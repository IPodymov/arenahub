// Демо-данные: игроки, команды и турниры во всех фазах, у сыгранных — сетка и призы в рублях.
// Даты считаются от момента запуска, поэтому для «свежей» витрины сид перезапускают с --reset.
//   pnpm --filter @arenahub/api db:demo            — создать, если демо-турниров ещё нет
//   pnpm --filter @arenahub/api db:demo -- --reset — удалить демо-турниры и создать заново
import { existsSync } from 'node:fs';
import path from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import {
  type BestOf,
  type GameCode,
  type MatchStatus,
  PrismaClient,
  type PrizeSource,
  type TournamentCategory,
  type TournamentStatus,
} from '../src/generated/prisma/client';

const HOUR = 3600_000;
const DAY = 24 * HOUR;

/** Организатор демо-турниров; без пароля — войти под ним нельзя. */
export const DEMO_ORGANIZER = 'arenahub';

const PREFIXES = ['Shadow', 'Frost', 'Nova', 'Viper', 'Blaze', 'Ghost'];
const PREFIXES_2 = ['Raven', 'Storm', 'Lynx', 'Echo', 'Titan', 'Zero'];
const SUFFIXES = ['Fox', 'Wolf', 'Byte', 'Strike', 'Hawk', 'Spark', 'Core', 'Blade'];
/** 96 игроков-ботов: ShadowFox, FrostWolf… */
export const DEMO_PLAYERS = [...PREFIXES, ...PREFIXES_2].flatMap((p) =>
  SUFFIXES.map((s) => `${p}${s}`),
);

const TEAM_NAMES: Record<string, string[]> = {
  'DOTA2:5': [
    'Северный Ветер',
    'Red Foxes',
    'Polar Bears',
    'Night Owls',
    'Iron Wolves',
    'Storm Riders',
    'Black Ice',
    'Sky Pirates',
  ],
  'CS2:5': [
    'Headshot Masters',
    'Flash Point',
    'Dust Kings',
    'Inferno Squad',
    'Mirage Five',
    'Nuke Busters',
    'Ancient Order',
    'Vertigo Team',
    'Overpass Crew',
    'Anubis Rising',
    'Eco Warriors',
    'Clutch Gods',
    'Smoke Screen',
    'Molotov Club',
    'AWP Academy',
    'Bomb Squad',
  ],
  'CS2:2': [
    'Двойной удар',
    'Wing & Man',
    'Duo Drift',
    'Пара пик',
    'Shortcut Bros',
    'Lake Side',
    'Twin Peaks',
    'Back to Back',
  ],
  'BRAWL_STARS:3': [
    'Gem Grabbers',
    'Brawl Ball FC',
    'Heist Gang',
    'Звёздный рейд',
    'Bounty Hunters',
    'Knockout Kids',
    'Showdown Trio',
    'Hot Zone',
  ],
};

type Timeline =
  'proposed' | 'upcoming' | 'registration' | 'closed' | 'live' | 'completed' | 'cancelled';

interface DemoTournament {
  slug: string;
  title: string;
  description: string;
  game: GameCode;
  teamSize: number;
  bestOf: BestOf;
  finalsBestOf?: BestOf;
  category: TournamentCategory;
  maxSlots: number;
  timeline: Timeline;
  /** Для прошедших — сколько дней назад старт, для будущих — через сколько */
  days: number;
  /** Сколько участников уже заявлено */
  participants: number;
  entryFeeRub?: number;
  prizeRub?: number;
  prizeSource?: PrizeSource;
  /** Доли призовых мест в процентах: [50, 25, 15, 10] */
  prizeSplit?: number[];
}

const RULES =
  'Стандартные правила платформы. Неявка в течение 10 минут — техническое поражение. ' +
  'Результат подтверждают обе стороны; спорные матчи решает модератор.';

