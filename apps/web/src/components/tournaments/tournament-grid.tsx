import type { TournamentSummaryDto } from '@arenahub/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { TournamentCard } from './tournament-card';

export function TournamentGrid({
  items,
  loading,
  empty,
}: {
  items?: TournamentSummaryDto[];
  loading?: boolean;
  empty: string;
}) {
  if (loading && !items) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }
  if (!items?.length) return <p className="text-muted py-12 text-center text-sm">{empty}</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((t) => (
        <TournamentCard key={t.id} t={t} />
      ))}
    </div>
  );
}
