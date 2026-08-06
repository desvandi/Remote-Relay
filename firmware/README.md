# Timer Digital Relay v4.0 — Firmware (ESP32)

Modular ESP32 firmware for the 12-channel Relay + 4 PIR Timer system.
Cloud-ready architecture: PWA dashboard (separate repo) communicates via
JWT-secured REST API, optionally tunneled through Cloudflare.

> Refactor of v3.1.0 monolithic `firmware_v3.1.0_fixed.ino` (2744 lines) into
> a modular structure: **Core / Drivers / Services / Storage / Network / Web / Utils / AI**.

---

## Architecture

```
firmware_v4/
├── firmware_v4.ino              ← main entry (setup + loop)
├── platformio.ini
├── src/
│   ├── Core/                    ← Config.h, Types.h, Globals.h
│   │
│   ├── Drivers/                 ← Hardware abstraction
│   │   ├── RelayDriver          12-channel active-LOW relay (boot glitch fix)
│   │   ├── PirDriver            4× HC-SR501 (3-sample debounce, stuck detect)
│   │   └── RtcDriver            DS3231 over I2C (400 kHz Fast Mode)
│   │
│   ├── Storage/                 ← Persistence
│   │   ├── FileSystem           LittleFS wrapper (mount, atomic write)
│   │   └── ConfigStore          User config + Schedule + Device config (CRC + backup)
│   │
│   ├── Utils/                   ← Reusable helpers
│   │   ├── Crc                  CRC-32 (zlib polynomial)
│   │   ├── Crypto               SHA-256, PBKDF2, HMAC-SHA256, JWT (HS256), base64url
│   │   └── Json                 CRC attach, parseMinutes, password strength
│   │
│   ├── Network/
│   │   └── WifiManager          AP mode, password from MAC, client events
│   │
│   ├── Services/                ← Business logic
│   │   ├── LogService           Activity log (JSON-lines) + audit log (plain text)
│   │   ├── Scheduler            Schedule evaluation (overnight + dayMask)
│   │   ├── RelayEngine          Priority: Manual > PIR > Schedule > Off
│   │   ├── AuthManager          JWT, CSRF, rate limiter, factory-reset tokens
│   │   └── OtaManager           Update library + GitHub Release check (stub)
│   │
│   ├── Web/
│   │   ├── HttpServer           WebServer(80) + route registration + CORS
│   │   └── Handlers/            22 route handlers, each in its own header
│   │       ├── AuthHandlers     /api/login, /api/logout, /api/session
│   │       ├── StatusHandlers   /api/status, /api/version, /api/health
│   │       ├── RelayHandlers    /api/relay
│   │       ├── ScheduleHandlers /api/schedule (POST/DELETE)
│   │       ├── PirHandlers      /api/pir, /api/pir/test
│   │       ├── TimeHandlers     /api/time
│   │       ├── LogHandlers      /api/log, /api/audit_log
│   │       ├── ConfigHandlers   /api/config (GET/POST) + /device /password /export /import
│   │       ├── SystemHandlers   /api/reboot
│   │       ├── OtaHandlers      /api/ota, /api/ota/check
│   │       └── FactoryResetHandlers  /api/factory_reset/prepare + /confirm
│   │
│   └── AI/
│       └── Advisor              Stub for future GAS/Gemini pipeline (no-op today)
```

---

## v4.0 API Contract

All responses follow: `{ "success": bool, "message": string, "data": T }`.

| Method | Endpoint                          | Purpose                                  |
|--------|-----------------------------------|------------------------------------------|
| POST   | `/api/login`                      | JWT + CSRF token + cookies               |
| POST   | `/api/logout`                     | Clear session cookies                    |
| GET    | `/api/session`                    | Check current session                    |
| GET    | `/api/status`                     | Full SystemStatus (12 channels + PIRs)   |
| GET    | `/api/version`                    | FirmwareInfo + OTA status                |
| GET    | `/api/health`                     | Hardware diagnostics                     |
| POST   | `/api/relay`                      | Toggle / on / off / set_mode             |
| POST   | `/api/schedule`                   | Upsert schedule (per-channel, max 4)     |
| DELETE | `/api/schedule?id=N`              | Delete schedule                          |
| POST   | `/api/pir`                        | Update PIR config (enabled / holdTime)   |
| POST   | `/api/pir/test`                   | Manual test trigger                      |
| POST   | `/api/time`                       | Set RTC time                             |
| GET    | `/api/log?type=&channelId=&limit=`| Filterable activity log (JSON)           |
| GET    | `/api/audit_log`                  | Plain-text audit log                     |
| GET    | `/api/config`                     | User + device info                       |
| POST   | `/api/config`                     | Update username / password (legacy)      |
| POST   | `/api/config/device`              | Update device name / timezone            |
| POST   | `/api/config/password`            | Change password (verify current)         |
| GET    | `/api/config/export`              | Full backup JSON                         |
| POST   | `/api/config/import`              | Restore from backup JSON                 |
| POST   | `/api/reboot`                     | Reboot ESP32                             |
| POST   | `/api/ota`                        | Upload firmware binary                   |
| POST   | `/api/ota/check`                  | Check GitHub Release for newer firmware  |
| POST   | `/api/factory_reset/prepare`      | Generate one-time reset token (60s)      |
| POST   | `/api/factory_reset/confirm`      | Execute factory reset                    |

