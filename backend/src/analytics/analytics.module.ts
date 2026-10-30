import { Module } from '@nestjs/common';
import { PricingService } from '../bookings/pricing.service';
import { AnalyticsController, RecommendationsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { RecommendationsService } from './recommendations.service';

@Module({
  controllers: [AnalyticsController, RecommendationsController],
  providers: [AnalyticsService, RecommendationsService, PricingService],
})
export class AnalyticsModule {}
