import { TIMEZONE } from './constants';

/** Календарная дата в Москве для момента `now` в формате YYYY-MM-DD. */
export function moscowDate(now: Date): string {
  // en-CA даёт ISO-подобный формат YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Полных лет на момент `now` (по московскому календарю). birthDate — YYYY-MM-DD. */
export function ageAt(birthDate: string, now: Date): number {
  const [by, bm, bd] = birthDate.split('-').map(Number) as [number, number, number];
  const [ny, nm, nd] = moscowDate(now).split('-').map(Number) as [number, number, number];
  let age = ny - by;
  if (nm < bm || (nm === bm && nd < bd)) age -= 1;
  return age;
}

export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}
