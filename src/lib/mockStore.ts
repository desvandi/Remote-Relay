// =============================================================================
// Mock API Store
// -----------------------------------------------------------------------------
// In-memory simulation of ESP32 firmware v4.0 state. Persisted to a JSON file
// under .data/ so the demo state survives server restarts.
//
// In production: this file is NOT used. The PWA calls the real ESP32 firmware
// through the Cloudflare Tunnel URL configured in NEXT_PUBLIC_API_BASE_URL.
// =============================================================================

import { promises as fs } from 'fs';
import path from 'path';
import type {
  Channel,
  Schedule,
  PIRState,
  ActivityLog,
  LogType,
  SystemStatus,
  SystemConfig,
  FirmwareInfo,
  OtaHistoryEntry,
  RelaySource,
} from '@/lib/types';

// Use relative path that works in any environment (dev + Vercel)
const DATA_DIR = process.env.NODE_ENV === 'production'
  ? '/tmp/timer12-data'  // Vercel serverless: /tmp is writable
  : path.join(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'mock-state.json');
const LOG_FILE = path.join(DATA_DIR, 'mock-logs.json');

// Demo mode flag — when false, mock API routes return graceful JSON errors (403)
// instead of attempting auth.
// Checks both DEMO_MODE and NEXT_PUBLIC_DEMO_MODE so users only need to set
// one var (NEXT_PUBLIC_* is exposed to the browser, regular DEMO_MODE is not).
// PHASE 26 (demo mode isolation): In PRODUCTION builds, DEMO_MODE is FORCIBLY
// false even if NEXT_PUBLIC_DEMO_MODE=true is set.
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const RAW_DEMO_MODE = process.env.NODE_ENV === 'development'
  || process.env.DEMO_MODE === 'true'
  || process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
const DEMO_MODE = IS_PRODUCTION ? false : RAW_DEMO_MODE;

if (IS_PRODUCTION) {
  if (process.env.DEMO_MODE === 'true' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    console.error('[SECURITY] CRITICAL: DEMO_MODE/NEXT_PUBLIC_DEMO_MODE=true detected in production. Forcibly disabled.');
  }
  if (process.env.MOCK_USER || process.env.MOCK_PASSWORD) {
    console.error('[SECURITY] CRITICAL: MOCK_USER/MOCK_PASSWORD detected in production. Mock auth forcibly disabled.');
  }
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.error('[SECURITY] CRITICAL: JWT_SECRET shorter than 32 bytes in production.');
  }
}

const MOCK_AUTH_EXPLICITLY_ENABLED =
  Boolean(process.env.JWT_SECRET && process.env.MOCK_USER && process.env.MOCK_PASSWORD)
  && !IS_PRODUCTION;

// PRODUCTION GUARD (non-throwing):
// Mock auth is "enabled" only when (a) dev mode, OR (b) DEMO_MODE=true (which
// implies non-production intent), OR (c) JWT_SECRET + MOCK_USER + MOCK_PASSWORD
// are all explicitly set AND we're not in production.
// When disabled, verifyCredentials() returns false and getJwtSecret() returns
// empty string — no throws, no 500s. API routes use this to short-circuit
// with a graceful JSON 403 response.
export function isMockAuthEnabled(): boolean {
  return DEMO_MODE || MOCK_AUTH_EXPLICITLY_ENABLED;
}

// audit-fixes (auditor #2 P0): Default credentials are now EMPTY in all modes
//   except local dev (NODE_ENV === 'development'). The previous fallback
//   'admin'/'admin123' was a known-credential backdoor that could be accidentally
//   activated if NEXT_PUBLIC_DEMO_MODE was left set in production.
//   In dev mode, the fallback is kept for DX (no env file needed for local dev).
//   In production with DEMO_MODE=true (unusual, only for staging demos), the
//   admin MUST still set MOCK_USER + MOCK_PASSWORD explicitly.
const DEV_DEFAULT_USER = 'admin';
const DEV_DEFAULT_PASSWORD = 'admin123';
const DEFAULT_USER = process.env.MOCK_USER
  || (process.env.NODE_ENV === 'development' ? DEV_DEFAULT_USER : '');
const DEFAULT_PASSWORD_HASH = process.env.MOCK_PASSWORD
  || (process.env.NODE_ENV === 'development' ? DEV_DEFAULT_PASSWORD : '');
// audit-fixes (auditor #2 P1): JWT_SECRET fallback is now EMPTY in all modes
//   except local dev. Previously fell back to 'timer12-demo-only-secret' in
//   DEMO_MODE which could be brute-forced. Now: dev gets the dev secret for DX,
//   production MUST set JWT_SECRET explicitly or mock auth is disabled.
const JWT_SECRET = process.env.JWT_SECRET
  || (process.env.NODE_ENV === 'development' ? 'timer12-dev-only-secret' : '');

