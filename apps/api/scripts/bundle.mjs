// Сборка API для Vercel в один файл: функция не зависит от раскладки node_modules в pnpm-монорепе.
// Вход — dist/main.js после `nest build` (tsc уже вывел метаданные декораторов).
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
  ],
});
