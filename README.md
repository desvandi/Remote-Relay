# Timer Digital Relay v4.0 — Remote Relay System

Complete IoT system for controlling 12 relay channels + 4 PIR sensors + PZEM-004T power meter via ESP32, accessible from anywhere through MQTT (works behind CGNAT/MiFi — no port forwarding needed).

## System Architecture

```
                    ┌──────────────────────────────────────────┐
                    │           GitHub (source code)            │
                    │  • Remote-Relay/                       │
                    │    (this PWA, deployed to Vercel)        │
                    │  • Firmware-code-gs_relaytimer/         │
                    │    (ESP32 firmware + Code.gs)            │
                    └──────────┬───────────────────────────────┘
                               │ git push → Vercel auto-deploy
                               ▼
                    ┌─────────────────────┐
                    │   Vercel (PWA)      │
                    │                     │
                    │  Env vars:          │
                    │  • NEXT_PUBLIC_     │
                    │    GAS_INSIGHTS_URL │
                    │  • NEXT_PUBLIC_     │
                    │    API_BASE_URL     │ (optional, LAN)
                    └────────┬────────────┘
                             │
              ┌──────────────┼──────────────────────────┐
              │              │                          │
              │ WSS          │ GET insights             │ HTTP POST logs
              │ (MQTT)       │ (every 5 min)            │ (every 1 hour)
              ▼              ▼                          ▼
        ┌──────────┐  ┌─────────────────┐    ┌──────────────────┐
        │ HiveMQ   │  │ Google Apps     │    │   ESP32          │
        │ Broker   │  │ Script Web App  │    │                  │
        │ (free)   │  │                 │    │  Config.h:       │
        │          │  │ → Gemini API    │    │  GAS_INSIGHTS_URL│
        │          │  │ → cache 1 hour  │    │                  │
        └────┬─────┘  └────────┬────────┘    └────────┬─────────┘
             │                 │                      │
             │ MQTT            │ HTTPS                │ MQTT
             │ (real-time)     │ (AI analysis)        │ (commands)
             │                 │                      │
             ▼                 ▼                      ▼
        ┌──────────────────────────────────────────────────────┐
        │              Handphone (PWA browser)                  │
        │                                                      │
        │  1. Real-time relay control via MQTT (instant)        │
        │  2. AI Insights fetched from GAS every 5 min          │
        │  3. ESP32 posts logs to GAS every 1 hour              │
        │  4. Energy analytics with charts (24h rolling)        │
        │  5. PZEM power monitoring (V/A/W/kWh/Hz/PF)           │
        │  6. RTC time display from DS3231                     │
        └──────────────────────────────────────────────────────┘
```

---

## Hardware Components

### Required
| Component | Model | Qty | Price (est.) | Notes |
|-----------|-------|-----|-------------|-------|
| Microcontroller | ESP32-WROOM-32 Dev Module | 1 | ~Rp 50.000 | 4MB flash, WiFi+BT |
| Relay Module | 12-channel active-LOW | 1 | ~Rp 80.000 | 5V, optocoupler isolated |
| RTC | DS3231SN | 1 | ~Rp 25.000 | I2C, CR1220 battery backup |
| PIR Sensors | HC-SR501 | 4 | ~Rp 8.000 each | Adjustable sensitivity |
| Power Supply | 5V ≥2A | 1 | ~Rp 30.000 | Shared GND with ESP32 |

### Optional (Power Monitoring)
| Component | Model | Qty | Price (est.) | Notes |
|-----------|-------|-----|-------------|-------|
| Power Meter | PZEM-004T v3.0 | 1 | ~Rp 30.000 | AC 80-260V, Modbus-RTU UART |

### Total Cost
- **Without PZEM**: ~Rp 217.000
- **With PZEM**: ~Rp 247.000

---

## Hardware Wiring

### ESP32 Pin Mapping

