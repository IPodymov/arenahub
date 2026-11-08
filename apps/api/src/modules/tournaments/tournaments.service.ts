import { Injectable } from '@nestjs/common';
import {
  ACTIVE_REGISTRATION_STATUSES,
  type CatalogTab,
  type CreateTournamentData,
  type Paginated,
  type ParticipantDto,
  type TournamentDto,
  type TournamentSummaryDto,
  type UpdateTournamentData,
} from '@arenahub/shared';
import type { z } from 'zod';
import type { GameCode, tournamentListQuery } from '@arenahub/shared';
import { DomainError } from '../../common/domain-error';
import { isUniqueViolation } from '../../common/prisma-errors';
import { Clock } from '../../infra/clock';
import { PrismaService } from '../../infra/prisma.service';
import { Prisma } from '../../generated/prisma/client';
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
    if (!t || t.status === 'DRAFT') throw new DomainError('TOURNAMENT_NOT_FOUND');
    return toTournamentDto(t, this.clock.now());
  }

  async participants(slug: string): Promise<ParticipantDto[]> {
    const t = await this.prisma.tournament.findUnique({
      where: { slug },
      select: { id: true, status: true },
    });
    if (!t || t.status === 'DRAFT') throw new DomainError('TOURNAMENT_NOT_FOUND');
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
      name: r.team?.name ?? r.teamNameSnapshot ?? r.user?.nickname ?? '—',
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

  // ───── Админка ─────

  async adminList(page: number, pageSize: number): Promise<Paginated<TournamentSummaryDto>> {
    const now = this.clock.now();
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.tournament.findMany({
        include: tournamentInclude,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.tournament.count(),
    ]);
    return { items: rows.map((r) => toSummaryDto(r, now)), total, page, pageSize };
  }

  async adminGet(id: string): Promise<TournamentDto> {
    return toTournamentDto(await this.load(id), this.clock.now());
  }

  async create(actorId: string, input: CreateTournamentData): Promise<TournamentDto> {
    const game = await this.loadGame(input.gameCode);
    const { gameCode: _gameCode, ...data } = input;
    const terms: TournamentTerms = {
      ...data,
      status: 'DRAFT',
      minAge: data.minAge ?? null,
    };
    assertTournamentValid(terms, toPolicySnapshot(game.policy!));

    try {
      const t = await this.prisma.tournament.create({
        data: {
          ...data,
          prizeDistribution: data.prizeDistribution ?? undefined,
          gameId: game.id,
          status: 'DRAFT',
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
    } else if (current.status !== 'DRAFT') {
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

  async changeStatus(id: string, action: StatusAction): Promise<TournamentDto> {
    const current = await this.load(id);
    const now = this.clock.now();
    const status = nextStatus(current, action, now);
    if (!status)
      throw new DomainError('INVALID_STATUS_TRANSITION', { from: current.status, action });
    if (action === 'publish')
      assertTournamentValid(toTerms(current), toPolicySnapshot(current.game.policy!));

    const t = await this.prisma.tournament.update({
      where: { id },
      data: {
        status,
        completedAt: status === 'COMPLETED' ? now : undefined,
        cancelledAt: status === 'CANCELLED' ? now : undefined,
      },
      include: tournamentInclude,
    });
    return toTournamentDto(t, now);
  }

  async remove(id: string): Promise<void> {
    const current = await this.load(id);
    if (current.status !== 'DRAFT') throw new DomainError('TOURNAMENT_NOT_EDITABLE');
    await this.prisma.tournament.delete({ where: { id } });
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
