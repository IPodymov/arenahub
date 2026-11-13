import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const DEV_SECRET_PREFIX = 'dev-only-';

const boolFromString = z
  .enum(['true', 'false', '1', '0', ''])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

const commaList = z
  .string()
  .default('')
  .transform((v) =>
    v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET должен быть не короче 32 символов'),
    WEB_ORIGIN: z.url(),
    STEAM_API_KEY: z.string().default(''),
    ADMIN_STEAM_IDS: commaList,
    ADMIN_NICKNAMES: commaList,
    AUTH_DEV_LOGIN: boolFromString,
    /**
     * Vercel Blob: на Vercel — BLOB_STORE_ID (+ OIDC), снаружи — BLOB_READ_WRITE_TOKEN.
     * Без них аватары пишутся на диск в UPLOADS_DIR (только для разработки и тестов).
     */
    BLOB_STORE_ID: z.string().default(''),
    BLOB_READ_WRITE_TOKEN: z.string().default(''),
    UPLOADS_DIR: z.string().min(1),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (env.AUTH_DEV_LOGIN) {
      ctx.addIssue({ code: 'custom', path: ['AUTH_DEV_LOGIN'], message: 'запрещён в production' });
    }
    if (!env.BLOB_STORE_ID && !env.BLOB_READ_WRITE_TOKEN) {
      ctx.addIssue({
        code: 'custom',
        path: ['BLOB_STORE_ID'],
        message: 'в production аватары хранятся только в Vercel Blob',
      });
    }
    if (env.SESSION_SECRET.startsWith(DEV_SECRET_PREFIX)) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_SECRET'],
        message: 'dev-значение запрещено в production',
      });
    }
  });

export type Env = z.output<typeof envSchema>;

/** Читает корневой .env (переменные окружения процесса имеют приоритет) и валидирует. Падает при ошибке. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const root = path.resolve(__dirname, '../../../..');
  const rootEnv = path.join(root, '.env');
  if (source === process.env && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

  // На Vercel адрес веба по умолчанию — продовый домен проекта
  const vercelOrigin = source.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${source.VERCEL_PROJECT_PRODUCTION_URL}`
    : undefined;
  const parsed = envSchema.safeParse({
    WEB_ORIGIN: vercelOrigin,
    UPLOADS_DIR: path.join(root, 'uploads'),
    ...source,
  });
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Некорректные переменные окружения:\n${lines.join('\n')}`);
  }
  return parsed.data;
}

export const ENV = Symbol('ENV');
