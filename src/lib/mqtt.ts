// =============================================================================
// MQTT Client — connects to HiveMQ public broker via WebSocket
// Used for remote internet access when ESP32 is behind CGNAT/MiFi
// =============================================================================

import mqtt from 'mqtt';
import type { SystemStatus, ActivityLog } from './types';
import { cancelAllPendingCommands } from './mqttPending';

// Re-export MqttAck type for consumers
export type { MqttAck } from './mqttPending';

// MQTT Broker URL — configurable via env var for production (self-hosted broker)
// Default: HiveMQ public broker (free, no auth, for demo/MVP)
// Production: set NEXT_PUBLIC_MQTT_BROKER_URL to your authenticated broker
//   e.g., wss://your-broker.com:8884/mqtt (with username/password)
// Also set NEXT_PUBLIC_MQTT_USERNAME + NEXT_PUBLIC_MQTT_PASSWORD for auth
const MQTT_BROKER_URL = process.env.NEXT_PUBLIC_MQTT_BROKER_URL || 'wss://broker.hivemq.com:8884/mqtt';
const MQTT_BROKER_USERNAME = process.env.NEXT_PUBLIC_MQTT_USERNAME || '';
const MQTT_BROKER_PASSWORD = process.env.NEXT_PUBLIC_MQTT_PASSWORD || '';

type MqttState = {
  client: mqtt.MqttClient | null;
  deviceId: string | null;
  password: string | null;
  connected: boolean;
};

type StatusCallback = (status: SystemStatus) => void;
type LogCallback = (log: ActivityLog) => void;
type OnlineCallback = (online: boolean) => void;

const state: MqttState = {
  client: null,
  deviceId: null,
  password: null,
  connected: false,
};

const statusCallbacks = new Set<StatusCallback>();
const logCallbacks = new Set<LogCallback>();
const onlineCallbacks = new Set<OnlineCallback>();
const ackCallbacks = new Set<(ack: { requestId: string; success: boolean; message: string }) => void>();

export function getMqttDeviceId(): string | null {
  if (state.deviceId) return state.deviceId;
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('timer12-mqtt-device-id');
  }
  return null;
}

export function setMqttDeviceId(deviceId: string | null) {
  state.deviceId = deviceId;
  if (typeof localStorage !== 'undefined') {
    if (deviceId) {
      localStorage.setItem('timer12-mqtt-device-id', deviceId);
    } else {
      localStorage.removeItem('timer12-mqtt-device-id');
    }
  }
}

export function isMqttConfigured(): boolean {
  return !!getMqttDeviceId();
}

export function isMqttConnected(): boolean {
  return state.connected;
}

export function connectMqtt(deviceId: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    // Cancel pending commands from previous connection SYNCHRONOUSLY
    cancelAllPendingCommands();

    if (state.client) {
      state.client.end(true);
      state.client = null;
    }

    state.deviceId = deviceId.toUpperCase().replace(/[^A-F0-9]/g, '');
    state.password = password.toUpperCase().replace(/[^A-Z0-9]/g, '');

    if (state.deviceId.length !== 12) {
      reject(new Error('Device ID must be 12 hex chars (e.g., A4CF12345678)'));
      return;
    }
    if (state.password.length < 4) {
      reject(new Error('MQTT password must be at least 4 chars'));
      return;
    }

    const baseTopic = `timer12/${state.deviceId}/${state.password}`;
    const clientId = `pwa-${crypto.randomUUID()}`;

    console.log(`[MQTT] Connecting to ${MQTT_BROKER_URL} as ${clientId}...`);

    const client = mqtt.connect(MQTT_BROKER_URL, {
      clientId,
      keepalive: 60,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
      clean: true,
      ...(MQTT_BROKER_USERNAME ? { username: MQTT_BROKER_USERNAME } : {}),
      ...(MQTT_BROKER_PASSWORD ? { password: MQTT_BROKER_PASSWORD } : {}),
    });

    state.client = client;

    // Settle-once pattern: prevent multiple resolve/reject calls
    let settled = false;
    const resolveOnce = () => { if (!settled) { settled = true; resolve(); } };
    const rejectOnce = (err: Error) => { if (!settled) { settled = true; reject(err); } };

    client.on('connect', () => {
      console.log('[MQTT] Connected to broker, subscribing...');
      client.subscribe(
        [`${baseTopic}/status`, `${baseTopic}/log`, `${baseTopic}/online`, `${baseTopic}/ack`],
        { qos: 1 },
        (err, granted) => {
          if (err) {
            console.error('[MQTT] Subscribe error:', err);
            state.connected = false;
            rejectOnce(new Error(`MQTT subscription failed: ${err.message}`));
            return;
          }
          console.log('[MQTT] Subscriptions confirmed:', granted);
          state.connected = true;
          onlineCallbacks.forEach((cb) => cb(true));
          resolveOnce();
        }
      );
    });

    client.on('message', (topic: string, payload: Buffer) => {
      const msg = payload.toString();
      if (topic.endsWith('/status')) {
        try {
          const status = JSON.parse(msg) as SystemStatus;
          statusCallbacks.forEach((cb) => cb(status));
        } catch (e) {
          console.error('[MQTT] Failed to parse status JSON:', e);
        }
      } else if (topic.endsWith('/log')) {
        try {
          const log = JSON.parse(msg) as ActivityLog;
          logCallbacks.forEach((cb) => cb(log));
        } catch (e) {
          console.error('[MQTT] Failed to parse log JSON:', e);
        }
      } else if (topic.endsWith('/online')) {
        const online = msg === '1';
        onlineCallbacks.forEach((cb) => cb(online));
      } else if (topic.endsWith('/ack')) {
        try {
          const ack = JSON.parse(msg) as { requestId: string; success: boolean; message: string };
          console.log('[MQTT] ACK received:', ack);
          ackCallbacks.forEach((cb) => cb(ack));
        } catch (e) {
          console.error('[MQTT] Failed to parse ACK JSON:', e);
        }
      }
    });

    client.on('error', (err: Error) => {
      console.error('[MQTT] Error:', err.message);
      if (!settled) {
        rejectOnce(err);
      }
    });

    client.on('offline', () => {
      console.log('[MQTT] Offline');
      state.connected = false;
      onlineCallbacks.forEach((cb) => cb(false));
    });

    client.on('reconnect', () => {
      console.log('[MQTT] Reconnecting...');
    });
  });
}

