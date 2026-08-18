'use client';

// =============================================================================
// EnvironmentView — Ambient temperature / humidity (brief §20, §39)
// -----------------------------------------------------------------------------
// Clearly labeled as AMBIENT/ENVIRONMENTAL (NOT battery temperature —
// brief §20 explicitly forbids mislabeling SHT31 as battery T).
// =============================================================================
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Thermometer, Droplets, Wind } from 'lucide-react';
import type { EnvironmentStatus } from '@/lib/types';

export function EnvironmentView({ environment }: { environment?: EnvironmentStatus }) {
  if (!environment) return null;
  const t = environment.temperature;
  const h = environment.humidity;
  const valid = environment.valid && t != null && h != null;

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-status-info/15 p-1.5">
            <Wind className="w-4 h-4 text-status-info" />
          </div>
          <CardTitle className="text-sm font-semibold">Environment (Ambient)</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        <Metric
          icon={Thermometer}
          label="Temperature"
          value={valid ? `${t!.toFixed(1)} °C` : 'N/A'}
          state={valid ? (t! > 45 || t! < -10 ? 'warn' : 'ok') : 'unavailable'}
        />
        <Metric
          icon={Droplets}
          label="Humidity"
          value={valid ? `${h!.toFixed(1)} %` : 'N/A'}
          state={valid ? (h! > 90 || h! < 10 ? 'warn' : 'ok') : 'unavailable'}
        />
      </CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon, label, value, state,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  state: 'ok' | 'warn' | 'unavailable';
}) {
  const cls = state === 'warn'
    ? 'border-status-warn/40 bg-status-warn/5 text-status-warn'
    : state === 'ok'
    ? 'border-border/40 bg-card/50'
    : 'border-muted-foreground/30 bg-muted/20 opacity-60';
  return (
    <div className={cn('rounded-md border px-2 py-1.5', cls)}>
      <div className="flex items-center gap-1.5">
        <Icon className="w-3 h-3 text-muted-foreground" />
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-base font-bold mt-0.5">{value}</p>
    </div>
  );
}
