// =============================================================================
// Timer Digital Relay v4.0 — API Contract Types
// Mirror of ESP32 firmware v4.0 REST API contract from Engineering Brief.
// All responses follow: { success: boolean, message: string, data: T }
// =============================================================================

export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

// ---------- AUTH ----------
export type LoginRequest = {
  username: string;
  password: string;
};

export type LoginData = {
  token: string;          // JWT access token
  csrfToken: string;      // CSRF token for mutation requests
  expiresAt: number;      // Token expiry (ms epoch)
  username: string;
};

export type SessionInfo = {
  isAuthenticated: boolean;
  username: string | null;
  expiresAt: number | null;
};

// ---------- CHANNEL / RELAY ----------
export type RelaySource = 'manual' | 'schedule' | 'pir' | 'off';

export type Channel = {
  id: number;              // 1..12
  name: string;
  modeAuto: boolean;       // true=Auto (schedule/PIR), false=Manual
  manualState: boolean;    // desired manual state (when modeAuto=false)
  pirEnabled: boolean;     // PIR override enabled
  pirHoldTime: number;     // seconds, PIR hold time
  // Read-only runtime state:
  state: boolean;          // actual relay state
  source: RelaySource;     // why it's currently ON/OFF
  hasPir: boolean;         // PIR sensor mapped to this channel (ch 9-12)
  // Energy monitoring (software-estimated)
  energyWh?: number;       // accumulated watt-hours since last reset
  wattage?: number;        // user-configured load wattage (W)
};

// ---------- SCHEDULE ----------
export type DayMask = number;  // bit0=Mon ... bit6=Sun; 0 = every day

export type Schedule = {
  id?: number;
  channelId: number;
  onTime: string;   // "HH:MM"
  offTime: string;  // "HH:MM"
  dayMask: DayMask;
  enabled: boolean;
};

// ---------- PIR ----------
export type PIRState = {
  id: number;                // 1..4
  channelId: number;         // 9..12
  enabled: boolean;
  motionNow: boolean;        // current motion detected
  lastMotionAt: number | null;  // ms epoch
  triggerCountToday: number;
  warmupUntil: number;       // ms epoch when warm-up completes
  stuckDetected: boolean;
  holdTime: number;          // seconds
};

// ---------- LOG ----------
export type LogType =
  | 'relay_on'
  | 'relay_off'
  | 'pir_trigger'
  | 'login'
  | 'logout'
  | 'error'
  | 'restart'
  | 'ota'
  | 'config_change'
  | 'factory_reset'
  | 'time_sync';

export type ActivityLog = {
  id: number;
  timestamp: number;   // ms epoch
  type: LogType;
  channelId: number | null;
  message: string;
};

export type LogFilter = {
  type?: LogType | 'all';
  channelId?: number | 'all';
  limit?: number;
  since?: number;       // ms epoch
};

// ---------- STATUS (dashboard overview) ----------
export type SystemStatus = {
  firmwareVersion: string;
  buildDate: string;
  deviceName: string;
  uptimeSeconds: number;
  currentTime: number;          // ms epoch (RTC time)
  timezone: string;
  wifiRssi: number;             // dBm
  freeHeap: number;             // bytes
  cpuLoadPercent: number;
  flashFreePercent: number;
  channels: Channel[];
  pirs: PIRState[];
  schedules: Schedule[];        // included in MQTT status (for remote Scheduler view)
  stats: {
    relaysOn: number;
    schedulesActive: number;
    pirTriggersToday: number;
    errorsToday: number;
  };
  online: boolean;
  // PZEM-004T v3.0 power monitoring (optional, via UART)
  pzemAvailable?: boolean;
  voltage?: number;         // Volts AC
  current?: number;         // Amperes
  power?: number;           // Watts (active)
  energy?: number;          // kWh (accumulated)
  frequency?: number;       // Hz
  powerFactor?: number;     // 0.0 - 1.0
  powerAlarm?: boolean;     // over-current alarm
};

// ---------- CONFIG ----------
export type SystemConfig = {
  deviceName: string;
  timezone: string;
  channels: Channel[];
  schedules: Schedule[];
  pirs: PIRState[];
};

// ---------- TIME ----------
export type SetTimeRequest = {
  datetime: string;   // ISO 8601
};

// ---------- OTA ----------
export type FirmwareInfo = {
  currentVersion: string;
  buildDate: string;
  latestAvailable: string;
  updateAvailable: boolean;
  signatureVerified: boolean;
  otaStatus: 'up-to-date' | 'update-available' | 'uploading' | 'verifying' | 'installing' | 'failed' | 'rollback';
  lastUpdateAt: number | null;
  lastUpdateStatus: 'success' | 'failed' | 'rollback' | null;
};

export type OtaHistoryEntry = {
  id: number;
  timestamp: number;
  fromVersion: string;
  toVersion: string;
  status: 'success' | 'failed' | 'rollback';
  durationSeconds: number;
};

// ---------- AI INSIGHTS (advisory only — Gemini via GAS) ----------
export type InsightSeverity = 'info' | 'warning' | 'critical';

export type InsightCategory =
  | 'habit_analysis'
  | 'energy_analysis'
  | 'fault_detection'
  | 'predictive_maintenance'
  | 'pir_recommendation';

export type AiInsight = {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;
  body: string;
  channelId?: number;
  action?: {
    label: string;
    type: 'apply_suggestion' | 'review' | 'dismiss';
    payload?: Record<string, unknown>;
  };
  generatedAt: number;
  source: 'gemini-mock';
};

// ---------- RELAY MUTATION ----------
export type RelayMutation = {
  channelId: number;
  action: 'toggle' | 'on' | 'off' | 'set_mode';
  mode?: 'auto' | 'manual';
  manualState?: boolean;
};

// ---------- FACTORY RESET ----------
export type FactoryResetPrepareResponse = {
  token: string;
  expiresAt: number;     // ms epoch
};

export type FactoryResetConfirmRequest = {
  token: string;
  confirm: 'RESET';
};