const NUM_CHANNELS = 12;
const NUM_PIR = 4;
const PIR_CHANNEL_OFFSET = 8; // PIR 1-4 → channel 9-12 (index 8-11)

const DAY_MS = 24 * 60 * 60 * 1000;
const BOOT_TIME = Date.now();

// ---------- In-memory state ----------
type StoreState = {
  deviceName: string;
  timezone: string;
  username: string;
  passwordHash: string;
  channels: Channel[];
  schedules: Schedule[];
  pirs: PIRState[];
  firmwareVersion: string;
  buildDate: string;
  latestAvailable: string;
  lastUpdateAt: number | null;
  lastUpdateStatus: 'success' | 'failed' | 'rollback' | null;
  otaHistory: OtaHistoryEntry[];
  otaStatus: FirmwareInfo['otaStatus'];
  bootTime: number;
  pirStartupTime: number;
};

// Use globalThis to survive Next.js dev module hot-reloads.
// Without this, every HMR cycle resets `state` to null and reloads from disk,
// racing with in-flight requests and overwriting recent mutations.
type GlobalStore = {
  state: StoreState | null;
  logs: ActivityLog[];
  nextLogId: number;
  nextScheduleId: number;
  pirSimTimer: NodeJS.Timeout | null;
  persistTimer: NodeJS.Timeout | null;
  recomputeTimer: NodeJS.Timeout | null;
};

const G: GlobalStore = ((globalThis as unknown as { __timer12Store?: GlobalStore }).__timer12Store) ?? (
  (globalThis as unknown as { __timer12Store?: GlobalStore }).__timer12Store = {
    state: null,
    logs: [],
    nextLogId: 1,
    nextScheduleId: 1,
    pirSimTimer: null,
    persistTimer: null,
    recomputeTimer: null,
  }
);

// ---------- Helpers ----------
function defaultChannels(): Channel[] {
  const names = [
    'Lampu Depan',
    'Lampu Taman',
    'Pompa Air',
    'Kipas Ruang Tamu',
    'TV Ruang Keluarga',
    'Lampu Dapur',
    'Lampu Kamar Utama',
    'AC Kamar Utama',
    'Lampu Koridor',     // PIR 1
    'Lampu Garasi',      // PIR 2
    'Lampu Belakang',    // PIR 3
    'Lampu Toilet',      // PIR 4
  ];
  return Array.from({ length: NUM_CHANNELS }, (_, i) => ({
    id: i + 1,
    name: names[i],
    modeAuto: i < 8,
    manualState: false,
    pirEnabled: i >= PIR_CHANNEL_OFFSET,
    pirHoldTime: 120,
    state: false,
    source: 'off' as RelaySource,
    hasPir: i >= PIR_CHANNEL_OFFSET,
    // v4.3.4 audit: state architecture fields for honest PWA demo
    desiredState: false,
    reportedState: false,
    physicalState: null,  // null = UNKNOWN (no aux contact feedback)
    stateConfidence: 'SOFTWARE_ONLY' as const,
    stateSequence: 0,
    stateTimestamp: 0,
    fault: false,
    safetyLockoutState: 'NORMAL' as const,
  }));
}

function defaultSchedules(): Schedule[] {
  // A few starter schedules so the demo isn't empty
  return [
    { id: G.nextScheduleId++, channelId: 1, onTime: '18:00', offTime: '06:00', dayMask: 0, enabled: true },
    { id: G.nextScheduleId++, channelId: 2, onTime: '19:00', offTime: '05:30', dayMask: 0b1111110, enabled: true }, // Mon-Sat
    { id: G.nextScheduleId++, channelId: 5, onTime: '07:00', offTime: '08:30', dayMask: 0b1111110, enabled: true },
    { id: G.nextScheduleId++, channelId: 8, onTime: '22:00', offTime: '05:00', dayMask: 0, enabled: true },
  ];
}

function defaultPIRs(): PIRState[] {
  return Array.from({ length: NUM_PIR }, (_, i) => ({
    id: i + 1,
    channelId: PIR_CHANNEL_OFFSET + i + 1,
    enabled: true,
    motionNow: false,
    lastMotionAt: null,
    triggerCountToday: Math.floor(Math.random() * 12),
    warmupUntil: BOOT_TIME + 60_000, // 60s warmup from boot
    stuckDetected: false,
    holdTime: 120,
  }));
}

function defaultState(): StoreState {
  return {
    deviceName: 'Timer12-ESP32-A1',
    timezone: 'Asia/Jakarta',
    username: DEFAULT_USER,
    passwordHash: DEFAULT_PASSWORD_HASH,
    channels: defaultChannels(),
    schedules: defaultSchedules(),
    pirs: defaultPIRs(),
    firmwareVersion: '3.1.0',
    buildDate: 'Aug  6 2026 09:14:00',
    latestAvailable: '4.0.0',
    lastUpdateAt: null,
    lastUpdateStatus: null,
    otaHistory: [],
    otaStatus: 'update-available',
    bootTime: BOOT_TIME,
    pirStartupTime: BOOT_TIME,
  };
}

