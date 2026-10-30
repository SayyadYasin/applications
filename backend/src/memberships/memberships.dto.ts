import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';

export class CreatePlanDto {
  @ApiProperty() @IsString() @MinLength(2) name: string;
  @ApiProperty({ description: 'Rupees' }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) price: number;
  @ApiProperty() @IsInt() @Min(1) @Max(3650) durationDays: number;
  @ApiPropertyOptional({ default: 0 }) @IsOptional() @IsNumber() @Min(0) @Max(100) discountPct?: number;
  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean() freeSurge?: boolean;
}

export class UpdatePlanDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) price?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(3650) durationDays?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) discountPct?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() freeSurge?: boolean;
}

export class PurchaseOrderDto {
  @ApiProperty() @IsString() planId: string;
}

export class PurchaseVerifyDto {
  @ApiProperty() @IsString() planId: string;
  @ApiProperty() @IsString() razorpayOrderId: string;
  @ApiProperty() @IsString() razorpayPaymentId: string;
  @ApiProperty() @IsString() razorpaySignature: string;
}
