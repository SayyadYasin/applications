import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard, Roles, RolesGuard } from '../auth/roles';
import { DashboardService } from './dashboard.service';

@ApiTags('admin/dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private svc: DashboardService) {}

  @ApiOperation({ summary: 'KPIs for today / 7d / 30d plus pending KYC and open tickets' })
  @Get()
  kpis() { return this.svc.kpis(); }
}
