import {
  BEST_OF_LABELS,
  CATEGORY_LABELS,
  formatLabel,
  type TournamentSummaryDto,
} from '@arenahub/shared';
import { CalendarDays, Users } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatDateTime, formatEntryFee, formatPrize } from '@/lib/format';
import { PhaseBadge } from './phase-badge';

export function TournamentCard({ t }: { t: TournamentSummaryDto }) {
  return (
    <Link href={`/tournaments/${t.slug}`} className="group block focus-visible:outline-none">
      <Card className="group-hover:border-primary/50 group-focus-visible:border-primary flex h-full flex-col gap-4 p-4 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-muted text-xs">{t.game.name}</p>
            <h3 className="mt-0.5 truncate font-semibold">{t.title}</h3>
          </div>
          <PhaseBadge phase={t.phase} />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge>{formatLabel(t.teamSize)}</Badge>
          <Badge>{BEST_OF_LABELS[t.bestOf]}</Badge>
          <Badge>{CATEGORY_LABELS[t.category]}</Badge>
        </div>

        <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-muted text-xs">Взнос</dt>
            <dd>{formatEntryFee(t.entryFeeKopecks)}</dd>
          </div>
          <div>
            <dt className="text-muted text-xs">Призовой фонд</dt>
            <dd>{formatPrize(t.prizePoolKopecks)}</dd>
          </div>
          <div className="text-muted flex items-center gap-1.5">
            <CalendarDays className="size-3.5" aria-hidden />
            <span className="text-xs">{formatDateTime(t.startsAt)}</span>
          </div>
          <div className="text-muted flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden />
            <span className="text-xs">
              {t.takenSlots} / {t.maxSlots}
            </span>
          </div>
        </dl>
      </Card>
    </Link>
  );
}
