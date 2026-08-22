import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { LayoutDashboard, CalendarClock, Settings as SettingsIcon, Cpu, Zap } from "lucide-react";
import { useConfig } from "@/context/ConfigContext";

const NAV = [
  { to: "/", label: "Dasbor", icon: LayoutDashboard, testid: "nav-dashboard" },
  { to: "/schedules", label: "Jadwal", icon: CalendarClock, testid: "nav-schedules" },
  { to: "/settings", label: "Pengaturan", icon: SettingsIcon, testid: "nav-settings" },
  { to: "/install", label: "Flash Firmware", icon: Cpu, testid: "nav-install" },
];

export default function AppShell() {
  const { config } = useConfig();
  const location = useLocation();

  return (
    <div className="min-h-screen relative z-10">
      <header
        className="sticky top-0 z-30 bg-zinc-900/70 backdrop-blur-2xl backdrop-saturate-150 border-b border-white/10"
        data-testid="app-header"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-[#007AFF] flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Zap size={18} className="text-white" strokeWidth={2.5} />
            </div>
            <div className="leading-tight">
              <div className="font-heading font-bold text-base tracking-tight">Relay Timer</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                {config?.device_id || "COMMAND CENTER"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 border border-zinc-800 rounded-full px-3 py-1.5">
              <Zap size={11} className="text-[#3B82F6]" /> Zero-Touch
            </span>
          </div>
        </div>

        <nav className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active =
              item.to === "/" ? location.pathname === "/" : location.pathname.startsWith(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                data-testid={item.testid}
                className={`relative flex items-center gap-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors ${
                  active ? "text-white" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon size={15} />
                {item.label}
                {active && (
                  <motion.div
                    layoutId="nav-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007AFF]"
                  />
                )}
              </NavLink>
            );
          })}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
