import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type GameCode, type Prisma } from '../src/generated/prisma/client';

type PolicySeed = Omit<Prisma.GamePolicyCreateWithoutGameInput, 'id' | 'updatedAt'>;

interface GameSeed {
  code: GameCode;
  name: string;
  slug: string;
  sortOrder: number;
  policy: PolicySeed;
}

// Лимиты призов оставлены пустыми (null) до сверки с актуальными правилами издателей.
export const GAMES: GameSeed[] = [
  {
    code: 'DOTA2',
    name: 'Dota 2',
    slug: 'dota-2',
    sortOrder: 1,
    policy: {
      paidEntryAllowed: true,
      maxEntryFeeKopecks: null,
      maxPrizePoolKopecks: null,
      allowedPrizeSources: ['NONE', 'SPONSOR', 'ENTRY_FEES'],
      minAge: 16,
      allowedTeamSizes: [1, 5],
      maxSubstitutes: 2,
      resultVerification: ['API', 'SCREENSHOT'],
      requiredProvider: 'STEAM',
      notes: 'Результат проверяется по match ID через Steam Web API / OpenDota.',
    },
  },
  {
    code: 'CS2',
    name: 'Counter-Strike 2',
    slug: 'cs2',
    sortOrder: 2,
    policy: {
      paidEntryAllowed: true,
      maxEntryFeeKopecks: null,
      maxPrizePoolKopecks: null,
      allowedPrizeSources: ['NONE', 'SPONSOR', 'ENTRY_FEES'],
      minAge: 16,
      allowedTeamSizes: [1, 2, 5],
      maxSubstitutes: 2,
      // Публичного API результатов матчей CS2 нет — только скриншот/демо
      resultVerification: ['SCREENSHOT'],
      requiredProvider: 'STEAM',
      notes: 'Учитывать правила Valve для коммьюнити-турниров.',
    },
  },
  {
    code: 'CLASH_ROYALE',
    name: 'Clash Royale',
    slug: 'clash-royale',
    sortOrder: 3,
    policy: {
      // Supercell Fan Content Policy: призы из денег игроков запрещены
      paidEntryAllowed: false,
      maxEntryFeeKopecks: 0n,
      maxPrizePoolKopecks: null,
      allowedPrizeSources: ['NONE', 'SPONSOR'],
      minAge: 16,
      allowedTeamSizes: [1, 2],
      maxSubstitutes: 0,
      resultVerification: ['API', 'SCREENSHOT'],
      // Проверка тега игрока появится вместе с интеграцией Supercell API
      requiredProvider: null,
      notes: 'Supercell запрещает платный вход и призы из взносов игроков.',
    },
  },
  {
    code: 'BRAWL_STARS',
    name: 'Brawl Stars',
    slug: 'brawl-stars',
    sortOrder: 4,
    policy: {
      paidEntryAllowed: false,
      maxEntryFeeKopecks: 0n,
      maxPrizePoolKopecks: null,
      allowedPrizeSources: ['NONE', 'SPONSOR'],
      minAge: 16,
      allowedTeamSizes: [1, 3],
      maxSubstitutes: 1,
      resultVerification: ['API', 'SCREENSHOT'],
      requiredProvider: null,
      notes: 'Supercell запрещает платный вход и призы из взносов игроков.',
    },
  },
];

export async function seedGames(prisma: PrismaClient): Promise<void> {
  for (const { policy, ...game } of GAMES) {
    await prisma.game.upsert({
      where: { code: game.code },
      create: { ...game, policy: { create: policy } },
      update: { ...game, policy: { upsert: { create: policy, update: policy } } },
    });
  }
}

const DAY = 24 * 60 * 60 * 1000;

/** Демо-турниры для локальной разработки — создаются один раз, если турниров ещё нет. */
async function seedDemo(prisma: PrismaClient): Promise<void> {
  if ((await prisma.tournament.count()) > 0) return;

  const admin = await prisma.user.upsert({
    where: { nickname: 'arenahub' },
    create: { nickname: 'arenahub', role: 'ADMIN' },
    update: {},
  });
  const games = Object.fromEntries((await prisma.game.findMany()).map((g) => [g.code, g.id]));
  const now = Date.now();

  const base = {
    status: 'PUBLISHED' as const,
    category: 'OPEN' as const,
    bracketType: 'SINGLE_ELIMINATION' as const,
    createdById: admin.id,
    rules: 'Стандартные правила платформы. Неявка в течение 10 минут — техническое поражение.',
  };

  await prisma.tournament.createMany({
    data: [
      {
        ...base,
        slug: 'dota-2-weekly-cup',
        title: 'Dota 2 Weekly Cup 5x5',
        description: 'Еженедельный командный кубок. Captains Mode.',
        gameId: games.DOTA2!,
        participantType: 'TEAM',
        teamSize: 5,
        maxSubstitutes: 2,
        bestOf: 'BO1',
        finalsBestOf: 'BO3',
        maxSlots: 16,
        entryFeeKopecks: 50_000n,
        prizePoolKopecks: 600_000n,
        prizeSource: 'ENTRY_FEES',
        prizeDistribution: [
          { place: 1, shareBp: 6000 },
          { place: 2, shareBp: 3000 },
          { place: 3, shareBp: 1000 },
        ],
        registrationOpensAt: new Date(now - DAY),
        registrationClosesAt: new Date(now + 5 * DAY),
        startsAt: new Date(now + 6 * DAY),
      },
      {
        ...base,
        slug: 'brawl-stars-3x3-open',
        title: 'Brawl Stars 3x3 Open',
        description: 'Бесплатный турнир, Gem Grab и Brawl Ball.',
        gameId: games.BRAWL_STARS!,
        participantType: 'TEAM',
        teamSize: 3,
        maxSubstitutes: 1,
        bestOf: 'BO3',
        maxSlots: 32,
        registrationOpensAt: new Date(now - DAY),
        registrationClosesAt: new Date(now + 3 * DAY),
        startsAt: new Date(now + 4 * DAY),
      },
      {
        ...base,
        slug: 'clash-royale-1x1-sprint',
        title: 'Clash Royale 1x1 Sprint',
        description: 'Соло-турнир, спонсорский призовой фонд.',
        gameId: games.CLASH_ROYALE!,
        participantType: 'SOLO',
        teamSize: 1,
        bestOf: 'BO3',
        maxSlots: 64,
        prizePoolKopecks: 300_000n,
        prizeSource: 'SPONSOR',
        prizeDistribution: [{ place: 1, shareBp: 10000 }],
        registrationOpensAt: new Date(now - 3 * DAY),
        registrationClosesAt: new Date(now - 2 * DAY),
        startsAt: new Date(now - DAY),
      },
      {
        ...base,
        slug: 'cs2-wingman-night',
        title: 'CS2 Wingman Night 2x2',
        gameId: games.CS2!,
        participantType: 'TEAM',
        teamSize: 2,
        bestOf: 'BO1',
        maxSlots: 16,
        status: 'COMPLETED',
        registrationOpensAt: new Date(now - 10 * DAY),
        registrationClosesAt: new Date(now - 8 * DAY),
        startsAt: new Date(now - 7 * DAY),
        completedAt: new Date(now - 7 * DAY + 4 * 60 * 60 * 1000),
      },
    ],
  });
}

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  try {
    await seedGames(prisma);
    if (process.env.NODE_ENV === 'development') await seedDemo(prisma);
    console.warn('[seed] готово');
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
