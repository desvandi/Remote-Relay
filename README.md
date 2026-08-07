# Timer Digital Relay v4.0 — Remote Relay Dashboard

Progressive Web App (PWA) for controlling an ESP32-based 12-channel relay + 4 PIR timer system from anywhere. **Works behind CGNAT/MiFi** — no port forwarding, no public IP, no always-on host required.

---

## System Architecture

```
                    ┌──────────────────────────────────────────┐
                    │           GitHub (source code)            │
                    │  • Remote-Relay/      (this PWA)          │
                    │  • firmware_v4/       (ESP32 code)        │
                    │  • Code.gs            (AI Insights)       │
                    └──────────┬───────────────────────────────┘
                               │ git push triggers auto-deploy
                               ▼
                    ┌─────────────────────┐
                    │   Vercel (PWA)      │
                    │                     │
                    │  Env vars:          │
                    │  • NEXT_PUBLIC_     │
                    │    GAS_INSIGHTS_URL │
                    │  • NEXT_PUBLIC_     │
                    │    API_BASE_URL     │ (optional, LAN mode)
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
        └──────────────────────────────────────────────────────┘
```

### Data Flow Summary

| Flow | Protocol | Frequency | Purpose |
|------|----------|-----------|---------|
| ESP32 → HiveMQ | MQTT (TCP 1883) | Every 5s + on-change | Publish status, logs, online state |
| PWA → HiveMQ | MQTT (WSS 8884) | Real-time | Subscribe status, publish commands |
| ESP32 → GAS | HTTPS POST | Every 1 hour | Send logs + status for AI analysis |
| GAS → Gemini | HTTPS POST | On-demand | Generate insights from logs |
| PWA → GAS | HTTPS GET | Every 5 min | Fetch cached AI insights |
| GitHub → Vercel | Git push | On commit | Auto-deploy PWA |

---

## Components Overview

### 1. ESP32 Firmware (`firmware_v4/`)
- 12 relay channels + 4 PIR sensors + DS3231 RTC
- WiFi STA mode (joins your WiFi via Config Portal)
- MQTT client (publishes status, subscribes commands)
- REST API server (port 80, for LAN access)
- Posts logs to GAS hourly for AI analysis
- Energy monitoring (Wh per relay)
- OTA firmware update (via MQTT URL download or REST upload)

### 2. PWA Dashboard (`Remote-Relay/` → Vercel)
- Next.js 16 + React 19 + TypeScript + Tailwind + shadcn/ui
- Hybrid REST/MQTT: auto-switches based on connection
- MQTT remote mode: control from anywhere via HiveMQ broker
- Fetches AI insights from GAS every 5 minutes
- Installable PWA (Android/iOS), dark mode, ID/EN i18n

### 3. Google Apps Script (`Code.gs`)
- Deployable as GAS Web App (free, no VPS needed)
- Receives logs from ESP32 via HTTP POST
- Calls Gemini API (`gemini-1.5-flash`) with structured prompt
- Caches insights for 1 hour (reduces API calls)
- PWA fetches insights via HTTP GET

### 4. HiveMQ Public Broker
- Free MQTT broker at `broker.hivemq.com`
- No signup, no auth (security via topic password)
- ESP32 connects via TCP port 1883
- PWA connects via WebSocket Secure (WSS) port 8884

---

## Quick Start

### Phase 1: Flash Firmware to ESP32

1. **Download** `firmware_v4_arduino.zip` and extract to `~/Documents/Arduino/firmware_v4/`
2. **Install libraries** in Arduino IDE (Sketch → Include Library → Manage Libraries):
   - `RTClib` by Adafruit (v2.1.4+)
   - `ArduinoJson` by Benoit Blanchon (v7.0.0+)
   - `PubSubClient` by Nick O'Leary (v2.8+)
3. **Open** `firmware_v4.ino` in Arduino IDE
4. **Set board:** ESP32 Dev Module, Partition: Default 4MB with spiffs
5. **Upload** via USB
6. **Open Serial Monitor** (115200 baud)
7. ESP32 starts AP `Timer12-Setup` — connect to it from phone/laptop
8. Open `http://192.168.4.1` in browser, enter your WiFi SSID + password
9. ESP32 reboots, joins your WiFi, connects to MQTT broker
10. **Serial Monitor shows:**
    ```
    MAC: A4CF12345678
    MQTT Password: K7M3P9XQ
    Device PIN: 123456
    ```
    **Save these** — needed for PWA login

### Phase 2: Deploy PWA to Vercel

