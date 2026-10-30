import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard } from '../auth/roles';
import {
  CreateBannerDto, CreateCategoryDto, CreateContentPageDto, CreatePricingRuleDto, CreateServiceAdminDto,
  CreateSubCategoryDto, CreateTownDto, SettingValueDto, UpdateBannerDto, UpdateCategoryDto,
  UpdateContentPageDto, UpdatePricingRuleDto, UpdateServiceAdminDto, UpdateSubCategoryDto, UpdateTownDto,
} from './admin.dto';
import { CatalogAdminService } from './catalog.service';

// NOTE: catalog resources live under admin/catalog/* to avoid clashing with CatalogModule's POST admin/services.
@ApiTags('admin/catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/catalog')
export class CatalogAdminController {
  constructor(private svc: CatalogAdminService) {}

  @Get('categories') categories() { return this.svc.listCategories(); }
  @Post('categories') createCategory(@CurrentUser() u: JwtUser, @Body() d: CreateCategoryDto) { return this.svc.createCategory(u.id, d); }
  @Patch('categories/:id') updateCategory(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() d: UpdateCategoryDto) { return this.svc.updateCategory(u.id, id, d); }
  @Delete('categories/:id') deleteCategory(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.svc.deleteCategory(u.id, id); }

  @Get('sub-categories') subCategories(@Query('categoryId') categoryId?: string) { return this.svc.listSubCategories(categoryId); }
  @Post('sub-categories') createSub(@CurrentUser() u: JwtUser, @Body() d: CreateSubCategoryDto) { return this.svc.createSubCategory(u.id, d); }
  @Patch('sub-categories/:id') updateSub(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() d: UpdateSubCategoryDto) { return this.svc.updateSubCategory(u.id, id, d); }
  @Delete('sub-categories/:id') deleteSub(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.svc.deleteSubCategory(u.id, id); }

  @Get('services') services(@Query('subCategoryId') subCategoryId?: string) { return this.svc.listServices(subCategoryId); }
  @Post('services') createService(@CurrentUser() u: JwtUser, @Body() d: CreateServiceAdminDto) { return this.svc.createService(u.id, d); }
  @Patch('services/:id') updateService(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() d: UpdateServiceAdminDto) { return this.svc.updateService(u.id, id, d); }
  @Delete('services/:id') deleteService(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.svc.deleteService(u.id, id); }
}

@ApiTags('admin/towns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/towns')
export class TownsAdminController {
  constructor(private svc: CatalogAdminService) {}

  @Get() list() { return this.svc.listTowns(); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() d: CreateTownDto) { return this.svc.createTown(u.id, d); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() d: UpdateTownDto) { return this.svc.updateTown(u.id, id, d); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.svc.deleteTown(u.id, id); }
}

@ApiTags('admin/pricing-rules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/pricing-rules')
export class PricingRulesAdminController {
  constructor(private svc: CatalogAdminService) {}

  @Get() list() { return this.svc.listPricingRules(); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() d: CreatePricingRuleDto) { return this.svc.createPricingRule(u.id, d); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() d: UpdatePricingRuleDto) { return this.svc.updatePricingRule(u.id, id, d); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.svc.deletePricingRule(u.id, id); }
}

@ApiTags('admin/banners')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/banners')
export class BannersAdminController {
  constructor(private svc: CatalogAdminService) {}

  @Get() list() { return this.svc.listBanners(); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() d: CreateBannerDto) { return this.svc.createBanner(u.id, d); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() d: UpdateBannerDto) { return this.svc.updateBanner(u.id, id, d); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.svc.deleteBanner(u.id, id); }
}

@ApiTags('admin/content')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/content')
export class ContentAdminController {
  constructor(private svc: CatalogAdminService) {}

  @Get() list() { return this.svc.listPages(); }
  @Post() create(@CurrentUser() u: JwtUser, @Body() d: CreateContentPageDto) { return this.svc.createPage(u.id, d); }
  @Patch(':id') update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() d: UpdateContentPageDto) { return this.svc.updatePage(u.id, id, d); }
  @Delete(':id') remove(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.svc.deletePage(u.id, id); }
}

@ApiTags('admin/settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/settings')
export class SettingsAdminController {
  constructor(private svc: CatalogAdminService) {}

  @Get() list() { return this.svc.listSettings(); }
  @Get(':key') get(@Param('key') key: string) { return this.svc.getSetting(key); }

  /** Known keys: commission.default (percent), gst.rate (percent), tax.config (object). */
  @Roles(Role.SUPER_ADMIN) @Put(':key')
  set(@CurrentUser() u: JwtUser, @Param('key') key: string, @Body() d: SettingValueDto) { return this.svc.setSetting(u.id, key, d.value); }
}

/** Unauthenticated read endpoints for the apps. */
@ApiTags('public-content')
@Controller()
export class PublicContentController {
  constructor(private svc: CatalogAdminService) {}

  @Get('content/:slug') page(@Param('slug') slug: string) { return this.svc.publicPage(slug); }
  @Get('banners') banners(@Query('townId') townId?: string) { return this.svc.publicBanners(townId); }
}
