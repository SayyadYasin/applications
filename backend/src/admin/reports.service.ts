import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { dateFilter, normalizeRaw } from './admin.util';

const BATCH = 1000;

export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? String(v) : String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s) && typeof v === 'string') s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const csvRow = (cells: unknown[]) => cells.map(csvCell).join(',') + '\n';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private async stream<T extends { id: string }>(
    res: Response, filename: string, header: string[],
    fetch: (cursor: string | undefined) => Promise<T[]>, toRow: (r: T) => unknown[],
  ) {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.write(csvRow(header));
    let cursor: string | undefined;
    for (;;) {
      const rows = await fetch(cursor);
      for (const r of rows) res.write(csvRow(toRow(r)));
      if (rows.length < BATCH) break;
      cursor = rows[rows.length - 1].id;
    }
    res.end();
  }

  private page(cursor?: string) {
    return { take: BATCH, orderBy: { id: 'asc' as const }, ...(cursor && { cursor: { id: cursor }, skip: 1 }) };
  }

  bookings(res: Response, from?: string, to?: string) {
    const where: Prisma.BookingWhereInput = { createdAt: dateFilter(from, to) };
    return this.stream(res, 'bookings.csv',
      ['code', 'status', 'scheduledAt', 'createdAt', 'service', 'customerId', 'partnerId', 'basePrice', 'surge', 'discount', 'tax', 'total', 'paymentMethod'],
      (c) => this.prisma.booking.findMany({ where, ...this.page(c), include: { service: { select: { name: true } } } }),
      (b) => [b.code, b.status, b.scheduledAt, b.createdAt, (b.service.name as { en?: string })?.en ?? '', b.customerId, b.partnerId,
        b.basePrice, b.surgeAmount, b.discount, b.taxAmount, b.total, b.paymentMethod]);
  }

  payments(res: Response, from?: string, to?: string) {
    const where: Prisma.PaymentWhereInput = { createdAt: dateFilter(from, to) };
    return this.stream(res, 'payments.csv',
      ['id', 'bookingId', 'method', 'status', 'amount', 'refundedAmount', 'razorpayPaymentId', 'createdAt'],
      (c) => this.prisma.payment.findMany({ where, ...this.page(c) }),
      (p) => [p.id, p.bookingId, p.method, p.status, p.amount, p.refundedAmount, p.razorpayPaymentId, p.createdAt]);
  }

  earnings(res: Response, from?: string, to?: string) {
    const where: Prisma.EarningWhereInput = { createdAt: dateFilter(from, to) };
    return this.stream(res, 'earnings.csv',
      ['id', 'partnerId', 'bookingId', 'gross', 'commission', 'net', 'settled', 'createdAt'],
      (c) => this.prisma.earning.findMany({ where, ...this.page(c) }),
      (e) => [e.id, e.partnerId, e.bookingId, e.gross, e.commission, e.net, e.settled, e.createdAt]);
  }

  payouts(res: Response, from?: string, to?: string) {
    const where: Prisma.PayoutWhereInput = { createdAt: dateFilter(from, to) };
    return this.stream(res, 'payouts.csv',
      ['id', 'partnerId', 'amount', 'status', 'upiId', 'reference', 'createdAt', 'processedAt'],
      (c) => this.prisma.payout.findMany({ where, ...this.page(c) }),
      (p) => [p.id, p.partnerId, p.amount, p.status, p.upiId, p.reference, p.createdAt, p.processedAt]);
  }

  /** Monthly GST summary: taxable value and CGST/SGST/IGST totals from issued invoices. */
  async gstSummary(res: Response, from?: string, to?: string) {
    const fromD = from ? new Date(from) : new Date('1970-01-01');
    const toD = to ? new Date(to) : new Date('2999-12-31');
    const rows = normalizeRaw<{ month: Date; invoices: number; taxable: number; cgst: number; sgst: number; igst: number; total: number }>(
      await this.prisma.$queryRaw`
        SELECT date_trunc('month', "issuedAt") AS month, COUNT(*) AS invoices,
               COALESCE(SUM("taxableValue"),0) AS taxable, COALESCE(SUM(cgst),0) AS cgst,
               COALESCE(SUM(sgst),0) AS sgst, COALESCE(SUM(igst),0) AS igst, COALESCE(SUM(total),0) AS total
        FROM "Invoice"
        WHERE "issuedAt" >= ${fromD} AND "issuedAt" <= ${toD}
        GROUP BY 1 ORDER BY 1`,
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="gst-summary.csv"');
    res.write(csvRow(['month', 'invoices', 'taxableValue', 'cgst', 'sgst', 'igst', 'total']));
    for (const r of rows) {
      res.write(csvRow([r.month.toISOString().slice(0, 7), r.invoices, r.taxable, r.cgst, r.sgst, r.igst, r.total]));
    }
    res.end();
  }
}
