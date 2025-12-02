# Исправленные баги в модуле Time Entries (Раунд 2)

## Найдено и исправлено 6 багов

### Безопасность (Data Leakage)

#### BUG 40: Отсутствие проверки userId в `findAll()`

**Проблема**: Метод `findAll()` не проверял, что переданный `userId` принадлежит той же компании. Это могло привести к утечке данных между компаниями.

**Исправление**: Добавлена проверка существования пользователя в компании перед фильтрацией:

```typescript
if (userId) {
  const user = await this.prisma.user.findFirst({
    where: { id: userId, companyId },
    select: { id: true },
  });
  if (!user) {
    throw new NotFoundException(
      `User with ID ${userId} not found in your company`,
    );
  }
  where.userId = userId;
}
```

#### BUG 41: Отсутствие проверки userId в `findActive()`

**Проблема**: Аналогично `findAll()`, метод `findActive()` не проверял принадлежность `userId` к компании.

**Исправление**: Добавлена та же проверка, что и в `findAll()`.

#### BUG 42: Отсутствие проверки userId в `findAllActivities()`

**Проблема**: Метод `findAllActivities()` не проверял принадлежность `userId` к компании.

**Исправление**: Добавлена та же проверка, что и в `findAll()`.

### Race Conditions и Консистентность данных

#### BUG 43: Использование `now` вне транзакции в `pause()`

**Проблема**: В методе `pause()` переменная `now` создавалась вне транзакции, но использовалась внутри. Это могло привести к рассинхронизации времени, если между созданием `now` и использованием в транзакции прошло время.

**Исправление**: Перемещено создание `now` и пересчет `newDuration` внутрь транзакции на основе актуальных данных `currentEntry`:

```typescript
const transactionResult = await this.prisma.$transaction(async (tx) => {
  const currentEntry = await tx.timeEntry.findFirst({...});
  // ...
  const now = new Date(); // Создается внутри транзакции
  const newDuration = currentEntry.duration + safeElapsed; // Используется актуальный duration
  // ...
});
```

#### BUG 44: Использование `endTime` и `duration` вне транзакции в `stop()`

**Проблема**: В методе `stop()` переменная `endTime` создавалась вне транзакции, а `duration` вычислялась на основе `entry.duration`, который мог измениться между проверкой и транзакцией.

**Исправление**: Перемещено создание `endTime` и пересчет `finalDuration` внутрь транзакции на основе актуальных данных `currentEntry`:

```typescript
const transactionResult = await this.prisma.$transaction(async (tx) => {
  const currentEntry = await tx.timeEntry.findFirst({...});
  // ...
  const endTime = new Date(); // Создается внутри транзакции
  const finalDuration = currentEntry.duration + safeElapsed; // Используется актуальный duration
  // ...
});
```

#### BUG 45: Проверка прав доступа вне транзакции в `update()`

**Проблема**: В методе `update()` проверка прав доступа выполнялась до транзакции. Если entry был удален между проверкой и транзакцией, проверка прав не выполнялась для удаленного entry.

**Исправление**: Перемещена проверка прав доступа внутрь транзакции после чтения `currentEntry`:

```typescript
const updated = await this.prisma.$transaction(async (tx) => {
  const currentEntry = await tx.timeEntry.findFirst({...});
  // ...
  // Check permissions within transaction to prevent race conditions
  if (updaterRole !== UserRole.OWNER && ...) {
    if (currentEntry.userId !== updaterId) {
      throw new ForbiddenException('You can only update your own time entries');
    }
  }
  // ...
});
```

## Итоги

- **Всего исправлено**: 6 багов
- **Критичность**: 3 бага безопасности (data leakage), 3 бага race conditions
- **Категории**:
  - Безопасность: 3 бага
  - Race conditions: 3 бага

Все исправления протестированы компиляцией. Код готов к использованию.
