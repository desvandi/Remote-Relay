// =============================================================================
// MQTT Command Transaction — send command, wait for ACK with timeout
//
// R10B-2 (audit round 10B): Typed ACK discriminated union.
// ACK validation is now per-commandType — each command type has its own
// data shape validator. ACKs with wrong/missing data for their commandType
// are REJECTED (not silently resolved with incomplete data).
//
// R10B-3 (audit round 10B): mqttPublisher is INLINED here.
// Previous separate mqttPublisher.ts module was still TypeScript-exported
// (any developer could `import { publishCommand } from './mqttPublisher'`).
// Now the publisher logic lives inside this module as a private function —
// no separate module to import from. The only public API is
// sendCommandWithAck() which enforces the ACK transaction pattern.
// =============================================================================
import type mqtt from 'mqtt';
import { onAck } from './mqtt';
import {
  pendingCommands,
  type PendingCommand,
  type MqttAck,
  type CommandType,
  isValidRelayAckData,
  isValidScheduleAckData,
  isValidPirAckData,
  isValidChannelAckData,
} from './mqttPending';

const ACK_TIMEOUT_MS = 5000; // 5 seconds

// =============================================================================
// R10B-3: Private publisher state (was mqttPublisher.ts module, now inlined)
// =============================================================================
// This is the ONLY place in the codebase that can publish raw MQTT messages.
// mqtt.ts calls setPublisherClient() during connectMqtt() to inject the
// connected client + credentials. No other module can access this — it's
// module-private to mqttTransaction.ts.

let _client: mqtt.MqttClient | null = null;
let _deviceId: string | null = null;
let _password: string | null = null;

/**
 * R10B-3: Called by mqtt.ts to inject the MQTT client + credentials.
 * This is the ONLY way to set the publisher client — there's no public
 * `publishCommand` export anymore. Publishing is enforced to go through
 * sendCommandWithAck() which adds the requestId + ACK transaction pattern.
 */
export function setPublisherClient(
  client: mqtt.MqttClient | null,
  deviceId: string | null,
  password: string | null
): void {
  _client = client;
  _deviceId = deviceId;
  _password = password;
}

/**
 * R10B-3: Private publisher — NOT exported.
 * Only sendCommandWithAck() can call this, ensuring every published command
 * has a requestId and waits for ACK.
 */
function publishCommand(command: Record<string, unknown>): boolean {
  if (!_client || !_deviceId || !_password) {
    console.warn('[MQTT] Not connected — cannot publish command');
    return false;
  }
  const topic = `timer12/${_deviceId}/${_password}/command`;
  const payload = JSON.stringify(command);
  const result = _client.publish(topic, payload, { qos: 1 });
  if (!result) {
    console.error('[MQTT] Publish failed — client not connected');
    return false;
  }
  return true;
}

// =============================================================================
// ACK validation + transaction logic
// =============================================================================

// Subscribe to ACK events — match requestId to pending commands
let ackSubscriptionInitialized = false;

function generateRequestId(): string {
  // Use crypto.randomUUID() — no Math.random() fallback
  return crypto.randomUUID();
}

/**
 * R10B-2: Validate ACK data shape based on pending command's commandType.
 * Returns { valid: true, ack: MqttAck } or { valid: false, error: string }.
 */