export function disconnectMqtt() {
  // Cancel all pending commands SYNCHRONOUSLY before closing client
  cancelAllPendingCommands();

  if (state.client) {
    state.client.end(true);
    state.client = null;
  }
  state.connected = false;
  state.deviceId = null;
  state.password = null;
}

// ---------------------------------------------------------------------------
// publishCommand is INTERNAL — use sendCommandWithAck() for all mutations.
// mqttApi is kept for backward compatibility but should NOT be used directly.
// All mutations go through mqttTransaction.ts (sendCommandWithAck).
// ---------------------------------------------------------------------------
/** @internal Use sendCommandWithAck() instead — exported only for mqttTransaction */
export function _publishCommand(command: Record<string, unknown>): boolean {
  if (!state.client || !state.connected || !state.deviceId || !state.password) {
    console.warn('[MQTT] Not connected — cannot publish command');
    return false;
  }
  // Do NOT generate requestId here — caller (sendCommandWithAck) provides it
  // This prevents double-requestId bug
  const topic = `timer12/${state.deviceId}/${state.password}/command`;
  const payload = JSON.stringify(command);
  const result = state.client.publish(topic, payload, { qos: 1 });
  if (!result) {
    console.error('[MQTT] Publish failed — client not connected');
    return false;
  }
  return true;
}

// Publish OTA update command via MQTT
export function publishOtaUpdate(url: string, version: string): boolean {
  if (!state.client || !state.connected || !state.deviceId || !state.password) {
    console.warn('[MQTT] Not connected — cannot publish OTA');
    return false;
  }
  const topic = `timer12/${state.deviceId}/${state.password}/ota`;
  const payload = JSON.stringify({ action: 'update', url, version });
  state.client.publish(topic, payload, { qos: 1 });
  return true;
}

// ---------------------------------------------------------------------------
// Subscribe to status updates (real-time push from ESP32)
// ---------------------------------------------------------------------------
export function onStatusChange(cb: StatusCallback): () => void {
  statusCallbacks.add(cb);
  return () => statusCallbacks.delete(cb);
}

export function onLog(cb: LogCallback): () => void {
  logCallbacks.add(cb);
  return () => logCallbacks.delete(cb);
}

export function onOnlineChange(cb: OnlineCallback): () => void {
  onlineCallbacks.add(cb);
  return () => onlineCallbacks.delete(cb);
}

export function onAck(cb: (ack: { requestId: string; success: boolean; message: string }) => void): () => void {
  ackCallbacks.add(cb);
  return () => ackCallbacks.delete(cb);
}

// ---------------------------------------------------------------------------
// Convenience command publishers (mirror REST API endpoints)
// ---------------------------------------------------------------------------
export const mqttApi = {
  // Relay: only SET_STATE (on/off/set_mode) — no TOGGLE for idempotency
  // WARNING: These are fire-and-forget. Use sendCommandWithAck() for ACK-guaranteed delivery.
  relayOn: (channelId: number) =>
    _publishCommand({ type: 'relay', action: 'on', channelId }),
  relayOff: (channelId: number) =>
    _publishCommand({ type: 'relay', action: 'off', channelId }),
  relaySetMode: (channelId: number, mode: 'auto' | 'manual', manualState?: boolean) =>
    _publishCommand({ type: 'relay', action: 'set_mode', channelId, mode, manualState }),
  scheduleUpsert: (sched: {
    channelId: number; onTime: string; offTime: string;
    dayMask: number; enabled: boolean; id?: number;
  }) => _publishCommand({ type: 'schedule', action: 'upsert', ...sched }),
  scheduleDelete: (id: number) =>
    _publishCommand({ type: 'schedule', action: 'delete', id }),
  pirConfig: (id: number, opts: { enabled?: boolean; holdTime?: number }) =>
    _publishCommand({ type: 'pir', action: 'config', id, ...opts }),
  pirTest: (id: number) =>
    _publishCommand({ type: 'pir', action: 'test', id }),
  channelRename: (channelId: number, name: string) =>
    _publishCommand({ type: 'channel', action: 'rename', channelId, name }),
  setTime: (datetime: string) =>
    _publishCommand({ type: 'time', action: 'set', datetime }),
  reboot: () =>
    _publishCommand({ type: 'system', action: 'reboot' }),
  getStatus: () =>
    _publishCommand({ type: 'system', action: 'getStatus' }),
  resetEnergyStats: () =>
    _publishCommand({ type: 'system', action: 'resetEnergyStats' }),
  resetDailyStats: () =>
    _publishCommand({ type: 'system', action: 'resetDailyStats' }),
  setDeviceConfig: (opts: { deviceName?: string; timezone?: string }) =>
    _publishCommand({ type: 'config', action: 'setDevice', ...opts }),
  otaUpdate: (url: string, version: string) =>
    publishOtaUpdate(url, version),
};
