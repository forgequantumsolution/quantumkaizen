# Quantum Kaizen — Simple Docker Deployment

One-command deploy of the full stack (Postgres, Redis, MinIO, API server, Web client) using Docker Compose.

---

## 1. Prerequisites

**Install Docker Desktop** (includes `docker` + `docker compose` v2):

- macOS: https://www.docker.com/products/docker-desktop/ → download `.dmg`, install, launch Docker.app, wait for "Docker Desktop is running".
- Verify: `docker --version` and `docker compose version` both print versions.

No other tooling is required. `openssl` (used to generate random secrets) ships with macOS.

---

## 2. Deploy

From the repo root (`quantumkaizen/repo/`):

```bash
./deploy.sh
```

On first run the script will:

1. Create `.env` from `.env.example` and inject strong random values for `JWT_SECRET`, `JWT_REFRESH_SECRET`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_ROOT_PASSWORD`.
2. Build the server + client Docker images (takes 3–6 min the first time).
3. Start Postgres → Redis → MinIO → server → client in order, waiting on each healthcheck.
4. The server entrypoint runs `prisma db push` to create the schema on first boot, then seeds the demo tenant (controlled by `SEED_ON_START` in `.env`).
5. Tail the logs until you Ctrl+C (the stack keeps running in the background).

When ready, open:

- **Web UI**: http://localhost
- **Health**: http://localhost/health

### Demo login (seeded on first boot)

- Tenant code: `AURORA-PH`
- Email: `admin@aurorabiopharma.com`
- Password: `QuantumK@izen2026`

Other seeded roles (`qa.head@…`, `qc.analyst@…`, `doc.controller@…`, …) all share the same password. Change immediately in a real deployment.

---

## 3. Operate

```bash
./deploy.sh status     # show container status
./deploy.sh logs       # tail all logs
./deploy.sh down       # stop containers (keeps data volumes)
./deploy.sh rebuild    # rebuild images from scratch and restart
./deploy.sh reset      # stop AND wipe all data volumes (destructive, asks for confirmation)
```

Direct compose commands also work:

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f server
docker compose -f docker-compose.prod.yml exec server sh
```

---

## 4. Ports & services

| Service  | Container           | Exposed on host      |
| -------- | ------------------- | -------------------- |
| Client   | `qk-client-prod`    | `${APP_PORT:-80}`    |
| Server   | `qk-server-prod`    | internal only (proxied through nginx) |
| Postgres | `qk-postgres-prod`  | internal only        |
| Redis    | `qk-redis-prod`     | internal only        |
| MinIO    | `qk-minio-prod`     | internal only        |

All traffic enters through the client container (nginx on port 80), which:

- Serves the React bundle at `/`
- Proxies `/api/*` → `server:5000`
- Proxies `/socket.io/*` → `server:5000` (WebSocket upgrade)
- Proxies `/health` → `server:5000/health`

To expose MinIO console (`:9001`) or Postgres (`:5432`) for debugging, uncomment the `ports:` lines in `docker-compose.prod.yml`.

---

## 5. Environment reference

All variables live in `.env`. Key ones:

| Variable               | Default                | Notes                                   |
| ---------------------- | ---------------------- | --------------------------------------- |
| `APP_PORT`             | `80`                   | Host port for the web UI                |
| `POSTGRES_PASSWORD`    | *(auto-generated)*     | Required                                |
| `JWT_SECRET`           | *(auto-generated)*     | Min 32 chars in production              |
| `JWT_REFRESH_SECRET`   | *(auto-generated)*     | Min 32 chars in production, ≠ JWT_SECRET |
| `CORS_ORIGIN`          | `http://localhost`     | Same-origin works out of the box        |
| `SEED_ON_START`        | `1`                    | Set to `0` on subsequent deploys        |
| `SMTP_HOST`            | *(empty)*              | Leave blank to disable email            |

---

## 6. Troubleshooting

**Build fails on `npm ci`.** Delete `node_modules` anywhere in the repo and retry: `./deploy.sh rebuild`.

**Server stuck "starting".** Check `./deploy.sh logs` — most common cause is `DATABASE_URL` mismatch or Postgres still initializing. The entrypoint waits via compose `depends_on: condition: service_healthy`, so give it ~30s on first run.

**`Prisma db push` fails.** Schema file is at `server/prisma/schema.prisma`. Reset with `./deploy.sh reset` then `./deploy.sh up`.

**Client shows "Backend unavailable".** Verify `curl http://localhost/health` returns JSON. If not, the server container is unhealthy — check `./deploy.sh logs`.

**Reset to clean slate.**

```bash
./deploy.sh reset
./deploy.sh up
```
