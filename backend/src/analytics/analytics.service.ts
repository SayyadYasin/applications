import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { normalizeRaw } from '../admin/admin.util';
import { PrismaService } from '../prisma/prisma.service';

type Gran = 'day' | 'week' | 'month';
// Whitelist: date_trunc unit is inlined (a bound parameter would break GROUP BY matching).
const UNIT: Record<Gran, Prisma.Sql> = {
  day: Prisma.raw(`'day'`),
  week: Prisma.raw(`'week'`),
  month: Prisma.raw(`'month'`),
};

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  private range(from?: string, to?: string) {
    return {
      from: from ? new Date(from) : new Date(Date.now() - 30 * 86_400_000),
      to: to ? new Date(to) : new Date(),
    };
  }

  async revenueSeries(g: Gran = 'day', fromS?: string, toS?: string) {
    const { from, to } = this.range(fromS, toS);
    const u = UNIT[g] ?? UNIT.day;
    const [gmv, commission] = await Promise.all([
      this.prisma.$queryRaw`
        SELECT date_trunc(${u}, "createdAt") AS bucket, COUNT(*) AS bookings, COALESCE(SUM(total),0) AS gmv
        FROM "Booking"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
          AND status NOT IN ('PENDING_PAYMENT','CANCELLED','REJECTED')
        GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw`
        SELECT date_trunc(${u}, "createdAt") AS bucket, COALESCE(SUM(commission),0) AS commission
        FROM "Earning"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
        GROUP BY 1 ORDER BY 1`,
    ]);
    const comm = new Map(normalizeRaw<{ bucket: Date; commission: number }>(commission as unknown[]).map((r) => [r.bucket.toISOString(), r.commission]));
    return normalizeRaw<{ bucket: Date; bookings: number; gmv: number }>(gmv as unknown[]).map((r) => ({
      bucket: r.bucket, bookings: r.bookings, gmv: r.gmv, revenue: comm.get(r.bucket.toISOString()) ?? 0,
    }));
  }

  async bookingsByStatus(fromS?: string, toS?: string) {
    const { from, to } = this.range(fromS, toS);
    const rows = await this.prisma.booking.groupBy({
      by: ['status'], _count: { _all: true }, where: { createdAt: { gte: from, lte: to } },
    });
    return rows.map((r) => ({ status: r.status, count: r._count._all }));
  }

  async topServices(limit = 10, fromS?: string, toS?: string) {
    const { from, to } = this.range(fromS, toS);
    const rows = await this.prisma.booking.groupBy({
      by: ['serviceId'], _count: { _all: true }, _sum: { total: true },
      where: { status: 'COMPLETED', createdAt: { gte: from, lte: to } },
      orderBy: { _count: { serviceId: 'desc' } }, take: limit,
    });
    const names = await this.prisma.service.findMany({ where: { id: { in: rows.map((r) => r.serviceId) } }, select: { id: true, name: true } });
    return rows.map((r) => ({
      serviceId: r.serviceId, name: names.find((n) => n.id === r.serviceId)?.name ?? null,
      bookings: r._count._all, gmv: Number(r._sum.total ?? 0),
    }));
  }

  async topPartners(limit = 10, fromS?: string, toS?: string) {
    const { from, to } = this.range(fromS, toS);
    const rows = await this.prisma.booking.groupBy({
      by: ['partnerId'], _count: { _all: true }, _sum: { total: true },
      where: { status: 'COMPLETED', partnerId: { not: null }, createdAt: { gte: from, lte: to } },
      orderBy: { _count: { partnerId: 'desc' } }, take: limit,
    });
    const partners = await this.prisma.partner.findMany({
      where: { id: { in: rows.map((r) => r.partnerId!) } },
      select: { id: true, ratingAvg: true, user: { select: { name: true } } },
    });
    return rows.map((r) => {
      const p = partners.find((x) => x.id === r.partnerId);
      return { partnerId: r.partnerId, name: p?.user.name ?? null, rating: p?.ratingAvg ?? null, jobs: r._count._all, gmv: Number(r._sum.total ?? 0) };
    });
  }

  async categoryMix(fromS?: string, toS?: string) {
    const { from, to } = this.range(fromS, toS);
    return normalizeRaw(await this.prisma.$queryRaw`
      SELECT c.id AS "categoryId", c.slug, c.name, COUNT(*) AS bookings, COALESCE(SUM(b.total),0) AS gmv
      FROM "Booking" b
      JOIN "Service" s ON s.id = b."serviceId"
      JOIN "ServiceSubCategory" sc ON sc.id = s."subCategoryId"
      JOIN "ServiceCategory" c ON c.id = sc."categoryId"
      WHERE b.status = 'COMPLETED' AND b."createdAt" >= ${from} AND b."createdAt" <= ${to}
      GROUP BY c.id, c.slug, c.name ORDER BY bookings DESC`);
  }

  async townPerformance(fromS?: string, toS?: string) {
    const { from, to } = this.range(fromS, toS);
    return normalizeRaw(await this.prisma.$queryRaw`
      SELECT t.id AS "townId", t.name AS town, COUNT(*) AS bookings,
             COUNT(*) FILTER (WHERE b.status = 'COMPLETED') AS completed,
             COUNT(*) FILTER (WHERE b.status = 'CANCELLED') AS cancelled,
             COALESCE(SUM(b.total) FILTER (WHERE b.status = 'COMPLETED'),0) AS gmv
      FROM "Booking" b
      JOIN "Customer" cu ON cu.id = b."customerId"
      JOIN "User" u ON u.id = cu."userId"
      JOIN "Town" t ON t.id = u."townId"
      WHERE b."createdAt" >= ${from} AND b."createdAt" <= ${to}
      GROUP BY t.id, t.name ORDER BY gmv DESC`);
  }

  async cancellationRate(fromS?: string, toS?: string) {
    const { from, to } = this.range(fromS, toS);
    const where = { createdAt: { gte: from, lte: to } };
    const [total, cancelled] = await Promise.all([
      this.prisma.booking.count({ where: { ...where, status: { not: 'PENDING_PAYMENT' } } }),
      this.prisma.booking.count({ where: { ...where, status: 'CANCELLED' } }),
    ]);
    return { total, cancelled, rate: total ? cancelled / total : 0 };
  }

  async repeatCustomerRate(fromS?: string, toS?: string) {
    const { from, to } = this.range(fromS, toS);
    const [row] = normalizeRaw<{ customers: number; repeat: number }>(await this.prisma.$queryRaw`
      SELECT COUNT(*) AS customers, COUNT(*) FILTER (WHERE n > 1) AS repeat FROM (
        SELECT "customerId", COUNT(*) AS n FROM "Booking"
        WHERE status NOT IN ('CANCELLED','REJECTED','PENDING_PAYMENT')
          AND "createdAt" >= ${from} AND "createdAt" <= ${to}
        GROUP BY "customerId") t`);
    const customers = row?.customers ?? 0;
    const repeat = row?.repeat ?? 0;
    return { customers, repeatCustomers: repeat, rate: customers ? repeat / customers : 0 };
  }
}
