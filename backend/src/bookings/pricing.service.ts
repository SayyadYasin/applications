import { BadRequestException, Injectable } from '@nestjs/common';
import { Coupon, DiscountType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PriceQuote {
  basePrice: number;
  surgeAmount: number;
  discount: number;
  taxable: number;
  taxAmount: number;
  total: number;
  couponId?: string;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService) {}

  /** Highest active multiplier whose hour/weekday window covers `at`. */
  async surgeMultiplier(at: Date): Promise<number> {
    const rules = await this.prisma.pricingRule.findMany({ where: { active: true } });
    const hour = at.getHours();
    const day = at.getDay();
    return rules
      .filter((r) => (r.weekdays.length === 0 || r.weekdays.includes(day)) &&
        (r.startHour == null || r.endHour == null || (hour >= r.startHour && hour < r.endHour)))
      .reduce((m, r) => Math.max(m, r.multiplier), 1);
  }

  private applyCoupon(c: Coupon, amount: number): number {
    const raw = c.type === DiscountType.PERCENT ? (amount * Number(c.value)) / 100 : Number(c.value);
    return Math.min(raw, c.maxDiscount ? Number(c.maxDiscount) : raw, amount);
  }

  async quote(opts: { serviceId: string; at: Date; couponCode?: string; userId: string; membershipDiscountPct?: number }): Promise<PriceQuote> {
    const service = await this.prisma.service.findUniqueOrThrow({ where: { id: opts.serviceId } });
    const base = Number(service.basePrice);
    const surge = round2(base * ((await this.surgeMultiplier(opts.at)) - 1));

    let discount = 0;
    let couponId: string | undefined;
    if (opts.couponCode) {
      const coupon = await this.prisma.coupon.findUnique({ where: { code: opts.couponCode } });
      const now = new Date();
      if (!coupon || !coupon.active || coupon.validFrom > now || coupon.validTo < now ||
          (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) ||
          Number(coupon.minOrder) > base + surge) {
        throw new BadRequestException('Coupon is not valid for this order');
      }
      const used = await this.prisma.booking.count({
        where: { couponId: coupon.id, customer: { userId: opts.userId }, status: { not: 'CANCELLED' } },
      });
      if (used >= coupon.perUserLimit) throw new BadRequestException('Coupon already used');
      discount = this.applyCoupon(coupon, base + surge);
      couponId = coupon.id;
    }
    if (opts.membershipDiscountPct) discount += ((base + surge - discount) * opts.membershipDiscountPct) / 100;
    discount = round2(discount);

    const taxable = round2(base + surge - discount);
    const taxAmount = round2((taxable * service.gstPct) / 100);
    return { basePrice: base, surgeAmount: surge, discount, taxable, taxAmount, total: round2(taxable + taxAmount), couponId };
  }
}

export type Decimalish = Prisma.Decimal | number;
