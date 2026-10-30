'use client';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { del, post } from '@/lib/api';
import { minToTime } from '@/lib/format';
import { useT } from '@/i18n';
import { toast } from '@/store/ui';
import { Async, Button, Card, Input, PageTitle } from '@/components/ui';
import { usePartnerMe } from '@/features/partner/hooks';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const toMin = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
};

export default function AvailabilityPage() {
  const t = useT();
  const qc = useQueryClient();
  const me = usePartnerMe();
  const [draft, setDraft] = useState<Record<number, { start: string; end: string }>>({});
  const [busy, setBusy] = useState<number | string | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['partner-me'] });

  async function add(day: number) {
    const d = draft[day] ?? { start: '09:00', end: '18:00' };
    const startMin = toMin(d.start);
    const endMin = toMin(d.end);
    if (!(endMin > startMin)) return toast.error('End time must be after start time');
    setBusy(day);
    try {
      await post('/partners/me/availability', { weekday: day, startMin, endMin });
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function remove(id: string) {
    setBusy(id);
    try {
      await del(`/partners/me/availability/${id}`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageTitle>{t('partner.availability')}</PageTitle>
      <Async q={me}>
        {(p) => (
          <ul className="space-y-3">
            {DAYS.map((name, day) => {
              const slots = p.availability.filter((s) => s.weekday === day);
              const d = draft[day] ?? { start: '09:00', end: '18:00' };
              return (
                <li key={day}>
                  <Card>
                    <h2 className="mb-2 font-semibold">{name}</h2>
                    {slots.length === 0 && <p className="mb-2 text-sm text-gray-400">Unavailable</p>}
                    <ul className="mb-2 flex flex-wrap gap-2">
                      {slots.map((s) => (
                        <li key={s.id} className="flex items-center gap-1 rounded-full bg-orange-50 py-1 pl-3 pr-1 text-sm">
                          {minToTime(s.startMin)} – {minToTime(s.endMin)}
                          <button aria-label={`Remove ${name} ${minToTime(s.startMin)}`} disabled={busy === s.id} onClick={() => remove(s.id)} className="h-7 w-7 rounded-full text-gray-500 hover:bg-orange-100">×</button>
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-wrap items-center gap-2">
                      <Input type="time" aria-label={`${name} start`} className="w-32" value={d.start} onChange={(e) => setDraft({ ...draft, [day]: { ...d, start: e.target.value } })} />
                      <span aria-hidden>–</span>
                      <Input type="time" aria-label={`${name} end`} className="w-32" value={d.end} onChange={(e) => setDraft({ ...draft, [day]: { ...d, end: e.target.value } })} />
                      <Button size="sm" variant="outline" loading={busy === day} onClick={() => add(day)}>+ {t('common.add')}</Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </Async>
    </>
  );
}
