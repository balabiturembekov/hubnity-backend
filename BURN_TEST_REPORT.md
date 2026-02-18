# Hubnity Backend — Burn Test Report

**Role:** Senior Backend Architect / Security Auditor / Database Specialist  
**Date:** 2026-02-18  
**Scope:** NestJS repository — bugs, logical flaws, performance bottlenecks

---

## 1. Concurrency & Race Conditions (The "Silent Killers")

### BUG-1: POST /time-entries vs POST /time-entries — Dual Active Timers

**Location:** `src/time-entries/time-entries.service.ts` lines 71–154 (create), 95–110 (activeEntryCheck)

**Severity:** **High**

**Exploit Scenario:**  
Two concurrent `POST /time-entries` requests for the same user (same millisecond) both pass `activeEntryCheck` before either commits. Both create RUNNING entries → user ends up with 2 active timers. Billing, reports, and idle detection become inconsistent.

**Fix:** Add a database-level unique partial index to enforce "one active timer per user":

```sql
CREATE UNIQUE INDEX idx_time_entries_one_active_per_user
ON time_entries (userId)
WHERE status IN ('RUNNING', 'PAUSED');
```

Then handle `PrismaClientKnownRequestError` (P2002) in `create()` and return a user-friendly 400.

---

### BUG-2: POST /time-entries vs POST /time-entries/sync — Race Between Create and Sync

**Location:** `src/time-entries/time-entries.service.ts` — `create()` (lines 71–154) and `sync()` (lines 256–391)

**Severity:** **High**

**Exploit Scenario:**  
User sends `POST /time-entries` (start timer) and `POST /time-entries/sync` with a RUNNING entry at the same time. Both transactions can pass the "no active entry" check and create RUNNING entries.

**Fix:** Same as BUG-1 — enforce at DB level with partial unique index. Alternatively, use `SELECT ... FOR UPDATE` or advisory locks within a single transaction, but the index is simpler and more robust.

---

### BUG-3: Sync Idempotency — Two Rapid Requests Same Key (OK)

**Location:** `src/time-entries/time-entries.service.ts` lines 256–266

**Status:** **Mitigated** — `idempotencyKey` is `@unique` in Prisma. Second request with same key either skips (existing match) or conflicts on insert. No duplicate entries.

---

## 2. Memory & Payload Attacks (The "OOM Killers")

### BUG-4: Base64 Screenshot — Full Payload in Memory Before Validation

**Location:** `src/screenshots/screenshots.service.ts` lines 96–124, `src/main.ts` line 50

**Severity:** **High**

**Exploit Scenario:**  
A 50MB JSON body is accepted by `express.json({ limit: "50mb" })` and fully loaded into RAM. Then `Buffer.from(base64Data, "base64")` allocates ~37.5MB. Sharp creates additional buffers. Peak RAM per request: ~100–150MB. Ten concurrent 50MB uploads → ~1–1.5GB. Combined with other traffic, this can OOM the process.

**Fix:**
- Stream-based upload: accept multipart/form-data and stream to disk/S3 before decoding.
- Or reduce body limit (e.g. 10MB) and document that screenshots should be compressed/thumbnailed client-side.
- Add request concurrency limit per user for screenshot uploads.

---

### BUG-5: class-validator on Large Strings — MaxLength Runs After Parse

**Location:** `src/screenshots/dto/upload-screenshot.dto.ts` lines 13–15, `src/main.ts` line 50

**Severity:** **Medium**

**Exploit Scenario:**  
`@MaxLength(50*1024*1024)` is evaluated after the full body is parsed. A malicious client sends a 50MB string. The entire payload is in memory before validation. Validation itself is O(1) for length, but the damage (memory allocation) is already done.

**Fix:** Reject oversized requests before parsing. The existing `Content-Length` check in `main.ts` (lines 29–47) helps, but can be bypassed if the client omits or lies about `Content-Length`. Consider:
- Nginx/Ingress `client_max_body_size` as first line of defense.
- Middleware that rejects when `Content-Length > limit` before body parsing.

