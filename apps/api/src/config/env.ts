import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

const DEV_SECRET_PREFIX = 'dev-only-';

const boolFromString = z
  .enum(['true', 'false', '1', '0', ''])
  .default('false')
  .transform((v) => v === 'true' || v === '1');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_PORT: z.coerce.number().int().positive().default(4000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    REDIS_URL: z.url({ protocol: /^rediss?$/ }),
    SESSION_SECRET: z.string().min(32, 'SESSION_SECRET должен быть не короче 32 символов'),
    WEB_ORIGIN: z.url(),
    STEAM_API_KEY: z.string().default(''),
    ADMIN_STEAM_IDS: z
      .string()
      .default('')
      .transform((v) =>
        v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    AUTH_DEV_LOGIN: boolFromString,
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    if (env.AUTH_DEV_LOGIN) {
      ctx.addIssue({ code: 'custom', path: ['AUTH_DEV_LOGIN'], message: 'запрещён в production' });
    }
    if (env.SESSION_SECRET.startsWith(DEV_SECRET_PREFIX)) {
      ctx.addIssue({
        code: 'custom',
        path: ['SESSION_SECRET'],
        message: 'dev-значение запрещено в production',
      });
    }
    if (!env.STEAM_API_KEY) {
      ctx.addIssue({ code: 'custom', path: ['STEAM_API_KEY'], message: 'обязателен в production' });
    }
  });

export type Env = z.output<typeof envSchema>;

/** Читает корневой .env (переменные окружения процесса имеют приоритет) и валидирует. Падает при ошибке. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const rootEnv = path.resolve(__dirname, '../../../../.env');
  if (source === process.env && existsSync(rootEnv)) process.loadEnvFile(rootEnv);

  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Некорректные переменные окружения:\n${lines.join('\n')}`);
  }
  return parsed.data;
}

export const ENV = Symbol('ENV');
