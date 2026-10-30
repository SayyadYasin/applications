import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateReviewDto {
  @ApiProperty() @IsString() bookingId: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) @Type(() => Number) @IsInt() @Min(1) @Max(5) rating: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) comment?: string;
}

export class ReplyDto {
  @ApiProperty() @IsString() @MaxLength(1000) reply: string;
}
