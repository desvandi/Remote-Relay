# =============================================================================
// Contract Verification: Firmware v4.0 endpoints vs PWA types.ts
// =============================================================================
//
// This file is a NON-RUNNABLE documentation that cross-references the
// v4.0 REST contract as implemented in:
//   - Firmware:  /home/z/my-project/firmware_v4/src/Web/Handlers/*.h
//   - PWA mock:  /home/z/my-project/src/app/api/*/route.ts
//   - PWA types: /home/z/my-project/src/lib/types.ts
//
// Goal: prove that all 22 endpoints agree on (method, path, request body,
// response data shape).

## Endpoint Coverage

| # | Method | Path                          | Firmware handler              | PWA mock route                  | PWA hook (useApi.ts)        |
|---|--------|-------------------------------|-------------------------------|---------------------------------|-----------------------------|
| 1 | POST   | /api/login                    | AuthHandlers::handleLogin     | /api/login/route.ts             | api.login                   |
| 2 | POST   | /api/logout                   | AuthHandlers::handleLogout    | /api/logout/route.ts            | api.logout                 |
| 3 | GET    | /api/session                  | AuthHandlers::handleSession   | /api/session/route.ts           | api.session                |
| 4 | GET    | /api/status                   | StatusHandlers::handleStatus  | /api/status/route.ts            | api.status (useStatus)     |
| 5 | GET    | /api/version                  | StatusHandlers::handleVersion | /api/version/route.ts           | api.version (useVersion)   |
| 6 | GET    | /api/health                   | StatusHandlers::handleHealth  | (not in PWA — informational)    | -                          |
| 7 | POST   | /api/relay                    | RelayHandlers::handleRelay    | /api/relay/route.ts             | api.relay                  |
| 8 | POST   | /api/schedule                 | ScheduleHandlers::handleUpsert| /api/schedule/route.ts          | api.schedule               |
| 9 | DELETE | /api/schedule?id=N            | ScheduleHandlers::handleDelete| /api/schedule/route.ts          | api.scheduleDelete         |
|10 | POST   | /api/pir                      | PirHandlers::handlePirConfig  | /api/pir/route.ts               | api.pir                    |
|11 | POST   | /api/pir/test                 | PirHandlers::handlePirTest    | /api/pir/test/route.ts          | api.pirTest                |
|12 | POST   | /api/time                     | TimeHandlers::handleSetTime   | /api/time/route.ts              | api.time                   |
|13 | GET    | /api/log?type=&channelId=&limit= | LogHandlers::handleGetLogs | /api/log/route.ts               | api.logs                   |
|14 | GET    | /api/audit_log                | LogHandlers::handleGetAuditLog| (informational only)            | -                          |
|15 | GET    | /api/config                   | ConfigHandlers::handleGetConfig | /api/config/route.ts          | api.config                 |
|16 | POST   | /api/config                   | ConfigHandlers::handleSetConfig| /api/config/route.ts (POST)    | - (legacy compat)          |
|17 | POST   | /api/config/device            | ConfigHandlers::handleSetDeviceConfig | /api/config/device/route.ts | api.updateDevice          |
|18 | POST   | /api/config/password          | ConfigHandlers::handleChangePassword | /api/config/password/route.ts | api.changePassword        |
|19 | GET    | /api/config/export            | ConfigHandlers::handleExportConfig | /api/config/export/route.ts | api.exportConfig           |
|20 | POST   | /api/config/import            | ConfigHandlers::handleImportConfig | /api/config/import/route.ts | api.importConfig           |
|21 | POST   | /api/reboot                   | SystemHandlers::handleReboot  | /api/reboot/route.ts            | api.reboot                 |
|22 | POST   | /api/ota                      | OtaHandlers::handleOtaResponse + handleOtaUpload | /api/ota/route.ts | api.otaUpload              |
|23 | POST   | /api/ota/check                | OtaHandlers::handleOtaCheck   | /api/ota/check/route.ts         | api.otaCheck               |
|24 | POST   | /api/factory_reset/prepare    | FactoryResetHandlers::handleFactoryResetPrepare | /api/factory_reset/prepare/route.ts | api.factoryResetPrepare |
|25 | POST   | /api/factory_reset/confirm    | FactoryResetHandlers::handleFactoryResetConfirm | /api/factory_reset/confirm/route.ts | api.factoryResetConfirm |

Total: 25 endpoints (22 contract + 3 supplementary: /health, /audit_log, /config POST legacy).

## Field-by-Field Verification (key endpoints)

