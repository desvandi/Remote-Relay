'use client';

import { useLanguage } from '@/components/providers/language-provider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles, Brain, Zap, AlertTriangle, Wrench, Radar,
  Info, AlertCircle, ShieldCheck, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AiInsight, InsightCategory, InsightSeverity } from '@/lib/types';
import { toast } from 'sonner';

// Mock insights — would come from GAS → Gemini pipeline in production
const MOCK_INSIGHTS: AiInsight[] = [
  {
    id: 'habit-1',
    category: 'habit_analysis',
    severity: 'info',
    title: 'Relay 2 selalu aktif 07:55',
    body: 'Berdasarkan log 30 hari terakhir, Relay 2 (Lampu Taman) selalu menyala tepat pukul 07:55 WIB setiap hari. Saat ini jadwal diatur ke 08:00. Disarankan menyesuaikan jadwal menjadi 07:55 untuk akurasi lebih tinggi.',
    channelId: 2,
    action: { label: 'Terapkan 07:55', type: 'apply_suggestion', payload: { schedule: '07:55' } },
    generatedAt: Date.now() - 3_600_000,
    source: 'gemini-mock',
  },
  {
    id: 'energy-1',
    category: 'energy_analysis',
    severity: 'warning',
    title: 'Relay 6 aktif 17 jam/hari',
    body: 'Relay 6 (Lampu Dapur) rata-rata aktif 17 jam per hari dalam seminggu terakhir. Estimasi konsumsi listrik tinggi. Pertimbangkan jadwal otomatis atau sensor PIR untuk mematikan saat tidak ada aktivitas.',
    channelId: 6,
    action: { label: 'Tinjau Jadwal', type: 'review' },
    generatedAt: Date.now() - 7_200_000,
    source: 'gemini-mock',
  },
  {
    id: 'fault-1',
    category: 'fault_detection',
    severity: 'critical',
    title: 'Relay 8 tidak OFF selama 12 hari',
    body: 'Relay 8 (AC Kamar Utama) tidak pernah mati selama 12 hari berturut-turut. Kemungkinan: (1) relay macet secara fisik, (2) sensor rusak, atau (3) jadwal salah. Disarankan inspeksi segera.',
    channelId: 8,
    action: { label: 'Inspeksi Sekarang', type: 'review' },
    generatedAt: Date.now() - 14_400_000,
    source: 'gemini-mock',
  },
  {
    id: 'maint-1',
    category: 'predictive_maintenance',
    severity: 'warning',
    title: 'Relay 4 telah aktif 6500 kali',
    body: 'Relay 4 (Kipas Ruang Tamu) telah di-toggle 6500 kali sejak pemasangan. Berdasarkan MTBF relay OMron G3MB-202P (~100.000 operasi), disarankan inspeksi kontak relay dalam 6 bulan ke depan.',
    channelId: 4,
    action: { label: 'Jadwalkan Inspeksi', type: 'review' },
    generatedAt: Date.now() - 21_600_000,
    source: 'gemini-mock',
  },
  {
    id: 'pir-1',
    category: 'pir_recommendation',
    severity: 'info',
    title: 'PIR 3 (Lampu Belakang) jarang digunakan',
    body: 'PIR 3 hanya ter-trigger 2x dalam 7 hari terakhir. Jika pola ini berlanjut, PIR dapat di-disable untuk menghemat daya dan mengurangi noise pada log. Aktivitas pengguna di area belakang tergolong rendah.',
    channelId: 11,
    action: { label: 'Disable PIR 3', type: 'apply_suggestion', payload: { pirId: 3, enabled: false } },
    generatedAt: Date.now() - 28_800_000,
    source: 'gemini-mock',
  },
  {
    id: 'habit-2',
    category: 'habit_analysis',
    severity: 'info',
    title: 'Pola penggunaan AC malam hari',
    body: 'AC Kamar Utama (CH8) rata-rata menyala pukul 22:00 dan dimatikan pukul 05:00. Pola konsisten di hari kerja. Weekend cenderung lebih lama (sampai 07:00). Disarankan jadwal terpisah weekday/weekend.',
    channelId: 8,
    action: { label: 'Buat Jadwal', type: 'review' },
    generatedAt: Date.now() - 36_000_000,
    source: 'gemini-mock',
  },
];

