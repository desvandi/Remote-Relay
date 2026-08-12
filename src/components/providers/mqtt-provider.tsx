'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
  connectMqtt, disconnectMqtt,
  onOnlineChange, onStatusChange, onLog,
} from '@/lib/mqtt';
import type { SystemStatus as FullSystemStatus, ActivityLog as FullActivityLog } from '@/lib/types';

type MqttContextValue = {
  configured: boolean;
  connected: boolean;
  deviceId: string | null;
  password: string | null;
  connect: (deviceId: string, password: string) => Promise<void>;
  disconnect: () => void;
};

const MqttContext = createContext<MqttContextValue | null>(null);

function getInitialDeviceId(): string | null {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('timer12-mqtt-device-id');
  }
  return null;
}

// NOTE: Password is intentionally NOT persisted in localStorage.
// It lives only in memory (session). User must re-enter on each app open.
// This prevents credential theft via XSS or browser extensions.

export function MqttProvider({ children }: { children: ReactNode }) {
  const [deviceId, setDeviceIdState] = useState<string | null>(getInitialDeviceId);
  const [password, setPasswordState] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Only auto-connect if both deviceId AND password are available
    // Password is NOT persisted, so auto-connect won't happen after page reload
    const id = getInitialDeviceId();
    if (id && password) {
      connectMqtt(id, password).catch((err) => {
        console.error('[MqttProvider] Auto-connect failed:', err);
      });
    }

    const unsubOnline = onOnlineChange((online) => setConnected(online));
    return () => {
      unsubOnline();
      disconnectMqtt();
    };
  }, [password]);

  const connect = useCallback(async (id: string, pass: string) => {
    // Only persist deviceId (not password) — security best practice
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('timer12-mqtt-device-id', id);
    }
    setDeviceIdState(id);
    setPasswordState(pass);
    await connectMqtt(id, pass);
    setConnected(true);
  }, []);

  const disconnect = useCallback(() => {
    disconnectMqtt();
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('timer12-mqtt-device-id');
    }
    setDeviceIdState(null);
    setPasswordState(null);
    setConnected(false);
  }, []);

  return (
    <MqttContext.Provider value={{
      configured: !!deviceId && !!password,
      connected,
      deviceId,
      password,
      connect,
      disconnect,
    }}>
      {children}
    </MqttContext.Provider>
  );
}

export function useMqtt() {
  const ctx = useContext(MqttContext);
  if (!ctx) throw new Error('useMqtt must be used within MqttProvider');
  return ctx;
}

// Hook for real-time status updates via MQTT
export function useMqttStatus(): FullSystemStatus | null {
  const { connected } = useMqtt();
  const [status, setStatus] = useState<FullSystemStatus | null>(null);

  useEffect(() => {
    if (!connected) return;
    const unsub = onStatusChange((s) => setStatus(s as FullSystemStatus));
    return unsub;
  }, [connected]);

  return connected ? status : null;
}

// Hook for real-time log stream via MQTT
export function useMqttLogs(maxLogs = 200): FullActivityLog[] {
  const { connected } = useMqtt();
  const [logs, setLogs] = useState<FullActivityLog[]>([]);

  useEffect(() => {
    if (!connected) return;
    const unsub = onLog((log) => {
      setLogs((prev) => [log as FullActivityLog, ...prev].slice(0, maxLogs));
    });
    return unsub;
  }, [connected, maxLogs]);

  return connected ? logs : [];
}
