import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { advisoryLock } from '../wallet/razorpay.util';
import { WalletService } from '../wallet/wallet.service';

export const POINTS_PER_RUPEES = 10; // 1 point per Rs 10 of taxable amount
export const POINTS_PER_REDEEM_UNIT = 100; // 100 points ...
export const RUPEES_PER_REDEEM_UNIT = 10; // ... = Rs 10

type Db = Prisma.TransactionClient;

export function pointsForTaxable(taxable: Prisma.Decimal | number): number {
  return new Prisma.Decimal(taxable).div(POINTS_PER_RUPEES).floor().toNumber();
}

@Injectable()
export class LoyaltyService {
  constructor(private prisma: PrismaService, private wallet: WalletService) {}

  private referralBonus() { return Number(process.env.REFERRAL_BONUS ?? 100); }

  /**
   * Awards loyalty points for a completed booking (idempotent) and, on the customer's first completed
   * booking, pays the referral bonus to referrer and referee. Pass the completion `tx` to stay atomic.
   */
  async award(customerId: string, bookingId: string, tx?: Db) {
    const run = async (db: Db) => {
      const reason = `BOOKING:${bookingId}`;
      await advisoryLock(db, `loyalty:${bookingId}`);
      if (await db.loyaltyTxn.findFirst({ where: { customerId, reason }, select: { id: true } })) return { points: 0 };

      const b = await db.booking.findUniqueOrThrow({
        where: { id: bookingId },
        include: { customer: { include: { user: true } } },
      });
      if (b.customerId !== customerId) throw new BadRequestException('Booking does not belong to customer');

      const points = pointsForTaxable(b.total.sub(b.taxAmount));
      if (points > 0) {
        await db.customer.update({ where: { id: customerId }, data: { loyaltyPoints: { increment: points } } });
        await db.loyaltyTxn.create({ data: { customerId, points, reason } });
      }
      await this.maybePayReferral(db, b.customer.user.id, b.customer.user.referredById, customerId);
      return { points };
    };
    return tx ? run(tx) : this.prisma.$transaction(run);
  }

  private async maybePayReferral(db: Db, refereeUserId: string, referrerUserId: string | null, customerId: string) {
    const bonus = this.referralBonus();
    if (!referrerUserId || !(bonus > 0)) return;
    const completed = await db.booking.count({ where: { customerId, status: 'COMPLETED' } });
    if (completed !== 1) return; // only the first completed booking qualifies
    if (await this.wallet.hasTxn(db, refereeUserId, 'REFERRAL_BONUS', refereeUserId)) return;
    await this.wallet.credit(referrerUserId, bonus, 'REFERRAL_BONUS', refereeUserId, db);
    await this.wallet.credit(refereeUserId, bonus, 'REFERRAL_BONUS', refereeUserId, db);
  }

  async summary(userId: string) {
    const c = await this.prisma.customer.findUniqueOrThrow({ where: { userId } });
    const history = await this.prisma.loyaltyTxn.findMany({ where: { customerId: c.id }, orderBy: { createdAt: 'desc' }, take: 50 });
    return {
      points: c.loyaltyPoints,
      redeemableValue: Math.floor(c.loyaltyPoints / POINTS_PER_REDEEM_UNIT) * RUPEES_PER_REDEEM_UNIT,
      rule: { earn: `1 point per Rs ${POINTS_PER_RUPEES} of taxable amount`, redeem: `${POINTS_PER_REDEEM_UNIT} points = Rs ${RUPEES_PER_REDEEM_UNIT}` },
      history,
    };
  }

  /** Converts points (multiples of 100) to wallet balance atomically. */
  async redeem(userId: string, points: number) {
    if (!Number.isInteger(points) || points < POINTS_PER_REDEEM_UNIT || points % POINTS_PER_REDEEM_UNIT !== 0) {
      throw new BadRequestException(`Points must be a multiple of ${POINTS_PER_REDEEM_UNIT}`);
    }
    const rupees = (points / POINTS_PER_REDEEM_UNIT) * RUPEES_PER_REDEEM_UNIT;
    return this.prisma.$transaction(async (tx) => {
      const c = await tx.customer.findUniqueOrThrow({ where: { userId } });
      const res = await tx.customer.updateMany({
        where: { id: c.id, loyaltyPoints: { gte: points } },
        data: { loyaltyPoints: { decrement: points } },
      });
      if (!res.count) throw new BadRequestException('Not enough loyalty points');
      await tx.loyaltyTxn.create({ data: { customerId: c.id, points: -points, reason: 'REDEEM_TO_WALLET' } });
      const { balance } = await this.wallet.credit(userId, rupees, 'LOYALTY_REDEEM', c.id, tx);
      return { redeemedPoints: points, credited: rupees, walletBalance: balance };
    });
  }

  async referralStats(userId: string) {
    const [user, count, earned] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } }),
      this.prisma.user.count({ where: { referredById: userId } }),
      this.prisma.walletTxn.aggregate({
        where: { wallet: { userId }, reason: 'REFERRAL_BONUS' },
        _sum: { amount: true },
        _count: true,
      }),
    ]);
    return {
      referralCode: user.referralCode,
      referredCount: count,
      rewardedCount: earned._count,
      totalEarned: earned._sum.amount ?? new Prisma.Decimal(0),
      bonusPerReferral: this.referralBonus(),
    };
  }
}