1. Go to https://vercel.com/new
2. Import `desvandi/Remote-Relay` from GitHub
3. Vercel auto-detects Next.js — accept defaults
4. **No env vars needed for basic MQTT mode** — deploy as-is
5. After deploy, open your Vercel URL

### Phase 3: Connect PWA to ESP32

1. Open your PWA URL in browser
2. Scroll to **"Remote Mode (MQTT)"** card
3. Enter:
   - **Device ID (MAC):** `A4CF12345678` (from Serial Monitor)
   - **MQTT Password:** `K7M3P9XQ` (from Serial Monitor)
4. Click **Connect via MQTT**
5. Dashboard loads — control relays from anywhere!

### Phase 4 (Optional): Enable AI Insights via GAS

1. Open https://script.google.com → **New Project**
2. Delete default code, paste contents of `Code.gs` (from `download/` folder)
3. **Set Gemini API key:**
   - Project Settings → Script Properties
   - Add property: `GEMINI_API_KEY` = your key from https://aistudio.google.com/apikey
4. **Deploy as Web App:**
   - Deploy → New Deployment → Type: Web App
   - Execute as: **Me**
   - Who has access: **Anyone** (anonymous)
   - Click **Deploy**, authorize permissions
5. **Copy deployment URL** (e.g., `https://script.google.com/macros/s/AKfyc.../exec`)
6. **Set in two places:**

   **PWA (Vercel):**
   - Vercel Dashboard → Settings → Environment Variables
   - Key: `NEXT_PUBLIC_GAS_INSIGHTS_URL`
   - Value: `https://script.google.com/macros/s/AKfyc.../exec`
   - Redeploy

   **ESP32 Firmware:**
   - Edit `Config.h` line 84:
     ```cpp
     constexpr const char* GAS_INSIGHTS_URL = "https://script.google.com/macros/s/AKfyc.../exec";
     ```
   - Re-flash firmware to ESP32
   - ESP32 will now POST logs to GAS every hour

7. Open PWA → AI Insights tab → real Gemini recommendations appear!

---

## Where to Input Config URLs

### GAS Script URL — 2 places

| Where | Variable | How |
|-------|----------|-----|
| **PWA (Vercel)** | `NEXT_PUBLIC_GAS_INSIGHTS_URL` | Vercel Dashboard → Settings → Environment Variables → Add |
| **ESP32 (Firmware)** | `GAS_INSIGHTS_URL` in `Config.h` | Edit file before flashing, re-upload |

> **When:** After deploying Code.gs as a GAS Web App (Phase 4, step 5 above).

### ESP32 MAC Address + MQTT Password — 1 place

| Where | Variable | How |
|-------|----------|-----|
| **PWA (login page)** | Input fields in "Remote Mode (MQTT)" card | Type manually from Serial Monitor output |

> **When:** Every time you connect to a different ESP32 device.

### WiFi Credentials — 1 place

| Where | Variable | How |
|-------|----------|-----|
| **ESP32 (Config Portal)** | Web form at `http://192.168.4.1` | Connect to `Timer12-Setup` AP, enter in browser |

> **When:** First boot, or when WiFi credentials change (auto-reopens on 3 failed retries).

---

## MQTT Architecture

### Broker
- **Host:** `broker.hivemq.com`
- **ESP32 port:** 1883 (TCP)
- **PWA port:** 8884 (WebSocket Secure)
- **Auth:** None (public broker)
- **Security:** Topic includes random 8-char password per device

### Topic Structure
```
timer12/<MAC>/<PASSWORD>/status    ← ESP32 publishes SystemStatus JSON
timer12/<MAC>/<PASSWORD>/command   ← PWA publishes commands
timer12/<MAC>/<PASSWORD>/log       ← ESP32 publishes activity log
timer12/<MAC>/<PASSWORD>/online    ← LWT: "1" on connect, "0" on disconnect
timer12/<MAC>/<PASSWORD>/ota       ← PWA publishes OTA update commands
```

**Example:** `timer12/A4CF12345678/K7M3P9XQ/status`

### Command Format (PWA → ESP32)
```json
{"type":"relay","action":"toggle","channelId":1}
{"type":"relay","action":"set_mode","channelId":1,"mode":"auto"}
{"type":"schedule","action":"upsert","channelId":1,"onTime":"18:00","offTime":"06:00","dayMask":0,"enabled":true}
{"type":"schedule","action":"delete","id":11}
{"type":"pir","action":"config","id":1,"enabled":true,"holdTime":120}
{"type":"pir","action":"test","id":1}
{"type":"channel","action":"rename","channelId":1,"name":"Lampu Taman"}
{"type":"time","action":"set","datetime":"2026-08-06T15:30:00"}
{"type":"system","action":"reboot"}
{"type":"system","action":"getStatus"}
{"type":"system","action":"resetEnergyStats"}
```

