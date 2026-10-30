'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, post } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import { useT } from '@/i18n';
import { toast } from '@/store/ui';
import { Async, Button, Card, Input, PageTitle, SectionTitle } from '@/components/ui';
import { ReferralCard } from '@/features/referral/ReferralCard';

interface Loyalty {
  points: number;
  redeemableValue: number;
  rule: { earn: string; redeem: string };
  history: { id: string; points: number; reason: string; createdAt: string }[];
}

export default function LoyaltyPage() {
  const t = useT();
  const qc = useQueryClient();
  const [pts, setPts] = useState('100');
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['loyalty'], queryFn: () => api<Loyalty>('/loyalty') });

  async function redeem() {
    setBusy(true);
    try {
      const r = await post<{ credited: number }>('/loyalty/redeem', { points: Number(pts) });
      toast.success(`${money(r.credited)} added to wallet`);
      qc.invalidateQueries({ queryKey: ['loyalty'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle>{t('loyalty.title')}</PageTitle>
      <Async q={q}>
        {(l) => (
          <>
            <Card className="bg-gradient-to-br from-amber-500 to-brand text-white">
              <p className="text-sm opacity-90">{t('loyalty.points')}</p>
              <p className="text-3xl font-extrabold">{l.points}</p>
              <p className="text-xs opacity-90">≈ {money(l.redeemableValue)}</p>
            </Card>
            <p className="mt-2 text-xs text-gray-500">{l.rule.earn} · {l.rule.redeem}</p>
            <Card className="mt-3 flex items-end gap-2">
              <div className="flex-1">
                <label htmlFor="pts" className="mb-1 block text-sm font-medium">{t('loyalty.points')}</label>
                <Input id="pts" inputMode="numeric" value={pts} onChange={(e) => setPts(e.target.value.replace(/\D/g, ''))} />
              </div>
              <Button loading={busy} onClick={redeem}>{t('loyalty.redeem')}</Button>
            </Card>
            <SectionTitle>{t('loyalty.history')}</SectionTitle>
            <ul className="space-y-2">
              {l.history.map((h) => (
                <li key={h.id}>
                  <Card className="flex justify-between py-3 text-sm">
                    <span>{h.reason.replace(/_/g, ' ')}<span className="block text-xs text-gray-400">{dateTime(h.createdAt)}</span></span>
                    <span className={h.points >= 0 ? 'font-bold text-green-700' : 'font-bold text-gray-700'}>{h.points > 0 ? '+' : ''}{h.points}</span>
                  </Card>
                </li>
              ))}
            </ul>
          </>
        )}
      </Async>
      <ReferralCard />
    </>
  );
}
