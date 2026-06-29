# Deploy Quantum Kaizen to GoDaddy VPS — v2 (Docker, standalone)

End-to-end guide for deploying a **new, isolated** Quantum Kaizen instance onto
the existing GoDaddy VPS — running side-by-side with the current deployment,
accessed by IP+port (no domain, no SSL). Auto-deploys on every push to
`shriyansh-backend`.

> **Audience:** zero VPS / Linux admin experience. Every command is copy-pasteable.
>
> **What this deploys:** a separate Quantum Kaizen stack at:
> - **Frontend:** `http://<VPS_IP>:8080`
> - **API:**      `http://<VPS_IP>:4000`
>
> **What it does NOT touch:**
> - The existing QK deployment serving `api.forgequantumsolution.com` (port 5126)
> - The static files at `/var/www/quantumkaizen/` (May 19 build)
> - The bare-metal Postgres on `:5432`
> - The `analytics_fe-app-1` container on `:3000`
> - Host nginx, certbot certs, DNS

---

## Target architecture

```
                              Internet
                                 │
                  http://<VPS_IP>:8080  (frontend, public)
                  http://<VPS_IP>:4000  (api, public)
                                 │
                                 ▼
                       Docker (already installed)
                                 │
        ┌───────────────┬────────┴──────────┬───────────────┐
        │               │                   │               │
        ▼               ▼                   ▼               ▼
   qk-frontend       qk-api             qk-worker      qk-postgres
   nginx:alpine      node:alpine        node:alpine    postgres:16-alpine
   :80 → host :8080  :4000 → host :4000  (no ports)    (no host port)
        │               │                   │               │
        └──── proxies   │                   └──────┐        │
              /api/* ──►│                          ▼        │
                        └──────────► Upstash Redis (rediss://...)
                                        (external, managed)
```

**Key choices**
- **All four services in one `docker compose`** — one command brings them up.
- **Frontend proxies `/api/*` internally** to the `qk-api` container (Docker
  network DNS), so the JS bundle uses relative URLs — no IP is baked in.
- **Postgres has no host port** — avoids collision with the bare-metal Postgres
  already on `:5432`.
- **Redis is containerized** (`qk-redis`, no host port) — used only by the worker for BullMQ.
- **GHCR for images.** GitHub Actions builds & pushes; the VPS pulls.

---

## What you need

| Thing | Value |
|---|---|
| VPS IP | `68.178.164.38` |
| VPS user | `forge` (or `root`) |
| Repo | https://github.com/forgequantumsolution/quantumkaizen |
| Deploy branch | `shriyansh-backend` |
| Redis | containerized — see `redis` service in `docker-compose.prod.yml` |
| GHCR | uses the workflow's `GITHUB_TOKEN` — nothing to provision in CI |

VPS prereqs (already installed on this box — verified):
Docker 29, Compose 5, nginx, certbot, git, rsync.

---

## Phases

| # | Phase | Where |
|---|---|---|
| 1 | Create the standalone folder + `.env` on the VPS | VPS |
| 2 | Authenticate VPS to GHCR | VPS |
| 3 | Bring up Postgres + ship first images by hand | Mac + VPS |
| 4 | First manual deploy via `deploy.sh` | VPS |
| 5 | GitHub Actions secrets | VPS + GitHub |
| 6 | Push to trigger CI deploy | Repo |
| 7 | Day-2 operations | reference |

---

# Phase 1 — Create the standalone folder + `.env`

## 1.1 Folder layout

On the VPS:

```bash
sudo mkdir -p /var/www/qk-v2/backups
sudo chown -R forge:forge /var/www/qk-v2
```

Final layout:
```
/var/www/qk-v2/
├── docker-compose.prod.yml   ← rsync'd by CI in Phase 6
├── deploy.sh                  ← rsync'd by CI in Phase 6
├── .env                       ← created by hand below (secrets, never in CI)
└── backups/                   ← pg_dump output goes here
```

## 1.2 Generate two strong secrets

On any machine (Windows PowerShell works):

```powershell
# POSTGRES_PASSWORD
$bytes = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes)
# JWT_SECRET
$bytes = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes); [Convert]::ToBase64String($bytes)
```

Or on the VPS:

```bash
openssl rand -base64 24    # POSTGRES_PASSWORD
openssl rand -base64 48    # JWT_SECRET
```

Save both in a password manager — you won't see them again.

## 1.3 Write `.env`

```bash
nano /var/www/qk-v2/.env
```

Paste and replace placeholders:

