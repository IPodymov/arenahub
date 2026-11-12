import type {
  BestOf,
  BracketType,
  CatalogTab,
  GameCode,
  ParticipantType,
  PrizeSource,
  RegistrationStatus,
  TournamentCategory,
  TournamentPhase,
  UserRole,
} from './enums';

export const GAME_LABELS: Record<GameCode, string> = {
  DOTA2: 'Dota 2',
  CS2: 'Counter-Strike 2',
  CLASH_ROYALE: 'Clash Royale',
  BRAWL_STARS: 'Brawl Stars',
};

export const PHASE_LABELS: Record<TournamentPhase, string> = {
  PROPOSED: 'На рассмотрении',
  REJECTED: 'Отклонён',
  DRAFT: 'Черновик',
  UPCOMING: 'Скоро',
  REGISTRATION: 'Регистрация',
  REGISTRATION_CLOSED: 'Регистрация закрыта',
  IN_PROGRESS: 'Идёт',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
};

export const CATALOG_TAB_LABELS: Record<CatalogTab, string> = {
  registration: 'Регистрация',
  live: 'Идёт',
  finished: 'Завершён',
};

export const CATEGORY_LABELS: Record<TournamentCategory, string> = {
  OPEN: 'Открытый',
  AMATEUR: 'Любительский',
  SEMI_PRO: 'Полупрофессиональный',
  PRO: 'Профессиональный',
};

export const BRACKET_LABELS: Record<BracketType, string> = {
  SINGLE_ELIMINATION: 'Single Elimination',
  DOUBLE_ELIMINATION: 'Double Elimination',
  ROUND_ROBIN: 'Круговая система',
  SWISS: 'Швейцарская система',
};

export const BEST_OF_LABELS: Record<BestOf, string> = { BO1: 'BO1', BO3: 'BO3', BO5: 'BO5' };

export const PARTICIPANT_TYPE_LABELS: Record<ParticipantType, string> = {
  SOLO: 'Соло',
  TEAM: 'Командный',
};

export const PRIZE_SOURCE_LABELS: Record<PrizeSource, string> = {
  NONE: 'Без призового фонда',
  SPONSOR: 'Спонсорский фонд',
  ENTRY_FEES: 'Из взносов участников',
};

export const REGISTRATION_STATUS_LABELS: Record<RegistrationStatus, string> = {
  PENDING_PAYMENT: 'Ожидает оплаты',
  CONFIRMED: 'Подтверждена',
  WITHDRAWN: 'Отозвана',
  DISQUALIFIED: 'Дисквалифицирован',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  USER: 'Пользователь',
  MODERATOR: 'Модератор',
  ADMIN: 'Администратор',
};

export function formatLabel(teamSize: number): string {
  return `${teamSize}x${teamSize}`;
}
