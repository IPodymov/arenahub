// Фабрики для unit-тестов доменных правил.
import type { Participant, RegistrationContext } from './registration-rules';
import type { PolicySnapshot, TournamentTerms } from './types';

export const NOW = new Date('2026-06-01T12:00:00Z');
const DAY = 86_400_000;

export const POLICIES = {
  DOTA2: {
    paidEntryAllowed: true,
    maxEntryFeeKopecks: null,
    maxPrizePoolKopecks: null,
    allowedPrizeSources: ['NONE', 'SPONSOR', 'ENTRY_FEES'],
    minAge: 16,
    allowedTeamSizes: [1, 5],
    maxSubstitutes: 2,
    requiredProvider: 'STEAM',
  },
  BRAWL_STARS: {
    paidEntryAllowed: false,
    maxEntryFeeKopecks: 0n,
    maxPrizePoolKopecks: null,
    allowedPrizeSources: ['NONE', 'SPONSOR'],
    minAge: 16,
    allowedTeamSizes: [1, 3],
    maxSubstitutes: 1,
    requiredProvider: null,
  },
} satisfies Record<string, PolicySnapshot>;

export function terms(overrides: Partial<TournamentTerms> = {}): TournamentTerms {
  return {
    status: 'PUBLISHED',
    participantType: 'SOLO',
    teamSize: 1,
    maxSubstitutes: 0,
    maxSlots: 16,
    minSlots: 2,
    minAge: null,
    entryFeeKopecks: 0n,
    prizePoolKopecks: 0n,
    prizeSource: 'NONE',
    registrationOpensAt: new Date(NOW.getTime() - DAY),
    registrationClosesAt: new Date(NOW.getTime() + DAY),
    startsAt: new Date(NOW.getTime() + 2 * DAY),
    ...overrides,
  };
}

/** Участник заданного возраста на момент NOW. */
export function player(
  id: string,
  age: number | null,
  overrides: Partial<Participant> = {},
): Participant {
  const birthDate = age === null ? null : `${NOW.getUTCFullYear() - age}-01-15`;
  return { id, nickname: id, birthDate, banned: false, linkedProviders: ['STEAM'], ...overrides };
}

export function soloContext(overrides: Partial<RegistrationContext> = {}): RegistrationContext {
  const actor = overrides.actor ?? player('u1', 20);
  return {
    now: NOW,
    tournament: { ...terms(), gameId: 'dota' },
    policy: POLICIES.DOTA2,
    takenSlots: 0,
    actor,
    team: null,
    playerIds: [actor.id],
    substituteIds: [],
    players: [actor],
    substitutes: [],
    alreadyRegisteredUserIds: [],
    teamAlreadyRegistered: false,
    ...overrides,
  };
}

/** Командная регистрация 5x5 Dota 2: капитан c1 + игроки p2..p5 (+ опц. запасные). */
export function teamContext(overrides: Partial<RegistrationContext> = {}): RegistrationContext {
  const players = ['c1', 'p2', 'p3', 'p4', 'p5'].map((id) => player(id, 20));
  return {
    now: NOW,
    tournament: {
      ...terms({ participantType: 'TEAM', teamSize: 5, maxSubstitutes: 2 }),
      gameId: 'dota',
    },
    policy: POLICIES.DOTA2,
    takenSlots: 0,
    actor: players[0]!,
    team: {
      id: 't1',
      gameId: 'dota',
      captainId: 'c1',
      disbanded: false,
      memberIds: ['c1', 'p2', 'p3', 'p4', 'p5', 's6', 's7', 's8'],
    },
    playerIds: players.map((p) => p.id),
    substituteIds: [],
    players,
    substitutes: [],
    alreadyRegisteredUserIds: [],
    teamAlreadyRegistered: false,
    ...overrides,
  };
}