```dotenv
# Image registry + tag (overridden per-deploy by deploy.sh)
BACKEND_IMAGE=ghcr.io/forgequantumsolution/quantumkaizen/backend
FRONTEND_IMAGE=ghcr.io/forgequantumsolution/quantumkaizen/frontend
IMAGE_TAG=latest

# Postgres (containerized — no collision with the bare-metal one on :5432)
POSTGRES_DB=qk_prod
POSTGRES_USER=qk_app
POSTGRES_PASSWORD=<paste-openssl-output>

# JWT
JWT_SECRET=<paste-openssl-output>
JWT_EXPIRES_IN=7d

# CORS — same-origin requests come through the frontend proxy, but set this
# anyway for direct API calls (e.g. integration testing).
CORS_ORIGIN=http://68.178.164.38:8080

# Redis — containerized (qk-redis service in the compose, no host port)
REDIS_URL=redis://redis:6379

# Optional: BullMQ cron cadences (defaults in code are fine)
# SLA_SWEEP_CRON=*/15 * * * *
# APPROVAL_DEADLINE_CRON=*/30 * * * *
```

Lock it down:

```bash
chmod 600 /var/www/qk-v2/.env
```

✅ **End of Phase 1.**

---

# Phase 2 — Authenticate VPS to GHCR

GitHub Actions will push images to
`ghcr.io/forgequantumsolution/quantumkaizen/{backend,frontend}`.
The VPS needs to be able to pull (even from public images, login is
required if your repo is private).

## 2.1 Create a Personal Access Token (PAT)

GitHub → your profile photo → **Settings** → **Developer settings** →
**Personal access tokens** → **Tokens (classic)** → **Generate new token**:

- **Note:** `vps-ghcr-pull`
- **Expiration:** 1 year
- **Scopes:** `read:packages` (nothing else)

Click **Generate token**. Copy the value once — it's only shown once.

## 2.2 Log in on the VPS

```bash
echo '<paste-token>' | docker login ghcr.io -u <your-github-username> --password-stdin
```

Expected: `Login Succeeded`. Credentials are saved to `~/.docker/config.json`.

✅ **End of Phase 2.**

---

# Phase 3 — Bring up Postgres + ship first images by hand

Goal: prove the stack works end-to-end once by hand. After this, CI handles every deploy.

## 3.1 Build & push first images from your Mac/Windows

You need the workflow file committed to the branch later (Phase 6), but for the
first deploy we build locally so the VPS has something to pull.

In your repo, in a terminal that has Docker:

```bash
docker login ghcr.io -u <your-github-username>
# Use the same PAT — or a personal PAT with write:packages

# Backend
docker build -f backend/Dockerfile \
  -t ghcr.io/forgequantumsolution/quantumkaizen/backend:latest .
docker push ghcr.io/forgequantumsolution/quantumkaizen/backend:latest

# Frontend
docker build -f client/Dockerfile \
  --build-arg VITE_API_BASE_URL=/api \
  -t ghcr.io/forgequantumsolution/quantumkaizen/frontend:latest .
docker push ghcr.io/forgequantumsolution/quantumkaizen/frontend:latest
```

## 3.2 Copy compose + deploy.sh to the VPS

From your repo:

```bash
scp docker-compose.prod.yml deploy/deploy.sh \
    forge@68.178.164.38:/var/www/qk-v2/
ssh forge@68.178.164.38 'chmod +x /var/www/qk-v2/deploy.sh'
```

✅ **End of Phase 3.**

---

# Phase 4 — First manual deploy

## 4.1 Run deploy.sh on the VPS

```bash
ssh forge@68.178.164.38
cd /var/www/qk-v2

IMAGE_TAG=latest \
  BACKEND_IMAGE=ghcr.io/forgequantumsolution/quantumkaizen/backend \
  FRONTEND_IMAGE=ghcr.io/forgequantumsolution/quantumkaizen/frontend \
  bash deploy.sh
```

`deploy.sh` will:
1. Pull all three images from GHCR
2. Start Postgres + wait for healthy
3. Run `prisma migrate deploy` in a one-shot container
4. Roll `api`, `worker`, `frontend` to the new images
5. Local health probes on `:4000` (api) and `:8080` (frontend)
6. Prune dangling images

## 4.2 End-to-end smoke

From the VPS:

```bash
curl http://127.0.0.1:4000/health
# {"status":"ok"}

curl -I http://127.0.0.1:8080/
# HTTP/1.1 200 OK
```

From your laptop's browser:

- **http://68.178.164.38:8080** — should show the QK app shell
- **http://68.178.164.38:4000/health** — should show `{"status":"ok"}`

If both work, the new deployment is live. The OLD deployment at
`api.forgequantumsolution.com` should still be working too — check it.

