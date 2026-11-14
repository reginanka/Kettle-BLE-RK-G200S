import { RgbTuple } from '../types/kettle';

export const PROTOCOL_CONSTANTS = {
  START_BYTE: 0x55,
  STOP_BYTE: 0xAA,
  SERVICE_NUS_UUID: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
  SERVICE_FFF0_UUID: '0000fff0-0000-1000-8000-00805f9b34fb',
  RX_CHAR_UUID: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
  TX_CHAR_UUID: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
  DEVICE_NAME_FILTER: 'RK-G200S',
  DEVICE_PREFIX_FILTER: 'RK-',
} as const;

export const CMD = {
  VERSION: 0x01,
  START: 0x03,
  STOP: 0x04,
  MODE: 0x05,
  STATUS: 0x06,
  LAMP_HOURS_GET: 0x30,
  PALETTE: 0x32,
  PALETTE_GET: 0x33,
  INTERVAL: 0x34,
  LIGHT_GET: 0x35,
  COMMIT: 0x36,
  LIGHT: 0x37,
  IMPULSE: 0x38,
  LAMP_HOURS_SET: 0x39,
  SOUND: 0x3C,
  STATS: 0x47,
  COUNT: 0x50,
  FRESH_SET: 0x51,
  FRESH_GET: 0x52,
  SYNC: 0x6E,
  TIME: 0x6F,
  AUTH: 0xFF,
} as const;

export const MODE = {
  BOIL: 0x00,
  HEAT: 0x01,
  BOIL_HEAT: 0x02,
  LAMP: 0x03,
  LIGHT: 0x04,
} as const;

export const LIGHT_TYPE = {
  BOIL: 0x00,
  LAMP: 0x01,
  SYNC: 0xC8,
} as const;

const ZERO_OK_COMMANDS = new Set<number>([
  CMD.SYNC,
  CMD.PALETTE,
  CMD.INTERVAL,
  CMD.LIGHT,
  CMD.LAMP_HOURS_SET,
  CMD.FRESH_SET,
]);

let packetCounter = 0;

export function getNextCounter(): number {
  const current = packetCounter;
  packetCounter = (packetCounter + 1) & 0xFF;
  return current;
}

export function resetCounter(): void {
  packetCounter = 0;
}

const AUTH_KEY_STORAGE = 'r4s_kettle_auth_key_hex';
const LEGACY_AUTH_KEY_STORAGE = 'r4s_kettle_auth_key';

export function bytesToHex(bytes: Uint8Array | number[]): string {
  const arr = bytes instanceof Uint8Array ? Array.from(bytes) : bytes;
  return arr.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

export function bytesToCompactHex(bytes: Uint8Array | number[]): string {
  const arr = bytes instanceof Uint8Array ? Array.from(bytes) : bytes;
  return arr.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join('');
}

export function hexToBytes(hexString: string): Uint8Array | null {
  const clean = hexString.replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '');
  if (clean.length === 0 || clean.length % 2 !== 0) return null;
  const result = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    result[i / 2] = parseInt(clean.substring(i, i + 2), 16);
  }
  return result;
}

export function parseAuthKeyHex(text: string): Uint8Array | null {
  const clean = text.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length !== 16) return null;
  return hexToBytes(clean);
}

/**
 * Derive 8-byte BLE auth key from MAC address AA:BB:CC:DD:EE:FF
 */
export function keyFromMac(mac: string): Uint8Array | null {
  const parts = mac
    .trim()
    .split(/[:\-]/)
    .map((p) => Number.parseInt(p, 16));
  if (parts.length !== 6 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return null;
  }
  const modelName = 'RK-G200S';
  const key = new Uint8Array(8);
  key[0] = 0x2F;
  for (let i = 0; i < 6; i++) {
    key[i + 1] = (parts[i] ?? 0) ^ modelName.charCodeAt(i);
  }
  key[7] = 0x2F;
  return key;
}

export function getOrCreateAuthKey(): Uint8Array {
  try {
    const savedHex = localStorage.getItem(AUTH_KEY_STORAGE);
    if (savedHex) {
      const parsed = parseAuthKeyHex(savedHex);
      if (parsed) return parsed;
    }

    const legacy = localStorage.getItem(LEGACY_AUTH_KEY_STORAGE);
    if (legacy) {
      const parts = legacy.split(',').map((n) => parseInt(n, 10));
      if (parts.length === 8 && parts.every((n) => !Number.isNaN(n) && n >= 0 && n <= 255)) {
        const key = new Uint8Array(parts);
        localStorage.setItem(AUTH_KEY_STORAGE, bytesToCompactHex(key));
        return key;
      }
    }
  } catch {
    // ignore storage access issues
  }

  return regenerateRandomAuthKey();
}

