// =============================================================================
// Network/WifiManager.h — ESP32 WiFi AP setup
// =============================================================================
#pragma once
#ifndef TIMER12_NETWORK_WIFI_H
#define TIMER12_NETWORK_WIFI_H

#include <Arduino.h>
#include <WiFi.h>

namespace Network {

class WifiManager {
public:
  bool begin();                  // Start AP with default credentials
  void onEvent(WiFiEvent_t event);
  String getApPassword() const;
  IPAddress getLocalIp() const;
  uint8_t getClientCount() const;
  int getRssi() const;
  void generateApPassword();

private:
  char _apPassword[33] = {0};
};

extern WifiManager wifi;

} // namespace Network

#endif
