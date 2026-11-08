import { DomainError } from '../../common/domain-error';

interface PolicyLike {
  allowedTeamSizes: number[];
  maxSubstitutes: number;
}

/** Максимальный ростер команды: самый большой формат игры + запасные. */
export function maxRosterSize(policy: PolicyLike): number {
  return Math.max(...policy.allowedTeamSizes) + policy.maxSubstitutes;
}

export function assertGameSupportsTeams(policy: PolicyLike): void {
  if (!policy.allowedTeamSizes.some((s) => s >= 2))
    throw new DomainError('GAME_HAS_NO_TEAM_FORMATS');
}

export interface TeamState {
  captainId: string;
  disbanded: boolean;
  memberIds: string[];
}

export function assertActive(team: TeamState): void {
  if (team.disbanded) throw new DomainError('TEAM_DISBANDED');
}

export function assertCaptain(team: TeamState, actorId: string): void {
  if (team.captainId !== actorId) throw new DomainError('NOT_TEAM_CAPTAIN');
}

export function assertCanJoin(team: TeamState, userId: string, maxRoster: number): void {
  assertActive(team);
  if (team.memberIds.includes(userId)) throw new DomainError('ALREADY_TEAM_MEMBER');
  if (team.memberIds.length >= maxRoster) throw new DomainError('TEAM_FULL');
}

/**
 * Можно ли убрать игрока из команды (выход или исключение).
 * Капитан не может уйти, пока в команде есть другие игроки; заявленных в активном турнире не трогаем.
 * Возвращает true, если после выхода команда опустеет и должна быть распущена.
 */
export function assertCanRemove(
  team: TeamState,
  userId: string,
  lockedInTournament: boolean,
): { disband: boolean } {
  assertActive(team);
  if (!team.memberIds.includes(userId)) throw new DomainError('NOT_TEAM_MEMBER');
  if (lockedInTournament) throw new DomainError('MEMBER_LOCKED_IN_TOURNAMENT');
  const isLast = team.memberIds.length === 1;
  if (userId === team.captainId && !isLast) throw new DomainError('CAPTAIN_MUST_TRANSFER');
  return { disband: isLast };
}
