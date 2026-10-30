import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy, googleConfigured } from './google.strategy';
import { JwtStrategy } from './jwt.strategy';
import { RolesGuard } from './roles';

@Global()
@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({ secret: c.getOrThrow('JWT_SECRET'), signOptions: { expiresIn: '7d' } }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RolesGuard, 
    // Evaluated lazily (after ConfigModule loaded .env); the strategy only registers with passport when env is present.
    { provide: GoogleStrategy, useFactory: () => (googleConfigured() ? new GoogleStrategy() : null) },
  ],
  exports: [RolesGuard, AuthService],
})
export class AuthModule {}
