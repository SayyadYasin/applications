'use client';
import { useState, type FormEvent } from 'react';
import { post, patch, qs, api } from '@/lib/api';
import { getPosition } from '@/lib/external';
import type { Address } from '@/lib/types';
import { useT } from '@/i18n';
import { toast } from '@/store/ui';
import { Button, Field, Input } from '@/components/ui';

interface Geo { formattedAddress?: string; line1?: string; city?: string; pincode?: string }

/** Create/edit address with GPS + reverse geocoding (POST/PATCH /addresses). */
export function AddressForm({ initial, onSaved, onCancel }: { initial?: Address; onSaved: (a: Address) => void; onCancel: () => void }) {
  const t = useT();
  const [f, setF] = useState({
    label: initial?.label ?? 'Home',
    line1: initial?.line1 ?? '',
    line2: initial?.line2 ?? '',
    city: initial?.city ?? '',
    pincode: initial?.pincode ?? '',
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(initial ? { lat: initial.lat, lng: initial.lng } : null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [gps, setGps] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function useGps() {
    setGps(true);
    try {
      const pos = await getPosition();
      setCoords(pos);
      try {
        const g = await api<Geo>(`/geo/reverse${qs(pos)}`);
        setF((x) => ({ ...x, line1: g.line1 ?? x.line1, city: g.city ?? x.city, pincode: g.pincode ?? x.pincode }));
      } catch (e) {
        toast.info(`Location captured. ${(e as Error).message} - please type the address.`);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGps(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!f.label.trim()) er.label = t('common.required');
    if (!f.line1.trim()) er.line1 = t('common.required');
    if (!f.city.trim()) er.city = t('common.required');
    if (!/^\d{6}$/.test(f.pincode)) er.pincode = '6 digits';
    if (!coords) er.gps = 'Tap "use my current location" so the partner can find you';
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const body = { ...f, line2: f.line2 || undefined, ...coords };
      const saved = initial ? await patch<Address>(`/addresses/${initial.id}`, body) : await post<Address>('/addresses', body);
      onSaved(saved);
    } catch (e2) {
      toast.error((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <Button type="button" variant="outline" full loading={gps} onClick={useGps} className="mb-1">
        📍 {t('book.useGps')}
      </Button>
      {coords && <p className="mb-3 text-center text-xs text-green-700">✓ {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>}
      {errs.gps && <p role="alert" className="mb-3 text-center text-xs text-red-600">{errs.gps}</p>}
      <Field label={t('book.label')} error={errs.label}>{(p) => <Input {...p} value={f.label} onChange={set('label')} maxLength={50} />}</Field>
      <Field label={t('book.line1')} error={errs.line1}>{(p) => <Input {...p} value={f.line1} onChange={set('line1')} maxLength={200} autoComplete="address-line1" />}</Field>
      <Field label={t('book.line2')}>{(p) => <Input {...p} value={f.line2} onChange={set('line2')} maxLength={200} autoComplete="address-line2" />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t('book.city')} error={errs.city}>{(p) => <Input {...p} value={f.city} onChange={set('city')} autoComplete="address-level2" />}</Field>
        <Field label={t('book.pincode')} error={errs.pincode}>{(p) => <Input {...p} value={f.pincode} onChange={set('pincode')} inputMode="numeric" maxLength={6} autoComplete="postal-code" />}</Field>
      </div>
      <div className="mt-2 flex gap-2">
        <Button type="button" variant="outline" full onClick={onCancel}>{t('common.cancel')}</Button>
        <Button type="submit" full loading={busy}>{t('common.save')}</Button>
      </div>
    </form>
  );
}
