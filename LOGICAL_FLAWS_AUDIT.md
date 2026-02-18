# Hubnity Backend — Logical Flaws Audit

**Role:** Senior Backend QA / Database Architect  
**Focus:** Data integrity, overlapping sessions, synchronization edge cases

---

## 1. The "Overlap" Paradox — **CRITICAL (High)**

### Finding

**POST /time-entries** (create): Has `activeEntryCheck` — prevents creating a new RUNNING/PAUSED entry if one exists. ✅

**POST /time-entries/sync**: No active-entry check. Sync can create RUNNING entries even when the user already has one. Result: multiple simultaneous active timers → wrong reports and billing.

### Location

`src/time-entries/time-entries.service.ts` — `sync()` method (lines ~254–335)

### Severity

**High** — Direct impact on billing and reporting.

### Fix

Add the same active-entry check as in `create()` before creating new entries in sync, and optionally auto-stop the previous RUNNING entry when creating a new one:

```typescript
// In sync(), inside the transaction loop, BEFORE tx.timeEntry.create():
if (item.status === "RUNNING" || item.status === "PAUSED") {
  const activeEntry = await tx.timeEntry.findFirst({
    where: {
      userId: item.userId,
      status: { in: ["RUNNING", "PAUSED"] },
      user: { companyId },
    },
  });
  if (activeEntry) {
    // Option A: Reject (like create)
    throw new BadRequestException(
      "User already has an active time entry. Sync cannot create overlapping RUNNING/PAUSED entries.",
    );
    // Option B: Auto-stop previous, then create (desktop-friendly)
    // await tx.timeEntry.update({
    //   where: { id: activeEntry.id },
    //   data: { status: "STOPPED", endTime: new Date(), ... },
    // });
  }
}
```

---

## 2. Timezone Inconsistency in Reports — **FIXED**

### Finding

`getHoursByDay` uses `date(te."startTime")` in raw SQL. That uses the DB/server timezone (usually UTC). The `timezone` field on `TimeEntry` is never used.

Example: 11 PM–2 AM in NYC (America/New_York) spans two calendar days locally but one day in UTC. Reports grouped by UTC will misallocate hours.

### Location

`src/analytics/analytics.service.ts` — `getHoursByDay()` (lines ~286–295)

### Severity

**High** — Incorrect daily summaries for users in non-UTC timezones.

### Fix

Use the entry’s timezone (or user default) when grouping by date. **FIXED:** Now uses `(te."startTime" AT TIME ZONE COALESCE(NULLIF(te.timezone, ''), 'UTC'))::date`. PostgreSQL example with `AT TIME ZONE`:

```typescript
// Option 1: Use entry timezone when available
// Requires per-entry timezone. More complex query.
const rawResult = await this.prisma.$queryRawUnsafe<
  { date: string; total_seconds: bigint }[]
>(
  `SELECT 
     (te."startTime" AT TIME ZONE COALESCE(te.timezone, 'UTC'))::date::text as date,
     COALESCE(SUM(te.duration), 0)::bigint as total_seconds
   FROM time_entries te
   WHERE ${whereClause}
   GROUP BY (te."startTime" AT TIME ZONE COALESCE(te.timezone, 'UTC'))::date
   ORDER BY date`,
  ...params,
);

// Option 2: Pass user/company timezone from query (simpler)
// Add timezone to AnalyticsQueryDto, default to 'UTC'
// Then: date(te."startTime" AT TIME ZONE $${paramIdx})::date
```

---

## 3. S3 Orphaned Files — **NONE (Verified OK)**

### Finding

`DELETE /screenshots/:id` does call `s3Service.deleteObject()` when S3 is enabled. The flow is:

1. Load screenshot (including `imageUrl`, `thumbnailUrl`)
2. If `s3Service.isEnabled()`: `extractKeyFromUrl()` → `deleteObject(imageKey)` and `deleteObject(thumbKey)`
3. Delete DB record

### Location

`src/screenshots/screenshots.service.ts` — `delete()` (lines ~360–368)

### Severity

**None** — S3 objects are deleted correctly. Orphan risk exists only if `extractKeyFromUrl` returns `null` for valid S3 URLs (e.g. unusual URL formats).

### Recommendation (Low)

Add a fallback when `extractKeyFromUrl` returns null but the URL looks like S3:

```typescript
if (this.s3Service.isEnabled()) {
  let imageKey = this.s3Service.extractKeyFromUrl(screenshot.imageUrl);
  if (!imageKey && screenshot.imageUrl.includes("s3")) {
    this.logger.warn({ screenshotId, imageUrl: screenshot.imageUrl }, "Could not extract S3 key");
  }
  if (imageKey) await this.s3Service.deleteObject(imageKey);
  // ...
}
```

