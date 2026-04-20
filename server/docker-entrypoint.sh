#!/bin/sh
set -e

echo "[entrypoint] Syncing Prisma schema to database..."
npx prisma db push --accept-data-loss --skip-generate

if [ "${SEED_ON_START}" = "1" ] || [ "${SEED_ON_START}" = "true" ]; then
  echo "[entrypoint] Seeding database (SEED_ON_START=$SEED_ON_START)..."
  npx tsx prisma/seed.ts || echo "[entrypoint] Base seed failed (continuing)."
else
  echo "[entrypoint] Skipping base seed (set SEED_ON_START=1 to enable)."
fi

# Always run the idempotent expansion seed so re-deploys top up missing data.
echo "[entrypoint] Running expansion seed (idempotent)..."
npx tsx prisma/seedMore.ts || echo "[entrypoint] Expansion seed failed (continuing)."

echo "[entrypoint] Starting server..."
exec node dist/index.js
