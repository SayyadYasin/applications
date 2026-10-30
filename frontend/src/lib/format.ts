import type { L10n, Money } from './types';
import { useUi, type Lang } from '@/store/ui';

export const num = (v: Money | null | undefined) => (v == null ? 0 : Number(v));

export function money(v: Money | null | undefined) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(num(v));
}

const LOCALES: Record<Lang, string> = { en: 'en-IN', hi: 'hi-IN', mr: 'mr-IN' };

export function dateTime(iso: string | Date) {
  return new Date(iso).toLocaleString(LOCALES[useUi.getState().lang], { dateStyle: 'medium', timeStyle: 'short' });
}
export function dateOnly(iso: string | Date) {
  return new Date(iso).toLocaleDateString(LOCALES[useUi.getState().lang], { dateStyle: 'medium' });
}

/** Localised name from {en,hi,...} JSON with fallback to English. */
export function loc(v: L10n, lang?: Lang): string {
  if (!v) return '';
  const l = lang ?? useUi.getState().lang;
  return v[l] || v.en || Object.values(v)[0] || '';
}

export function minToTime(m: number) {
  const h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${mm} ${ap}`;
}

export function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const initials = (n: string) =>
  n
    .split(/\s+/)
    .map((x) => x[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