---

## 4. Idempotency Key "False Positives" — **High**

### Finding

When an entry with the same `idempotencyKey` already exists, sync skips creation and returns `action: "skipped"` without checking if the payload matches the stored record.

Example: client retries with the same key but different `duration` or `projectId`. Server returns 200 OK, data stays wrong, no warning.

### Location

`src/time-entries/time-entries.service.ts` — `sync()` (lines ~256–268)

### Severity

**High** — Silent data inconsistency.

### Fix

On skip, compare critical fields and either reject or return a conflict indicator:

```typescript
if (existing) {
  const fullExisting = await tx.timeEntry.findUnique({
    where: { idempotencyKey: item.idempotencyKey },
    select: { id: true, userId: true, projectId: true, startTime: true, endTime: true, duration: true },
  });
  if (fullExisting) {
    const startMatch = fullExisting.startTime.getTime() === new Date(item.startTime).getTime();
    const projectMatch = (fullExisting.projectId ?? "") === (item.projectId ?? "");
    const durationMatch = fullExisting.duration === (item.duration ?? 0);
    if (!startMatch || !projectMatch || !durationMatch) {
      results.push({
        idempotencyKey: item.idempotencyKey,
        id: fullExisting.id,
        action: "conflict",
        message: "Payload differs from existing record",
      });
      continue; // or throw BadRequestException
    }
  }
  results.push({ idempotencyKey: item.idempotencyKey, id: existing.id, action: "skipped" });
  skipped++;
  continue;
}
```

---

## 5. Race Conditions in Multi-Pod Environment — **Medium**

### Finding

Sync uses `findUnique` then `create`. Two pods can both see “no existing” and both try to create. The second hits the unique constraint on `idempotencyKey` and Prisma throws (e.g. `P2002`), which surfaces as 500.

There is no Redis lock or advisory lock. The DB unique constraint prevents duplicates but does not give a clean, client-friendly response.

### Location

`src/time-entries/time-entries.service.ts` — `sync()` transaction

### Severity

**Medium** — Duplicates are prevented, but clients get 500 instead of a clear “already exists” response.

### Fix

Catch unique constraint violation and treat it as “skipped”:

```typescript
try {
  const newEntry = await tx.timeEntry.create({ data: { ... } });
  results.push({ idempotencyKey: item.idempotencyKey, id: newEntry.id, action: "created" });
  created++;
} catch (error: unknown) {
  if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
    const existing = await tx.timeEntry.findUnique({
      where: { idempotencyKey: item.idempotencyKey },
      select: { id: true },
    });
    results.push({
      idempotencyKey: item.idempotencyKey,
      id: existing?.id ?? null,
      action: "skipped",
    });
    skipped++;
  } else {
    throw error;
  }
}
```

---

## 6. Role Escalation & Self-Approval — **Medium**

### Finding

**Role escalation:** Blocked. `PATCH /users/me` strips `role` if it differs from current. `PATCH /users/:id` is restricted to OWNER/ADMIN. MANAGER cannot change their own or others’ roles.

**Self-approval:** Not blocked. `approve()` and `reject()` do not check `approverId !== entry.userId`. MANAGER (and ADMIN/OWNER) can approve their own time entries, which conflicts with typical audit/compliance expectations.

### Location

`src/time-entries/time-entries.service.ts` — `approve()`, `reject()`, `bulkApprove()`, `bulkReject()`

### Severity

**Medium** — Policy/compliance risk rather than technical exploit.

### Fix

Reject self-approval (optionally allow for OWNER):

```typescript
// In approve(), reject(), bulkApprove(), bulkReject():
if (entry.userId === approverId) {
  throw new ForbiddenException(
    "You cannot approve or reject your own time entries. Another approver is required.",
  );
}
```

---

## Summary Table

| # | Issue                         | Severity | Status   |
|---|-------------------------------|----------|----------|
| 1 | Sync overlap (multiple RUNNING) | High     | **Fixed** (auto-STOP previous) |
| 2 | Timezone in getHoursByDay     | High     | **Fixed** (AT TIME ZONE) |
| 3 | S3 orphaned files            | None     | OK        |
| 4 | Idempotency payload mismatch | High     | **Fixed** (409 Conflict) |
| 5 | Race condition → 500 on sync  | Medium   | Fix needed |
| 6 | Self-approval of time entries | Medium   | **Fixed** (ForbiddenException) |
