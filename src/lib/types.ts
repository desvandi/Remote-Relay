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
// v4.1 (brief §31): Added battery / powerFlow / environment / energy nested
//   objects. All are optional — older firmware (4.0.x) without battery
//   monitoring will omit them and the PWA renders as before (brief §55).
//   No `any` is used (brief §34). Invalid readings arrive as `null`, never 0.
export type AlarmState = 'NORMAL' | 'WARNING' | 'FAULT' | 'UNAVAILABLE';
export type CellSensorState = 'ok' | 'i2c_error' | 'tap_fault' | 'invalid_value' | 'range_fault' | 'stale';
export type ResistanceQuality = 'INVALID' | 'LOW_DELTA_I' | 'UNSTABLE' | 'VALID' | 'HIGH_CONFIDENCE';

export type CellReading = {
  index: number;                 // 1..8
  voltage: number | null;        // V (null if invalid — brief §17)
  state: CellSensorState;
};

export type CellMetrics = {
  min: number;
  max: number;
  average: number;
  delta: number;                 // cellMax - cellMin
  minIndex: number;              // 1..8
  maxIndex: number;
};

export type PackResistanceResult = {
  ohms: number | null;
  deltaV: number | null;
  deltaI: number | null;
  sampleWindowMs: number | null;
  quality: ResistanceQuality;
};

export type CellResistanceResult = {
  index: number;                 // 1..8
  ohms: number | null;
  quality: ResistanceQuality;
};

export type BatteryDiagnosticsState = {
  batteryVoltageFault: boolean;
  batteryCurrentSensorFault: boolean;
  inverterCurrentSensorFault: boolean;
  cellMeasurementFault: boolean;
  cellTapFault: boolean;
  cellOverVoltage: boolean;
  cellUnderVoltage: boolean;
  cellImbalance: boolean;
  highPackResistance: boolean;
  highCellResistance: boolean;
  powerFlowInconsistency: boolean;
  sht31Fault: boolean;
  adsFault: boolean;
  inaFault: boolean;
  overall: AlarmState;
};

export type BatteryStatus = {
  packVoltage: number | null;     // V
  packVoltageValid: boolean;
  packVoltageSource: string;       // 'ads1115_bplus' | 'esp32_adc1' | 'unavailable'
  current: number | null;         // A (signed — >0 discharge, <0 charge)
  power: number | null;           // W (signed)
  chargePower: number | null;     // W (always >=0)
  dischargePower: number | null;  // W (always >=0)
  socAvailable: boolean;          // false when capacity not configured (brief §24)
  soc: number | null;             // % 0..100 — null when unavailable
  socSynchronized: boolean;
  chargedAh: number | null;
  dischargedAh: number | null;
  chargedWh: number | null;
  dischargedWh: number | null;
  cells: CellReading[];           // length 8
  cellMetrics?: CellMetrics;
  packResistance: PackResistanceResult;
  cellResistance: CellResistanceResult[];
  valid: boolean;
  diagnostics: BatteryDiagnosticsState;
};

export type PowerFlow = {
  mpptCurrent: number | null;     // derived = Iinverter - Ibattery (brief §6)
  mpptPower: number | null;
  batteryCurrent: number | null;
  batteryPower: number | null;    // signed
  inverterCurrent: number | null;
  inverterDcPower: number | null;
  consistencyError: number | null;
  consistency: AlarmState;
  batteryCurrentValid: boolean;
  inverterCurrentValid: boolean;
  valid: boolean;
};

export type EnvironmentStatus = {
  temperature: number | null;    // °C (ambient — NOT battery T, brief §20)
  humidity: number | null;       // % RH
  valid: boolean;
  label: 'ambient';
};

export type EnergyCounters = {
  pvWh: number | null;
  batteryChargedWh: number | null;
  batteryDischargedWh: number | null;
  inverterDcWh: number | null;
  chargedAh: number | null;
  dischargedAh: number | null;
  valid: boolean;
};

// v4.2 industrial-grade hardening (audit brief §13-16, §18-19, §22, §44, §59-60)
// — All optional: PWA must render gracefully when firmware omits them.
export type RtcStatus = 'VALID' | 'INVALID' | 'UNSYNCED';
export type SensorStatus = 'VALID' | 'STALE' | 'ERROR' | 'UNAVAILABLE';
export type AlarmSeverity = 'INFO' | 'WARNING' | 'CRITICAL';

