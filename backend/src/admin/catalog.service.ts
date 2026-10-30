import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBannerDto, CreateCategoryDto, CreateContentPageDto, CreatePricingRuleDto, CreateServiceAdminDto,
  CreateSubCategoryDto, CreateTownDto, UpdateBannerDto, UpdateCategoryDto, UpdateContentPageDto,
  UpdatePricingRuleDto, UpdateServiceAdminDto, UpdateSubCategoryDto, UpdateTownDto,
} from './admin.dto';
import { safeDelete } from './admin.util';
import { AuditService } from './audit.service';

const json = (v: unknown) => v as Prisma.InputJsonValue;

/** Catalog, towns, pricing rules, banners, CMS pages and settings. Every mutation is audited. */
@Injectable()
export class CatalogAdminService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private async must<T>(p: Promise<T | null>, what: string): Promise<T> {
    const r = await p;
    if (!r) throw new NotFoundException(`${what} not found`);
    return r;
  }

  // ---- categories ----
  listCategories() {
    return this.prisma.serviceCategory.findMany({ orderBy: { sortOrder: 'asc' }, include: { subCategories: true } });
  }
  async createCategory(actor: string, dto: CreateCategoryDto) {
    const r = await this.prisma.serviceCategory.create({ data: { ...dto, name: json(dto.name) } });
    await this.audit.record(actor, 'CATEGORY_CREATE', 'ServiceCategory', r.id, dto);
    return r;
  }
  async updateCategory(actor: string, id: string, dto: UpdateCategoryDto) {
    await this.must(this.prisma.serviceCategory.findUnique({ where: { id } }), 'Category');
    const r = await this.prisma.serviceCategory.update({ where: { id }, data: { ...dto, name: dto.name ? json(dto.name) : undefined } });
    await this.audit.record(actor, 'CATEGORY_UPDATE', 'ServiceCategory', id, dto);
    return r;
  }
  async deleteCategory(actor: string, id: string) {
    await safeDelete(() => this.prisma.serviceCategory.delete({ where: { id } }), 'Category');
    await this.audit.record(actor, 'CATEGORY_DELETE', 'ServiceCategory', id);
    return { deleted: true };
  }

  // ---- sub-categories ----
  listSubCategories(categoryId?: string) {
    return this.prisma.serviceSubCategory.findMany({ where: { categoryId }, orderBy: { slug: 'asc' } });
  }
  async createSubCategory(actor: string, dto: CreateSubCategoryDto) {
    const r = await this.prisma.serviceSubCategory.create({ data: { ...dto, name: json(dto.name) } });
    await this.audit.record(actor, 'SUBCATEGORY_CREATE', 'ServiceSubCategory', r.id, dto);
    return r;
  }
  async updateSubCategory(actor: string, id: string, dto: UpdateSubCategoryDto) {
    await this.must(this.prisma.serviceSubCategory.findUnique({ where: { id } }), 'Sub-category');
    const r = await this.prisma.serviceSubCategory.update({ where: { id }, data: { ...dto, name: dto.name ? json(dto.name) : undefined } });
    await this.audit.record(actor, 'SUBCATEGORY_UPDATE', 'ServiceSubCategory', id, dto);
    return r;
  }
  async deleteSubCategory(actor: string, id: string) {
    await safeDelete(() => this.prisma.serviceSubCategory.delete({ where: { id } }), 'Sub-category');
    await this.audit.record(actor, 'SUBCATEGORY_DELETE', 'ServiceSubCategory', id);
    return { deleted: true };
  }

  // ---- services ----
  listServices(subCategoryId?: string) {
    return this.prisma.service.findMany({ where: { subCategoryId }, orderBy: { id: 'asc' } });
  }
  async createService(actor: string, dto: CreateServiceAdminDto) {
    const r = await this.prisma.service.create({
      data: { ...dto, name: json(dto.name), description: dto.description ? json(dto.description) : undefined },
    });
    await this.audit.record(actor, 'SERVICE_CREATE', 'Service', r.id, dto);
    return r;
  }
  async updateService(actor: string, id: string, dto: UpdateServiceAdminDto) {
    await this.must(this.prisma.service.findUnique({ where: { id } }), 'Service');
    const r = await this.prisma.service.update({
      where: { id },
      data: { ...dto, name: dto.name ? json(dto.name) : undefined, description: dto.description ? json(dto.description) : undefined },
    });
    await this.audit.record(actor, 'SERVICE_UPDATE', 'Service', id, dto);
    return r;
  }
  /** Services are referenced by bookings, so deleting soft-deactivates unless nothing references it. */
  async deleteService(actor: string, id: string) {
    await this.must(this.prisma.service.findUnique({ where: { id } }), 'Service');
    const used = await this.prisma.booking.count({ where: { serviceId: id } });
    if (used) await this.prisma.service.update({ where: { id }, data: { active: false } });
    else {
      await this.prisma.partnerService.deleteMany({ where: { serviceId: id } });
      await this.prisma.service.delete({ where: { id } });
    }
    await this.audit.record(actor, 'SERVICE_DELETE', 'Service', id, { softDeleted: used > 0 });
    return { deleted: used === 0, deactivated: used > 0 };
  }

  // ---- towns ----
  listTowns() { return this.prisma.town.findMany({ orderBy: { name: 'asc' } }); }
  async createTown(actor: string, dto: CreateTownDto) {
    const r = await this.prisma.town.create({ data: dto });
    await this.audit.record(actor, 'TOWN_CREATE', 'Town', r.id, dto);
    return r;
  }
  async updateTown(actor: string, id: string, dto: UpdateTownDto) {
    await this.must(this.prisma.town.findUnique({ where: { id } }), 'Town');
    const r = await this.prisma.town.update({ where: { id }, data: dto });
    await this.audit.record(actor, 'TOWN_UPDATE', 'Town', id, dto);
    return r;
  }
  async deleteTown(actor: string, id: string) {
    await safeDelete(() => this.prisma.town.delete({ where: { id } }), 'Town');
    await this.audit.record(actor, 'TOWN_DELETE', 'Town', id);
    return { deleted: true };
  }

  // ---- pricing rules ----
  listPricingRules() { return this.prisma.pricingRule.findMany({ orderBy: { name: 'asc' } }); }
  async createPricingRule(actor: string, dto: CreatePricingRuleDto) {
    const r = await this.prisma.pricingRule.create({ data: dto });
    await this.audit.record(actor, 'PRICING_RULE_CREATE', 'PricingRule', r.id, dto);
    return r;
  }
  async updatePricingRule(actor: string, id: string, dto: UpdatePricingRuleDto) {
    await this.must(this.prisma.pricingRule.findUnique({ where: { id } }), 'Pricing rule');
    const r = await this.prisma.pricingRule.update({ where: { id }, data: dto });
    await this.audit.record(actor, 'PRICING_RULE_UPDATE', 'PricingRule', id, dto);
    return r;
  }
  async deletePricingRule(actor: string, id: string) {
    await this.must(this.prisma.pricingRule.findUnique({ where: { id } }), 'Pricing rule');
    await this.prisma.pricingRule.delete({ where: { id } });
    await this.audit.record(actor, 'PRICING_RULE_DELETE', 'PricingRule', id);
    return { deleted: true };
  }

  // ---- banners ----
  listBanners() { return this.prisma.banner.findMany({ orderBy: { sortOrder: 'asc' } }); }
  publicBanners(townId?: string) {
    return this.prisma.banner.findMany({
      where: { active: true, ...(townId && { OR: [{ townId }, { townId: null }] }) },
      orderBy: { sortOrder: 'asc' },
    });
  }
  async createBanner(actor: string, dto: CreateBannerDto) {
    const r = await this.prisma.banner.create({ data: dto });
    await this.audit.record(actor, 'BANNER_CREATE', 'Banner', r.id, dto);
    return r;
  }
  async updateBanner(actor: string, id: string, dto: UpdateBannerDto) {
    await this.must(this.prisma.banner.findUnique({ where: { id } }), 'Banner');
    const r = await this.prisma.banner.update({ where: { id }, data: dto });
    await this.audit.record(actor, 'BANNER_UPDATE', 'Banner', id, dto);
    return r;
  }
  async deleteBanner(actor: string, id: string) {
    await this.must(this.prisma.banner.findUnique({ where: { id } }), 'Banner');
    await this.prisma.banner.delete({ where: { id } });
    await this.audit.record(actor, 'BANNER_DELETE', 'Banner', id);
    return { deleted: true };
  }

  // ---- CMS pages ----
  listPages() { return this.prisma.contentPage.findMany({ orderBy: { slug: 'asc' } }); }
  publicPage(slug: string) { return this.must(this.prisma.contentPage.findUnique({ where: { slug } }), 'Page'); }
  async createPage(actor: string, dto: CreateContentPageDto) {
    const r = await this.prisma.contentPage.create({ data: { slug: dto.slug, title: json(dto.title), body: json(dto.body) } });
    await this.audit.record(actor, 'CONTENT_CREATE', 'ContentPage', r.id, { slug: dto.slug });
    return r;
  }
  async updatePage(actor: string, id: string, dto: UpdateContentPageDto) {
    await this.must(this.prisma.contentPage.findUnique({ where: { id } }), 'Page');
    const r = await this.prisma.contentPage.update({
      where: { id },
      data: { slug: dto.slug, title: dto.title ? json(dto.title) : undefined, body: dto.body ? json(dto.body) : undefined },
    });
    await this.audit.record(actor, 'CONTENT_UPDATE', 'ContentPage', id, { slug: r.slug });
    return r;
  }
  async deletePage(actor: string, id: string) {
    await this.must(this.prisma.contentPage.findUnique({ where: { id } }), 'Page');
    await this.prisma.contentPage.delete({ where: { id } });
    await this.audit.record(actor, 'CONTENT_DELETE', 'ContentPage', id);
    return { deleted: true };
  }

  // ---- settings ----
  listSettings() { return this.prisma.setting.findMany({ orderBy: { key: 'asc' } }); }
  getSetting(key: string) { return this.must(this.prisma.setting.findUnique({ where: { key } }), 'Setting'); }
  async setSetting(actor: string, key: string, value: unknown) {
    const before = await this.prisma.setting.findUnique({ where: { key } });
    const r = await this.prisma.setting.upsert({
      where: { key },
      create: { key, value: json(value) },
      update: { value: json(value) },
    });
    await this.audit.record(actor, 'SETTING_SET', 'Setting', key, { from: before?.value ?? null, to: value });
    return r;
  }
}
