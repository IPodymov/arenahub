import { PHASE_LABELS, type TournamentPhase } from '@arenahub/shared';
import { Badge, type BadgeProps } from '@/components/ui/badge';

const VARIANT: Record<TournamentPhase, BadgeProps['variant']> = {
  DRAFT: 'default',
  UPCOMING: 'default',
  REGISTRATION: 'success',
  REGISTRATION_CLOSED: 'warning',
  IN_PROGRESS: 'primary',
  COMPLETED: 'default',
  CANCELLED: 'danger',
};

export function PhaseBadge({ phase }: { phase: TournamentPhase }) {
  return <Badge variant={VARIANT[phase]}>{PHASE_LABELS[phase]}</Badge>;
}
