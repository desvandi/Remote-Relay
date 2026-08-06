# Timer Digital Relay v4.0 — PWA Dashboard

Progressive Web App dashboard for the **ESP32-based 12-channel Relay + 4 PIR**
timer system. Cloud-ready (Vercel + Cloudflare Tunnel), locally autonomous,
JWT-secured, installable on Android & iOS.

> Engineering Brief v4.0 — PWA frontend layer only. ESP32 firmware v4.0 lives
> in a separate repo and is not required for this dashboard to run (a built-in
> mock API simulates the firmware for demo purposes).

---

## What's Inside

| Feature | Description |
|---|---|
| **12 Relay Control** | Real-time toggle, manual/auto mode switch, source indicator (Manual / Schedule / PIR / Off) |
| **Weekly Scheduler** | Up to 4 schedules per channel, day-mask (Mon–Sun), overnight support, visual weekly timeline |
| **4 PIR Sensors** | HC-SR501 on channels 9–12, motion status, hold-time slider, warm-up countdown, stuck detection, test trigger |
| **Activity Log** | Filterable by type / channel, search, export CSV, auto-refresh, color-coded badges |
| **AI Insights** | Mock advisory cards (habit / energy / fault / maintenance / PIR) — pipeline stub for Gemini via Google Apps Script |
| **OTA Management** | Current vs latest version, signature verification status, upload binary with progress, OTA history |
| **Settings** | Timezone, RTC sync, password change with strength meter, config export / import, factory reset (two-step) |
| **PWA** | Installable, dark / light / system theme, ID + EN i18n, mobile bottom-nav |

---

## Quick Start (Demo Mode)

The PWA ships with a **mock API server** (Next.js route handlers under
`src/app/api/*`) that simulates the ESP32 firmware v4.0 — so you can demo
every feature without any hardware.

```bash
# Install dependencies (Node 18+ or Bun)
bun install                    # or: npm install

# Start dev server on http://localhost:3000
bun run dev                    # or: npm run dev
```

Open the preview, login with **`admin` / `admin123`**.

The mock simulator runs in the background: random PIR triggers, relay state
recomputed every 30 s based on schedule + PIR priority (Manual > PIR > Schedule
> Off), activity log auto-generated — giving the dashboard a live feel.

---

## Deploy to Vercel (Production)

This repo is structured as a flat Next.js 16 project at the root — Vercel
will auto-detect the framework, no extra configuration needed.

### Option A — Vercel CLI

```bash
npm i -g vercel
vercel --prod
```

### Option B — Vercel Dashboard

