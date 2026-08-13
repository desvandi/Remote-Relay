'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { mqttApi } from '@/lib/mqtt';
import { sendCommandWithAck } from '@/lib/mqttTransaction';
import { useAuth } from '@/components/providers/auth-provider';
import { useMqttStatus, useMqttLogs } from '@/components/providers/mqtt-provider';
import { toast } from 'sonner';
import { useLanguage } from '@/components/providers/language-provider';
import { useEffect } from 'react';
import type { RelayMutation, Schedule, SystemConfig, RelaySource } from '@/lib/types';

// ---------- Status (hybrid REST/MQTT) ----------
export function useStatus() {
  const { session, isMqttMode } = useAuth();
  const mqttStatus = useMqttStatus();
  const qc = useQueryClient();

  // REST query (disabled when MQTT is active)
  const restQuery = useQuery({
    queryKey: ['status'],
    queryFn: () => api.status(),
    enabled: session.isAuthenticated && !isMqttMode,
    refetchInterval: isMqttMode ? false : 3_000,
  });

  // When MQTT status arrives, update the query cache so all components see it
  useEffect(() => {
    if (mqttStatus) {
      qc.setQueryData(['status'], mqttStatus);
    }
  }, [mqttStatus, qc]);

  if (isMqttMode) {
    return {
      data: mqttStatus ?? undefined,
      isLoading: !mqttStatus,
      refetch: async () => { mqttApi.getStatus(); },
    };
  }
  return restQuery;
}

// ---------- Config (REST only — MQTT doesn't have a separate config endpoint) ----------
export function useConfig() {
  const { session, isMqttMode } = useAuth();
  const mqttStatus = useMqttStatus();

  const restQuery = useQuery({
    queryKey: ['config'],
    queryFn: () => api.config(),
    enabled: session.isAuthenticated && !isMqttMode,
  });

  // In MQTT mode, derive config from status
  if (isMqttMode && mqttStatus) {
    const config: SystemConfig = {
      deviceName: mqttStatus.deviceName,
      timezone: mqttStatus.timezone,
      channels: mqttStatus.channels,
      schedules: mqttStatus.schedules ?? [],
      pirs: mqttStatus.pirs,
    };
    return { data: config, isLoading: false };
  }
  return restQuery;
}

// ---------- Version / Firmware ----------
export function useVersion() {
  const { session, isMqttMode } = useAuth();
  const mqttStatus = useMqttStatus();

  const restQuery = useQuery({
    queryKey: ['version'],
    queryFn: () => api.version(),
    enabled: session.isAuthenticated && !isMqttMode,
    refetchInterval: isMqttMode ? false : 30_000,
  });

  if (isMqttMode && mqttStatus) {
    return {
      data: {
        currentVersion: mqttStatus.firmwareVersion,
        buildDate: mqttStatus.buildDate,
        latestAvailable: '4.0.0',
        updateAvailable: false,
        signatureVerified: true,
        otaStatus: 'up-to-date' as const,
        lastUpdateAt: null,
        lastUpdateStatus: null,
      },
      isLoading: false,
    };
  }
  return restQuery;
}

// ---------- Logs (hybrid REST/MQTT) ----------
export function useLogs(filter?: { type?: string; channelId?: number; limit?: number }) {
  const { session, isMqttMode } = useAuth();
  const mqttLogs = useMqttLogs(filter?.limit ?? 200);

  const restQuery = useQuery({
    queryKey: ['logs', filter],
    queryFn: () => api.logs(filter),
    enabled: session.isAuthenticated && !isMqttMode,
    refetchInterval: isMqttMode ? false : 5_000,
  });

  if (isMqttMode) {
    let logs = mqttLogs;
    if (filter?.type && filter.type !== 'all') {
      logs = logs.filter((l) => l.type === filter.type);
    }
    if (filter?.channelId && String(filter.channelId) !== 'all') {
      logs = logs.filter((l) => l.channelId === filter.channelId);
    }
    return { data: { logs, total: logs.length }, isLoading: false };
  }
  return restQuery;
}

