# Quantum Kairoz — backend image (api + worker share this image)
#
# Build context is the REPO ROOT (npm workspaces monorepo).
# Build:   docker build -f backend/Dockerfile -t qk-backend .
# Run api: docker run -p 4000:4000 qk-backend
# Run worker: docker run qk-backend node dist/jobs/worker.js

ARG NODE_VERSION=20-alpine

# ── Base ─────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache openssl
WORKDIR /app

# ── deps: install ALL workspace deps (incl. dev) for building ────────
FROM base AS deps
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY client/package.json ./client/
RUN npm ci --no-audit --prefer-offline

# ── builder: generate prisma client + tsc backend ────────────────────
FROM deps AS builder
COPY backend ./backend
RUN npx prisma generate --schema backend/prisma/schema.prisma
RUN npm run build --workspace=backend
RUN test -f backend/dist/index.js && test -f backend/dist/jobs/worker.js

# ── prod-deps: install runtime deps only + regenerate prisma client ──
FROM base AS prod-deps
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY client/package.json ./client/
RUN npm ci --omit=dev --no-audit --prefer-offline \
      --workspace=backend --include-workspace-root
COPY backend/prisma ./backend/prisma
RUN npx prisma generate --schema backend/prisma/schema.prisma

# ── runtime: minimal image, non-root user ────────────────────────────
FROM base AS runtime
RUN apk add --no-cache curl \
 && addgroup -S app && adduser -S app -G app

ENV NODE_ENV=production
ENV PORT=4000

# Production node_modules (root-hoisted + workspace-local if any)
COPY --from=prod-deps --chown=app:app /app/node_modules ./node_modules
COPY --from=prod-deps --chown=app:app /app/backend/node_modules ./backend/node_modules
# Manifests so npm/prisma can resolve workspace at runtime
COPY --from=prod-deps --chown=app:app /app/package.json /app/package-lock.json ./
COPY --from=prod-deps --chown=app:app /app/backend/package.json ./backend/
# Prisma schema + migrations (needed for `prisma migrate deploy` on the host)
COPY --from=prod-deps --chown=app:app /app/backend/prisma ./backend/prisma
# Built JS
COPY --from=builder --chown=app:app /app/backend/dist ./backend/dist

USER app
WORKDIR /app/backend

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4000/health || exit 1

CMD ["node", "dist/index.js"]
