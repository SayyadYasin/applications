import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard, JwtUser, RolesGuard } from '../auth/roles';
import { ChatGateway, bookingRoom } from './chat.gateway';
import { ListMessagesQuery, SendMessageDto } from './chat.dto';
import { ChatService } from './chat.service';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bookings/:id/messages')
export class ChatController {
  constructor(private svc: ChatService, private gateway: ChatGateway) {}

  @Get()
  list(@CurrentUser() u: JwtUser, @Param('id') id: string, @Query() q: ListMessagesQuery) {
    return this.svc.list(id, u.id, u.role, q);
  }

  @Post()
  async send(@CurrentUser() u: JwtUser, @Param('id') id: string, @Body() dto: SendMessageDto) {
    const { msg } = await this.svc.send(id, u.id, dto.body);
    this.gateway.server?.to(bookingRoom(id)).emit('message', msg);
    return msg;
  }

  @Post('read')
  async read(@CurrentUser() u: JwtUser, @Param('id') id: string) {
    const ids = await this.svc.markRead(id, u.id);
    if (ids.length) this.gateway.server?.to(bookingRoom(id)).emit('read', { bookingId: id, by: u.id, messageIds: ids });
    return { read: ids.length };
  }
}
