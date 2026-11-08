import { describe, expect, it } from 'vitest';
import { ageAt, isValidIsoDate, moscowDate } from './age';

describe('ageAt', () => {
  it('считает полные годы', () => {
    expect(ageAt('2008-05-10', new Date('2026-05-09T12:00:00Z'))).toBe(17);
    expect(ageAt('2008-05-10', new Date('2026-05-10T12:00:00Z'))).toBe(18);
  });

  it('использует московский календарь', () => {
    // 2026-05-09 21:30 UTC = 2026-05-10 00:30 МСК — уже день рождения
    expect(moscowDate(new Date('2026-05-09T21:30:00Z'))).toBe('2026-05-10');
    expect(ageAt('2008-05-10', new Date('2026-05-09T21:30:00Z'))).toBe(18);
  });
});

describe('isValidIsoDate', () => {
  it('отклоняет несуществующие даты', () => {
    expect(isValidIsoDate('2008-02-30')).toBe(false);
    expect(isValidIsoDate('2008-02-29')).toBe(true);
    expect(isValidIsoDate('10.05.2008')).toBe(false);
  });
});