export const DEMO_TOURNAMENTS: DemoTournament[] = [
  // ───── Завершённые: сетка и призы ─────
  {
    slug: 'dota-2-autumn-major',
    title: 'Dota 2 Autumn Major 5x5',
    description: 'Главный осенний турнир сезона. Captains Mode, финал до трёх побед.',
    game: 'DOTA2',
    teamSize: 5,
    bestOf: 'BO3',
    finalsBestOf: 'BO5',
    category: 'SEMI_PRO',
    maxSlots: 8,
    timeline: 'completed',
    days: 18,
    participants: 8,
    prizeRub: 150_000,
    prizeSource: 'SPONSOR',
    prizeSplit: [50, 25, 15, 10],
  },
  {
    slug: 'cs2-moscow-open-cup',
    title: 'CS2 Moscow Open Cup',
    description: '16 команд, single elimination. Map pool Active Duty, финал BO3.',
    game: 'CS2',
    teamSize: 5,
    bestOf: 'BO1',
    finalsBestOf: 'BO3',
    category: 'OPEN',
    maxSlots: 16,
    timeline: 'completed',
    days: 11,
    participants: 16,
    entryFeeRub: 2_500,
    prizeRub: 40_000,
    prizeSource: 'ENTRY_FEES',
    prizeSplit: [60, 25, 15],
  },
  {
    slug: 'cs2-wingman-night',
    title: 'CS2 Wingman Night 2x2',
    description: 'Ночной турнир напарников на картах Wingman.',
    game: 'CS2',
    teamSize: 2,
    bestOf: 'BO1',
    finalsBestOf: 'BO3',
    category: 'AMATEUR',
    maxSlots: 8,
    timeline: 'completed',
    days: 7,
    participants: 8,
    prizeRub: 20_000,
    prizeSource: 'SPONSOR',
    prizeSplit: [60, 30, 10],
  },
  {
    slug: 'clash-royale-october-cup',
    title: 'Clash Royale October Cup 1x1',
    description: 'Соло-турнир с призами от спонсора. Турнирные правила уровней карт.',
    game: 'CLASH_ROYALE',
    teamSize: 1,
    bestOf: 'BO3',
    category: 'OPEN',
    maxSlots: 16,
    timeline: 'completed',
    days: 25,
    participants: 16,
    prizeRub: 30_000,
    prizeSource: 'SPONSOR',
    prizeSplit: [50, 30, 20],
  },
  {
    slug: 'brawl-stars-team-clash',
    title: 'Brawl Stars Team Clash 3x3',
    description: 'Gem Grab, Brawl Ball и Heist по кругу. Финал до трёх побед.',
    game: 'BRAWL_STARS',
    teamSize: 3,
    bestOf: 'BO3',
    finalsBestOf: 'BO5',
    category: 'AMATEUR',
    maxSlots: 8,
    timeline: 'completed',
    days: 4,
    participants: 8,
    prizeRub: 50_000,
    prizeSource: 'SPONSOR',
    prizeSplit: [50, 25, 15, 10],
  },
  {
    slug: 'dota-2-mid-wars-1x1',
    title: 'Dota 2 Mid Wars 1x1',
    description: 'Дуэли на центральной линии: Shadow Fiend, два убийства или башня.',
    game: 'DOTA2',
    teamSize: 1,
    bestOf: 'BO1',
    finalsBestOf: 'BO3',
    category: 'OPEN',
    maxSlots: 16,
    timeline: 'completed',
    days: 14,
    participants: 16,
    entryFeeRub: 500,
    prizeRub: 8_000,
    prizeSource: 'ENTRY_FEES',
    prizeSplit: [70, 30],
  },
  {
    slug: 'cs2-retake-masters',
    title: 'CS2 Retake Masters',
    description: 'Турнир отменён: не набралось минимальное число команд.',
    game: 'CS2',
    teamSize: 5,
    bestOf: 'BO1',
    category: 'PRO',
    maxSlots: 16,
    timeline: 'cancelled',
    days: 3,
    participants: 0,
  },

  // ───── Идут сейчас: сетка частично сыграна ─────
  {
    slug: 'dota-2-weekend-clash',
    title: 'Dota 2 Weekend Clash 5x5',
    description: 'Выходной кубок для любительских команд. Четвертьфиналы уже сыграны.',
    game: 'DOTA2',
    teamSize: 5,
    bestOf: 'BO1',
    finalsBestOf: 'BO3',
    category: 'AMATEUR',
    maxSlots: 8,
    timeline: 'live',
    days: 0,
    participants: 8,
    prizeRub: 25_000,
    prizeSource: 'SPONSOR',
    prizeSplit: [60, 30, 10],
  },
  {
    slug: 'clash-royale-evening-sprint',
    title: 'Clash Royale Evening Sprint',
    description: 'Быстрый вечерний турнир, все матчи BO1.',
    game: 'CLASH_ROYALE',
    teamSize: 1,
    bestOf: 'BO1',
    category: 'OPEN',
    maxSlots: 16,
    timeline: 'live',
    days: 0,
    participants: 16,
  },

  // ───── Регистрация и будущие ─────
  {
    slug: 'dota-2-winter-cup',
    title: 'Dota 2 Winter Cup 5x5',
    description: 'Зимний кубок с призами от спонсора. Captains Mode, финал BO3.',
    game: 'DOTA2',
    teamSize: 5,
    bestOf: 'BO1',
    finalsBestOf: 'BO3',
    category: 'SEMI_PRO',
    maxSlots: 16,
    timeline: 'registration',
    days: 6,
    participants: 5,
    prizeRub: 100_000,
    prizeSource: 'SPONSOR',
    prizeSplit: [50, 25, 15, 10],
  },
  {
    slug: 'cs2-friday-wingman',
    title: 'CS2 Friday Wingman 2x2',
    description: 'Пятничный турнир напарников, взнос 300 ₽ идёт в призовой фонд.',
    game: 'CS2',
    teamSize: 2,
    bestOf: 'BO1',
    category: 'OPEN',
    maxSlots: 16,
    timeline: 'registration',
    days: 3,
    participants: 6,
    entryFeeRub: 300,
    prizeRub: 4_000,
    prizeSource: 'ENTRY_FEES',
    prizeSplit: [70, 30],
  },
  {
    slug: 'brawl-stars-newbie-open',
    title: 'Brawl Stars Newbie Open 3x3',
    description: 'Бесплатный турнир для новичков, без призового фонда.',
    game: 'BRAWL_STARS',
    teamSize: 3,
    bestOf: 'BO3',
    category: 'OPEN',
    maxSlots: 32,
    timeline: 'registration',
    days: 4,
    participants: 4,
  },
  {
    slug: 'clash-royale-night-duel',
    title: 'Clash Royale Night Duel 1x1',
    description: 'Регистрация закрыта, сетка формируется. Старт через несколько часов.',
    game: 'CLASH_ROYALE',
    teamSize: 1,
    bestOf: 'BO3',
    category: 'AMATEUR',
    maxSlots: 32,
    timeline: 'closed',
    days: 0,
    participants: 12,
    prizeRub: 15_000,
    prizeSource: 'SPONSOR',
    prizeSplit: [100],
  },
  {
    slug: 'cs2-new-year-major',
    title: 'CS2 New Year Major',
    description: 'Новогодний турнир для полупрофессиональных команд. Регистрация откроется скоро.',
    game: 'CS2',
    teamSize: 5,
    bestOf: 'BO3',
    finalsBestOf: 'BO5',
    category: 'PRO',
    maxSlots: 16,
    timeline: 'upcoming',
    days: 30,
    participants: 0,
    prizeRub: 300_000,
    prizeSource: 'SPONSOR',
    prizeSplit: [50, 25, 15, 10],
  },
  {
    slug: 'brawl-stars-winter-league',
    title: 'Brawl Stars Winter League',
    description: 'Зимняя лига. Регистрация откроется через неделю.',
    game: 'BRAWL_STARS',
    teamSize: 3,
    bestOf: 'BO3',
    category: 'SEMI_PRO',
    maxSlots: 16,
    timeline: 'upcoming',
    days: 20,
    participants: 0,
    prizeRub: 60_000,
    prizeSource: 'SPONSOR',
    prizeSplit: [60, 30, 10],
  },

  // ───── Ждёт модератора ─────
  {
    slug: 'dota-2-turbo-community',
    title: 'Dota 2 Turbo Community Cup',
    description: 'Предложение игрока: турнир в режиме Turbo для своих.',
    game: 'DOTA2',
    teamSize: 5,
    bestOf: 'BO1',
    category: 'OPEN',
    maxSlots: 8,
    timeline: 'proposed',
    days: 9,
    participants: 0,
  },
];