const CATEGORY_META: Record<InsightCategory, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  habit_analysis: { icon: Brain, color: 'text-status-info' },
  energy_analysis: { icon: Zap, color: 'text-status-warn' },
  fault_detection: { icon: AlertTriangle, color: 'text-status-error' },
  predictive_maintenance: { icon: Wrench, color: 'text-status-warn' },
  pir_recommendation: { icon: Radar, color: 'text-status-info' },
};

const SEVERITY_META: Record<InsightSeverity, { color: string; bg: string; labelKey: 'ai.severity.info' | 'ai.severity.warning' | 'ai.severity.critical' }> = {
  info: { color: 'text-status-info', bg: 'bg-status-info/10', labelKey: 'ai.severity.info' },
  warning: { color: 'text-status-warn', bg: 'bg-status-warn/10', labelKey: 'ai.severity.warning' },
  critical: { color: 'text-status-error', bg: 'bg-status-error/10', labelKey: 'ai.severity.critical' },
};

const CATEGORY_LABEL_KEY: Record<InsightCategory, 'ai.category.habit' | 'ai.category.energy' | 'ai.category.fault' | 'ai.category.maintenance' | 'ai.category.pir'> = {
  habit_analysis: 'ai.category.habit',
  energy_analysis: 'ai.category.energy',
  fault_detection: 'ai.category.fault',
  predictive_maintenance: 'ai.category.maintenance',
  pir_recommendation: 'ai.category.pir',
};

export function AiView() {
  const { t } = useLanguage();

  const onAction = (insight: AiInsight) => {
    if (insight.action?.type === 'apply_suggestion') {
      toast.success(`Saran diterapkan: ${insight.action.label}`);
    } else if (insight.action?.type === 'review') {
      toast.info(`Membuka halaman review untuk: ${insight.title}`);
    } else {
      toast.success(`Insight diabaikan`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          {t('ai.title')}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t('ai.subtitle')}</p>
      </div>

      {/* Pipeline diagram */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="px-2 py-1 rounded-md bg-card border border-border/60 font-mono">ESP32</span>
            <span className="text-muted-foreground">→</span>
            <span className="px-2 py-1 rounded-md bg-card border border-border/60 font-mono">Google Apps Script</span>
            <span className="text-muted-foreground">→</span>
            <span className="px-2 py-1 rounded-md bg-card border border-border/60 font-mono">Gemini API</span>
            <span className="text-muted-foreground">→</span>
            <span className="px-2 py-1 rounded-md bg-card border border-border/60 font-mono">Dashboard</span>
            <Badge variant="outline" className="ml-auto text-status-warn border-status-warn/30">
              Mock Data
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <div className="rounded-lg border border-status-warn/30 bg-status-warn/5 px-4 py-3 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-status-warn flex-shrink-0 mt-0.5" />
        <p className="text-sm text-status-warn">{t('ai.disclaimer')}</p>
      </div>

      {/* Insight cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {MOCK_INSIGHTS.map((insight) => {
          const catMeta = CATEGORY_META[insight.category];
          const sevMeta = SEVERITY_META[insight.severity];
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
                        {t(CATEGORY_LABEL_KEY[insight.category])}
                        {insight.channelId && ` · CH${insight.channelId}`}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="outline" className={cn('text-[9px] h-5 flex-shrink-0', sevMeta.color, 'border-current/30')}>
                    {t(sevMeta.labelKey)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">{insight.body}</p>
                {insight.action && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant={insight.severity === 'critical' ? 'destructive' : 'default'} onClick={() => onAction(insight)}>
                      {insight.action.label}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onAction({ ...insight, action: { label: '', type: 'dismiss' } })}>
                      {t('common.dismiss')}
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
                    {new Date(insight.generatedAt).toLocaleString('id-ID', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
