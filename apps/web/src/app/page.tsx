'use client';

import { formatLabel } from '@arenahub/shared';
import Link from 'next/link';
import { PageTitle } from '@/components/layout/page-title';
import { TournamentGrid } from '@/components/tournaments/tournament-grid';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useGames, useTournaments } from '@/lib/queries';

export default function HomePage() {
  const { data: games } = useGames();
  const upcoming = useTournaments({ tab: 'registration', pageSize: 6 });
  const live = useTournaments({ tab: 'live', pageSize: 3 });

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4 pt-4 sm:pt-10">
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Онлайн-турниры по Dota 2, CS2, Clash Royale и Brawl Stars
        </h1>
        <p className="text-muted max-w-xl">
          Соло и командные турниры с понятными правилами и автоматической сеткой. Соберите команду,
          пригласите друзей по ссылке и зарегистрируйтесь в пару кликов.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link href="/tournaments">Найти турнир</Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link href="/teams/new">Создать команду</Link>
          </Button>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Игры</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {games?.map((g) => (
            <Link key={g.code} href={`/tournaments?game=${g.code}`}>
              <Card className="hover:border-primary/50 p-4 transition-colors">
                <p className="font-medium">{g.name}</p>
                <p className="text-muted mt-1 text-xs">
                  {g.policy.allowedTeamSizes.map(formatLabel).join(' · ')}
                  {!g.policy.paidEntryAllowed && ' · только бесплатно'}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {!!live.data?.items.length && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">Идут сейчас</h2>
          <TournamentGrid items={live.data.items} empty="" />
        </section>
      )}

      <section>
        <PageTitle
          title="Открыта регистрация"
          actions={
            <Button asChild variant="link">
              <Link href="/tournaments">Все турниры</Link>
            </Button>
          }
        />
        <TournamentGrid
          items={upcoming.data?.items}
          loading={upcoming.isPending}
          empty="Скоро здесь появятся турниры"
        />
      </section>
    </div>
  );
}
