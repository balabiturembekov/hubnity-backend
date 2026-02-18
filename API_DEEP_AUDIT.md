# Hubnity API — Deep Audit Report

**Role:** Senior Backend Architect / Auditor  
**Date:** February 2025  
**Scope:** NestJS codebase — REST API surface, implementation quality, professional gaps

---

## 1. Table of Existing Endpoints

All endpoints use global prefix `api/v1`. Base URL: `/api/v1`.

| Method | Path | Auth | Logic | Entities |
|--------|------|------|-------|----------|
| **App** |
| GET | `/` | None | Returns static message | — |
| **Auth** |
| POST | `/auth/register` | None | Creates Company + User (OWNER), JWT | Company, User |
| POST | `/auth/login` | None | Validates credentials, issues JWT | User, RefreshToken |
| GET | `/auth/me` | JWT | Returns current user profile | User |
| POST | `/auth/refresh` | None | Refreshes access token | RefreshToken |
| POST | `/auth/change-password` | JWT | Validates current password, updates | User |
| POST | `/auth/forgot-password` | None | Sends reset email (or no-op) | PasswordResetToken |
| POST | `/auth/reset-password` | None | Resets password by token | User, PasswordResetToken |
| POST | `/auth/logout` | JWT | Revokes refresh token(s) | RefreshToken |
| POST | `/auth/logout-by-refresh-token` | None | Revokes specific refresh token | RefreshToken |
| **Users** |
| POST | `/users` | JWT + OWNER/ADMIN | Direct Prisma create | User |
| GET | `/users` | JWT + OWNER/ADMIN | List company users | User |
| GET | `/users/me` | JWT | Current user profile | User |
| PATCH | `/users/me` | JWT | Update own profile (no role/companyId) | User |
| GET | `/users/:id` | JWT | Self or admin; company-scoped | User |
| PATCH | `/users/:id` | JWT + OWNER/ADMIN | Update user | User |
| DELETE | `/users/:id` | JWT + OWNER/ADMIN | Soft/hard delete (no self-delete) | User |
| **Companies** |
| GET | `/companies/me` | JWT | Company profile | Company |
| PATCH | `/companies/me` | JWT + OWNER/ADMIN | Update name/domain | Company |
| GET | `/companies/screenshot-settings` | JWT | Screenshot settings | Company |
| PATCH | `/companies/screenshot-settings` | JWT + OWNER/ADMIN | Update screenshot interval | Company |
| GET | `/companies/idle-detection-settings` | JWT | Idle detection settings | Company |
| PATCH | `/companies/idle-detection-settings` | JWT + OWNER/ADMIN | Update idle threshold | Company |
| GET | `/companies/:companyId/projects` | JWT | List projects (companyId=me supported) | Project |
| GET | `/companies/:companyId/members` | JWT + OWNER/ADMIN | List members | User |
| GET | `/companies/:companyId/timesheets` | JWT | Paginated time entries | TimeEntry |
| GET | `/companies/:companyId/activities` | JWT | Activity events by time slot | Activity |
| GET | `/companies/:companyId/activities/daily` | JWT | Daily activity summary | TeamActivity |
| **Organizations** |
| GET | `/organizations` | JWT | Hubstaff-style: returns single company | Company |
| **Projects** |
| POST | `/projects` | JWT + OWNER/ADMIN | Direct Prisma create | Project |
| GET | `/projects` | JWT | List company projects | Project |
| GET | `/projects/active` | JWT | Active projects only | Project |
| GET | `/projects/:id/budget-status` | JWT | Budget used/remaining | Project, TimeEntry |
| GET | `/projects/:id` | JWT | Single project | Project |
| PATCH | `/projects/:id` | JWT + OWNER/ADMIN | Update project | Project |
| DELETE | `/projects/:id` | JWT + OWNER/ADMIN | Delete project | Project |
| **Time Entries** |
| POST | `/time-entries` | JWT | Create (checks active entry, project for EMPLOYEE) | TimeEntry |
| GET | `/time-entries` | JWT | List with filters (userId, projectId, dates) | TimeEntry |
| GET | `/time-entries/active` | JWT | RUNNING/PAUSED entries | TimeEntry |
| GET | `/time-entries/my` | JWT | Own entries only | TimeEntry |
| GET | `/time-entries/activities` | JWT | Activity history | Activity |
| GET | `/time-entries/pending` | JWT | PENDING approval entries | TimeEntry |
| POST | `/time-entries/bulk-approve` | JWT + OWNER/ADMIN | Bulk approve | TimeEntry |
| POST | `/time-entries/bulk-reject` | JWT + OWNER/ADMIN | Bulk reject | TimeEntry |
| GET | `/time-entries/:id` | JWT | Single entry | TimeEntry |
| PATCH | `/time-entries/:id` | JWT | Update (role-based) | TimeEntry |
| POST | `/time-entries/:id/approve` | JWT + OWNER/ADMIN | Approve | TimeEntry |
| POST | `/time-entries/:id/reject` | JWT + OWNER/ADMIN | Reject | TimeEntry |
| PUT | `/time-entries/:id/stop` | JWT | Stop timer | TimeEntry |
| PUT | `/time-entries/:id/pause` | JWT | Pause timer | TimeEntry |
| PUT | `/time-entries/:id/resume` | JWT | Resume timer | TimeEntry |
| DELETE | `/time-entries/:id` | JWT | EMPLOYEE: PENDING only; ADMIN: any | TimeEntry |
| **Screenshots** |
| POST | `/screenshots` | JWT | Base64 upload, local storage | Screenshot, TimeEntry |
| GET | `/screenshots/time-entry/:timeEntryId` | JWT | List by time entry | Screenshot |
| DELETE | `/screenshots/:id` | JWT | Delete screenshot | Screenshot |
| **Notifications** |
| GET | `/notifications` | JWT | Paginated list (unread filter) | Notification |
| GET | `/notifications/unread-count` | JWT | Count for badge | Notification |
| GET | `/notifications/:id` | JWT | Single notification | Notification |
| PATCH | `/notifications/read` | JWT | Mark as read (ids or all) | Notification |
| PATCH | `/notifications/:id/read` | JWT | Mark one as read | Notification |
| **Analytics** |
| GET | `/analytics/dashboard` | JWT | Summary stats | TimeEntry, User, Project |
| GET | `/analytics/hours-by-day` | JWT | Hours per day | TimeEntry |
| GET | `/analytics/hours-by-project` | JWT | Hours per project | TimeEntry |
| GET | `/analytics/productivity` | JWT | User productivity metrics | TimeEntry |
| GET | `/analytics/compare` | JWT | Compare two periods | TimeEntry |
| GET | `/analytics/work-sessions` | JWT | Work sessions list | TimeEntry |
| GET | `/analytics/apps-urls` | JWT | Apps + URLs aggregation | AppActivity, UrlActivity |
| GET | `/analytics/export` | JWT | CSV export | TimeEntry |
| **Team Activity** |
| GET | `/team-activity` | JWT | Team activity by period | TimeEntry, User |
| **Idle Detection** |
| POST | `/idle/heartbeat` | JWT | Update last activity | UserActivity |
| GET | `/idle/status` | JWT | Idle status | UserActivity |
| **App Activity** |
| POST | `/app-activity` | JWT | Create app usage record | AppActivity |
| POST | `/app-activity/batch` | JWT | Batch create (max 100) | AppActivity |
| GET | `/app-activity/time-entry/:timeEntryId/stats` | JWT | Stats by time entry | AppActivity |
| GET | `/app-activity/user/:userId/stats` | JWT | Stats by user + period | AppActivity |
| **URL Activity** |
| POST | `/url-activity` | JWT | Create URL record (checks blocked) | UrlActivity |
| POST | `/url-activity/batch` | JWT | Batch create (skips blocked) | UrlActivity |
| GET | `/url-activity/time-entry/:timeEntryId/stats` | JWT | Stats by time entry | UrlActivity |
| GET | `/url-activity/user/:userId/stats` | JWT | Stats by user + period | UrlActivity |
| **Blocked URLs** |
| GET | `/blocked-urls` | JWT | List (admin-only in service) | BlockedUrl |
| POST | `/blocked-urls` | JWT | Create (admin-only in service) | BlockedUrl |
| DELETE | `/blocked-urls/:id` | JWT | Delete (admin-only in service) | BlockedUrl |

