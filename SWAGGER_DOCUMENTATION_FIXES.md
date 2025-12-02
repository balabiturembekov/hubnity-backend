# Исправления Swagger документации

## Итоги проверки

### Найдено и исправлено 4 проблемы

#### 1. Отсутствие тега для idle-detection

- **Проблема**: В `main.ts` отсутствовал тег `idle-detection` для Swagger документации
- **Исправление**: Добавлен тег `idle-detection` в конфигурацию Swagger
- **Файл**: `src/main.ts`

#### 2. Отсутствие статуса 400 в logout-by-refresh-token

- **Проблема**: Эндпоинт `POST /api/auth/logout-by-refresh-token` может возвращать `BadRequestException` (400), но это не было задокументировано в Swagger
- **Исправление**: Добавлен `@ApiResponse` со статусом 400 для случая отсутствия refresh token
- **Файл**: `src/auth/auth.controller.ts`

#### 3. Несоответствие названия проекта в примерах

- **Проблема**: В `app.controller.ts` и `app.service.ts` использовалось старое название "HubStaff" вместо "Hubnity"
- **Исправление**:
  - Обновлен пример в `app.controller.ts` на "Hubnity API is running!"
  - Обновлен возвращаемый текст в `app.service.ts` на "Hubnity API is running!"
- **Файлы**: `src/app.controller.ts`, `src/app.service.ts`

#### 4. Неполное описание API в заголовке Swagger

- **Проблема**: Название и описание API не отражали полный функционал (отсутствовало упоминание детекции простоя)
- **Исправление**:
  - Название изменено с "Time Tracker API" на "Hubnity API"
  - Описание дополнено упоминанием детекции простоя
- **Файл**: `src/main.ts`

## Статистика

- **Всего исправлено**: 4 проблемы
- **Категории**:
  - Отсутствующие теги: 1
  - Отсутствующие статусы ответов: 1
  - Несоответствие названий: 1
  - Неполное описание: 1

## Результаты

- ✅ Все теги добавлены в Swagger
- ✅ Все возможные статусы ответов задокументированы
- ✅ Названия проекта согласованы
- ✅ Описание API полное и актуальное

## Проверенные модули

Все контроллеры проверены на соответствие Swagger документации:

1. **Auth** (`src/auth/auth.controller.ts`) - ✅ Исправлено
2. **Users** (`src/users/users.controller.ts`) - ✅ Корректно
3. **Projects** (`src/projects/projects.controller.ts`) - ✅ Корректно
4. **Time Entries** (`src/time-entries/time-entries.controller.ts`) - ✅ Корректно
5. **Screenshots** (`src/screenshots/screenshots.controller.ts`) - ✅ Корректно
6. **Companies** (`src/companies/companies.controller.ts`) - ✅ Корректно
7. **Team Activity** (`src/team-activity/team-activity.controller.ts`) - ✅ Корректно
8. **Idle Detection** (`src/idle-detection/idle-detection.controller.ts`) - ✅ Корректно
9. **Health** (`src/app.controller.ts`) - ✅ Исправлено

## Рекомендации

1. ✅ Все эндпоинты имеют правильные описания
2. ✅ Все статусы ответов задокументированы
3. ✅ Примеры соответствуют реальным ответам
4. ✅ DTO соответствуют валидации
5. ✅ Все теги добавлены в Swagger

Swagger документация теперь полностью соответствует логике приложения.
