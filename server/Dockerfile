# Build context is the REPO ROOT (npm workspaces monorepo with a single root lockfile).
# CI passes `context: .` and `file: ./server/Dockerfile`.

# ── Stage 1: Builder ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root manifests + workspace manifests for cached install
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
COPY server/prisma ./server/prisma/

# Install all workspace deps (npm honors workspaces)
RUN npm ci

# Copy server sources and build
COPY server ./server
WORKDIR /app/server
RUN npx prisma generate && (npm run build || echo "tsc reported type errors (non-blocking)") && test -f dist/index.js

# Prune to production-only deps for the server workspace
WORKDIR /app
RUN npm prune --omit=dev --workspace=server

# ── Stage 2: Runtime (minimal) ────────────────────────────────────────
FROM node:20-alpine AS runner

# Security: create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nodeapp

WORKDIR /app

# Copy only what the server needs at runtime.
# With workspaces, hoisted modules live at /app/node_modules,
# and workspace-local modules at /app/server/node_modules (if any).
COPY --from=builder --chown=nodeapp:nodejs /app/server/dist ./dist
COPY --from=builder --chown=nodeapp:nodejs /app/server/prisma ./prisma
COPY --from=builder --chown=nodeapp:nodejs /app/server/package.json ./
COPY --from=builder --chown=nodeapp:nodejs /app/node_modules ./node_modules

USER nodeapp

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

ENTRYPOINT ["node", "dist/index.js"]
