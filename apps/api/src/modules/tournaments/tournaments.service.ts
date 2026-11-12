import { Injectable } from '@nestjs/common';
import {
  ACTIVE_REGISTRATION_STATUSES,
  type BracketDto,
  type CatalogTab,
  type CreateTournamentData,
  HIDDEN_TOURNAMENT_STATUSES,
  type Paginated,
  type ParticipantDto,
  type TournamentDto,
  type TournamentStatus,
  type TournamentSummaryDto,
  type UpdateTournamentData,
  type UserRole,
} from '@arenahub/shared';
import type { z } from 'zod';
import type { GameCode, tournamentListQuery } from '@arenahub/shared';
import { DomainError } from '../../common/domain-error';
import { isUniqueViolation } from '../../common/prisma-errors';
import { Clock } from '../../infra/clock';
import { PrismaService } from '../../infra/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { computeStandings, type PrizeShare } from './domain/standings';
import { nextStatus, type StatusAction } from './domain/tournament-phase';
import { assertTournamentValid } from './domain/tournament-rules';
import type { TournamentTerms } from './domain/types';
import {
  toPolicySnapshot,
  toSummaryDto,
  toTerms,
  toTournamentDto,
  tournamentInclude,
  type TournamentRow,
} from './tournaments.mapper';

type ListQuery = z.output<typeof tournamentListQuery>;

/** Поля, которые можно менять у опубликованного турнира (не влияют на условия участия). */
const PUBLISHED_EDITABLE = new Set(['title', 'description', 'rules']);

/** Сколько предложений одного пользователя может одновременно ждать модератора. */
export const MAX_PENDING_PROPOSALS = 3;

/** Модератор удаляет только то, что не дошло до публикации; админ — любой турнир. */
const STAFF_DELETABLE: ReadonlySet<TournamentStatus> = new Set(['PROPOSED', 'REJECTED', 'DRAFT']);

const registrationName = {
  team: { select: { name: true } },
  user: { select: { nickname: true } },
} as const;

function nameOf(r: {
  team: { name: string } | null;
  teamNameSnapshot: string | null;
  user: { nickname: string } | null;
}): string {
  return r.team?.name ?? r.teamNameSnapshot ?? r.user?.nickname ?? '—';
}

