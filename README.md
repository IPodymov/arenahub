# ArenaHub

Платформа онлайн-турниров по Dota 2, CS2, Clash Royale и Brawl Stars.
Монорепо: pnpm workspaces + Turborepo.

| Пакет             | Что внутри                                                                          |
| ----------------- | ----------------------------------------------------------------------------------- |
| `apps/api`        | NestJS (модульный монолит), Prisma 7 + PostgreSQL, сессии в Redis, Passport (Steam) |
| `apps/web`        | Next.js 16 (App Router), Tailwind v4, компоненты в стиле shadcn/ui, TanStack Query  |
| `packages/shared` | zod-схемы DTO, enum'ы, коды доменных ошибок, утилиты возраста и денег               |

## Запуск

Нужны Node.js 24+, pnpm 11 и Docker.

```bash
pnpm i                  # зависимости, Prisma Client, .env из .env.example
pnpm dev                # docker compose (Postgres :55432, Redis :56379), миграции + сид, API :4000, web http://localhost:3000
```

Зарегистрироваться и войти можно на `/login` по никнейму и паролю. Чтобы получить админку,
добавьте свой никнейм в `ADMIN_NICKNAMES` и войдите заново.

Роли:

- **Пользователь** предлагает турнир (`/proposals`); в каталог он попадёт после одобрения. Одновременно
  на рассмотрении — не больше трёх предложений.
- **Модератор** создаёт и публикует турниры сразу, ведёт их статусы, одобряет или отклоняет
  предложения с комментарием (`/admin/tournaments`). Удаляет только неопубликованные.
- **Администратор** — всё то же, плюс назначает роли, блокирует пользователей (`/admin/users`)
  и может удалить любой турнир вместе с сеткой.

