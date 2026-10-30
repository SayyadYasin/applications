import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { KycStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import {
  DocType, LocationDto, PresignDocDto, RegisterDocDto, SetOnlineDto, SetServicesDto, SlotDto, UpdatePartnerProfileDto,
} from './partners.dto';
import { missingKycDocs, validateSlot } from './partners.rules';

@Injectable()
export class PartnersService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private notifications: NotificationsService,
  ) {}

  private async me(userId: string) {
    const p = await this.prisma.partner.findUnique({ where: { userId } });
    if (!p) throw new NotFoundException('Partner profile not found');
    return p;
  }

  async getProfile(userId: string) {
    return this.prisma.partner.findUniqueOrThrow({
      where: { userId },
      include: {
        user: { select: { name: true, phone: true, email: true, avatarUrl: true } },
        documents: { select: { id: true, type: true, verified: true, createdAt: true } },
        services: { include: { service: { select: { id: true, name: true, basePrice: true } } } },
        availability: { orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }] },
      },
    });
  }

  async updateProfile(userId: string, dto: UpdatePartnerProfileDto) {
    const p = await this.me(userId);
    return this.prisma.partner.update({ where: { id: p.id }, data: dto });
  }

  async publicProfile(partnerId: string) {
    const p = await this.prisma.partner.findFirst({
      where: { id: partnerId, kycStatus: KycStatus.APPROVED },
      select: {
        id: true, bio: true, ratingAvg: true, ratingCount: true, completedJobs: true, isOnline: true,
        user: { select: { name: true, avatarUrl: true } },
        services: { select: { customPrice: true, service: { select: { id: true, name: true, basePrice: true } } } },
        reviews: { orderBy: { createdAt: 'desc' }, take: 10, select: { rating: true, comment: true, reply: true, createdAt: true } },
      },
    });
    if (!p) throw new NotFoundException('Partner not found');
    return p;
  }

  // ---- KYC ----

  async presignDoc(userId: string, dto: PresignDocDto) {
    const p = await this.me(userId);
    if (p.kycStatus === KycStatus.APPROVED) throw new BadRequestException('KYC already approved');
    if (!this.storage.isAllowedContentType(dto.contentType)) throw new BadRequestException('Unsupported content type');
    const key = `partners/${p.id}/${dto.type}-${randomUUID()}`;
    return this.storage.presignUpload(key, dto.contentType);
  }

  async registerDoc(userId: string, dto: RegisterDocDto) {
    const p = await this.me(userId);
    if (!dto.key.startsWith(`partners/${p.id}/${dto.type}-`)) throw new BadRequestException('Invalid document key');
    if (await this.prisma.partnerDocument.findFirst({ where: { partnerId: p.id, s3Key: dto.key } })) {
      throw new BadRequestException('Document already registered');
    }
    return this.prisma.partnerDocument.create({ data: { partnerId: p.id, type: dto.type, s3Key: dto.key } });
  }

  async submitKyc(userId: string) {
    const p = await this.me(userId);
    if (p.kycStatus === KycStatus.APPROVED || p.kycStatus === KycStatus.SUBMITTED) {
      throw new BadRequestException(`KYC is already ${p.kycStatus}`);
    }
    const docs = await this.prisma.partnerDocument.findMany({ where: { partnerId: p.id }, select: { type: true } });
    const missing = missingKycDocs(docs.map((d) => d.type));
    if (missing.length) throw new BadRequestException(`Missing required documents: ${missing.join(', ')}`);
    return this.prisma.partner.update({ where: { id: p.id }, data: { kycStatus: KycStatus.SUBMITTED }, select: { id: true, kycStatus: true } });
  }

  // ---- Admin KYC ----

  listPendingKyc() {
    return this.prisma.partner.findMany({
      where: { kycStatus: KycStatus.SUBMITTED },
      include: { user: { select: { name: true, phone: true } }, documents: true },
      orderBy: { id: 'asc' },
      take: 100,
    });
  }

  async documentDownloadInfo(docId: string) {
    const d = await this.prisma.partnerDocument.findUnique({ where: { id: docId } });
    if (!d) throw new NotFoundException('Document not found');
    const url = this.storage.configured ? await this.storage.presignDownload(d.s3Key) : undefined;
    return { id: d.id, type: d.type, key: d.s3Key, verified: d.verified, url };
  }

  async verifyDoc(actorId: string, docId: string, approve: boolean, reason?: string) {
    const d = await this.prisma.partnerDocument.findUnique({ where: { id: docId }, include: { partner: true } });
    if (!d) throw new NotFoundException('Document not found');
    if (approve) {
      await this.prisma.partnerDocument.update({ where: { id: docId }, data: { verified: true } });
    } else {
      // Rejected documents are removed so the partner re-uploads; the key is kept in the audit log.
      await this.prisma.partnerDocument.delete({ where: { id: docId } });
    }
    await this.prisma.auditLog.create({
      data: {
        actorId, action: approve ? 'KYC_DOC_APPROVED' : 'KYC_DOC_REJECTED', entity: 'PartnerDocument', entityId: docId,
        meta: { partnerId: d.partnerId, type: d.type, key: d.s3Key, reason },
      },
    });
    if (!approve) {
      this.notifications.notifySafe(d.partner.userId, {
        title: 'Document rejected',
        body: `Your ${d.type} document was rejected${reason ? `: ${reason}` : ''}. Please upload it again.`,
      });
    }
    return { id: docId, approved: approve };
  }

  async decideKyc(actorId: string, partnerId: string, approve: boolean, reason?: string) {
    const p = await this.prisma.partner.findUnique({ where: { id: partnerId }, include: { documents: true } });
    if (!p) throw new NotFoundException('Partner not found');
    if (p.kycStatus !== KycStatus.SUBMITTED) throw new BadRequestException('KYC is not awaiting review');
    if (approve) {
      const missing = missingKycDocs(p.documents.map((d) => d.type));
      if (missing.length) throw new BadRequestException(`Missing required documents: ${missing.join(', ')}`);
    } else if (!reason) {
      throw new BadRequestException('A reason is required to reject');
    }
    const status = approve ? KycStatus.APPROVED : KycStatus.REJECTED;
    await this.prisma.$transaction([
      this.prisma.partner.update({ where: { id: partnerId }, data: { kycStatus: status, ...(approve ? {} : { isOnline: false }) } }),
      ...(approve ? [this.prisma.partnerDocument.updateMany({ where: { partnerId }, data: { verified: true } })] : []),
      this.prisma.auditLog.create({
        data: { actorId, action: approve ? 'KYC_APPROVED' : 'KYC_REJECTED', entity: 'Partner', entityId: partnerId, meta: { reason } },
      }),
    ]);
    await this.notifications.notify(p.userId, {
      title: approve ? 'KYC approved' : 'KYC rejected',
      body: approve ? 'You can now go online and receive jobs.' : `Your KYC was rejected: ${reason}`,
    });
    return { partnerId, kycStatus: status };
  }

  // ---- Services ----

  async setServices(userId: string, dto: SetServicesDto) {
    const p = await this.me(userId);
    const ids = dto.services.map((s) => s.serviceId);
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Duplicate serviceId');
    const found = await this.prisma.service.count({ where: { id: { in: ids }, active: true } });
    if (found !== ids.length) throw new BadRequestException('One or more services are invalid or inactive');
    await this.prisma.$transaction([
      this.prisma.partnerService.deleteMany({ where: { partnerId: p.id } }),
      this.prisma.partnerService.createMany({
        data: dto.services.map((s) => ({ partnerId: p.id, serviceId: s.serviceId, customPrice: s.customPrice })),
      }),
    ]);
    return this.prisma.partnerService.findMany({ where: { partnerId: p.id } });
  }

  // ---- Availability ----

  async listSlots(userId: string) {
    const p = await this.me(userId);
    return this.prisma.availabilitySlot.findMany({ where: { partnerId: p.id }, orderBy: [{ weekday: 'asc' }, { startMin: 'asc' }] });
  }

  async addSlot(userId: string, dto: SlotDto) {
    const p = await this.me(userId);
    const existing = await this.prisma.availabilitySlot.findMany({ where: { partnerId: p.id, weekday: dto.weekday } });
    validateSlot(dto, existing);
    return this.prisma.availabilitySlot.create({ data: { partnerId: p.id, ...dto } });
  }

  private async ownSlot(userId: string, id: string) {
    const p = await this.me(userId);
    const s = await this.prisma.availabilitySlot.findUnique({ where: { id } });
    if (!s) throw new NotFoundException('Slot not found');
    if (s.partnerId !== p.id) throw new ForbiddenException();
    return s;
  }

  async updateSlot(userId: string, id: string, dto: SlotDto) {
    const s = await this.ownSlot(userId, id);
    const existing = await this.prisma.availabilitySlot.findMany({ where: { partnerId: s.partnerId, weekday: dto.weekday } });
    validateSlot(dto, existing, id);
    return this.prisma.availabilitySlot.update({ where: { id }, data: dto });
  }

  async deleteSlot(userId: string, id: string) {
    await this.ownSlot(userId, id);
    await this.prisma.availabilitySlot.delete({ where: { id } });
    return { deleted: true };
  }

  // ---- Online / location ----

  async setOnline(userId: string, dto: SetOnlineDto) {
    const p = await this.me(userId);
    if (dto.online) {
      if (p.kycStatus !== KycStatus.APPROVED) throw new ForbiddenException('KYC must be approved before going online');
      const hasLoc = (dto.lat != null && dto.lng != null) || (p.lat != null && p.lng != null);
      if (!hasLoc) throw new BadRequestException('Location is required to go online');
    }
    return this.prisma.partner.update({
      where: { id: p.id },
      data: { isOnline: dto.online, ...(dto.lat != null && dto.lng != null ? { lat: dto.lat, lng: dto.lng } : {}) },
      select: { id: true, isOnline: true, lat: true, lng: true },
    });
  }

  async updateLocation(userId: string, dto: LocationDto) {
    const p = await this.me(userId);
    return this.prisma.partner.update({ where: { id: p.id }, data: { lat: dto.lat, lng: dto.lng }, select: { id: true, lat: true, lng: true } });
  }
}

export type { DocType };
