import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TicketStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminListTicketsQuery, CreateTicketDto, ResolveDisputeDto, UpdateTicketDto } from './support.dto';

@Injectable()
export class SupportService {
  constructor(private prisma: PrismaService, private notifications: NotificationsService) {}

  async create(userId: string, dto: CreateTicketDto) {
    if (dto.bookingId) {
      const b = await this.prisma.booking.findFirst({
        where: { id: dto.bookingId, OR: [{ customer: { userId } }, { partner: { userId } }] },
        select: { id: true },
      });
      if (!b) throw new NotFoundException('Booking not found');
    } else if (dto.isDispute) {
      throw new BadRequestException('A dispute must be linked to a booking');
    }
    return this.prisma.supportTicket.create({
      data: { userId, subject: dto.subject, body: dto.body, bookingId: dto.bookingId, isDispute: !!dto.isDispute },
    });
  }

  listMine(userId: string) {
    return this.prisma.supportTicket.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async getMine(userId: string, id: string) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id }, include: { booking: { select: { id: true, code: true, status: true } } } });
    if (!t) throw new NotFoundException('Ticket not found');
    if (t.userId !== userId) throw new ForbiddenException();
    return t;
  }

  // ---- admin ----

  async adminList(q: AdminListTicketsQuery) {
    const where: Prisma.SupportTicketWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.isDispute !== undefined ? { isDispute: q.isDispute } : {}),
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.bookingId ? { bookingId: q.bookingId } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: q.take ?? 50,
        skip: q.skip ?? 0,
        include: { user: { select: { id: true, name: true, phone: true, role: true } } },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);
    return { items, total };
  }

  async adminGet(id: string) {
    const t = await this.prisma.supportTicket.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, phone: true, email: true, role: true } }, booking: true },
    });
    if (!t) throw new NotFoundException('Ticket not found');
    return t;
  }

  async adminUpdate(actorId: string, id: string, dto: UpdateTicketDto) {
    if (!dto.status && dto.resolution === undefined) throw new BadRequestException('Nothing to update');
    const t = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Ticket not found');
    const updated = await this.prisma.supportTicket.update({
      where: { id },
      data: { ...(dto.status ? { status: dto.status } : {}), ...(dto.resolution !== undefined ? { resolution: dto.resolution } : {}) },
    });
    await this.prisma.auditLog.create({
      data: { actorId, action: 'TICKET_UPDATE', entity: 'SupportTicket', entityId: id, meta: { status: dto.status, hasResolution: dto.resolution !== undefined } },
    });
    if (dto.status === TicketStatus.RESOLVED || dto.status === TicketStatus.CLOSED || dto.resolution) {
      this.notifications.notifySafe(t.userId, { title: 'Support ticket updated', body: `Your ticket "${t.subject}" was updated.` });
    }
    return updated;
  }

  async resolveDispute(actorId: string, id: string, dto: ResolveDisputeDto) {
    const t = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Ticket not found');
    if (!t.isDispute) throw new BadRequestException('Ticket is not a dispute');
    const status = dto.status ?? TicketStatus.RESOLVED;
    if (status !== TicketStatus.RESOLVED && status !== TicketStatus.CLOSED) throw new BadRequestException('Status must be RESOLVED or CLOSED');
    const updated = await this.prisma.supportTicket.update({ where: { id }, data: { status, resolution: dto.resolution } });
    await this.prisma.auditLog.create({
      data: { actorId, action: 'DISPUTE_RESOLVED', entity: 'SupportTicket', entityId: id, meta: { bookingId: t.bookingId, status } },
    });
    this.notifications.notifySafe(t.userId, { title: 'Dispute resolved', body: dto.resolution.slice(0, 200) });
    return updated;
  }
}
