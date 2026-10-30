import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';

let instance: Razorpay | undefined;

/** Lazily-created shared Razorpay client (the SDK throws on empty keys, so don't build at import time). */
export function getRazorpay(): Razorpay {
  if (!instance) {
    instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID ?? '',
      key_secret: process.env.RAZORPAY_KEY_SECRET ?? '',
    });
  }
  return instance;
}

/** Checkout signature: HMAC_SHA256(orderId|paymentId, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET ?? '').update(`${orderId}|${paymentId}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature ?? '');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function toPaise(amount: Prisma.Decimal): number {
  return amount.mul(100).toDecimalPlaces(0).toNumber();
}

/** Coerces user/DB amounts to a positive, 2dp Decimal. */
export function toMoney(v: Prisma.Decimal | number | string): Prisma.Decimal {
  const d = new Prisma.Decimal(v);
  if (!d.isFinite() || d.lte(0)) throw new BadRequestException('Amount must be positive');
  return d.toDecimalPlaces(2);
}

/** Serialises concurrent work on the same key for the duration of the transaction. */
export async function advisoryLock(tx: Prisma.TransactionClient, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}
