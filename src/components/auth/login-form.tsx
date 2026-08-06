'use client';

import { useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { useMqtt } from '@/components/providers/mqtt-provider';
import { useLanguage } from '@/components/providers/language-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Lock, User, Zap, Wifi, ShieldCheck, Cpu, Radio } from 'lucide-react';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { toast } from 'sonner';

export function LoginForm() {
  const { login } = useAuth();
  const { connect, disconnect, connected, deviceId } = useMqtt();
  const { t } = useLanguage();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // MQTT device ID input
  const [macInput, setMacInput] = useState('');
  const [mqttLoading, setMqttLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('login.error_invalid'));
    } finally {
      setLoading(false);
    }
  };

  const onMqttConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const mac = macInput.trim().toUpperCase().replace(/[^A-F0-9]/g, '');
    if (mac.length !== 12) {
      toast.error('Device ID must be 12 hex characters (e.g., A4CF12345678)');
      return;
    }
    setMqttLoading(true);
    try {
      await connect(mac);
      toast.success('Connected to ESP32 via MQTT');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'MQTT connection failed');
    } finally {
      setMqttLoading(false);
    }
  };

  const onMqttDisconnect = () => {
    disconnect();
    setMacInput('');
    toast.info('Disconnected from MQTT');
  };

  return (
    <div className="min-h-screen flex flex-col bg-background bg-grid relative overflow-hidden">
      {/* Top-right controls */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <LanguageSwitcher />
        <ThemeToggle />
      </div>

      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />

      <div className="flex-1 flex items-center justify-center p-4 relative z-1">
        <div className="w-full max-w-md space-y-6">
          {/* Brand */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 mb-2">
              <Zap className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t('app.name')}
            </h1>
            <p className="text-sm text-muted-foreground">{t('app.tagline')}</p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
              <Cpu className="w-3 h-3" /> ESP32
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
              <Wifi className="w-3 h-3" /> Cloud-Ready
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
              <ShieldCheck className="w-3 h-3" /> JWT + CSRF
            </span>
          </div>

          {/* Local Login Card (REST/Mock mode) */}
          <Card className="border-border/50 shadow-xl backdrop-blur-sm">
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl">{t('login.title')}</CardTitle>
              <CardDescription>{t('login.subtitle')} — Local / LAN mode</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">{t('login.username')}</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-9"
                      autoComplete="username"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t('login.password')}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-9"
                      autoComplete="current-password"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                {error && (
                  <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                    {error}
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('common.loading')}
                    </>
                  ) : (
                    t('login.submit')
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  {t('login.demo_creds')}
                </p>
              </form>
            </CardContent>
          </Card>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* MQTT Remote Mode Card */}
          <Card className={connected
            ? "border-status-on/40 shadow-xl backdrop-blur-sm"
            : "border-border/50 shadow-xl backdrop-blur-sm"
          }>
            <CardHeader className="space-y-1">
              <CardTitle className="text-xl flex items-center gap-2">
                <Radio className={`w-5 h-5 ${connected ? 'text-status-on' : 'text-primary'}`} />
                Remote Mode (MQTT)
              </CardTitle>
              <CardDescription>
                {connected
                  ? `Connected to device ${deviceId} — control from anywhere via internet`
                  : 'Control ESP32 from anywhere — no port forwarding needed (works behind MiFi/CGNAT)'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {connected ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-status-on/10 border border-status-on/20">
                    <div className="status-dot status-dot-on animate-pulse" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-status-on">MQTT Connected</p>
                      <p className="text-xs text-muted-foreground">Device: {deviceId}</p>
                    </div>
                  </div>
                  <Button onClick={onMqttDisconnect} variant="outline" className="w-full">
                    Disconnect
                  </Button>
                </div>
              ) : (
                <form onSubmit={onMqttConnect} className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="mac">ESP32 Device ID (MAC Address)</Label>
                    <Input
                      id="mac"
                      type="text"
                      value={macInput}
                      onChange={(e) => setMacInput(e.target.value)}
                      placeholder="e.g., A4CF12345678"
                      className="font-mono uppercase"
                      required
                      disabled={mqttLoading}
                      maxLength={17}
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Found in Serial Monitor: <code className="font-mono">MAC: XXXXXXXXXXXX</code>
                    </p>
                  </div>
                  <Button type="submit" className="w-full" disabled={mqttLoading}>
                    {mqttLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Radio className="w-4 h-4 mr-2" />
                        Connect via MQTT
                      </>
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            v4.0 · PWA · MQTT Remote · {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
