# Production Deployment — Hubnity Backend

## Prerequisites

1. Run [ENV_CHECK.md](./ENV_CHECK.md) commands to verify cluster readiness.
2. PostgreSQL and Redis running (in-cluster or external).
3. Docker image built and pushed to your registry.

## Deployment Order

```bash
# 1. Namespace + ConfigMap
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml

# 2. Secrets (create from template or kubectl)
kubectl apply -f k8s/secrets.yaml   # or use kubectl create secret ...

# 3. PostgreSQL + Redis (if in-cluster)
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl wait --for=condition=ready pod -l app=hubnity-postgres -n hubnity --timeout=120s
kubectl wait --for=condition=ready pod -l app=hubnity-redis -n hubnity --timeout=60s

# 4. Migration Job (run BEFORE main app)
kubectl apply -f k8s/migration-job.yaml
kubectl wait --for=condition=complete job/hubnity-migrate -n hubnity --timeout=120s

# 5. Backend Deployment + Service
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# 6. Ingress
kubectl apply -f k8s/ingress.yaml
```

## Docker Entrypoint vs Migration Job

The Docker image's `docker-entrypoint.sh` runs `prisma db push` by default. For production with migrations:

- **Option A:** Rely on the migration job only. Change the entrypoint to run `prisma migrate deploy` instead of `prisma db push`, or add `SKIP_DB_SYNC=1` and skip the db sync step when that env is set.
- **Option B:** Keep the migration job and ensure the entrypoint does not run `db push` after migrations (it could overwrite migration history). Prefer `migrate deploy` in the entrypoint for production.

## Body Size

- **Ingress:** `proxy-body-size: "50m"` — allows large Base64 screenshots.
- **App:** Default `BODY_SIZE_LIMIT=10mb` (set in `main.ts`). To allow 50MB, set `BODY_SIZE_LIMIT=50mb` in ConfigMap.

## Questions Answered

| Question | Default / Note |
|----------|----------------|
| Docker Registry | `ghcr.io/balabiturembekov/hubnity-backend:latest` — change in deployment.yaml |
| Helm vs raw YAML | Raw YAML manifests (no Helm chart) |
| PostgreSQL/Redis | In-cluster (`hubnity-postgres`, `hubnity-redis`) — adjust DATABASE_URL/REDIS_URL for external |