| Component | GPIO | Type | Notes |
|-----------|------|------|-------|
| **Relay 1** | 13 | Output | Active-LOW (LOW=ON) |
| **Relay 2** | 14 | Output | |
| **Relay 3** | 16 | Output | |
| **Relay 4** | 17 | Output | |
| **Relay 5** | 18 | Output | |
| **Relay 6** | 19 | Output | |
| **Relay 7** | 21 | Output | |
| **Relay 8** | 22 | Output | |
| **Relay 9** | 23 | Output | PIR 1 mapped here |
| **Relay 10** | 25 | Output | PIR 2 mapped here |
| **Relay 11** | 26 | Output | PIR 3 mapped here |
| **Relay 12** | 27 | Output | PIR 4 mapped here |
| **PIR 1** | 34 | Input-only | HC-SR501 → Relay 9 |
| **PIR 2** | 35 | Input-only | HC-SR501 → Relay 10 |
| **PIR 3** | 36 | Input-only | HC-SR501 → Relay 11 (SENSOR_VP) |
| **PIR 4** | 39 | Input-only | HC-SR501 → Relay 12 (SENSOR_VN) |
| **DS3231 SDA** | 32 | I2C Data | 400kHz Fast Mode |
| **DS3231 SCL** | 33 | I2C Clock | 400kHz Fast Mode |
| **PZEM TX→RX** | 5 | UART1 RX | PZEM TX → ESP32 GPIO5 |
| **PZEM RX←TX** | 4 | UART1 TX | ESP32 GPIO4 → PZEM RX |

### Wiring Diagram

```
ESP32-WROOM-32                    12-CH Relay Module
┌─────────────┐                  ┌──────────────┐
│ GPIO13-27   │─────────────────→│ IN1-IN12     │ (12 wires)
│ GND         │─────────────────→│ GND          │ (shared ground)
│ 5V          │                  │ VCC (5V ext) │ ← external PSU
└─────────────┘                  └──────────────┘

ESP32                            DS3231 RTC
┌─────────────┐                  ┌──────────────┐
│ GPIO32 (SDA)│←────────────────→│ SDA          │
│ GPIO33 (SCL)│←────────────────→│ SCL          │
│ 3.3V        │─────────────────→│ VCC          │
│ GND         │─────────────────→│ GND          │
└─────────────┘                  └──────────────┘

ESP32                            PZEM-004T v3.0
┌─────────────┐                  ┌──────────────┐
│ GPIO5 (RX)  │←─────────────────│ TX           │ (PZEM TX → ESP RX)
│ GPIO4 (TX)  │─────────────────→│ RX           │ (ESP TX → PZEM RX)
│ 5V          │─────────────────→│ VCC          │
│ GND         │─────────────────→│ GND          │
└─────────────┘                  └──────────────┘
                                        │
                                 ┌──────┴──────┐
                                 │ AC Input    │
                                 │ L (Phase)   │ ← 220V AC mains
                                 │ N (Neutral) │
                                 └─────────────┘

ESP32                            HC-SR501 PIR ×4
┌─────────────┐                  ┌──────────────┐
│ GPIO34      │←─────────────────│ PIR 1 OUT    │
│ GPIO35      │←─────────────────│ PIR 2 OUT    │
│ GPIO36      │←─────────────────│ PIR 3 OUT    │
│ GPIO39      │←─────────────────│ PIR 4 OUT    │
│ 5V          │─────────────────→│ VCC (all)    │
│ GND         │─────────────────→│ GND (all)    │
└─────────────┘                  └──────────────┘
```

### Power Supply Notes
- ESP32: powered via USB 5V or VIN pin (5V)
- Relay module: needs external 5V ≥1A PSU (NOT from ESP32 pin — current insufficient)
- **CRITICAL**: ESP32 GND and relay PSU GND must be connected (shared ground)
- PZEM-004T: powered from same 5V (low current draw)
- PIR sensors: powered from ESP32 5V pin (low current)
- DS3231: powered from 3.3V or 5V (low current)

