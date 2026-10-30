import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, TxnType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toMoney } from './razorpay.util';

type Db = Prisma.TransactionClient;

@Injectable()
export class WalletService {
  constructor(private prisma: PrismaService) {}

  private run<T>(tx: Db | undefined, fn: (db: Db) => Promise<T>): Promise<T> {
    return tx ? fn(tx) : this.prisma.$transaction(fn);
  }

  private ensureWallet(db: Db, userId: string) {
    return db.wallet.upsert({ where: { userId }, update: {}, create: { userId } });
  }

  async getBalance(userId: string) {
    const w = await this.prisma.wallet.findUnique({ where: { userId } });
    return { balance: w?.balance ?? new Prisma.Decimal(0), currency: 'INR' };
  }

  async transactions(userId: string, page = 1, limit = 20) {
    const where = { wallet: { userId } };
    const [items, total] = await Promise.all([
      this.prisma.walletTxn.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.walletTxn.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  /** Adds money to a wallet. Pass `tx` to join an existing transaction. */
  async credit(userId: string, amount: Prisma.Decimal | number | string, reason: string, refId?: string, tx?: Db) {
    const amt = toMoney(amount);
    return this.run(tx, async (db) => {
      const w = await this.ensureWallet(db, userId);
      const updated = await db.wallet.update({ where: { id: w.id }, data: { balance: { increment: amt } } });
      await db.walletTxn.create({ data: { walletId: w.id, type: TxnType.CREDIT, amount: amt, reason, refId } });
      return { balance: updated.balance };
    });
  }

  /** Removes money atomically; the conditional update guarantees the balance never goes negative. */
  async debit(userId: string, amount: Prisma.Decimal | number | string, reason: string, refId?: string, tx?: Db) {
    const amt = toMoney(amount);
    return this.run(tx, async (db) => {
      const w = await this.ensureWallet(db, userId);
      const res = await db.wallet.updateMany({
        where: { id: w.id, balance: { gte: amt } },
        data: { balance: { decrement: amt } },
      });
      if (!res.count) throw new BadRequestException('Insufficient wallet balance');
      await db.walletTxn.create({ data: { walletId: w.id, type: TxnType.DEBIT, amount: amt, reason, refId } });
      const after = await db.wallet.findUniqueOrThrow({ where: { id: w.id } });
      return { balance: after.balance };
    });
  }

  /** True if a txn with this reason/refId was already recorded (for idempotent callers). */
  async hasTxn(db: Db | PrismaService, userId: string, reason: string, refId: string) {
    return !!(await db.walletTxn.findFirst({ where: { wallet: { userId }, reason, refId }, select: { id: true } }));
  }
}
