import { Module } from '@nestjs/common';
import { PricingService } from '../bookings/pricing.service';
import { AdminCouponsController, CouponsController } from './coupons.controller';
import { CouponsService } from './coupons.service';

@Module({
  controllers: [CouponsController, AdminCouponsController],
  providers: [CouponsService, PricingService], // PricingService only needs PrismaService (global)
  exports: [CouponsService],
})
export class CouponsModule {}
