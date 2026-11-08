'use client';

import type { InvitePreviewDto, TeamDto } from '@arenahub/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api, errorText } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { qk, useMe } from '@/lib/queries';

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const preview = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api<InvitePreviewDto>(`/invites/${token}`),
  });
  const accept = useMutation({
    mutationFn: () => api<TeamDto>(`/invites/${token}/accept`, 'POST'),
    onSuccess: async (team) => {
      await qc.invalidateQueries({ queryKey: qk.myTeams });
      router.push(`/teams/${team.id}`);
    },
  });

  if (preview.isPending) return <Skeleton className="mx-auto h-48 max-w-md" />;
  if (preview.error) {
    return (
      <Alert tone="danger" className="mx-auto max-w-md">
        {errorText(preview.error)}
      </Alert>
    );
  }
  const { team, expiresAt } = preview.data;

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>Приглашение в команду</CardTitle>
        <CardDescription>
          {team.tag && `[${team.tag}] `}
          {team.name} · {team.game.name} · {team.memberCount}/{team.maxRosterSize} игроков
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-muted text-xs">Ссылка действует до {formatDateTime(expiresAt)}</p>
        {me === null ? (
          <Button asChild>
            <Link href="/login">Войдите, чтобы вступить</Link>
          </Button>
        ) : (
          <Button disabled={accept.isPending || !me} onClick={() => accept.mutate()}>
            Вступить в команду
          </Button>
        )}
        {accept.error && <Alert tone="danger">{errorText(accept.error)}</Alert>}
      </CardContent>
    </Card>
  );
}
