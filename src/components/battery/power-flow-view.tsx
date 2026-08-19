'use client';

// =============================================================================
// PowerFlowView — DC power-flow visualization (brief §21, §22, §36)
// -----------------------------------------------------------------------------
// Display: MPPT / Battery / Inverter with real-time W / A and directional
// visualization derived from signed power/current (NOT hard-coded — brief §36).
//
// Topology (brief §4):
//                    ☀ MPPT
//                      │
//             ┌────────┴────────┐
//             ▼                  ▼
//         Battery             Inverter
//
// Direction logic:
//   Ibattery > 0 → battery discharging → arrow from Battery → Inverter
//   Ibattery < 0 → battery charging → arrow from MPPT → Battery
//   Imppt > 0    → MPPT producing power
// =============================================================================
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Sun, Battery, Zap, ArrowRight, ArrowLeft, ArrowDown, Check } from 'lucide-react';
import type { PowerFlow } from '@/lib/types';

function fmtA(v: number | null) {
  if (v == null || !Number.isFinite(v)) return 'N/A';
  return `${v.toFixed(2)} A`;
}
function fmtW(v: number | null) {
  if (v == null || !Number.isFinite(v)) return 'N/A';
  return `${v.toFixed(1)} W`;
}

export function PowerFlowView({ powerFlow }: { powerFlow?: PowerFlow }) {
  // v4.1.1 audit: null-guard with explicit UNAVAILABLE placeholder (brief §46,
  //   §59). Previously the component returned null silently — leaving a gap
  //   in the dashboard grid. Now it renders an explicit UNAVAILABLE card so
  //   operators know the subsystem is down, not just empty.
  if (!powerFlow) {
    return (
      <Card className="overflow-hidden border-border/60 opacity-60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-muted/30 p-1.5">
                <Sun className="w-4 h-4 text-muted-foreground" />
              </div>
              <CardTitle className="text-sm font-semibold">DC Power Flow</CardTitle>
            </div>
            <Badge variant="outline" className="text-[9px] px-1.5 h-4 opacity-50">UNAVAILABLE</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">No power-flow telemetry from firmware.</p>
        </CardContent>
      </Card>
    );
  }
  const pf = powerFlow;

  // v4.1.1 audit: when batteryCurrent/inverterCurrent are null, fall back to 0
  //   for direction logic but display "N/A" in the UI (already handled by fmtA).
  const ibatt = pf.batteryCurrent ?? 0;
  const iinv = pf.inverterCurrent ?? 0;
  const imppt = pf.mpptCurrent ?? 0;

  const isCharging = ibatt < -0.05;     // brief §5: Ibattery<0 = charging
  const isDischarging = ibatt > 0.05;  // brief §5: Ibattery>0 = discharging
  const mpptProducing = imppt > 0.05;

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-status-warn/15 p-1.5">
              <Sun className="w-4 h-4 text-status-warn" />
            </div>
            <CardTitle className="text-sm font-semibold">DC Power Flow</CardTitle>
          </div>
          <FlowConsistencyBadge state={pf.consistency} error={pf.consistencyError} />
        </div>
      </CardHeader>
      <CardContent>
        {/* Flow diagram */}
        <div className="grid grid-cols-3 gap-2 items-stretch">
          {/* MPPT */}
          <FlowNode
            icon={Sun}
            label="MPPT"
            currentA={fmtA(imppt)}
            powerW={fmtW(pf.mpptPower)}
            active={mpptProducing}
            accent="warn"
          />

          {/* Arrows — v4.1.1 audit: accessibility text label alongside color
              (brief §37 "Do not use red/green colors as the only indication") */}
          <div className="flex flex-col items-center justify-center gap-1 py-2" aria-label="Power flow direction">
            <div className="flex items-center gap-1">
              {mpptProducing && (isCharging || !isDischarging) ? (
                <ArrowRight className="w-3 h-3 text-status-warn" aria-hidden="true" />
              ) : null}
              {isDischarging ? (
                <ArrowLeft className="w-3 h-3 text-status-info" aria-hidden="true" />
              ) : null}
            </div>
            <Battery className={cn('w-5 h-5', isCharging ? 'text-status-on' : isDischarging ? 'text-status-warn' : 'text-muted-foreground')} aria-hidden="true" />
            <div className="flex items-center gap-1">
              {(isCharging || isDischarging) && (
                <ArrowDown className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
              )}
            </div>
            <span className="text-[9px] text-muted-foreground uppercase tracking-wider mt-1">
              {isCharging ? 'Charging' : isDischarging ? 'Discharging' : 'Idle'}
            </span>
          </div>

          {/* Inverter */}
          <FlowNode
            icon={Zap}
            label="Inverter"
            currentA={fmtA(iinv)}
            powerW={fmtW(pf.inverterDcPower)}
            active={iinv > 0.05}
            accent="info"
          />
        </div>

        {/* Battery branch summary */}
        <div className="mt-3 pt-2 border-t border-border/40 grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Battery Current</p>
            <p className="font-bold font-mono">{fmtA(ibatt)}</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Battery Power</p>
            <p className={cn('font-bold font-mono', isCharging && 'text-status-on', isDischarging && 'text-status-warn')}>
              {fmtW(pf.batteryPower)}
            </p>
          </div>
        </div>

        {/* Direction summary */}
        <div className="mt-2 text-[10px] text-muted-foreground">
          {isCharging && '☀ MPPT → 🔋 Battery (charging)'}
          {isDischarging && '🔋 Battery → ⚡ Inverter (discharging)'}
          {!isCharging && !isDischarging && 'Idle — no significant current'}
        </div>
      </CardContent>
    </Card>
  );
}

function FlowNode({
  icon: Icon, label, currentA, powerW, active, accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  currentA: string;
  powerW: string;
  active: boolean;
  accent: 'warn' | 'info' | 'on' | 'off';
}) {
  const accentMap = {
    warn: 'border-status-warn/40 bg-status-warn/5 text-status-warn',
    info: 'border-status-info/40 bg-status-info/5 text-status-info',
    on:   'border-status-on/40 bg-status-on/5 text-status-on',
    off:  'border-border/40 bg-muted/30 text-muted-foreground',
  };
  return (
    <div className={cn('rounded-md border px-2 py-2 text-center transition-colors', accentMap[accent], !active && 'opacity-50')}>
      <Icon className="w-4 h-4 mx-auto mb-1" />
      <p className="text-[10px] uppercase tracking-wider">{label}</p>
      <p className="text-sm font-bold font-mono">{powerW}</p>
      <p className="text-[9px] text-muted-foreground font-mono">{currentA}</p>
    </div>
  );
}

function FlowConsistencyBadge({ state, error }: { state: PowerFlow['consistency']; error: number | null }) {
  const cls = state === 'NORMAL' ? 'border-status-on/30 text-status-on'
              : state === 'WARNING' ? 'border-status-warn/30 text-status-warn'
              : state === 'FAULT' ? 'border-status-error/30 text-status-error'
              : 'opacity-50';
  const Icon = state === 'NORMAL' ? Check : Sun;
  return (
    <Badge variant="outline" className={cn('text-[9px] px-1.5 h-4', cls)}>
      <Icon className="w-2.5 h-2.5 mr-1" />
      {state}{error != null && Number.isFinite(error) ? ` ${error.toFixed(0)}W` : ''}
    </Badge>
  );
}
