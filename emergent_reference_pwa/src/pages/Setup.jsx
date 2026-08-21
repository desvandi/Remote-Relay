import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Link2,
  KeyRound,
  Cpu,
  Zap,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  TerminalSquare,
  ShieldCheck,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useConfig } from "@/context/ConfigContext";
import { isValidGasUrl, isValidToken } from "@/lib/storage";
import { pingGas } from "@/lib/gas";

const BG = "https://images.pexels.com/photos/37730212/pexels-photo-37730212.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";

const STEPS = [
  { id: 1, title: "URL Apps Script", icon: Link2 },
  { id: 2, title: "Kredensial Perangkat", icon: KeyRound },
  { id: 3, title: "Uji & Simpan", icon: ShieldCheck },
];

export default function Setup() {
  const navigate = useNavigate();
  const { config, saveConfig } = useConfig();

  const [step, setStep] = useState(1);
  const [gasUrl, setGasUrl] = useState(config?.gas_webapp_url || "");
  const [token, setToken] = useState(config?.auth_token || "");
  const [deviceId, setDeviceId] = useState(config?.device_id || "RELAY_CTRL_01");

  const [testState, setTestState] = useState("idle"); // idle | testing | validated | error
  const [logs, setLogs] = useState([]);
  const logRef = useRef(null);

  const urlValid = isValidGasUrl(gasUrl);
  const tokenValid = isValidToken(token);
  const deviceValid = deviceId.trim().length >= 1;

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  // Reset validation if the user edits credentials after validating.
  useEffect(() => {
    setTestState("idle");
  }, [gasUrl, token, deviceId]);

  const pushLog = (line, kind = "info") =>
    setLogs((prev) => [...prev, { line, kind, t: new Date().toLocaleTimeString("id-ID") }]);

  const runHandshake = async () => {
    setLogs([]);
    setTestState("testing");
    pushLog("Memulai handshake pra-simpan…", "info");
    pushLog(`POST ${gasUrl}`, "dim");
    pushLog(`payload → {"action":"PING","token":"${token.slice(0, 4)}••••"}`, "dim");
    pushLog("Batas waktu maksimal 7000ms…", "dim");

    const res = await pingGas(gasUrl, token, 7000);

    if (res.ok) {
      pushLog(`✓ Respon diterima dalam ${res.latency}ms`, "success");
      pushLog('✓ {"status":"SUCCESS","message":"PONG"}', "success");
      pushLog("Koneksi TERVALIDASI. Tombol Simpan diaktifkan.", "success");
      setTestState("validated");
    } else {
      pushLog(`✗ ${res.error}`, "error");
      pushLog("Koneksi GAGAL. Periksa URL & Token lalu coba lagi.", "error");
      setTestState("error");
    }
  };

  const handleSave = () => {
    if (testState !== "validated") return;
    saveConfig({
      gas_webapp_url: gasUrl.trim(),
      auth_token: token.trim(),
      device_id: deviceId.trim(),
    });
    toast.success("Konfigurasi tersimpan", {
      description: "Perangkat siap dikendalikan dari dasbor.",
    });
    navigate("/");
  };

  const canNext = (step === 1 && urlValid) || (step === 2 && tokenValid && deviceValid);

  return (
    <div className="min-h-screen relative z-10 flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 z-0">
        <img src={BG} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-zinc-950/90" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 w-full max-w-2xl"
      >
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-lg bg-[#007AFF] flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Zap size={22} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-white">
              Setup Awal Relay Timer
            </h1>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              Zero-Touch · Konfigurasi Runtime
            </p>
          </div>
        </div>

        {/* Stepper */}
        <div className="flex items-center mb-8" data-testid="setup-stepper">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const done = step > s.id;
            const active = step === s.id;
            return (
              <React.Fragment key={s.id}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center border transition-colors ${
                      active
                        ? "bg-[#007AFF] border-[#007AFF] text-white"
                        : done
                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                        : "bg-zinc-900 border-zinc-800 text-zinc-600"
                    }`}
                  >
                    {done ? <Check size={16} /> : <Icon size={16} />}
                  </div>
                  <span
                    className={`hidden sm:block text-xs font-medium ${
                      active ? "text-white" : "text-zinc-500"
                    }`}
                  >
                    {s.title}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-3 ${done ? "bg-emerald-500/40" : "bg-zinc-800"}`}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="bg-zinc-900 border border-zinc-700/60 rounded-lg p-6 sm:p-8 shadow-2xl shadow-black/60">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="s1"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="space-y-5"
              >
                <div>
                  <Label className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">
                    GAS WebApp URL
                  </Label>
                  <p className="text-sm text-zinc-400 mt-1 mb-3">
                    Tempel URL deployment Apps Script Anda (diakhiri dengan <code className="font-mono text-zinc-300">/exec</code>).
                  </p>
                  <Input
                    data-testid="setup-gas-url-input"
                    value={gasUrl}
                    onChange={(e) => setGasUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                    className="font-mono text-sm bg-zinc-950 border-zinc-800 focus-visible:ring-[#007AFF]"
                  />
                  {gasUrl && !urlValid && (
                    <p className="text-xs text-rose-400 mt-2" data-testid="setup-url-error">
                      Format URL tidak valid. Harus berupa URL /exec Apps Script.
                    </p>
                  )}
                  {urlValid && (
                    <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                      <Check size={12} /> Format URL valid.
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="s2"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="space-y-5"
              >
                <div>
                  <Label className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">
                    Auth Token
                  </Label>
                  <p className="text-sm text-zinc-400 mt-1 mb-3">
                    Sama persis dengan nilai <code className="font-mono text-zinc-300">AUTH_TOKEN</code> pada tab Config di Google Sheet.
                  </p>
                  <Input
                    data-testid="setup-token-input"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="usr_sec_99a8b7c6d5e4f3a21"
                    className="font-mono text-sm bg-zinc-950 border-zinc-800 focus-visible:ring-[#007AFF]"
                  />
                  {token && !tokenValid && (
                    <p className="text-xs text-rose-400 mt-2" data-testid="setup-token-error">
                      Token minimal 16 karakter alphanumerik (huruf, angka, underscore).
                    </p>
                  )}
                  {tokenValid && (
                    <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                      <Check size={12} /> Token memenuhi syarat keamanan.
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">
                    Device Key / ID
                  </Label>
                  <p className="text-sm text-zinc-400 mt-1 mb-3">
                    Identifier unik ESP32 (mis. <code className="font-mono text-zinc-300">RELAY_CTRL_01</code>).
                  </p>
                  <Input
                    data-testid="setup-device-input"
                    value={deviceId}
                    onChange={(e) => setDeviceId(e.target.value)}
                    placeholder="RELAY_CTRL_01"
                    className="font-mono text-sm bg-zinc-950 border-zinc-800 focus-visible:ring-[#007AFF]"
                  />
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="s3"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                className="space-y-5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs uppercase tracking-[0.2em] text-zinc-500 font-semibold">
                      Live Connection Test
                    </Label>
                    <p className="text-sm text-zinc-400 mt-1">
                      Handshake wajib berhasil sebelum konfigurasi dapat disimpan.
                    </p>
                  </div>
                  {testState === "validated" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 rounded-full">
                      <ShieldCheck size={13} /> VALIDATED
                    </span>
                  )}
                  {testState === "error" && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-mono text-rose-400 border border-rose-500/30 bg-rose-500/10 px-3 py-1 rounded-full">
                      <X size={13} /> FAILED
                    </span>
                  )}
                </div>

                <div
                  ref={logRef}
                  data-testid="setup-terminal"
                  className="term-scroll bg-zinc-950 border border-zinc-800 rounded-md p-4 h-52 overflow-y-auto font-mono text-xs leading-relaxed"
                >
                  <div className="flex items-center gap-2 text-zinc-600 mb-2">
                    <TerminalSquare size={13} /> handshake.log
                  </div>
                  {logs.length === 0 && (
                    <p className="text-zinc-600">
                      Klik "Uji &amp; Simpan Koneksi" untuk memulai handshake…
                    </p>
                  )}
                  {logs.map((l, i) => (
                    <div
                      key={i}
                      className={
                        l.kind === "success"
                          ? "text-emerald-400"
                          : l.kind === "error"
                          ? "text-rose-400"
                          : l.kind === "dim"
                          ? "text-zinc-600"
                          : "text-zinc-300"
                      }
                    >
                      <span className="text-zinc-700">[{l.t}]</span> {l.line}
                    </div>
                  ))}
                  {testState === "testing" && <div className="text-amber-400 term-cursor" />}
                </div>

                <Button
                  data-testid="setup-test-btn"
                  onClick={runHandshake}
                  disabled={testState === "testing"}
                  className="w-full bg-[#007AFF] hover:bg-[#3B82F6] text-white font-semibold"
                >
                  {testState === "testing" ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" /> Menghubungkan…
                    </>
                  ) : (
                    <>
                      <Zap size={16} className="mr-2" /> Uji &amp; Simpan Koneksi
                    </>
                  )}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Nav buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-800">
            <Button
              variant="ghost"
              data-testid="setup-back-btn"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="text-zinc-400 hover:text-white"
            >
              <ChevronLeft size={16} className="mr-1" /> Kembali
            </Button>

            {step < 3 ? (
              <Button
                data-testid="setup-next-btn"
                onClick={() => canNext && setStep((s) => s + 1)}
                disabled={!canNext}
                className="bg-[#007AFF] hover:bg-[#3B82F6] text-white font-semibold"
              >
                Lanjut <ChevronRight size={16} className="ml-1" />
              </Button>
            ) : (
              <Button
                data-testid="setup-save-btn"
                onClick={handleSave}
                disabled={testState !== "validated"}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold disabled:opacity-40"
              >
                <Check size={16} className="mr-1" /> Simpan Konfigurasi
              </Button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-6 flex items-center justify-center gap-2">
          <Cpu size={12} /> Perlu flash firmware dulu?{" "}
          <button
            onClick={() => navigate("/install")}
            data-testid="setup-goto-install"
            className="text-[#007AFF] hover:underline"
          >
            Buka halaman Flash Firmware
          </button>
        </p>
      </motion.div>
    </div>
  );
}
