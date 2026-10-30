import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { JwtUser } from '../auth/roles';
import { PrismaService } from '../prisma/prisma.service';
import { ChangeRoleDto, CreateAdminDto, ListUsersDto } from './admin.dto';
import { pageArgs, paged } from './admin.util';
import { AuditService } from './audit.service';

const safeSelect = {
  id: true, email: true, phone: true, name: true, avatarUrl: true, role: true, language: true,
  isActive: true, townId: true, createdAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersAdminService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  async list(q: ListUsersDto) {
    const p = pageArgs(q);
    const where: Prisma.UserWhereInput = {
      ...(q.role && { role: q.role }),
      ...(q.isActive !== undefined && { isActive: q.isActive }),
      ...(q.q && {
        OR: [
          { name: { contains: q.q, mode: 'insensitive' } },
          { email: { contains: q.q, mode: 'insensitive' } },
          { phone: { contains: q.q } },
        ],
      }),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ where, select: safeSelect, orderBy: { createdAt: 'desc' }, take: p.take, skip: p.skip }),
      this.prisma.user.count({ where }),
    ]);
    return paged(items, total, p);
  }

  async get(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      select: { ...safeSelect, town: true, customer: true, partner: true, wallet: { select: { balance: true } } },
    });
    if (!u) throw new NotFoundException('User not found');
    return u;
  }

  async setActive(actor: JwtUser, id: string, isActive: boolean) {
    if (id === actor.id && !isActive) throw new BadRequestException('You cannot deactivate yourself');
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    if (target.role === Role.SUPER_ADMIN && actor.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only a super admin can change a super admin');
    }
    const u = await this.prisma.user.update({ where: { id }, data: { isActive }, select: safeSelect });
    await this.audit.record(actor.id, isActive ? 'USER_ACTIVATE' : 'USER_DEACTIVATE', 'User', id);
    return u;
  }

  async changeRole(actor: JwtUser, id: string, dto: ChangeRoleDto) {
    if (id === actor.id) throw new BadRequestException('You cannot change your own role');
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException('User not found');
    const u = await this.prisma.user.update({ where: { id }, data: { role: dto.role }, select: safeSelect });
    await this.audit.record(actor.id, 'USER_CHANGE_ROLE', 'User', id, { from: target.role, to: dto.role });
    return u;
  }

  async createAdmin(actor: JwtUser, dto: CreateAdminDto) {
    const email = dto.email.toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('Email already registered');
    const u = await this.prisma.user.create({
      data: {
        email,
        name: dto.name,
        role: dto.role ?? Role.ADMIN,
        passwordHash: await bcrypt.hash(dto.password, 12),
      },
      select: safeSelect,
    });
    await this.audit.record(actor.id, 'ADMIN_CREATE', 'User', u.id, { email, role: u.role });
    return u;
  }
}