// ───── Детерминированный ГСЧ: один и тот же slug — одна и та же сетка ─────

function rngFor(key: string): () => number {
  let h = 1779033703 ^ key.length;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 3432918353);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Порядок посева в первом раунде: 1–8, 4–5, 2–7, 3–6 … — фавориты встречаются как можно позже. */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const sum = order.length * 2 + 1;
    order = order.flatMap((s) => [s, sum - s]);
  }
  return order;
}

const WINS_NEEDED: Record<BestOf, number> = { BO1: 1, BO3: 2, BO5: 3 };

interface Entrant {
  id: string;
  seed: number;
}

interface GeneratedMatch {
  round: number;
  position: number;
  bracketGroup: number;
  bestOf: BestOf;
  status: MatchStatus;
  participantAId: string | null;
  participantBId: string | null;
  winnerRegistrationId: string | null;
  scoreA: number;
  scoreB: number;
  scheduledAt: Date;
  completedAt: Date | null;
}

/**
 * Single elimination с матчем за 3-е место.
 * playedRounds — сколько раундов уже сыграно (Infinity — весь турнир).
 */
export function buildBracket(opts: {
  key: string;
  entrants: Entrant[];
  bestOf: BestOf;
  finalsBestOf: BestOf | null;
  startsAt: Date;
  playedRounds: number;
}): GeneratedMatch[] {
  const rand = rngFor(opts.key);
  const size = opts.entrants.length;
  const rounds = Math.log2(size);
  if (!Number.isInteger(rounds) || rounds < 1) throw new Error(`Сетка на ${size} участников`);
  const bySeed = new Map(opts.entrants.map((e) => [e.seed, e]));
  const at = (round: number) => new Date(opts.startsAt.getTime() + (round - 1) * 2 * HOUR);

  const play = (
    round: number,
    position: number,
    bracketGroup: number,
    a: Entrant | null,
    b: Entrant | null,
    bestOf: BestOf,
    played: boolean,
  ): { match: GeneratedMatch; winner: Entrant | null; loser: Entrant | null } => {
    const base = {
      round,
      position,
      bracketGroup,
      bestOf,
      participantAId: a?.id ?? null,
      participantBId: b?.id ?? null,
      scheduledAt: at(round),
    };
    if (!played || !a || !b) {
      const status: MatchStatus = a && b ? 'READY' : 'PENDING';
      return {
        match: {
          ...base,
          status,
          winnerRegistrationId: null,
          scoreA: 0,
          scoreB: 0,
          completedAt: null,
        },
        winner: null,
        loser: null,
      };
    }
    // Фаворит (меньший посев) выигрывает в ~65% случаев
    const aWins = rand() < (a.seed < b.seed ? 0.65 : 0.35);
    const need = WINS_NEEDED[bestOf];
    const loserScore = Math.floor(rand() * need);
    const minutes = 35 + Math.floor(rand() * 25);
    return {
      match: {
        ...base,
        status: 'COMPLETED',
        winnerRegistrationId: aWins ? a.id : b.id,
        scoreA: aWins ? need : loserScore,
        scoreB: aWins ? loserScore : need,
        completedAt: new Date(at(round).getTime() + (need + loserScore) * minutes * 60_000),
      },
      winner: aWins ? a : b,
      loser: aWins ? b : a,
    };
  };

  const matches: GeneratedMatch[] = [];
  let current: (Entrant | null)[] = seedOrder(size).map((s) => bySeed.get(s) ?? null);
  const semiLosers: (Entrant | null)[] = [];
  for (let round = 1; round <= rounds; round++) {
    const next: (Entrant | null)[] = [];
    const bestOf = round === rounds ? (opts.finalsBestOf ?? opts.bestOf) : opts.bestOf;
    for (let position = 0; position < current.length / 2; position++) {
      const a = current[2 * position] ?? null;
      const b = current[2 * position + 1] ?? null;
      const r = play(round, position, 0, a, b, bestOf, round <= opts.playedRounds);
      matches.push(r.match);
      next.push(r.winner);
      if (round === rounds - 1) semiLosers.push(r.loser);
    }
    current = next;
  }
  if (rounds >= 2) {
    const [a = null, b = null] = semiLosers;
    matches.push(play(rounds, 0, 1, a, b, opts.bestOf, rounds <= opts.playedRounds).match);
  }
  return matches;
}

