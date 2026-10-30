import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { advisoryLock } from '../wallet/razorpay.util';
import { CreateReviewDto } from './reviews.dto';

const publicReview = {
  id: true, rating: true, comment: true, reply: true, createdAt: true,
  booking: { select: { customer: { select: { user: { select: { name: true, avatarUrl: true } } } } } },
} satisfies Prisma.ReviewSelect;

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, dto: CreateReviewDto) {
    const booking = await this.prisma.booking.findFirst({ where: { id: dto.bookingId, customer: { userId } } });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'COMPLETED') throw new BadRequestException('Only completed bookings can be reviewed');
    if (!booking.partnerId) throw new BadRequestException('Booking has no partner');
    const partnerId = booking.partnerId;

    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(tx, `review-partner:${partnerId}`);
      if (await tx.review.findUnique({ where: { bookingId: booking.id } })) throw new ConflictException('Booking already reviewed');
      const review = await tx.review.create({
        data: { bookingId: booking.id, partnerId, rating: dto.rating, comment: dto.comment },
      });
      const agg = await tx.review.aggregate({ where: { partnerId }, _avg: { rating: true }, _count: true });
      await tx.partner.update({
        where: { id: partnerId },
        data: { ratingAvg: Math.round((agg._avg.rating ?? 0) * 100) / 100, ratingCount: agg._count },
      });
      return review;
    });
  }

  async reply(userId: string, reviewId: string, reply: string) {
    const r = await this.prisma.review.findFirst({ where: { id: reviewId, partner: { userId } } });
    if (!r) throw new NotFoundException('Review not found');
    return this.prisma.review.update({ where: { id: r.id }, data: { reply } });
  }

  async byPartner(partnerId: string, page = 1, limit = 20) {
    const partner = await this.prisma.partner.findUnique({ where: { id: partnerId }, select: { ratingAvg: true, ratingCount: true } });
    if (!partner) throw new NotFoundException('Partner not found');
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({ where: { partnerId }, select: publicReview, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.review.count({ where: { partnerId } }),
    ]);
    return { ...partner, items, total, page, limit };
  }

  async mine(userId: string, page = 1, limit = 20) {
    const where = { partner: { userId } };
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({ where, select: publicReview, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.review.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  // ---- favorites ----
  private async customerId(userId: string) {
    const c = await this.prisma.customer.findUnique({ where: { userId }, select: { id: true } });
    if (!c) throw new ForbiddenException('Customer profile not found');
    return c.id;
  }

  async addFavorite(userId: string, partnerId: string) {
    const customerId = await this.customerId(userId);
    if (!(await this.prisma.partner.findUnique({ where: { id: partnerId }, select: { id: true } }))) throw new NotFoundException('Partner not found');
    await this.prisma.favoritePartner.upsert({
      where: { customerId_partnerId: { customerId, partnerId } }, update: {}, create: { customerId, partnerId },
    });
    return { favorite: true };
  }

  async removeFavorite(userId: string, partnerId: string) {
    const customerId = await this.customerId(userId);
    await this.prisma.favoritePartner.deleteMany({ where: { customerId, partnerId } });
    return { favorite: false };
  }

  async listFavorites(userId: string) {
    const customerId = await this.customerId(userId);
    const favs = await this.prisma.favoritePartner.findMany({
      where: { customerId },
      include: { partner: { select: { id: true, ratingAvg: true, ratingCount: true, completedJobs: true, isOnline: true, bio: true, user: { select: { name: true, avatarUrl: true } } } } },
    });
    return favs.map((f) => f.partner);
  }
}
