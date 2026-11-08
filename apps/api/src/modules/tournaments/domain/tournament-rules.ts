import { PLATFORM_MIN_AGE } from '@arenahub/shared';
import { DomainError } from '../../../common/domain-error';
import type { PolicySnapshot, TournamentTerms } from './types';

/** Эффективный минимальный возраст: максимум из платформы, игры и турнира. */
export function effectiveMinAge(
  t: Pick<TournamentTerms, 'minAge'>,
  policy: Pick<PolicySnapshot, 'minAge'>,
): number {
  return Math.max(PLATFORM_MIN_AGE, policy.minAge, t.minAge ?? 0);
}

/** Условия входа и призов против политики игры. Используется и при создании, и при регистрации. */
export function assertMoneyTermsAllowed(t: TournamentTerms, policy: PolicySnapshot): void {
  if (t.entryFeeKopecks > 0n && !policy.paidEntryAllowed) {
    throw new DomainError('PAID_ENTRY_FORBIDDEN_BY_GAME');
  }
  if (policy.maxEntryFeeKopecks !== null && t.entryFeeKopecks > policy.maxEntryFeeKopecks) {
    throw new DomainError('ENTRY_FEE_ABOVE_LIMIT', { max: policy.maxEntryFeeKopecks.toString() });
  }
  if (!policy.allowedPrizeSources.includes(t.prizeSource)) {
    throw new DomainError(
      t.prizeSource === 'ENTRY_FEES' && !policy.paidEntryAllowed
        ? 'PAID_ENTRY_FORBIDDEN_BY_GAME'
        : 'PRIZE_SOURCE_FORBIDDEN_BY_GAME',
      { prizeSource: t.prizeSource },
    );
  }
  if (policy.maxPrizePoolKopecks !== null && t.prizePoolKopecks > policy.maxPrizePoolKopecks) {
    throw new DomainError('PRIZE_POOL_ABOVE_LIMIT', { max: policy.maxPrizePoolKopecks.toString() });
  }
  const hasPrize = t.prizePoolKopecks > 0n;
  if (
    hasPrize !== (t.prizeSource !== 'NONE') ||
    (t.prizeSource === 'ENTRY_FEES' && t.entryFeeKopecks === 0n)
  ) {
    throw new DomainError('PRIZE_SOURCE_INCONSISTENT');
  }
}

export function assertFormatAllowed(t: TournamentTerms, policy: PolicySnapshot): void {
  const soloOk = t.participantType === 'SOLO' && t.teamSize === 1 && t.maxSubstitutes === 0;
  const teamOk = t.participantType === 'TEAM' && t.teamSize >= 2;
  if (!soloOk && !teamOk) throw new DomainError('PARTICIPANT_TYPE_INCONSISTENT');
  if (!policy.allowedTeamSizes.includes(t.teamSize)) {
    throw new DomainError('TEAM_SIZE_FORBIDDEN_BY_GAME', { allowed: policy.allowedTeamSizes });
  }
  if (t.maxSubstitutes > policy.maxSubstitutes) {
    throw new DomainError('SUBSTITUTES_ABOVE_LIMIT', { max: policy.maxSubstitutes });
  }
}

/** Полная проверка параметров турнира при создании/изменении/публикации. */
export function assertTournamentValid(t: TournamentTerms, policy: PolicySnapshot): void {
  assertFormatAllowed(t, policy);
  assertMoneyTermsAllowed(t, policy);

  if (t.minAge !== null && t.minAge < policy.minAge) {
    throw new DomainError('MIN_AGE_BELOW_GAME_MINIMUM', { min: policy.minAge });
  }
  if (!(t.registrationOpensAt < t.registrationClosesAt && t.registrationClosesAt <= t.startsAt)) {
    throw new DomainError('INVALID_SCHEDULE');
  }
  if (t.minSlots < 2 || t.maxSlots < t.minSlots) throw new DomainError('INVALID_SLOTS');
}
