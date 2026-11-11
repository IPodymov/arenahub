/** Коды доменных ошибок. API отдаёт их в теле 422, фронт переводит через DOMAIN_ERROR_MESSAGES. */
export const DomainErrorCode = {
  // Пользователь и возраст
  BIRTH_DATE_REQUIRED: 'BIRTH_DATE_REQUIRED',
  BIRTH_DATE_ALREADY_SET: 'BIRTH_DATE_ALREADY_SET',
  BIRTH_DATE_INVALID: 'BIRTH_DATE_INVALID',
  AGE_BELOW_PLATFORM_MINIMUM: 'AGE_BELOW_PLATFORM_MINIMUM',
  AGE_BELOW_TOURNAMENT_MINIMUM: 'AGE_BELOW_TOURNAMENT_MINIMUM',
  PAID_TOURNAMENT_ADULTS_ONLY: 'PAID_TOURNAMENT_ADULTS_ONLY',
  USER_BANNED: 'USER_BANNED',
  NICKNAME_TAKEN: 'NICKNAME_TAKEN',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  LINKED_ACCOUNT_REQUIRED: 'LINKED_ACCOUNT_REQUIRED',

  // Политика игры при создании турнира
  GAME_NOT_FOUND: 'GAME_NOT_FOUND',
  GAME_INACTIVE: 'GAME_INACTIVE',
  PAID_ENTRY_FORBIDDEN_BY_GAME: 'PAID_ENTRY_FORBIDDEN_BY_GAME',
  ENTRY_FEE_ABOVE_LIMIT: 'ENTRY_FEE_ABOVE_LIMIT',
  PRIZE_POOL_ABOVE_LIMIT: 'PRIZE_POOL_ABOVE_LIMIT',
  PRIZE_SOURCE_FORBIDDEN_BY_GAME: 'PRIZE_SOURCE_FORBIDDEN_BY_GAME',
  PRIZE_SOURCE_INCONSISTENT: 'PRIZE_SOURCE_INCONSISTENT',
  TEAM_SIZE_FORBIDDEN_BY_GAME: 'TEAM_SIZE_FORBIDDEN_BY_GAME',
  PARTICIPANT_TYPE_INCONSISTENT: 'PARTICIPANT_TYPE_INCONSISTENT',
  SUBSTITUTES_ABOVE_LIMIT: 'SUBSTITUTES_ABOVE_LIMIT',
  MIN_AGE_BELOW_GAME_MINIMUM: 'MIN_AGE_BELOW_GAME_MINIMUM',
  INVALID_SCHEDULE: 'INVALID_SCHEDULE',
  INVALID_SLOTS: 'INVALID_SLOTS',

  // Жизненный цикл турнира
  TOURNAMENT_NOT_FOUND: 'TOURNAMENT_NOT_FOUND',
  TOURNAMENT_NOT_EDITABLE: 'TOURNAMENT_NOT_EDITABLE',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  SLUG_TAKEN: 'SLUG_TAKEN',

  // Регистрация
  REGISTRATION_NOT_OPEN: 'REGISTRATION_NOT_OPEN',
  TOURNAMENT_FULL: 'TOURNAMENT_FULL',
  ALREADY_REGISTERED: 'ALREADY_REGISTERED',
  NOT_REGISTERED: 'NOT_REGISTERED',
  WRONG_PARTICIPANT_TYPE: 'WRONG_PARTICIPANT_TYPE',
  TEAM_REQUIRED: 'TEAM_REQUIRED',
  TEAM_GAME_MISMATCH: 'TEAM_GAME_MISMATCH',
  LINEUP_SIZE_MISMATCH: 'LINEUP_SIZE_MISMATCH',
  LINEUP_DUPLICATE_PLAYER: 'LINEUP_DUPLICATE_PLAYER',
  LINEUP_PLAYER_NOT_IN_TEAM: 'LINEUP_PLAYER_NOT_IN_TEAM',

  // Команды
  TEAM_NOT_FOUND: 'TEAM_NOT_FOUND',
  TEAM_NAME_TAKEN: 'TEAM_NAME_TAKEN',
  TEAM_DISBANDED: 'TEAM_DISBANDED',
  TEAM_FULL: 'TEAM_FULL',
  NOT_TEAM_CAPTAIN: 'NOT_TEAM_CAPTAIN',
  NOT_TEAM_MEMBER: 'NOT_TEAM_MEMBER',
  ALREADY_TEAM_MEMBER: 'ALREADY_TEAM_MEMBER',
  CAPTAIN_MUST_TRANSFER: 'CAPTAIN_MUST_TRANSFER',
  MEMBER_LOCKED_IN_TOURNAMENT: 'MEMBER_LOCKED_IN_TOURNAMENT',
  INVITE_INVALID: 'INVITE_INVALID',
  GAME_HAS_NO_TEAM_FORMATS: 'GAME_HAS_NO_TEAM_FORMATS',
} as const;
export type DomainErrorCode = (typeof DomainErrorCode)[keyof typeof DomainErrorCode];

