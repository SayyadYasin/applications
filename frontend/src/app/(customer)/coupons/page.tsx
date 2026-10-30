'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { dateOnly, money, num } from '@/lib/format';
import type { Coupon } from '@/lib/types';
import { useT } from '@/i18n';
import { toast } from '@/store/ui';
import { Async, Button, Card, EmptyState, PageTitle } from '@/components/ui';

export default function CouponsPage() {
  const t = useT();
  const q = useQuery({ queryKey: ['coupons', 'available'], queryFn: () => api<Coupon[]>('/coupons/available') });
  return (
    <>
      <PageTitle>{t('coupons.title')}</PageTitle>
      <Async q={q} empty={<EmptyState icon="🏷️" />}>
        {(list) => (
          <ul className="space-y-3">
            {list.map((c) => (
              <li key={c.code}>
                <Card className="flex items-center justify-between gap-3 border-dashed border-brand">
                  <div>
                    <p className="font-mono text-lg font-bold text-brand">{c.code}</p>
                    <p className="text-sm font-medium">
                      {c.type === 'PERCENT' ? `${num(c.value)}%` : money(c.value)} {t('coupons.off')}
                      {c.maxDiscount ? ` (max ${money(c.maxDiscount)})` : ''}
                    </p>
                    <p className="text-xs text-gray-500">
                      {num(c.minOrder) > 0 && `${t('coupons.min', { amount: money(c.minOrder) })} · `}
                      {t('coupons.valid', { date: dateOnly(c.validTo) })}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard?.writeText(c.code).then(() => toast.success(t('common.copied')))}>Copy</Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </>
  );
}