### OTA via MQTT
PWA publishes to `ota` topic:
```json
{"action":"update","url":"https://github.com/.../firmware.bin","version":"4.1.0"}
```
ESP32 HTTP downloads binary, streams to flash, publishes progress, reboots on success.

---

## REST API (LAN Mode, Optional)

For LAN-only access (faster than MQTT, same WiFi required):

Set `NEXT_PUBLIC_API_BASE_URL=http://192.168.1.50` in Vercel env vars.

All responses: `{ "success": bool, "message": string, "data": T }`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/login` | JWT + CSRF cookies |
| GET | `/api/status` | Full SystemStatus |
| POST | `/api/relay` | Toggle/on/off/set_mode |
| POST | `/api/schedule` | Upsert schedule |
| POST | `/api/pir` | PIR config |
| POST | `/api/time` | Set RTC |
| GET | `/api/log` | Activity log |
| POST | `/api/channel` | Rename channel |
| POST | `/api/reboot` | Reboot ESP32 |
| POST | `/api/ota` | Upload firmware (LAN only) |
| POST | `/api/factory_reset/prepare` | Generate reset token |
| POST | `/api/factory_reset/confirm` | Execute factory reset |

---

## Features

| Feature | LAN (REST) | Remote (MQTT) |
|---------|:----------:|:--------------:|
| 12 Relay Control | ✅ | ✅ |
| Channel Rename | ✅ | ✅ |
| Weekly Scheduler (max 4/channel) | ✅ | ✅ |
| Schedule Conflict Validation | ✅ | ✅ |
| 4 PIR Config | ✅ | ✅ |
| Activity Log (real-time + CSV) | ✅ | ✅ |
| AI Insights (Gemini via GAS) | ✅ | ✅ |
| Energy Monitoring (Wh per relay) | ✅ | ✅ |
| Geofencing (enter/leave actions) | ✅ | ✅ |
| OTA Firmware Update | ✅ (upload) | ✅ (URL download) |
| WiFi Config Portal | ✅ | ✅ |
| MQTT Security (topic password) | — | ✅ |
| Change Password | ✅ | ❌ (use LAN) |
| Factory Reset | ✅ | ❌ (use LAN) |
| Config Export/Import | ✅ | ❌ (use LAN) |
| Dark Mode (light/dark/system) | ✅ | ✅ |
| Multi-language (ID/EN) | ✅ | ✅ |
| PWA Install (Android/iOS) | ✅ | ✅ |

---

## Hardware Setup

### Components
- ESP32-WROOM-32 Dev Module
- 12-channel relay module (active-LOW, 5V)
- 4× HC-SR501 PIR sensor
- DS3231 RTC module (+ CR1220 battery)
- 5V power supply (≥1A, shared GND with ESP32)

### Pin Mapping
| Component | GPIO | Notes |
|-----------|------|-------|
| Relay 1-12 | 13,14,16,17,18,19,21,22,23,25,26,27 | Active-LOW |
| PIR 1-4 | 34,35,36,39 | Input-only pins |
| DS3231 SDA | 32 | I2C 400kHz |
| DS3231 SCL | 33 | I2C 400kHz |

---

## Project Structure

```
Remote-Relay/                         ← PWA (this repo)
├── package.json
├── .env.example                      ← env var template
├── src/
│   ├── app/
│   │   ├── layout.tsx                ← Root: PWA metadata + 5 providers
│   │   ├── page.tsx                  ← Auth gate (login or dashboard)
│   │   └── api/                      ← Mock REST API (LAN mode fallback)
│   ├── components/
│   │   ├── providers/                ← Theme, Language, Query, Auth, MQTT
│   │   ├── layout/                   ← AppShell, Sidebar, Header
│   │   ├── auth/                     ← Login (REST + MQTT dual mode)
│   │   ├── dashboard/                ← 12 relay grid
│   │   ├── scheduler/                ← Weekly schedule editor
│   │   ├── pir/                      ← 4 PIR cards
│   │   ├── logs/                     ← Activity log table
│   │   ├── ai/                       ← AI Insights (GAS-powered)
│   │   ├── ota/                      ← Firmware management
│   │   └── settings/                 ← Timezone, password, backup, reset
│   ├── hooks/useApi.ts              ← Hybrid REST/MQTT React Query hooks
│   └── lib/
│       ├── types.ts                  ← API contract types
│       ├── api.ts                    ← REST API client
│       ├── mqtt.ts                   ← MQTT client (WSS to HiveMQ)
│       ├── aiInsights.ts             ← GAS insights fetcher
│       ├── geofence.ts               ← Geofencing utility
│       ├── scheduleConflict.ts       ← Schedule overlap validator
│       ├── mockStore.ts              ← In-memory simulator (demo mode)
│       ├── i18n.ts                   ← ID + EN translations
│       └── format.ts                 ← Time/uptime/RSSI formatters
└── public/
    ├── manifest.webmanifest
    └── icon-{192,512,512-maskable}.png

