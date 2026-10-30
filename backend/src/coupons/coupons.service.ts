import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PricingService } from '../bookings/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './coupons.dto';

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService, private pricing: PricingService) {}

  private check(c: { type: string; value: number; validFrom?: string; validTo?: string }, prev?: { validFrom: Date; validTo: Date }) {
    if (c.type === 'PERCENT' && c.value > 100) throw new BadRequestException('Percent value cannot exceed 100');
    const from = c.validFrom ? new Date(c.validFrom) : prev?.validFrom;
    const to = c.validTo ? new Date(c.validTo) : prev?.validTo;
    if (from && to && from >= to) throw new BadRequestException('validTo must be after validFrom');
  }

  // ---- admin ----
  async create(dto: CreateCouponDto) {
    this.check(dto);
    try {
      return await this.prisma.coupon.create({
        data: { ...dto, validFrom: new Date(dto.validFrom), validTo: new Date(dto.validTo) },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Coupon code already exists');
      throw e;
    }
  }

  list(page = 1, limit = 50) {
    return this.prisma.coupon.findMany({ orderBy: { validTo: 'desc' }, skip: (page - 1) * limit, take: limit });
  }

  async get(id: string) {
    const c = await this.prisma.coupon.findUnique({ where: { id } });
    if (!c) throw new NotFoundException('Coupon not found');
    return c;
  }

  async update(id: string, dto: UpdateCouponDto) {
    const c = await this.get(id);
    this.check({ type: dto.type ?? c.type, value: dto.value ?? Number(c.value), validFrom: dto.validFrom, validTo: dto.validTo }, c);
    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...dto,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validTo: dto.validTo ? new Date(dto.validTo) : undefined,
      },
    });
  }

  /** Soft delete when the coupon has been used (bookings reference it); hard delete otherwise. */
  async remove(id: string) {
    const c = await this.get(id);
    const used = await this.prisma.booking.count({ where: { couponId: id } });
    if (used > 0) {
      await this.prisma.coupon.update({ where: { id }, data: { active: false } });
      return { deleted: false, deactivated: true };
    }
    await this.prisma.coupon.delete({ where: { id: c.id } });
    return { deleted: true };
  }

  // ---- customer ----
  /** Runs the real pricing quote so the preview matches what the booking will charge. */
  async validate(userId: string, dto: ValidateCouponDto) {
    const customer = await this.prisma.customer.findUnique({ where: { userId }, include: { membership: true } });
    const at = dto.scheduledAt ? new Date(dto.scheduledAt) : new Date();
    const active = customer?.membership && customer.membershipEnds && customer.membershipEnds > new Date();
    const membershipDiscountPct = active ? customer!.membership!.discountPct : 0;
    const [without, withCoupon] = await Promise.all([
      this.pricing.quote({ serviceId: dto.serviceId, at, userId, membershipDiscountPct }),
      this.pricing.quote({ serviceId: dto.serviceId, at, userId, membershipDiscountPct, couponCode: dto.code }),
    ]);
    return {
      valid: true,
      code: dto.code,
      discount: Math.round((withCoupon.discount - without.discount) * 100) / 100,
      quote: withCoupon,
      originalTotal: without.total,
    };
  }

  /** Active, in-date, not exhausted coupons the customer can still use. */
  async available(userId: string) {
    const now = new Date();
    const coupons = await this.prisma.coupon.findMany({
      where: { active: true, validFrom: { lte: now }, validTo: { gte: now } },
      orderBy: { validTo: 'asc' },
      select: { id: true, code: true, type: true, value: true, maxDiscount: true, minOrder: true, usageLimit: true, usedCount: true, perUserLimit: true, validTo: true },
    });
    const usage = await this.prisma.booking.groupBy({
      by: ['couponId'],
      where: { customer: { userId }, couponId: { in: coupons.map((c) => c.id) }, status: { not: 'CANCELLED' } },
      _count: true,
    });
    const usedBy = new Map(usage.map((u) => [u.couponId, u._count]));
    return coupons
      .filter((c) => (c.usageLimit == null || c.usedCount < c.usageLimit) && (usedBy.get(c.id) ?? 0) < c.perUserLimit)
      .map(({ usageLimit: _u, usedCount: _c, perUserLimit: _p, id: _i, ...pub }) => pub);
  }
}
