import { DOMAIN_ERROR_MESSAGES, type DomainErrorCode } from '@arenahub/shared';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly issues?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Запрос к API через прокси Next.js (/api → apps/api). Cookie сессии уходит автоматически. */
export async function api<T>(path: string, method: Method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (res.status === 204) return undefined as T;

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data ?? {}) as {
      code?: string;
      message?: string;
      details?: Record<string, unknown>;
      issues?: { path: string; message: string }[];
    };
    const code = err.code ?? `HTTP_${res.status}`;
    const message =
      DOMAIN_ERROR_MESSAGES[code as DomainErrorCode] ?? err.message ?? 'Что-то пошло не так';
    throw new ApiError(res.status, code, message, err.details, err.issues);
  }
  return data as T;
}

/** Текст ошибки для показа пользователю (с подробностями валидации и ником игрока). */
export function errorText(err: unknown): string {
  if (!(err instanceof ApiError)) return 'Сервер недоступен, попробуйте позже';
  const nickname = typeof err.details?.nickname === 'string' ? ` (${err.details.nickname})` : '';
  const issues = err.issues?.length
    ? `: ${err.issues.map((i) => `${i.path} — ${i.message}`).join('; ')}`
    : '';
  return `${err.message}${nickname}${issues}`;
}
