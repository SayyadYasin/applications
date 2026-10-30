'use client';
import { useUi } from '@/store/ui';
import { cx } from './ui';

export function Toaster() {
  const toasts = useUi((s) => s.toasts);
  const dismiss = useUi((s) => s.dismiss);
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3">
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.kind === 'error' ? 'alert' : 'status'}
          className={cx(
            'pointer-events-auto flex max-w-md items-start gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg',
            t.kind === 'success' && 'bg-green-600',
            t.kind === 'error' && 'bg-red-600',
            t.kind === 'info' && 'bg-gray-800',
          )}
        >
          <span className="flex-1">{t.text}</span>
          <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="opacity-80 hover:opacity-100">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
