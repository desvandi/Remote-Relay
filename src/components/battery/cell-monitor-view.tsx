'use client';

// =============================================================================
// CellMonitorView — 8-cell voltage visualization (brief §37)
// -----------------------------------------------------------------------------
// Display: 8 cell voltages + Min / Max / Delta + visual warning states for
//   undervoltage, overvoltage, imbalance, invalid, tap fault.
// Per brief §37: do NOT use red/green as the only indication — include
//   text/status labels for accessibility.
// =============================================================================
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Layers } from 'lucide-react';
import type { BatteryStatus, CellSensorState } from '@/lib/types';

const CELL_LABELS: Record<CellSensorState, string> = {
  ok: 'OK',
  i2c_error: 'I2C ERR',
  tap_fault: 'TAP FAULT',
  invalid_value: 'INVALID',
  range_fault: 'RANGE',
  stale: 'STALE',
};

export function CellMonitorView({ battery }: { battery?: BatteryStatus }) {
  if (!battery) return null;
  const cells = battery.cells ?? [];
  const cm = battery.cellMetrics;

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-status-info/15 p-1.5">
            <Layers className="w-4 h-4 text-status-info" />
          </div>
          <CardTitle className="text-sm font-semibold">Cell Monitor (8S)</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Cell grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {cells.map((c) => (
            <CellTile key={c.index} voltage={c.voltage} state={c.state} index={c.index} />
          ))}
        </div>

        {/* Metrics */}
        {cm && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40">
            <CellMetric label="Min" value={`${cm.min.toFixed(3)} V`} sub={`Cell ${cm.minIndex}`} />
            <CellMetric label="Max" value={`${cm.max.toFixed(3)} V`} sub={`Cell ${cm.maxIndex}`} />
            <CellMetric label="Delta" value={`${cm.delta.toFixed(3)} V`} sub={cm.delta > 0.08 ? '⚠' : 'ok'} warn={cm.delta > 0.08} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CellTile({ voltage, state, index }: { voltage: number | null; state: CellSensorState; index: number }) {
  // Accessibility: text label always shown, color is secondary indicator (brief §37)
  let cls = 'border-border/60 bg-muted/30';
  let dotCls = 'bg-muted-foreground';
  if (state !== 'ok') {
    cls = 'border-status-error/40 bg-status-error/5';
    dotCls = 'bg-status-error';
  } else if (voltage == null) {
    cls = 'border-muted-foreground/40 bg-muted/20 opacity-60';
  } else if (voltage > 3.55) {
    cls = 'border-status-warn/40 bg-status-warn/5';
    dotCls = 'bg-status-warn';
  } else if (voltage < 2.80) {
    cls = 'border-status-warn/40 bg-status-warn/5';
    dotCls = 'bg-status-warn';
  }

  return (
    <div className={cn('rounded-md border px-2 py-1.5', cls)}>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono text-muted-foreground">C{index}</span>
        <span className={cn('w-1.5 h-1.5 rounded-full', dotCls)} aria-hidden="true" />
      </div>
      <p className="text-sm font-bold font-mono mt-0.5">
        {voltage != null && Number.isFinite(voltage) ? `${voltage.toFixed(3)} V` : 'N/A'}
      </p>
      <p className="text-[9px] text-muted-foreground uppercase tracking-wide">
        {CELL_LABELS[state]}
      </p>
    </div>
  );
}

function CellMetric({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-md border border-border/40 bg-card/50 px-2 py-1">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={cn('text-sm font-bold font-mono', warn && 'text-status-warn')}>{value}</p>
      {sub && <p className="text-[9px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
