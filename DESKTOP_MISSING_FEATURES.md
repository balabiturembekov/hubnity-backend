# 📋 Что еще не реализовано для Desktop версии

## ✅ Что УЖЕ реализовано (85%)

### Базовые функции (100%)

- ✅ Аутентификация и авторизация (JWT, refresh tokens)
- ✅ Трекинг времени (start, stop, pause, resume)
- ✅ Скриншоты (загрузка, миниатюры, настройки)
- ✅ Детекция простоя (heartbeat, автоматическая пауза)
- ✅ WebSocket (real-time обновления)
- ✅ Управление проектами и пользователями
- ✅ **Отслеживание приложений (App Tracking)** ⬅️ **НОВОЕ!**

---

## ❌ Что ОТСУТСТВУЕТ (15%)

### 1. **Отслеживание URL (URL Tracking)** 🔴 КРИТИЧНО

**Что нужно реализовать:**

#### Модель данных (Prisma):

```prisma
model UrlActivity {
  id          String    @id @default(uuid())
  timeEntryId String
  userId      String
  url         String    // Полный URL
  domain      String    // Домен (github.com)
  title       String?   // Заголовок страницы
  timeSpent   Int       @default(0) // в секундах
  startTime   DateTime  @default(now())
  endTime     DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  timeEntry TimeEntry @relation(fields: [timeEntryId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([timeEntryId])
  @@index([domain])
  @@index([startTime])
  @@index([userId, startTime])
  @@map("url_activities")
}

model BlockedUrl {
  id        String   @id @default(uuid())
  companyId String
  url       String?  // Конкретный URL (опционально)
  domain    String?  // Домен (опционально)
  pattern   String?  // Regex паттерн (опционально)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@index([domain])
  @@map("blocked_urls")
}
```

#### API эндпоинты:

- `POST /api/url-activity` - создать запись о URL
- `POST /api/url-activity/batch` - batch создание записей
- `GET /api/url-activity/time-entry/:timeEntryId/stats` - статистика по time entry
- `GET /api/url-activity/user/:userId/stats` - статистика по пользователю
- `GET /api/blocked-urls` - получить список заблокированных URL
- `POST /api/blocked-urls` - добавить заблокированный URL
- `DELETE /api/blocked-urls/:id` - удалить заблокированный URL

#### Пример данных:

```json
{
  "timeEntryId": "uuid",
  "url": "https://github.com/user/repo",
  "domain": "github.com",
  "title": "GitHub Repository",
  "timeSpent": 1800
}
```

**Приоритет:** 🔴 КРИТИЧНО - важно для анализа продуктивности

---

### 2. **Геолокация (GPS Tracking)** 🟡 ВАЖНО

**Что нужно реализовать:**

#### Модель данных (Prisma):

```prisma
model Location {
  id          String    @id @default(uuid())
  timeEntryId String?
  userId      String
  latitude    Float
  longitude   Float
  accuracy    Float?    // Точность в метрах
  altitude    Float?    // Высота над уровнем моря
  speed       Float?    // Скорость в м/с
  heading     Float?    // Направление в градусах
  timestamp   DateTime  @default(now())
  createdAt   DateTime  @default(now())

  timeEntry TimeEntry? @relation(fields: [timeEntryId], references: [id], onDelete: SetNull)
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([timeEntryId])
  @@index([timestamp])
  @@index([userId, timestamp])
  @@map("locations")
}

model Office {
  id          String   @id @default(uuid())
  companyId   String
  name        String
  address     String?
  latitude    Float
  longitude   Float
  radius      Float    @default(100) // Радиус в метрах
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId])
  @@map("offices")
}
```

#### API эндпоинты:

- `POST /api/locations` - отправить геолокацию
- `POST /api/locations/batch` - batch отправка геолокации
- `GET /api/locations?timeEntryId=...` - получить историю местоположений
- `GET /api/offices` - получить список офисов компании
- `POST /api/offices` - создать офис
- `PATCH /api/offices/:id` - обновить офис
- `DELETE /api/offices/:id` - удалить офис
- `GET /api/locations/geofence-check` - проверить нахождение в офисе

#### Пример данных:

```json
{
  "timeEntryId": "uuid",
  "latitude": 40.7128,
  "longitude": -74.006,
  "accuracy": 10,
  "altitude": 50,
  "speed": 0
}
```

