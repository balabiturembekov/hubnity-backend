# Локальная разработка (без Kubernetes)

Backend поднимается через **npm** + **Docker** (только PostgreSQL и Redis).

## Быстрый старт

```bash
# 1. Поднять PostgreSQL и Redis
npm run dev:db

# 2. (Опционально) Применить миграции
npx prisma migrate dev

# 3. Запустить backend
npm run start:dev
```

Или одной командой:

```bash
npm run dev
```

Backend будет доступен на http://localhost:3001/api

Swagger: http://localhost:3001/api/docs

---

## Команды

| Команда | Описание |
|---------|----------|
| `npm run dev` | Поднять postgres+redis и запустить backend |
| `npm run dev:db` | Только поднять postgres+redis |
| `npm run dev:db:down` | Остановить postgres+redis |
| `npm run start:dev` | Запустить backend (hot reload) |

---

## Переменные окружения

Создайте `.env` на основе `.env.example`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/timetracker?schema=public"
REDIS_HOST="localhost"
REDIS_PORT=6379
REDIS_PASSWORD=""
PORT=3001
JWT_SECRET="your-secret"
FRONTEND_URL="http://localhost:3002"
```

---

## Production (Kubernetes)

Для деплоя на app.automatonsoft.de используется Kubernetes. См. [DEPLOY.md](./DEPLOY.md).
