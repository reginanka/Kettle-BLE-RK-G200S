import { bleController } from './bleController';
import { AudioReactiveStats } from '../types/kettle';
import { MODE } from './kettleProtocol';

type StatsCallback = (stats: AudioReactiveStats) => void;

class AudioVisualizerService {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphoneStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  private isRunning = false;
  private animFrameId: number | null = null;

  private sensitivity = 1.3;
  private noiseFloor = 15;
  private throttleIntervalMs = 135;

  private lastSendTime = 0;
  private lastColor = { r: -1, g: -1, b: -1 };
  private droppedFrames = 0;
  private sentFrames = 0;
  private frameCount = 0;
  private lastFpsCalcTime = 0;
  private currentFps = 0;

  private currentBass = 0;
  private currentMid = 0;
  private currentHigh = 0;

  private statsListeners = new Set<StatsCallback>();

  public subscribeStats(cb: StatsCallback): () => void {
    this.statsListeners.add(cb);
    cb(this.getStats());
    return () => this.statsListeners.delete(cb);
  }

  public getStats(): AudioReactiveStats {
    return {
      isActive: this.isRunning,
      bass: this.currentBass,
      mid: this.currentMid,
      high: this.currentHigh,
      fps: this.currentFps,
      droppedFrames: this.droppedFrames,
      sentFrames: this.sentFrames,
      sensitivity: this.sensitivity,
    };
  }

  private notifyStats(): void {
    const stats = this.getStats();
    this.statsListeners.forEach((cb) => cb(stats));
  }

  public setSensitivity(val: number): void {
    this.sensitivity = Math.max(0.4, Math.min(3.0, val));
    this.notifyStats();
  }

  public isActive(): boolean {
    return this.isRunning;
  }

  public async start(): Promise<boolean> {
    if (this.isRunning) return true;

    try {
      bleController.log('SYS', [], 'Запит доступу до мікрофона для світломузики...');
      bleController.pausePolling();

      this.microphoneStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.55;

      this.sourceNode = this.audioContext.createMediaStreamSource(this.microphoneStream);
      this.sourceNode.connect(this.analyser);

      this.isRunning = true;
      this.lastSendTime = 0;
      this.lastFpsCalcTime = performance.now();
      this.frameCount = 0;
      this.droppedFrames = 0;
      this.sentFrames = 0;

      bleController.log('SYS', [], 'Світломузика активована (Бас→R, Середні→G, Високі→B)');

      if (bleController.getState().isConnected) {
        await bleController.programAndStart(MODE.LIGHT, 100);
      }

      this.processLoop();
      this.notifyStats();
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      bleController.log('SYS', [], `Помилка доступу до мікрофона: ${msg}`);
      this.stop();
      return false;
    }
  }

  private processLoop = (): void => {
    if (!this.isRunning || !this.analyser || !this.audioContext) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    const sampleRate = this.audioContext.sampleRate || 48000;
    const binHz = sampleRate / this.analyser.fftSize;

    const bassBins = Math.max(1, Math.round(250 / binHz));
    const midBins = Math.max(bassBins + 1, Math.round(2000 / binHz));
    const highBins = Math.min(bufferLength, Math.round(8000 / binHz));

    let bassSum = 0;
    for (let i = 0; i < bassBins; i++) bassSum += dataArray[i];
    const rawBass = bassSum / (bassBins || 1);

    let midSum = 0;
    for (let i = bassBins; i < midBins; i++) midSum += dataArray[i];
    const rawMid = midSum / (midBins - bassBins || 1);

    let highSum = 0;
    for (let i = midBins; i < highBins; i++) highSum += dataArray[i];
    const rawHigh = highSum / (highBins - midBins || 1);

    const applyCurve = (raw: number, weight: number): number => {
      const filtered = Math.max(0, raw - this.noiseFloor);
      const scaled = filtered * this.sensitivity * weight;
      const normalized = Math.min(1, scaled / 200);
      return Math.round(Math.pow(normalized, 1.35) * 255);
    };

    const r = applyCurve(rawBass, 1.45);
    const g = applyCurve(rawMid, 1.25);
    const b = applyCurve(rawHigh, 1.6);

    this.currentBass = r;
    this.currentMid = g;
    this.currentHigh = b;

    this.frameCount++;
    const now = performance.now();
    if (now - this.lastFpsCalcTime >= 1000) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsCalcTime = now;
    }

    const timeSinceLastSend = now - this.lastSendTime;
    if (timeSinceLastSend >= this.throttleIntervalMs) {
      const colorDelta =
        Math.abs(r - this.lastColor.r) +
        Math.abs(g - this.lastColor.g) +
        Math.abs(b - this.lastColor.b);

      if (colorDelta > 14 || timeSinceLastSend > 800) {
        this.lastSendTime = now;
        this.lastColor = { r, g, b };

        void bleController.setRgbStream(r, g, b, 255, true).then((sent) => {
          if (sent) this.sentFrames++;
          else this.droppedFrames++;
        });
      }
    }

    this.notifyStats();
    this.animFrameId = requestAnimationFrame(this.processLoop);
  };

  public drawVisualization(canvas: HTMLCanvasElement, isDark: boolean): void {
    if (!this.analyser || !this.isRunning) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    ctx.clearRect(0, 0, width, height);

    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    if (isDark) {
      bgGrad.addColorStop(0, 'rgba(15, 23, 42, 0.9)');
      bgGrad.addColorStop(1, 'rgba(2, 6, 23, 0.98)');
    } else {
      bgGrad.addColorStop(0, 'rgba(241, 245, 249, 0.95)');
      bgGrad.addColorStop(1, 'rgba(226, 232, 240, 0.98)');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    const barCount = 36;
    const barWidth = width / barCount - 2;
    const step = Math.floor(bufferLength / barCount);

    for (let i = 0; i < barCount; i++) {
      let sum = 0;
      for (let j = 0; j < step; j++) {
        sum += dataArray[i * step + j] || 0;
      }
      const avg = (sum / step) * (this.sensitivity * 0.9);
      const barHeight = Math.min(height - 4, (avg / 255) * height);
      const x = i * (barWidth + 2) + 2;
      const y = height - barHeight;

      const barGrad = ctx.createLinearGradient(0, height, 0, y);
      if (i < 10) {
        barGrad.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
        barGrad.addColorStop(1, '#ef4444');
      } else if (i < 22) {
        barGrad.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
        barGrad.addColorStop(1, '#10b981');
      } else {
        barGrad.addColorStop(0, 'rgba(14, 165, 233, 0.35)');
        barGrad.addColorStop(1, '#0ea5e9');
      }

      ctx.fillStyle = barGrad;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 0, 0]);
      ctx.fill();

      if (barHeight > 6) {
        ctx.fillStyle = isDark ? '#ffffff' : '#0f172a';
        ctx.fillRect(x, y - 2, barWidth, 2);
      }
    }
  }

  public stop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // ignore
      }
      this.sourceNode = null;
    }
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {
        // ignore
      }
      this.analyser = null;
    }
    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach((track) => track.stop());
      this.microphoneStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        void this.audioContext.close();
      } catch {
        // ignore
      }
      this.audioContext = null;
    }

    this.isRunning = false;
    this.currentBass = 0;
    this.currentMid = 0;
    this.currentHigh = 0;
    this.currentFps = 0;

    bleController.log('SYS', [], 'Світломузика зупинена, мікрофон вимкнено.');
    bleController.resumePolling();
    this.notifyStats();
  }
}

export const audioVisualizer = new AudioVisualizerService();
