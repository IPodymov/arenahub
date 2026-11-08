import { Injectable } from '@nestjs/common';
import { PassportSerializer } from '@nestjs/passport';
import type { SessionUser } from '../../common/auth';
import { AuthService } from './auth.service';

/** В сессии хранится только id; роль и бан проверяются на каждом запросе. */
@Injectable()
export class SessionSerializer extends PassportSerializer {
  constructor(private readonly auth: AuthService) {
    super();
  }

  serializeUser(user: SessionUser, done: (err: unknown, id?: string) => void): void {
    done(null, user.id);
  }

  deserializeUser(id: string, done: (err: unknown, user?: SessionUser | false) => void): void {
    this.auth.findSessionUser(id).then(
      (user) => done(null, user ?? false),
      (err: unknown) => done(err),
    );
  }
}