✅ **End of Phase 4.**

---

# Phase 5 — GitHub Actions secrets

We need GitHub Actions to be able to SSH into the VPS as a dedicated deploy
identity (not your personal SSH key).

## 5.1 Generate a deploy keypair ON the VPS

```bash
ssh forge@68.178.164.38
ssh-keygen -t ed25519 -N "" -C "github-actions" -f ~/.ssh/gh_actions_deploy
```

## 5.2 Authorize the deploy key

```bash
cat ~/.ssh/gh_actions_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh
```

## 5.3 Copy the PRIVATE key

```bash
cat ~/.ssh/gh_actions_deploy
```

Copy the **entire output** including the `-----BEGIN…` and `-----END…` lines.

## 5.4 Add GitHub repo secrets

Repo → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**. Add three:

| Name | Value |
|------|-------|
| `VPS_HOST` | `68.178.164.38` |
| `VPS_USER` | `forge` |
| `VPS_SSH_KEY` | the private key from 5.3 (whole thing) |

> No GHCR token needed in CI — the workflow uses the built-in `GITHUB_TOKEN`
> with `packages: write` permission.

## 5.5 Delete the private key from the VPS

```bash
shred -u ~/.ssh/gh_actions_deploy
# .pub stays. authorized_keys already has the key. GitHub has the private.
```

✅ **End of Phase 5.**

---

# Phase 6 — Push to trigger CI deploy

## 6.1 Commit + push

On your Mac/Windows machine:

```bash
git checkout shriyansh-backend
git add backend/Dockerfile \
        client/Dockerfile \
        client/nginx.conf \
        docker-compose.prod.yml \
        .github/workflows/deploy-vps.yml \
        deploy/ \
        GODADDY_VPS_DEPLOY_V2.md
git commit -m "ci: dockerized standalone VPS deployment"
git push origin shriyansh-backend
```

## 6.2 Watch the workflow

GitHub → **Actions** → "Deploy to GoDaddy VPS" → latest run.

Pipeline:
1. **build** — `docker buildx build` for backend + frontend in parallel, push both to GHCR
2. **deploy** — rsync compose + script → SSH → `deploy.sh`
3. **Public smoke test** — `curl http://68.178.164.38:4000/health` from the runner

First run ~6–8 min (cold buildx cache). Subsequent: ~2–3 min.

## 6.3 Make a trivial visible change

```bash
# Edit something obvious (e.g. <title> in client/index.html)
git commit -am "test: trigger VPS deploy"
git push origin shriyansh-backend
```

Wait for the green check, reload `http://68.178.164.38:8080/` in an
incognito window (to bypass cache). New title should appear.

## 6.4 Confirm rollout

```bash
ssh forge@68.178.164.38
cd /var/www/qk-v2
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=30 api
```

Look for a fresh start timestamp + the new image tag.

✅ **End of Phase 6.** Auto-deploy works.

---

# Phase 7 — Day-2 operations

## Deploy a change
```bash
git push origin shriyansh-backend     # ~2–3 min via GH Actions
```

## Read logs
```bash
cd /var/www/qk-v2
docker compose -f docker-compose.prod.yml logs -f               # all, live tail
docker compose -f docker-compose.prod.yml logs --tail=200 api
docker compose -f docker-compose.prod.yml logs --tail=200 worker
docker compose -f docker-compose.prod.yml logs --tail=200 frontend
```

## Manual restart
```bash
cd /var/www/qk-v2
docker compose -f docker-compose.prod.yml restart api      # quick
docker compose -f docker-compose.prod.yml up -d api        # picks up new image if pulled
```

## Get a psql shell into the containerized Postgres
```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U qk_app -d qk_prod
```

## Database backups

Create `/home/forge/qk-v2-backup.sh`:

```bash
#!/bin/bash
set -e
BACKUP_DIR=/var/www/qk-v2/backups
DATE=$(date +%Y-%m-%d_%H-%M)
docker compose -f /var/www/qk-v2/docker-compose.prod.yml exec -T postgres \
  pg_dump -U qk_app -F c qk_prod > "$BACKUP_DIR/qk_prod_$DATE.dump"
find $BACKUP_DIR -name 'qk_prod_*.dump' -mtime +14 -delete
```

```bash
chmod +x /home/forge/qk-v2-backup.sh
crontab -e
# add:
0 3 * * * /home/forge/qk-v2-backup.sh >> /home/forge/qk-v2-backup.log 2>&1
```

For off-site backups, rsync `/var/www/qk-v2/backups/` to S3 / B2 / your Mac weekly.

## Rollback a bad deploy

**Option A — redeploy a previous image tag** (no git changes, fastest):

