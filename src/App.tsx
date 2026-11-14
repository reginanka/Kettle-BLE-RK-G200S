import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Bluetooth,
  Clock,
  Coffee,
  Droplets,
  Flame,
  KeyRound,
  Sparkles,
  WifiOff,
  X,
} from 'lucide-react';
import { Header } from './components/Header';
import { KettleVisual } from './components/KettleVisual';
import { HeatingTab } from './components/HeatingTab';
import { BacklightTab } from './components/BacklightTab';
import { DrinksTab } from './components/DrinksTab';
import { ScheduleTab } from './components/ScheduleTab';
import { LinkTab } from './components/LinkTab';
import { PairingGuideModal } from './components/PairingGuideModal';
import { bleController } from './services/bleController';
import { audioVisualizer } from './services/audioVisualizer';
import {
  AppAlertBanner,
  HexLogEntry,
  KettleState,
  ScheduleJob,
  TabId,
} from './types/kettle';
import { useTheme } from './hooks/useTheme';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useLanguage } from './i18n/LanguageContext';

interface NavTabItem {
  id: TabId;
  labelKey: 'kettle' | 'light' | 'drinks' | 'schedule' | 'link';
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_TABS: NavTabItem[] = [
  { id: 'kettle', labelKey: 'kettle', icon: Flame },
  { id: 'light', labelKey: 'light', icon: Sparkles },
  { id: 'drinks', labelKey: 'drinks', icon: Coffee },
  { id: 'schedule', labelKey: 'schedule', icon: Clock },
  { id: 'link', labelKey: 'link', icon: Bluetooth },
];

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const isOnline = useOnlineStatus();
  const { t } = useLanguage();

  const [kettleState, setKettleState] = useState<KettleState>(() => bleController.getState());
  const [activeTab, setActiveTab] = useState<TabId>('kettle');
  const [logs, setLogs] = useState<HexLogEntry[]>([]);
  const [scheduleJobs, setScheduleJobs] = useState<ScheduleJob[]>([]);
  const [activeAlert, setActiveAlert] = useState<AppAlertBanner | null>(null);
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [activeStreamingRgb, setActiveStreamingRgb] = useState<{
    r: number;
    g: number;
    b: number;
  } | null>(null);

  useEffect(() => {
    const unsubState = bleController.subscribeState((newState) => {
      setKettleState(newState);
    });

    const unsubLogs = bleController.subscribeLogs((newLog) => {
      setLogs((prev) => [...prev.slice(-299), newLog]);
    });

    const unsubSchedule = bleController.subscribeSchedule((jobs) => {
      setScheduleJobs(jobs);
    });

    const unsubAlerts = bleController.subscribeAlerts((alert) => {
      setActiveAlert(alert);
    });

    const handleBeforeUnload = () => {
      audioVisualizer.stop();
      bleController.disconnect();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubState();
      unsubLogs();
      unsubSchedule();
      unsubAlerts();
      window.removeEventListener('beforeunload', handleBeforeUnload);
      audioVisualizer.stop();
      bleController.disconnect();
    };
  }, []);

  const handleClearLogs = () => {
    setLogs([]);
  };

