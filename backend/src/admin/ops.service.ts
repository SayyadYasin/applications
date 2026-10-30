import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, KycStatus, Prisma } from '@prisma/client';
import { BookingsService } from '../bookings/bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { RefundsService } from '../refunds/refunds.service';
import { ListBookingsDto, ListPartnersDto, ListPaymentsDto, ManualRefundDto, PageQueryDto } from './admin.dto';
import { dateFilter, pageArgs, paged } from './admin.util';
import { AuditService } from './audit.service';

/** Partners, bookings and payments admin operations. */
@Injectable()
export class OpsAdminService {
  constructor(
    private prisma: PrismaService,
    private audit: AuditService,
    private bookings: BookingsService,
    private refunds: RefundsService,
  ) {}

  // ---------- partners ----------
  async listPartners(q: ListPartnersDto) {
    const p = pageArgs(q);
    const where: Prisma.PartnerWhereInput = {
      ...(q.kycStatus && { kycStatus: q.kycStatus }),
      ...(q.q && {
        user: {
          OR: [
            { name: { contains: q.q, mode: 'insensitive' } },
            { email: { contains: q.q, mode: 'insensitive' } },
            { phone: { contains: q.q } },
          ],
        },
      }),
    };
    const [items, total] = await Promise.all([
      this.prisma.partner.findMany({
        where, take: p.take, skip: p.skip, orderBy: { ratingAvg: 'desc' },
        include: { user: { select: { id: true, name: true, email: true, phone: true, isActive: true } } },
      }),
      this.prisma.partner.count({ where }),
    ]);
    return paged(items, total, p);
  }

