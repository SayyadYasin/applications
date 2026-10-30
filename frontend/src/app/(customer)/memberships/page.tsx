'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, post } from '@/lib/api';
import { openRazorpay, type RazorpayOrder } from '@/lib/external';
import { dateOnly, money } from '@/lib/format';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { toast } from '@/store/ui';
import { Async, Badge, Button, Card, PageTitle } from '@/components/ui';

interface Plan { id: string; name: string; price: string; durationDays: number; discountPct: number; freeSurge: boolean }
interface Mine { active: boolean; plan: Plan | null; endsAt: string | null }

export default function MembershipsPage() {
  const t = useT();
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const [busy, setBusy] = useState('');
  const plans = useQuery({ queryKey: ['plans'], queryFn: () => api<Plan[]>('/memberships/plans') });
  const mine = useQuery({ queryKey: ['membership'], queryFn: () => api<Mine>('/memberships/me') });

  async function buy(p: Plan, wallet: boolean) {
    setBusy(p.id + wallet);
    try {
      if (wallet) await post('/memberships/purchase/wallet', { planId: p.id });
      else {
        const order = await post<RazorpayOrder>('/memberships/purchase/order', { planId: p.id });
        const r = await openRazorpay(order, { name: 'TownServices', description: p.name, prefill: { name: user?.name, email: user?.email ?? undefined, contact: user?.phone ?? undefined } });
        await post('/memberships/purchase/verify', { planId: p.id, razorpayOrderId: r.razorpay_order_id, razorpayPaymentId: r.razorpay_payment_id, razorpaySignature: r.razorpay_signature });
      }
      toast.success('Membership activated');
      qc.invalidateQueries({ queryKey: ['membership'] });
      qc.invalidateQueries({ queryKey: ['wallet'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy('');
    }
  }

  return (
    <>
      <PageTitle>{t('member.title')}</PageTitle>
      {mine.data?.active && mine.data.plan && (
        <Card className="mb-4 border-green-300 bg-green-50">
          <p className="font-bold">{mine.data.plan.name} <Badge tone="green">Active</Badge></p>
          <p className="text-sm text-gray-600">{t('member.active', { date: dateOnly(mine.data.endsAt!) })}</p>
        </Card>
      )}
      <Async q={plans}>
        {(list) => (
          <ul className="space-y-3">
            {list.map((p) => (
              <li key={p.id}>
                <Card>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-lg font-bold">{p.name}</p>
                      <p className="text-sm text-gray-500">{t('member.days', { days: p.durationDays })}</p>
                    </div>
                    <p className="text-xl font-extrabold text-brand">{money(p.price)}</p>
                  </div>
                  <ul className="my-2 space-y-1 text-sm text-gray-700">
                    {p.discountPct > 0 && <li>✓ {t('member.discount', { pct: p.discountPct })}</li>}
                    {p.freeSurge && <li>✓ {t('member.freeSurge')}</li>}
                  </ul>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button loading={busy === p.id + false} onClick={() => buy(p, false)}>{t('member.buy')}</Button>
                    <Button variant="outline" loading={busy === p.id + true} onClick={() => buy(p, true)}>{t('member.buyWallet')}</Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </>
  );
}
