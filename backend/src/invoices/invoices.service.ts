import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { PrismaService } from '../prisma/prisma.service';

const inr = (n: unknown) => `INR ${Number(n).toFixed(2)}`;

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async getForBooking(userId: string, role: string, bookingId: string) {
    const b = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        invoice: true,
        service: true,
        address: true,
        customer: { include: { user: { select: { name: true, email: true, phone: true } } } },
        partner: { include: { user: { select: { name: true } } } },
      },
    });
    if (!b) throw new NotFoundException('Booking not found');
    const isAdmin = role === 'ADMIN' || role === 'SUPER_ADMIN';
    if (!isAdmin && b.customer.userId !== userId && b.partner?.userId !== userId) throw new ForbiddenException();
    if (!b.invoice) throw new NotFoundException('Invoice is not available until the booking is completed');

    const serviceName = (b.service.name as Record<string, string> | null)?.en ?? Object.values((b.service.name as any) ?? {})[0] ?? 'Service';
    return {
      number: b.invoice.number,
      issuedAt: b.invoice.issuedAt,
      bookingCode: b.code,
      supplier: {
        name: process.env.COMPANY_NAME ?? 'TownServices',
        gstin: process.env.COMPANY_GSTIN ?? null,
        address: process.env.COMPANY_ADDRESS ?? null,
      },
      recipient: {
        name: b.customer.user.name,
        phone: b.customer.user.phone,
        email: b.customer.user.email,
        address: [b.address.line1, b.address.line2, b.address.city, b.address.pincode].filter(Boolean).join(', '),
      },
      provider: b.partner?.user.name ?? null,
      lineItem: {
        description: String(serviceName),
        hsnSac: b.service.hsnCode ?? '9954',
        gstPct: b.service.gstPct,
        basePrice: Number(b.basePrice),
        surge: Number(b.surgeAmount),
        discount: Number(b.discount),
      },
      taxableValue: Number(b.invoice.taxableValue),
      cgst: Number(b.invoice.cgst),
      sgst: Number(b.invoice.sgst),
      igst: Number(b.invoice.igst),
      total: Number(b.invoice.total),
    };
  }

  /** Builds the PDF document; caller pipes it to the response. */
  buildPdf(inv: Awaited<ReturnType<InvoicesService['getForBooking']>>) {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const half = inv.lineItem.gstPct / 2;

    doc.fontSize(20).text('TAX INVOICE', { align: 'right' });
    doc.fontSize(10).text(`Invoice No: ${inv.number}`, { align: 'right' });
    doc.text(`Date: ${new Date(inv.issuedAt).toLocaleDateString('en-IN')}`, { align: 'right' });
    doc.text(`Booking: ${inv.bookingCode}`, { align: 'right' });

    doc.moveDown().fontSize(12).text(inv.supplier.name, 50, 50, { continued: false });
    doc.fontSize(10);
    if (inv.supplier.address) doc.text(inv.supplier.address, { width: 250 });
    if (inv.supplier.gstin) doc.text(`GSTIN: ${inv.supplier.gstin}`);

    doc.moveDown(2).fontSize(11).text('Bill To', 50, doc.y, { underline: true });
    doc.fontSize(10).text(inv.recipient.name);
    doc.text(inv.recipient.address, { width: 300 });
    if (inv.recipient.phone) doc.text(`Phone: ${inv.recipient.phone}`);
    if (inv.provider) doc.text(`Service provider: ${inv.provider}`);

    doc.moveDown(2);
    const top = doc.y;
    const cols = [50, 250, 320, 400, 480];
    doc.font('Helvetica-Bold');
    ['Description', 'HSN/SAC', 'Rate', 'Taxable', 'Total'].forEach((h, i) => doc.text(h, cols[i], top, { width: 80 }));
    doc.font('Helvetica').moveTo(50, top + 15).lineTo(545, top + 15).stroke();
    const y = top + 22;
    doc.text(inv.lineItem.description, cols[0], y, { width: 190 });
    doc.text(inv.lineItem.hsnSac, cols[1], y, { width: 60 });
    doc.text(`${inv.lineItem.gstPct}%`, cols[2], y, { width: 70 });
    doc.text(inr(inv.taxableValue), cols[3], y, { width: 80 });
    doc.text(inr(inv.total), cols[4], y, { width: 70 });

    doc.y = y + 50;
    const row = (label: string, value: string, bold = false) => {
      const ry = doc.y;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').text(label, 330, ry, { width: 120 });
      doc.text(value, 450, ry, { width: 95, align: 'right' });
      doc.moveDown(0.3);
    };
    row('Base price', inr(inv.lineItem.basePrice));
    if (inv.lineItem.surge) row('Surge', inr(inv.lineItem.surge));
    if (inv.lineItem.discount) row('Discount', `- ${inr(inv.lineItem.discount)}`);
    row('Taxable value', inr(inv.taxableValue));
    row(`CGST @ ${half}%`, inr(inv.cgst));
    row(`SGST @ ${half}%`, inr(inv.sgst));
    if (inv.igst) row('IGST', inr(inv.igst));
    row('Total', inr(inv.total), true);

    doc.font('Helvetica').fontSize(8).text('This is a computer generated invoice and does not require a signature.', 50, 760, { align: 'center', width: 495 });
    doc.end();
    return doc;
  }
}
