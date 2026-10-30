import { Injectable } from '@nestjs/common';
import { KycStatus } from '@prisma/client';
import { slotsCover } from '../partners/partners.rules';
import { PrismaService } from '../prisma/prisma.service';

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

@Injectable()
export class AssignmentService {
  constructor(private prisma: PrismaService) {}

  /**
   * Lead assignment: KYC-approved, online partners offering the service, within their radius,
   * with no overlapping booking. Score = proximity (50%) + rating (30%) + acceptance rate (20%).
   * Returns ranked candidate partner ids; the caller offers the job in order.
   */
  async rank(opts: { serviceId: string; lat: number; lng: number; at: Date; durationMin: number; preferredPartnerId?: string }) {
    const end = new Date(opts.at.getTime() + opts.durationMin * 60_000);
    const partners = await this.prisma.partner.findMany({
      where: {
        kycStatus: KycStatus.APPROVED,
        isOnline: true,
        lat: { not: null },
        services: { some: { serviceId: opts.serviceId } },
        bookings: {
          none: {
            status: { in: ['ASSIGNED', 'PARTNER_EN_ROUTE', 'IN_PROGRESS'] },
            scheduledAt: { lt: end, gt: new Date(opts.at.getTime() - 4 * 3600_000) },
          },
        },
      },
      include: { availability: true },
    });

    return partners
      // Partners with availability slots must have one covering the requested weekday/time (no slots = always available).
      .filter((p) => slotsCover(p.availability, opts.at, opts.durationMin))
      .map((p) => ({ p, km: haversineKm({ lat: p.lat!, lng: p.lng! }, opts) }))
      .filter(({ p, km }) => km <= p.radiusKm)
      .map(({ p, km }) => {
        const proximity = 1 - km / p.radiusKm;
        const score = 0.5 * proximity + 0.3 * (p.ratingAvg / 5) + 0.2 * p.acceptanceRate + (p.id === opts.preferredPartnerId ? 0.25 : 0);
        return { partnerId: p.id, score, km };
      })
      .sort((a, b) => b.score - a.score);
  }
}
