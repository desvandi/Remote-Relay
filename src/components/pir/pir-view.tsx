'use client';

import { useLanguage } from '@/components/providers/language-provider';
import { useStatus, usePirMutation, usePirTest } from '@/hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Radar, Activity, AlertTriangle, Zap, Clock, FlaskConical, Power,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/format';
import { useEffect, useState } from 'react';

export function PirView() {
  const { t, lang } = useLanguage();
  const { data: status, isLoading } = useStatus();

  if (isLoading || !status) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('pir.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('pir.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {status.pirs.map((pir) => {
          const channel = status.channels.find((c) => c.id === pir.channelId);
          return <PirCard key={pir.id} pir={pir} channelName={channel?.name ?? `CH${pir.channelId}`} lang={lang} />;
        })}
      </div>
    </div>
  );
}

function PirCard({
  pir,
  channelName,
  lang,
}: {
  pir: import('@/lib/types').PIRState;
  channelName: string;
  lang: 'id' | 'en';
}) {
  const { t } = useLanguage();
  const pirMutation = usePirMutation();
  const testMutation = usePirTest();
  const [holdTime, setHoldTime] = useState(pir.holdTime);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const inWarmup = now < pir.warmupUntil;
  const warmupRemaining = Math.max(0, Math.ceil((pir.warmupUntil - now) / 1000));

  const onHoldTimeChange = (val: number[]) => {
    setHoldTime(val[0]);
  };
  const onHoldTimeCommit = (val: number[]) => {
    pirMutation.mutate({ id: pir.id, holdTime: val[0] });
  };
  const onToggleEnabled = (enabled: boolean) => {
    pirMutation.mutate({ id: pir.id, enabled });
  };
  const onTest = () => testMutation.mutate(pir.id);

  return (
    <Card className={cn(
      'border-border/60 transition-all',
      pir.motionNow && 'border-status-warn/40 shadow-md',
      pir.stuckDetected && 'border-status-error/50',
      !pir.enabled && 'opacity-60'
    )}>
      <CardHeader className="pb-2 space-y-0">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-1.5">
              <Radar className={cn('w-4 h-4', pir.motionNow ? 'text-status-warn animate-pulse' : 'text-muted-foreground')} />
              <span className="text-[10px] font-mono text-muted-foreground">PIR {pir.id}</span>
            </div>
            <CardTitle className="text-sm mt-0.5">{channelName}</CardTitle>
            <p className="text-[10px] text-muted-foreground">CH{pir.channelId}</p>
          </div>
          <Switch checked={pir.enabled} onCheckedChange={onToggleEnabled} disabled={pirMutation.isPending} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Status */}
        <div className={cn(
          'rounded-lg p-3 flex items-center gap-3 transition-colors',
          inWarmup ? 'bg-status-info/10' :
          pir.stuckDetected ? 'bg-status-error/10' :
          pir.motionNow ? 'bg-status-warn/10' : 'bg-muted/30'
        )}>
          <div className={cn(
            'rounded-lg p-2',
            inWarmup ? 'bg-status-info/20 text-status-info' :
            pir.stuckDetected ? 'bg-status-error/20 text-status-error' :
            pir.motionNow ? 'bg-status-warn/20 text-status-warn' : 'bg-muted text-muted-foreground'
          )}>
            {inWarmup ? <Clock className="w-5 h-5" /> :
             pir.stuckDetected ? <AlertTriangle className="w-5 h-5" /> :
             pir.motionNow ? <Activity className="w-5 h-5" /> :
             <Radar className="w-5 h-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">
              {inWarmup ? `${t('pir.warmup')} ${warmupRemaining}s` :
               pir.stuckDetected ? t('pir.stuck_alert') :
               pir.motionNow ? t('pir.motion_detected') :
               t('pir.no_motion')}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {t('pir.last_motion')}: {formatRelativeTime(pir.lastMotionAt, lang)}
            </p>
          </div>
          {pir.motionNow && (
            <div className="status-dot status-dot-warn animate-pulse" />
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md bg-muted/30 px-3 py-2">
            <p className="text-[10px] text-muted-foreground">{t('pir.triggers_today')}</p>
            <p className="text-lg font-bold font-mono">{pir.triggerCountToday}</p>
          </div>
          <div className="rounded-md bg-muted/30 px-3 py-2">
            <p className="text-[10px] text-muted-foreground">{t('pir.hold_time')}</p>
            <p className="text-lg font-bold font-mono">{pir.holdTime}s</p>
          </div>
        </div>

        {/* Hold time slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs">{t('pir.hold_time')}</Label>
            <span className="text-xs font-mono text-muted-foreground">{holdTime}s</span>
          </div>
          <Slider
            value={[holdTime]}
            onValueChange={onHoldTimeChange}
            onValueCommit={onHoldTimeCommit}
            min={5}
            max={600}
            step={5}
            disabled={!pir.enabled || pirMutation.isPending}
          />
        </div>

        {/* Test trigger */}
        <Button
          variant="outline"
          size="sm"
          onClick={onTest}
          disabled={!pir.enabled || inWarmup || testMutation.isPending}
          className="w-full"
        >
          <FlaskConical className="w-3.5 h-3.5 mr-1.5" />
          {t('pir.test_trigger')}
        </Button>

        {/* Status badges */}
        <div className="flex items-center justify-between text-[10px]">
          <Badge variant={pir.enabled ? 'default' : 'outline'} className="text-[9px] h-4">
            {pir.enabled ? t('common.enabled') : t('common.disabled')}
          </Badge>
          {pir.stuckDetected && (
            <Badge variant="destructive" className="text-[9px] h-4">
              <AlertTriangle className="w-2.5 h-2.5 mr-1" />
              STUCK
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
