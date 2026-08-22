// Google Apps Script client. The PWA talks directly to the GAS WebApp from the browser.
// GAS WebApps do not reliably support CORS preflight, so we send a "simple request"
// (text/plain body, no custom headers) to avoid an OPTIONS preflight.

const DEFAULT_TIMEOUT = 7000;

export async function callGas(url, payload, timeoutMs = DEFAULT_TIMEOUT) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    const latency = Date.now() - startedAt;

    if (!res.ok) {
      return {
        ok: false,
        httpStatus: res.status,
        latency,
        error: `HTTP ${res.status} dari server Apps Script.`,
      };
    }

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return {
        ok: false,
        latency,
        error: "Respon Apps Script bukan JSON yang valid.",
      };
    }
    return { ok: true, data, latency, httpStatus: res.status };
  } catch (e) {
    clearTimeout(timer);
    const latency = Date.now() - startedAt;
    if (e.name === "AbortError") {
      return { ok: false, timeout: true, latency, error: "Koneksi timeout (melebihi batas waktu)." };
    }
    return {
      ok: false,
      network: true,
      latency,
      error: "Gagal terhubung (kemungkinan CORS, jaringan, atau URL salah).",
    };
  }
}

// Pre-Save Handshake: POST {action:"PING", token}. Expect {status:"SUCCESS", message:"PONG"}.
export async function pingGas(url, token, timeoutMs = DEFAULT_TIMEOUT) {
  const r = await callGas(url, { action: "PING", token }, timeoutMs);
  if (!r.ok) {
    if (r.httpStatus === 401) {
      return { ok: false, latency: r.latency, error: "Token Otorisasi salah (HTTP 401)." };
    }
    return { ok: false, latency: r.latency, error: r.error };
  }
  const payload = r.data || {};
  const status = payload.status;
  const msg = payload.message || (payload.data && payload.data.message);
  if (status === "SUCCESS" && (msg === "PONG" || payload.message === "PONG")) {
    return { ok: true, latency: r.latency, data: payload };
  }
  if (status === "ERROR") {
    return {
      ok: false,
      latency: r.latency,
      error: payload.message || "Apps Script menolak permintaan (token tidak valid?).",
    };
  }
  return { ok: false, latency: r.latency, error: "Respon handshake tidak dikenali (bukan PONG)." };
}

// Fetch current relay state snapshot from GAS.
export async function getRelayStatus(cfg, timeoutMs = 8000) {
  return callGas(
    cfg.gas_webapp_url,
    { action: "GET_STATUS", token: cfg.auth_token, device: cfg.device_id },
    timeoutMs
  );
}

// Command a relay ON/OFF, with optional auto-off timer (seconds).
export async function setRelay(cfg, relayIndex, state, timerSec = 0, timeoutMs = 8000) {
  return callGas(
    cfg.gas_webapp_url,
    {
      action: "SET_RELAY",
      token: cfg.auth_token,
      device: cfg.device_id,
      relay: relayIndex,
      state: state ? "ON" : "OFF",
      timer_sec: timerSec,
    },
    timeoutMs
  );
}

// Fetch recent transaction logs from the Logs sheet.
export async function getLogs(cfg, limit = 30, timeoutMs = 8000) {
  return callGas(
    cfg.gas_webapp_url,
    { action: "GET_LOGS", token: cfg.auth_token, device: cfg.device_id, limit },
    timeoutMs
  );
}

// ---- Schedules (daily recurring relay ON/OFF) ----
export async function listSchedules(cfg, timeoutMs = 8000) {
  return callGas(
    cfg.gas_webapp_url,
    { action: "SCHEDULE_LIST", token: cfg.auth_token, device: cfg.device_id },
    timeoutMs
  );
}

export async function addSchedule(cfg, schedule, timeoutMs = 8000) {
  return callGas(
    cfg.gas_webapp_url,
    { action: "SCHEDULE_ADD", token: cfg.auth_token, device: cfg.device_id, schedule },
    timeoutMs
  );
}

export async function deleteSchedule(cfg, id, timeoutMs = 8000) {
  return callGas(
    cfg.gas_webapp_url,
    { action: "SCHEDULE_DELETE", token: cfg.auth_token, device: cfg.device_id, id },
    timeoutMs
  );
}

export async function toggleSchedule(cfg, id, enabled, timeoutMs = 8000) {
  return callGas(
    cfg.gas_webapp_url,
    { action: "SCHEDULE_TOGGLE", token: cfg.auth_token, device: cfg.device_id, id, enabled },
    timeoutMs
  );
}