// ---------- Persistence ----------
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

async function persist() {
  if (!G.state) return;
  await ensureDataDir();
  const data = JSON.stringify(G.state);
  await fs.writeFile(STATE_FILE, data, 'utf-8');
  await fs.writeFile(LOG_FILE, JSON.stringify({ logs: G.logs, nextLogId: G.nextLogId }), 'utf-8');
}

function schedulePersist() {
  if (G.persistTimer) clearTimeout(G.persistTimer);
  G.persistTimer = setTimeout(() => {
    persist().catch((err) => console.error('[mockStore] persist failed:', err));
  }, 2000);
}

async function load() {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(STATE_FILE, 'utf-8');
    G.state = JSON.parse(raw) as StoreState;
    // Reset boot time on reload (simulates fresh start)
    G.state.bootTime = Date.now();
    G.state.pirStartupTime = Date.now();
    G.state.pirs = G.state.pirs.map((p) => ({
      ...p,
      warmupUntil: Date.now() + 60_000,
      motionNow: false,
      stuckDetected: false,
    }));
  } catch {
    G.state = defaultState();
  }
  try {
    const rawLogs = await fs.readFile(LOG_FILE, 'utf-8');
    const parsed = JSON.parse(rawLogs);
    G.logs = parsed.logs || [];
    G.nextLogId = parsed.nextLogId || 1;
  } catch {
    G.logs = [];
  }
  // Cap G.logs to last 500
  if (G.logs.length > 500) {
    G.logs = G.logs.slice(-500);
  }
  // Reset daily counters if a new day has started
  resetDailyCountersIfNeeded();
}

function resetDailyCountersIfNeeded() {
  if (!G.state) return;
  const today = new Date().toDateString();
  const lastReset = (G.state as StoreState & { lastDailyReset?: string }).lastDailyReset;
  if (lastReset !== today) {
    G.state.pirs = G.state.pirs.map((p) => ({ ...p, triggerCountToday: 0 }));
    (G.state as StoreState & { lastDailyReset?: string }).lastDailyReset = today;
  }
}

// ---------- Log helpers ----------
function appendLog(type: LogType, message: string, channelId: number | null = null) {
  G.logs.push({
    id: G.nextLogId++,
    timestamp: Date.now(),
    type,
    channelId,
    message,
  });
  if (G.logs.length > 500) G.logs = G.logs.slice(-500);
  schedulePersist();
}

// ---------- Relay G.state engine (mirrors firmware priority logic) ----------
function dayMaskMatches(dayMask: number, date: Date): boolean {
  if (dayMask === 0) return true; // every day
  // JS getDay: 0=Sun, 1=Mon, ... 6=Sat
  // Our bit0=Mon ... bit6=Sun
  const jsDay = date.getDay();
  const bitIndex = jsDay === 0 ? 6 : jsDay - 1;
  return (dayMask & (1 << bitIndex)) !== 0;
}

function parseTimeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function isScheduleActive(s: Schedule, now: Date): boolean {
  if (!s.enabled) return false;
  if (!dayMaskMatches(s.dayMask, now)) return false;
  const curMin = now.getHours() * 60 + now.getMinutes();
  const onMin = parseTimeToMinutes(s.onTime);
  const offMin = parseTimeToMinutes(s.offTime);
  // Handle overnight (onTime > offTime)
  if (onMin <= offMin) {
    return curMin >= onMin && curMin < offMin;
  } else {
    return curMin >= onMin || curMin < offMin;
  }
}

function recomputeRelayStates() {
  if (!G.state) return;
  const now = new Date();
  let changes: { channel: Channel; newState: boolean; newSource: RelaySource }[] = [];

  G.state.channels.forEach((ch, idx) => {
    let newState = false;
    let newSource: RelaySource = 'off';

    if (!ch.modeAuto) {
      // Manual mode wins
      newState = ch.manualState;
      newSource = ch.manualState ? 'manual' : 'off';
    } else {
      // Auto mode: PIR > Schedule > Off
      if (ch.hasPir && ch.pirEnabled) {
        const pir = G.state!.pirs.find((p) => p.channelId === ch.id);
        if (pir && pir.motionNow && Date.now() >= pir.warmupUntil) {
          newState = true;
          newSource = 'pir';
        }
      }
      if (!newState) {
        const schedules = G.state!.schedules.filter((s) => s.channelId === ch.id);
        const active = schedules.find((s) => isScheduleActive(s, now));
        if (active) {
          newState = true;
          newSource = 'schedule';
        }
      }
    }

    if (newState !== ch.state) {
      changes.push({ channel: ch, newState, newSource });
    }
    G.state!.channels[idx] = { ...ch, state: newState, source: newSource };
  });

  // Log G.state changes
  for (const c of changes) {
    appendLog(
      c.newState ? 'relay_on' : 'relay_off',
      `${c.channel.name} (CH${c.channel.id}) ${c.newState ? 'ON' : 'OFF'} via ${c.newSource}`,
      c.channel.id
    );
  }
}

