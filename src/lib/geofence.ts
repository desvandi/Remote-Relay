// =============================================================================
// Geofencing — location-based relay automation
// Uses PWA Geolocation API to detect when phone enters/leaves home area
// Triggers relay actions (e.g., turn off all lights when leaving home)
// =============================================================================

export type GeofenceConfig = {
  enabled: boolean;
  lat: number;
  lng: number;
  radius: number;       // meters
  actions: {
    onEnter: GeofenceAction[];
    onLeave: GeofenceAction[];
  };
};

export type GeofenceAction = {
  type: 'relay_on' | 'relay_off' | 'relay_toggle' | 'all_off' | 'all_on';
  channelId?: number;  // 1-12, required for relay_on/off/toggle
};

export type GeofenceState = {
  inside: boolean;
  distance: number;     // meters from center
  lastUpdate: number;   // ms epoch
  error: string | null;
};

const STORAGE_KEY = 'timer12-geofence';
const WATCH_INTERVAL_MS = 30_000;  // check every 30s

let watchId: number | null = null;
let lastInside = false;
const stateCallbacks = new Set<(state: GeofenceState) => void>();

export function getDefaultGeofence(): GeofenceConfig {
  return {
    enabled: false,
    lat: 0,
    lng: 0,
    radius: 200,  // 200m default radius
    actions: {
      onEnter: [],
      onLeave: [
        { type: 'all_off' },
      ],
    },
  };
}

export function loadGeofenceConfig(): GeofenceConfig {
  if (typeof localStorage === 'undefined') return getDefaultGeofence();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...getDefaultGeofence(), ...JSON.parse(stored) };
    }
  } catch {}
  return getDefaultGeofence();
}

export function saveGeofenceConfig(config: GeofenceConfig): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function startGeofenceWatch(
  config: GeofenceConfig,
  onAction: (action: GeofenceAction) => void
): boolean {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return false;
  }

  stopGeofenceWatch();

  if (!config.enabled || (config.lat === 0 && config.lng === 0)) {
    return false;
  }

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const distance = haversineDistance(
        position.coords.latitude,
        position.coords.longitude,
        config.lat,
        config.lng
      );
      const inside = distance <= config.radius;
      const state: GeofenceState = {
        inside,
        distance: Math.round(distance),
        lastUpdate: Date.now(),
        error: null,
      };

      // Detect transitions
      if (inside && !lastInside) {
        // Entered geofence
        config.actions.onEnter.forEach(onAction);
      } else if (!inside && lastInside) {
        // Left geofence
        config.actions.onLeave.forEach(onAction);
      }
      lastInside = inside;

      stateCallbacks.forEach((cb) => cb(state));
    },
    (err) => {
      const state: GeofenceState = {
        inside: false,
        distance: -1,
        lastUpdate: Date.now(),
        error: err.message,
      };
      stateCallbacks.forEach((cb) => cb(state));
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: WATCH_INTERVAL_MS,
    }
  );

  return true;
}

export function stopGeofenceWatch(): void {
  if (watchId !== null && typeof navigator !== 'undefined') {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
}

export function onGeofenceState(cb: (state: GeofenceState) => void): () => void {
  stateCallbacks.add(cb);
  return () => stateCallbacks.delete(cb);
}

/**
 * Get current position once (for setting home location)
 */
export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation not available'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(err.message)),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

/**
 * Haversine distance between two lat/lng points (meters)
 */
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius (meters)
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
