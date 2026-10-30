import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountType } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class CreateCouponDto {
  @ApiProperty() @Transform(({ value }) => String(value).trim().toUpperCase()) @Matches(/^[A-Z0-9_-]{3,32}$/) code: string;
  @ApiProperty({ enum: DiscountType }) @IsEnum(DiscountType) type: DiscountType;
  @ApiProperty({ description: 'Percent (0-100] or flat rupees' }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) value: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) maxDiscount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) minOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) usageLimit?: number;
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @IsInt() @Min(1) @Max(1000) perUserLimit?: number;
  @ApiProperty() @IsDateString() validFrom: string;
  @ApiProperty() @IsDateString() validTo: string;
  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() active?: boolean;
}

export class UpdateCouponDto {
  @ApiPropertyOptional({ enum: DiscountType }) @IsOptional() @IsEnum(DiscountType) type?: DiscountType;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) value?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) maxDiscount?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) minOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) usageLimit?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(1000) perUserLimit?: number;
  @ApiPropertyOptional() @IsOptional() @IsDateString() validFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() validTo?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}

export class ValidateCouponDto {
  @ApiProperty() @Transform(({ value }) => String(value).trim().toUpperCase()) @IsString() code: string;
  @ApiProperty() @IsString() serviceId: string;
  @ApiPropertyOptional({ description: 'Defaults to now' }) @IsOptional() @IsDateString() scheduledAt?: string;
}
