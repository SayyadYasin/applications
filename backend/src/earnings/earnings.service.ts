import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { PayoutStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { advisoryLock } from '../wallet/razorpay.util';
import { availableForPayout, dayKey, groupEarnings, minPayout, weekKey } from './earnings.util';
import { RequestPayoutDto } from './earnings.dto';

const PENDING: PayoutStatus[] = [PayoutStatus.REQUESTED, PayoutStatus.APPROVED];
const DAY_MS = 86_400_000;
const D = (v: Prisma.Decimal | null | undefined) => v ?? new Prisma.Decimal(0);

@Injectable()
export class EarningsService {
  constructor(private prisma: PrismaService) {}

  private async partnerOf(userId: string) {
    const p = await this.prisma.partner.findUnique({ where: { userId } });
    if (!p) throw new ForbiddenException('Partner profile not found');
    return p;
  }

  private async balances(db: Prisma.TransactionClient | PrismaService, partnerId: string) {
    const [all, unsettled, payouts] = await Promise.all([
      db.earning.aggregate({ where: { partnerId }, _sum: { gross: true, commission: true, net: true }, _count: true }),
      db.earning.aggregate({ where: { partnerId, settled: false }, _sum: { net: true } }),
      db.payout.groupBy({ by: ['status'], where: { partnerId }, _sum: { amount: true } }),
    ]);
    const sumOf = (s: PayoutStatus) => D(payouts.find((p) => p.status === s)?._sum.amount);
    const pending = sumOf('REQUESTED').add(sumOf('APPROVED'));
    const paidOut = sumOf('PAID');
    return {
      totalGross: D(all._sum.gross), totalCommission: D(all._sum.commission), totalNet: D(all._sum.net),
      jobs: all._count, unsettledNet: D(unsettled._sum.net), pendingPayouts: pending, paidOut,
      available: availableForPayout(D(all._sum.net), pending.add(paidOut)),
    };
  }

  async summary(userId: string) {
    const p = await this.partnerOf(userId);
    const b = await this.balances(this.prisma, p.id);
    const startOfToday = new Date(Date.now() - ((Date.now() + 330 * 60_000) % DAY_MS)); // IST midnight
    const [today, week] = await Promise.all([
      this.prisma.earning.aggregate({ where: { partnerId: p.id, createdAt: { gte: startOfToday } }, _sum: { net: true } }),
      this.prisma.earning.aggregate({ where: { partnerId: p.id, createdAt: { gte: new Date(Date.now() - 7 * DAY_MS) } }, _sum: { net: true } }),
    ]);
    return {
      ...b,
      todayNet: D(today._sum.net),
      last7DaysNet: D(week._sum.net),
      minPayout: minPayout(),
      canRequestPayout: b.available.gte(minPayout()),
    };
  }

  private async report(userId: string, from: Date, to: Date, keyFn: (d: Date) => string) {
    const p = await this.partnerOf(userId);
    const rows = await this.prisma.earning.findMany({
      where: { partnerId: p.id, createdAt: { gte: from, lte: to } },
      select: { gross: true, commission: true, net: true, createdAt: true },
    });
    const buckets = groupEarnings(rows, keyFn);
    return {
      from, to, buckets,
      totals: {
        jobs: buckets.reduce((s, x) => s + x.jobs, 0),
        net: Math.round(buckets.reduce((s, x) => s + x.net, 0) * 100) / 100,
      },
    };
  }

  private range(from: string | undefined, to: string | undefined, defaultDays: number) {
    const end = to ? new Date(to) : new Date();
    const start = from ? new Date(from) : new Date(end.getTime() - defaultDays * DAY_MS);
    if (start > end) throw new BadRequestException('from must be before to');
    if (end.getTime() - start.getTime() > 400 * DAY_MS) throw new BadRequestException('Range too large (max 400 days)');
    return { start, end };
  }

  daily(userId: string, from?: string, to?: string) {
    const { start, end } = this.range(from, to, 30);
    return this.report(userId, start, end, dayKey);
  }

  weekly(userId: string, from?: string, to?: string) {
    const { start, end } = this.range(from, to, 84);
    return this.report(userId, start, end, weekKey);
  }

  async analytics(userId: string, days = 30) {
    const p = await this.partnerOf(userId);
    const now = Date.now();
    const since = new Date(now - days * DAY_MS);
    const prevSince = new Date(now - 2 * days * DAY_MS);
    const [byStatus, cur, prev, series, reviews] = await Promise.all([
      this.prisma.booking.groupBy({ by: ['status'], where: { partnerId: p.id, createdAt: { gte: since } }, _count: true }),
      this.prisma.earning.aggregate({ where: { partnerId: p.id, createdAt: { gte: since } }, _sum: { net: true } }),
      this.prisma.earning.aggregate({ where: { partnerId: p.id, createdAt: { gte: prevSince, lt: since } }, _sum: { net: true } }),
      this.prisma.earning.findMany({
        where: { partnerId: p.id, createdAt: { gte: since } },
        select: { gross: true, commission: true, net: true, createdAt: true },
      }),
      this.prisma.review.count({ where: { partnerId: p.id } }),
    ]);
    const n = (s: string) => byStatus.find((x) => x.status === s)?._count ?? 0;
    const completed = n('COMPLETED');
    const cancelled = n('CANCELLED');
    // Bookings that reached a terminal state while assigned to this partner.
    const finished = completed + cancelled;
    const curNet = Number(D(cur._sum.net));
    const prevNet = Number(D(prev._sum.net));
    return {
      windowDays: days,
      completedJobs: completed,
      cancelledJobs: cancelled,
      completionRate: finished ? Math.round((completed / finished) * 1000) / 10 : null, // percent
      acceptanceRate: Math.round(p.acceptanceRate * 1000) / 10, // percent
      averageRating: p.ratingAvg,
      ratingCount: p.ratingCount,
      reviewCount: reviews,
      earnings: {
        net: curNet,
        previousNet: prevNet,
        changePct: prevNet > 0 ? Math.round(((curNet - prevNet) / prevNet) * 1000) / 10 : null,
        trend: groupEarnings(series, dayKey).map(({ period, net }) => ({ period, net })),
      },
    };
  }

  /** Creates a payout request; serialised per partner so concurrent requests can't over-draw. */
  async requestPayout(userId: string, dto: RequestPayoutDto) {
    const p = await this.partnerOf(userId);
    if (p.kycStatus !== 'APPROVED') throw new ForbiddenException('KYC must be approved to request payouts');
    if (!dto.upiId && !dto.bankAccount) throw new BadRequestException('Provide a UPI id or bank account');
    const amount = new Prisma.Decimal(dto.amount).toDecimalPlaces(2);
    const min = minPayout();
    if (amount.lt(min)) throw new BadRequestException(`Minimum payout is Rs ${min}`);

    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(tx, `payout:${p.id}`);
      const b = await this.balances(tx, p.id);
      if (amount.gt(b.available)) {
        throw new BadRequestException(`Amount exceeds available earnings (Rs ${b.available.toFixed(2)})`);
      }
      return tx.payout.create({
        data: { partnerId: p.id, amount, upiId: dto.upiId, bankAccount: dto.bankAccount },
      });
    });
  }

  async listPayouts(userId: string, status?: PayoutStatus, page = 1, limit = 20) {
    const p = await this.partnerOf(userId);
    const where = { partnerId: p.id, ...(status ? { status } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.payout.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.payout.count({ where }),
    ]);
    return { items, total, page, limit };
  }
}
