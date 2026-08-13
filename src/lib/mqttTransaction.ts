// =============================================================================
// MQTT Command Transaction — send command, wait for ACK with timeout
// =============================================================================
import { publishCommand, onAck } from './mqtt';

type PendingCommand = {
  requestId: string;
  resolve: (ack: { success: boolean; message: string }) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

const pendingCommands = new Map<string, PendingCommand>();
const ACK_TIMEOUT_MS = 5000; // 5 seconds

// Subscribe to ACK events — match requestId to pending commands
let ackSubscriptionInitialized = false;

function generateRequestId(): string {
  // Use crypto.randomUUID() — no Math.random() fallback
  // All modern browsers (2024+) support crypto.randomUUID()
  return crypto.randomUUID();
}

function initAckSubscription() {
  if (ackSubscriptionInitialized) return;
  ackSubscriptionInitialized = true;

  onAck((ack) => {
    const pending = pendingCommands.get(ack.requestId);
    if (pending) {
      clearTimeout(pending.timeoutId);
      pendingCommands.delete(ack.requestId);
      if (ack.success) {
        pending.resolve(ack);
      } else {
        pending.reject(new Error(ack.message || 'Command failed'));
      }
    }
  });
}

/**
 * Cancel all pending commands — called on disconnect/logout/error.
 * Rejects all pending promises with 'Connection closed' error.
 */
export function cancelAllPendingCommands(): void {
  for (const [id, pending] of pendingCommands) {
    clearTimeout(pending.timeoutId);
    pending.reject(new Error('MQTT connection closed — command cancelled'));
    pendingCommands.delete(id);
  }
}

/**
 * Send a command to ESP32 via MQTT and wait for ACK.
 * Returns a Promise that:
 *   - resolves when ESP32 publishes ACK with matching requestId
 *   - rejects after 5 seconds if no ACK received (timeout)
 *   - rejects if ACK indicates failure
 *
 * This ensures UI only shows "success" after ESP32 actually executes the command.
 */
export function sendCommandWithAck(command: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
  initAckSubscription();

  return new Promise((resolve, reject) => {
    // Generate UUID requestId — single source of truth
    const requestId = generateRequestId();

    // Set up timeout
    const timeoutId = setTimeout(() => {
      pendingCommands.delete(requestId);
      reject(new Error('Command timeout — ESP32 did not respond in 5 seconds'));
    }, ACK_TIMEOUT_MS);

    // Store pending command
    pendingCommands.set(requestId, {
      requestId,
      resolve,
      reject,
      timeoutId,
    });

    // Publish command with requestId (publishCommand does NOT generate its own)
    const published = publishCommand({ ...command, requestId });
    if (!published) {
      clearTimeout(timeoutId);
      pendingCommands.delete(requestId);
      reject(new Error('MQTT publish failed — device may be offline'));
    }
  });
}

/**
 * Check if there are pending commands awaiting ACK
 */
export function hasPendingCommands(): boolean {
  return pendingCommands.size > 0;
}
