import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { PayoutStatus } from '@prisma/client';

export class RangeDto {
  @ApiPropertyOptional({ description: 'ISO date; default 30 days ago (daily) / 12 weeks ago (weekly)' })
  @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional({ description: 'ISO date; default now' }) @IsOptional() @IsDateString() to?: string;
}

export class AnalyticsDto {
  @ApiPropertyOptional({ default: 30, description: 'Look-back window in days' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(7) @Max(365) days?: number;
}

export class RequestPayoutDto {
  @ApiProperty({ description: 'Rupees' }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(1) amount: number;
  @ApiPropertyOptional() @IsOptional() @Matches(/^[\w.\-]{2,256}@[\w.\-]{2,64}$/, { message: 'Invalid UPI id' }) upiId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bankAccount?: string;
}

export class PayoutListDto {
  @ApiPropertyOptional({ enum: PayoutStatus }) @IsOptional() @IsEnum(PayoutStatus) status?: PayoutStatus;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class MarkPaidDto {
  @ApiProperty({ description: 'Bank/UPI transaction reference' }) @IsString() reference: string;
}

export class RejectPayoutDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}
