'use client';

import { PageTitle } from '@/components/layout/page-title';
import { RequireAuth } from '@/components/layout/require-auth';
import { TournamentForm } from '@/components/tournaments/tournament-form';
import { useGames } from '@/lib/queries';

export default function NewTournamentPage() {
  const { data: games } = useGames();
  return (
    <RequireAuth access="staff">
      {() => (
        <>
          <PageTitle title="Новый турнир" />
          {games && <TournamentForm games={games} mode="staff" />}
        </>
      )}
    </RequireAuth>
  );
}
