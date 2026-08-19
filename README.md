# Timer Digital Relay v4.3 — Remote Relay System (Industrial-Grade R2)

> **Status: 🟡 NOT PRODUCTION READY — HARDENING ROUND REQUIRED** (per ChatGPT audit)
>
> Next.js 16 PWA dashboard for controlling 12 relay channels + 4 PIR sensors + PZEM-004T power meter + 8S LiFePO4 battery monitoring (INA219/ADS1115/SHT31) via ESP32. **Formal command state model** — `COMMAND_PENDING → CONFIRMED_ON/OFF | TIMEOUT (UNKNOWN) | FAILED | DEVICE_OFFLINE | STATE_DRIFT`. Cloud-ready, MQTT remote access (works behind CGNAT/MiFi — no port forwarding needed), AI insights via Gemini. **Strongly-typed telemetry** (no `any`) with explicit null handling for invalid sensor readings (never silent 0). **Separate desired/reported/physical state semantics** (PWA never assumes "button pressed = relay ON").

[![PWA](https://img.shields.io/badge/PWA-installable-blue)](#)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](#)
[![Industrial Grade](https://img.shields.io/badge/grade-industrial-orange)](#industrial-grade-hardening-v43)
[![TypeScript Strict](https://img.shields.io/badge/TypeScript-strict-blue)](#)
[![Status](https://img.shields.io/badge/status-NOT%20PROD%20READY%20—%20HARDENING%20ROUND-yellow)](#production-readiness-status)
[![Security Audit](https://img.shields.io/badge/audit-round%2010K-brightgreen)](#)

Companion firmware repo: **[desvandi/Firmware-code-gs_relaytimer](https://github.com/desvandi/Firmware-code-gs_relaytimer)**

---

## 🟡 Production Readiness Status

Per ChatGPT targeted remediation audit (v4.2 → v4.3), the following P1 blockers were addressed in PWA types:

| P1 ID | Issue | PWA Implementation (v4.3) |
|---|---|---|
| P1-005 | Separate desired/reported/physical state semantics | ✅ New `ChannelState` type with `desiredState`, `reportedState`, `physicalState` (nullable — null when no aux feedback), `stateConfidence`, `stateTimestamp`, `stateSequence`, `fault` |
| P1-006 | COMMAND_TIMEOUT = UNKNOWN execution status | ✅ New `CommandExecutionState` union type with 8 explicit states: `COMMAND_PENDING`, `CONFIRMED_ON`, `CONFIRMED_OFF`, `TIMEOUT` (UNKNOWN execution — distinct from `FAILED`), `FAILED`, `DEVICE_OFFLINE`, `UNKNOWN`, `STATE_DRIFT` |
| P1-007 | Command semantics classification | ✅ New `CommandSemantics` union type: `IDEMPOTENT_STATE` (SET_STATE: ON/OFF — replay-safe) vs `NON_IDEMPOTENT_ACTION` (PULSE/TOGGLE/START_MOTOR — NOT replay-safe); PWA labels each command so firmware can reject non-idempotent through transaction path |
| P1-014 | Separate commandedState from physicalState | ✅ New `StateConfidence` union type: `SOFTWARE_ONLY` (GPIO commanded, no physical confirmation — current hardware limitation), `VERIFIED` (aux contact confirms — future HW), `UNKNOWN` (never commanded), `FAULT` (state drift or interlock violation) |

### Remaining PWA items (not blocking but recommended):

- Render `CommandExecutionState` in UI (currently the relay card shows simple ON/OFF — future enhancement to display TIMEOUT/UNKNOWN distinctly)
- Render `StateConfidence::SOFTWARE_ONLY` badge on relay cards (honest disclosure that current hardware has no aux contact feedback)
- Implement PWA-side command retry policy with backoff + jitter (currently only single attempt + TIMEOUT)
- Add Auth Gateway for short-lived MQTT credentials (architectural — P1-015 in firmware repo)

---

## ⚡ What's New in v4.3 (ChatGPT Targeted Remediation)

v4.3 PWA implements the 4 type-level P1 blockers identified by ChatGPT's source-code re-audit. Per the audit directive: "DO NOT ADD FEATURES RANDOMLY." This is targeted remediation, not feature addition.

### New Type Definitions (src/lib/types.ts)

```typescript
// P1-006: Command execution state model (8 explicit states)
export type CommandExecutionState =
  | 'COMMAND_PENDING'        // sent, waiting for ACK
  | 'CONFIRMED_ON'           // ACK received, channel is ON
  | 'CONFIRMED_OFF'          // ACK received, channel is OFF
  | 'TIMEOUT'                // no ACK within timeout — UNKNOWN execution
  | 'FAILED'                 // ACK received with success=false
  | 'DEVICE_OFFLINE'         // device not reachable
  | 'UNKNOWN'                // never commanded, or state indeterminate
  | 'STATE_DRIFT';           // desired != reported for sustained period

// P1-007: Command semantics (firmware rejects non-idempotent through transaction path)
export type CommandSemantics =
  | 'IDEMPOTENT_STATE'        // SET_STATE: ON, OFF, SET_MODE — replay-safe
  | 'NON_IDEMPOTENT_ACTION';  // PULSE, TOGGLE, START_MOTOR, etc. — NOT replay-safe

// P1-005, P1-014: Per-channel state architecture
export type StateConfidence =
  | 'SOFTWARE_ONLY'  // GPIO commanded, no physical confirmation
  | 'VERIFIED'       // Auxiliary contact confirms physical state (future HW)
  | 'UNKNOWN'        // Never commanded, or boot state indeterminate
  | 'FAULT';         // State drift detected or interlock violation

export type ChannelState = {
  desiredState: boolean;
  reportedState: boolean;
  physicalState: boolean | null;
  stateConfidence: StateConfidence;
  stateTimestamp: number;
  stateSequence: number;
  fault: boolean;
};
```

### Why TIMEOUT ≠ FAILED (P1-006)

Per ChatGPT audit: "Karena timeout berarti: 'kita tidak tahu apakah command telah dieksekusi'. Bukan: 'command pasti gagal'."

When PWA sends a relay command and doesn't receive an ACK within 5 seconds:
- **TIMEOUT** — the command may or may not have been executed. The device could have received it, executed the relay transition, but failed to publish the ACK (MQTT broker down, ESP32 crashed after GPIO write, etc.). UI must show TIMEOUT, NOT "OFF".
- **FAILED** — explicit reject. The device ACK'd with `success=false`. The command was definitely NOT executed.

PWA rendering these states distinctly prevents operator confusion: a TIMEOUT operator can manually verify the physical state before retrying, rather than assuming the previous command failed and re-issuing blindly.

### Why physicalState is nullable (P1-014)

Per ChatGPT audit: "Jangan menyebut software GPIO state sebagai physical confirmed state tanpa feedback hardware."

The current hardware has NO auxiliary contact feedback — only GPIO output. So:
- `reportedState` = what device ACK'd (software state — what GPIO was commanded)
- `physicalState` = what's actually energized at the relay contact

Without aux feedback, `physicalState` is `null` (UNKNOWN). PWA must never render `reportedState` as if it were `physicalState`. A future hardware revision with aux contact feedback would set `physicalState` to a real boolean and `stateConfidence` to `VERIFIED`.

### Command Semantics (P1-007)

Per ChatGPT audit: "logical idempotency ≠ physical side-effect idempotency"

PWA must label each command with `CommandSemantics`:
- `IDEMPOTENT_STATE` — ON, OFF, SET_MODE. Replaying these is safe (ON twice = still ON).
- `NON_IDEMPOTENT_ACTION` — PULSE, TOGGLE, START_MOTOR, TRIGGER_CONTACTOR, RESET. Replaying these is NOT safe (TOGGLE twice = no change, but contactor cycled twice = wear + possible fault).

Firmware `CommandArbiter::processCommand()` rejects `NON_IDEMPOTENT_ACTION` through the transactional path with `RELAY_INTERLOCK_VIOLATION` alarm. PWA must use these semantics only for non-transactional direct commands (e.g., commissioning mode test triggers).

---

## 🏭 Industrial-Grade Hardening (v4.3)

### PWA Authoritative State Model (audit brief §57, P1-006)

PWA NEVER assumes "button pressed = relay ON". The valid state flow is:

```
COMMAND_PENDING → (await device ACK) → CONFIRMED_ON / CONFIRMED_OFF
                                            ↘ TIMEOUT (UNKNOWN — device may have executed)
                                            ↘ FAILED (explicit reject — device did NOT execute)
                                            ↘ DEVICE_OFFLINE (no ACK possible)
                                            ↘ STATE_DRIFT (desired != reported for sustained period)
```

### Offline Behavior (audit brief §58)

When the device is offline:
- PWA shows the last known state with a "STALE" timestamp
- PWA does NOT claim real-time
- PWA queues only safe commands (manual relay toggles) — never schedules or factory reset commands
- Queued commands are sent on reconnect (with proper requestId + ACK waiting per audit brief §24-27)

### Compatibility Matrix (audit brief §66)

| PWA Version | Firmware Version | Protocol Version | Notes |
|---|---|---|---|
| v4.3.x | v4.3.x | 5 | Full feature set — command arbiter + interlock + health state machine |
| v4.3.x | v4.2.x | 4 | Battery + power flow + environment + health + alarms (no arbiter/interlock) |
| v4.3.x | v4.1.x | 3 | Battery + power flow + environment (no health/alarms) |
| v4.3.x | v4.0.x | 2 | Legacy — relay + PZEM only |
| v4.2.x | v4.3.x | 4 | v4.2 PWA ignores new v4.3 fields (ChannelState, CommandSemantics) |

See [COMPATIBILITY_MATRIX.md](../Firmware-code-gs_relaytimer/COMPATIBILITY_MATRIX.md) in the firmware repo for full details.

---

## 🔧 Existing v4.0/v4.1/v4.2 Documentation

The sections below are preserved from previous versions. They remain accurate for all existing features. The v4.3 additions are layered on top — no existing behavior has been removed.

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
