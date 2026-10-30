import { BadRequestException } from '@nestjs/common';
import { PricingService } from './pricing.service';

const coupon = (over: Record<string, unknown> = {}) => ({
  id: 'c1', code: 'X', type: 'PERCENT', value: 10, maxDiscount: null, minOrder: 0, usageLimit: null,
  perUserLimit: 1, usedCount: 0, validFrom: new Date(Date.now() - 1e6), validTo: new Date(Date.now() + 1e9), active: true, ...over,
});

function setup(opts: { base?: number; gst?: number; rules?: unknown[]; coupon?: unknown; used?: number } = {}) {
  const prisma = {
    service: { findUniqueOrThrow: jest.fn().mockResolvedValue({ basePrice: opts.base ?? 1000, gstPct: opts.gst ?? 18 }) },
    pricingRule: { findMany: jest.fn().mockResolvedValue(opts.rules ?? []) },
    coupon: { findUnique: jest.fn().mockResolvedValue(opts.coupon ?? null) },
    booking: { count: jest.fn().mockResolvedValue(opts.used ?? 0) },
  };
  return { svc: new PricingService(prisma as any), prisma };
}

// 2026-01-05 is a Monday, 2026-01-10 a Saturday (local time).
const monday = (h: number) => new Date(2026, 0, 5, h, 0, 0);
const saturday = (h: number) => new Date(2026, 0, 10, h, 0, 0);
const peak = { multiplier: 1.25, startHour: 18, endHour: 21, weekdays: [1, 2, 3, 4, 5] };
const weekend = { multiplier: 1.2, startHour: null, endHour: null, weekdays: [0, 6] };

describe('PricingService', () => {
  describe('surgeMultiplier', () => {
    it('applies the weekday evening window, end hour exclusive', async () => {
      const { svc } = setup({ rules: [peak] });
      expect(await svc.surgeMultiplier(monday(18))).toBe(1.25);
      expect(await svc.surgeMultiplier(monday(20))).toBe(1.25);
      expect(await svc.surgeMultiplier(monday(21))).toBe(1);
      expect(await svc.surgeMultiplier(monday(17))).toBe(1);
    });
    it('ignores the window on other weekdays and applies weekend rule all day', async () => {
      const { svc } = setup({ rules: [peak, weekend] });
      expect(await svc.surgeMultiplier(saturday(19))).toBe(1.2);
      expect(await svc.surgeMultiplier(saturday(3))).toBe(1.2);
    });
    it('takes the highest of overlapping rules', async () => {
      const { svc } = setup({ rules: [{ ...peak, weekdays: [0, 1, 2, 3, 4, 5, 6] }, weekend] });
      expect(await svc.surgeMultiplier(saturday(19))).toBe(1.25);
    });
  });

  describe('quote', () => {
    const base = { serviceId: 's', userId: 'u' };

    it('computes surge and GST', async () => {
      const { svc } = setup({ rules: [peak], base: 1000, gst: 18 });
      const q = await svc.quote({ ...base, at: monday(19) });
      expect(q).toMatchObject({ basePrice: 1000, surgeAmount: 250, discount: 0, taxable: 1250, taxAmount: 225, total: 1475 });
    });

    it('applies GST with no surge', async () => {
      const { svc } = setup({ base: 500, gst: 12 });
      const q = await svc.quote({ ...base, at: monday(10) });
      expect(q.taxAmount).toBe(60);
      expect(q.total).toBe(560);
    });

    it('percent coupon', async () => {
      const { svc } = setup({ coupon: coupon({ type: 'PERCENT', value: 10 }) });
      const q = await svc.quote({ ...base, at: monday(10), couponCode: 'X' });
      expect(q.discount).toBe(100);
      expect(q.total).toBe(1062); // (1000-100)*1.18
      expect(q.couponId).toBe('c1');
    });

    it('flat coupon', async () => {
      const { svc } = setup({ coupon: coupon({ type: 'FLAT', value: 150 }) });
      const q = await svc.quote({ ...base, at: monday(10), couponCode: 'X' });
      expect(q.discount).toBe(150);
    });

    it('flat coupon cannot exceed the order amount', async () => {
      const { svc } = setup({ base: 100, coupon: coupon({ type: 'FLAT', value: 500 }) });
      const q = await svc.quote({ ...base, at: monday(10), couponCode: 'X' });
      expect(q.discount).toBe(100);
      expect(q.total).toBe(0);
    });

    it('caps percent coupon at maxDiscount', async () => {
      const { svc } = setup({ base: 2000, coupon: coupon({ type: 'PERCENT', value: 50, maxDiscount: 300 }) });
      const q = await svc.quote({ ...base, at: monday(10), couponCode: 'X' });
      expect(q.discount).toBe(300);
    });

    it('rejects when below minOrder', async () => {
      const { svc } = setup({ base: 400, coupon: coupon({ minOrder: 500 }) });
      await expect(svc.quote({ ...base, at: monday(10), couponCode: 'X' })).rejects.toThrow(BadRequestException);
    });

    it('minOrder counts the surge-inclusive amount', async () => {
      const { svc } = setup({ base: 450, rules: [peak], coupon: coupon({ minOrder: 500 }) });
      await expect(svc.quote({ ...base, at: monday(19), couponCode: 'X' })).resolves.toBeDefined(); // 562.5
    });

    it.each([
      ['unknown code', null],
      ['inactive', coupon({ active: false })],
      ['expired', coupon({ validTo: new Date(Date.now() - 1000) })],
      ['not started', coupon({ validFrom: new Date(Date.now() + 1e6) })],
      ['usage limit hit', coupon({ usageLimit: 5, usedCount: 5 })],
    ])('rejects %s coupon', async (_n, c) => {
      const { svc } = setup({ coupon: c });
      await expect(svc.quote({ ...base, at: monday(10), couponCode: 'X' })).rejects.toThrow(BadRequestException);
    });

    it('rejects when per-user limit reached', async () => {
      const { svc } = setup({ coupon: coupon({ perUserLimit: 1 }), used: 1 });
      await expect(svc.quote({ ...base, at: monday(10), couponCode: 'X' })).rejects.toThrow('already used');
    });

    it('stacks membership discount after coupon', async () => {
      const { svc } = setup({ coupon: coupon({ type: 'FLAT', value: 100 }) });
      const q = await svc.quote({ ...base, at: monday(10), couponCode: 'X', membershipDiscountPct: 10 });
      expect(q.discount).toBe(190); // 100 + 10% of 900
    });
  });
});
