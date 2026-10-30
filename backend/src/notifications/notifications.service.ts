import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ChannelProvider, EmailProvider, NotifyPayload, PushProvider, SmsProvider, WhatsAppProvider } from './providers';

export interface NotifyOptions extends NotifyPayload {
  /** Extra channels besides the always-stored IN_APP row. Defaults to PUSH. */
  channels?: NotificationChannel[];
}

@Injectable()
export class NotificationsService {
  private log = new Logger(NotificationsService.name);
  readonly providers: Record<string, ChannelProvider> = {};

  constructor(private prisma: PrismaService) {
    for (const p of [new EmailProvider(), new SmsProvider(), new WhatsAppProvider(), new PushProvider()]) {
      this.providers[p.channel] = p;
    }
  }

  /** Stores the in-app row, then fans out to channels. Provider failures never throw. */
  async notify(userId: string, opts: NotifyOptions) {
    const row = await this.prisma.notification.create({
      data: { userId, title: opts.title, body: opts.body, channel: NotificationChannel.IN_APP },
    });
    const channels = (opts.channels ?? [NotificationChannel.PUSH]).filter((c) => c !== NotificationChannel.IN_APP);
    if (channels.length) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, phone: true, fcmToken: true },
      });
      if (user) {
        await Promise.all(
          [...new Set(channels)].map(async (c) => {
            try {
              await this.providers[c]?.send(user, { title: opts.title, body: opts.body, data: opts.data });
            } catch (e) {
              this.log.warn(`${c} delivery to ${userId} failed: ${(e as Error).message}`);
            }
          }),
        );
      }
    }
    return row;
  }

  /** Fire-and-forget variant for hooks that must not break the caller. */
  notifySafe(userId: string | null | undefined, opts: NotifyOptions) {
    if (!userId) return;
    this.notify(userId, opts).catch((e) => this.log.warn(`notify failed: ${e.message}`));
  }

  /** Sends straight to a phone number without needing a user row (e.g. OTP before signup). Returns whether SMS is configured. */
  async sendSmsToPhone(phone: string, payload: NotifyPayload) {
    const sms = this.providers[NotificationChannel.SMS];
    await sms.send({ id: 'anonymous', phone }, payload);
    return sms.enabled;
  }

  list(userId: string, take = 50, skip = 0) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(take, 100),
      skip,
    });
  }

  async markRead(userId: string, id?: string) {
    const res = await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(id ? { id } : {}) },
      data: { readAt: new Date() },
    });
    return { updated: res.count };
  }

  async registerToken(userId: string, token: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { fcmToken: token } });
    return { registered: true };
  }
}
