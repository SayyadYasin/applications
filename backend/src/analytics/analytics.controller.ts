import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AnalyticsQueryDto } from '../admin/admin.dto';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard } from '../auth/roles';
import { AnalyticsService } from './analytics.service';
import { RecommendationsService } from './recommendations.service';

@ApiTags('admin/analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private svc: AnalyticsService) {}

  @Get('revenue') revenue(@Query() q: AnalyticsQueryDto) { return this.svc.revenueSeries(q.granularity, q.from, q.to); }
  @Get('bookings-by-status') byStatus(@Query() q: AnalyticsQueryDto) { return this.svc.bookingsByStatus(q.from, q.to); }
  @Get('top-services') topServices(@Query() q: AnalyticsQueryDto) { return this.svc.topServices(q.limit, q.from, q.to); }
  @Get('top-partners') topPartners(@Query() q: AnalyticsQueryDto) { return this.svc.topPartners(q.limit, q.from, q.to); }
  @Get('category-mix') categoryMix(@Query() q: AnalyticsQueryDto) { return this.svc.categoryMix(q.from, q.to); }
  @Get('towns') towns(@Query() q: AnalyticsQueryDto) { return this.svc.townPerformance(q.from, q.to); }
  @Get('cancellation-rate') cancellation(@Query() q: AnalyticsQueryDto) { return this.svc.cancellationRate(q.from, q.to); }
  @Get('repeat-customers') repeat(@Query() q: AnalyticsQueryDto) { return this.svc.repeatCustomerRate(q.from, q.to); }
}

@ApiTags('recommendations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
@Controller('recommendations')
export class RecommendationsController {
  constructor(private svc: RecommendationsService) {}

  @Get() list(@CurrentUser() u: JwtUser) { return this.svc.forUser(u.id); }

  @Post('rebook/:bookingId')
  rebook(@CurrentUser() u: JwtUser, @Param('bookingId') id: string) { return this.svc.rebookDraft(u.id, id); }
}
