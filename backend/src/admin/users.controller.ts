import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard } from '../auth/roles';
import { ChangeRoleDto, CreateAdminDto, ListUsersDto, SetActiveDto } from './admin.dto';
import { UsersAdminService } from './users.service';

@ApiTags('admin/users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/users')
export class UsersAdminController {
  constructor(private svc: UsersAdminService) {}

  @Get() list(@Query() q: ListUsersDto) { return this.svc.list(q); }

  @Roles(Role.SUPER_ADMIN) @Post('admins')
  createAdmin(@CurrentUser() u: JwtUser, @Body() dto: CreateAdminDto) { return this.svc.createAdmin(u, dto); }

  @Get(':id') get(@Param('id') id: string) { return this.svc.get(id); }

  @Patch(':id/active')
  setActive(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: SetActiveDto) {
    return this.svc.setActive(u, id, dto.isActive);
  }

  @Roles(Role.SUPER_ADMIN) @Patch(':id/role')
  changeRole(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: ChangeRoleDto) {
    return this.svc.changeRole(u, id, dto);
  }
}
