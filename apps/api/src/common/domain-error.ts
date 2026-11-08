import { DOMAIN_ERROR_MESSAGES, type DomainErrorCode } from '@arenahub/shared';

/** Нарушение бизнес-правила. Бросается доменом, превращается в HTTP-ответ фильтром. */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    readonly details?: Record<string, unknown>,
  ) {
    super(DOMAIN_ERROR_MESSAGES[code]);
    this.name = 'DomainError';
  }
}
