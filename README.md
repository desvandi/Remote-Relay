# Timer Digital Relay v4.2 — Remote Relay System (Industrial-Grade)

> Next.js 16 PWA dashboard for controlling 12 relay channels + 4 PIR sensors + PZEM-004T power meter + 8S LiFePO4 battery monitoring (INA219/ADS1115/SHT31) via ESP32. Cloud-ready, MQTT remote access (works behind CGNAT/MiFi — no port forwarding needed), AI insights via Gemini. **Strongly-typed telemetry** (no `any`) with explicit null handling for invalid sensor readings (never silent 0).

[![PWA](https://img.shields.io/badge/PWA-installable-blue)](#)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](#)
[![Industrial Grade](https://img.shields.io/badge/grade-industrial-orange)](#industrial-grade-hardening-v42)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-strict-blue)](#)
[![Security Audit](https://img.shields.io/badge/audit-round%2010K-brightgreen)](#)

Companion firmware repo: **[desvandi/Firmware-code-gs_relaytimer](https://github.com/desvandi/Firmware-code-gs_relaytimer)**

---

## ⚡ What's New in v4.2 (Industrial-Grade Hardening)

v4.2 PWA mirrors the firmware v4.2 industrial-grade hardening:

### Type Safety (audit brief §34, §73)

- **Strict TypeScript types** for all new telemetry — no `any` shortcuts.
  Added types: `HealthSnapshot`, `Alarm`, `RtcStatus`, `SensorStatus`,
  `AlarmSeverity`. All new fields are optional (`?:`) so old firmware
  (v4.0/v4.1) still works with the v4.2 PWA.
- **Explicit null handling**: invalid sensor readings arrive as `null`,
  never as silent `0` (audit brief §20-21, §38). UI shows "N/A" or
  "UNAVAILABLE" placeholders instead of misleading "0 V" / "0 A".
- **Accessibility**: PWA components include text labels alongside color
  indicators (audit brief §37 — "Do not use red/green colors as the only
  indication"). Battery cell tiles show state strings like "OK",
  "I2C ERR", "TAP FAULT", "INVALID", "RANGE", "STALE".

### New Dashboard Sections

The dashboard now has the following sections (in addition to the existing
relay grid, PZEM power meter, scheduler, logs, OTA, settings):

1. **Battery Summary** — Pack voltage, battery current, battery power,
   SOC, charged/discharged Ah, ambient T/H
2. **DC Power Flow** — MPPT/Battery/Inverter with direction derived from
   signed power (NOT hard-coded — brief §36)
3. **Cell Monitor** — 8-cell voltage grid + min/max/delta with text
   status labels
4. **Battery Health** — Pack + per-cell resistance + measurement quality
5. **Environment** — Ambient T/RH clearly labeled as ambient
6. **Battery Diagnostics** — 15 fault flags + overall severity
   (NORMAL/WARNING/FAULT/UNAVAILABLE)

### v4.2 Telemetry Fields

```typescript
// From src/lib/types.ts
type SystemStatus = {
  // ... existing v4.0 fields (firmwareVersion, channels, pirs, schedules,
  //   stats, PZEM, alarms) ...
  battery?: BatteryStatus;      // v4.1
  powerFlow?: PowerFlow;         // v4.1
  environment?: EnvironmentStatus;  // v4.1
  dcEnergy?: EnergyCounters;     // v4.1 (separate from PZEM `energy`)
  health?: HealthSnapshot;       // v4.2 — §44
  systemAlarms?: Alarm[];        // v4.2 — §60 (distinct from PZEM `alarms`)
  telemetrySequence?: number;    // v4.2 — §22 monotonic counter
};
```

### Demo Mode

PWA continues to work in demo mode (no ESP32 hardware required). Mock store
generates realistic 8S LiFePO4 telemetry at ~26.4 V pack with signed
currents (charging during day, discharging at night).

---

## 🏭 Industrial-Grade Hardening (v4.2)

### PWA Authoritative State (audit brief §57)

PWA NEVER assumes "button pressed = relay ON". The valid state flow is:

```
COMMAND_PENDING → (await device ACK) → CONFIRMED_ON / CONFIRMED_OFF
                                            ↘ TIMEOUT / FAILED / DEVICE_OFFLINE
```

When a command is sent, the PWA shows a "PENDING" state. The actual
relay state is determined by the device's next status publication. If
the device doesn't confirm within the ACK timeout, the PWA shows
"TIMEOUT" (not "OFF" — operators must know the command may not have
executed).

### Offline Behavior (audit brief §58)

When the device is offline:

- PWA shows the last known state with a "STALE" timestamp
- PWA does NOT claim real-time
- PWA queues only safe commands (manual relay toggles) — never schedules
  or factory reset commands
- Queued commands are sent on reconnect (with proper requestId + ACK
  waiting per audit brief §24-27)

### Compatibility Matrix (audit brief §66)

| PWA Version | Firmware Version | Protocol Version | Notes |
|---|---|---|---|
| v4.2.x | v4.2.x | v4 | Full feature set — health, alarms, telemetry sequence |
| v4.2.x | v4.1.x | v3 | Battery + power flow + environment (no health/alarms) |
| v4.2.x | v4.0.x | v2 | Legacy — relay + PZEM only |
| v4.1.x | v4.2.x | v3 | Backward-compatible — v4.1 PWA ignores new v4.2 fields |

See [COMPATIBILITY_MATRIX.md](../Firmware-code-gs_relaytimer/COMPATIBILITY_MATRIX.md)
in the firmware repo for full details.

### Battery UI Components

All battery UI components live under `src/components/battery/`:

| Component | Brief § | Purpose |
|---|---|---|
| `battery-summary.tsx` | 35 | Pack V/I/P/SOC + charged/discharged Ah + ambient T/H |
| `cell-monitor-view.tsx` | 37 | 8-cell voltage grid + min/max/delta + text status labels |
| `power-flow-view.tsx` | 36 | MPPT/Battery/Inverter with signed-power-derived direction |
| `battery-health-view.tsx` | 38 | Pack + per-cell resistance + quality + "Not available" when invalid |
| `environment-view.tsx` | 39 | Ambient T/RH clearly labeled as ambient |
| `battery-diagnostics-view.tsx` | 30, 59 | 15 fault flags + overall severity |

---

## 🔧 Existing v4.0/v4.1 Documentation

The sections below are preserved from v4.0/v4.1. They remain accurate for
all existing features. The v4.2 additions are layered on top — no existing
behavior has been removed.

---

## Table of Contents

1. [Quick Start (Demo Mode)](#quick-start-demo-mode)
2. [Production Deployment (Vercel)](#production-deployment-vercel)
   - [Step 1: Fork + Import to Vercel](#step-1-fork--import-to-vercel)
   - [Step 2: Configure Environment Variables](#step-2-configure-environment-variables)
   - [Step 3: Deploy](#step-3-deploy)
   - [Step 4: PWA Installation](#step-4-pwa-installation)
3. [MQTT Configuration](#mqtt-configuration)
   - [Development (HiveMQ Public)](#development-hivemq-public)
   - [Production (Self-hosted Mosquitto)](#production-self-hosted-mosquitto)
4. [Modes of Operation](#modes-of-operation)
5. [Environment Variables Reference](#environment-variables-reference)
6. [Connecting PWA to ESP32](#connecting-pwa-to-esp32)
7. [Architecture](#architecture)
8. [Security Architecture](#security-architecture)
9. [Features Matrix](#features-matrix)
10. [Tech Stack](#tech-stack)
11. [Troubleshooting](#troubleshooting)

---

## Quick Start (Demo Mode)

For local development without real ESP32 hardware:

```bash
# Clone
git clone https://github.com/desvandi/Remote-Relay.git
cd Remote-Relay

# Install dependencies
bun install

# Start dev server
bun run dev
```

Open `http://localhost:3000`. Login with `admin` / `admin123` (demo mode).

Demo mode uses in-memory mock data — no ESP32 required. All 12 relay channels, scheduler, PIR, logs, energy analytics, and AI insights work with simulated data.

---

## Production Deployment (Vercel)

### Step 1: Fork + Import to Vercel

1. Fork this repo to your GitHub account
2. Go to [vercel.com](https://vercel.com) → **New Project**
3. Import your forked repo
4. Vercel auto-detects Next.js 16 — no configuration needed

### Step 2: Configure Environment Variables

In Vercel → **Settings → Environment Variables**, add:

#### Required for MQTT Remote Mode (recommended for production)

| Variable | Value | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_MQTT_BROKER_URL` | `wss://mqtt.yourdomain.com:8884/mqtt` | MQTT broker WSS URL |
| `NEXT_PUBLIC_MQTT_USERNAME` | `pwa-user` or `device-A4CF12345678` | Broker username |
| `NEXT_PUBLIC_MQTT_PASSWORD` | `your-broker-password` | Broker password |

#### Optional (AI Insights via Google Apps Script)

| Variable | Value | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_GAS_INSIGHTS_URL` | `https://script.google.com/macros/s/AKfyc.../exec` | GAS Web App URL for AI insights |

#### Optional (LAN/REST mode — alternative to MQTT)

| Variable | Value | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_DEMO_MODE` | `true` | Enable demo LAN login (admin/admin123) |
| `NEXT_PUBLIC_API_BASE_URL` | `https://your-esp32-tunnel.example.com` | Cloudflare Tunnel URL to ESP32 |

#### JWT Secret (for LAN/REST mode only)

| Variable | Value | Purpose |
|----------|-------|---------|
| `JWT_SECRET` | Random 32+ char string | JWT signing secret for mock/REST auth |
| `MOCK_USER` | `admin` | Mock API username |
| `MOCK_PASSWORD` | `admin123` | Mock API password |

### Step 3: Deploy

1. Click **Deploy** in Vercel
2. Wait for build to complete (~2 minutes)
3. Your PWA is live at `https://your-project.vercel.app`

### Step 4: PWA Installation

**Android (Chrome):**
1. Open PWA URL in Chrome
2. Menu (⋮) → **Install app**
3. App appears on home screen

**iOS (Safari):**
1. Open PWA URL in Safari
2. Share button → **Add to Home Screen**
3. App appears on home screen

**Desktop (Chrome/Edge):**
1. Open PWA URL
2. Click install icon (⊕) in address bar
3. App opens in standalone window

---

## MQTT Configuration

### Development (HiveMQ Public)

For testing without deploying your own broker:

- **Broker**: `broker.hivemq.com` (free, public, no auth)
- **WSS URL**: `wss://broker.hivemq.com:8884/mqtt`
- **No username/password needed**

Set in `.env.local`:
```bash
NEXT_PUBLIC_MQTT_BROKER_URL=wss://broker.hivemq.com:8884/mqtt
```

**⚠️ HiveMQ public broker is NOT secure for 220V relay control.** Anyone who knows your MAC + MQTT password can publish commands. Use for development only.

### Production (Self-hosted Mosquitto)

For 220V relay control, deploy your own Mosquitto broker with TLS + ACL + per-device credentials.

See the [firmware repo deployment guide](https://github.com/desvandi/Firmware-code-gs_relaytimer#step-2-deploy-mosquitto-mqtt-broker) for complete Mosquitto setup instructions.

Set in Vercel env vars:
```bash
NEXT_PUBLIC_MQTT_BROKER_URL=wss://mqtt.yourdomain.com:8884/mqtt
NEXT_PUBLIC_MQTT_USERNAME=pwa-user
NEXT_PUBLIC_MQTT_PASSWORD=your-strong-password
```

**Mosquitto ACL for PWA:**
```
# PWA user can subscribe to any device's topics (read status + ack + log)
# and publish to any device's command topic
user pwa-user
topic readwrite timer12/#
```

For stricter security, create separate PWA users per device with read-only access to status/log/ack and write access only to command.

---

## Modes of Operation

| Mode | Condition | Badge | Use Case |
|------|-----------|-------|----------|
| **MQTT Remote** | MAC + password entered in login | `· mqtt` (green) | Production — works from anywhere |
| **LAN REST** | `NEXT_PUBLIC_API_BASE_URL` set | `· live` (blue) | Same-WiFi access via Cloudflare Tunnel |
| **Demo Mock** | `NEXT_PUBLIC_DEMO_MODE=true` | `· mock` (amber) | Development without ESP32 |

### MQTT Remote Mode (Recommended)

- Works behind CGNAT/MiFi (outbound MQTT connection)
- No port forwarding needed
- All features available (relay, schedule, PIR, logs, energy, AI, OTA)
- TLS + broker auth + ACL for security
- ACK transaction with 5s timeout + retry queue
- NVS-persisted transaction journal (survives ESP32 reboot)

### LAN REST Mode

- Calls ESP32 REST API directly via Cloudflare Tunnel
- Faster than MQTT (no broker round-trip)
- Same WiFi required (or Cloudflare Tunnel for remote)
- JWT (15min) + refresh token (7day) + CSRF for auth

---

## Environment Variables Reference

### Production (MQTT Remote Mode)

```bash
# MQTT Broker (REQUIRED for MQTT mode)
NEXT_PUBLIC_MQTT_BROKER_URL=wss://mqtt.yourdomain.com:8884/mqtt
NEXT_PUBLIC_MQTT_USERNAME=pwa-user
NEXT_PUBLIC_MQTT_PASSWORD=your-strong-password

# AI Insights (OPTIONAL)
NEXT_PUBLIC_GAS_INSIGHTS_URL=https://script.google.com/macros/s/AKfyc.../exec
```

### Development (Demo Mode)

```bash
# Enable demo mock API with admin/admin123
NEXT_PUBLIC_DEMO_MODE=true

# Or use HiveMQ public broker for MQTT testing
NEXT_PUBLIC_MQTT_BROKER_URL=wss://broker.hivemq.com:8884/mqtt
```

### LAN REST Mode

```bash
# Point to ESP32 via Cloudflare Tunnel
NEXT_PUBLIC_API_BASE_URL=https://your-esp32-tunnel.example.com

# JWT secret for mock auth (if using mock API routes)
JWT_SECRET=your-random-32-char-secret
MOCK_USER=admin
MOCK_PASSWORD=admin123
```

### Complete Variable List

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NEXT_PUBLIC_MQTT_BROKER_URL` | No | `wss://broker.hivemq.com:8884/mqtt` | MQTT broker WSS URL |
| `NEXT_PUBLIC_MQTT_USERNAME` | No | empty | Broker username (production) |
| `NEXT_PUBLIC_MQTT_PASSWORD` | No | empty | Broker password (production) |
| `NEXT_PUBLIC_GAS_INSIGHTS_URL` | No | empty | GAS Web App URL for AI insights |
| `NEXT_PUBLIC_API_BASE_URL` | No | empty | ESP32 REST URL (LAN mode) |
| `NEXT_PUBLIC_DEMO_MODE` | No | `false` | Enable demo mock API |
| `JWT_SECRET` | No | empty | JWT signing secret (mock/REST auth) |
| `MOCK_USER` | No | empty | Mock API username |
| `MOCK_PASSWORD` | No | empty | Mock API password |

---

## Connecting PWA to ESP32

### MQTT Mode (Production)

1. Flash firmware to ESP32 with production config (see [firmware deployment guide](https://github.com/desvandi/Firmware-code-gs_relaytimer#production-deployment-guide))
2. Open Serial Monitor, copy:
   - **MAC Address** (12 hex chars, e.g., `A4CF12345678`)
   - **MQTT Password** (8 chars, e.g., `K7M3P9XQ`)
3. Open PWA (Vercel URL)
4. Scroll to **"Remote Mode (MQTT)"** card
5. Enter Device ID (MAC) + MQTT Password
6. Click **Connect via MQTT**
7. Dashboard loads — control relays from anywhere

### LAN REST Mode

1. Set up Cloudflare Tunnel pointing to ESP32's local IP
2. Set `NEXT_PUBLIC_API_BASE_URL` in Vercel env vars
3. Open PWA → **"Local / LAN mode"** card
4. Login with ESP32 credentials (username: `admin`, password from Serial)

---

## Architecture

```
                    ┌──────────────────────────────────────────┐
                    │           GitHub (source code)            │
                    │  • Remote-Relay/ (this PWA)               │
                    │  • Firmware-code-gs_relaytimer/ (ESP32)   │
                    └──────────┬───────────────────────────────┘
                               │ git push → Vercel auto-deploy
                               ▼
                    ┌─────────────────────┐
                    │   Vercel (PWA)      │
                    │                     │
                    │  Env vars:          │
                    │  • NEXT_PUBLIC_     │
                    │    MQTT_BROKER_URL  │
                    │  • NEXT_PUBLIC_     │
                    │    GAS_INSIGHTS_URL │
                    └────────┬────────────┘
                             │
              ┌──────────────┼──────────────────────────┐
              │              │                          │
              │ WSS          │ GET insights             │ HTTP POST logs
              │ (MQTT)       │ (every 5 min)            │ (every 1 hour)
              ▼              ▼                          ▼
        ┌──────────┐  ┌─────────────────┐    ┌──────────────────┐
        │ Mosquitto│  │ Google Apps     │    │   ESP32          │
        │ Broker   │  │ Script Web App  │    │                  │
        │ (TLS)    │  │                 │    │  Config.h:       │
        │          │  │ → Gemini API    │    │  GAS_INSIGHTS_URL│
        └────┬─────┘  │ → HMAC verify   │    │                  │
             │        │ → cache 1 hour  │    └────────┬─────────┘
             │ MQTT            │                 │           │
             │ (real-time)     │                 │ MQTT      │ REST
             │                 │                 │ (commands)│ (LAN)
             ▼                 ▼                 ▼           ▼
        ┌──────────────────────────────────────────────────────┐
        │              Handphone (PWA browser)                  │
        │                                                      │
        │  1. Real-time relay control via MQTT (instant)        │
        │  2. AI Insights fetched from GAS every 5 min          │
        │  3. ESP32 posts logs to GAS every 1 hour              │
        │  4. Energy analytics with charts (24h rolling)        │
        │  5. PZEM power monitoring (V/A/W/kWh/Hz/PF)           │
        │  6. RTC time display from DS3231                      │
        └──────────────────────────────────────────────────────┘
```

---

## Security Architecture

### MQTT Transaction Layer (Rounds 9–10K)

- **Typed ACK discriminated union**: `MqttAck` is a TypeScript discriminated union with per-commandType data shape (relay, schedule, pir, channel, generic). ACKs with wrong data for their commandType are REJECTED.
- **Private publisher**: `mqttPublisher.ts` was DELETED. Publisher logic inlined into `mqttTransaction.ts` as private function. Only `sendCommandWithAck()` + `setPublisherClient()` are exported. No raw publish function accessible.
- **ACK validation**: `validateAckForCommand()` dispatches per `pending.commandType`. Missing required fields → reject.
- **commandType tracking**: `PendingCommand` includes `commandType` for per-type ACK validation.

### Auth (PWA-side)

- **JWT cookie**: `timer12_jwt` (httpOnly, 15min TTL, SameSite=Strict)
- **Refresh token cookie**: `timer12_refresh` (httpOnly, 7day TTL)
- **CSRF cookie**: `timer12_csrf` (readable by JS, echoed in `X-CSRF-Token` header)
- **Auto-detection**: If MQTT connected → auto-authenticate (skip REST login)
- **Graceful degradation**: If mock API disabled in production → LAN login hidden, MQTT card shown

### MQTT Security

- **No password in topic**: Topic is `timer12/<deviceId>/command` (not `<deviceId>/<password>/command`)
- **Broker auth**: Username/password in MQTT CONNECT (via env vars)
- **WSS (WebSocket Secure)**: Port 8884 for browser connections
- **TLS**: End-to-end encryption between PWA ↔ broker ↔ ESP32

#### ⚠️ `NEXT_PUBLIC_MQTT_PASSWORD` is NOT a secret (audit-fixes P0-3)

The `NEXT_PUBLIC_*` prefix means these env vars are **inlined into the client bundle at build time**. Any web visitor can extract them from the browser's JavaScript:

```bash
# Anyone can extract the "secret" broker password from the deployed PWA:
curl https://your-pwa.vercel.app/_next/static/chunks/main-*.js | grep -o 'MQTT_PASSWORD[^"]*"[^"]*"'
```

This is **by design** (the browser needs the credential to connect to the broker), but it means the broker credential is **not a secret in the traditional sense**. Mitigations, in order of preference:

1. **Per-device broker ACL (MANDATORY for production).** Create one broker user per device: `pwa-<MAC>`. Scope each user's ACL to exactly that device's topics (`timer12/<MAC>/command` write + `timer12/<MAC>/{status,log,ack,online}` read). A leaked credential then only compromises ONE device, not the whole fleet. See the [firmware README's ACL section](https://github.com/desvandi/Firmware-code-gs_relaytimer#2f-configure-acl-per-device-topic-restrictions---mandatory-for-production) for the exact pattern.

2. **Short-lived broker credentials via auth gateway (recommended for >10 devices).** Deploy a small backend that authenticates the user (e.g., with the device MAC + MQTT password entered at login) and issues a short-lived (e.g., 1-hour) broker credential scoped to that device. The PWA then connects with the short-lived credential instead of a static `NEXT_PUBLIC_MQTT_PASSWORD`. This is not implemented in the current PWA — it's a recommended architecture evolution.

3. **Accept the risk for single-device deployments.** If you have exactly ONE device and trust everyone who can load the PWA, you can use a single `pwa-user` credential. This is the default behavior of this repo. **Not acceptable for 220V relay control in shared or public deployments.**

The default `NEXT_PUBLIC_MQTT_BROKER_URL = wss://broker.hivemq.com:8884/mqtt` (HiveMQ public broker) is for development only. Anyone who knows your device MAC can publish commands to it. **Never use HiveMQ public for 220V relay control.**

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
| OTA Firmware Update | ✅ (upload) | ✅ (signed, MQTT) |
| WiFi Config Portal | ✅ | ✅ |
| Change Password | ✅ | ❌ (use LAN) |
| Factory Reset | ✅ | ❌ (use LAN) |
| Config Export/Import | ✅ | ❌ (use LAN) |
| Dark Mode | ✅ | ✅ |
| Multi-language (ID/EN) | ✅ | ✅ |
| PWA Install (Android/iOS) | ✅ | ✅ |

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
| AI | Google Apps Script → Gemini API (gemini-1.5-flash) |
| Hosting | Vercel (PWA) + ESP32 (firmware) + GAS (AI) |
| Auth | JWT (HS256, 15min) + Refresh (7day) + CSRF (REST) |
| Power Meter | PZEM-004T v3.0 (Modbus-RTU over UART) |
| RTC | DS3231SN (I2C, CR1220 backup) |

---

## Project Structure

```
Remote-Relay/
├── package.json
├── .env.example
├── src/
│   ├── app/                          ← Next.js App Router
│   │   ├── api/                      ← Mock API routes (dev/demo only)
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
│   │   ├── settings/                 ← Timezone, password, backup, reset
│   │   └── ui/                       ← shadcn/ui components
│   ├── hooks/useApi.ts              ← Hybrid REST/MQTT React Query hooks
│   └── lib/
│       ├── types.ts                  ← API contract types
│       ├── api.ts                    ← REST API client
│       ├── apiResponse.ts            ← Server-side JSON envelope helpers
│       ├── mqtt.ts                   ← MQTT client (WSS connection)
│       ├── mqttTransaction.ts        ← ACK transaction layer (typed, private publisher)
│       ├── mqttPending.ts            ← Pending commands + typed ACK discriminated union
│       ├── aiInsights.ts             ← GAS insights fetcher
│       ├── geofence.ts               ← Geofencing utility
│       ├── scheduleConflict.ts       ← Schedule overlap validator
│       ├── energyHistory.ts          ← 24h rolling energy storage (localStorage)
│       ├── mockStore.ts              ← In-memory simulator (dev/demo only)
│       ├── auth.ts                   ← getSession / requireAuth (graceful no-op)
│       ├── jwt.ts                    ← HS256 sign/verify (server-side)
│       ├── i18n.ts                   ← ID + EN translations
│       └── format.ts                 ← Time/uptime/RSSI formatters
└── public/
    ├── manifest.webmanifest
    └── icon-{192,512,512-maskable}.png
```

---

## Troubleshooting

### PWA shows "Local / LAN mode disabled"

This is expected when `NEXT_PUBLIC_API_BASE_URL` and `NEXT_PUBLIC_DEMO_MODE` are not set. Use the **Remote Mode (MQTT)** card instead.

To enable LAN mode: set `NEXT_PUBLIC_API_BASE_URL` to your ESP32's Cloudflare Tunnel URL.

### MQTT won't connect

- Check `NEXT_PUBLIC_MQTT_BROKER_URL` is set (must be `wss://` for TLS)
- Check broker username/password in env vars
- Check Mosquitto is running and port 8884 is open
- Wait 10s for first connection (broker can be slow to accept WSS)

### "Invalid JSON response (status 500)"

This happens when mock API routes are called in production without `JWT_SECRET` or `DEMO_MODE`. Either:
- Set `NEXT_PUBLIC_DEMO_MODE=true` for demo mode, OR
- Set `JWT_SECRET` + `MOCK_USER` + `MOCK_PASSWORD` for REST auth, OR
- Use MQTT mode (LAN login is hidden automatically)

### AI Insights show mock cards

- `NEXT_PUBLIC_GAS_INSIGHTS_URL` not set in Vercel
- ESP32 not sending logs to GAS (check `GAS_INSIGHTS_URL` in firmware Config.h)
- GAS HMAC secret not registered (check GAS Script Properties)

### OTA doesn't work in MQTT mode

OTA via MQTT requires Ed25519 signature. See [firmware OTA guide](https://github.com/desvandi/Firmware-code-gs_relaytimer#ota-firmware-update-signed).

---

## Companion Repositories

- **Firmware + Code.gs**: [desvandi/Firmware-code-gs_relaytimer](https://github.com/desvandi/Firmware-code-gs_relaytimer) — ESP32 firmware + Google Apps Script
- **PWA Dashboard**: This repo

---

## License

Proprietary — built per the Timer Digital Relay v4.0 Cloud-Ready Architecture Engineering Brief.
