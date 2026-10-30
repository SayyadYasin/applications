import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SendMessageDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(2000) body: string;
}

export class ListMessagesQuery {
  @ApiPropertyOptional({ description: 'Message id cursor: returns messages older than this' }) @IsOptional() @IsString() before?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit?: number;
}
