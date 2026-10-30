import { Controller, Get, Module, Param, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, JwtAuthGuard, JwtUser, RolesGuard } from '../auth/roles';
import { InvoicesService } from './invoices.service';

@ApiTags('invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bookings/:id')
export class InvoicesController {
  constructor(private svc: InvoicesService) {}

  @Get('invoice')
  get(@CurrentUser() u: JwtUser, @Param('id') id: string) { return this.svc.getForBooking(u.id, u.role, id); }

  @Get('invoice.pdf')
  async pdf(@CurrentUser() u: JwtUser, @Param('id') id: string, @Res() res: Response) {
    const inv = await this.svc.getForBooking(u.id, u.role, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${inv.number}.pdf"`);
    this.svc.buildPdf(inv).pipe(res);
  }
}

@Module({ controllers: [InvoicesController], providers: [InvoicesService], exports: [InvoicesService] })
export class InvoicesModule {}
