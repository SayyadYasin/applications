import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty() @IsString() serviceId: string;
  @ApiProperty() @IsString() addressId: string;
  @ApiProperty() @IsDateString() scheduledAt: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isInstant?: boolean;
  @ApiProperty({ enum: PaymentMethod }) @IsEnum(PaymentMethod) paymentMethod: PaymentMethod;
  @ApiPropertyOptional() @IsOptional() @IsString() couponCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() preferredPartnerId?: string;
}

export class RescheduleDto {
  @ApiProperty() @IsDateString() scheduledAt: string;
}

export class CancelDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class CompleteDto {
  @ApiProperty() @IsString() otp: string;
}
