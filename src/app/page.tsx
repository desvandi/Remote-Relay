'use client';

import { useAuth } from '@/components/providers/auth-provider';
import { useUiStore } from '@/lib/store';
import { LoginForm } from '@/components/auth/login-form';
import { AppShell } from '@/components/layout/app-shell';
import { DashboardView } from '@/components/dashboard/dashboard-view';
import { SchedulerView } from '@/components/scheduler/scheduler-view';
import { PirView } from '@/components/pir/pir-view';
import { LogsView } from '@/components/logs/logs-view';
import { AiView } from '@/components/ai/ai-view';
import { EnergyAnalyticsView } from '@/components/energy/energy-analytics-view';
import { OtaView } from '@/components/ota/ota-view';
import { SettingsView } from '@/components/settings/settings-view';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const { session, loading } = useAuth();
  const { currentView } = useUiStore();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!session.isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <AppShell>
      {currentView === 'dashboard' && <DashboardView />}
      {currentView === 'scheduler' && <SchedulerView />}
      {currentView === 'pir' && <PirView />}
      {currentView === 'logs' && <LogsView />}
      {currentView === 'ai' && <AiView />}
      {currentView === 'energy' && <EnergyAnalyticsView />}
      {currentView === 'ota' && <OtaView />}
      {currentView === 'settings' && <SettingsView />}
    </AppShell>
  );
}
