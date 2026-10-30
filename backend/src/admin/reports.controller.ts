import { Body, Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProduces, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { Response } from 'express';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard } from '../auth/roles';
import { BroadcastDto, DateRangeDto } from './admin.dto';
import { BroadcastService } from './broadcast.service';
import { ReportsService } from './reports.service';

@ApiTags('admin/reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/reports')
export class ReportsController {
  constructor(private svc: ReportsService) {}

  @ApiProduces('text/csv') @Get('bookings.csv')
  bookings(@Query() q: DateRangeDto, @Res() res: Response) { return this.svc.bookings(res, q.from, q.to); }

  @ApiProduces('text/csv') @Get('payments.csv')
  payments(@Query() q: DateRangeDto, @Res() res: Response) { return this.svc.payments(res, q.from, q.to); }

  @ApiProduces('text/csv') @Get('earnings.csv')
  earnings(@Query() q: DateRangeDto, @Res() res: Response) { return this.svc.earnings(res, q.from, q.to); }

  @ApiProduces('text/csv') @Get('payouts.csv')
  payouts(@Query() q: DateRangeDto, @Res() res: Response) { return this.svc.payouts(res, q.from, q.to); }

  @ApiProduces('text/csv') @Get('gst-summary.csv')
  gst(@Query() q: DateRangeDto, @Res() res: Response) { return this.svc.gstSummary(res, q.from, q.to); }
}

@ApiTags('admin/notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/notifications')
export class BroadcastController {
  constructor(private svc: BroadcastService) {}

  @Post('broadcast')
  broadcast(@CurrentUser() u: JwtUser, @Body() dto: BroadcastDto) { return this.svc.broadcast(u.id, dto); }
}
