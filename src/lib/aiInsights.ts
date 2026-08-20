// =============================================================================
// AI Insights — Phase 2.1 (security rework) + Phase 5 (schema sync) + Phase 6 (actuator isolation)
// =============================================================================
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from './api';
import type { AiInsight } from './types';

const POLL_INTERVAL_MS = 5 * 60 * 1000;

type InsightsResponse = {
  success: boolean;
  insights?: AiInsight[];
  cached?: boolean;
  mock?: boolean;
  error?: string;
  message?: string;
};

// PH2-1: PWA fetches from ESP32's authenticated /api/insights endpoint.
export function useAiInsights(deviceId: string | null) {
  return useQuery({
    queryKey: ['ai-insights', deviceId],
    queryFn: async (): Promise<AiInsight[]> => {
      if (!deviceId) {
        return getMockInsights();
      }
      try {
        const envelope = await api.insights();
        const insights = envelope.insights || [];
        return insights.filter(ins => isValidInsight_(ins));
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          return getMockInsights();
        }
        console.warn('[aiInsights] fetch failed, falling back to mock:', err);
        return getMockInsights();
      }
    },
    enabled: !!deviceId,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS,
  });
}

const ALLOWED_CATEGORIES = [
  'habit_analysis', 'energy_analysis', 'fault_detection',
  'predictive_maintenance', 'pir_recommendation', 'battery_analysis',
] as const;
const ALLOWED_SEVERITIES = ['info', 'warning', 'critical'] as const;
const ALLOWED_ACTION_TYPES = ['apply_suggestion', 'review', 'dismiss'] as const;

function isValidInsight_(ins: unknown): ins is AiInsight {
  if (!ins || typeof ins !== 'object') return false;
  const i = ins as Record<string, unknown>;
  if (typeof i.id !== 'string' || !i.id) return false;
  if (typeof i.category !== 'string' || !(ALLOWED_CATEGORIES as readonly string[]).includes(i.category)) return false;
  if (typeof i.severity !== 'string' || !(ALLOWED_SEVERITIES as readonly string[]).includes(i.severity)) return false;
  if (typeof i.title !== 'string' || !i.title) return false;
  if (typeof i.body !== 'string' || !i.body) return false;
  if (i.channelId != null && (typeof i.channelId !== 'number' || i.channelId < 1 || i.channelId > 12)) return false;
  if (typeof i.generatedAt !== 'number') return false;
  if (typeof i.source !== 'string' || !['gemini', 'mock'].includes(i.source)) return false;
  if (i.action != null) {
    if (typeof i.action !== 'object') return false;
    const a = i.action as Record<string, unknown>;
    if (typeof a.label !== 'string') return false;
    if (typeof a.type !== 'string' || !(ALLOWED_ACTION_TYPES as readonly string[]).includes(a.type)) return false;
  }
  if (i.advisoryOnly === false) return false;
  return true;
}

function getMockInsights(): AiInsight[] {
  return [
    {
      id: 'mock-1',
      category: 'habit_analysis',
      severity: 'info',
      title: 'Waiting for AI insights',
      body: 'Once the ESP32 begins posting logs to Google Apps Script, Gemini will analyze device patterns.',
      channelId: null,
      action: { label: 'Dismiss', type: 'dismiss' },
      generatedAt: Date.now(),
      source: 'mock',
      advisoryOnly: true,
    },
  ];
}
