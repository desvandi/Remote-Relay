// =============================================================================
// MQTT Pending Commands — shared state for transaction lifecycle
// Separated from mqttTransaction.ts to avoid circular dependency.
// mqtt.ts can import this directly (synchronous, no dynamic import).
// =============================================================================

export type PendingCommand = {
  requestId: string;
  resolve: (ack: MqttAck) => void;
  reject: (error: Error) => void;
  timeoutId: ReturnType<typeof setTimeout>;
};

export type MqttAck = {
  requestId: string;
  success: boolean;
  message: string;
  timestamp?: number;
  data?: {
    channelId?: number;
    state?: boolean;
    source?: string;
    modeAuto?: boolean;
  };
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
