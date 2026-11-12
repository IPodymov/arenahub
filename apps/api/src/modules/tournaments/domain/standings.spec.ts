import { describe, expect, it } from 'vitest';
import { computeStandings, type MatchResult } from './standings';

function m(
  round: number,
  a: string,
  b: string,
  winner: string | null,
  bracketGroup = 0,
): MatchResult {
  return {
    round,
    bracketGroup,
    participantAId: a,
    participantBId: b,
    winnerRegistrationId: winner,
    completed: winner !== null,
  };
}

// 8 участников: a…h, побеждает «левый»
const quarter = [
  m(1, 'a', 'b', 'a'),
  m(1, 'c', 'd', 'c'),
  m(1, 'e', 'f', 'e'),
  m(1, 'g', 'h', 'g'),
];
const semi = [m(2, 'a', 'c', 'a'), m(2, 'e', 'g', 'e')];
const DIST = [
  { place: 1, shareBp: 5000 },
  { place: 2, shareBp: 2500 },
  { place: 3, shareBp: 1500 },
  { place: 4, shareBp: 1000 },
];

describe('computeStandings', () => {
  it('пусто, пока финал не сыгран', () => {
    expect(computeStandings([...quarter, ...semi, m(3, 'a', 'e', null)], 0n, null)).toEqual([]);
  });

  it('места по раундам и призы по долям', () => {
    const s = computeStandings([...quarter, ...semi, m(3, 'a', 'e', 'e')], 100_000n, DIST);
    const byId = Object.fromEntries(s.map((x) => [x.registrationId, x]));
    expect(byId.e).toMatchObject({ place: 1, placeTo: 1, prizeKopecks: 50_000n });
    expect(byId.a).toMatchObject({ place: 2, placeTo: 2, prizeKopecks: 25_000n });
    // Без матча за 3-е место полуфиналисты делят 3–4 и сумму их долей
    expect(byId.c).toMatchObject({ place: 3, placeTo: 4, prizeKopecks: 12_500n });
    expect(byId.g).toMatchObject({ place: 3, placeTo: 4, prizeKopecks: 12_500n });
    expect(byId.b).toMatchObject({ place: 5, placeTo: 8, prizeKopecks: 0n });
    expect(s).toHaveLength(8);
  });

  it('матч за 3-е место разводит полуфиналистов', () => {
    const s = computeStandings(
      [...quarter, ...semi, m(3, 'a', 'e', 'a'), m(3, 'c', 'g', 'g', 1)],
      100_000n,
      DIST,
    );
    const byId = Object.fromEntries(s.map((x) => [x.registrationId, x]));
    expect(byId.g).toMatchObject({ place: 3, placeTo: 3, prizeKopecks: 15_000n });
    expect(byId.c).toMatchObject({ place: 4, placeTo: 4, prizeKopecks: 10_000n });
  });

  it('сумма выплат не превышает фонд', () => {
    const s = computeStandings([...quarter, ...semi, m(3, 'a', 'e', 'a')], 100_001n, [
      { place: 1, shareBp: 3333 },
      { place: 2, shareBp: 3333 },
      { place: 3, shareBp: 3334 },
    ]);
    const total = s.reduce((sum, x) => sum + x.prizeKopecks, 0n);
    expect(total <= 100_001n).toBe(true);
  });
});