---

## 2. Implementation Quality

### 2.1 Authentication

| Aspect | Implementation |
|--------|----------------|
| **Mechanism** | JWT (access token) via Passport `jwt` strategy |
| **Guard** | `JwtAuthGuard` — validates Bearer token, attaches `user` to request |
| **Refresh** | Refresh tokens stored in DB; `/auth/refresh` issues new access + refresh |
| **Logout** | Revokes refresh token(s); `logout-by-refresh-token` for token-only logout |
| **Coverage** | All business endpoints use `@UseGuards(JwtAuthGuard)` except auth routes and `GET /` |

### 2.2 Authorization (RBAC)

| Aspect | Implementation |
|--------|----------------|
| **Roles** | `UserRole`: SUPER_ADMIN, OWNER, ADMIN, EMPLOYEE |
| **Guard** | `RolesGuard` — checks `@Roles(...)` decorator |
| **Usage** | OWNER/ADMIN for: company settings, projects CRUD, users CRUD, time approval, members, blocked URLs |
| **Gaps** | No project-level or team-level roles; no MANAGER role; RBAC is company-wide only |

### 2.3 Validation

| Aspect | Implementation |
|--------|----------------|
| **Global** | `ValidationPipe` with `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` |
| **DTOs** | class-validator used for body/query in most endpoints |
| **Gaps** | Some query params (e.g. `time_slot[start]`, `page_limit`) parsed manually; not all use DTOs |

