import { z } from 'zod';
import { kopecksSchema } from '../money';
import {
  BestOf,
  BracketType,
  CatalogTab,
  GameCode,
  type MatchStatus,
  ParticipantType,
  PrizeSource,
  TournamentCategory,
  type RegistrationStatus,
  type TournamentPhase,
  TournamentStatus,
} from '../enums';
import { paginationQuery } from './common';

export const tournamentListQuery = paginationQuery.extend({
  tab: CatalogTab.default('registration'),
  game: GameCode.optional(),
  participantType: ParticipantType.optional(),
  teamSize: z.coerce.number().int().min(1).max(10).optional(),
  category: TournamentCategory.optional(),
  paid: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type TournamentListQuery = z.input<typeof tournamentListQuery>;

const prizeDistributionSchema = z
  .array(z.object({ place: z.number().int().min(1), shareBp: z.number().int().min(1).max(10_000) }))
  .max(16)
  .refine(
    (rows) => rows.reduce((s, r) => s + r.shareBp, 0) === 10_000,
    'Сумма долей должна быть 100%',
  )
  .refine(
    (rows) => new Set(rows.map((r) => r.place)).size === rows.length,
    'Места не должны повторяться',
  );

const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Только латиница в нижнем регистре, цифры и дефисы');

const tournamentFields = {
  slug: slugSchema,
  title: z.string().trim().min(3).max(120),
  description: z.string().max(5000).nullable().optional(),
  rules: z.string().max(20000).nullable().optional(),
  gameCode: GameCode,
  participantType: ParticipantType,
  teamSize: z.number().int().min(1).max(10),
  maxSubstitutes: z.number().int().min(0).max(5).default(0),
  bracketType: BracketType,
  bestOf: BestOf,
  finalsBestOf: BestOf.nullable().optional(),
  category: TournamentCategory,
  maxSlots: z.number().int().min(2).max(1024),
  minSlots: z.number().int().min(2).max(1024).default(2),
  minAge: z.number().int().min(16).max(99).nullable().optional(),
  entryFeeKopecks: kopecksSchema.default(0n),
  prizePoolKopecks: kopecksSchema.default(0n),
  prizeSource: PrizeSource.default('NONE'),
  prizeDistribution: prizeDistributionSchema.nullable().optional(),
  registrationOpensAt: z.coerce.date(),
  registrationClosesAt: z.coerce.date(),
  startsAt: z.coerce.date(),
};

// Согласованность полей между собой и с политикой игры проверяет доменный сервис —
// здесь только форма данных.
export const createTournamentSchema = z.object(tournamentFields);
export type CreateTournamentInput = z.input<typeof createTournamentSchema>;
export type CreateTournamentData = z.output<typeof createTournamentSchema>;

export const updateTournamentSchema = z
  .object(tournamentFields)
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Нечего обновлять');
export type UpdateTournamentInput = z.input<typeof updateTournamentSchema>;
export type UpdateTournamentData = z.output<typeof updateTournamentSchema>;

export const adminTournamentListQuery = paginationQuery.extend({
  status: TournamentStatus.optional(),
});
export type AdminTournamentListQuery = z.input<typeof adminTournamentListQuery>;

export const rejectTournamentSchema = z.object({
  note: z.string().trim().min(3, 'Укажите причину').max(500),
});
export type RejectTournamentInput = z.input<typeof rejectTournamentSchema>;

export const registerForTournamentSchema = z.object({
  /** Только для командных турниров */
  teamId: z.uuid().optional(),
  /** Основной состав (включая капитана, если он играет) */
  playerIds: z.array(z.uuid()).max(10).optional(),
  substituteIds: z.array(z.uuid()).max(5).default([]),
});
export type RegisterForTournamentInput = z.input<typeof registerForTournamentSchema>;

export interface TournamentSummaryDto {
  id: string;
  slug: string;
  title: string;
  game: { code: GameCode; name: string };
  participantType: ParticipantType;
  teamSize: number;
  bracketType: BracketType;
  bestOf: BestOf;
  category: TournamentCategory;
  status: TournamentStatus;
  phase: TournamentPhase;
  maxSlots: number;
  takenSlots: number;
  entryFeeKopecks: string;
  prizePoolKopecks: string;
  prizeSource: PrizeSource;
  registrationOpensAt: string;
  registrationClosesAt: string;
  startsAt: string;
  createdBy: { id: string; nickname: string };
}

export interface TournamentDto extends TournamentSummaryDto {
  description: string | null;
  rules: string | null;
  maxSubstitutes: number;
  finalsBestOf: BestOf | null;
  minSlots: number;
  minAge: number;
  prizeDistribution: { place: number; shareBp: number }[] | null;
  completedAt: string | null;
  cancelledAt: string | null;
  /** Причина отклонения предложения */
  reviewNote: string | null;
}

export interface ParticipantDto {
  registrationId: string;
  status: RegistrationStatus;
  /** Соло: ник игрока; команда: название */
  name: string;
  team: { id: string; name: string; tag: string | null } | null;
  members: { userId: string; nickname: string; avatarUrl: string | null; isSubstitute: boolean }[];
  registeredAt: string;
}

export interface MyRegistrationDto {
  registrationId: string;
  status: RegistrationStatus;
  teamId: string | null;
}

export interface BracketSideDto {
  registrationId: string;
  name: string;
  seed: number | null;
}

export interface BracketMatchDto {
  id: string;
  round: number;
  position: number;
  /** 0 — основная сетка, 1 — матч за 3-е место */
  bracketGroup: number;
  bestOf: BestOf;
  status: MatchStatus;
  a: BracketSideDto | null;
  b: BracketSideDto | null;
  winnerRegistrationId: string | null;
  scoreA: number;
  scoreB: number;
  scheduledAt: string | null;
  completedAt: string | null;
}

/** Итоговое место; при дележе (например 5–8) placeTo > place. */
export interface StandingDto {
  place: number;
  placeTo: number;
  registrationId: string;
  name: string;
  prizeKopecks: string;
}

export interface BracketDto {
  /** Раундов в основной сетке */
  rounds: number;
  matches: BracketMatchDto[];
  /** Пусто, пока не сыгран финал */
  standings: StandingDto[];
}
