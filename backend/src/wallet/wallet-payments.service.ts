import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { BookingsService } from '../bookings/bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { advisoryLock, getRazorpay, toMoney, toPaise, verifyCheckoutSignature } from './razorpay.util';
import { WalletService } from './wallet.service';

const TOPUP = 'WALLET_TOPUP';

@Injectable()
export class WalletPaymentsService {
  private log = new Logger(WalletPaymentsService.name);

  // BookingsService is resolved lazily to avoid a module cycle (Bookings -> Refunds -> Wallet -> Bookings).
  constructor(private prisma: PrismaService, private wallet: WalletService, private moduleRef: ModuleRef) {}

  async createTopUpOrder(userId: string, amount: number) {
    const amt = toMoney(amount);
    const order = await getRazorpay().orders.create({
      amount: toPaise(amt),
      currency: 'INR',
      receipt: `wt_${Date.now().toString(36)}`,
      notes: { purpose: TOPUP, userId },
    });
    return { orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID };
  }

  async verifyTopUp(userId: string, orderId: string, paymentId: string, signature: string) {
    if (!verifyCheckoutSignature(orderId, paymentId, signature)) throw new BadRequestException('Invalid payment signature');
    const order: any = await getRazorpay().orders.fetch(orderId);
    if (order.notes?.purpose !== TOPUP || order.notes?.userId !== userId) throw new ForbiddenException('Order does not belong to you');
    if (order.status !== 'paid') throw new BadRequestException('Payment not completed');
    const amount = toMoney(Number(order.amount_paid) / 100);

    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(tx, `topup:${paymentId}`);
      if (await this.wallet.hasTxn(tx, userId, 'TOPUP', paymentId)) {
        return { credited: false, ...(await this.wallet.getBalance(userId)) }; // idempotent replay
      }
      const { balance } = await this.wallet.credit(userId, amount, 'TOPUP', paymentId, tx);
      return { credited: true, balance };
    });
  }

  /** Pays a PENDING_PAYMENT booking from the customer's wallet and confirms it. */
  async payBooking(userId: string, bookingId: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id: bookingId, customer: { userId } } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'PENDING_PAYMENT') throw new BadRequestException('Booking is not awaiting payment');
    if (booking.paymentMethod !== PaymentMethod.WALLET) throw new BadRequestException('Booking was not created with wallet payment');

    const result = await this.prisma.$transaction(async (tx) => {
      await advisoryLock(tx, `paybooking:${bookingId}`);
      const paid = await tx.payment.findFirst({ where: { bookingId, status: PaymentStatus.PAID } });
      if (paid) throw new BadRequestException('Booking already paid');
      const { balance } = await this.wallet.debit(userId, booking.total, 'BOOKING_PAYMENT', bookingId, tx);
      await tx.payment.create({
        data: { bookingId, method: PaymentMethod.WALLET, status: PaymentStatus.PAID, amount: booking.total },
      });
      return { balance };
    });

    try {
      await this.moduleRef.get(BookingsService, { strict: false }).confirm(bookingId);
    } catch (e) {
      this.log.error(`Wallet paid but confirm failed for ${bookingId}: ${(e as Error).message}`);
    }
    return { paid: true, balance: result.balance };
  }
}
