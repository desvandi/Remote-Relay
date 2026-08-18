'use client';

// =============================================================================
// BatteryDiagnosticsView — Fault flag panel (brief §30, §59)
// -----------------------------------------------------------------------------
// Alarm states use text labels (NORMAL/WARNING/FAULT/UNAVAILABLE) per brief
// §59, NOT just colors. Debounce is enforced on firmware side; this component
// only displays the resulting state.
// =============================================================================
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ShieldCheck, ShieldAlert, ShieldX, ShieldOff } from 'lucide-react';
import type { BatteryDiagnosticsState, AlarmState } from '@/lib/types';

const FAULT_FIELDS: { key: keyof BatteryDiagnosticsState; label: string }[] = [
  { key: 'batteryVoltageFault',       label: 'Pack Voltage Sensor' },
  { key: 'batteryCurrentSensorFault', label: 'Battery Current Sensor' },
  { key: 'inverterCurrentSensorFault', label: 'Inverter Current Sensor' },
  { key: 'cellMeasurementFault',     label: 'Cell Measurement (ADS)' },
  { key: 'cellTapFault',             label: 'Cell Tap Fault' },
  { key: 'cellOverVoltage',          label: 'Cell Over-Voltage' },
  { key: 'cellUnderVoltage',         label: 'Cell Under-Voltage' },
  { key: 'cellImbalance',            label: 'Cell Imbalance' },
  { key: 'highPackResistance',       label: 'High Pack Resistance' },
  { key: 'highCellResistance',       label: 'High Cell Resistance' },
  { key: 'powerFlowInconsistency',   label: 'Power-Flow Inconsistency' },
  { key: 'sht31Fault',                label: 'SHT31 (Ambient)' },
  { key: 'adsFault',                  label: 'ADS1115 (Cells)' },
  { key: 'inaFault',                  label: 'INA219 (Current)' },
];

export function BatteryDiagnosticsView({ diagnostics }: { diagnostics?: BatteryDiagnosticsState }) {
  if (!diagnostics) return null;

  const overall = diagnostics.overall;
  const Icon = overall === 'NORMAL' ? ShieldCheck
              : overall === 'WARNING' ? ShieldAlert
              : overall === 'FAULT' ? ShieldX
              : ShieldOff;
  const iconCls = overall === 'NORMAL' ? 'text-status-on'
                  : overall === 'WARNING' ? 'text-status-warn'
                  : overall === 'FAULT' ? 'text-status-error'
                  : 'text-muted-foreground opacity-50';

  return (
    <Card className="overflow-hidden border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('rounded-lg bg-muted/30 p-1.5', iconCls)}>
              <Icon className="w-4 h-4" />
            </div>
            <CardTitle className="text-sm font-semibold">Battery Diagnostics</CardTitle>
          </div>
          <span className={cn('text-[10px] font-bold uppercase tracking-wider', iconCls)}>
            {overall}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
          {FAULT_FIELDS.map(({ key, label }) => (
            <FaultRow key={key} label={label} fault={Boolean(diagnostics[key])} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function FaultRow({ label, fault }: { label: string; fault: boolean }) {
  return (
    <div className="flex items-center justify-between px-2 py-1 rounded border border-border/40 bg-card/40">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={cn(
        'text-[10px] font-bold uppercase tracking-wider',
        fault ? 'text-status-error' : 'text-status-on',
      )}>
        {fault ? 'FAULT' : 'OK'}
      </span>
    </div>
  );
}