// ---------- PIR simulation ----------

function startPirSimulation() {
  if (G.pirSimTimer) clearInterval(G.pirSimTimer);
  G.pirSimTimer = setInterval(() => {
    if (!G.state) return;
    const now = Date.now();
    G.state.pirs.forEach((p, idx) => {
      // Skip during warmup
      if (now < p.warmupUntil) return;
      // Random motion trigger (~15% chance per check)
      if (!p.motionNow && Math.random() < 0.15) {
        G.state!.pirs[idx] = {
          ...p,
          motionNow: true,
          lastMotionAt: now,
          triggerCountToday: p.triggerCountToday + 1,
        };
        appendLog('pir_trigger', `PIR ${p.id} motion detected (CH${p.channelId})`, p.channelId);
        // Auto-clear after holdTime
        setTimeout(() => {
          if (G.state && G.state.pirs[idx]) {
            G.state.pirs[idx] = { ...G.state.pirs[idx], motionNow: false };
          }
        }, p.holdTime * 1000);
      }
      // Stuck detection: motionNow HIGH for >30 min
      if (p.motionNow && p.lastMotionAt && now - p.lastMotionAt > 30 * 60 * 1000) {
        if (!p.stuckDetected) {
          G.state!.pirs[idx] = { ...p, stuckDetected: true, motionNow: false };
          appendLog('error', `PIR ${p.id} stuck detected (30min timeout) — forced OFF`, p.channelId);
        }
      }
    });
    recomputeRelayStates();
  }, 10_000); // check every 10s
}

// ---------- Public API ----------
export async function getStore(): Promise<StoreState> {
  if (!G.state) {
    await load();
    startPirSimulation();
    // Initial relay computation
    recomputeRelayStates();
    // Recompute every 30s (in case schedule G.state changes by minute)
    setInterval(recomputeRelayStates, 30_000);
  }
  return G.state!;
}

export function getLogsSnapshot(): ActivityLog[] {
  return [...G.logs].reverse(); // newest first
}

export function appendLogExternal(type: LogType, message: string, channelId: number | null = null) {
  appendLog(type, message, channelId);
}

// ---------- Auth ----------
// Returns false when mock auth is disabled (no throw — caller decides response).
export function verifyCredentials(username: string, password: string): boolean {
  if (!isMockAuthEnabled() || !G.state) return false;
  return G.state.username === username && G.state.passwordHash === password;
}

// Returns empty string when mock auth is disabled. verifyJwt() with empty
// secret naturally returns null — getSession() returns unauthenticated.
export function getJwtSecret(): string {
  return JWT_SECRET;
}

export function changePassword(current: string, next: string): boolean {
  if (!G.state) return false;
  if (G.state.passwordHash !== current) return false;
  G.state.passwordHash = next;
  schedulePersist();
  appendLog('config_change', `Password changed for user ${G.state.username}`, null);
  return true;
}

// ---------- Mutations ----------
export function setRelayState(channelId: number, action: 'toggle' | 'on' | 'off' | 'set_mode', opts?: { mode?: 'auto' | 'manual'; manualState?: boolean }): boolean {
  if (!G.state) return false;
  const idx = G.state.channels.findIndex((c) => c.id === channelId);
  if (idx < 0) return false;
  const ch = G.state.channels[idx];
  if (action === 'set_mode') {
    if (opts?.mode === 'auto') {
      G.state.channels[idx] = { ...ch, modeAuto: true };
      appendLog('config_change', `${ch.name} set to AUTO mode`, channelId);
    } else if (opts?.mode === 'manual') {
      G.state.channels[idx] = { ...ch, modeAuto: false, manualState: opts.manualState ?? false };
      appendLog('config_change', `${ch.name} set to MANUAL mode (G.state=${opts.manualState ?? false})`, channelId);
    }
  } else {
    // Force manual mode for direct toggle
    let newManual: boolean;
    if (action === 'toggle') newManual = !ch.manualState;
    else if (action === 'on') newManual = true;
    else newManual = false;
    G.state.channels[idx] = { ...ch, modeAuto: false, manualState: newManual };
    appendLog('config_change', `${ch.name} manually ${newManual ? 'ON' : 'OFF'}`, channelId);
  }
  recomputeRelayStates();
  schedulePersist();
  return true;
}

export function upsertSchedule(s: Schedule): boolean {
  if (!G.state) return false;
  const chSchedules = G.state.schedules.filter((x) => x.channelId === s.channelId);
  if (s.id) {
    const idx = G.state.schedules.findIndex((x) => x.id === s.id);
    if (idx >= 0) {
      G.state.schedules[idx] = s;
      appendLog('config_change', `Schedule updated for CH${s.channelId}`, s.channelId);
    } else return false;
  } else {
    if (chSchedules.length >= 4) return false;
    G.state.schedules.push({ ...s, id: G.nextScheduleId++ });
    appendLog('config_change', `Schedule added for CH${s.channelId} (${s.onTime}-${s.offTime})`, s.channelId);
  }
  recomputeRelayStates();
  schedulePersist();
  return true;
}

