import { Body, Controller, Get, Patch, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { GoogleAuthGuard } from './google.strategy';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto, GoogleTokenDto, LoginDto, RegisterDto, RequestOtpDto, VerifyOtpDto } from './auth.dto';
import { AuthService } from './auth.service';
import { CurrentUser, JwtAuthGuard, JwtUser } from './roles';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private prisma: PrismaService) {}

  @Post('register') register(@Body() dto: RegisterDto) { return this.auth.register(dto); }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login') login(@Body() dto: LoginDto) { return this.auth.login(dto); }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/request') requestOtp(@Body() dto: RequestOtpDto) { return this.auth.requestOtp(dto); }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('otp/verify') verifyOtp(@Body() dto: VerifyOtpDto) { return this.auth.verifyOtp(dto); }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleStart() { /* redirected to Google by the guard */ }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const { accessToken } = await this.auth.googleLogin(req.user);
    res.redirect(`${process.env.WEB_URL ?? 'http://localhost:3000'}/auth/callback?token=${encodeURIComponent(accessToken)}`);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('google/token') googleToken(@Body() dto: GoogleTokenDto) { return this.auth.googleIdToken(dto.idToken); }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('password')
  changePassword(@CurrentUser() u: JwtUser, @Body() dto: ChangePasswordDto) { return this.auth.changePassword(u.id, dto); }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() u: JwtUser) {
    return this.prisma.user.findUnique({
      where: { id: u.id },
      select: { id: true, name: true, email: true, phone: true, role: true, language: true, referralCode: true },
    });
  }
}
