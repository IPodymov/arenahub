'use client';

import { formatLabel, type Paginated, type TournamentSummaryDto } from '@arenahub/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { PageTitle } from '@/components/layout/page-title';
import { RequireAuth } from '@/components/layout/require-auth';
import { PhaseBadge } from '@/components/tournaments/phase-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, errorText } from '@/lib/api';
import { formatDateTime, formatEntryFee } from '@/lib/format';
import { qk } from '@/lib/queries';

type Action = 'publish' | 'start' | 'complete' | 'cancel' | 'delete';

const ACTIONS: { action: Action; label: string; when: (t: TournamentSummaryDto) => boolean }[] = [
  { action: 'publish', label: 'Опубликовать', when: (t) => t.status === 'DRAFT' },
  {
    action: 'start',
    label: 'Начать',
    when: (t) =>
      t.status === 'PUBLISHED' && (t.phase === 'REGISTRATION_CLOSED' || t.phase === 'IN_PROGRESS'),
  },
  { action: 'complete', label: 'Завершить', when: (t) => t.phase === 'IN_PROGRESS' },
  {
    action: 'cancel',
    label: 'Отменить',
    when: (t) => t.status !== 'COMPLETED' && t.status !== 'CANCELLED',
  },
  { action: 'delete', label: 'Удалить', when: (t) => t.status === 'DRAFT' },
];

function AdminList() {
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: qk.adminTournaments(page),
    queryFn: () =>
      api<Paginated<TournamentSummaryDto>>(`/admin/tournaments?page=${page}&pageSize=20`),
  });
  const run = useMutation({
    mutationFn: ({ id, action }: { id: string; action: Action }) =>
      action === 'delete'
        ? api(`/admin/tournaments/${id}`, 'DELETE')
        : api(`/admin/tournaments/${id}/${action}`, 'POST'),
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['admin'] }),
        qc.invalidateQueries({ queryKey: ['tournaments'] }),
      ]),
  });

  const pages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <>
      <PageTitle
        title="Турниры — админка"
        actions={
          <Button asChild>
            <Link href="/admin/tournaments/new">Создать турнир</Link>
          </Button>
        }
      />
      {run.error && (
        <Alert tone="danger" className="mb-4">
          {errorText(run.error)}
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        {data?.items.map((t) => (
          <Card
            key={t.id}
            className="flex flex-col gap-3 p-3 md:flex-row md:items-center md:justify-between"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <PhaseBadge phase={t.phase} />
                {t.status !== 'DRAFT' ? (
                  <Link
                    href={`/tournaments/${t.slug}`}
                    className="truncate font-medium hover:underline"
                  >
                    {t.title}
                  </Link>
                ) : (
                  <span className="truncate font-medium">{t.title}</span>
                )}
              </div>
              <p className="text-muted mt-1 text-xs">
                {t.game.name} · {formatLabel(t.teamSize)} · {formatEntryFee(t.entryFeeKopecks)} ·{' '}
                {t.takenSlots}/{t.maxSlots} · старт {formatDateTime(t.startsAt)}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {ACTIONS.filter((a) => a.when(t)).map((a) => (
                <Button
                  key={a.action}
                  size="sm"
                  variant={a.action === 'cancel' || a.action === 'delete' ? 'danger' : 'secondary'}
                  disabled={run.isPending}
                  onClick={() => run.mutate({ id: t.id, action: a.action })}
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </Card>
        ))}
        {data?.items.length === 0 && (
          <p className="text-muted py-12 text-center text-sm">Турниров пока нет</p>
        )}
      </div>
      {pages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Назад
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={page >= pages}
            onClick={() => setPage(page + 1)}
          >
            Вперёд
          </Button>
        </div>
      )}
    </>
  );
}

export default function AdminTournamentsPage() {
  return <RequireAuth adminOnly>{() => <AdminList />}</RequireAuth>;
}
