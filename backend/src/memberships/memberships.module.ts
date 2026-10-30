import { Body, Controller, Delete, Get, Module, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard } from '../auth/roles';
import { WalletModule } from '../wallet/wallet.module';
import { CreatePlanDto, PurchaseOrderDto, PurchaseVerifyDto, UpdatePlanDto } from './memberships.dto';
import { MembershipsService } from './memberships.service';

@ApiTags('memberships')
@Controller('memberships')
export class MembershipsController {
  constructor(private svc: MembershipsService) {}

  @Get('plans') plans() { return this.svc.listPlans(); }

  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.CUSTOMER) @Get('me')
  mine(@CurrentUser() u: JwtUser) { return this.svc.mine(u.id); }

  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.CUSTOMER) @Post('purchase/order')
  order(@CurrentUser() u: JwtUser, @Body() dto: PurchaseOrderDto) { return this.svc.createOrder(u.id, dto.planId); }

  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.CUSTOMER) @Post('purchase/verify')
  verify(@CurrentUser() u: JwtUser, @Body() dto: PurchaseVerifyDto) {
    return this.svc.verifyPurchase(u.id, dto.planId, dto.razorpayOrderId, dto.razorpayPaymentId, dto.razorpaySignature);
  }

  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.CUSTOMER) @Post('purchase/wallet')
  wallet(@CurrentUser() u: JwtUser, @Body() dto: PurchaseOrderDto) { return this.svc.purchaseWithWallet(u.id, dto.planId); }
}

@ApiTags('admin-memberships')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/memberships/plans')
export class AdminMembershipsController {
  constructor(private svc: MembershipsService) {}

  @Post() create(@Body() dto: CreatePlanDto) { return this.svc.createPlan(dto); }
  @Get() list() { return this.svc.listPlans(); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdatePlanDto) { return this.svc.updatePlan(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.svc.deletePlan(id); }
}

@Module({
  imports: [WalletModule],
  controllers: [MembershipsController, AdminMembershipsController],
  providers: [MembershipsService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
