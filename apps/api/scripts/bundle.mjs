// Сборка API для Vercel в один файл: функция не зависит от раскладки node_modules в pnpm-монорепе.
// Вход — dist/main.js после `nest build` (tsc уже вывел метаданные декораторов).
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

await build({
  entryPoints: ['dist/main.js'],
  outfile: 'vercel-dist/main.js',
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  sourcemap: true,
  logLevel: 'warning',
  // Необязательные модули Nest и драйверов: подключаются лениво и в проекте не используются
  external: [
    '@nestjs/microservices',
    '@nestjs/microservices/*',
    '@nestjs/websockets',
    '@nestjs/websockets/*',
    'class-transformer',
    'class-transformer/*',
    'class-validator',
    'pg-native',
    // Нативный модуль, в бандл не встраивается — ставится рядом (ниже)
    'sharp',
  ],
});

// sharp с бинарником под платформу сборки кладём в vercel-dist/node_modules — там его найдёт функция
const { version } = JSON.parse(
  readFileSync(new URL('../node_modules/sharp/package.json', import.meta.url), 'utf8'),
);
writeFileSync(
  'vercel-dist/package.json',
  JSON.stringify({ private: true, dependencies: { sharp: version } }, null, 2),
);
execFileSync('npm', ['install', '--omit=dev', '--no-package-lock', '--no-audit', '--no-fund'], {
  cwd: 'vercel-dist',
  stdio: 'inherit',
});
