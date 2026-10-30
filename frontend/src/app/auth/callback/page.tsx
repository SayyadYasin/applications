'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { homeFor } from '@/lib/session';
import { useAuth, type SessionUser } from '@/store/auth';
import { Loading, LinkButton } from '@/components/ui';

/** Landing page for the server-side Google OAuth redirect: /auth/callback?token=... */
export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setError('Missing sign-in token.');
      return;
    }
    // Store the token first so api() sends it, then resolve the role.
    useAuth.getState().login(token, '');
    api<SessionUser>('/auth/me')
      .then((me) => {
        useAuth.getState().setUser(me);
        router.replace(homeFor(me.role));
      })
      .catch((e: Error) => {
        useAuth.getState().logout();
        setError(e.message);
      });
  }, [router]);

  if (error) {
    return (
      <main className="mx-auto max-w-sm p-8 text-center">
        <p role="alert" className="mb-4 text-red-600">{error}</p>
        <LinkButton href="/login">Back to login</LinkButton>
      </main>
    );
  }
  return (
    <main className="p-8">
      <Loading label="Signing you in…" />
    </main>
  );
}
