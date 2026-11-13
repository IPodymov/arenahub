import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Переключает процесс на тестовую БД. Вызывается до импорта приложения. */
export function applyTestEnv(): void {
  const rootEnv = path.resolve(__dirname, '../../../.env');
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
  const testDb = process.env.TEST_DATABASE_URL;
  if (!testDb) throw new Error('TEST_DATABASE_URL не задан');
  assertTestDatabase(testDb);
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = testDb;
  process.env.AUTH_DEV_LOGIN = 'true';
  process.env.STEAM_API_KEY = '';
  process.env.ADMIN_NICKNAMES = 'boss';
  process.env.SESSION_SECRET ??= 'test-secret-0123456789abcdef0123456789';
  process.env.WEB_ORIGIN ??= 'http://localhost:3000';
  process.env.UPLOADS_DIR = path.join(os.tmpdir(), 'arenahub-test-uploads');
  // Тесты пишут аватары на диск, а не в настоящий Blob
  process.env.BLOB_STORE_ID = '';
  process.env.BLOB_READ_WRITE_TOKEN = '';
}

/** Защита от очистки не той базы: тесты работают только с БД, чьё имя оканчивается на _test. */
export function assertTestDatabase(url: string | undefined): void {
  const name = url ? new URL(url).pathname.slice(1) : '';
  if (!name.endsWith('_test'))
    throw new Error(`Отказ: e2e очищают данные, а БД "${name}" не тестовая`);
}
