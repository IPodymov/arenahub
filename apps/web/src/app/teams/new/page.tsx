'use client';

import { GameCode, type TeamDto } from '@arenahub/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { type FormEvent, Suspense, useState } from 'react';
import { PageTitle } from '@/components/layout/page-title';
import { RequireAuth } from '@/components/layout/require-auth';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Hint, Input, Label, Select } from '@/components/ui/input';
import { api, errorText } from '@/lib/api';
import { qk, useGames } from '@/lib/queries';

function NewTeamForm() {
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: games } = useGames();
  const teamGames = games?.filter((g) => g.policy.allowedTeamSizes.some((s) => s >= 2));

  const [gameCode, setGameCode] = useState<string>(
    GameCode.catch('DOTA2').parse(params.get('game') ?? undefined),
  );
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');

  const create = useMutation({
    mutationFn: () => api<TeamDto>('/teams', 'POST', { gameCode, name, tag: tag || undefined }),
    onSuccess: async (team) => {
      await qc.invalidateQueries({ queryKey: qk.myTeams });
      router.push(`/teams/${team.id}`);
    },
  });

  return (
    <Card className="max-w-lg">
      <CardContent className="pt-4 sm:pt-5">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <Label>
            Игра
            <Select value={gameCode} onChange={(e) => setGameCode(e.target.value)}>
              {teamGames?.map((g) => (
                <option key={g.code} value={g.code}>
                  {g.name}
                </option>
              ))}
            </Select>
          </Label>
          <Label>
            Название
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              maxLength={32}
            />
          </Label>
          <Label>
            Тег <Hint>2–5 букв или цифр, необязательно</Hint>
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              minLength={2}
              maxLength={5}
            />
          </Label>
          {create.error && <Alert tone="danger">{errorText(create.error)}</Alert>}
          <Button type="submit" disabled={create.isPending}>
            Создать команду
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function NewTeamPage() {
  return (
    <RequireAuth>
      {() => (
        <>
          <PageTitle
            title="Новая команда"
            subtitle="Вы станете капитаном и сможете пригласить игроков по ссылке"
          />
          <Suspense>
            <NewTeamForm />
          </Suspense>
        </>
      )}
    </RequireAuth>
  );
}
