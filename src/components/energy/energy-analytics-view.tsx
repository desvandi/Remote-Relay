'use client';

import { useState, useEffect } from 'react';
import { useStatus } from '@/hooks/useApi';
import { useLanguage } from '@/components/providers/language-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Zap, Activity, TrendingUp, AlertTriangle, DollarSign,
  Gauge, BarChart3, Clock, RefreshCw,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { cn } from '@/lib/utils';
import {
  recordEnergySample, getRecentSamples, clearEnergyHistory,
  getTariff, setTariff, calculateCost, estimateMonthlyBill,
} from '@/lib/energyHistory';
import { toast } from 'sonner';

export function EnergyAnalyticsView() {
  const { data: status, isLoading } = useStatus();
  const { t, lang } = useLanguage();
  const [tariff, setTariffState] = useState(getTariff());
  const [chartData, setChartData] = useState<Array<{ time: string; power: number; voltage: number; current: number }>>([]);

  // Record sample when status updates (side effect only, no setState)
  useEffect(() => {
    if (status?.pzemAvailable) {
      recordEnergySample(status);
    }
  }, [status]);

  // Refresh chart data on interval (setState in callback = OK)
  useEffect(() => {
    if (!status?.pzemAvailable) return;
    const refreshChart = () => {
      const samples = getRecentSamples(24);
      setChartData(samples.map((s) => ({
        time: new Date(s.ts).toLocaleTimeString(lang === 'id' ? 'id-ID' : 'en-US', { hour: '2-digit', minute: '2-digit' }),
        power: Math.round(s.power),
        voltage: parseFloat(s.voltage.toFixed(1)),
        current: parseFloat(s.current.toFixed(3)),
      })));
    };
    refreshChart();
    const id = setInterval(refreshChart, 5000);
    return () => clearInterval(id);
  }, [status?.pzemAvailable, lang]);

  if (isLoading || !status) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!status.pzemAvailable) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Energy Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time power monitoring via PZEM-004T v3.0</p>
        </div>
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <Gauge className="w-8 h-8 mx-auto mb-2 opacity-50" />
            PZEM-004T v3.0 not connected. Connect sensor to ESP32 UART (TX to GPIO4, RX to GPIO5) to enable energy monitoring.
          </CardContent>
        </Card>
      </div>
    );
  }

  const voltage = status.voltage ?? 0;
  const current = status.current ?? 0;
  const power = status.power ?? 0;
  const energy = status.energy ?? 0;
  const energyToday = status.energyToday ?? 0;
  const frequency = status.frequency ?? 50;
  const powerFactor = status.powerFactor ?? 0;
  const apparentPower = status.apparentPower ?? voltage * current;
  const reactivePower = status.reactivePower ?? 0;
  const costToday = calculateCost(energyToday);
  const monthlyEstimate = estimateMonthlyBill(energyToday);
  const alarms = status.alarms ?? {};
  const hasActiveAlarm = alarms.undervoltage || alarms.overvoltage || alarms.overcurrent || alarms.overpower || alarms.lowPowerFactor;

  const onSaveTariff = () => {
    setTariff(tariff);
    toast.success('Tarif listrik disimpan');
  };

  const onClearHistory = () => {
    clearEnergyHistory();
    setChartData([]);
    toast.info('History cleared');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            Energy Analytics
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time monitoring via PZEM-004T v3.0</p>
        </div>
        {hasActiveAlarm && (
          <Badge variant="destructive" className="animate-pulse">
            <AlertTriangle className="w-3 h-3 mr-1" />
            ALARM ACTIVE
          </Badge>
        )}
      </div>

      {/* Real-time gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <MetricCard icon={Zap} label="Voltage" value={voltage.toFixed(1)} unit="V" color="text-status-on" alarm={alarms.undervoltage || alarms.overvoltage} />
        <MetricCard icon={Zap} label="Current" value={current.toFixed(3)} unit="A" color="text-status-info" alarm={alarms.overcurrent} />
        <MetricCard icon={Zap} label="Power" value={power.toFixed(1)} unit="W" color="text-status-on" alarm={alarms.overpower} />
        <MetricCard icon={Activity} label="Energy" value={energy.toFixed(3)} unit="kWh" color="text-status-warn" />
        <MetricCard icon={Activity} label="Freq" value={frequency.toFixed(1)} unit="Hz" color="text-status-info" />
        <MetricCard icon={Gauge} label="PF" value={powerFactor.toFixed(2)} unit="" color={alarms.lowPowerFactor ? "text-status-error" : "text-status-on"} alarm={alarms.lowPowerFactor} />
        <MetricCard icon={TrendingUp} label="Apparent" value={apparentPower.toFixed(1)} unit="VA" color="text-muted-foreground" />
        <MetricCard icon={TrendingUp} label="Reactive" value={reactivePower.toFixed(1)} unit="VAR" color="text-muted-foreground" />
      </div>

      {/* Alarm indicators */}
      {hasActiveAlarm && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          {alarms.undervoltage && <AlarmCard label="Undervoltage" value={`${voltage.toFixed(1)}V`} threshold="< 190V" />}
          {alarms.overvoltage && <AlarmCard label="Overvoltage" value={`${voltage.toFixed(1)}V`} threshold="> 250V" />}
          {alarms.overcurrent && <AlarmCard label="Overcurrent" value={`${current.toFixed(3)}A`} threshold="> 8A" />}
          {alarms.overpower && <AlarmCard label="Overpower" value={`${power.toFixed(1)}W`} threshold="> 1500W" />}
          {alarms.lowPowerFactor && <AlarmCard label="Low PF" value={powerFactor.toFixed(2)} threshold="< 0.70" />}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-status-on" />
              Power (W) - Last 24h
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={60} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="power" stroke="#10B981" strokeWidth={2} fill="url(#powerGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                Collecting data... charts will appear after 1 minute.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4 text-status-info" />
              Voltage (V) - Last 24h
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} interval={60} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 10 }} domain={[200, 240]} stroke="var(--muted-foreground)" />
                  <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="voltage" stroke="#06B6D4" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground">
                Collecting data...
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Daily Statistics */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Daily Statistics (reset at midnight)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
            <StatItem label="Energy Today" value={`${energyToday.toFixed(3)} kWh`} />
            <StatItem label="Min Voltage" value={`${(status.voltageMin ?? 0).toFixed(1)} V`} />
            <StatItem label="Max Voltage" value={`${(status.voltageMax ?? 0).toFixed(1)} V`} />
            <StatItem label="Max Current" value={`${(status.currentMax ?? 0).toFixed(3)} A`} />
            <StatItem label="Max Power" value={`${(status.powerMax ?? 0).toFixed(1)} W`} />
            <StatItem label="Avg Power" value={`${(status.powerAvg ?? 0).toFixed(1)} W`} />
          </div>
        </CardContent>
      </Card>

      {/* Cost Calculator */}
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-status-warn" />
            Cost Estimation
          </CardTitle>
          <CardDescription>Based on PLN tariff (configurable)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <CostCard label="Today" kwh={energyToday} cost={costToday} />
            <CostCard label="This Month (est.)" kwh={energyToday * 30} cost={monthlyEstimate} />
            <CostCard label="Total Accumulated" kwh={energy} cost={calculateCost(energy)} />
          </div>
          <div className="flex items-end gap-2 pt-2 border-t border-border/40">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">Tarif Listrik (Rp/kWh)</Label>
              <Input
                type="number"
                value={tariff}
                onChange={(e) => setTariffState(Number(e.target.value))}
                className="font-mono"
                min={0}
                step={1}
              />
            </div>
            <Button size="sm" onClick={onSaveTariff}>Save Tariff</Button>
            <Button size="sm" variant="outline" onClick={onClearHistory}>
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Clear History
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, unit, color, alarm }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  unit: string;
  color: string;
  alarm?: boolean;
}) {
  return (
    <Card className={cn('border-border/60', alarm && 'border-status-error/40 status-glow-on')}>
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <Icon className={cn('w-4 h-4', color)} />
          {alarm && <div className="status-dot status-dot-error animate-pulse" />}
        </div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className={cn('text-lg font-bold font-mono', color)}>
          {value}<span className="text-xs text-muted-foreground ml-1">{unit}</span>
        </p>
      </CardContent>
    </Card>
  );
}

function AlarmCard({ label, value, threshold }: { label: string; value: string; threshold: string }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-status-error/10 border border-status-error/30">
      <AlertTriangle className="w-4 h-4 text-status-error flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs font-medium text-status-error">{label}</p>
        <p className="text-[10px] text-muted-foreground">{value} ({threshold})</p>
      </div>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2 rounded-md bg-muted/30">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-mono font-semibold">{value}</p>
    </div>
  );
}

function CostCard({ label, kwh, cost }: { label: string; kwh: number; cost: number }) {
  return (
    <div className="p-3 rounded-lg border border-border/40 bg-muted/20">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-lg font-bold text-status-warn">
        Rp {cost.toLocaleString('id-ID')}
      </p>
      <p className="text-[10px] text-muted-foreground font-mono">{kwh.toFixed(3)} kWh</p>
    </div>
  );
}