### 2.4 Error Handling

| Aspect | Implementation |
|--------|----------------|
| **Global filter** | None — NestJS default exception handling |
| **Sentry** | Initialized in `main.ts`; captures unhandled errors |
| **Body size** | Custom middleware: 413 for oversized payloads; body-parser error handler for truncated JSON |
| **Gaps** | No unified error response format; no HTTP exception filter for consistent JSON structure |

### 2.5 Other

| Aspect | Implementation |
|--------|----------------|
| **Throttling** | `@Throttle` on auth endpoints (register, login, refresh, change-password, forgot/reset) |
| **Swagger** | OpenAPI docs at `/api/v1/docs` |
| **CORS** | Configurable via `FRONTEND_URL`, `FRONTEND_IP`, `ALLOWED_ORIGINS` |

---

## 3. Architectural Gaps (Professional Missing Features)

### 3.1 Hierarchy

| Gap | Current | Expected (Hubstaff/Toggl-style) |
|-----|---------|----------------------------------|
| **Organizations** | Single company per user; `GET /organizations` returns one company | Multi-org support; user can belong to multiple orgs |
| **Teams** | No teams — flat User ↔ Company | Teams within company; project assignment by team |
| **Structure** | Company → Users, Projects | Org → Teams → Users; Projects assigned to teams |

### 3.2 RBAC (Roles)

| Gap | Current | Expected |
|-----|---------|----------|
| **Manager role** | No MANAGER | Manager can approve time for their team only |
| **Project-level roles** | None | Project manager, project member |
| **Team-level roles** | None | Team lead, team member |
| **Permissions** | Role-based only | Fine-grained permissions (e.g. view reports, manage screenshots) |

### 3.3 Settings / Policies

| Gap | Current | Expected |
|-----|---------|----------|
| **Screenshot settings** | Company-wide only | Per-team override (e.g. Team A: 60s, Team B: 300s) |
| **Idle timeout** | Company-wide only | Per-team or per-project override |
| **Workweek** | Not configurable | Working days, hours, timezone per company/team |
| **Approval workflow** | Simple approve/reject | Multi-step approval, required approvers |

### 3.4 Reporting

| Gap | Current | Expected |
|-----|---------|----------|
| **Daily/weekly summaries** | `GET /companies/:id/activities/daily` returns team activity; analytics has hours-by-day | Dedicated report endpoints (e.g. `/reports/weekly-summary`) |
| **Payroll export** | CSV export in analytics | Dedicated payroll report (hours, rates, totals) |
| **Scheduled reports** | None | Email reports (daily digest, weekly summary) |
| **Custom date ranges** | Supported in analytics | More report types (project profitability, user utilization) |

