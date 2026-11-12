import { Injectable } from '@nestjs/common';
import {
  ACTIVE_REGISTRATION_STATUSES,
  HIDDEN_TOURNAMENT_STATUSES,
  type MyRegistrationDto,
  type registerForTournamentSchema,
} from '@arenahub/shared';
import type { z } from 'zod';
import { dateOnlyToString } from '../../common/dates';
import { DomainError } from '../../common/domain-error';
import { isUniqueViolation } from '../../common/prisma-errors';
import { Clock } from '../../infra/clock';
import { PrismaService } from '../../infra/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import {
  assertCanWithdraw,
  checkRegistration,
  type Participant,
} from './domain/registration-rules';
import { toPolicySnapshot, toTerms, tournamentInclude } from './tournaments.mapper';

type RegisterInput = z.output<typeof registerForTournamentSchema>;
type Tx = Prisma.TransactionClient;

const participantInclude = {
  linkedAccounts: { select: { provider: true } },
} satisfies Prisma.UserInclude;
type UserRow = Prisma.UserGetPayload<{ include: typeof participantInclude }>;

function toParticipant(u: UserRow): Participant {
  return {
    id: u.id,
    nickname: u.nickname,
    birthDate: u.birthDate ? dateOnlyToString(u.birthDate) : null,
    banned: u.bannedAt !== null,
    linkedProviders: u.linkedAccounts.map((a) => a.provider),
  };
}

@Injectable()
export class RegistrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  /**
   * Регистрация соло-игрока или команды. Строка турнира блокируется на время транзакции,
   * поэтому проверка слотов и вставка атомарны.
   */
  async register(actorId: string, slug: string, input: RegisterInput): Promise<MyRegistrationDto> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<{ id: string }[]>`
          SELECT id FROM "Tournament"
          WHERE slug = ${slug} AND status NOT IN ('PROPOSED', 'REJECTED', 'DRAFT') FOR UPDATE`;
        const tournamentId = locked[0]?.id;
        if (!tournamentId) throw new DomainError('TOURNAMENT_NOT_FOUND');

        const t = await tx.tournament.findUniqueOrThrow({
          where: { id: tournamentId },
          include: tournamentInclude,
        });
        const actor = toParticipant(
          await tx.user.findUniqueOrThrow({ where: { id: actorId }, include: participantInclude }),
        );

        const team = input.teamId
          ? await tx.team.findUnique({ where: { id: input.teamId }, include: { members: true } })
          : null;
        if (input.teamId && !team) throw new DomainError('TEAM_NOT_FOUND');

        // Состав по умолчанию — роли из ростера команды
        const playerIds = team
          ? (input.playerIds ??
            team.members.filter((m) => m.role === 'PLAYER').map((m) => m.userId))
          : [actorId];
        const substituteIds = team
          ? input.playerIds
            ? input.substituteIds
            : team.members.filter((m) => m.role === 'SUBSTITUTE').map((m) => m.userId)
          : [];

        const users = await this.loadUsers(tx, [...playerIds, ...substituteIds]);
        const pick = (ids: string[]) =>
          ids.flatMap((id) => (users.has(id) ? [users.get(id)!] : []));

        const alreadyRegistered = await tx.registrationMember.findMany({
          where: { tournamentId, active: true, userId: { in: [...playerIds, ...substituteIds] } },
          select: { userId: true },
        });
        const teamAlreadyRegistered = team
          ? (await tx.registration.count({
              where: {
                tournamentId,
                teamId: team.id,
                status: { in: [...ACTIVE_REGISTRATION_STATUSES] },
              },
            })) > 0
          : false;

        const status = checkRegistration({
          now: this.clock.now(),
          tournament: { ...toTerms(t), gameId: t.gameId },
          policy: toPolicySnapshot(t.game.policy!),
          takenSlots: t._count.registrations,
          actor,
          team: team
            ? {
                id: team.id,
                gameId: team.gameId,
                captainId: team.captainId,
                disbanded: team.disbandedAt !== null,
                memberIds: team.members.map((m) => m.userId),
              }
            : null,
          playerIds,
          substituteIds,
          players: pick(playerIds),
          substitutes: pick(substituteIds),
          alreadyRegisteredUserIds: alreadyRegistered.map((r) => r.userId),
          teamAlreadyRegistered,
        });

        const reg = await tx.registration.create({
          data: {
            tournamentId,
            participantType: t.participantType,
            userId: team ? null : actorId,
            teamId: team?.id ?? null,
            teamNameSnapshot: team?.name ?? null,
            status,
            createdById: actorId,
            members: {
              create: [
                ...playerIds.map((userId) => ({ tournamentId, userId, isSubstitute: false })),
                ...substituteIds.map((userId) => ({ tournamentId, userId, isSubstitute: true })),
              ],
            },
          },
        });
        return { registrationId: reg.id, status: reg.status, teamId: reg.teamId };
      });
    } catch (err) {
      // Гонка двух параллельных заявок одного игрока/команды — ловит частичный уникальный индекс
      if (isUniqueViolation(err)) throw new DomainError('ALREADY_REGISTERED');
      throw err;
    }
  }

  /** Активная заявка, в составе которой есть пользователь. */
  async mine(actorId: string, slug: string): Promise<MyRegistrationDto | null> {
    const slot = await this.prisma.registrationMember.findFirst({
      where: { userId: actorId, active: true, registration: { tournament: { slug } } },
      include: { registration: true },
    });
    if (!slot) return null;
    return {
      registrationId: slot.registrationId,
      status: slot.registration.status,
      teamId: slot.registration.teamId,
    };
  }

  /** Отзыв: соло — сам игрок, команда — капитан. */
  async withdraw(actorId: string, slug: string): Promise<void> {
    const t = await this.prisma.tournament.findUnique({ where: { slug } });
    if (!t || HIDDEN_TOURNAMENT_STATUSES.includes(t.status))
      throw new DomainError('TOURNAMENT_NOT_FOUND');
    assertCanWithdraw(toTerms(t), this.clock.now());

    const reg = await this.prisma.registration.findFirst({
      where: {
        tournamentId: t.id,
        status: { in: [...ACTIVE_REGISTRATION_STATUSES] },
        OR: [{ userId: actorId }, { team: { captainId: actorId } }],
      },
    });
    if (!reg) throw new DomainError('NOT_REGISTERED');

    await this.prisma.$transaction([
      this.prisma.registration.update({
        where: { id: reg.id },
        data: { status: 'WITHDRAWN', withdrawnAt: this.clock.now() },
      }),
      this.prisma.registrationMember.updateMany({
        where: { registrationId: reg.id },
        data: { active: false },
      }),
    ]);
  }

  private async loadUsers(tx: Tx, ids: string[]): Promise<Map<string, Participant>> {
    const rows = await tx.user.findMany({
      where: { id: { in: ids } },
      include: participantInclude,
    });
    return new Map(rows.map((u) => [u.id, toParticipant(u)]));
  }
}
