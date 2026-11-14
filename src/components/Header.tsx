import React, { useState } from 'react';
import { Bluetooth, BluetoothOff, Download, HelpCircle, Moon, RefreshCw, Sun, X } from 'lucide-react';
import { KettleState } from '../types/kettle';
import { bleController } from '../services/bleController';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { AppTheme } from '../hooks/useTheme';
import { useLanguage } from '../i18n/LanguageContext';

interface HeaderProps {
  kettleState: KettleState;
  theme: AppTheme;
  onToggleTheme: () => void;
  onOpenGuide: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  kettleState,
  theme,
  onToggleTheme,
  onOpenGuide,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { lang, toggleLang, t } = useLanguage();
  const [showIOSModal, setShowIOSModal] = useState(false);

  const handleConnectToggle = async () => {
    if (kettleState.isConnected) {
      bleController.disconnect();
    } else {
      await bleController.connect();
    }
  };

  const statusSummary = kettleState.isConnecting
    ? t.header.connecting
    : kettleState.isConnected
    ? kettleState.isAuthorized
      ? `${t.header.nearby} · v${kettleState.firmware}`
      : t.header.waitingPair
    : t.header.offline;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-slate-800/90 bg-white/90 dark:bg-[#060911]/90 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 sm:py-0 sm:min-h-14 flex flex-wrap items-center justify-between gap-x-2 gap-y-2 sm:gap-3">
        {/* Brand wordmark + live status (stacked cleanly on mobile, inline on desktop) */}
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-3 shrink-0">
          <span className="font-display font-extrabold text-[15px] sm:text-lg leading-tight tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            {t.header.brand}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">
            <span
              className={`sm:hidden inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                kettleState.isConnecting
                  ? 'bg-amber-500 animate-pulse'
                  : kettleState.isConnected
                  ? kettleState.isAuthorized
                    ? 'bg-emerald-500'
                    : 'bg-amber-500'
                  : 'bg-slate-400 dark:bg-slate-600'
              }`}
            />
            <span>{statusSummary}</span>
          </span>
        </div>

        {/* Guide, language switch, theme switch, optional PWA install, primary BLE CTA */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
          <button
            type="button"
            onClick={onOpenGuide}
            aria-label={t.app.guide}
            title={t.app.guide}
            className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white flex items-center justify-center transition-colors"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={toggleLang}
            aria-label={t.header.switchLangTitle}
            title={t.header.switchLangTitle}
            className="h-9 min-w-[36px] px-2 sm:h-11 sm:min-w-[44px] sm:px-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white font-mono text-xs font-bold flex items-center justify-center transition-colors"
          >
            {lang === 'uk' ? 'UA' : 'EN'}
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? t.header.switchToLight : t.header.switchToDark}
            title={theme === 'dark' ? t.header.lightThemeTitle : t.header.darkThemeTitle}
            className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white flex items-center justify-center transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {!isInstalled && isInstallable && (
            <button
              type="button"
              onClick={() => void install()}
              aria-label={t.header.install}
              title={t.header.install}
              className="h-9 w-9 sm:w-auto sm:h-11 sm:px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900 text-slate-800 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Download className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span className="hidden md:inline">{t.header.install}</span>
            </button>
          )}

          {!isInstalled && isIOS && (
            <button
              type="button"
              onClick={() => setShowIOSModal(true)}
              aria-label={t.header.iosPwa}
              title={t.header.iosPwa}
              className="h-9 w-9 sm:w-auto sm:h-11 sm:px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <Download className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span className="hidden md:inline">{t.header.iosPwa}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleConnectToggle()}
            disabled={kettleState.isConnecting}
            className={`h-9 px-3 sm:h-11 sm:px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 transition-colors active:scale-[0.98] ${
              kettleState.isConnected
                ? 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/70'
                : 'bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950'
            }`}
          >
            {kettleState.isConnecting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>{t.header.searching}</span>
              </>
            ) : kettleState.isConnected ? (
              <>
                <BluetoothOff className="w-4 h-4" />
                <span>{t.header.disconnect}</span>
              </>
            ) : (
              <>
                <Bluetooth className="w-4 h-4" />
                <span>{t.header.connect}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* iOS Safari Install Guide Modal */}
      {showIOSModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 shadow-2xl text-slate-900 dark:text-slate-100">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold">{t.header.iosTitle}</h3>
              <button
                type="button"
                onClick={() => setShowIOSModal(false)}
                className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed space-y-1">
              <span className="block">{t.header.iosStep1}</span>
              <span className="block">{t.header.iosStep2}</span>
              <span className="block">{t.header.iosStep3}</span>
            </p>
            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="mt-5 w-full min-h-[44px] rounded-xl bg-slate-900 dark:bg-cyan-500 text-white dark:text-slate-950 text-sm font-semibold"
            >
              {t.common.understood}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
