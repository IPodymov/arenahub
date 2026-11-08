import { Inject, Injectable } from '@nestjs/common';
import {
  type CreateInviteInput,
  type CreateTeamInput,
  type InvitePreviewDto,
  type TeamDto,
  type TeamInviteDto,
  type TeamMemberRole,
  type UpdateTeamInput,
} from '@arenahub/shared';
import { createHash, randomBytes } from 'node:crypto';
import { ENV, type Env } from '../../config/env';
import { DomainError } from '../../common/domain-error';
import { isUniqueViolation } from '../../common/prisma-errors';
import { Clock } from '../../infra/clock';
import { PrismaService } from '../../infra/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import {
  assertActive,
  assertCanJoin,
  assertCanRemove,
  assertCaptain,
  assertGameSupportsTeams,
  maxRosterSize,
  type TeamState,
} from './team-rules';

const teamInclude = {
  game: { include: { policy: true } },
  members: { include: { user: true }, orderBy: { joinedAt: 'asc' } },
} satisfies Prisma.TeamInclude;
type TeamWithMembers = Prisma.TeamGetPayload<{ include: typeof teamInclude }>;

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

@Injectable()
export class TeamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async create(actorId: string, input: CreateTeamInput): Promise<TeamDto> {
    const game = await this.prisma.game.findUnique({
      where: { code: input.gameCode },
      include: { policy: true },
    });
    if (!game?.policy) throw new DomainError('GAME_NOT_FOUND');
    if (!game.isActive) throw new DomainError('GAME_INACTIVE');
    assertGameSupportsTeams(game.policy);
    await this.assertNameFree(game.id, input.name);

