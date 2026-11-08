import type { AuthProvider, GameCode, PrizeSource, ResultVerification } from '../enums';

export interface GamePolicyDto {
  paidEntryAllowed: boolean;
  maxEntryFeeKopecks: string | null;
  maxPrizePoolKopecks: string | null;
  allowedPrizeSources: PrizeSource[];
  minAge: number;
  allowedTeamSizes: number[];
  maxSubstitutes: number;
  resultVerification: ResultVerification[];
  requiredProvider: AuthProvider | null;
  notes: string | null;
}

export interface GameDto {
  id: string;
  code: GameCode;
  name: string;
  slug: string;
  iconUrl: string | null;
  policy: GamePolicyDto;
}
