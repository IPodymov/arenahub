import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seedDemo } from '../prisma/demo';
import type { PrismaService } from '../src/infra/prisma.service';
import { createApp, login, publishTournament, resetData, tournamentPayload } from './helpers';

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

async function loginAs(nickname: string, role: 'MODERATOR' | 'ADMIN') {
  const agent = await login(app, nickname);
  // Роль читается из БД на каждом запросе — перелогин не нужен
  await prisma.user.update({ where: { nickname }, data: { role } });
  return agent;
}

describe('предложения турниров', () => {
  it('пользователь предлагает, модератор отклоняет с причиной или одобряет', async () => {
    const user = await login(app, 'player');
    const moder = await loginAs('moder', 'MODERATOR');

    const first = await user.post('/api/v1/proposals').send(tournamentPayload()).expect(201);
    expect(first.body).toMatchObject({ status: 'PROPOSED', createdBy: { nickname: 'player' } });
    // До одобрения турнира нет ни в каталоге, ни по ссылке
    await request(app.getHttpServer()).get(`/api/v1/tournaments/${first.body.slug}`).expect(404);
    await user.get('/api/v1/admin/tournaments').expect(403);

    const queue = await moder.get('/api/v1/admin/tournaments?status=PROPOSED').expect(200);
    expect(queue.body.items.map((t: { id: string }) => t.id)).toEqual([first.body.id]);

    await moder.post(`/api/v1/admin/tournaments/${first.body.id}/reject`).send({}).expect(400);
    await moder
      .post(`/api/v1/admin/tournaments/${first.body.id}/reject`)
      .send({ note: 'Нет правил' })
      .expect(200);

    const second = await user.post('/api/v1/proposals').send(tournamentPayload()).expect(201);
    const approved = await moder
      .post(`/api/v1/admin/tournaments/${second.body.id}/approve`)
      .expect(200);
    expect(approved.body).toMatchObject({ status: 'PUBLISHED', phase: 'REGISTRATION' });
    await request(app.getHttpServer()).get(`/api/v1/tournaments/${second.body.slug}`).expect(200);

    const mine = await user.get('/api/v1/proposals/mine').expect(200);
    const byId = Object.fromEntries(mine.body.map((t: { id: string }) => [t.id, t]));
    expect(byId[first.body.id]).toMatchObject({ status: 'REJECTED', reviewNote: 'Нет правил' });
    expect(byId[second.body.id]).toMatchObject({ status: 'PUBLISHED', reviewNote: null });

    // Повторно рассмотреть нельзя
    await moder.post(`/api/v1/admin/tournaments/${second.body.id}/approve`).expect(422);
  });

  it('предложения проверяются политикой игры и ограничены по количеству', async () => {
    const user = await login(app, 'player');
    const paid = await user
      .post('/api/v1/proposals')
      .send(tournamentPayload({ gameCode: 'BRAWL_STARS', entryFeeKopecks: '10000' }))
      .expect(422);
    expect(paid.body.code).toBe('PAID_ENTRY_FORBIDDEN_BY_GAME');

    for (let i = 0; i < 3; i++)
      await user.post('/api/v1/proposals').send(tournamentPayload()).expect(201);
    const limited = await user.post('/api/v1/proposals').send(tournamentPayload()).expect(422);
    expect(limited.body.code).toBe('PROPOSAL_LIMIT_REACHED');

    // Отозванное предложение освобождает место
    const mine = await user.get('/api/v1/proposals/mine').expect(200);
    await user.delete(`/api/v1/proposals/${mine.body[0].id}`).expect(204);
    await user.post('/api/v1/proposals').send(tournamentPayload()).expect(201);
  });

  it('чужое предложение отозвать нельзя', async () => {
    const author = await login(app, 'author');
    const other = await login(app, 'other');
    const p = await author.post('/api/v1/proposals').send(tournamentPayload()).expect(201);
    await other.delete(`/api/v1/proposals/${p.body.id}`).expect(404);
  });
});

