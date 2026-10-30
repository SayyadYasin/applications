import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsInt, Min } from 'class-validator';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard } from '../auth/roles';
import { LoyaltyService } from './loyalty.service';

export class RedeemDto {
  @ApiProperty({ description: 'Multiple of 100; 100 points = Rs 10' }) @IsInt() @Min(100) points: number;
}

@ApiTags('loyalty')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class LoyaltyController {
  constructor(private svc: LoyaltyService) {}

  @Roles(Role.CUSTOMER) @Get('loyalty')
  summary(@CurrentUser() u: JwtUser) { return this.svc.summary(u.id); }

  @Roles(Role.CUSTOMER) @Post('loyalty/redeem')
  redeem(@CurrentUser() u: JwtUser, @Body() dto: RedeemDto) { return this.svc.redeem(u.id, dto.points); }

  @Roles(Role.CUSTOMER, Role.PARTNER) @Get('referrals/me')
  referral(@CurrentUser() u: JwtUser) { return this.svc.referralStats(u.id); }
}
