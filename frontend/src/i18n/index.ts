'use client';
import { useUi, type Lang } from '@/store/ui';
import { en, type Key } from './en';
import { hi } from './hi';
import { mr } from './mr';

const dicts: Record<Lang, Partial<Record<Key, string>>> = { en, hi, mr };

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
];

export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>) {
  let s = dicts[lang][key] ?? en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

export function useT() {
  const lang = useUi((s) => s.lang);
  return (key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars);
}

export type { Key };
