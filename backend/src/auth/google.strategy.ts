import { ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AuthGuard, PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';

export const googleConfigured = () =>
  !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL);

/** Only registered as a provider when the Google env vars are set (see AuthModule). */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor() {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      scope: ['email', 'profile'],
    });
  }

  validate(_at: string, _rt: string, profile: Profile) {
    const email = profile.emails?.find((e) => (e as any).verified !== false)?.value;
    return { googleId: profile.id, email, name: profile.displayName, avatarUrl: profile.photos?.[0]?.value };
  }
}

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  canActivate(ctx: ExecutionContext) {
    if (!googleConfigured()) throw new ServiceUnavailableException('Google sign-in is not configured');
    return super.canActivate(ctx);
  }
}
