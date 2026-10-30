import { Module } from '@nestjs/common';
import { BookingsModule } from '../bookings/bookings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RefundsModule } from '../refunds/refunds.module';
import { AuditService } from './audit.service';
import { BroadcastService } from './broadcast.service';
import {
  BannersAdminController, CatalogAdminController, ContentAdminController, PricingRulesAdminController,
  PublicContentController, SettingsAdminController, TownsAdminController,
} from './catalog.controller';
import { CatalogAdminService } from './catalog.service';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { BookingsAdminController, PartnersAdminController, PaymentsAdminController } from './ops.controller';
import { OpsAdminService } from './ops.service';
import { BroadcastController, ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { UsersAdminController } from './users.controller';
import { UsersAdminService } from './users.service';

@Module({
  imports: [BookingsModule, RefundsModule, NotificationsModule],
  controllers: [
    DashboardController, UsersAdminController, PartnersAdminController, BookingsAdminController,
    PaymentsAdminController, CatalogAdminController, TownsAdminController, PricingRulesAdminController,
    BannersAdminController, ContentAdminController, SettingsAdminController, PublicContentController,
    ReportsController, BroadcastController,
  ],
  providers: [
    AuditService, DashboardService, UsersAdminService, OpsAdminService, CatalogAdminService,
    ReportsService, BroadcastService,
  ],
  exports: [AuditService],
})
export class AdminModule {}
