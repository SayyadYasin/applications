'use client';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { loc, money, num } from '@/lib/format';
import type { Service } from '@/lib/types';
import { useT } from '@/i18n';
import { useUi } from '@/store/ui';
import { Async, Card, LinkButton, PageTitle, Row } from '@/components/ui';

export default function ServicePage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  useUi((s) => s.lang);
  const q = useQuery({ queryKey: ['service', id], queryFn: () => api<Service>(`/services/${id}`) });
  return (
    <Async q={q}>
      {(s) => {
        const base = num(s.basePrice);
        return (
          <>
            <PageTitle>{loc(s.name)}</PageTitle>
            <Card>
              {s.description && <p className="mb-3 text-gray-700">{loc(s.description)}</p>}
              <Row label={t('svc.duration')} value={`${s.durationMin} ${t('common.minutes')}`} />
              <Row label={t('common.from')} value={money(base)} />
              <Row label={`${t('svc.gst')} (${s.gstPct}%)`} value={money((base * s.gstPct) / 100)} />
              <Row bold label={t('common.total')} value={money(base + (base * s.gstPct) / 100)} />
            </Card>
            <div className="sticky bottom-20 mt-4 md:bottom-4">
              <LinkButton href={`/book/${s.id}`} full>{t('svc.book')}</LinkButton>
            </div>
          </>
        );
      }}
    </Async>
  );
}
