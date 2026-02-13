#!/bin/sh
set -e

# POSTGRES_HOST / REDIS_HOST for K8s (hubnity-postgres, hubnity-redis); default postgres/redis for docker-compose
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
REDIS_HOST="${REDIS_HOST:-redis}"

echo "Waiting for PostgreSQL at $POSTGRES_HOST to start..."
until nc -z -w 2 "$POSTGRES_HOST" 5432 2>/dev/null; do
  echo "  PostgreSQL not ready, waiting..."
  sleep 2
done
echo "PostgreSQL started"

echo "Waiting for Redis at $REDIS_HOST to start..."
until nc -z -w 2 "$REDIS_HOST" 6379 2>/dev/null; do
  echo "  Redis not ready, waiting..."
  sleep 2
done
echo "Redis started"

echo "Syncing Prisma schema with database..."
npx prisma db push --accept-data-loss --skip-generate
npx prisma generate

echo "Starting application..."
exec "$@"

