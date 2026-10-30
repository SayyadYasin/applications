import { Body, Controller, Get, Module, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard } from '../auth/roles';
import { AdminListTicketsQuery, CreateTicketDto, ResolveDisputeDto, UpdateTicketDto } from './support.dto';
import { SupportService } from './support.service';

@ApiTags('support')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('support/tickets')
export class SupportController {
  constructor(private svc: SupportService) {}

  @Roles(Role.CUSTOMER, Role.PARTNER) @Post()
  create(@CurrentUser() u: JwtUser, @Body() dto: CreateTicketDto) { return this.svc.create(u.id, dto); }

  @Roles(Role.CUSTOMER, Role.PARTNER) @Get('mine')
  mine(@CurrentUser() u: JwtUser) { return this.svc.listMine(u.id); }

  @Roles(Role.CUSTOMER, Role.PARTNER) @Get('mine/:id')
  getMine(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.svc.getMine(u.id, id); }
}

@ApiTags('support-admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/support/tickets')
export class SupportAdminController {
  constructor(private svc: SupportService) {}

  @Get() list(@Query() q: AdminListTicketsQuery) { return this.svc.adminList(q); }
  @Get(':id') get(@Param('id') id: string) { return this.svc.adminGet(id); }

  @Patch(':id')
  update(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: UpdateTicketDto) { return this.svc.adminUpdate(u.id, id, dto); }

  @Post(':id/resolve-dispute')
  resolve(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: ResolveDisputeDto) { return this.svc.resolveDispute(u.id, id, dto); }
}

@Module({ controllers: [SupportController, SupportAdminController], providers: [SupportService], exports: [SupportService] })
export class SupportModule {}
