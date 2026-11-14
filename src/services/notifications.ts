import { AlertSettings } from '../types/kettle';

const ALERTS_STORAGE_KEY = 'skykettle_alert_settings_v1';

const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  boilAlertEnabled: true,
  staleAlertEnabled: true,
  staleLimitHours: 24,
  soundChimeEnabled: true,
};

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new Ctx();
  }
  if (sharedAudioCtx.state === 'suspended') {
    void sharedAudioCtx.resume().catch(() => undefined);
  }
  return sharedAudioCtx;
}

export function playTone(freq: number, durationMs = 180, gainLevel = 0.08): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(gainLevel, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.02);
  } catch {
    // ignore Web Audio autoplay restrictions
  }
}

export function playNotificationChime(kind: 'boil' | 'stale'): void {
  const notes = kind === 'boil' ? [587.33, 739.99, 880] : [523.25, 440];
  notes.forEach((freq, idx) => {
    window.setTimeout(() => playTone(freq, 220, 0.09), idx * 140);
  });
}

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isBrowserNotificationSupported()) return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function sendSystemNotification(title: string, body: string): void {
  if (!isBrowserNotificationSupported() || Notification.permission !== 'granted') {
    return;
  }
  try {
    new Notification(title, {
      body,
      icon: './pwa-192x192.png',
      tag: 'skykettle-alert',
    });
  } catch {
    // ignore if browser requires service worker notification
  }
}

export function loadAlertSettings(): AlertSettings {
  try {
    const raw = localStorage.getItem(ALERTS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ALERT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AlertSettings>;
    return {
      boilAlertEnabled: parsed.boilAlertEnabled ?? DEFAULT_ALERT_SETTINGS.boilAlertEnabled,
      staleAlertEnabled: parsed.staleAlertEnabled ?? DEFAULT_ALERT_SETTINGS.staleAlertEnabled,
      staleLimitHours: Math.max(6, Math.min(48, Number(parsed.staleLimitHours) || DEFAULT_ALERT_SETTINGS.staleLimitHours)),
      soundChimeEnabled: parsed.soundChimeEnabled ?? DEFAULT_ALERT_SETTINGS.soundChimeEnabled,
    };
  } catch {
    return { ...DEFAULT_ALERT_SETTINGS };
  }
}

export function saveAlertSettings(settings: AlertSettings): void {
  try {
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}
