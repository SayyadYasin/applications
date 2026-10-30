'use client';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, qs } from '@/lib/api';
import type { Service } from '@/lib/types';
import { useT } from '@/i18n';
import { Async, EmptyState, Input, PageTitle } from '@/components/ui';
import { ServiceCard } from '@/features/catalog/parts';

export default function SearchPage() {
  const t = useT();
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const initial = new URLSearchParams(window.location.search).get('q') ?? '';
    setQ(initial);
    setDebounced(initial);
  }, []);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const res = useQuery({
    queryKey: ['services', 'search', debounced],
    queryFn: () => api<Service[]>(`/services${qs({ q: debounced })}`),
  });

  return (
    <>
      <PageTitle>{t('home.results')}</PageTitle>
      <div className="mb-4" role="search">
        <Input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('common.search')} aria-label={t('common.search')} />
      </div>
      <Async q={res} empty={<EmptyState title={t('home.noResults')} icon="🔍" />}>
        {(list) => <ul className="space-y-2">{list.map((s) => <li key={s.id}><ServiceCard s={s} /></li>)}</ul>}
      </Async>
    </>
  );
}
