# Найденные баги в Swagger документации

## Итоги проверки

### Найдено 8 багов

## Детальный список багов

### BUG 1: Team Activity Controller - Отсутствуют статусы ответов для ошибок

**Файл**: `src/team-activity/team-activity.controller.ts`

**Проблема**: 
- Отсутствует `@ApiResponse` для статуса 401 (неавторизован)
- Отсутствует `@ApiResponse` для статуса 404 (пользователь или проект не найден)
- Отсутствует `@ApiResponse` для статуса 400 (неверные параметры запроса)

**Реальная логика**: 
- Сервис может выбросить `NotFoundException` для несуществующего пользователя (строка 231-234)
- Сервис может выбросить `NotFoundException` для несуществующего проекта (строка 289-292)
- Контроллер использует `@UseGuards(JwtAuthGuard)`, поэтому может быть 401

**Исправление**: Добавить недостающие `@ApiResponse` декораторы

---

### BUG 2: Team Activity Controller - Отсутствует документация query параметров

**Файл**: `src/team-activity/team-activity.controller.ts`

**Проблема**: 
- Отсутствуют `@ApiQuery` декораторы для параметров запроса
- Параметры `userId`, `projectId`, `period`, `startDate`, `endDate` не задокументированы

**Реальная логика**: 
- DTO `TeamActivityQueryDto` содержит эти поля
- Параметры используются в сервисе

**Исправление**: Добавить `@ApiQuery` декораторы для всех query параметров

---

### BUG 3: Time Entries Controller - Отсутствует статус 401 для некоторых эндпоинтов

**Файл**: `src/time-entries/time-entries.controller.ts`

**Проблема**: 
- Эндпоинты `GET /time-entries`, `GET /time-entries/active`, `GET /time-entries/my`, `GET /time-entries/activities` не имеют `@ApiResponse` для статуса 401
- Все эндпоинты используют `@UseGuards(JwtAuthGuard)`, поэтому могут вернуть 401

**Исправление**: Добавить `@ApiResponse({ status: 401, description: "Не авторизован" })` для всех эндпоинтов

---

### BUG 4: Time Entries Controller - Отсутствует статус 400 для pause/resume

**Файл**: `src/time-entries/time-entries.controller.ts`

**Проблема**: 
- Эндпоинты `PUT /time-entries/:id/pause` и `PUT /time-entries/:id/resume` имеют `@ApiResponse` для статуса 400, но описание неполное
- В реальной логике может быть несколько причин для 400 (неправильный статус, уже приостановлен/возобновлен)

**Исправление**: Уточнить описание статуса 400

---

### BUG 5: Users Controller - Отсутствует статус 401 для эндпоинта GET /me

**Файл**: `src/users/users.controller.ts`

**Проблема**: 
- Эндпоинт `GET /users/me` не имеет `@ApiResponse` для статуса 401
- Контроллер использует `@UseGuards(JwtAuthGuard)`, поэтому может быть 401

**Исправление**: Добавить `@ApiResponse({ status: 401, description: "Не авторизован" })`

---

### BUG 6: Projects Controller - Отсутствует статус 401

**Файл**: `src/projects/projects.controller.ts`

**Проблема**: 
- Все эндпоинты используют `@UseGuards(JwtAuthGuard)`, но отсутствует `@ApiResponse` для статуса 401
- Эндпоинты `GET /projects`, `GET /projects/active`, `GET /projects/:id` не имеют документации для 401

**Исправление**: Добавить `@ApiResponse({ status: 401, description: "Не авторизован" })` для всех эндпоинтов

---

### BUG 7: Screenshots Controller - Отсутствует статус 401

**Файл**: `src/screenshots/screenshots.controller.ts`

**Проблема**: 
- Эндпоинт `GET /screenshots/time-entry/:timeEntryId` не имеет `@ApiResponse` для статуса 401
- Контроллер использует `@UseGuards(JwtAuthGuard)`, поэтому может быть 401

**Исправление**: Добавить `@ApiResponse({ status: 401, description: "Не авторизован" })`

---

### BUG 8: Companies Controller - Отсутствует статус 401

**Файл**: `src/companies/companies.controller.ts`

**Проблема**: 
- Эндпоинты `GET /companies/screenshot-settings` и `GET /companies/idle-detection-settings` не имеют `@ApiResponse` для статуса 401
- Контроллер использует `@UseGuards(JwtAuthGuard)`, поэтому может быть 401

**Исправление**: Добавить `@ApiResponse({ status: 401, description: "Не авторизован" })` для всех эндпоинтов

---

## Статистика

- **Всего найдено**: 8 багов
- **Категории**:
  - Отсутствующие статусы ответов: 7 багов
  - Отсутствующая документация параметров: 1 баг

## Приоритет исправления

1. **Высокий**: BUG 1, BUG 2 (Team Activity - отсутствует критичная документация)
2. **Средний**: BUG 3, BUG 5, BUG 6, BUG 7, BUG 8 (отсутствует статус 401)
3. **Низкий**: BUG 4 (уточнение описания)