---

### BUG-6: No Streaming for Large Payloads

**Location:** `src/screenshots/screenshots.controller.ts`, `src/screenshots/screenshots.service.ts`

**Severity:** **Medium**

**Exploit Scenario:**  
All screenshot uploads load the full Base64 string into memory. There is no streaming. For high-traffic or large-image scenarios, memory pressure is high.

**Fix:** Migrate to `multipart/form-data` with streaming to temp file, then process with Sharp from file path. Avoid holding full Base64 in a single string/buffer.

---

## 3. Database Integrity & Leakage (PostgreSQL)

### BUG-7: Orphaned S3 Objects on Company/User Cascade Delete

**Location:** `prisma/schema.prisma` — Company → User → TimeEntry → Screenshot (all `onDelete: Cascade`)

**Severity:** **High**

**Exploit Scenario:**  
When a Company (or User/TimeEntry) is cascade-deleted, Prisma deletes Screenshot rows. The application never invokes `ScreenshotsService.delete()`, so S3 objects (or local files) are never removed. Result: orphaned objects in S3, storage cost growth, and potential data leakage if URLs are guessable.

**Fix:**
- Add a Prisma `$use` middleware or `beforeDelete` hook on `Screenshot` to delete S3 objects before row deletion.
- Or implement a scheduled job that finds Screenshots with missing TimeEntry and cleans up S3.
- For Company deletion: add an explicit `deleteCompany` service that deletes S3 objects for all company screenshots before deleting the company.

---

### BUG-8: Raw SQL — Parameterized Correctly (No Injection)

**Location:** `src/analytics/analytics.service.ts` lines 272–298

**Severity:** **None (Verified Safe)**

**Analysis:**  
`$queryRawUnsafe` is used with parameterized placeholders (`$1`, `$2`, …). `companyId`, `userId`, `projectId` come from `validateAndGetWhere`, which validates them against the DB. `te.timezone` is from the database, not user input. No string concatenation of user input into SQL.

---

### BUG-9: findMany Without take — Unbounded Result Set

**Location:** `src/analytics/analytics.service.ts` lines 641–662 (`getAppsUrls`)

**Severity:** **Medium**

**Exploit Scenario:**  
`appActivity.findMany` and `urlActivity.findMany` have no `take`. For a company with many time entries and app/URL activity, the query can return tens of thousands of rows. Response size and memory grow unbounded; the endpoint can become slow or crash.

**Fix:** Add `take` (e.g. 5000) and document the limit. Optionally paginate.

```typescript
this.prisma.appActivity.findMany({
  where: { timeEntry: timeEntryWhere },
  select: { ... },
  take: 5000,  // Add
}),
```

---

### BUG-10: Invitation Cascade on Company Delete — OK

**Location:** `prisma/schema.prisma` line 337

**Status:** **OK** — `Invitation` has `company Company @relation(..., onDelete: Cascade)`. Deleting a Company cascades to Invitations. No ghost invitations.

---

## 4. Authentication & RBAC (Security)

### BUG-11: companyId From JWT — No Body Override

**Location:** Controllers pass `user.companyId` from `@GetUser()` to services. No `companyId` from `req.body` or `req.params` is used for authorization.

**Status:** **OK** — `companyId` is consistently taken from the JWT (`user.companyId`). `CompaniesController.resolveCompanyId` allows `"me"` or the user’s own `companyId`; otherwise it throws 403.

---

### BUG-12: Token/Password Leakage in Responses

**Location:** `src/auth/auth.service.ts` (login, register, refresh), `src/users/users.service.ts`

**Status:** **OK** — Login/register responses use explicit `user: { id, name, email, avatar, ... }` without `password`. User list endpoints use `select` that excludes `password`. Refresh tokens are not returned in GET responses.

---

