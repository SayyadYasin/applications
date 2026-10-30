'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';
import { useAuth, type SessionUser } from '@/store/auth';

export const homeFor = (role: string | null) => (role === 'PARTNER' ? '/partner' : '/');

/** True after first client render (zustand persist is hydrated from localStorage by then). */
export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}

/** Keeps the session user fresh from GET /auth/me. */
export function useSession() {
  const token = useAuth((s) => s.token);
  const user = useAuth((s) => s.user);
  const setUser = useAuth((s) => s.setUser);
  const mounted = useMounted();
  useEffect(() => {
    if (!mounted || !token) return;
    api<SessionUser>('/auth/me').then(setUser).catch(() => undefined);
  }, [mounted, token, setUser]);
  return { mounted, token, user };
}

/** Redirects after login/registration based on role (or ?next=). */
export function useAfterAuth() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const setUser = useAuth((s) => s.setUser);
  return async (accessToken: string, role: string) => {
    login(accessToken, role);
    let r = role;
    try {
      const me = await api<SessionUser>('/auth/me');
      setUser(me);
      r = me.role;
    } catch {
      /* role from login response is enough */
    }
    const next = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('next') : null;
    router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : homeFor(r));
  };
}
