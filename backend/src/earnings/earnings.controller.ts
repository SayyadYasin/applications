import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard } from '../auth/roles';
import { AnalyticsDto, PayoutListDto, RangeDto, RequestPayoutDto } from './earnings.dto';
import { EarningsService } from './earnings.service';

@ApiTags('earnings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PARTNER)
@Controller('earnings')
export class EarningsController {
  constructor(private svc: EarningsService) {}

  @Get('summary') summary(@CurrentUser() u: JwtUser) { return this.svc.summary(u.id); }

  @Get('daily') daily(@CurrentUser() u: JwtUser, @Query() q: RangeDto) { return this.svc.daily(u.id, q.from, q.to); }

  @Get('weekly') weekly(@CurrentUser() u: JwtUser, @Query() q: RangeDto) { return this.svc.weekly(u.id, q.from, q.to); }

  @Get('analytics') analytics(@CurrentUser() u: JwtUser, @Query() q: AnalyticsDto) { return this.svc.analytics(u.id, q.days); }

  @Post('payouts') requestPayout(@CurrentUser() u: JwtUser, @Body() dto: RequestPayoutDto) { return this.svc.requestPayout(u.id, dto); }

  @Get('payouts') payouts(@CurrentUser() u: JwtUser, @Query() q: PayoutListDto) {
    return this.svc.listPayouts(u.id, q.status, q.page, q.limit);
  }
}
