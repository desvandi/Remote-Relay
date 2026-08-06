# Remote-Relay — Timer Digital Relay v4.0 (Cloud-Ready Architecture)

ESP32-based 12-channel relay + 4 PIR timer system with PWA dashboard.
**Cloud-ready, locally autonomous, JWT-secured, installable on Android & iOS.**

```
                    ┌─────────────────────────────┐
                    │   Installable PWA           │
                    │   (Vercel hosting)          │
                    └────────────┬────────────────┘
                                 │ HTTPS + JWT
                                 ▼
                    ┌─────────────────────────────┐
                    │   Cloudflare Tunnel         │
                    │   (gateway, no port fwd)    │
                    └────────────┬────────────────┘
                                 │
───── Internet ──────────────────┼─────────────────────────────────
                                 │ Local Network
                                 ▼
                    ┌─────────────────────────────┐
                    │   ESP32 Backend             │
                    │   (this repo, firmware/)    │
                    │   - REST API v4.0           │
                    │   - Scheduler Engine        │
                    │   - Relay + PIR Engine      │
                    │   - RTC DS3231              │
                    │   - JWT Auth + CSRF         │
                    │   - OTA Update              │
                    └────────────┬────────────────┘
                                 │
                                 ▼
                    LittleFS / Preferences / NVS
```

## Repository Structure

```
Remote-Relay/
├── README.md                  ← this file
├── firmware/                  ← ESP32 firmware v4.0 (PlatformIO + Arduino)
│   ├── firmware_v4.ino        ← main entry (setup + loop)
│   ├── platformio.ini         ← build configuration
│   ├── src/
│   │   ├── Core/              ← Config, Types, Globals
│   │   ├── Drivers/           ← Relay, PIR, RTC DS3231
│   │   ├── Storage/           ← LittleFS, atomic config + CRC
│   │   ├── Utils/             ← CRC, Crypto (SHA-256/PBKDF2/JWT), JSON
│   │   ├── Network/           ← WiFi AP manager
│   │   ├── Services/          ← Scheduler, RelayEngine, Auth, OTA, Log
│   │   ├── Web/               ← HTTP server + 22 v4.0 route handlers
│   │   └── AI/                ← Stub for future GAS/Gemini pipeline
│   ├── README.md              ← firmware build & flash instructions
│   └── CONTRACT_VERIFICATION.md  ← cross-check firmware vs PWA contract
│
└── dashboard/                 ← PWA frontend (Next.js 16 + TypeScript)
    ├── package.json           ← dependencies (Next.js 16, React 19, shadcn/ui)
    ├── src/
    │   ├── app/               ← App Router (layout, page, api/* route handlers)
    │   ├── components/        ← UI components (login, dashboard, scheduler, etc.)
    │   ├── hooks/             ← React Query hooks (useApi.ts)
    │   └── lib/               ← types, api client, mock store, i18n, etc.
    ├── public/                ← manifest.webmanifest, PWA icons
    └── README.md              ← deployment guide (Vercel + Cloudflare Tunnel)
```

## Quick Start

### Option A — PWA Dashboard Only (Demo Mode)

The PWA ships with a **mock API server** that simulates the ESP32 firmware,
so you can demo every feature without hardware.

```bash
cd dashboard
bun install                    # or: npm install
bun run dev                    # starts Next.js on http://localhost:3000
```

Open the preview, login with `admin` / `admin123`.

### Option B — Full Stack (Firmware + PWA + Cloudflare Tunnel)

1. **Flash firmware** to ESP32:
   ```bash
   cd firmware
   pio run -t upload           # requires PlatformIO + USB cable
   pio device monitor          # note the WiFi AP password from serial output
   ```

2. **Connect to ESP32 AP** (`Timer12CH`) and configure at `http://192.168.4.1`.

3. **Set up Cloudflare Tunnel** routing `timer.your-domain.com` → `http://<ESP32-IP>:80`.

4. **Deploy PWA to Vercel**:
   ```bash
   cd dashboard
   vercel --prod
   # set env var: NEXT_PUBLIC_API_BASE_URL=https://timer.your-domain.com
   ```

5. **Install PWA** on your phone (Chrome/Safari → Add to Home Screen).

## v4.0 API Contract

All 25 endpoints follow `{ success: bool, message: string, data: T }`:

| Auth            | Status            | Control              | Config                | System         |
|-----------------|-------------------|----------------------|-----------------------|----------------|
| POST /login     | GET /status       | POST /relay          | GET /config           | POST /reboot   |
| POST /logout    | GET /version      | POST /schedule       | POST /config          | POST /ota      |
| GET /session    | GET /health       | DELETE /schedule     | POST /config/device   | POST /ota/check|
|                 |                   | POST /pir            | POST /config/password | POST /factory_reset/prepare |
|                 |                   | POST /pir/test       | GET /config/export    | POST /factory_reset/confirm |
|                 |                   | POST /time           | POST /config/import   |                |
|                 |                   |                      | GET /audit_log        |                |
|                 |                   | GET /log             |                       |                |

See [`firmware/CONTRACT_VERIFICATION.md`](./firmware/CONTRACT_VERIFICATION.md)
for the full field-by-field cross-check.

## Architecture Principles

1. **ESP32 is the single source of truth** — all logic (scheduler, PIR, RTC)
   runs locally and keeps working even if internet, Cloudflare, Vercel, or
   Google are all down.
2. **PWA is just a UI** — no business logic in the frontend. Every button
   click translates to a REST API call.
3. **AI is advisory only** — Gemini (via Google Apps Script) provides
   recommendations, but final decisions stay with the user or firmware.
4. **Cloud-ready but locally autonomous** — Cloudflare Tunnel enables remote
   access without port forwarding, but the system doesn't depend on it.

## Tech Stack

| Layer        | Technology                                                       |
|--------------|------------------------------------------------------------------|
| Firmware     | ESP32 Arduino core, PlatformIO, LittleFS, mbedtls (crypto)       |
| Hardware     | ESP32-WROOM-32, DS3231 RTC, 12× relay module, 4× HC-SR501 PIR   |
| Frontend     | Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui    |
| State        | TanStack Query (server), Zustand (client UI)                     |
| Auth         | JWT (HS256) + CSRF token + httpOnly cookies                      |
| Deployment   | Vercel (PWA), Cloudflare Tunnel (gateway), GitHub Actions (OTA)  |

## License

Proprietary — built per the Timer Digital Relay v4.0 Engineering Brief.
