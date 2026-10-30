'use client';
import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, post } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import type { Paged, Payout } from '@/lib/types';
import { useT } from '@/i18n';
import { toast } from '@/store/ui';
import { Async, Badge, Button, Card, Field, Input, PageTitle, SectionTitle, statusTone } from '@/components/ui';

export default function PayoutsPage() {
  const t = useT();
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [upi, setUpi] = useState('');
  const [busy, setBusy] = useState(false);
  const summary = useQuery({ queryKey: ['earn-summary'], queryFn: () => api<{ available: string; minPayout: number }>('/earnings/summary') });
  const list = useQuery({ queryKey: ['payouts'], queryFn: () => api<Paged<Payout>>('/earnings/payouts?limit=50') });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!(n > 0)) return toast.error('Enter an amount');
    if (!/^[\w.-]{2,256}@[\w.-]{2,64}$/.test(upi)) return toast.error('Enter a valid UPI ID (name@bank)');
    setBusy(true);
    try {
      await post('/earnings/payouts', { amount: n, upiId: upi });
      toast.success('Payout requested');
      setAmount('');
      qc.invalidateQueries({ queryKey: ['payouts'] });
      qc.invalidateQueries({ queryKey: ['earn-summary'] });
    } catch (e2) {
      toast.error((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle>{t('partner.payouts')}</PageTitle>
      <Card>
        <p className="text-sm text-gray-500">{t('partner.available')}</p>
        <p className="mb-3 text-2xl font-extrabold text-brand">{money(summary.data?.available)}</p>
        <form onSubmit={submit} noValidate>
          <Field label={t('wallet.amount')} hint={summary.data ? `Minimum ${money(summary.data.minPayout)}` : undefined}>
            {(p) => <Input {...p} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />}
          </Field>
          <Field label={t('partner.upi')}>{(p) => <Input {...p} autoCapitalize="none" placeholder="name@bank" value={upi} onChange={(e) => setUpi(e.target.value.trim())} />}</Field>
          <Button type="submit" full loading={busy}>{t('partner.requestPayout')}</Button>
        </form>
      </Card>
      <SectionTitle>{t('partner.payouts')}</SectionTitle>
      <Async q={list} isEmpty={(d) => d.items.length === 0}>
        {(d) => (
          <ul className="space-y-2">
            {d.items.map((p) => (
              <li key={p.id}>
                <Card className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-semibold">{money(p.amount)}</p>
                    <p className="text-xs text-gray-500">{dateTime(p.createdAt)} · {p.upiId ?? p.bankAccount}</p>
                    {p.reference && <p className="text-xs text-gray-400">Ref {p.reference}</p>}
                  </div>
                  <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </>
  );
}
