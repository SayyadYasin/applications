'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, post } from '@/lib/api';
import { dateOnly } from '@/lib/format';
import type { Paged, Review } from '@/lib/types';
import { useT } from '@/i18n';
import { toast } from '@/store/ui';
import { Async, Button, Card, EmptyState, Input, PageTitle, Stars } from '@/components/ui';

export default function PartnerReviews() {
  const t = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['my-reviews'], queryFn: () => api<Paged<Review>>('/reviews/mine?limit=50') });

  async function reply(id: string) {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await post(`/reviews/${id}/reply`, { reply: text.trim() });
      setOpen(null);
      setText('');
      qc.invalidateQueries({ queryKey: ['my-reviews'] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle>{t('partner.reviews')}</PageTitle>
      <Async q={q} empty={<EmptyState icon="⭐" />} isEmpty={(d) => d.items.length === 0}>
        {(d) => (
          <ul className="space-y-2">
            {d.items.map((r) => (
              <li key={r.id}>
                <Card>
                  <div className="flex items-center justify-between">
                    <Stars value={r.rating} size="text-base" />
                    <span className="text-xs text-gray-400">{dateOnly(r.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium">{r.booking?.customer?.user?.name}</p>
                  {r.comment && <p className="text-sm text-gray-700">{r.comment}</p>}
                  {r.reply ? (
                    <p className="mt-2 rounded-lg bg-gray-50 p-2 text-sm"><span className="font-semibold">{t('partner.reply')}: </span>{r.reply}</p>
                  ) : open === r.id ? (
                    <div className="mt-2 flex gap-2">
                      <Input aria-label={t('partner.reply')} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
                      <Button loading={busy} onClick={() => reply(r.id)}>{t('common.send')}</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="ghost" className="mt-1" onClick={() => { setOpen(r.id); setText(''); }}>{t('partner.reply')}</Button>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Async>
    </>
  );
}
