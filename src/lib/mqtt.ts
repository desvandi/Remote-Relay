// =============================================================================
// MQTT Client — connects to HiveMQ public broker via WebSocket
// Used for remote internet access when ESP32 is behind CGNAT/MiFi
// =============================================================================

import mqtt from 'mqtt';
import type { SystemStatus, ActivityLog } from './types';

// HiveMQ public broker — free, no signup, no auth
// WSS (WebSocket Secure) required for Vercel HTTPS
const MQTT_BROKER_URL = 'wss://broker.hivemq.com:8884/mqtt';

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

    // Topic includes password for security: timer12/<mac>/<password>/<subtopic>
    const baseTopic = `timer12/${state.deviceId}/${state.password}`;
    const clientId = `pwa-${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(16).slice(2, 10)}`;

    console.log(`[MQTT] Connecting to ${MQTT_BROKER_URL} as ${clientId}...`);
    console.log(`[MQTT] Device: ${state.deviceId}, topics: ${baseTopic}/{status,command,log,online}`);

    const client = mqtt.connect(MQTT_BROKER_URL, {
      clientId,
      keepalive: 60,
      reconnectPeriod: 5000,
      connectTimeout: 10000,
      clean: true,
    });

    state.client = client;

    client.on('connect', () => {
      console.log('[MQTT] Connected to broker');
      state.connected = true;
      // Subscribe to status, log, online, and ack topics
      client.subscribe([
        `${baseTopic}/status`,
        `${baseTopic}/log`,
        `${baseTopic}/online`,
        `${baseTopic}/ack`,
      ], { qos: 1 });
      onlineCallbacks.forEach((cb) => cb(true));
      resolve();
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
      if (!state.connected) {
        reject(err);
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
  if (state.client) {
    state.client.end(true);
    state.client = null;
  }
  state.connected = false;
  state.deviceId = null;
}

// ---------------------------------------------------------------------------
// Publish a command to the ESP32 via MQTT
// ---------------------------------------------------------------------------
export function publishCommand(command: Record<string, unknown>): boolean {
  if (!state.client || !state.connected || !state.deviceId || !state.password) {
    console.warn('[MQTT] Not connected — cannot publish command');
    return false;
  }
  // Add requestId for command tracking + ACK
  const commandWithId = {
    ...command,
    requestId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
  const topic = `timer12/${state.deviceId}/${state.password}/command`;
  const payload = JSON.stringify(commandWithId);
  const result = state.client.publish(topic, payload, { qos: 1 });
  // mqtt.js publish returns true on success, false if client not connected
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
  relayToggle: (channelId: number) =>
    publishCommand({ type: 'relay', action: 'toggle', channelId }),
  relayOn: (channelId: number) =>
    publishCommand({ type: 'relay', action: 'on', channelId }),
  relayOff: (channelId: number) =>
    publishCommand({ type: 'relay', action: 'off', channelId }),
  relaySetMode: (channelId: number, mode: 'auto' | 'manual', manualState?: boolean) =>
    publishCommand({ type: 'relay', action: 'set_mode', channelId, mode, manualState }),
  scheduleUpsert: (sched: {
    channelId: number; onTime: string; offTime: string;
    dayMask: number; enabled: boolean; id?: number;
  }) => publishCommand({ type: 'schedule', action: 'upsert', ...sched }),
  scheduleDelete: (id: number) =>
    publishCommand({ type: 'schedule', action: 'delete', id }),
  pirConfig: (id: number, opts: { enabled?: boolean; holdTime?: number }) =>
    publishCommand({ type: 'pir', action: 'config', id, ...opts }),
  pirTest: (id: number) =>
    publishCommand({ type: 'pir', action: 'test', id }),
  channelRename: (channelId: number, name: string) =>
    publishCommand({ type: 'channel', action: 'rename', channelId, name }),
  setTime: (datetime: string) =>
    publishCommand({ type: 'time', action: 'set', datetime }),
  reboot: () =>
    publishCommand({ type: 'system', action: 'reboot' }),
  getStatus: () =>
    publishCommand({ type: 'system', action: 'getStatus' }),
  resetEnergyStats: () =>
    publishCommand({ type: 'system', action: 'resetEnergyStats' }),
  resetDailyStats: () =>
    publishCommand({ type: 'system', action: 'resetDailyStats' }),
  setDeviceConfig: (opts: { deviceName?: string; timezone?: string }) =>
    publishCommand({ type: 'config', action: 'setDevice', ...opts }),
  otaUpdate: (url: string, version: string) =>
    publishOtaUpdate(url, version),
};
