'use client';

import {
  BEST_OF_LABELS,
  BRACKET_LABELS,
  CATEGORY_LABELS,
  formatLabel,
  formatRub,
  PARTICIPANT_TYPE_LABELS,
  PRIZE_SOURCE_LABELS,
  REGISTRATION_STATUS_LABELS,
} from '@arenahub/shared';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import { Bracket, Standings } from '@/components/tournaments/bracket';
import { PhaseBadge } from '@/components/tournaments/phase-badge';
import { RegisterPanel } from '@/components/tournaments/register-panel';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs } from '@/components/ui/tabs';
import { ApiError } from '@/lib/api';
import { formatDateTime, formatEntryFee, formatPrize } from '@/lib/format';
import { useBracket, useMe, useParticipants, useTournament } from '@/lib/queries';

type Tab = 'overview' | 'bracket' | 'participants' | 'rules';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

export default function TournamentPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: t, error, isPending } = useTournament(slug);
  const participants = useParticipants(slug);
  const { data: bracket } = useBracket(slug);
  const { data: me } = useMe();
  const [tab, setTab] = useState<Tab>('overview');

  if (error instanceof ApiError && error.status === 404) notFound();
  if (isPending || !t) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <PhaseBadge phase={t.phase} />
            <span className="text-muted text-sm">{t.game.name}</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
          <div className="flex flex-wrap gap-1.5">
            <Badge>{formatLabel(t.teamSize)}</Badge>
            <Badge>{PARTICIPANT_TYPE_LABELS[t.participantType]}</Badge>
            <Badge>{BRACKET_LABELS[t.bracketType]}</Badge>
            <Badge>{CATEGORY_LABELS[t.category]}</Badge>
          </div>
        </div>

        <Tabs
          className="mb-4"
          value={tab}
          onChange={setTab}
          items={[
            { value: 'overview', label: 'Обзор' },
            ...(bracket?.matches.length ? [{ value: 'bracket' as const, label: 'Сетка' }] : []),
            { value: 'participants', label: 'Участники', count: t.takenSlots },
            { value: 'rules', label: 'Правила' },
          ]}
        />

        {tab === 'overview' && (
          <div className="flex flex-col gap-4">
            {bracket && bracket.standings.length > 0 && <Standings standings={bracket.standings} />}
            {t.description && (
              <p className="text-sm leading-relaxed whitespace-pre-line">{t.description}</p>
            )}
            <Card>
              <CardContent className="pt-4 sm:pt-5">
                <dl className="divide-border divide-y">
                  <Row label="Регистрация">
                    {formatDateTime(t.registrationOpensAt)} —{' '}
                    {formatDateTime(t.registrationClosesAt)}
                  </Row>
                  <Row label="Старт">{formatDateTime(t.startsAt)}</Row>
                  <Row label="Матчи">
                    {BEST_OF_LABELS[t.bestOf]}
                    {t.finalsBestOf && `, финал ${BEST_OF_LABELS[t.finalsBestOf]}`}
                  </Row>
                  <Row label="Слоты">
                    {t.takenSlots} / {t.maxSlots}
                  </Row>
                  {t.participantType === 'TEAM' && (
                    <Row label="Запасные">до {t.maxSubstitutes}</Row>
                  )}
                  <Row label="Возраст">{t.minAge}+</Row>
                </dl>
              </CardContent>
            </Card>
            {t.prizeDistribution && t.prizePoolKopecks !== '0' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Распределение призов</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="divide-border divide-y">
                    {t.prizeDistribution.map((p) => (
                      <Row key={p.place} label={`${p.place} место`}>
                        {formatRub((BigInt(t.prizePoolKopecks) * BigInt(p.shareBp)) / 10_000n)}
                      </Row>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {tab === 'bracket' && bracket && <Bracket bracket={bracket} />}

        {tab === 'participants' && (
          <div className="flex flex-col gap-2">
            {participants.data?.length === 0 && (
              <p className="text-muted py-8 text-center text-sm">Пока никто не зарегистрировался</p>
            )}
            {participants.data?.map((p, i) => (
              <Card
                key={p.registrationId}
                className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-muted w-6 text-right text-sm">{i + 1}</span>
                  {p.team ? (
                    <Link href={`/teams/${p.team.id}`} className="font-medium hover:underline">
                      {p.team.tag && <span className="text-muted">[{p.team.tag}] </span>}
                      {p.name}
                    </Link>
                  ) : (
                    <Link
                      href={`/users/${p.members[0]?.userId}`}
                      className="font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                  )}
                  {p.status !== 'CONFIRMED' && (
                    <Badge variant="warning">{REGISTRATION_STATUS_LABELS[p.status]}</Badge>
                  )}
                </div>
                {p.team && (
                  <p className="text-muted pl-9 text-xs sm:pl-0">
                    {p.members
                      .map((m) => m.nickname + (m.isSubstitute ? ' (зап.)' : ''))
                      .join(', ')}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}

        {tab === 'rules' && (
          <Card>
            <CardContent className="pt-4 sm:pt-5">
              <p className="text-sm leading-relaxed whitespace-pre-line">
                {t.rules || 'Правила пока не опубликованы.'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <aside className="flex flex-col gap-3 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardContent className="flex flex-col gap-4 pt-4 sm:pt-5">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted text-xs">Взнос</dt>
                <dd className="font-medium">{formatEntryFee(t.entryFeeKopecks)}</dd>
              </div>
              <div>
                <dt className="text-muted text-xs">Призовой фонд</dt>
                <dd className="font-medium">{formatPrize(t.prizePoolKopecks)}</dd>
              </div>
            </dl>
            {t.prizeSource !== 'NONE' && (
              <p className="text-muted text-xs">{PRIZE_SOURCE_LABELS[t.prizeSource]}</p>
            )}
            <RegisterPanel t={t} me={me} />
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
