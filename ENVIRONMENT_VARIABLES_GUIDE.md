# PWA Environment Variables Guide

Panduan lengkap mengisi environment variables untuk PWA Remote Relay.

---

## Cara Setting

### Untuk Development (Local)

```bash
# 1. Copy file template
cp .env.example .env.local

# 2. Edit .env.local sesuai kebutuhan
nano .env.local

# 3. Jalankan
bun dev
```

### Untuk Production (Vercel)

1. Buka https://vercel.com → pilih project Remote-Relay
2. Settings → Environment Variables
3. Tambahkan setiap variable di bawah
4. Klik **Save** lalu **Redeploy**

---

## Mode Operasi

PWA punya 2 mode utama:

| Mode | Kapan dipakai | Variables yang wajib |
|---|---|---|
| **REST (LAN)** | ESP32 di WiFi yang sama | `NEXT_PUBLIC_API_BASE_URL` |
| **MQTT (Remote)** | Akses dari mana saja via internet | `NEXT_PUBLIC_MQTT_BROKER_URL` + `NEXT_PUBLIC_MQTT_USERNAME` + `NEXT_PUBLIC_MQTT_PASSWORD` |
| **Demo** | Tanpa ESP32 (development) | `DEMO_MODE=true` |

PWA **otomatis** pilih mode: jika `NEXT_PUBLIC_MQTT_BROKER_URL` diisi → MQTT mode. Jika kosong → REST mode.

---

## Variables Lengkap

### 1. `NEXT_PUBLIC_API_BASE_URL`

| | |
|---|---|
| **Required** | Hanya untuk REST (LAN) mode |
| **Default** | Kosong (MQTT mode) |
| **Format** | URL ESP32 atau Cloudflare Tunnel |

**REST mode (LAN langsung):**
```
NEXT_PUBLIC_API_BASE_URL=http://192.168.1.50
```
Gunakan IP lokal ESP32. PWA harus di WiFi yang sama.

**REST mode via Cloudflare Tunnel:**
```
NEXT_PUBLIC_API_BASE_URL=https://timer.example.com
```
Cloudflare Tunnel menghubungkan domain publik ke ESP32 di LAN.

**MQTT mode (remote):**
```
NEXT_PUBLIC_API_BASE_URL=
```
Kosongkan. PWA menggunakan MQTT untuk komunikasi.

---

### 2. `NEXT_PUBLIC_MQTT_BROKER_URL`

| | |
|---|---|
| **Required** | Hanya untuk MQTT (remote) mode |
| **Default** | Kosong (REST mode) |
| **Format** | `wss://hostname:port/mqtt` |

**Production (Mosquitto TLS + WebSocket):**
```
NEXT_PUBLIC_MQTT_BROKER_URL=wss://broker.example.com:8884/mqtt
```
- Port `8884` = WebSocket over TLS
- `wss://` = WebSocket Secure (wajib untuk production)
- Broker harus mendukung WebSocket (Mosquitto: `listener 8884` + `protocol websockets`)

**Development (HiveMQ public):**
```
NEXT_PUBLIC_MQTT_BROKER_URL=wss://broker.hivemq.com:8884/mqtt
```
- HiveMQ public broker — gratis, no auth, untuk testing saja
- **TIDAK AMAN untuk production** — siapapun bisa subscribe topic Anda

---

### 3. `NEXT_PUBLIC_MQTT_USERNAME`

| | |
|---|---|
| **Required** | Hanya untuk MQTT (remote) mode dengan broker ber-auth |
| **Default** | Kosong |
| **Format** | String bebas |

**Production (per-device ACL):**
```
NEXT_PUBLIC_MQTT_USERNAME=pwa-frontend
```
- Buat user terpisah untuk PWA (bukan credential ESP32)
- Broker ACL: PWA boleh subscribe `timer12/+/status`, publish `timer12/+/command`
- **PWA TIDAK boleh subscribe topic device lain**

**Development (HiveMQ public):**
```
NEXT_PUBLIC_MQTT_USERNAME=
```
Kosongkan (HiveMQ public tidak butuh auth).

---

### 4. `NEXT_PUBLIC_MQTT_PASSWORD`

| | |
|---|---|
| **Required** | Hanya untuk MQTT (remote) mode dengan broker ber-auth |
| **Default** | Kosong |
| **Format** | String bebas |

**Production:**
```
NEXT_PUBLIC_MQTT_PASSWORD=Str0ngP@ssw0rd!2026
```
- Gunakan password yang kuat (16+ karakter, campuran huruf/angka/simbol)
- Rotate secara berkala
- **JANGAN commit ke git** — set di Vercel dashboard saja

**Development:**
```
NEXT_PUBLIC_MQTT_PASSWORD=
```

---

### 5. `NEXT_PUBLIC_GAS_INSIGHTS_URL`

| | |
|---|---|
| **Required** | Tidak (opsional) |
| **Default** | Kosong (mock insights) |
| **Format** | URL Google Apps Script Web App |

**Dengan AI Insights (Gemini):**
```
NEXT_PUBLIC_GAS_INSIGHTS_URL=https://script.google.com/macros/s/AKfycbwAAQYaLZhE7RVktWi_GElKeZS49JYLVXGdlw7bpqDEViAA-pstUtul6yU5T1rH9OPlug/exec
```
Cara deploy:
1. Buka https://script.google.com → New Project
2. Paste isi `code.gs/Code.gs` dari firmware repo
3. Set Script Properties:
   - `GEMINI_API_KEY` = API key dari https://aistudio.google.com
   - `DEVICE_<anonymousId>_SECRET` = hex 64 chars dari Serial Monitor ESP32