### PZEM-004T AC Wiring
```
                    PZEM-004T v3.0
                    ┌──────────────┐
  Mains L ────────→│ AC IN (L)    │
  Mains N ────────→│ AC IN (N)    │
                    │              │
  Load L ←─────────│ Load (L)     │ (passing through PZEM)
  Load N ←─────────│ Load (N)     │
                    └──────────────┘
```
> ⚠️ **DANGER**: PZEM-004T connects directly to 220V AC mains. Only qualified electrician should wire AC side. Ensure power is OFF before wiring.

---

## Firmware Configuration

> 📦 **Firmware + Code.gs repo**: https://github.com/desvandi/Firmware-code-gs_relaytimer
>
> Contains all 53 ESP32 source files (flat layout for Arduino IDE compatibility) and `Code.gs` (Google Apps Script for AI insights). Clone that repo to flash the firmware.

### Libraries Required (Arduino IDE → Library Manager)
| Library | Author | Version | Purpose |
|---------|--------|---------|---------|
| RTClib | Adafruit | ^2.1.4 | DS3231 RTC driver |
| ArduinoJson | Benoit Blanchon | ^7.0.0 | JSON parse/serialize |
| PubSubClient | Nick O'Leary | ^2.8 | MQTT client |

### Board Settings (Arduino IDE)
| Setting | Value |
|---------|-------|
| Board | ESP32 Dev Module |
| Port | /dev/cu.SLAB_USBtoUART (macOS) |
| Upload Speed | 921600 |
| CPU Frequency | 240 MHz |
| Flash Frequency | 80 MHz |
| Flash Mode | QIO |
| Flash Size | 4MB (32Mb) |
| Partition Scheme | Default 4MB with spiffs |
| Core Debug Level | Info |
| PSRAM | Disabled |

### Configuration File: `Config.h`