```bash
ssh forge@68.178.164.38
cd /var/www/qk-v2
IMAGE_TAG=sha-<previous-good-sha> \
  BACKEND_IMAGE=ghcr.io/forgequantumsolution/quantumkaizen/backend \
  FRONTEND_IMAGE=ghcr.io/forgequantumsolution/quantumkaizen/frontend \
  bash deploy.sh
```

Available tags: GitHub → your profile → **Packages** → `quantumkaizen/backend` or `/frontend`.

**Option B — revert the commit:**
```bash
git revert HEAD
git push origin shriyansh-backend
```

## OS updates
```bash
sudo apt update && sudo apt upgrade -y
sudo reboot         # if kernel updated; pm2/docker auto-restart on boot
```

---

# Troubleshooting

### `docker compose pull` fails with "denied" on GHCR
PAT expired or scope wrong. Regenerate (Phase 2) with `read:packages` only,
re-run `docker login ghcr.io`.

### Frontend at `:8080` shows blank / 502
The frontend nginx can't reach the api container. Check:
```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=80 api
docker compose -f docker-compose.prod.yml exec frontend wget -qO- http://api:4000/health
```

### API at `:4000` returns "Invalid environment variables"
Zod validation in `backend/src/config/env.ts` failed. Check the log for the
exact field. Common causes: `JWT_SECRET` < 16 chars, `DATABASE_URL` malformed.

### Prisma can't connect to Postgres
Service name in the URL must be `postgres` (compose service name), not
`localhost`. Inside Docker, containers reach each other by service name.

### Port 4000 or 8080 conflict on the VPS
Something else grabbed the port:
```bash
sudo ss -tlnp | grep -E ':(4000|8080) '
```
Free it or change the host-side port in `docker-compose.prod.yml`.

### CORS errors when calling the API directly from another origin
The frontend goes through `/api/*` proxy (same-origin, no CORS). Direct
external callers of `http://68.178.164.38:4000` need their origin in
`CORS_ORIGIN`. Edit `.env`, then:
```bash
docker compose -f /var/www/qk-v2/docker-compose.prod.yml up -d api
```

### Volume `quantum-kaizen_pgdata` got nuked — how do I restore?
```bash
cd /var/www/qk-v2
docker compose -f docker-compose.prod.yml up -d postgres
# wait for healthy, then:
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore --no-owner --no-acl -U qk_app -d qk_prod \
  < /var/www/qk-v2/backups/qk_prod_<latest>.dump
```

### GitHub Actions step `Trust VPS host key` fails
VPS IP changed, or something is blocking the runner. From your laptop:
```bash
ssh-keyscan 68.178.164.38     # should return keys, not hang
```

### "permission denied" on `/var/run/docker.sock` when running `docker`
`forge` not in `docker` group. Fix once:
```bash
sudo usermod -aG docker forge
exit && ssh forge@68.178.164.38   # re-login for group to take effect
```

---

# When you're ready to move to a real domain

This guide deploys to IP+port for speed. When you want
`app.forgequantumsolution.com` and HTTPS, the steps are:

1. Add an A record `app` → `68.178.164.38` in GoDaddy DNS.
2. Add an nginx server block on the host for `app.forgequantumsolution.com`
   that reverse-proxies to `http://127.0.0.1:8080`. Example:
   ```nginx
   server {
       listen 80;
       server_name app.forgequantumsolution.com;
       location / {
           proxy_pass http://127.0.0.1:8080;
           proxy_set_header Host $host;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
3. `sudo certbot --nginx -d app.forgequantumsolution.com`
4. Update `CORS_ORIGIN` in `.env` to `https://app.forgequantumsolution.com`
   and restart api.

The Docker stack doesn't change at all.

---

# Security checklist (do later, when shipping more)

This guide intentionally skips hardening to keep first deploy simple.
Revisit after the deploy is stable:

- [ ] SSH key auth instead of password
- [ ] Disable root SSH (`PermitRootLogin no`)
- [ ] `ufw` enabled (only allow 22 + currently-used app ports)
- [ ] `fail2ban` running
- [ ] `unattended-upgrades` for OS patches
- [ ] `chmod 600 /var/www/qk-v2/.env`, owned by `forge` (already done in Phase 1.3)
- [ ] `JWT_SECRET` rotated from any previously-exposed values
- [ ] Daily DB backup runs (`/home/forge/qk-v2-backup.log`)
- [ ] Backups copied off-VPS at least weekly
- [ ] PAT on the VPS scoped to `read:packages` only with expiry set
- [ ] When you add a domain: HSTS header, `Strict-Transport-Security`
