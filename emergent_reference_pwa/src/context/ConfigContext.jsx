import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import {
  loadConfig,
  saveConfig as persistConfig,
  clearConfig as wipeConfig,
  isValidConfig,
} from "@/lib/storage";

const ConfigContext = createContext(null);

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(() => loadConfig());

  const isConfigured = useMemo(() => isValidConfig(config), [config]);

  const saveConfig = useCallback((partial) => {
    const merged = persistConfig(partial);
    setConfig(merged);
    return merged;
  }, []);

  const replaceConfig = useCallback((full) => {
    wipeConfig();
    const merged = persistConfig(full);
    setConfig(merged);
    return merged;
  }, []);

  const resetConfig = useCallback(() => {
    wipeConfig();
    setConfig(null);
  }, []);

  const value = useMemo(
    () => ({ config, isConfigured, saveConfig, replaceConfig, resetConfig }),
    [config, isConfigured, saveConfig, replaceConfig, resetConfig]
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig harus digunakan di dalam ConfigProvider");
  return ctx;
}