export const DOMAIN_ERROR_MESSAGES: Record<DomainErrorCode, string> = {
  BIRTH_DATE_REQUIRED: 'Укажите дату рождения в профиле',
  BIRTH_DATE_ALREADY_SET: 'Дата рождения уже указана. Для изменения обратитесь в поддержку',
  BIRTH_DATE_INVALID: 'Некорректная дата рождения',
  AGE_BELOW_PLATFORM_MINIMUM: 'Платформа доступна с 16 лет',
  AGE_BELOW_TOURNAMENT_MINIMUM: 'Возраст участника ниже минимального для этого турнира',
  PAID_TOURNAMENT_ADULTS_ONLY: 'Платные турниры доступны только с 18 лет',
  USER_BANNED: 'Аккаунт заблокирован',
  NICKNAME_TAKEN: 'Этот никнейм уже занят',
  INVALID_CREDENTIALS: 'Неверный никнейм или пароль',
  LINKED_ACCOUNT_REQUIRED: 'Для участия нужно привязать игровой аккаунт',

  GAME_NOT_FOUND: 'Игра не найдена',
  GAME_INACTIVE: 'Игра сейчас недоступна для турниров',
  PAID_ENTRY_FORBIDDEN_BY_GAME: 'Правила издателя игры запрещают платный вход',
  ENTRY_FEE_ABOVE_LIMIT: 'Взнос превышает лимит для этой игры',
  PRIZE_POOL_ABOVE_LIMIT: 'Призовой фонд превышает лимит для этой игры',
  PRIZE_SOURCE_FORBIDDEN_BY_GAME: 'Правила издателя запрещают такой источник призового фонда',
  PRIZE_SOURCE_INCONSISTENT: 'Источник призового фонда не соответствует взносу и сумме фонда',
  TEAM_SIZE_FORBIDDEN_BY_GAME: 'Такой формат не поддерживается для этой игры',
  PARTICIPANT_TYPE_INCONSISTENT: 'Соло-турнир должен быть в формате 1x1, командный — от 2 игроков',
  SUBSTITUTES_ABOVE_LIMIT: 'Слишком много запасных',
  MIN_AGE_BELOW_GAME_MINIMUM: 'Минимальный возраст не может быть ниже установленного для игры',
  INVALID_SCHEDULE: 'Некорректные даты: открытие регистрации < закрытие ≤ старт',
  INVALID_SLOTS: 'Некорректное количество слотов',

  TOURNAMENT_NOT_FOUND: 'Турнир не найден',
  TOURNAMENT_NOT_EDITABLE: 'Турнир уже нельзя редактировать',
  INVALID_STATUS_TRANSITION: 'Недопустимая смена статуса турнира',
  SLUG_TAKEN: 'Адрес турнира уже занят',

  REGISTRATION_NOT_OPEN: 'Регистрация на турнир сейчас закрыта',
  TOURNAMENT_FULL: 'Все слоты заняты',
  ALREADY_REGISTERED: 'Участник уже зарегистрирован на этот турнир',
  NOT_REGISTERED: 'Вы не зарегистрированы на этот турнир',
  WRONG_PARTICIPANT_TYPE: 'Неверный тип регистрации для этого турнира',
  TEAM_REQUIRED: 'Для командного турнира выберите команду',
  TEAM_GAME_MISMATCH: 'Команда создана для другой игры',
  LINEUP_SIZE_MISMATCH: 'Количество игроков в составе не соответствует формату',
  LINEUP_DUPLICATE_PLAYER: 'Игрок указан в составе дважды',
  LINEUP_PLAYER_NOT_IN_TEAM: 'В составе есть игрок не из этой команды',

  TEAM_NOT_FOUND: 'Команда не найдена',
  TEAM_NAME_TAKEN: 'Команда с таким названием уже есть в этой игре',
  TEAM_DISBANDED: 'Команда распущена',
  TEAM_FULL: 'В команде нет свободных мест',
  NOT_TEAM_CAPTAIN: 'Действие доступно только капитану',
  NOT_TEAM_MEMBER: 'Пользователь не состоит в команде',
  ALREADY_TEAM_MEMBER: 'Вы уже в этой команде',
  CAPTAIN_MUST_TRANSFER: 'Сначала передайте капитанство другому игроку',
  MEMBER_LOCKED_IN_TOURNAMENT: 'Игрок заявлен в активном турнире — состав менять нельзя',
  INVITE_INVALID: 'Приглашение недействительно или истекло',
  GAME_HAS_NO_TEAM_FORMATS: 'Для этой игры нет командных форматов',
};

/** Тело ответа API на доменную ошибку. */
export interface DomainErrorBody {
  code: DomainErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/** Тело ответа API на ошибку валидации (400). */
export interface ValidationErrorBody {
  code: 'VALIDATION_ERROR';
  message: string;
  issues: { path: string; message: string }[];
}
