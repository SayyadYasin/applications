import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

export enum SelfSignupRole { CUSTOMER = 'CUSTOMER', PARTNER = 'PARTNER' }

export class RegisterDto {
  @ApiProperty() @IsString() @MinLength(2) name: string;
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() @MinLength(8) password: string;
  @ApiPropertyOptional() @IsOptional() @Matches(/^[6-9]\d{9}$/) phone?: string;
  @ApiPropertyOptional({ enum: SelfSignupRole }) @IsOptional() @IsEnum(SelfSignupRole) role?: SelfSignupRole;
  @ApiPropertyOptional() @IsOptional() @IsString() referralCode?: string;
}

export class LoginDto {
  @ApiProperty() @IsEmail() email: string;
  @ApiProperty() @IsString() password: string;
}

export class GoogleTokenDto {
  @ApiProperty() @IsString() idToken: string;
}

export class ChangePasswordDto {
  @ApiPropertyOptional() @IsOptional() @IsString() currentPassword?: string;
  @ApiProperty() @IsString() @MinLength(8) newPassword: string;
}

export class RequestOtpDto {
  @ApiProperty({ example: '9876543210' }) @Matches(/^[6-9]\d{9}$/) phone: string;
}

export class VerifyOtpDto extends RequestOtpDto {
  @ApiProperty() @IsString() @Length(6, 6) code: string;
  @ApiPropertyOptional() @IsOptional() @IsString() name?: string;
}
