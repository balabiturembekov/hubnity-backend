# 🚀 Быстрый старт

## Минимальная настройка для запуска

### 1. Создайте файл `.env`

```bash
cp .env.example .env
```

### 2. Минимальные настройки в `.env`

```env
# Обязательно измените эти значения!
JWT_SECRET=your-super-secret-key-here-min-32-chars
POSTGRES_PASSWORD=your-secure-password
REDIS_PASSWORD=your-redis-password

# Остальное можно оставить по умолчанию
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://localhost:3002
```

### 3. Запуск

```bash
# Сборка и запуск
docker-compose up -d

# Просмотр логов
docker-compose logs -f backend
```

### 4. Проверка

```bash
# Проверка API
curl http://localhost:3001/api

# Или откройте в браузере
open http://localhost:3001/api
```

## Остановка

```bash
docker-compose down
```

## Полная документация

См. [README.DOCKER.md](./README.DOCKER.md) для детальной информации.

