'use client';
import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, post } from '@/lib/api';
import { openRazorpay, type RazorpayOrder } from '@/lib/external';
import { dateTime, money, num } from '@/lib/format';
import type { Paged, WalletTxn } from '@/lib/types';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { toast } from '@/store/ui';
import { Async, Badge, Button, Card, Field, Input, PageTitle, SectionTitle } from '@/components/ui';

export function WalletView() {
  const t = useT();
  const qc = useQueryClient();
  const user = useAuth((s) => s.user);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const bal = useQuery({ queryKey: ['wallet'], queryFn: () => api<{ balance: string; currency: string }>('/wallet') });
  const txns = useQuery({ queryKey: ['wallet', 'txns'], queryFn: () => api<Paged<WalletTxn>>('/wallet/transactions?limit=50') });

  async function topup(e: FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!(n >= 1 && n <= 100000)) return toast.error('Enter an amount between ₹1 and ₹1,00,000');
    setBusy(true);
    try {
      const order = await post<RazorpayOrder>('/wallet/topup/order', { amount: n });
      const r = await openRazorpay(order, {
        name: 'TownServices',
        description: 'Wallet top-up',
        prefill: { name: user?.name, email: user?.email ?? undefined, contact: user?.phone ?? undefined },
      });
      await post('/wallet/topup/verify', {
        razorpayOrderId: r.razorpay_order_id,
        razorpayPaymentId: r.razorpay_payment_id,
        razorpaySignature: r.razorpay_signature,
      });
      toast.success(t('wallet.topupOk'));
      setAmount('');
      qc.invalidateQueries({ queryKey: ['wallet'] });
    } catch (e2) {
      toast.error((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle>{t('wallet.title')}</PageTitle>
      <Card className="bg-gradient-to-br from-brand to-orange-500 text-white">
        <p className="text-sm opacity-90">{t('wallet.balance')}</p>
        <p className="mt-1 text-3xl font-extrabold">{bal.isLoading ? '…' : money(bal.data?.balance)}</p>
      </Card>
      <SectionTitle>{t('wallet.topup')}</SectionTitle>
      <Card>
        <form onSubmit={topup} className="flex flex-wrap items-end gap-2" noValidate>
          <div className="min-w-40 flex-1">
            <Field label={t('wallet.amount')}>{(p) => <Input {...p} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />}</Field>
          </div>
          <Button type="submit" loading={busy} className="mb-3">{t('wallet.topup')}</Button>
        </form>
        <div className="flex gap-2">
          {[100, 500, 1000].map((n) => (
            <Button key={n} size="sm" variant="outline" onClick={() => setAmount(String(n))}>₹{n}</Button>
          ))}
        </div>
      </Card>
      <SectionTitle>{t('wallet.txns')}</SectionTitle>
      <Async q={txns} isEmpty={(d) => d.items.length === 0}>
        {(d) => (
          <ul className="space-y-2">
            {d.items.map((x) => (
              <li key={x.id}>
                <Card className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium">{x.reason.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-500">{dateTime(x.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className={x.type === 'CREDIT' ? 'font-bold text-green-700' : 'font-bold text-gray-900'}>
                      {x.type === 'CREDIT' ? '+' : '−'}{money(num(x.amount))}
                    </p>
                    <Badge tone={x.type === 'CREDIT' ? 'green' : 'gray'}>{x.type}</Badge>
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
