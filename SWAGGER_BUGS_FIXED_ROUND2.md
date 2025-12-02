# Исправления Swagger документации (Раунд 2)

## Итоги проверки

### Найдено и исправлено 4 бага

#### BUG 1: Time Entries Controller - Отсутствует статус 401 для `GET /:id`

**Файл**: `src/time-entries/time-entries.controller.ts`

**Проблема**:

- Эндпоинт `GET /time-entries/:id` использует `@UseGuards(JwtAuthGuard)`, поэтому может вернуть статус 401 (неавторизован)
- В Swagger документации отсутствовал `@ApiResponse` для статуса 401

**Исправление**: Добавлен `@ApiResponse({ status: 401, description: "Не авторизован" })` перед `findOne` методом

---

#### BUG 2: Users Controller - Отсутствует статус 401 и 404 для `PATCH /me`

**Файл**: `src/users/users.controller.ts`

**Проблема**:

- Эндпоинт `PATCH /users/me` использует `@UseGuards(JwtAuthGuard)`, поэтому может вернуть статус 401
- Сервис `usersService.update` может выбросить `NotFoundException` (404), если пользователь не найден
- В Swagger документации отсутствовали `@ApiResponse` для статусов 401 и 404

**Исправление**: Добавлены `@ApiResponse` для статусов 401 и 404

---

#### BUG 3: Screenshots Controller - Отсутствует статус 401 для `DELETE /:id`

**Файл**: `src/screenshots/screenshots.controller.ts`

**Проблема**:

- Эндпоинт `DELETE /screenshots/:id` использует `@UseGuards(JwtAuthGuard)`, поэтому может вернуть статус 401
- В Swagger документации отсутствовал `@ApiResponse` для статуса 401

**Исправление**: Добавлен `@ApiResponse({ status: 401, description: "Не авторизован" })` перед `delete` методом

---

#### BUG 4: Idle Detection Controller - Отсутствует статус 404 для `GET /status`

**Файл**: `src/idle-detection/idle-detection.controller.ts`

**Проблема**:

- Сервис `idleDetectionService.getUserActivityStatus` может выбросить `NotFoundException` (404), если пользователь не найден или неактивен (строка 497 в `idle-detection.service.ts`)
- В Swagger документации отсутствовал `@ApiResponse` для статуса 404

**Исправление**: Добавлен `@ApiResponse({ status: 404, description: "Пользователь не найден или неактивен" })` перед `getStatus` методом

---

## Статистика

- **Всего исправлено**: 4 бага
- **Категории**:
  - Отсутствующие статусы ответов: 4 бага
    - Статус 401 (неавторизован): 3 бага
    - Статус 404 (не найдено): 2 бага

## Результаты

- ✅ Все эндпоинты с `@UseGuards(JwtAuthGuard)` имеют статус 401 в документации
- ✅ Все эндпоинты, которые могут выбросить `NotFoundException`, имеют статус 404 в документации
- ✅ Swagger документация теперь полностью соответствует реальной логике приложения

## Проверенные модули

1. **Time Entries** (`src/time-entries/time-entries.controller.ts`) - ✅ Исправлено
2. **Users** (`src/users/users.controller.ts`) - ✅ Исправлено
3. **Screenshots** (`src/screenshots/screenshots.controller.ts`) - ✅ Исправлено
4. **Idle Detection** (`src/idle-detection/idle-detection.controller.ts`) - ✅ Исправлено

## Рекомендации

1. ✅ Все эндпоинты имеют правильные статусы ответов
2. ✅ Все статусы соответствуют реальной логике приложения
3. ✅ Документация полная и актуальная

Swagger документация теперь полностью соответствует логике приложения.