Демо-данные (96 игроков-ботов без пароля, команды, 16 турниров во всех фазах, у сыгранных — сетка
и призы в рублях) локально создаются автоматически. Даты считаются от момента запуска, обновить:
`pnpm --filter @arenahub/api db:demo -- --reset`.
Dev-вход (без пароля, с галочкой «как администратор») включается `AUTH_DEV_LOGIN=true` в `.env`.
Для входа через Steam укажите `STEAM_API_KEY` (https://steamcommunity.com/dev/apikey)
и свой steamid64 в `ADMIN_STEAM_IDS`. Steam возвращает пользователя на `WEB_ORIGIN`.

## Команды

```bash
pnpm lint | typecheck | build
pnpm test        # unit: доменные правила (возраст, политика игры, слоты, состав)
pnpm test:e2e    # e2e против БД arenahub_test (создаётся docker-compose)
pnpm db:migrate  # новая миграция (prisma migrate dev)
pnpm db:studio
```

## Деплой (Vercel)

Один проект Vercel на [Services](https://vercel.com/docs/services) (`vercel.json`): `apps/web` (Next.js)
и `apps/api` (NestJS, одна функция Fluid compute) деплоятся вместе, регион `fra1`.
`/api/v1/*` уходит в API, остальное — в Next, поэтому cookie сессии остаётся первосторонней.

- Push в `main` — продакшен, остальные ветки и PR — превью (Git-интеграция).
- Postgres — Neon, Redis — Upstash (Vercel Marketplace), переменные подключения прописаны в проект.
- Миграции применяются при сборке API (`prisma migrate deploy` через `DATABASE_URL_UNPOOLED`).
  Превью сейчас смотрят в ту же базу, что и прод.
- В проекте заданы `SESSION_SECRET`, `AUTH_DEV_LOGIN=false`; `WEB_ORIGIN` по умолчанию — продовый домен.
- Справочник игр в новую базу: `NODE_ENV=production DATABASE_URL=… pnpm --filter @arenahub/api exec tsx prisma/seed.ts`.
- Демо-турниры в базу: `DATABASE_URL=… pnpm --filter @arenahub/api db:demo -- --reset`.
- Аватары API обрабатывает (`sharp`, 256×256 WebP) и кладёт в публичный Vercel Blob
  (`BLOB_STORE_ID` через OIDC или `BLOB_READ_WRITE_TOKEN`; в production без них API не стартует).
  `sharp` — нативный модуль, `scripts/bundle.mjs` ставит его в `vercel-dist/node_modules`.
  Без учётных данных Blob (локально, e2e) файлы пишутся в `uploads/` в корне и отдаются по `/api/v1/uploads/*`.

## Архитектура

- **Бизнес-правила** — чистые функции в `apps/api/src/modules/*/domain` и `team-rules.ts`;
  сервисы загружают данные и вызывают их, контроллеры только валидируют вход zod-схемами из `shared`.
  Фронт дублирует проверки лишь для подсказок.
- **Политика игры** (`GamePolicy`): платный вход, лимиты, источники призов, минимальный возраст,
  форматы, запасные, способ проверки результата, обязательный аккаунт. Для Clash Royale и Brawl Stars
  платный вход запрещён в домене (создание турнира и регистрация) и дополнительно триггером в БД.
- **Возраст** считается по московскому календарю. Платформа — с 16 лет, платные турниры и кошелёк — с 18.
  Дату рождения пользователь указывает один раз.
- **Фаза турнира** (`Регистрация / Идёт / Завершён`) вычисляется из статуса и дат — без cron.
- **Регистрация** атомарна: строка турнира блокируется `SELECT … FOR UPDATE`; один игрок — одно место
  в турнире (частичный уникальный индекс). Платная заявка до появления кошелька — `PENDING_PAYMENT`.
- **Деньги** — только копейки в `BigInt`, в JSON — строкой. Таблицы леджера (двойная запись,
  идемпотентность, неизменяемые проводки) созданы заранее, логики пока нет.
- **Сетка** — single elimination с матчем за 3-е место. Места и выплаты считает `domain/standings.ts`:
  выбывшие в одном раунде делят места (5–8) и поровну — сумму призов за них. Пока матчи заполняет
  только демо-сид; проведение матчей и споры — следующие итерации.

## API (`/api/v1`)

|                                                                                               |                                  |
| --------------------------------------------------------------------------------------------- | -------------------------------- |
| `GET /auth/steam`, `GET /auth/steam/return`                                                   | вход через Steam                 |
| `POST /auth/register`, `POST /auth/login`                                                     | никнейм + пароль                 |
| `POST /auth/dev-login`                                                                        | вход без Steam (только dev/test) |
| `POST /auth/logout`, `GET /auth/me`, `GET /auth/providers`                                    |                                  |
| `PATCH /users/me`, `PUT /users/me/birth-date`, `GET /users/:id`                               | профиль                          |
| `GET /games`, `GET /games/:code`                                                              | игры и политики                  |
| `POST /teams`, `GET /teams/mine`, `GET/PATCH /teams/:id`                                      | команды                          |
| `POST /teams/:id/invites`, `DELETE /teams/:id/invites/:inviteId`                              | ссылки-приглашения               |
| `GET /invites/:token`, `POST /invites/:token/accept`                                          | вступление по ссылке             |
| `POST /teams/:id/leave`, `POST /teams/:id/captain`, `PATCH/DELETE /teams/:id/members/:userId` | состав                           |
| `GET /tournaments?tab&game&teamSize&category&paid&page&pageSize`                              | каталог                          |
| `GET /tournaments/:slug`, `GET /tournaments/:slug/{participants,bracket}`                     | турнир, участники, сетка и итоги |
| `POST /proposals`, `GET /proposals/mine`, `DELETE /proposals/:id`                             | предложения турниров             |
| `POST /tournaments/:slug/registrations`, `GET/DELETE …/registrations/mine`                    | регистрация                      |
| `GET/POST /admin/tournaments?status`, `GET/PATCH/DELETE /admin/tournaments/:id`               | модерация (модератор и админ)    |
| `POST /admin/tournaments/:id/{approve,publish,start,complete,cancel}`, `…/reject`             | смена статуса, рассмотрение      |
| `GET /admin/users?q&role`, `PATCH /admin/users/:id/role`, `POST /admin/users/:id/{ban,unban}` | роли и баны (только админ)       |

Доменные ошибки: `422 { code, message, details }` (404/403/409 для «не найдено», «нет прав», «конфликт»);
коды и русские тексты — в `packages/shared/src/errors.ts`.
