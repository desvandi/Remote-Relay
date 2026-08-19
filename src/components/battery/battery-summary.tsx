'use client';

// =============================================================================
// BatterySummary — top-level battery summary card (brief §35)
// -----------------------------------------------------------------------------
// Displays: Pack Voltage, Battery Current, Battery Power, SOC, Charged Ah,
//           Discharged Ah, Ambient Temperature, Humidity.
// All values come from the strongly-typed BatteryStatus + EnvironmentStatus
// contracts — no `any` (brief §34). Invalid values render as "N/A" rather
// than "0" (brief §38).
// =============================================================================
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Battery, BatteryCharging, BatteryWarning,
  Thermometer, Droplets, Zap, Gauge,
} from 'lucide-react';
import type { BatteryStatus, EnvironmentStatus } from '@/lib/types';

function fmtV(v: number | null | undefined, unit = 'V', digits = 2) {
  if (v == null || !Number.isFinite(v)) return 'N/A';
  return `${v.toFixed(digits)} ${unit}`;
}

function fmtA(v: number | null | undefined, digits = 2) {
  if (v == null || !Number.isFinite(v)) return 'N/A';
  return `${v.toFixed(digits)} A`;
}

function fmtW(v: number | null | undefined, digits = 1) {
  if (v == null || !Number.isFinite(v)) return 'N/A';
  return `${v.toFixed(digits)} W`;
}

function fmtAh(v: number | null | undefined) {
  if (v == null || !Number.isFinite(v)) return 'N/A';
  return `${v.toFixed(2)} Ah`;
}

export function BatterySummary({
  battery,
  environment,
}: {
  battery?: BatteryStatus;
  environment?: EnvironmentStatus;
}) {
  if (!battery) return null;

  const isCharging = (battery.current ?? 0) < 0;
  const isDischarging = (battery.current ?? 0) > 0;
  const soc = battery.socAvailable ? (battery.soc ?? 0) : null;

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-status-info/15 p-1.5">
              <Battery className="w-4 h-4 text-status-info" />
            </div>
            <CardTitle className="text-sm font-semibold">Battery & DC Energy</CardTitle>
          </div>
          <BatteryHealthBadge state={battery.diagnostics.overall} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main pack readouts */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Pack Voltage</p>
            <p className="text-lg font-bold leading-tight">
              {fmtV(battery.packVoltage, 'V', 2)}
            </p>
            <p className="text-[9px] text-muted-foreground">{battery.packVoltageSource}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Battery Current</p>
            <p className={cn(
              'text-lg font-bold leading-tight',
              isCharging && 'text-status-on',
              isDischarging && 'text-status-warn',
            )}>
              {fmtA(battery.current, 2)}
            </p>
            <p className="text-[9px] text-muted-foreground">
              {isCharging ? 'charging' : isDischarging ? 'discharging' : 'idle'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">SOC</p>
            <p className="text-lg font-bold leading-tight">
              {soc != null ? `${soc.toFixed(1)}%` : 'N/A'}
            </p>
            <p className="text-[9px] text-muted-foreground">
              {battery.socSynchronized ? 'synced' : 'coulomb only'}
            </p>
          </div>
        </div>

        {/* Power */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Battery Power</p>
            <p className="text-sm font-bold">
              {fmtW(battery.power)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
              <BatteryCharging className="w-2.5 h-2.5" /> Charging
            </p>
            <p className="text-sm font-bold text-status-on">{fmtW(battery.chargePower)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider flex items-center gap-1">
              <BatteryWarning className="w-2.5 h-2.5" /> Discharging
            </p>
            <p className="text-sm font-bold text-status-warn">{fmtW(battery.dischargePower)}</p>
          </div>
        </div>

        {/* Energy / Environment */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-border/40">
          <Metric icon={Zap} label="Charged" value={fmtAh(battery.chargedAh)} />
          <Metric icon={Zap} label="Discharged" value={fmtAh(battery.dischargedAh)} />
          <Metric
            icon={Thermometer}
            label="Ambient"
            value={environment?.valid && environment.temperature != null
              ? `${environment.temperature.toFixed(1)} °C` : 'N/A'}
          />
          <Metric
            icon={Droplets}
            label="Humidity"
            value={environment?.valid && environment.humidity != null
              ? `${environment.humidity.toFixed(1)} %` : 'N/A'}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon, label, value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="w-3 h-3 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wider truncate">{label}</p>
        <p className="text-xs font-semibold">{value}</p>
      </div>
    </div>
  );
}

function BatteryHealthBadge({ state }: { state: 'NORMAL' | 'WARNING' | 'FAULT' | 'UNAVAILABLE' }) {
  const map = {
    NORMAL:      { label: 'NORMAL',      variant: 'outline' as const, cls: 'border-status-on/30 text-status-on' },
    WARNING:     { label: 'WARNING',     variant: 'outline' as const, cls: 'border-status-warn/30 text-status-warn' },
    FAULT:       { label: 'FAULT',       variant: 'outline' as const, cls: 'border-status-error/30 text-status-error' },
    UNAVAILABLE: { label: 'UNAVAILABLE', variant: 'outline' as const, cls: 'opacity-50' },
  };
  const s = map[state] ?? map.UNAVAILABLE;
  return (
    <Badge variant={s.variant} className={cn('text-[9px] px-1.5 h-4', s.cls)}>
      {s.label}
    </Badge>
  );
}
