'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { homeFor, useSession } from '@/lib/session';
import type { Notification } from '@/lib/types';
import { useT, type Key } from '@/i18n';
import { useAuth } from '@/store/auth';
import { LangSwitcher } from './LangSwitcher';
import { Loading, cx } from './ui';

interface NavItem { href: string; key: Key; icon: string; match?: (p: string) => boolean }

const CUSTOMER_NAV: NavItem[] = [
  { href: '/', key: 'nav.home', icon: '🏠', match: (p) => p === '/' || p.startsWith('/category') || p.startsWith('/service') || p.startsWith('/search') || p.startsWith('/book/') },
  { href: '/bookings', key: 'nav.bookings', icon: '📋' },
  { href: '/wallet', key: 'nav.wallet', icon: '👛' },
  { href: '/profile', key: 'nav.profile', icon: '👤', match: (p) => ['/profile', '/favorites', '/coupons', '/loyalty', '/memberships', '/support'].some((x) => p.startsWith(x)) },
];
const PARTNER_NAV: NavItem[] = [
  { href: '/partner', key: 'nav.home', icon: '🏠' },
  { href: '/partner/jobs', key: 'nav.jobs', icon: '🛠️' },
  { href: '/partner/earnings', key: 'nav.earnings', icon: '📈' },
  { href: '/partner/wallet', key: 'nav.wallet', icon: '👛' },
  { href: '/partner/profile', key: 'nav.profile', icon: '👤', match: (p) => ['/partner/profile', '/partner/kyc', '/partner/services', '/partner/availability', '/partner/reviews', '/partner/payouts', '/partner/support'].some((x) => p.startsWith(x)) },
];

const PUBLIC_PREFIXES = ['/category', '/service', '/search'];
const isPublic = (p: string) => p === '/' || PUBLIC_PREFIXES.some((x) => p.startsWith(x));

export function AppShell({ variant, children }: { variant: 'customer' | 'partner'; children: ReactNode }) {
  const t = useT();
  const path = usePathname();
  const router = useRouter();
  const { mounted, token, user } = useSession();
  const nav = variant === 'partner' ? PARTNER_NAV : CUSTOMER_NAV;
  const publicPage = variant === 'customer' && isPublic(path);
  const storeRole = useAuth((s) => s.role);
  const role = user?.role ?? storeRole;

  const wrongRole = !!token && !!role && (variant === 'partner' ? role !== 'PARTNER' : role === 'PARTNER');

  useEffect(() => {
    if (!mounted) return;
    if (!token && !publicPage) router.replace(`/login?next=${encodeURIComponent(path)}`);
    else if (wrongRole && !(publicPage && role !== 'PARTNER')) router.replace(homeFor(role));
  }, [mounted, token, publicPage, wrongRole, role, path, router]);

  const notifs = useQuery({
    queryKey: ['notifications', 'badge'],
    queryFn: () => api<Notification[]>('/notifications?take=30'),
    enabled: mounted && !!token && !wrongRole,
    refetchInterval: 60_000,
  });
  const unread = notifs.data?.filter((n) => !n.readAt).length ?? 0;
  const notifHref = variant === 'partner' ? '/partner/notifications' : '/notifications';

  const blocked = !mounted || (!token && !publicPage) || wrongRole;
  const active = (n: NavItem) => (n.match ? n.match(path) : n.href === path || (n.href !== '/' && n.href !== '/partner' && path.startsWith(n.href)));

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:p-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4">
          <Link href={variant === 'partner' ? '/partner' : '/'} className="text-lg font-extrabold text-brand">
            {t('appName')}
            {variant === 'partner' && <span className="ml-1 text-xs font-semibold text-gray-500">Partner</span>}
          </Link>
          <nav aria-label="Main" className="ml-4 hidden gap-1 md:flex">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} aria-current={active(n) ? 'page' : undefined} className={cx('rounded-lg px-3 py-1.5 text-sm font-medium', active(n) ? 'bg-orange-50 text-brand' : 'text-gray-600 hover:bg-gray-100')}>
                {t(n.key)}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LangSwitcher />
            {token ? (
              <Link href={notifHref} aria-label={t('notif.title')} className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-gray-100">
                <span aria-hidden>🔔</span>
                {unread > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{unread > 9 ? '9+' : unread}</span>}
              </Link>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(path)}`} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-semibold text-white">
                {t('auth.login')}
              </Link>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-4xl px-4 py-4">
        {blocked && !(publicPage && mounted && !wrongRole) ? <Loading /> : children}
      </main>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="mx-auto flex max-w-4xl justify-around">
          {nav.map((n) => (
            <li key={n.href} className="flex-1">
              <Link href={n.href} aria-current={active(n) ? 'page' : undefined} className={cx('flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium', active(n) ? 'text-brand' : 'text-gray-500')}>
                <span className="text-lg" aria-hidden>{n.icon}</span>
                {t(n.key)}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
