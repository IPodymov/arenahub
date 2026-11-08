import { z } from 'zod';
import { CURRENCY, LOCALE } from './constants';

/**
 * Суммы в копейках. В JSON передаются строкой (bigint не сериализуется),
 * на входе допускается и целое число.
 */
export const kopecksSchema = z
  .union([
    z.string().regex(/^\d+$/, 'Сумма в копейках — целое неотрицательное число'),
    z.number().int().nonnegative(),
  ])
  .transform((v) => BigInt(v));

export function formatRub(kopecks: string | bigint): string {
  const k = typeof kopecks === 'bigint' ? kopecks : BigInt(kopecks);
  const rubles = k / 100n;
  const rest = k % 100n;
  const formatted = new Intl.NumberFormat(LOCALE, {
    style: 'currency',
    currency: CURRENCY,
    maximumFractionDigits: rest === 0n ? 0 : 2,
    minimumFractionDigits: rest === 0n ? 0 : 2,
  });
  // Number безопасен для отображения сумм до ~90 трлн ₽
  return formatted.format(Number(rubles) + Number(rest) / 100);
}

/** Рубли из формы (целые) → копейки строкой. */
export function rublesToKopecks(rubles: number): string {
  return (BigInt(Math.trunc(rubles)) * 100n).toString();
}