export function deleteSchedule(id: number): boolean {
  if (!G.state) return false;
  const idx = G.state.schedules.findIndex((x) => x.id === id);
  if (idx < 0) return false;
  const s = G.state.schedules[idx];
  G.state.schedules.splice(idx, 1);
  appendLog('config_change', `Schedule deleted for CH${s.channelId}`, s.channelId);
  recomputeRelayStates();
  schedulePersist();
  return true;
}

export function renameChannel(channelId: number, newName: string): boolean {
  if (!G.state) return false;
  const idx = G.state.channels.findIndex((c) => c.id === channelId);
  if (idx < 0) return false;
  const trimmed = newName.trim();
  if (trimmed.length < 1 || trimmed.length > 32) return false;
  const oldName = G.state.channels[idx].name;
  if (oldName === trimmed) return true;
  G.state.channels[idx] = { ...G.state.channels[idx], name: trimmed };
  appendLog('config_change', `CH${channelId} renamed: "${oldName}" → "${trimmed}"`, channelId);
  schedulePersist();
  return true;
}

export function updatePIRConfig(id: number, opts: { enabled?: boolean; holdTime?: number }): boolean {
  if (!G.state) return false;
  const idx = G.state.pirs.findIndex((p) => p.id === id);
  if (idx < 0) return false;
  const p = G.state.pirs[idx];
  G.state.pirs[idx] = {
    ...p,
    enabled: opts.enabled ?? p.enabled,
    holdTime: opts.holdTime ?? p.holdTime,
  };
  // Sync to channel
  const chIdx = G.state.channels.findIndex((c) => c.id === p.channelId);
  if (chIdx >= 0) {
    G.state.channels[chIdx] = {
      ...G.state.channels[chIdx],
      pirEnabled: G.state.pirs[idx].enabled,
      pirHoldTime: G.state.pirs[idx].holdTime,
    };
  }
  appendLog('config_change', `PIR ${id} config updated (enabled=${opts.enabled ?? p.enabled}, hold=${opts.holdTime ?? p.holdTime}s)`, p.channelId);
  schedulePersist();
  return true;
}

export function testPIRTrigger(id: number): boolean {
  if (!G.state) return false;
  const idx = G.state.pirs.findIndex((p) => p.id === id);
  if (idx < 0) return false;
  const p = G.state.pirs[idx];
  if (Date.now() < p.warmupUntil) return false;
  G.state.pirs[idx] = {
    ...p,
    motionNow: true,
    lastMotionAt: Date.now(),
    triggerCountToday: p.triggerCountToday + 1,
  };
  appendLog('pir_trigger', `PIR ${id} manual test trigger`, p.channelId);
  recomputeRelayStates();
  setTimeout(() => {
    if (G.state && G.state.pirs[idx]) {
      G.state.pirs[idx] = { ...G.state.pirs[idx], motionNow: false };
      recomputeRelayStates();
    }
  }, p.holdTime * 1000);
  return true;
}

export function setRtcTime(isoDatetime: string): boolean {
  // In mock mode, we just log it (RTC time is the system clock)
  appendLog('time_sync', `RTC time set to ${isoDatetime}`, null);
  return true;
}

export function updateDeviceConfig(opts: { deviceName?: string; timezone?: string }): boolean {
  if (!G.state) return false;
  if (opts.deviceName !== undefined) G.state.deviceName = opts.deviceName;
  if (opts.timezone !== undefined) G.state.timezone = opts.timezone;
  appendLog('config_change', `Device config updated`, null);
  schedulePersist();
  return true;
}

export function exportConfig(): SystemConfig {
  if (!G.state) throw new Error('Store not initialized');
  return {
    deviceName: G.state.deviceName,
    timezone: G.state.timezone,
    channels: G.state.channels,
    schedules: G.state.schedules,
    pirs: G.state.pirs,
  };
}

