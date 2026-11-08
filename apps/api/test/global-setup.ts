import { PrismaPg } from '@prisma/adapter-pg';
import { execSync } from 'node:child_process';
import { seedGames } from '../prisma/seed';
import { PrismaClient } from '../src/generated/prisma/client';
import { applyTestEnv } from './test-env';

/** Применяет миграции к тестовой БД (без сброса) и заполняет справочник игр. */
export default async function setup(): Promise<void> {
  applyTestEnv();
  execSync('pnpm exec prisma migrate deploy', { stdio: 'pipe', env: process.env });
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  try {
    await seedGames(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
