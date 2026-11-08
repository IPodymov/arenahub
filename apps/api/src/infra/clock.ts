import { Injectable } from '@nestjs/common';

/** Источник «сейчас». В тестах подменяется. */
@Injectable()
export class Clock {
  now(): Date {
    return new Date();
  }
}
