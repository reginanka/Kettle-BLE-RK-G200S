export type TabId = 'kettle' | 'light' | 'drinks' | 'schedule' | 'link';

export type KettleModeName = 'standby' | 'boil' | 'heat' | 'boilHeat' | 'nightlight' | 'light';

export type RgbTuple = [number, number, number];

export interface KettleState {
  // Connection & Auth
  isConnected: boolean;
  isConnecting: boolean;
  isAuthorized: boolean;
  isPairing: boolean;
  pairingAttempts: number;
  deviceName: string;
  firmware: string;
  authKeyHex: string;
  macAddress: string;
  error: string | null;

  // Live Operational Telemetry
  currentTemp: number;
  targetTemp: number;
  selectedMode: number; // 0x00..0x04
  activeMode: KettleModeName;
  isWorking: boolean;
  isHolding: boolean;
  soundEnabled: boolean;
  parentalLock: boolean;
  errorCode: number; // 0 = ok, 1 = no water, 2 = off base
  boilOffset: number; // -5..+5

  // Lighting & Palettes
  backlightColor: { r: number; g: number; b: number };
  flashColor: string | null;
  brightness: number; // 20..255
  colorInterval: number; // 30..180 seconds
  lampHours: number; // 1..12 hours
  lightBoil: boolean;
  lightSync: boolean;
  boilScale: [string, string, string]; // 40°, 70°, 100° hex colors
  nightScale: [string, string, string]; // 3-stop cycle hex colors

  // Usage Counters & Water Freshness
  boilsCount: number;
  energyWh: number;
  ontimeSeconds: number;
  heaterResource: number;
  freshOn: boolean;
  freshHours: number;
  kettleTimeText: string | null;

  lastStatusTime?: number;
}

export interface AlertSettings {
  boilAlertEnabled: boolean;
  staleAlertEnabled: boolean;
  staleLimitHours: number;
  soundChimeEnabled: boolean;
}

export interface AppAlertBanner {
  id: string;
  kind: 'boil' | 'stale';
  title: string;
  message: string;
}

export interface HexLogEntry {
  id: string;
  timestamp: string;
  direction: 'TX' | 'RX' | 'SYS';
  hex: string;
  bytes: number[];
  commandName: string;
  notes?: string;
}

export interface AudioReactiveStats {
  isActive: boolean;
  bass: number;
  mid: number;
  high: number;
  fps: number;
  droppedFrames: number;
  sentFrames: number;
  sensitivity: number;
}

export interface DrinkPreset {
  id: string;
  name: string;
  category: string;
  temp: number;
  mode: number;
  note: string;
}

export interface ScheduleJob {
  id: string;
  hhmm: string;
  mode: number;
  temp: number;
  repeat: 'once' | 'daily';
  enabled: boolean;
}
