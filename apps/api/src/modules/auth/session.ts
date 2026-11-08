import { RedisStore } from 'connect-redis';
import session from 'express-session';
import type { RequestHandler } from 'express';
import type { Env } from '../../config/env';
import type { RedisClient } from '../../infra/redis';

export const SESSION_COOKIE = 'arenahub.sid';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export function sessionMiddleware(env: Env, redis: RedisClient): RequestHandler {
  return session({
    name: SESSION_COOKIE,
    store: new RedisStore({
      client: redis,
      prefix: env.NODE_ENV === 'test' ? 'arenahub:test:sess:' : 'arenahub:sess:',
    }),
    secret: env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: THIRTY_DAYS_MS,
      path: '/',
    },
  });
}
