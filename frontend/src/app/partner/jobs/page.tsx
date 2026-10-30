'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Booking } from '@/lib/types';
import { useT } from '@/i18n';
import { Async, Chip, EmptyState, PageTitle } from '@/components/ui';
import { JobCard } from '@/features/partner/JobCard';
import { isActive } from '@/features/bookings/parts';

export default function PartnerJobs() {
  const t = useT();
  const [f, setF] = useState<'active' | 'done' | 'all'>('active');
  const q = useQuery({ queryKey: ['partner-jobs'], queryFn: () => api<Booking[]>('/bookings'), refetchInterval: 20_000 });
  return (
    <>
      <PageTitle>{t('partner.jobs')}</PageTitle>
      <div className="mb-4 flex gap-2">
        <Chip active={f === 'active'} onClick={() => setF('active')}>{t('bookings.upcoming')}</Chip>
        <Chip active={f === 'done'} onClick={() => setF('done')}>{t('bookings.past')}</Chip>
        <Chip active={f === 'all'} onClick={() => setF('all')}>{t('common.all')}</Chip>
      </div>
      <Async q={q} empty={<EmptyState icon="🛠️" />}>
        {(list) => {
          const shown = list.filter((b) => (f === 'all' ? true : f === 'active' ? isActive(b) : !isActive(b)));
          return shown.length === 0 ? <EmptyState icon="🛠️" /> : <ul className="space-y-2">{shown.map((b) => <li key={b.id}><JobCard b={b} /></li>)}</ul>;
        }}
      </Async>
    </>
  );
}
