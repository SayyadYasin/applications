import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard } from '../auth/roles';
import { PageDto } from '../wallet/wallet.dto';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './coupons.dto';
import { CouponsService } from './coupons.service';

@ApiTags('coupons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('coupons')
export class CouponsController {
  constructor(private svc: CouponsService) {}

  @Roles(Role.CUSTOMER) @Get('available')
  available(@CurrentUser() u: JwtUser) { return this.svc.available(u.id); }

  @Roles(Role.CUSTOMER) @Post('validate')
  validate(@CurrentUser() u: JwtUser, @Body() dto: ValidateCouponDto) { return this.svc.validate(u.id, dto); }
}

@ApiTags('admin-coupons')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/coupons')
export class AdminCouponsController {
  constructor(private svc: CouponsService) {}

  @Post() create(@Body() dto: CreateCouponDto) { return this.svc.create(dto); }
  @Get() list(@Query() q: PageDto) { return this.svc.list(q.page, q.limit); }
  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateCouponDto) { return this.svc.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.remove(id); }
}
