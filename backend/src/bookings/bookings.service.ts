import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { ChatGateway } from '../chat/chat.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { LoyaltyService } from '../loyalty-referral/loyalty.service';
import { cancellationRefund } from '../refunds/refund-policy';
import { RefundsService } from '../refunds/refunds.service';
import { BookingStatus, PaymentMethod, Prisma } from '@prisma/client';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AssignmentService } from './assignment.service';
import { CreateBookingDto } from './bookings.dto';
import { PricingService } from './pricing.service';

const DEFAULT_COMMISSION_PCT = Number(process.env.DEFAULT_COMMISSION_PCT ?? 15);
const round2 = (n: number) => Math.round(n * 100) / 100;

// Allowed transitions; anything else is rejected.
export const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING_PAYMENT: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['PARTNER_EN_ROUTE', 'CONFIRMED', 'CANCELLED'],
  PARTNER_EN_ROUTE: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

@Injectable()
export class BookingsService {
  constructor(
    private prisma: PrismaService,
    private pricing: PricingService,
    private assignment: AssignmentService,
    private refunds: RefundsService,
    private loyalty: LoyaltyService,
    @Optional() private chat?: ChatGateway,
    @Optional() private notifications?: NotificationsService,
  ) {}

  /** Realtime status event + in-app/push notifications; never throws or blocks the transition. */
  private announceStatus(bookingId: string, to: BookingStatus) {
    this.chat?.emitBookingStatus(bookingId, to);
    if (!this.notifications || !['ASSIGNED', 'COMPLETED', 'CANCELLED'].includes(to)) return;
    const n = this.notifications;
    void (async () => {
      try {
        const b = await this.prisma.booking.findUnique({
          where: { id: bookingId },
          select: { code: true, customer: { select: { userId: true } }, partner: { select: { userId: true } } },
        });
        if (!b) return;
        const data = { bookingId, status: to };
        const msg = {
          ASSIGNED: ['Partner assigned', `A partner has been assigned to booking ${b.code}.`],
          COMPLETED: ['Job completed', `Booking ${b.code} is complete. Thank you!`],
          CANCELLED: ['Booking cancelled', `Booking ${b.code} was cancelled.`],
        }[to as 'ASSIGNED' | 'COMPLETED' | 'CANCELLED'];
        await n.notify(b.customer.userId, { title: msg[0], body: msg[1], data });
        if (b.partner) {
          await n.notify(b.partner.userId, {
            title: to === 'ASSIGNED' ? 'New job assigned' : msg[0],
            body: to === 'ASSIGNED' ? `You have a new job: booking ${b.code}.` : msg[1],
            data,
          });
        }
      } catch (e) {
        this.log.warn(`Status notification failed for ${bookingId}: ${(e as Error).message}`);
      }
    })();
  }

  private log = new Logger(BookingsService.name);

  private async setStatus(
    tx: Prisma.TransactionClient | PrismaService,
    id: string,
    from: BookingStatus,
    to: BookingStatus,
    data: Prisma.BookingUpdateInput = {},
  ) {
    if (!TRANSITIONS[from].includes(to)) throw new BadRequestException(`Cannot go from ${from} to ${to}`);
    // Conditional update guards against concurrent transitions.
    const res = await tx.booking.updateMany({ where: { id, status: from }, data: { ...(data as any), status: to } });
    if (!res.count) throw new BadRequestException('Booking changed concurrently, retry');
    await tx.bookingStatusLog.create({ data: { bookingId: id, status: to } });
    this.announceStatus(id, to);
  }

