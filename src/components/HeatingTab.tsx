import React, { useState } from 'react';
import { Flame, Lock, Power, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { KettleState } from '../types/kettle';
import { bleController } from '../services/bleController';
import { MODE } from '../services/kettleProtocol';
import { useLanguage } from '../i18n/LanguageContext';

interface HeatingTabProps {
  kettleState: KettleState;
}

const QUICK_TEMPS = [40, 55, 70, 85, 100];

export const HeatingTab: React.FC<HeatingTabProps> = ({ kettleState }) => {
  const { lang, t } = useLanguage();
  const [isPending, setIsPending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const hasLiveData = kettleState.isConnected && kettleState.isAuthorized;
  const off = !kettleState.isConnected;
  const isInLightMode =
    kettleState.selectedMode === MODE.LAMP || kettleState.selectedMode === MODE.LIGHT;
  const effectiveHeatMode = isInLightMode ? MODE.BOIL : kettleState.selectedMode;
  const isBoilOnly = effectiveHeatMode === MODE.BOIL;
  const displayTemp = isBoilOnly ? 100 : kettleState.targetTemp;
  const locked = kettleState.parentalLock;
  const locale = lang === 'en' ? 'en-US' : 'uk-UA';

  const formatOntime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h <= 0) return `${m} ${t.common.minutesShort}`;
    return `${h} ${t.common.hoursShort} ${m} ${t.common.minutesShort}`;
  };

  const heatModes = [
    { id: MODE.BOIL, ...t.heating.modes.boil },
    { id: MODE.HEAT, ...t.heating.modes.heat },
    { id: MODE.BOIL_HEAT, ...t.heating.modes.boilHeat },
  ];

  const handleToggleRun = async () => {
    setIsPending(true);
    try {
      if (kettleState.isWorking) {
        await bleController.stop();
      } else {
        await bleController.programAndStart(effectiveHeatMode, displayTemp);
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Heating Mode Selection */}
      <section className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            {t.heating.modeTitle}
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t.modes[effectiveHeatMode] ?? t.modes.standby}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {heatModes.map((m) => {
            const active = effectiveHeatMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => bleController.setSelectedMode(m.id)}
                className={`min-h-[56px] px-3.5 py-2.5 rounded-xl border text-left transition-colors flex flex-col justify-center ${
                  active
                    ? 'bg-cyan-600 dark:bg-cyan-500 border-cyan-600 dark:border-cyan-500 text-white dark:text-slate-950'
                    : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                }`}
              >
                <span className="text-xs font-bold leading-snug">{m.label}</span>
                <span
                  className={`text-[11px] leading-snug mt-0.5 ${
                    active ? 'text-cyan-50 dark:text-slate-900/80' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {m.hint}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Precision Temperature (1°C step) + Sound & Lock + Start/Stop */}
      <section className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              {t.heating.tempTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isBoilOnly ? t.heating.tempHintBoil : t.heating.tempHintRange}
            </p>
          </div>
          <div className="font-display text-3xl font-extrabold text-cyan-600 dark:text-cyan-400 tabular-nums shrink-0">
            {displayTemp}°C
          </div>
        </div>

        <input
          type="range"
          min={40}
          max={100}
          step={1}
          value={displayTemp}
          disabled={isBoilOnly}
          aria-label={t.heating.tempAria}
          onChange={(e) => bleController.setTargetTemp(Number(e.target.value))}
          className="w-full h-2.5 rounded-lg bg-slate-200 dark:bg-slate-800 appearance-none cursor-pointer accent-cyan-600 dark:accent-cyan-400 disabled:opacity-40"
        />

        <div className="grid grid-cols-5 gap-2">
          {QUICK_TEMPS.map((temp) => {
            const active = displayTemp === temp;
            return (
              <button
                key={temp}
                type="button"
                disabled={isBoilOnly}
                onClick={() => bleController.setTargetTemp(temp)}
                className={`min-h-[44px] rounded-xl text-xs font-mono font-bold tabular-nums border transition-colors disabled:opacity-40 ${
                  active
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 border-slate-900 dark:border-white'
                    : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {temp}°
              </button>
            );
          })}
        </div>

        {/* Sound & Lock Status */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            disabled={off || isPending}
            onClick={() => void bleController.setSound(!kettleState.soundEnabled)}
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition-colors"
          >
            {kettleState.soundEnabled ? (
              <>
                <Volume2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span className="whitespace-nowrap">{t.heating.soundOn}</span>
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4 text-slate-400" />
                <span className="whitespace-nowrap">{t.heating.soundOff}</span>
              </>
            )}
          </button>

          <div
            title={t.heating.lockTooltip}
            className={`min-h-[44px] px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 ${
              locked
                ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300'
                : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span className="whitespace-nowrap">{locked ? t.heating.lockOn : t.heating.lockOff}</span>
          </div>
        </div>

        {/* Primary Start / Stop CTA */}
        <button
          type="button"
          disabled={off || isPending || (locked && !kettleState.isWorking)}
          onClick={() => void handleToggleRun()}
          className={`w-full min-h-[48px] px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors active:scale-[0.99] disabled:opacity-40 ${
            kettleState.isWorking
              ? 'bg-rose-600 hover:bg-rose-500 text-white'
              : 'bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white'
          }`}
        >
          {kettleState.isWorking ? (
            <>
              <Power className="w-4 h-4" />
              <span>{t.heating.stopMode(t.modes[kettleState.selectedMode] ?? t.modes.standby)}</span>
            </>
          ) : (
            <>
              <Flame className="w-4 h-4" />
              <span>{t.heating.startTemp(displayTemp)}</span>
            </>
          )}
        </button>

        {off && (
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
            {t.heating.connectHint}
          </p>
        )}
      </section>

      {/* Full Live Kettle Telemetry Panel */}
      <section className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              {t.heating.telemetryTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {hasLiveData ? t.heating.telemetrySubOn : t.heating.telemetrySubOff}
            </p>
          </div>
          {hasLiveData && (
            <button
              type="button"
              disabled={isRefreshing}
              onClick={async () => {
                setIsRefreshing(true);
                try {
                  await bleController.refreshAll();
                } finally {
                  setIsRefreshing(false);
                }
              }}
              className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center gap-1.5 shrink-0 disabled:opacity-40 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{t.common.refresh}</span>
            </button>
          )}
        </div>

        {!hasLiveData ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 px-4 py-6 text-center space-y-1">
            <p className="font-display text-sm font-bold text-slate-600 dark:text-slate-300">
              {t.common.noData}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.heating.telemetryEmptyDesc}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                {t.heating.waterTemp}
              </span>
              <span className="font-display text-base font-bold text-cyan-600 dark:text-cyan-400 tabular-nums">
                {Math.round(kettleState.currentTemp)}°C
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                {t.heating.targetPrefix(kettleState.targetTemp)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                {t.heating.flaskAndBase}
              </span>
              <span
                className={`font-display text-sm font-bold leading-snug ${
                  kettleState.errorCode === 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {kettleState.errorCode === 1
                  ? t.heating.noWater
                  : kettleState.errorCode === 2
                  ? t.heating.offBase
                  : t.heating.waterOk}
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                {kettleState.errorCode === 0 ? t.heating.sensorOk : t.heating.sensorWarn}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                {t.heating.workState}
              </span>
              <span className="font-display text-sm font-bold text-slate-900 dark:text-white leading-snug">
                {kettleState.isWorking
                  ? kettleState.isHolding
                    ? t.heating.holdingWarm
                    : t.modes[kettleState.selectedMode] ?? t.modes.standby
                  : t.app.waiting}
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                {t.heating.boilOffsetLabel(
                  kettleState.boilOffset > 0 ? `+${kettleState.boilOffset}` : String(kettleState.boilOffset)
                )}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                {t.heating.freshness}
              </span>
              <span className="font-display text-base font-bold text-slate-900 dark:text-white tabular-nums">
                {kettleState.freshOn ? `${kettleState.freshHours} ${t.common.hoursShort}` : t.common.disabled}
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                {kettleState.freshOn ? t.heating.timeInFlask : t.heating.freshOffDesc}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                {t.heating.soundAndLock}
              </span>
              <span className="font-display text-sm font-bold text-slate-900 dark:text-white leading-snug">
                {kettleState.soundEnabled ? t.heating.soundEnabled : t.heating.soundOff}
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                {kettleState.parentalLock ? t.heating.lockEnabledDesc : t.heating.lockDisabledDesc}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                {t.heating.boilsCount}
              </span>
              <span className="font-display text-base font-bold text-slate-900 dark:text-white tabular-nums">
                {kettleState.boilsCount.toLocaleString(locale)}
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                {t.heating.counter50}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                {t.heating.energy}
              </span>
              <span className="font-display text-base font-bold text-slate-900 dark:text-white tabular-nums">
                {kettleState.energyWh.toLocaleString(locale)} {t.heating.whUnit}
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                {(kettleState.energyWh / 1000).toFixed(2)} {t.heating.kwhUnit}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                {t.heating.runtime}
              </span>
              <span className="font-display text-base font-bold text-slate-900 dark:text-white tabular-nums">
                {formatOntime(kettleState.ontimeSeconds)}
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                {t.heating.heaterRes(kettleState.heaterResource.toLocaleString(locale))}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
              <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                {t.heating.clockAndFw}
              </span>
              <span className="font-mono text-xs font-bold text-slate-900 dark:text-white tabular-nums block truncate">
                {kettleState.kettleTimeText ? kettleState.kettleTimeText.split(' · ')[0] : t.common.noData}
              </span>
              <span className="block text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                {t.heating.firmwarePrefix(kettleState.firmware)}
              </span>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
