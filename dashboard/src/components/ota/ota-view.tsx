'use client';

import { useState, useRef } from 'react';
import { useLanguage } from '@/components/providers/language-provider';
import { useVersion, useOtaCheck, useOtaUpload } from '@/hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Download, Upload, ShieldCheck, RefreshCw, AlertTriangle,
  CheckCircle2, XCircle, History, FileWarning,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/format';

export function OtaView() {
  const { t, lang } = useLanguage();
  const { data: info, isLoading } = useVersion();
  const checkMutation = useOtaCheck();
  const uploadMutation = useOtaUpload();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'verifying' | 'installing' | 'done'>('idle');
  const fileRef = useRef<HTMLInputElement>(null);

  if (isLoading || !info) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const onCheck = () => checkMutation.mutate();

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadPhase('uploading');
    setUploadProgress(0);
    try {
      await uploadMutation.mutateAsync({
        file,
        onProgress: (pct) => {
          setUploadProgress(pct);
          if (pct === 100) setUploadPhase('verifying');
        },
      });
      setUploadPhase('installing');
      setTimeout(() => setUploadPhase('done'), 2000);
    } catch {
      setUploadPhase('idle');
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const statusInfo = {
    'up-to-date': { color: 'text-status-on', bg: 'bg-status-on/10', icon: CheckCircle2, label: t('ota.up_to_date') },
    'update-available': { color: 'text-status-warn', bg: 'bg-status-warn/10', icon: AlertTriangle, label: t('ota.update_available') },
    'uploading': { color: 'text-status-info', bg: 'bg-status-info/10', icon: Upload, label: t('ota.uploading') },
    'verifying': { color: 'text-status-info', bg: 'bg-status-info/10', icon: ShieldCheck, label: t('ota.verifying') },
    'installing': { color: 'text-status-info', bg: 'bg-status-info/10', icon: Download, label: t('ota.installing') },
    'failed': { color: 'text-status-error', bg: 'bg-status-error/10', icon: XCircle, label: t('ota.ota_failed') },
    'rollback': { color: 'text-status-error', bg: 'bg-status-error/10', icon: XCircle, label: t('ota.rollback') },
  }[info.otaStatus];

  const StatusIcon = statusInfo.icon;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('ota.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('ota.subtitle')}</p>
      </div>

      {/* Warning */}
      <div className="rounded-lg border border-status-warn/30 bg-status-warn/5 px-4 py-3 flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-status-warn flex-shrink-0 mt-0.5" />
        <p className="text-sm text-status-warn">{t('ota.warning_stable_power')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Current version */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              <span>{t('ota.current_version')}</span>
              <Badge className={cn('text-xs', statusInfo.bg, statusInfo.color, 'border-0')}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {statusInfo.label}
              </Badge>
            </CardTitle>
            <CardDescription>{info.buildDate}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono">v{info.currentVersion}</span>
              <span className="text-xs text-muted-foreground">(installed)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <ShieldCheck className={cn('w-4 h-4', info.signatureVerified ? 'text-status-on' : 'text-status-error')} />
              <span>{info.signatureVerified ? t('ota.signature_verified') : 'Signature NOT verified'}</span>
            </div>
            {info.lastUpdateAt && (
              <div className="text-xs text-muted-foreground">
                Last update: {formatDateTime(info.lastUpdateAt, undefined, lang)} ·{' '}
                <span className={info.lastUpdateStatus === 'success' ? 'text-status-on' : 'text-status-error'}>
                  {info.lastUpdateStatus}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Latest version */}
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-sm flex items-center justify-between">
              <span>{t('ota.latest_version')}</span>
              {info.updateAvailable && (
                <Badge variant="outline" className="text-status-warn border-status-warn/30">
                  {t('ota.update_available')}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>GitHub Release</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono">v{info.latestAvailable}</span>
              {info.updateAvailable && (
                <span className="text-xs text-status-warn">↑ available</span>
              )}
            </div>
            <Button onClick={onCheck} variant="outline" size="sm" disabled={checkMutation.isPending}>
              {checkMutation.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              )}
              {t('ota.check_update')}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Upload binary */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Upload className="w-4 h-4" />
            {t('ota.upload_binary')}
          </CardTitle>
          <CardDescription>
            Upload firmware.bin (max 2 MB) · ESP32 will verify signature before installing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".bin"
            onChange={onFileSelected}
            disabled={uploadPhase !== 'idle' && uploadPhase !== 'done'}
            className="hidden"
          />
          {uploadPhase === 'idle' && (
            <Button onClick={() => fileRef.current?.click()} disabled={uploadMutation.isPending}>
              <Upload className="w-3.5 h-3.5 mr-1.5" />
              {t('ota.upload_binary')}
            </Button>
          )}
          {uploadPhase !== 'idle' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  {uploadPhase === 'uploading' && <Upload className="w-4 h-4 text-status-info" />}
                  {uploadPhase === 'verifying' && <ShieldCheck className="w-4 h-4 text-status-info" />}
                  {uploadPhase === 'installing' && <Download className="w-4 h-4 text-status-info" />}
                  {uploadPhase === 'done' && <CheckCircle2 className="w-4 h-4 text-status-on" />}
                  {uploadPhase === 'uploading' && t('ota.uploading')}
                  {uploadPhase === 'verifying' && t('ota.verifying')}
                  {uploadPhase === 'installing' && t('ota.installing')}
                  {uploadPhase === 'done' && t('ota.up_to_date')}
                </span>
                <span className="font-mono text-xs">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
              {uploadPhase === 'done' && (
                <Button variant="outline" size="sm" onClick={() => setUploadPhase('idle')}>
                  Upload Another
                </Button>
              )}
            </div>
          )}
          <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md p-2.5">
            <FileWarning className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
            <p>OTA flow: GitHub Release → ESP32 cek versi → Download → Verify Signature → Install → Rollback jika gagal. Pada mode mock, OTA disimulasikan dengan 90% tingkat keberhasilan.</p>
          </div>
        </CardContent>
      </Card>

      {/* OTA History */}
      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="w-4 h-4" />
            {t('ota.history')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Show mock history if empty */}
          {info.lastUpdateAt === null ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Belum ada riwayat OTA. Update pertama akan muncul di sini.
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              <div className="flex items-center gap-3 px-4 py-2.5">
                <CheckCircle2 className="w-4 h-4 text-status-on" />
                <div className="flex-1">
                  <p className="text-sm">OTA update completed</p>
                  <p className="text-xs text-muted-foreground">
                    {info.lastUpdateAt && formatDateTime(info.lastUpdateAt, undefined, lang)}
                  </p>
                </div>
                <Badge variant="outline" className="text-status-on border-status-on/30">
                  {info.lastUpdateStatus ?? 'success'}
                </Badge>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