  async create(userId: string, dto: CreateBookingDto) {
    const customer = await this.prisma.customer.findUniqueOrThrow({ where: { userId }, include: { membership: true } });
    const address = await this.prisma.address.findFirst({ where: { id: dto.addressId, userId } });
    if (!address) throw new NotFoundException('Address not found');

    const at = dto.isInstant ? new Date() : new Date(dto.scheduledAt);
    if (!dto.isInstant && at.getTime() < Date.now() + 30 * 60_000) {
      throw new BadRequestException('Schedule at least 30 minutes ahead');
    }

    const membershipActive = customer.membership && customer.membershipEnds && customer.membershipEnds > new Date();
    const quote = await this.pricing.quote({
      serviceId: dto.serviceId,
      at,
      couponCode: dto.couponCode,
      userId,
      membershipDiscountPct: membershipActive ? customer.membership!.discountPct : 0,
    });

    const booking = await this.prisma.booking.create({
      data: {
        code: `TS${Date.now().toString(36).toUpperCase()}${randomInt(100, 999)}`,
        customerId: customer.id,
        serviceId: dto.serviceId,
        addressId: address.id,
        isInstant: !!dto.isInstant,
        scheduledAt: at,
        basePrice: quote.basePrice,
        surgeAmount: quote.surgeAmount,
        discount: quote.discount,
        taxAmount: quote.taxAmount,
        total: quote.total,
        couponId: quote.couponId,
        paymentMethod: dto.paymentMethod,
        completionOtp: String(randomInt(1000, 10000)),
        statusLog: { create: { status: BookingStatus.PENDING_PAYMENT } },
      },
    });
    if (quote.couponId) await this.prisma.coupon.update({ where: { id: quote.couponId }, data: { usedCount: { increment: 1 } } });

    // Cash and wallet bookings are confirmed immediately; online ones wait for the payment webhook.
    if (dto.paymentMethod === PaymentMethod.CASH) await this.confirm(booking.id, dto.preferredPartnerId);
    return this.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
  }

