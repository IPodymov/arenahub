'use client';

import {
  formatLabel,
  HIDDEN_TOURNAMENT_STATUSES,
  type MeDto,
  type Paginated,
  type TournamentSummaryDto,
} from '@arenahub/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { PageTitle } from '@/components/layout/page-title';
import { RequireAuth } from '@/components/layout/require-auth';
import { PhaseBadge } from '@/components/tournaments/phase-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs } from '@/components/ui/tabs';
import { api, errorText } from '@/lib/api';
import { formatDateTime, formatEntryFee } from '@/lib/format';
import { qk } from '@/lib/queries';

type Action = 'approve' | 'publish' | 'start' | 'complete' | 'cancel' | 'delete';

type Filter = 'all' | 'PROPOSED';

const FILTERS = [
  { value: 'all' as const, label: 'Все' },
  { value: 'PROPOSED' as const, label: 'На рассмотрении' },
];

const ACTIONS: {
  action: Action;
  label: string;
  when: (t: TournamentSummaryDto, me: MeDto) => boolean;
}[] = [
  { action: 'approve', label: 'Одобрить', when: (t) => t.status === 'PROPOSED' },
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
    when: (t) => t.status === 'DRAFT' || t.status === 'PUBLISHED' || t.status === 'IN_PROGRESS',
  },
  // Модератор удаляет только неопубликованное, админ — любой турнир вместе с сеткой
  {
    action: 'delete',
    label: 'Удалить',
    when: (t, me) => me.role === 'ADMIN' || HIDDEN_TOURNAMENT_STATUSES.includes(t.status),
  },
];

function RejectForm({ id, onDone }: { id: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const reject = useMutation({
    mutationFn: () => api(`/admin/tournaments/${id}/reject`, 'POST', { note }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['admin'] });
      onDone();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    reject.mutate();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Причина — её увидит автор"
        aria-label="Причина отклонения"
        required
        minLength={3}
        maxLength={500}
        autoFocus
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="danger" disabled={reject.isPending}>
          Отклонить
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Отмена
        </Button>
      </div>
      {reject.error && <Alert tone="danger">{errorText(reject.error)}</Alert>}
    </form>
  );
}

function AdminList({ me }: { me: MeDto }) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Filter>('all');
  const [rejecting, setRejecting] = useState<string | null>(null);
  const qc = useQueryClient();
  const status = filter === 'all' ? '' : `&status=${filter}`;
  const { data } = useQuery({
    queryKey: qk.adminTournaments(page, filter),
    queryFn: () =>
      api<Paginated<TournamentSummaryDto>>(`/admin/tournaments?page=${page}&pageSize=20${status}`),
  });
  const pending = useQuery({
    queryKey: qk.adminTournaments(1, 'PROPOSED'),
    queryFn: () =>
      api<Paginated<TournamentSummaryDto>>('/admin/tournaments?page=1&pageSize=20&status=PROPOSED'),
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

  function act(t: TournamentSummaryDto, action: Action) {
    // Удаление сыгранного турнира стирает сетку и заявки — переспрашиваем
    if (
      action === 'delete' &&
      !HIDDEN_TOURNAMENT_STATUSES.includes(t.status) &&
      !window.confirm(`Удалить «${t.title}» вместе с участниками и сеткой?`)
    )
      return;
    run.mutate({ id: t.id, action });
  }

  const pages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <>
      <PageTitle
        title="Модерация турниров"
        subtitle={
          me.role === 'ADMIN'
            ? 'Администратор: все действия, включая удаление сыгранных турниров'
            : 'Модератор: создание, публикация и рассмотрение предложений'
        }
        actions={
          <Button asChild>
            <Link href="/admin/tournaments/new">Создать турнир</Link>
          </Button>
        }
      />
      <Tabs
        className="mb-4"
        value={filter}
        onChange={(v) => {
          setFilter(v);
          setPage(1);
        }}
        items={FILTERS.map((f) =>
          f.value === 'PROPOSED' ? { ...f, count: pending.data?.total } : f,
        )}
      />
      {run.error && (
        <Alert tone="danger" className="mb-4">
          {errorText(run.error)}
        </Alert>
      )}
      <div className="flex flex-col gap-2">
        {data?.items.map((t) => (
          <Card key={t.id} className="flex flex-col gap-3 p-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <PhaseBadge phase={t.phase} />
                  {!HIDDEN_TOURNAMENT_STATUSES.includes(t.status) ? (
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
                  {t.takenSlots}/{t.maxSlots} · старт {formatDateTime(t.startsAt)} · автор{' '}
                  <Link href={`/users/${t.createdBy.id}`} className="hover:underline">
                    {t.createdBy.nickname}
                  </Link>
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {ACTIONS.filter((a) => a.when(t, me)).map((a) => (
                  <Button
                    key={a.action}
                    size="sm"
                    variant={
                      a.action === 'cancel' || a.action === 'delete' ? 'danger' : 'secondary'
                    }
                    disabled={run.isPending}
                    onClick={() => act(t, a.action)}
                  >
                    {a.label}
                  </Button>
                ))}
                {t.status === 'PROPOSED' && rejecting !== t.id && (
                  <Button size="sm" variant="danger" onClick={() => setRejecting(t.id)}>
                    Отклонить
                  </Button>
                )}
              </div>
            </div>
            {rejecting === t.id && <RejectForm id={t.id} onDone={() => setRejecting(null)} />}
          </Card>
        ))}
        {data?.items.length === 0 && (
          <p className="text-muted py-12 text-center text-sm">
            {filter === 'PROPOSED' ? 'Новых предложений нет' : 'Турниров пока нет'}
          </p>
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
  return <RequireAuth access="staff">{(me) => <AdminList me={me} />}</RequireAuth>;
}
