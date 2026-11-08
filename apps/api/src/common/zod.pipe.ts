import { BadRequestException, type PipeTransform } from '@nestjs/common';
import type { ValidationErrorBody } from '@arenahub/shared';
import type { z } from 'zod';

/** Валидирует вход zod-схемой из @arenahub/shared и возвращает распарсенное значение. */
export class ZodPipe<T extends z.ZodType> implements PipeTransform<unknown, z.output<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.output<T> {
    const result = this.schema.safeParse(value ?? {});
    if (result.success) return result.data;
    const body: ValidationErrorBody = {
      code: 'VALIDATION_ERROR',
      message: 'Некорректные данные',
      issues: result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    };
    throw new BadRequestException(body);
  }
}
