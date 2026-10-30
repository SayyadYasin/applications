import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateTicketDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) subject: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(5000) body: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bookingId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDispute?: boolean;
}

export class AdminListTicketsQuery {
  @ApiPropertyOptional({ enum: TicketStatus }) @IsOptional() @IsEnum(TicketStatus) status?: TicketStatus;
  @ApiPropertyOptional() @IsOptional() @Transform(({ value }) => value === 'true' || value === true) @IsBoolean() isDispute?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() userId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bookingId?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) take?: number;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) skip?: number;
}

export class UpdateTicketDto {
  @ApiPropertyOptional({ enum: TicketStatus }) @IsOptional() @IsEnum(TicketStatus) status?: TicketStatus;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) resolution?: string;
}

export class ResolveDisputeDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(5000) resolution: string;
  @ApiPropertyOptional({ enum: [TicketStatus.RESOLVED, TicketStatus.CLOSED], default: TicketStatus.RESOLVED })
  @IsOptional() @IsEnum(TicketStatus) status?: TicketStatus;
}
