import { CanActivate, ExecutionContext, Injectable, SetMetadata, createParamDecorator } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Role } from '@prisma/client';

export interface JwtUser {
  id: string;
  role: Role;
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): JwtUser => ctx.switchToHttp().getRequest().user,
);

export class JwtAuthGuard extends AuthGuard('jwt') {}

/** SUPER_ADMIN passes every role check. */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (!required?.length) return true;
    const user: JwtUser | undefined = ctx.switchToHttp().getRequest().user;
    return !!user && (user.role === Role.SUPER_ADMIN || required.includes(user.role));
  }
}
