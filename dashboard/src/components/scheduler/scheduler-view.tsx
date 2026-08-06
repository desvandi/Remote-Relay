'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/providers/language-provider';
import { useConfig, useScheduleMutation, useScheduleDelete } from '@/hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Trash2, Save, CalendarClock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DAY_KEYS, dayMaskToDays, daysToDayMask } from '@/lib/format';
import type { Schedule } from '@/lib/types';
import { toast } from 'sonner';

export function SchedulerView() {
  const { t } = useLanguage();
  const { data: config, isLoading } = useConfig();
  const [selectedChannel, setSelectedChannel] = useState<number>(1);

  if (isLoading || !config) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  const channels = config.channels;
  const channel = channels.find((c) => c.id === selectedChannel)!;
  const schedules = config.schedules.filter((s) => s.channelId === selectedChannel);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('scheduler.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('scheduler.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">{t('scheduler.select_channel')}</Label>
          <Select value={String(selectedChannel)} onValueChange={(v) => setSelectedChannel(Number(v))}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {channels.map((ch) => (
                <SelectItem key={ch.id} value={String(ch.id)}>
                  CH{String(ch.id).padStart(2, '0')} · {ch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Channel info banner */}
      <Card className="border-border/60 bg-card/50">
        <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-semibold">{channel.name}</p>
            <p className="text-xs text-muted-foreground">
              Channel {channel.id} · {schedules.length}/4 schedules · Mode: {channel.modeAuto ? 'Auto' : 'Manual'}
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline">MAX 4 schedules</Badge>
            {channel.pirEnabled && <Badge variant="outline" className="text-status-warn border-status-warn/30">PIR Override Active</Badge>}
          </div>
        </CardContent>
      </Card>

      {/* Schedules list */}
      <div className="space-y-3">
        {schedules.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              <CalendarClock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              {t('scheduler.empty')}
            </CardContent>
          </Card>
        )}
        {schedules.map((s) => (
          <ScheduleRow key={s.id} schedule={s} channelName={channel.name} />
        ))}
      </div>

      {/* Add new schedule */}
      {schedules.length < 4 && <AddScheduleCard channelId={selectedChannel} />}

      {/* Weekly preview */}
      <WeeklyPreview schedules={schedules} />
    </div>
  );
}

function ScheduleRow({ schedule, channelName }: { schedule: Schedule; channelName: string }) {
  const { t } = useLanguage();
  const mutation = useScheduleMutation();
  const deleteMutation = useScheduleDelete();
  const [onTime, setOnTime] = useState(schedule.onTime);
  const [offTime, setOffTime] = useState(schedule.offTime);
  const [days, setDays] = useState<boolean[]>(dayMaskToDays(schedule.dayMask));
  const [enabled, setEnabled] = useState(schedule.enabled);
  const dirty = onTime !== schedule.onTime || offTime !== schedule.offTime ||
    daysToDayMask(days) !== schedule.dayMask || enabled !== schedule.enabled;

  const onSave = () => {
    if (!/^\d{2}:\d{2}$/.test(onTime) || !/^\d{2}:\d{2}$/.test(offTime)) {
      toast.error('Invalid time format');
      return;
    }
    mutation.mutate({
      id: schedule.id,
      channelId: schedule.channelId,
      onTime,
      offTime,
      dayMask: daysToDayMask(days),
      enabled,
    });
  };

  const onDelete = () => {
    if (schedule.id) deleteMutation.mutate(schedule.id);
  };

  return (
    <Card className={cn('border-border/60 transition-opacity', !enabled && 'opacity-60')}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">#{schedule.id}</span>
            <span>{channelName}</span>
            <Badge variant={enabled ? 'default' : 'outline'} className="text-[10px] h-5">
              {enabled ? t('common.enabled') : t('common.disabled')}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <Button variant="ghost" size="icon" onClick={onDelete} disabled={deleteMutation.isPending} className="h-8 w-8 text-muted-foreground hover:text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t('scheduler.on_time')}</Label>
            <Input type="time" value={onTime} onChange={(e) => setOnTime(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('scheduler.off_time')}</Label>
            <Input type="time" value={offTime} onChange={(e) => setOffTime(e.target.value)} className="font-mono" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('scheduler.days')}</Label>
          <div className="flex flex-wrap gap-1">
            {DAY_KEYS.map((dk, i) => (
              <button
                key={dk}
                onClick={() => setDays((prev) => prev.map((v, idx) => (idx === i ? !v : v)))}
                className={cn(
                  'w-9 h-9 rounded-md text-xs font-medium transition-colors border',
                  days[i]
                    ? 'bg-primary/15 text-primary border-primary/30'
                    : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/70'
                )}
              >
                {t(`scheduler.${dk}` as const)}
              </button>
            ))}
            <button
              onClick={() => setDays([true, true, true, true, true, true, true])}
              className="px-2 h-9 rounded-md text-[10px] font-medium bg-muted text-muted-foreground hover:bg-muted/70"
            >
              {t('scheduler.every_day')}
            </button>
          </div>
        </div>
        {dirty && (
          <Button onClick={onSave} disabled={mutation.isPending} size="sm" className="w-full sm:w-auto">
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {t('common.save')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function AddScheduleCard({ channelId }: { channelId: number }) {
  const { t } = useLanguage();
  const mutation = useScheduleMutation();
  const [onTime, setOnTime] = useState('07:00');
  const [offTime, setOffTime] = useState('17:00');
  const [days, setDays] = useState<boolean[]>([true, true, true, true, true, true, true]);

  const onAdd = () => {
    mutation.mutate(
      {
        channelId,
        onTime,
        offTime,
        dayMask: daysToDayMask(days),
        enabled: true,
      },
      {
        onSuccess: () => {
          setOnTime('07:00');
          setOffTime('17:00');
          setDays([true, true, true, true, true, true, true]);
        },
      }
    );
  };

  return (
    <Card className="border-dashed border-primary/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          {t('scheduler.add_schedule')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t('scheduler.on_time')}</Label>
            <Input type="time" value={onTime} onChange={(e) => setOnTime(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('scheduler.off_time')}</Label>
            <Input type="time" value={offTime} onChange={(e) => setOffTime(e.target.value)} className="font-mono" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{t('scheduler.days')}</Label>
          <div className="flex flex-wrap gap-1">
            {DAY_KEYS.map((dk, i) => (
              <button
                key={dk}
                onClick={() => setDays((prev) => prev.map((v, idx) => (idx === i ? !v : v)))}
                className={cn(
                  'w-9 h-9 rounded-md text-xs font-medium transition-colors border',
                  days[i]
                    ? 'bg-primary/15 text-primary border-primary/30'
                    : 'bg-muted text-muted-foreground border-transparent hover:bg-muted/70'
                )}
              >
                {t(`scheduler.${dk}` as const)}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={onAdd} disabled={mutation.isPending} size="sm">
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          {t('common.add')}
        </Button>
      </CardContent>
    </Card>
  );
}

function WeeklyPreview({ schedules }: { schedules: Schedule[] }) {
  const { t } = useLanguage();
  if (schedules.length === 0) return null;

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const dayList = DAY_KEYS;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{t('scheduler.preview')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            {/* Hour header */}
            <div className="flex items-center border-b border-border/40 pb-1 mb-1">
              <div className="w-12 text-[10px] text-muted-foreground font-medium" />
              <div className="flex-1 grid grid-cols-24 gap-px">
                {hours.map((h) => (
                  <div key={h} className="text-[8px] text-muted-foreground text-center font-mono">
                    {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
                  </div>
                ))}
              </div>
            </div>
            {/* Day rows */}
            {dayList.map((dk, dayIdx) => {
              const daySchedules = schedules.filter((s) => {
                if (s.dayMask === 0) return true;
                return (s.dayMask & (1 << dayIdx)) !== 0;
              });
              return (
                <div key={dk} className="flex items-center border-b border-border/20 py-0.5">
                  <div className="w-12 text-[10px] text-muted-foreground font-medium">
                    {t(`scheduler.${dk}` as const)}
                  </div>
                  <div className="flex-1 grid grid-cols-24 gap-px h-4">
                    {hours.map((h) => {
                      const active = daySchedules.some((s) => {
                        if (!s.enabled) return false;
                        const onMin = parseInt(s.onTime.split(':')[0]) * 60 + parseInt(s.onTime.split(':')[1]);
                        const offMin = parseInt(s.offTime.split(':')[0]) * 60 + parseInt(s.offTime.split(':')[1]);
                        const curMin = h * 60;
                        if (onMin <= offMin) return curMin >= onMin && curMin < offMin;
                        return curMin >= onMin || curMin < offMin;
                      });
                      return (
                        <div
                          key={h}
                          className={cn(
                            'rounded-[1px]',
                            active ? 'bg-status-on/70' : 'bg-muted/40'
                          )}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">24-hour timeline · green = scheduled ON</p>
      </CardContent>
    </Card>
  );
}
