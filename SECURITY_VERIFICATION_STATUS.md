# Security Verification Status (PWA)

> **audit-fixes-v2 final status (after auditor #1-#6 review cycle)**
>
> Companion to [firmware repo SECURITY_VERIFICATION_STATUS.md](https://github.com/desvandi/Firmware-code-gs_relaytimer/blob/main/SECURITY_VERIFICATION_STATUS.md).
> This document covers PWA-specific findings only. Cross-repo findings (MQTT contract, OTA) are documented in the firmware repo.

---

## Verification Tier Definitions

| Tier | Meaning |
|------|---------|
| 🔧 **FIXED-SOURCE** | Code has been modified to address the finding |
| 🔨 **VERIFIED-BUILD** | `bun run lint` PASS + `bun run build` SUCCESS |
| ⚡ **VERIFIED-RUNTIME** | Behavior proven on actual Vercel deployment + real ESP32 + Mosquitto broker |

**Critical rule**: FIXED-SOURCE + VERIFIED-BUILD ≠ production-ready. Runtime verification on real deployment is the final gate.

---

## Status Matrix (as of `main` after PR #3 merge)

### 🔴 P0 Findings (PWA-specific)

| ID | Finding | Tier | Status |
|----|---------|------|--------|
| P0-2 | `NEXT_PUBLIC_MQTT_PASSWORD` browser-exposed | 🟠 UNRESOLVED (architectural) | Per-device broker ACL (in firmware README) limits blast radius. Full fix requires server-side MQTT proxy. See "Backlog" below. |

### 🟠 P1 Findings (PWA-specific)

| ID | Finding | Tier | Status |
|----|---------|------|--------|
| P1-10 | MQTT mode hardcoded `signatureVerified: true` | 🔧 FIXED-SOURCE + 🔨 VERIFIED-BUILD | `useApi.ts` returns `null` for unverified fields. `types.ts` allows null. ⚡ Runtime test pending (PWA UI must show "unknown" not "verified" in MQTT mode). |
| P1-cross | `/api/channel` endpoint contract sync | 🔧 FIXED-SOURCE + 🔨 VERIFIED-BUILD | PWA calls `/api/channel`, firmware now handles it (see firmware repo P1-1). ⚡ Contract test pending. |

### 🟡 P2 Findings (PWA-specific)

| ID | Finding | Tier | Status |
|----|---------|------|--------|
| P2-1 | MQTT status/log runtime schema not validated | 🟠 UNRESOLVED | `mqtt.ts` does `JSON.parse(msg) as SystemStatus` without runtime validation. PENDING (backlog). |
| P2-7 | Unused dependencies (next-auth, prisma, next-intl, etc.) | 🟠 UNRESOLVED | Bloats bundle, increases attack surface. PENDING (cleanup). |

---

## ✅ Areas Auditor #6 Confirmed Strong (PWA-side)

- **MQTT ACK transaction layer**: requestId + timeout + per-commandType ACK validation
- **Private publisher**: `mqttTransaction.ts` inlined publisher, only `sendCommandWithAck()` exported
- **Auth fail-closed**: production with `NEXT_PUBLIC_DEMO_MODE=true` no longer backdoor `admin/admin123`
- **CSRF coverage**: all 14 mutation routes have CSRF (except `/api/login` which is pre-auth)
- **CSP + security headers**: X-Frame-Options DENY, X-Content-Type-Options nosniff, etc.

---

## ⚡ PWA Runtime Test Matrix (REQUIRED before production deployment)

### Auth Tests (PWA ↔ ESP32 REST)

| Test | Expected | Status |
|------|----------|--------|
| Login with wrong password × 5 | 60s block | ⏳ Pending |
| Login with correct password after block expires | 200 | ⏳ Pending |
| Access token expiry → auto-refresh | New access + new CSRF + new refresh cookie | ⏳ Critical — verifies P1-5 fix |
| **Old CSRF token after refresh** | **403 on next mutation** | ⏳ Critical — verifies P1-5 fix |
| Refresh token expired (>7 days) | Force re-login | ⏳ Critical — verifies P1-4 fix |
| Logout | All 3 cookies cleared + refresh token revoked in NVS | ⏳ Pending |

### MQTT Mode Tests (PWA ↔ Mosquitto ↔ ESP32)

| Test | Expected | Status |
|------|----------|--------|
| Connect with valid deviceId + broker credential | Subscribe to 4 topics + ready | ⏳ Pending |
| Connect with wrong broker credential | Connection refused | ⏳ Pending |
| Send relay ON command | ACK received <5s, relay state updated | ⏳ Pending |
| Send command + disconnect before ACK | Timeout 5s, command rejected | ⏳ Pending |
| Reconnect after disconnect | Pending commands cleaned | ⏳ Pending |
| Duplicate requestId (same payload) | ACK replay, no double-execution | ⏳ Pending |
| MQTT mode OTA UI shows "unknown" | Not "verified up-to-date" | ⏳ Critical — verifies P1-10 fix |

### LAN REST Mode Tests (PWA ↔ ESP32 direct)

| Test | Expected | Status |
|------|----------|--------|
| POST /api/channel (rename) | 200 + state persists + UI updates | ⏳ Critical — verifies P1-cross fix |
| POST /api/relay action=toggle | 400 "toggle removed" | ⏳ Critical — verifies P1-3 fix |
| DELETE /api/schedule?channelId=3&id=2 | 200 + schedule removed | ⏳ Critical — verifies P1-2 fix |

---

## 🟠 Backlog (PWA-specific)

### 1. P0-2: Server-side MQTT proxy (architectural)
Replace `NEXT_PUBLIC_MQTT_USERNAME`/`NEXT_PUBLIC_MQTT_PASSWORD` with a Next.js API route that:
1. Authenticates the user (with device MAC + MQTT password entered at login)
2. Issues short-lived (e.g., 1-hour) broker credentials scoped to that device
3. PWA connects to Mosquitto with the short-lived credential

This eliminates browser-exposed broker credentials. Per-device broker ACL (already documented in firmware README) is the interim mitigation.

### 2. P2-1: Runtime schema validation for MQTT payloads
Add `parseStatus()`, `parseActivityLog()`, `parseAck()` schema validators (e.g., using `zod` which is already a dependency). Defense-in-depth against malformed MQTT payloads.

### 3. P2-7: Remove unused dependencies
`next-auth`, `prisma`, `@prisma/client`, `next-intl`, possibly `@mdxeditor/editor`, `react-syntax-highlighter`, `z-ai-web-dev-sdk` — bloat bundle + increase attack surface.

### 4. Distributed rate limiting (auditor #2)
PWA `/api/login` rate limiter is in-memory (per-instance on Vercel serverless). For production with >1 instance, use Upstash Redis or Vercel KV.

---

## Process Recommendation (from auditor #6)

Use 3-tier labels: **FIXED-SOURCE / VERIFIED-BUILD / VERIFIED-RUNTIME**. Do NOT conflate FIXED-SOURCE with FIXED.

### Current overall status (PWA)

- 🔧 FIXED-SOURCE: ✅ All PWA-specific P1 findings
- 🔨 VERIFIED-BUILD: ✅ `bun run lint` PASS, `bun run build` SUCCESS (20 routes)
- ⚡ VERIFIED-RUNTIME: ❌ NOT YET PROVEN — Vercel deployment + real ESP32 + Mosquitto integration test pending

**Production deployment decision**: BLOCKED until integration test matrix passes.

---

## Cross-Repo References

- **Firmware repo**: https://github.com/desvandi/Firmware-code-gs_relaytimer/blob/main/SECURITY_VERIFICATION_STATUS.md
- **Firmware PR #3 (merged)**: https://github.com/desvandi/Firmware-code-gs_relaytimer/pull/3
- **PWA PR #3 (merged)**: https://github.com/desvandi/Remote-Relay/pull/3