All configurable parameters are in `Config.h` (in the [firmware repo](https://github.com/desvandi/Firmware-code-gs_relaytimer) at `firmware/Config.h`). Key settings:

#### WiFi (STA Mode)
```cpp
// ESP32 joins this WiFi on boot. If fails after 3 retries, opens Config Portal.
constexpr const char* WIFI_CONFIG_PORTAL_SSID = "Timer12-Setup";
```
- **First boot**: ESP32 opens AP `Timer12-Setup`. Connect to it, open `http://192.168.4.1`, enter WiFi SSID + password.
- **Subsequent boots**: ESP32 auto-joins saved WiFi. If WiFi changed, it falls back to Config Portal.

#### MQTT Broker
```cpp
constexpr const char* MQTT_BROKER_HOST = "broker.hivemq.com";
constexpr uint16_t MQTT_BROKER_PORT = 1883;
```
- Free public broker, no signup needed
- Security: 8-char random password per device (auto-generated, stored in NVS)

#### Google Apps Script (AI Insights)
```cpp
constexpr const char* GAS_INSIGHTS_URL = "https://script.google.com/macros/s/AKfyc.../exec";
```
- Paste your GAS Web App deployment URL here
- Leave empty (`""`) to disable AI insights
- ESP32 POSTs logs + status to this URL every 1 hour

#### PZEM-004T
```cpp
constexpr uint8_t PZEM_RX_PIN = 5;    // ESP32 RX ← PZEM TX
constexpr uint8_t PZEM_TX_PIN = 4;    // ESP32 TX → PZEM RX
constexpr uint32_t PZEM_BAUD_RATE = 9600;
```

#### Alarm Thresholds
```cpp
constexpr float ALARM_VOLTAGE_MIN = 190.0;    // Undervoltage
constexpr float ALARM_VOLTAGE_MAX = 250.0;    // Overvoltage
constexpr float ALARM_CURRENT_MAX = 8.0;       // Overcurrent (PZEM max 10A)
constexpr float ALARM_POWER_MAX = 1500.0;     // Overpower
constexpr float ALARM_PF_MIN = 0.70;          // Low power factor
```

### Serial Monitor Output (115200 baud)
```
========================================
Timer 12 Relay v4.0.0
Build: Aug  7 2026 ...
Cloud-Ready Architecture (modular)
========================================
[WiFi] MQTT Password: <DEVICE_SECRET>
[WiFi] Device PIN: <DEVICE_PIN>
========================================
WiFi: connecting to STA "YourWiFi"...
WiFi STA connected! IP: 192.168.1.50, RSSI: -55 dBm
[PZEM] PZEM-004T v3.0 detected!
[PZEM] V=220.0V, I=0.150A, P=33.0W, E=0.005kWh, F=50.0Hz, PF=0.87
[AI] GAS URL configured
MQTT: connected!
Boot complete. Ready.
```

**Save these values:**
- **MAC Address** (shown in Serial): needed for PWA login
- **MQTT Password**: needed for PWA login
- **Device PIN**: for future factory reset verification

---

## PWA Dashboard Configuration

### Environment Variables (Vercel)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_GAS_INSIGHTS_URL` | No | Google Apps Script Web App URL for AI Insights. Leave empty for mock insights. |
| `NEXT_PUBLIC_API_BASE_URL` | No | ESP32 local IP for LAN REST mode. Leave empty for MQTT remote mode (recommended). |

### Modes of Operation

| Mode | Condition | Badge | Features Available |
|------|-----------|-------|-------------------|
| **MQTT Remote** | MAC + password entered | `· mqtt` (green) | All features via MQTT (works from anywhere) |
| **LAN REST** | `NEXT_PUBLIC_API_BASE_URL` set | `· live` (blue) | All features via REST (same WiFi only) |
| **Demo Mock** | Neither configured | `· mock` (amber) | All features with simulated data |

### Connecting PWA to ESP32

1. Open PWA URL (Vercel deployment)
2. Scroll to **"Remote Mode (MQTT)"** card
3. Enter:
   - **Device ID (MAC):** from Serial Monitor (12 hex chars, e.g., `<DEVICE_MAC>`)
   - **MQTT Password:** from Serial Monitor (8 chars, e.g., `<DEVICE_SECRET>`)
4. Click **Connect via MQTT**
5. Dashboard loads — control relays from anywhere

---

## Google Apps Script (AI Insights) Setup

> 📦 **Code.gs lives in**: [`code.gs/Code.gs`](https://github.com/desvandi/Firmware-code-gs_relaytimer/blob/main/code.gs/Code.gs) in the firmware repo.

### Deploy Code.gs
1. Open https://script.google.com → **New Project**
2. Delete default code, paste contents of [`Code.gs`](https://github.com/desvandi/Firmware-code-gs_relaytimer/blob/main/code.gs/Code.gs)
3. **Set Gemini API key:**
   - Project Settings → Script Properties
   - Add: `GEMINI_API_KEY` = your key from https://aistudio.google.com/apikey
4. **Deploy as Web App:**
   - Deploy → New Deployment → Type: Web App
   - Execute as: **Me**
   - Who has access: **Anyone**
5. **Copy deployment URL** (e.g., `https://script.google.com/macros/s/AKfyc.../exec`)

### Set URL in Two Places

| Location | Variable | How |
|----------|----------|-----|
| **PWA (Vercel)** | `NEXT_PUBLIC_GAS_INSIGHTS_URL` | Vercel Dashboard → Settings → Environment Variables |
| **ESP32 (Firmware)** | `GAS_INSIGHTS_URL` in `Config.h` | Edit file before flashing |

### AI Analysis Flow
```
ESP32 (every 1 hour) → POST {mac, status, logs[50]} → GAS Web App
                                                         ↓
                                                    Gemini API
                                                         ↓
PWA (every 5 min) ← GET insights ← GAS (cached 1 hour)
```

### What Gemini Analyzes
1. **Usage patterns**: relays always on/off at same time (from logs)
2. **Energy waste**: high consumption, long ON durations (from PZEM + logs)
3. **Faults**: relay stuck ON, PIR not triggering, voltage anomalies
4. **Maintenance**: relay cycle count, contact wear estimate
5. **PIR optimization**: rarely triggered sensors
6. **Power quality**: voltage stability, power factor, frequency deviations
7. **Cost estimation**: electricity cost at Rp 1467/kWh

---

## Features Matrix

| Feature | LAN (REST) | Remote (MQTT) |
|---------|:----------:|:--------------:|
| 12 Relay Control (ON/OFF, mode) | ✅ | ✅ |
| Channel Rename (persistent) | ✅ | ✅ |
| Weekly Scheduler (max 4/channel) | ✅ | ✅ |
| Schedule Conflict Validation | ✅ | ✅ |
| 4 PIR Config + Test Trigger | ✅ | ✅ |
| Activity Log (real-time + CSV) | ✅ | ✅ |
| AI Insights (Gemini via GAS) | ✅ | ✅ |
| Energy Monitoring (PZEM) | ✅ | ✅ |
| Energy Analytics + Charts | ✅ | ✅ |
| Power Alarms (5 thresholds) | ✅ | ✅ |
| Geofencing (enter/leave) | ✅ | ✅ |
| OTA Firmware Update | ✅ (upload, real) | ✅ (URL download, real via ESP32) |
| OTA (PWA mock API) | DEMO (simulated) | DEMO (simulated) |
| WiFi Config Portal | ✅ | ✅ |
| MQTT Security (topic password) | — | ✅ |
| Device Config (name, timezone) | ✅ | ✅ |
| Change Password | ✅ | ❌ (use LAN) |
| Factory Reset | ✅ | ❌ (use LAN) |
| Config Export/Import | ✅ | ❌ (use LAN) |
| Dark Mode | ✅ | ✅ |
| Multi-language (ID/EN) | ✅ | ✅ |
| PWA Install (Android/iOS) | ✅ | ✅ |

---

## MQTT Topic Structure

```
timer12/<MAC>/<PASSWORD>/status    ← ESP32 publishes SystemStatus (every 5s)
timer12/<MAC>/<PASSWORD>/command   ← PWA publishes commands
timer12/<MAC>/<PASSWORD>/log       ← ESP32 publishes activity log (real-time)
timer12/<MAC>/<PASSWORD>/online    ← LWT: "1" on connect, "0" on disconnect
timer12/<MAC>/<PASSWORD>/ota       ← PWA publishes OTA update commands
```

### Command Types (PWA → ESP32)
| Type | Actions | Description |
|------|---------|-------------|
| `relay` | on, off, set_mode | Relay control (SET_STATE only, no TOGGLE for idempotency) |
| `schedule` | upsert, delete | Schedule management |
| `pir` | config, test | PIR configuration |
| `channel` | rename | Channel rename (persistent) |
| `time` | set | Set RTC time |
| `system` | reboot, getStatus, resetEnergyStats, resetDailyStats | System commands |
| `config` | setDevice | Device name + timezone change |

### Status Fields (ESP32 → PWA)
28 fields including: firmware info, device name, uptime, RTC time, WiFi RSSI, heap, CPU load, 12 channels (name, state, source, mode), 4 PIRs, schedules, PZEM data (voltage, current, power, energy, frequency, PF, VA, VAR, daily stats, alarms), stats summary.

---

## REST API (LAN Mode)

Set `NEXT_PUBLIC_API_BASE_URL=http://192.168.1.50` in Vercel env vars.

All responses: `{ "success": bool, "message": string, "data": T }`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/login` | JWT + CSRF cookies |
| GET | `/api/status` | Full SystemStatus |
| POST | `/api/relay` | Set relay state/mode (ON/OFF/set_mode) |
| POST | `/api/schedule` | Upsert schedule |
| POST | `/api/pir` | PIR config |
| POST | `/api/time` | Set RTC |
| GET | `/api/log` | Activity log |
| POST | `/api/channel` | Rename channel |
| POST | `/api/reboot` | Reboot ESP32 |
| POST | `/api/ota` | Upload firmware |
| POST | `/api/factory_reset/prepare` | Generate reset token |
| POST | `/api/factory_reset/confirm` | Execute factory reset |

---

## Project Structure

```
Remote-Relay/                         ← PWA (this repo, deployed to Vercel)
├── package.json
├── .env.example
├── src/
│   ├── app/                          ← Next.js App Router
│   │   ├── api/                      ← Mock API routes (dev/demo only; real calls hit ESP32)
│   │   ├── page.tsx                  ← Login (REST + MQTT dual mode)
│   │   ├── layout.tsx                ← Providers wrap
│   │   └── globals.css               ← Tailwind 4 + custom styles
│   ├── components/
│   │   ├── providers/                ← Theme, Language, Query, Auth, MQTT
│   │   ├── layout/                   ← AppShell, Sidebar, Header
│   │   ├── auth/                     ← Login (REST + MQTT dual mode)
│   │   ├── dashboard/                ← 12 relay grid + PZEM stats
│   │   ├── scheduler/                ← Weekly schedule editor
│   │   ├── pir/                      ← 4 PIR cards
│   │   ├── logs/                     ← Activity log table
│   │   ├── ai/                       ← AI Insights (GAS-powered)
│   │   ├── energy/                   ← Energy Analytics + charts
│   │   ├── ota/                      ← Firmware management
│   │   └── settings/                 ← Timezone, password, backup, reset
│   │   └── ui/                       ← shadcn/ui components
│   ├── hooks/useApi.ts              ← Hybrid REST/MQTT React Query hooks
│   └── lib/
│       ├── types.ts                  ← API contract types
│       ├── api.ts                    ← REST API client
│       ├── apiResponse.ts            ← Server-side JSON envelope helpers
│       ├── mqtt.ts                   ← MQTT client (WSS to HiveMQ)
│       ├── mqttPublisher.ts          ← Internal publisher (private, not exported)
│       ├── mqttTransaction.ts        ← ACK transaction layer (UUID, 5s timeout, schema validation)
│       ├── mqttPending.ts            ← Pending commands map + synchronous cancel
│       ├── aiInsights.ts             ← GAS insights fetcher
│       ├── geofence.ts               ← Geofencing utility
│       ├── scheduleConflict.ts       ← Schedule overlap validator
│       ├── energyHistory.ts          ← 24h rolling energy storage (localStorage)
│       ├── mockStore.ts              ← In-memory simulator (dev/demo only)
│       ├── auth.ts                   ← getSession / requireAuth / CSRF (graceful no-op when disabled)
│       ├── jwt.ts                    ← HS256 sign/verify (server-side)
│       ├── i18n.ts                   ← ID + EN translations
│       └── format.ts                 ← Time/uptime/RSSI formatters
└── public/
    ├── manifest.webmanifest
    └── icon-{192,512,512-maskable}.png

Firmware-code-gs_relaytimer/          ← ESP32 firmware + GAS (separate repo)
├── firmware/                         ← 53 files, flat layout for Arduino IDE
│   ├── firmware_v4.ino               ← Main entry (setup + loop)
│   ├── Config.h                      ← ⚠️ Edit GAS_INSIGHTS_URL + MQTT broker here
│   ├── MqttClient.cpp                ← ACK + requestId dedup + TLS support
│   ├── PzemDriver.cpp                ← PZEM-004T v3.0 self-contained Modbus-RTU
│   ├── Advisor.cpp                   ← GAS integration (watchdog-safe HTTP)
│   ├── AuthManager.cpp               ← JWT + CSRF + rate limiter
│   └── ... (47 more files)
└── code.gs/
    └── Code.gs                       ← Google Apps Script (deploy to GAS)
```

See the [firmware repo README](https://github.com/desvandi/Firmware-code-gs_relaytimer#readme) for the firmware file-by-file breakdown.

---

## Troubleshooting

### PWA shows "MOCK API" badge
- **Cause**: No MQTT connection AND no `NEXT_PUBLIC_API_BASE_URL`
- **Fix**: Connect via MQTT (enter MAC + password in login page)

### MQTT won't connect
- Check ESP32 Serial Monitor shows `MQTT: connected!`
- Verify MAC (12 hex) + MQTT password (8 chars) match Serial output
- Wait 10s for first connection (HiveMQ can be slow)

### ESP32 falls back to Config Portal
- WiFi credentials wrong → connect to `Timer12-Setup` AP, reconfigure at `http://192.168.4.1`
- WiFi out of range → move ESP32 closer to router

### AI Insights show mock cards
- `NEXT_PUBLIC_GAS_INSIGHTS_URL` not set in Vercel
- `GAS_INSIGHTS_URL` empty in `Config.h`
- Fix: deploy Code.gs, set URL in both places, re-flash firmware

### PZEM not detected
- Check wiring: TX→GPIO5, RX→GPIO4, VCC→5V, GND→GND
- Serial Monitor should show `[PZEM] PZEM-004T v3.0 detected!`
- If not detected, firmware runs without PZEM (graceful degradation)

### RTC time invalid
- Check CR1220 battery in DS3231 module
- Set time via PWA Settings → Set RTC Time → Sync Now
- Check I2C wiring: SDA=GPIO32, SCL=GPIO33

### Channel names not persisting
- Names are saved to LittleFS (`/schedule.json`) every 10s after change
- On reboot, names are loaded from file
- If LittleFS is corrupted, names reset to default ("Relay 1"..."Relay 12")

### OTA / Password / Factory Reset don't work
- These require LAN (REST) connection
- Connect phone to same WiFi as ESP32, set `NEXT_PUBLIC_API_BASE_URL`

---

## Security Notes

> ⚠️ **PRODUCTION SECURITY DISCLAIMER**
>
> This system uses **HiveMQ public broker** (anonymous, no TLS on ESP32 side, port 1883).
> Device password is embedded in MQTT topic path as an obscurity measure.
>
> **This is NOT sufficient for production relay control of 220V AC loads.**
>
> For production deployment, you MUST:
> 1. Deploy self-hosted MQTT broker (Mosquitto/EMQX) with TLS (port 8883)
> 2. Enable broker authentication (username/password per device)
> 3. Configure ACL per device (restrict publish/subscribe to own topics)
> 4. Remove password from topic path (use `timer12/<deviceId>/command` instead)
> 5. Set `MQTT_BROKER_HOST`, `MQTT_BROKER_PORT=8883`, `MQTT_BROKER_USERNAME`, `MQTT_BROKER_PASSWORD` in `Config.h`
> 6. Update PWA `MQTT_BROKER_URL` to use `wss://` with authenticated broker
>
> The codebase already supports authenticated brokers — set the credentials and re-flash.

### Current Security Measures (MVP / Demo)
- **MQTT topic password**: 8-char random alphanumeric, generated per device, stored in NVS (obscurity, not authentication)
- **MQTT TLS**: Supported in firmware (port 8883 → WiFiClientSecure). Default: plain TCP (port 1883)
- **GAS Web App**: Deployed as "Anyone (anonymous)" — URL is unguessable. For production: add HMAC signature
- **JWT (REST mode)**: HS256 signed, 1-hour expiry, CSRF token required. Secret from `process.env.JWT_SECRET` (hard fail if missing in production)
- **No hardcoded secrets**: All credentials generated at first boot, stored in NVS. No `admin/admin123` in production (DEMO_MODE only)
- **ACK transaction**: Every relay command waits for ESP32 ACK (5s timeout). UI only shows success after ESP32 confirms execution
- **Idempotency**: PWA uses SET_STATE (ON/OFF) instead of TOGGLE. ESP32 deduplicates by requestId (ring buffer of 16)
- **Data minimization**: GAS receives anonymous device ID (SHA-256 hash of MAC, truncated to 16 chars), not raw MAC
- **WiFi Config Portal**: Open AP (no password) for easy onboarding. Closes automatically after WiFi saved.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| PWA Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI | Tailwind CSS 4 + shadcn/ui + Lucide |
| State | TanStack Query (server), Zustand (UI) |
| Charts | Recharts |
| MQTT | mqtt.js v5 (PWA) + PubSubClient (ESP32) |
| Broker | HiveMQ public (broker.hivemq.com) |
| AI | Google Apps Script → Gemini API (gemini-1.5-flash) |
| Hosting | Vercel (PWA) + ESP32 (firmware) + GAS (AI) |
| Auth | JWT (HS256) + CSRF (REST) + Topic password (MQTT) |
| Power Meter | PZEM-004T v3.0 (Modbus-RTU over UART) |
| RTC | DS3231SN (I2C, CR1220 backup) |

---

## Changelog (PWA)

### v4.0.2 — Auth graceful-degradation fix (latest)

- **Fixed**: "Invalid JSON response (status 500)" when clicking LAN login button on Vercel.
  - Root cause: `assertMockAuthConfigured()` threw an uncaught error in production (no `JWT_SECRET` / `DEMO_MODE`), causing Next.js to return 500 with HTML instead of JSON.
  - Fix: Replaced throwing guard with non-throwing `isMockAuthEnabled()` boolean. All auth functions (`verifyCredentials`, `getJwtSecret`, `getSession`) now gracefully return `false` / empty / unauthenticated when mock auth is disabled — no throws, no 500s.
- **`/api/login`**: Returns `403 JSON` with clear "LAN mode disabled" message instead of throwing.
- **`/api/session`**: Returns `200 JSON {isAuthenticated:false}` instead of 500 (silent page-load check).
- **LoginForm**: When LAN mode is disabled, hides the LAN login card and shows a notice card guiding the user to MQTT mode (with env var setup instructions for re-enabling demo mode).
- **New env var**: `NEXT_PUBLIC_DEMO_MODE=true` (frontend-visible variant of `DEMO_MODE` — lets the browser detect demo mode and show the LAN login card).
- **Build fix**: `tsconfig.json` now excludes `examples/`, `skills/`, `mini-services/`, `firmware_v4/`, `tool-results/`, `upload/`, `download/`, `Remote-Relay/` from type-checking (was breaking Vercel build with unrelated `socket.io-client` and `zai-sdk` type errors from those reference directories).

### v4.0.1 — MQTT transaction layer hardening (8 audit rounds)

- **MQTT transaction layer**: `sendCommandWithAck()` generates UUID `requestId`, waits for ESP32 ACK with 5s timeout, deep-validates ACK schema (`channelId` 1-12, `state` boolean, `source` enum, `modeAuto` boolean). Matches ACK by `requestId` from a `pendingCommands` Map.
- **Subscribe-before-resolve**: connect promise resolves only after subscribe callback confirms granted QoS (validates `granted.length === 4` and `qos !== 128`).
- **Settle-once pattern**: subsequent connection events don't re-trigger resolve/reject.
- **Private publisher**: `publishCommand()` moved to `mqttPublisher.ts` (not exported from public API) — only accessible via `sendCommandWithAck()`.
- **Synchronous cancel**: `cancelAllPendingCommands()` is synchronous (no async dynamic import) — safe to call from React unmount.
- **Idempotent relay control**: All 10 relay mutations use `SET_STATE ON/OFF` (no TOGGLE). ESP32 deduplicates by `requestId` via ring buffer of 16.
- **React Query cache update**: relay mutation updates the cache from ACK data (not optimistic update) for deterministic UI state.

See the [firmware repo CHANGELOG](https://github.com/desvandi/Firmware-code-gs_relaytimer#security-audit-notes) for the matching ESP32-side hardening (8 audit rounds).

---

## License

Proprietary — built per the Timer Digital Relay v4.0 Cloud-Ready Architecture Engineering Brief.
