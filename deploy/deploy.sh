#!/usr/bin/env bash
# Quantum Kaizen — standalone VPS deploy script.
# Lives at /var/www/qk-v2/deploy.sh on the host.
# Invoked by GitHub Actions over SSH; also runnable by hand for first deploy
# or recovery:
#
#   IMAGE_TAG=sha-abcd1234 \
#     BACKEND_IMAGE=ghcr.io/forgequantumsolution/quantumkaizen/backend \
#     FRONTEND_IMAGE=ghcr.io/forgequantumsolution/quantumkaizen/frontend \
#     bash /var/www/qk-v2/deploy.sh
#
# Prereqs on host:
#   - /var/www/qk-v2/.env exists and is chmod 600
#   - /var/www/qk-v2/docker-compose.prod.yml present
#   - `docker login ghcr.io` succeeded for the forge user

set -euo pipefail

: "${IMAGE_TAG:?IMAGE_TAG must be set (e.g. sha-abcd1234 or latest)}"
: "${BACKEND_IMAGE:?BACKEND_IMAGE must be set}"
: "${FRONTEND_IMAGE:?FRONTEND_IMAGE must be set}"

cd "$(dirname "$0")"

export IMAGE_TAG BACKEND_IMAGE FRONTEND_IMAGE
COMPOSE="docker compose -f docker-compose.prod.yml"

echo "==> Tag:      ${IMAGE_TAG}"
echo "==> Backend:  ${BACKEND_IMAGE}"
echo "==> Frontend: ${FRONTEND_IMAGE}"

echo "==> Pulling images"
$COMPOSE pull api worker frontend

echo "==> Ensuring Postgres is up"
$COMPOSE up -d postgres

echo "==> Waiting for Postgres to be healthy"
for i in {1..30}; do
  status=$(docker inspect --format='{{.State.Health.Status}}' qk-postgres 2>/dev/null || echo "starting")
  if [ "$status" = "healthy" ]; then
    echo "    Postgres healthy"
    break
  fi
  if [ "$i" = "30" ]; then
    echo "Postgres never became healthy"
    docker logs --tail=50 qk-postgres
    exit 1
  fi
  sleep 2
done

echo "==> Running Prisma migrations (one-shot container)"
$COMPOSE run --rm api npx prisma migrate deploy --schema prisma/schema.prisma

echo "==> Rolling api + worker + frontend to new images"
$COMPOSE up -d --remove-orphans api worker frontend

echo "==> Local /health probe (API direct)"
sleep 5
for i in {1..15}; do
  if curl -fsS http://127.0.0.1:4000/health > /dev/null; then
    echo "    api healthy at :4000"
    break
  fi
  if [ "$i" = "15" ]; then
    echo "Local API health check failed"
    $COMPOSE logs --tail=80 api
    exit 1
  fi
  sleep 2
done

echo "==> Local frontend probe"
for i in {1..10}; do
  if curl -fsS http://127.0.0.1:8080/ > /dev/null; then
    echo "    frontend healthy at :8080"
    break
  fi
  if [ "$i" = "10" ]; then
    echo "Local frontend check failed"
    $COMPOSE logs --tail=80 frontend
    exit 1
  fi
  sleep 2
done

echo "==> Pruning dangling images"
docker image prune -f

echo "==> Deploy complete: ${IMAGE_TAG}"
echo ""
echo "    Frontend: http://<VPS_IP>:8080"
echo "    API:      http://<VPS_IP>:4000"
