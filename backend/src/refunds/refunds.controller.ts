import { Body, Controller, Get, NotFoundException, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsNumber, IsString, Min, MinLength } from 'class-validator';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard } from '../auth/roles';
import { RefundsService } from './refunds.service';

export class AdminRefundDto {
  @ApiProperty() @IsString() bookingId: string;
  @ApiProperty({ description: 'Rupees' }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) amount: number;
  @ApiProperty() @IsString() @MinLength(3) reason: string;
}

@ApiTags('refunds')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('refunds')
export class RefundsController {
  constructor(private svc: RefundsService) {}

  @Roles(Role.CUSTOMER) @Get('cancellation-preview/:bookingId')
  preview(@CurrentUser() u: JwtUser, @Param('bookingId') id: string) { return this.svc.previewCancellation(u.id, id); }

  @Roles(Role.ADMIN) @Post()
  async adminRefund(@Body() dto: AdminRefundDto) {
    const r = await this.svc.refund(dto.bookingId, dto.amount, dto.reason);
    if (!r) throw new NotFoundException('No paid payment found for booking');
    return r;
  }
}