### 3.5 Sync Robustness (Desktop App)

| Gap | Current | Expected |
|-----|---------|----------|
| **Idempotency** | **Not implemented** — `CreateTimeEntryDto` has no `idempotencyKey`; Prisma schema has no `idempotencyKey` | `idempotencyKey` in TimeEntry; dedupe on create |
| **Batch sync** | No `/sync/batch` | `POST /sync/batch` with idempotency for offline-first desktop |
| **Conflict resolution** | None | Last-write-wins or explicit conflict API |
| **Timezone** | Not stored per entry | `timezone` field for user/entry |

### 3.6 Other Gaps

| Gap | Description |
|-----|-------------|
| **Screenshots storage** | Local filesystem; no S3/cloud storage for production scalability |
| **Audit log** | No audit trail for sensitive actions (user changes, settings, approvals) |
| **API versioning** | Prefix `api/v1` only; no deprecation strategy |
| **Rate limiting** | Throttle only on auth; no general API rate limits |
| **Webhooks** | No webhooks for events (time approved, user added, etc.) |

---

## 4. Prioritized Roadmap to Enterprise-Ready

### P0 — Critical (Sync & Core Reliability)

1. **Idempotency for Time Entries**
   - Add `idempotencyKey` to `TimeEntry` (Prisma schema)
   - Add to `CreateTimeEntryDto`
   - In `TimeEntriesService.create`: check by `idempotencyKey` before insert; return existing if found
   - Optional: Redis cache for fast lookup (as in `PRODUCTION_READY_DESIGN.md`)

2. **Sync module**
   - `POST /api/v1/sync/batch` — bulk create/update time entries with idempotency
   - Handle conflicts (e.g. return 409 with conflict details)

3. **Timezone support**
   - Add `timezone` to User and/or TimeEntry
   - Use for display and reporting

### P1 — High (Enterprise Features)

4. **Teams**
   - Add `Team` model; `User` belongs to Team(s); `Project` assigned to Teams
   - `GET/POST /teams`, `GET /teams/:id/members`
   - Filter timesheets/analytics by team

5. **Manager role**
   - Add `MANAGER` role; can approve time for team members only
   - Update `RolesGuard` and approval logic

6. **Per-team settings**
   - `screenshotInterval`, `idleThreshold` overridable per Team
   - Fallback to company defaults

7. **Global exception filter**
   - Unified error response: `{ statusCode, error, message, timestamp }`
   - Map Prisma errors to appropriate HTTP codes

### P2 — Medium (Polish & Scale)

8. **Screenshots → S3**
   - Store screenshots in S3 (or compatible); keep thumbnails
   - Configurable via env

9. **Audit log**
   - Log sensitive actions (user create/update/delete, settings change, approval)
   - New `AuditLog` model or external service

10. **Reporting endpoints**
    - `GET /reports/weekly-summary`
    - `GET /reports/payroll` (hours, rates, totals)
    - Optional: scheduled email reports

### P3 — Lower Priority

11. **Webhooks** — Event subscriptions for integrations  
12. **API rate limiting** — General throttle per user/IP  
13. **Multi-organization** — User in multiple companies  
14. **Project-level roles** — Project manager, member  

---

## 5. Summary

| Category | Status |
|----------|--------|
| **Endpoints** | ~70 REST endpoints; good coverage for core time tracking |
| **Auth** | JWT + refresh; solid |
| **RBAC** | OWNER/ADMIN/EMPLOYEE; no Teams, no Manager |
| **Validation** | ValidationPipe + DTOs; some manual query parsing |
| **Error handling** | None custom; Sentry for monitoring |
| **Settings** | Company-wide screenshot + idle; no per-team |
| **Reporting** | Analytics + team-activity; no dedicated reports |
| **Sync** | **No idempotency**; no batch sync — blocks Desktop sync |

**Top 3 actions:** Implement idempotency for TimeEntry, add Sync module, and introduce Teams + Manager role for enterprise readiness.
