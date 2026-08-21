// Runtime storage layer for Relay Timer PWA (Stateless Client)
// Primary: localStorage. Structured under a single key: RELAY_SYS_CONFIG.

export const CONFIG_KEY = "RELAY_SYS_CONFIG";
export const CONFIG_VERSION = "1.0.0";

export const DEFAULT_APP_SETTINGS = {
  auto_refresh_sec: 5,
  enable_notifications: true,
  theme: "dark",
};

// Validate the auth token: minimal 16 karakter alphanumerik (underscore diperbolehkan).
export function isValidToken(token) {
  if (typeof token !== "string") return false;
  return /^[A-Za-z0-9_]{16,}$/.test(token.trim());
}

// Validate GAS WebApp URL (must be a Google Apps Script /exec deployment URL).
export function isValidGasUrl(url) {
  if (typeof url !== "string") return false;
  const u = url.trim();
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec\/?$/.test(u);
}

// Strict schema validation for the whole config object.
export function isValidConfig(cfg) {
  if (!cfg || typeof cfg !== "object") return false;
  if (!isValidGasUrl(cfg.gas_webapp_url)) return false;
  if (!isValidToken(cfg.auth_token)) return false;
  if (typeof cfg.device_id !== "string" || cfg.device_id.trim().length < 1) return false;
  return true;
}

export function loadConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (e) {
    return null;
  }
}

export function saveConfig(partial) {
  const existing = loadConfig() || {};
  const merged = {
    version: CONFIG_VERSION,
    ...existing,
    ...partial,
    app_settings: {
      ...DEFAULT_APP_SETTINGS,
      ...(existing.app_settings || {}),
      ...(partial.app_settings || {}),
    },
    updated_at: new Date().toISOString(),
  };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(merged));
  return merged;
}

export function clearConfig() {
  localStorage.removeItem(CONFIG_KEY);
}

export function exportConfigBlob() {
  const cfg = loadConfig();
  if (!cfg) return null;
  const blob = new Blob([JSON.stringify(cfg, null, 2)], {
    type: "application/json",
  });
  return blob;
}

// Parse & validate an imported JSON string. Returns { ok, config, error }.
export function parseImportedConfig(jsonText) {
  let parsed;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return { ok: false, error: "File bukan JSON yang valid." };
  }
  if (!isValidConfig(parsed)) {
    return {
      ok: false,
      error:
        "Struktur konfigurasi tidak valid. Pastikan gas_webapp_url, auth_token (min 16 karakter), dan device_id benar.",
    };
  }
  return { ok: true, config: parsed };
}
