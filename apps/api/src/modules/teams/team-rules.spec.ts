import { describe, expect, it } from 'vitest';
import { assertCanJoin, assertCanRemove, maxRosterSize } from './team-rules';

const team = { captainId: 'c', disbanded: false, memberIds: ['c', 'a', 'b'] };

describe('team-rules', () => {
  it('ростер = максимальный формат + запасные', () => {
    expect(maxRosterSize({ allowedTeamSizes: [1, 5], maxSubstitutes: 2 })).toBe(7);
    expect(maxRosterSize({ allowedTeamSizes: [1, 3], maxSubstitutes: 1 })).toBe(4);
  });

  it('вступление: дубли и переполнение', () => {
    expect(() => assertCanJoin(team, 'a', 7)).toThrow(
      expect.objectContaining({ code: 'ALREADY_TEAM_MEMBER' }),
    );
    expect(() => assertCanJoin(team, 'x', 3)).toThrow(
      expect.objectContaining({ code: 'TEAM_FULL' }),
    );
    expect(() => assertCanJoin({ ...team, disbanded: true }, 'x', 7)).toThrow(
      expect.objectContaining({ code: 'TEAM_DISBANDED' }),
    );
    expect(() => assertCanJoin(team, 'x', 7)).not.toThrow();
  });

  it('капитан не выходит, пока есть другие игроки', () => {
    expect(() => assertCanRemove(team, 'c', false)).toThrow(
      expect.objectContaining({ code: 'CAPTAIN_MUST_TRANSFER' }),
    );
  });

  it('последний игрок выходит — команда распускается', () => {
    expect(assertCanRemove({ ...team, memberIds: ['c'] }, 'c', false)).toEqual({ disband: true });
    expect(assertCanRemove(team, 'a', false)).toEqual({ disband: false });
  });

  it('заявленного в активном турнире убрать нельзя', () => {
    expect(() => assertCanRemove(team, 'a', true)).toThrow(
      expect.objectContaining({ code: 'MEMBER_LOCKED_IN_TOURNAMENT' }),
    );
  });
});
