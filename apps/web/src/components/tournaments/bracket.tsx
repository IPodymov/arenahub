import {
  BEST_OF_LABELS,
  type BracketDto,
  type BracketMatchDto,
  type BracketSideDto,
  formatRub,
  type StandingDto,
} from '@arenahub/shared';
import { Medal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function roundTitle(round: number, rounds: number): string {
  switch (rounds - round) {
    case 0:
      return 'Финал';
    case 1:
      return 'Полуфинал';
    case 2:
      return 'Четвертьфинал';
    case 3:
      return '1/8 финала';
    default:
      return `Раунд ${round}`;
  }
}

const STATUS_HINT: Partial<Record<BracketMatchDto['status'], string>> = {
  PENDING: 'Ожидает соперников',
  READY: 'Скоро',
  IN_PROGRESS: 'Идёт',
  AWAITING_CONFIRMATION: 'Ждёт подтверждения',
  DISPUTED: 'Спор',
};

function Side({
  side,
  score,
  match,
}: {
  side: BracketSideDto | null;
  score: number;
  match: BracketMatchDto;
}) {
  const done = match.status === 'COMPLETED';
  const won = done && side !== null && side.registrationId === match.winnerRegistrationId;
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-2 px-2.5 py-1.5 text-sm',
        done && !won && 'text-muted',
      )}
    >
      <span className={cn('flex min-w-0 items-center gap-1.5', won && 'font-semibold')}>
        {side?.seed != null && <span className="text-muted w-4 shrink-0 text-xs">{side.seed}</span>}
        <span className="truncate">{side?.name ?? 'TBD'}</span>
      </span>
      <span className={cn('tabular-nums', won && 'text-primary font-semibold')}>
        {done ? score : ''}
      </span>
    </div>
  );
}

function MatchCard({ m }: { m: BracketMatchDto }) {
  const hint = STATUS_HINT[m.status];
  return (
    <div className="border-border bg-surface overflow-hidden rounded-md border">
      <Side side={m.a} score={m.scoreA} match={m} />
      <div className="border-border border-t" />
      <Side side={m.b} score={m.scoreB} match={m} />
      {(hint || m.bestOf !== 'BO1') && (
        <div className="border-border bg-surface-2 text-muted flex justify-between border-t px-2.5 py-1 text-[11px]">
          <span>{hint ?? ''}</span>
          <span>{BEST_OF_LABELS[m.bestOf]}</span>
        </div>
      )}
    </div>
  );
}

/** Сетка single elimination: колонки по раундам, матч за 3-е место — под финалом. */
export function Bracket({ bracket }: { bracket: BracketDto }) {
  const main = bracket.matches.filter((m) => m.bracketGroup === 0);
  const third = bracket.matches.find((m) => m.bracketGroup === 1);
  const rounds = Array.from({ length: bracket.rounds }, (_, i) => i + 1);

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-4">
        {rounds.map((r) => (
          <div key={r} className="flex w-56 flex-col">
            <h3 className="text-muted mb-2 text-xs font-medium tracking-wide uppercase">
              {roundTitle(r, bracket.rounds)}
            </h3>
            <div className="flex flex-1 flex-col justify-around gap-3">
              {main
                .filter((m) => m.round === r)
                .map((m) => (
                  <MatchCard key={m.id} m={m} />
                ))}
              {r === bracket.rounds && third && (
                <div>
                  <h3 className="text-muted mb-2 text-xs font-medium tracking-wide uppercase">
                    За 3-е место
                  </h3>
                  <MatchCard m={third} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const MEDAL: Record<number, string> = {
  1: 'text-amber-400',
  2: 'text-slate-300',
  3: 'text-orange-400',
};

/** Итоговые места и выплаты. */
export function Standings({ standings }: { standings: StandingDto[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Итоги и призы</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="divide-border divide-y">
          {standings.map((s) => (
            <li key={s.registrationId} className="flex items-center gap-3 py-2 text-sm">
              <span className="text-muted w-10 shrink-0 tabular-nums">
                {s.place === s.placeTo ? s.place : `${s.place}–${s.placeTo}`}
              </span>
              {MEDAL[s.place] && s.place === s.placeTo ? (
                <Medal className={cn('size-4 shrink-0', MEDAL[s.place])} aria-hidden />
              ) : (
                <span className="size-4 shrink-0" />
              )}
              <span className={cn('min-w-0 flex-1 truncate', s.place === 1 && 'font-semibold')}>
                {s.name}
              </span>
              <span className="font-medium tabular-nums">
                {s.prizeKopecks === '0' ? '—' : formatRub(s.prizeKopecks)}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
