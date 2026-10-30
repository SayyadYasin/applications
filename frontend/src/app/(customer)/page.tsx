'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, patch, qs } from '@/lib/api';
import { getPosition } from '@/lib/external';
import { loc } from '@/lib/format';
import type { Banner, Category, Recommendation, Service, Town } from '@/lib/types';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { toast, useUi } from '@/store/ui';
import { Async, Button, Card, Input, SectionTitle } from '@/components/ui';
import { CategoryTile } from '@/features/catalog/parts';
import { useMounted } from '@/lib/session';

const TOWN_KEY = 'ts-town';
function readTown(): Town | null {
  try {
    return JSON.parse(localStorage.getItem(TOWN_KEY) ?? 'null');
  } catch {
    return null;
  }
}

export default function Home() {
  const t = useT();
  const router = useRouter();
  const mounted = useMounted();
  const token = useAuth((s) => s.token);
  const isCustomer = useAuth((s) => s.role) === 'CUSTOMER';
  useUi((s) => s.lang);
  const [town, setTown] = useState<Town | null>(null);
  const [locating, setLocating] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => setTown(readTown()), []);

  const banners = useQuery({
    queryKey: ['banners', town?.id],
    queryFn: () => api<Banner[]>(`/banners${qs({ townId: town?.id })}`),
  });
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/categories') });
  const recs = useQuery({
    queryKey: ['recommendations'],
    queryFn: () => api<Recommendation[]>('/recommendations'),
    enabled: mounted && !!token && isCustomer,
  });

  async function detect() {
    setLocating(true);
    try {
      const pos = await getPosition();
      const tw = await api<Town | null>(`/geo/nearest-town${qs(pos)}`);
      if (!tw) return toast.info('No service town found near you yet');
      setTown(tw);
      localStorage.setItem(TOWN_KEY, JSON.stringify(tw));
      if (token) patch('/profile', { townId: tw.id }).catch(() => undefined);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLocating(false);
    }
  }

  function search(e: FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          📍 {town ? <strong>{town.name}</strong> : t('home.noTown')}
        </p>
        <Button size="sm" variant="outline" loading={locating} onClick={detect}>{t('home.detect')}</Button>
      </div>

      <form onSubmit={search} role="search" className="mb-4">
        <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('common.search')} aria-label={t('common.search')} />
      </form>

      {banners.data && banners.data.length > 0 && (
        <section aria-label={t('home.banners')} className="-mx-4 mb-2 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
          {banners.data.map((b) => {
            const img = (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={b.imageUrl} alt={b.title} className="h-36 w-72 rounded-2xl object-cover shadow-sm sm:h-44 sm:w-96" loading="lazy" />
            );
            return b.link ? (
              <a key={b.id} href={b.link} className="shrink-0 snap-start">{img}</a>
            ) : (
              <div key={b.id} className="shrink-0 snap-start">{img}</div>
            );
          })}
        </section>
      )}

      <SectionTitle>{t('home.categories')}</SectionTitle>
      <Async q={cats}>
        {(list) => (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {list.map((c) => <CategoryTile key={c.id} c={c} />)}
          </div>
        )}
      </Async>

      {recs.data && recs.data.length > 0 && (
        <>
          <SectionTitle>{t('home.recommended')}</SectionTitle>
          <ul className="grid gap-2 sm:grid-cols-2">
            {recs.data.map((r) => (
              <li key={r.serviceId}>
                <Link href={`/service/${r.serviceId}`} className="block">
                  <Card className="transition hover:border-brand">
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-xs capitalize text-gray-500">{r.reason}</p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <PopularServices town={town} />
    </>
  );
}

function PopularServices({ town }: { town: Town | null }) {
  const t = useT();
  const q = useQuery({ queryKey: ['services', 'home', town?.id], queryFn: () => api<Service[]>(`/services${qs({ townId: town?.id })}`) });
  if (!q.data?.length) return null;
  return (
    <>
      <SectionTitle>{t('home.services')}</SectionTitle>
      <ul className="grid gap-2 sm:grid-cols-2">
        {q.data.slice(0, 8).map((s) => (
          <li key={s.id}>
            <Link href={`/service/${s.id}`} className="block">
              <Card className="transition hover:border-brand">
                <p className="font-semibold">{loc(s.name)}</p>
                <p className="text-xs text-gray-500">{s.durationMin} {t('common.minutes')}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
