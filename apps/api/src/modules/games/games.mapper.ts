import type { GameDto, GamePolicyDto } from '@arenahub/shared';
import type { Game, GamePolicy } from '../../generated/prisma/client';

export function toPolicyDto(p: GamePolicy): GamePolicyDto {
  return {
    paidEntryAllowed: p.paidEntryAllowed,
    maxEntryFeeKopecks: p.maxEntryFeeKopecks?.toString() ?? null,
    maxPrizePoolKopecks: p.maxPrizePoolKopecks?.toString() ?? null,
    allowedPrizeSources: p.allowedPrizeSources,
    minAge: p.minAge,
    allowedTeamSizes: p.allowedTeamSizes,
    maxSubstitutes: p.maxSubstitutes,
    resultVerification: p.resultVerification,
    requiredProvider: p.requiredProvider,
    notes: p.notes,
  };
}

export function toGameDto(g: Game & { policy: GamePolicy | null }): GameDto {
  if (!g.policy) throw new Error(`У игры ${g.code} нет политики`);
  return {
    id: g.id,
    code: g.code,
    name: g.name,
    slug: g.slug,
    iconUrl: g.iconUrl,
    policy: toPolicyDto(g.policy),
  };
}
