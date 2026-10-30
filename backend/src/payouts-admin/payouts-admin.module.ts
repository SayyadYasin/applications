import { BadRequestException, Body, Controller, Get, Injectable, Module, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PayoutStatus, Role } from '@prisma/client';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard } from '../auth/roles';
import { MarkPaidDto, PayoutListDto, RejectPayoutDto } from '../earnings/earnings.dto';
import { PrismaService } from '../prisma/prisma.service';
import { advisoryLock } from '../wallet/razorpay.util';

@Injectable()
export class PayoutsAdminService {
  constructor(private prisma: PrismaService) {}

  async list(status?: PayoutStatus, page = 1, limit = 20) {
    const where = status ? { status } : {};
    const [items, total] = await Promise.all([
      this.prisma.payout.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit,
        include: { partner: { select: { id: true, user: { select: { name: true, phone: true } } } } },
      }),
      this.prisma.payout.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  /** Atomically moves a payout between states, rejecting illegal transitions. */
  private async transition(
    adminId: string, id: string, from: PayoutStatus[], to: PayoutStatus,
    extra: { reference?: string } = {}, meta: Record<string, unknown> = {},
  ) {
    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(tx, `payoutadmin:${id}`);
      const p = await tx.payout.findUnique({ where: { id } });
      if (!p) throw new NotFoundException('Payout not found');
      if (!from.includes(p.status)) throw new BadRequestException(`Payout is ${p.status}; cannot move to ${to}`);

      const processedAt = to === 'PAID' || to === 'REJECTED' ? new Date() : undefined;
      const updated = await tx.payout.update({ where: { id }, data: { status: to, processedAt, ...extra } });

      if (to === 'PAID') {
        // Best effort: mark oldest unsettled earnings settled while they fit within the paid amount.
        const open = await tx.earning.findMany({ where: { partnerId: p.partnerId, settled: false }, orderBy: { createdAt: 'asc' } });
        let left = p.amount;
        const ids: string[] = [];
        for (const e of open) {
          if (e.net.gt(left)) break;
          left = left.sub(e.net);
          ids.push(e.id);
        }
        if (ids.length) await tx.earning.updateMany({ where: { id: { in: ids } }, data: { settled: true } });
      }
      await tx.auditLog.create({
        data: { actorId: adminId, action: `PAYOUT_${to}`, entity: 'Payout', entityId: id, meta: { amount: p.amount.toString(), ...meta } as any },
      });
      return updated;
    });
  }

  approve(adminId: string, id: string) { return this.transition(adminId, id, ['REQUESTED'], 'APPROVED'); }
  reject(adminId: string, id: string, reason?: string) { return this.transition(adminId, id, ['REQUESTED', 'APPROVED'], 'REJECTED', {}, { reason }); }
  markPaid(adminId: string, id: string, reference: string) { return this.transition(adminId, id, ['APPROVED'], 'PAID', { reference }, { reference }); }
}

@ApiTags('admin-payouts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/payouts')
export class PayoutsAdminController {
  constructor(private svc: PayoutsAdminService) {}

  @Get() list(@Query() q: PayoutListDto) { return this.svc.list(q.status, q.page, q.limit); }

  @Post(':id/approve') approve(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.svc.approve(u.id, id); }

  @Post(':id/reject') reject(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: RejectPayoutDto) {
    return this.svc.reject(u.id, id, dto.reason);
  }

  @Post(':id/mark-paid') markPaid(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: MarkPaidDto) {
    return this.svc.markPaid(u.id, id, dto.reference);
  }
}

@Module({ controllers: [PayoutsAdminController], providers: [PayoutsAdminService] })
export class PayoutsAdminModule {}
