'use client';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, qs } from '@/lib/api';
import { loc } from '@/lib/format';
import type { Category, Service } from '@/lib/types';
import { useT } from '@/i18n';
import { useUi } from '@/store/ui';
import { Async, Chip, EmptyState, ErrorState, Loading, PageTitle } from '@/components/ui';
import { ServiceCard } from '@/features/catalog/parts';

export default function CategoryPage() {
  const { slug } = useParams<{ slug: string }>();
  const t = useT();
  useUi((s) => s.lang);
  const [sub, setSub] = useState<string>('');
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/categories') });
  const cat = cats.data?.find((c) => c.slug === slug);
  const services = useQuery({
    queryKey: ['services', 'cat', cat?.id, sub],
    queryFn: () => api<Service[]>(`/services${qs({ subCategoryId: sub })}`),
    enabled: !!cat,
  });

  if (cats.isLoading) return <Loading />;
  if (cats.error) return <ErrorState error={cats.error} onRetry={() => cats.refetch()} />;
  if (!cat) return <EmptyState title="Category not found" />;
  const subIds = new Set(cat.subCategories.map((s) => s.id));

  return (
    <>
      <PageTitle>{loc(cat.name)}</PageTitle>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Sub-categories">
        <Chip active={sub === ''} onClick={() => setSub('')}>{t('common.all')}</Chip>
        {cat.subCategories.map((s) => (
          <Chip key={s.id} active={sub === s.id} onClick={() => setSub(s.id)}>{loc(s.name)}</Chip>
        ))}
      </div>
      <Async q={services} empty={<EmptyState title={t('home.noResults')} icon="🔍" />}>
        {(list) => {
          const shown = sub ? list : list.filter((s) => subIds.has(s.subCategoryId));
          return shown.length ? (
            <ul className="space-y-2">{shown.map((s) => <li key={s.id}><ServiceCard s={s} /></li>)}</ul>
          ) : (
            <EmptyState title={t('home.noResults')} icon="🔍" />
          );
        }}
      </Async>
    </>
  );
}
