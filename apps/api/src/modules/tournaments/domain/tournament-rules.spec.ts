import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../common/domain-error';
import { NOW, POLICIES, terms } from './fixtures';
import { nextStatus, tournamentPhase } from './tournament-phase';
import { assertTournamentValid } from './tournament-rules';
import type { PolicySnapshot, TournamentTerms } from './types';

function codeOf(t: TournamentTerms, policy: PolicySnapshot): string | null {
  try {
    assertTournamentValid(t, policy);
    return null;
  } catch (err) {
    if (err instanceof DomainError) return err.code;
    throw err;
  }
}

describe('assertTournamentValid — политика игры', () => {
  it('Brawl Stars: платный вход запрещён на уровне домена', () => {
    expect(codeOf(terms({ entryFeeKopecks: 100n }), POLICIES.BRAWL_STARS)).toBe(
      'PAID_ENTRY_FORBIDDEN_BY_GAME',
    );
  });

  it('Brawl Stars: призовой фонд из взносов запрещён', () => {
    expect(
      codeOf(terms({ prizeSource: 'ENTRY_FEES', prizePoolKopecks: 100n }), POLICIES.BRAWL_STARS),
    ).toBe('PAID_ENTRY_FORBIDDEN_BY_GAME');
  });

  it('Brawl Stars: бесплатный 3x3 со спонсорским призом допустим', () => {
    const t = terms({
      participantType: 'TEAM',
      teamSize: 3,
      maxSubstitutes: 1,
      prizeSource: 'SPONSOR',
      prizePoolKopecks: 500_000n,
    });
    expect(codeOf(t, POLICIES.BRAWL_STARS)).toBeNull();
  });

  it('Dota 2: платный вход разрешён', () => {
    const t = terms({
      entryFeeKopecks: 50_000n,
      prizeSource: 'ENTRY_FEES',
      prizePoolKopecks: 400_000n,
    });
    expect(codeOf(t, POLICIES.DOTA2)).toBeNull();
  });

  it('лимит взноса и призового фонда из политики', () => {
    const policy = {
      ...POLICIES.DOTA2,
      maxEntryFeeKopecks: 10_000n,
      maxPrizePoolKopecks: 100_000n,
    };
    expect(
      codeOf(
        terms({ entryFeeKopecks: 10_001n, prizeSource: 'ENTRY_FEES', prizePoolKopecks: 1n }),
        policy,
      ),
    ).toBe('ENTRY_FEE_ABOVE_LIMIT');
    expect(codeOf(terms({ prizeSource: 'SPONSOR', prizePoolKopecks: 100_001n }), policy)).toBe(
      'PRIZE_POOL_ABOVE_LIMIT',
    );
  });

  it('формат, которого нет в политике', () => {
    expect(codeOf(terms({ participantType: 'TEAM', teamSize: 4 }), POLICIES.DOTA2)).toBe(
      'TEAM_SIZE_FORBIDDEN_BY_GAME',
    );
  });

  it('соло должен быть 1x1, команда — от 2', () => {
    expect(codeOf(terms({ participantType: 'SOLO', teamSize: 5 }), POLICIES.DOTA2)).toBe(
      'PARTICIPANT_TYPE_INCONSISTENT',
    );
    expect(codeOf(terms({ participantType: 'TEAM', teamSize: 1 }), POLICIES.DOTA2)).toBe(
      'PARTICIPANT_TYPE_INCONSISTENT',
    );
  });

  it('запасных больше, чем позволяет игра', () => {
    expect(
      codeOf(terms({ participantType: 'TEAM', teamSize: 5, maxSubstitutes: 3 }), POLICIES.DOTA2),
    ).toBe('SUBSTITUTES_ABOVE_LIMIT');
  });

  it('фонд и источник фонда согласованы', () => {
    expect(codeOf(terms({ prizePoolKopecks: 100n }), POLICIES.DOTA2)).toBe(
      'PRIZE_SOURCE_INCONSISTENT',
    );
    expect(codeOf(terms({ prizeSource: 'SPONSOR' }), POLICIES.DOTA2)).toBe(
      'PRIZE_SOURCE_INCONSISTENT',
    );
    expect(
      codeOf(terms({ prizeSource: 'ENTRY_FEES', prizePoolKopecks: 100n }), POLICIES.DOTA2),
    ).toBe('PRIZE_SOURCE_INCONSISTENT');
  });

  it('минимальный возраст турнира не ниже игрового', () => {
    expect(codeOf(terms({ minAge: 16 }), { ...POLICIES.DOTA2, minAge: 18 })).toBe(
      'MIN_AGE_BELOW_GAME_MINIMUM',
    );
  });

  it('расписание и слоты', () => {
    expect(
      codeOf(
        terms({ registrationClosesAt: new Date(NOW.getTime() + 10 * 86_400_000) }),
        POLICIES.DOTA2,
      ),
    ).toBe('INVALID_SCHEDULE');
    expect(codeOf(terms({ maxSlots: 4, minSlots: 8 }), POLICIES.DOTA2)).toBe('INVALID_SLOTS');
  });
});

describe('tournamentPhase', () => {
  const t = terms();
  it('вычисляет фазу опубликованного турнира по датам', () => {
    expect(tournamentPhase(t, new Date(t.registrationOpensAt.getTime() - 1))).toBe('UPCOMING');
    expect(tournamentPhase(t, NOW)).toBe('REGISTRATION');
    expect(tournamentPhase(t, t.registrationClosesAt)).toBe('REGISTRATION_CLOSED');
    expect(tournamentPhase(t, t.startsAt)).toBe('IN_PROGRESS');
  });

  it('хранимые конечные статусы имеют приоритет над датами', () => {
    expect(tournamentPhase(terms({ status: 'COMPLETED' }), NOW)).toBe('COMPLETED');
    expect(tournamentPhase(terms({ status: 'DRAFT' }), NOW)).toBe('DRAFT');
  });
});

describe('nextStatus', () => {
  it('публикуется только черновик до старта', () => {
    expect(nextStatus(terms({ status: 'DRAFT' }), 'publish', NOW)).toBe('PUBLISHED');
    expect(nextStatus(terms({ status: 'PUBLISHED' }), 'publish', NOW)).toBeNull();
  });

  it('завершённый нельзя отменить, идущий — можно завершить', () => {
    expect(nextStatus(terms({ status: 'COMPLETED' }), 'cancel', NOW)).toBeNull();
    expect(nextStatus(terms({ status: 'IN_PROGRESS' }), 'complete', NOW)).toBe('COMPLETED');
    expect(nextStatus(terms(), 'complete', NOW)).toBeNull();
  });
});
