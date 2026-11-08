// Создаёт .env из .env.example при первой установке, чтобы `pnpm i && docker compose up -d && pnpm dev` работало сразу.
import { copyFileSync, existsSync } from 'node:fs';

if (!process.env.CI && !existsSync('.env') && existsSync('.env.example')) {
  copyFileSync('.env.example', '.env');
  console.log('[arenahub] .env создан из .env.example');
}
