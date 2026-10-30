import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard } from '../auth/roles';
import {
  AutoAssignDto, CommissionDto, ForceAssignDto, ForceCancelDto, ListBookingsDto, ListPartnersDto,
  ListPaymentsDto, ManualRefundDto, PageQueryDto,
} from './admin.dto';
import { OpsAdminService } from './ops.service';

@ApiTags('admin/partners')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/partners')
export class PartnersAdminController {
  constructor(private svc: OpsAdminService) {}

  @Get() list(@Query() q: ListPartnersDto) { return this.svc.listPartners(q); }
  @Get(':id') get(@Param('id') id: string) { return this.svc.getPartner(id); }

  @Patch(':id/commission')
  commission(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: CommissionDto) {
    return this.svc.setCommission(u.id, id, dto.commissionPct ?? null);
  }
}

@ApiTags('admin/bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/bookings')
export class BookingsAdminController {
  constructor(private svc: OpsAdminService) {}

  @Get() list(@Query() q: ListBookingsDto) { return this.svc.listBookings(q); }
  @Get(':id') get(@Param('id') id: string) { return this.svc.getBooking(id); }

  @Post(':id/assign')
  assign(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: ForceAssignDto) {
    return this.svc.forceAssign(u.id, id, dto.partnerId);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: ForceCancelDto) {
    return this.svc.forceCancel(u.id, id, dto.reason);
  }

  @Post(':id/auto-assign')
  autoAssign(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: AutoAssignDto) {
    return this.svc.triggerAutoAssign(u.id, id, dto.preferredPartnerId);
  }
}

@ApiTags('admin/payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class PaymentsAdminController {
  constructor(private svc: OpsAdminService) {}

  @Get('payments') payments(@Query() q: ListPaymentsDto) { return this.svc.listPayments(q); }
  @Get('refunds') refunds(@Query() q: PageQueryDto) { return this.svc.listRefunds(q); }

  @Post('refunds')
  refund(@CurrentUser() u: JwtUser, @Body() dto: ManualRefundDto) { return this.svc.manualRefund(u.id, dto); }
}
