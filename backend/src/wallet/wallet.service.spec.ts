import { BadRequestException } from '@nestjs/common';
import { WalletService } from './wallet.service';

function makePrisma(updateCount: number) {
  const tx: any = {
    wallet: {
      upsert: jest.fn().mockResolvedValue({ id: 'w1' }),
      updateMany: jest.fn().mockResolvedValue({ count: updateCount }),
      update: jest.fn().mockResolvedValue({ balance: 150 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ balance: 50 }),
    },
    walletTxn: { create: jest.fn().mockResolvedValue({}) },
  };
  return { tx, prisma: { $transaction: (fn: any) => fn(tx) } as any };
}

describe('WalletService', () => {
  it('rejects debit when balance is insufficient and writes no txn', async () => {
    const { tx, prisma } = makePrisma(0);
    const svc = new WalletService(prisma);
    await expect(svc.debit('u1', 100, 'X')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.walletTxn.create).not.toHaveBeenCalled();
    expect(tx.wallet.updateMany.mock.calls[0][0].where.balance).toHaveProperty('gte');
  });

  it('debits and records txn when funds exist', async () => {
    const { tx, prisma } = makePrisma(1);
    const svc = new WalletService(prisma);
    const r = await svc.debit('u1', 100, 'X', 'ref');
    expect(r.balance).toBe(50);
    expect(tx.walletTxn.create).toHaveBeenCalledTimes(1);
  });

  it('rejects non-positive amounts', async () => {
    const { prisma } = makePrisma(1);
    const svc = new WalletService(prisma);
    await expect(svc.credit('u1', 0, 'X')).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.debit('u1', -5, 'X')).rejects.toBeInstanceOf(BadRequestException);
  });
});
