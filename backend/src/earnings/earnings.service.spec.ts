import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { availableForPayout, groupEarnings, weekKey } from './earnings.util';
import { EarningsService } from './earnings.service';

const D = (n: number) => new Prisma.Decimal(n);

function makeService(opts: { totalNet: number; pending?: number; paid?: number; kyc?: string }) {
  const tx: any = {
    $executeRaw: jest.fn().mockResolvedValue(1),
    earning: {
      aggregate: jest.fn()
        .mockResolvedValueOnce({ _sum: { gross: D(0), commission: D(0), net: D(opts.totalNet) }, _count: 3 })
        .mockResolvedValueOnce({ _sum: { net: D(opts.totalNet) } }),
    },
    payout: {
      groupBy: jest.fn().mockResolvedValue([
        { status: 'REQUESTED', _sum: { amount: D(opts.pending ?? 0) } },
        { status: 'PAID', _sum: { amount: D(opts.paid ?? 0) } },
      ]),
      create: jest.fn().mockImplementation(async ({ data }: any) => data),
    },
  };
  const prisma: any = {
    partner: { findUnique: jest.fn().mockResolvedValue({ id: 'p1', kycStatus: opts.kyc ?? 'APPROVED' }) },
    $transaction: (fn: any) => fn(tx),
  };
  return { svc: new EarningsService(prisma), tx };
}

describe('payout limits', () => {
  const OLD = process.env.MIN_PAYOUT;
  afterEach(() => { process.env.MIN_PAYOUT = OLD; });

  it('availableForPayout never goes negative', () => {
    expect(availableForPayout(D(100), D(150)).toNumber()).toBe(0);
    expect(availableForPayout(D(1000), D(300)).toNumber()).toBe(700);
  });

  it('rejects below the minimum (default 500)', async () => {
    delete process.env.MIN_PAYOUT;
    const { svc } = makeService({ totalNet: 5000 });
    await expect(svc.requestPayout('u1', { amount: 499, upiId: 'a@upi' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('honours MIN_PAYOUT env', async () => {
    process.env.MIN_PAYOUT = '1000';
    const { svc } = makeService({ totalNet: 5000 });
    await expect(svc.requestPayout('u1', { amount: 999, upiId: 'a@upi' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects amounts above net earnings less pending/paid payouts', async () => {
    const { svc, tx } = makeService({ totalNet: 2000, pending: 1000, paid: 500 });
    await expect(svc.requestPayout('u1', { amount: 600, upiId: 'a@upi' })).rejects.toThrow(/exceeds available/);
    expect(tx.payout.create).not.toHaveBeenCalled();
  });

  it('creates a payout within the available balance', async () => {
    const { svc, tx } = makeService({ totalNet: 2000, pending: 1000, paid: 0 });
    const r: any = await svc.requestPayout('u1', { amount: 1000, upiId: 'a@upi' });
    expect(tx.payout.create).toHaveBeenCalled();
    expect(r.partnerId).toBe('p1');
  });
});

describe('earnings grouping', () => {
  it('groups by IST day and Monday-based week', () => {
    const rows = [
      { gross: D(100), commission: D(15), net: D(85), createdAt: new Date('2026-03-02T01:00:00Z') }, // Mon
      { gross: D(100), commission: D(15), net: D(85), createdAt: new Date('2026-03-02T20:00:00Z') }, // Tue 01:30 IST
      { gross: D(50), commission: D(5), net: D(45), createdAt: new Date('2026-03-08T10:00:00Z') }, // Sun
    ];
    const daily = groupEarnings(rows, (d) => d.toISOString().slice(0, 10));
    expect(daily).toHaveLength(2);
    expect(weekKey(rows[0].createdAt)).toBe('2026-03-02');
    expect(weekKey(rows[2].createdAt)).toBe('2026-03-02');
    expect(groupEarnings(rows, weekKey)[0]).toMatchObject({ jobs: 3, net: 215 });
  });
});
