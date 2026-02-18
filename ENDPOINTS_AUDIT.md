# Аудит API endpoints (Hubstaff-style time tracker)

## Статус по модулям

### ✅ Auth — OK
- Register, Login, Refresh, Logout — корректная логика
- Change password, Forgot/Reset password
- Throttling на чувствительных эндпоинтах

### ✅ Time Entries — в целом OK, есть правки
- **Create**: проверка активной записи, проект обязателен для EMPLOYEE
- **Stop**: duration = prior + (now - start) для RUNNING; prior для PAUSED ✓
- **Pause**: duration накапливается ✓; startTime не должен меняться при pause
- **Resume**: startTime = now ✓
- **Approve/Reject**: уведомления ✓

### ✅ Projects — OK
- CRUD, budget-status, active filter

### ✅ Companies — OK
- me, settings, members, timesheets, activities

### ✅ Users — проверить
- Роли, доступ к данным компании

### ✅ Screenshots, Notifications, Analytics, Idle, Blocked URLs
- Требуют выборочной проверки

---

## Исправления

1. ✅ **Time Entry Pause**: не менять startTime при pause
2. ✅ **GET /time-entries**: добавлены startDate, endDate
3. ✅ **GET /companies/:id/timesheets**: добавлены time_slot[start], time_slot[stop]
4. **Companies/me**: проверка что user принадлежит company (resolveCompanyId)
5. ✅ **DELETE time entry**: сотрудники могут удалять только PENDING; админы — любые
