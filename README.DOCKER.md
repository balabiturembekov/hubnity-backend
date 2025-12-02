# 🐳 Docker Deployment Guide

Руководство по развертыванию приложения Time Tracker с помощью Docker Compose.

## 📋 Требования

- Docker Engine 20.10+
- Docker Compose 2.0+
- Минимум 2GB свободной RAM
- Минимум 10GB свободного места на диске

## 🚀 Быстрый старт

### 1. Клонирование и настройка

```bash
# Клонируйте репозиторий
git clone <your-repo-url>
cd server

# Создайте файл .env из примера
cp .env.example .env

# Отредактируйте .env и укажите свои значения
nano .env  # или используйте любой редактор
```

### 2. Обязательные настройки в .env

**КРИТИЧЕСКИ ВАЖНО:** Измените следующие значения перед запуском:

```env
# Генерация безопасного JWT секрета
JWT_SECRET=$(openssl rand -base64 32)

# Надежный пароль для PostgreSQL
POSTGRES_PASSWORD=your-very-secure-password-here

# Надежный пароль для Redis
REDIS_PASSWORD=your-redis-password-here

# URL вашего фронтенда
FRONTEND_URL=https://yourdomain.com
```

### 3. Запуск приложения

```bash
# Сборка и запуск всех сервисов
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Проверка статуса
docker-compose ps
```

### 4. Проверка работоспособности

```bash
# Проверка health check
curl http://localhost:3001/api

# Или откройте в браузере
open http://localhost:3001/api
```

## 📦 Структура сервисов

### Backend (NestJS)

- **Порт:** 3001
- **Health Check:** `GET /api`
- **Volumes:** `uploads_data` (скриншоты и миниатюры)

### PostgreSQL

- **Порт:** 5432 (внутренний, не экспортируется наружу по умолчанию)
- **База данных:** `timetracker`
- **Volumes:** `postgres_data` (персистентное хранилище)

### Redis

- **Порт:** 6379 (внутренний)
- **Volumes:** `redis_data` (персистентное хранилище)

## 🔧 Управление

### Остановка

```bash
# Остановка всех сервисов
docker-compose down

# Остановка с удалением volumes (ОСТОРОЖНО: удалит все данные!)
docker-compose down -v
```

### Перезапуск

```bash
# Перезапуск всех сервисов
docker-compose restart

# Перезапуск конкретного сервиса
docker-compose restart backend
```

### Обновление

```bash
# Остановка
docker-compose down

# Обновление кода (git pull)
git pull

# Пересборка образа
docker-compose build --no-cache backend

# Запуск
docker-compose up -d
```

### Просмотр логов

```bash
# Все сервисы
docker-compose logs -f

# Конкретный сервис
docker-compose logs -f backend
docker-compose logs -f postgres
docker-compose logs -f redis

# Последние 100 строк
docker-compose logs --tail=100 backend
```

## 🗄️ Работа с базой данных

### Подключение к PostgreSQL

```bash
# Через docker exec
docker-compose exec postgres psql -U postgres -d timetracker

# Или через внешний клиент
psql -h localhost -p 5432 -U postgres -d timetracker
```

### Резервное копирование

```bash
# Создание бэкапа
docker-compose exec postgres pg_dump -U postgres timetracker > backup_$(date +%Y%m%d_%H%M%S).sql

# Восстановление из бэкапа
docker-compose exec -T postgres psql -U postgres timetracker < backup.sql
```

### Миграции Prisma

Миграции выполняются автоматически при старте контейнера через `docker-entrypoint.sh`.

Для ручного запуска:

```bash
# Выполнение миграций
docker-compose exec backend npx prisma migrate deploy

# Создание новой миграции (требует доступа к исходникам)
docker-compose exec backend npx prisma migrate dev --name migration_name
```

## 🔒 Безопасность

### Production настройки

1. **Измените все пароли** в `.env`
2. **Используйте сильный JWT_SECRET** (минимум 32 символа)
3. **Настройте firewall** - не открывайте порты PostgreSQL и Redis наружу
4. **Используйте reverse proxy** (Nginx/Traefik) для HTTPS
5. **Регулярно обновляйте образы**:

```bash
docker-compose pull
docker-compose up -d
```

### Использование с Nginx (пример)

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 📊 Мониторинг

### Проверка использования ресурсов

```bash
# Статистика контейнеров
docker stats

# Использование диска
docker system df

# Детальная информация о volumes
docker volume ls
docker volume inspect timetracker-postgres-data
```

### Health Checks

Все сервисы имеют health checks:

```bash
# Проверка статуса health checks
docker-compose ps

# Детальная информация
docker inspect time-tracker-backend | grep -A 10 Health
```

## 🐛 Решение проблем

### Проблема: Контейнер не запускается

```bash
# Проверьте логи
docker-compose logs backend

# Проверьте переменные окружения
docker-compose exec backend env

# Проверьте подключение к БД
docker-compose exec backend npx prisma db push --skip-generate
```

### Проблема: База данных не доступна

```bash
# Проверьте статус PostgreSQL
docker-compose ps postgres

# Проверьте логи
docker-compose logs postgres

# Проверьте подключение
docker-compose exec postgres pg_isready -U postgres
```

### Проблема: Redis не работает

```bash
# Проверьте статус
docker-compose ps redis

# Проверьте подключение
docker-compose exec redis redis-cli ping
```

### Очистка и пересборка

```bash
# Остановка и удаление контейнеров
docker-compose down

# Удаление volumes (ОСТОРОЖНО!)
docker-compose down -v

# Пересборка без кэша
docker-compose build --no-cache

# Запуск заново
docker-compose up -d
```

## 🔄 Production Deployment

Для production используйте `docker-compose.prod.yml`:

```bash
# Запуск с production настройками
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Production конфигурация включает:

- Оптимизированные настройки PostgreSQL
- Увеличенные лимиты памяти для Redis
- Ограничения ресурсов для backend
- Расширенное логирование

## 📝 Полезные команды

```bash
# Просмотр всех контейнеров
docker-compose ps

# Просмотр всех volumes
docker volume ls | grep timetracker

# Просмотр всех networks
docker network ls | grep timetracker

# Очистка неиспользуемых ресурсов
docker system prune -a

# Просмотр использования диска volumes
du -sh /var/lib/docker/volumes/timetracker-*
```

## 🔗 Полезные ссылки

- [Docker Compose документация](https://docs.docker.com/compose/)
- [PostgreSQL документация](https://www.postgresql.org/docs/)
- [Redis документация](https://redis.io/documentation)
- [NestJS документация](https://docs.nestjs.com/)

## 📧 Поддержка

При возникновении проблем:

1. Проверьте логи: `docker-compose logs`
2. Проверьте health checks: `docker-compose ps`
3. Убедитесь, что все переменные окружения установлены правильно
