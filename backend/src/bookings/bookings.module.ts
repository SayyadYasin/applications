import { Body, Controller, Get, Module, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard } from '../auth/roles';
import { LoyaltyReferralModule } from '../loyalty-referral/loyalty-referral.module';
import { RefundsModule } from '../refunds/refunds.module';
import { AssignmentService } from './assignment.service';
import { CancelDto, CompleteDto, CreateBookingDto, RescheduleDto } from './bookings.dto';
import { BookingsService } from './bookings.service';
import { PricingService } from './pricing.service';

@ApiTags('bookings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private svc: BookingsService) {}

  @Roles(Role.CUSTOMER) @Post()
  create(@CurrentUser() u: JwtUser, @Body() dto: CreateBookingDto) { return this.svc.create(u.id, dto); }

  @Get()
  list(@CurrentUser() u: JwtUser) { return this.svc.listForUser(u.id, u.role); }

  @Get(':id')
  get(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.svc.get(u.id, u.role, id); }

  @Roles(Role.CUSTOMER) @Post(':id/cancel')
  cancel(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: CancelDto) { return this.svc.cancel(u.id, id, dto.reason); }

  @Roles(Role.CUSTOMER) @Post(':id/reschedule')
  reschedule(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: RescheduleDto) { return this.svc.reschedule(u.id, id, dto.scheduledAt); }

  @Roles(Role.PARTNER) @Post(':id/reject')
  reject(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.svc.reject(u.id, id); }

  @Roles(Role.PARTNER) @Post(':id/depart')
  depart(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.svc.depart(u.id, id); }

  @Roles(Role.PARTNER) @Post(':id/start')
  start(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.svc.start(u.id, id); }

  @Roles(Role.PARTNER) @Post(':id/complete')
  complete(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: CompleteDto) { return this.svc.complete(u.id, id, dto.otp); }
}

@Module({
  imports: [RefundsModule, LoyaltyReferralModule],
  controllers: [BookingsController],
  providers: [BookingsService, PricingService, AssignmentService],
  exports: [BookingsService],
})
export class BookingsModule {}
