import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { loadConfig, saveConfig } from "@/lib/storage";

const ThemeContext = createContext(null);

function initialTheme() {
  return "dark";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(initialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      const cfg = loadConfig();
      if (cfg) saveConfig({ app_settings: { ...(cfg.app_settings || {}), theme: next } });
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme harus digunakan di dalam ThemeProvider");
  return ctx;
}
