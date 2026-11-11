import { z } from 'zod';
import { nicknameSchema } from './users';

export const devLoginSchema = z.object({
  nickname: nicknameSchema,
  asAdmin: z.boolean().default(false),
});
export type DevLoginInput = z.input<typeof devLoginSchema>;

export const passwordSchema = z
  .string()
  .min(8, 'Минимум 8 символов')
  .max(128, 'Максимум 128 символов');

export const registerSchema = z.object({
  nickname: nicknameSchema,
  password: passwordSchema,
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  nickname: z.string().trim().min(1, 'Укажите никнейм'),
  password: z.string().min(1, 'Укажите пароль').max(128),
});
export type LoginInput = z.input<typeof loginSchema>;

export interface AuthProvidersDto {
  steam: boolean;
  password: boolean;
  devLogin: boolean;
}
