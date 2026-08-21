import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Power,
  Timer as TimerIcon,
  ShieldAlert,
  RefreshCw,
  Cpu,
  Activity,
  Wifi,
  WifiOff,
  Clock,
  ScrollText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatusBadge from "@/components/StatusBadge";
import { useConfig } from "@/context/ConfigContext";
import { getRelayStatus, setRelay, getLogs } from "@/lib/gas";

const RELAY_LABELS = ["Relay 1", "Relay 2", "Relay 3", "Relay 4"];
const TIMER_PRESETS = [
  { label: "5 mnt", sec: 300 },
  { label: "30 mnt", sec: 1800 },
  { label: "1 jam", sec: 3600 },
];
const SAFETY_CUTOFF = 3600;

function fmt(sec) {
  if (sec <= 0) return "00:00:00";
  const h = String(Math.floor(sec / 3600)).padStart(2, "0");
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, "0");
  const s = String(sec % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function Dashboard() {
  const { config } = useConfig();
  const gpioMap = config?.relay_gpio_map || [26, 27, 14, 12];
  const refreshSec = config?.app_settings?.auto_refresh_sec || 5;

  const [conn, setConn] = useState("idle"); // idle | testing | connected | offline
  const [lastSync, setLastSync] = useState(null);
  const [freeHeap, setFreeHeap] = useState(null);
  const [relays, setRelays] = useState(
    gpioMap.map((gpio, i) => ({ gpio, on: false, remaining: 0, timerSec: 0 }))
  );
  const [busy, setBusy] = useState(-1);
  const [logs, setLogs] = useState([]);
  const tickRef = useRef(null);

  // Local countdown ticker (auto-off when timer reaches zero)
  useEffect(() => {
    tickRef.current = setInterval(() => {
      setRelays((prev) =>
        prev.map((r) => {
          if (r.on && r.remaining > 0) {
            const rem = r.remaining - 1;
            if (rem <= 0) {
              return { ...r, on: false, remaining: 0, timerSec: 0 };
            }
            return { ...r, remaining: rem };
          }
          return r;
        })
      );
    }, 1000);
    return () => clearInterval(tickRef.current);
  }, []);

  const syncStatus = useCallback(async () => {
    if (!config) return;
    setConn((c) => (c === "connected" ? "connected" : "testing"));
    const res = await getRelayStatus(config, 8000);
    if (res.ok && res.data && res.data.status === "SUCCESS") {
      setConn("connected");
      setLastSync(new Date());
      const data = res.data.data || {};
      if (typeof data.free_heap === "number") setFreeHeap(data.free_heap);
      if (Array.isArray(data.relays)) {
        setRelays((prev) =>
          prev.map((r, i) => {
            const remote = data.relays[i];
            if (!remote) return r;
            return {
              ...r,
              on: remote.state === "ON" || remote.state === true,
              remaining: typeof remote.remaining === "number" ? remote.remaining : r.remaining,
            };
          })
        );
      }
    } else {
      setConn("offline");
    }
  }, [config]);

  const syncLogs = useCallback(async () => {
    if (!config) return;
    const res = await getLogs(config, 30, 8000);
    if (res.ok && res.data && res.data.status === "SUCCESS" && Array.isArray(res.data.data?.logs)) {
      setLogs(res.data.data.logs);
    }
  }, [config]);

  useEffect(() => {
    syncStatus();
    syncLogs();
    const id = setInterval(() => {
      syncStatus();
      syncLogs();
    }, refreshSec * 1000);
    return () => clearInterval(id);
  }, [syncStatus, syncLogs, refreshSec]);

  const toggleRelay = async (index) => {
    const target = !relays[index].on;
    const timerSec = target ? relays[index].timerSec : 0;
    // Safety cutoff: bila ON tanpa timer (∞), tetap paksa auto-off pada SAFETY_CUTOFF.
    const effectiveRemaining = target ? (timerSec > 0 ? timerSec : SAFETY_CUTOFF) : 0;
    const prevRemaining = relays[index].remaining;
    setBusy(index);
    // Optimistic update
    setRelays((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, on: target, remaining: effectiveRemaining } : r
      )
    );
    const res = await setRelay(config, index, target, timerSec, 8000);
    setBusy(-1);
    if (res.ok && res.data && res.data.status === "SUCCESS") {
      toast.success(`${RELAY_LABELS[index]} ${target ? "dinyalakan" : "dimatikan"}`);
      setConn("connected");
    } else {
      // Revert on failure (restore previous on-state AND remaining)
      setRelays((prev) =>
        prev.map((r, i) =>
          i === index ? { ...r, on: !target, remaining: !target ? prevRemaining : 0 } : r
        )
      );
      setConn("offline");
      toast.error(`Gagal mengirim perintah ke ${RELAY_LABELS[index]}`, {
        description: res.error || "Perangkat tidak merespon.",
      });
    }
  };

  const setTimer = (index, sec) => {
    setRelays((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, timerSec: sec, remaining: r.on ? sec : r.remaining } : r
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Status panel */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900 border border-zinc-800 rounded-lg p-6"
        data-testid="status-panel"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                conn === "connected"
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "bg-rose-500/10 text-rose-400"
              }`}
            >
              {conn === "connected" ? <Wifi size={22} /> : <WifiOff size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-heading text-xl font-bold tracking-tight">
                  {config?.device_id}
                </h1>
                <StatusBadge status={conn} testid="conn-status-badge" />
              </div>
              <p className="font-mono text-xs text-zinc-500 mt-1">
                {lastSync
                  ? `Sinkron terakhir ${lastSync.toLocaleTimeString("id-ID")}`
                  : "Menunggu sinkronisasi…"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                Free Heap
              </div>
              <div className="font-mono text-lg text-zinc-200">
                {freeHeap != null ? `${(freeHeap / 1024).toFixed(1)} KB` : "—"}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                Auto Refresh
              </div>
              <div className="font-mono text-lg text-zinc-200">{refreshSec}s</div>
            </div>
            <Button
              variant="outline"
              size="icon"
              data-testid="refresh-btn"
              onClick={syncStatus}
              className="border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white"
            >
              <RefreshCw size={16} className={conn === "testing" ? "animate-spin" : ""} />
            </Button>
          </div>
        </div>

        {conn === "offline" && (
          <div
            className="mt-4 flex items-start gap-2 text-xs text-amber-400 bg-amber-500/5 border border-amber-500/20 rounded-md p-3"
            data-testid="offline-warning"
          >
            <ShieldAlert size={14} className="mt-0.5 shrink-0" />
            Perangkat / Apps Script tidak merespon. Perintah bersifat lokal hingga koneksi pulih.
            Pastikan ESP32 online dan URL GAS benar.
          </div>
        )}
      </motion.div>

      {/* Relay grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" data-testid="relay-grid">
        {relays.map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`relative bg-zinc-900 border rounded-lg p-6 transition-colors ${
              r.on ? "border-emerald-500/40 border-t-2 border-t-emerald-500" : "border-zinc-800"
            }`}
            data-testid={`relay-card-${i}`}
          >
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading text-lg font-semibold">{RELAY_LABELS[i]}</h3>
                  <span
                    className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded ${
                      r.on
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                    data-testid={`relay-state-${i}`}
                  >
                    {r.on ? "ON" : "OFF"}
                  </span>
                </div>
                <p className="font-mono text-xs text-zinc-500 mt-1 flex items-center gap-1">
                  <Cpu size={11} /> GPIO {r.gpio}
                </p>
              </div>
              <Activity
                size={18}
                className={r.on ? "text-emerald-400" : "text-zinc-700"}
              />
            </div>

            {/* Countdown */}
            <div className="mb-6">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 mb-1 flex items-center gap-1">
                <Clock size={11} /> Sisa Waktu
              </div>
              <div
                className={`font-mono text-4xl sm:text-5xl tracking-tighter font-light ${
                  r.on && r.remaining > 0 ? "text-white" : "text-zinc-700"
                }`}
                data-testid={`relay-countdown-${i}`}
              >
                {r.on && r.remaining > 0 ? fmt(r.remaining) : "--:--:--"}
              </div>
            </div>

            {/* Timer presets */}
            <div className="flex items-center gap-2 mb-6 flex-wrap">
              <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 flex items-center gap-1">
                <TimerIcon size={11} /> Timer:
              </span>
              {TIMER_PRESETS.map((p) => (
                <button
                  key={p.sec}
                  data-testid={`relay-${i}-preset-${p.sec}`}
                  onClick={() => setTimer(i, p.sec)}
                  className={`text-xs font-mono px-2.5 py-1 rounded border transition-colors ${
                    r.timerSec === p.sec
                      ? "border-[#007AFF] text-[#3B82F6] bg-blue-500/10"
                      : "border-zinc-800 text-zinc-400 hover:border-zinc-700"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                data-testid={`relay-${i}-preset-0`}
                onClick={() => setTimer(i, 0)}
                className={`text-xs font-mono px-2.5 py-1 rounded border transition-colors ${
                  r.timerSec === 0
                    ? "border-[#007AFF] text-[#3B82F6] bg-blue-500/10"
                    : "border-zinc-800 text-zinc-400 hover:border-zinc-700"
                }`}
              >
                ∞
              </button>
            </div>

            {/* Big toggle */}
            <button
              data-testid={`relay-toggle-${i}`}
              onClick={() => toggleRelay(i)}
              disabled={busy === i}
              className={`w-full h-16 rounded-md font-heading font-bold text-base flex items-center justify-center gap-2 transition-colors disabled:opacity-60 ${
                r.on
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white relay-pulse"
                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
              }`}
            >
              <Power size={20} strokeWidth={2.5} />
              {busy === i ? "Mengirim…" : r.on ? "MATIKAN" : "NYALAKAN"}
            </button>

            {/* Safety cutoff note */}
            <p className="mt-4 text-[11px] text-zinc-600 flex items-center gap-1.5">
              <ShieldAlert size={12} className="text-amber-500/70" />
              Safety cutoff otomatis: {fmt(SAFETY_CUTOFF)}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Activity log panel (Riwayat Aktivitas) — from Google Sheet Logs tab */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-zinc-900 border border-zinc-800 rounded-lg p-6"
        data-testid="activity-log-panel"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-lg font-semibold flex items-center gap-2">
            <ScrollText size={18} /> Riwayat Aktivitas
          </h2>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            {logs.length} entri · tab Logs
          </span>
        </div>

        <div className="term-scroll bg-zinc-950 border border-zinc-800 rounded-md max-h-72 overflow-y-auto">
          {logs.length === 0 ? (
            <div className="p-6 text-center text-sm text-zinc-600 font-mono" data-testid="log-empty">
              {conn === "connected"
                ? "Belum ada transaksi tercatat."
                : "Log akan muncul saat terhubung ke Google Sheet."}
            </div>
          ) : (
            <ul className="divide-y divide-zinc-800/70">
              {logs.map((l, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 px-4 py-2.5 font-mono text-xs"
                  data-testid={`log-row-${i}`}
                >
                  <span className="text-zinc-600 shrink-0 w-36">
                    {l.timestamp ? new Date(l.timestamp).toLocaleString("id-ID") : "-"}
                  </span>
                  <span
                    className={`shrink-0 w-24 uppercase tracking-wider ${
                      l.type === "SET_RELAY"
                        ? "text-[#3B82F6]"
                        : l.type === "SCHEDULE"
                        ? "text-amber-400"
                        : l.type === "HEARTBEAT"
                        ? "text-zinc-500"
                        : "text-emerald-400"
                    }`}
                  >
                    {l.type}
                  </span>
                  <span className="text-zinc-300 break-all">{l.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </motion.div>
    </div>
  );
}