  /** PENDING_PAYMENT -> CONFIRMED -> ASSIGNED (auto-assign best partner if one is available). */
  async confirm(bookingId: string, preferredPartnerId?: string) {
    const b = await this.prisma.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { service: true, address: true },
    });
    await this.setStatus(this.prisma, b.id, b.status, BookingStatus.CONFIRMED);
    await this.autoAssign(b.id, preferredPartnerId);
  }

  async autoAssign(bookingId: string, preferredPartnerId?: string, excludePartnerIds: string[] = []) {
    const b = await this.prisma.booking.findUniqueOrThrow({ where: { id: bookingId }, include: { service: true, address: true } });
    const ranked = (await this.assignment.rank({
      serviceId: b.serviceId,
      lat: b.address.lat,
      lng: b.address.lng,
      at: b.scheduledAt,
      durationMin: b.service.durationMin,
      preferredPartnerId,
    })).filter((r) => !excludePartnerIds.includes(r.partnerId));
    if (!ranked.length) return null; // stays CONFIRMED; admin/cron retries
    await this.setStatus(this.prisma, b.id, BookingStatus.CONFIRMED, BookingStatus.ASSIGNED, {
      partner: { connect: { id: ranked[0].partnerId } },
    });
    return ranked[0].partnerId;
  }

  private async ownedByCustomer(userId: string, id: string) {
    const b = await this.prisma.booking.findFirst({ where: { id, customer: { userId } } });
    if (!b) throw new NotFoundException('Booking not found');
    return b;
  }

  private async ownedByPartner(userId: string, id: string) {
    const b = await this.prisma.booking.findFirst({ where: { id, partner: { userId } } });
    if (!b) throw new NotFoundException('Booking not found');
    return b;
  }

  async listForUser(userId: string, role: string) {
    return this.prisma.booking.findMany({
      where: role === 'PARTNER' ? { partner: { userId } } : { customer: { userId } },
      orderBy: { scheduledAt: 'desc' },
      include: { service: true, partner: { include: { user: { select: { name: true, phone: true } } } } },
      take: 100,
    });
  }

  async get(userId: string, role: string, id: string) {
    const b = await this.prisma.booking.findUnique({
      where: { id },
      include: { service: true, address: true, statusLog: { orderBy: { at: 'asc' } }, customer: true, partner: true },
    });
    if (!b) throw new NotFoundException();
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    if (!isAdmin && b.customer.userId !== userId && b.partner?.userId !== userId) throw new ForbiddenException();
    // Completion OTP is only for the customer.
    if (b.customer.userId !== userId) b.completionOtp = null;
    return b;
  }

  async cancel(userId: string, id: string, reason?: string) {
    const b = await this.ownedByCustomer(userId, id);
    if (b.status === 'PARTNER_EN_ROUTE' || b.status === 'IN_PROGRESS') {
      throw new BadRequestException('Cannot cancel once the partner is on the way; contact support');
    }
    await this.setStatus(this.prisma, id, b.status, BookingStatus.CANCELLED, { cancelReason: reason });
    // Refund per cancellation policy (100% if >2h before schedule, else 50%) when a payment exists.
    let refund: { amount: string; pct: number } | null = null;
    try {
      const paid = await this.prisma.payment.findFirst({
        where: { bookingId: id, status: { in: ['PAID', 'PARTIALLY_REFUNDED'] } },
        orderBy: { createdAt: 'desc' },
      });
      if (paid) {
        const { pct, amount } = cancellationRefund(paid.amount, b.scheduledAt);
        const refundable = paid.amount.sub(paid.refundedAmount);
        const amt = amount.gt(refundable) ? refundable : amount;
        if (amt.gt(0)) {
          await this.refunds.refund(id, amt, reason ? `Booking cancelled: ${reason}` : 'Booking cancelled');
          refund = { amount: amt.toFixed(2), pct };
        }
      }
    } catch (e) {
      this.log.error(`Refund failed for cancelled booking ${id}: ${(e as Error).message}`);
      return { cancelled: true, refund: null, refundPending: true };
    }
    return { cancelled: true, refund };
  }

  async reschedule(userId: string, id: string, scheduledAt: string) {
    const b = await this.ownedByCustomer(userId, id);
    const at = new Date(scheduledAt);
    if (!['CONFIRMED', 'ASSIGNED'].includes(b.status)) throw new BadRequestException('Cannot reschedule now');
    if (at.getTime() < Date.now() + 30 * 60_000) throw new BadRequestException('Schedule at least 30 minutes ahead');
    await this.prisma.booking.update({ where: { id }, data: { scheduledAt: at, rescheduledFrom: b.scheduledAt } });
    // Partner may be busy at the new time: release and re-run assignment.
    if (b.status === 'ASSIGNED') {
      await this.prisma.booking.update({ where: { id }, data: { partner: { disconnect: true } } });
      await this.setStatus(this.prisma, id, BookingStatus.ASSIGNED, BookingStatus.CONFIRMED);
      await this.autoAssign(id);
    }
    return this.prisma.booking.findUniqueOrThrow({ where: { id } });
  }

  // ---- Partner actions ----

  async reject(userId: string, id: string) {
    const b = await this.ownedByPartner(userId, id);
    if (b.status !== 'ASSIGNED') throw new BadRequestException('Only assigned jobs can be rejected');
    const rejected = b.partnerId!;
    await this.prisma.booking.update({ where: { id }, data: { partner: { disconnect: true } } });
    await this.setStatus(this.prisma, id, BookingStatus.ASSIGNED, BookingStatus.CONFIRMED);
    await this.autoAssign(id, undefined, [rejected]);
    return { rejected: true };
  }

  async depart(userId: string, id: string) {
    const b = await this.ownedByPartner(userId, id);
    await this.setStatus(this.prisma, id, b.status, BookingStatus.PARTNER_EN_ROUTE);
    return { status: 'PARTNER_EN_ROUTE' };
  }

  async start(userId: string, id: string) {
    const b = await this.ownedByPartner(userId, id);
    await this.setStatus(this.prisma, id, b.status, BookingStatus.IN_PROGRESS, { startedAt: new Date() });
    return { status: 'IN_PROGRESS' };
  }

  /** Completion requires the customer's OTP, then books earning (net of commission) and the GST invoice. */
  async complete(userId: string, id: string, otp: string) {
    const b = await this.prisma.booking.findFirst({ where: { id, partner: { userId } }, include: { partner: true } });
    if (!b) throw new NotFoundException('Booking not found');
    if (b.completionOtp !== otp) throw new BadRequestException('Incorrect completion OTP');

    return this.prisma.$transaction(async (tx) => {
      await this.setStatus(tx, id, b.status, BookingStatus.COMPLETED, { completedAt: new Date() });
      const taxable = round2(Number(b.total) - Number(b.taxAmount));
      const pct = b.partner!.commissionPct ?? DEFAULT_COMMISSION_PCT;
      const commission = round2((taxable * pct) / 100);
      await tx.earning.create({
        data: { partnerId: b.partnerId!, bookingId: id, gross: taxable, commission, net: round2(taxable - commission) },
      });
      await tx.partner.update({ where: { id: b.partnerId! }, data: { completedJobs: { increment: 1 } } });
      await this.loyalty.award(b.customerId, id, tx);
      const half = round2(Number(b.taxAmount) / 2);
      await tx.invoice.create({
        data: {
          number: `INV-${new Date().getFullYear()}-${b.code}`,
          bookingId: id,
          taxableValue: taxable,
          cgst: half,
          sgst: round2(Number(b.taxAmount) - half),
          total: b.total,
        },
      });
      return { status: 'COMPLETED' };
    });
  }
}
