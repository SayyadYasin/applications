import { Prisma } from '@prisma/client';

const IST_OFFSET_MIN = 330;
const DAY_MS = 86_400_000;

export interface EarningRow { gross: Prisma.Decimal; commission: Prisma.Decimal; net: Prisma.Decimal; createdAt: Date }
export interface Bucket { period: string; jobs: number; gross: number; commission: number; net: number }

/** Shifts a date so its UTC fields read as IST wall-clock. */
const toIst = (d: Date) => new Date(d.getTime() + IST_OFFSET_MIN * 60_000);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export const dayKey = (d: Date) => iso(toIst(d));

/** Monday of the IST week containing `d`, as YYYY-MM-DD. */
export function weekKey(d: Date): string {
  const ist = toIst(d);
  const dow = (ist.getUTCDay() + 6) % 7; // Mon=0
  return iso(new Date(ist.getTime() - dow * DAY_MS));
}

export function groupEarnings(rows: EarningRow[], keyFn: (d: Date) => string): Bucket[] {
  const map = new Map<string, Bucket>();
  for (const r of rows) {
    const k = keyFn(r.createdAt);
    const b = map.get(k) ?? { period: k, jobs: 0, gross: 0, commission: 0, net: 0 };
    b.jobs += 1;
    b.gross += Number(r.gross);
    b.commission += Number(r.commission);
    b.net += Number(r.net);
    map.set(k, b);
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return [...map.values()]
    .sort((a, b) => a.period.localeCompare(b.period))
    .map((b) => ({ ...b, gross: round(b.gross), commission: round(b.commission), net: round(b.net) }));
}

/**
 * Amount a partner may still request: all net earnings minus everything already requested/approved/paid.
 * (Equivalent to unsettled net minus pending payouts, without drift from partially-covering payouts.)
 */
export function availableForPayout(totalNet: Prisma.Decimal, committedPayouts: Prisma.Decimal): Prisma.Decimal {
  const v = totalNet.sub(committedPayouts);
  return v.isNegative() ? new Prisma.Decimal(0) : v;
}

export const minPayout = () => {
  const n = Number(process.env.MIN_PAYOUT ?? 500);
  return Number.isFinite(n) && n > 0 ? n : 500;
};
