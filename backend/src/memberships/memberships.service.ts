import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipPlan, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { advisoryLock, getRazorpay, toPaise, verifyCheckoutSignature } from '../wallet/razorpay.util';
import { WalletService } from '../wallet/wallet.service';
import { CreatePlanDto, UpdatePlanDto } from './memberships.dto';

const PURPOSE = 'MEMBERSHIP';
const DAY_MS = 86_400_000;

@Injectable()
export class MembershipsService {
  constructor(private prisma: PrismaService, private wallet: WalletService) {}

  // ---- plans ----
  listPlans() { return this.prisma.membershipPlan.findMany({ orderBy: { price: 'asc' } }); }

  createPlan(dto: CreatePlanDto) { return this.prisma.membershipPlan.create({ data: dto }); }

  async updatePlan(id: string, dto: UpdatePlanDto) {
    await this.plan(id);
    return this.prisma.membershipPlan.update({ where: { id }, data: dto });
  }

  async deletePlan(id: string) {
    await this.plan(id);
    const inUse = await this.prisma.customer.count({ where: { membershipId: id } });
    const bought = await this.prisma.membershipPurchase.count({ where: { planId: id } });
    if (inUse || bought) throw new ConflictException('Plan has purchases and cannot be deleted');
    await this.prisma.membershipPlan.delete({ where: { id } });
    return { deleted: true };
  }

  private async plan(id: string) {
    const p = await this.prisma.membershipPlan.findUnique({ where: { id } });
    if (!p) throw new NotFoundException('Plan not found');
    return p;
  }

  private async customer(userId: string) {
    const c = await this.prisma.customer.findUnique({ where: { userId } });
    if (!c) throw new ForbiddenException('Customer profile not found');
    return c;
  }

  async mine(userId: string) {
    const c = await this.prisma.customer.findUnique({ where: { userId }, include: { membership: true } });
    const active = !!c?.membershipEnds && c.membershipEnds > new Date();
    return { active, plan: active ? c!.membership : null, endsAt: active ? c!.membershipEnds : null };
  }

  // ---- purchase ----
  async createOrder(userId: string, planId: string) {
    const plan = await this.plan(planId);
    await this.customer(userId);
    const order = await getRazorpay().orders.create({
      amount: toPaise(plan.price),
      currency: 'INR',
      receipt: `mp_${Date.now().toString(36)}`,
      notes: { purpose: PURPOSE, userId, planId },
    });
    return { orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID };
  }

  async verifyPurchase(userId: string, planId: string, orderId: string, paymentId: string, signature: string) {
    if (!verifyCheckoutSignature(orderId, paymentId, signature)) throw new BadRequestException('Invalid payment signature');
    const order: any = await getRazorpay().orders.fetch(orderId);
    if (order.notes?.purpose !== PURPOSE || order.notes?.userId !== userId || order.notes?.planId !== planId) {
      throw new ForbiddenException('Order does not match this purchase');
    }
    if (order.status !== 'paid') throw new BadRequestException('Payment not completed');
    const plan = await this.plan(planId);
    const customer = await this.customer(userId);

    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(tx, `membership-pay:${paymentId}`);
      const existing = await tx.membershipPurchase.findFirst({ where: { customerId: customer.id, paymentRef: paymentId } });
      if (existing) return { replay: true, purchase: existing };
      return this.activate(tx, customer.id, plan, plan.price, paymentId);
    });
  }

  async purchaseWithWallet(userId: string, planId: string) {
    const plan = await this.plan(planId);
    const customer = await this.customer(userId);
    return this.prisma.$transaction(async (tx) => {
      await advisoryLock(tx, `membership-cust:${customer.id}`);
      await this.wallet.debit(userId, plan.price, 'MEMBERSHIP_PURCHASE', plan.id, tx);
      return this.activate(tx, customer.id, plan, plan.price, `WALLET:${Date.now()}`);
    });
  }

  /** Creates the purchase row and sets customer membership; extends from the current end date if still active. */
  private async activate(tx: Prisma.TransactionClient, customerId: string, plan: MembershipPlan, amount: Prisma.Decimal, paymentRef: string) {
    const c = await tx.customer.findUniqueOrThrow({ where: { id: customerId } });
    const now = new Date();
    const startsAt = c.membershipEnds && c.membershipEnds > now ? c.membershipEnds : now;
    const endsAt = new Date(startsAt.getTime() + plan.durationDays * DAY_MS);
    const purchase = await tx.membershipPurchase.create({
      data: { customerId, planId: plan.id, amount, startsAt, endsAt, paymentRef },
    });
    await tx.customer.update({ where: { id: customerId }, data: { membershipId: plan.id, membershipEnds: endsAt } });
    return { replay: false, purchase };
  }
}
