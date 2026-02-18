# Настройка системного nginx для app.automatonsoft.de

После миграции на Kubernetes nginx на хосте должен проксировать на Ingress (порт 31728).

## 1. Проверить существующий конфиг и сертификаты

```bash
# Где лежат конфиги nginx
ls -la /etc/nginx/sites-enabled/

# Сертификаты Let's Encrypt
sudo ls -la /etc/letsencrypt/live/
```

Если домен `app.automatonsoft.de` уже есть в certbot, сертификаты будут в `/etc/letsencrypt/live/app.automatonsoft.de/`.

## 2. Обновить конфиг nginx

**Вариант A — есть старый конфиг** (например `/etc/nginx/sites-available/app.automatonsoft.de`):

Отредактируйте `proxy_pass` — замените адрес бэкенда на `http://127.0.0.1:31728`:

```nginx
location / {
    proxy_pass http://127.0.0.1:31728;   # было: http://localhost:9090 или backend:3001
    proxy_set_header Host app.automatonsoft.de;
    # ... остальные proxy_set_header
}
```

**Вариант B — новый конфиг** из репозитория:

```bash
cd ~/hubnity-backend
sudo cp nginx/host-nginx-app.automatonsoft.de.conf /etc/nginx/sites-available/app.automatonsoft.de
sudo ln -sf /etc/nginx/sites-available/app.automatonsoft.de /etc/nginx/sites-enabled/
```

Если пути к сертификатам другие — поправьте `ssl_certificate` и `ssl_certificate_key` в конфиге.

## 3. Проверить и перезагрузить nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 4. Проверка

```bash
curl -I https://app.automatonsoft.de/api
curl https://app.automatonsoft.de/api
```

## Если сертификаты истекли

```bash
sudo certbot renew
sudo systemctl reload nginx
```