    try {
      const team = await this.prisma.team.create({
        data: {
          gameId: game.id,
          name: input.name,
          tag: input.tag ?? null,
          captainId: actorId,
          members: { create: { userId: actorId, role: 'PLAYER' } },
        },
        include: teamInclude,
      });
      return this.toDto(team);
    } catch (err) {
      if (isUniqueViolation(err)) throw new DomainError('TEAM_NAME_TAKEN');
      throw err;
    }
  }

  async get(teamId: string): Promise<TeamDto> {
    return this.toDto(await this.load(teamId));
  }

  async listForUser(userId: string): Promise<TeamDto[]> {
    const teams = await this.prisma.team.findMany({
      where: { disbandedAt: null, members: { some: { userId } } },
      include: teamInclude,
      orderBy: { createdAt: 'desc' },
    });
    return teams.map((t) => this.toDto(t));
  }

  async update(actorId: string, teamId: string, input: UpdateTeamInput): Promise<TeamDto> {
    const team = await this.load(teamId);
    const state = this.state(team);
    assertActive(state);
    assertCaptain(state, actorId);
    if (input.name && input.name.toLowerCase() !== team.name.toLowerCase()) {
      await this.assertNameFree(team.gameId, input.name);
    }
    try {
      await this.prisma.team.update({ where: { id: teamId }, data: input });
    } catch (err) {
      if (isUniqueViolation(err)) throw new DomainError('TEAM_NAME_TAKEN');
      throw err;
    }
    return this.get(teamId);
  }

  async createInvite(
    actorId: string,
    teamId: string,
    input: CreateInviteInput,
  ): Promise<TeamInviteDto> {
    const team = await this.load(teamId);
    const state = this.state(team);
    assertActive(state);
    assertCaptain(state, actorId);

    const token = randomBytes(24).toString('base64url');
    const ttlHours = input.ttlHours ?? 72;
    const invite = await this.prisma.teamInvite.create({
      data: {
        teamId,
        tokenHash: hashToken(token),
        createdById: actorId,
        expiresAt: new Date(this.clock.now().getTime() + ttlHours * 3600_000),
        maxUses: input.maxUses ?? 1,
      },
    });
    return {
      id: invite.id,
      url: `${this.env.WEB_ORIGIN}/invite/${token}`,
      expiresAt: invite.expiresAt.toISOString(),
      maxUses: invite.maxUses,
    };
  }

  async revokeInvite(actorId: string, teamId: string, inviteId: string): Promise<void> {
    const team = await this.load(teamId);
    assertCaptain(this.state(team), actorId);
    await this.prisma.teamInvite.updateMany({
      where: { id: inviteId, teamId, revokedAt: null },
      data: { revokedAt: this.clock.now() },
    });
  }

  async previewInvite(token: string): Promise<InvitePreviewDto> {
    const invite = await this.findUsableInvite(token);
    const team = await this.load(invite.teamId);
    return {
      team: {
        id: team.id,
        name: team.name,
        tag: team.tag,
        game: { code: team.game.code, name: team.game.name },
        memberCount: team.members.length,
        maxRosterSize: maxRosterSize(team.game.policy!),
      },
      expiresAt: invite.expiresAt.toISOString(),
    };
  }

  async acceptInvite(actorId: string, token: string): Promise<TeamDto> {
    const invite = await this.findUsableInvite(token);
    const teamId = await this.prisma.$transaction(async (tx) => {
      // Блокируем команду, чтобы параллельные вступления не переполнили ростер
      await tx.$queryRaw`SELECT id FROM "Team" WHERE id = ${invite.teamId}::uuid FOR UPDATE`;
      const team = await tx.team.findUniqueOrThrow({
        where: { id: invite.teamId },
        include: teamInclude,
      });
      assertCanJoin(this.state(team), actorId, maxRosterSize(team.game.policy!));

      const consumed = await tx.teamInvite.updateMany({
        where: { id: invite.id, revokedAt: null, usedCount: { lt: invite.maxUses } },
        data: { usedCount: { increment: 1 } },
      });
      if (consumed.count === 0) throw new DomainError('INVITE_INVALID');

      await tx.teamMember.create({ data: { teamId: team.id, userId: actorId, role: 'PLAYER' } });
      return team.id;
    });
    return this.get(teamId);
  }

  async leave(actorId: string, teamId: string): Promise<void> {
    await this.removeMember(teamId, actorId);
  }

  async kick(actorId: string, teamId: string, userId: string): Promise<TeamDto> {
    const team = await this.load(teamId);
    assertCaptain(this.state(team), actorId);
    if (userId === actorId) throw new DomainError('CAPTAIN_MUST_TRANSFER');
    await this.removeMember(teamId, userId);
    return this.get(teamId);
  }

  async transferCaptain(actorId: string, teamId: string, newCaptainId: string): Promise<TeamDto> {
    const team = await this.load(teamId);
    const state = this.state(team);
    assertActive(state);
    assertCaptain(state, actorId);
    if (!state.memberIds.includes(newCaptainId)) throw new DomainError('NOT_TEAM_MEMBER');
    await this.prisma.team.update({ where: { id: teamId }, data: { captainId: newCaptainId } });
    return this.get(teamId);
  }

  async setMemberRole(
    actorId: string,
    teamId: string,
    userId: string,
    role: TeamMemberRole,
  ): Promise<TeamDto> {
    const team = await this.load(teamId);
    const state = this.state(team);
    assertActive(state);
    assertCaptain(state, actorId);
    if (!state.memberIds.includes(userId)) throw new DomainError('NOT_TEAM_MEMBER');
    await this.prisma.teamMember.update({
      where: { teamId_userId: { teamId, userId } },
      data: { role },
    });
    return this.get(teamId);
  }

  private async removeMember(teamId: string, userId: string): Promise<void> {
    const team = await this.load(teamId);
    const locked = await this.isLockedInTournament(teamId, userId);
    const { disband } = assertCanRemove(this.state(team), userId, locked);

    await this.prisma.$transaction(async (tx) => {
      await tx.teamMember.delete({ where: { teamId_userId: { teamId, userId } } });
      if (disband)
        await tx.team.update({ where: { id: teamId }, data: { disbandedAt: this.clock.now() } });
    });
  }

  /** Игрок заявлен от этой команды в турнире, который ещё не закончился. */
  private async isLockedInTournament(teamId: string, userId: string): Promise<boolean> {
    const slot = await this.prisma.registrationMember.findFirst({
      where: {
        userId,
        active: true,
        registration: { teamId, tournament: { status: { in: ['PUBLISHED', 'IN_PROGRESS'] } } },
      },
      select: { id: true },
    });
    return slot !== null;
  }

  private async findUsableInvite(token: string) {
    const invite = await this.prisma.teamInvite.findUnique({
      where: { tokenHash: hashToken(token) },
    });
    if (
      !invite ||
      invite.revokedAt ||
      invite.expiresAt <= this.clock.now() ||
      invite.usedCount >= invite.maxUses
    ) {
      throw new DomainError('INVITE_INVALID');
    }
    return invite;
  }

  private async assertNameFree(gameId: string, name: string): Promise<void> {
    const clash = await this.prisma.team.findFirst({
      where: { gameId, disbandedAt: null, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (clash) throw new DomainError('TEAM_NAME_TAKEN');
  }

  private async load(teamId: string): Promise<TeamWithMembers> {
    const team = await this.prisma.team.findUnique({ where: { id: teamId }, include: teamInclude });
    if (!team) throw new DomainError('TEAM_NOT_FOUND');
    return team;
  }

  private state(team: TeamWithMembers): TeamState {
    return {
      captainId: team.captainId,
      disbanded: team.disbandedAt !== null,
      memberIds: team.members.map((m) => m.userId),
    };
  }

  private toDto(team: TeamWithMembers): TeamDto {
    return {
      id: team.id,
      name: team.name,
      tag: team.tag,
      avatarUrl: team.avatarUrl,
      game: { code: team.game.code, name: team.game.name },
      captainId: team.captainId,
      maxRosterSize: maxRosterSize(team.game.policy!),
      members: team.members.map((m) => ({
        userId: m.userId,
        nickname: m.user.nickname,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        isCaptain: m.userId === team.captainId,
        joinedAt: m.joinedAt.toISOString(),
      })),
      disbanded: team.disbandedAt !== null,
      createdAt: team.createdAt.toISOString(),
    };
  }
}
