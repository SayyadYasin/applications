'use client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, post } from '@/lib/api';
import { dateTime } from '@/lib/format';
import type { Notification } from '@/lib/types';
import { useT } from '@/i18n';
import { toast } from '@/store/ui';
import { Async, Button, Card, PageTitle, cx } from '@/components/ui';

export function NotificationsView() {
  const t = useT();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api<Notification[]>('/notifications?take=50') });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };
  async function readAll() {
    try {
      await post('/notifications/read-all');
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function readOne(n: Notification) {
    if (n.readAt) return;
    try {
      await post(`/notifications/${n.id}/read`);
      refresh();
    } catch {
      /* ignore */
    }
  }
  return (
    <>
      <PageTitle action={<Button size="sm" variant="outline" onClick={readAll}>{t('notif.markAll')}</Button>}>{t('notif.title')}</PageTitle>
      <Async q={q} empty={<Card className="text-center text-gray-500">🔔 {t('common.empty')}</Card>}>
        {(items) => (
          <ul className="space-y-2">
            {items.map((n) => (
              <li key={n.id}>
                <button onClick={() => readOne(n)} className="w-full text-left">
                  <Card className={cx('py-3', !n.readAt && 'border-orange-300 bg-orange-50')}>
                    <p className="font-semibold">{n.title}</p>
                    <p className="text-sm text-gray-600">{n.body}</p>
                    <p className="mt-1 text-xs text-gray-400">{dateTime(n.createdAt)}</p>
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </>
  );
}
