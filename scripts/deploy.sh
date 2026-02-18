#!/usr/bin/env bash
# Zero-downtime deploy for Hubnity Backend
# Usage: ./scripts/deploy.sh [--swarm]
#
# Prerequisites:
#   - Set HUBNITY_BACKEND_IMAGE in .env (e.g. ghcr.io/org/hubnity-backend:latest)
#   - For Swarm: docker swarm init
#
# Default: docker compose up with --scale backend=3
# --swarm: docker stack deploy (deploy.replicas, update_config, rollback)
set -e

cd "$(dirname "$0")/.."
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.prod.yml"
STACK_NAME="${STACK_NAME:-hubnity}"
USE_SWARM=false

for arg in "$@"; do
  case $arg in
    --swarm) USE_SWARM=true ;;
  esac
done

echo "==> Pulling latest images..."
docker compose $COMPOSE_FILES pull backend

echo "==> Running database migrations..."
docker compose $COMPOSE_FILES run --rm backend npx prisma migrate deploy

echo "==> Deploying backend..."
if $USE_SWARM; then
  if ! docker info 2>/dev/null | grep -q "Swarm: active"; then
    echo "Error: Swarm mode not active. Run: docker swarm init"
    exit 1
  fi
  docker stack deploy -c docker-compose.yml -c docker-compose.prod.yml $STACK_NAME
  echo "==> Stack $STACK_NAME updated. Check: docker service ls"
else
  docker compose $COMPOSE_FILES up -d --no-deps --scale backend=3 backend
  echo "==> Backend scaled to 3 replicas. Check: docker compose ps"
fi
