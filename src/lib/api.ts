// =============================================================================
// API Client — calls ESP32 firmware v4.0 REST API contract
// -----------------------------------------------------------------------------
// In production: NEXT_PUBLIC_API_BASE_URL points to the Cloudflare Tunnel URL
//   (e.g., https://timer.example.com) which routes to the ESP32.
// In demo/mock mode: BASE_URL is empty so all calls go to the relative
//   /api/* Next.js route handlers in this project.
// =============================================================================

import type { ApiResponse } from '@/lib/types';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// CSRF token cache (per session)
let csrfTokenCache: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfTokenCache = token;
}

export function getCsrfToken(): string | null {
  return csrfTokenCache;
}

async function request<T>(
  path: string,
  opts: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    signal?: AbortSignal;
    skipCsrf?: boolean;
  } = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };
  if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  // Attach CSRF token for state-changing requests
  if (!opts.skipCsrf && opts.method && opts.method !== 'GET' && csrfTokenCache) {
    headers['X-CSRF-Token'] = csrfTokenCache;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: 'include', // send/receive cookies (JWT)
      signal: opts.signal,
      cache: 'no-store',
    });
  } catch (err) {
    throw new ApiError(
      err instanceof Error ? `Network error: ${err.message}` : 'Network error',
      0
    );
  }

  let json: ApiResponse<T> | null = null;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(`Invalid JSON response (status ${res.status})`, res.status);
  }

  if (!res.ok || !json.success) {
    const msg = json?.message || `Request failed (${res.status})`;
    throw new ApiError(msg, res.status);
  }
  return json.data;
}

// ---------- Auth ----------
export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; csrfToken: string; expiresAt: number; username: string }>(
      '/api/login',
      { method: 'POST', body: { username, password }, skipCsrf: true }
    ),
  logout: () => request<{ success: boolean }>('/api/logout', { method: 'POST' }),
  session: () => request<{ isAuthenticated: boolean; username: string | null; expiresAt: number | null }>(
    '/api/session'
  ),
  // Status & config
  status: () => request<import('@/lib/types').SystemStatus>('/api/status'),
  config: () => request<import('@/lib/types').SystemConfig>('/api/config'),
  version: () => request<import('@/lib/types').FirmwareInfo>('/api/version'),
  // Mutations
  relay: (mutation: import('@/lib/types').RelayMutation) =>
    request<{ channel: import('@/lib/types').Channel }>('/api/relay', { method: 'POST', body: mutation }),
  channelRename: (channelId: number, name: string) =>
    request<{ channel: { id: number; name: string } }>('/api/channel', { method: 'POST', body: { channelId, name } }),
  schedule: (sched: import('@/lib/types').Schedule) =>
    request<{ schedule: import('@/lib/types').Schedule }>('/api/schedule', { method: 'POST', body: sched }),
  scheduleDelete: (id: number) =>
    request<{ deleted: boolean }>(`/api/schedule?id=${id}`, { method: 'DELETE' }),
  pir: (id: number, opts: { enabled?: boolean; holdTime?: number }) =>
    request<{ pir: import('@/lib/types').PIRState }>('/api/pir', { method: 'POST', body: { id, ...opts } }),
  pirTest: (id: number) =>
    request<{ triggered: boolean }>('/api/pir/test', { method: 'POST', body: { id } }),
  time: (datetime: string) =>
    request<{ synced: boolean }>('/api/time', { method: 'POST', body: { datetime } }),
  // Logs
  logs: (filter?: { type?: string; channelId?: number; limit?: number }) => {
    const params = new URLSearchParams();
    if (filter?.type && filter.type !== 'all') params.set('type', filter.type);
    if (filter?.channelId && String(filter.channelId) !== 'all') params.set('channelId', String(filter.channelId));
    if (filter?.limit) params.set('limit', String(filter.limit));
    const q = params.toString();
    return request<{ logs: import('@/lib/types').ActivityLog[]; total: number }>(
      `/api/log${q ? `?${q}` : ''}`
    );
  },
  // OTA
  otaCheck: () => request<{ available: boolean; latestVersion: string }>('/api/ota/check', { method: 'POST' }),
  otaUpload: (file: File, onProgress?: (pct: number) => void) =>
    new Promise<{ success: boolean; newVersion?: string }>((resolve, reject) => {
      // For mock: simulate upload via XHR to track progress
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/api/ota`);
      xhr.withCredentials = true;
      if (csrfTokenCache) xhr.setRequestHeader('X-CSRF-Token', csrfTokenCache);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        try {
          const json = JSON.parse(xhr.responseText) as ApiResponse<{ success: boolean; newVersion?: string }>;
          if (xhr.status >= 200 && xhr.status < 300 && json.success) resolve(json.data);
          else reject(new ApiError(json.message || 'OTA failed', xhr.status));
        } catch {
          reject(new ApiError('Invalid OTA response', xhr.status));
        }
      };
      xhr.onerror = () => reject(new ApiError('OTA network error', 0));
      const fd = new FormData();
      fd.append('file', file);
      xhr.send(fd);
    }),
  // System
  reboot: () => request<{ rebooting: boolean }>('/api/reboot', { method: 'POST' }),
  factoryResetPrepare: () =>
    request<{ token: string; expiresAt: number }>('/api/factory_reset/prepare', { method: 'POST' }),
  factoryResetConfirm: (token: string) =>
    request<{ reset: boolean }>('/api/factory_reset/confirm', { method: 'POST', body: { token, confirm: 'RESET' } }),
  // Config
  updateDevice: (opts: { deviceName?: string; timezone?: string }) =>
    request<{ updated: boolean }>('/api/config/device', { method: 'POST', body: opts }),
  changePassword: (current: string, next: string) =>
    request<{ changed: boolean }>('/api/config/password', { method: 'POST', body: { current, next } }),
  exportConfig: () => request<{ config: import('@/lib/types').SystemConfig }>('/api/config/export'),
  importConfig: (cfg: import('@/lib/types').SystemConfig) =>
    request<{ imported: boolean }>('/api/config/import', { method: 'POST', body: cfg }),
};
