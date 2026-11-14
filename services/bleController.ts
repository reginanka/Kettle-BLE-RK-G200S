import {
  AlertSettings,
  AppAlertBanner,
  BleDiagnosticCode,
  HexLogEntry,
  KettleModeName,
  KettleState,
  RgbTuple,
  ScheduleJob,
} from '../types/kettle';
import {
  CMD,
  LIGHT_TYPE,
  MODE,
  bytesToCompactHex,
  bytesToHex,
  createAuthPacket,
  createCommitPacket,
  createCountPacket,
  createFreshGetPacket,
  createFreshSetPacket,
  createGetStatusPacket,
  createImpulsePacket,
  createIntervalPacket,
  createLampHoursGetPacket,
  createLampHoursSetPacket,
  createLightGetPacket,
  createLightSwitchPacket,
  createPaletteGetPacket,
  createPalettePacket,
  createReadTimePacket,
  createSetModePacket,
  createSetRgbPacket,
  createSoundPacket,
  createStartPacket,
  createStatsPacket,
  createStopPacket,
  createSyncTimePacket,
  createVersionPacket,
  cssHex,
  getOrCreateAuthKey,
  interpretPacket,
  keyFromMac,
  parseAuthKeyHex,
  parseCssHex,
  parseIncomingFrame,
  regenerateRandomAuthKey,
  resetCounter,
  saveAuthKey,
} from './kettleProtocol';
import {
  KettleTransport,
  createDefaultBleTransport,
  isBleSupported,
} from './bleTransport';
import {
  loadAlertSettings,
  playNotificationChime,
  saveAlertSettings,
  sendSystemNotification,
} from './notifications';

type StateCallback = (state: KettleState) => void;
type LogCallback = (log: HexLogEntry) => void;
type ScheduleCallback = (jobs: ScheduleJob[]) => void;
type AlertCallback = (alert: AppAlertBanner) => void;
type AlertSettingsCallback = (settings: AlertSettings) => void;

const SCHEDULE_STORAGE_KEY = 'skykettle_schedule_jobs_v1';

