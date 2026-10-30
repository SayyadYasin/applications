import { Logger } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';

export interface NotifyTarget {
  id: string;
  email?: string | null;
  phone?: string | null;
  fcmToken?: string | null;
}

export interface NotifyPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface ChannelProvider {
  readonly channel: NotificationChannel;
  /** True when env config is present; otherwise send() only logs. */
  readonly enabled: boolean;
  send(target: NotifyTarget, payload: NotifyPayload): Promise<void>;
}

const log = new Logger('NotificationProviders');
const e164 = (phone: string) => (phone.startsWith('+') ? phone.slice(1) : phone.length === 10 ? `91${phone}` : phone);

export class EmailProvider implements ChannelProvider {
  readonly channel = NotificationChannel.EMAIL;
  private transporter: any = null;
  readonly enabled = !!process.env.SMTP_HOST;

  private async tx() {
    if (!this.transporter) {
      const nodemailer = await import('nodemailer');
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
    }
    return this.transporter;
  }

  async send(t: NotifyTarget, p: NotifyPayload) {
    if (!t.email) return;
    if (!this.enabled) return void log.debug(`[email noop] ${t.email}: ${p.title}`);
    await (await this.tx()).sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
      to: t.email,
      subject: p.title,
      text: p.body,
    });
  }
}

export class SmsProvider implements ChannelProvider {
  readonly channel = NotificationChannel.SMS;
  readonly enabled = !!process.env.MSG91_AUTH_KEY && !!process.env.MSG91_TEMPLATE_ID;

  /** MSG91 flow API; the template is expected to use ##title##, ##body## and/or ##otp## variables. */
  async send(t: NotifyTarget, p: NotifyPayload) {
    if (!t.phone) return;
    if (!this.enabled) return void log.debug(`[sms noop] ${t.phone}: ${p.title}`);
    const res = await fetch('https://control.msg91.com/api/v5/flow/', {
      method: 'POST',
      headers: { authkey: process.env.MSG91_AUTH_KEY!, 'content-type': 'application/json' },
      body: JSON.stringify({
        template_id: process.env.MSG91_TEMPLATE_ID,
        short_url: '0',
        recipients: [{ mobiles: e164(t.phone), title: p.title, body: p.body, otp: p.data?.otp }],
      }),
    });
    if (!res.ok) throw new Error(`MSG91 ${res.status}: ${await res.text()}`);
  }
}

export class WhatsAppProvider implements ChannelProvider {
  readonly channel = NotificationChannel.WHATSAPP;
  readonly enabled = !!process.env.WHATSAPP_TOKEN && !!process.env.WHATSAPP_PHONE_ID;

  async send(t: NotifyTarget, p: NotifyPayload) {
    if (!t.phone) return;
    if (!this.enabled) return void log.debug(`[whatsapp noop] ${t.phone}: ${p.title}`);
    const res = await fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: e164(t.phone),
        type: 'text',
        text: { body: `${p.title}\n${p.body}` },
      }),
    });
    if (!res.ok) throw new Error(`WhatsApp ${res.status}: ${await res.text()}`);
  }
}

export class PushProvider implements ChannelProvider {
  readonly channel = NotificationChannel.PUSH;
  readonly enabled = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  private app: any = null;

  private async messaging() {
    const mod: any = await import('firebase-admin');
    const admin = mod.default ?? mod;
    if (!this.app) {
      this.app = admin.apps.length
        ? admin.app()
        : admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!)) });
    }
    return admin.messaging(this.app);
  }

  async send(t: NotifyTarget, p: NotifyPayload) {
    if (!t.fcmToken) return;
    if (!this.enabled) return void log.debug(`[push noop] ${t.id}: ${p.title}`);
    await (await this.messaging()).send({
      token: t.fcmToken,
      notification: { title: p.title, body: p.body },
      data: p.data,
    });
  }
}
