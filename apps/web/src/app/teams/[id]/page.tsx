'use client';

import type { TeamDto, TeamInviteDto } from '@arenahub/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Copy, Crown } from 'lucide-react';
import Link from 'next/link';
import { notFound, useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { PageTitle } from '@/components/layout/page-title';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError, errorText } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { qk, useMe, useTeam } from '@/lib/queries';

function InviteBlock({ team }: { team: TeamDto }) {
  const [invite, setInvite] = useState<TeamInviteDto | null>(null);
  const [copied, setCopied] = useState(false);
  const create = useMutation({
    mutationFn: () => api<TeamInviteDto>(`/teams/${team.id}/invites`, 'POST', { maxUses: 5 }),
    onSuccess: setInvite,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Пригласить игроков</CardTitle>
        <CardDescription>Ссылка действует 72 часа и до 5 вступлений</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {invite ? (
          <>
            <div className="flex gap-2">
              <Input
                readOnly
                value={invite.url}
                onFocus={(e) => e.target.select()}
                aria-label="Ссылка-приглашение"
              />
              <Button
                variant="secondary"
                aria-label="Скопировать"
                onClick={async () => {
                  await navigator.clipboard.writeText(invite.url);
                  setCopied(true);
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <p className="text-muted text-xs">
              {copied ? 'Скопировано. ' : ''}Действует до {formatDateTime(invite.expiresAt)}
            </p>
          </>
        ) : (
          <Button variant="secondary" disabled={create.isPending} onClick={() => create.mutate()}>
            Создать ссылку
          </Button>
        )}
        {create.error && <Alert tone="danger">{errorText(create.error)}</Alert>}
      </CardContent>
    </Card>
  );
}

export default function TeamPage() {
  const { id } = useParams<{ id: string }>();
  const { data: team, error, isPending } = useTeam(id);
  const { data: me } = useMe();
  const qc = useQueryClient();
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);

  const action = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onMutate: () => setActionError(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.team(id) }),
    onError: (err) => setActionError(errorText(err)),
  });

  if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
  if (isPending || !team) return <Skeleton className="h-64 w-full" />;

  const isCaptain = me?.id === team.captainId;
  const isMember = team.members.some((m) => m.userId === me?.id);

  return (
    <>
      <PageTitle
        title={team.tag ? `[${team.tag}] ${team.name}` : team.name}
        subtitle={`${team.game.name} · ${team.members.length} из ${team.maxRosterSize} игроков`}
        actions={
          isMember &&
          !team.disbanded && (
            <Button
              variant="danger"
              size="sm"
              disabled={action.isPending}
              onClick={() =>
                action.mutate(async () => {
                  await api(`/teams/${team.id}/leave`, 'POST');
                  await qc.invalidateQueries({ queryKey: qk.myTeams });
                  router.push('/profile');
                })
              }
            >
              Покинуть команду
            </Button>
          )
        }
      />
      {team.disbanded && (
        <Alert tone="warning" className="mb-4">
          Команда распущена
        </Alert>
      )}
      {actionError && (
        <Alert tone="danger" className="mb-4">
          {actionError}
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader>
            <CardTitle>Состав</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {team.members.map((m) => (
              <div
                key={m.userId}
                className="border-border flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-2 text-sm">
                  {m.isCaptain && <Crown className="text-warning size-4" aria-label="Капитан" />}
                  <Link href={`/users/${m.userId}`} className="font-medium hover:underline">
                    {m.nickname}
                  </Link>
                  <Badge>{m.role === 'PLAYER' ? 'Основной' : 'Запасной'}</Badge>
                </div>
                {isCaptain && !m.isCaptain && !team.disbanded && (
                  <div className="flex flex-wrap gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        action.mutate(() =>
                          api(`/teams/${team.id}/members/${m.userId}`, 'PATCH', {
                            role: m.role === 'PLAYER' ? 'SUBSTITUTE' : 'PLAYER',
                          }),
                        )
                      }
                    >
                      {m.role === 'PLAYER' ? 'В запас' : 'В основу'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        action.mutate(() =>
                          api(`/teams/${team.id}/captain`, 'POST', { userId: m.userId }),
                        )
                      }
                    >
                      Сделать капитаном
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger"
                      onClick={() =>
                        action.mutate(() => api(`/teams/${team.id}/members/${m.userId}`, 'DELETE'))
                      }
                    >
                      Исключить
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
        {isCaptain && !team.disbanded && <InviteBlock team={team} />}
      </div>
    </>
  );
}
