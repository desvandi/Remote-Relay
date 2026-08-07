// =============================================================================
// Energy History — stores power readings in localStorage (24h rolling)
// Sampled every 60s from MQTT status updates = max 1440 data points
// =============================================================================

export type EnergySample = {
  ts: number;          // ms epoch
  voltage: number;     // V
  current: number;     // A
  power: number;       // W
  energy: number;      // kWh (total)
  frequency: number;   // Hz
  powerFactor: number; // 0-1
};

const STORAGE_KEY = 'timer12-energy-history';
const MAX_SAMPLES = 1440;  // 24h × 60 samples/hour
const SAMPLE_INTERVAL_MS = 60_000;  // 1 minute

let lastSampleMs = 0;
let cachedHistory: EnergySample[] | null = null;

export function getEnergyHistory(): EnergySample[] {
  if (cachedHistory) return cachedHistory;
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      cachedHistory = JSON.parse(raw) as EnergySample[];
      return cachedHistory;
    }
  } catch {}
  return [];
}

export function recordEnergySample(status: {
  voltage?: number;
  current?: number;
  power?: number;
  energy?: number;
  frequency?: number;
  powerFactor?: number;
  pzemAvailable?: boolean;
}): void {
  if (!status.pzemAvailable) return;
  if (typeof localStorage === 'undefined') return;

  const now = Date.now();
  if (now - lastSampleMs < SAMPLE_INTERVAL_MS) return;
  lastSampleMs = now;

  const sample: EnergySample = {
    ts: now,
    voltage: status.voltage ?? 0,
    current: status.current ?? 0,
    power: status.power ?? 0,
    energy: status.energy ?? 0,
    frequency: status.frequency ?? 50,
    powerFactor: status.powerFactor ?? 0,
  };

  const history = getEnergyHistory();
  history.push(sample);

  // Trim to max samples (remove oldest)
  if (history.length > MAX_SAMPLES) {
    history.splice(0, history.length - MAX_SAMPLES);
  }

  // Save to localStorage (best-effort, may fail if quota exceeded)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    cachedHistory = history;
  } catch {
    // Quota exceeded — trim harder
    if (history.length > 720) {
      history.splice(0, history.length - 720);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        cachedHistory = history;
      } catch {}
    }
  }
}

export function clearEnergyHistory(): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  cachedHistory = [];
}

// Get samples from last N hours
export function getRecentSamples(hours: number): EnergySample[] {
  const history = getEnergyHistory();
  const cutoff = Date.now() - hours * 3600_000;
  return history.filter((s) => s.ts >= cutoff);
}

// Calculate cost from kWh
export const DEFAULT_TARIFF_RP_PER_KWH = 1467; // PLN R1 tarif

export function getTariff(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_TARIFF_RP_PER_KWH;
  const stored = localStorage.getItem('timer12-tariff');
  return stored ? Number(stored) : DEFAULT_TARIFF_RP_PER_KWH;
}

export function setTariff(rpPerKwh: number): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem('timer12-tariff', String(rpPerKwh));
}

export function calculateCost(kwh: number): number {
  return Math.round(kwh * getTariff());
}

// Estimate monthly bill from current daily consumption
export function estimateMonthlyBill(dailyKwh: number): number {
  const daysInMonth = 30;
  return calculateCost(dailyKwh * daysInMonth);
}
