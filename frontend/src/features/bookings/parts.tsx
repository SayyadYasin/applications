'use client';
import { dateTime } from '@/lib/format';
import type { Booking, BookingStatus, StatusLog } from '@/lib/types';
import { useT } from '@/i18n';
import { Badge, cx, statusTone } from '@/components/ui';

export function StatusBadge({ status }: { status: string }) {
  const t = useT();
  return <Badge tone={statusTone(status)}>{t(`status.${status}` as 'status.CONFIRMED')}</Badge>;
}

const FLOW: BookingStatus[] = ['PENDING_PAYMENT', 'CONFIRMED', 'ASSIGNED', 'PARTNER_EN_ROUTE', 'IN_PROGRESS', 'COMPLETED'];

/** Vertical timeline: reached steps use the status log timestamps; cancelled/rejected are appended. */
export function Timeline({ status, log }: { status: BookingStatus; log?: StatusLog[] }) {
  const t = useT();
  const at = new Map<string, string>();
  for (const l of log ?? []) at.set(l.status, l.at);
  const terminalBad = status === 'CANCELLED' || status === 'REJECTED';
  const idx = FLOW.indexOf(status);
  const steps: { s: BookingStatus; done: boolean; current: boolean }[] = FLOW.map((s, i) => ({
    s,
    done: terminalBad ? at.has(s) : i <= idx,
    current: s === status,
  }));
  if (terminalBad) steps.push({ s: status, done: true, current: true });
  return (
    <ol className="relative ml-3 border-l-2 border-gray-200">
      {steps.map(({ s, done, current }) => (
        <li key={s} className="mb-4 ml-5 last:mb-0" aria-current={current ? 'step' : undefined}>
          <span
            className={cx(
              'absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full border-2 bg-white',
              done ? (s === 'CANCELLED' || s === 'REJECTED' ? 'border-red-500 bg-red-500' : 'border-brand bg-brand') : 'border-gray-300',
              current && 'ring-4 ring-orange-100',
            )}
          />
          <p className={cx('text-sm', done ? 'font-semibold text-gray-900' : 'text-gray-400')}>{t(`status.${s}` as 'status.CONFIRMED')}</p>
          {at.get(s) && <p className="text-xs text-gray-500">{dateTime(at.get(s)!)}</p>}
        </li>
      ))}
    </ol>
  );
}

export const isActive = (b: Pick<Booking, 'status'>) => !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(b.status);
