// =============================================================================
// AI Insights — fetch from Google Apps Script Web App
// GAS calls Gemini API, caches results for 1 hour
// =============================================================================

import { useQuery } from '@tanstack/react-query';

const GAS_URL = process.env.NEXT_PUBLIC_GAS_INSIGHTS_URL || '';
const POLL_INTERVAL_MS = 5 * 60 * 1000;  // 5 minutes

export type AiInsight = {
  id: string;
  category: 'habit_analysis' | 'energy_analysis' | 'fault_detection' | 'predictive_maintenance' | 'pir_recommendation';
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string;
  channelId?: number | null;
  action?: {
    label: string;
    type: 'apply_suggestion' | 'review' | 'dismiss';
  };
  generatedAt: number;
  source: 'gemini' | 'mock';
};

type GasResponse = {
  success: boolean;
  insights?: AiInsight[];
  cached?: boolean;
  mock?: boolean;
  error?: string;
  message?: string;
};

export function useAiInsights(mac: string | null) {
  return useQuery({
    queryKey: ['ai-insights', mac],
    queryFn: async (): Promise<AiInsight[]> => {
      if (!GAS_URL) {
        // GAS not configured — return mock insights
        return getMockInsights();
      }
      if (!mac) {
        return getMockInsights();
      }

      const url = `${GAS_URL}?action=insights&mac=${mac}`;
      const res = await fetch(url, {
        method: 'GET',
        // GAS Web Apps need no-cors mode sometimes, but try normal first
      });

      if (!res.ok) {
        throw new Error(`GAS request failed: ${res.status}`);
      }

      const data: GasResponse = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'GAS returned error');
      }

      return data.insights || [];
    },
    enabled: !!mac,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });
}

export function isGasConfigured(): boolean {
  return !!GAS_URL;
}

export function getGasUrl(): string {
  return GAS_URL;
}

// Mock insights (shown when GAS is not configured or no data yet)
function getMockInsights(): AiInsight[] {
  return [
    {
      id: 'mock-1',
      category: 'habit_analysis',
      severity: 'info',
      title: 'AI Insights Not Configured',
      body: 'Deploy Google Apps Script (Code.gs) and set NEXT_PUBLIC_GAS_INSIGHTS_URL in Vercel to enable AI analysis via Gemini. See README for setup instructions.',
      channelId: null,
      action: { label: 'Dismiss', type: 'dismiss' },
      generatedAt: Date.now(),
      source: 'mock',
    },
    {
      id: 'mock-2',
      category: 'energy_analysis',
      severity: 'warning',
      title: 'Energy monitoring active',
      body: 'ESP32 is tracking Wh per relay. Connect GAS to get AI-powered energy recommendations based on actual usage patterns.',
      channelId: null,
      action: { label: 'Review', type: 'review' },
      generatedAt: Date.now(),
      source: 'mock',
    },
    {
      id: 'mock-3',
      category: 'fault_detection',
      severity: 'info',
      title: 'System healthy',
      body: 'All relays responding normally. No faults detected in recent logs.',
      channelId: null,
      action: { label: 'Dismiss', type: 'dismiss' },
      generatedAt: Date.now(),
      source: 'mock',
    },
  ];
}
