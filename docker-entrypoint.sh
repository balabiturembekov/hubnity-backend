#!/bin/sh
set -e

echo "Waiting for PostgreSQL to start..."
while ! nc -z postgres 5432; do
  sleep 0.1
done
echo "PostgreSQL started"

echo "Waiting for Redis to start..."
while ! nc -z redis 6379; do
  sleep 0.1
done
echo "Redis started"

echo "Syncing Prisma schema with database..."
npx prisma db push --accept-data-loss --skip-generate
npx prisma generate

echo "Starting application..."
exec "$@"

