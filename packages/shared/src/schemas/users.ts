import { z } from 'zod';
import { isValidIsoDate } from '../age';
import { type AuthProvider, UserRole } from '../enums';
import { paginationQuery } from './common';

export const nicknameSchema = z
  .string()
  .trim()
  .min(3, 'Минимум 3 символа')
  .max(24, 'Максимум 24 символа')
  .regex(/^[\p{L}\p{N}_.-]+$/u, 'Только буквы, цифры и символы _ . -');

export const emailSchema = z
  .email('Некорректный адрес почты')
  .max(254)
  .transform((v) => v.toLowerCase());

export const updateProfileSchema = z
  .object({
    nickname: nicknameSchema.optional(),
    avatarUrl: z
      .url({ protocol: /^https$/, error: 'Нужна ссылка https://' })
      .max(500)
      .nullable()
      .optional(),
    /** null — убрать почту */
    email: emailSchema.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'Нечего обновлять');
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;
export type UpdateProfileData = z.output<typeof updateProfileSchema>;

export const setBirthDateSchema = z.object({
  birthDate: z.string().refine(isValidIsoDate, 'Формат даты: ГГГГ-ММ-ДД'),
});
export type SetBirthDateInput = z.input<typeof setBirthDateSchema>;

export interface EligibilityDto {
  age: number | null;
  /** Есть дата рождения и ≥ 16 */
  canPlayFree: boolean;
  /** ≥ 18 */
  canPlayPaid: boolean;
  canUseWallet: boolean;
}

export interface LinkedAccountDto {
  provider: AuthProvider;
  externalId: string;
  displayName: string | null;
  profileUrl: string | null;
  verified: boolean;
}

export interface MeDto {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  email: string | null;
  /** false — пароль ещё не задан (вход через Steam), его можно установить без текущего */
  hasPassword: boolean;
  role: UserRole;
  birthDate: string | null;
  eligibility: EligibilityDto;
  linkedAccounts: LinkedAccountDto[];
  createdAt: string;
}

export interface PublicUserDto {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  linkedAccounts: Pick<LinkedAccountDto, 'provider' | 'displayName' | 'profileUrl'>[];
  teams: { id: string; name: string; tag: string | null; gameCode: string }[];
  createdAt: string;
}

export const adminUserListQuery = paginationQuery.extend({
  q: z.string().trim().max(24).optional(),
  role: UserRole.optional(),
});
export type AdminUserListQuery = z.input<typeof adminUserListQuery>;

export const setUserRoleSchema = z.object({ role: UserRole });
export type SetUserRoleInput = z.input<typeof setUserRoleSchema>;

export interface AdminUserDto {
  id: string;
  nickname: string;
  role: UserRole;
  bannedAt: string | null;
  /** Есть пароль — может входить по никнейму (у демо-игроков и dev-входов нет) */
  canLogin: boolean;
  createdAt: string;
}
