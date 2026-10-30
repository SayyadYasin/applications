import { Body, Controller, Delete, Get, Module, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard } from '../auth/roles';
import { PageDto } from '../wallet/wallet.dto';
import { CreateReviewDto, ReplyDto } from './reviews.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('reviews')
@Controller()
export class ReviewsController {
  constructor(private svc: ReviewsService) {}

  // Public
  @Get('partners/:partnerId/reviews')
  byPartner(@Param('partnerId') id: string, @Query() q: PageDto) { return this.svc.byPartner(id, q.page, q.limit); }

  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.CUSTOMER) @Post('reviews')
  create(@CurrentUser() u: JwtUser, @Body() dto: CreateReviewDto) { return this.svc.create(u.id, dto); }

  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.PARTNER) @Get('reviews/mine')
  mine(@CurrentUser() u: JwtUser, @Query() q: PageDto) { return this.svc.mine(u.id, q.page, q.limit); }

  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.PARTNER) @Post('reviews/:id/reply')
  reply(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: ReplyDto) { return this.svc.reply(u.id, id, dto.reply); }

  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.CUSTOMER) @Get('favorites')
  favorites(@CurrentUser() u: JwtUser) { return this.svc.listFavorites(u.id); }

  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.CUSTOMER) @Post('favorites/:partnerId')
  add(@CurrentUser() u: JwtUser, @Param('partnerId') id: string) { return this.svc.addFavorite(u.id, id); }

  @ApiBearerAuth() @UseGuards(JwtAuthGuard, RolesGuard) @Roles(Role.CUSTOMER) @Delete('favorites/:partnerId')
  remove(@CurrentUser() u: JwtUser, @Param('partnerId') id: string) { return this.svc.removeFavorite(u.id, id); }
}

@Module({ controllers: [ReviewsController], providers: [ReviewsService], exports: [ReviewsService] })
export class ReviewsModule {}
