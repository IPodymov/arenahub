import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { UserRole } from '@arenahub/shared';
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

@Injectable()
export class AdminGuard extends AuthenticatedGuard {
  override canActivate(ctx: ExecutionContext): boolean {
    super.canActivate(ctx);
    const user = ctx.switchToHttp().getRequest<Request>().user;
    if (user?.role !== 'ADMIN') {
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Недостаточно прав' });
    }
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
