import React, { useEffect, useState } from 'react';
import {
  Bell,
  Bluetooth,
  Clock,
  Droplets,
  HelpCircle,
  KeyRound,
  RefreshCw,
  Volume2,
} from 'lucide-react';
import { AlertSettings, HexLogEntry, KettleState } from '../types/kettle';
import { bleController } from '../services/bleController';
import { DevConsole } from './DevConsole';
import {
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
} from '../services/notifications';
import { useLanguage } from '../i18n/LanguageContext';

interface LinkTabProps {
  kettleState: KettleState;
  logs: HexLogEntry[];
  onClearLogs: () => void;
  onOpenGuide: () => void;
}

export const LinkTab: React.FC<LinkTabProps> = ({
  kettleState,
  logs,
  onClearLogs,
  onOpenGuide,
}) => {
  const { t } = useLanguage();
  const off = !kettleState.isConnected;
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(() =>
    bleController.getAlertSettings()
  );
  const [notifPerm, setNotifPerm] = useState<NotificationPermission | 'unsupported'>(() =>
    getBrowserNotificationPermission()
  );

  useEffect(() => {
    const unsub = bleController.subscribeAlertSettings((next) => {
      setAlertSettings(next);
    });
    return () => {
      unsub();
    };
  }, []);

  const handleRequestNotifications = async () => {
    const perm = await requestBrowserNotificationPermission();
    setNotifPerm(perm);
  };

  return (
    <div className="space-y-4">
      {/* Connection, Key & MAC Derivation */}
      <section className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              {t.link.authTitle}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t.link.authSub}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenGuide}
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 shrink-0"
          >
            <HelpCircle className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>{t.app.guide}</span>
          </button>
        </div>

        {/* Auth Key Hex */}
        <div className="space-y-2">
          <label className="block text-xs text-slate-600 dark:text-slate-300">
            <span>{t.link.keyLabel}</span>
            <div className="mt-1 flex flex-wrap gap-2">
              <input
                type="text"
                value={kettleState.authKeyHex}
                spellCheck={false}
                autoCapitalize="off"
                onChange={(e) => bleController.setAuthKeyHex(e.target.value)}
                className="flex-1 min-w-[180px] min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 font-mono text-xs tracking-wider text-slate-900 dark:text-cyan-300"
              />
              <button
                type="button"
                onClick={() => bleController.setFactoryAuthKey()}
                title={t.link.factoryTitle}
                className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold whitespace-nowrap hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                FF...FF
              </button>
              <button
                type="button"
                onClick={() => bleController.regenerateAuthKey()}
                className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold whitespace-nowrap hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                {t.link.newKey}
              </button>
            </div>
          </label>

          {/* MAC Address derivation */}
          <label className="block text-xs text-slate-600 dark:text-slate-300">
            <span>{t.link.macLabel}</span>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={kettleState.macAddress}
                placeholder="AA:BB:CC:DD:EE:FF"
                spellCheck={false}
                autoCapitalize="off"
                onChange={(e) => bleController.setMacAddress(e.target.value)}
                className="flex-1 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 font-mono text-xs text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={() => bleController.deriveKeyFromMac()}
                className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
              >
                <KeyRound className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                <span>{t.link.deriveKey}</span>
              </button>
            </div>
          </label>
        </div>

        {/* Connection Action */}
        <button
          type="button"
          disabled={kettleState.isConnecting}
          onClick={() => void (kettleState.isConnected ? bleController.disconnect() : bleController.connect())}
          className="w-full min-h-[44px] px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 text-xs font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <Bluetooth className="w-4 h-4" />
          <span>{kettleState.isConnected ? t.link.disconnectBtn : t.link.connectBtn}</span>
        </button>

        {kettleState.isConnected && !kettleState.isAuthorized && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/40 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
            <span>
              {kettleState.isPairing
                ? t.app.pairingActive(kettleState.pairingAttempts)
                : t.link.pairNeeded}
            </span>
            <button
              type="button"
              onClick={() =>
                kettleState.isPairing ? bleController.stopPairingRoutine() : bleController.startPairingRoutine()
              }
              className="min-h-[40px] px-3 rounded-lg bg-amber-500 text-slate-950 font-semibold"
            >
              {kettleState.isPairing ? t.common.stop : t.app.pairNow}
            </button>
          </div>
        )}
      </section>

      {/* Hardware Settings, Clock (0x6E/0x6F), Boil Offset & Freshness */}
      <section className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white">
            {t.link.diagTitle}
          </h2>
          <button
            type="button"
            disabled={off}
            onClick={() => void bleController.refreshAll()}
            className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t.common.refresh}</span>
          </button>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <dt className="text-[11px] text-slate-500 dark:text-slate-400">{t.link.firmware}</dt>
            <dd className="text-sm font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
              {kettleState.firmware}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-500 dark:text-slate-400">{t.link.mode}</dt>
            <dd className="text-sm font-semibold text-slate-900 dark:text-white truncate">
              {t.modes[kettleState.selectedMode] ?? t.modes.standby}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-500 dark:text-slate-400">{t.link.waterAge}</dt>
            <dd className="text-sm font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
              {kettleState.freshOn ? `${kettleState.freshHours} ${t.common.hoursShort}` : t.common.off}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] text-slate-500 dark:text-slate-400">{t.link.boilOffset}</dt>
            <dd className="text-sm font-mono font-semibold text-slate-900 dark:text-white tabular-nums">
              {kettleState.boilOffset > 0 ? `+${kettleState.boilOffset}` : kettleState.boilOffset}
            </dd>
          </div>
        </dl>

        {/* Kettle Internal Clock Readout (0x6F) */}
        <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="block text-[11px] text-slate-500 dark:text-slate-400">
              {t.link.clockLabel}
            </span>
            <span className="font-mono text-xs font-semibold tabular-nums text-slate-900 dark:text-white">
              {kettleState.kettleTimeText ?? t.link.clockNotRead}
            </span>
          </div>

          <button
            type="button"
            disabled={off}
            onClick={() => void bleController.readClock()}
            className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
          >
            <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>{t.link.readClockBtn}</span>
          </button>
        </div>

        {/* Boil duration offset */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-600 dark:text-slate-300">{t.link.boilOffsetRange}</span>
            <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
              {kettleState.boilOffset > 0 ? `+${kettleState.boilOffset}` : kettleState.boilOffset}
            </span>
          </div>
          <input
            type="range"
            min={-5}
            max={5}
            step={1}
            disabled={off || kettleState.isWorking}
            value={kettleState.boilOffset}
            onChange={(e) => void bleController.setBoilOffset(Number(e.target.value))}
            className="w-full h-2 rounded-lg bg-slate-200 dark:bg-slate-800 appearance-none cursor-pointer accent-cyan-600 dark:accent-cyan-400 disabled:opacity-40"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            disabled={off}
            onClick={() => void bleController.syncClock()}
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Clock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
            <span>{t.link.syncClockBtn}</span>
          </button>

          <button
            type="button"
            disabled={off}
            onClick={() => void bleController.setFreshnessReminder(!kettleState.freshOn)}
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-40"
          >
            <Droplets className="w-4 h-4 text-sky-500" />
            <span>{kettleState.freshOn ? t.link.freshOn : t.link.freshOff}</span>
          </button>
        </div>
      </section>

      {/* Boil & Stale Water Alerts */}
      <section className="rounded-2xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>{t.link.alertsTitle}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t.link.alertsSub}
            </p>
          </div>
          <button
            type="button"
            onClick={() => bleController.testAlert('boil')}
            className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 text-xs font-semibold shrink-0"
          >
            {t.link.testBtn}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() =>
              bleController.updateAlertSettings({ boilAlertEnabled: !alertSettings.boilAlertEnabled })
            }
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-xs"
          >
            <span className="text-slate-700 dark:text-slate-300 font-medium">{t.link.boilAlert}</span>
            <span className={alertSettings.boilAlertEnabled ? 'font-bold text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}>
              {alertSettings.boilAlertEnabled ? t.common.on : t.common.off}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              bleController.updateAlertSettings({ staleAlertEnabled: !alertSettings.staleAlertEnabled })
            }
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-xs"
          >
            <span className="text-slate-700 dark:text-slate-300 font-medium">{t.link.staleAlert}</span>
            <span className={alertSettings.staleAlertEnabled ? 'font-bold text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}>
              {alertSettings.staleAlertEnabled ? t.common.on : t.common.off}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              bleController.updateAlertSettings({ soundChimeEnabled: !alertSettings.soundChimeEnabled })
            }
            className="min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center justify-between text-xs"
          >
            <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
              <Volume2 className="w-3.5 h-3.5" />
              <span>{t.link.soundAlert}</span>
            </span>
            <span className={alertSettings.soundChimeEnabled ? 'font-bold text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}>
              {alertSettings.soundChimeEnabled ? t.common.yes : t.common.off}
            </span>
          </button>
        </div>

        {/* Stale water threshold hours */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-slate-600 dark:text-slate-300">{t.link.staleThreshold}</span>
            <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
              {alertSettings.staleLimitHours} {t.common.hoursShort}
            </span>
          </div>
          <input
            type="range"
            min={6}
            max={48}
            step={2}
            value={alertSettings.staleLimitHours}
            onChange={(e) =>
              bleController.updateAlertSettings({ staleLimitHours: Number(e.target.value) })
            }
            className="w-full h-2 rounded-lg bg-slate-200 dark:bg-slate-800 appearance-none cursor-pointer accent-cyan-600 dark:accent-cyan-400"
          />
        </div>

        {/* Browser Push / System Notification permission */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-slate-200 dark:border-slate-800">
          <span className="text-slate-500 dark:text-slate-400">
            {t.link.sysNotifPrefix}{' '}
            <strong className="text-slate-800 dark:text-slate-200">
              {notifPerm === 'granted'
                ? t.link.permGranted
                : notifPerm === 'denied'
                ? t.link.permDenied
                : notifPerm === 'unsupported'
                ? t.link.permUnsupported
                : t.link.permDefault}
            </strong>
          </span>

          {notifPerm === 'default' && (
            <button
              type="button"
              onClick={() => void handleRequestNotifications()}
              className="min-h-[40px] px-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 font-semibold whitespace-nowrap"
            >
              {t.link.allowNotifBtn}
            </button>
          )}
        </div>
      </section>

      {/* Embedded HEX Debug Console */}
      <DevConsole logs={logs} onClearLogs={onClearLogs} />
    </div>
  );
};