describe('права модератора и админа', () => {
  it('модератор создаёт турниры сразу, но удаляет только неопубликованные', async () => {
    const moder = await loginAs('moder', 'MODERATOR');
    const admin = await loginAs('chief', 'ADMIN');
    const slug = await publishTournament(moder);
    const { id } = (await moder.get(`/api/v1/tournaments/${slug}`).expect(200)).body;

    const denied = await moder.delete(`/api/v1/admin/tournaments/${id}`).expect(403);
    expect(denied.body.code).toBe('FORBIDDEN_FOR_ROLE');
    await admin.delete(`/api/v1/admin/tournaments/${id}`).expect(204);

    const draft = await moder.post('/api/v1/admin/tournaments').send(tournamentPayload());
    await moder.delete(`/api/v1/admin/tournaments/${draft.body.id}`).expect(204);
  });

  it('роли и баны — только у админа, себе менять нельзя', async () => {
    const moder = await loginAs('moder', 'MODERATOR');
    const admin = await loginAs('chief', 'ADMIN');
    const user = await login(app, 'player');
    const { id: userId } = (await user.get('/api/v1/auth/me')).body;
    const { id: adminId } = (await admin.get('/api/v1/auth/me')).body;

    await moder.get('/api/v1/admin/users').expect(403);
    const list = await admin.get('/api/v1/admin/users?q=PLAY').expect(200);
    expect(list.body.items).toHaveLength(1);

    const promoted = await admin
      .patch(`/api/v1/admin/users/${userId}/role`)
      .send({ role: 'MODERATOR' })
      .expect(200);
    expect(promoted.body.role).toBe('MODERATOR');
    await user.get('/api/v1/admin/tournaments').expect(200);

    const self = await admin
      .patch(`/api/v1/admin/users/${adminId}/role`)
      .send({ role: 'USER' })
      .expect(403);
    expect(self.body.code).toBe('CANNOT_MODERATE_SELF');

    await admin.post(`/api/v1/admin/users/${userId}/ban`).expect(200);
    await user.get('/api/v1/auth/me').expect(401);
    await admin.post(`/api/v1/admin/users/${userId}/unban`).expect(200);
  });
});

describe('демо-данные и сетка', () => {
  it('у сыгранного турнира есть сетка, места и призы в пределах фонда', async () => {
    await seedDemo(prisma, { reset: true });
    const http = request(app.getHttpServer());

    const res = await http.get('/api/v1/tournaments/dota-2-autumn-major/bracket').expect(200);
    expect(res.body.rounds).toBe(3);
    // 7 матчей сетки + матч за 3-е место
    expect(res.body.matches).toHaveLength(8);
    expect(res.body.matches.every((m: { status: string }) => m.status === 'COMPLETED')).toBe(true);
    const places = res.body.standings.map((s: { place: number }) => s.place);
    expect(places).toEqual([1, 2, 3, 4, 5, 5, 5, 5]);
    expect(res.body.standings[0].prizeKopecks).toBe('7500000');
    const paid = res.body.standings.reduce(
      (sum: bigint, s: { prizeKopecks: string }) => sum + BigInt(s.prizeKopecks),
      0n,
    );
    expect(paid).toBe(15_000_000n);

    // Финал — до трёх побед
    const final = res.body.matches.find(
      (m: { round: number; bracketGroup: number }) => m.round === 3 && m.bracketGroup === 0,
    );
    expect(Math.max(final.scoreA, final.scoreB)).toBe(3);

    const live = await http.get('/api/v1/tournaments/dota-2-weekend-clash/bracket').expect(200);
    expect(live.body.standings).toEqual([]);
    expect(live.body.matches.filter((m: { status: string }) => m.status === 'READY')).toHaveLength(
      2,
    );

    const finished = await http.get('/api/v1/tournaments?tab=finished&pageSize=50').expect(200);
    expect(finished.body.total).toBe(7);
    await http.get('/api/v1/tournaments/dota-2-turbo-community').expect(404);

    // Повторный запуск без --reset ничего не дублирует
    expect(await seedDemo(prisma, { reset: false })).toBe(0);
  });
});
