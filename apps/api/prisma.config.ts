import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

const rootEnv = path.resolve(__dirname, '../../.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // generate не требует подключения — заглушка позволяет собирать без .env (CI).
    // Миграции идут мимо пулера (Neon отдаёт прямое подключение в DATABASE_URL_UNPOOLED).
    url:
      process.env.DATABASE_URL_UNPOOLED ??
      process.env.DATABASE_URL ??
      'postgresql://localhost:5432/placeholder',
  },
});
