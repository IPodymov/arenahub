import type {
  AuthProvider,
  ParticipantType,
  PrizeSource,
  TournamentStatus,
} from '@arenahub/shared';

/** Срез политики игры, нужный доменным правилам. */
export interface PolicySnapshot {
  paidEntryAllowed: boolean;
  maxEntryFeeKopecks: bigint | null;
  maxPrizePoolKopecks: bigint | null;
  allowedPrizeSources: PrizeSource[];
  minAge: number;
  allowedTeamSizes: number[];
  maxSubstitutes: number;
  requiredProvider: AuthProvider | null;
}

export interface ScheduleSnapshot {
  status: TournamentStatus;
  registrationOpensAt: Date;
  registrationClosesAt: Date;
  startsAt: Date;
}

/** Параметры турнира, проверяемые против политики игры. */
export interface TournamentTerms extends ScheduleSnapshot {
  participantType: ParticipantType;
  teamSize: number;
  maxSubstitutes: number;
  maxSlots: number;
  minSlots: number;
  minAge: number | null;
  entryFeeKopecks: bigint;
  prizePoolKopecks: bigint;
  prizeSource: PrizeSource;
}
