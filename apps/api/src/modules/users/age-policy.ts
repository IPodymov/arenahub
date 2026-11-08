import { ADULT_AGE, ageAt, type EligibilityDto, PLATFORM_MIN_AGE } from '@arenahub/shared';

/** Возрастные права пользователя на момент `now`. */
export function computeEligibility(birthDate: string | null, now: Date): EligibilityDto {
  if (!birthDate) return { age: null, canPlayFree: false, canPlayPaid: false, canUseWallet: false };
  const age = ageAt(birthDate, now);
  const adult = age >= ADULT_AGE;
  return { age, canPlayFree: age >= PLATFORM_MIN_AGE, canPlayPaid: adult, canUseWallet: adult };
}