// ───── Запись в БД ─────

function schedule(t: DemoTournament, now: number) {
  const startsAt =
    t.timeline === 'live'
      ? now - 5 * HOUR
      : t.timeline === 'closed'
        ? now + 4 * HOUR
        : t.timeline === 'completed' || t.timeline === 'cancelled'
          ? now - t.days * DAY
          : now + t.days * DAY;
  const opensAt =
    t.timeline === 'upcoming'
      ? Math.min(now + 7 * DAY, startsAt - 3 * DAY)
      : t.timeline === 'registration' || t.timeline === 'proposed'
        ? Math.min(now - 2 * DAY, startsAt - 3 * DAY)
        : startsAt - 10 * DAY;
  return {
    registrationOpensAt: new Date(opensAt),
    // «Регистрация закрыта»: приём заявок уже кончился, старт ещё впереди
    registrationClosesAt: new Date(t.timeline === 'closed' ? now - 2 * HOUR : startsAt - HOUR),
    startsAt: new Date(startsAt),
  };
}

const STATUS: Record<Timeline, TournamentStatus> = {
  proposed: 'PROPOSED',
  upcoming: 'PUBLISHED',
  registration: 'PUBLISHED',
  closed: 'PUBLISHED',
  live: 'IN_PROGRESS',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
};

