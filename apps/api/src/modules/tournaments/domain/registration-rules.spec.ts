import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../common/domain-error';
import { checkRegistration, type RegistrationContext } from './registration-rules';
import { NOW, player, POLICIES, soloContext, teamContext, terms } from './fixtures';

function codeOf(ctx: RegistrationContext): string | null {
  try {
    checkRegistration(ctx);
    return null;
  } catch (err) {
    if (err instanceof DomainError) return err.code;
    throw err;
  }
}

const paidDota = {
  ...terms({ entryFeeKopecks: 50_000n, prizePoolKopecks: 100_000n, prizeSource: 'ENTRY_FEES' }),
  gameId: 'dota',
};

describe('checkRegistration — окно регистрации', () => {
  it('бесплатная соло-заявка взрослого подтверждается сразу', () => {
    expect(checkRegistration(soloContext())).toBe('CONFIRMED');
  });

  it.each([
    ['ещё не открыта', { registrationOpensAt: new Date(NOW.getTime() + 1000) }],
    ['уже закрыта', { registrationClosesAt: new Date(NOW.getTime() - 1000) }],
    ['черновик', { status: 'DRAFT' as const }],
    ['отменён', { status: 'CANCELLED' as const }],
  ])('отклоняется, если регистрация %s', (_, override) => {
    const ctx = soloContext({ tournament: { ...terms(override), gameId: 'dota' } });
    expect(codeOf(ctx)).toBe('REGISTRATION_NOT_OPEN');
  });
});

describe('checkRegistration — политика игры', () => {
  it('платный вход в Brawl Stars невозможен, даже если турнир оказался в БД', () => {
    const ctx = soloContext({
      policy: POLICIES.BRAWL_STARS,
      tournament: { ...terms({ entryFeeKopecks: 10_000n }), gameId: 'bs' },
    });
    expect(codeOf(ctx)).toBe('PAID_ENTRY_FORBIDDEN_BY_GAME');
  });

  it('приз из взносов в Brawl Stars невозможен', () => {
    const ctx = soloContext({
      policy: POLICIES.BRAWL_STARS,
      tournament: { ...terms({ prizeSource: 'ENTRY_FEES', prizePoolKopecks: 1n }), gameId: 'bs' },
    });
    expect(codeOf(ctx)).toBe('PAID_ENTRY_FORBIDDEN_BY_GAME');
  });

  it('спонсорский приз в Brawl Stars допустим', () => {
    const ctx = soloContext({
      policy: POLICIES.BRAWL_STARS,
      tournament: {
        ...terms({ prizeSource: 'SPONSOR', prizePoolKopecks: 300_000n }),
        gameId: 'bs',
      },
    });
    expect(checkRegistration(ctx)).toBe('CONFIRMED');
  });

  it('формат, запрещённый политикой, отклоняется', () => {
    const ctx = teamContext({ policy: { ...POLICIES.DOTA2, allowedTeamSizes: [1] } });
    expect(codeOf(ctx)).toBe('TEAM_SIZE_FORBIDDEN_BY_GAME');
  });

  it('требуется привязанный аккаунт из политики', () => {
    const actor = player('u1', 20, { linkedProviders: [] });
    expect(codeOf(soloContext({ actor, players: [actor] }))).toBe('LINKED_ACCOUNT_REQUIRED');
  });
});

describe('checkRegistration — возраст', () => {
  it('без даты рождения регистрироваться нельзя', () => {
    const actor = player('u1', null);
    expect(codeOf(soloContext({ actor, players: [actor] }))).toBe('BIRTH_DATE_REQUIRED');
  });

  it('16–17 лет — бесплатный турнир доступен', () => {
    for (const age of [16, 17]) {
      const actor = player('u1', age);
      expect(checkRegistration(soloContext({ actor, players: [actor] }))).toBe('CONFIRMED');
    }
  });

  it('16–17 лет — платный турнир недоступен', () => {
    for (const age of [16, 17]) {
      const actor = player('u1', age);
      expect(codeOf(soloContext({ actor, players: [actor], tournament: paidDota }))).toBe(
        'PAID_TOURNAMENT_ADULTS_ONLY',
      );
    }
  });

  it('18 лет — платная заявка создаётся в статусе «ожидает оплаты»', () => {
    const actor = player('u1', 18);
    expect(checkRegistration(soloContext({ actor, players: [actor], tournament: paidDota }))).toBe(
      'PENDING_PAYMENT',
    );
  });

  it('18 исполняется ровно сегодня по Москве', () => {
    // NOW = 2026-06-01 15:00 МСК
    const actor = player('u1', null, { birthDate: '2008-06-01' });
    expect(checkRegistration(soloContext({ actor, players: [actor], tournament: paidDota }))).toBe(
      'PENDING_PAYMENT',
    );
    const tomorrow = player('u1', null, { birthDate: '2008-06-02' });
    expect(
      codeOf(soloContext({ actor: tomorrow, players: [tomorrow], tournament: paidDota })),
    ).toBe('PAID_TOURNAMENT_ADULTS_ONLY');
  });

  it('младше 16 — отказ (на случай даты, введённой админом)', () => {
    const actor = player('u1', 15);
    expect(codeOf(soloContext({ actor, players: [actor] }))).toBe('AGE_BELOW_PLATFORM_MINIMUM');
  });

  it('турнир может ужесточить минимальный возраст', () => {
    const actor = player('u1', 17);
    const ctx = soloContext({
      actor,
      players: [actor],
      tournament: { ...terms({ minAge: 18 }), gameId: 'dota' },
    });
    expect(codeOf(ctx)).toBe('AGE_BELOW_TOURNAMENT_MINIMUM');
  });

  it('в платном командном турнире несовершеннолетний игрок состава блокирует заявку', () => {
    const base = teamContext();
    const players = base.players.map((p) => (p.id === 'p3' ? player('p3', 17) : p));
    const ctx = teamContext({
      players,
      tournament: { ...paidDota, participantType: 'TEAM', teamSize: 5, maxSubstitutes: 2 },
    });
    expect(codeOf(ctx)).toBe('PAID_TOURNAMENT_ADULTS_ONLY');
  });

  it('в платном турнире капитан-организатор тоже должен быть 18+', () => {
    const captain = player('c1', 17);
    const base = teamContext();
    const ctx = teamContext({
      actor: captain,
      players: [captain, ...base.players.slice(1)],
      tournament: { ...paidDota, participantType: 'TEAM', teamSize: 5, maxSubstitutes: 2 },
    });
    expect(codeOf(ctx)).toBe('PAID_TOURNAMENT_ADULTS_ONLY');
  });
});

