import {
  ADULT_AGE,
  ageAt,
  type AuthProvider,
  PLATFORM_MIN_AGE,
  type RegistrationStatus,
} from '@arenahub/shared';
import { DomainError } from '../../../common/domain-error';
import { tournamentPhase } from './tournament-phase';
import { assertFormatAllowed, assertMoneyTermsAllowed, effectiveMinAge } from './tournament-rules';
import type { PolicySnapshot, TournamentTerms } from './types';

export interface Participant {
  id: string;
  nickname: string;
  /** YYYY-MM-DD */
  birthDate: string | null;
  banned: boolean;
  linkedProviders: AuthProvider[];
}

export interface TeamSnapshot {
  id: string;
  gameId: string;
  captainId: string;
  disbanded: boolean;
  memberIds: string[];
}

export interface RegistrationContext {
  now: Date;
  tournament: TournamentTerms & { gameId: string };
  policy: PolicySnapshot;
  /** Активные регистрации (ожидает оплаты + подтверждена) */
  takenSlots: number;
  /** Кто нажимает кнопку: сам игрок (соло) или капитан (команда) */
  actor: Participant;
  team: TeamSnapshot | null;
  /** Запрошенный состав (id), до сопоставления с пользователями — для проверки дублей */
  playerIds: string[];
  substituteIds: string[];
  /** Загруженные пользователи состава (для соло — сам actor) */
  players: Participant[];
  substitutes: Participant[];
  /** Кто из состава уже занимает место в этом турнире */
  alreadyRegisteredUserIds: string[];
  teamAlreadyRegistered: boolean;
}

function assertEligibleParticipant(
  p: Participant,
  ctx: RegistrationContext,
  isPaid: boolean,
): void {
  const details = { userId: p.id, nickname: p.nickname };
  if (p.banned) throw new DomainError('USER_BANNED', details);
  if (!p.birthDate) throw new DomainError('BIRTH_DATE_REQUIRED', details);

  const age = ageAt(p.birthDate, ctx.now);
  const minAge = effectiveMinAge(ctx.tournament, ctx.policy);
  if (age < minAge) throw new DomainError('AGE_BELOW_TOURNAMENT_MINIMUM', { ...details, minAge });
  if (isPaid && age < ADULT_AGE) throw new DomainError('PAID_TOURNAMENT_ADULTS_ONLY', details);

  const required = ctx.policy.requiredProvider;
  if (required && !p.linkedProviders.includes(required)) {
    throw new DomainError('LINKED_ACCOUNT_REQUIRED', { ...details, provider: required });
  }
  if (ctx.alreadyRegisteredUserIds.includes(p.id))
    throw new DomainError('ALREADY_REGISTERED', details);
}

function assertActorMayAct(actor: Participant, ctx: RegistrationContext, isPaid: boolean): void {
  if (actor.banned) throw new DomainError('USER_BANNED');
  if (!actor.birthDate)
    throw new DomainError('BIRTH_DATE_REQUIRED', { userId: actor.id, nickname: actor.nickname });
  const age = ageAt(actor.birthDate, ctx.now);
  if (age < PLATFORM_MIN_AGE) throw new DomainError('AGE_BELOW_PLATFORM_MINIMUM');
  // Платит за команду капитан — он тоже должен быть совершеннолетним
  if (isPaid && age < ADULT_AGE)
    throw new DomainError('PAID_TOURNAMENT_ADULTS_ONLY', {
      userId: actor.id,
      nickname: actor.nickname,
    });
}

function assertTeamLineup(ctx: RegistrationContext, team: TeamSnapshot): void {
  const t = ctx.tournament;
  if (team.disbanded) throw new DomainError('TEAM_DISBANDED');
  if (team.gameId !== t.gameId) throw new DomainError('TEAM_GAME_MISMATCH');
  if (team.captainId !== ctx.actor.id) throw new DomainError('NOT_TEAM_CAPTAIN');
  if (ctx.teamAlreadyRegistered) throw new DomainError('ALREADY_REGISTERED', { teamId: team.id });

  const all = [...ctx.playerIds, ...ctx.substituteIds];
  if (new Set(all).size !== all.length) throw new DomainError('LINEUP_DUPLICATE_PLAYER');
  const outsider = all.find((id) => !team.memberIds.includes(id));
  if (outsider) throw new DomainError('LINEUP_PLAYER_NOT_IN_TEAM', { userId: outsider });

  if (ctx.playerIds.length !== t.teamSize) {
    throw new DomainError('LINEUP_SIZE_MISMATCH', {
      expected: t.teamSize,
      actual: ctx.playerIds.length,
    });
  }
  const maxSubs = Math.min(t.maxSubstitutes, ctx.policy.maxSubstitutes);
  if (ctx.substituteIds.length > maxSubs)
    throw new DomainError('SUBSTITUTES_ABOVE_LIMIT', { max: maxSubs });
}

/**
 * Все правила регистрации на турнир. Порядок проверок фиксирован:
 * окно регистрации → политика игры → тип участия → состав → каждый игрок → слоты.
 * Возвращает статус новой регистрации.
 */
export function checkRegistration(ctx: RegistrationContext): RegistrationStatus {
  const t = ctx.tournament;

  if (tournamentPhase(t, ctx.now) !== 'REGISTRATION')
    throw new DomainError('REGISTRATION_NOT_OPEN');

  // Политика игры перепроверяется: она могла измениться после создания турнира
  assertFormatAllowed(t, ctx.policy);
  assertMoneyTermsAllowed(t, ctx.policy);

  const isPaid = t.entryFeeKopecks > 0n;
  assertActorMayAct(ctx.actor, ctx, isPaid);

  if (t.participantType === 'SOLO') {
    if (ctx.team) throw new DomainError('WRONG_PARTICIPANT_TYPE');
  } else {
    if (!ctx.team) throw new DomainError('TEAM_REQUIRED');
    assertTeamLineup(ctx, ctx.team);
  }

  for (const p of [...ctx.players, ...ctx.substitutes]) assertEligibleParticipant(p, ctx, isPaid);

  if (ctx.takenSlots >= t.maxSlots) throw new DomainError('TOURNAMENT_FULL');

  // Оплата появится с кошельком; до неё платная заявка занимает слот в статусе «ожидает оплаты»
  return isPaid ? 'PENDING_PAYMENT' : 'CONFIRMED';
}

/** Отозвать заявку можно до старта турнира. */
export function assertCanWithdraw(t: TournamentTerms, now: Date): void {
  const phase = tournamentPhase(t, now);
  if (phase !== 'REGISTRATION' && phase !== 'REGISTRATION_CLOSED' && phase !== 'UPCOMING') {
    throw new DomainError('REGISTRATION_NOT_OPEN');
  }
}
