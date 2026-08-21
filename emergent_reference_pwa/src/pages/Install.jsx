import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Cpu,
  ChevronLeft,
  Usb,
  Chrome,
  ListChecks,
  AlertTriangle,
  Wifi,
  KeyRound,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const BG = "https://images.unsplash.com/photo-1592659762303-90081d34b277?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NTJ8MHwxfHNlYXJjaHwyfHxjaXJjdWl0JTIwYm9hcmQlMjBoYXJkd2FyZSUyMG1hY3JvfGVufDB8fHx8MTc4NzMyMTcxOHww&ixlib=rb-4.1.0&q=85";

const ESP_TOOLS_SRC = "https://unpkg.com/esp-web-tools@10/dist/web/install-button.js?module";

const STEPS = [
  { icon: Usb, title: "Hubungkan ESP32", desc: "Colokkan board ESP32 ke komputer via kabel USB data." },
  { icon: Chrome, title: "Gunakan Chrome / Edge", desc: "Flashing WebSerial hanya berjalan di browser desktop berbasis Chromium." },
  { icon: Download, title: "Klik Flash & Pilih Port", desc: "Tekan tombol di bawah, lalu pilih port serial COM/tty yang muncul." },
  { icon: Wifi, title: "Captive Portal", desc: 'Setelah flash, ESP32 memancarkan WiFi "RelayTimer-Setup-XXXX". Buka 192.168.4.1.' },
  { icon: KeyRound, title: "Isi Kredensial", desc: "Masukkan SSID, Password, URL GAS, Auth Token & Device Key yang sama dengan sheet." },
];

export default function Install() {
  const navigate = useNavigate();
  const [scriptReady, setScriptReady] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    setSupported("serial" in navigator);
    if (document.querySelector(`script[data-esp-web-tools]`)) {
      setScriptReady(true);
      return;
    }
    const s = document.createElement("script");
    s.type = "module";
    s.src = ESP_TOOLS_SRC;
    s.setAttribute("data-esp-web-tools", "true");
    s.onload = () => setScriptReady(true);
    document.body.appendChild(s);
  }, []);

  const manifestUrl = `${window.location.origin}/firmware/manifest.json`;

  return (
    <div className="min-h-screen relative z-10">
      <div className="absolute inset-0 z-0">
        <img src={BG} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-zinc-950/92" />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950 via-transparent to-zinc-950" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <button
          onClick={() => navigate(-1)}
          data-testid="install-back-btn"
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white mb-8 transition-colors"
        >
          <ChevronLeft size={16} /> Kembali
        </button>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-lg bg-[#007AFF] flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Cpu size={22} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="font-heading text-2xl font-bold tracking-tight text-white">
                Flash Firmware ESP32
              </h1>
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
                ESP Web Tools · WebSerial · Flash-Once
              </p>
            </div>
          </div>
          <p className="text-sm text-zinc-400 max-w-2xl">
            Pasang firmware Relay Timer generik langsung dari browser—tanpa Arduino IDE. Firmware
            mendukung Captive Portal sehingga seluruh konfigurasi diisi setelah flashing.
          </p>
        </motion.div>

        {/* Flash button card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-8 bg-zinc-900/70 backdrop-blur-xl border border-white/10 rounded-lg p-8 flex flex-col items-center text-center"
        >
          <div className="font-mono text-xs text-zinc-500 mb-1">relay_timer_v1.0.0.bin</div>
          <div className="font-heading text-lg font-semibold text-white mb-6">
            Firmware Relay Timer v1.0.0
          </div>

          {!supported && (
            <div className="mb-5 flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-md px-4 py-3">
              <AlertTriangle size={16} />
              Browser ini tidak mendukung WebSerial. Gunakan Chrome atau Edge di desktop.
            </div>
          )}

          <div data-testid="esp-install-button-wrap">
            {scriptReady ? (
              <esp-web-install-button manifest={manifestUrl}>
                <button
                  slot="activate"
                  data-testid="esp-flash-btn"
                  className="inline-flex items-center gap-2 bg-[#007AFF] hover:bg-[#3B82F6] text-white font-heading font-semibold px-8 py-4 rounded-md transition-colors"
                >
                  <Usb size={18} /> Flash Firmware Sekarang
                </button>
                <span slot="unsupported" className="text-sm text-rose-400">
                  Browser tidak didukung. Gunakan Chrome/Edge desktop.
                </span>
                <span slot="not-allowed" className="text-sm text-rose-400">
                  WebSerial diblokir. Buka halaman via HTTPS.
                </span>
              </esp-web-install-button>
            ) : (
              <Button disabled className="bg-zinc-800 text-zinc-500 px-8 py-4">
                Memuat ESP Web Tools…
              </Button>
            )}
          </div>

          <p className="mt-4 font-mono text-[11px] text-zinc-600 break-all max-w-md">
            manifest: {manifestUrl}
          </p>
        </motion.div>

        {/* Steps */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-8 bg-zinc-900/70 backdrop-blur-xl border border-white/10 rounded-lg p-6"
        >
          <h2 className="font-heading text-lg font-semibold text-white flex items-center gap-2 mb-5">
            <ListChecks size={18} /> Panduan Flashing
          </h2>
          <ol className="space-y-4">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <li key={i} className="flex items-start gap-4">
                  <div className="w-8 h-8 shrink-0 rounded-md bg-zinc-950 border border-zinc-800 flex items-center justify-center text-[#3B82F6] font-mono text-sm">
                    {i + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                      <Icon size={14} className="text-zinc-400" /> {s.title}
                    </div>
                    <p className="text-sm text-zinc-500 mt-0.5">{s.desc}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </motion.div>
      </div>
    </div>
  );
}
