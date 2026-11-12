import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type GameCode, type Prisma } from '../src/generated/prisma/client';
import { seedDemo } from './demo';

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

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });
  try {
    await seedGames(prisma);
    // Демо-турниры — только локально; в другие базы их кладут явно: `pnpm db:demo`
    if (process.env.NODE_ENV === 'development') await seedDemo(prisma, { reset: false });
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
