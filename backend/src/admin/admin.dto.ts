import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { BookingStatus, KycStatus, NotificationChannel, PaymentMethod, PaymentStatus, Role } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  ArrayNotEmpty, IsArray, IsBoolean, IsDateString, IsDefined, IsEmail, IsEnum, IsInt, IsNumber, IsObject,
  IsOptional, IsString, Max, MaxLength, Min, MinLength,
} from 'class-validator';

export class PageQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}

export class DateRangeDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}

// ---- users ----
export class ListUsersDto extends PageQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional({ enum: Role }) @IsOptional() @IsEnum(Role) role?: Role;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean() isActive?: boolean;
}
export class SetActiveDto { @ApiProperty() @IsBoolean() isActive: boolean; }
export class ChangeRoleDto { @ApiProperty({ enum: Role }) @IsEnum(Role) role: Role; }
export class CreateAdminDto {
  @ApiProperty() @IsString() @MinLength(2) name: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @MinLength(8) password: string;
  @ApiPropertyOptional({ enum: [Role.ADMIN, Role.SUPER_ADMIN] }) @IsOptional() @IsEnum(Role) role?: Role;
}

// ---- partners ----
export class ListPartnersDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: KycStatus }) @IsOptional() @IsEnum(KycStatus) kycStatus?: KycStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
}
export class CommissionDto {
  @ApiProperty({ nullable: true, description: 'Percent 0-100; null clears the override' })
  @IsOptional() @IsNumber() @Min(0) @Max(100) commissionPct: number | null;
}

// ---- bookings ----
export class ListBookingsDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: BookingStatus }) @IsOptional() @IsEnum(BookingStatus) status?: BookingStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() townId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() partnerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() customerId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}
export class ForceAssignDto { @ApiProperty() @IsString() partnerId: string; }
export class ForceCancelDto { @ApiPropertyOptional() @IsOptional() @IsString() reason?: string; }
export class AutoAssignDto { @ApiPropertyOptional() @IsOptional() @IsString() preferredPartnerId?: string; }

// ---- payments ----
export class ListPaymentsDto extends PageQueryDto {
  @ApiPropertyOptional({ enum: PaymentStatus }) @IsOptional() @IsEnum(PaymentStatus) status?: PaymentStatus;
  @ApiPropertyOptional({ enum: PaymentMethod }) @IsOptional() @IsEnum(PaymentMethod) method?: PaymentMethod;
  @ApiPropertyOptional() @IsOptional() @IsString() bookingId?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() from?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() to?: string;
}
export class ManualRefundDto {
  @ApiProperty() @IsString() bookingId: string;
  @ApiProperty() @IsNumber() @Min(1) amount: number;
  @ApiProperty() @IsString() @MinLength(3) reason: string;
}

// ---- catalog ----
export class CreateCategoryDto {
  @ApiProperty() @IsString() slug: string;
  @ApiProperty({ example: { en: 'Electrician', hi: 'Electrician (hi)' } }) @IsObject() name: Record<string, string>;
  @ApiPropertyOptional() @IsOptional() @IsString() iconUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateCategoryDto extends PartialType(CreateCategoryDto) {}

export class CreateSubCategoryDto {
  @ApiProperty() @IsString() categoryId: string;
  @ApiProperty() @IsString() slug: string;
  @ApiProperty() @IsObject() name: Record<string, string>;
}
export class UpdateSubCategoryDto extends PartialType(CreateSubCategoryDto) {}

export class CreateServiceAdminDto {
  @ApiProperty() @IsString() subCategoryId: string;
  @ApiPropertyOptional() @IsOptional() @IsString() townId?: string;
  @ApiProperty() @IsObject() name: Record<string, string>;
  @ApiPropertyOptional() @IsOptional() @IsObject() description?: Record<string, string>;
  @ApiProperty() @IsNumber() @Min(0) basePrice: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(15) durationMin?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) @Max(100) gstPct?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() hsnCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateServiceAdminDto extends PartialType(CreateServiceAdminDto) {}

export class CreateTownDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() state: string;
  @ApiProperty() @IsNumber() lat: number;
  @ApiProperty() @IsNumber() lng: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdateTownDto extends PartialType(CreateTownDto) {}

export class CreatePricingRuleDto {
  @ApiProperty() @IsString() name: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(23) startHour?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(24) endHour?: number;
  @ApiPropertyOptional({ type: [Number], description: '0=Sunday..6=Saturday; empty = every day' })
  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) weekdays?: number[];
  @ApiProperty() @IsNumber() @Min(0.5) @Max(5) multiplier: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
}
export class UpdatePricingRuleDto extends PartialType(CreatePricingRuleDto) {}

export class CreateBannerDto {
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsString() imageUrl: string;
  @ApiPropertyOptional() @IsOptional() @IsString() link?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() townId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() active?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}
export class UpdateBannerDto extends PartialType(CreateBannerDto) {}

export class CreateContentPageDto {
  @ApiProperty() @IsString() slug: string;
  @ApiProperty() @IsObject() title: Record<string, string>;
  @ApiProperty() @IsObject() body: Record<string, string>;
}
export class UpdateContentPageDto extends PartialType(CreateContentPageDto) {}

export class SettingValueDto { @ApiProperty() @IsDefined() value: unknown; }

export class BroadcastDto {
  @ApiProperty() @IsString() @MaxLength(120) title: string;
  @ApiProperty() @IsString() @MaxLength(1000) body: string;
  @ApiProperty({ enum: ['ALL', 'ROLE', 'TOWN'] }) @IsEnum(['ALL', 'ROLE', 'TOWN']) target: 'ALL' | 'ROLE' | 'TOWN';
  @ApiPropertyOptional({ enum: Role }) @IsOptional() @IsEnum(Role) role?: Role;
  @ApiPropertyOptional() @IsOptional() @IsString() townId?: string;
  @ApiPropertyOptional({ enum: NotificationChannel, isArray: true })
  @IsOptional() @IsArray() @ArrayNotEmpty() @IsEnum(NotificationChannel, { each: true }) channels?: NotificationChannel[];
}

export class AnalyticsQueryDto extends DateRangeDto {
  @ApiPropertyOptional({ enum: ['day', 'week', 'month'], default: 'day' })
  @IsOptional() @IsEnum(['day', 'week', 'month']) granularity?: 'day' | 'week' | 'month';
  @ApiPropertyOptional({ default: 10 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit?: number;
}
