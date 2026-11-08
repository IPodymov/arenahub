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

export default function LoginPage() {
  const { data: providers } = useAuthProviders();
  const router = useRouter();
  const qc = useQueryClient();
  const [nickname, setNickname] = useState('');
  const [asAdmin, setAsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function devLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/auth/dev-login', 'POST', { nickname, asAdmin });
      await qc.invalidateQueries({ queryKey: qk.me });
      router.push('/profile');
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4 pt-6">
      <Card>
        <CardHeader>
          <CardTitle>Вход</CardTitle>
          <CardDescription>Платформа доступна с 16 лет.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {providers?.steam ? (
            <Button asChild size="lg">
              {/* Полная навигация: редирект на Steam OpenID */}
              <a href="/api/v1/auth/steam">Войти через Steam</a>
            </Button>
          ) : (
            <Alert>Вход через Steam не настроен: укажите STEAM_API_KEY в .env.</Alert>
          )}
          <p className="text-muted text-xs">Battle.net и Supercell ID появятся позже.</p>
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
              {error && <Alert tone="danger">{error}</Alert>}
              <Button type="submit" variant="secondary">
                Войти
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
