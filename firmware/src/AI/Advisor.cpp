// =============================================================================
// AI/Advisor.cpp — Stub implementation (future GAS integration)
// =============================================================================
#include "Advisor.h"

namespace AI {

Advisor advisor;

void Advisor::begin(const String& gasUrl) {
  _gasUrl = gasUrl;
  _head = 0;
  _tail = 0;
}

void Advisor::recordEvent(const String& eventType, const String& payload) {
  // Encode compact JSON into the ring buffer
  String entry = "{\"type\":\"";
  entry += eventType;
  entry += "\",\"ts\":";
  entry += String(millis());
  entry += ",\"payload\":";
  entry += payload;
  entry += "}";
  _queue[_tail] = entry;
  _tail = (_tail + 1) % QUEUE_SIZE;
  if (_tail == _head) {
    // Overwrite oldest
    _head = (_head + 1) % QUEUE_SIZE;
  }
}

void Advisor::tick() {
  // No-op for now — AP mode has no internet.
  // In v5.x: if (WiFi.status() == WL_CONNECTED && _gasUrl.length() > 0 && _head != _tail) {
  //   HTTPClient http; http.begin(_gasUrl); ...
  // }
}

size_t Advisor::getQueueDepth() const {
  if (_tail >= _head) return _tail - _head;
  return QUEUE_SIZE - _head + _tail;
}

} // namespace AI
