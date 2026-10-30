import { BadRequestException, ConflictException, Injectable, Logger, Optional, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ChangePasswordDto, LoginDto, RegisterDto, RequestOtpDto, VerifyOtpDto } from './auth.dto';

const OTP_TTL_MS = 5 * 60_000;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  private log = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    @Optional() private notifications?: NotificationsService,
  ) {}

  token(user: { id: string; role: Role }) {
    return { accessToken: this.jwt.sign({ sub: user.id, role: user.role }), role: user.role };
  }

  /** Creates the user plus the role profile and wallet in one transaction. */
  createUser(data: { name: string; email?: string; phone?: string; passwordHash?: string; googleId?: string; avatarUrl?: string; role: Role; referredById?: string }) {
    return this.prisma.user.create({
      data: {
        ...data,
        wallet: { create: {} },
        ...(data.role === Role.PARTNER ? { partner: { create: {} } } : { customer: { create: {} } }),
      },
    });
  }

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, ...(dto.phone ? [{ phone: dto.phone }] : [])] },
    });
    if (exists) throw new ConflictException('Email or phone already registered');

    const referrer = dto.referralCode
      ? await this.prisma.user.findUnique({ where: { referralCode: dto.referralCode } })
      : null;

    // Role is limited to CUSTOMER/PARTNER by the DTO; admins are created by seed/super admin only.
    const user = await this.createUser({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      passwordHash: await bcrypt.hash(dto.password, 12),
      role: (dto.role as Role) ?? Role.CUSTOMER,
      referredById: referrer?.id,
    });
    return this.token(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user?.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash)) || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.token(user);
  }

  async requestOtp({ phone }: RequestOtpDto) {
    const recent = await this.prisma.otp.count({ where: { phone, createdAt: { gt: new Date(Date.now() - 60_000) } } });
    if (recent) throw new BadRequestException('Please wait before requesting another OTP');

    const code = String(randomInt(100000, 1000000));
    await this.prisma.otp.create({
      data: { phone, codeHash: await bcrypt.hash(code, 8), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });
    if (this.notifications) {
      try {
        await this.notifications.sendSmsToPhone(phone, {
          title: 'Your TownServices OTP',
          body: `${code} is your TownServices verification code. Valid for 5 minutes.`,
          data: { otp: code },
        });
      } catch (e) {
        this.log.error(`OTP SMS delivery failed for ${phone}: ${(e as Error).message}`);
      }
    }
    // Never log OTPs in production.
    if (process.env.NODE_ENV !== 'production') this.log.debug(`OTP for ${phone}: ${code}`);
    return { sent: true };
  }

  /** Find-or-create by googleId, then by verified email (linking the Google id), else create a customer. */
  async googleLogin(p: { googleId: string; email?: string; name?: string; avatarUrl?: string }) {
    let user = await this.prisma.user.findUnique({ where: { googleId: p.googleId } });
    if (!user && p.email) {
      const byEmail = await this.prisma.user.findUnique({ where: { email: p.email } });
      if (byEmail) user = await this.prisma.user.update({ where: { id: byEmail.id }, data: { googleId: p.googleId, avatarUrl: byEmail.avatarUrl ?? p.avatarUrl } });
    }
    user ??= await this.createUser({
      name: p.name ?? p.email?.split('@')[0] ?? 'Customer',
      email: p.email,
      googleId: p.googleId,
      avatarUrl: p.avatarUrl,
      role: Role.CUSTOMER,
    });
    if (!user.isActive) throw new UnauthorizedException('Account disabled');
    return this.token(user);
  }

  /** Verifies a Google ID token via Google's tokeninfo endpoint (for the PWA). */
  async googleIdToken(idToken: string) {
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!res.ok) throw new UnauthorizedException('Invalid Google token');
    const info: any = await res.json();
    const aud = process.env.GOOGLE_CLIENT_ID;
    if (aud && info.aud !== aud) throw new UnauthorizedException('Google token audience mismatch');
    if (!info.sub || (info.email && String(info.email_verified) !== 'true')) throw new UnauthorizedException('Google account not verified');
    return this.googleLogin({ googleId: info.sub, email: info.email, name: info.name, avatarUrl: info.picture });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    // Accounts created via OTP/Google have no password yet; they may set one without a current password.
    if (user.passwordHash) {
      if (!dto.currentPassword || !(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(dto.newPassword, 12) } });
    return { changed: true };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const otp = await this.prisma.otp.findFirst({ where: { phone: dto.phone }, orderBy: { createdAt: 'desc' } });
    if (!otp || otp.expiresAt < new Date() || otp.attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException('OTP expired or invalid');
    }
    if (!(await bcrypt.compare(dto.code, otp.codeHash))) {
      await this.prisma.otp.update({ where: { id: otp.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException('OTP expired or invalid');
    }
    await this.prisma.otp.deleteMany({ where: { phone: dto.phone } });

    const user =
      (await this.prisma.user.findUnique({ where: { phone: dto.phone } })) ??
      (await this.createUser({ name: dto.name ?? 'Customer', phone: dto.phone, role: Role.CUSTOMER }));
    if (!user.isActive) throw new UnauthorizedException('Account disabled');
    return this.token(user);
  }
}
