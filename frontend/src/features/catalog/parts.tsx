'use client';
import Link from 'next/link';
import { useUi } from '@/store/ui';
import { loc, money } from '@/lib/format';
import type { Category, Service } from '@/lib/types';
import { useT } from '@/i18n';
import { Card } from '@/components/ui';

const ICONS: Record<string, string> = {
  plumbing: '🚰', electrical: '💡', cleaning: '🧹', 'ac-repair': '❄️', appliance: '🔧', carpentry: '🪚',
  painting: '🎨', 'pest-control': '🐜', salon: '💇', beauty: '💅', 'home-cleaning': '🧽', gardening: '🌿',
};
export const iconFor = (c: Category) => ICONS[c.slug] ?? ICONS[c.slug.split('-')[0]] ?? '🛠️';

export function CategoryTile({ c }: { c: Category }) {
  useUi((s) => s.lang);
  return (
    <Link href={`/category/${c.slug}`} className="flex flex-col items-center gap-2 rounded-2xl border bg-white p-3 text-center shadow-sm transition hover:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
      {c.iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.iconUrl} alt="" className="h-10 w-10 object-contain" loading="lazy" />
      ) : (
        <span className="text-3xl" aria-hidden>{iconFor(c)}</span>
      )}
      <span className="text-sm font-medium leading-tight">{loc(c.name)}</span>
    </Link>
  );
}

export function ServiceCard({ s }: { s: Pick<Service, 'id' | 'name' | 'basePrice' | 'durationMin'> }) {
  const t = useT();
  useUi((x) => x.lang);
  return (
    <Link href={`/service/${s.id}`} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">
      <Card className="flex items-center justify-between gap-3 transition hover:border-brand">
        <div>
          <p className="font-semibold">{loc(s.name)}</p>
          <p className="text-xs text-gray-500">{s.durationMin} {t('common.minutes')}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">{t('common.from')}</p>
          <p className="font-bold text-brand">{money(s.basePrice)}</p>
        </div>
      </Card>
    </Link>
  );
}
