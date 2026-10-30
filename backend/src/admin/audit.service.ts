import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Records an AuditLog row for every mutating admin action. */
@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  record(actorId: string, action: string, entity: string, entityId?: string | null, meta?: unknown) {
    return this.prisma.auditLog.create({
      data: {
        actorId,
        action,
        entity,
        entityId: entityId ?? null,
        meta: meta === undefined ? undefined : (JSON.parse(JSON.stringify(meta)) as Prisma.InputJsonValue),
      },
    });
  }
}
