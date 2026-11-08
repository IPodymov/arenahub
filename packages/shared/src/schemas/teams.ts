import { z } from 'zod';
import { TEAM_INVITE_TTL_HOURS_DEFAULT } from '../constants';
import { GameCode, type TeamMemberRole } from '../enums';

export const teamNameSchema = z
  .string()
  .trim()
  .min(2, 'Минимум 2 символа')
  .max(32, 'Максимум 32 символа');
export const teamTagSchema = z
  .string()
  .trim()
  .min(2)
  .max(5)
  .regex(/^[A-Za-z0-9А-Яа-яЁё]+$/, 'Только буквы и цифры');

export const createTeamSchema = z.object({
  gameCode: GameCode,
  name: teamNameSchema,
  tag: teamTagSchema.optional(),
});
export type CreateTeamInput = z.input<typeof createTeamSchema>;

export const updateTeamSchema = z
  .object({
    name: teamNameSchema.optional(),
    tag: teamTagSchema.nullable().optional(),
    avatarUrl: z.url().max(500).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Нечего обновлять');
export type UpdateTeamInput = z.input<typeof updateTeamSchema>;

export const createInviteSchema = z.object({
  ttlHours: z
    .number()
    .int()
    .min(1)
    .max(24 * 14)
    .default(TEAM_INVITE_TTL_HOURS_DEFAULT),
  maxUses: z.number().int().min(1).max(10).default(1),
});
export type CreateInviteInput = z.input<typeof createInviteSchema>;

export const transferCaptainSchema = z.object({ userId: z.uuid() });
export type TransferCaptainInput = z.input<typeof transferCaptainSchema>;

export const setMemberRoleSchema = z.object({
  role: z.enum(['PLAYER', 'SUBSTITUTE']),
});

export interface TeamMemberDto {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  role: TeamMemberRole;
  isCaptain: boolean;
  joinedAt: string;
}

export interface TeamDto {
  id: string;
  name: string;
  tag: string | null;
  avatarUrl: string | null;
  game: { code: GameCode; name: string };
  captainId: string;
  maxRosterSize: number;
  members: TeamMemberDto[];
  disbanded: boolean;
  createdAt: string;
}

export interface TeamInviteDto {
  id: string;
  /** Полная ссылка; токен показывается только при создании */
  url: string;
  expiresAt: string;
  maxUses: number;
}

export interface InvitePreviewDto {
  team: {
    id: string;
    name: string;
    tag: string | null;
    game: { code: GameCode; name: string };
    memberCount: number;
    maxRosterSize: number;
  };
  expiresAt: string;
}