firmware_v4/                          ← ESP32 firmware (separate download)
├── firmware_v4.ino                   ← Main entry
├── Config.h                          ← ⚠️ Edit GAS_INSIGHTS_URL here
├── WifiManager.cpp                   ← WiFi Config Portal + STA mode
├── MqttClient.cpp                    ← MQTT publish/subscribe + OTA
├── Advisor.cpp                       ← GAS integration (POST logs hourly)
├── RelayEngine.cpp                   ← Priority: Manual > PIR > Schedule
├── ... (40+ files total)

download/
├── Code.gs                           ← Google Apps Script (deploy to GAS)
├── firmware_v4_arduino.zip           ← Firmware package
└── firmware-deployment-guide.pdf     ← Detailed setup guide
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| PWA Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI | Tailwind CSS 4 + shadcn/ui + Lucide |
| State | TanStack Query (server), Zustand (UI) |
| MQTT | mqtt.js v5 (PWA) + PubSubClient (ESP32) |
| Broker | HiveMQ public (broker.hivemq.com) |
| AI | Google Apps Script → Gemini API (gemini-1.5-flash) |
| Hosting | Vercel (PWA) + ESP32 (firmware) + GAS (AI) |
| Auth | JWT (HS256) + CSRF (REST mode) + Topic password (MQTT mode) |
| Theme | next-themes (dark default) |
| i18n | Custom context (ID + EN) |

---

## Troubleshooting

### PWA shows "MOCK API" badge
- **Cause:** No MQTT connection AND no `NEXT_PUBLIC_API_BASE_URL`
- **Fix:** Connect via MQTT (enter MAC + password in login page)

### MQTT won't connect
- Check ESP32 Serial Monitor — must show `MQTT: connected!`
- Verify MAC (12 hex chars) + MQTT password (8 chars) match Serial output
- HiveMQ can be slow — wait 10s for first connection
- Ensure ESP32 is in STA mode (joined WiFi, not Config Portal)

### ESP32 falls back to Config Portal
- WiFi credentials wrong → connect to `Timer12-Setup` AP, reconfigure at `http://192.168.4.1`
- WiFi out of range → move ESP32 closer to router

### AI Insights show mock cards
- **Cause:** `NEXT_PUBLIC_GAS_INSIGHTS_URL` not set in Vercel, OR `GAS_INSIGHTS_URL` empty in `Config.h`
- **Fix:** Deploy Code.gs to GAS, set URL in both Vercel env vars + Config.h, re-flash firmware

### OTA / Password / Factory Reset don't work
- These require LAN (REST) connection — MQTT can't do NVS writes
- Connect phone to same WiFi as ESP32, set `NEXT_PUBLIC_API_BASE_URL`, use REST mode

### Relay doesn't toggle
- Check wiring: GPIO → relay IN, shared GND, 5V PSU
- Check Serial Monitor: should show `Relay X ON via manual`
- Check relay module is active-LOW (most are)

---

## Security Notes

- **MQTT topic password:** 8-char random alphanumeric, generated per device, stored in NVS. Without it, attackers can't subscribe/publish even if they know your MAC.
- **Public broker:** HiveMQ public broker is unauthenticated. Topic password provides obscurity-level security. For production, consider self-hosted Mosquitto with auth.
- **GAS Web App:** Deployed as "Anyone (anonymous)" — anyone with the URL can fetch insights. The URL is unguessable (long random string). No sensitive data is exposed (only usage patterns + recommendations).
- **JWT (REST mode):** HS256 signed with device secret, 1-hour expiry. CSRF token required for all mutations.
- **No hardcoded WiFi/MQTT passwords:** All credentials generated at first boot, stored in NVS.

---

## License

Proprietary — built per the Timer Digital Relay v4.0 Cloud-Ready Architecture Engineering Brief.
