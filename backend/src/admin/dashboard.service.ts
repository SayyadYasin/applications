import { Injectable } from '@nestjs/common';
import { BookingStatus, KycStatus, TicketStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { daysAgo, startOfToday } from './admin.util';

const NOT_REVENUE: BookingStatus[] = ['PENDING_PAYMENT', 'CANCELLED', 'REJECTED'];

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  private async window(from: Date) {
    const [bookings, gmv, commission, newUsers, activePartners, refunds] = await Promise.all([
      this.prisma.booking.count({ where: { createdAt: { gte: from } } }),
      this.prisma.booking.aggregate({ _sum: { total: true }, where: { createdAt: { gte: from }, status: { notIn: NOT_REVENUE } } }),
      this.prisma.earning.aggregate({ _sum: { commission: true }, where: { createdAt: { gte: from } } }),
      this.prisma.user.count({ where: { createdAt: { gte: from } } }),
      this.prisma.partner.count({ where: { kycStatus: KycStatus.APPROVED, bookings: { some: { createdAt: { gte: from } } } } }),
      this.prisma.refund.aggregate({ _sum: { amount: true }, _count: true, where: { createdAt: { gte: from } } }),
    ]);
    return {
      bookings,
      gmv: Number(gmv._sum.total ?? 0),
      revenue: Number(commission._sum.commission ?? 0),
      newUsers,
      activePartners,
      refunds: { count: refunds._count, amount: Number(refunds._sum.amount ?? 0) },
    };
  }

  async kpis() {
    const [today, last7d, last30d, pendingKyc, openTickets, onlinePartners] = await Promise.all([
      this.window(startOfToday()),
      this.window(daysAgo(7)),
      this.window(daysAgo(30)),
      this.prisma.partner.count({ where: { kycStatus: KycStatus.SUBMITTED } }),
      this.prisma.supportTicket.count({ where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS] } } }),
      this.prisma.partner.count({ where: { kycStatus: KycStatus.APPROVED, isOnline: true } }),
    ]);
    return { today, last7d, last30d, pendingKyc, openTickets, onlinePartners, generatedAt: new Date() };
  }
}
