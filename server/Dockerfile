# ── Stage 1: Builder ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies only
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

# Build TypeScript
COPY . .
RUN npx prisma generate && npm run build

# Prune to production deps only
RUN npm prune --omit=dev

# ── Stage 2: Runtime (minimal) ────────────────────────────────────────
FROM node:20-alpine AS runner

# Security: create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nodeapp

WORKDIR /app

# Copy only what's needed to run
COPY --from=builder --chown=nodeapp:nodejs /app/dist ./dist
COPY --from=builder --chown=nodeapp:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodeapp:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nodeapp:nodejs /app/package.json ./

# Switch to non-root user before exposing port
USER nodeapp

EXPOSE 5000

# Health check — liveness only (no DB call)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/health || exit 1

# ENTRYPOINT prevents argument injection (prefer over CMD)
ENTRYPOINT ["node", "dist/index.js"]
