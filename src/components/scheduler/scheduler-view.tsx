'use client';

import { useState } from 'react';
import { useLanguage } from '@/components/providers/language-provider';
import {
  useConfig,
  useScheduleMutation,
  useScheduleDelete,
  useRenameChannel,
} from '@/hooks/useApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus, Trash2, Save, CalendarClock, Pencil, Check, X, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DAY_KEYS, dayMaskToDays, daysToDayMask } from '@/lib/format';
import type { Schedule, Channel } from '@/lib/types';
import { toast } from 'sonner';

export function SchedulerView() {
  const { t } = useLanguage();
  const { data: config, isLoading } = useConfig();
  const [selectedChannel, setSelectedChannel] = useState<number>(1);

  if (isLoading || !config) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  const channels = config.channels;
  const channel = channels.find((c) => c.id === selectedChannel)!;
  const schedules = config.schedules.filter((s) => s.channelId === selectedChannel);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t('scheduler.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('scheduler.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Channel sidebar */}
        <ChannelSidebar
          channels={channels}
          schedules={config.schedules}
          selectedId={selectedChannel}
          onSelect={setSelectedChannel}
        />

        {/* Right column: rename + schedules + preview */}
        <div className="space-y-4 min-w-0">
          <ChannelHeaderCard channel={channel} scheduleCount={schedules.length} />
          <SchedulesList schedules={schedules} channel={channel} />
          {schedules.length < 4 && <AddScheduleCard channelId={selectedChannel} />}
          <WeeklyPreview schedules={schedules} />
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Channel sidebar — pick from 12 channels, show schedule count + status
// =============================================================================
function ChannelSidebar({
  channels,
  schedules,
  selectedId,
  onSelect,
}: {
  channels: Channel[];
  schedules: Schedule[];
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  const { t } = useLanguage();
  return (
    <Card className="border-border/60 lg:sticky lg:top-20 lg:self-start">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          {t('scheduler.select_channel')}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[420px] lg:h-[60vh]">
          <div className="px-2 pb-2 space-y-1">
            {channels.map((ch) => {
              const chScheds = schedules.filter((s) => s.channelId === ch.id);
              const active = ch.id === selectedId;
              return (
                <button
                  key={ch.id}
                  onClick={() => onSelect(ch.id)}
                  className={cn(
                    'w-full text-left px-3 py-2.5 rounded-lg border transition-colors group',
                    active
                      ? 'bg-primary/10 border-primary/30'
                      : 'border-transparent hover:bg-muted/60'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          'text-[10px] font-mono',
                          active ? 'text-primary' : 'text-muted-foreground'
                        )}>
                          CH{String(ch.id).padStart(2, '0')}
                        </span>
                        {ch.hasPir && (
                          <Badge variant="outline" className="text-[9px] h-4 px-1 py-0 text-status-warn border-status-warn/30">
                            PIR
                          </Badge>
                        )}
                      </div>
                      <p className={cn(
                        'text-sm font-medium truncate mt-0.5',
                        active ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        {ch.name}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <span className={cn(
                        'text-[10px] font-mono',
                        chScheds.length === 0 ? 'text-muted-foreground/60' : 'text-foreground'
                      )}>
                        {chScheds.length}/4
                      </span>
                      <span className={cn(
                        'text-[9px] uppercase tracking-wide',
                        ch.modeAuto ? 'text-status-on' : 'text-status-info'
                      )}>
                        {ch.modeAuto ? t('dashboard.mode_auto') : t('dashboard.mode_manual')}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// ChannelHeaderCard — inline-renameable name + meta info
// =============================================================================
function ChannelHeaderCard({ channel, scheduleCount }: { channel: Channel; scheduleCount: number }) {
  const { t } = useLanguage();
  const renameMut = useRenameChannel();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(channel.name);

  // Sync draft when channel name changes externally (e.g., after rename success)
  const [lastSeenName, setLastSeenName] = useState(channel.name);
  if (channel.name !== lastSeenName) {
    setLastSeenName(channel.name);
    if (!editing) setDraftName(channel.name);
  }

  const dirty = draftName.trim() !== channel.name && draftName.trim().length > 0;

  const onStartEdit = () => {
    setDraftName(channel.name);
    setEditing(true);
  };

  const onCancel = () => {
    setDraftName(channel.name);
    setEditing(false);
  };

  const onSave = () => {
    if (!dirty) {
      setEditing(false);
      return;
    }
    renameMut.mutate(
      { channelId: channel.id, name: draftName.trim() },
      {
        onSuccess: () => {
          setEditing(false);
          setLastSeenName(draftName.trim());
        },
        onError: () => {
          setDraftName(channel.name);
        },
      }
    );
  };

  return (
    <Card className="border-border/60 bg-card/50">
      <CardContent className="p-4 space-y-3">
        {/* Channel ID + name (editable) */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className={cn(
              'w-9 h-9 rounded-lg flex items-center justify-center font-mono text-xs font-bold',
              channel.hasPir
                ? 'bg-status-warn/15 text-status-warn border border-status-warn/30'
                : 'bg-primary/10 text-primary border border-primary/20'
            )}>
              {String(channel.id).padStart(2, '0')}
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Channel {channel.id}
              </span>
              {editing ? (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    maxLength={32}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSave();
                      if (e.key === 'Escape') onCancel();
                    }}
                    className="h-7 w-48 text-sm px-2"
                    placeholder="Nama channel..."
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-status-on"
                    onClick={onSave}
                    disabled={!dirty || renameMut.isPending}
                    title={t('common.save')}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={onCancel}
                    title={t('common.cancel')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ) : (
                <button
                  onClick={onStartEdit}
                  className="group flex items-center gap-1.5 mt-0.5 text-left"
                  title="Klik untuk mengganti nama"
                >
                  <span className="text-base font-semibold">{channel.name}</span>
                  <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1" />

          {/* Stats badges */}
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="font-mono">
              {scheduleCount}/4 {t('scheduler.title').toLowerCase()}
            </Badge>
            <Badge
              variant="outline"
              className={channel.modeAuto
                ? 'text-status-on border-status-on/30'
                : 'text-status-info border-status-info/30'}
            >
              {channel.modeAuto ? t('dashboard.mode_auto') : t('dashboard.mode_manual')}
            </Badge>
            {channel.pirEnabled && (
              <Badge variant="outline" className="text-status-warn border-status-warn/30">
                PIR ON
              </Badge>
            )}
          </div>
        </div>

        {/* Helper text */}
        <p className="text-xs text-muted-foreground">
          {editing
            ? 'Tekan Enter untuk simpan, Esc untuk batal. Nama tersimpan permanen di firmware.'
            : 'Klik nama channel untuk mengganti sesuai beban sebenarnya (mis. "Lampu Tamu", "Pompa Air").'}
        </p>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// SchedulesList — empty state + list of ScheduleRow
// =============================================================================
function SchedulesList({ schedules, channel }: { schedules: Schedule[]; channel: Channel }) {
  const { t } = useLanguage();
  if (schedules.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          <CalendarClock className="w-8 h-8 mx-auto mb-2 opacity-50" />
          {t('scheduler.empty')}
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3">
      {schedules.map((s) => (
        <ScheduleRow key={s.id} schedule={s} channel={channel} />
      ))}
    </div>
  );
}

// =============================================================================
// ScheduleRow — single schedule editor
// =============================================================================
function ScheduleRow({ schedule, channel }: { schedule: Schedule; channel: Channel }) {
  const { t } = useLanguage();
  const mutation = useScheduleMutation();
  const deleteMutation = useScheduleDelete();
  const [onTime, setOnTime] = useState(schedule.onTime);
  const [offTime, setOffTime] = useState(schedule.offTime);
  const [days, setDays] = useState<boolean[]>(dayMaskToDays(schedule.dayMask));
  const [enabled, setEnabled] = useState(schedule.enabled);

  // Reset local state if schedule identity changes (e.g., after channel switch)
  const [lastSeenId, setLastSeenId] = useState(schedule.id);
  const [lastSeenOnTime, setLastSeenOnTime] = useState(schedule.onTime);
  const [lastSeenOffTime, setLastSeenOffTime] = useState(schedule.offTime);
  const [lastSeenMask, setLastSeenMask] = useState(schedule.dayMask);
  const [lastSeenEnabled, setLastSeenEnabled] = useState(schedule.enabled);

  if (
    schedule.id !== lastSeenId ||
    schedule.onTime !== lastSeenOnTime ||
    schedule.offTime !== lastSeenOffTime ||
    schedule.dayMask !== lastSeenMask ||
    schedule.enabled !== lastSeenEnabled
  ) {
    setLastSeenId(schedule.id);
    setLastSeenOnTime(schedule.onTime);
    setLastSeenOffTime(schedule.offTime);
    setLastSeenMask(schedule.dayMask);
    setLastSeenEnabled(schedule.enabled);
    setOnTime(schedule.onTime);
    setOffTime(schedule.offTime);
    setDays(dayMaskToDays(schedule.dayMask));
    setEnabled(schedule.enabled);
  }

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
            <span className="text-muted-foreground">·</span>
            <span className="font-mono text-xs text-muted-foreground">CH{String(channel.id).padStart(2, '0')}</span>
            <span className="text-muted-foreground">·</span>
            <span className="font-medium truncate max-w-40">{channel.name}</span>
            <Badge variant={enabled ? 'default' : 'outline'} className="text-[10px] h-5">
              {enabled ? t('common.enabled') : t('common.disabled')}
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <Button
              variant="ghost"
              size="icon"
              onClick={onDelete}
              disabled={deleteMutation.isPending}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              title={t('common.delete')}
            >
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

// =============================================================================
// AddScheduleCard — form for new schedule
// =============================================================================
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

// =============================================================================
// WeeklyPreview — visual 24×7 grid
// =============================================================================
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
