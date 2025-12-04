# 🖥️ Настройка CORS для Tauri Desktop приложения

## ✅ Поддержка Tauri добавлена!

CORS конфигурация теперь поддерживает Tauri desktop приложения.

## 🔧 Как это работает

### В Development режиме (локально)

**Автоматически разрешены:**

- ✅ `tauri://localhost`
- ✅ `http://tauri.localhost`
- ✅ `https://tauri.localhost`
- ✅ `http://localhost:*` (все порты)
- ✅ Запросы без origin (для Tauri)

**Ничего настраивать не нужно!** Просто запускайте Tauri приложение локально.

### В Production режиме (на сервере)

Для работы Tauri desktop приложения с production API нужно добавить Tauri origins в переменную окружения `ALLOWED_ORIGINS`.

#### Вариант 1: Через переменную окружения (рекомендуется)

В `.env` или `docker-compose.yml` добавьте:

```bash
ALLOWED_ORIGINS=tauri://localhost,http://tauri.localhost,https://tauri.localhost
```

Или если у вас уже есть другие origins:

```bash
ALLOWED_ORIGINS=https://your-frontend.com,tauri://localhost,http://tauri.localhost
```

#### Вариант 2: Через docker-compose.yml

```yaml
backend:
  environment:
    ALLOWED_ORIGINS: "https://app.automatonsoft.de,tauri://localhost,http://tauri.localhost"
```

## 📝 Пример настройки в Tauri

В вашем Tauri приложении (`tauri.conf.json` или `src-tauri/tauri.conf.json`):

```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:3000",
    "distDir": "../dist"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "http": {
        "all": false,
        "request": true,
        "scope": ["http://localhost:*", "https://app.automatonsoft.de/**"]
      }
    },
    "security": {
      "csp": null
    }
  }
}
```

## 🔍 Как проверить, что CORS работает

### 1. Проверка в браузере (DevTools)

Откройте DevTools в Tauri приложении и проверьте Network tab:

- Запросы должны проходить без CORS ошибок
- В заголовках ответа должен быть `Access-Control-Allow-Origin`

### 2. Проверка через curl

```bash
# Проверка с Tauri origin
curl -H "Origin: tauri://localhost" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type,Authorization" \
     -X OPTIONS \
     https://app.automatonsoft.de/api/auth/login

# Должен вернуть:
# Access-Control-Allow-Origin: tauri://localhost
```

### 3. Проверка логов на сервере

В логах backend вы увидите:

```
🔒 CORS Configuration: {
  allowedOrigins: [ 'tauri://localhost', 'http://tauri.localhost', ... ],
  ...
}
CORS: Allowing Tauri origin: tauri://localhost
```

## 🚨 Возможные проблемы и решения

### Проблема: CORS блокирует запросы из Tauri

**Решение:**

1. Убедитесь, что `ALLOWED_ORIGINS` содержит `tauri://localhost`
2. Проверьте, что `NODE_ENV=production` на сервере
3. Перезапустите backend после изменения переменных окружения

### Проблема: Запросы без origin блокируются

**Решение:**

- В development режиме запросы без origin разрешены автоматически
- В production добавьте `tauri://localhost` в `ALLOWED_ORIGINS`

### Проблема: Tauri отправляет другой origin

**Решение:**

- Проверьте, какой origin отправляет Tauri (в DevTools Network tab)
- Добавьте этот origin в `ALLOWED_ORIGINS`

## 📚 Дополнительная информация

### Tauri версии

- **Tauri v1**: Использует `tauri://localhost` или `http://localhost`
- **Tauri v2**: Может использовать `http://localhost` или без origin

Текущая конфигурация поддерживает оба варианта.

### Безопасность

⚠️ **Важно:** В production режиме CORS строго контролируется. Убедитесь, что:

- Добавлены только нужные origins
- Не используется `*` (allow all) в production
- Tauri origins добавлены только если действительно используется desktop приложение

## ✅ Итог

Для локальной разработки:

- ✅ **Ничего настраивать не нужно** - все работает автоматически

Для production:

- ✅ Добавьте `tauri://localhost` в `ALLOWED_ORIGINS`
- ✅ Перезапустите backend
- ✅ Готово!
