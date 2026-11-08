// Перед `pnpm dev`: ждём Postgres, применяем миграции и сид (идемпотентный).
import { execSync } from 'node:child_process';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const deadline = Date.now() + 60_000;

for (;;) {
  try {
    execSync('prisma migrate deploy', { stdio: 'pipe' });
    break;
  } catch (err) {
    if (Date.now() > deadline) {
      console.error(String(err.stderr ?? err));
      console.error('[arenahub] Postgres недоступен. Запущен ли `docker compose up -d`?');
      process.exit(1);
    }
    console.warn('[arenahub] Жду Postgres…');
    await new Promise((r) => setTimeout(r, 2000));
  }
}
run('prisma db seed');
