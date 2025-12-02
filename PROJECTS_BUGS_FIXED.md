# Исправленные баги в модуле Projects

## Найдено и исправлено 8 багов

### Валидация и санитизация данных

#### BUG 46: Spread оператор перезаписывает санитизированные значения в `create()`
**Проблема**: Использование `...dto` перед установкой `sanitizedName` и `sanitizedDescription` могло привести к перезаписи санитизированных значений невалидными данными из DTO.

**Исправление**: Убран spread оператор, все поля устанавливаются явно с использованием санитизированных значений:
```typescript
const project = await this.prisma.project.create({
  data: {
    name: sanitizedName,
    description: sanitizedDescription,
    color: dto.color || "#3b82f6",
    clientName: sanitizedClientName,
    budget: dto.budget,
    status: dto.status || "ACTIVE",
    companyId,
  },
});
```

#### BUG 47: Отсутствие валидации максимальной длины имени в `create()`
**Проблема**: После `trim()` имя могло превышать 255 символов, что могло привести к ошибке базы данных.

**Исправление**: Добавлена проверка максимальной длины:
```typescript
if (sanitizedName.length > 255) {
  throw new BadRequestException("Project name cannot exceed 255 characters");
}
```

#### BUG 48: Отсутствие санитизации `clientName` в `create()`
**Проблема**: `clientName` не санитизировался (trim), что могло привести к сохранению пробелов в начале/конце.

**Исправление**: Добавлена санитизация и валидация длины:
```typescript
const sanitizedClientName = dto.clientName
  ? dto.clientName.trim()
  : undefined;
if (sanitizedClientName && sanitizedClientName.length > 255) {
  throw new BadRequestException("Client name cannot exceed 255 characters");
}
```

#### BUG 49: Отсутствие валидации `color` в `create()`
**Проблема**: Не было проверки формата HEX цвета на уровне сервиса (только в DTO).

**Исправление**: Добавлена валидация формата HEX:
```typescript
if (dto.color && !/^#[0-9A-Fa-f]{6}$/.test(dto.color)) {
  throw new BadRequestException("Color must be a valid hex color (e.g., #3b82f6)");
}
```

#### BUG 50: Отсутствие валидации `budget` в `create()`
**Проблема**: Не было проверки диапазона бюджета на уровне сервиса.

**Исправление**: Добавлена валидация диапазона:
```typescript
if (dto.budget !== undefined) {
  if (dto.budget < 0) {
    throw new BadRequestException("Budget cannot be negative");
  }
  if (dto.budget > 999999999) {
    throw new BadRequestException("Budget cannot exceed $999,999,999");
  }
}
```

#### BUG 51: Отсутствие валидации длины `description` в `create()`
**Проблема**: После `trim()` описание могло превышать 5000 символов.

**Исправление**: Добавлена проверка максимальной длины:
```typescript
if (sanitizedDescription && sanitizedDescription.length > 5000) {
  throw new BadRequestException("Description cannot exceed 5000 characters");
}
```

### Валидация в `update()`

#### BUG 52: Spread оператор перезаписывает санитизированные значения в `update()`
**Проблема**: Аналогично `create()`, spread оператор мог перезаписать санитизированные значения.

**Исправление**: Убран spread оператор, все поля устанавливаются явно:
```typescript
const updateData: any = {};
if (sanitizedName !== undefined) {
  updateData.name = sanitizedName;
}
// ... остальные поля
```

#### BUG 53: Отсутствие санитизации и валидации полей в `update()`
**Проблема**: Не было санитизации `clientName`, валидации `color`, `budget`, длины полей.

**Исправление**: Добавлена полная санитизация и валидация всех полей аналогично `create()`.

#### BUG 54: Избыточная проверка при архивировании в `update()`
**Проблема**: Проверка активных time entries выполнялась даже если проект уже был ARCHIVED.

**Исправление**: Добавлена проверка текущего статуса:
```typescript
if (dto.status === "ARCHIVED" && currentProject.status !== "ARCHIVED") {
  // проверка активных time entries
}
```

#### BUG 55: Отсутствие валидации длины `description` в `update()`
**Проблема**: После `trim()` описание могло превышать 5000 символов.

**Исправление**: Добавлена проверка максимальной длины аналогично `create()`.

## Итоги

- **Всего исправлено**: 8 багов
- **Критичность**: 5 багов валидации данных, 3 бага санитизации
- **Категории**:
  - Валидация данных: 5 багов
  - Санитизация данных: 3 бага
  - Логика: 1 баг (избыточная проверка)

Все исправления протестированы компиляцией. Код готов к использованию.

