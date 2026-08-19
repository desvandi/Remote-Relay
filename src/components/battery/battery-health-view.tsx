'use client';

// =============================================================================
// BatteryHealthView — Pack & cell resistance diagnostics (brief §38)
// -----------------------------------------------------------------------------
// Display:
//   • Pack Resistance + measurement quality
//   • Per-cell Resistance array (8 cells)
//   • Highest-resistance cell index + Resistance Delta
//   • Measurement Quality label
//
// Per brief §38: when resistance is unavailable, show "Not available" —
//   NEVER "0 Ω".
// =============================================================================
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Activity, Gauge } from 'lucide-react';
import type { BatteryStatus, ResistanceQuality } from '@/lib/types';

const QUALITY_LABEL: Record<ResistanceQuality, { label: string; cls: string }> = {
  INVALID:        { label: 'INVALID',         cls: 'opacity-50' },
  LOW_DELTA_I:    { label: 'LOW ΔI',          cls: 'text-status-warn border-status-warn/30' },
  UNSTABLE:        { label: 'UNSTABLE',        cls: 'text-status-warn border-status-warn/30' },
  VALID:          { label: 'VALID',           cls: 'text-status-on border-status-on/30' },
  HIGH_CONFIDENCE: { label: 'HIGH CONFIDENCE', cls: 'text-status-on border-status-on/30' },
};

function fmtOhms(v: number | null) {
  if (v == null || !Number.isFinite(v)) return null;
  if (v < 1.0) return `${(v * 1000).toFixed(1)} mΩ`;
  return `${v.toFixed(3)} Ω`;
}

export function BatteryHealthView({ battery }: { battery?: BatteryStatus }) {
  if (!battery) return null;

  const pr = battery.packResistance;
  const cr = battery.cellResistance ?? [];
  const validCells = cr.filter((c) => c.ohms != null && Number.isFinite(c.ohms));
  let highIdx = -1, highVal = -1;
  for (const c of validCells) {
    if ((c.ohms ?? 0) > highVal) {
      highVal = c.ohms ?? 0; highIdx = c.index;
    }
  }
  let lowVal = Infinity;
  for (const c of validCells) {
    if ((c.ohms ?? 0) < lowVal) lowVal = c.ohms ?? 0;
  }
  const delta = (highVal >= 0 && Number.isFinite(lowVal)) ? (highVal - lowVal) : null;

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-status-info/15 p-1.5">
            <Gauge className="w-4 h-4 text-status-info" />
          </div>
          <CardTitle className="text-sm font-semibold">Battery Health (DC estimate)</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Pack resistance summary */}
        <div className="rounded-md border border-border/40 bg-card/50 px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-muted-foreground" />
              <p className="text-xs font-medium">Pack Resistance</p>
            </div>
            <QualityBadge quality={pr?.quality ?? 'INVALID'} />
          </div>
          <p className="text-2xl font-bold mt-1 font-mono">
            {fmtOhms(pr?.ohms ?? null) ?? 'Not available'}
          </p>
          {(pr?.deltaV != null && pr?.deltaI != null) && (
            <p className="text-[9px] text-muted-foreground mt-0.5">
              ΔV={pr.deltaV.toFixed(3)}V  ΔI={pr.deltaI.toFixed(2)}A  window={pr.sampleWindowMs ?? '?'}ms
            </p>
          )}
        </div>

        {/* Per-cell resistance grid */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
            Cell Resistance (DC dynamic estimate)
          </p>
          <div className="grid grid-cols-4 gap-1.5">
            {cr.map((c) => (
              <div key={c.index} className={cn(
                'rounded-md border px-1.5 py-1',
                c.ohms != null ? 'border-border/60 bg-muted/30' : 'border-muted-foreground/30 bg-muted/10 opacity-60',
              )}>
                <p className="text-[9px] font-mono text-muted-foreground">C{c.index}</p>
                <p className="text-xs font-bold font-mono">
                  {fmtOhms(c.ohms) ?? 'N/A'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40">
          <div>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Highest</p>
            <p className="text-xs font-bold font-mono">
              {highIdx > 0 ? `C${highIdx}: ${fmtOhms(highVal)}` : 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Delta</p>
            <p className="text-xs font-bold font-mono">{fmtOhms(delta) ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Quality</p>
            <p className="text-xs font-bold">{pr?.quality ?? 'INVALID'}</p>
          </div>
        </div>

        <p className="text-[9px] text-muted-foreground italic">
          Diagnostic estimate (ΔV/ΔI). NOT laboratory ESR or AC impedance.
        </p>
      </CardContent>
    </Card>
  );
}

function QualityBadge({ quality }: { quality: ResistanceQuality }) {
  const s = QUALITY_LABEL[quality] ?? QUALITY_LABEL.INVALID;
  return (
    <Badge variant="outline" className={cn('text-[9px] px-1.5 h-4', s.cls)}>
      {s.label}
    </Badge>
  );
}
