import {
  BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { haversineKm } from '../bookings/assignment.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AvatarUploadDto, CreateAddressDto, UpdateAddressDto, UpdateProfileDto } from './profile.dto';

@Injectable()
export class ProfileService {
  constructor(private prisma: PrismaService, private storage: StorageService) {}

  getProfile(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true, name: true, email: true, phone: true, avatarUrl: true, language: true, role: true, townId: true,
        town: { select: { id: true, name: true, state: true } }, referralCode: true,
        customer: { select: { loyaltyPoints: true, membershipId: true, membershipEnds: true } },
      },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (dto.townId) {
      const t = await this.prisma.town.findFirst({ where: { id: dto.townId, active: true } });
      if (!t) throw new BadRequestException('Unknown or inactive town');
    }
    let avatarUrl: string | undefined;
    if (dto.avatarKey) {
      if (!dto.avatarKey.startsWith(`avatars/${userId}/`)) throw new BadRequestException('Invalid avatar key');
      avatarUrl = this.storage.publicUrl(dto.avatarKey);
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { name: dto.name, language: dto.language, townId: dto.townId, ...(avatarUrl ? { avatarUrl } : {}) },
    });
    return this.getProfile(userId);
  }

  avatarUploadUrl(userId: string, dto: AvatarUploadDto) {
    return this.storage.presignUpload(`avatars/${userId}/${randomUUID()}`, dto.contentType);
  }

  // ---- Addresses ----

  listAddresses(userId: string) {
    return this.prisma.address.findMany({ where: { userId }, orderBy: [{ isDefault: 'desc' }, { label: 'asc' }] });
  }

  async createAddress(userId: string, dto: CreateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      const count = await tx.address.count({ where: { userId } });
      const makeDefault = dto.isDefault || count === 0;
      if (makeDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      return tx.address.create({ data: { ...dto, userId, isDefault: makeDefault } });
    });
  }

  private async owned(userId: string, id: string) {
    const a = await this.prisma.address.findFirst({ where: { id, userId } });
    if (!a) throw new NotFoundException('Address not found');
    return a;
  }

  async updateAddress(userId: string, id: string, dto: UpdateAddressDto) {
    const existing = await this.owned(userId, id);
    if (dto.isDefault === false && existing.isDefault) {
      throw new BadRequestException('Set another address as default instead');
    }
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.address.updateMany({ where: { userId, isDefault: true, id: { not: id } }, data: { isDefault: false } });
      return tx.address.update({ where: { id }, data: dto });
    });
  }

  async setDefault(userId: string, id: string) {
    await this.owned(userId, id);
    return this.prisma.$transaction(async (tx) => {
      await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
      return tx.address.update({ where: { id }, data: { isDefault: true } });
    });
  }

  async deleteAddress(userId: string, id: string) {
    const a = await this.owned(userId, id);
    const used = await this.prisma.booking.count({ where: { addressId: id } });
    if (used) throw new ConflictException('Address is used by existing bookings and cannot be deleted');
    await this.prisma.$transaction(async (tx) => {
      await tx.address.delete({ where: { id } });
      if (a.isDefault) {
        const next = await tx.address.findFirst({ where: { userId }, orderBy: { id: 'asc' } });
        if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    });
    return { deleted: true };
  }

  // ---- Geo ----

  async reverseGeocode(lat: number, lng: number) {
    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) throw new ServiceUnavailableException('Reverse geocoding is not configured');
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${encodeURIComponent(key)}`;
    const res = await fetch(url);
    if (!res.ok) throw new ServiceUnavailableException('Geocoding provider error');
    const json: any = await res.json();
    if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
      throw new ServiceUnavailableException(`Geocoding failed: ${json.status}`);
    }
    const r = json.results?.[0];
    if (!r) throw new NotFoundException('No address found for these coordinates');
    const comp = (type: string) => r.address_components?.find((c: any) => c.types.includes(type))?.long_name;
    return {
      formattedAddress: r.formatted_address,
      line1: [comp('premise'), comp('route'), comp('sublocality')].filter(Boolean).join(', ') || r.formatted_address,
      city: comp('locality') ?? comp('administrative_area_level_2'),
      state: comp('administrative_area_level_1'),
      pincode: comp('postal_code'),
      lat, lng,
    };
  }

  listTowns() {
    return this.prisma.town.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  }

  async nearestTown(lat: number, lng: number) {
    const towns = await this.listTowns();
    if (!towns.length) throw new NotFoundException('No active towns');
    const ranked = towns
      .map((t) => ({ town: t, distanceKm: Math.round(haversineKm({ lat, lng }, t) * 10) / 10 }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
    return ranked[0];
  }
}