export type HealthSnapshot = {
  uptimeSeconds: number;
  bootCount: number;
  lastResetReason: number;
  lastResetReasonStr: string;
  watchdogResets: number;
  brownoutResets: number;
  freeHeap: number;
  minFreeHeap: number;
  largestFreeBlock: number;
  wifiReconnectCount: number;
  mqttReconnectCount: number;
  rtcStatus: RtcStatus;
  pzemStatus: SensorStatus;
  pirStatus: SensorStatus;
  sht31Status: SensorStatus;
  ina219Status: SensorStatus;
  ads1115Status: SensorStatus;
  filesystemOk: boolean;
  nvsOk: boolean;
  mqttConnected: boolean;
  highestAlarmSeverity: AlarmSeverity;
  taskHeartbeats: {
    relayEngine: number;
    mqtt: number;
    telemetry: number;
    scheduler: number;
    pir: number;
    pzem: number;
    ota: number;
    healthMonitor: number;
    batteryMonitor: number;
  };
};

export type Alarm = {
  code: string;
  severity: AlarmSeverity;
  active: boolean;
  acknowledged: boolean;
  raisedAt: number;       // ms since boot
  clearedAt: number;     // 0 if still active
  message: string;
};

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
  energy?: number;          // kWh (accumulated total)
  frequency?: number;       // Hz
  powerFactor?: number;     // 0.0 - 1.0
  powerAlarm?: boolean;     // over-current alarm from PZEM hardware
  // Derived calculations (computed by ESP32)
  apparentPower?: number;   // VA = V × A
  reactivePower?: number;   // VAR = √(VA² - W²)
  // Daily statistics (reset at midnight by ESP32)
  energyToday?: number;     // kWh consumed today
  voltageMin?: number;      // min voltage today
  voltageMax?: number;      // max voltage today
  currentMax?: number;      // max current today
  powerMax?: number;        // max power today
  powerAvg?: number;        // average power today
  // Alarm state (checked by ESP32 every read cycle)
  alarms?: {
    undervoltage?: boolean;
    overvoltage?: boolean;
    overcurrent?: boolean;
    overpower?: boolean;
    lowPowerFactor?: boolean;
  };
  // v4.1 — DC Energy & Battery Monitoring blocks (optional, brief §31)
  battery?: BatteryStatus;
  powerFlow?: PowerFlow;
  environment?: EnvironmentStatus;
  // Note: existing PZEM `energy?: number` (kWh) is preserved. New DC energy
  // counters use a distinct key to avoid type collision (brief §55 backward
  // compat — old `energy` field retains its original meaning).
  dcEnergy?: EnergyCounters;
  // v4.2 — industrial-grade hardening (audit brief §22, §44, §60)
  health?: HealthSnapshot;
  // Note: existing PZEM `alarms?: {...}` (AC power quality) is preserved.
  // New system-wide alarm registry uses a distinct key to avoid type collision.
  systemAlarms?: Alarm[];
  telemetrySequence?: number;  // §22: monotonic counter for packet-loss detection
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
// audit-fixes-v2 (auditor #4 P1-6): fields that require real update-channel
//   verification are now nullable. In MQTT mode, the PWA does not perform an
//   actual update-channel check (only the firmware itself does, via Ed25519-
//   signed MQTT OTA). Returning `null` for these fields signals to the UI
//   that the status is "unknown" rather than falsely claiming "verified".
export type FirmwareInfo = {
  currentVersion: string;
  buildDate: string;
  latestAvailable: string | null;
  updateAvailable: boolean | null;
  signatureVerified: boolean | null;
  otaStatus: 'up-to-date' | 'update-available' | 'uploading' | 'verifying' | 'installing' | 'failed' | 'rollback' | 'unknown';
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
  | 'pir_recommendation'
  | 'battery_analysis';  // v4.1 (brief §42) — advisory insights on cell imbalance,
                          // pack/cell resistance, power-flow, inverter efficiency

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
  action: 'on' | 'off' | 'set_mode';
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
