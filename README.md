# Timer Digital Relay v4.0 — Remote Relay Dashboard

Progressive Web App (PWA) dashboard for controlling an ESP32-based 12-channel relay + 4 PIR timer system from anywhere in the world. **Works behind CGNAT/MiFi** — no port forwarding, no public IP, no always-on host required.

## How It Works

```
Handphone (PWA on Vercel)           ESP32 (joins your WiFi/MiFi)
       │                                    │
       │ WSS (outbound)                     │ MQTT (outbound, port 1883)
       ▼                                    ▼
       └──────────► HiveMQ Broker ◄─────────┘
                    (broker.hivemq.com:8884)
                    FREE · No signup · No auth
```

**ESP32** joins your WiFi network (STA mode), connects outbound to a free public MQTT broker. **PWA** on Vercel connects to the same broker via WebSocket. They communicate in real-time — no port forwarding needed, works behind any NAT/CGNAT (IndiHome, MiFi, First Media, etc.).

## Quick Start

### Option A: Demo Mode (Mock API, no hardware)
```bash
bun install && bun run dev
```
Open http://localhost:3000, login with `admin` / `admin123`. All 9 features work with simulated data.

### Option B: Production (Real ESP32 via MQTT)
1. Flash firmware to ESP32 (see [Firmware Setup](#firmware-setup) below)
2. Deploy this PWA to Vercel (auto-detected as Next.js)
3. Open PWA → scroll to **"Remote Mode (MQTT)"** → enter ESP32 MAC address
4. Dashboard loads real-time data from your ESP32, accessible from anywhere

---

## Features

| Feature | LAN (REST) | Remote (MQTT) |
|---------|:----------:|:--------------:|
| 12 Relay Control (toggle, mode switch) | ✅ | ✅ |
| Channel Rename | ✅ | ✅ |
| Weekly Scheduler (max 4/channel, day-mask) | ✅ | ✅ |
| 4 PIR Config (hold time, test trigger) | ✅ | ✅ |
| Activity Log (real-time + filter + CSV export) | ✅ | ✅ |
| AI Insights (mock advisory cards) | ✅ | ✅ |
| OTA Firmware Upload | ✅ | ❌ (use LAN) |
| Change Password | ✅ | ❌ (use LAN) |
| Factory Reset | ✅ | ❌ (use LAN) |
| Config Export/Import | ✅ | ❌ (use LAN) |
| Device Name / Timezone change | ✅ | ❌ (use LAN) |
| Dark Mode (light/dark/system) | ✅ | ✅ |
| Multi-language (ID/EN) | ✅ | ✅ |
| PWA Install (Android/iOS) | ✅ | ✅ |

---

## Firmware Setup

### Hardware Required
- ESP32-WROOM-32 Dev Module
- 12-channel relay module (active-LOW, 5V)
- 4× HC-SR501 PIR sensor
- DS3231 RTC module (+ CR1220 battery)
- 5V power supply (≥1A, shared GND with ESP32)
- Breadboard/jumper wires

### Pin Mapping
| Component | GPIO | Notes |
|-----------|------|-------|
| Relay 1-12 | 13,14,16,17,18,19,21,22,23,25,26,27 | Active-LOW |
| PIR 1-4 | 34,35,36,39 | Input-only pins |
| DS3231 SDA | 32 | I2C 400kHz |
| DS3231 SCL | 33 | I2C 400kHz |

### Install Libraries (Arduino IDE)
Open **Sketch → Include Library → Manage Libraries...** and install:
1. **RTClib** by Adafruit (v2.1.4+)
2. **ArduinoJson** by Benoit Blanchon (v7.0.0+)
3. **PubSubClient** by Nick O'Leary (v2.8+)

### Configure WiFi Credentials
Edit `Config.h` in the firmware folder:
```cpp
constexpr const char* STA_SSID = "YOUR_WIFI_SSID";
constexpr const char* STA_PASSWORD = "YOUR_WIFI_PASSWORD";
```

### Flash Firmware
1. Download `firmware_v4_arduino.zip` (contact repo owner)
2. Extract to `~/Documents/Arduino/firmware_v4/`
3. Open `firmware_v4.ino` in Arduino IDE 2.x
4. Set board: **ESP32 Dev Module**, partition: **Default 4MB with spiffs**
5. Upload via USB
6. Open Serial Monitor (115200 baud) — note the **MAC address** (e.g., `A4CF12345678`)

ESP32 will:
- Try to join your WiFi (STA mode, 15s timeout)
- Fall back to AP mode (`Timer12CH`) if WiFi fails
- Connect to HiveMQ MQTT broker automatically
- Start REST API server on port 80 (for LAN access)

---

## Deploy PWA to Vercel

### Via Vercel Dashboard
1. Go to https://vercel.com/new
2. Import this GitHub repo
3. Vercel auto-detects Next.js 16 — accept defaults
4. **No environment variables needed for MQTT mode** (PWA connects to broker directly)
5. Deploy

### Optional: LAN Mode env var
If you want to use REST API (LAN only, faster than MQTT):
- Settings → Environment Variables → add:
  - `NEXT_PUBLIC_API_BASE_URL` = `http://192.168.1.50` (your ESP32 local IP)
- Redeploy

> **Note:** REST mode only works when your phone is on the same WiFi as the ESP32. For remote access, use MQTT mode (no env var needed).

### Mode Indicators in Dashboard
The header shows the active mode:
- `· mqtt` (green) — MQTT remote mode, connected to ESP32 via broker
- `· live` (blue) — REST LAN mode, connected to ESP32 directly
- `· mock` (amber) — Demo mode, using simulated data (no real hardware)

---

## Connect PWA to ESP32

### Remote Mode (MQTT) — Works from anywhere
1. Open your Vercel PWA URL
2. On login page, scroll to **"Remote Mode (MQTT)"** card
3. Enter ESP32 MAC address (12 hex chars, e.g., `A4CF12345678`)
   - Found in Serial Monitor: `MAC: A4CF12345678`
4. Click **Connect via MQTT**
5. Dashboard loads — you can now control relays from anywhere

### Local Mode (REST) — Faster, same WiFi only
1. Set `NEXT_PUBLIC_API_BASE_URL` env var in Vercel (ESP32 local IP)
2. Login with `admin` + WiFi AP password (from Serial Monitor)
3. Dashboard connects directly to ESP32 REST API

### Hybrid (Both modes)
- If MQTT is connected → uses MQTT (remote)
- If `NEXT_PUBLIC_API_BASE_URL` is set and MQTT is off → uses REST (LAN)
- If neither → uses Mock API (demo)

---

## MQTT Architecture

### Broker
- **Host:** `broker.hivemq.com`
- **Port:** 1883 (ESP32, plain TCP) / 8884 (PWA, WSS)
- **Auth:** None (public broker)
- **Free, no signup, no rate limit**

### Topics (per device, based on MAC)
```
timer12/<MAC>/status    ← ESP32 publishes SystemStatus JSON (every 5s + on-change)
timer12/<MAC>/command   ← PWA publishes command JSON, ESP32 executes
timer12/<MAC>/log       ← ESP32 publishes activity log entries (real-time push)
timer12/<MAC>/online    ← LWT: "1" on connect, "0" on disconnect
```

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
```

### Security Note
The public broker means anyone who knows your MAC address can subscribe to your topics. For personal use this is acceptable (MAC is hard to guess). For production, consider:
- Self-hosted broker with auth (Mosquitto on VPS)
- AES encryption on payloads
- Private broker (EMQX Cloud free tier)

---

## REST API Contract (LAN Mode)

All responses: `{ "success": bool, "message": string, "data": T }`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/login` | JWT + CSRF cookies |
| POST | `/api/logout` | Clear session |
| GET | `/api/session` | Check auth |
| GET | `/api/status` | Full SystemStatus |
| GET | `/api/version` | Firmware info |
| POST | `/api/relay` | Toggle/on/off/set_mode |
| POST | `/api/schedule` | Upsert schedule |
| DELETE | `/api/schedule?id=N` | Delete schedule |
| POST | `/api/pir` | PIR config |
| POST | `/api/pir/test` | Test trigger |
| POST | `/api/time` | Set RTC |
| GET | `/api/log` | Activity log (filterable) |
| POST | `/api/channel` | Rename channel |
| GET | `/api/config` | User + device info |
| POST | `/api/config/device` | Device name/timezone |
| POST | `/api/config/password` | Change password |
| GET | `/api/config/export` | Backup JSON |
| POST | `/api/config/import` | Restore backup |
| POST | `/api/reboot` | Reboot ESP32 |
| POST | `/api/ota` | Upload firmware |
| POST | `/api/ota/check` | Check for update |
| POST | `/api/factory_reset/prepare` | Generate reset token |
| POST | `/api/factory_reset/confirm` | Execute reset |

---

## PWA Installation

### Android (Chrome/Edge)
1. Open PWA URL → menu (⋮) → **Install app**
2. App appears in launcher with Timer12 icon

### iOS (Safari)
1. Open PWA URL → **Share** → **Add to Home Screen**
2. Launches in standalone mode (no Safari chrome)

---

## Project Structure

```
Remote-Relay/
├── package.json                ← Next.js 16 + React 19 + TypeScript 5
├── src/
│   ├── app/
│   │   ├── layout.tsx          ← Root: PWA metadata + 5 providers
│   │   ├── page.tsx            ← Auth gate (login or dashboard)
│   │   └── api/                ← Mock REST API (22 route handlers)
│   ├── components/
│   │   ├── providers/          ← Theme, Language, Query, Auth, MQTT
│   │   ├── layout/             ← AppShell, Sidebar, Header, Mobile nav
│   │   ├── auth/               ← Login (REST + MQTT dual mode)
│   │   ├── dashboard/          ← 12 relay grid
│   │   ├── scheduler/          ← Weekly schedule editor
│   │   ├── pir/                ← 4 PIR cards
│   │   ├── logs/               ← Activity log table
│   │   ├── ai/                 ← Mock Gemini insights
│   │   ├── ota/                ← Firmware management
│   │   └── settings/           ← Timezone, password, backup, reset
│   ├── hooks/useApi.ts         ← Hybrid REST/MQTT React Query hooks
│   └── lib/
│       ├── types.ts            ← v4.0 API contract types
│       ├── api.ts              ← REST API client
│       ├── mqtt.ts             ← MQTT client (WSS to HiveMQ)
│       ├── mockStore.ts        ← In-memory simulator (demo mode)
│       ├── i18n.ts             ← ID + EN translations
│       └── format.ts           ← Time/uptime/RSSI formatters
└── public/
    ├── manifest.webmanifest    ← PWA manifest
    └── icon-{192,512,512-maskable}.png
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| UI | Tailwind CSS 4 + shadcn/ui + Lucide |
| State | TanStack Query (server), Zustand (UI) |
| Auth | JWT (HS256) + CSRF (REST mode) |
| MQTT | mqtt.js v5 (PWA) + PubSubClient (ESP32) |
| Broker | HiveMQ public (broker.hivemq.com) |
| Theme | next-themes (dark default) |
| i18n | Custom context (ID + EN) |
| Hosting | Vercel (PWA) + ESP32 (firmware) |

---

## Troubleshooting

### PWA shows "MOCK API" badge
- **Cause:** No MQTT connection AND no `NEXT_PUBLIC_API_BASE_URL` env var
- **Fix:** Either (a) connect via MQTT in login page, or (b) set `NEXT_PUBLIC_API_BASE_URL` in Vercel

### MQTT won't connect
- Check ESP32 Serial Monitor — must show `MQTT: connected!`
- Verify MAC address is 12 hex chars (uppercase, no colons)
- HiveMQ broker is sometimes slow — wait 10s for first connection
- Check ESP32 is in STA mode (joined WiFi, not AP fallback)

### ESP32 falls back to AP mode
- WiFi credentials wrong → check `STA_SSID` / `STA_PASSWORD` in `Config.h`
- WiFi out of range → move ESP32 closer to router
- AP mode: SSID `Timer12CH`, password shown in Serial Monitor

### OTA / Password / Factory Reset don't work
- These features require LAN (REST) connection — MQTT can't do large binary uploads or NVS writes
- Connect phone to same WiFi as ESP32, set `NEXT_PUBLIC_API_BASE_URL`, use REST mode

### Relay doesn't toggle
- Check wiring: GPIO → relay IN, shared GND, 5V PSU
- Check Serial Monitor: should show `Relay X ON via manual`
- Check relay module is active-LOW (most are)

---

## License

Proprietary — built per the Timer Digital Relay v4.0 Cloud-Ready Architecture Engineering Brief.
