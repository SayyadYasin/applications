import { BadRequestException, Controller, Headers, Injectable, Module, Param, Post, RawBodyRequest, Req, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentStatus, Role } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';
import { getRazorpay } from '../wallet/razorpay.util';
import { CurrentUser, JwtAuthGuard, JwtUser, Roles, RolesGuard } from '../auth/roles';
import { BookingsModule } from '../bookings/bookings.module';
import { BookingsService } from '../bookings/bookings.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  private get rzp() { return getRazorpay(); }

  constructor(private prisma: PrismaService, private bookings: BookingsService) {}

  /** Creates a Razorpay order (supports UPI, cards, netbanking) for a booking awaiting payment. */
  async createOrder(userId: string, bookingId: string) {
    const b = await this.prisma.booking.findFirst({ where: { id: bookingId, customer: { userId } } });
    if (!b) throw new BadRequestException('Booking not found');
    if (b.status !== 'PENDING_PAYMENT') throw new BadRequestException('Booking is not awaiting payment');

    const order = await this.rzp.orders.create({
      amount: Math.round(Number(b.total) * 100), // paise
      currency: 'INR',
      receipt: b.code,
    });
    await this.prisma.payment.create({
      data: { bookingId: b.id, method: b.paymentMethod, amount: b.total, razorpayOrderId: order.id },
    });
    return { orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID };
  }

  /** Verifies the webhook HMAC over the raw body, then confirms the booking (idempotent). */
  async handleWebhook(rawBody: Buffer, signature: string) {
    const expected = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET ?? '').update(rawBody).digest('hex');
    const a = Buffer.from(expected);
    const s = Buffer.from(signature ?? '');
    if (a.length !== s.length || !timingSafeEqual(a, s)) throw new UnauthorizedException('Bad signature');

    const event = JSON.parse(rawBody.toString());
    if (event.event !== 'payment.captured') return { ignored: true };
    const p = event.payload.payment.entity;

    const payment = await this.prisma.payment.findUnique({ where: { razorpayOrderId: p.order_id } });
    if (!payment || payment.status === PaymentStatus.PAID) return { ok: true };

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.PAID, razorpayPaymentId: p.id },
    });
    await this.bookings.confirm(payment.bookingId);
    return { ok: true };
  }
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private svc: PaymentsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CUSTOMER)
  @Post('order/:bookingId')
  order(@CurrentUser() u: JwtUser, @Param('bookingId') id: string) { return this.svc.createOrder(u.id, id); }

  @Post('webhook/razorpay')
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') sig: string) {
    return this.svc.handleWebhook(req.rawBody!, sig);
  }
}

@Module({ imports: [BookingsModule], controllers: [PaymentsController], providers: [PaymentsService] })
export class PaymentsModule {}
