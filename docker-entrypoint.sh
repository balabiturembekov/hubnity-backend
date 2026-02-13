#!/bin/sh
set -e

echo "Waiting for PostgreSQL to start..."
until nc -z -w 2 postgres 5432 2>/dev/null; do
  echo "  PostgreSQL not ready, waiting..."
  sleep 2
done
echo "PostgreSQL started"

echo "Waiting for Redis to start..."
until nc -z -w 2 redis 6379 2>/dev/null; do
  echo "  Redis not ready, waiting..."
  sleep 2
done
echo "Redis started"

echo "Syncing Prisma schema with database..."
npx prisma db push --accept-data-loss --skip-generate
npx prisma generate

echo "Starting application..."
exec "$@"

