import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import passport from 'passport';
import { ENV, type Env } from './config/env';
import { REDIS, type RedisClient } from './infra/redis';
import { sessionMiddleware } from './modules/auth/session';

export const API_PREFIX = 'api/v1';

/** Общая настройка HTTP-приложения — для main.ts и e2e. */
export function configureApp(app: INestApplication): void {
  const env = app.get<Env>(ENV);
  const redis = app.get<RedisClient>(REDIS);
  const express = app as NestExpressApplication;

  if (env.NODE_ENV === 'production') express.set('trust proxy', 1);
  express.disable('x-powered-by');
  app.setGlobalPrefix(API_PREFIX);
  app.use(sessionMiddleware(env, redis));
  app.use(passport.initialize());
  app.use(passport.session());
  app.enableShutdownHooks();
}
