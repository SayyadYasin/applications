'use client';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { post } from '@/lib/api';
import { GOOGLE_CLIENT_ID, renderGoogleButton } from '@/lib/external';
import { useAfterAuth, useMounted } from '@/lib/session';
import { useT } from '@/i18n';
import { useAuth } from '@/store/auth';
import { toast } from '@/store/ui';
import { Button, Card, Chip, Field, Input } from '@/components/ui';
import { LangSwitcher } from '@/components/LangSwitcher';
import { homeFor } from '@/lib/session';
import { useRouter } from 'next/navigation';

interface TokenRes { accessToken: string; role: string }
const PHONE_RE = /^[6-9]\d{9}$/;

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-2xl font-extrabold text-brand">{t('appName')}</Link>
        <LangSwitcher />
      </div>
      <h1 className="mb-1 text-2xl font-bold">{title}</h1>
      <p className="mb-5 text-gray-600">{t('tagline')}</p>
      <Card>{children}</Card>
    </main>
  );
}

function GoogleButton() {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  const after = useAfterAuth();
  const [available, setAvailable] = useState(!!GOOGLE_CLIENT_ID);
  useEffect(() => {
    if (!ref.current || !GOOGLE_CLIENT_ID) return;
    renderGoogleButton(ref.current, async (idToken) => {
      try {
        const r = await post<TokenRes>('/auth/google/token', { idToken });
        await after(r.accessToken, r.role);
      } catch (e) {
        toast.error((e as Error).message);
      }
    }).then((ok) => setAvailable(ok)).catch(() => setAvailable(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!available) return null;
  return (
    <>
      <div className="my-4 flex items-center gap-3 text-xs text-gray-400" aria-hidden>
        <span className="h-px flex-1 bg-gray-200" />
        {t('auth.or')}
        <span className="h-px flex-1 bg-gray-200" />
      </div>
      <div ref={ref} className="flex min-h-11 justify-center" aria-label={t('auth.google')} />
    </>
  );
}

function OtpForm({ role }: { role?: 'CUSTOMER' | 'PARTNER' }) {
  const t = useT();
  const after = useAfterAuth();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!PHONE_RE.test(phone)) return setErr('Enter a valid 10-digit Indian mobile number');
    setErr('');
    setBusy(true);
    try {
      await post('/auth/otp/request', { phone });
      setSent(true);
      toast.success(t('auth.otpSent'));
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return setErr('Enter the 6-digit code');
    setErr('');
    setBusy(true);
    try {
      const r = await post<TokenRes>('/auth/otp/verify', { phone, code, ...(name && { name }) });
      await after(r.accessToken, r.role);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }
  void role;

  return (
    <form onSubmit={sent ? verify : send} noValidate>
      <Field label={t('auth.phone')}>
        {(p) => <Input {...p} inputMode="numeric" autoComplete="tel-national" maxLength={10} value={phone} disabled={sent} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="9876543210" />}
      </Field>
      {sent && (
        <>
          <Field label={t('auth.otp')}>
            {(p) => <Input {...p} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />}
          </Field>
          <Field label={`${t('auth.name')} (new users)`}>{(p) => <Input {...p} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}</Field>
        </>
      )}
      {err && <p role="alert" className="mb-3 text-sm text-red-600">{err}</p>}
      <Button type="submit" full loading={busy}>{sent ? t('auth.verifyOtp') : t('auth.sendOtp')}</Button>
      {sent && (
        <Button type="button" variant="ghost" full className="mt-2" onClick={() => { setSent(false); setCode(''); }}>
          {t('common.back')}
        </Button>
      )}
    </form>
  );
}

function EmailLogin() {
  const t = useT();
  const after = useAfterAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email || !password) return setErr(t('common.required'));
    setBusy(true);
    setErr('');
    try {
      const r = await post<TokenRes>('/auth/login', { email, password });
      await after(r.accessToken, r.role);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} noValidate>
      <Field label={t('auth.email')}>{(p) => <Input {...p} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
      <Field label={t('auth.password')}>{(p) => <Input {...p} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
      {err && <p role="alert" className="mb-3 text-sm text-red-600">{err}</p>}
      <Button type="submit" full loading={busy}>{t('auth.login')}</Button>
    </form>
  );
}

function useRedirectIfAuthed() {
  const router = useRouter();
  const mounted = useMounted();
  const token = useAuth((s) => s.token);
  const role = useAuth((s) => s.role);
  useEffect(() => {
    if (!mounted || !token || !role) return;
    const next = new URLSearchParams(window.location.search).get('next');
    router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : homeFor(role));
  }, [mounted, token, role, router]);
}

export function LoginScreen() {
  const t = useT();
  const [tab, setTab] = useState<'email' | 'otp'>('email');
  useRedirectIfAuthed();
  return (
    <Frame title={t('auth.welcome')}>
      <div className="mb-4 flex gap-2" role="tablist">
        <Chip active={tab === 'email'} onClick={() => setTab('email')}>{t('auth.emailTab')}</Chip>
        <Chip active={tab === 'otp'} onClick={() => setTab('otp')}>{t('auth.otpTab')}</Chip>
      </div>
      {tab === 'email' ? <EmailLogin /> : <OtpForm />}
      <GoogleButton />
      <p className="mt-5 text-center text-sm text-gray-600">
        {t('auth.noAccount')}{' '}
        <Link className="font-semibold text-brand" href="/register">{t('auth.register')}</Link>
      </p>
    </Frame>
  );
}

export function RegisterScreen() {
  const t = useT();
  const after = useAfterAuth();
  const [role, setRole] = useState<'CUSTOMER' | 'PARTNER'>('CUSTOMER');
  const [f, setF] = useState({ name: '', email: '', password: '', phone: '', referralCode: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useRedirectIfAuthed();

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('role') === 'PARTNER') setRole('PARTNER');
    const ref = p.get('ref');
    if (ref) setF((x) => ({ ...x, referralCode: ref }));
  }, []);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (f.name.trim().length < 2) er.name = 'Enter your name';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = 'Enter a valid email';
    if (f.password.length < 8) er.password = 'At least 8 characters';
    if (f.phone && !PHONE_RE.test(f.phone)) er.phone = 'Enter a valid 10-digit mobile number';
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      const r = await post<TokenRes>('/auth/register', {
        name: f.name.trim(), email: f.email, password: f.password, role,
        ...(f.phone && { phone: f.phone }),
        ...(f.referralCode && { referralCode: f.referralCode }),
      });
      await after(r.accessToken, r.role);
    } catch (e2) {
      toast.error((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Frame title={t('auth.register')}>
      <div className="mb-4 flex gap-2" role="radiogroup">
        <Chip active={role === 'CUSTOMER'} onClick={() => setRole('CUSTOMER')}>{t('auth.iAmCustomer')}</Chip>
        <Chip active={role === 'PARTNER'} onClick={() => setRole('PARTNER')}>{t('auth.iAmPartner')}</Chip>
      </div>
      <form onSubmit={submit} noValidate>
        <Field label={t('auth.name')} error={errs.name}>{(p) => <Input {...p} autoComplete="name" value={f.name} onChange={set('name')} />}</Field>
        <Field label={t('auth.email')} error={errs.email}>{(p) => <Input {...p} type="email" autoComplete="email" value={f.email} onChange={set('email')} />}</Field>
        <Field label={t('auth.password')} error={errs.password}>{(p) => <Input {...p} type="password" autoComplete="new-password" value={f.password} onChange={set('password')} />}</Field>
        <Field label={`${t('auth.phone')} (optional)`} error={errs.phone}>{(p) => <Input {...p} inputMode="numeric" maxLength={10} autoComplete="tel-national" value={f.phone} onChange={set('phone')} />}</Field>
        <Field label={t('auth.referral')}>{(p) => <Input {...p} value={f.referralCode} onChange={set('referralCode')} />}</Field>
        <Button type="submit" full loading={busy}>{t('auth.register')}</Button>
      </form>
      <GoogleButton />
      <p className="mt-5 text-center text-sm text-gray-600">
        {t('auth.haveAccount')}{' '}
        <Link className="font-semibold text-brand" href="/login">{t('auth.login')}</Link>
      </p>
    </Frame>
  );
}
