import React from 'react';
import { KettleState } from '../types/kettle';
import { MODE, cssHex, mixScaleColor } from '../services/kettleProtocol';
import { useLanguage } from '../i18n/LanguageContext';

interface KettleVisualProps {
  kettleState: KettleState;
  activeRgbColor?: { r: number; g: number; b: number } | null;
  viewMode?: 'heating' | 'light';
}

const LED_MARKS = [40, 55, 70, 85, 100];

export const KettleVisual: React.FC<KettleVisualProps> = ({
  kettleState,
  activeRgbColor,
  viewMode = 'heating',
}) => {
  const { t } = useLanguage();
  const isLightView = viewMode === 'light';
  const hasLiveData = kettleState.isConnected && kettleState.isAuthorized;
  const currentTemp = Math.round(kettleState.currentTemp);
  const isWorking = hasLiveData && kettleState.isWorking;
  const activeMode = kettleState.activeMode;
  const isDecorative = activeMode === 'nightlight' || activeMode === 'light';
  const empty = hasLiveData && kettleState.errorCode === 1;
  const lifted = hasLiveData && kettleState.errorCode === 2;

  const waterRgb = mixScaleColor(hasLiveData ? currentTemp : 40, kettleState.boilScale);
  const waterHex = hasLiveData ? cssHex(waterRgb) : '#94a3b8';

  const ringRgb = activeRgbColor
    ? `rgb(${activeRgbColor.r}, ${activeRgbColor.g}, ${activeRgbColor.b})`
    : kettleState.flashColor
    ? kettleState.flashColor
    : isDecorative
    ? `rgb(${kettleState.backlightColor.r}, ${kettleState.backlightColor.g}, ${kettleState.backlightColor.b})`
    : isLightView
    ? kettleState.nightScale[0]
    : waterHex;

  const showLeds =
    ((hasLiveData && (kettleState.lightSync || kettleState.lightBoil || isDecorative)) || isLightView) && !lifted;
  const hasActiveGlow = Boolean(activeRgbColor || kettleState.flashColor || (hasLiveData && isDecorative) || showLeds);

  // Water surface Y inside SVG viewBox (0..1312): top ~255 (full), bottom ~910 (empty)
  const fillRatio = !hasLiveData ? 0.45 : empty ? 0.08 : Math.min(0.88, 0.56 + currentTemp / 320);
  const waterTopY = Math.round(920 - fillRatio * 660);

  const statusHeadline = !hasLiveData
    ? t.common.noData
    : kettleState.errorCode === 1
    ? t.visual.noWater
    : kettleState.errorCode === 2
    ? t.visual.offBase
    : !isWorking
    ? t.visual.standby
    : kettleState.isHolding
    ? t.visual.holdingAt(kettleState.targetTemp)
    : activeMode === 'boil'
    ? t.visual.boilingTo100
    : activeMode === 'heat'
    ? t.visual.heatingTo(kettleState.targetTemp)
    : activeMode === 'boilHeat'
    ? t.visual.boilThenHold(kettleState.targetTemp)
    : activeMode === 'nightlight'
    ? t.visual.nightlight3
    : t.visual.lamp;

  return (
    <section className="relative rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 overflow-hidden">
      {/* Subtle ambient glow matching active LED ring */}
      <div
        className="pointer-events-none absolute inset-x-10 bottom-6 h-24 rounded-full blur-3xl opacity-20 dark:opacity-30 transition-colors duration-300"
        style={{ background: hasActiveGlow ? ringRgb : 'transparent' }}
        aria-hidden="true"
      />

      {/* Quiet metadata line */}
      <div className="relative z-10 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {isLightView
            ? activeRgbColor
              ? t.visual.liveColorStream
              : hasLiveData && isDecorative
              ? statusHeadline
              : t.visual.lightPreview
            : statusHeadline}
        </span>
        <span className="font-mono tabular-nums">
          {isLightView
            ? t.visual.brightnessLabel(Math.round((kettleState.brightness / 255) * 100))
            : !hasLiveData
            ? t.common.notConnected
            : isDecorative
            ? t.visual.noHeating
            : t.visual.targetLabel(
                isWorking ? kettleState.targetTemp : kettleState.selectedMode === MODE.BOIL ? 100 : kettleState.targetTemp
              )}
          {!isLightView && hasLiveData && ` · ${kettleState.soundEnabled ? t.visual.soundShort : t.visual.silentShort}`}
          {hasLiveData && kettleState.parentalLock ? ` · ${t.visual.lockShort}` : ''}
        </span>
      </div>

      {/* Real RK-G200S Transparent PNG with Internal Dynamic Water & RGB Lighting */}
      <div className="relative z-10 mx-auto my-3 w-56 sm:w-64 aspect-[1199/1312] select-none">
        {/* Steam plumes when heating near boiling */}
        {isWorking && !isDecorative && !lifted && !empty && currentTemp >= 78 && (
          <div
            className="pointer-events-none absolute -top-2 left-[14%] w-[52%] flex justify-center gap-3 z-30"
            aria-hidden="true"
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="steam-plume block w-2.5 h-8 rounded-full bg-cyan-400/55 dark:bg-cyan-300/65 blur-[3px]"
                style={{ animationDelay: `${i * 0.45}s` }}
              />
            ))}
          </div>
        )}

        {/* Layer 0: Dynamic Water & Internal RGB Illumination clipped to the glass flask */}
        <svg
          viewBox="0 0 1199 1312"
          className="absolute inset-0 w-full h-full pointer-events-none"
          aria-hidden="true"
        >
          <defs>
            {/* Inner glass cavity silhouette matching kettle-g200s.webp */}
            <clipPath id="realKettleGlassClip">
              <path d="M 208 190 L 786 190 C 814 310 854 510 868 740 C 872 820 870 910 868 972 Q 500 1038 134 972 C 132 900 132 800 136 720 C 144 520 174 340 208 190 Z" />
            </clipPath>

            <linearGradient id="waterColumnGrad" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={isLightView || isDecorative || activeRgbColor || kettleState.flashColor ? ringRgb : waterHex}
                stopOpacity={isLightView ? '0.62' : '0.45'}
              />
              <stop
                offset="65%"
                stopColor={isLightView || isDecorative || activeRgbColor || kettleState.flashColor ? ringRgb : waterHex}
                stopOpacity={isLightView ? '0.78' : '0.68'}
              />
              <stop offset="100%" stopColor={hasActiveGlow ? ringRgb : waterHex} stopOpacity="0.92" />
            </linearGradient>

            <radialGradient id="bottomLedUplight" cx="50%" cy="94%" r="60%">
              <stop offset="0%" stopColor={ringRgb} stopOpacity={hasActiveGlow ? 0.92 : 0.25} />
              <stop offset="55%" stopColor={ringRgb} stopOpacity={hasActiveGlow ? 0.42 : 0.1} />
              <stop offset="100%" stopColor={ringRgb} stopOpacity="0" />
            </radialGradient>

            <filter id="ledRingBlur" x="-30%" y="-60%" width="160%" height="220%">
              <feGaussianBlur stdDeviation="16" />
            </filter>
          </defs>

          <g clipPath="url(#realKettleGlassClip)">
            {/* Full-flask ambient light glow (illuminates whole glass when lamp/music/flash active) */}
            {(isDecorative || kettleState.flashColor || activeRgbColor || showLeds) && !lifted && (
              <rect
                x="120"
                y="180"
                width="770"
                height="860"
                fill="url(#bottomLedUplight)"
                className="transition-opacity duration-300"
              />
            )}

            {/* Dynamic Water Level & Temperature/RGB Color */}
            <rect
              x="120"
              y={waterTopY}
              width="770"
              height={1040 - waterTopY}
              fill="url(#waterColumnGrad)"
              opacity={!hasLiveData && !isLightView ? 0.16 : empty ? 0.32 : lifted ? 0.35 : 0.85}
              className="transition-all duration-500"
            />

            {/* Subtle curved water meniscus */}
            <path
              d={`M 120 ${waterTopY} Q 310 ${waterTopY + 18} 500 ${waterTopY} T 890 ${waterTopY} L 890 ${waterTopY + 26} Q 695 ${waterTopY + 42} 500 ${waterTopY + 26} T 120 ${waterTopY + 26} Z`}
              fill="#ffffff"
              opacity={empty ? 0.14 : 0.32}
              className="transition-all duration-500"
            />

            {/* Rising heating bubbles */}
            {isWorking && !isDecorative && !lifted && !empty && (
              <g className="animate-pulse">
                <circle cx="340" cy="840" r="10" fill="#ffffff" opacity="0.72" />
                <circle cx="465" cy="760" r="13" fill="#ffffff" opacity="0.65" />
                <circle cx="585" cy="810" r="9" fill="#ffffff" opacity="0.82" />
                <circle cx="670" cy="705" r="12" fill="#ffffff" opacity="0.6" />
                <circle cx="410" cy="640" r="8" fill="#ffffff" opacity="0.75" />
                <circle cx="535" cy="590" r="11" fill="#ffffff" opacity="0.68" />
                <circle cx="620" cy="885" r="7" fill="#ffffff" opacity="0.8" />
              </g>
            )}

            {/* Bottom internal LED light strip glow */}
            {hasActiveGlow && !lifted && (
              <ellipse
                cx="500"
                cy="955"
                rx="355"
                ry="48"
                fill={ringRgb}
                opacity="0.75"
                filter="url(#ledRingBlur)"
              />
            )}
          </g>
        </svg>

        {/* Layer 1: Transparent RK-G200S Kettle Body */}
        <img
          src="./kettle-g200s.webp"
          alt={t.visual.alt}
          draggable={false}
          className="relative z-10 w-full h-full object-contain pointer-events-none"
        />

        {/* Layer 2: Subtle outer LED light accent along the bottom glass ring */}
        {hasActiveGlow && !lifted && (
          <svg
            viewBox="0 0 1199 1312"
            className="absolute inset-0 z-20 w-full h-full pointer-events-none"
            aria-hidden="true"
          >
            <path
              d="M 132 958 Q 500 1034 868 958"
              fill="none"
              stroke={ringRgb}
              strokeWidth="16"
              strokeLinecap="round"
              opacity="0.82"
            />
          </svg>
        )}

        {/* Layer 3: Centered Temperature Readout (heating view only) */}
        {!isLightView && (
          <div
            className="pointer-events-none absolute z-30 left-[41.7%] top-[44%] -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center"
          >
            <div
              className="px-4 py-2 rounded-2xl backdrop-blur-[3px] bg-white/70 dark:bg-slate-950/65 border border-white/50 dark:border-slate-800/70 shadow-sm"
            >
              {hasLiveData ? (
                <>
                  <div className="flex items-baseline justify-center gap-0.5">
                    <span className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white tabular-nums">
                      {currentTemp}
                    </span>
                    <span className="font-display text-lg sm:text-xl font-bold text-cyan-600 dark:text-cyan-400">
                      °C
                    </span>
                  </div>
                  <span className="block mt-0.5 text-[11px] font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                    {t.modes[kettleState.selectedMode] ?? t.modes.standby}
                  </span>
                </>
              ) : (
                <>
                  <div className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-400 dark:text-slate-500 tabular-nums">
                    — °C
                  </div>
                  <span className="block mt-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {t.common.noData}
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5 Temperature LED Indicators (heating view only) */}
      {!isLightView && (
        <div className="relative z-10 mx-auto mt-1 grid w-52 grid-cols-5 gap-1" aria-hidden="true">
          {LED_MARKS.map((mark) => {
            const lit = hasLiveData && showLeds && currentTemp >= mark - 8;
            return (
              <div key={mark} className="flex flex-col items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full transition-colors duration-200"
                  style={{
                    backgroundColor: lit ? ringRgb : 'rgba(148, 163, 184, 0.35)',
                    boxShadow: lit ? `0 0 8px ${ringRgb}` : 'none',
                  }}
                />
                <span className="text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {mark}°
                </span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
