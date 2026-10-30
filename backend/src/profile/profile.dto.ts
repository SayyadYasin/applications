import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsLatitude, IsLongitude, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(2) @MaxLength(100) name?: string;
  @ApiPropertyOptional({ example: 'hi' }) @IsOptional() @IsString() @Matches(/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/) language?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() townId?: string;
  @ApiPropertyOptional({ description: 'Key returned by the avatar upload-url endpoint' }) @IsOptional() @IsString() @MaxLength(300) avatarKey?: string;
}

export class AvatarUploadDto {
  @ApiProperty({ example: 'image/jpeg' }) @IsIn(['image/jpeg', 'image/png', 'image/webp']) contentType: string;
}

export class CreateAddressDto {
  @ApiProperty() @IsString() @MaxLength(50) label: string;
  @ApiProperty() @IsString() @MaxLength(200) line1: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @ApiProperty() @IsString() @MaxLength(100) city: string;
  @ApiProperty() @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' }) pincode: string;
  @ApiProperty() @Type(() => Number) @IsLatitude() lat: number;
  @ApiProperty() @Type(() => Number) @IsLongitude() lng: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class UpdateAddressDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) label?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) line1?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) line2?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) city?: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^\d{6}$/) pincode?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLatitude() lat?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLongitude() lng?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
}

export class LatLngQuery {
  @ApiProperty() @Type(() => Number) @IsLatitude() lat: number;
  @ApiProperty() @Type(() => Number) @IsLongitude() lng: number;
}
