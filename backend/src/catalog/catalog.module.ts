import { Body, Controller, Get, Module, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsInt, IsNumber, IsObject, IsString, Min } from 'class-validator';
import { JwtAuthGuard, Roles, RolesGuard } from '../auth/roles';
import { PrismaService } from '../prisma/prisma.service';

class CreateServiceDto {
  @IsString() subCategoryId: string;
  @IsObject() name: Record<string, string>;
  @IsNumber() @Min(0) basePrice: number;
  @IsInt() @Min(15) durationMin: number;
}

@ApiTags('catalog')
@Controller()
export class CatalogController {
  constructor(private prisma: PrismaService) {}

  @Get('categories')
  categories() {
    return this.prisma.serviceCategory.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      include: { subCategories: true },
    });
  }

  /** Simple search over the JSON name field (English). Swap for pg_trgm / Meilisearch at scale. */
  @Get('services')
  services(@Query('q') q?: string, @Query('townId') townId?: string, @Query('subCategoryId') subCategoryId?: string) {
    return this.prisma.service.findMany({
      where: {
        active: true,
        ...(subCategoryId && { subCategoryId }),
        ...(townId && { OR: [{ townId }, { townId: null }] }),
        ...(q && { name: { path: ['en'], string_contains: q } }),
      },
      take: 50,
    });
  }

  @Get('services/:id')
  service(@Param('id') id: string) {
    return this.prisma.service.findUniqueOrThrow({ where: { id } });
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/services')
  create(@Body() dto: CreateServiceDto) {
    return this.prisma.service.create({ data: dto });
  }
}

@Module({ controllers: [CatalogController] })
export class CatalogModule {}