@Injectable()
export class TournamentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  // ───── Публичное ─────

  async list(query: ListQuery): Promise<Paginated<TournamentSummaryDto>> {
    const now = this.clock.now();
    const where: Prisma.TournamentWhereInput = {
      AND: [
        this.tabWhere(query.tab, now),
        query.game ? { game: { code: query.game } } : {},
        query.participantType ? { participantType: query.participantType } : {},
        query.teamSize ? { teamSize: query.teamSize } : {},
        query.category ? { category: query.category } : {},
        query.paid === undefined
          ? {}
          : query.paid
            ? { entryFeeKopecks: { gt: 0 } }
            : { entryFeeKopecks: 0 },
      ],
    };
    const orderBy: Prisma.TournamentOrderByWithRelationInput =
      query.tab === 'registration' ? { startsAt: 'asc' } : { startsAt: 'desc' };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.tournament.findMany({
        where,
        include: tournamentInclude,
        orderBy: [orderBy, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.tournament.count({ where }),
    ]);
    return {
      items: rows.map((r) => toSummaryDto(r, now)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async getPublic(slug: string): Promise<TournamentDto> {
    const t = await this.prisma.tournament.findUnique({
      where: { slug },
      include: tournamentInclude,
    });
    if (!t || HIDDEN_TOURNAMENT_STATUSES.includes(t.status))
      throw new DomainError('TOURNAMENT_NOT_FOUND');
    return toTournamentDto(t, this.clock.now());
  }

  async participants(slug: string): Promise<ParticipantDto[]> {
    const t = await this.prisma.tournament.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });
    if (!t || HIDDEN_TOURNAMENT_STATUSES.includes(t.status))
      throw new DomainError('TOURNAMENT_NOT_FOUND');
    const regs = await this.prisma.registration.findMany({
      where: { tournamentId: t.id, status: { in: [...ACTIVE_REGISTRATION_STATUSES] } },
      include: {
        team: true,
        user: true,
        members: { include: { user: true }, orderBy: { isSubstitute: 'asc' } },
      },
      orderBy: { createdAt: 'asc' },
    });
    return regs.map((r) => ({
      registrationId: r.id,
      status: r.status,
      name: nameOf(r),
      team: r.team ? { id: r.team.id, name: r.team.name, tag: r.team.tag } : null,
      members: r.members.map((m) => ({
        userId: m.userId,
        nickname: m.user.nickname,
        avatarUrl: m.user.avatarUrl,
        isSubstitute: m.isSubstitute,
      })),
      registeredAt: r.createdAt.toISOString(),
    }));
  }

  async bracket(slug: string): Promise<BracketDto> {
    const t = await this.prisma.tournament.findUnique({
      where: { slug },
      select: { id: true, status: true, prizePoolKopecks: true, prizeDistribution: true },
    });
    if (!t || HIDDEN_TOURNAMENT_STATUSES.includes(t.status))
      throw new DomainError('TOURNAMENT_NOT_FOUND');

    const side = { include: registrationName } as const;
    const matches = await this.prisma.match.findMany({
      where: { tournamentId: t.id },
      include: { participantA: side, participantB: side },
      orderBy: [{ bracketGroup: 'asc' }, { round: 'asc' }, { position: 'asc' }],
    });
    const names = new Map<string, string>();
    const toSide = (r: (typeof matches)[number]['participantA']) => {
      if (!r) return null;
      names.set(r.id, nameOf(r));
      return { registrationId: r.id, name: nameOf(r), seed: r.seed };
    };

    const dtos = matches.map((m) => ({
      id: m.id,
      round: m.round,
      position: m.position,
      bracketGroup: m.bracketGroup,
      bestOf: m.bestOf,
      status: m.status,
      a: toSide(m.participantA),
      b: toSide(m.participantB),
      winnerRegistrationId: m.winnerRegistrationId,
      scoreA: m.scoreA,
      scoreB: m.scoreB,
      scheduledAt: m.scheduledAt?.toISOString() ?? null,
      completedAt: m.completedAt?.toISOString() ?? null,
    }));
    const standings = computeStandings(
      matches.map((m) => ({ ...m, completed: m.status === 'COMPLETED' })),
      t.prizePoolKopecks,
      t.prizeDistribution as PrizeShare[] | null,
    );
    return {
      rounds: Math.max(0, ...matches.filter((m) => m.bracketGroup === 0).map((m) => m.round)),
      matches: dtos,
      standings: standings.map((s) => ({
        ...s,
        name: names.get(s.registrationId) ?? '—',
        prizeKopecks: s.prizeKopecks.toString(),
      })),
    };
  }

  // ───── Предложения пользователей ─────

  async propose(actorId: string, input: CreateTournamentData): Promise<TournamentDto> {
    const pending = await this.prisma.tournament.count({
      where: { createdById: actorId, status: 'PROPOSED' },
    });
    if (pending >= MAX_PENDING_PROPOSALS)
      throw new DomainError('PROPOSAL_LIMIT_REACHED', { max: MAX_PENDING_PROPOSALS });
    return this.create(actorId, input, 'PROPOSED');
  }

  async myProposals(actorId: string): Promise<TournamentDto[]> {
    const now = this.clock.now();
    const rows = await this.prisma.tournament.findMany({
      where: { createdById: actorId },
      include: tournamentInclude,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((r) => toTournamentDto(r, now));
  }

  /** Автор может отозвать предложение, пока его не рассмотрели. */
  async withdrawProposal(actorId: string, id: string): Promise<void> {
    const { count } = await this.prisma.tournament.deleteMany({
      where: { id, createdById: actorId, status: 'PROPOSED' },
    });
    if (count === 0) throw new DomainError('TOURNAMENT_NOT_FOUND');
  }

  // ───── Модерация ─────

  async adminList(
    page: number,
    pageSize: number,
    status?: TournamentStatus,
  ): Promise<Paginated<TournamentSummaryDto>> {
    const now = this.clock.now();
    const where: Prisma.TournamentWhereInput = status ? { status } : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.tournament.findMany({
        where,
        include: tournamentInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.tournament.count({ where }),
    ]);
    return { items: rows.map((r) => toSummaryDto(r, now)), total, page, pageSize };
  }

  async adminGet(id: string): Promise<TournamentDto> {
    return toTournamentDto(await this.load(id), this.clock.now());
  }

  async create(
    actorId: string,
    input: CreateTournamentData,
    status: 'DRAFT' | 'PROPOSED' = 'DRAFT',
  ): Promise<TournamentDto> {
    const game = await this.loadGame(input.gameCode);
    const { gameCode: _gameCode, ...data } = input;
    const terms: TournamentTerms = {
      ...data,
      status,
      minAge: data.minAge ?? null,
    };
    assertTournamentValid(terms, toPolicySnapshot(game.policy!));

    try {
      const t = await this.prisma.tournament.create({
        data: {
          ...data,
          prizeDistribution: data.prizeDistribution ?? undefined,
          gameId: game.id,
          status,
          createdById: actorId,
        },
        include: tournamentInclude,
      });
      return toTournamentDto(t, this.clock.now());
    } catch (err) {
      if (isUniqueViolation(err)) throw new DomainError('SLUG_TAKEN');
      throw err;
    }
  }

  async update(id: string, patch: UpdateTournamentData): Promise<TournamentDto> {
    const current = await this.load(id);
    const keys = Object.keys(patch);
    if (current.status === 'PUBLISHED') {
      if (keys.some((k) => !PUBLISHED_EDITABLE.has(k)))
        throw new DomainError('TOURNAMENT_NOT_EDITABLE');
    } else if (current.status !== 'DRAFT' && current.status !== 'PROPOSED') {
      throw new DomainError('TOURNAMENT_NOT_EDITABLE');
    }

    const { gameCode, ...data } = patch;
    const game = gameCode ? await this.loadGame(gameCode) : current.game;
    const merged: TournamentTerms = {
      ...toTerms(current),
      ...data,
      minAge: data.minAge !== undefined ? data.minAge : current.minAge,
    };
    assertTournamentValid(merged, toPolicySnapshot(game.policy!));

    try {
      const t = await this.prisma.tournament.update({
        where: { id },
        data: {
          ...data,
          prizeDistribution:
            data.prizeDistribution === null ? Prisma.DbNull : data.prizeDistribution,
          gameId: game.id,
        },
        include: tournamentInclude,
      });
      return toTournamentDto(t, this.clock.now());
    } catch (err) {
      if (isUniqueViolation(err)) throw new DomainError('SLUG_TAKEN');
      throw err;
    }
  }

  /** Смена статуса; `note` — причина отклонения предложения. */
  async changeStatus(id: string, action: StatusAction, note?: string): Promise<TournamentDto> {
    const current = await this.load(id);
    const now = this.clock.now();
    const status = nextStatus(current, action, now);
    if (!status)
      throw new DomainError('INVALID_STATUS_TRANSITION', { from: current.status, action });
    if (action === 'publish' || action === 'approve')
      assertTournamentValid(toTerms(current), toPolicySnapshot(current.game.policy!));
    const reviewed = action === 'approve' || action === 'reject';

    // Условие на статус в where — защита от гонки двух модераторов
    const { count } = await this.prisma.tournament.updateMany({
      where: { id, status: current.status },
      data: {
        status,
        completedAt: status === 'COMPLETED' ? now : undefined,
        cancelledAt: status === 'CANCELLED' ? now : undefined,
        reviewedAt: reviewed ? now : undefined,
        reviewNote: action === 'reject' ? note : reviewed ? null : undefined,
      },
    });
    if (count === 0)
      throw new DomainError('INVALID_STATUS_TRANSITION', { from: current.status, action });
    return toTournamentDto(await this.load(id), now);
  }

  async remove(id: string, actorRole: UserRole): Promise<void> {
    const current = await this.load(id);
    if (actorRole !== 'ADMIN' && !STAFF_DELETABLE.has(current.status))
      throw new DomainError('FORBIDDEN_FOR_ROLE');
    // Админ может удалить и сыгранный турнир — вместе с сеткой и заявками
    await this.prisma.$transaction([
      this.prisma.dispute.deleteMany({ where: { match: { tournamentId: id } } }),
      this.prisma.match.deleteMany({ where: { tournamentId: id } }),
      this.prisma.registration.deleteMany({ where: { tournamentId: id } }),
      this.prisma.tournament.delete({ where: { id } }),
    ]);
  }

  private tabWhere(tab: CatalogTab, now: Date): Prisma.TournamentWhereInput {
    // Должно совпадать с tournamentPhase()/TAB_PHASES
    switch (tab) {
      case 'registration':
        return { status: 'PUBLISHED', startsAt: { gt: now } };
      case 'live':
        return { OR: [{ status: 'IN_PROGRESS' }, { status: 'PUBLISHED', startsAt: { lte: now } }] };
      case 'finished':
        return { status: { in: ['COMPLETED', 'CANCELLED'] } };
    }
  }

  private async load(id: string): Promise<TournamentRow> {
    const t = await this.prisma.tournament.findUnique({
      where: { id },
      include: tournamentInclude,
    });
    if (!t) throw new DomainError('TOURNAMENT_NOT_FOUND');
    return t;
  }

  private async loadGame(code: GameCode) {
    const game = await this.prisma.game.findUnique({ where: { code }, include: { policy: true } });
    if (!game?.policy) throw new DomainError('GAME_NOT_FOUND');
    if (!game.isActive) throw new DomainError('GAME_INACTIVE');
    return game;
  }
}
