import { describe, expect, it } from 'vitest';
import { formatRub, kopecksSchema } from './money';

describe('money', () => {
  it('парсит копейки в bigint', () => {
    expect(kopecksSchema.parse('150000')).toBe(150000n);
    expect(kopecksSchema.parse(0)).toBe(0n);
    expect(kopecksSchema.safeParse('1.5').success).toBe(false);
    expect(kopecksSchema.safeParse(-1).success).toBe(false);
  });

  it('форматирует рубли', () => {
    expect(formatRub('150000').replace(/\s/g, ' ')).toBe('1 500 ₽');
  });
});
