import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaService } from '../src/infra/prisma.service';
import { createApp, resetData } from './helpers';

let app: INestApplication;
let prisma: PrismaService;

beforeAll(async () => {
  ({ app, prisma } = await createApp());
});
afterAll(async () => {
  await app?.close();
});
beforeEach(async () => {
  await resetData(prisma);
});

describe('регистрация и вход по паролю', () => {
  it('регистрирует, выходит и снова входит', async () => {
    const agent = request.agent(app.getHttpServer());
    const credentials = { nickname: 'player_one', password: 'secret-pass' };

    const registered = await agent.post('/api/v1/auth/register').send(credentials).expect(201);
    expect(registered.body).toMatchObject({ nickname: 'player_one', role: 'USER' });
    await agent.get('/api/v1/auth/me').expect(200);

    await agent.post('/api/v1/auth/logout').expect(204);
    await agent.get('/api/v1/auth/me').expect(401);

    await agent.post('/api/v1/auth/login').send(credentials).expect(200);
    const me = await agent.get('/api/v1/auth/me').expect(200);
    expect(me.body.id).toBe(registered.body.id);

    const user = await prisma.user.findUniqueOrThrow({ where: { nickname: 'player_one' } });
    expect(user.passwordHash).toMatch(/^scrypt\$/);
  });

  it('не даёт занять никнейм повторно', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/api/v1/auth/register')
      .send({ nickname: 'taken', password: 'secret-pass' })
      .expect(201);
    const res = await request(server)
      .post('/api/v1/auth/register')
      .send({ nickname: 'taken', password: 'other-pass' })
      .expect(409);
    expect(res.body.code).toBe('NICKNAME_TAKEN');
  });

  it('отклоняет короткий пароль', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ nickname: 'shorty', password: '123' })
      .expect(400);
  });

  it('отвечает одинаково на неверный пароль и несуществующий никнейм', async () => {
    const server = app.getHttpServer();
    await request(server)
      .post('/api/v1/auth/register')
      .send({ nickname: 'real', password: 'secret-pass' })
      .expect(201);

    const wrongPassword = await request(server)
      .post('/api/v1/auth/login')
      .send({ nickname: 'real', password: 'wrong-pass' })
      .expect(401);
    const unknownUser = await request(server)
      .post('/api/v1/auth/login')
      .send({ nickname: 'ghost', password: 'secret-pass' })
      .expect(401);
    expect(wrongPassword.body).toEqual(unknownUser.body);
    expect(wrongPassword.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('выдаёт роль admin никнеймам из ADMIN_NICKNAMES', async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .post('/api/v1/auth/register')
      .send({ nickname: 'boss', password: 'secret-pass' })
      .expect(201);
    expect(res.body.role).toBe('ADMIN');

    // Уже зарегистрированный пользователь повышается при следующем входе
    await prisma.user.update({ where: { nickname: 'boss' }, data: { role: 'USER' } });
    const relogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ nickname: 'boss', password: 'secret-pass' })
      .expect(200);
    expect(relogin.body.role).toBe('ADMIN');
  });

  it('не пускает по паролю пользователя без пароля (dev/Steam)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/dev-login')
      .send({ nickname: 'devuser' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ nickname: 'devuser', password: 'anything-123' })
      .expect(401);
  });
});