export function importConfig(cfg: Partial<SystemConfig>): boolean {
  if (!G.state) return false;

  // Deep validation — treat as untrusted input
  if (cfg.deviceName) {
    if (typeof cfg.deviceName !== 'string' || cfg.deviceName.length < 1 || cfg.deviceName.length > 32) return false;
    G.state.deviceName = cfg.deviceName;
  }
  if (cfg.timezone) {
    if (typeof cfg.timezone !== 'string' || cfg.timezone.length > 40) return false;
    G.state.timezone = cfg.timezone;
  }
  if (cfg.channels && Array.isArray(cfg.channels)) {
    if (cfg.channels.length !== 12) return false;  // must have exactly 12 channels
    // Validate each channel
    for (const ch of cfg.channels) {
      if (!ch || typeof ch.id !== 'number' || ch.id < 1 || ch.id > 12) return false;
      if (typeof ch.name !== 'string' || ch.name.length > 20) return false;
      if (typeof ch.modeAuto !== 'boolean') return false;
    }
    G.state.channels = cfg.channels;
  }
  if (cfg.schedules && Array.isArray(cfg.schedules)) {
    // Validate schedules
    for (const s of cfg.schedules) {
      if (!s || typeof s.channelId !== 'number' || s.channelId < 1 || s.channelId > 12) return false;
      if (typeof s.onTime !== 'string' || !/^\d{2}:\d{2}$/.test(s.onTime)) return false;
      if (typeof s.offTime !== 'string' || !/^\d{2}:\d{2}$/.test(s.offTime)) return false;
      if (typeof s.dayMask !== 'number' || s.dayMask < 0 || s.dayMask > 127) return false;
      if (typeof s.enabled !== 'boolean') return false;
    }
    G.state.schedules = cfg.schedules;
  }
  if (cfg.pirs && Array.isArray(cfg.pirs)) {
    if (cfg.pirs.length !== 4) return false;  // must have exactly 4 PIRs
    G.state.pirs = cfg.pirs;
  }
  appendLog('config_change', 'Configuration imported (validated)', null);
  recomputeRelayStates();
  schedulePersist();
  return true;
}

export function factoryReset(): boolean {
  if (!G.state) return false;
  const fresh = defaultState();
  G.state = fresh;
  G.logs = [];
  G.nextLogId = 1;
  appendLog('factory_reset', 'Factory reset performed. System rebooting.', null);
  persist();
  return true;
}

export function reboot(): boolean {
  appendLog('restart', 'System reboot requested', null);
  return true;
}

// ---------- OTA simulation ----------
export function getFirmwareInfo(): FirmwareInfo {
  if (!G.state) throw new Error('Store not initialized');
  return {
    currentVersion: G.state.firmwareVersion,
    buildDate: G.state.buildDate,
    latestAvailable: G.state.latestAvailable,
    updateAvailable: G.state.firmwareVersion !== G.state.latestAvailable,
    signatureVerified: true,
    otaStatus: G.state.otaStatus,
    lastUpdateAt: G.state.lastUpdateAt,
    lastUpdateStatus: G.state.lastUpdateStatus,
  };
}

export function getOtaHistory(): OtaHistoryEntry[] {
  if (!G.state) return [];
  return G.state.otaHistory;
}

export async function simulateOtaUpdate(toVersion: string): Promise<boolean> {
  if (!G.state) return false;
  const fromVersion = G.state.firmwareVersion;
  const startTime = Date.now();

  G.state.otaStatus = 'uploading';
  await new Promise((r) => setTimeout(r, 1500));
  G.state.otaStatus = 'verifying';
  await new Promise((r) => setTimeout(r, 1200));
  G.state.otaStatus = 'installing';
  await new Promise((r) => setTimeout(r, 2000));

  // 90% success rate
  const success = Math.random() < 0.9;
  const duration = Math.round((Date.now() - startTime) / 1000);

  if (success) {
    G.state.firmwareVersion = toVersion;
    G.state.otaStatus = 'up-to-date';
    G.state.lastUpdateAt = Date.now();
    G.state.lastUpdateStatus = 'success';
    G.state.otaHistory.push({
      id: G.state.otaHistory.length + 1,
      timestamp: Date.now(),
      fromVersion,
      toVersion,
      status: 'success',
      durationSeconds: duration,
    });
    appendLog('ota', `OTA update ${fromVersion} → ${toVersion} succeeded (${duration}s)`, null);
  } else {
    G.state.otaStatus = 'rollback';
    G.state.lastUpdateStatus = 'rollback';
    G.state.otaHistory.push({
      id: G.state.otaHistory.length + 1,
      timestamp: Date.now(),
      fromVersion,
      toVersion,
      status: 'rollback',
      durationSeconds: duration,
    });
    appendLog('ota', `OTA update ${fromVersion} → ${toVersion} failed — rolled back`, null);
  }
  schedulePersist();
  return success;
}

