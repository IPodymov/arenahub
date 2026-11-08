import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { PrismaService } from '../src/infra/prisma.service';
import {
  createApp,
  login,
  loginWithAge,
  publishTournament,
  resetData,
  tournamentPayload,
} from './helpers';

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

describe('вход → команда → приглашение → регистрация', () => {
  it('капитан собирает команду по ссылке и регистрирует её на турнир Brawl Stars 3x3', async () => {
    const admin = await login(app, 'admin', true);
    const slug = await publishTournament(admin, {
      gameCode: 'BRAWL_STARS',
      participantType: 'TEAM',
      teamSize: 3,
      maxSubstitutes: 1,
      bestOf: 'BO3',
    });

    // Вход и профиль
    const captain = await login(app, 'captain');
    const me = await captain.get('/api/v1/auth/me').expect(200);
    expect(me.body.eligibility.canPlayFree).toBe(false);
    const withAge = await captain
      .put('/api/v1/users/me/birth-date')
      .send({ birthDate: '2000-03-15' })
      .expect(200);
    expect(withAge.body.eligibility).toMatchObject({
      age: expect.any(Number),
      canPlayFree: true,
      canPlayPaid: true,
    });

    // Команда и приглашение
    const team = await captain
      .post('/api/v1/teams')
      .send({ gameCode: 'BRAWL_STARS', name: 'Звёзды', tag: 'STAR' })
      .expect(201);
    expect(team.body.captainId).toBe(me.body.id);
    const invite = await captain
      .post(`/api/v1/teams/${team.body.id}/invites`)
      .send({ maxUses: 2 })
      .expect(201);
    const token = String(invite.body.url).split('/invite/')[1]!;

    const preview = await request(app.getHttpServer()).get(`/api/v1/invites/${token}`).expect(200);
    expect(preview.body.team.name).toBe('Звёзды');

    for (const nick of ['friend1', 'friend2']) {
      const friend = await loginWithAge(app, nick, 16);
      await friend.post(`/api/v1/invites/${token}/accept`).expect(201);
    }
    // Ссылка рассчитана на 2 использования
    const extra = await loginWithAge(app, 'friend3', 20);
    const used = await extra.post(`/api/v1/invites/${token}/accept`).expect(422);
    expect(used.body.code).toBe('INVITE_INVALID');

    // Регистрация (состав — игроки команды по умолчанию)
    const reg = await captain
      .post(`/api/v1/tournaments/${slug}/registrations`)
      .send({ teamId: team.body.id })
      .expect(201);
    expect(reg.body.status).toBe('CONFIRMED');

    const participants = await request(app.getHttpServer())
      .get(`/api/v1/tournaments/${slug}/participants`)
      .expect(200);
    expect(participants.body).toHaveLength(1);
    expect(participants.body[0].members).toHaveLength(3);

    const tournament = await request(app.getHttpServer())
      .get(`/api/v1/tournaments/${slug}`)
      .expect(200);
    expect(tournament.body.takenSlots).toBe(1);

    // Повторная заявка и выход заявленного игрока
    const again = await captain
      .post(`/api/v1/tournaments/${slug}/registrations`)
      .send({ teamId: team.body.id })
      .expect(409);
    expect(again.body.code).toBe('ALREADY_REGISTERED');

    const friend1 = await login(app, 'friend1');
    const leave = await friend1.post(`/api/v1/teams/${team.body.id}/leave`).expect(422);
    expect(leave.body.code).toBe('MEMBER_LOCKED_IN_TOURNAMENT');

    // После отзыва заявки выйти можно
    await captain.delete(`/api/v1/tournaments/${slug}/registrations/mine`).expect(204);
    await friend1.post(`/api/v1/teams/${team.body.id}/leave`).expect(204);
  });

  it('смена капитана: старый капитан после передачи может выйти', async () => {
    const captain = await loginWithAge(app, 'cap', 20);
    const team = await captain
      .post('/api/v1/teams')
      .send({ gameCode: 'DOTA2', name: 'Radiant' })
      .expect(201);
    const invite = await captain.post(`/api/v1/teams/${team.body.id}/invites`).send({}).expect(201);
    const token = String(invite.body.url).split('/invite/')[1]!;
    const mate = await loginWithAge(app, 'mate', 20);
    const joined = await mate.post(`/api/v1/invites/${token}/accept`).expect(201);
    const mateId = joined.body.members.find(
      (m: { nickname: string }) => m.nickname === 'mate',
    ).userId;

    const blocked = await captain.post(`/api/v1/teams/${team.body.id}/leave`).expect(422);
    expect(blocked.body.code).toBe('CAPTAIN_MUST_TRANSFER');

    const transferred = await captain
      .post(`/api/v1/teams/${team.body.id}/captain`)
      .send({ userId: mateId })
      .expect(201);
    expect(transferred.body.captainId).toBe(mateId);
    await captain.post(`/api/v1/teams/${team.body.id}/leave`).expect(204);
  });
});

