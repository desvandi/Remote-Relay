// =============================================================================
// MQTT Command Transaction — send command, wait for ACK with timeout
// =============================================================================
import { onAck } from './mqtt';
import { publishCommand } from './mqttPublisher';
import { pendingCommands, type PendingCommand, type MqttAck } from './mqttPending';

const ACK_TIMEOUT_MS = 5000; // 5 seconds

// Subscribe to ACK events — match requestId to pending commands
let ackSubscriptionInitialized = false;

function generateRequestId(): string {
  // Use crypto.randomUUID() — no Math.random() fallback
  return crypto.randomUUID();
}

function initAckSubscription() {
  if (ackSubscriptionInitialized) return;
  ackSubscriptionInitialized = true;

  onAck((ack: MqttAck) => {
    // Validate ACK schema — don't trust MQTT payload blindly
    if (!ack || typeof ack.requestId !== 'string' || typeof ack.success !== 'boolean') {
      console.error('[MQTT] Invalid ACK schema, ignoring:', ack);
      return;
    }
    if (typeof ack.message !== 'string') {
      console.error('[MQTT] Invalid ACK message type, ignoring:', ack);
      return;
    }

    // Deep-validate relay ACK data if present
    if (ack.data) {
      const d = ack.data;
      if (d.channelId !== undefined) {
        if (typeof d.channelId !== 'number' || !Number.isInteger(d.channelId) ||
            d.channelId < 1 || d.channelId > 12) {
          console.error('[MQTT] Invalid ACK channelId, ignoring:', d.channelId);
          return;
        }
      }
      if (d.state !== undefined && typeof d.state !== 'boolean') {
        console.error('[MQTT] Invalid ACK state type, ignoring:', d.state);
        return;
      }
      if (d.source !== undefined && !['manual', 'schedule', 'pir', 'off'].includes(d.source)) {
        console.error('[MQTT] Invalid ACK source, ignoring:', d.source);
        return;
      }
      if (d.modeAuto !== undefined && typeof d.modeAuto !== 'boolean') {
        console.error('[MQTT] Invalid ACK modeAuto type, ignoring:', d.modeAuto);
        return;
      }
    }

    // P1 #12 (audit round 9): For relay commands, ACK data is REQUIRED.
    // If ACK is for a relay command and data is missing or incomplete,
    // reject the ACK instead of resolving with incomplete data.
    const pending = pendingCommands.get(ack.requestId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      pendingCommands.delete(ack.requestId);
      if (ack.success) {
        // For relay commands, validate that ACK contains complete relay data
        if (pending.commandType === 'relay') {
          if (!ack.data || ack.data.channelId === undefined ||
              ack.data.state === undefined || ack.data.source === undefined ||
              ack.data.modeAuto === undefined) {
            console.error('[MQTT] Relay ACK missing required data fields, rejecting:', ack);
            pending.reject(new Error('Relay ACK incomplete — missing channelId/state/source/modeAuto'));
            return;
          }
        }
        pending.resolve(ack);
      } else {
        pending.reject(new Error(ack.message || 'Command failed'));
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
 *   - For relay commands: rejects if ACK data is missing required fields
 *     (channelId, state, source, modeAuto) — P1 #12 audit round 9
 */
export function sendCommandWithAck(
  command: Record<string, unknown>,
  options?: { commandType?: 'relay' | 'schedule' | 'pir' | 'channel' | 'time' | 'system' | 'config' | 'ota' }
): Promise<MqttAck> {
  initAckSubscription();

  return new Promise((resolve, reject) => {
    const requestId = generateRequestId();
    const commandType = options?.commandType || (command.type as string) || 'unknown';

    const timeoutId = setTimeout(() => {
      pendingCommands.delete(requestId);
      reject(new Error('Command timeout — ESP32 did not respond in 5 seconds'));
    }, ACK_TIMEOUT_MS);

    const pending: PendingCommand = {
      requestId,
      resolve,
      reject,
      timeoutId,
      commandType,
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
export type { MqttAck } from './mqttPending';
