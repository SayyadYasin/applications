'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, post } from '@/lib/api';
import { getPosition } from '@/lib/external';
import { money, num } from '@/lib/format';
import type { Booking } from '@/lib/types';
import { useT } from '@/i18n';
import { toast } from '@/store/ui';
import { Async, Badge, Button, Card, EmptyState, SectionTitle, statusTone } from '@/components/ui';
import { usePartnerMe } from '@/features/partner/hooks';
import { JobCard } from '@/features/partner/JobCard';
import { isActive } from '@/features/bookings/parts';

interface Summary { todayNet: string; last7DaysNet: string; available: string; jobs: number }

export default function PartnerHome() {
  const t = useT();
  const qc = useQueryClient();
  const me = usePartnerMe();
  const [busy, setBusy] = useState(false);
  const summary = useQuery({ queryKey: ['earn-summary'], queryFn: () => api<Summary>('/earnings/summary') });
  const jobs = useQuery({ queryKey: ['partner-jobs'], queryFn: () => api<Booking[]>('/bookings'), refetchInterval: 15_000 });

  async function toggle(next: boolean) {
    setBusy(true);
    try {
      let pos: { lat: number; lng: number } | undefined;
      if (next) pos = await getPosition().catch(() => undefined);
      await post('/partners/me/online', { online: next, ...pos });
      qc.invalidateQueries({ queryKey: ['partner-me'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reject(id: string) {
    try {
      await post(`/bookings/${id}/reject`);
      qc.invalidateQueries({ queryKey: ['partner-jobs'] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const p = me.data;
  return (
    <>
      <Async q={me}>
        {(partner) => (
          <>
            <Card className="flex items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold">{partner.user.name}</p>
                <p className="text-sm text-gray-600">★ {partner.ratingAvg.toFixed(1)} ({partner.ratingCount}) · {partner.completedJobs} jobs</p>
                {partner.isOnline && <p className="text-xs text-green-700">● {t('partner.sharingLocation')}</p>}
              </div>
              <Button
                variant={partner.isOnline ? 'outline' : 'primary'}
                loading={busy}
                disabled={partner.kycStatus !== 'APPROVED'}
                onClick={() => toggle(!partner.isOnline)}
                aria-pressed={partner.isOnline}
              >
                {partner.isOnline ? t('partner.goOffline') : t('partner.goOnline')}
              </Button>
            </Card>
            {partner.kycStatus !== 'APPROVED' && (
              <Card className="mt-3 border-orange-300 bg-orange-50">
                <p className="font-semibold">{t('partner.kyc')} <Badge tone={statusTone(partner.kycStatus)}>{partner.kycStatus}</Badge></p>
                <p className="mb-2 text-sm text-gray-600">Complete KYC, pick your services and set availability to start receiving jobs.</p>
                <div className="flex flex-wrap gap-2">
                  <Link href="/partner/kyc" className="rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white">{t('partner.kyc')}</Link>
                  <Link href="/partner/services" className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold">{t('partner.services')}</Link>
                  <Link href="/partner/availability" className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold">{t('partner.availability')}</Link>
                </div>
              </Card>
            )}
          </>
        )}
      </Async>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Card className="p-3"><p className="text-xs text-gray-500">{t('partner.today')}</p><p className="font-bold text-brand">{money(num(summary.data?.todayNet))}</p></Card>
        <Card className="p-3"><p className="text-xs text-gray-500">{t('partner.last7')}</p><p className="font-bold">{money(num(summary.data?.last7DaysNet))}</p></Card>
        <Card className="p-3"><p className="text-xs text-gray-500">{t('partner.available')}</p><p className="font-bold">{money(num(summary.data?.available))}</p></Card>
      </div>

      <SectionTitle>{t('partner.newJobs')}</SectionTitle>
      <Async q={jobs} empty={<EmptyState icon="🛠️" />}>
        {(list) => {
          const incoming = list.filter((b) => b.status === 'ASSIGNED');
          const ongoing = list.filter((b) => ['PARTNER_EN_ROUTE', 'IN_PROGRESS'].includes(b.status));
          return (
            <>
              {incoming.length === 0 && ongoing.length === 0 && <EmptyState icon="🛠️" />}
              <ul className="space-y-2">
                {[...ongoing, ...incoming].map((b) => (
                  <li key={b.id}>
                    <JobCard b={b}>
                      {b.status === 'ASSIGNED' && (
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <Button variant="outline" onClick={() => reject(b.id)}>{t('partner.reject')}</Button>
                          <Link href={`/partner/jobs/${b.id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-4 font-semibold text-white">{t('partner.accept')}</Link>
                        </div>
                      )}
                    </JobCard>
                  </li>
                ))}
              </ul>
              {list.some(isActive) && <p className="mt-2 text-center text-xs text-gray-400">Auto-refreshing every 15s</p>}
            </>
          );
        }}
      </Async>
      {p && null}
    </>
  );
}
