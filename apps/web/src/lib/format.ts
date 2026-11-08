import { formatRub, LOCALE, TIMEZONE } from '@arenahub/shared';

const dateTime = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIMEZONE,
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});
const dateOnly = new Intl.DateTimeFormat(LOCALE, {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** «12 ноября, 19:00 МСК» */
export function formatDateTime(iso: string): string {
  return `${dateTime.format(new Date(iso))} МСК`;
}

/** Дата рождения YYYY-MM-DD → «15 марта 2000 г.» */
export function formatBirthDate(isoDate: string): string {
  return dateOnly.format(new Date(`${isoDate}T00:00:00Z`));
}

export function formatEntryFee(kopecks: string): string {
  return kopecks === '0' ? 'Бесплатно' : formatRub(kopecks);
}

export function formatPrize(kopecks: string): string {
  return kopecks === '0' ? '—' : formatRub(kopecks);
}

// Москва живёт в UTC+3 без перехода на летнее время с 2014 года.
const MSK_OFFSET = '+03:00';

/** Значение <input type="datetime-local"> в московском времени → ISO. */
export function moscowLocalToIso(local: string): string {
  return new Date(`${local}:00${MSK_OFFSET}`).toISOString();
}

/** ISO → значение для <input type="datetime-local"> в московском времени. */
export function isoToMoscowLocal(iso: string): string {
  const shifted = new Date(new Date(iso).getTime() + 3 * 3600_000);
  return shifted.toISOString().slice(0, 16);
}
