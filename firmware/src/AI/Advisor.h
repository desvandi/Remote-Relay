// =============================================================================
// AI/Advisor.h — Advisory hook (future Gemini integration via Google Apps Script)
// -----------------------------------------------------------------------------
// Per Engineering Brief: Gemini API is NOT called directly from the ESP32.
// Instead, ESP32 sends logs/summaries to Google Apps Script, which calls Gemini
// and stores recommendations. The PWA fetches and displays them.
//
// This module is a stub for future use. Currently a no-op that the firmware
// can call after notable events (e.g., schedule changes, errors) to enqueue
// data for the GAS pipeline. The actual network call will be implemented when
// the GAS Web App URL and auth scheme are finalized.
// =============================================================================
#pragma once
#ifndef TIMER12_AI_ADVISOR_H
#define TIMER12_AI_ADVISOR_H

#include <Arduino.h>

namespace AI {

class Advisor {
public:
  // Initialize with optional GAS endpoint URL (stored in NVS in production)
  void begin(const String& gasUrl = "");

  // Enqueue an event for the next GAS sync cycle (non-blocking, in-RAM queue)
  void recordEvent(const String& eventType, const String& payload);

  // Called from loop(): if WiFi STA is connected (future), POST queued events
  // to GAS endpoint. Currently a no-op since AP mode has no internet.
  void tick();

  // Get queue depth (for /api/health or diagnostics)
  size_t getQueueDepth() const;

private:
  String _gasUrl;
  // Simple ring buffer (16 events max)
  static const size_t QUEUE_SIZE = 16;
  String _queue[QUEUE_SIZE];
  size_t _head = 0;
  size_t _tail = 0;
};

extern Advisor advisor;

} // namespace AI

#endif
