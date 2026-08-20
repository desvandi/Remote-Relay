'use client';

import { useMqtt } from '@/components/providers/mqtt-provider';
// PH2-1: isGasConfigured/getGasUrl removed from aiInsights.ts.
import { useAiInsights } from '@/lib/aiInsights';
import type { AiInsight } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Sparkles, Brain, Zap, AlertTriangle, Wrench, Radar,
  Info, ShieldCheck, Clock, Cloud,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type InsightCategory = 'habit_analysis' | 'energy_analysis' | 'fault_detection' | 'predictive_maintenance' | 'pir_recommendation' | 'battery_analysis';
type InsightSeverity = 'info' | 'warning' | 'critical';

const CATEGORY_META: Record<InsightCategory, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  habit_analysis: { icon: Brain, color: 'text-status-info' },
  energy_analysis: { icon: Zap, color: 'text-status-warn' },
  fault_detection: { icon: AlertTriangle, color: 'text-status-error' },
  predictive_maintenance: { icon: Wrench, color: 'text-status-warn' },
  pir_recommendation: { icon: Radar, color: 'text-status-info' },
  battery_analysis: { icon: ShieldCheck, color: 'text-status-info' },
};

const SEVERITY_META: Record<InsightSeverity, { color: string; bg: string; label: string }> = {
  info: { color: 'text-status-info', bg: 'bg-status-info/10', label: 'Info' },
  warning: { color: 'text-status-warn', bg: 'bg-status-warn/10', label: 'Warning' },
  critical: { color: 'text-status-error', bg: 'bg-status-error/10', label: 'Critical' },
};

const CATEGORY_LABELS: Record<InsightCategory, string> = {
  habit_analysis: 'Habit Analysis',
  energy_analysis: 'Energy Analysis',
  fault_detection: 'Fault Detection',
  predictive_maintenance: 'Predictive Maintenance',
  pir_recommendation: 'PIR Recommendation',
  battery_analysis: 'Battery Analysis',
};

export function AiView() {
  
  const { deviceId } = useMqtt();
  const { data: insights, isLoading } = useAiInsights(deviceId);
  // PH2-1: gasConfigured is derived from insights' source field.
  const gasConfigured = (insights ?? []).some(i => i.source === 'gemini');

  const onAction = (insightTitle: string, actionLabel: string) => {
    toast.success(`${actionLabel} — ${insightTitle}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          AI Insights
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Advisory recommendations from Gemini AI via Google Apps Script
        </p>
      </div>

      {/* Pipeline diagram */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="px-2 py-1 rounded-md bg-card border border-border/60 font-mono">ESP32</span>
            <span className="text-muted-foreground">→ POST logs/hour →</span>
            <span className="px-2 py-1 rounded-md bg-card border border-border/60 font-mono">GAS Web App</span>
            <span className="text-muted-foreground">→ Gemini API →</span>
            <span className="px-2 py-1 rounded-md bg-card border border-border/60 font-mono">Insights</span>
            <span className="text-muted-foreground">→ PWA fetch/5min →</span>
            <span className="px-2 py-1 rounded-md bg-card border border-border/60 font-mono">Dashboard</span>
            <Badge variant="outline" className={cn(
              "ml-auto text-xs",
              gasConfigured
                ? "text-status-on border-status-on/30"
                : "text-status-warn border-status-warn/30"
            )}>
              <Cloud className="w-3 h-3 mr-1" />
              {gasConfigured ? 'GAS Connected' : 'GAS Not Configured'}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* GAS not configured warning */}
      {!gasConfigured && (
        <div className="rounded-lg border border-status-warn/30 bg-status-warn/5 px-4 py-3 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-status-warn flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-status-warn font-medium">AI Insights using mock data</p>
            <p className="text-xs text-muted-foreground mt-1">
              To enable AI analysis via Gemini: deploy Code.gs to Google Apps Script,
              set <code className="font-mono bg-muted px-1 rounded">GAS_INSIGHTS_URL</code> in firmware
              <code className="font-mono bg-muted px-1 rounded"> Config.h</code>, and set
              <code className="font-mono bg-muted px-1 rounded"> GEMINI_API_KEY</code> in the
              GAS Script Properties. The ESP32 will then proxy authenticated requests to GAS
              and serve the results via <code className="font-mono bg-muted px-1 rounded">/api/insights</code>.
              See README for the full setup guide.
            </p>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="rounded-lg border border-status-warn/30 bg-status-warn/5 px-4 py-3 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-status-warn flex-shrink-0 mt-0.5" />
        <p className="text-sm text-status-warn">
          AI provides recommendations only. Final decisions remain with the user or firmware.
        </p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      )}

      {/* Insight cards */}
      {!isLoading && insights && insights.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((insight) => {
            const catMeta = CATEGORY_META[insight.category] || CATEGORY_META.habit_analysis;
            const sevMeta = SEVERITY_META[insight.severity] || SEVERITY_META.info;
            const CatIcon = catMeta.icon;
            return (
              <Card key={insight.id} className={cn('border-border/60 overflow-hidden')}>
                <CardHeader className="pb-2 space-y-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn('rounded-lg p-1.5 flex-shrink-0', sevMeta.bg)}>
                        <CatIcon className={cn('w-4 h-4', catMeta.color)} />
                      </div>
                      <div className="min-w-0">
                        <CardTitle className="text-sm leading-tight">{insight.title}</CardTitle>
                        <CardDescription className="text-[10px] mt-0.5">
                          {CATEGORY_LABELS[insight.category]}
                          {insight.channelId && ` · CH${insight.channelId}`}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn('text-[9px] h-5 flex-shrink-0', sevMeta.color, 'border-current/30')}>
                      {sevMeta.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">{insight.body}</p>
                  {insight.action && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={insight.severity === 'critical' ? 'destructive' : 'default'}
                        onClick={() => onAction(insight.title, insight.action!.label)}
                      >
                        {insight.action.label}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onAction(insight.title, 'Dismiss')}
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/40">
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" />
                      Advisory only
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(insight.generatedAt).toLocaleString('id-ID', {
                        hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'
                      })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && insights && insights.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
            No insights available yet. Insights are generated every hour by GAS.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
