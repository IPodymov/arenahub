import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { moscowDate } from '@arenahub/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { PrismaService } from '../src/infra/prisma.service';
import { assertTestDatabase } from './test-env';

export type Agent = ReturnType<typeof request.agent>;

export async function createApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication({ logger: ['error'] });
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/** Удаляет всё, кроме справочника игр. */
export async function resetData(prisma: PrismaService): Promise<void> {
  assertTestDatabase(process.env.DATABASE_URL);
  await prisma.$executeRawUnsafe(`
    TRUNCATE "LedgerEntry", "LedgerTransaction", "LedgerAccount", "NewsPost", "Dispute", "ResultSubmission",
      "MatchGame", "Match", "RegistrationMember", "Registration", "Tournament", "TeamInvite", "TeamMember",
      "Team", "LinkedAccount", "User" CASCADE`);
}

/** Агент с cookie сессии после dev-входа. */
export async function login(
  app: INestApplication,
  nickname: string,
  asAdmin = false,
): Promise<Agent> {
  const agent = request.agent(app.getHttpServer());
  await agent.post('/api/v1/auth/dev-login').send({ nickname, asAdmin }).expect(200);
  return agent;
}

/** Дата рождения, при которой сегодня (по Москве) пользователю ровно `age` лет и пара месяцев. */
export function birthDateForAge(age: number): string {
  const [y, m, d] = moscowDate(new Date()).split('-').map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(y - age, m - 1 - 2, Math.min(d, 28)));
  return shifted.toISOString().slice(0, 10);
}

export async function loginWithAge(
  app: INestApplication,
  nickname: string,
  age: number,
): Promise<Agent> {
  const agent = await login(app, nickname);
  await agent
    .put('/api/v1/users/me/birth-date')
    .send({ birthDate: birthDateForAge(age) })
    .expect(200);
  return agent;
}

const HOUR = 3600_000;

export function tournamentPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const now = Date.now();
  return {
    slug: `t-${Math.random().toString(36).slice(2, 10)}`,
    title: 'Тестовый турнир',
    gameCode: 'DOTA2',
    participantType: 'SOLO',
    teamSize: 1,
    bracketType: 'SINGLE_ELIMINATION',
    bestOf: 'BO1',
    category: 'OPEN',
    maxSlots: 8,
    registrationOpensAt: new Date(now - HOUR).toISOString(),
    registrationClosesAt: new Date(now + 24 * HOUR).toISOString(),
    startsAt: new Date(now + 48 * HOUR).toISOString(),
    ...overrides,
  };
}

/** Админ создаёт и публикует турнир, возвращает его slug. */
export async function publishTournament(
  admin: Agent,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const created = await admin
    .post('/api/v1/admin/tournaments')
    .send(tournamentPayload(overrides))
    .expect(201);
  await admin.post(`/api/v1/admin/tournaments/${created.body.id}/publish`).expect(200);
  return created.body.slug as string;
}
