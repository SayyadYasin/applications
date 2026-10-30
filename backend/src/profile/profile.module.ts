import { Body, Controller, Delete, Get, Module, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, JwtUser, RolesGuard } from '../auth/roles';
import { StorageModule } from '../storage/storage.service';
import { AvatarUploadDto, CreateAddressDto, LatLngQuery, UpdateAddressDto, UpdateProfileDto } from './profile.dto';
import { ProfileService } from './profile.service';

@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('profile')
export class ProfileController {
  constructor(private svc: ProfileService) {}

  @Get() get(@CurrentUser() u: JwtUser) { return this.svc.getProfile(u.id); }
  @Patch() update(@CurrentUser() u: JwtUser, @Body() dto: UpdateProfileDto) { return this.svc.updateProfile(u.id, dto); }
  @Post('avatar/upload-url') avatar(@CurrentUser() u: JwtUser, @Body() dto: AvatarUploadDto) { return this.svc.avatarUploadUrl(u.id, dto); }
}

@ApiTags('addresses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('addresses')
export class AddressesController {
  constructor(private svc: ProfileService) {}

  @Get() list(@CurrentUser() u: JwtUser) { return this.svc.listAddresses(u.id); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() dto: CreateAddressDto) { return this.svc.createAddress(u.id, dto); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateAddressDto) { return this.svc.updateAddress(u.id, id, dto); }
  @Put(':id/default') setDefault(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.svc.setDefault(u.id, id); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.svc.deleteAddress(u.id, id); }
}

@ApiTags('geo')
@Controller('geo')
export class GeoController {
  constructor(private svc: ProfileService) {}

  @ApiBearerAuth() @UseGuards(JwtAuthGuard)
  @Get('reverse') reverse(@Query() q: LatLngQuery) { return this.svc.reverseGeocode(q.lat, q.lng); }

  @Get('towns') towns() { return this.svc.listTowns(); }
  @Get('nearest-town') nearest(@Query() q: LatLngQuery) { return this.svc.nearestTown(q.lat, q.lng); }
}

@Module({
  imports: [StorageModule],
  controllers: [ProfileController, AddressesController, GeoController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
