'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { money, num } from '@/lib/format';
import type { Bucket } from '@/lib/types';
import { useT } from '@/i18n';
import { Async, Card, Chip, LinkButton, PageTitle, Row, SectionTitle } from '@/components/ui';
import { BarChart, LineChart, ProgressBar } from '@/components/charts';

interface Summary {
  totalGross: string; totalCommission: string; totalNet: string; jobs: number;
  todayNet: string; last7DaysNet: string; available: string; pendingPayouts: string; paidOut: string;
  minPayout: number; canRequestPayout: boolean;
}
interface Report { buckets: Bucket[]; totals: { jobs: number; net: number } }
interface Analytics {
  windowDays: number; completedJobs: number; cancelledJobs: number; completionRate: number | null; acceptanceRate: number;
  averageRating: number; ratingCount: number;
  earnings: { net: number; previousNet: number; changePct: number | null; trend: { period: string; net: number }[] };
}

export default function EarningsPage() {
  const t = useT();
  const [mode, setMode] = useState<'daily' | 'weekly'>('daily');
  const [days, setDays] = useState(30);
  const summary = useQuery({ queryKey: ['earn-summary'], queryFn: () => api<Summary>('/earnings/summary') });
  const report = useQuery({ queryKey: ['earn-report', mode], queryFn: () => api<Report>(`/earnings/${mode}`) });
  const analytics = useQuery({ queryKey: ['earn-analytics', days], queryFn: () => api<Analytics>(`/earnings/analytics?days=${days}`) });

  return (
    <>
      <PageTitle action={<LinkButton size="sm" href="/partner/payouts">{t('partner.payouts')}</LinkButton>}>{t('partner.earnings')}</PageTitle>
      <Async q={summary}>
        {(s) => (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Card className="p-3"><p className="text-xs text-gray-500">{t('partner.today')}</p><p className="text-xl font-bold text-brand">{money(s.todayNet)}</p></Card>
              <Card className="p-3"><p className="text-xs text-gray-500">{t('partner.last7')}</p><p className="text-xl font-bold">{money(s.last7DaysNet)}</p></Card>
              <Card className="p-3"><p className="text-xs text-gray-500">{t('partner.available')}</p><p className="text-xl font-bold">{money(s.available)}</p></Card>
              <Card className="p-3"><p className="text-xs text-gray-500">{t('partner.pending')}</p><p className="text-xl font-bold">{money(s.pendingPayouts)}</p></Card>
            </div>
            <Card className="mt-2">
              <Row label="Gross" value={money(s.totalGross)} />
              <Row label="Commission" value={`− ${money(s.totalCommission)}`} />
              <Row bold label="Net" value={money(s.totalNet)} />
              <Row label={t('partner.paidOut')} value={money(s.paidOut)} />
            </Card>
          </>
        )}
      </Async>

      <SectionTitle action={
        <div className="flex gap-2">
          <Chip active={mode === 'daily'} onClick={() => setMode('daily')}>{t('partner.daily')}</Chip>
          <Chip active={mode === 'weekly'} onClick={() => setMode('weekly')}>{t('partner.weekly')}</Chip>
        </div>
      }>{t('partner.earnings')}</SectionTitle>
      <Card>
        <Async q={report} isEmpty={(r) => r.buckets.length === 0}>
          {(r) => (
            <>
              <BarChart data={r.buckets.map((b) => ({ label: b.period.slice(mode === 'daily' ? 5 : 0), value: num(b.net) }))} />
              <p className="mt-2 text-sm text-gray-600">{r.totals.jobs} jobs · {money(r.totals.net)}</p>
            </>
          )}
        </Async>
      </Card>

      <SectionTitle action={
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => <Chip key={d} active={days === d} onClick={() => setDays(d)}>{d}d</Chip>)}
        </div>
      }>{t('partner.trend')}</SectionTitle>
      <Card>
        <Async q={analytics}>
          {(a) => (
            <>
              <LineChart data={a.earnings.trend.map((x) => ({ label: x.period.slice(5), value: x.net }))} />
              <p className="my-2 text-sm">
                {money(a.earnings.net)}{' '}
                {a.earnings.changePct != null && (
                  <span className={a.earnings.changePct >= 0 ? 'text-green-700' : 'text-red-600'}>
                    {a.earnings.changePct >= 0 ? '▲' : '▼'} {Math.abs(a.earnings.changePct)}% vs previous {a.windowDays}d
                  </span>
                )}
              </p>
              <div className="space-y-3">
                <ProgressBar label="Completion rate" value={a.completionRate ?? 0} />
                <ProgressBar label="Acceptance rate" value={a.acceptanceRate} />
              </div>
              <p className="mt-3 text-sm text-gray-600">{a.completedJobs} completed · {a.cancelledJobs} cancelled · ★ {a.averageRating.toFixed(1)} ({a.ratingCount})</p>
            </>
          )}
        </Async>
      </Card>
    </>
  );
}
