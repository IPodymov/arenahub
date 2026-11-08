'use client';

import {
  CATALOG_TAB_LABELS,
  CatalogTab,
  CATEGORY_LABELS,
  GameCode,
  TournamentCategory,
  type TournamentListQuery,
} from '@arenahub/shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { PageTitle } from '@/components/layout/page-title';
import { TournamentGrid } from '@/components/tournaments/tournament-grid';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/input';
import { Tabs } from '@/components/ui/tabs';
import { useGames, useTournaments } from '@/lib/queries';

const FORMATS = [
  { value: '', label: 'Любой формат' },
  { value: '1', label: '1x1' },
  { value: '2', label: '2x2' },
  { value: '3', label: '3x3' },
  { value: '5', label: '5x5' },
];

function Catalog() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: games } = useGames();

  const tab = CatalogTab.catch('registration').parse(params.get('tab') ?? undefined);
  const game = GameCode.optional()
    .catch(undefined)
    .parse(params.get('game') ?? undefined);
  const category = TournamentCategory.optional()
    .catch(undefined)
    .parse(params.get('category') ?? undefined);
  const teamSize = Number(params.get('teamSize')) || undefined;
  const paid = params.get('paid') as 'true' | 'false' | null;
  const page = Math.max(1, Number(params.get('page')) || 1);

  const query: TournamentListQuery = {
    tab,
    game,
    category,
    teamSize,
    paid: paid ?? undefined,
    page,
  };
  const { data, isPending, isFetching } = useTournaments(query);

  function set(key: string, value: string | undefined) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    router.replace(`${pathname}?${next}`, { scroll: false });
  }

  const pages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <>
      <PageTitle title="Турниры" subtitle="Время везде указано по Москве" />

      <Tabs
        items={CatalogTab.options.map((v) => ({ value: v, label: CATALOG_TAB_LABELS[v] }))}
        value={tab}
        onChange={(v) => set('tab', v === 'registration' ? undefined : v)}
      />

      <div className="my-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Select aria-label="Игра" value={game ?? ''} onChange={(e) => set('game', e.target.value)}>
          <option value="">Все игры</option>
          {games?.map((g) => (
            <option key={g.code} value={g.code}>
              {g.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Формат"
          value={teamSize ?? ''}
          onChange={(e) => set('teamSize', e.target.value)}
        >
          {FORMATS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Категория"
          value={category ?? ''}
          onChange={(e) => set('category', e.target.value)}
        >
          <option value="">Любая категория</option>
          {TournamentCategory.options.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </Select>
        <Select aria-label="Взнос" value={paid ?? ''} onChange={(e) => set('paid', e.target.value)}>
          <option value="">Любой взнос</option>
          <option value="false">Бесплатные</option>
          <option value="true">Платные</option>
        </Select>
      </div>

      <div className={isFetching && !isPending ? 'opacity-60 transition-opacity' : undefined}>
        <TournamentGrid
          items={data?.items}
          loading={isPending}
          empty="По этим фильтрам турниров нет"
        />
      </div>

      {pages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-3 text-sm">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => set('page', String(page - 1))}
          >
            Назад
          </Button>
          <span className="text-muted">
            {page} из {pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pages}
            onClick={() => set('page', String(page + 1))}
          >
            Вперёд
          </Button>
        </div>
      )}
    </>
  );
}

export default function TournamentsPage() {
  return (
    <Suspense>
      <Catalog />
    </Suspense>
  );
}
