'use client';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, download, post, qs } from '@/lib/api';
import { dateTime, loc, money, num, toLocalInput } from '@/lib/format';
import { payForBooking } from '@/lib/pay';
import { useBookingSocket } from '@/lib/socket';
import type { Booking } from '@/lib/types';
import { useT } from '@/i18n';
import { toast, useUi } from '@/store/ui';
import { Async, Button, Card, Field, Input, LinkButton, PageTitle, Row, SectionTitle, Sheet, Stars, Textarea } from '@/components/ui';
import { MapView, type Pin } from '@/components/MapView';
import { StatusBadge, Timeline, isActive } from '@/features/bookings/parts';

interface PartnerPublic {
  id: string;
  bio?: string | null;
  ratingAvg: number;
  ratingCount: number;
  completedJobs: number;
  user: { name: string };
}

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  useUi((s) => s.lang);
  const router = useRouter();
  const qc = useQueryClient();
  const [live, setLive] = useState<{ lat: number; lng: number } | null>(null);
  const [sheet, setSheet] = useState<null | 'cancel' | 'resched' | 'review'>(null);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [when, setWhen] = useState(toLocalInput(new Date(Date.now() + 3 * 3600_000)));
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [reviewed, setReviewed] = useState(false);

  const q = useQuery({
    queryKey: ['booking', id],
    queryFn: () => api<Booking>(`/bookings/${id}`),
    refetchInterval: (query) => {
      const b = query.state.data;
      return b && (b.status === 'PENDING_PAYMENT' || isActive(b)) ? 8000 : false;
    },
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['booking', id] });
    qc.invalidateQueries({ queryKey: ['bookings'] });
  };

  useBookingSocket(id, {
    onStatus: () => refresh(),
    onLocation: (e) => setLive({ lat: e.lat, lng: e.lng }),
  });

  const b = q.data;
  const partner = useQuery({
    queryKey: ['partner-public', b?.partnerId],
    queryFn: () => api<PartnerPublic>(`/partners/${b!.partnerId}/public`),
    enabled: !!b?.partnerId,
    retry: false,
  });
  const preview = useQuery({
    queryKey: ['cancel-preview', id],
    queryFn: () => api<{ pct: number; amount: string }>(`/refunds/cancellation-preview/${id}`),
    enabled: sheet === 'cancel',
  });

  async function run(fn: () => Promise<unknown>, ok?: string) {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      refresh();
      setSheet(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function rebook() {
    try {
      const r = await post<{ draft: { serviceId: string; addressId: string; scheduledAt: string; paymentMethod: string; preferredPartnerId?: string }; serviceAvailable: boolean }>(`/recommendations/rebook/${id}`);
      if (!r.serviceAvailable) return toast.error('This service is no longer available');
      router.push(`/book/${r.draft.serviceId}${qs({ address: r.draft.addressId, at: r.draft.scheduledAt, pay: r.draft.paymentMethod, partner: r.draft.preferredPartnerId })}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Async q={q}>
      {(bk) => {
        const active = isActive(bk);
        const partnerPos = live ?? (bk.partner?.lat != null && bk.partner?.lng != null ? { lat: bk.partner.lat, lng: bk.partner.lng } : null);
        const pins: Pin[] = [
          ...(bk.address ? [{ lat: bk.address.lat, lng: bk.address.lng, label: 'Home' }] : []),
          ...(partnerPos && ['PARTNER_EN_ROUTE', 'IN_PROGRESS'].includes(bk.status) ? [{ lat: partnerPos.lat, lng: partnerPos.lng, label: 'Partner' }] : []),
        ];
        const showOtp = bk.completionOtp && ['ASSIGNED', 'PARTNER_EN_ROUTE', 'IN_PROGRESS'].includes(bk.status);
        return (
          <>
            <PageTitle action={<StatusBadge status={bk.status} />}>{loc(bk.service?.name)}</PageTitle>
            <p className="-mt-2 mb-3 text-sm text-gray-500">#{bk.code} · {dateTime(bk.scheduledAt)}{bk.isInstant && ' · ⚡'}</p>

            {bk.status === 'PENDING_PAYMENT' && (
              <Card className="mb-3 border-orange-300 bg-orange-50">
                <p className="mb-2 text-sm">{t('status.PENDING_PAYMENT')}</p>
                <Button loading={busy} onClick={() => run(() => payForBooking(bk))}>{t('bookings.payNow')} · {money(bk.total)}</Button>
              </Card>
            )}

            {showOtp && (
              <Card className="mb-3 border-brand bg-orange-50 text-center">
                <p className="text-sm text-gray-700">{t('bookings.completionOtp')}</p>
                <p className="my-1 text-4xl font-extrabold tracking-[0.4em] text-brand" aria-label={`OTP ${bk.completionOtp}`}>{bk.completionOtp}</p>
              </Card>
            )}

            <Card>
              <h2 className="mb-3 font-semibold">{t('bookings.timeline')}</h2>
              <Timeline status={bk.status} log={bk.statusLog} />
            </Card>

            {bk.partnerId ? (
              <>
                <SectionTitle>{t('bookings.partner')}</SectionTitle>
                <Card className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{partner.data?.user.name ?? t('bookings.partner')}</p>
                    {partner.data && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Stars value={partner.data.ratingAvg} size="text-sm" /> {partner.data.ratingAvg.toFixed(1)} ({partner.data.ratingCount})
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {bk.partner?.user?.phone && <a href={`tel:${bk.partner.user.phone}`} className="rounded-xl border px-3 py-2 text-sm">📞</a>}
                    <LinkButton size="sm" href={`/bookings/${bk.id}/chat`}>💬 {t('bookings.chat')}</LinkButton>
                  </div>
                </Card>
                <Button variant="ghost" size="sm" className="mt-1" onClick={() => run(() => post(`/favorites/${bk.partnerId}`), '❤')}>♡ {t('bookings.favorite')}</Button>
              </>
            ) : (
              active && bk.status !== 'PENDING_PAYMENT' && <p className="mt-3 text-sm text-gray-600">{t('bookings.noPartner')}</p>
            )}

            {pins.length > 0 && (
              <>
                <SectionTitle>{t('bookings.track')}</SectionTitle>
                <MapView pins={pins} />
              </>
            )}

            {bk.address && (
              <>
                <SectionTitle>{t('book.address')}</SectionTitle>
                <Card><p className="font-medium">{bk.address.label}</p><p className="text-sm text-gray-600">{[bk.address.line1, bk.address.line2, bk.address.city, bk.address.pincode].filter(Boolean).join(', ')}</p></Card>
              </>
            )}

            <SectionTitle>{t('book.summary')}</SectionTitle>
            <Card>
              <Row label={t('book.base')} value={money(bk.basePrice)} />
              {num(bk.surgeAmount) > 0 && <Row label={t('book.surge')} value={money(bk.surgeAmount)} />}
              {num(bk.discount) > 0 && <Row label={t('book.discount')} value={`− ${money(bk.discount)}`} />}
              <Row label={t('book.tax')} value={money(bk.taxAmount)} />
              <Row bold label={t('common.total')} value={money(bk.total)} />
              <p className="mt-1 text-xs text-gray-500">{t(`book.pay.${bk.paymentMethod}` as 'book.pay.UPI')}</p>
            </Card>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {['CONFIRMED', 'ASSIGNED'].includes(bk.status) && <Button variant="outline" onClick={() => setSheet('resched')}>{t('bookings.reschedule')}</Button>}
              {['PENDING_PAYMENT', 'CONFIRMED', 'ASSIGNED'].includes(bk.status) && <Button variant="danger" onClick={() => setSheet('cancel')}>{t('bookings.cancel')}</Button>}
              {bk.status === 'COMPLETED' && (
                <>
                  <Button variant="outline" onClick={() => download(`/bookings/${bk.id}/invoice.pdf`, `invoice-${bk.code}.pdf`).catch((e) => toast.error(e.message))}>📄 {t('bookings.invoice')}</Button>
                  {!reviewed && <Button onClick={() => setSheet('review')}>★ {t('bookings.rate')}</Button>}
                </>
              )}
              {!active && <Button variant="outline" onClick={rebook}>↻ {t('bookings.rebook')}</Button>}
              <LinkButton variant="ghost" href="/support">{t('support.title')}</LinkButton>
            </div>

            <Sheet open={sheet === 'cancel'} onClose={() => setSheet(null)} title={t('bookings.cancel')}>
              <Async q={preview}>
                {(p) => (
                  <p className="mb-3 rounded-lg bg-orange-50 p-3 text-sm">
                    {num(p.amount) > 0 ? t('bookings.refundPreview', { pct: p.pct, amount: money(p.amount) }) : t('bookings.noRefund')}
                  </p>
                )}
              </Async>
              <Field label={t('bookings.cancelReason')}>{(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
              <Button variant="danger" full loading={busy} onClick={() => run(() => post(`/bookings/${id}/cancel`, reason ? { reason } : {}), t('bookings.cancelled.ok'))}>{t('bookings.cancel')}</Button>
            </Sheet>

            <Sheet open={sheet === 'resched'} onClose={() => setSheet(null)} title={t('bookings.reschedule')}>
              <Field label={t('book.date')}>{(p) => <Input {...p} type="datetime-local" min={toLocalInput(new Date(Date.now() + 31 * 60_000))} value={when} onChange={(e) => setWhen(e.target.value)} />}</Field>
              <Button full loading={busy} onClick={() => run(() => post(`/bookings/${id}/reschedule`, { scheduledAt: new Date(when).toISOString() }), t('bookings.rescheduled'))}>{t('common.confirm')}</Button>
            </Sheet>

            <Sheet open={sheet === 'review'} onClose={() => setSheet(null)} title={t('bookings.rate')}>
              <p className="mb-1 text-sm font-medium">{t('bookings.rating')}</p>
              <Stars value={rating} onChange={setRating} size="text-3xl" />
              <div className="mt-3">
                <Field label={t('bookings.comment')}>{(p) => <Textarea {...p} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />}</Field>
              </div>
              <Button full loading={busy} onClick={() => run(async () => { await post('/reviews', { bookingId: id, rating, ...(comment && { comment }) }); setReviewed(true); }, t('bookings.reviewed'))}>{t('common.submit')}</Button>
            </Sheet>
          </>
        );
      }}
    </Async>
  );
}

