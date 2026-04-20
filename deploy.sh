#!/usr/bin/env bash
# Quantum Kaizen — one-command Docker deploy.
# Usage:
#   ./deploy.sh           # build + start everything
#   ./deploy.sh logs      # tail logs
#   ./deploy.sh down      # stop + remove containers (keeps volumes)
#   ./deploy.sh reset     # stop + remove containers AND volumes (WIPES DATA)
#   ./deploy.sh rebuild   # rebuild images from scratch and restart

set -euo pipefail

cd "$(dirname "$0")"

COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"

# Pick "docker compose" (v2) or fall back to "docker-compose" (v1)
if docker compose version >/dev/null 2>&1; then
  DC="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  DC="docker-compose"
else
  echo "ERROR: Docker is not installed or not in PATH."
  echo "Install Docker Desktop from https://www.docker.com/products/docker-desktop/"
  echo "then re-run this script."
  exit 1
fi

gen_secret() {
  # 48 random bytes, base64, strip '=+/', trim to 48 chars
  openssl rand -base64 48 2>/dev/null | tr -d '=+/\n' | cut -c1-48
}

ensure_env() {
  if [ -f "$ENV_FILE" ]; then
    echo "[deploy] Using existing $ENV_FILE"
    return
  fi
  echo "[deploy] No $ENV_FILE found — generating one with random secrets..."
  cp .env.example "$ENV_FILE"

  # Replace placeholders with strong secrets
  local jwt refresh pgpass redispass miniopass
  jwt=$(gen_secret)
  refresh=$(gen_secret)
  pgpass=$(gen_secret | cut -c1-24)
  redispass=$(gen_secret | cut -c1-24)
  miniopass=$(gen_secret | cut -c1-24)

  # Portable in-place sed (macOS + GNU)
  sed_inplace() {
    if sed --version >/dev/null 2>&1; then
      sed -i "$@"
    else
      sed -i '' "$@"
    fi
  }

  sed_inplace "s#^JWT_SECRET=.*#JWT_SECRET=$jwt#" "$ENV_FILE"
  sed_inplace "s#^JWT_REFRESH_SECRET=.*#JWT_REFRESH_SECRET=$refresh#" "$ENV_FILE"
  sed_inplace "s#^POSTGRES_PASSWORD=.*#POSTGRES_PASSWORD=$pgpass#" "$ENV_FILE"
  sed_inplace "s#^REDIS_PASSWORD=.*#REDIS_PASSWORD=$redispass#" "$ENV_FILE"
  sed_inplace "s#^MINIO_ROOT_PASSWORD=.*#MINIO_ROOT_PASSWORD=$miniopass#" "$ENV_FILE"

  echo "[deploy] Wrote $ENV_FILE with freshly generated secrets."
}

cmd="${1:-up}"

case "$cmd" in
  up|"")
    ensure_env
    echo "[deploy] Building images (this will take a few minutes on first run)..."
    $DC -f "$COMPOSE_FILE" build
    echo "[deploy] Starting stack..."
    $DC -f "$COMPOSE_FILE" up -d
    echo ""
    echo "[deploy] Stack is starting. Tailing server logs (Ctrl+C to stop tailing)..."
    echo "[deploy] Web UI:   http://localhost:$(grep '^APP_PORT=' "$ENV_FILE" | cut -d= -f2)"
    echo "[deploy] Health:   http://localhost:$(grep '^APP_PORT=' "$ENV_FILE" | cut -d= -f2)/health"
    echo "[deploy] MinIO UI: http://localhost:9001 (not exposed by default — see docker-compose.prod.yml)"
    echo ""
    echo "[deploy] Demo tenant (after seed):"
    echo "          tenant code: AURORA-PH"
    echo "          admin login: admin@aurorabiopharma.com / QuantumK@izen2026"
    echo ""
    sleep 2
    $DC -f "$COMPOSE_FILE" logs -f server client
    ;;
  logs)
    $DC -f "$COMPOSE_FILE" logs -f
    ;;
  down)
    $DC -f "$COMPOSE_FILE" down
    ;;
  reset)
    echo "[deploy] This will DESTROY all data volumes (postgres, redis, minio)."
    printf "[deploy] Type 'yes' to continue: "
    read -r ans
    if [ "$ans" = "yes" ]; then
      $DC -f "$COMPOSE_FILE" down -v
    else
      echo "[deploy] Cancelled."
    fi
    ;;
  rebuild)
    ensure_env
    $DC -f "$COMPOSE_FILE" build --no-cache
    $DC -f "$COMPOSE_FILE" up -d --force-recreate
    ;;
  ps|status)
    $DC -f "$COMPOSE_FILE" ps
    ;;
  *)
    echo "Unknown command: $cmd"
    echo "Usage: ./deploy.sh [up|logs|down|reset|rebuild|status]"
    exit 1
    ;;
esac
