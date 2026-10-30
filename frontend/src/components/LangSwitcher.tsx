'use client';
import { LANGS, useT } from '@/i18n';
import { useUi, type Lang } from '@/store/ui';

export function LangSwitcher({ className }: { className?: string }) {
  const lang = useUi((s) => s.lang);
  const setLang = useUi((s) => s.setLang);
  const t = useT();
  return (
    <select
      aria-label={t('common.language')}
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      className={`min-h-9 rounded-lg border border-gray-300 bg-white px-2 text-sm ${className ?? ''}`}
    >
      {LANGS.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  );
}
