import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { BookingStatus } from '@prisma/client';
import { Namespace, Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';

export const bookingRoom = (id: string) => `booking:${id}`;

interface AuthedSocket extends Socket {
  data: { userId: string; role: string };
}

@Injectable()
@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(',') },
})
export class ChatGateway implements OnGatewayConnection {
  private log = new Logger(ChatGateway.name);
  @WebSocketServer() server: Namespace | Server;

  constructor(private jwt: JwtService, private chat: ChatService, private prisma: PrismaService) {}

  /** JWT is read from handshake.auth.token or the Authorization header. */
  async handleConnection(client: AuthedSocket) {
    try {
      const raw: string | undefined =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.headers.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');
      if (!raw) throw new Error('missing token');
      const payload = await this.jwt.verifyAsync<{ sub: string }>(raw);
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, isActive: true } });
      if (!user?.isActive) throw new Error('inactive');
      client.data = { userId: user.id, role: user.role };
    } catch {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  private async guard<T>(client: AuthedSocket, fn: () => Promise<T>) {
    try {
      return await fn();
    } catch (e) {
      const message = (e as Error).message || 'Error';
      return { error: message } as any;
    }
  }

  @SubscribeMessage('join')
  join(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { bookingId: string }) {
    return this.guard(client, async () => {
      await this.chat.assertParticipant(body?.bookingId, client.data.userId);
      await client.join(bookingRoom(body.bookingId));
      return { joined: true };
    });
  }

  @SubscribeMessage('leave')
  async leave(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { bookingId: string }) {
    await client.leave(bookingRoom(body?.bookingId));
    return { left: true };
  }

  @SubscribeMessage('message')
  message(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { bookingId: string; body: string }) {
    return this.guard(client, async () => {
      const text = typeof body?.body === 'string' ? body.body.trim() : '';
      if (!text || text.length > 2000) return { error: 'Invalid message' };
      const { msg } = await this.chat.send(body.bookingId, client.data.userId, text);
      this.server.to(bookingRoom(body.bookingId)).emit('message', msg);
      return { ok: true, id: msg.id };
    });
  }

  @SubscribeMessage('read')
  read(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { bookingId: string }) {
    return this.guard(client, async () => {
      const ids = await this.chat.markRead(body.bookingId, client.data.userId);
      if (ids.length) this.server.to(bookingRoom(body.bookingId)).emit('read', { bookingId: body.bookingId, by: client.data.userId, messageIds: ids });
      return { read: ids.length };
    });
  }

  /** Partner live location while PARTNER_EN_ROUTE: persists Partner.lat/lng and broadcasts to the booking room. */
  @SubscribeMessage('location')
  location(@ConnectedSocket() client: AuthedSocket, @MessageBody() body: { bookingId: string; lat: number; lng: number }) {
    return this.guard(client, async () => {
      const { lat, lng } = body ?? ({} as any);
      if (typeof lat !== 'number' || typeof lng !== 'number' || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
        return { error: 'Invalid coordinates' };
      }
      const b = await this.chat.assertParticipant(body.bookingId, client.data.userId);
      if (b.partnerUserId !== client.data.userId) return { error: 'Only the assigned partner can share location' };
      if (b.status !== BookingStatus.PARTNER_EN_ROUTE) return { error: 'Location sharing is only active while en route' };
      await this.prisma.partner.update({ where: { userId: client.data.userId }, data: { lat, lng } });
      this.server.to(bookingRoom(body.bookingId)).emit('location', { bookingId: body.bookingId, lat, lng, at: new Date().toISOString() });
      return { ok: true };
    });
  }

  /** Called by BookingsService after a status change. Safe if no sockets are connected. */
  emitBookingStatus(bookingId: string, status: BookingStatus | string) {
    try {
      this.server?.to(bookingRoom(bookingId)).emit('booking:status', { bookingId, status, at: new Date().toISOString() });
    } catch (e) {
      this.log.warn(`emitBookingStatus failed: ${(e as Error).message}`);
    }
  }
}
