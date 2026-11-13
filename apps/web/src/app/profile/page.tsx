'use client';

import { type MeDto, PLATFORM_MIN_AGE, ROLE_LABELS } from '@arenahub/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { type FormEvent, type InputHTMLAttributes, useRef, useState } from 'react';
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

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** Аватар: файл уходит на сервер, там он обрезается до квадрата и сохраняется. */
function AvatarControl({ me }: { me: MeDto }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [tooBig, setTooBig] = useState(false);
  const onSuccess = (data: MeDto) => qc.setQueryData(qk.me, data);
  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api<MeDto>('/users/me/avatar', 'PUT', form);
    },
    onSuccess,
  });
  const remove = useMutation({
    mutationFn: () => api<MeDto>('/users/me/avatar', 'DELETE'),
    onSuccess,
  });
  const pending = upload.isPending || remove.isPending;
  const error = upload.error ?? remove.error;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {me.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- аватар из Steam живёт на внешнем домене
          <img
            src={me.avatarUrl}
            alt=""
            className="border-border size-14 rounded-full border object-cover"
          />
        ) : (
          <div className="bg-surface-2 text-muted flex size-14 items-center justify-center rounded-full text-xl font-semibold">
            {me.nickname.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate font-medium">{me.nickname}</p>
          <p className="text-muted truncate text-sm">{me.email ?? 'Почта не указана'}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            upload.reset();
            remove.reset();
            setTooBig(file.size > AVATAR_MAX_BYTES);
            if (file.size <= AVATAR_MAX_BYTES) upload.mutate(file);
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pending}
          onClick={() => input.current?.click()}
        >
          {upload.isPending ? 'Загрузка…' : me.avatarUrl ? 'Сменить аватар' : 'Загрузить аватар'}
        </Button>
        {me.avatarUrl && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => remove.mutate()}
          >
            Удалить
          </Button>
        )}
      </div>
      <Hint>JPEG, PNG, WebP или GIF до 5 МБ. Картинка будет обрезана до квадрата.</Hint>
      {tooBig && <Alert tone="danger">Файл больше 5 МБ</Alert>}
      {error && <Alert tone="danger">{errorText(error)}</Alert>}
    </div>
  );
}

/** Одно поле профиля с собственной кнопкой «Сохранить»; пустое значение — null, если можно очистить. */
function ProfileField({
  me,
  field,
  label,
  hint,
  type = 'text',
  clearable = false,
  inputProps,
}: {
  me: MeDto;
  field: 'nickname' | 'email';
  label: string;
  hint?: string;
  type?: string;
  clearable?: boolean;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
}) {
  const qc = useQueryClient();
  const initial = me[field] ?? '';
  const [value, setValue] = useState(initial);
  const save = useMutation({
    mutationFn: () =>
      api<MeDto>('/users/me', 'PATCH', { [field]: clearable && !value.trim() ? null : value }),
    onSuccess: (data) => {
      qc.setQueryData(qk.me, data);
      setValue(data[field] ?? '');
    },
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
        {label}
        <div className="flex gap-2">
          <Input
            type={type}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              save.reset();
            }}
            required={!clearable}
            {...inputProps}
          />
          <Button
            type="submit"
            variant="secondary"
            disabled={save.isPending || value.trim() === initial}
          >
            Сохранить
          </Button>
        </div>
        {hint && <Hint>{hint}</Hint>}
      </Label>
      {save.error && <Alert tone="danger">{errorText(save.error)}</Alert>}
      {save.isSuccess && <Alert tone="success">Сохранено</Alert>}
    </form>
  );
}

function PasswordForm({ me }: { me: MeDto }) {
  const qc = useQueryClient();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [mismatch, setMismatch] = useState(false);
  const save = useMutation({
    mutationFn: () =>
      api('/users/me/password', 'PUT', {
        currentPassword: me.hasPassword ? current : undefined,
        newPassword: next,
      }),
    onSuccess: async () => {
      setCurrent('');
      setNext('');
      setRepeat('');
      await qc.invalidateQueries({ queryKey: qk.me });
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setMismatch(next !== repeat);
    if (next === repeat) save.mutate();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {me.hasPassword ? (
        <Label>
          Текущий пароль
          <Input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
            maxLength={128}
          />
        </Label>
      ) : (
        <Hint>
          Пароль ещё не задан — сейчас вы входите через внешний аккаунт. Задайте пароль, чтобы
          входить по никнейму или почте.
        </Hint>
      )}
      <Label>
        Новый пароль
        <Input
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={128}
        />
      </Label>
      <Label>
        Повторите новый пароль
        <Input
          type="password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
          autoComplete="new-password"
          required
          maxLength={128}
        />
      </Label>
      {mismatch && <Alert tone="danger">Пароли не совпадают</Alert>}
      {save.error && <Alert tone="danger">{errorText(save.error)}</Alert>}
      {save.isSuccess && (
        <Alert tone="success">Пароль сохранён. На других устройствах нужно войти заново.</Alert>
      )}
      <Button type="submit" disabled={save.isPending}>
        {me.hasPassword ? 'Сменить пароль' : 'Задать пароль'}
      </Button>
    </form>
  );
}

function SessionsControl() {
  const revoke = useMutation({ mutationFn: () => api('/users/me/sessions/revoke', 'POST') });
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted text-sm">
        Если вы входили с чужого устройства, завершите там сессию — здесь вы останетесь в аккаунте.
      </p>
      <Button
        variant="secondary"
        disabled={revoke.isPending}
        onClick={() => revoke.mutate()}
        className="self-start"
      >
        Выйти на других устройствах
      </Button>
      {revoke.error && <Alert tone="danger">{errorText(revoke.error)}</Alert>}
      {revoke.isSuccess && <Alert tone="success">Остальные сессии завершены</Alert>}
    </div>
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
          <PageTitle
            title="Профиль"
            subtitle={me.role === 'USER' ? undefined : ROLE_LABELS[me.role]}
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Данные</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-5">
                <AvatarControl me={me} />
                <ProfileField
                  me={me}
                  field="nickname"
                  label="Никнейм"
                  inputProps={{ minLength: 3, maxLength: 24, autoComplete: 'username' }}
                />
                <ProfileField
                  me={me}
                  field="email"
                  label="Почта"
                  type="email"
                  clearable
                  hint="По почте тоже можно входить. Оставьте пустым, чтобы отвязать."
                  inputProps={{ maxLength: 254, autoComplete: 'email' }}
                />
                <BirthDateForm me={me} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Безопасность</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <PasswordForm me={me} />
                <div className="border-border border-t pt-5">
                  <SessionsControl />
                </div>
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
