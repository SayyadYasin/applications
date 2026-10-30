import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard } from '../auth/roles';
import { StorageModule } from '../storage/storage.service';
import {
  LocationDto, PresignDocDto, RegisterDocDto, RejectDto, SetOnlineDto, SetServicesDto, SlotDto, UpdatePartnerProfileDto,
} from './partners.dto';
import { PartnersService } from './partners.service';

@ApiTags('partners')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.PARTNER)
@Controller('partners/me')
export class PartnerSelfController {
  constructor(private svc: PartnersService) {}

  @Get() profile(@CurrentUser() u: JwtUser) { return this.svc.getProfile(u.id); }
  @Patch() update(@CurrentUser() u: JwtUser, @Body() dto: UpdatePartnerProfileDto) { return this.svc.updateProfile(u.id, dto); }

  @Post('kyc/upload-url') presign(@CurrentUser() u: JwtUser, @Body() dto: PresignDocDto) { return this.svc.presignDoc(u.id, dto); }
  @Post('kyc/documents') registerDoc(@CurrentUser() u: JwtUser, @Body() dto: RegisterDocDto) { return this.svc.registerDoc(u.id, dto); }
  @Post('kyc/submit') submit(@CurrentUser() u: JwtUser) { return this.svc.submitKyc(u.id); }

  @Put('services') setServices(@CurrentUser() u: JwtUser, @Body() dto: SetServicesDto) { return this.svc.setServices(u.id, dto); }

  @Get('availability') slots(@CurrentUser() u: JwtUser) { return this.svc.listSlots(u.id); }
  @Post('availability') addSlot(@CurrentUser() u: JwtUser, @Body() dto: SlotDto) { return this.svc.addSlot(u.id, dto); }
  @Put('availability/:id') updateSlot(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: SlotDto) { return this.svc.updateSlot(u.id, id, dto); }
  @Delete('availability/:id') deleteSlot(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.svc.deleteSlot(u.id, id); }

  @Post('online') online(@CurrentUser() u: JwtUser, @Body() dto: SetOnlineDto) { return this.svc.setOnline(u.id, dto); }
  @Post('location') location(@CurrentUser() u: JwtUser, @Body() dto: LocationDto) { return this.svc.updateLocation(u.id, dto); }
}

@ApiTags('partners')
@Controller('partners')
export class PartnerPublicController {
  constructor(private svc: PartnersService) {}

  @Get(':id/public') publicProfile(@Param('id') id: string) { return this.svc.publicProfile(id); }
}

@ApiTags('partners-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/partners')
export class PartnerAdminController {
  constructor(private svc: PartnersService) {}

  @Get('kyc/pending') pending() { return this.svc.listPendingKyc(); }
  @Get('documents/:docId') doc(@Param('docId') docId: string) { return this.svc.documentDownloadInfo(docId); }

  @Post('documents/:docId/approve')
  approveDoc(@CurrentUser() u: JwtUser, @Param('docId') docId: string) { return this.svc.verifyDoc(u.id, docId, true); }

  @Post('documents/:docId/reject')
  rejectDoc(@CurrentUser() u: JwtUser, @Param('docId') docId: string, @Body() dto: RejectDto) { return this.svc.verifyDoc(u.id, docId, false, dto.reason); }

  @Post(':id/kyc/approve')
  approve(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.svc.decideKyc(u.id, id, true); }

  @Post(':id/kyc/reject')
  reject(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: RejectDto) { return this.svc.decideKyc(u.id, id, false, dto.reason); }
}

@Module({
  imports: [StorageModule],
  controllers: [PartnerSelfController, PartnerPublicController, PartnerAdminController],
  providers: [PartnersService],
  exports: [PartnersService],
})
export class PartnersModule {}
