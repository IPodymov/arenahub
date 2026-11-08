import { z } from 'zod';

// Значения совпадают с enum'ами Prisma (apps/api/prisma/schema.prisma).

export const UserRole = z.enum(['USER', 'ADMIN']);
export type UserRole = z.infer<typeof UserRole>;

export const AuthProvider = z.enum(['STEAM', 'BATTLENET', 'SUPERCELL']);
export type AuthProvider = z.infer<typeof AuthProvider>;

export const GameCode = z.enum(['DOTA2', 'CS2', 'CLASH_ROYALE', 'BRAWL_STARS']);
export type GameCode = z.infer<typeof GameCode>;

export const ResultVerification = z.enum(['API', 'SCREENSHOT']);
export type ResultVerification = z.infer<typeof ResultVerification>;

export const PrizeSource = z.enum(['NONE', 'SPONSOR', 'ENTRY_FEES']);
export type PrizeSource = z.infer<typeof PrizeSource>;

export const ParticipantType = z.enum(['SOLO', 'TEAM']);
export type ParticipantType = z.infer<typeof ParticipantType>;

export const BracketType = z.enum([
  'SINGLE_ELIMINATION',
  'DOUBLE_ELIMINATION',
  'ROUND_ROBIN',
  'SWISS',
]);
export type BracketType = z.infer<typeof BracketType>;

export const BestOf = z.enum(['BO1', 'BO3', 'BO5']);
export type BestOf = z.infer<typeof BestOf>;

export const TournamentStatus = z.enum([
  'DRAFT',
  'PUBLISHED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);
export type TournamentStatus = z.infer<typeof TournamentStatus>;

/** Публичная фаза: вычисляется из статуса и дат, в БД не хранится. */
export const TournamentPhase = z.enum([
  'DRAFT',
  'UPCOMING',
  'REGISTRATION',
  'REGISTRATION_CLOSED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);
export type TournamentPhase = z.infer<typeof TournamentPhase>;

/** Табы каталога. */
export const CatalogTab = z.enum(['registration', 'live', 'finished']);
export type CatalogTab = z.infer<typeof CatalogTab>;

export const TournamentCategory = z.enum(['OPEN', 'AMATEUR', 'SEMI_PRO', 'PRO']);
export type TournamentCategory = z.infer<typeof TournamentCategory>;

export const TeamMemberRole = z.enum(['PLAYER', 'SUBSTITUTE']);
export type TeamMemberRole = z.infer<typeof TeamMemberRole>;

export const RegistrationStatus = z.enum([
  'PENDING_PAYMENT',
  'CONFIRMED',
  'WITHDRAWN',
  'DISQUALIFIED',
]);
export type RegistrationStatus = z.infer<typeof RegistrationStatus>;

export const ACTIVE_REGISTRATION_STATUSES: readonly RegistrationStatus[] = [
  'PENDING_PAYMENT',
  'CONFIRMED',
];
