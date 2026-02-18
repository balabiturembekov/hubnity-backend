# Hubnity — Production-Ready Backend System Design

**Tech Stack:** NestJS (TypeScript), PostgreSQL (Prisma), Redis (Cache + BullMQ)  
**Infrastructure:** Kubernetes, Ingress Nginx, S3-compatible storage  
**Core:** High-frequency sync of time entries and screenshots from desktop clients

---

## 1. Domain Entities & Database Schema (PostgreSQL)

### Current vs Target State

| Entity | Current (Hubnity) | Target (Production) | Gap |
|--------|-------------------|---------------------|-----|
| **Users & Auth** | User, RefreshToken, PasswordResetToken | + subscription_status | Add subscription |
| **Organizations** | Company (flat) | Org → Projects → Teams → Users | Add Teams, hierarchy |
| **TimeEntries** | startTime, endTime, duration, status | + idempotencyKey, timezone | Add idempotency, TZ |
| **Screenshots** | imageUrl (local path) | s3_url, blur_level, metadata | S3, blur, metadata |
| **ActivityLogs** | AppActivity, UrlActivity | + keyboard_clicks, mouse_movements | Add activity metrics |

### Schema Additions (Prisma migrations)

```prisma
// === Users & Auth (extend existing) ===
model User {
  // ... existing fields
  subscriptionStatus SubscriptionStatus @default(FREE)
  timezone           String?            @default("UTC")
}

enum SubscriptionStatus {
  FREE
  TRIAL
  PRO
  ENTERPRISE
}

// === Organizations & Teams (hierarchical) ===
model Team {
  id          String   @id @default(uuid())
  name        String
  projectId   String
  companyId   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project  Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  company  Company @relation(fields: [companyId], references: [id], onDelete: Cascade)
  members  TeamMember[]

  @@index([projectId])
  @@index([companyId])
  @@map("teams")
}

model TeamMember {
  id        String   @id @default(uuid())
  teamId    String
  userId    String
  role      String   @default("MEMBER")
  createdAt DateTime @default(now())

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([teamId, userId])
  @@map("team_members")
}

// === TimeEntries (idempotency, timezone) ===
model TimeEntry {
  // ... existing fields
  idempotencyKey String?   @unique  // client-generated UUID for retry dedup
  timezone       String?   @default("UTC")
}

// === Screenshots (S3, blur, metadata) ===
model Screenshot {
  id           String   @id @default(uuid())
  timeEntryId  String
  s3Key        String   // S3 object key (e.g. screenshots/{companyId}/{timeEntryId}/{uuid}.jpg)
  s3Url        String?  // Full URL or CDN URL
  thumbnailKey String?  // S3 key for thumbnail
  blurLevel    Int      @default(0)  // 0=none, 1=low, 2=medium, 3=high
  capturedAt   DateTime @default(now())
  metadata     Json?    // { os, resolution, displayCount, ... }
  createdAt    DateTime @default(now())

  timeEntry TimeEntry @relation(...)
}

// === ActivityLogs (keyboard, mouse) ===
model ActivityLog {
  id          String   @id @default(uuid())
  timeEntryId String
  userId      String
  minute      DateTime // bucket: start of minute
  keyboardClicks Int   @default(0)
  mouseMovements Int  @default(0)
  createdAt   DateTime @default(now())

  timeEntry TimeEntry @relation(...)
  user      User      @relation(...)
  @@unique([timeEntryId, minute])
  @@index([userId, minute])
  @@map("activity_logs")
}
```

---

## 2. API Endpoints Strategy (REST)

### Auth Module (existing + refresh)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register + create org |
| POST | `/api/v1/auth/login` | Login, returns access + refresh tokens |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET | `/api/v1/auth/me` | Current user |
| POST | `/api/v1/auth/logout` | Revoke refresh token(s) |

### Sync Module (critical for desktop clients)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/sync/batch` | Bulk time entries with idempotency |
| POST | `/api/v1/sync/screenshots` | Multipart upload → S3 + metadata |

**POST /sync/batch** — Request body:
```json
{
  "entries": [
    {
      "idempotencyKey": "uuid-from-client",
      "userId": "uuid",
      "projectId": "uuid",
      "startTime": "2024-01-15T09:00:00Z",
      "endTime": "2024-01-15T17:00:00Z",
      "duration": 28800,
      "status": "STOPPED",
      "timezone": "Europe/Moscow",
      "description": "..."
    }
  ]
}
```

**Response:** `{ "processed": 5, "skipped": 2, "conflicts": [...] }`

**POST /sync/screenshots** — Multipart/form-data:
- `file` — image binary (stream to S3)
- `timeEntryId`, `blurLevel`, `metadata` (JSON string)

### Project Module (existing + tasks)

| Method | Endpoint | Description |
|--------|----------|-------------|
| CRUD | `/api/v1/projects` | Projects |
| CRUD | `/api/v1/projects/:id/tasks` | Tasks (optional) |
| GET | `/api/v1/projects/active` | Active projects |

### Reporting Module

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/reports/daily` | Daily summary (user, date range) |
| GET | `/api/v1/reports/team` | Team report (paginated, cursor-based) |
| GET | `/api/v1/reports/export` | CSV/Excel export (async job) |

---

## 3. Core Business Logic

### 3.1 Idempotency Handler

```
Client sends: { idempotencyKey: "abc-123", ... }
Backend:
  1. SELECT * FROM time_entries WHERE idempotency_key = 'abc-123'
  2. If found → return 200 with existing entry (skip insert)
  3. If not found → INSERT, return 201
  4. Store idempotencyKey in Redis (TTL 24h) for fast lookup before DB