1. Push this repo to GitHub (already done at
   https://github.com/desvandi/Remote-Relay).
2. Go to https://vercel.com/new → Import the `Remote-Relay` repo.
3. Vercel auto-detects Next.js 16 — accept defaults.
4. Set environment variable (see below).
5. Deploy.

### Environment Variables

Set in Vercel → Settings → Environment Variables:

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | **Yes (prod)** | URL of your ESP32 firmware v4.0, reached via Cloudflare Tunnel (e.g. `https://timer.your-domain.com`). When unset, the PWA uses the built-in mock API. |
| `NEXT_PUBLIC_GAS_INSIGHTS_URL` | No | Google Apps Script Web App URL for real AI Insights (future). |

Copy `.env.example` to `.env.local` for local development with custom settings.

---

## Switching from Mock → Real ESP32

When firmware v4.0 is flashed to the ESP32 and reachable through a tunnel:

1. **Set `NEXT_PUBLIC_API_BASE_URL`** in Vercel env vars to the tunnel URL.
2. **Redeploy** the PWA on Vercel.
3. The PWA's `src/lib/api.ts` will now route every `fetch()` to
   `${NEXT_PUBLIC_API_BASE_URL}/api/*` instead of the relative `/api/*` mock
   routes. The mock route handlers remain in the codebase but are not called.

### ESP32 Firmware v4.0 Contract

The dashboard expects the firmware to expose these endpoints with the exact
envelope `{ success, message, data }` and field names documented in
`src/lib/types.ts`:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST   | `/api/login` | JWT + CSRF cookies |
| POST   | `/api/logout` | Clear session |
| GET    | `/api/session` | Check auth status |
| GET    | `/api/status` | Full SystemStatus (12 channels + 4 PIRs + stats) |
| GET    | `/api/version` | FirmwareInfo + OTA status |
| POST   | `/api/relay` | Toggle / on / off / set_mode |
| POST   | `/api/schedule` | Upsert schedule |
| DELETE | `/api/schedule?id=N` | Delete schedule |
| POST   | `/api/pir` | Update PIR config |
| POST   | `/api/pir/test` | Manual test trigger |
| POST   | `/api/time` | Set RTC time |
| GET    | `/api/log?type=&channelId=&limit=` | Filterable activity log |
| GET    | `/api/config` | User + device info |
| POST   | `/api/config/device` | Update device name / timezone |
| POST   | `/api/config/password` | Change password |
| GET    | `/api/config/export` | Full backup JSON |
| POST   | `/api/config/import` | Restore from backup JSON |
| POST   | `/api/reboot` | Reboot ESP32 |
| POST   | `/api/ota` | Upload firmware binary |
| POST   | `/api/ota/check` | Check GitHub Release for newer firmware |
| POST   | `/api/factory_reset/prepare` | Generate one-time reset token (60s) |
| POST   | `/api/factory_reset/confirm` | Execute factory reset |

### Cloudflare Tunnel Setup

No port forwarding, no DDNS, free, TLS-terminated:

```bash
# 1. Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 \
  -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# 2. Authenticate (one-time)
cloudflared tunnel login

# 3. Create a named tunnel
cloudflared tunnel create timer-relay

# 4. Configure routing — ~/.cloudflared/config.yml
cat > ~/.cloudflared/config.yml <<EOF
tunnel: timer-relay
credentials-file: ~/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: timer.your-domain.com
    service: http://192.168.1.50:80   # ESP32 local IP
  - service: http_status:404
EOF

# 5. Route DNS to the tunnel
cloudflared tunnel route dns timer-relay timer.your-domain.com

# 6. Run as a system service
sudo cloudflared service install
sudo systemctl enable --now cloudflared
```

---

## PWA Installation

### Android (Chrome / Edge)
1. Open the deployed URL.
2. Tap the **menu** (⋮) → **Install app** / **Add to Home screen**.
3. Confirm. The app appears in the launcher with the Timer12 icon.

### iOS (Safari)
1. Open the deployed URL in Safari.
2. Tap **Share** (□↑) → **Add to Home Screen**.
3. Confirm. The app launches in standalone mode (no Safari chrome).

The `public/manifest.webmanifest` declares standalone display, theme color,
icons (192 / 512 / maskable), and shortcuts to Dashboard / Scheduler / Logs.

---

## Project Structure

```
Remote-Relay/
├── package.json                ← Next.js 16 + React 19 + TypeScript 5
├── next.config.ts
├── tsconfig.json
├── tailwind.config.ts          ← Tailwind 4 + shadcn/ui (New York)
├── .env.example                ← env var template
├── .gitignore
│
├── public/
│   ├── manifest.webmanifest    ← PWA manifest
│   ├── icon-192.png            ← PWA icons (192 / 512 / maskable)
│   ├── icon-512.png
│   ├── icon-512-maskable.png
│   ├── apple-touch-icon.png
│   └── favicon-{16,32}.png
│
└── src/
    ├── app/
    │   ├── layout.tsx          ← Root layout: PWA metadata, providers
    │   ├── page.tsx            ← Single-page router (auth → login / dashboard)
    │   ├── globals.css         ← Design tokens (IoT emerald theme, dark mode)
    │   └── api/                ← Mock v4.0 API server (Next.js route handlers)
    │       ├── login/          ← POST → JWT + CSRF cookies
    │       ├── logout/
    │       ├── session/
    │       ├── status/         ← GET → full SystemStatus
    │       ├── version/        ← GET → firmware info + OTA status
    │       ├── relay/          ← POST → toggle / on / off / set_mode
    │       ├── schedule/       ← POST + DELETE → upsert / delete
    │       ├── pir/            ← POST config + /test trigger
    │       ├── time/           ← POST → set RTC
    │       ├── log/            ← GET → filterable activity log
    │       ├── config/         ← GET/POST + /device /password /export /import
    │       ├── reboot/
    │       ├── ota/            ← POST upload + /check
    │       └── factory_reset/  ← two-step prepare → confirm
    │
    ├── components/
    │   ├── providers/          ← Theme / Language / Query / Auth contexts
    │   ├── layout/             ← AppShell, Sidebar, Header, Mobile nav
    │   ├── auth/               ← LoginForm
    │   ├── dashboard/          ← 12 relay grid + stat cards
    │   ├── scheduler/          ← Weekly schedule editor + preview
    │   ├── pir/                ← 4 PIR sensor cards
    │   ├── logs/               ← Filterable activity log table
    │   ├── ai/                 ← Mock Gemini advisory cards
    │   ├── ota/                ← Firmware management UI
    │   └── settings/           ← Timezone / RTC / Password / Backup / Factory Reset
    │
    ├── hooks/
    │   └── useApi.ts           ← TanStack Query hooks (relay / schedule / pir / ota / …)
    │
    └── lib/
        ├── types.ts            ← v4.0 API contract TypeScript types
        ├── api.ts              ← Fetch wrapper + JWT / CSRF client
        ├── auth.ts             ← Server-side session helpers (mock)
        ├── jwt.ts              ← HS256 sign / verify (mock)
        ├── mockStore.ts        ← In-memory state + file persistence + simulator
        ├── i18n.ts             ← ID + EN translation tables
        ├── format.ts           ← Time / uptime / bytes / RSSI formatters
        ├── store.ts            ← Zustand UI state (current view, sidebar)
        └── apiResponse.ts      ← { success, message, data } envelope helpers
```

---

## Tech Stack

| Layer      | Technology                                                       |
|------------|------------------------------------------------------------------|
| Framework  | Next.js 16 (App Router, Turbopack)                               |
| Language   | TypeScript 5                                                     |
| UI         | Tailwind CSS 4 + shadcn/ui (New York) + Lucide icons             |
| State      | TanStack Query (server), Zustand (client UI)                     |
| Auth       | JWT (HS256) + CSRF token + httpOnly cookies (mock in dev)        |
| i18n       | Custom context (ID + EN)                                         |
| Theme      | next-themes (dark default, light, system)                        |
| Icons      | lucide-react                                                     |
| Toaster    | sonner + radix toast                                             |

---

## AI Pipeline (Gemini via Google Apps Script)

The dashboard shows **mock advisory cards** today. In production, the flow is:

```
ESP32 ──→ Google Apps Script ──→ Gemini API ──→ Dashboard
        (logs + summaries)      (analysis)       (shows recommendations)
```

**Why not call Gemini directly from the ESP32?**
- ESP32 doesn't store the Gemini API key (saves flash + reduces attack surface).
- RAM / flash budget stays small — firmware stays focused on real-time control.
- AI quota and cost are easier to control at the GAS layer.
- AI is **advisory only** — final decisions stay with the user or firmware,
  so control reliability never depends on AI availability.

### Apps Script stub (to be implemented)

```javascript
// Code.gs — deploy as a Google Apps Script Web App
function doPost(e) {
  const logs = JSON.parse(e.postData.contents);
  const insight = callGemini(logs);
  return ContentService.createTextOutput(JSON.stringify(insight))
    .setMimeType(ContentService.MimeType.JSON);
}

function callGemini(logs) {
  const key = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key}`;
  const payload = { contents: [{ parts: [{ text: buildPrompt(logs) }] }] };
  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
  });
  return JSON.parse(res.getContentText());
}
```

Set `NEXT_PUBLIC_GAS_INSIGHTS_URL` to the Apps Script Web App URL when ready.

---

## License

Proprietary — built per the **Timer Digital Relay v4.0 Cloud-Ready Architecture**
Engineering Brief.
