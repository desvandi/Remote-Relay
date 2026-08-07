'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, setCsrfToken, ApiError } from '@/lib/api';
import type { SessionInfo } from '@/lib/types';
import { useMqtt } from '@/components/providers/mqtt-provider';

type AuthContextValue = {
  session: SessionInfo;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  isMqttMode: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const DEFAULT_SESSION: SessionInfo = {
  isAuthenticated: false,
  username: null,
  expiresAt: null,
};

const MQTT_SESSION: SessionInfo = {
  isAuthenticated: true,
  username: 'mqtt-user',
  expiresAt: null,  // no expiry in MQTT mode
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const { connected: mqttConnected } = useMqtt();
  const [session, setSession] = useState<SessionInfo>(DEFAULT_SESSION);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    // If MQTT is connected, auto-authenticate (skip REST login)
    if (mqttConnected) {
      setSession(MQTT_SESSION);
      setLoading(false);
      return;
    }
    try {
      const s = await api.session();
      setSession(s);
      if (typeof document !== 'undefined' && s.isAuthenticated) {
        const match = document.cookie.match(/(?:^|;\s*)timer12_csrf=([^;]+)/);
        if (match) {
          setCsrfToken(decodeURIComponent(match[1]));
        }
      }
    } catch {
      setSession(DEFAULT_SESSION);
    } finally {
      setLoading(false);
    }
  }, [mqttConnected]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    if (mqttConnected) {
      // In MQTT mode, login is a no-op (auto-authenticated)
      setSession(MQTT_SESSION);
      return;
    }
    const result = await api.login(username, password);
    setCsrfToken(result.csrfToken);
    setSession({
      isAuthenticated: true,
      username: result.username,
      expiresAt: result.expiresAt,
    });
  }, [mqttConnected]);

  const logout = useCallback(async () => {
    if (mqttConnected) {
      // In MQTT mode, logout just clears local state but stays connected
      setSession(DEFAULT_SESSION);
      return;
    }
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setCsrfToken(null);
    setSession(DEFAULT_SESSION);
  }, [mqttConnected]);

  return (
    <AuthContext.Provider value={{
      session,
      loading,
      login,
      logout,
      refresh,
      isMqttMode: mqttConnected,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ApiError };