describe('checkRegistration — слоты', () => {
  it('последний свободный слот можно занять', () => {
    expect(checkRegistration(soloContext({ takenSlots: 15 }))).toBe('CONFIRMED');
  });

  it('при заполненных слотах — отказ', () => {
    expect(codeOf(soloContext({ takenSlots: 16 }))).toBe('TOURNAMENT_FULL');
  });

  it('повторная заявка того же игрока — отказ', () => {
    expect(codeOf(soloContext({ alreadyRegisteredUserIds: ['u1'] }))).toBe('ALREADY_REGISTERED');
  });
});

describe('checkRegistration — команда и размер состава', () => {
  it('полный состав 5x5 проходит', () => {
    expect(checkRegistration(teamContext())).toBe('CONFIRMED');
  });

  it('состав меньше формата — отказ', () => {
    const base = teamContext();
    const ctx = teamContext({
      playerIds: base.playerIds.slice(0, 4),
      players: base.players.slice(0, 4),
    });
    expect(codeOf(ctx)).toBe('LINEUP_SIZE_MISMATCH');
  });

  it('состав больше формата — отказ', () => {
    const base = teamContext();
    const extra = player('s6', 20);
    const ctx = teamContext({
      playerIds: [...base.playerIds, 's6'],
      players: [...base.players, extra],
    });
    expect(codeOf(ctx)).toBe('LINEUP_SIZE_MISMATCH');
  });

  it('запасные сверх лимита — отказ', () => {
    const subs = ['s6', 's7', 's8'].map((id) => player(id, 20));
    const ctx = teamContext({ substituteIds: subs.map((s) => s.id), substitutes: subs });
    expect(codeOf(ctx)).toBe('SUBSTITUTES_ABOVE_LIMIT');
  });

  it('игрок не из команды — отказ', () => {
    const base = teamContext();
    const ctx = teamContext({ playerIds: [...base.playerIds.slice(0, 4), 'stranger'] });
    expect(codeOf(ctx)).toBe('LINEUP_PLAYER_NOT_IN_TEAM');
  });

  it('один игрок дважды — отказ', () => {
    const base = teamContext();
    const ctx = teamContext({ playerIds: [...base.playerIds.slice(0, 4), 'c1'] });
    expect(codeOf(ctx)).toBe('LINEUP_DUPLICATE_PLAYER');
  });

  it('регистрирует только капитан', () => {
    const ctx = teamContext({ actor: player('p2', 20) });
    expect(codeOf(ctx)).toBe('NOT_TEAM_CAPTAIN');
  });

  it('команда другой игры — отказ', () => {
    const base = teamContext();
    expect(codeOf(teamContext({ team: { ...base.team!, gameId: 'cs2' } }))).toBe(
      'TEAM_GAME_MISMATCH',
    );
  });

  it('распущенная команда — отказ', () => {
    const base = teamContext();
    expect(codeOf(teamContext({ team: { ...base.team!, disbanded: true } }))).toBe(
      'TEAM_DISBANDED',
    );
  });

  it('командный турнир без команды — отказ', () => {
    expect(codeOf(teamContext({ team: null }))).toBe('TEAM_REQUIRED');
  });

  it('соло-турнир с командой — отказ', () => {
    expect(codeOf(soloContext({ team: teamContext().team }))).toBe('WRONG_PARTICIPANT_TYPE');
  });

  it('команда уже заявлена — отказ', () => {
    expect(codeOf(teamContext({ teamAlreadyRegistered: true }))).toBe('ALREADY_REGISTERED');
  });
});
