# Remote Relay — PWA (Stateless Client)

Repo target: `Remote-Relay`

Single-Deploy PWA untuk kontrol relay ESP32 via Google Apps Script. 100% stateless terhadap build environment — seluruh konfigurasi user disimpan di browser (`localStorage`, key `RELAY_SYS_CONFIG`).

## Fitur
- **First-Run Experience + Routing Guard**: tanpa config valid → redirect `/setup`.
- **Setup Wizard 3 langkah** dengan **Live Connection Test** (handshake `PING`/`PONG`, timeout 7000ms via `AbortController`). Tombol Simpan terkunci sampai `VALIDATED`.
- **Dashboard**: kontrol relay ON/OFF, timer countdown, safety cutoff, polling status.
- **Settings**: Export/Import JSON config (validasi schema ketat), Factory Reset (konfirmasi modal), tema & auto-refresh.
- **/install**: flashing firmware ESP32 via ESP Web Tools (WebSerial).

## Struktur
```
src/lib/storage.js         # localStorage schema + validasi
src/lib/gas.js             # GAS client (handshake, status, set relay)
src/context/ConfigContext  # state config global
src/pages/Setup.jsx        # wizard + handshake
src/pages/Dashboard.jsx    # kontrol relay
src/pages/Settings.jsx     # backup / reset
src/pages/Install.jsx      # ESP Web Tools
```

## Deploy (Vercel / Cloudflare Pages)
Deploy sekali secara global. **Tidak ada** env var yang mengunci ke 1 user. Setiap user mengonfigurasi via `/setup` di browser masing-masing.
