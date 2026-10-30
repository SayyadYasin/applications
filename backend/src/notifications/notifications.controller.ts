import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, JwtUser, RolesGuard } from '../auth/roles';
import { ListNotificationsQuery, RegisterPushTokenDto } from './notifications.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  @Get()
  list(@CurrentUser() u: JwtUser, @Query() q: ListNotificationsQuery) { return this.svc.list(u.id, q.take, q.skip); }

  @Post('read-all')
  readAll(@CurrentUser() u: JwtUser) { return this.svc.markRead(u.id); }

  @Post('push-token')
  token(@CurrentUser() u: JwtUser, @Body() dto: RegisterPushTokenDto) { return this.svc.registerToken(u.id, dto.token); }

  @Post(':id/read')
  read(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.svc.markRead(u.id, id); }
}
