// =============================================================================
// Formatting utilities for the dashboard
// =============================================================================

export function formatUptime(seconds: number, lang: 'id' | 'en' = 'id'): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d} ${lang === 'id' ? 'h' : 'd'}`);
  if (h > 0) parts.push(`${h} ${lang === 'id' ? 'j' : 'h'}`);
  if (m > 0) parts.push(`${m} ${lang === 'id' ? 'm' : 'm'}`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

export function formatTime(ts: number, timezone?: string, lang: 'id' | 'en' = 'id'): string {
  const d = new Date(ts);
  try {
    return new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(d);
  } catch {
    return d.toLocaleTimeString();
  }
}

export function formatDateTime(ts: number, timezone?: string, lang: 'id' | 'en' = 'id'): string {
  const d = new Date(ts);
  try {
    return new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-US', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

export function formatRelativeTime(ts: number | null, lang: 'id' | 'en' = 'id'): string {
  if (!ts) return lang === 'id' ? 'Tidak pernah' : 'Never';
  const diff = Date.now() - ts;
  if (diff < 5_000) return lang === 'id' ? 'Baru saja' : 'Just now';
  if (diff < 60_000) return lang === 'id' ? `${Math.floor(diff / 1000)} dtk lalu` : `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return lang === 'id' ? `${Math.floor(diff / 60000)} mnt lalu` : `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86_400_000) return lang === 'id' ? `${Math.floor(diff / 3_600_000)} jam lalu` : `${Math.floor(diff / 3_600_000)}h ago`;
  return lang === 'id' ? `${Math.floor(diff / 86_400_000)} hari lalu` : `${Math.floor(diff / 86_400_000)}d ago`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function formatRssi(rssi: number): { label: string; bars: number } {
  if (rssi >= -55) return { label: 'Excellent', bars: 4 };
  if (rssi >= -65) return { label: 'Good', bars: 3 };
  if (rssi >= -75) return { label: 'Fair', bars: 2 };
  if (rssi >= -85) return { label: 'Weak', bars: 1 };
  return { label: 'Poor', bars: 0 };
}

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

export function dayMaskToDays(mask: number): boolean[] {
  // returns [Mon..Sun] booleans
  if (mask === 0) return [true, true, true, true, true, true, true];
  return DAY_KEYS.map((_, i) => (mask & (1 << i)) !== 0);
}

export function daysToDayMask(days: boolean[]): number {
  if (days.every(Boolean)) return 0;
  let mask = 0;
  for (let i = 0; i < 7; i++) {
    if (days[i]) mask |= 1 << i;
  }
  return mask;
}
