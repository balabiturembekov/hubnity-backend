# Screenshots Ingestion Pipeline Audit

## Issue
Desktop App (Tauri) fails to sync screenshots with **400 Bad Request: Unterminated string in JSON**.

## Root Cause
When request body exceeds size limits, the payload is truncated. JSON parser receives incomplete string → "Unterminated string" → 400 Bad Request.

---

## Audit Results

### 1. NestJS Body Parser (main.ts) ✅

| Item | Status |
|------|--------|
| `bodyParser: false` | NestJS built-in disabled; we use Express directly |
| `express.json({ limit })` | **50mb** (was already set) |
| `express.urlencoded({ limit })` | **50mb** |
| Configurable via env | `BODY_SIZE_LIMIT` (default 50mb) |

**Fix applied:** Early Content-Length check + explicit 413 error handler for body-parser/JSON errors.

### 2. Kubernetes Ingress ✅

```yaml
annotations:
  nginx.ingress.kubernetes.io/proxy-body-size: "50m"
```

**Already configured.** If using a different Ingress (e.g. market-ingress), add the same annotation.

### 3. Database (PostgreSQL / Prisma) ✅

| Field | Type | Notes |
|-------|------|-------|
| `imageUrl` | String (TEXT) | Path to file on disk, not Base64 |
| `thumbnailUrl` | String? | Path to thumbnail |

Screenshots are stored as **files** in `uploads/screenshots/`. DB stores only paths. No column size limit.

### 4. ValidationPipe

Runs **after** body is parsed. If body is truncated, JSON parse fails before ValidationPipe. No impact.

### 5. Middleware Order

1. `/uploads` static
2. helmet
3. **Content-Length check** (early 413)
4. express.json
5. express.urlencoded
6. **Error handler** (body-parser/JSON errors → 413)

---

## Code Changes

### main.ts
- `BODY_LIMIT` constant (env: `BODY_SIZE_LIMIT`)
- Pre-parse Content-Length check → 413 with clear message
- Error handler for `entity.too.large` / "Unterminated string" → 413

### Ingress
- Annotation already present; comment added for clarity

---

## Logging

Errors now logged as:
```
[Request Entity Too Large] Content-Length: X, limit: Y, path: /api/v1/screenshots
[Request Entity Too Large] Unterminated string in JSON | path: /api/v1/screenshots
```

---

## Checklist for Deployment

- [ ] Apply `kubectl apply -f k8s/ingress.yaml` (proxy-body-size: 50m)
- [ ] If using different Ingress, add `nginx.ingress.kubernetes.io/proxy-body-size: "50m"`
- [ ] Rebuild and deploy backend with main.ts changes
- [ ] Optional: `BODY_SIZE_LIMIT=50mb` in ConfigMap if needed
