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

function getInitialPassword(): string | null {
  if (typeof localStorage !== 'undefined') {
    return localStorage.getItem('timer12-mqtt-password');
  }
  return null;
}

export function MqttProvider({ children }: { children: ReactNode }) {
  const [deviceId, setDeviceIdState] = useState<string | null>(getInitialDeviceId);
  const [password, setPasswordState] = useState<string | null>(getInitialPassword);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const id = getInitialDeviceId();
    const pass = getInitialPassword();
    if (id && pass) {
      connectMqtt(id, pass).catch((err) => {
        console.error('[MqttProvider] Auto-connect failed:', err);
      });
    }

    const unsubOnline = onOnlineChange((online) => setConnected(online));
    return () => {
      unsubOnline();
      disconnectMqtt();
    };
  }, []);

  const connect = useCallback(async (id: string, pass: string) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('timer12-mqtt-device-id', id);
      localStorage.setItem('timer12-mqtt-password', pass);
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
      localStorage.removeItem('timer12-mqtt-password');
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
