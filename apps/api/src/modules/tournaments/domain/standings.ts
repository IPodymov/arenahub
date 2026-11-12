/** Срез матча, нужный для подсчёта мест. */
export interface MatchResult {
  round: number;
  /** 0 — основная сетка, 1 — матч за 3-е место */
  bracketGroup: number;
  participantAId: string | null;
  participantBId: string | null;
  winnerRegistrationId: string | null;
  completed: boolean;
}

export interface PrizeShare {
  place: number;
  shareBp: number;
}

export interface Standing {
  place: number;
  placeTo: number;
  registrationId: string;
  prizeKopecks: bigint;
}

export const THIRD_PLACE_GROUP = 1;

function loserOf(m: MatchResult): string | null {
  if (!m.winnerRegistrationId) return null;
  return m.winnerRegistrationId === m.participantAId ? m.participantBId : m.participantAId;
}

/**
 * Итоговые места single elimination. Пусто, пока финал не сыгран.
 * Выбывшие в одном раунде делят места (5–8 и т.п.) и поровну — сумму призов за эти места.
 * Сыгранный матч за 3-е место разводит полуфиналистов на 3 и 4.
 */
export function computeStandings(
  matches: MatchResult[],
  prizePoolKopecks: bigint,
  distribution: PrizeShare[] | null,
): Standing[] {
  const main = matches.filter((m) => m.bracketGroup === 0);
  const rounds = Math.max(0, ...main.map((m) => m.round));
  const final = main.find((m) => m.round === rounds);
  if (!final?.completed || !final.winnerRegistrationId) return [];

  const places: { place: number; placeTo: number; ids: string[] }[] = [
    { place: 1, placeTo: 1, ids: [final.winnerRegistrationId] },
  ];
  // Проигравшие раунда r (считая от финала: 0 — финал) занимают места 2^k+1 … 2^(k+1)
  for (let r = rounds; r >= 1; r--) {
    const k = rounds - r;
    const losers = main
      .filter((m) => m.round === r && m.completed)
      .map(loserOf)
      .filter((id): id is string => id !== null);
    if (losers.length === 0) continue;
    places.push({ place: 2 ** k + 1, placeTo: 2 ** (k + 1), ids: losers });
  }

  const third = matches.find((m) => m.bracketGroup === THIRD_PLACE_GROUP && m.completed);
  const thirdLoser = third && loserOf(third);
  if (third?.winnerRegistrationId && thirdLoser) {
    const i = places.findIndex((p) => p.place === 3);
    if (i !== -1) {
      places.splice(
        i,
        1,
        { place: 3, placeTo: 3, ids: [third.winnerRegistrationId] },
        { place: 4, placeTo: 4, ids: [thirdLoser] },
      );
    }
  }

  const shareOf = (place: number) => distribution?.find((d) => d.place === place)?.shareBp ?? 0;
  return places.flatMap(({ place, placeTo, ids }) => {
    let bp = 0;
    for (let p = place; p <= placeTo; p++) bp += shareOf(p);
    // Копейки округляем вниз: остаток фонда не раздаём больше, чем есть
    const each = (prizePoolKopecks * BigInt(bp)) / 10_000n / BigInt(ids.length);
    return ids.map((registrationId) => ({ place, placeTo, registrationId, prizeKopecks: each }));
  });
}
