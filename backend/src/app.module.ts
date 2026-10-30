import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { BookingsModule } from './bookings/bookings.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ChatModule } from './chat/chat.module';
import { SupportModule } from './support/support.module';
import { PartnersModule } from './partners/partners.module';
import { ProfileModule } from './profile/profile.module';
import { InvoicesModule } from './invoices/invoices.module';
import { WalletModule } from './wallet/wallet.module';
import { EarningsModule } from './earnings/earnings.module';
import { PayoutsAdminModule } from './payouts-admin/payouts-admin.module';
import { RefundsModule } from './refunds/refunds.module';
import { CouponsModule } from './coupons/coupons.module';
import { ReviewsModule } from './reviews/reviews.module';
import { LoyaltyReferralModule } from './loyalty-referral/loyalty-referral.module';
import { MembershipsModule } from './memberships/memberships.module';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    NotificationsModule,
    ChatModule,
    CatalogModule,
    BookingsModule,
    PaymentsModule,
    SupportModule,
    PartnersModule,
    ProfileModule,
    InvoicesModule,
    WalletModule,
    EarningsModule,
    PayoutsAdminModule,
    RefundsModule,
    CouponsModule,
    ReviewsModule,
    LoyaltyReferralModule,
    MembershipsModule,
    AdminModule,
    AnalyticsModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
