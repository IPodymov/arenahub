'use client';

import { HIDDEN_TOURNAMENT_STATUSES, formatLabel, type TournamentDto } from '@arenahub/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { PageTitle } from '@/components/layout/page-title';
import { RequireAuth } from '@/components/layout/require-auth';
import { PhaseBadge } from '@/components/tournaments/phase-badge';
import { TournamentForm } from '@/components/tournaments/tournament-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api, errorText } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { qk, useGames, useMyProposals } from '@/lib/queries';

function ProposalRow({ t }: { t: TournamentDto }) {
  const qc = useQueryClient();
  const withdraw = useMutation({
    mutationFn: () => api(`/proposals/${t.id}`, 'DELETE'),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.myProposals }),
  });
  const visible = !HIDDEN_TOURNAMENT_STATUSES.includes(t.status);

  return (
    <Card className="flex flex-col gap-2 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <PhaseBadge phase={t.phase} />
            {visible ? (
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
            {t.game.name} · {formatLabel(t.teamSize)} · старт {formatDateTime(t.startsAt)}
          </p>
        </div>
        {t.status === 'PROPOSED' && (
          <Button
            size="sm"
            variant="secondary"
            disabled={withdraw.isPending}
            onClick={() => withdraw.mutate()}
          >
            Отозвать
          </Button>
        )}
      </div>
      {t.status === 'REJECTED' && t.reviewNote && (
        <Alert tone="danger">Причина отклонения: {t.reviewNote}</Alert>
      )}
      {withdraw.error && <Alert tone="danger">{errorText(withdraw.error)}</Alert>}
    </Card>
  );
}

function Proposals() {
  const { data: games } = useGames();
  const { data: mine } = useMyProposals();
  const [sent, setSent] = useState(false);

  return (
    <>
      <PageTitle
        title="Предложить турнир"
        subtitle="Модератор проверит условия и опубликует турнир или вернёт его с комментарием."
      />
      {mine && mine.length > 0 && (
        <section className="mb-8 flex flex-col gap-2">
          <h2 className="text-sm font-semibold">Мои предложения</h2>
          {mine.map((t) => (
            <ProposalRow key={t.id} t={t} />
          ))}
        </section>
      )}
      {sent && (
        <Alert tone="success" className="mb-4 max-w-3xl">
          Предложение отправлено. Решение модератора появится в списке выше.
        </Alert>
      )}
      {games && <TournamentForm games={games} mode="proposal" onDone={() => setSent(true)} />}
    </>
  );
}

export default function ProposalsPage() {
  return <RequireAuth>{() => <Proposals />}</RequireAuth>;
}
