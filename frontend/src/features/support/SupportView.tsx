'use client';
import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, post } from '@/lib/api';
import { dateTime } from '@/lib/format';
import type { Booking, Ticket } from '@/lib/types';
import { useT } from '@/i18n';
import { toast } from '@/store/ui';
import { Async, Badge, Button, Card, Field, Input, PageTitle, Select, Sheet, Textarea, statusTone } from '@/components/ui';

export function SupportView() {
  const t = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ subject: '', body: '', bookingId: '', isDispute: false });
  const [busy, setBusy] = useState(false);
  const tickets = useQuery({ queryKey: ['tickets'], queryFn: () => api<Ticket[]>('/support/tickets/mine') });
  const bookings = useQuery({ queryKey: ['bookings'], queryFn: () => api<Booking[]>('/bookings'), enabled: open });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.subject.trim() || !f.body.trim()) return toast.error(t('common.required'));
    setBusy(true);
    try {
      await post('/support/tickets', {
        subject: f.subject.trim(),
        body: f.body.trim(),
        ...(f.bookingId && { bookingId: f.bookingId }),
        ...(f.bookingId && f.isDispute && { isDispute: true }),
      });
      toast.success(t('support.created'));
      setOpen(false);
      setF({ subject: '', body: '', bookingId: '', isDispute: false });
      qc.invalidateQueries({ queryKey: ['tickets'] });
    } catch (e2) {
      toast.error((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle action={<Button size="sm" onClick={() => setOpen(true)}>+ {t('support.new')}</Button>}>{t('support.title')}</PageTitle>
      <Async q={tickets}>
        {(list) => (
          <ul className="space-y-2">
            {list.map((x) => (
              <li key={x.id}>
                <Card>
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{x.subject}</p>
                    <Badge tone={statusTone(x.status)}>{x.status.replace('_', ' ')}</Badge>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600">{x.body}</p>
                  {x.resolution && <p className="mt-2 rounded-lg bg-green-50 p-2 text-sm text-green-800">{x.resolution}</p>}
                  <p className="mt-2 text-xs text-gray-400">
                    {dateTime(x.createdAt)} {x.isDispute && '· Dispute'}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Async>
      <Sheet open={open} onClose={() => setOpen(false)} title={t('support.new')}>
        <form onSubmit={submit} noValidate>
          <Field label={t('support.subject')}>{(p) => <Input {...p} maxLength={200} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} />}</Field>
          <Field label={t('support.body')}>{(p) => <Textarea {...p} maxLength={5000} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />}</Field>
          <Field label={t('support.booking')}>
            {(p) => (
              <Select {...p} value={f.bookingId} onChange={(e) => setF({ ...f, bookingId: e.target.value })}>
                <option value="">—</option>
                {bookings.data?.map((b) => (
                  <option key={b.id} value={b.id}>{b.code} · {dateTime(b.scheduledAt)}</option>
                ))}
              </Select>
            )}
          </Field>
          {f.bookingId && (
            <label className="mb-3 flex items-center gap-2 text-sm">
              <input type="checkbox" checked={f.isDispute} onChange={(e) => setF({ ...f, isDispute: e.target.checked })} className="h-4 w-4 accent-orange-600" />
              {t('support.dispute')}
            </label>
          )}
          <Button type="submit" full loading={busy}>{t('common.submit')}</Button>
        </form>
      </Sheet>
    </>
  );
}
