import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsLatitude, IsLongitude, IsNumber, IsOptional, IsString,
  Max, MaxLength, Min, ValidateNested,
} from 'class-validator';

export const DOC_TYPES = ['AADHAAR', 'PAN', 'LICENSE', 'SELFIE'] as const;
export type DocType = (typeof DOC_TYPES)[number];

export class UpdatePartnerProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) bio?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(1) @Max(100) radiusKm?: number;
}

export class PresignDocDto {
  @ApiProperty({ enum: DOC_TYPES }) @IsIn(DOC_TYPES as unknown as string[]) type: DocType;
  @ApiProperty({ example: 'image/jpeg' }) @IsString() contentType: string;
}

export class RegisterDocDto {
  @ApiProperty({ enum: DOC_TYPES }) @IsIn(DOC_TYPES as unknown as string[]) type: DocType;
  @ApiProperty({ description: 'Key returned by the presign endpoint' }) @IsString() @MaxLength(300) key: string;
}

export class RejectDto {
  @ApiProperty() @IsString() @MaxLength(500) reason: string;
}

export class PartnerServiceItemDto {
  @ApiProperty() @IsString() serviceId: string;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) customPrice?: number;
}

export class SetServicesDto {
  @ApiProperty({ type: [PartnerServiceItemDto] })
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => PartnerServiceItemDto)
  services: PartnerServiceItemDto[];
}

export class SlotDto {
  @ApiProperty({ minimum: 0, maximum: 6 }) @Type(() => Number) @IsInt() @Min(0) @Max(6) weekday: number;
  @ApiProperty({ description: 'Minutes from midnight' }) @Type(() => Number) @IsInt() @Min(0) @Max(1439) startMin: number;
  @ApiProperty() @Type(() => Number) @IsInt() @Min(1) @Max(1440) endMin: number;
}

export class SetOnlineDto {
  @ApiProperty() @IsBoolean() online: boolean;
  @ApiPropertyOptional() @IsOptional() @IsLatitude() lat?: number;
  @ApiPropertyOptional() @IsOptional() @IsLongitude() lng?: number;
}

export class LocationDto {
  @ApiProperty() @IsLatitude() lat: number;
  @ApiProperty() @IsLongitude() lng: number;
}
