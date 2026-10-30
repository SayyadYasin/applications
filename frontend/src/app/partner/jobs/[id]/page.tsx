'use client';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, post } from '@/lib/api';
import { directionsUrl } from '@/lib/external';
import { dateTime, loc, money, num } from '@/lib/format';
import { emitLocation, useBookingSocket } from '@/lib/socket';
import type { Booking } from '@/lib/types';
import { useT } from '@/i18n';
import { toast } from '@/store/ui';
import { Async, Button, Card, Field, Input, LinkButton, PageTitle, Row, SectionTitle, Sheet } from '@/components/ui';
import { MapView } from '@/components/MapView';
import { StatusBadge, Timeline } from '@/features/bookings/parts';

export default function PartnerJob() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState('');
  const q = useQuery({ queryKey: ['booking', id], queryFn: () => api<Booking>(`/bookings/${id}`), refetchInterval: 15_000 });
  const status = q.data?.status;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['booking', id] });
    qc.invalidateQueries({ queryKey: ['partner-jobs'] });
  };
  useBookingSocket(id, { onStatus: refresh });

  // Share live location with the customer while en route.
  useEffect(() => {
    if (status !== 'PARTNER_EN_ROUTE' || !navigator.geolocation) return;
    let last = 0;
    const w = navigator.geolocation.watchPosition(
      (p) => {
        if (Date.now() - last < 5000) return;
        last = Date.now();
        emitLocation(id, p.coords.latitude, p.coords.longitude);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(w);
  }, [status, id]);

  async function act(path: string, body?: unknown, done?: () => void) {
    setBusy(true);
    try {
      await post(path, body);
      refresh();
      done?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Async q={q}>
      {(b) => (
        <>
          <PageTitle action={<StatusBadge status={b.status} />}>{loc(b.service?.name)}</PageTitle>
          <p className="-mt-2 mb-3 text-sm text-gray-500">#{b.code} · {dateTime(b.scheduledAt)}</p>

          <Card className="mb-3">
            {b.status === 'ASSIGNED' && (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button loading={busy} onClick={() => act(`/bookings/${id}/depart`)}>🚗 {t('partner.depart')}</Button>
                <Button variant="outline" loading={busy} onClick={() => act(`/bookings/${id}/reject`)}>{t('partner.reject')}</Button>
              </div>
            )}
            {b.status === 'PARTNER_EN_ROUTE' && (
              <>
                <p className="mb-2 text-sm text-green-700">● {t('partner.sharingLocation')}</p>
                <Button full loading={busy} onClick={() => act(`/bookings/${id}/start`)}>▶ {t('partner.start')}</Button>
              </>
            )}
            {b.status === 'IN_PROGRESS' && <Button full onClick={() => setOtpOpen(true)}>✔ {t('partner.complete')}</Button>}
            {!['ASSIGNED', 'PARTNER_EN_ROUTE', 'IN_PROGRESS'].includes(b.status) && <p className="text-sm text-gray-600">{t(`status.${b.status}` as 'status.CONFIRMED')}</p>}
          </Card>

          {b.address && (
            <>
              <SectionTitle>{t('book.address')}</SectionTitle>
              <Card>
                <p className="font-medium">{b.address.label}</p>
                <p className="text-sm text-gray-600">{[b.address.line1, b.address.line2, b.address.city, b.address.pincode].filter(Boolean).join(', ')}</p>
                <div className="mt-3 flex gap-2">
                  <a href={directionsUrl(b.address.lat, b.address.lng)} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center rounded-xl bg-brand px-3 text-sm font-semibold text-white">🧭 {t('partner.navigate')}</a>
                  <LinkButton size="sm" variant="outline" href={`/partner/jobs/${b.id}/chat`}>💬 {t('bookings.chat')}</LinkButton>
                </div>
              </Card>
              <div className="mt-3"><MapView pins={[{ lat: b.address.lat, lng: b.address.lng, label: 'Customer' }]} height={200} /></div>
            </>
          )}

          <SectionTitle>{t('book.summary')}</SectionTitle>
          <Card>
            <Row label={t('book.base')} value={money(b.basePrice)} />
            {num(b.discount) > 0 && <Row label={t('book.discount')} value={`− ${money(b.discount)}`} />}
            <Row label={t('book.tax')} value={money(b.taxAmount)} />
            <Row bold label={t('common.total')} value={money(b.total)} />
            <p className="mt-1 text-xs text-gray-500">{t(`book.pay.${b.paymentMethod}` as 'book.pay.UPI')}</p>
          </Card>

          <SectionTitle>{t('bookings.timeline')}</SectionTitle>
          <Card><Timeline status={b.status} log={b.statusLog} /></Card>

          <Sheet open={otpOpen} onClose={() => setOtpOpen(false)} title={t('partner.complete')}>
            <Field label={t('partner.enterOtp')}>
              {(p) => <Input {...p} inputMode="numeric" maxLength={6} autoFocus value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />}
            </Field>
            <Button full loading={busy} disabled={otp.length < 4} onClick={() => act(`/bookings/${id}/complete`, { otp }, () => { setOtpOpen(false); setOtp(''); toast.success(t('status.COMPLETED')); })}>
              {t('common.confirm')}
            </Button>
          </Sheet>
        </>
      )}
    </Async>
  );
}
