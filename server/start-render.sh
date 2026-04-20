#!/usr/bin/env bash
# Render start command for the Quantum Kaizen API.
#
# Render's Web Service runs this once per instance boot. It's the counterpart
# of docker-entrypoint.sh but for Render's plain-Linux runtime.
set -e

echo "[start-render] Syncing Prisma schema to database..."
npx prisma db push --accept-data-loss --skip-generate

if [ "${SEED_ON_START}" = "1" ] || [ "${SEED_ON_START}" = "true" ]; then
  echo "[start-render] Seeding (SEED_ON_START=$SEED_ON_START)..."
  npx tsx prisma/seed.ts || echo "[start-render] Base seed failed (continuing)."
fi

# Idempotent expansion seed — safe to run on every boot.
echo "[start-render] Running expansion seed..."
npx tsx prisma/seedMore.ts || echo "[start-render] Expansion seed failed (continuing)."

echo "[start-render] Starting server..."
exec node dist/index.js
