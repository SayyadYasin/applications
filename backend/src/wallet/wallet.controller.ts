import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard } from '../auth/roles';
import { PageDto, TopUpOrderDto, TopUpVerifyDto } from './wallet.dto';
import { WalletPaymentsService } from './wallet-payments.service';
import { WalletService } from './wallet.service';

@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('wallet')
export class WalletController {
  constructor(private svc: WalletService, private pay: WalletPaymentsService) {}

  @Roles(Role.CUSTOMER, Role.PARTNER) @Get()
  balance(@CurrentUser() u: JwtUser) { return this.svc.getBalance(u.id); }

  @Roles(Role.CUSTOMER, Role.PARTNER) @Get('transactions')
  txns(@CurrentUser() u: JwtUser, @Query() q: PageDto) { return this.svc.transactions(u.id, q.page, q.limit); }

  @Roles(Role.CUSTOMER, Role.PARTNER) @Post('topup/order')
  topUpOrder(@CurrentUser() u: JwtUser, @Body() dto: TopUpOrderDto) { return this.pay.createTopUpOrder(u.id, dto.amount); }

  @Roles(Role.CUSTOMER, Role.PARTNER) @Post('topup/verify')
  topUpVerify(@CurrentUser() u: JwtUser, @Body() dto: TopUpVerifyDto) {
    return this.pay.verifyTopUp(u.id, dto.razorpayOrderId, dto.razorpayPaymentId, dto.razorpaySignature);
  }

  @Roles(Role.CUSTOMER) @Post('pay-booking/:bookingId')
  payBooking(@CurrentUser() u: JwtUser, @Param('bookingId') id: string) { return this.pay.payBooking(u.id, id); }
}
