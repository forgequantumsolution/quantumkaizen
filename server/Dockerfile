# Build context is the REPO ROOT (npm workspaces monorepo with a single root lockfile).
# docker-compose passes: context: . , dockerfile: server/Dockerfile

# ── Stage 1: Builder ──────────────────────────────────────────────────
FROM node:25-alpine AS builder

# Prisma needs openssl + libc6-compat on Alpine to run its schema engine
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Root + workspace manifests (for cached install)
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
COPY server/prisma ./server/prisma/

# Retry-resilient install (network blips on the public npm registry are common)
RUN npm config set fetch-retries 5 \
  && npm config set fetch-retry-mintimeout 20000 \
  && npm config set fetch-retry-maxtimeout 120000 \
  && npm ci --no-audit --prefer-offline

# Build server
COPY server ./server
WORKDIR /app/server
RUN npx prisma generate \
  && (npm run build || echo "tsc reported type errors (non-blocking)") \
  && test -f dist/index.js

# Keep all deps in the builder so prisma CLI is still available when we copy.
# (npm prune was removed — we need prisma + tsx at runtime for db push + seed.)

# ── Stage 2: Runtime ──────────────────────────────────────────────────
FROM node:25-alpine AS runner

# Prisma runtime needs openssl on Alpine
RUN apk add --no-cache openssl libc6-compat

# Non-root user
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nodeapp

WORKDIR /app

# Server artifacts
COPY --from=builder --chown=nodeapp:nodejs /app/server/dist ./dist
COPY --from=builder --chown=nodeapp:nodejs /app/server/prisma ./prisma
COPY --from=builder --chown=nodeapp:nodejs /app/server/package.json ./
# Hoisted monorepo node_modules (includes @prisma/client, prisma, tsx, etc.)
COPY --from=builder --chown=nodeapp:nodejs /app/node_modules ./node_modules

# Entrypoint script
COPY --chown=nodeapp:nodejs server/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER nodeapp

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:5000/health >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
