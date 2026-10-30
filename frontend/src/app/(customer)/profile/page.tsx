'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, patch } from '@/lib/api';
import type { Profile, Town } from '@/lib/types';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { toast, useUi } from '@/store/ui';
import { Async, Button, Card, Field, Input, PageTitle, Select } from '@/components/ui';
import { LangSwitcher } from '@/components/LangSwitcher';
import type { Key } from '@/i18n';

const LINKS: { href: string; icon: string; key: Key }[] = [
  { href: '/profile/addresses', icon: '📍', key: 'profile.addresses' },
  { href: '/favorites', icon: '❤️', key: 'profile.favorites' },
  { href: '/coupons', icon: '🏷️', key: 'coupons.title' },
  { href: '/loyalty', icon: '⭐', key: 'loyalty.title' },
  { href: '/memberships', icon: '👑', key: 'member.title' },
  { href: '/notifications', icon: '🔔', key: 'notif.title' },
  { href: '/support', icon: '🛟', key: 'support.title' },
];

export default function ProfilePage() {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const logout = useAuth((s) => s.logout);
  const [name, setName] = useState('');
  const [townId, setTownId] = useState('');
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['profile'], queryFn: () => api<Profile>('/profile') });
  const towns = useQuery({ queryKey: ['towns'], queryFn: () => api<Town[]>('/geo/towns') });

  useEffect(() => {
    if (q.data) {
      setName(q.data.name);
      setTownId(q.data.townId ?? '');
    }
  }, [q.data]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error(t('common.required'));
    setBusy(true);
    try {
      const lang = useUi.getState().lang;
      await patch('/profile', { name: name.trim(), language: lang, ...(townId && { townId }) });
      toast.success(t('common.saved'));
      qc.invalidateQueries({ queryKey: ['profile'] });
    } catch (e2) {
      toast.error((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle>{t('profile.title')}</PageTitle>
      <Async q={q}>
        {(p) => (
          <Card>
            <p className="mb-3 text-sm text-gray-500">{p.email ?? p.phone}</p>
            <form onSubmit={save} noValidate>
              <Field label={t('auth.name')}>{(f) => <Input {...f} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
              <Field label={t('profile.town')}>
                {(f) => (
                  <Select {...f} value={townId} onChange={(e) => setTownId(e.target.value)}>
                    <option value="">—</option>
                    {towns.data?.map((x) => <option key={x.id} value={x.id}>{x.name}, {x.state}</option>)}
                  </Select>
                )}
              </Field>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">{t('common.language')}</span>
                <LangSwitcher />
              </div>
              <Button type="submit" full loading={busy}>{t('common.save')}</Button>
            </form>
          </Card>
        )}
      </Async>
      <ul className="mt-4 divide-y rounded-2xl border bg-white">
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex min-h-12 items-center justify-between px-4 py-3 hover:bg-gray-50">
              <span><span aria-hidden className="mr-3">{l.icon}</span>{t(l.key)}</span>
              <span aria-hidden className="text-gray-400">›</span>
            </Link>
          </li>
        ))}
      </ul>
      <Button variant="outline" full className="mt-4" onClick={() => { logout(); router.replace('/login'); }}>{t('common.logout')}</Button>
    </>
  );
}