function loadScheduleJobs(): ScheduleJob[] {
  try {
    const raw = localStorage.getItem(SCHEDULE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveScheduleJobs(jobs: ScheduleJob[]): void {
  try {
    localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(jobs));
  } catch {
    // ignore storage errors
  }
}

function modeCodeToName(modeCode: number, running: boolean): KettleModeName {
  if (!running) return 'standby';
  switch (modeCode) {
    case MODE.BOIL:
      return 'boil';
    case MODE.HEAT:
      return 'heat';
    case MODE.BOIL_HEAT:
      return 'boilHeat';
    case MODE.LAMP:
      return 'nightlight';
    case MODE.LIGHT:
      return 'light';
    default:
      return 'boil';
  }
}

class BleController {
  private transport: KettleTransport = createDefaultBleTransport();

  private stateListeners = new Set<StateCallback>();
  private logListeners = new Set<LogCallback>();
  private scheduleListeners = new Set<ScheduleCallback>();
  private alertListeners = new Set<AlertCallback>();
  private alertSettingsListeners = new Set<AlertSettingsCallback>();

  private pendingRequests = new Map<number, (buf: Uint8Array) => void>();
  private commandChain: Promise<void> = Promise.resolve();
  private isStreamingInFlight = false;

  private loopTimerId: number | null = null;
  private pollAcc = 0;
  private lastTickTime = 0;
  private scheduleMark = '';

  private pairingTimerId: number | null = null;
  private pairingBaselineCaptured = false;
  private pairingBaselineSound = true;
  private pairingBaselineParental = false;
  private userInitiatedDisconnect = false;
  private isPollingPaused = false;
  private wasActivelyHeating = false;
  private staleNotified = false;
  private lang: 'uk' | 'en' = 'uk';

  private jobs: ScheduleJob[] = loadScheduleJobs();
  private alertSettings: AlertSettings = loadAlertSettings();

  private state: KettleState = {
    isConnected: false,
    isConnecting: false,
    isAuthorized: false,
    isPairing: false,
    pairingAttempts: 0,
    deviceName: '',
    firmware: '—',
    authKeyHex: bytesToCompactHex(getOrCreateAuthKey()),
    macAddress: '',
    error: null,
    diagnosticCode: null,

    currentTemp: 24,
    targetTemp: 100,
    selectedMode: MODE.BOIL,
    activeMode: 'standby',
    isWorking: false,
    isHolding: false,
    soundEnabled: true,
    parentalLock: false,
    errorCode: 0,
    boilOffset: 0,

    backlightColor: { r: 6, g: 182, b: 212 },
    flashColor: null,
    brightness: 255,
    colorInterval: 30,
    lampHours: 8,
    lightBoil: true,
    lightSync: true,
    boilScale: ['#38bdf8', '#f59e0b', '#ef4444'],
    nightScale: ['#06b6d4', '#8b5cf6', '#f97316'],

    boilsCount: 0,
    energyWh: 0,
    ontimeSeconds: 0,
    heaterResource: 0,
    freshOn: true,
    freshHours: 0,
    kettleTimeText: null,
  };

  public isBluetoothSupported(): boolean {
    return isBleSupported();
  }

  public setTransport(customTransport: KettleTransport): void {
    this.transport = customTransport;
  }

  public clearDiagnostic(): void {
    this.notifyState({ diagnosticCode: null, error: null });
  }

  private classifyConnectError(msg: string): BleDiagnosticCode | null {
    if (/скасовано|cancel|notfounderror/i.test(msg)) return 'cancelled';
    if (/увімкніть bluetooth|bluetooth.*off|disabled|powered off/i.test(msg)) return 'bluetooth_disabled';
    if (/permission|location|геолокац|дозвіл|denied/i.test(msg)) return 'permission_or_location';
    if (/gatt|timeout|disconnected|write\/notify|не знайдено|не вдалась/i.test(msg)) return 'gatt_busy_or_timeout';
    return null;
  }

  public subscribeState(cb: StateCallback): () => void {
    this.stateListeners.add(cb);
    cb({ ...this.state });
    return () => this.stateListeners.delete(cb);
  }

  public subscribeLogs(cb: LogCallback): () => void {
    this.logListeners.add(cb);
    return () => this.logListeners.delete(cb);
  }

  public subscribeSchedule(cb: ScheduleCallback): () => void {
    this.scheduleListeners.add(cb);
    cb([...this.jobs]);
    return () => this.scheduleListeners.delete(cb);
  }

  public subscribeAlerts(cb: AlertCallback): () => void {
    this.alertListeners.add(cb);
    return () => this.alertListeners.delete(cb);
  }

  public subscribeAlertSettings(cb: AlertSettingsCallback): () => void {
    this.alertSettingsListeners.add(cb);
    cb({ ...this.alertSettings });
    return () => this.alertSettingsListeners.delete(cb);
  }

  public getAlertSettings(): AlertSettings {
    return { ...this.alertSettings };
  }

  public updateAlertSettings(partial: Partial<AlertSettings>): void {
    this.alertSettings = { ...this.alertSettings, ...partial };
    saveAlertSettings(this.alertSettings);
    const snap = { ...this.alertSettings };
    this.alertSettingsListeners.forEach((cb) => cb(snap));
    if (partial.staleLimitHours !== undefined || partial.staleAlertEnabled === false) {
      this.staleNotified = false;
    }
  }

  public setLanguage(lang: 'uk' | 'en'): void {
    this.lang = lang;
  }

  public testAlert(kind: 'boil' | 'stale' = 'boil'): void {
    const en = this.lang === 'en';
    if (kind === 'boil') {
      this.emitAlert(
        'boil',
        en ? 'Water boiled!' : 'Вода закипіла!',
        en ? 'Test notification: kettle reached target temperature.' : 'Тестове сповіщення: чайник досяг заданої температури.'
      );
    } else {
      this.emitAlert(
        'stale',
        en ? 'Stale water' : 'Вода застоялася',
        en ? 'Test notification: time to refresh the water.' : 'Тестове сповіщення: час оновити воду в чайнику.'
      );
    }
  }

  private emitAlert(kind: 'boil' | 'stale', title: string, message: string): void {
    const alert: AppAlertBanner = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind,
      title,
      message,
    };
    if (this.alertSettings.soundChimeEnabled) {
      playNotificationChime(kind);
    }
    sendSystemNotification(title, message);
    this.log('SYS', [], `${title} — ${message}`);
    this.alertListeners.forEach((cb) => cb(alert));
  }

  public getState(): KettleState {
    return { ...this.state };
  }

  private notifyState(partial?: Partial<KettleState>): void {
    if (partial) {
      this.state = { ...this.state, ...partial };
    }
    const snapshot = { ...this.state };
    this.stateListeners.forEach((cb) => cb(snapshot));
  }

  private notifySchedule(): void {
    const copy = [...this.jobs];
    this.scheduleListeners.forEach((cb) => cb(copy));
  }

  public log(direction: 'TX' | 'RX' | 'SYS', bytes: number[], notes?: string): void {
    const hex = bytes.length > 0 ? bytesToHex(bytes) : '';
    const info = bytes.length > 0 ? interpretPacket(bytes) : { name: notes || 'Подія системи' };
    const entry: HexLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toLocaleTimeString('uk-UA', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
      }),
      direction,
      hex,
      bytes,
      commandName: info.name,
      notes: notes || info.notes,
    };
    this.logListeners.forEach((cb) => cb(entry));
  }

  // ==================== KEY & MAC MANAGEMENT ====================

  public setAuthKeyHex(hexInput: string): void {
    const clean = hexInput.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 16);
    this.notifyState({ authKeyHex: clean, error: null });
    const parsed = parseAuthKeyHex(clean);
    if (parsed) {
      saveAuthKey(parsed);
    }
  }

  public setMacAddress(macInput: string): void {
    const clean = macInput.toUpperCase().replace(/[^0-9A-F:]/g, '').slice(0, 17);
    this.notifyState({ macAddress: clean, error: null });
  }

  public deriveKeyFromMac(): boolean {
    const derived = keyFromMac(this.state.macAddress);
    if (!derived) {
      this.notifyState({
        error:
          this.lang === 'en'
            ? 'MAC address must follow AA:BB:CC:DD:EE:FF format.'
            : 'MAC-адреса має бути у форматі AA:BB:CC:DD:EE:FF.',
      });
      return false;
    }
    saveAuthKey(derived);
    const hex = bytesToCompactHex(derived);
    this.notifyState({ authKeyHex: hex, error: null });
    this.log('SYS', [], `Згенеровано ключ із MAC: ${hex}`);
    return true;
  }

  public regenerateAuthKey(): string {
    const key = regenerateRandomAuthKey();
    const hex = bytesToCompactHex(key);
    this.notifyState({ authKeyHex: hex, error: null });
    this.log('SYS', [], `Створено новий 8-байтний ключ: ${hex}`);
    if (this.state.isConnected) {
      this.startPairingRoutine();
    }
    return hex;
  }

  public setFactoryAuthKey(): void {
    const hex = 'FFFFFFFFFFFFFFFF';
    const parsed = parseAuthKeyHex(hex);
    if (parsed) {
      saveAuthKey(parsed);
    }
    this.notifyState({ authKeyHex: hex, error: null });
    this.log('SYS', [], `Встановлено заводський ключ: ${hex}`);
    if (this.state.isConnected && !this.state.isAuthorized) {
      this.startPairingRoutine();
    }
  }

  // ==================== CONNECTION ====================

  public async connect(): Promise<boolean> {
    if (!this.isBluetoothSupported()) {
      const msg =
        this.lang === 'en'
          ? 'Web Bluetooth is unavailable in this browser. Open in Google Chrome or Microsoft Edge over HTTPS or localhost.'
          : 'Web Bluetooth недоступний у цьому браузері. Відкрийте у Google Chrome або Microsoft Edge (по HTTPS або localhost).';
      this.notifyState({ error: msg });
      this.log('SYS', [], msg);
      return false;
    }

    this.userInitiatedDisconnect = true;
    this.disconnectQuiet();
    this.userInitiatedDisconnect = false;
    resetCounter();
    this.notifyState({ isConnecting: true, error: null, diagnosticCode: null });

    try {
      await this.transport.connect(
        () => this.handleDisconnected(),
        (bytes) => this.handleIncomingBytes(bytes),
        (msg) => this.log('SYS', [], msg)
      );

      this.notifyState({
        isConnected: true,
        isConnecting: false,
        isAuthorized: false,
        deviceName: this.transport.deviceName,
        error: null,
        diagnosticCode: null,
      });

      this.startLoop();

      // Try single auth immediately
      const parsedKey = parseAuthKeyHex(this.state.authKeyHex) ?? getOrCreateAuthKey();
      const authRes = await this.sendPacketWithReply(createAuthPacket(parsedKey));
      if (authRes && authRes[3] === 0x01) {
        await this.onAuthorized();
      } else {
        this.log('SYS', [], 'Чайник очікує підтвердження прив’язки. Затисніть кнопку ввімкнення ⏻ на ручці на 5–10 сек до 3 сигналів.');
        this.startPairingRoutine();
      }

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Помилка підключення BLE';
      const diagnosticCode = this.classifyConnectError(msg);
      this.log('SYS', [], `Помилка підключення: ${msg}`);
      this.notifyState({
        isConnected: false,
        isConnecting: false,
        isAuthorized: false,
        error: msg,
        diagnosticCode,
      });
      return false;
    }
  }

  private async onAuthorized(): Promise<void> {
    this.stopPairingRoutine();
    this.notifyState({
      isAuthorized: true,
      isPairing: false,
      error: null,
      diagnosticCode: null,
    });
    this.log('SYS', [], 'Авторизацію 0xFF 01 підтверджено. Зчитування стану чайника...');
    await this.performInitialHandshake();
  }

  private async performInitialHandshake(): Promise<void> {
    await this.sendPacketWithReply(createVersionPacket());
    const tz = -new Date().getTimezoneOffset() * 60;
    await this.sendPacketWithReply(createSyncTimePacket(Math.floor(Date.now() / 1000), tz));
    await this.refreshAll();
  }

  public startPairingRoutine(): void {
    this.stopPairingRoutine();
    if (!this.state.isConnected) return;

    this.pairingBaselineCaptured = false;
    this.notifyState({ isPairing: true, pairingAttempts: 0, diagnosticCode: null });

    const attemptAuth = async () => {
      if (!this.state.isConnected || this.state.isAuthorized) {
        this.stopPairingRoutine();
        return;
      }

      const nextAttempt = this.state.pairingAttempts + 1;
      if (nextAttempt > 40) {
        this.stopPairingRoutine();
        this.notifyState({ diagnosticCode: 'pairing_timeout' });
        this.log('SYS', [], 'Час очікування прив’язки вичерпано. Спочатку затисніть ⏻ на чайнику (5–10 сек до 3 сигналів), а потім натисніть «Підключити».');
        return;
      }

      if (nextAttempt === 12 && !this.state.diagnosticCode) {
        this.notifyState({ diagnosticCode: 'auth_rejected_still_waiting' });
      }

      this.notifyState({ pairingAttempts: nextAttempt });
      const key = parseAuthKeyHex(this.state.authKeyHex) ?? getOrCreateAuthKey();
      const reply = await this.sendPacketWithReply(createAuthPacket(key));
      if (reply && reply[3] === 0x01) {
        await this.onAuthorized();
      }
    };

    void attemptAuth();
    this.pairingTimerId = window.setInterval(() => {
      void attemptAuth();
    }, 650);
  }

  public stopPairingRoutine(): void {
    if (this.pairingTimerId !== null) {
      clearInterval(this.pairingTimerId);
      this.pairingTimerId = null;
    }
    this.notifyState({ isPairing: false });
  }

  public disconnect(): void {
    this.userInitiatedDisconnect = true;
    this.disconnectQuiet();
    this.handleDisconnected();
    this.userInitiatedDisconnect = false;
  }

  private disconnectQuiet(): void {
    this.stopPairingRoutine();
    this.stopLoop();
    this.pendingRequests.forEach((_, iter) => this.pendingRequests.delete(iter));
    this.transport.disconnect();
  }

  private handleDisconnected(): void {
    const wasPairing = this.state.isPairing;
    const wasUnauthConnected = this.state.isConnected && !this.state.isAuthorized;
    const droppedUnexpectedlyDuringPairing = !this.userInitiatedDisconnect && (wasPairing || wasUnauthConnected);
    this.stopPairingRoutine();
    this.stopLoop();
    this.wasActivelyHeating = false;
    this.notifyState({
      isConnected: false,
      isConnecting: false,
      isAuthorized: false,
      isWorking: false,
      isHolding: false,
      activeMode: 'standby',
      lastStatusTime: undefined,
      diagnosticCode: droppedUnexpectedlyDuringPairing ? 'kettle_reset_pairing' : this.state.diagnosticCode,
    });
    this.log(
      'SYS',
      [],
      droppedUnexpectedlyDuringPairing
        ? 'З’єднання з чайником закрито. Якщо на чайнику щойно замигали індикатори — натисніть «Підключити» ще раз прямо зараз.'
        : 'З’єднання з чайником закрито.'
    );
  }

  // ==================== PACKET QUEUE & STREAMING ====================

  private handleIncomingBytes(bytes: Uint8Array): void {
    const arr = Array.from(bytes);
    this.log('RX', arr);

    const parsed = parseIncomingFrame(bytes);
    this.applyParsedFrame(parsed);

    const iter = bytes[1] ?? 0;
    const resolver = this.pendingRequests.get(iter);
    if (resolver) {
      this.pendingRequests.delete(iter);
      resolver(bytes);
    }
  }

  private applyParsedFrame(parsed: ReturnType<typeof parseIncomingFrame>): void {
    switch (parsed.kind) {
      case 'version':
        this.notifyState({ firmware: parsed.text });
        break;

      case 'status': {
        const activeMode = modeCodeToName(parsed.mode, parsed.running);
        const isHeatingMode =
          parsed.mode === MODE.BOIL ||
          parsed.mode === MODE.HEAT ||
          parsed.mode === MODE.BOIL_HEAT;
        const holding =
          parsed.running &&
          (parsed.mode === MODE.HEAT || parsed.mode === MODE.BOIL_HEAT) &&
          parsed.current >= parsed.target - 1;

        if (this.alertSettings.boilAlertEnabled && parsed.error === 0) {
          const finishedBoil =
            this.wasActivelyHeating &&
            !parsed.running &&
            parsed.current >= Math.max(40, this.state.targetTemp - 2);
          const reachedHold =
            this.wasActivelyHeating &&
            holding &&
            !this.state.isHolding;

          if (finishedBoil || reachedHold) {
            const en = this.lang === 'en';
            this.emitAlert(
              'boil',
              parsed.target >= 100
                ? en ? 'Kettle boiled!' : 'Чайник закипів!'
                : en ? `Heated to ${parsed.current}°C` : `Нагріто до ${parsed.current}°C`,
              holding
                ? en
                  ? `Keeping warm at ${parsed.target}°C.`
                  : `Увімкнено підтримку температури ${parsed.target}°C.`
                : en
                ? `Water temperature reached ${parsed.current}°C.`
                : `Температура води досягла ${parsed.current}°C.`
            );
            this.wasActivelyHeating = false;
          }
        }

        if (parsed.running && isHeatingMode && !holding) {
          this.wasActivelyHeating = true;
        } else if (!parsed.running) {
          this.wasActivelyHeating = false;
        }

        let nextDiagnostic = this.state.diagnosticCode;
        if (this.state.isPairing && !this.state.isAuthorized) {
          if (!this.pairingBaselineCaptured) {
            this.pairingBaselineCaptured = true;
            this.pairingBaselineSound = parsed.sound;
            this.pairingBaselineParental = parsed.parental;
          } else if (
            parsed.sound !== this.pairingBaselineSound ||
            parsed.parental !== this.pairingBaselineParental
          ) {
            this.pairingBaselineSound = parsed.sound;
            this.pairingBaselineParental = parsed.parental;
            if (nextDiagnostic !== 'wrong_button_sound') {
              nextDiagnostic = 'wrong_button_sound';
              this.log(
                'SYS',
                [],
                'Виявлено перемикання звуку/блокування — схоже, натиснуто «+» замість кнопки живлення ⏻.'
              );
            }
          }
        }

        this.notifyState({
          currentTemp: parsed.current,
          targetTemp: parsed.target,
          selectedMode: parsed.mode,
          activeMode,
          isWorking: parsed.running,
          isHolding: holding,
          soundEnabled: parsed.sound,
          colorInterval: Math.max(30, parsed.colorInterval || 30),
          parentalLock: parsed.parental,
          errorCode: parsed.error,
          boilOffset: parsed.boilOffset,
          lastStatusTime: Date.now(),
          diagnosticCode: nextDiagnostic,
        });
        break;
      }

      case 'stats':
        this.notifyState({
          ontimeSeconds: parsed.ontime,
          energyWh: parsed.wh,
          heaterResource: parsed.heater,
          boilsCount: this.state.boilsCount || parsed.heater,
        });
        break;

      case 'count':
        this.notifyState({ boilsCount: parsed.n });
        break;

      case 'hours':
        this.notifyState({ lampHours: Math.max(1, Math.min(12, parsed.n || 8)) });
        break;

      case 'fresh': {
        if (
          this.alertSettings.staleAlertEnabled &&
          parsed.on &&
          parsed.hours >= this.alertSettings.staleLimitHours &&
          !this.staleNotified
        ) {
          this.staleNotified = true;
          const en = this.lang === 'en';
          this.emitAlert(
            'stale',
            en ? 'Stale water' : 'Вода застоялася',
            en
              ? `Water has been sitting for ${parsed.hours}h (limit ${this.alertSettings.staleLimitHours}h). Time to refresh.`
              : `Вода у чайнику стоїть уже ${parsed.hours} год (ліміт ${this.alertSettings.staleLimitHours} год). Пора оновити.`
          );
        } else if (!parsed.on || parsed.hours < this.alertSettings.staleLimitHours) {
          this.staleNotified = false;
        }
        this.notifyState({ freshOn: parsed.on, freshHours: parsed.hours });
        break;
      }

      case 'time': {
        if (parsed.unix > 0) {
          const d = new Date((parsed.unix + parsed.offset) * 1000);
          const pad = (n: number) => String(n).padStart(2, '0');
          const hhmmss = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
          const ddmmyy = `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
          const utcH = Math.round(parsed.offset / 3600);
          const utcLabel = `UTC${utcH >= 0 ? `+${utcH}` : utcH}`;
          this.notifyState({ kettleTimeText: `${hhmmss} · ${ddmmyy} (${utcLabel})` });
        } else {
          this.notifyState({
            kettleTimeText: this.lang === 'en' ? 'Time not set' : 'Час не встановлено',
          });
        }
        break;
      }

      case 'palette': {
        const colors: [string, string, string] = [
          cssHex(parsed.colors[0]),
          cssHex(parsed.colors[1]),
          cssHex(parsed.colors[2]),
        ];
        if (parsed.kindType === LIGHT_TYPE.LAMP) {
          this.notifyState({
            nightScale: colors,
            brightness: parsed.brightness[0] || this.state.brightness,
          });
        } else {
          this.notifyState({ boilScale: colors });
        }
        break;
      }

      default:
        break;
    }
  }

  /**
   * Serialized packet send that waits for response matching `iter` byte.
   */
  public sendPacketWithReply(packet: Uint8Array): Promise<Uint8Array | null> {
    const task = async (): Promise<Uint8Array | null> => {
      if (!this.state.isConnected) return null;
      const bytes = Array.from(packet);
      this.log('TX', bytes);

      const iter = packet[1] ?? 0;
      return new Promise<Uint8Array | null>((resolve) => {
        const timer = window.setTimeout(() => {
          this.pendingRequests.delete(iter);
          resolve(null);
        }, 3500);

        this.pendingRequests.set(iter, (buf) => {
          clearTimeout(timer);
          resolve(buf);
        });

        this.transport.write(packet).catch((err) => {
          clearTimeout(timer);
          this.pendingRequests.delete(iter);
          this.log('SYS', [], `Помилка запису BLE: ${err instanceof Error ? err.message : String(err)}`);
          resolve(null);
        });
      });
    };

    const next = this.commandChain.then(task);
    this.commandChain = next.then(() => undefined, () => undefined);
    return next;
  }

  /**
   * Fire-and-forget packet with Drop-Frame protection for 7-8 fps audio streaming
   */
  public async sendRawPacket(packet: Uint8Array, allowDrop = false): Promise<boolean> {
    if (!this.state.isConnected) return false;

    if (this.isStreamingInFlight) {
      if (allowDrop) return false;
    }

    this.isStreamingInFlight = true;
    try {
      const bytes = Array.from(packet);
      this.log('TX', bytes);

      await this.transport.write(packet);
      return true;
    } catch (err) {
      this.log('SYS', [], `Помилка потокового запису: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    } finally {
      this.isStreamingInFlight = false;
    }
  }

  // ==================== KETTLE COMMANDS ====================

  public setSelectedMode(modeCode: number): void {
    this.notifyState({ selectedMode: modeCode });
  }

  public setTargetTemp(temp: number): void {
    const clamped = Math.max(40, Math.min(100, Math.round(temp)));
    this.notifyState({ targetTemp: clamped });
  }

  public async programAndStart(modeCode: number, targetTemp: number): Promise<boolean> {
    const effectiveTemp = modeCode === MODE.BOIL ? 100 : targetTemp;
    this.notifyState({ selectedMode: modeCode, targetTemp: effectiveTemp, error: null });

    if (modeCode === MODE.LAMP || modeCode === MODE.LIGHT) {
      const colorsHex = modeCode === MODE.LIGHT
        ? [this.state.nightScale[0], this.state.nightScale[0], this.state.nightScale[0]]
        : this.state.nightScale;
      const colors = colorsHex.map(parseCssHex) as [RgbTuple, RgbTuple, RgbTuple];
      await this.sendPacketWithReply(createPalettePacket(true, colors, this.state.brightness));
      await this.sendPacketWithReply(createCommitPacket());
      if (modeCode === MODE.LAMP) {
        await this.sendPacketWithReply(createIntervalPacket(this.state.colorInterval));
      }
      const [r, g, b] = colors[0];
      this.notifyState({ backlightColor: { r, g, b } });
    }

    const modeAck = await this.sendPacketWithReply(createSetModePacket(modeCode, effectiveTemp, this.state.boilOffset));
    if (!modeAck) return false;

    const startAck = await this.sendPacketWithReply(createStartPacket());
    if (startAck && startAck[3] === 0x00) {
      this.notifyState({
        error:
          this.lang === 'en'
            ? 'Kettle rejected start (check water level, base placement, or handle lock).'
            : 'Чайник відхилив пуск (перевірте воду, базу або замок кнопок).',
      });
    }
    await this.sendPacketWithReply(createGetStatusPacket());
    return true;
  }

  public async stop(): Promise<void> {
    await this.sendPacketWithReply(createStopPacket());
    await this.sendPacketWithReply(createGetStatusPacket());
  }

  public async setRgbStream(r: number, g: number, b: number, brightness = 255, allowDrop = true): Promise<boolean> {
    const packet = createSetRgbPacket(r, g, b, brightness);
    const ok = await this.sendRawPacket(packet, allowDrop);
    if (ok) {
      this.notifyState({ backlightColor: { r, g, b }, brightness });
    }
    return ok;
  }

  public async turnOnNightlight(r: number, g: number, b: number, brightness = 255): Promise<void> {
    const hex = cssHex([r, g, b]);
    const scale: [string, string, string] = [hex, hex, hex];
    this.notifyState({ nightScale: scale, backlightColor: { r, g, b }, brightness, selectedMode: MODE.LIGHT });
    await this.programAndStart(MODE.LIGHT, 100);
  }

  public async applyPalette(isLamp: boolean, commitToEeprom = true): Promise<void> {
    const hexScale = isLamp ? this.state.nightScale : this.state.boilScale;
    const colors = hexScale.map(parseCssHex) as [RgbTuple, RgbTuple, RgbTuple];
    await this.sendPacketWithReply(createPalettePacket(isLamp, colors, this.state.brightness));
    if (commitToEeprom) {
      await this.sendPacketWithReply(createCommitPacket());
    }
    if (isLamp) {
      const [r, g, b] = colors[0];
      this.notifyState({ backlightColor: { r, g, b } });
    }
  }

  public async readPalette(isLamp: boolean): Promise<void> {
    if (!this.state.isConnected) return;
    await this.sendPacketWithReply(createPaletteGetPacket(isLamp));
  }

  public updateNightScaleColor(index: 0 | 1 | 2, hex: string): void {
    const next = [...this.state.nightScale] as [string, string, string];
    next[index] = hex;
    const [r, g, b] = parseCssHex(next[0]);
    this.notifyState({ nightScale: next, backlightColor: { r, g, b } });
  }

  public updateBoilScaleColor(index: 0 | 1 | 2, hex: string): void {
    const next = [...this.state.boilScale] as [string, string, string];
    next[index] = hex;
    this.notifyState({ boilScale: next });
  }

  public setBrightness(val: number): void {
    this.notifyState({ brightness: Math.max(20, Math.min(255, Math.round(val))) });
  }

  public async setColorInterval(secs: number): Promise<void> {
    const clamped = Math.max(30, Math.min(180, Math.round(secs)));
    this.notifyState({ colorInterval: clamped });
    await this.sendPacketWithReply(createIntervalPacket(clamped));
  }

  public async setLampHours(hours: number): Promise<void> {
    const clamped = Math.max(1, Math.min(12, Math.round(hours)));
    this.notifyState({ lampHours: clamped });
    await this.sendPacketWithReply(createLampHoursSetPacket(clamped));
    await this.sendPacketWithReply(createLampHoursGetPacket());
  }

  public async setLightFeature(which: 'boil' | 'sync', on: boolean): Promise<void> {
    const type = which === 'boil' ? LIGHT_TYPE.BOIL : LIGHT_TYPE.SYNC;
    if (which === 'boil') this.notifyState({ lightBoil: on });
    else this.notifyState({ lightSync: on });
    await this.sendPacketWithReply(createLightSwitchPacket(type, on));
  }

  public async flashImpulse(rgbOverride?: RgbTuple, durationMs = 900): Promise<void> {
    const rgb = rgbOverride ?? parseCssHex(this.state.nightScale[0]);
    const hex = cssHex(rgb);
    this.notifyState({ flashColor: hex });
    await this.sendPacketWithReply(createImpulsePacket(rgb, this.state.brightness));
    window.setTimeout(() => {
      if (this.state.flashColor === hex) {
        this.notifyState({ flashColor: null });
      }
    }, durationMs);
  }

  public async runDiscoSequence(): Promise<void> {
    const palette: RgbTuple[] = [
      [239, 68, 68],
      [245, 158, 11],
      [16, 185, 129],
      [59, 130, 246],
      [168, 85, 247],
    ];
    for (const color of palette) {
      if (!this.state.isConnected) break;
      const hex = cssHex(color);
      this.notifyState({ flashColor: hex });
      await this.sendPacketWithReply(createImpulsePacket(color, 255));
      await new Promise((r) => setTimeout(r, 380));
    }
    this.notifyState({ flashColor: null });
  }

  public async setSound(on: boolean): Promise<void> {
    this.notifyState({ soundEnabled: on });
    await this.sendPacketWithReply(createSoundPacket(on));
    await this.sendPacketWithReply(createGetStatusPacket());
  }

  public async setBoilOffset(offset: number): Promise<void> {
    const clamped = Math.max(-5, Math.min(5, Math.round(offset)));
    this.notifyState({ boilOffset: clamped });
    if (this.state.isWorking) return;
    await this.sendPacketWithReply(createSetModePacket(this.state.selectedMode, this.state.targetTemp, clamped));
    await this.sendPacketWithReply(createGetStatusPacket());
  }

  public async setFreshnessReminder(on: boolean): Promise<void> {
    this.notifyState({ freshOn: on });
    await this.sendPacketWithReply(createFreshSetPacket(on));
    await this.sendPacketWithReply(createFreshGetPacket());
  }

  public async syncClock(): Promise<void> {
    const tz = -new Date().getTimezoneOffset() * 60;
    await this.sendPacketWithReply(createSyncTimePacket(Math.floor(Date.now() / 1000), tz));
    await this.readClock();
  }

  public async readClock(): Promise<void> {
    if (!this.state.isConnected) return;
    await this.sendPacketWithReply(createReadTimePacket());
  }

  public async refreshAll(): Promise<void> {
    if (!this.state.isConnected) return;
    await this.sendPacketWithReply(createGetStatusPacket());
    await this.sendPacketWithReply(createStatsPacket());
    await this.sendPacketWithReply(createCountPacket());
    await this.sendPacketWithReply(createLampHoursGetPacket());
    await this.sendPacketWithReply(createFreshGetPacket());
    await this.sendPacketWithReply(createReadTimePacket());
    await this.sendPacketWithReply(createPaletteGetPacket(false));
    await this.sendPacketWithReply(createPaletteGetPacket(true));
    const boilLight = await this.sendPacketWithReply(createLightGetPacket(LIGHT_TYPE.BOIL));
    if (boilLight) {
      const parsed = parseIncomingFrame(boilLight);
      if (parsed.kind === 'light') this.notifyState({ lightBoil: parsed.on });
    }
    const syncLight = await this.sendPacketWithReply(createLightGetPacket(LIGHT_TYPE.SYNC));
    if (syncLight) {
      const parsed = parseIncomingFrame(syncLight);
      if (parsed.kind === 'light') this.notifyState({ lightSync: parsed.on });
    }
  }

  // ==================== SCHEDULE MANAGEMENT ====================

  public addScheduleJob(job: Omit<ScheduleJob, 'id'>): void {
    this.jobs = [...this.jobs, { ...job, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }];
    saveScheduleJobs(this.jobs);
    this.notifySchedule();
  }

  public toggleScheduleJob(id: string): void {
    this.jobs = this.jobs.map((j) => (j.id === id ? { ...j, enabled: !j.enabled } : j));
    saveScheduleJobs(this.jobs);
    this.notifySchedule();
  }

  public removeScheduleJob(id: string): void {
    this.jobs = this.jobs.filter((j) => j.id !== id);
    saveScheduleJobs(this.jobs);
    this.notifySchedule();
  }

  // ==================== POLLING & TICK LOOP ====================

  public pausePolling(): void {
    this.isPollingPaused = true;
    this.log('SYS', [], 'Фонове опитування 0x06 призупинено для потокової світломузики');
  }

  public resumePolling(): void {
    this.isPollingPaused = false;
    this.log('SYS', [], 'Фонове опитування 0x06 відновлено');
    if (this.state.isConnected && this.state.isAuthorized) {
      void this.sendPacketWithReply(createGetStatusPacket());
    }
  }

  private startLoop(): void {
    this.stopLoop();
    this.lastTickTime = performance.now();
    this.pollAcc = 0;

    this.loopTimerId = window.setInterval(() => {
      const nowMs = performance.now();
      const dt = Math.min(0.5, (nowMs - this.lastTickTime) / 1000);
      this.lastTickTime = nowMs;

      // Schedule checker
      const now = new Date();
      const mark = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (!this.scheduleMark) {
        this.scheduleMark = mark;
      } else if (mark !== this.scheduleMark && this.state.isConnected && this.state.isAuthorized) {
        this.scheduleMark = mark;
        const due = this.jobs.filter((j) => j.enabled && j.hhmm === hhmm);
        if (due.length > 0) {
          const job = due[0];
          if (job.repeat === 'once') {
            this.jobs = this.jobs.map((j) => (j.id === job.id ? { ...j, enabled: false } : j));
            saveScheduleJobs(this.jobs);
            this.notifySchedule();
          }
          this.log('SYS', [], `Спрацював розклад на ${job.hhmm}`);
          void this.programAndStart(job.mode, job.temp);
        }
      }

      // Status polling every 2.5s
      this.pollAcc += dt;
      if (this.pollAcc >= 2.5 && !this.isPollingPaused && this.state.isConnected && this.state.isAuthorized) {
        this.pollAcc = 0;
        void this.sendPacketWithReply(createGetStatusPacket());
      }
    }, 250);
  }

  private stopLoop(): void {
    if (this.loopTimerId !== null) {
      clearInterval(this.loopTimerId);
      this.loopTimerId = null;
    }
  }
}

export const bleController = new BleController();