// ---------- Relay mutation (hybrid REST/MQTT) ----------
export function useRelayMutation() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const { isMqttMode } = useAuth();

  return useMutation({
    mutationFn: async (mutation: RelayMutation) => {
      if (isMqttMode) {
        const ack = await sendCommandWithAck({
          type: 'relay',
          action: mutation.action,
          channelId: mutation.channelId,
          mode: mutation.mode,
          manualState: mutation.manualState,
        });
        return { channel: null, ack } as const;
      }
      const channel = await api.relay(mutation);
      return { channel, ack: undefined } as const;
    },
    onSuccess: (data, vars) => {
      if (!isMqttMode) {
        qc.invalidateQueries({ queryKey: ['status'] });
      } else if (data.ack?.data) {
        // MQTT mode: update status cache directly from ACK data
        // This provides deterministic UI update without waiting for next status push
        qc.setQueryData<{ channels: Array<{ id: number; state: boolean; source: string; modeAuto: boolean }> } | undefined>(
          ['status'],
          (old) => {
            if (!old?.channels) return old;
            return {
              ...old,
              channels: old.channels.map((ch) =>
                ch.id === vars.channelId && data.ack?.data
                  ? {
                      ...ch,
                      state: data.ack.data.state ?? ch.state,
                      source: (data.ack.data.source as RelaySource) ?? ch.source,
                      modeAuto: data.ack.data.modeAuto ?? ch.modeAuto,
                    }
                  : ch
              ),
            };
          }
        );
      }
      if (vars.action === 'on' || vars.action === 'off') {
        toast.success(vars.action === 'off' ? t('toast.relay_off') : t('toast.relay_on'));
      } else {
        toast.success(t('toast.saved'));
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

// ---------- Channel rename (hybrid REST/MQTT with ACK) ----------
export function useRenameChannel() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const { isMqttMode } = useAuth();

  return useMutation({
    mutationFn: async ({ channelId, name }: { channelId: number; name: string }) => {
      if (isMqttMode) {
        await sendCommandWithAck({
          type: 'channel', action: 'rename', channelId, name,
        });
        return { channel: { id: channelId, name } };
      }
      return api.channelRename(channelId, name);
    },
    onSuccess: () => {
      if (!isMqttMode) {
        qc.invalidateQueries({ queryKey: ['config'] });
        qc.invalidateQueries({ queryKey: ['status'] });
      }
      toast.success(t('toast.saved'));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

// ---------- Schedule mutation (hybrid REST/MQTT with ACK) ----------
export function useScheduleMutation() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const { isMqttMode } = useAuth();

  return useMutation({
    mutationFn: async (sched: Schedule) => {
      if (isMqttMode) {
        await sendCommandWithAck({
          type: 'schedule', action: 'upsert', ...sched,
        });
        return { schedule: sched };
      }
      return api.schedule(sched);
    },
    onSuccess: () => {
      if (!isMqttMode) {
        qc.invalidateQueries({ queryKey: ['config'] });
        qc.invalidateQueries({ queryKey: ['status'] });
      }
      toast.success(t('toast.saved'));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

export function useScheduleDelete() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const { isMqttMode } = useAuth();

  return useMutation({
    mutationFn: async (id: number) => {
      if (isMqttMode) {
        await sendCommandWithAck({ type: 'schedule', action: 'delete', id });
        return { deleted: true };
      }
      return api.scheduleDelete(id);
    },
    onSuccess: () => {
      if (!isMqttMode) {
        qc.invalidateQueries({ queryKey: ['config'] });
        qc.invalidateQueries({ queryKey: ['status'] });
      }
      toast.success(t('toast.saved'));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

// ---------- PIR mutation (hybrid REST/MQTT) ----------
export function usePirMutation() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const { isMqttMode } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...opts }: { id: number; enabled?: boolean; holdTime?: number }) => {
      if (isMqttMode) {
        await sendCommandWithAck({ type: 'pir', action: 'config', id, ...opts });
        return { pir: null };
      }
      return api.pir(id, opts);
    },
    onSuccess: () => {
      if (!isMqttMode) {
        qc.invalidateQueries({ queryKey: ['status'] });
        qc.invalidateQueries({ queryKey: ['config'] });
      }
      toast.success(t('toast.saved'));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

export function usePirTest() {
  const { t } = useLanguage();
  const { isMqttMode } = useAuth();

  return useMutation({
    mutationFn: async (id: number) => {
      if (isMqttMode) {
        await sendCommandWithAck({ type: 'pir', action: 'test', id });
        return { triggered: true };
      }
      return api.pirTest(id);
    },
    onSuccess: () => toast.success(t('pir.test_trigger')),
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

// ---------- Time mutation (hybrid REST/MQTT) ----------
export function useTimeMutation() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const { isMqttMode } = useAuth();

  return useMutation({
    mutationFn: async (datetime: string) => {
      if (isMqttMode) {
        await sendCommandWithAck({ type: 'time', action: 'set', datetime });
        return { synced: true };
      }
      return api.time(datetime);
    },
    onSuccess: () => {
      if (!isMqttMode) qc.invalidateQueries({ queryKey: ['status'] });
      toast.success(t('toast.time_synced'));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

// ---------- OTA (REST only — MQTT can't handle large binary uploads) ----------
export function useOtaCheck() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const { isMqttMode } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (isMqttMode) return { available: false, latestVersion: '4.0.0', currentVersion: '4.0.0' };
      return api.otaCheck();
    },
    onSuccess: (data) => {
      if (!isMqttMode) qc.invalidateQueries({ queryKey: ['version'] });
      if (data.available) {
        toast.success(t('ota.update_available') + `: v${data.latestVersion}`);
      } else {
        toast.success(t('ota.up_to_date'));
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

export function useOtaUpload() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const { isMqttMode } = useAuth();

  return useMutation({
    mutationFn: async ({ file, onProgress }: { file: File; onProgress?: (pct: number) => void }) => {
      if (isMqttMode) {
        toast.error('OTA upload not available in MQTT mode — use LAN connection for firmware updates');
        throw new Error('OTA not available in MQTT mode');
      }
      return api.otaUpload(file, onProgress);
    },
    onSuccess: () => {
      if (!isMqttMode) qc.invalidateQueries({ queryKey: ['version'] });
      toast.success(t('toast.ota_success'));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.ota_failed')),
  });
}

// ---------- Reboot (hybrid REST/MQTT) ----------
export function useReboot() {
  const { t } = useLanguage();
  const { isMqttMode } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (isMqttMode) {
        await sendCommandWithAck({ type: 'system', action: 'reboot' });
        return { rebooting: true };
      }
      return api.reboot();
    },
    onSuccess: () => toast.success(t('toast.rebooting')),
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

// ---------- Device config (REST only in MQTT mode — device name/timezone need NVS write) ----------
export function useDeviceConfigMutation() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const { isMqttMode } = useAuth();

  return useMutation({
    mutationFn: async (opts: { deviceName?: string; timezone?: string }) => {
      if (isMqttMode) {
        await sendCommandWithAck({ type: 'config', action: 'setDevice', ...opts });
        return { updated: true };
      }
      return api.updateDevice(opts);
    },
    onSuccess: () => {
      if (!isMqttMode) {
        qc.invalidateQueries({ queryKey: ['status'] });
        qc.invalidateQueries({ queryKey: ['config'] });
      }
      toast.success(t('toast.saved'));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

// ---------- Password change (REST only — MQTT doesn't support auth) ----------
export function useChangePassword() {
  const { t } = useLanguage();
  const { isMqttMode } = useAuth();

  return useMutation({
    mutationFn: async ({ current, next }: { current: string; next: string }) => {
      if (isMqttMode) {
        toast.info('Password changes require LAN connection');
        return { changed: false };
      }
      return api.changePassword(current, next);
    },
    onSuccess: () => {
      if (!isMqttMode) toast.success(t('toast.password_changed'));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

// ---------- Export / Import config (REST only) ----------
export function useExportConfig() {
  const { t } = useLanguage();
  const { isMqttMode } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (isMqttMode) {
        toast.info('Config export requires LAN connection');
        return { config: null as unknown as SystemConfig };
      }
      return api.exportConfig();
    },
    onSuccess: ({ config }) => {
      if (config && !isMqttMode) {
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `timer12-config-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success(t('toast.config_exported'));
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

export function useImportConfig() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  const { isMqttMode } = useAuth();

  return useMutation({
    mutationFn: async (cfg: SystemConfig) => {
      if (isMqttMode) {
        toast.info('Config import requires LAN connection');
        return { imported: false };
      }
      return api.importConfig(cfg);
    },
    onSuccess: () => {
      if (!isMqttMode) {
        qc.invalidateQueries();
        toast.success(t('toast.config_imported'));
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

// ---------- Factory reset (REST only) ----------
export function useFactoryResetPrepare() {
  const { t } = useLanguage();
  const { isMqttMode } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (isMqttMode) {
        toast.info('Factory reset requires LAN connection');
        return { token: '', expiresAt: 0 };
      }
      return api.factoryResetPrepare();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

export function useFactoryResetConfirm() {
  const { t } = useLanguage();
  const { isMqttMode } = useAuth();

  return useMutation({
    mutationFn: async (token: string) => {
      if (isMqttMode) {
        toast.info('Factory reset requires LAN connection');
        return { reset: false };
      }
      return api.factoryResetConfirm(token);
    },
    onSuccess: () => {
      if (!isMqttMode) toast.success(t('toast.factory_reset_done'));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}
