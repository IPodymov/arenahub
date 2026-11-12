import type { CatalogTab, TournamentPhase } from '@arenahub/shared';
import type { ScheduleSnapshot } from './types';

/** Публичная фаза турнира: хранимый статус + даты. Не требует фоновых задач. */
export function tournamentPhase(t: ScheduleSnapshot, now: Date): TournamentPhase {
  switch (t.status) {
    case 'PROPOSED':
    case 'REJECTED':
    case 'DRAFT':
    case 'IN_PROGRESS':
    case 'COMPLETED':
    case 'CANCELLED':
      return t.status;
    case 'PUBLISHED':
      if (now < t.registrationOpensAt) return 'UPCOMING';
      if (now < t.registrationClosesAt) return 'REGISTRATION';
      if (now < t.startsAt) return 'REGISTRATION_CLOSED';
      return 'IN_PROGRESS';
  }
}

export const TAB_PHASES: Record<CatalogTab, readonly TournamentPhase[]> = {
  registration: ['UPCOMING', 'REGISTRATION', 'REGISTRATION_CLOSED'],
  live: ['IN_PROGRESS'],
  finished: ['COMPLETED', 'CANCELLED'],
};

export type StatusAction = 'publish' | 'start' | 'complete' | 'cancel' | 'approve' | 'reject';

/** Переходы жизненного цикла, доступные модераторам и админам. */
export function nextStatus(
  t: ScheduleSnapshot,
  action: StatusAction,
  now: Date,
): ScheduleSnapshot['status'] | null {
  const phase = tournamentPhase(t, now);
  switch (action) {
    case 'publish':
      return t.status === 'DRAFT' && now < t.startsAt ? 'PUBLISHED' : null;
    // Одобренное предложение сразу публикуется
    case 'approve':
      return t.status === 'PROPOSED' && now < t.startsAt ? 'PUBLISHED' : null;
    case 'reject':
      return t.status === 'PROPOSED' ? 'REJECTED' : null;
    case 'start':
      return t.status === 'PUBLISHED' &&
        (phase === 'REGISTRATION_CLOSED' || phase === 'IN_PROGRESS')
        ? 'IN_PROGRESS'
        : null;
    case 'complete':
      return phase === 'IN_PROGRESS' ? 'COMPLETED' : null;
    case 'cancel':
      return t.status === 'PUBLISHED' || t.status === 'IN_PROGRESS' || t.status === 'DRAFT'
        ? 'CANCELLED'
        : null;
  }
}
