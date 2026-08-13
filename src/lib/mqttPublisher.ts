// =============================================================================
// mqttPublisher.ts — Internal MQTT publisher (NOT exported from public API)
// =============================================================================
// This module is the ONLY place that can publish raw MQTT messages.
// It is imported by mqttTransaction.ts ONLY.
// It is NEVER imported by components, hooks, or any other module.
// =============================================================================
import mqtt from 'mqtt';

// Shared state — imported from mqttPending to avoid circular deps
// We need access to the MQTT client and connection state.
// This is set by mqtt.ts during connectMqtt().

let _client: mqtt.MqttClient | null = null;
let _deviceId: string | null = null;
let _password: string | null = null;

/**
 * Called by mqtt.ts to inject the client + credentials.
 * This avoids circular dependency (mqtt.ts → mqttTransaction → mqttPublisher → mqtt.ts)
 */
export function setPublisherClient(
  client: mqtt.MqttClient | null,
  deviceId: string | null,
  password: string | null
) {
  _client = client;
  _deviceId = deviceId;
  _password = password;
}

/**
 * Publish a command to the ESP32 via MQTT.
 * NOT exported to public API — only accessible via sendCommandWithAck().
 */
export function publishCommand(command: Record<string, unknown>): boolean {
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