function validateAckForCommand(
  rawAck: { requestId: string; success: boolean; message: string; timestamp?: number; data?: unknown },
  pending: PendingCommand
): { valid: true; ack: MqttAck } | { valid: false; error: string } {
  // Failure ACKs don't need data validation
  if (!rawAck.success) {
    return {
      valid: true,
      ack: {
        requestId: rawAck.requestId,
        success: false,
        message: rawAck.message,
        timestamp: rawAck.timestamp,
        commandType: pending.commandType,
      },
    };
  }

  // Success ACKs — validate data shape per commandType
  const data = rawAck.data;

  switch (pending.commandType) {
    case 'relay':
      if (!isValidRelayAckData(data)) {
        return { valid: false, error: 'Relay ACK missing required fields (channelId/state/source/modeAuto)' };
      }
      return {
        valid: true,
        ack: {
          requestId: rawAck.requestId,
          success: true,
          message: rawAck.message,
          timestamp: rawAck.timestamp,
          commandType: 'relay',
          data,
        },
      };

    case 'schedule':
      if (!isValidScheduleAckData(data)) {
        return { valid: false, error: 'Schedule ACK missing required fields (channelId/scheduleId)' };
      }
      return {
        valid: true,
        ack: {
          requestId: rawAck.requestId,
          success: true,
          message: rawAck.message,
          timestamp: rawAck.timestamp,
          commandType: 'schedule',
          data,
        },
      };

    case 'pir':
      if (!isValidPirAckData(data)) {
        return { valid: false, error: 'PIR ACK missing required fields (id/channelId/enabled/holdTime/motionNow)' };
      }
      return {
        valid: true,
        ack: {
          requestId: rawAck.requestId,
          success: true,
          message: rawAck.message,
          timestamp: rawAck.timestamp,
          commandType: 'pir',
          data,
        },
      };

    case 'channel':
      if (!isValidChannelAckData(data)) {
        return { valid: false, error: 'Channel ACK missing required fields (channelId/name)' };
      }
      return {
        valid: true,
        ack: {
          requestId: rawAck.requestId,
          success: true,
          message: rawAck.message,
          timestamp: rawAck.timestamp,
          commandType: 'channel',
          data,
        },
      };

    case 'time':
    case 'system':
    case 'config':
    case 'unknown':
    case 'ota':
      // Generic ACKs — no specific data required
      return {
        valid: true,
        ack: {
          requestId: rawAck.requestId,
          success: true,
          message: rawAck.message,
          timestamp: rawAck.timestamp,
          commandType: pending.commandType,
        },
      };

    default:
      return { valid: false, error: `Unknown commandType: ${pending.commandType}` };
  }
}

function initAckSubscription() {
  if (ackSubscriptionInitialized) return;
  ackSubscriptionInitialized = true;

  onAck((rawAck: { requestId: string; success: boolean; message: string; timestamp?: number; data?: unknown }) => {
    // Validate ACK schema — don't trust MQTT payload blindly
    if (!rawAck || typeof rawAck.requestId !== 'string' || typeof rawAck.success !== 'boolean') {
      console.error('[MQTT] Invalid ACK schema, ignoring:', rawAck);
      return;
    }
    if (typeof rawAck.message !== 'string') {
      console.error('[MQTT] Invalid ACK message type, ignoring:', rawAck);
      return;
    }

    const pending = pendingCommands.get(rawAck.requestId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      pendingCommands.delete(rawAck.requestId);

      // R10B-2: Per-commandType data validation
      const result = validateAckForCommand(rawAck, pending);
      if (!result.valid) {
        console.error(`[MQTT] ACK validation failed for ${pending.commandType}:`, result.error, rawAck);
        pending.reject(new Error(result.error));
        return;
      }

      if (result.ack.success) {
        pending.resolve(result.ack);
      } else {
        pending.reject(new Error(result.ack.message || 'Command failed'));
      }
    }
  });
}

/**
 * Send a command to ESP32 via MQTT and wait for ACK.
 * Returns a Promise that:
 *   - resolves when ESP32 publishes ACK with matching requestId
 *   - rejects after 5 seconds if no ACK received (timeout)
 *   - rejects if ACK indicates failure
 *   - rejects if ACK data shape doesn't match commandType (R10B-2)
 */
export function sendCommandWithAck(
  command: Record<string, unknown>,
  options?: { commandType?: CommandType }
): Promise<MqttAck> {
  initAckSubscription();

  return new Promise((resolve, reject) => {
    const requestId = generateRequestId();
    const commandType: CommandType = options?.commandType || (command.type as CommandType) || 'unknown';

    const timeoutId = setTimeout(() => {
      pendingCommands.delete(requestId);
      reject(new Error('Command timeout — ESP32 did not respond in 5 seconds'));
    }, ACK_TIMEOUT_MS);

    const pending: PendingCommand = {
      requestId,
      commandType,
      resolve,
      reject,
      timeoutId,
    };

    pendingCommands.set(requestId, pending);

    const published = publishCommand({ ...command, requestId });
    if (!published) {
      clearTimeout(timeoutId);
      pendingCommands.delete(requestId);
      reject(new Error('MQTT publish failed — device may be offline'));
    }
  });
}

export function hasPendingCommands(): boolean {
  return pendingCommands.size > 0;
}

// Re-export cancelAllPendingCommands for convenience
export { cancelAllPendingCommands } from './mqttPending';
export type { MqttAck, CommandType } from './mqttPending';
export type {
  RelayAckData,
  ScheduleAckData,
  PirAckData,
  ChannelAckData,
} from './mqttPending';