describe('доменные ограничения', () => {
  it('турнир Brawl Stars с платным входом создать нельзя — ошибка домена', async () => {
    const admin = await login(app, 'admin', true);
    const res = await admin
      .post('/api/v1/admin/tournaments')
      .send(tournamentPayload({ gameCode: 'BRAWL_STARS', entryFeeKopecks: '10000' }))
      .expect(422);
    expect(res.body.code).toBe('PAID_ENTRY_FORBIDDEN_BY_GAME');
  });

  it('даже в обход домена БД не даст сохранить платный турнир Brawl Stars', async () => {
    const admin = await prisma.user.create({ data: { nickname: 'raw-admin', role: 'ADMIN' } });
    const game = await prisma.game.findUniqueOrThrow({ where: { code: 'BRAWL_STARS' } });
    const now = Date.now();
    await expect(
      prisma.tournament.create({
        data: {
          slug: 'raw-paid-bs',
          title: 'raw',
          gameId: game.id,
          participantType: 'SOLO',
          teamSize: 1,
          bracketType: 'SINGLE_ELIMINATION',
          bestOf: 'BO1',
          category: 'OPEN',
          maxSlots: 8,
          entryFeeKopecks: 100n,
          registrationOpensAt: new Date(now),
          registrationClosesAt: new Date(now + 1000),
          startsAt: new Date(now + 2000),
          createdById: admin.id,
        },
      }),
    ).rejects.toThrow(/PAID_ENTRY_FORBIDDEN_BY_GAME/);
  });

  it('пользователь 16–17 лет не может зарегистрироваться на платный турнир, взрослый — может', async () => {
    const admin = await login(app, 'admin', true);
    const slug = await publishTournament(admin, {
      entryFeeKopecks: '50000',
      prizePoolKopecks: '200000',
      prizeSource: 'ENTRY_FEES',
    });

    const teen = await loginWithAge(app, 'teen', 17);
    const denied = await teen
      .post(`/api/v1/tournaments/${slug}/registrations`)
      .send({})
      .expect(422);
    expect(denied.body.code).toBe('PAID_TOURNAMENT_ADULTS_ONLY');

    const adult = await loginWithAge(app, 'adult', 18);
    const ok = await adult.post(`/api/v1/tournaments/${slug}/registrations`).send({}).expect(201);
    expect(ok.body.status).toBe('PENDING_PAYMENT');
  });

  it('16–17 лет — бесплатный турнир доступен', async () => {
    const admin = await login(app, 'admin', true);
    const slug = await publishTournament(admin);
    const teen = await loginWithAge(app, 'teen', 16);
    const ok = await teen.post(`/api/v1/tournaments/${slug}/registrations`).send({}).expect(201);
    expect(ok.body.status).toBe('CONFIRMED');
  });

  it('слоты: заявка сверх лимита отклоняется', async () => {
    const admin = await login(app, 'admin', true);
    const slug = await publishTournament(admin, { maxSlots: 2 });
    for (const nick of ['player1', 'player2']) {
      const p = await loginWithAge(app, nick, 20);
      await p.post(`/api/v1/tournaments/${slug}/registrations`).send({}).expect(201);
    }
    const late = await loginWithAge(app, 'player3', 20);
    const res = await late.post(`/api/v1/tournaments/${slug}/registrations`).send({}).expect(422);
    expect(res.body.code).toBe('TOURNAMENT_FULL');
  });

  it('дату рождения нельзя поменять самому, младше 16 — нельзя указать', async () => {
    const user = await login(app, 'kid');
    const young = await user
      .put('/api/v1/users/me/birth-date')
      .send({ birthDate: '2015-01-01' })
      .expect(422);
    expect(young.body.code).toBe('AGE_BELOW_PLATFORM_MINIMUM');
    await user.put('/api/v1/users/me/birth-date').send({ birthDate: '2000-01-01' }).expect(200);
    const again = await user
      .put('/api/v1/users/me/birth-date')
      .send({ birthDate: '1990-01-01' })
      .expect(422);
    expect(again.body.code).toBe('BIRTH_DATE_ALREADY_SET');
  });
});

describe('каталог и админка', () => {
  it('опубликованный турнир появляется в каталоге с фазой «Регистрация», черновик — нет', async () => {
    const admin = await login(app, 'admin', true);
    const draft = await admin
      .post('/api/v1/admin/tournaments')
      .send(tournamentPayload({ slug: 'draft-one' }))
      .expect(201);
    expect(draft.body.status).toBe('DRAFT');
    const slug = await publishTournament(admin, { slug: 'published-one', gameCode: 'CS2' });

    const anon = request(app.getHttpServer());
    const list = await anon.get('/api/v1/tournaments?tab=registration').expect(200);
    expect(list.body.items.map((t: { slug: string }) => t.slug)).toEqual([slug]);
    expect(list.body.items[0].phase).toBe('REGISTRATION');

    const filtered = await anon.get('/api/v1/tournaments?tab=registration&game=DOTA2').expect(200);
    expect(filtered.body.total).toBe(0);

    await anon.get('/api/v1/tournaments/draft-one').expect(404);

    await admin.post(`/api/v1/admin/tournaments/${draft.body.id}/cancel`).expect(200);
    const finished = await anon.get('/api/v1/tournaments?tab=finished').expect(200);
    expect(finished.body.items[0]).toMatchObject({ slug: 'draft-one', phase: 'CANCELLED' });
  });

  it('админские эндпоинты закрыты для обычных пользователей и анонимов', async () => {
    const user = await login(app, 'user');
    await user.post('/api/v1/admin/tournaments').send(tournamentPayload()).expect(403);
    await request(app.getHttpServer()).get('/api/v1/admin/tournaments').expect(401);
  });

  it('logout завершает сессию', async () => {
    const user = await login(app, 'user');
    await user.post('/api/v1/auth/logout').expect(204);
    await user.get('/api/v1/auth/me').expect(401);
  });
});