### BUG-13: MANAGER Role in Pending Entries — Logic Flaw

**Location:** `src/time-entries/time-entries.controller.ts` lines 434–468 (`findPending`)

**Severity:** **Medium**

**Exploit Scenario:**  
For non-admin users, the code forces `effectiveUserId = user.id` and ignores `userId` query. But the condition `userId && userId !== user.id` throws 403. So employees see only their own pending entries. However, `findPending` is called with `user.companyId` and `userId` (for admins). If a MANAGER is not in the OWNER/ADMIN/SUPER_ADMIN list, they fall into the "employee" branch and only see their own. This may be intentional, but it’s worth confirming that MANAGER should or should not see subordinates’ pending entries.

**Fix:** If MANAGER should see team pending entries, add `UserRole.MANAGER` to the admin branch and pass `userId` when appropriate.

---

## 5. Infrastructure & K8s Readiness

### BUG-14: Redis Failover — Graceful Degradation

**Location:** `src/cache/cache.service.ts` lines 18–54, 66–78, 82–94

**Status:** **OK** — If Redis fails to connect, `client` is set to `null`. `isAvailable()` returns false. `get()` returns `null`, `set()`/`del()` no-op. The app does not crash. Cache is bypassed gracefully.

---

### BUG-15: Health Check — No DB or Redis Probe

**Location:** `src/app.controller.ts` lines 10–30, `src/app.service.ts`

**Severity:** **High**

**Exploit Scenario:**  
`GET /` returns a static 200 with "Hubnity API is running!". It does not check PostgreSQL or Redis. A pod can be marked healthy by K8s while the DB is down, leading to 500s on real traffic and failed deployments.

**Fix:** Implement a proper health endpoint:

```typescript
@Get('health')
async health() {
  const db = await this.prisma.$queryRaw`SELECT 1`.catch(() => null);
  const redis = this.cache.isAvailable();
  const status = db && redis ? 'healthy' : 'degraded';
  return {
    status,
    database: db ? 'up' : 'down',
    redis: redis ? 'up' : 'down',
  };
}
```

Use this for K8s liveness/readiness probes.

---

## Summary Table

| ID    | Severity  | Category        | Description                                      |
|-------|-----------|-----------------|--------------------------------------------------|
| BUG-1 | High      | Concurrency     | Dual active timers via concurrent POST           |
| BUG-2 | High      | Concurrency     | Race between create and sync                     |
| BUG-4 | High      | Memory          | 50MB payloads cause high RAM usage               |
| BUG-7 | High      | DB Integrity    | Orphaned S3 objects on cascade delete           |
| BUG-15| High      | Infrastructure  | Health check does not probe DB/Redis             |
| BUG-5 | Medium    | Memory          | Validation after full body parse                 |
| BUG-6 | Medium    | Memory          | No streaming for screenshot uploads              |
| BUG-9 | Medium    | DB/Performance  | Unbounded findMany in getAppsUrls                |
| BUG-13| Medium    | RBAC            | MANAGER access to pending entries                 |

---

## Recommended Priority

1. **Immediate:** BUG-1, BUG-2 (add partial unique index), BUG-15 (health check)
2. **Short-term:** BUG-7 (S3 cleanup on cascade), BUG-9 (add take to findMany)
3. **Medium-term:** BUG-4, BUG-5, BUG-6 (streaming / payload limits)

---

## Fixes Applied (2026-02-18)

- **BUG-1/2:** Added unique partial index `idx_time_entries_one_active_per_user`; P2002 handled in create/sync.
- **BUG-4/5:** Body limit reduced to 10MB; Content-Length check when present (reject if > limit before parse).
- **BUG-7:** `deleteFilesForTimeEntry` / `deleteFilesForUser` in ScreenshotsService; called before TimeEntry/User delete.
- **BUG-9:** `take: 5000` added to getAppsUrls findMany.
- **BUG-13:** MANAGER can view company pending entries (findPending).
