import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { isStaff, type UserRole } from '@arenahub/shared';
import type { Request } from 'express';

/** То, что лежит в req.user после десериализации сессии. */
export interface SessionUser {
  id: string;
  role: UserRole;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface User extends SessionUser {}
  }
}

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.isAuthenticated?.() || !req.user) {
      throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Требуется вход' });
    }
    return true;
  }
}

function forbidden(): ForbiddenException {
  return new ForbiddenException({ code: 'FORBIDDEN', message: 'Недостаточно прав' });
}

/** Модератор или админ. */
@Injectable()
export class StaffGuard extends AuthenticatedGuard {
  override canActivate(ctx: ExecutionContext): boolean {
    super.canActivate(ctx);
    if (!isStaff(ctx.switchToHttp().getRequest<Request>().user?.role)) throw forbidden();
    return true;
  }
}

@Injectable()
export class AdminGuard extends AuthenticatedGuard {
  override canActivate(ctx: ExecutionContext): boolean {
    super.canActivate(ctx);
    if (ctx.switchToHttp().getRequest<Request>().user?.role !== 'ADMIN') throw forbidden();
    return true;
  }
}

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): SessionUser => {
    const user = ctx.switchToHttp().getRequest<Request>().user;
    if (!user) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Требуется вход' });
    return user;
  },
);