  const needsAuth = kettleState.isConnected && !kettleState.isAuthorized;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060911] text-slate-900 dark:text-slate-100 flex flex-col pb-24 selection:bg-cyan-500 selection:text-slate-950">
      <Header
        kettleState={kettleState}
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenGuide={() => setIsPairingModalOpen(true)}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 pt-4 pb-6 space-y-4">
        {/* Offline PWA Notice */}
        {!isOnline && (
          <div className="px-4 py-2.5 rounded-2xl bg-slate-200/70 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 flex items-center gap-2.5">
            <WifiOff className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
            <span>{t.app.offlinePwa}</span>
          </div>
        )}

        {/* Boil / Stale Water Alert Banner */}
        {activeAlert && (
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 ${
              activeAlert.kind === 'boil'
                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-100'
                : 'bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-500/40 text-sky-900 dark:text-sky-100'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {activeAlert.kind === 'boil' ? (
                <Bell className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Droplets className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
              )}
              <div className="min-w-0">
                <strong className="block font-bold">{activeAlert.title}</strong>
                <span className="opacity-90">{activeAlert.message}</span>
              </div>
            </div>
            <button
              type="button"
              aria-label={t.app.closeAlert}
              onClick={() => setActiveAlert(null)}
              className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error Banner */}
        {kettleState.error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/40 text-rose-800 dark:text-rose-200 text-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span className="leading-snug">{kettleState.error}</span>
            </div>
            <button
              type="button"
              onClick={() => void bleController.connect()}
              className="min-h-[44px] px-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs whitespace-nowrap shrink-0 transition-colors"
            >
              {t.app.retry}
            </button>
          </div>
        )}

        {/* Pairing Action Banner (0xFF Unauthorized) */}
        {needsAuth && (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/40 text-amber-900 dark:text-amber-100 text-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <KeyRound className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div className="min-w-0">
                <strong className="block text-xs font-bold">{t.app.pairingTitle}</strong>
                <span className="text-amber-800 dark:text-amber-200/90">
                  {kettleState.isPairing
                    ? t.app.pairingActive(kettleState.pairingAttempts)
                    : t.app.pairingHint}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  kettleState.isPairing
                    ? bleController.stopPairingRoutine()
                    : bleController.startPairingRoutine()
                }
                className="min-h-[44px] px-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs whitespace-nowrap transition-colors"
              >
                {kettleState.isPairing ? t.common.stop : t.app.pairNow}
              </button>
              <button
                type="button"
                onClick={() => bleController.regenerateAuthKey()}
                className="min-h-[44px] px-3 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-white/70 dark:bg-slate-900/70 text-amber-900 dark:text-amber-200 font-semibold text-xs whitespace-nowrap transition-colors"
              >
                {t.app.newKey}
              </button>
              <button
                type="button"
                onClick={() => setIsPairingModalOpen(true)}
                className="min-h-[44px] px-3 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-white/70 dark:bg-slate-900/70 text-amber-900 dark:text-amber-200 font-semibold text-xs whitespace-nowrap transition-colors"
              >
                {t.app.guide}
              </button>
            </div>
          </div>
        )}


        {/* Mobile Compact Kettle Summary Bar on non-visual tabs */}
        {activeTab !== 'kettle' && activeTab !== 'light' && (
          <button
            type="button"
            onClick={() => setActiveTab('kettle')}
            className="lg:hidden w-full min-h-[48px] px-4 rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-left transition-colors hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor:
                    kettleState.isConnected && kettleState.isAuthorized
                      ? `rgb(${kettleState.backlightColor.r}, ${kettleState.backlightColor.g}, ${kettleState.backlightColor.b})`
                      : 'rgba(148, 163, 184, 0.45)',
                }}
              />
              <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                {kettleState.isConnected && kettleState.isAuthorized
                  ? `${kettleState.isWorking ? t.modes[kettleState.selectedMode] : t.app.waiting}${kettleState.isHolding ? ` · ${t.app.holding}` : ''}`
                  : t.common.noData}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-display text-lg font-extrabold text-cyan-600 dark:text-cyan-400 tabular-nums">
                {kettleState.isConnected && kettleState.isAuthorized
                  ? `${Math.round(kettleState.currentTemp)}°C`
                  : '— °C'}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {t.app.toControls}
              </span>
            </div>
          </button>
        )}

        {/* Main 2-Column Desktop / Single-Column Mobile Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Live Kettle Visual */}
          <div
            className={`lg:col-span-5 lg:sticky lg:top-20 ${
              activeTab === 'kettle' || activeTab === 'light' ? 'block' : 'hidden lg:block'
            }`}
          >
            <KettleVisual
              kettleState={kettleState}
              activeRgbColor={activeStreamingRgb}
              viewMode={activeTab === 'light' ? 'light' : 'heating'}
            />
          </div>

          {/* Right Column: Active Tab Panel */}
          <div className="lg:col-span-7 min-w-0">
            {activeTab === 'kettle' && <HeatingTab kettleState={kettleState} />}
            {activeTab === 'light' && (
              <BacklightTab
                kettleState={kettleState}
                theme={theme}
                onActiveColorChange={setActiveStreamingRgb}
              />
            )}
            {activeTab === 'drinks' && (
              <DrinksTab
                kettleState={kettleState}
                onSelectDrinkTabSwitch={() => setActiveTab('kettle')}
              />
            )}
            {activeTab === 'schedule' && (
              <ScheduleTab kettleState={kettleState} jobs={scheduleJobs} />
            )}
            {activeTab === 'link' && (
              <LinkTab
                kettleState={kettleState}
                logs={logs}
                onClearLogs={handleClearLogs}
                onOpenGuide={() => setIsPairingModalOpen(true)}
              />
            )}
          </div>
        </div>
      </main>

      {/* Fixed 5-Tab Mobile-Friendly Bottom Navigation */}
      <nav
        aria-label={t.nav.ariaLabel}
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 dark:border-slate-800/90 bg-white/95 dark:bg-[#060911]/95 backdrop-blur-md pb-safe"
      >
        <div className="max-w-3xl mx-auto grid grid-cols-5 h-16 px-1">
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={`min-h-[44px] my-1 mx-0.5 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  active
                    ? 'text-cyan-600 dark:text-cyan-400 bg-cyan-50/90 dark:bg-cyan-950/40'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="text-[11px] font-semibold leading-none whitespace-nowrap">
                  {t.nav[tab.labelKey]}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Pairing Guide Modal */}
      <PairingGuideModal
        isOpen={isPairingModalOpen}
        onClose={() => setIsPairingModalOpen(false)}
      />
    </div>
  );
}
