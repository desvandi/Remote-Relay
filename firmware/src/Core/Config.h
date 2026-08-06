// =============================================================================
// Core/Config.h — System-wide constants and configuration
// Timer Digital Relay v4.0 — Cloud-Ready Architecture
// =============================================================================
#pragma once
#ifndef TIMER12_CORE_CONFIG_H
#define TIMER12_CORE_CONFIG_H

#include <Arduino.h>
#include <cstdint>

// ---------- FIRMWARE VERSION ----------
namespace Core {
  constexpr char FIRMWARE_VERSION[] = "4.0.0";
  constexpr char BUILD_DATE[] = __DATE__ " " __TIME__;
  constexpr uint8_t CONFIG_VERSION = 2;  // bump when schedule.json schema changes
  constexpr char DEVICE_MODEL[] = "ESP32-WROOM-32 Timer12 v4.0";

  // ---------- CHANNELS ----------
  constexpr uint8_t NUM_CHANNELS = 12;
  constexpr uint8_t NUM_PIR = 4;
  constexpr uint8_t PIR_CHANNEL_OFFSET = 8;  // PIR 1..4 -> channel 9..12 (index 8..11)
  constexpr uint8_t MAX_SCHEDULES = 4;

  // ---------- PIN MAPPING ----------
  // Relay outputs (active-LOW module: LOW = ON, HIGH = OFF)
  constexpr uint8_t RELAY_PINS[NUM_CHANNELS] = {
    13, 14, 16, 17, 18, 19,
    21, 22, 23, 25, 26, 27
  };
  constexpr uint8_t RELAY_ON = LOW;
  constexpr uint8_t RELAY_OFF = HIGH;

  // PIR inputs (input-only GPIO, no internal pull needed for HC-SR501)
  constexpr uint8_t PIR_PINS[NUM_PIR] = {34, 35, 36, 39};

  // I2C for DS3231 RTC
  constexpr uint8_t I2C_SDA = 32;
  constexpr uint8_t I2C_SCL = 33;
  constexpr uint32_t I2C_CLOCK = 400000;  // Fast Mode

  // ---------- WIFI AP ----------
  constexpr const char* AP_SSID = "Timer12CH";
  constexpr uint8_t WIFI_CHANNEL = 6;
  constexpr uint8_t WIFI_MAX_CLIENTS = 4;  // increased for cloud tunnel
  constexpr bool WIFI_HIDDEN = false;
  constexpr int8_t WIFI_TX_POWER_DBM = 17;
  constexpr uint32_t AP_IP[] = {192, 168, 4, 1};

  // ---------- STORAGE LIMITS ----------
  constexpr size_t MAX_NAME_LEN = 20;
  constexpr size_t MAX_NAME_BUF = MAX_NAME_LEN + 1;
  constexpr size_t MAX_USER_LEN = 31;
  constexpr size_t MAX_USER_BUF = MAX_USER_LEN + 1;
  constexpr size_t MAX_TIME_STR = 5;       // "HH:MM"
  constexpr size_t MAX_TIME_BUF = 6;       // +null
  constexpr size_t SALT_LEN = 16;
  constexpr size_t HASH_LEN = 32;          // SHA-256 output bytes
  constexpr size_t HASH_HEX_LEN = HASH_LEN * 2;
  constexpr size_t HASH_HEX_BUF_SIZE = HASH_HEX_LEN + 1;
  constexpr uint16_t PBKDF2_ITERATIONS = 10000;

  constexpr size_t MAX_BODY_SIZE = 16384;       // 16 KB for /api/config/import
  constexpr size_t MAX_AUDIT_LOG_SIZE = 8192;   // 8 KB before rotation
  constexpr size_t MAX_ACTIVITY_LOG_ENTRIES = 200;

  // ---------- TIMING ----------
  constexpr unsigned long SAVE_DELAY_MS = 10000;       // 10s debounce
  constexpr unsigned long MAX_SAVE_DELAY_MS = 60000;   // 60s forced save
  constexpr unsigned long PIR_WARMUP_MS = 60000;       // 60s warmup after boot
  constexpr unsigned long PIR_DEBOUNCE_INTERVAL_MS = 50;
  constexpr uint8_t PIR_DEBOUNCE_SAMPLES = 3;
  constexpr uint8_t PIR_DEBOUNCE_THRESHOLD = 2;       // 2 of 3 = HIGH
  constexpr unsigned long PIR_STUCK_TIMEOUT_MS = 1800000;     // 30 min
  constexpr unsigned long PIR_STUCK_COOLDOWN_MS = 300000;     // 5 min

  constexpr unsigned long RELAY_TICK_MS = 1000;        // recompute relay state every 1s

  // ---------- AUTH ----------
  constexpr uint8_t AUTH_FAIL_THRESHOLD_SHORT = 5;
  constexpr uint8_t AUTH_FAIL_THRESHOLD_LONG = 10;
  constexpr unsigned long AUTH_BLOCK_SHORT_MS = 60000;     // 1 min
  constexpr unsigned long AUTH_BLOCK_LONG_MS = 300000;     // 5 min
  constexpr size_t MAX_TRACKED_IPS = 8;
  constexpr uint16_t CSRF_TOKEN_LEN = 32;                  // hex chars (16 bytes random)
  constexpr unsigned long CSRF_TOKEN_TTL_MS = 3600000;     // 1 hour
  constexpr uint16_t JWT_TTL_SECONDS = 3600;               // 1 hour
  constexpr size_t JWT_MAX_LEN = 512;

  // ---------- FACTORY RESET ----------
  constexpr unsigned long FACTORY_RESET_TOKEN_TTL_MS = 60000;  // 60s

  // ---------- OTA ----------
  constexpr size_t OTA_MAX_BINARY_SIZE = 2 * 1024 * 1024;  // 2 MB safety cap

  // ---------- FILE PATHS ----------
  constexpr const char* PATH_CONFIG_JSON = "/config.json";
  constexpr const char* PATH_CONFIG_BAK = "/config.bak";
  constexpr const char* PATH_CONFIG_TMP = "/config.tmp";
  constexpr const char* PATH_SCHEDULE_JSON = "/schedule.json";
  constexpr const char* PATH_SCHEDULE_BAK = "/schedule.bak";
  constexpr const char* PATH_SCHEDULE_TMP = "/schedule.tmp";
  constexpr const char* PATH_SCHEDULE_BAK_TMP = "/schedule.bak.tmp";
  constexpr const char* PATH_AUDIT_LOG = "/audit.log";
  constexpr const char* PATH_AUDIT_LOG_OLD = "/audit.log.old";
  constexpr const char* PATH_ACTIVITY_LOG = "/activity.log";
  constexpr const char* PATH_ACTIVITY_LOG_OLD = "/activity.log.old";

  // ---------- DEFAULT TIMEZONE ----------
  constexpr const char* DEFAULT_TIMEZONE = "Asia/Jakarta";

  // ---------- JWT (mock secret — burn into NVS in production) ----------
  // In production: store a per-device random 32-byte secret in Preferences/NVS
  // at first boot. Here we use a compile-time constant for demonstration.
  constexpr const char* JWT_SECRET_DEFAULT = "Timer12-v4.0-CHANGE-ME-IN-PRODUCTION";
}

#endif // TIMER12_CORE_CONFIG_H
