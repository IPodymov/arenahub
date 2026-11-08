'use client';

import {
  ADULT_AGE,
  type MeDto,
  REGISTRATION_STATUS_LABELS,
  type TeamDto,
  type TournamentDto,
} from '@arenahub/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Hint, Label, Select } from '@/components/ui/input';
import { api, errorText } from '@/lib/api';
import { qk, useMyRegistration, useMyTeams } from '@/lib/queries';

/**
 * Предварительная проверка для UX. Окончательное решение принимает API —
 * здесь только подсказка, почему кнопка недоступна.
 */
function blockingReason(t: TournamentDto, me: MeDto): string | null {
  if (t.phase !== 'REGISTRATION') return 'Регистрация сейчас закрыта';
  if (t.takenSlots >= t.maxSlots) return 'Все слоты заняты';
  if (!me.birthDate) return 'Укажите дату рождения в профиле';
  const age = me.eligibility.age ?? 0;
  if (age < t.minAge) return `Турнир доступен с ${t.minAge} лет`;
  if (t.entryFeeKopecks !== '0' && age < ADULT_AGE) return 'Платные турниры доступны с 18 лет';
  return null;
}

export function RegisterPanel({ t, me }: { t: TournamentDto; me: MeDto | null | undefined }) {
  const qc = useQueryClient();
  const mine = useMyRegistration(t.slug, !!me);
  const teams = useMyTeams(!!me && t.participantType === 'TEAM');
  const [teamId, setTeamId] = useState('');

  const eligibleTeams: TeamDto[] =
    teams.data?.filter((team) => team.captainId === me?.id && team.game.code === t.game.code) ?? [];
  const selectedTeam = eligibleTeams.find((x) => x.id === teamId) ?? eligibleTeams[0];

  const invalidate = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.tournament(t.slug) }),
      qc.invalidateQueries({ queryKey: qk.participants(t.slug) }),
      qc.invalidateQueries({ queryKey: qk.myRegistration(t.slug) }),
    ]);

  const register = useMutation({
    mutationFn: () =>
      api(
        `/tournaments/${t.slug}/registrations`,
        'POST',
        t.participantType === 'TEAM' ? { teamId: selectedTeam?.id } : {},
      ),
    onSuccess: invalidate,
  });
  const withdraw = useMutation({
    mutationFn: () => api(`/tournaments/${t.slug}/registrations/mine`, 'DELETE'),
    onSuccess: invalidate,
  });

  if (me === undefined) return null;
  if (me === null) {
    return (
      <Button asChild className="w-full">
        <Link href="/login">Войдите, чтобы участвовать</Link>
      </Button>
    );
  }

  if (mine.data) {
    // Командную заявку отзывает капитан
    const canWithdraw = !mine.data.teamId || eligibleTeams.some((x) => x.id === mine.data?.teamId);
    return (
      <div className="flex flex-col gap-2">
        <Alert tone={mine.data.status === 'CONFIRMED' ? 'success' : 'warning'}>
          Вы зарегистрированы · {REGISTRATION_STATUS_LABELS[mine.data.status]}
          {mine.data.status === 'PENDING_PAYMENT' && '. Оплата взноса появится вместе с кошельком.'}
        </Alert>
        {canWithdraw && (t.phase === 'REGISTRATION' || t.phase === 'REGISTRATION_CLOSED') && (
          <Button
            variant="secondary"
            disabled={withdraw.isPending}
            onClick={() => withdraw.mutate()}
          >
            Отозвать заявку
          </Button>
        )}
        {withdraw.error && <Alert tone="danger">{errorText(withdraw.error)}</Alert>}
      </div>
    );
  }

  const reason = blockingReason(t, me);
  const needsTeam = t.participantType === 'TEAM';

  return (
    <div className="flex flex-col gap-3">
      {needsTeam &&
        !reason &&
        (eligibleTeams.length ? (
          <Label>
            Команда
            <Select value={selectedTeam?.id ?? ''} onChange={(e) => setTeamId(e.target.value)}>
              {eligibleTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name} · {team.members.filter((m) => m.role === 'PLAYER').length} осн.
                </option>
              ))}
            </Select>
            <Hint>
              В заявку попадут игроки основного состава ({t.teamSize}) и запасные (до{' '}
              {t.maxSubstitutes}). Роли меняются на странице команды.
            </Hint>
          </Label>
        ) : (
          <Alert>
            Нужна команда по {t.game.name}, где вы капитан.{' '}
            <Link href={`/teams/new?game=${t.game.code}`} className="text-primary underline">
              Создать команду
            </Link>
          </Alert>
        ))}

      {reason && <Alert tone="warning">{reason}</Alert>}
      {register.error && <Alert tone="danger">{errorText(register.error)}</Alert>}

      <Button
        size="lg"
        disabled={!!reason || register.isPending || (needsTeam && !selectedTeam)}
        onClick={() => register.mutate()}
      >
        {needsTeam ? 'Зарегистрировать команду' : 'Зарегистрироваться'}
      </Button>
    </div>
  );
}
