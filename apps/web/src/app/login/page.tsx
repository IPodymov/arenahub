'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { type FormEvent, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { api, errorText } from '@/lib/api';
import { qk, useAuthProviders } from '@/lib/queries';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const { data: providers } = useAuthProviders();
  const router = useRouter();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>('login');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [asAdmin, setAsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devError, setDevError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setPasswordRepeat('');
  }

  async function signIn(path: string, body: unknown, onError: (text: string) => void) {
    setPending(true);
    try {
      await api(path, 'POST', body);
      await qc.invalidateQueries({ queryKey: qk.me });
      router.push('/profile');
    } catch (err) {
      onError(errorText(err));
    } finally {
      setPending(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (mode === 'register' && password !== passwordRepeat) {
      setError('Пароли не совпадают');
      return;
    }
    await signIn(`/auth/${mode}`, { nickname, password }, setError);
  }

  async function devLogin(e: FormEvent) {
    e.preventDefault();
    setDevError(null);
    await signIn('/auth/dev-login', { nickname, asAdmin }, setDevError);
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 pt-6">
      <Card>
        <CardHeader>
          <CardTitle>{mode === 'login' ? 'Вход' : 'Регистрация'}</CardTitle>
          <CardDescription>Платформа доступна с 16 лет.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <form onSubmit={submit} className="flex flex-col gap-3">
            <Label>
              {mode === 'login' ? 'Никнейм или почта' : 'Никнейм'}
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                autoComplete="username"
                required
                minLength={mode === 'register' ? 3 : 1}
                maxLength={mode === 'register' ? 24 : 254}
              />
            </Label>
            <Label>
              Пароль
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                required
                minLength={mode === 'register' ? 8 : 1}
                maxLength={128}
              />
            </Label>
            {mode === 'register' && (
              <Label>
                Повторите пароль
                <Input
                  type="password"
                  value={passwordRepeat}
                  onChange={(e) => setPasswordRepeat(e.target.value)}
                  autoComplete="new-password"
                  required
                  maxLength={128}
                />
              </Label>
            )}
            {error && <Alert tone="danger">{error}</Alert>}
            <Button type="submit" size="lg" disabled={pending}>
              {mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </Button>
          </form>

          <p className="text-muted text-center text-sm">
            {mode === 'login' ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}{' '}
            <Button
              type="button"
              variant="link"
              className="h-auto"
              onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
            </Button>
          </p>

          {providers?.steam ? (
            <Button asChild variant="secondary">
              {/* Полная навигация: редирект на Steam OpenID */}
              <a href="/api/v1/auth/steam">Войти через Steam</a>
            </Button>
          ) : (
            <p className="text-muted text-xs">
              Вход через Steam, Battle.net и Supercell ID появится позже.
            </p>
          )}
        </CardContent>
      </Card>

      {providers?.devLogin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Dev-вход</CardTitle>
            <CardDescription>
              Только для локальной разработки, в production выключен.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={devLogin} className="flex flex-col gap-3">
              <Label>
                Никнейм
                <Input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  required
                  minLength={3}
                  maxLength={24}
                />
              </Label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={asAdmin}
                  onChange={(e) => setAsAdmin(e.target.checked)}
                />
                Войти как администратор
              </label>
              {devError && <Alert tone="danger">{devError}</Alert>}
              <Button type="submit" variant="secondary" disabled={pending}>
                Войти
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