**Приоритет:** 🟡 ВАЖНО - полезно для мобильных сотрудников

---

### 3. **Batch операции для синхронизации** 🟡 ВАЖНО

**Что нужно реализовать:**

#### API эндпоинты:

- `POST /api/time-entries/batch` - batch создание time entries
- `POST /api/screenshots/batch` - batch загрузка скриншотов
- `POST /api/sync` - универсальная синхронизация offline данных

#### Пример универсальной синхронизации:

```json
{
  "timeEntries": [
    {
      "id": "local-uuid-1",
      "projectId": "uuid",
      "startTime": "2024-01-01T10:00:00Z",
      "duration": 3600,
      "description": "Work"
    }
  ],
  "screenshots": [
    {
      "id": "local-uuid-2",
      "timeEntryId": "local-uuid-1",
      "image": "base64...",
      "timestamp": "2024-01-01T10:30:00Z"
    }
  ],
  "appActivities": [
    {
      "timeEntryId": "local-uuid-1",
      "appName": "Chrome",
      "timeSpent": 1800
    }
  ],
  "urlActivities": [
    {
      "timeEntryId": "local-uuid-1",
      "url": "https://github.com",
      "timeSpent": 900
    }
  ]
}
```

**Примечание:** Batch операции для App Activity уже реализованы (`POST /api/app-activity/batch`)

**Приоритет:** 🟡 ВАЖНО - необходимо для офлайн режима

---

### 4. **Оптимизированные эндпоинты для desktop** 🟢 ЖЕЛАТЕЛЬНО

**Что нужно реализовать:**

- Минимальный payload для получения данных (только необходимые поля)
- Поддержка фильтрации на стороне сервера (query параметры)
- Пагинация для больших списков (`?page=1&limit=50`)
- Сжатие ответов (gzip) - обычно настраивается на уровне Nginx
- Оптимизированные запросы к БД (select только нужные поля)

**Пример:**

```typescript
GET /api/time-entries/my?fields=id,startTime,duration,status&page=1&limit=50
```

**Приоритет:** 🟢 ЖЕЛАТЕЛЬНО - улучшит производительность

---

### 5. **Расширенная активность (Keystrokes, Mouse)** 🟢 ОПЦИОНАЛЬНО

**Что нужно реализовать:**

#### Модель данных (Prisma):

```prisma
model ActivityMetrics {
  id          String   @id @default(uuid())
  timeEntryId String
  userId      String
  keystrokes  Int      @default(0)
  mouseClicks Int      @default(0)
  mouseDistance Float  @default(0) // в пикселях
  scrollDistance Float  @default(0) // в пикселях
  timestamp   DateTime @default(now())
  createdAt   DateTime @default(now())

  timeEntry TimeEntry @relation(fields: [timeEntryId], references: [id], onDelete: Cascade)
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([timeEntryId])
  @@index([timestamp])
  @@map("activity_metrics")
}
```

#### API эндпоинты:

- `POST /api/activity-metrics` - отправить метрики активности
- `POST /api/activity-metrics/batch` - batch отправка метрик
- `GET /api/activity-metrics/time-entry/:timeEntryId` - получить метрики для time entry

**Примечание:** Обычно эти данные агрегируются на клиенте и отправляются как часть heartbeat или отдельными запросами.

**Приоритет:** 🟢 ОПЦИОНАЛЬНО - можно реализовать позже

---

## 📊 Итоговая оценка

### Готовность: **85%** ⬆️

**Реализовано:**

- ✅ Базовые функции (100%)
- ✅ Отслеживание приложений (100%)

**Осталось:**

- ❌ Отслеживание URL (критично)
- ❌ Геолокация (важно)
- ❌ Batch операции (частично)
- ❌ Оптимизация (желательно)

---

## 🎯 Рекомендации по приоритетам

### Приоритет 1 (Критично):

1. **Отслеживание URL** - без этого невозможно полноценно анализировать продуктивность

### Приоритет 2 (Важно):

2. **Batch операции** - необходимо для офлайн режима
3. **Геолокация** - полезно для мобильных сотрудников

### Приоритет 3 (Желательно):

4. **Оптимизированные эндпоинты** - улучшит производительность
5. **Расширенная активность** - можно реализовать позже
