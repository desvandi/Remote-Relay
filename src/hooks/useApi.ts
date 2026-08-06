'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/components/providers/auth-provider';
import { toast } from 'sonner';
import { useLanguage } from '@/components/providers/language-provider';
import type { RelayMutation, Schedule, SystemConfig } from '@/lib/types';

// ---------- Status ----------
export function useStatus() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['status'],
    queryFn: () => api.status(),
    enabled: session.isAuthenticated,
    refetchInterval: 3_000, // poll every 3s for live relay state
  });
}

// ---------- Config ----------
export function useConfig() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['config'],
    queryFn: () => api.config(),
    enabled: session.isAuthenticated,
  });
}

// ---------- Version / Firmware ----------
export function useVersion() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['version'],
    queryFn: () => api.version(),
    enabled: session.isAuthenticated,
    refetchInterval: 30_000,
  });
}

// ---------- Logs ----------
export function useLogs(filter?: { type?: string; channelId?: number; limit?: number }) {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['logs', filter],
    queryFn: () => api.logs(filter),
    enabled: session.isAuthenticated,
    refetchInterval: 5_000,
  });
}

// ---------- Relay mutation ----------
export function useRelayMutation() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: (mutation: RelayMutation) => api.relay(mutation),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['status'] });
      if (vars.action === 'toggle' || vars.action === 'on' || vars.action === 'off') {
        toast.success(vars.action === 'off' ? t('toast.relay_off') : t('toast.relay_on'));
      } else {
        toast.success(t('toast.saved'));
      }
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

// ---------- Schedule mutation ----------
export function useScheduleMutation() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: (sched: Schedule) => api.schedule(sched),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['config'] });
      qc.invalidateQueries({ queryKey: ['status'] });
      toast.success(t('toast.saved'));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

export function useScheduleDelete() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: (id: number) => api.scheduleDelete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['config'] });
      qc.invalidateQueries({ queryKey: ['status'] });
      toast.success(t('toast.saved'));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

// ---------- PIR mutation ----------
export function usePirMutation() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: ({ id, ...opts }: { id: number; enabled?: boolean; holdTime?: number }) =>
      api.pir(id, opts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['status'] });
      qc.invalidateQueries({ queryKey: ['config'] });
      toast.success(t('toast.saved'));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

export function usePirTest() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: (id: number) => api.pirTest(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['status'] });
      toast.success(t('pir.test_trigger'));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

// ---------- Time mutation ----------
export function useTimeMutation() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: (datetime: string) => api.time(datetime),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['status'] });
      toast.success(t('toast.time_synced'));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

// ---------- OTA ----------
export function useOtaCheck() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: () => api.otaCheck(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['version'] });
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
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (pct: number) => void }) =>
      api.otaUpload(file, onProgress),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['version'] });
      toast.success(t('toast.ota_success'));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.ota_failed')),
  });
}

// ---------- Reboot ----------
export function useReboot() {
  const { t } = useLanguage();
  return useMutation({
    mutationFn: () => api.reboot(),
    onSuccess: () => toast.success(t('toast.rebooting')),
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

// ---------- Device config ----------
export function useDeviceConfigMutation() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: (opts: { deviceName?: string; timezone?: string }) => api.updateDevice(opts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['status'] });
      qc.invalidateQueries({ queryKey: ['config'] });
      toast.success(t('toast.saved'));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

// ---------- Password change ----------
export function useChangePassword() {
  const { t } = useLanguage();
  return useMutation({
    mutationFn: ({ current, next }: { current: string; next: string }) =>
      api.changePassword(current, next),
    onSuccess: () => toast.success(t('toast.password_changed')),
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

// ---------- Export / Import config ----------
export function useExportConfig() {
  const { t } = useLanguage();
  return useMutation({
    mutationFn: () => api.exportConfig(),
    onSuccess: ({ config }) => {
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timer12-config-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('toast.config_exported'));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

export function useImportConfig() {
  const qc = useQueryClient();
  const { t } = useLanguage();
  return useMutation({
    mutationFn: (cfg: SystemConfig) => api.importConfig(cfg),
    onSuccess: () => {
      qc.invalidateQueries();
      toast.success(t('toast.config_imported'));
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

// ---------- Factory reset ----------
export function useFactoryResetPrepare() {
  const { t } = useLanguage();
  return useMutation({
    mutationFn: () => api.factoryResetPrepare(),
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}

export function useFactoryResetConfirm() {
  const { t } = useLanguage();
  return useMutation({
    mutationFn: (token: string) => api.factoryResetConfirm(token),
    onSuccess: () => toast.success(t('toast.factory_reset_done')),
    onError: (err) => toast.error(err instanceof Error ? err.message : t('toast.error')),
  });
}
