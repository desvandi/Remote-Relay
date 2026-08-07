'use client';

import { useState, useRef } from 'react';
import { useLanguage } from '@/components/providers/language-provider';
import { useStatus, useDeviceConfigMutation, useChangePassword, useExportConfig, useImportConfig, useFactoryResetPrepare, useFactoryResetConfirm, useTimeMutation, useReboot } from '@/hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Clock, Globe, Lock, Database, RotateCcw, Download, Upload,
  Save, AlertTriangle, ShieldAlert, Cloud, RefreshCw, Power,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const TIMEZONES = [
  'Asia/Jakarta',
  'Asia/Makassar',
  'Asia/Jayapura',
  'Asia/Pontianak',
  'UTC',
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'Asia/Tokyo',
];

export function SettingsView() {
  const { t } = useLanguage();
  const { data: status, isLoading } = useStatus();

  if (isLoading || !status) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('settings.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <TimezoneCard currentTz={status.timezone} currentDevice={status.deviceName} />
        <RtcTimeCard />
        <PasswordChangeCard />
        <BackupRestoreCard />
        <RebootCard />
        <FactoryResetCard />
      </div>
    </div>
  );
}

function TimezoneCard({ currentTz, currentDevice }: { currentTz: string; currentDevice: string }) {
  const { t } = useLanguage();
  const mutation = useDeviceConfigMutation();
  const [tz, setTz] = useState(currentTz);
  const [deviceName, setDeviceName] = useState(currentDevice);
  const dirty = tz !== currentTz || deviceName !== currentDevice;

  const onSave = () => {
    mutation.mutate({ deviceName, timezone: tz });
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          {t('settings.timezone')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Device Name</Label>
          <Input value={deviceName} onChange={(e) => setDeviceName(e.target.value)} maxLength={32} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('settings.timezone')}</Label>
          <Select value={tz} onValueChange={setTz}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((z) => (
                <SelectItem key={z} value={z}>{z}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {dirty && (
          <Button onClick={onSave} disabled={mutation.isPending} size="sm" className="w-full">
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {t('common.save')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function RtcTimeCard() {
  const { t } = useLanguage();
  const mutation = useTimeMutation();
  const [dt, setDt] = useState('');

  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const localNow = now.toISOString().slice(0, 16);

  const onSync = () => {
    const iso = dt || new Date().toISOString();
    mutation.mutate(iso);
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          {t('settings.set_rtc')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">Datetime (DS3231)</Label>
          <Input type="datetime-local" value={dt || localNow} onChange={(e) => setDt(e.target.value)} />
        </div>
        <Button onClick={onSync} disabled={mutation.isPending} size="sm" className="w-full">
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          {t('settings.sync_now')}
        </Button>
      </CardContent>
    </Card>
  );
}

function PasswordChangeCard() {
  const { t } = useLanguage();
  const mutation = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const strength = getStrength(next);
  const match = next === confirm;
  const canSubmit = current && next.length >= 8 && match;

  const onSubmit = () => {
    mutation.mutate(
      { current, next },
      {
        onSuccess: () => {
          setCurrent('');
          setNext('');
          setConfirm('');
        },
      }
    );
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Lock className="w-4 h-4 text-primary" />
          {t('settings.change_password')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <Label className="text-xs">{t('settings.current_password')}</Label>
          <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('settings.new_password')}</Label>
          <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          {next && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="flex-1 grid grid-cols-4 gap-1 h-1">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded-full transition-colors',
                      i < strength.score
                        ? strength.score <= 1 ? 'bg-status-error'
                        : strength.score <= 2 ? 'bg-status-warn'
                        : 'bg-status-on'
                        : 'bg-muted'
                    )}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">{strength.label}</span>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t('settings.confirm_password')}</Label>
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          {confirm && !match && <p className="text-[10px] text-status-error mt-1">Passwords do not match</p>}
        </div>
        <Button onClick={onSubmit} disabled={!canSubmit || mutation.isPending} size="sm" className="w-full">
          {t('common.save')}
        </Button>
      </CardContent>
    </Card>
  );
}

function getStrength(pw: string): { score: number; label: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score, label: labels[score] };
}

function BackupRestoreCard() {
  const { t } = useLanguage();
  const exportMut = useExportConfig();
  const importMut = useImportConfig();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const cfg = JSON.parse(reader.result as string);
        importMut.mutate(cfg);
      } catch {
        toast.error('Invalid config file');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          {t('settings.backup_restore')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button onClick={() => exportMut.mutate()} disabled={exportMut.isPending} variant="outline" size="sm" className="w-full justify-start">
          <Download className="w-3.5 h-3.5 mr-2" />
          {t('settings.export_config')}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={onImport}
          className="hidden"
        />
        <Button onClick={() => fileInputRef.current?.click()} disabled={importMut.isPending} variant="outline" size="sm" className="w-full justify-start">
          <Upload className="w-3.5 h-3.5 mr-2" />
          {t('settings.import_config')}
        </Button>
        <Button variant="ghost" size="sm" className="w-full justify-start text-muted-foreground" onClick={() => toast.info('Fitur backup ke GAS akan tersedia setelah Apps Script di-deploy.')}>
          <Cloud className="w-3.5 h-3.5 mr-2" />
          {t('settings.backup_to_gas')}
        </Button>
      </CardContent>
    </Card>
  );
}

function RebootCard() {
  const { t } = useLanguage();
  const mutation = useReboot();
  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Power className="w-4 h-4 text-primary" />
          Reboot System
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Restart ESP32. Scheduler tetap berjalan dari RTC setelah reboot. Koneksi akan terputus sebentar.
        </p>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} variant="outline" size="sm" className="w-full">
          <RefreshCw className={cn('w-3.5 h-3.5 mr-1.5', mutation.isPending && 'animate-spin')} />
          Reboot
        </Button>
      </CardContent>
    </Card>
  );
}

function FactoryResetCard() {
  const { t } = useLanguage();
  const prepareMut = useFactoryResetPrepare();
  const confirmMut = useFactoryResetConfirm();
  const [token, setToken] = useState('');
  const [confirmStr, setConfirmStr] = useState('');

  const onPrepare = () => {
    prepareMut.mutate(undefined, {
      onSuccess: (data) => {
        setToken(data.token);
        toast.info(`Token dibuat (valid 60 detik)`);
      },
    });
  };

  const onConfirm = () => {
    if (confirmStr !== 'RESET') {
      toast.error('Ketik "RESET" untuk konfirmasi');
      return;
    }
    confirmMut.mutate(token, {
      onSuccess: () => {
        setToken('');
        setConfirmStr('');
      },
    });
  };

  return (
    <Card className="border-status-error/30">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2 text-status-error">
          <ShieldAlert className="w-4 h-4" />
          {t('settings.factory_reset')}
        </CardTitle>
        <CardDescription className="text-status-error/80">
          Danger Zone
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>Peringatan</AlertTitle>
          <AlertDescription>{t('settings.factory_reset_warning')}</AlertDescription>
        </Alert>

        {!token ? (
          <Button onClick={onPrepare} variant="destructive" size="sm" className="w-full" disabled={prepareMut.isPending}>
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            {t('settings.factory_reset_prepare')}
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="space-y-1">
              <Label className="text-xs">{t('settings.factory_reset_token')}</Label>
              <Input value={token} readOnly className="font-mono text-xs bg-muted" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ketik "RESET" untuk konfirmasi</Label>
              <Input value={confirmStr} onChange={(e) => setConfirmStr(e.target.value)} placeholder="RESET" />
            </div>
            <div className="flex gap-2">
              <Button onClick={onConfirm} variant="destructive" size="sm" disabled={confirmMut.isPending} className="flex-1">
                {t('settings.factory_reset_confirm')}
              </Button>
              <Button onClick={() => { setToken(''); setConfirmStr(''); }} variant="outline" size="sm">
                {t('common.cancel')}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
