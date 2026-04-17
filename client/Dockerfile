# Build context is the REPO ROOT (npm workspaces monorepo with a single root lockfile).
# CI passes `context: .` and `file: ./client/Dockerfile`.

# ─── Stage 1: Builder ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root manifests + workspace manifests for cached install
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install all workspace deps
RUN npm ci

# Copy client sources and build the production bundle
COPY client ./client
WORKDIR /app/client
RUN npm run build

# ─── Stage 2: Nginx ───────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

LABEL maintainer="Forge Quantum Solutions <devops@forgequantum.com>"
LABEL description="Quantum Kaizen Web Client"
LABEL version="1.0.0"

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Custom nginx config
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

# Built assets from builder
COPY --from=builder /app/client/dist /usr/share/nginx/html

# Non-root nginx
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    touch /var/run/nginx.pid && \
    chown -R nginx:nginx /var/run/nginx.pid

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:80/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
