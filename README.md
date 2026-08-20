# Timer Digital Relay v4.3.8 — Remote Relay System

> Next.js 16 PWA dashboard for controlling 12 relay channels + 4 PIR sensors + PZEM-004T power meter + 8S LiFePO4 battery monitoring (INA219/ADS1115/SHT31) via ESP32. Cloud-ready, MQTT remote access (works behind CGNAT/MiFi), AI insights via Gemini. **Strongly-typed telemetry** (no `any`) with explicit null handling for invalid sensor readings (never silent 0). **Separate desired/reported/physical state semantics** — PWA never assumes "button pressed = relay ON".

[![PWA](https://img.shields.io/badge/PWA-installable-blue)](#)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](#)
[![Build](https://img.shields.io/badge/bun%20build-success-brightgreen)](#)

**Firmware repo:** [desvandi/Firmware-code-gs_relaytimer](https://github.com/desvandi/Firmware-code-gs_relaytimer)

---

## Status

✅ **SOFTWARE PRODUCTION-READY** — `bunx tsc --noEmit`, `bun run lint`, `bun run build` all exit 0.

---

## Quick Start

### Demo Mode (no ESP32 needed)

```bash
bun install
DEMO_MODE=true bun dev
```

Browse to `http://localhost:3000`. Default credentials: `admin` / `admin123`.

### Production

```bash
bun install
bun run build
```

Deploy to Vercel. Configure environment variables (see `.env.example`).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | REST mode | ESP32 Cloudflare Tunnel URL |
| `NEXT_PUBLIC_MQTT_BROKER_URL` | MQTT mode | `wss://broker.example.com:8884/mqtt` |
| `NEXT_PUBLIC_MQTT_USERNAME` | MQTT mode | Broker username (per-device ACL) |
| `NEXT_PUBLIC_MQTT_PASSWORD` | MQTT mode | Broker password |
| `NEXT_PUBLIC_GAS_INSIGHTS_URL` | Optional | GAS Web App URL for AI insights |
| `DEMO_MODE` | Dev only | `true` enables mock data |
| `JWT_SECRET` | Mock auth | 32-byte random string (dev/staging only) |

See `.env.example` for full reference.

---

## Architecture

```
USER → PWA (UI + State Model) → MQTT/REST → ESP32 → Relay GPIO
```

**PWA never assumes button-pressed = relay-ON.** The valid state flow:

```
COMMAND_PENDING → (await device ACK)
  ├→ CONFIRMED_ON / CONFIRMED_OFF (ACK received)
  ├→ TIMEOUT (UNKNOWN execution — device may or may not have executed)
  ├→ FAILED (explicit reject)
  ├→ DEVICE_OFFLINE (no ACK possible)
  └→ STATE_DRIFT (desired ≠ reported for sustained period)
```

After MQTT reconnect, PWA **reconciles** TIMEOUT commands by fetching current device state — no blind retry.

---

## Key Types

```typescript
// Command execution state model (8 states)
type CommandExecutionState = 'COMMAND_PENDING' | 'CONFIRMED_ON' | 'CONFIRMED_OFF'
  | 'TIMEOUT' | 'FAILED' | 'DEVICE_OFFLINE' | 'UNKNOWN' | 'STATE_DRIFT';

// Command semantics (firmware rejects non-idempotent through transaction path)
type CommandSemantics = 'IDEMPOTENT_STATE' | 'NON_IDEMPOTENT_ACTION';

// Per-channel state architecture
type ChannelState = {
  desiredState: boolean;           // what operator requested
  reportedState: boolean;          // what device ACK'd (software GPIO)
  physicalState: boolean | null;  // null = UNKNOWN (no aux contact feedback)
  stateConfidence: StateConfidence;
  stateSequence: number;
  stateTimestamp: number;
  fault: boolean;
};

// Safety lockout state (5 states, ACK ≠ CLEAR)
type SafetyLockoutState = 'NORMAL' | 'TRIPPED' | 'ACKNOWLEDGED' | 'CLEARED' | 'ARMED';

// State confidence (honest disclosure — SOFTWARE_ONLY ≠ VERIFIED)
type StateConfidence = 'SOFTWARE_ONLY' | 'VERIFIED' | 'UNKNOWN' | 'FAULT';
```

---

## Dashboard Sections

| Section | Component | Purpose |
|---|---|---|
| Relay Grid | `dashboard-view.tsx` | 12-channel relay control with mode/source/priority |
| PZEM Power | `dashboard-view.tsx` | AC voltage/current/power/energy/frequency/PF |
| Battery Summary | `battery/battery-summary.tsx` | Pack V/I/P/SOC + charged/discharged Ah + ambient T/H |
| DC Power Flow | `battery/power-flow-view.tsx` | MPPT/Battery/Inverter with signed-power direction |
| Cell Monitor | `battery/cell-monitor-view.tsx` | 8-cell voltage grid + min/max/delta + text status labels |
| Battery Health | `battery/battery-health-view.tsx` | Pack + per-cell resistance + quality |
| Environment | `battery/environment-view.tsx` | Ambient T/RH (clearly labeled as ambient) |
| Diagnostics | `battery/battery-diagnostics-view.tsx` | 15 fault flags + overall severity |
| Scheduler | `scheduler/scheduler-view.tsx` | Per-channel schedule management |
| PIR | `pir/pir-view.tsx` | PIR config + test trigger |
| OTA | `ota/` | Firmware update (Ed25519-signed) |
| Logs | `logs/logs-view.tsx` | Activity log with filtering |
| AI Insights | `ai/` | Gemini-powered advisory insights |

---

## Compatibility

| PWA | Firmware | Protocol | Notes |
|---|---|---|---|
| v4.3.x | v4.3.x | 5 | Full feature set |
| v4.3.x | v4.1.x | 3 | Battery + power flow (no health/alarms) |
| v4.3.x | v4.0.x | 2 | Legacy — relay + PZEM only |

See [COMPATIBILITY_MATRIX.md](../Firmware-code-gs_relaytimer/COMPATIBILITY_MATRIX.md) for full details.

---

## Modes of Operation

### REST Mode (LAN)

PWA polls `/api/status` every 3 seconds via Cloudflare Tunnel URL.

### MQTT Mode (Remote)

PWA connects to MQTT broker via WebSocket TLS (`wss://`). Receives status every 5 seconds. Commands sent with `requestId` + ACK transaction pattern. Reconciliation on reconnect.

### Demo Mode

No ESP32 needed. Mock store generates realistic 8S LiFePO4 telemetry (~26.4V pack, signed currents, cell delta for imbalance demo).

---

## Offline Behavior

When device is offline:
- PWA shows last known state with STALE timestamp
- PWA does NOT claim real-time
- PWA queues only safe commands (manual relay toggles)
- On reconnect: fetches current state, reconciles TIMEOUT → CONFIRMED or STATE_DRIFT
- No blind retry
