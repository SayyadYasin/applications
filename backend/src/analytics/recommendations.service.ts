import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PricingService } from '../bookings/pricing.service';
import { CreateBookingDto } from '../bookings/bookings.dto';
import { PrismaService } from '../prisma/prisma.service';
import { scoreServices } from './recommendation.scoring';

const DAY = 86_400_000;

@Injectable()
export class RecommendationsService {
  private log = new Logger(RecommendationsService.name);
  constructor(private prisma: PrismaService, private pricing: PricingService) {}

  async forUser(userId: string, limit = 10) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { townId: true } });
    const since = new Date(Date.now() - 30 * DAY);

    const [services, past, popular] = await Promise.all([
      this.prisma.service.findMany({
        where: { active: true, ...(user.townId && { OR: [{ townId: user.townId }, { townId: null }] }) },
        select: { id: true, name: true, subCategory: { select: { categoryId: true, category: { select: { slug: true } } } } },
      }),
      this.prisma.booking.findMany({
        where: { customer: { userId }, status: { notIn: ['CANCELLED', 'REJECTED'] } },
        select: { serviceId: true, scheduledAt: true, service: { select: { subCategory: { select: { categoryId: true } } } } },
        orderBy: { scheduledAt: 'desc' },
        take: 200,
      }),
      this.prisma.booking.groupBy({
        by: ['serviceId'],
        _count: { _all: true },
        where: {
          createdAt: { gte: since },
          status: { notIn: ['CANCELLED', 'REJECTED'] },
          ...(user.townId && { customer: { user: { townId: user.townId } } }),
        },
      }),
    ]);

    return scoreServices({
      candidates: services.map((s) => ({
        serviceId: s.id,
        name: (s.name as { en?: string })?.en ?? s.id,
        categoryId: s.subCategory.categoryId,
        categorySlug: s.subCategory.category.slug,
      })),
      history: past.map((b) => ({ serviceId: b.serviceId, categoryId: b.service.subCategory.categoryId, at: b.scheduledAt })),
      townPopularity: Object.fromEntries(popular.map((p) => [p.serviceId, p._count._all])),
      now: new Date(),
      limit,
    });
  }

  /** Prefilled CreateBookingDto for repeating a past booking: same service/address/partner, next day same time. */
  async rebookDraft(userId: string, bookingId: string) {
    const b = await this.prisma.booking.findFirst({
      where: { id: bookingId, customer: { userId } },
      include: { service: { select: { active: true } } },
    });
    if (!b) throw new NotFoundException('Booking not found');

    const next = new Date(b.scheduledAt);
    const min = Date.now() + 24 * 3600_000;
    // Same time of day, tomorrow at the earliest.
    const today = new Date();
    next.setFullYear(today.getFullYear(), today.getMonth(), today.getDate());
    while (next.getTime() < min) next.setDate(next.getDate() + 1);

    const draft: CreateBookingDto = {
      serviceId: b.serviceId,
      addressId: b.addressId,
      scheduledAt: next.toISOString(),
      isInstant: false,
      paymentMethod: b.paymentMethod,
      ...(b.partnerId && { preferredPartnerId: b.partnerId }),
    };
    let quote: unknown = null;
    try {
      quote = await this.pricing.quote({ serviceId: b.serviceId, at: next, userId });
    } catch (e) {
      this.log.warn(`rebook quote failed: ${(e as Error).message}`);
    }
    return { draft, quote, serviceAvailable: b.service.active };
  }
}