  async getPartner(id: string) {
    const partner = await this.prisma.partner.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, isActive: true, townId: true } },
        documents: true,
        services: { include: { service: true } },
        availability: true,
      },
    });
    if (!partner) throw new NotFoundException('Partner not found');
    const [earn, pending] = await Promise.all([
      this.prisma.earning.aggregate({ where: { partnerId: id }, _sum: { gross: true, commission: true, net: true } }),
      this.prisma.payout.aggregate({ where: { partnerId: id, status: { in: ['REQUESTED', 'APPROVED'] } }, _sum: { amount: true } }),
    ]);
    return {
      ...partner,
      earningsSummary: {
        gross: Number(earn._sum.gross ?? 0),
        commission: Number(earn._sum.commission ?? 0),
        net: Number(earn._sum.net ?? 0),
        pendingPayouts: Number(pending._sum.amount ?? 0),
      },
    };
  }

  async setCommission(actorId: string, id: string, pct: number | null) {
    const before = await this.prisma.partner.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Partner not found');
    const updated = await this.prisma.partner.update({ where: { id }, data: { commissionPct: pct } });
    await this.audit.record(actorId, 'PARTNER_SET_COMMISSION', 'Partner', id, { from: before.commissionPct, to: pct });
    return updated;
  }

  // ---------- bookings ----------
  async listBookings(q: ListBookingsDto) {
    const p = pageArgs(q);
    const where: Prisma.BookingWhereInput = {
      ...(q.status && { status: q.status }),
      ...(q.partnerId && { partnerId: q.partnerId }),
      ...(q.customerId && { customerId: q.customerId }),
      ...(q.townId && { customer: { user: { townId: q.townId } } }),
      ...(dateFilter(q.from, q.to) && { scheduledAt: dateFilter(q.from, q.to) }),
    };
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({
        where, take: p.take, skip: p.skip, orderBy: { createdAt: 'desc' },
        select: {
          id: true, code: true, status: true, scheduledAt: true, total: true, paymentMethod: true, createdAt: true,
          service: { select: { id: true, name: true } },
          partner: { select: { id: true, user: { select: { name: true } } } },
          customer: { select: { id: true, user: { select: { name: true, phone: true, townId: true } } } },
        },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return paged(items, total, p);
  }

  async getBooking(id: string) {
    const b = await this.prisma.booking.findUnique({
      where: { id },
      include: {
        service: true, address: true, coupon: true, payments: true, invoice: true, earning: true, review: true,
        statusLog: { orderBy: { at: 'asc' } },
        customer: { include: { user: { select: { id: true, name: true, email: true, phone: true } } } },
        partner: { include: { user: { select: { id: true, name: true, email: true, phone: true } } } },
      },
    });
    if (!b) throw new NotFoundException('Booking not found');
    return { ...b, completionOtp: undefined };
  }

  async forceAssign(actorId: string, id: string, partnerId: string) {
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Booking not found');
    if (b.status !== BookingStatus.CONFIRMED && b.status !== BookingStatus.ASSIGNED) {
      throw new BadRequestException(`Cannot assign a booking in ${b.status}`);
    }
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId } });
    if (!partner || partner.kycStatus !== KycStatus.APPROVED) throw new BadRequestException('Partner not found or KYC not approved');

    const res = await this.prisma.booking.updateMany({
      where: { id, status: b.status },
      data: { partnerId, status: BookingStatus.ASSIGNED },
    });
    if (!res.count) throw new BadRequestException('Booking changed concurrently, retry');
    await this.prisma.bookingStatusLog.create({ data: { bookingId: id, status: BookingStatus.ASSIGNED } });
    await this.audit.record(actorId, 'BOOKING_FORCE_ASSIGN', 'Booking', id, { from: b.partnerId, to: partnerId });
    return this.prisma.booking.findUniqueOrThrow({ where: { id } });
  }

  async forceCancel(actorId: string, id: string, reason?: string) {
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b) throw new NotFoundException('Booking not found');
    if (b.status === BookingStatus.COMPLETED || b.status === BookingStatus.CANCELLED || b.status === BookingStatus.REJECTED) {
      throw new BadRequestException(`Booking is already ${b.status}`);
    }
    const res = await this.prisma.booking.updateMany({
      where: { id, status: b.status },
      data: { status: BookingStatus.CANCELLED, cancelReason: reason ?? 'Cancelled by admin' },
    });
    if (!res.count) throw new BadRequestException('Booking changed concurrently, retry');
    await this.prisma.bookingStatusLog.create({ data: { bookingId: id, status: BookingStatus.CANCELLED } });
    await this.audit.record(actorId, 'BOOKING_FORCE_CANCEL', 'Booking', id, { reason, previous: b.status });
    return { cancelled: true };
  }

  async triggerAutoAssign(actorId: string, id: string, preferredPartnerId?: string) {
    const partnerId = await this.bookings.autoAssign(id, preferredPartnerId);
    await this.audit.record(actorId, 'BOOKING_AUTO_ASSIGN', 'Booking', id, { partnerId });
    return { assigned: !!partnerId, partnerId };
  }

  // ---------- payments ----------
  async listPayments(q: ListPaymentsDto) {
    const p = pageArgs(q);
    const where: Prisma.PaymentWhereInput = {
      ...(q.status && { status: q.status }),
      ...(q.method && { method: q.method }),
      ...(q.bookingId && { bookingId: q.bookingId }),
      ...(dateFilter(q.from, q.to) && { createdAt: dateFilter(q.from, q.to) }),
    };
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where, take: p.take, skip: p.skip, orderBy: { createdAt: 'desc' },
        include: { booking: { select: { code: true, status: true } } },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return paged(items, total, p);
  }

  async listRefunds(q: PageQueryDto) {
    const p = pageArgs(q);
    const [items, total] = await Promise.all([
      this.prisma.refund.findMany({ take: p.take, skip: p.skip, orderBy: { createdAt: 'desc' } }),
      this.prisma.refund.count(),
    ]);
    return paged(items, total, p);
  }

  async manualRefund(actorId: string, dto: ManualRefundDto) {
    const result = await this.refunds.refund(dto.bookingId, dto.amount, dto.reason);
    await this.audit.record(actorId, 'REFUND_MANUAL', 'Booking', dto.bookingId, { amount: dto.amount, reason: dto.reason });
    return result;
  }
}
