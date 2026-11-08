'use client';

import { GAME_LABELS, type GameCode, type PublicUserDto } from '@arenahub/shared';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { PageTitle } from '@/components/layout/page-title';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, errorText } from '@/lib/api';

export default function UserPage() {
  const { id } = useParams<{ id: string }>();
  const {
    data: user,
    error,
    isPending,
  } = useQuery({
    queryKey: ['user', id],
    queryFn: () => api<PublicUserDto>(`/users/${id}`),
  });

  if (isPending) return <Skeleton className="h-48 w-full" />;
  if (error || !user) return <Alert tone="danger">{errorText(error)}</Alert>;

  return (
    <>
      <PageTitle title={user.nickname} />
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Команды</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {user.teams.length === 0 && <p className="text-muted text-sm">Нет команд</p>}
          {user.teams.map((t) => (
            <Link
              key={t.id}
              href={`/teams/${t.id}`}
              className="border-border hover:border-primary/50 flex justify-between rounded-md border p-3 text-sm"
            >
              <span>{t.name}</span>
              <span className="text-muted text-xs">{GAME_LABELS[t.gameCode as GameCode]}</span>
            </Link>
          ))}
        </CardContent>
      </Card>
    </>
  );
}