```

**Redis key:** `idempotency:time_entry:{key}` → `{ timeEntryId, createdAt }`

### 3.2 Time Overlap Protection

```typescript
// Before INSERT/UPDATE time entry
const overlapping = await prisma.timeEntry.findFirst({
  where: {
    userId,
    status: { in: ['RUNNING', 'PAUSED'] },
    OR: [
      { startTime: { lte: newEnd }, endTime: { gte: newStart } },
      { endTime: null }  // running entry
    ],
    id: { not: currentId }
  }
});
if (overlapping) {
  // Option A: Reject with 409 Conflict
  // Option B: Auto-merge (extend endTime, sum duration)
  throw new ConflictException('Overlapping time entry');
}
```

### 3.3 Screenshot Processing (BullMQ)

```
1. Client uploads → API receives multipart
2. Stream directly to S3 (presigned URL or backend proxy)
3. Save metadata to DB (s3_key, time_entry_id, blur_level)
4. Enqueue job: screenshot-process (blur sensitive data, generate thumbnail)
5. Worker: sharp/blur → upload thumbnail to S3 → update DB
```

**Queue:** `screenshot-processing`  
**Concurrency:** 5 workers (CPU-bound)

---

## 4. Infrastructure & Scalability

### 4.1 Body Parser Limits

| Layer | Config | Value |
|-------|--------|-------|
| NestJS/Express | `express.json({ limit })` | 50mb |
| Ingress Nginx | `proxy-body-size` | 50m |
| Ingress (slow upload) | `configuration-snippet` | `client_body_timeout 120s;` |

### 4.2 Rate Limiting

| Scope | Limit | Storage |
|-------|-------|---------|
| Global | 1000 req/min (dev), 100 req/min (prod) | ThrottlerModule |
| Per-user (sync) | 60 req/min for `/sync/*` | Redis |
| Per-IP (auth) | 5 login attempts/min | Redis |

### 4.3 Logging & Monitoring

| Tool | Purpose |
|------|---------|
| **Sentry** | Error tracking (already integrated) |
| **Pino** | Structured JSON logs |
| **Prometheus** | Metrics (optional: `@willsoto/nestjs-prometheus`) |
| **Grafana** | Dashboards |

### 4.4 Stateless Design

- No in-memory session store → JWT + Redis for refresh tokens
- No sticky sessions required
- Horizontal scaling: multiple replicas behind Ingress
- S3 for screenshots → no local disk dependency
- Redis for cache, queues, idempotency → shared state

---

## 5. Development Roadmap

### Phase 1 — MVP (Current + Sync)
- [x] Auth (login, register, refresh)
- [x] Basic time tracking (CRUD, pause/resume/stop)
- [x] Screenshots (Base64 → local disk)
- [ ] **POST /sync/batch** with idempotency
- [ ] Add `idempotencyKey`, `timezone` to TimeEntry

### Phase 2 — Reliability
- [ ] S3 integration for screenshots (presigned URLs or stream upload)
- [ ] Multipart upload endpoint
- [ ] BullMQ job for blur/thumbnail
- [ ] K8s deployment (already have manifests)
- [ ] Ingress: `client_body_timeout`, `proxy-body-size`

### Phase 3 — Enterprise
- [ ] Teams & hierarchical org
- [ ] GET /reports/daily, /reports/team (cursor pagination)
- [ ] ActivityLog (keyboard, mouse)
- [ ] Subscription/billing hooks
- [ ] Prometheus metrics

---

## 6. Sync Module — Detailed Design

### POST /sync/batch

```typescript
// Pseudo-code
async syncBatch(dto: SyncBatchDto, userId: string) {
  const results = { processed: 0, skipped: 0, conflicts: [] };
  for (const entry of dto.entries) {
    if (!entry.idempotencyKey) {
      results.conflicts.push({ entry, reason: 'missing_idempotency_key' });
      continue;
    }
    const cached = await redis.get(`idempotency:te:${entry.idempotencyKey}`);
    if (cached) {
      results.skipped++;
      continue;
    }
    const existing = await prisma.timeEntry.findUnique({
      where: { idempotencyKey: entry.idempotencyKey }
    });
    if (existing) {
      await redis.setex(`idempotency:te:${entry.idempotencyKey}`, 86400, existing.id);
      results.skipped++;
      continue;
    }
    // Check overlap, then insert
    await this.createWithIdempotency(entry, userId);
    results.processed++;
  }
  return results;
}
```

### POST /sync/screenshots (Multipart → S3)

```
Option A: Backend receives multipart, streams to S3
  - Use @fastify/multipart or multer with stream
  - pipe(req.file.stream) → S3 upload

Option B: Presigned URL (recommended for large files)
  - POST /sync/screenshots/presign { timeEntryId, contentType }
  - Response: { uploadUrl, screenshotId }
  - Client PUT to uploadUrl
  - Client POST /sync/screenshots/confirm { screenshotId, metadata }
```

---

## 7. File Structure (Proposed)

```
src/
├── sync/
│   ├── sync.module.ts
│   ├── sync.controller.ts
│   ├── sync.service.ts
│   ├── idempotency.service.ts
│   └── dto/
├── storage/
│   ├── s3.service.ts
│   └── storage.module.ts
├── reports/
│   ├── reports.module.ts
│   ├── reports.controller.ts
│   └── reports.service.ts
└── ... (existing modules)
```

---

## 8. Environment Variables

```env
# Existing
DATABASE_URL=
REDIS_HOST=
JWT_SECRET=

# S3 (Phase 2)
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_REGION=

# Limits
BODY_SIZE_LIMIT=50mb
SYNC_RATE_LIMIT=60
```
