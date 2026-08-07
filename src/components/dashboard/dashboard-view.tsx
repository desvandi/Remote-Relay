'use client';

import { useLanguage } from '@/components/providers/language-provider';
import { useStatus, useRelayMutation } from '@/hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Power, PowerOff, Clock, Activity, AlertTriangle, Radar,
  Zap, Cpu, HardDrive, Signal, Calendar,
} from 'lucide-react';
import { formatUptime, formatTime, formatRssi } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Channel, RelaySource } from '@/lib/types';

export function DashboardView() {
  const { t, lang } = useLanguage();
  const { data: status, isLoading } = useStatus();

  if (isLoading || !status) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const rssi = formatRssi(status.wifiRssi);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('dashboard.subtitle')}</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={Zap}
          label={t('dashboard.relays_on')}
          value={`${status.stats.relaysOn}/12`}
          accent="on"
        />
        <StatCard
          icon={Calendar}
          label={t('dashboard.schedules_active')}
          value={String(status.stats.schedulesActive)}
          accent="info"
        />
        <StatCard
          icon={Radar}
          label={t('dashboard.pir_triggers_today')}
          value={String(status.stats.pirTriggersToday)}
          accent="info"
        />
        <StatCard
          icon={AlertTriangle}
          label={t('dashboard.errors_today')}
          value={String(status.stats.errorsToday)}
          accent={status.stats.errorsToday > 0 ? 'error' : 'off'}
        />
      </div>

      {/* System info row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        <MiniStat icon={Clock} label={t('dashboard.uptime')} value={formatUptime(status.uptimeSeconds, lang)} />
        <MiniStat icon={Cpu} label={t('dashboard.cpu_load')} value={`${status.cpuLoadPercent}%`} />
        <MiniStat icon={HardDrive} label={t('dashboard.free_heap')} value={`${Math.round(status.freeHeap / 1024)} KB`} />
        <MiniStat icon={Activity} label={t('dashboard.flash_free')} value={`${status.flashFreePercent}%`} />
        <MiniStat icon={Signal} label={t('dashboard.wifi_rssi')} value={`${status.wifiRssi} dBm (${rssi.bars}/4)`} />
        <MiniStat icon={Clock} label={t('dashboard.current_time')} value={formatTime(status.currentTime, status.timezone, lang)} mono />
      </div>

      {/* Power monitoring (ACS712) */}
      {status.acs712Available && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Zap} label="Total Current" value={`${(status.totalCurrentA ?? 0).toFixed(2)} A`} accent="info" />
          <StatCard icon={Zap} label="Total Power" value={`${(status.totalPowerW ?? 0).toFixed(0)} W`} accent="on" />
          <StatCard icon={Activity} label="Total Energy" value={`${(status.totalEnergyWh ?? 0).toFixed(1)} Wh`} accent="warn" />
          <StatCard icon={Activity} label="Est. Cost" value={`Rp ${((status.totalEnergyWh ?? 0) / 1000 * 1467).toFixed(0)}`} accent="off" />
        </div>
      )}

      {/* Relay grid */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
          12 Relay Channels
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {status.channels.map((ch) => (
            <RelayCard key={ch.id} channel={ch} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: 'on' | 'off' | 'warn' | 'error' | 'info';
}) {
  const accentMap: Record<string, string> = {
    on: 'text-status-on bg-status-on/10',
    off: 'text-status-off bg-status-off/10',
    warn: 'text-status-warn bg-status-warn/10',
    error: 'text-status-error bg-status-error/10',
    info: 'text-status-info bg-status-info/10',
  };
  return (
    <Card className="overflow-hidden border-border/60">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
          </div>
          <div className={cn('rounded-lg p-2', accentMap[accent])}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/40 bg-card/50">
      <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground truncate">{label}</p>
        <p className={cn('text-xs font-semibold truncate', mono && 'font-mono')}>{value}</p>
      </div>
    </div>
  );
}

const SOURCE_LABELS: Record<RelaySource, { key: 'dashboard.source_manual' | 'dashboard.source_schedule' | 'dashboard.source_pir' | 'dashboard.source_off'; color: string }> = {
  manual: { key: 'dashboard.source_manual', color: 'text-status-info' },
  schedule: { key: 'dashboard.source_schedule', color: 'text-status-on' },
  pir: { key: 'dashboard.source_pir', color: 'text-status-warn' },
  off: { key: 'dashboard.source_off', color: 'text-muted-foreground' },
};

function RelayCard({ channel }: { channel: Channel }) {
  const { t } = useLanguage();
  const mutation = useRelayMutation();
  const isOn = channel.state;
  const sourceInfo = SOURCE_LABELS[channel.source];

  const onToggle = () => {
    // Force manual mode + toggle
    mutation.mutate({
      channelId: channel.id,
      action: 'toggle',
      mode: 'manual',
      manualState: !channel.manualState,
    });
  };

  const onModeChange = (auto: boolean) => {
    mutation.mutate({
      channelId: channel.id,
      action: 'set_mode',
      mode: auto ? 'auto' : 'manual',
      manualState: channel.manualState,
    });
  };

  return (
    <Card
      className={cn(
        'relative overflow-hidden transition-all border-border/60',
        isOn && 'border-status-on/30 status-glow-on'
      )}
    >
      <CardHeader className="pb-2 space-y-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-muted-foreground">CH{String(channel.id).padStart(2, '0')}</span>
              {channel.hasPir && (
                <Radar className="w-3 h-3 text-status-warn" aria-label="PIR" />
              )}
            </div>
            <CardTitle className="text-sm font-semibold truncate mt-0.5">{channel.name}</CardTitle>
          </div>
          <div className={cn('status-dot', isOn ? 'status-dot-on' : 'status-dot-off')} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        {/* Big status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                'rounded-lg p-2 transition-colors',
                isOn ? 'bg-status-on/15 text-status-on' : 'bg-muted text-muted-foreground'
              )}
            >
              {isOn ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
            </div>
            <div>
              <p className={cn('text-lg font-bold leading-none', isOn ? 'text-status-on' : 'text-muted-foreground')}>
                {isOn ? 'ON' : 'OFF'}
              </p>
              <p className={cn('text-[10px] font-medium mt-0.5', sourceInfo.color)}>
                via {t(sourceInfo.key)}
              </p>
            </div>
          </div>
          {/* Mode switch */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1">
              <span className={cn('text-[10px] font-medium', !channel.modeAuto && 'text-foreground')}>
                {t('dashboard.mode_manual')}
              </span>
              <Switch
                checked={channel.modeAuto}
                onCheckedChange={onModeChange}
                disabled={mutation.isPending}
                aria-label="Mode"
              />
              <span className={cn('text-[10px] font-medium', channel.modeAuto && 'text-foreground')}>
                {t('dashboard.mode_auto')}
              </span>
            </div>
          </div>
        </div>

        {/* Action button */}
        <Button
          onClick={onToggle}
          disabled={mutation.isPending}
          variant={isOn ? 'secondary' : 'default'}
          size="sm"
          className="w-full"
        >
          {isOn ? (
            <>
              <PowerOff className="w-3.5 h-3.5 mr-1.5" />
              {t('dashboard.toggle_relay')} OFF
            </>
          ) : (
            <>
              <Power className="w-3.5 h-3.5 mr-1.5" />
              {t('dashboard.toggle_relay')} ON
            </>
          )}
        </Button>

        {/* Footer info */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>
            {channel.pirEnabled ? (
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 border-status-warn/30 text-status-warn">
                PIR ON
              </Badge>
            ) : channel.hasPir ? (
              <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 opacity-50">
                PIR OFF
              </Badge>
            ) : null}
          </span>
          <span className="font-mono">
            {channel.pirEnabled ? `${channel.pirHoldTime}s hold` : ''}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
