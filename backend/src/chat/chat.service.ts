import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  /** Returns the booking's participant user ids or throws when the user is not the customer/partner (admins allowed read-only via allowAdmin). */
  async assertParticipant(bookingId: string, userId: string, role?: string, allowAdmin = false) {
    const b = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, status: true, customer: { select: { userId: true } }, partner: { select: { id: true, userId: true } } },
    });
    if (!b) throw new NotFoundException('Booking not found');
    const isParticipant = b.customer.userId === userId || b.partner?.userId === userId;
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    if (!isParticipant && !(allowAdmin && isAdmin)) throw new ForbiddenException('Not a participant of this booking');
    return { id: b.id, status: b.status as BookingStatus, customerUserId: b.customer.userId, partnerUserId: b.partner?.userId ?? null, partnerId: b.partner?.id ?? null };
  }

  async send(bookingId: string, senderId: string, body: string) {
    const b = await this.assertParticipant(bookingId, senderId);
    if (b.status === 'CANCELLED' || b.status === 'REJECTED') throw new ForbiddenException('Chat is closed for this booking');
    const msg = await this.prisma.chatMessage.create({ data: { bookingId, senderId, body: body.trim() } });
    return { msg, booking: b };
  }

  async list(bookingId: string, userId: string, role: string, opts: { before?: string; limit?: number }) {
    await this.assertParticipant(bookingId, userId, role, true);
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const rows = await this.prisma.chatMessage.findMany({
      where: { bookingId },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts.before ? { cursor: { id: opts.before }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    return { items: items.reverse(), nextCursor: hasMore ? rows[limit - 1].id : null };
  }

  /** Marks messages sent by the other party as read. Returns ids updated. */
  async markRead(bookingId: string, userId: string) {
    await this.assertParticipant(bookingId, userId);
    const unread = await this.prisma.chatMessage.findMany({
      where: { bookingId, senderId: { not: userId }, readAt: null },
      select: { id: true },
    });
    if (unread.length) {
      await this.prisma.chatMessage.updateMany({ where: { id: { in: unread.map((m) => m.id) } }, data: { readAt: new Date() } });
    }
    return unread.map((m) => m.id);
  }
}
