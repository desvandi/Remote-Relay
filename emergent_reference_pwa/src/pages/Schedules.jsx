import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  CalendarClock,
  Plus,
  Trash2,
  Power,
  Repeat,
  Loader2,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConfig } from "@/context/ConfigContext";
import {
  listSchedules,
  addSchedule,
  deleteSchedule,
  toggleSchedule,
} from "@/lib/gas";

const RELAY_LABELS = ["Relay 1", "Relay 2", "Relay 3", "Relay 4"];

export default function Schedules() {
  const { config } = useConfig();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(true);
  const [saving, setSaving] = useState(false);

  const [relay, setRelay] = useState("0");
  const [action, setAction] = useState("ON");
  const [time, setTime] = useState("06:00");

  const load = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    const res = await listSchedules(config, 8000);
    if (res.ok && res.data && res.data.status === "SUCCESS") {
      setItems(res.data.data?.schedules || []);
      setOnline(true);
    } else {
      setOnline(false);
    }
    setLoading(false);
  }, [config]);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const m = /^(\d{2}):(\d{2})$/.exec(time);
    if (!m || parseInt(m[1], 10) > 23 || parseInt(m[2], 10) > 59) {
      toast.error("Format jam tidak valid (00:00–23:59).");
      return;
    }
    const schedule = {
      relay: parseInt(relay, 10),
      action,
      time,
      days: "daily",
      enabled: true,
    };
    setSaving(true);
    const res = await addSchedule(config, schedule, 8000);
    setSaving(false);
    if (res.ok && res.data && res.data.status === "SUCCESS") {
      toast.success("Jadwal ditambahkan", {
        description: `${RELAY_LABELS[schedule.relay]} ${action} @ ${time} (harian)`,
      });
      setOnline(true);
      load();
    } else {
      toast.error("Gagal menambah jadwal", {
        description: res.error || "Perangkat / Apps Script tidak merespon.",
      });
      setOnline(false);
    }
  };

  const handleToggle = async (item, enabled) => {
    setItems((prev) => prev.map((s) => (s.id === item.id ? { ...s, enabled } : s)));
    const res = await toggleSchedule(config, item.id, enabled, 8000);
    if (!(res.ok && res.data && res.data.status === "SUCCESS")) {
      setItems((prev) => prev.map((s) => (s.id === item.id ? { ...s, enabled: !enabled } : s)));
      toast.error("Gagal memperbarui jadwal");
    }
  };

  const handleDelete = async (item) => {
    const prev = items;
    setItems((p) => p.filter((s) => s.id !== item.id));
    const res = await deleteSchedule(config, item.id, 8000);
    if (res.ok && res.data && res.data.status === "SUCCESS") {
      toast.success("Jadwal dihapus");
    } else {
      setItems(prev);
      toast.error("Gagal menghapus jadwal");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarClock size={22} /> Jadwal Otomatis
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Nyalakan / matikan relay pada jam tertentu, berulang setiap hari.
          </p>
        </div>
        {!online && (
          <button
            onClick={load}
            data-testid="schedule-retry-btn"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-rose-400 border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 rounded-full hover:bg-rose-500/20 transition-colors"
          >
            <WifiOff size={13} /> OFFLINE · Coba lagi
          </button>
        )}
      </div>

      {/* Add form */}
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={handleAdd}
        className="bg-zinc-900 border border-zinc-800 rounded-lg p-6"
        data-testid="schedule-add-form"
      >
        <h2 className="font-heading text-lg font-semibold mb-5 flex items-center gap-2">
          <Plus size={18} /> Tambah Jadwal
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div>
            <Label className="text-xs uppercase tracking-[0.15em] text-zinc-500 font-semibold">
              Relay
            </Label>
            <Select value={relay} onValueChange={setRelay}>
              <SelectTrigger data-testid="schedule-relay-select" className="mt-2 bg-zinc-950 border-zinc-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELAY_LABELS.map((l, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-[0.15em] text-zinc-500 font-semibold">
              Aksi
            </Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger data-testid="schedule-action-select" className="mt-2 bg-zinc-950 border-zinc-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ON">Nyalakan (ON)</SelectItem>
                <SelectItem value="OFF">Matikan (OFF)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-[0.15em] text-zinc-500 font-semibold">
              Jam
            </Label>
            <Input
              data-testid="schedule-time-input"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-2 font-mono bg-zinc-950 border-zinc-800 focus-visible:ring-[#007AFF]"
            />
          </div>
          <Button
            type="submit"
            data-testid="schedule-add-btn"
            disabled={saving}
            className="bg-[#007AFF] hover:bg-[#3B82F6] text-white font-semibold"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} className="mr-1" />}
            Tambah
          </Button>
        </div>
      </motion.form>

      {/* List */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6" data-testid="schedule-list">
        <h2 className="font-heading text-lg font-semibold mb-4 flex items-center gap-2">
          <Repeat size={18} /> Jadwal Aktif
        </h2>

        {loading ? (
          <div className="py-8 text-center text-sm text-zinc-500 font-mono">
            <Loader2 size={16} className="inline animate-spin mr-2" /> Memuat…
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-600 font-mono" data-testid="schedule-empty">
            {online ? "Belum ada jadwal. Tambahkan di atas." : "Tidak dapat memuat jadwal (offline)."}
          </div>
        ) : (
          <ul className="space-y-3">
            <AnimatePresence>
              {items.map((s) => (
                <motion.li
                  key={s.id}
                  layout
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-md px-4 py-3"
                  data-testid={`schedule-item-${s.id}`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-9 h-9 rounded-md flex items-center justify-center ${
                        s.action === "ON"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      <Power size={16} />
                    </div>
                    <div>
                      <div className="font-heading font-semibold text-sm">
                        {RELAY_LABELS[s.relay] || `Relay ${s.relay}`} · {s.action}
                      </div>
                      <div className="font-mono text-xs text-zinc-500">
                        {s.time} · setiap hari
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch
                      data-testid={`schedule-toggle-${s.id}`}
                      checked={!!s.enabled}
                      onCheckedChange={(v) => handleToggle(s, v)}
                    />
                    <button
                      data-testid={`schedule-delete-${s.id}`}
                      onClick={() => handleDelete(s)}
                      className="text-zinc-500 hover:text-rose-400 transition-colors"
                      aria-label="Hapus jadwal"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </div>
  );
}
