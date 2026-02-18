# Hubnity Backend — Архитектурный аудит

**Цель:** Структурированный отчёт для быстрого погружения в контекст (onboarding другой нейросети/разработчика).

---

## 1. Технологический стек

| Категория | Технология |
|-----------|-------------|
| **Runtime** | Node.js 20 |
| **Framework** | NestJS 11 |
| **ORM** | Prisma 6.18 |
| **БД** | PostgreSQL 16 |
| **Кэш / очереди** | Redis 7 (ioredis), BullMQ (@nestjs/bullmq) |
| **Хранилище файлов** | AWS S3 SDK (Minio-compatible), sharp (обработка изображений) |
| **Auth** | JWT (passport-jwt), bcrypt |
| **Валидация** | class-validator, class-transformer |
| **Документация** | Swagger/OpenAPI |
| **Логирование** | nestjs-pino, pino-pretty |
| **Мониторинг** | Sentry |
| **Rate limiting** | @nestjs/throttler, express-rate-limit |
| **Realtime** | Socket.IO (@nestjs/websockets, @nestjs/platform-socket.io) |
| **Планировщик** | @nestjs/schedule (Cron) |

---

## 2. Архитектурный паттерн

**Тип:** Layered + Module-based (NestJS default). Не Clean/Hexagonal — бизнес-логика смешана с инфраструктурой в сервисах.

**Путь запроса:**
```
HTTP Request
  → main.ts (express.json, body limit middleware, CORS)
  → ValidationPipe (global, whitelist, forbidNonWhitelisted)
  → Controller (JwtAuthGuard, RolesGuard, @GetUser())
  → Service (PrismaService, CacheService, EventsGateway, etc.)
  → Prisma → PostgreSQL
  → Response
```

**Слои:**
- **Controllers** — тонкие, делегируют в сервисы, используют DTO
- **Services** — основная логика, прямые вызовы Prisma, Redis, S3
- **Prisma** — единственный слой доступа к БД (нет репозиториев)
- **Guards/Decorators** — JWT, RBAC (RolesGuard + @Roles)

**Особенности:**
- Нет Domain Layer — сущности = Prisma-модели
- Нет Application Services — бизнес-логика в NestJS-сервисах
- Кросс-модульные зависимости через прямые инжекты (TimeEntriesService → ScreenshotsService, NotificationsService, EventsGateway)

---

## 3. Модель данных

**Ключевые сущности:**

| Сущность | Назначение | Связи |
|----------|------------|-------|
| **Company** | Тенант, настройки трекинга | 1:N User, Project, BlockedUrl, Invitation |
| **User** | Сотрудник, роли (OWNER/ADMIN/MANAGER/EMPLOYEE) | N:1 Company, 1:N TimeEntry, Activity, Notification |
| **Project** | Проект для учёта времени | N:1 Company, 1:N TimeEntry |
| **TimeEntry** | Запись времени (старт/стоп/пауза) | N:1 User, Project; 1:N Screenshot, AppActivity, UrlActivity |
| **Screenshot** | Скриншот привязан к TimeEntry | N:1 TimeEntry |
| **Activity** | События START/STOP/PAUSE/RESUME | N:1 User, Project |
| **AppActivity** | Использование приложений | N:1 TimeEntry, User |
| **UrlActivity** | Использование URL | N:1 TimeEntry, User |
| **Notification** | Уведомления (approve/reject) | N:1 User |
| **RefreshToken** | JWT refresh | N:1 User |
| **Invitation** | Приглашения в компанию | N:1 Company, User (inviter) |

**Тяжёлые агрегаты:**
- **TimeEntry** — центральная сущность: связана с Screenshot, AppActivity, UrlActivity. При удалении TimeEntry — cascade delete на Screenshot. S3/локальные файлы удаляются явно через `ScreenshotsService.deleteFilesForTimeEntry()` перед удалением TimeEntry.
- **Analytics** — агрегирует TimeEntry по дням/проектам, raw SQL (`$queryRawUnsafe`) для `getHoursByDay`, `getHoursByProject`.

**Индексы:** Prisma schema содержит индексы на userId, projectId, startTime, status, approvalStatus, idempotencyKey. Partial unique index `idx_time_entries_one_active_per_user` для одного активного таймера на пользователя.

**Timezone в аналитике:** `getHoursByDay` группирует по локальной дате (AT TIME ZONE COALESCE(te.timezone, 'UTC')) — исправлено (LOGICAL_FLAWS_AUDIT 6.3).

---

## 4. Бизнес-логика

**Расположение:** В сервисах (Services). Доменных моделей нет.

**Ключевые правила:**

