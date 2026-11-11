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

Войти можно через **Dev-вход** на `/login` (галочка «как администратор» даёт админку).
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
- Таблицы матчей, споров и новостей созданы на будущее, логики к ним нет.

## API (`/api/v1`)

|                                                                                               |                                  |
| --------------------------------------------------------------------------------------------- | -------------------------------- |
| `GET /auth/steam`, `GET /auth/steam/return`                                                   | вход через Steam                 |
| `POST /auth/dev-login`                                                                        | вход без Steam (только dev/test) |
| `POST /auth/logout`, `GET /auth/me`, `GET /auth/providers`                                    |                                  |
| `PATCH /users/me`, `PUT /users/me/birth-date`, `GET /users/:id`                               | профиль                          |
| `GET /games`, `GET /games/:code`                                                              | игры и политики                  |
| `POST /teams`, `GET /teams/mine`, `GET/PATCH /teams/:id`                                      | команды                          |
| `POST /teams/:id/invites`, `DELETE /teams/:id/invites/:inviteId`                              | ссылки-приглашения               |
| `GET /invites/:token`, `POST /invites/:token/accept`                                          | вступление по ссылке             |
| `POST /teams/:id/leave`, `POST /teams/:id/captain`, `PATCH/DELETE /teams/:id/members/:userId` | состав                           |
| `GET /tournaments?tab&game&teamSize&category&paid&page&pageSize`                              | каталог                          |
| `GET /tournaments/:slug`, `GET /tournaments/:slug/participants`                               |                                  |
| `POST /tournaments/:slug/registrations`, `GET/DELETE …/registrations/mine`                    | регистрация                      |
| `GET/POST /admin/tournaments`, `GET/PATCH/DELETE /admin/tournaments/:id`                      | админка                          |
| `POST /admin/tournaments/:id/{publish,start,complete,cancel}`                                 | смена статуса                    |

Доменные ошибки: `422 { code, message, details }` (404/403/409 для «не найдено», «нет прав», «конфликт»);
коды и русские тексты — в `packages/shared/src/errors.ts`.
