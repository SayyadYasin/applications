import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { BroadcastDto } from './admin.dto';
import { AuditService } from './audit.service';

@Injectable()
export class BroadcastService {
  constructor(private prisma: PrismaService, private notifications: NotificationsService, private audit: AuditService) {}

  /** Sends to all active users, a role, or a town, in batches of 50 to bound concurrency. */
  async broadcast(actorId: string, dto: BroadcastDto) {
    if (dto.target === 'ROLE' && !dto.role) throw new BadRequestException('role is required when target=ROLE');
    if (dto.target === 'TOWN' && !dto.townId) throw new BadRequestException('townId is required when target=TOWN');

    const where: Prisma.UserWhereInput = {
      isActive: true,
      ...(dto.target === 'ROLE' && { role: dto.role }),
      ...(dto.target === 'TOWN' && { townId: dto.townId }),
    };
    let sent = 0;
    let failed = 0;
    let cursor: string | undefined;
    for (;;) {
      const users = await this.prisma.user.findMany({
        where, select: { id: true }, orderBy: { id: 'asc' }, take: 50,
        ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      });
      if (!users.length) break;
      const results = await Promise.allSettled(
        users.map((u) => this.notifications.notify(u.id, { title: dto.title, body: dto.body, channels: dto.channels })),
      );
      sent += results.filter((r) => r.status === 'fulfilled').length;
      failed += results.filter((r) => r.status === 'rejected').length;
      cursor = users[users.length - 1].id;
    }
    await this.audit.record(actorId, 'NOTIFICATION_BROADCAST', 'Notification', null, {
      target: dto.target, role: dto.role, townId: dto.townId, title: dto.title, sent, failed,
    });
    return { sent, failed };
  }
}
