import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaService } from '../src/infra/prisma.service';
import { type Agent, createApp, login, resetData } from './helpers';

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

async function register(nickname: string, password = 'secret-pass-1'): Promise<Agent> {
  const agent = request.agent(app.getHttpServer());
  await agent.post('/api/v1/auth/register').send({ nickname, password }).expect(201);
  return agent;
}

async function signIn(nickname: string, password: string, status = 200): Promise<Agent> {
  const agent = request.agent(app.getHttpServer());
  await agent.post('/api/v1/auth/login').send({ nickname, password }).expect(status);
  return agent;
}

describe('профиль', () => {
  it('почта: добавление, вход по ней, уникальность без учёта регистра, удаление', async () => {
    const user = await register('mailer');
    const me = await user
      .patch('/api/v1/users/me')
      .send({ email: 'Mailer@Example.COM' })
      .expect(200);
    expect(me.body).toMatchObject({ email: 'mailer@example.com', hasPassword: true });

    await signIn('MAILER@example.com', 'secret-pass-1');

    const other = await register('other');
    const taken = await other
      .patch('/api/v1/users/me')
      .send({ email: 'mailer@EXAMPLE.com' })
      .expect(409);
    expect(taken.body.code).toBe('EMAIL_TAKEN');
    // Ник по-прежнему отличается от почты в ошибке
    const nick = await other.patch('/api/v1/users/me').send({ nickname: 'mailer' }).expect(409);
    expect(nick.body.code).toBe('NICKNAME_TAKEN');

    await user.patch('/api/v1/users/me').send({ email: 'not-an-email' }).expect(400);
    const cleared = await user.patch('/api/v1/users/me').send({ email: null }).expect(200);
    expect(cleared.body.email).toBeNull();
  });

  it('аватар — только https-ссылка', async () => {
    const user = await register('avatar');
    await user.patch('/api/v1/users/me').send({ avatarUrl: 'http://x.ru/a.png' }).expect(400);
    const ok = await user
      .patch('/api/v1/users/me')
      .send({ avatarUrl: 'https://x.ru/a.png' })
      .expect(200);
    expect(ok.body.avatarUrl).toBe('https://x.ru/a.png');
  });

  it('смена пароля проверяет текущий и разлогинивает другие устройства', async () => {
    const phone = await register('changer');
    const laptop = await signIn('changer', 'secret-pass-1');

    const wrong = await phone
      .put('/api/v1/users/me/password')
      .send({ currentPassword: 'nope-nope', newPassword: 'brand-new-pass' })
      .expect(422);
    expect(wrong.body.code).toBe('WRONG_PASSWORD');
    await phone
      .put('/api/v1/users/me/password')
      .send({ newPassword: 'brand-new-pass' })
      .expect(422);
    await phone
      .put('/api/v1/users/me/password')
      .send({ currentPassword: 'secret-pass-1', newPassword: 'short' })
      .expect(400);

    await phone
      .put('/api/v1/users/me/password')
      .send({ currentPassword: 'secret-pass-1', newPassword: 'brand-new-pass' })
      .expect(204);
    await phone.get('/api/v1/auth/me').expect(200);
    await laptop.get('/api/v1/auth/me').expect(401);

    await signIn('changer', 'secret-pass-1', 401);
    await signIn('changer', 'brand-new-pass');
  });

  it('без пароля (dev-вход) можно задать первый пароль без текущего', async () => {
    const user = await login(app, 'steamer');
    expect((await user.get('/api/v1/auth/me')).body.hasPassword).toBe(false);
    await user.put('/api/v1/users/me/password').send({ newPassword: 'first-pass-1' }).expect(204);
    expect((await user.get('/api/v1/auth/me')).body.hasPassword).toBe(true);
    await signIn('steamer', 'first-pass-1');
  });

  it('«выйти на других устройствах» оставляет текущую сессию', async () => {
    const current = await register('sessions');
    const other = await signIn('sessions', 'secret-pass-1');
    await current.post('/api/v1/users/me/sessions/revoke').expect(204);
    await current.get('/api/v1/auth/me').expect(200);
    await other.get('/api/v1/auth/me').expect(401);
  });
});