export function regenerateRandomAuthKey(): Uint8Array {
  const newKey = new Uint8Array(8);
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    window.crypto.getRandomValues(newKey);
  } else {
    for (let i = 0; i < 8; i++) {
      newKey[i] = Math.floor(Math.random() * 256);
    }
  }
  saveAuthKey(newKey);
  return newKey;
}

export function saveAuthKey(key: Uint8Array): void {
  try {
    localStorage.setItem(AUTH_KEY_STORAGE, bytesToCompactHex(key));
    localStorage.setItem(LEGACY_AUTH_KEY_STORAGE, Array.from(key).join(','));
  } catch {
    // ignore storage errors
  }
}

export function buildPacket(command: number, payload: ArrayLike<number> = [], customCounter?: number): Uint8Array {
  const counter = customCounter !== undefined ? customCounter & 0xFF : getNextCounter();
  return Uint8Array.from([
    PROTOCOL_CONSTANTS.START_BYTE,
    counter,
    command & 0xFF,
    ...Array.from(payload),
    PROTOCOL_CONSTANTS.STOP_BYTE,
  ]);
}

function u16(b: Uint8Array, i: number): number {
  return (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
}

function u32(b: Uint8Array, i: number): number {
  return (
    ((b[i] ?? 0) |
      ((b[i + 1] ?? 0) << 8) |
      ((b[i + 2] ?? 0) << 16) |
      ((b[i + 3] ?? 0) << 24)) >>> 0
  );
}

function i32(b: Uint8Array, i: number): number {
  return (
    (b[i] ?? 0) |
    ((b[i + 1] ?? 0) << 8) |
    ((b[i + 2] ?? 0) << 16) |
    ((b[i + 3] ?? 0) << 24)
  );
}

function le32(n: number): number[] {
  const v = n | 0;
  return [v & 0xFF, (v >> 8) & 0xFF, (v >> 16) & 0xFF, (v >> 24) & 0xFF];
}

// Packet builders
export function createAuthPacket(keyOverride?: Uint8Array): Uint8Array {
  const key = keyOverride ?? getOrCreateAuthKey();
  return buildPacket(CMD.AUTH, key);
}

export function createVersionPacket(): Uint8Array {
  return buildPacket(CMD.VERSION);
}

export function createStartPacket(): Uint8Array {
  return buildPacket(CMD.START);
}

export function createStopPacket(): Uint8Array {
  return buildPacket(CMD.STOP);
}

export function createGetStatusPacket(): Uint8Array {
  return buildPacket(CMD.STATUS);
}

export function createSetModePacket(mode: number, targetTemp: number, boilOffset = 0): Uint8Array {
  const payload = new Uint8Array(16);
  const clampedTemp = mode === MODE.BOIL || targetTemp >= 100 ? 0 : Math.max(40, Math.min(99, Math.round(targetTemp)));
  const clampedOffset = Math.max(-5, Math.min(5, Math.round(boilOffset)));
  payload[0] = mode & 0xFF;
  payload[2] = mode === MODE.LAMP || mode === MODE.LIGHT ? 0 : clampedTemp;
  payload[13] = (0x80 + clampedOffset) & 0xFF;
  return buildPacket(CMD.MODE, payload);
}

export function createPalettePacket(
  isLamp: boolean,
  colors: [RgbTuple, RgbTuple, RgbTuple],
  brightness = 255
): Uint8Array {
  const temps = isLamp ? [0x00, 0x32, 0x64] : [40, 70, 100];
  const bright = Math.max(1, Math.min(255, Math.round(brightness)));
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const payload: number[] = [isLamp ? LIGHT_TYPE.LAMP : LIGHT_TYPE.BOIL];
  colors.forEach((c, idx) => {
    payload.push(temps[idx] ?? 0, bright, clamp(c[0]), clamp(c[1]), clamp(c[2]));
  });
  return buildPacket(CMD.PALETTE, payload);
}

export function createSetRgbPacket(r: number, g: number, b: number, brightness = 255): Uint8Array {
  const color: RgbTuple = [r, g, b];
  return createPalettePacket(true, [color, color, color], brightness);
}

export function createPaletteGetPacket(isLamp: boolean): Uint8Array {
  return buildPacket(CMD.PALETTE_GET, [isLamp ? LIGHT_TYPE.LAMP : LIGHT_TYPE.BOIL]);
}

export function createCommitPacket(): Uint8Array {
  return buildPacket(CMD.COMMIT);
}

export function createIntervalPacket(secs: number): Uint8Array {
  const s = Math.max(30, Math.min(3600, Math.round(secs)));
  return buildPacket(CMD.INTERVAL, [s & 0xFF, (s >> 8) & 0xFF]);
}

export function createLampHoursSetPacket(hours: number): Uint8Array {
  const h = Math.max(1, Math.min(12, Math.round(hours)));
  return buildPacket(CMD.LAMP_HOURS_SET, [h & 0xFF, (h >> 8) & 0xFF]);
}

export function createLampHoursGetPacket(): Uint8Array {
  return buildPacket(CMD.LAMP_HOURS_GET);
}

export function createLightSwitchPacket(type: number, on: boolean): Uint8Array {
  return buildPacket(CMD.LIGHT, [type & 0xFF, type & 0xFF, on ? 0x01 : 0x00]);
}

export function createLightGetPacket(type: number): Uint8Array {
  return buildPacket(CMD.LIGHT_GET, [type & 0xFF]);
}

export function createImpulsePacket(rgb: RgbTuple, brightness = 255): Uint8Array {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return buildPacket(CMD.IMPULSE, [
    clamp(rgb[0]),
    clamp(rgb[1]),
    clamp(rgb[2]),
    Math.max(1, Math.min(255, Math.round(brightness))),
    0x00,
    0x00,
  ]);
}

export function createSoundPacket(on: boolean): Uint8Array {
  return buildPacket(CMD.SOUND, [on ? 0x01 : 0x00]);
}

export function createStatsPacket(): Uint8Array {
  return buildPacket(CMD.STATS, [0x00]);
}

export function createCountPacket(): Uint8Array {
  return buildPacket(CMD.COUNT, [0x00]);
}

export function createFreshSetPacket(on: boolean): Uint8Array {
  const payload = new Uint8Array(16);
  payload[1] = on ? 0x01 : 0x00;
  payload[2] = 48;
  return buildPacket(CMD.FRESH_SET, payload);
}

export function createFreshGetPacket(): Uint8Array {
  return buildPacket(CMD.FRESH_GET, [0x00]);
}

export function createSyncTimePacket(unixSec: number, tzOffsetSec: number): Uint8Array {
  return buildPacket(CMD.SYNC, [...le32(unixSec), ...le32(tzOffsetSec)]);
}

export function createReadTimePacket(): Uint8Array {
  return buildPacket(CMD.TIME);
}

// Color & formatting helpers
export function cssHex(rgb: RgbTuple): string {
  return `#${rgb.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('')}`;
}

export function parseCssHex(hex: string): RgbTuple {
  const h = hex.replace('#', '');
  if (h.length !== 6) return [6, 182, 212];
  const r = Number.parseInt(h.slice(0, 2), 16);
  const g = Number.parseInt(h.slice(2, 4), 16);
  const b = Number.parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return [6, 182, 212];
  return [r, g, b];
}

export function mixScaleColor(temp: number, scale: [string, string, string]): RgbTuple {
  const stops: { at: number; c: RgbTuple }[] = [
    { at: 40, c: parseCssHex(scale[0]) },
    { at: 70, c: parseCssHex(scale[1]) },
    { at: 100, c: parseCssHex(scale[2]) },
  ];
  const x = Math.max(40, Math.min(100, temp));
  let idx = 0;
  while (idx < stops.length - 1 && x > stops[idx + 1].at) {
    idx++;
  }
  const a = stops[idx];
  const b = stops[Math.min(stops.length - 1, idx + 1)];
  const ratio = a.at === b.at ? 0 : (x - a.at) / (b.at - a.at);
  return [
    Math.round(a.c[0] + (b.c[0] - a.c[0]) * ratio),
    Math.round(a.c[1] + (b.c[1] - a.c[1]) * ratio),
    Math.round(a.c[2] + (b.c[2] - a.c[2]) * ratio),
  ];
}

export function modeLabel(mode: number): string {
  switch (mode) {
    case MODE.BOIL:
      return 'Кип’ятіння';
    case MODE.HEAT:
      return 'Нагрів і підтримка';
    case MODE.BOIL_HEAT:
      return 'Кип’ятіння + тепло';
    case MODE.LAMP:
      return 'Нічник (3 кольори)';
    case MODE.LIGHT:
      return 'Світильник';
    default:
      return 'Очікування';
  }
}

export type ParsedFrame =
  | { kind: 'auth'; ok: boolean }
  | { kind: 'version'; text: string }
  | {
      kind: 'status';
      mode: number;
      target: number;
      sound: boolean;
      current: number;
      colorInterval: number;
      parental: boolean;
      running: boolean;
      error: number;
      boilOffset: number;
    }
  | { kind: 'stats'; ontime: number; wh: number; heater: number }
  | { kind: 'count'; n: number }
  | { kind: 'hours'; n: number }
  | { kind: 'light'; on: boolean }
  | {
      kind: 'palette';
      kindType: number;
      temps: [number, number, number];
      brightness: [number, number, number];
      colors: [RgbTuple, RgbTuple, RgbTuple];
    }
  | { kind: 'fresh'; on: boolean; hours: number }
  | { kind: 'time'; unix: number; offset: number }
  | { kind: 'ack'; cmd: number; ok: boolean }
  | { kind: 'raw' };

export function parseIncomingFrame(buf: Uint8Array | number[]): ParsedFrame {
  const bytes = buf instanceof Uint8Array ? buf : Uint8Array.from(buf);
  if (bytes.length < 4 || bytes[0] !== PROTOCOL_CONSTANTS.START_BYTE || bytes[bytes.length - 1] !== PROTOCOL_CONSTANTS.STOP_BYTE) {
    return { kind: 'raw' };
  }

  const cmd = bytes[2] ?? 0;
  const p = bytes.subarray(3, bytes.length - 1);

  if (cmd === CMD.AUTH) {
    return { kind: 'auth', ok: (p[0] ?? 0) !== 0 };
  }

  if (cmd === CMD.VERSION && p.length >= 2) {
    return { kind: 'version', text: `${p[0] ?? 0}.${p[1] ?? 0}` };
  }

  if (cmd === CMD.STATUS && p.length >= 16) {
    const rawTarget = p[2] ?? 0;
    return {
      kind: 'status',
      mode: p[0] ?? 0,
      target: rawTarget === 0 ? 100 : rawTarget,
      sound: (p[4] ?? 0) !== 0,
      current: p[5] ?? 0,
      colorInterval: p[6] ?? 30,
      parental: (p[7] ?? 0) !== 0,
      running: (p[8] ?? 0) !== 0,
      error: p[9] ?? 0,
      boilOffset: (p[13] ?? 0x80) - 0x80,
    };
  }

  // Fallback short status frame compatibility
  if (cmd === CMD.STATUS && p.length >= 4) {
    const rawMode = p[0] ?? 0;
    const rawTarget = p[1] ?? 0;
    const current = p[2] ?? 24;
    return {
      kind: 'status',
      mode: rawMode === 0 ? 0 : rawMode - 1,
      target: rawTarget === 0 ? 100 : rawTarget,
      sound: true,
      current,
      colorInterval: 30,
      parental: false,
      running: rawMode !== 0,
      error: 0,
      boilOffset: 0,
    };
  }

  if (cmd === CMD.STATS && p.length >= 14) {
    return {
      kind: 'stats',
      ontime: u32(p, 2),
      wh: u32(p, 6),
      heater: u32(p, 10),
    };
  }

  if (cmd === CMD.COUNT && p.length >= 7) {
    return { kind: 'count', n: u32(p, 3) };
  }

  if (cmd === CMD.LAMP_HOURS_GET && p.length >= 2) {
    return { kind: 'hours', n: u16(p, 0) };
  }

  if (cmd === CMD.TIME && p.length >= 8) {
    return { kind: 'time', unix: i32(p, 0), offset: i32(p, 4) };
  }

  if (cmd === CMD.LIGHT_GET && p.length >= 3) {
    return { kind: 'light', on: (p[2] ?? 0) !== 0 };
  }

  if (cmd === CMD.PALETTE_GET && p.length >= 16) {
    const rgb = (i: number): RgbTuple => [p[i] ?? 0, p[i + 1] ?? 0, p[i + 2] ?? 0];
    return {
      kind: 'palette',
      kindType: p[0] ?? 0,
      temps: [p[1] ?? 0, p[6] ?? 0, p[11] ?? 0],
      brightness: [p[2] ?? 255, p[7] ?? 255, p[12] ?? 255],
      colors: [rgb(3), rgb(8), rgb(13)],
    };
  }

  if (cmd === CMD.FRESH_GET && p.length >= 6) {
    return { kind: 'fresh', on: (p[1] ?? 0) !== 0, hours: u16(p, 4) };
  }

  if (
    cmd === CMD.START ||
    cmd === CMD.STOP ||
    cmd === CMD.MODE ||
    cmd === CMD.SYNC ||
    cmd === CMD.PALETTE ||
    cmd === CMD.INTERVAL ||
    cmd === CMD.COMMIT ||
    cmd === CMD.LIGHT ||
    cmd === CMD.IMPULSE ||
    cmd === CMD.LAMP_HOURS_SET ||
    cmd === CMD.SOUND ||
    cmd === CMD.FRESH_SET
  ) {
    const byte = p[0] ?? 0;
    return {
      kind: 'ack',
      cmd,
      ok: ZERO_OK_COMMANDS.has(cmd) ? byte === 0 : byte !== 0,
    };
  }

  return { kind: 'raw' };
}

const CMD_NAMES: Record<number, string> = {
  [CMD.VERSION]: 'VERSION (0x01)',
  [CMD.START]: 'START (0x03)',
  [CMD.STOP]: 'STOP (0x04)',
  [CMD.MODE]: 'SET_MODE (0x05)',
  [CMD.STATUS]: 'STATUS (0x06)',
  [CMD.LAMP_HOURS_GET]: 'HOURS_GET (0x30)',
  [CMD.PALETTE]: 'PALETTE (0x32)',
  [CMD.PALETTE_GET]: 'PALETTE_GET (0x33)',
  [CMD.INTERVAL]: 'INTERVAL (0x34)',
  [CMD.LIGHT_GET]: 'LIGHT_GET (0x35)',
  [CMD.COMMIT]: 'COMMIT (0x36)',
  [CMD.LIGHT]: 'LIGHT_CFG (0x37)',
  [CMD.IMPULSE]: 'IMPULSE (0x38)',
  [CMD.LAMP_HOURS_SET]: 'HOURS_SET (0x39)',
  [CMD.SOUND]: 'SOUND (0x3C)',
  [CMD.STATS]: 'STATS (0x47)',
  [CMD.COUNT]: 'COUNT (0x50)',
  [CMD.FRESH_SET]: 'FRESH_SET (0x51)',
  [CMD.FRESH_GET]: 'FRESH_GET (0x52)',
  [CMD.SYNC]: 'SYNC_TIME (0x6E)',
  [CMD.TIME]: 'READ_TIME (0x6F)',
  [CMD.AUTH]: 'AUTH (0xFF)',
};

export function interpretPacket(bytes: number[]): { name: string; notes?: string } {
  if (bytes.length < 4 || bytes[0] !== PROTOCOL_CONSTANTS.START_BYTE) {
    return { name: 'Raw Packet', notes: 'Нестандартний формат' };
  }

  const cmd = bytes[2] ?? 0;
  const name = CMD_NAMES[cmd] ?? `CMD (0x${cmd.toString(16).toUpperCase().padStart(2, '0')})`;

  if (cmd === CMD.MODE && bytes.length >= 8) {
    const mode = bytes[3] ?? 0;
    const temp = bytes[5] === 0 ? 100 : bytes[5];
    const offset = bytes.length >= 18 ? (bytes[16] ?? 0x80) - 0x80 : 0;
    const offsetNote = offset !== 0 ? `, кипіння ${offset > 0 ? `+${offset}` : offset}` : '';
    return {
      name,
      notes: `${modeLabel(mode)}${mode === MODE.LAMP || mode === MODE.LIGHT ? '' : ` · ${temp}°C`}${offsetNote}`,
    };
  }

  if (cmd === CMD.PALETTE && bytes.length >= 10) {
    const isLamp = bytes[3] === LIGHT_TYPE.LAMP;
    return {
      name,
      notes: isLamp
        ? `Нічник RGB(${bytes[6]},${bytes[7]},${bytes[8]})`
        : `Шкала нагріву 40/70/100°C`,
    };
  }

  if (cmd === CMD.IMPULSE && bytes.length >= 7) {
    return {
      name,
      notes: `Спалах RGB(${bytes[3]},${bytes[4]},${bytes[5]})`,
    };
  }

  if (cmd === CMD.AUTH && bytes.length === 5) {
    return {
      name,
      notes: bytes[3] === 0x01 ? 'Авторизацію підтверджено' : 'Очікує підтвердження «+» на чайнику',
    };
  }

  return { name };
}
