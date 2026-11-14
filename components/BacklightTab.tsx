import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Disc3,
  Mic,
  MicOff,
  Moon,
  Power,
  RefreshCw,
  Save,
  Sliders,
  Sparkles,
  SunMedium,
  Zap,
} from 'lucide-react';
import { AudioReactiveStats, KettleState } from '../types/kettle';
import { bleController } from '../services/bleController';
import { audioVisualizer } from '../services/audioVisualizer';
import { MODE, cssHex, mixScaleColor } from '../services/kettleProtocol';
import { AppTheme } from '../hooks/useTheme';
import { LightGamesSection } from './LightGamesSection';
import { useLanguage } from '../i18n/LanguageContext';

interface BacklightTabProps {
  kettleState: KettleState;
  theme: AppTheme;
  onActiveColorChange: (color: { r: number; g: number; b: number } | null) => void;
}

const QUICK_SWATCH_HEXES = [
  '#ef4444',
  '#3b82f6',
  '#10b981',
  '#a855f7',
  '#06b6d4',
  '#fef3c7',
];

export const BacklightTab: React.FC<BacklightTabProps> = ({
  kettleState,
  theme,
  onActiveColorChange,
}) => {
  const { t } = useLanguage();
  const [isApplying, setIsApplying] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [audioStats, setAudioStats] = useState<AudioReactiveStats>(audioVisualizer.getStats());
  const [sensitivity, setSensitivity] = useState(audioStats.sensitivity);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const off = !kettleState.isConnected;
  const isAudioActive = audioStats.isActive;

  useEffect(() => {
    const unsub = audioVisualizer.subscribeStats((stats) => {
      setAudioStats(stats);
      if (stats.isActive) {
        onActiveColorChange({ r: stats.bass, g: stats.mid, b: stats.high });
      } else {
        onActiveColorChange(null);
      }
    });

    let rafId = 0;
    const drawLoop = () => {
      if (canvasRef.current && audioVisualizer.isActive()) {
        audioVisualizer.drawVisualization(canvasRef.current, theme === 'dark');
      }
      rafId = requestAnimationFrame(drawLoop);
    };
    rafId = requestAnimationFrame(drawLoop);

    return () => {
      unsub();
      cancelAnimationFrame(rafId);
      onActiveColorChange(null);
    };
  }, [onActiveColorChange, theme]);

  const handleToggleMic = async () => {
    setMicError(null);
    if (isAudioActive) {
      audioVisualizer.stop();
    } else {
      const ok = await audioVisualizer.start();
      if (!ok) {
        setMicError(t.backlight.micError);
      }
    }
  };

  const handleTurnOffLight = async () => {
    setIsApplying(true);
    try {
      if (isAudioActive) audioVisualizer.stop();
      await bleController.stop();
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* SECTION 1: MICROPHONE AUDIO REACTIVE LIGHT MUSIC */}
      <section className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                {t.backlight.fftTitle}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.backlight.fftSub}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleToggleMic()}
            className={`min-h-[44px] px-4 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
              isAudioActive
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950'
            }`}
          >
            {isAudioActive ? (
              <>
                <MicOff className="w-4 h-4" />
                <span>{t.backlight.stopMusic}</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>{t.backlight.startMusic}</span>
              </>
            )}
          </button>
        </div>

        {micError && (
          <p className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-500/40 text-xs text-rose-700 dark:text-rose-300">
            {micError}
          </p>
        )}

        {/* Frequency Bars */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs font-semibold text-rose-600 dark:text-rose-400">
              <span>{t.backlight.bass}</span>
              <span className="font-mono tabular-nums">{audioStats.bass}</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-rose-500 transition-all duration-75" style={{ width: `${(audioStats.bass / 255) * 100}%` }} />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span>{t.backlight.mid}</span>
              <span className="font-mono tabular-nums">{audioStats.mid}</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-emerald-500 transition-all duration-75" style={{ width: `${(audioStats.mid / 255) * 100}%` }} />
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs font-semibold text-sky-600 dark:text-sky-400">
              <span>{t.backlight.high}</span>
              <span className="font-mono tabular-nums">{audioStats.high}</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-sky-500 transition-all duration-75" style={{ width: `${(audioStats.high / 255) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Spectrum Canvas */}
        <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950">
          <canvas ref={canvasRef} width={480} height={88} className="w-full h-22 block" />
          {!isAudioActive && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 px-4 text-center">
              {t.backlight.micPlaceholder}
            </div>
          )}
        </div>

        {/* Sensitivity + Diagnostics */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 font-medium">
              <Sliders className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              {t.backlight.micSensitivity}
            </span>
            <span className="font-mono font-bold tabular-nums text-cyan-600 dark:text-cyan-400">
              {sensitivity.toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min={0.4}
            max={3.0}
            step={0.1}
            value={sensitivity}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSensitivity(val);
              audioVisualizer.setSensitivity(val);
            }}
            className="w-full h-2 rounded-lg bg-slate-200 dark:bg-slate-800 appearance-none cursor-pointer accent-cyan-600 dark:accent-cyan-400"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
            <span>
              BLE: {isAudioActive ? '7–8 fps' : '0 fps'} · {t.backlight.sent}: {audioStats.sentFrames} · {t.backlight.dropped}: {audioStats.droppedFrames}
            </span>
            <span>{cssHex([audioStats.bass, audioStats.mid, audioStats.high]).toUpperCase()}</span>
          </div>
        </div>
      </section>

      {/* SECTION 2: 3-COLOR NIGHTLIGHT, LAMP & EFFECTS */}
      <section className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              {t.backlight.nightTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t.backlight.nightSub}
            </p>
          </div>
        </div>

        {/* Quick Swatches for Color 1 */}
        <div className="grid grid-cols-6 gap-2">
          {QUICK_SWATCH_HEXES.map((hex, idx) => {
            const name = t.backlight.swatches[idx];
            const active = kettleState.nightScale[0].toLowerCase() === hex.toLowerCase();
            return (
              <button
                key={hex}
                type="button"
                title={name}
                onClick={() => {
                  bleController.updateNightScaleColor(0, hex);
                  if (kettleState.isWorking && kettleState.activeMode === 'light') {
                    void bleController.applyPalette(true, false);
                  }
                }}
                className={`min-h-[44px] rounded-xl border flex items-center justify-center transition-transform active:scale-95 ${
                  active
                    ? 'border-slate-900 dark:border-white ring-2 ring-cyan-500/40'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
                style={{ backgroundColor: hex }}
              >
                <span className="sr-only">{name}</span>
              </button>
            );
          })}
        </div>

        {/* 3 Nightlight Color Pickers */}
        <div className="grid grid-cols-3 gap-2.5">
          {([0, 1, 2] as const).map((idx) => (
            <label key={idx} className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
              <span>{t.backlight.colorN(idx + 1)}</span>
              <input
                type="color"
                value={kettleState.nightScale[idx]}
                onChange={(e) => bleController.updateNightScaleColor(idx, e.target.value)}
                className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-1"
              />
            </label>
          ))}
        </div>

        {/* Brightness, Interval, Auto-Off */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <SunMedium className="w-3.5 h-3.5 text-amber-500" />
                {t.backlight.brightness}
              </span>
              <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                {Math.round((kettleState.brightness / 255) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={20}
              max={255}
              value={kettleState.brightness}
              onChange={(e) => bleController.setBrightness(Number(e.target.value))}
              className="w-full h-2 rounded-lg bg-slate-200 dark:bg-slate-800 appearance-none cursor-pointer accent-cyan-600 dark:accent-cyan-400"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-600 dark:text-slate-300">{t.backlight.cycleInterval}</span>
              <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                {kettleState.colorInterval} {t.common.secondsShort}
              </span>
            </div>
            <input
              type="range"
              min={30}
              max={180}
              step={10}
              disabled={off}
              value={kettleState.colorInterval}
              onChange={(e) => bleController.setColorInterval(Number(e.target.value))}
              className="w-full h-2 rounded-lg bg-slate-200 dark:bg-slate-800 appearance-none cursor-pointer accent-cyan-600 dark:accent-cyan-400 disabled:opacity-40"
            />
          </div>

          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-slate-600 dark:text-slate-300">{t.backlight.autoOff}</span>
              <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                {kettleState.lampHours} {t.common.hoursShort}
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={12}
              step={1}
              disabled={off}
              value={kettleState.lampHours}
              onChange={(e) => void bleController.setLampHours(Number(e.target.value))}
              className="w-full h-2 rounded-lg bg-slate-200 dark:bg-slate-800 appearance-none cursor-pointer accent-cyan-600 dark:accent-cyan-400 disabled:opacity-40"
            />
          </div>
        </div>

        {/* Lamp Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={off || isApplying}
            onClick={() => void bleController.programAndStart(MODE.LIGHT, 100)}
            className="min-h-[44px] px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors"
          >
            <Moon className="w-4 h-4" />
            <span>{t.backlight.lampBtn}</span>
          </button>

          <button
            type="button"
            disabled={off || isApplying}
            onClick={() => void bleController.programAndStart(MODE.LAMP, 100)}
            className="min-h-[44px] px-3 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 hover:opacity-90 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 transition-opacity"
          >
            <Sparkles className="w-4 h-4" />
            <span>{t.backlight.night3Btn}</span>
          </button>

          <button
            type="button"
            disabled={off || isApplying}
            onClick={() => void bleController.flashImpulse()}
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Zap className="w-4 h-4 text-amber-500" />
            <span>{t.backlight.flashBtn}</span>
          </button>

          <button
            type="button"
            disabled={off || isApplying}
            onClick={() => void bleController.runDiscoSequence()}
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Disc3 className="w-4 h-4 text-purple-500" />
            <span>{t.backlight.discoBtn}</span>
          </button>

          <button
            type="button"
            disabled={off || isApplying}
            onClick={() => void bleController.applyPalette(true, true)}
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Save className="w-4 h-4" />
            <span>{t.backlight.saveEepromBtn}</span>
          </button>

          <button
            type="button"
            disabled={off || isApplying}
            onClick={() => void handleTurnOffLight()}
            className="min-h-[44px] px-3 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40"
          >
            <Power className="w-4 h-4" />
            <span>{t.backlight.turnOffLightBtn}</span>
          </button>
        </div>
      </section>

      {/* SECTION 3: BOIL TEMPERATURE COLOR SCALE & STANDBY LIGHTS */}
      <section className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
        <div>
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            {t.backlight.scaleTitle}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t.backlight.scaleSub}
          </p>
        </div>

        {/* 5-point Interpolated Gradient Strip (40° / 55° / 70° / 85° / 100°) */}
        <div className="space-y-2">
          <div
            className="h-3 w-full rounded-full border border-slate-200 dark:border-slate-700"
            style={{
              background: `linear-gradient(90deg, ${kettleState.boilScale[0]} 0%, ${cssHex(
                mixScaleColor(55, kettleState.boilScale)
              )} 25%, ${kettleState.boilScale[1]} 50%, ${cssHex(
                mixScaleColor(85, kettleState.boilScale)
              )} 75%, ${kettleState.boilScale[2]} 100%)`,
            }}
          />
          <div className="grid grid-cols-5 gap-1">
            {[40, 55, 70, 85, 100].map((temp) => {
              const dotHex = cssHex(mixScaleColor(temp, kettleState.boilScale));
              const isAnchor = temp === 40 || temp === 70 || temp === 100;
              return (
                <div key={temp} className="flex flex-col items-center gap-0.5">
                  <span
                    className={`h-2.5 w-2.5 rounded-full border ${
                      isAnchor
                        ? 'border-slate-900/40 dark:border-white/60'
                        : 'border-slate-400/30 dark:border-slate-500/40'
                    }`}
                    style={{ backgroundColor: dotHex }}
                  />
                  <span
                    className={`text-[10px] font-mono tabular-nums ${
                      isAnchor
                        ? 'font-bold text-slate-800 dark:text-slate-200'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {temp}°
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={off}
            onClick={() => void bleController.setLightFeature('boil', !kettleState.lightBoil)}
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-xs disabled:opacity-40"
          >
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              {t.backlight.duringHeating}
            </span>
            <span className={kettleState.lightBoil ? 'font-bold text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}>
              {kettleState.lightBoil ? t.common.on : t.common.off}
            </span>
          </button>

          <button
            type="button"
            disabled={off}
            onClick={() => void bleController.setLightFeature('sync', !kettleState.lightSync)}
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-xs disabled:opacity-40"
          >
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              {t.backlight.inStandby}
            </span>
            <span className={kettleState.lightSync ? 'font-bold text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}>
              {kettleState.lightSync ? t.common.on : t.common.off}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {t.backlight.scaleStops.map((label, idx) => (
            <label key={idx} className="flex flex-col gap-1 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center justify-between gap-1">
                <span>{label}</span>
                <span className="font-mono text-[10px] text-slate-400 uppercase">
                  {kettleState.boilScale[idx]}
                </span>
              </div>
              <input
                type="color"
                value={kettleState.boilScale[idx]}
                onChange={(e) => bleController.updateBoilScaleColor(idx as 0 | 1 | 2, e.target.value)}
                className="h-11 w-full cursor-pointer rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-1"
              />
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={off}
            onClick={() => void bleController.readPalette(false)}
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t.backlight.readPalette}</span>
          </button>

          <button
            type="button"
            disabled={off}
            onClick={() => void bleController.applyPalette(false, true)}
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center gap-1.5 disabled:opacity-40 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{t.backlight.writePalette}</span>
          </button>
        </div>
      </section>

      {/* SECTION 4: INTERACTIVE LIGHTING MINI-GAMES (0x38) */}
      <LightGamesSection
        kettleState={kettleState}
        onActiveColorChange={onActiveColorChange}
      />
    </div>
  );
};