### Authentication

| v3.1 (old)                         | v4.0 (new)                                   |
|------------------------------------|----------------------------------------------|
| HTTP Basic Auth on every request   | `POST /api/login` returns JWT + CSRF cookies |
| CSRF token embedded in `/api/status` | CSRF token in separate `timer12_csrf` cookie |
| Password verified on every request | JWT signature verified (stateless)           |
| Rate limiter per IP                | Same (5 fails → 60s block; 10 → 5min block)  |

Cookies set on login:
- `timer12_jwt` (httpOnly, SameSite=Strict, 1h TTL) — bearer token
- `timer12_csrf` (readable by JS, 1h TTL) — must echo in `X-CSRF-Token` header for mutations

### CORS

The server sends `Access-Control-Allow-Origin: *` with credentials, allowing
the PWA (deployed on Vercel) to call the ESP32 directly through the Cloudflare
Tunnel. For stricter security in production, replace `*` with the specific
PWA origin.

---

## Build & Flash

### Prerequisites

- PlatformIO Core (`pip install platformio`) or PlatformIO IDE for VSCode
- ESP32 dev board (WROOM-32, 4 MB flash recommended)
- USB cable

### Build

```bash
cd firmware_v4
pio run                    # build firmware
pio run -t upload          # build + flash over USB
pio device monitor         # view serial output (115200 baud)
```

### Upload LittleFS image (optional — only if you want to pre-seed config)

```bash
pio run -t uploadfs
```

The firmware auto-creates `/config.json` and `/schedule.json` on first boot
if they don't exist, so this is not required.

---

## Default Credentials

On first boot (or after factory reset), the firmware generates a random
password derived from the ESP32's MAC address:

```
T<last-4-hex-of-MAC><mid-4-hex><low-4-hex>
```

The password is printed to **Serial** during boot — copy and store it
securely. The default username is `admin`.

To change credentials later: `POST /api/config/password` (requires current password).

---

## Hardware Pinout

| Component | GPIO | Notes                              |
|-----------|------|------------------------------------|
| Relay 1   | 13   | Active-LOW module                  |
| Relay 2   | 14   |                                    |
| Relay 3   | 16   |                                    |
| Relay 4   | 17   |                                    |
| Relay 5   | 18   |                                    |
| Relay 6   | 19   |                                    |
| Relay 7   | 21   |                                    |
| Relay 8   | 22   |                                    |
| Relay 9   | 23   | PIR 1 mapped here                  |
| Relay 10  | 25   | PIR 2 mapped here                  |
| Relay 11  | 26   | PIR 3 mapped here                  |
| Relay 12  | 27   | PIR 4 mapped here                  |
| PIR 1     | 34   | Input-only, no pull                |
| PIR 2     | 35   | Input-only, no pull                |
| PIR 3     | 36   | Input-only (SENSOR_VP)             |
| PIR 4     | 39   | Input-only (SENSOR_VN)             |
| I2C SDA   | 32   | DS3231                             |
| I2C SCL   | 33   | DS3231                             |

---

## Priority Logic (Relay Engine)

```
For each channel i (1..12):
  1. If channels[i].modeAuto == false:
       → Manual mode: relay = channels[i].manualState (source: 'manual' or 'off')
  2. Else if i has PIR (9..12) AND channels[i].pirEnabled:
       → If PIR stuck: ignore PIR, fall through to schedule
       → Else if PIR motion OR within hold-time window: relay = ON (source: 'pir')
       → Else if schedule active: relay = ON (source: 'schedule')
       → Else: OFF
  3. Else (no PIR or PIR disabled):
       → If schedule active: relay = ON (source: 'schedule')
       → Else: OFF
```

PIR can only force ON, never force OFF. PIR cannot override Manual mode.
Stuck PIR (HIGH > 30 min) is force-disabled for 5 min cooldown.

---

## Cloud-Ready Deployment

1. **ESP32 boots in AP mode** — connect to `Timer12CH` WiFi (password on serial)
2. **Configure via direct connection** at `http://192.168.4.1`
3. **For remote access**: set up Cloudflare Tunnel pointing to the ESP32's
   local IP (see PWA repo README for `cloudflared` setup)
4. **PWA dashboard** (deployed on Vercel) calls the ESP32 via the tunnel URL
   by setting `NEXT_PUBLIC_API_BASE_URL`

The firmware is **single source of truth** — it keeps working even if internet,
Cloudflare, Vercel, or Google are all down. The PWA is just a UI; all logic
(scheduler, PIR, RTC) lives in firmware and runs locally.

---

## Future Roadmap

- **v4.1**: Multi-user auth (admin + viewer roles), signed OTA from GitHub Release
- **v4.2**: WiFi STA fallback (connect to home router for internet + AP for direct)
- **v5.0**: Multi-device mesh (one dashboard manages many ESP32s)

---

## License

Proprietary — built per the Timer Digital Relay v4.0 Engineering Brief.
