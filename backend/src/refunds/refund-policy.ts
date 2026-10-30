import { Prisma } from '@prisma/client';

export const FULL_REFUND_WINDOW_MS = 2 * 60 * 60 * 1000;

/** Full refund when cancelled more than 2h before the schedule, otherwise 50%. */
export function cancellationRefund(
  paid: Prisma.Decimal | number | string,
  scheduledAt: Date,
  now: Date = new Date(),
): { pct: number; amount: Prisma.Decimal } {
  const pct = scheduledAt.getTime() - now.getTime() > FULL_REFUND_WINDOW_MS ? 100 : 50;
  const amount = new Prisma.Decimal(paid).mul(pct).div(100).toDecimalPlaces(2);
  return { pct, amount };
}
