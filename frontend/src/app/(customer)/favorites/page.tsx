'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, del } from '@/lib/api';
import { useT } from '@/i18n';
import { toast } from '@/store/ui';
import { Async, Button, Card, EmptyState, PageTitle, Stars } from '@/components/ui';

interface Fav {
  id: string;
  ratingAvg: number;
  ratingCount: number;
  completedJobs: number;
  isOnline: boolean;
  bio?: string | null;
  user: { name: string };
}

export default function FavoritesPage() {
  const t = useT();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['favorites'], queryFn: () => api<Fav[]>('/favorites') });
  async function remove(id: string) {
    try {
      await del(`/favorites/${id}`);
      qc.invalidateQueries({ queryKey: ['favorites'] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <>
      <PageTitle>{t('profile.favorites')}</PageTitle>
      <Async q={q} empty={<EmptyState icon="❤️" />}>
        {(list) => (
          <ul className="space-y-2">
            {list.map((p) => (
              <li key={p.id}>
                <Card className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{p.user.name} {p.isOnline && <span className="ml-1 text-xs text-green-600">● {t('partner.online')}</span>}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-600"><Stars value={p.ratingAvg} size="text-sm" /> {p.ratingAvg.toFixed(1)} ({p.ratingCount}) · {p.completedJobs} jobs</div>
                    {p.bio && <p className="mt-1 text-sm text-gray-500">{p.bio}</p>}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => remove(p.id)}>{t('common.delete')}</Button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </>
  );
}
