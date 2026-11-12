import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import type { SessionUser } from '../../common/auth';
import { AuthService } from './auth.service';

/**
 * В сессии хранится `id:версия`; роль, бан и версия проверяются на каждом запросе.
 * Сессии старого формата (только id) считаются версией 0.
 */
@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private readonly auth: AuthService) {
    super();
  }

  serializeUser(user: SessionUser, done: (err: unknown, key?: string) => void): void {
    done(null, `${user.id}:${user.sessionVersion}`);
  }

  deserializeUser(key: string, done: (err: unknown, user?: SessionUser | false) => void): void {
    const [id = '', version = '0'] = key.split(':');
    this.auth.findSessionUser(id, Number(version)).then(
      (user) => done(null, user ?? false),
      (err: unknown) => done(err),
    );
  }
}