const rub = (v: number | undefined) => BigInt(Math.round((v ?? 0) * 100));

async function upsertPlayers(prisma: PrismaClient): Promise<Map<string, string>> {
  const existing = await prisma.user.findMany({
    where: { nickname: { in: [DEMO_ORGANIZER, ...DEMO_PLAYERS] } },
  });
  const taken = existing.filter((u) => u.passwordHash !== null).map((u) => u.nickname);
  if (taken.length > 0) {
    throw new Error(`Никнеймы демо-игроков заняты настоящими пользователями: ${taken.join(', ')}`);
  }
  const birthDate = new Date('2000-01-15T00:00:00Z');
  await prisma.user.createMany({
    data: [
      { nickname: DEMO_ORGANIZER, role: 'MODERATOR', birthDate },
      ...DEMO_PLAYERS.map((nickname) => ({ nickname, birthDate })),
    ],
    skipDuplicates: true,
  });
  const users = await prisma.user.findMany({
    where: { nickname: { in: [DEMO_ORGANIZER, ...DEMO_PLAYERS] } },
    select: { id: true, nickname: true },
  });
  return new Map(users.map((u) => [u.nickname, u.id]));
}

interface DemoTeam {
  id: string;
  name: string;
  memberIds: string[];
}

/** Команды на формат «игра:размер»; у каждой команды формата свои игроки. */
async function upsertTeams(
  prisma: PrismaClient,
  users: Map<string, string>,
  gameIds: Record<string, string>,
): Promise<Map<string, DemoTeam[]>> {
  const result = new Map<string, DemoTeam[]>();
  for (const [format, names] of Object.entries(TEAM_NAMES)) {
    const [game, size] = format.split(':') as [GameCode, string];
    const teamSize = Number(size);
    const teams: DemoTeam[] = [];
    for (const [i, name] of names.entries()) {
      const memberIds = DEMO_PLAYERS.slice(i * teamSize, (i + 1) * teamSize).map((n) =>
        users.get(n)!,
      );
      const team =
        (await prisma.team.findFirst({
          where: { gameId: gameIds[game]!, name, disbandedAt: null },
        })) ??
        (await prisma.team.create({
          data: {
            gameId: gameIds[game]!,
            name,
            tag: name
              .replace(/[^\p{L}\p{N} ]/gu, '')
              .split(' ')
              .map((w) => w[0])
              .join('')
              .slice(0, 4)
              .toUpperCase(),
            captainId: memberIds[0]!,
            members: { create: memberIds.map((userId) => ({ userId })) },
          },
        }));
      teams.push({ id: team.id, name, memberIds });
    }
    result.set(format, teams);
  }
  return result;
}

/** Удаляет демо-турниры (созданные демо-пользователями) вместе с заявками и сеткой. */
async function removeDemoTournaments(prisma: PrismaClient, userIds: string[]): Promise<void> {
  const where = { tournament: { createdById: { in: userIds } } };
  await prisma.$transaction([
    prisma.dispute.deleteMany({ where: { match: where } }),
    prisma.match.deleteMany({ where }),
    prisma.registration.deleteMany({ where }),
    prisma.tournament.deleteMany({ where: { createdById: { in: userIds } } }),
  ]);
}

