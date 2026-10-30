'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { patch } from '@/lib/api';
import { useT, type Key } from '@/i18n';
import { useAuth } from '@/store/auth';
import { toast } from '@/store/ui';
import { Async, Button, Card, Field, Input, PageTitle, Textarea } from '@/components/ui';
import { LangSwitcher } from '@/components/LangSwitcher';
import { ReferralCard } from '@/features/referral/ReferralCard';
import { usePartnerMe } from '@/features/partner/hooks';

const LINKS: { href: string; icon: string; key: Key }[] = [
  { href: '/partner/kyc', icon: '🪪', key: 'partner.kyc' },
  { href: '/partner/services', icon: '🧰', key: 'partner.services' },
  { href: '/partner/availability', icon: '🗓️', key: 'partner.availability' },
  { href: '/partner/reviews', icon: '⭐', key: 'partner.reviews' },
  { href: '/partner/payouts', icon: '🏦', key: 'partner.payouts' },
  { href: '/partner/notifications', icon: '🔔', key: 'notif.title' },
  { href: '/partner/support', icon: '🛟', key: 'support.title' },
];

export default function PartnerProfile() {
  const t = useT();
  const router = useRouter();
  const qc = useQueryClient();
  const logout = useAuth((s) => s.logout);
  const me = usePartnerMe();
  const [bio, setBio] = useState('');
  const [radius, setRadius] = useState('10');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me.data) {
      setBio(me.data.bio ?? '');
      setRadius(String(me.data.radiusKm));
    }
  }, [me.data]);

  async function save(e: FormEvent) {
    e.preventDefault();
    const r = Number(radius);
    if (!(r >= 1 && r <= 100)) return toast.error('Radius must be 1-100 km');
    setBusy(true);
    try {
      await patch('/partners/me', { bio, radiusKm: r });
      toast.success(t('common.saved'));
      qc.invalidateQueries({ queryKey: ['partner-me'] });
    } catch (e2) {
      toast.error((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageTitle>{t('profile.title')}</PageTitle>
      <Async q={me}>
        {(p) => (
          <Card>
            <p className="font-semibold">{p.user.name}</p>
            <p className="mb-3 text-sm text-gray-500">{p.user.email ?? p.user.phone}</p>
            <form onSubmit={save} noValidate>
              <Field label={t('partner.bio')}>{(f) => <Textarea {...f} maxLength={1000} value={bio} onChange={(e) => setBio(e.target.value)} />}</Field>
              <Field label={t('partner.radius')}>{(f) => <Input {...f} inputMode="decimal" value={radius} onChange={(e) => setRadius(e.target.value)} />}</Field>
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
      <ReferralCard />
      <Button variant="outline" full className="mt-4" onClick={() => { logout(); router.replace('/login'); }}>{t('common.logout')}</Button>
    </>
  );
}
