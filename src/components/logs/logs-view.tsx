'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/providers/language-provider';
import { useStatus, useLogs } from '@/hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Power, PowerOff, Radar, LogIn, LogOut, AlertTriangle, RefreshCw,
  Download, Search, Filter, ScrollText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateTime } from '@/lib/format';
import type { LogType } from '@/lib/types';
import { toast } from 'sonner';

const LOG_TYPE_META: Record<LogType, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  relay_on: { icon: Power, color: 'text-status-on', bg: 'bg-status-on/10' },
  relay_off: { icon: PowerOff, color: 'text-muted-foreground', bg: 'bg-muted/30' },
  pir_trigger: { icon: Radar, color: 'text-status-warn', bg: 'bg-status-warn/10' },
  login: { icon: LogIn, color: 'text-status-info', bg: 'bg-status-info/10' },
  logout: { icon: LogOut, color: 'text-muted-foreground', bg: 'bg-muted/30' },
  error: { icon: AlertTriangle, color: 'text-status-error', bg: 'bg-status-error/10' },
  restart: { icon: RefreshCw, color: 'text-status-info', bg: 'bg-status-info/10' },
  ota: { icon: Download, color: 'text-status-info', bg: 'bg-status-info/10' },
  config_change: { icon: Filter, color: 'text-status-info', bg: 'bg-status-info/10' },
  factory_reset: { icon: AlertTriangle, color: 'text-status-error', bg: 'bg-status-error/10' },
  time_sync: { icon: RefreshCw, color: 'text-status-info', bg: 'bg-status-info/10' },
};

export function LogsView() {
  const { t, lang } = useLanguage();
  const { data: status } = useStatus();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [limit, setLimit] = useState(100);

  const enabled = !!status;
  const { data, isLoading } = useLogs({
    type: typeFilter,
    channelId: channelFilter === 'all' ? undefined : Number(channelFilter),
    limit,
  });

  const filtered = data?.logs.filter((l) =>
    search ? l.message.toLowerCase().includes(search.toLowerCase()) : true
  ) ?? [];

  const onExportCsv = () => {
    if (!filtered.length) {
      toast.error('No logs to export');
      return;
    }
    const rows = [
      ['timestamp', 'type', 'channel', 'message'],
      ...filtered.map((l) => [
        new Date(l.timestamp).toISOString(),
        l.type,
        l.channelId ? `CH${l.channelId}` : '',
        l.message.replace(/"/g, '""'),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timer12-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('logs.export_csv'));
  };

  if (isLoading || !status) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('logs.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('logs.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
            <span className="text-muted-foreground">{t('logs.auto_refresh')}</span>
          </div>
          <Button variant="outline" size="sm" onClick={onExportCsv}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            {t('logs.export_csv')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t('logs.filter_type')}</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  <SelectItem value="relay_on">Relay ON</SelectItem>
                  <SelectItem value="relay_off">Relay OFF</SelectItem>
                  <SelectItem value="pir_trigger">PIR Trigger</SelectItem>
                  <SelectItem value="login">Login</SelectItem>
                  <SelectItem value="logout">Logout</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="restart">Restart</SelectItem>
                  <SelectItem value="ota">OTA</SelectItem>
                  <SelectItem value="config_change">Config Change</SelectItem>
                  <SelectItem value="factory_reset">Factory Reset</SelectItem>
                  <SelectItem value="time_sync">Time Sync</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t('logs.filter_channel')}</label>
              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('common.all')}</SelectItem>
                  {status.channels.map((ch) => (
                    <SelectItem key={ch.id} value={String(ch.id)}>
                      CH{String(ch.id).padStart(2, '0')} · {ch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t('common.search')}</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search logs..."
                  className="pl-8 h-9"
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Limit:</span>
            <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
              <SelectTrigger className="h-7 w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
                <SelectItem value="500">500</SelectItem>
              </SelectContent>
            </Select>
            <span className="ml-auto">Showing {filtered.length} entries</span>
          </div>
        </CardContent>
      </Card>

      {/* Logs table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <ScrollText className="w-8 h-8 mx-auto mb-2 opacity-50" />
              {t('logs.empty')}
            </div>
          ) : (
            <ScrollArea className="h-[60vh]">
              <div className="divide-y divide-border/40">
                {filtered.map((log) => {
                  const meta = LOG_TYPE_META[log.type] ?? LOG_TYPE_META.error;
                  const Icon = meta.icon;
                  const channel = log.channelId
                    ? status.channels.find((c) => c.id === log.channelId)
                    : null;
                  return (
                    <div key={log.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                      <div className={cn('rounded-md p-1.5 flex-shrink-0', meta.bg)}>
                        <Icon className={cn('w-3.5 h-3.5', meta.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5', meta.color, 'border-current/30')}>
                            {log.type}
                          </Badge>
                          {channel && (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              CH{String(channel.id).padStart(2, '0')} · {channel.name}
                            </span>
                          )}
                        </div>
                        <p className="text-sm mt-0.5">{log.message}</p>
                      </div>
                      <div className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">
                        {formatDateTime(log.timestamp, status.timezone, lang)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
