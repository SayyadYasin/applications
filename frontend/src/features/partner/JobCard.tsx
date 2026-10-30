'use client';
import Link from 'next/link';
import { dateTime, loc, money } from '@/lib/format';
import type { Booking } from '@/lib/types';
import { Card } from '@/components/ui';
import { StatusBadge } from '@/features/bookings/parts';

export function JobCard({ b, children }: { b: Booking; children?: React.ReactNode }) {
  return (
    <Card>
      <Link href={`/partner/jobs/${b.id}`} className="block">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold">{loc(b.service?.name)}</p>
          <StatusBadge status={b.status} />
        </div>
        <p className="mt-1 text-sm text-gray-600">{dateTime(b.scheduledAt)}{b.isInstant && ' · ⚡'}</p>
        <div className="mt-1 flex justify-between text-xs text-gray-500">
          <span>#{b.code}</span>
          <span className="font-semibold text-gray-800">{money(b.total)}</span>
        </div>
      </Link>
      {children}
    </Card>
  );
}
