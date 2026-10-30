import { Module } from '@nestjs/common';
import { WalletModule } from '../wallet/wallet.module';
import { LoyaltyController } from './loyalty.controller';
import { LoyaltyService } from './loyalty.service';

@Module({
  imports: [WalletModule],
  controllers: [LoyaltyController],
  providers: [LoyaltyService],
  exports: [LoyaltyService],
})
export class LoyaltyReferralModule {}
