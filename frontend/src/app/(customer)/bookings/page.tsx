'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { dateTime, loc, money } from '@/lib/format';
import type { Booking } from '@/lib/types';
import { useT } from '@/i18n';
import { useUi } from '@/store/ui';
import { Async, Card, Chip, EmptyState, LinkButton, PageTitle } from '@/components/ui';
import { StatusBadge, isActive } from '@/features/bookings/parts';

type Filter = 'all' | 'upcoming' | 'past' | 'cancelled';

export default function BookingsPage() {
  const t = useT();
  useUi((s) => s.lang);
  const [f, setF] = useState<Filter>('all');
  const q = useQuery({ queryKey: ['bookings'], queryFn: () => api<Booking[]>('/bookings'), refetchInterval: 20_000 });

  const match = (b: Booking) =>
    f === 'all' ? true : f === 'upcoming' ? isActive(b) : f === 'past' ? b.status === 'COMPLETED' : ['CANCELLED', 'REJECTED'].includes(b.status);

  return (
    <>
      <PageTitle>{t('bookings.title')}</PageTitle>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4" role="group" aria-label="Filter">
        {(['all', 'upcoming', 'past', 'cancelled'] as Filter[]).map((x) => (
          <Chip key={x} active={f === x} onClick={() => setF(x)}>
            {x === 'all' ? t('common.all') : t(`bookings.${x}` as 'bookings.past')}
          </Chip>
        ))}
      </div>
      <Async q={q} empty={<EmptyState icon="📋" action={<LinkButton href="/">{t('home.categories')}</LinkButton>} />}>
        {(list) => {
          const shown = list.filter(match);
          return shown.length === 0 ? (
            <EmptyState icon="📋" />
          ) : (
            <ul className="space-y-2">
              {shown.map((b) => (
                <li key={b.id}>
                  <Link href={`/bookings/${b.id}`} className="block">
                    <Card className="transition hover:border-brand">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">{loc(b.service?.name)}</p>
                        <StatusBadge status={b.status} />
                      </div>
                      <p className="mt-1 text-sm text-gray-600">{dateTime(b.scheduledAt)}</p>
                      <div className="mt-1 flex justify-between text-xs text-gray-500">
                        <span>#{b.code}</span>
                        <span className="font-semibold text-gray-800">{money(b.total)}</span>
                      </div>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          );
        }}
      </Async>
    </>
  );
}
