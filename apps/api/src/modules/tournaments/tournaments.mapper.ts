import {
  ACTIVE_REGISTRATION_STATUSES,
  type TournamentDto,
  type TournamentSummaryDto,
} from '@arenahub/shared';
import type { Prisma } from '../../generated/prisma/client';
import { tournamentPhase } from './domain/tournament-phase';
import { effectiveMinAge } from './domain/tournament-rules';
import type { PolicySnapshot, TournamentTerms } from './domain/types';

export const tournamentInclude = {
  game: { include: { policy: true } },
  createdBy: { select: { id: true, nickname: true } },
  _count: {
    select: { registrations: { where: { status: { in: [...ACTIVE_REGISTRATION_STATUSES] } } } },
  },
} satisfies Prisma.TournamentInclude;

export type TournamentRow = Prisma.TournamentGetPayload<{ include: typeof tournamentInclude }>;

export function toPolicySnapshot(p: NonNullable<TournamentRow['game']['policy']>): PolicySnapshot {
  return {
    paidEntryAllowed: p.paidEntryAllowed,
    maxEntryFeeKopecks: p.maxEntryFeeKopecks,
    maxPrizePoolKopecks: p.maxPrizePoolKopecks,
    allowedPrizeSources: p.allowedPrizeSources,
    minAge: p.minAge,
    allowedTeamSizes: p.allowedTeamSizes,
    maxSubstitutes: p.maxSubstitutes,
    requiredProvider: p.requiredProvider,
  };
}

export function toTerms(t: TournamentRow | Prisma.TournamentGetPayload<object>): TournamentTerms {
  return {
    status: t.status,
    participantType: t.participantType,
    teamSize: t.teamSize,
    maxSubstitutes: t.maxSubstitutes,
    maxSlots: t.maxSlots,
    minSlots: t.minSlots,
    minAge: t.minAge,
    entryFeeKopecks: t.entryFeeKopecks,
    prizePoolKopecks: t.prizePoolKopecks,
    prizeSource: t.prizeSource,
    registrationOpensAt: t.registrationOpensAt,
    registrationClosesAt: t.registrationClosesAt,
    startsAt: t.startsAt,
  };
}

export function toSummaryDto(t: TournamentRow, now: Date): TournamentSummaryDto {
  return {
    id: t.id,
    slug: t.slug,
    title: t.title,
    game: { code: t.game.code, name: t.game.name },
    participantType: t.participantType,
    teamSize: t.teamSize,
    bracketType: t.bracketType,
    bestOf: t.bestOf,
    category: t.category,
    status: t.status,
    phase: tournamentPhase(t, now),
    maxSlots: t.maxSlots,
    takenSlots: t._count.registrations,
    entryFeeKopecks: t.entryFeeKopecks.toString(),
    prizePoolKopecks: t.prizePoolKopecks.toString(),
    prizeSource: t.prizeSource,
    registrationOpensAt: t.registrationOpensAt.toISOString(),
    registrationClosesAt: t.registrationClosesAt.toISOString(),
    startsAt: t.startsAt.toISOString(),
    createdBy: t.createdBy,
  };
}

export function toTournamentDto(t: TournamentRow, now: Date): TournamentDto {
  return {
    ...toSummaryDto(t, now),
    description: t.description,
    rules: t.rules,
    maxSubstitutes: t.maxSubstitutes,
    finalsBestOf: t.finalsBestOf,
    minSlots: t.minSlots,
    minAge: effectiveMinAge(t, t.game.policy!),
    prizeDistribution: (t.prizeDistribution as TournamentDto['prizeDistribution']) ?? null,
    completedAt: t.completedAt?.toISOString() ?? null,
    cancelledAt: t.cancelledAt?.toISOString() ?? null,
    reviewNote: t.reviewNote,
  };
}
