import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Download,
  Upload,
  Trash2,
  Bell,
  BellOff,
  RefreshCw,
  Link2,
  KeyRound,
  Cpu,
  Pencil,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useConfig } from "@/context/ConfigContext";
import { exportConfigBlob, parseImportedConfig } from "@/lib/storage";

function mask(v) {
  if (!v) return "—";
  if (v.length <= 8) return "••••";
  return v.slice(0, 6) + "••••" + v.slice(-4);
}

function Row({ icon: Icon, label, value, mono = true, testid }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0">
      <span className="flex items-center gap-2 text-sm text-zinc-400">
        <Icon size={14} /> {label}
      </span>
      <span
        data-testid={testid}
        className={`text-sm text-zinc-200 max-w-[55%] truncate ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { config, saveConfig, resetConfig } = useConfig();
  const fileRef = useRef(null);
  const [notif, setNotif] = useState(config?.app_settings?.enable_notifications ?? true);
  const [refresh, setRefresh] = useState(String(config?.app_settings?.auto_refresh_sec ?? 5));

  const handleExport = () => {
    const blob = exportConfigBlob();
    if (!blob) {
      toast.error("Tidak ada konfigurasi untuk diekspor.");
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "relay_config_backup.json";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Backup diunduh", { description: "relay_config_backup.json" });
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = parseImportedConfig(reader.result);
      if (!result.ok) {
        toast.error("Impor gagal", { description: result.error });
        return;
      }
      saveConfig(result.config);
      toast.success("Konfigurasi diimpor", { description: "Muat ulang untuk menerapkan." });
      setTimeout(() => window.location.reload(), 800);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleReset = () => {
    resetConfig();
    toast.success("Konfigurasi aplikasi direset.");
    navigate("/setup", { replace: true });
  };

  const updateSetting = (patch) => {
    saveConfig({ app_settings: { ...(config?.app_settings || {}), ...patch } });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Pengaturan</h1>
        <p className="text-sm text-zinc-500 mt-1">Kelola konfigurasi, backup, dan preferensi aplikasi.</p>
      </div>

      {/* Connection info */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-zinc-900 border border-zinc-800 rounded-lg p-6"
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-heading text-lg font-semibold">Koneksi Perangkat</h2>
          <Button
            variant="outline"
            size="sm"
            data-testid="edit-connection-btn"
            onClick={() => navigate("/setup")}
            className="border-zinc-800 bg-zinc-950 text-zinc-300 hover:text-white"
          >
            <Pencil size={13} className="mr-1.5" /> Ubah
          </Button>
        </div>
        <Row icon={Link2} label="GAS WebApp URL" value={mask(config?.gas_webapp_url)} testid="info-gas-url" />
        <Row icon={KeyRound} label="Auth Token" value={mask(config?.auth_token)} testid="info-token" />
        <Row icon={Cpu} label="Device ID" value={config?.device_id || "—"} testid="info-device" />
      </motion.section>

      {/* App settings */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 space-y-5"
      >
        <h2 className="font-heading text-lg font-semibold">Preferensi Aplikasi</h2>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {notif ? <Bell size={16} className="text-zinc-400" /> : <BellOff size={16} className="text-zinc-500" />}
            <div>
              <Label className="text-sm">Notifikasi</Label>
              <p className="text-xs text-zinc-500">Peringatan status relay & koneksi.</p>
            </div>
          </div>
          <Switch
            data-testid="notif-switch"
            checked={notif}
            onCheckedChange={(v) => {
              setNotif(v);
              updateSetting({ enable_notifications: v });
            }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw size={16} className="text-zinc-400" />
            <div>
              <Label className="text-sm">Interval Auto-Refresh</Label>
              <p className="text-xs text-zinc-500">Frekuensi polling status perangkat.</p>
            </div>
          </div>
          <Select
            value={refresh}
            onValueChange={(v) => {
              setRefresh(v);
              updateSetting({ auto_refresh_sec: parseInt(v, 10) });
            }}
          >
            <SelectTrigger data-testid="refresh-select" className="w-28 bg-zinc-950 border-zinc-800 font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 detik</SelectItem>
              <SelectItem value="5">5 detik</SelectItem>
              <SelectItem value="10">10 detik</SelectItem>
              <SelectItem value="30">30 detik</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.section>

      {/* Backup */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-zinc-900 border border-zinc-800 rounded-lg p-6"
      >
        <h2 className="font-heading text-lg font-semibold mb-1">Backup &amp; Restore</h2>
        <p className="text-sm text-zinc-500 mb-5">Ekspor atau impor seluruh isi RELAY_SYS_CONFIG.</p>
        <div className="flex flex-wrap gap-3">
          <Button
            data-testid="export-btn"
            onClick={handleExport}
            className="bg-[#007AFF] hover:bg-[#3B82F6] text-white"
          >
            <Download size={16} className="mr-2" /> Export Config
          </Button>
          <Button
            variant="outline"
            data-testid="import-btn"
            onClick={() => fileRef.current?.click()}
            className="border-zinc-800 bg-zinc-950 text-zinc-200 hover:text-white"
          >
            <Upload size={16} className="mr-2" /> Import Config
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            data-testid="import-file-input"
            onChange={handleImportFile}
          />
        </div>
      </motion.section>

      {/* Danger zone */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-6"
      >
        <h2 className="font-heading text-lg font-semibold text-rose-400 flex items-center gap-2 mb-1">
          <ShieldAlert size={18} /> Zona Berbahaya
        </h2>
        <p className="text-sm text-zinc-400 mb-5">
          Menghapus RELAY_SYS_CONFIG dari browser dan mengembalikan aplikasi ke Setup Awal.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" data-testid="factory-reset-btn">
              <Trash2 size={16} className="mr-2" /> Reset Konfigurasi Aplikasi
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-zinc-900 border-zinc-800">
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Konfigurasi?</AlertDialogTitle>
              <AlertDialogDescription>
                Tindakan ini menghapus seluruh konfigurasi lokal (URL, token, device). Anda harus
                melakukan setup ulang. Konfigurasi di ESP32 &amp; Google Sheet tidak terpengaruh.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="reset-cancel-btn">Batal</AlertDialogCancel>
              <AlertDialogAction
                data-testid="reset-confirm-btn"
                onClick={handleReset}
                className="bg-rose-500 hover:bg-rose-600 text-white"
              >
                Ya, Reset Sekarang
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.section>
    </div>
  );
}
