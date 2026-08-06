// =============================================================================
// Network/WifiManager.cpp
// =============================================================================
#include "WifiManager.h"
#include "Core/Config.h"
#include "Core/Globals.h"
#include "Services/LogService.h"
#include <esp_task_wdt.h>

namespace Network {

WifiManager wifi;

void WifiManager::generateApPassword() {
  uint64_t mac = ESP.getEfuseMac();
  snprintf(_apPassword, sizeof(_apPassword), "AP-%04X%04X",
           (uint16_t)(mac >> 16), (uint16_t)mac);
  if (strlen(_apPassword) < 8) strcpy(_apPassword, "Timer12-Secure");
  // Persist to global for use elsewhere
  strncpy(Core::apPassword, _apPassword, 32);
  Core::apPassword[32] = '\0';
}

bool WifiManager::begin() {
  generateApPassword();
  WiFi.setTxPower((wifi_power_t)Core::WIFI_TX_POWER_DBM);
  WiFi.onEvent([this](WiFiEvent_t event) { onEvent(event); });
  WiFi.mode(WIFI_AP);

  IPAddress localIP(Core::AP_IP[0], Core::AP_IP[1], Core::AP_IP[2], Core::AP_IP[3]);
  IPAddress gateway(Core::AP_IP[0], Core::AP_IP[1], Core::AP_IP[2], Core::AP_IP[3]);
  IPAddress subnet(255, 255, 255, 0);
  WiFi.softAPConfig(localIP, gateway, subnet);

  int retries = 0;
  while (!WiFi.softAP(Core::AP_SSID, _apPassword, Core::WIFI_CHANNEL,
                      Core::WIFI_HIDDEN, Core::WIFI_MAX_CLIENTS) &&
         retries < 5) {
    delay(1000);
    retries++;
    esp_task_wdt_reset();
  }
  if (retries >= 5) {
    Services::Log::append(Core::LogType::Error, "softAP failed - restart", 0);
    delay(1000);
    ESP.restart();
    return false;
  }
  Services::Log::append(Core::LogType::Restart, "AP started: " + String(Core::AP_SSID), 0);
  return true;
}

void WifiManager::onEvent(WiFiEvent_t event) {
  switch (event) {
    case WIFI_EVENT_AP_STACONNECTED:
      Services::Log::append(Core::LogType::Login, "WiFi client connected", 0);
      break;
    case WIFI_EVENT_AP_STADISCONNECTED:
      Services::Log::append(Core::LogType::Logout, "WiFi client disconnected", 0);
      break;
    default: break;
  }
}

String WifiManager::getApPassword() const {
  return String(_apPassword);
}

IPAddress WifiManager::getLocalIp() const {
  return WiFi.softAPIP();
}

uint8_t WifiManager::getClientCount() const {
  return WiFi.softAPgetStationNum();
}

int WifiManager::getRssi() const {
  // For AP mode, RSSI is N/A; we return a synthetic value
  return -55;
}

} // namespace Network
