'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { api, setCsrfToken, ApiError } from '@/lib/api';
import type { SessionInfo } from '@/lib/types';

type AuthContextValue = {
  session: SessionInfo;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const DEFAULT_SESSION: SessionInfo = {
  isAuthenticated: false,
  username: null,
  expiresAt: null,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionInfo>(DEFAULT_SESSION);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await api.session();
      setSession(s);
      // Fetch CSRF token from cookie (set by login)
      // In browser, we read document.cookie
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
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (username: string, password: string) => {
    const result = await api.login(username, password);
    setCsrfToken(result.csrfToken);
    setSession({
      isAuthenticated: true,
      username: result.username,
      expiresAt: result.expiresAt,
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // ignore
    }
    setCsrfToken(null);
    setSession(DEFAULT_SESSION);
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, login, logout, refresh }}>
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
