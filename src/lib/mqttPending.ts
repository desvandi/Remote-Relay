// =============================================================================
// MQTT Pending Commands — shared state for transaction lifecycle
// Separated from mqttTransaction.ts to avoid circular dependency.
// mqtt.ts can import this directly (synchronous, no dynamic import).
//
// R10B-2 (audit round 10B): Typed ACK discriminated union.
// Previously MqttAck had `data?: RelayAckData` for ALL commands — but
// firmware sends different data shapes per command type. Now we have a
// proper discriminated union with runtime validation per commandType.
// =============================================================================

// ---------- ACK data shapes (one per command type) ----------

export type RelayAckData = {
  channelId: number;
  state: boolean;
  source: 'manual' | 'schedule' | 'pir' | 'off';
  modeAuto: boolean;
};

export type ScheduleAckData = {
  channelId: number;
  scheduleId: number;
};

export type PirAckData = {
  id: number;
  channelId: number;
  enabled: boolean;
  holdTime: number;
  motionNow: boolean;
};

export type ChannelAckData = {
  channelId: number;
  name: string;
};

export type GenericAckData = Record<string, never>;  // empty for time/system/config

export type OtaAckData = {
  // OTA ACK doesn't carry data — status published via /otaStatus topic
  [key: string]: never;
};

// ---------- Discriminated union of ACK types ----------

export type CommandType =
  | 'relay'
  | 'schedule'
  | 'pir'
  | 'channel'
  | 'time'
  | 'system'
  | 'config'
  | 'ota'
  | 'unknown';

export type MqttAck =
  | { requestId: string; success: true; message: string; timestamp?: number; commandType: 'relay'; data: RelayAckData }
  | { requestId: string; success: true; message: string; timestamp?: number; commandType: 'schedule'; data: ScheduleAckData }
  | { requestId: string; success: true; message: string; timestamp?: number; commandType: 'pir'; data: PirAckData }
  | { requestId: string; success: true; message: string; timestamp?: number; commandType: 'channel'; data: ChannelAckData }
  | { requestId: string; success: true; message: string; timestamp?: number; commandType: 'time' | 'system' | 'config' | 'ota' | 'unknown'; data?: GenericAckData }
  | { requestId: string; success: false; message: string; timestamp?: number; commandType: CommandType; data?: never };

// ---------- Pending command tracking ----------

export type PendingCommand = {
  requestId: string;
  commandType: CommandType;
  resolve: (ack: MqttAck) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

// Shared Map — accessible by both mqtt.ts (for cleanup) and mqttTransaction.ts (for add/match)
export const pendingCommands = new Map<string, PendingCommand>();

/**
 * Cancel all pending commands — SYNCHRONOUS (no dynamic import needed).
 * Called from disconnectMqtt() and connectMqtt() before creating new connection.
 */
export function cancelAllPendingCommands(): void {
  for (const [id, pending] of pendingCommands) {
    clearTimeout(pending.timeoutId);
    pending.reject(new Error('MQTT connection closed — command cancelled'));
    pendingCommands.delete(id);
  }
}

// ---------- Runtime validators (R10B-2: per-commandType schema validation) ----------

export function isValidRelayAckData(data: unknown): data is RelayAckData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.channelId === 'number' && Number.isInteger(d.channelId) &&
    d.channelId >= 1 && d.channelId <= 12 &&
    typeof d.state === 'boolean' &&
    typeof d.source === 'string' && ['manual', 'schedule', 'pir', 'off'].includes(d.source) &&
    typeof d.modeAuto === 'boolean'
  );
}

export function isValidScheduleAckData(data: unknown): data is ScheduleAckData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.channelId === 'number' && Number.isInteger(d.channelId) &&
    d.channelId >= 1 && d.channelId <= 12 &&
    typeof d.scheduleId === 'number' && Number.isInteger(d.scheduleId)
  );
}

export function isValidPirAckData(data: unknown): data is PirAckData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.id === 'number' && Number.isInteger(d.id) && d.id >= 1 && d.id <= 4 &&
    typeof d.channelId === 'number' && Number.isInteger(d.channelId) &&
    typeof d.enabled === 'boolean' &&
    typeof d.holdTime === 'number' &&
    typeof d.motionNow === 'boolean'
  );
}

export function isValidChannelAckData(data: unknown): data is ChannelAckData {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return (
    typeof d.channelId === 'number' && Number.isInteger(d.channelId) &&
    d.channelId >= 1 && d.channelId <= 12 &&
    typeof d.name === 'string' && d.name.length > 0 && d.name.length <= 32
  );
}
