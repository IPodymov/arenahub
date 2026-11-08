'use client';

import { type MeDto, PLATFORM_MIN_AGE } from '@arenahub/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { PageTitle } from '@/components/layout/page-title';
import { RequireAuth } from '@/components/layout/require-auth';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Hint, Input, Label } from '@/components/ui/input';
import { api, errorText } from '@/lib/api';
import { formatBirthDate } from '@/lib/format';
import { qk, useMyTeams } from '@/lib/queries';

function NicknameForm({ me }: { me: MeDto }) {
  const qc = useQueryClient();
  const [nickname, setNickname] = useState(me.nickname);
  const save = useMutation({
    mutationFn: () => api<MeDto>('/users/me', 'PATCH', { nickname }),
    onSuccess: (data) => qc.setQueryData(qk.me, data),
  });
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Label>
        Никнейм
        <div className="flex gap-2">
          <Input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            minLength={3}
            maxLength={24}
            required
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={save.isPending || nickname === me.nickname}
          >
            Сохранить
          </Button>
        </div>
      </Label>
      {save.error && <Alert tone="danger">{errorText(save.error)}</Alert>}
      {save.isSuccess && <Alert tone="success">Сохранено</Alert>}
    </form>
  );
}

function BirthDateForm({ me }: { me: MeDto }) {
  const qc = useQueryClient();
  const [birthDate, setBirthDate] = useState('');
  const save = useMutation({
    mutationFn: () => api<MeDto>('/users/me/birth-date', 'PUT', { birthDate }),
    onSuccess: (data) => qc.setQueryData(qk.me, data),
  });

  if (me.birthDate) {
    const e = me.eligibility;
    return (
      <div className="flex flex-col gap-2 text-sm">
        <p>
          Дата рождения: <span className="font-medium">{formatBirthDate(me.birthDate)}</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={e.canPlayFree ? 'success' : 'danger'}>Бесплатные турниры</Badge>
          <Badge variant={e.canPlayPaid ? 'success' : 'default'}>
            Платные турниры {e.canPlayPaid ? '' : '— с 18 лет'}
          </Badge>
          <Badge variant={e.canUseWallet ? 'success' : 'default'}>
            Кошелёк {e.canUseWallet ? '' : '— с 18 лет'}
          </Badge>
        </div>
        <Hint>Изменить дату можно только через поддержку.</Hint>
      </div>
    );
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <Label>
        Дата рождения
        <div className="flex gap-2">
          <Input
            type="date"
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
            required
          />
          <Button type="submit" disabled={save.isPending || !birthDate}>
            Сохранить
          </Button>
        </div>
        <Hint>
          Нужна для участия в турнирах. Платформа доступна с {PLATFORM_MIN_AGE} лет, платные турниры
          и кошелёк — с 18. Указывается один раз.
        </Hint>
      </Label>
      {save.error && <Alert tone="danger">{errorText(save.error)}</Alert>}
    </form>
  );
}

function Teams() {
  const { data: teams } = useMyTeams();
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Мои команды</CardTitle>
        <Button asChild size="sm" variant="secondary">
          <Link href="/teams/new">Создать</Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {teams?.length === 0 && (
          <p className="text-muted text-sm">Вы пока не состоите в командах</p>
        )}
        {teams?.map((t) => (
          <Link
            key={t.id}
            href={`/teams/${t.id}`}
            className="border-border hover:border-primary/50 flex items-center justify-between rounded-md border p-3 text-sm"
          >
            <span>
              {t.tag && <span className="text-muted">[{t.tag}] </span>}
              {t.name}
            </span>
            <span className="text-muted text-xs">
              {t.game.name} · {t.members.length}/{t.maxRosterSize}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      {(me) => (
        <>
          <PageTitle title="Профиль" subtitle={me.role === 'ADMIN' ? 'Администратор' : undefined} />
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Данные</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <NicknameForm me={me} />
                <BirthDateForm me={me} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Игровые аккаунты</CardTitle>
                <CardDescription>
                  Battle.net и тег Supercell появятся в следующих версиях
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {me.linkedAccounts.map((a) => (
                  <div
                    key={a.provider}
                    className="border-border flex items-center justify-between rounded-md border p-3 text-sm"
                  >
                    <span>
                      {a.provider === 'STEAM' ? 'Steam' : a.provider} ·{' '}
                      {a.displayName ?? a.externalId}
                    </span>
                    {a.verified ? (
                      <Badge variant="success">Подтверждён</Badge>
                    ) : (
                      <Badge>Не подтверждён</Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Teams />
          </div>
        </>
      )}
    </RequireAuth>
  );
}
