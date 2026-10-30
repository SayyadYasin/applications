'use client';
import Link from 'next/link';
import { useEffect, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { useT } from '@/i18n';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  loading?: boolean;
  full?: boolean;
};
const variants = {
  primary: 'bg-brand text-white hover:bg-orange-700 disabled:bg-orange-300',
  outline: 'border border-gray-300 bg-white text-gray-800 hover:bg-gray-50 disabled:text-gray-400',
  ghost: 'text-brand hover:bg-orange-50 disabled:text-gray-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
};
export function Button({ variant = 'primary', size = 'md', loading, full, className, children, disabled, ...p }: BtnProps) {
  return (
    <button
      {...p}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed',
        size === 'sm' ? 'min-h-9 px-3 text-sm' : 'min-h-11 px-4 text-base',
        variants[variant],
        full && 'w-full',
        className,
      )}
    >
      {loading && <Spinner small />}
      {children}
    </button>
  );
}

export function LinkButton({ href, variant = 'primary', size = 'md', className, children, full }: { href: string; variant?: 'primary' | 'outline' | 'ghost'; size?: 'sm' | 'md'; className?: string; children: ReactNode; full?: boolean }) {
  return (
    <Link
      href={href}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand',
        size === 'sm' ? 'min-h-9 px-3 text-sm' : 'min-h-11 px-4 text-base',
        variants[variant],
        full && 'w-full',
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function Spinner({ small }: { small?: boolean }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cx('inline-block animate-spin rounded-full border-2 border-current border-t-transparent', small ? 'h-4 w-4' : 'h-6 w-6 text-brand')}
    />
  );
}

export function Card({ children, className, ...p }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...p} className={cx('rounded-2xl border border-gray-200 bg-white p-4 shadow-sm', className)}>
      {children}
    </div>
  );
}

export function PageTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h1 className="text-xl font-bold">{children}</h1>
      {action}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between">
      <h2 className="text-base font-semibold text-gray-900">{children}</h2>
      {action}
    </div>
  );
}

export function Loading({ label }: { label?: string }) {
  const t = useT();
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-gray-500" aria-live="polite">
      <Spinner />
      <span>{label ?? t('common.loading')}</span>
    </div>
  );
}

export function EmptyState({ title, hint, action, icon = '🗂️' }: { title?: string; hint?: string; action?: ReactNode; icon?: string }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-gray-300 px-6 py-10 text-center">
      <div className="text-3xl" aria-hidden>{icon}</div>
      <p className="font-medium text-gray-700">{title ?? t('common.empty')}</p>
      {hint && <p className="text-sm text-gray-500">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useT();
  const msg = error instanceof Error ? error.message : t('common.error');
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-center">
      <p className="font-medium text-red-700">{t('common.error')}</p>
      <p className="text-sm text-red-600">{msg}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

/** Renders loading / error / empty states around a react-query result. */
export function Async<T>({ q, children, empty, isEmpty }: {
  q: { data?: T; isLoading: boolean; error: unknown; refetch: () => unknown };
  children: (d: T) => ReactNode;
  empty?: ReactNode;
  isEmpty?: (d: T) => boolean;
}) {
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (q.data === undefined || q.data === null) return <>{empty ?? <EmptyState />}</>;
  if (isEmpty?.(q.data) ?? (Array.isArray(q.data) && q.data.length === 0)) return <>{empty ?? <EmptyState />}</>;
  return <>{children(q.data)}</>;
}

export function Field({ label, error, hint, children, id }: { label: string; error?: string; hint?: string; children: (props: { id: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }) => ReactNode; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  return (
    <div className="mb-3">
      <label htmlFor={fid} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {children({ id: fid, 'aria-invalid': error ? true : undefined, 'aria-describedby': error || hint ? `${fid}-d` : undefined })}
      {(error || hint) && (
        <p id={`${fid}-d`} className={cx('mt-1 text-xs', error ? 'text-red-600' : 'text-gray-500')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

const inputCls =
  'w-full min-h-11 rounded-xl border border-gray-300 bg-white px-3 text-base placeholder:text-gray-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:bg-gray-100';
export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(inputCls, p.className)} />;
}
export function Select(p: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cx(inputCls, p.className)} />;
}
export function Textarea(p: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cx(inputCls, 'min-h-24 py-2', p.className)} />;
}

const tones: Record<string, string> = {
  gray: 'bg-gray-100 text-gray-700',
  green: 'bg-green-100 text-green-800',
  orange: 'bg-orange-100 text-orange-800',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-800',
};
export function Badge({ tone = 'gray', children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={cx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone])}>{children}</span>;
}

export const statusTone = (s: string) =>
  ({
    COMPLETED: 'green', APPROVED: 'green', PAID: 'green', RESOLVED: 'green', CLOSED: 'gray',
    CANCELLED: 'red', REJECTED: 'red', FAILED: 'red',
    PARTNER_EN_ROUTE: 'blue', IN_PROGRESS: 'blue', ASSIGNED: 'blue', SUBMITTED: 'blue',
  })[s] ?? 'orange';

export function Stars({ value, onChange, size = 'text-xl' }: { value: number; onChange?: (n: number) => void; size?: string }) {
  return (
    <div className={cx('flex gap-0.5', size)} role={onChange ? 'radiogroup' : 'img'} aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n}`} onClick={() => onChange(n)} className={n <= value ? 'text-amber-500' : 'text-gray-300'}>
            ★
          </button>
        ) : (
          <span key={n} className={n <= Math.round(value) ? 'text-amber-500' : 'text-gray-300'} aria-hidden>
            ★
          </span>
        ),
      )}
    </div>
  );
}

export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 sm:rounded-3xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-full text-xl text-gray-500 hover:bg-gray-100">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Row({ label, value, bold }: { label: ReactNode; value: ReactNode; bold?: boolean }) {
  return (
    <div className={cx('flex justify-between gap-3 py-1 text-sm', bold && 'border-t pt-2 text-base font-bold')}>
      <span className={bold ? '' : 'text-gray-600'}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx('min-h-9 shrink-0 rounded-full border px-3.5 text-sm font-medium transition', active ? 'border-brand bg-brand text-white' : 'border-gray-300 bg-white text-gray-700 hover:border-brand')}
    >
      {children}
    </button>
  );
}
