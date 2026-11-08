/** Postgres DATE (Prisma отдаёт как полночь UTC) ↔ строка YYYY-MM-DD. */
export function dateOnlyToString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function stringToDateOnly(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}
