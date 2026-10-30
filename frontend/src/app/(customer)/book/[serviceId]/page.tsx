'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, post } from '@/lib/api';
import { loc, money, num, toLocalInput } from '@/lib/format';
import { payForBooking } from '@/lib/pay';
import type { Address, Booking, Coupon, PaymentMethod, Quote, Service } from '@/lib/types';
import { useT } from '@/i18n';
import { toast, useUi } from '@/store/ui';
import { Async, Button, Card, Chip, Field, Input, PageTitle, Row, SectionTitle, Sheet, cx } from '@/components/ui';
import { AddressForm } from '@/features/address/AddressForm';

const METHODS: PaymentMethod[] = ['UPI', 'ONLINE', 'WALLET', 'CASH'];
const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i); // 8:00 .. 20:00

function slotDate(day: string, hour: number) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hour, 0, 0, 0);
}

export default function BookPage() {
  const { serviceId } = useParams<{ serviceId: string }>();
  const t = useT();
  useUi((s) => s.lang);
  const router = useRouter();
  const qc = useQueryClient();

  const svc = useQuery({ queryKey: ['service', serviceId], queryFn: () => api<Service>(`/services/${serviceId}`) });
  const addrs = useQuery({ queryKey: ['addresses'], queryFn: () => api<Address[]>('/addresses') });
  const wallet = useQuery({ queryKey: ['wallet'], queryFn: () => api<{ balance: string }>('/wallet') });
  const available = useQuery({ queryKey: ['coupons', 'available'], queryFn: () => api<Coupon[]>('/coupons/available') });

  const [addressId, setAddressId] = useState('');
  const [instant, setInstant] = useState(false);
  const [day, setDay] = useState(() => toLocalInput(new Date(Date.now() + 86_400_000)).slice(0, 10));
  const [hour, setHour] = useState<number | null>(null);
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; quote: Quote } | null>(null);
  const [applying, setApplying] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('UPI');
  const [partnerId, setPartnerId] = useState<string | undefined>();
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Prefill from a rebook draft: /book/:id?address=&at=&pay=&partner=
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('address')) setAddressId(p.get('address')!);
    const at = p.get('at');
    if (at) {
      const d = new Date(at);
      if (!isNaN(+d)) {
        setDay(toLocalInput(d).slice(0, 10));
        setHour(d.getHours());
      }
    }
    const pay = p.get('pay') as PaymentMethod | null;
    if (pay && METHODS.includes(pay)) setMethod(pay);
    if (p.get('partner')) setPartnerId(p.get('partner')!);
  }, []);

  useEffect(() => {
    if (!addressId && addrs.data?.length) setAddressId((addrs.data.find((a) => a.isDefault) ?? addrs.data[0]).id);
  }, [addrs.data, addressId]);

  const scheduledAt = useMemo(() => (instant ? new Date() : hour == null ? null : slotDate(day, hour)), [instant, day, hour]);
  const minTime = Date.now() + 30 * 60_000;
  const todayStr = toLocalInput(new Date()).slice(0, 10);

  // Changing time/service invalidates a validated coupon since surge/discount may change.
  useEffect(() => setCoupon(null), [instant, day, hour]);

  const s = svc.data;
  const base = num(s?.basePrice);
  const est: Quote | null = s
    ? { basePrice: base, surgeAmount: 0, discount: 0, taxable: base, taxAmount: Math.round(base * s.gstPct) / 100, total: Math.round((base + (base * s.gstPct) / 100) * 100) / 100 }
    : null;
  const quote = coupon?.quote ?? est;

  async function applyCoupon(code = couponInput) {
    const c = code.trim().toUpperCase();
    if (!c || !s) return;
    setApplying(true);
    try {
      const r = await post<{ discount: number; quote: Quote }>('/coupons/validate', {
        code: c,
        serviceId: s.id,
        ...(scheduledAt && { scheduledAt: scheduledAt.toISOString() }),
      });
      setCoupon({ code: c, quote: r.quote });
      setCouponInput(c);
      toast.success(t('book.couponApplied'));
    } catch (e) {
      setCoupon(null);
      toast.error((e as Error).message);
    } finally {
      setApplying(false);
    }
  }

  async function confirm() {
    if (!s) return;
    if (!addressId) return toast.error(t('book.address'));
    if (!scheduledAt) return toast.error(t('book.slot'));
    if (!instant && scheduledAt.getTime() < minTime) return toast.error('Schedule at least 30 minutes ahead');
    setBusy(true);
    let booking: Booking | null = null;
    try {
      booking = await post<Booking>('/bookings', {
        serviceId: s.id,
        addressId,
        scheduledAt: scheduledAt.toISOString(),
        isInstant: instant,
        paymentMethod: method,
        ...(coupon && { couponCode: coupon.code }),
        ...(partnerId && { preferredPartnerId: partnerId }),
      });
      qc.invalidateQueries({ queryKey: ['bookings'] });
      if (booking.status === 'PENDING_PAYMENT' && method !== 'CASH') {
        toast.info(t('book.paying'));
        await payForBooking(booking);
        qc.invalidateQueries({ queryKey: ['wallet'] });
      }
      toast.success(t('book.success'));
    } catch (e) {
      toast.error(booking ? t('book.payFailed') : (e as Error).message);
    } finally {
      setBusy(false);
      if (booking) router.replace(`/bookings/${booking.id}`);
    }
  }

  return (
    <Async q={svc}>
      {(service) => (
        <>
          <PageTitle>{t('book.title')}</PageTitle>
          <Card className="mb-2">
            <p className="font-semibold">{loc(service.name)}</p>
            <p className="text-sm text-gray-500">{service.durationMin} {t('common.minutes')}</p>
          </Card>

          <SectionTitle action={<Button size="sm" variant="ghost" onClick={() => setAddOpen(true)}>+ {t('book.addAddress')}</Button>}>{t('book.address')}</SectionTitle>
          <Async q={addrs} empty={<Card className="text-center"><Button onClick={() => setAddOpen(true)}>+ {t('book.addAddress')}</Button></Card>}>
            {(list) => (
              <div className="space-y-2" role="radiogroup" aria-label={t('book.address')}>
                {list.map((a) => (
                  <button key={a.id} type="button" role="radio" aria-checked={addressId === a.id} onClick={() => setAddressId(a.id)} className={cx('w-full rounded-2xl border p-3 text-left', addressId === a.id ? 'border-brand bg-orange-50' : 'border-gray-200 bg-white')}>
                    <p className="font-semibold">{a.label}{a.isDefault && <span className="ml-2 text-xs text-brand">{t('profile.default')}</span>}</p>
                    <p className="text-sm text-gray-600">{[a.line1, a.line2, a.city, a.pincode].filter(Boolean).join(', ')}</p>
                  </button>
                ))}
              </div>
            )}
          </Async>

          <SectionTitle>{t('book.when')}</SectionTitle>
          <div className="mb-3 flex gap-2">
            <Chip active={instant} onClick={() => setInstant(true)}>⚡ {t('book.instant')}</Chip>
            <Chip active={!instant} onClick={() => setInstant(false)}>🗓️ {t('book.schedule')}</Chip>
          </div>
          {!instant && (
            <Card>
              <Field label={t('book.date')}>
                {(p) => <Input {...p} type="date" min={todayStr} value={day} onChange={(e) => { setDay(e.target.value); setHour(null); }} />}
              </Field>
              <p className="mb-1 text-sm font-medium text-gray-700" id="slots-l">{t('book.slot')}</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="slots-l">
                {HOURS.map((h) => {
                  const disabled = slotDate(day, h).getTime() < minTime;
                  const label = `${h % 12 || 12}:00 ${h >= 12 ? 'PM' : 'AM'}`;
                  return (
                    <button key={h} type="button" role="radio" aria-checked={hour === h} disabled={disabled} onClick={() => setHour(h)} className={cx('min-h-10 rounded-lg border px-3 text-sm', hour === h ? 'border-brand bg-brand text-white' : 'border-gray-300 bg-white', disabled && 'cursor-not-allowed opacity-40')}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </Card>
          )}

          <SectionTitle>{t('book.coupon')}</SectionTitle>
          <Card>
            <div className="flex gap-2">
              <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="SAVE20" aria-label={t('book.coupon')} />
              <Button variant="outline" loading={applying} onClick={() => applyCoupon()}>{t('book.apply')}</Button>
            </div>
            {available.data && available.data.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {available.data.slice(0, 4).map((c) => (
                  <Chip key={c.code} active={coupon?.code === c.code} onClick={() => { setCouponInput(c.code); applyCoupon(c.code); }}>{c.code}</Chip>
                ))}
              </div>
            )}
            {coupon && <p className="mt-2 text-sm text-green-700">✓ {coupon.code} {t('book.couponApplied')}</p>}
          </Card>

          <SectionTitle>{t('book.payment')}</SectionTitle>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('book.payment')}>
            {METHODS.map((m) => {
              const low = m === 'WALLET' && num(wallet.data?.balance) < num(quote?.total);
              return (
                <button key={m} type="button" role="radio" aria-checked={method === m} onClick={() => setMethod(m)} className={cx('rounded-2xl border p-3 text-left text-sm', method === m ? 'border-brand bg-orange-50' : 'border-gray-200 bg-white')}>
                  <span className="font-semibold">{t(`book.pay.${m}` as 'book.pay.UPI')}</span>
                  {m === 'WALLET' && <span className={cx('block text-xs', low ? 'text-red-600' : 'text-gray-500')}>{money(wallet.data?.balance)}{low ? ` · ${t('book.walletLow')}` : ''}</span>}
                </button>
              );
            })}
          </div>

          {quote && (
            <>
              <SectionTitle>{t('book.summary')}</SectionTitle>
              <Card>
                <Row label={t('book.base')} value={money(quote.basePrice)} />
                {quote.surgeAmount > 0 && <Row label={t('book.surge')} value={money(quote.surgeAmount)} />}
                {quote.discount > 0 && <Row label={t('book.discount')} value={`− ${money(quote.discount)}`} />}
                <Row label={`${t('book.tax')} (${service.gstPct}%)`} value={money(quote.taxAmount)} />
                <Row bold label={t('common.total')} value={money(quote.total)} />
                {!coupon && <p className="mt-2 text-xs text-gray-500">{t('book.estimate')}</p>}
              </Card>
            </>
          )}

          <div className="sticky bottom-20 mt-5 md:bottom-4">
            <Button full loading={busy} onClick={confirm} disabled={!addressId || (!instant && hour == null)}>
              {t('book.confirm')} · {money(quote?.total)}
            </Button>
          </div>

          <Sheet open={addOpen} onClose={() => setAddOpen(false)} title={t('book.addAddress')}>
            <AddressForm
              onCancel={() => setAddOpen(false)}
              onSaved={(a) => {
                qc.invalidateQueries({ queryKey: ['addresses'] });
                setAddressId(a.id);
                setAddOpen(false);
              }}
            />
          </Sheet>
        </>
      )}
    </Async>
  );
}
