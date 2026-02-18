# Zero Downtime Deploy — Hubnity Backend

## Обзор

Конфигурация для обновления без простоя на VPS (12 ядер, 24 ГБ ОЗУ) с 3 репликами backend.

## 1. Docker Compose — deploy-конфиг

В `docker-compose.prod.yml` для backend:

```yaml
deploy:
  replicas: 3
  update_config:
    parallelism: 1      # Обновлять по 1 контейнеру
    order: start-first  # Сначала запустить новый, потом остановить старый
    failure_action: rollback
    delay: 10s
```

**Важно:** `deploy` работает только в **Docker Swarm**. Для обычного `docker compose up` используйте `--scale backend=3`.

## 2. Healthcheck

- **Dockerfile:** `wget http://localhost:3001/api/v1/` — проверка после полного старта NestJS
- **docker-compose:** `start_period: 90s` — даёт время на запуск приложения
- Nginx получает трафик только на контейнеры в состоянии `healthy`

## 3. deploy.sh

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

Скрипт выполняет:
1. `docker compose pull backend`
2. `docker compose run --rm backend npx prisma migrate deploy`
3. `docker compose up -d --no-deps --scale backend=3 backend`

Для Swarm: `./scripts/deploy.sh --swarm`

## 4. Nginx — балансировка между 3 репликами

### Вариант A: Внутренний Nginx (текущий)

`nginx/nginx.conf` уже настроен:
- `resolver 127.0.0.11` — Docker DNS, переразрешение каждые 10 с
- `set $backend_upstream backend` — runtime-разрешение имени
- Трафик распределяется между всеми репликами `backend`

### Вариант B: Nginx Proxy Manager (внешний)

1. Создайте **Proxy Host** для вашего домена.
2. В **Details** → **Forward Hostname** укажите имя сервиса backend:
   - Docker Compose: `backend` (или `time-tracker-backend-1`, `-2`, `-3` при scale)
   - Swarm: `backend` (VIP балансирует сам)
3. В **Custom Nginx Configuration** добавьте:

```nginx
# Для балансировки между репликами (если NPM проксирует на один хост)
upstream hubnity_backend {
    least_conn;
    server backend:3001 max_fails=3 fail_timeout=30s;
    keepalive 32;
}
```

Если NPM и backend в одной Docker-сети, `backend` резолвится во все реплики. Иначе укажите IP/порты каждого контейнера.

### Вариант C: Ручной конфиг Nginx на хосте

```nginx
upstream hubnity_backend {
    least_conn;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s;  # если порты проброшены
    server 127.0.0.1:3002 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3003 max_fails=3 fail_timeout=30s;
    keepalive 32;
}

server {
    listen 80;
    server_name app.example.com;
    location / {
        proxy_pass http://hubnity_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Для этого нужно пробросить порты 3001–3003 с контейнеров на хост (в `docker-compose` или через `ports`).

### Рекомендация

Используйте **внутренний Nginx** из `nginx/nginx.conf`: он уже настроен на балансировку через Docker DNS. Внешний NPM/nginx проксирует на `localhost:9090` (порт внутреннего Nginx).
