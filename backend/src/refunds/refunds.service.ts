import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getRazorpay, toMoney, toPaise } from '../wallet/razorpay.util';
import { WalletService } from '../wallet/wallet.service';
import { cancellationRefund } from './refund-policy';

const REFUNDABLE = [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED];

@Injectable()
export class RefundsService {
  private log = new Logger(RefundsService.name);

  constructor(private prisma: PrismaService, private wallet: WalletService) {}

  /** What a customer would get back if they cancelled this booking right now. */
  async previewCancellation(userId: string, bookingId: string) {
    const b = await this.prisma.booking.findFirst({
      where: { id: bookingId, customer: { userId } },
      include: { payments: { where: { status: { in: REFUNDABLE } } } },
    });
    if (!b) throw new NotFoundException('Booking not found');
    const paid = b.payments[0];
    if (!paid) return { pct: 0, amount: new Prisma.Decimal(0) };
    return cancellationRefund(paid.amount, b.scheduledAt);
  }

  /**
   * Refunds `amount` of the booking's paid payment. Online payments go back to Razorpay;
   * CASH/WALLET payments (and online ones without a gateway id) are credited to the customer's wallet.
   * Returns null if there is nothing paid to refund.
   */
  async refund(bookingId: string, amount: Prisma.Decimal | number | string, reason: string) {
    const amt = toMoney(amount);
    const payment = await this.prisma.payment.findFirst({
      where: { bookingId, status: { in: REFUNDABLE } },
      orderBy: { createdAt: 'desc' },
      include: { booking: { include: { customer: true } } },
    });
    if (!payment) return null;

    const refundable = payment.amount.sub(payment.refundedAmount);
    if (amt.gt(refundable)) throw new BadRequestException(`Refund exceeds refundable balance (${refundable.toFixed(2)})`);

    const newRefunded = payment.refundedAmount.add(amt);
    const newStatus = newRefunded.gte(payment.amount) ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
    const reserve = (db: Prisma.TransactionClient) =>
      db.payment.updateMany({
        // Optimistic guard: fails if a concurrent refund changed refundedAmount.
        where: { id: payment.id, refundedAmount: payment.refundedAmount },
        data: { refundedAmount: newRefunded, status: newStatus },
      });
    const conflict = () => new BadRequestException('Payment was modified concurrently, retry');

    const viaGateway =
      (payment.method === PaymentMethod.ONLINE || payment.method === PaymentMethod.UPI) && !!payment.razorpayPaymentId;

    if (!viaGateway) {
      const userId = payment.booking.customer.userId;
      return this.prisma.$transaction(async (tx) => {
        if (!(await reserve(tx)).count) throw conflict();
        await this.wallet.credit(userId, amt, 'REFUND', bookingId, tx);
        return tx.refund.create({ data: { paymentId: payment.id, amount: amt, reason, status: 'PROCESSED' } });
      });
    }

    // Gateway path: reserve first so concurrent calls can't double-refund, then call Razorpay.
    if (!(await reserve(this.prisma)).count) throw conflict();
    let rzpRefundId: string | undefined;
    try {
      const r: any = await getRazorpay().payments.refund(payment.razorpayPaymentId!, {
        amount: toPaise(amt),
        notes: { bookingId, reason: reason.slice(0, 200) },
      });
      rzpRefundId = r.id;
    } catch (e) {
      await this.prisma.payment.updateMany({
        where: { id: payment.id },
        data: { refundedAmount: { decrement: amt }, status: payment.status },
      });
      this.log.error(`Razorpay refund failed for booking ${bookingId}: ${JSON.stringify((e as any)?.error ?? (e as Error).message)}`);
      throw new BadGatewayException('Refund could not be processed by the payment gateway');
    }
    return this.prisma.refund.create({
      data: { paymentId: payment.id, amount: amt, reason, status: 'PROCESSED', razorpayRefundId: rzpRefundId },
    });
  }
}