4. Deploy → New Deployment → Web App → Execute as: Me → Access: Anyone
5. Copy URL → paste ke variable ini

**Tanpa AI Insights:**
```
NEXT_PUBLIC_GAS_INSIGHTS_URL=
```
PWA menampilkan mock insights card sebagai placeholder.

---

### 6. `DEMO_MODE` dan `NEXT_PUBLIC_DEMO_MODE`

| | |
|---|---|
| **Required** | Tidak (development only) |
| **Default** | Kosong |
| **Format** | `true` atau kosong |

**Demo mode (tanpa ESP32):**
```
DEMO_MODE=true
NEXT_PUBLIC_DEMO_MODE=true
```
- PWA menggunakan mock store dengan data realistis (8S LiFePO4 ~26.4V, signed currents, cell delta)
- Login: `admin` / `admin123`
- Tidak ada ESP32/MQTT/broker needed
- Cocok untuk development dan demo

**Production:**
```
DEMO_MODE=
NEXT_PUBLIC_DEMO_MODE=
```
Kosongkan. Jangan aktifkan di production.

> **Catatan:** `NEXT_PUBLIC_DEMO_MODE` terlihat di browser (client-side). `DEMO_MODE` hanya di server. Set keduanya untuk konsistensi.

---

### 7. `JWT_SECRET`

| | |
|---|---|
| **Required** | Hanya untuk mock auth (demo/staging) |
| **Default** | Kosong (mock auth disabled di production) |
| **Format** | String random 32+ karakter |

**Development:**
```
JWT_SECRET=timer12-dev-only-secret-change-me
```

**Staging:**
```
JWT_SECRET=g^7kL9$mP2qR4sT6uV8wX0yZ1aB3cD5eF7gH9iJ
```
Generate dengan:
```bash
openssl rand -hex 32
```

**Production (MQTT mode):**
```
JWT_SECRET=
```
Kosongkan jika menggunakan MQTT mode (auth dilakukan oleh broker, bukan JWT).

> **Penting:** Di production dengan `NODE_ENV=production`, mock auth **otomatis disabled** bahkan jika `JWT_SECRET` diisi. Ini fail-closed guard.

---

## Contoh Konfigurasi Lengkap

### Scenario 1: Development (Demo Mode)

```env
DEMO_MODE=true
NEXT_PUBLIC_DEMO_MODE=true
JWT_SECRET=timer12-dev-only-secret
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_MQTT_BROKER_URL=
NEXT_PUBLIC_MQTT_USERNAME=
NEXT_PUBLIC_MQTT_PASSWORD=
NEXT_PUBLIC_GAS_INSIGHTS_URL=
```

### Scenario 2: REST Mode (LAN, ESP32 di WiFi yang sama)

```env
DEMO_MODE=
NEXT_PUBLIC_DEMO_MODE=
JWT_SECRET=your-32-char-secret-here
NEXT_PUBLIC_API_BASE_URL=http://192.168.1.50
NEXT_PUBLIC_MQTT_BROKER_URL=
NEXT_PUBLIC_MQTT_USERNAME=
NEXT_PUBLIC_MQTT_PASSWORD=
NEXT_PUBLIC_GAS_INSIGHTS_URL=https://script.google.com/macros/s/AKfyc.../exec
```

### Scenario 3: MQTT Mode (Production, remote access via internet)

```env
DEMO_MODE=
NEXT_PUBLIC_DEMO_MODE=
JWT_SECRET=
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_MQTT_BROKER_URL=wss://broker.example.com:8884/mqtt
NEXT_PUBLIC_MQTT_USERNAME=pwa-frontend
NEXT_PUBLIC_MQTT_PASSWORD=Str0ngP@ssw0rd!2026
NEXT_PUBLIC_GAS_INSIGHTS_URL=https://script.google.com/macros/s/AKfyc.../exec
```

### Scenario 4: MQTT Mode (Development, HiveMQ public broker)

```env
DEMO_MODE=
NEXT_PUBLIC_DEMO_MODE=
JWT_SECRET=
NEXT_PUBLIC_API_BASE_URL=
NEXT_PUBLIC_MQTT_BROKER_URL=wss://broker.hivemq.com:8884/mqtt
NEXT_PUBLIC_MQTT_USERNAME=
NEXT_PUBLIC_MQTT_PASSWORD=
NEXT_PUBLIC_GAS_INSIGHTS_URL=
```

---

## Checklist Sebelum Production Deploy

- [ ] `DEMO_MODE` dan `NEXT_PUBLIC_DEMO_MODE` kosong
- [ ] `NEXT_PUBLIC_MQTT_BROKER_URL` menggunakan `wss://` (bukan `ws://`)
- [ ] `NEXT_PUBLIC_MQTT_USERNAME` dan `NEXT_PUBLIC_MQTT_PASSWORD` diisi
- [ ] MQTT broker menggunakan TLS (port 8884 untuk WebSocket TLS)
- [ ] MQTT broker ACL membatasi PWA ke `timer12/+/status` (subscribe) dan `timer12/+/command` (publish) saja
- [ ] `NEXT_PUBLIC_GAS_INSIGHTS_URL` diisi (jika AI insights diperlukan)
- [ ] ESP32 firmware di-flash dengan `-DPRODUCTION_BUILD` (TLS + auth + CA + non-wildcard CORS)
- [ ] ESP32 MQTT broker credential berbeda dari PWA credential (blast-radius isolation)
- [ ] ESP32 `Config.h` diisi: broker host, port 8883, username, password, root CA, OTA public key
- [ ] GAS Script Properties: `GEMINI_API_KEY` dan `DEVICE_<id>_SECRET` sudah dikonfigurasi
