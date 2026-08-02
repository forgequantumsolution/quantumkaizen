#!/usr/bin/env bash
# Quantum Kaizen — DEMO stack deploy script.
#
# Lives at /opt/quantumkaizen/deploy.sh on the host, rsynced from
# deploy-demo/deploy.sh in the repo on EVERY deploy — edit it there, not on the
# VPS, or your changes are silently overwritten on the next run.
#
# Invoked by the "Deploy For Demo" workflow over SSH; also runnable by hand for
# a first deploy or recovery:
#
#   IMAGE_TAG=sha-abcd1234 \
#     BACKEND_IMAGE=ghcr.io/forgequantumsolution/quantumkaizen/backend \
#     FRONTEND_IMAGE=ghcr.io/forgequantumsolution/quantumkaizen/frontend \
#     bash /opt/quantumkaizen/deploy.sh
#
# This is the DEMO twin of /var/www/qk-v2/deploy.sh. It drives only the
# quantum-kaizen-demo compose project (kaizen-* containers) and never touches
# the production qk-* stack.
#
# Prereqs on host:
#   - /opt/quantumkaizen/.env exists, chmod 600, with POSTGRES_DB/USER/PASSWORD
#     and JWT_SECRET (min 16 chars — the API exits immediately without it)
#   - /opt/quantumkaizen/docker-compose.yml present (rsynced alongside this)
#   - `docker login ghcr.io` succeeded

set -euo pipefail

: "${IMAGE_TAG:?IMAGE_TAG must be set (e.g. sha-abcd1234 or latest)}"
: "${BACKEND_IMAGE:?BACKEND_IMAGE must be set}"
: "${FRONTEND_IMAGE:?FRONTEND_IMAGE must be set}"

cd "$(dirname "$0")"

# Host ports the stack publishes. Compose maps '${FRONTEND_PORT}:80' and
# '${API_PORT}:4000', so these must agree with what CI exports.
FRONTEND_PORT="${FRONTEND_PORT:-8081}"
API_PORT="${API_PORT:-4000}"
export IMAGE_TAG BACKEND_IMAGE FRONTEND_IMAGE FRONTEND_PORT API_PORT

# Named docker-compose.yml (not a -demo suffix) so bare `docker compose ps` and
# `docker compose logs` work when you are sitting in this directory.
COMPOSE="docker compose -f docker-compose.yml"

if [ ! -f .env ]; then
  echo "ERROR: /opt/quantumkaizen/.env not found." >&2
  echo "Create it once with POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD and" >&2
  echo "JWT_SECRET before the first demo deploy." >&2
  exit 1
fi

echo "==> Tag:      ${IMAGE_TAG}"
echo "==> Backend:  ${BACKEND_IMAGE}"
echo "==> Frontend: ${FRONTEND_IMAGE}"
echo "==> Ports:    frontend :${FRONTEND_PORT}  api :${API_PORT}"

echo "==> Pulling images"
$COMPOSE pull api worker frontend

echo "==> Ensuring Postgres is up"
$COMPOSE up -d postgres

# Resolve the container by compose service rather than hardcoding a name — a
# hardcoded literal that does not match the actual container_name silently
# burns the full timeout on every deploy instead of failing fast.
echo "==> Waiting for Postgres to be healthy"
for i in {1..30}; do
  pg_cid=$($COMPOSE ps -q postgres || true)
  status=$(docker inspect --format='{{.State.Health.Status}}' "${pg_cid}" 2>/dev/null || echo "starting")
  if [ "$status" = "healthy" ]; then
    echo "    Postgres healthy"
    break
  fi
  if [ "$i" = "30" ]; then
    echo "Postgres never became healthy (last status: ${status})"
    $COMPOSE logs --tail=50 postgres || true
    exit 1
  fi
  sleep 2
done

echo "==> Running Prisma migrations (one-shot container)"
$COMPOSE run --rm api npx prisma migrate deploy --schema prisma/schema.prisma

# Idempotent reference-data seeds. The sidebar auto-generates the "Risk" module
# from the `Risk` WorkflowType row, which migrations never create — only these
# seeds do. `tsx` is a devDependency (absent from the prod image), so fetch it
# on the fly with `npx -y`. Each seed is a no-op on re-run and MUST NOT abort the
# deploy, so failures are guarded — the app still rolls, just without the data.
echo "==> Seeding Risk Management reference data (idempotent; non-fatal)"
$COMPOSE run --rm api npx -y tsx prisma/seed-risk-workflow.ts \
  || echo "    WARNING: risk workflow seed failed — Risk sidebar module may not appear"
$COMPOSE run --rm api npx -y tsx prisma/seed-risk-master.ts \
  || echo "    WARNING: risk master-data seed failed — default frameworks may be missing"

echo "==> Rolling api + worker + frontend to new images"
$COMPOSE up -d --remove-orphans api worker frontend

echo "==> Local /health probe (API direct)"
sleep 5
for i in {1..15}; do
  if curl -fsS "http://127.0.0.1:${API_PORT}/health" > /dev/null; then
    echo "    api healthy at :${API_PORT}"
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
  if curl -fsS "http://127.0.0.1:${FRONTEND_PORT}/" > /dev/null; then
    echo "    frontend healthy at :${FRONTEND_PORT}"
    break
  fi
  if [ "$i" = "10" ]; then
    echo "Local frontend check failed"
    $COMPOSE logs --tail=80 frontend
    exit 1
  fi
  sleep 2
done

# Verifies nginx can actually reach the api service inside kaizen-net. A plain
# "/" probe serves static files even when proxy_pass points at a dead upstream.
echo "==> Frontend → api proxy probe"
curl -fsS "http://127.0.0.1:${FRONTEND_PORT}/health" > /dev/null \
  || { echo "Frontend cannot reach api — check proxy_pass upstream in nginx.conf"; \
       $COMPOSE logs --tail=40 frontend; exit 1; }
echo "    proxy healthy"

echo "==> Pruning dangling images"
docker image prune -f

echo "==> Demo deploy complete: ${IMAGE_TAG}"
echo ""
echo "    Frontend: http://<VPS_IP>:${FRONTEND_PORT}"
echo "    API:      http://<VPS_IP>:${API_PORT}"