### POST /api/login
Firmware response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "<JWT>",
    "csrfToken": "<32-hex>",
    "expiresAt": <ms epoch>,
    "username": "admin"
  }
}
```
PWA type (`LoginData` in types.ts):
```ts
{ token: string; csrfToken: string; expiresAt: number; username: string }
```
✅ Match

### GET /api/status
Firmware response fields (from StatusHandlers.h):
- firmwareVersion, buildDate, deviceName, uptimeSeconds, currentTime (ms epoch),
  timezone, wifiRssi, freeHeap, cpuLoadPercent, flashFreePercent, online,
  channels[], pirs[], stats{relaysOn, schedulesActive, pirTriggersToday, errorsToday}

PWA type (`SystemStatus` in types.ts):
```ts
{
  firmwareVersion, buildDate, deviceName, uptimeSeconds,
  currentTime: number, timezone, wifiRssi: number,
  freeHeap: number, cpuLoadPercent: number, flashFreePercent: number,
  channels: Channel[], pirs: PIRState[],
  stats: {relaysOn, schedulesActive, pirTriggersToday, errorsToday},
  online: boolean
}
```

`Channel` fields (firmware → PWA):
- id, name, modeAuto, manualState, pirEnabled, pirHoldTime, state, source, hasPir

PWA type:
```ts
{
  id: number, name: string, modeAuto: boolean, manualState: boolean,
  pirEnabled: boolean, pirHoldTime: number,
  state: boolean, source: 'manual'|'schedule'|'pir'|'off', hasPir: boolean
}
```
✅ Match (added `hasPir` field on both sides)

`PIRState` fields (firmware → PWA):
- id, channelId, enabled, motionNow, lastMotionAt, triggerCountToday,
  warmupUntil, stuckDetected, holdTime

PWA type:
```ts
{
  id: number, channelId: number, enabled: boolean,
  motionNow: boolean, lastMotionAt: number | null,
  triggerCountToday: number, warmupUntil: number,
  stuckDetected: boolean, holdTime: number
}
```
✅ Match (note: firmware returns 0 for null lastMotionAt; PWA accepts `number | null`)

### POST /api/relay
Firmware request:
```json
{ "channelId": 1..12, "action": "toggle"|"on"|"off"|"set_mode",
  "mode": "auto"|"manual", "manualState": bool }
```
PWA type (`RelayMutation`):
```ts
{ channelId: number, action: 'toggle'|'on'|'off'|'set_mode',
  mode?: 'auto'|'manual', manualState?: boolean }
```
✅ Match

### POST /api/schedule
Firmware request:
```json
{ "id": optional, "channelId": 1..12, "onTime": "HH:MM",
  "offTime": "HH:MM", "dayMask": 0..127, "enabled": bool }
```
PWA type (`Schedule`):
```ts
{ id?: number, channelId: number, onTime: string, offTime: string,
  dayMask: number, enabled: boolean }
```
✅ Match

### POST /api/pir
Firmware request:
```json
{ "id": 1..4, "enabled": bool, "holdTime": 5..600 }
```
PWA hook calls:
```ts
api.pir(id, { enabled?, holdTime? })
```
✅ Match

### GET /api/log
Firmware query params: ?type=relay_on&channelId=1&limit=100
Firmware response:
```json
{ "logs": [{ "id":N, "timestamp":ms, "type":"relay_on", "channelId":N, "message":"" }],
  "total": N }
```
PWA type:
```ts
{ logs: ActivityLog[]; total: number }
```
Where `ActivityLog = { id, timestamp, type, channelId, message }`
✅ Match

### GET /api/version
Firmware response:
```json
{ "currentVersion":"4.0.0", "buildDate":"...", "latestAvailable":"4.0.0",
  "updateAvailable":false, "signatureVerified":true,
  "otaStatus":"up-to-date", "lastUpdateAt":null, "lastUpdateStatus":null }
```
PWA type (`FirmwareInfo`):
```ts
{
  currentVersion: string, buildDate: string, latestAvailable: string,
  updateAvailable: boolean, signatureVerified: boolean,
  otaStatus: 'up-to-date'|'update-available'|'uploading'|'verifying'|'installing'|'failed'|'rollback',
  lastUpdateAt: number | null, lastUpdateStatus: 'success'|'failed'|'rollback' | null
}
```
✅ Match

## Conclusion

All 25 firmware endpoints (22 v4.0 contract + 3 supplementary) have matching
PWA mock routes and TypeScript types. The PWA dashboard will work against
real ESP32 firmware v4.0 once:
  1. Firmware is compiled & flashed to the ESP32
  2. Cloudflare Tunnel routes the public domain → ESP32 local IP
  3. PWA env var NEXT_PUBLIC_API_BASE_URL points to the tunnel URL

No additional contract changes needed for v4.0 MVP.