// ---------- Status ----------
export function getSystemStatus(): SystemStatus {
  if (!G.state) throw new Error('Store not initialized');
  const now = Date.now();
  const uptimeSeconds = Math.floor((now - G.state.bootTime) / 1000);
  const relaysOn = G.state.channels.filter((c) => c.state).length;
  const schedulesActive = G.state.schedules.filter((s) => s.enabled && isScheduleActive(s, new Date())).length;
  const pirTriggersToday = G.state.pirs.reduce((sum, p) => sum + p.triggerCountToday, 0);
  const errorsToday = G.logs.filter(
    (l) => l.type === 'error' && now - l.timestamp < DAY_MS
  ).length;

  // Mock hardware stats with small variation
  const freeHeap = 180_000 + Math.floor(Math.random() * 20_000);
  const cpuLoad = 8 + Math.floor(Math.random() * 15);
  const flashFree = 35 + Math.floor(Math.random() * 5);
  const wifiRssi = -55 - Math.floor(Math.random() * 15);

  // PZEM mock values
  const pzVoltage = 220.0 + (Math.random() - 0.5) * 4;
  const pzCurrent = relaysOn * 0.15 + Math.random() * 0.05;
  const pzPower = relaysOn * 33 + Math.random() * 10;
  const pzApparent = pzVoltage * pzCurrent;
  const pzReactive = Math.sqrt(Math.max(0, pzApparent * pzApparent - pzPower * pzPower));

  // v4.1 — DC Energy & Battery Monitoring mock (brief §56)
  // Realistic 8S LiFePO4 around 26.4 V nominal. Cell voltages around 3.30 V ± 20 mV
  // to demonstrate realistic cell delta. Currents signed per contract.
  // Ibattery < 0 during day (PV charging), > 0 during night (discharge).
  const hour = new Date().getHours();
  const isCharging = hour >= 7 && hour <= 16;  // daylight hours
  const batteryV = 26.4 + (Math.random() - 0.5) * 0.4;
  const ibatt = isCharging ? -(15 + Math.random() * 25) : (8 + Math.random() * 18);
  const iinv = 5 + Math.random() * 30;       // inverter always consumes
  const imppt = iinv - ibatt;                // derived (brief §6)
  const pbatt = batteryV * ibatt;            // signed
  const pinv = batteryV * iinv;
  const pmppt = batteryV * imppt;
  const baseCellV = 3.30 + (Math.random() - 0.5) * 0.02;
  const cellV = Array.from({ length: 8 }, (_, i) =>
    Number((baseCellV + (Math.random() - 0.5) * 0.04 + (i === 3 ? -0.015 : 0)).toFixed(3))
  );
  const cellMin = Math.min(...cellV);
  const cellMax = Math.max(...cellV);
  const cellAvg = cellV.reduce((a, b) => a + b, 0) / 8;
  const cellDelta = cellMax - cellMin;
  const minIdx = cellV.indexOf(cellMin) + 1;
  const maxIdx = cellV.indexOf(cellMax) + 1;
  const pvWh = 4250 + Math.random() * 50;
  const chargedWh = 3200 + Math.random() * 30;
  const dischargedWh = 2900 + Math.random() * 30;
  const inverterDcWh = 5500 + Math.random() * 40;
  const chargedAh = chargedWh / 26.4;
  const dischargedAh = dischargedWh / 26.4;

  return {
    firmwareVersion: G.state.firmwareVersion,
    buildDate: G.state.buildDate,
    deviceName: G.state.deviceName,
    uptimeSeconds,
    currentTime: now,
    timezone: G.state.timezone,
    wifiRssi,
    freeHeap,
    cpuLoadPercent: cpuLoad,
    flashFreePercent: flashFree,
    channels: G.state.channels,
    pirs: G.state.pirs,
    schedules: G.state.schedules,
    stats: {
      relaysOn,
      schedulesActive,
      pirTriggersToday,
      errorsToday,
    },
    online: true,
    // PZEM-004T v3.0 mock data (simulated for demo mode)
    pzemAvailable: true,
    voltage: pzVoltage,
    current: pzCurrent,
    power: pzPower,
    energy: relaysOn * 0.0055 + Math.random() * 0.002,
    frequency: 50.0 + (Math.random() - 0.5) * 0.2,
    powerFactor: 0.85 + Math.random() * 0.1,
    powerAlarm: false,
    apparentPower: pzApparent,
    reactivePower: pzReactive,
    // Daily stats
    energyToday: 2.7 + Math.random() * 0.5,
    voltageMin: 215.0 + Math.random() * 3,
    voltageMax: 225.0 + Math.random() * 3,
    currentMax: 0.8 + Math.random() * 0.2,
    powerMax: 180 + Math.random() * 50,
    powerAvg: 80 + Math.random() * 30,
    // Alarms
    alarms: {
      undervoltage: false,
      overvoltage: false,
      overcurrent: false,
      overpower: false,
      lowPowerFactor: false,
    },
    // v4.1 — DC Energy & Battery Monitoring blocks (brief §56 — demo mode)
    battery: {
      packVoltage: Number(batteryV.toFixed(2)),
      packVoltageValid: true,
      packVoltageSource: 'ads1115_bplus',
      current: Number(ibatt.toFixed(2)),
      power: Number(pbatt.toFixed(1)),
      chargePower: Number(Math.max(0, -pbatt).toFixed(1)),
      dischargePower: Number(Math.max(0, pbatt).toFixed(1)),
      socAvailable: true,
      soc: Number(((batteryV - 20.0) / (29.2 - 20.0) * 100).toFixed(1)),
      socSynchronized: true,
      chargedAh: Number(chargedAh.toFixed(2)),
      dischargedAh: Number(dischargedAh.toFixed(2)),
      chargedWh: Number(chargedWh.toFixed(1)),
      dischargedWh: Number(dischargedWh.toFixed(1)),
      cells: cellV.map((v, i) => ({
        index: i + 1,
        voltage: Number(v.toFixed(3)),
        state: 'ok' as const,
      })),
      cellMetrics: {
        min: Number(cellMin.toFixed(3)),
        max: Number(cellMax.toFixed(3)),
        average: Number(cellAvg.toFixed(3)),
        delta: Number(cellDelta.toFixed(3)),
        minIndex: minIdx,
        maxIndex: maxIdx,
      },
      packResistance: {
        ohms: 0.032 + Math.random() * 0.01,
        deltaV: 0.05 + Math.random() * 0.02,
        deltaI: 2.0 + Math.random() * 1.0,
        sampleWindowMs: 2000,
        quality: 'VALID' as const,
      },
      cellResistance: cellV.map((_, i) => ({
        index: i + 1,
        ohms: 0.004 + Math.random() * 0.003,
        quality: 'VALID' as const,
      })),
      valid: true,
      diagnostics: {
        batteryVoltageFault: false,
        batteryCurrentSensorFault: false,
        inverterCurrentSensorFault: false,
        cellMeasurementFault: false,
        cellTapFault: false,
        cellOverVoltage: false,
        cellUnderVoltage: false,
        cellImbalance: cellDelta > 0.08,
        highPackResistance: false,
        highCellResistance: false,
        powerFlowInconsistency: false,
        sht31Fault: false,
        adsFault: false,
        inaFault: false,
        overall: cellDelta > 0.08 ? 'WARNING' as const : 'NORMAL' as const,
      },
    },
    powerFlow: {
      mpptCurrent: Number(imppt.toFixed(2)),
      mpptPower: Number(pmppt.toFixed(1)),
      batteryCurrent: Number(ibatt.toFixed(2)),
      batteryPower: Number(pbatt.toFixed(1)),
      inverterCurrent: Number(iinv.toFixed(2)),
      inverterDcPower: Number(pinv.toFixed(1)),
      consistencyError: Number(((Math.random() - 0.5) * 10).toFixed(1)),
      consistency: 'NORMAL' as const,
      batteryCurrentValid: true,
      inverterCurrentValid: true,
      valid: true,
    },
    environment: {
      temperature: Number((28 + (Math.random() - 0.5) * 4).toFixed(1)),
      humidity: Number((65 + (Math.random() - 0.5) * 10).toFixed(1)),
      valid: true,
      label: 'ambient' as const,
    },
    dcEnergy: {
      pvWh: Number(pvWh.toFixed(1)),
      batteryChargedWh: Number(chargedWh.toFixed(1)),
      batteryDischargedWh: Number(dischargedWh.toFixed(1)),
      inverterDcWh: Number(inverterDcWh.toFixed(1)),
      chargedAh: Number(chargedAh.toFixed(2)),
      dischargedAh: Number(dischargedAh.toFixed(2)),
      valid: true,
    },
    // v4.2 — industrial-grade health + alarms + telemetry sequence (brief §22, §44, §60)
    health: {
      uptimeSeconds,
      bootCount: 1 + Math.floor(Math.random() * 3),
      lastResetReason: 1,  // POWERON_RESET
      lastResetReasonStr: 'POWERON_RESET',
      watchdogResets: 0,
      brownoutResets: 0,
      freeHeap,
      minFreeHeap: freeHeap - 5000,
      largestFreeBlock: freeHeap - 2000,
      wifiReconnectCount: Math.floor(Math.random() * 2),
      mqttReconnectCount: Math.floor(Math.random() * 2),
      rtcStatus: 'VALID' as const,
      pzemStatus: 'VALID' as const,
      pirStatus: 'VALID' as const,
      sht31Status: 'VALID' as const,
      ina219Status: 'VALID' as const,
      ads1115Status: 'VALID' as const,
      filesystemOk: true,
      nvsOk: true,
      mqttConnected: true,
      highestAlarmSeverity: 'INFO' as const,
      taskHeartbeats: {
        relayEngine: Math.floor(Math.random() * 1000),
        mqtt: Math.floor(Math.random() * 1000),
        telemetry: Math.floor(Math.random() * 1000),
        scheduler: Math.floor(Math.random() * 1000),
        pir: Math.floor(Math.random() * 1000),
        pzem: Math.floor(Math.random() * 1000),
        ota: Math.floor(Math.random() * 1000),
        healthMonitor: Math.floor(Math.random() * 1000),
        batteryMonitor: Math.floor(Math.random() * 1000),
      },
    },
    // v4.2 — system-wide alarm registry (brief §60). Empty = NORMAL state.
    systemAlarms: [] as import('@/lib/types').Alarm[],
    telemetrySequence: Math.floor(Math.random() * 1000) + 1,
  };
}
