import { z } from 'zod';
import { nicknameSchema } from './users';

export const devLoginSchema = z.object({
  nickname: nicknameSchema,
  asAdmin: z.boolean().default(false),
});
export type DevLoginInput = z.input<typeof devLoginSchema>;
