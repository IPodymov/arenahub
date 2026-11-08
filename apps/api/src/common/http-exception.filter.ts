import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { DomainErrorBody, DomainErrorCode } from '@arenahub/shared';
import type { Response } from 'express';
import { DomainError } from './domain-error';

const NOT_FOUND: ReadonlySet<DomainErrorCode> = new Set([
  'GAME_NOT_FOUND',
  'TOURNAMENT_NOT_FOUND',
  'TEAM_NOT_FOUND',
  'NOT_REGISTERED',
]);
const FORBIDDEN: ReadonlySet<DomainErrorCode> = new Set(['NOT_TEAM_CAPTAIN', 'USER_BANNED']);
const CONFLICT: ReadonlySet<DomainErrorCode> = new Set([
  'NICKNAME_TAKEN',
  'TEAM_NAME_TAKEN',
  'SLUG_TAKEN',
  'ALREADY_REGISTERED',
  'ALREADY_TEAM_MEMBER',
]);

export function domainErrorStatus(code: DomainErrorCode): number {
  if (NOT_FOUND.has(code)) return HttpStatus.NOT_FOUND;
  if (FORBIDDEN.has(code)) return HttpStatus.FORBIDDEN;
  if (CONFLICT.has(code)) return HttpStatus.CONFLICT;
  return HttpStatus.UNPROCESSABLE_ENTITY;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof DomainError) {
      const body: DomainErrorBody = { code: exception.code, message: exception.message };
      if (exception.details) body.details = exception.details;
      res.status(domainErrorStatus(exception.code)).json(body);
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const body =
        typeof response === 'object' && response !== null && 'code' in response
          ? response
          : { code: `HTTP_${status}`, message: exception.message };
      res.status(status).json(body);
      return;
    }

    this.logger.error(exception);
    res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json({ code: 'INTERNAL_ERROR', message: 'Внутренняя ошибка сервера' });
  }
}