| Правило | Где | Описание |
|---------|-----|----------|
| Один активный таймер | TimeEntriesService.create() | Проверка RUNNING/PAUSED перед созданием |
| Sync overlap | TimeEntriesService.sync() | Исправлено: ensureNoActiveOverlapOrAutoStop + partial unique index |
| RBAC | RolesGuard, сервисы | OWNER/ADMIN — approve, MANAGER — видит pending компании |
| EMPLOYEE + project | TimeEntriesService.create() | projectId обязателен для EMPLOYEE |
| Idempotency | TimeEntriesService.sync() | idempotencyKey для дедупликации |
| S3 cleanup | ScreenshotsService | deleteFilesForTimeEntry/User вызываются из TimeEntriesService, UsersService перед cascade delete |

**Хранимые процедуры:** Нет. Вся логика в TypeScript.

**Кэширование:** CacheService (Redis) — company profile, tracking settings, projects, users. TTL 300–600s. Инвалидация при update через `invalidateCompanySettings`, `invalidateProjects`, etc.

---

## 5. Infrastructure & DevOps

**Docker:**
- `Dockerfile` — multi-stage, Node 20-slim, Prisma generate + build
- `docker-compose.yml` — postgres, redis, backend, nginx
- `docker-compose.prod.yml` — production overrides, deploy.replicas (Swarm)
- `docker-compose.npm.yml` — Nginx Proxy Manager, Minio
- `docker-entrypoint.sh` — wait for postgres/redis, `prisma db push` (не migrate deploy)

**Kubernetes:**
- `k8s/` — namespace, configmap, deployment, service, ingress, migration-job, secrets template
- Ingress: nginx, `proxy-body-size: 50m`
- Deployment: 2 replicas, healthcheck `/api/v1/`

**Конфиги:**
- `.env` / `.env.production` — DATABASE_URL, JWT_SECRET, REDIS_*, S3_*, CORS
- ConfigModule (NestJS) — глобальный, envFilePath: ".env"
- Secrets — kubectl create secret или k8s/secrets.yaml (base64)

**Деплой:**
- `scripts/deploy.sh` — pull, `prisma migrate deploy`, `docker compose up -d`
- CI: lint, format, test, build (package.json `ci` script)

---

## 6. Current State & Technical Debt

### 6.1 God Service — TimeEntriesService (~2045 строк)

**Проблема:** Один сервис содержит create, update, pause, resume, stop, sync, approve, reject, bulk-approve, delete, getPending, getActivities и т.д. Нарушение SRP.

**Рекомендация:** Разбить на TimeEntryCrudService, TimeEntryApprovalService, TimeEntrySyncService или выделить use-case handlers.

### 6.2 Sync overlap — логическая ошибка

**Проблема:** `POST /time-entries/sync` не проверяет активный таймер. Можно создать несколько RUNNING для одного пользователя → некорректные отчёты.

**Местоположение:** `src/time-entries/time-entries.service.ts`, метод `sync()`.

**Документация:** LOGICAL_FLAWS_AUDIT.md (п. 1).

### 6.3 Timezone в аналитике

**Проблема:** `getHoursByDay` использует `date(te."startTime")` — UTC. Поле `timezone` на TimeEntry не используется. Отчёты по дням неверны для non-UTC пользователей.

**Местоположение:** `src/analytics/analytics.service.ts`, `getHoursByDay()`.

**Документация:** LOGICAL_FLAWS_AUDIT.md (п. 2).

### 6.4 Критические уязвимости (потенциальные)

- **CORS:** В production `!origin` → `callback(null, true)` — разрешает запросы без Origin (health checks, Tauri). Риск CSRF при неправильной настройке ALLOWED_ORIGINS.
- **Body limit:** 10MB по умолчанию, Content-Length check до парсинга — защита от OOM. Ingress 50m — рассогласование при BODY_SIZE_LIMIT=10mb.
- **Rate limit:** 100 req/min в production — может быть мало для batch-операций (sync, app-activity batch).

---

## 7. Entry Points

| Файл | Назначение |
|------|------------|
| `src/main.ts` | Bootstrap, CORS, ValidationPipe, body limit, Swagger |
| `src/app.module.ts` | Корневой модуль, импорты всех feature-модулей |
| `prisma/schema.prisma` | Модель данных, индексы |
| `src/auth/auth.service.ts` | Регистрация, логин, JWT, refresh |
| `src/time-entries/time-entries.service.ts` | Ядро бизнес-логики (таймеры, sync, approve) |
| `src/time-entries/time-entries.controller.ts` | REST API time-entries |
| `src/companies/companies.service.ts` | Настройки компании, tracking, cache |
| `src/analytics/analytics.service.ts` | Отчёты, raw SQL |
| `src/events/events.gateway.ts` | WebSocket, broadcast настроек |
| `src/s3/s3.service.ts` | S3/Minio, auto-create bucket |
| `src/cache/cache.service.ts` | Redis cache, invalidation |

**Рекомендуемый порядок погружения:**
1. `prisma/schema.prisma` — модель данных
2. `src/main.ts` — pipeline запроса
3. `src/auth/` — аутентификация
4. `src/time-entries/time-entries.service.ts` — основная логика
5. `src/companies/`, `src/analytics/` — вспомогательные домены