export async function seedDemo(prisma: PrismaClient, opts: { reset: boolean }): Promise<number> {
  const users = await upsertPlayers(prisma);
  const organizerId = users.get(DEMO_ORGANIZER)!;
  const demoUserIds = [...users.values()];
  const existing = await prisma.tournament.count({
    where: { slug: { in: DEMO_TOURNAMENTS.map((t) => t.slug) } },
  });
  if (existing > 0 && !opts.reset) return 0;
  await removeDemoTournaments(prisma, demoUserIds);

  const gameIds = Object.fromEntries(
    (await prisma.game.findMany()).map((g) => [g.code, g.id]),
  ) as Record<GameCode, string>;
  const teams = await upsertTeams(prisma, users, gameIds);
  const now = Date.now();

  for (const t of DEMO_TOURNAMENTS) {
    const dates = schedule(t, now);
    const status = STATUS[t.timeline];
    const split = t.prizeSplit ?? [];
    const created = await prisma.tournament.create({
      data: {
        slug: t.slug,
        title: t.title,
        description: t.description,
        rules: RULES,
        gameId: gameIds[t.game],
        participantType: t.teamSize === 1 ? 'SOLO' : 'TEAM',
        teamSize: t.teamSize,
        bracketType: 'SINGLE_ELIMINATION',
        bestOf: t.bestOf,
        finalsBestOf: t.finalsBestOf ?? null,
        category: t.category,
        status,
        maxSlots: t.maxSlots,
        entryFeeKopecks: rub(t.entryFeeRub),
        prizePoolKopecks: rub(t.prizeRub),
        prizeSource: t.prizeSource ?? 'NONE',
        prizeDistribution: split.length
          ? split.map((pct, i) => ({ place: i + 1, shareBp: pct * 100 }))
          : undefined,
        ...dates,
        completedAt:
          t.timeline === 'completed' ? new Date(dates.startsAt.getTime() + 9 * HOUR) : null,
        cancelledAt: t.timeline === 'cancelled' ? new Date(dates.startsAt.getTime() - DAY) : null,
        reviewedAt: t.timeline === 'proposed' ? null : dates.registrationOpensAt,
        createdById: t.timeline === 'proposed' ? users.get(DEMO_PLAYERS[0]!)! : organizerId,
      },
    });

    // Заявки: команды формата или игроки-соло, по порядку посева
    const pool =
      t.teamSize === 1
        ? DEMO_PLAYERS.slice(0, t.participants).map((n) => {
            const id = users.get(n)!;
            return { name: null, teamId: null, captainId: id, memberIds: [id] };
          })
        : (teams.get(`${t.game}:${t.teamSize}`) ?? []).slice(0, t.participants).map((team) => ({
            name: team.name,
            teamId: team.id,
            captainId: team.memberIds[0]!,
            memberIds: team.memberIds,
          }));
    if (pool.length < t.participants) throw new Error(`Мало участников для ${t.slug}`);

    const rand = rngFor(`${t.slug}:seeding`);
    const opensAt = dates.registrationOpensAt.getTime();
    const window = Math.min(dates.registrationClosesAt.getTime(), now) - opensAt;
    const entrants: Entrant[] = [];
    for (const [i, p] of pool.entries()) {
      const reg = await prisma.registration.create({
        data: {
          tournamentId: created.id,
          participantType: t.teamSize === 1 ? 'SOLO' : 'TEAM',
          userId: t.teamSize === 1 ? p.captainId : null,
          teamId: p.teamId,
          teamNameSnapshot: p.name,
          status: 'CONFIRMED',
          seed: t.timeline === 'completed' || t.timeline === 'live' ? i + 1 : null,
          createdById: p.captainId,
          createdAt: new Date(opensAt + Math.floor(rand() * Math.max(window, HOUR))),
          members: {
            create: p.memberIds.map((userId) => ({ tournamentId: created.id, userId })),
          },
        },
      });
      entrants.push({ id: reg.id, seed: i + 1 });
    }

    if (t.timeline === 'completed' || t.timeline === 'live') {
      const matches = buildBracket({
        key: t.slug,
        entrants,
        bestOf: t.bestOf,
        finalsBestOf: t.finalsBestOf ?? null,
        startsAt: dates.startsAt,
        playedRounds: t.timeline === 'completed' ? Infinity : 1,
      });
      await prisma.match.createMany({
        data: matches.map((m) => ({ ...m, tournamentId: created.id })),
      });
    }
  }
  return DEMO_TOURNAMENTS.length;
}

async function main(): Promise<void> {
  const rootEnv = path.resolve(__dirname, '../../../.env');
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  try {
    const created = await seedDemo(prisma, { reset: process.argv.includes('--reset') });
    console.warn(
      created
        ? `[demo] создано турниров: ${created}`
        : '[demo] демо-турниры уже есть — для пересоздания запустите с --reset',
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
