# Deploy Quantum Kaizen to GoDaddy VPS

End-to-end guide for moving the app off Render/Netlify and onto a self-managed
GoDaddy VPS, with automated deployment from GitHub on every push to
`shriyansh-backend`.

> **Audience:** someone with zero VPS / Linux admin experience.
> Every command is copy-pasteable. Read each section top to bottom — do not skip.

---

## Target architecture

```
                                    Internet
                                       │
                       forgequantumsolution.com  +  www.forgequantumsolution.com
                          api.forgequantumsolution.com
                                       │
                                       ▼
                              GoDaddy DNS (A records)
                                       │
                                       ▼
                            VPS  68.178.164.38  (Ubuntu 24.04)
                                       │
            ┌──────────────────────────┴─────────────────────────────┐
            │                                                         │
            ▼                                                         ▼
       nginx :80/:443                                          PM2 process manager
    (TLS via Let's Encrypt)                                          │
            │                                                         │
   ┌────────┴────────┐                                                │
   │                 │                                                │
   ▼                 ▼                                                │
static files     reverse proxy ──► localhost:4000 ◄── qk-api  (Express + Prisma)
React build      api.* subdomain                  ◄── qk-worker (BullMQ)
/var/www/...
                                                         │
                                              ┌──────────┴──────────┐
                                              ▼                     ▼
                                       PostgreSQL 16          Redis (Upstash)
                                       (self-hosted          (managed, free tier)
                                        on this VPS)
```

**Why this layout**
- **nginx** terminates HTTPS, serves static React files, and reverse-proxies
  `api.*` to the Node backend on `localhost:4000`. The Node process never
  listens on a public port — only nginx is internet-facing.
- **PM2** keeps the Node API and BullMQ worker alive across crashes and reboots.
- **PostgreSQL** runs locally on this VPS (your choice — see Phase 7 for
  migration from Neon).
- **Redis** stays on Upstash (managed, free tier, zero ops).

---

## What you need before you start

| Thing | Value (yours) |
|---|---|
| VPS IP | `68.178.164.38` |
| VPS OS | Ubuntu 24.04 LTS |
| VPS login user | `forge` (has sudo) |
| Domain | `forgequantumsolution.com` (at GoDaddy) |
| Redis | Upstash connection string (`rediss://...`) — keep current one |
| Repo | https://github.com/forgequantumsolution/quantumkaizen |
| Deploy branch | `shriyansh-backend` |

You'll also need:
- A Mac/Linux terminal that can SSH
- Your GoDaddy account login (for DNS in Phase 4)
- Your GitHub account with admin access to the repo (for Phase 10–11)

---

## Phases at a glance

| # | Phase | What you do | Where |
|---|---|---|---|
| 1 | Harden the server | SSH keys, firewall, fail2ban, swap, timezone | VPS |
| 2 | Install software | Node 20, Postgres 16, nginx, certbot, PM2, git | VPS |
| 3 | Create database | DB, user, password | VPS |
| 4 | Configure DNS | A records pointing to VPS IP | GoDaddy |
| 5 | Configure nginx | Server blocks for frontend + API subdomain | VPS |
| 6 | Issue SSL certs | Let's Encrypt via certbot | VPS |
| 7 | Migrate data | Dump Neon → restore to local Postgres | Mac + VPS |
| 8 | First manual deploy | Clone, build, migrate, start | VPS |
| 9 | PM2 boot persistence | Auto-restart on reboot | VPS |
| 10 | GitHub Actions secrets | Deploy key + secrets | VPS + GitHub |
| 11 | GitHub Actions workflow | `.github/workflows/deploy-vps.yml` | Repo |
| 12 | Smoke test | Push, watch it deploy | Repo |
| 13 | Decommission Render/Netlify | Pause/delete services | Render + Netlify |

---

# Phase 1 — Harden the server

Goal: prevent random internet bots from compromising the box on day 1.

## 1.1 Confirm `forge` has sudo

```bash
ssh forge@68.178.164.38
sudo whoami           # should print: root
```

If it does, you're good. If not, stop and get root creds from GoDaddy to add
`forge` to the `sudo` group: `usermod -aG sudo forge`.

## 1.2 Set up SSH key login (and disable password login)

### 1.2a — Generate a key on your Mac (skip if you already have `~/.ssh/id_ed25519`)

```bash
# On your Mac, NOT the server
ssh-keygen -t ed25519 -C "info@forgequantumsolution.com"
# Press Enter 3 times to accept defaults & no passphrase
```

### 1.2b — Copy the public key to the VPS

```bash
# On your Mac
ssh-copy-id forge@68.178.164.38
# Enter forge's password one last time
```

### 1.2c — Test key login works (CRITICAL — do not skip)

```bash
# On your Mac, in a fresh terminal
ssh forge@68.178.164.38
# Should log you in WITHOUT asking for a password
```

If this fails, **do not proceed to 1.2d** — you'll lock yourself out. Debug
first: re-run `ssh-copy-id`, or paste the key manually into
`~/.ssh/authorized_keys` on the server.

### 1.2d — Disable password login on the server

Only after 1.2c works. On the VPS:

```bash
sudo nano /etc/ssh/sshd_config.d/99-hardening.conf
```

Paste:

```
PasswordAuthentication no
PermitRootLogin no
PubkeyAuthentication yes
```

Save (`Ctrl+O`, Enter, `Ctrl+X`), then reload SSH:

```bash
sudo systemctl reload ssh
```

Open a **new terminal tab** and confirm `ssh forge@68.178.164.38` still works
before closing your current session.

## 1.3 Enable the firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'      # ports 80 and 443
sudo ufw --force enable
sudo ufw status                  # should show 22, 80, 443 as ALLOW
```

## 1.4 Install fail2ban (blocks SSH brute-force)

```bash
sudo apt update
sudo apt install -y fail2ban
sudo systemctl enable --now fail2ban
sudo fail2ban-client status      # should show jail "sshd"
```

## 1.5 Set timezone & hostname

```bash
sudo timedatectl set-timezone Asia/Kolkata     # or your timezone
sudo hostnamectl set-hostname qk-prod
```

Log out and back in to see the new hostname in your prompt.

## 1.6 Create a 2 GB swap file

Small VPSes often crash during `npm ci` or `tsc` builds when memory runs out.
Swap is cheap insurance.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h                          # should show "Swap: 2.0Gi"
```

## 1.7 Update all packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt autoremove -y
```

If kernel was updated, reboot:

```bash
sudo reboot
# wait 30s, then re-ssh
```

✅ **End of Phase 1.** Server is hardened. Memory is safe. Firewall is up.

---

# Phase 2 — Install software

## 2.1 Node.js 20 (via NodeSource — Ubuntu's default is too old)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version       # v20.x.x
npm --version        # 10.x.x
```

## 2.2 PostgreSQL 16

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
sudo -u postgres psql -c "SELECT version();"   # confirm running
```

## 2.3 nginx

```bash
sudo apt install -y nginx
sudo systemctl enable --now nginx
curl http://localhost                          # should print nginx welcome HTML
```

## 2.4 certbot (Let's Encrypt SSL, via snap — Ubuntu 24.04 recommended path)

```bash
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot
certbot --version
```

## 2.5 PM2 (process manager — keeps Node alive)

```bash
sudo npm install -g pm2
pm2 --version
```

## 2.6 git

```bash
sudo apt install -y git
git --version
```

## 2.7 rsync (used by the GitHub Actions deploy in Phase 11)

```bash
sudo apt install -y rsync
rsync --version | head -1
```

✅ **End of Phase 2.** All runtime software is installed.

---

# Phase 3 — Create the PostgreSQL database

## 3.1 Create a database role and database

Replace `STRONG_PASSWORD_HERE` with a 32-char random password.
Generate one with: `openssl rand -base64 24` (run on your Mac, copy the output).

```bash
sudo -u postgres psql <<EOF
CREATE USER qk_app WITH PASSWORD 'STRONG_PASSWORD_HERE';
CREATE DATABASE qk_prod OWNER qk_app;
GRANT ALL PRIVILEGES ON DATABASE qk_prod TO qk_app;
\c qk_prod
GRANT ALL ON SCHEMA public TO qk_app;
EOF
```

## 3.2 Test the connection as the app user

```bash
psql "postgresql://qk_app:STRONG_PASSWORD_HERE@localhost:5432/qk_prod" -c "SELECT current_database(), current_user;"
```

Expected:
```
 current_database | current_user
------------------+--------------
 qk_prod          | qk_app
```

## 3.3 Save the connection string for later

You'll paste this into the `.env` file in Phase 8:

```
DATABASE_URL=postgresql://qk_app:STRONG_PASSWORD_HERE@localhost:5432/qk_prod?schema=public
DIRECT_URL=postgresql://qk_app:STRONG_PASSWORD_HERE@localhost:5432/qk_prod?schema=public
```

Both URLs are the same when self-hosted (the Neon split was only because of
pgbouncer pooling — irrelevant here).

✅ **End of Phase 3.** Database is provisioned and reachable on `localhost:5432`.

---

# Phase 4 — Point your GoDaddy domain at the VPS

## 4.1 Open DNS in GoDaddy

1. https://account.godaddy.com → My Products → Domains → `forgequantumsolution.com` → **DNS**
2. You'll see the **DNS Records** table (you've been here before — same view as your screenshot).

## 4.2 Delete any conflicting records first

Look for **existing `A` records** with name `@` or `www` — they probably point at GoDaddy parking pages. Click the trash icon to remove them. (Don't touch any `MX` records — those are for email.)

## 4.3 Add three A records

Click **Add New Record** three times and fill in:

| Type | Name | Value (Points to) | TTL |
|------|------|---------------------|-----|
| A    | `@`  | `68.178.164.38`     | 600 seconds |
| A    | `www`| `68.178.164.38`     | 600 seconds |
| A    | `api`| `68.178.164.38`     | 600 seconds |

Save.

## 4.4 Wait for DNS propagation

Check at https://dnschecker.org → type `forgequantumsolution.com` → most regions should return `68.178.164.38` within 5–30 minutes (despite the "24h" warning).

Verify from your Mac:

```bash
dig +short forgequantumsolution.com
dig +short www.forgequantumsolution.com
dig +short api.forgequantumsolution.com
# All three should print: 68.178.164.38
```

**Do not proceed to Phase 6 (SSL) until all three resolve correctly.** Let's
Encrypt will fail otherwise.

✅ **End of Phase 4.** Your domain points at your VPS.

---

# Phase 5 — Configure nginx

We'll create two server blocks:
- `forgequantumsolution.com` + `www.` → static React app from `/var/www/quantumkaizen/client`
- `api.forgequantumsolution.com` → reverse proxy to `http://localhost:4000`

## 5.1 Create the web root for the frontend

```bash
sudo mkdir -p /var/www/quantumkaizen/client
sudo mkdir -p /var/www/quantumkaizen/backend
sudo chown -R forge:forge /var/www/quantumkaizen
```

Drop a placeholder `index.html` so we can test nginx before the real app is deployed:

```bash
echo '<h1>Quantum Kaizen — coming soon</h1>' > /var/www/quantumkaizen/client/index.html
```

## 5.2 Frontend nginx config

```bash
sudo nano /etc/nginx/sites-available/forgequantumsolution.com
```

Paste:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name forgequantumsolution.com www.forgequantumsolution.com;

    root /var/www/quantumkaizen/client;
    index index.html;

    # SPA fallback: every unknown path serves index.html so React Router works.
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Long-cache hashed Vite assets.
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    client_max_body_size 10M;
}
```

## 5.3 API nginx config

```bash
sudo nano /etc/nginx/sites-available/api.forgequantumsolution.com
```

Paste:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.forgequantumsolution.com;

    client_max_body_size 25M;     # uploads / large JSON payloads

    location / {
        proxy_pass         http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";
        proxy_read_timeout 90s;
    }
}
```

## 5.4 Enable both sites and disable the default

```bash
sudo ln -s /etc/nginx/sites-available/forgequantumsolution.com /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/api.forgequantumsolution.com /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t                # must say "syntax is ok" + "test is successful"
sudo systemctl reload nginx
```

## 5.5 Smoke test

In your Mac browser, visit:
- http://forgequantumsolution.com → should show "Quantum Kaizen — coming soon"
- http://api.forgequantumsolution.com → should show "502 Bad Gateway" (expected — backend isn't running yet)

If the frontend shows the placeholder, nginx is wired up correctly.

✅ **End of Phase 5.** nginx serves the frontend and proxies the API path.

---

# Phase 6 — Issue Let's Encrypt SSL certificates

## 6.1 Run certbot

certbot will read your nginx config, prove ownership over HTTP, fetch certs,
edit nginx to add HTTPS server blocks, and set up auto-renewal — all in one
command.

```bash
sudo certbot --nginx \
  -d forgequantumsolution.com \
  -d www.forgequantumsolution.com \
  -d api.forgequantumsolution.com \
  --agree-tos -m info@forgequantumsolution.com \
  --redirect
```

Answer prompts:
- Email: already on the command line
- Terms of Service: `Y`
- EFF email signup: `N` (your choice)
- `--redirect` flag means certbot will add HTTP→HTTPS 301 redirects automatically

## 6.2 Verify

```bash
curl -I https://forgequantumsolution.com         # 200 OK with cert
curl -I https://api.forgequantumsolution.com     # 502 (backend not up yet)
curl -I http://forgequantumsolution.com          # 301 Moved Permanently → https://...
```

## 6.3 Confirm auto-renewal is set up

```bash
sudo systemctl list-timers | grep certbot        # snap.certbot.renew.timer should exist
sudo certbot renew --dry-run                     # simulates renewal — should succeed
```

Certs renew automatically twice a day; renewal only triggers if cert is within
30 days of expiry.

✅ **End of Phase 6.** HTTPS works. All HTTP traffic redirects to HTTPS.

---

# Phase 7 — Migrate data from Neon to your local Postgres

If you're starting with a fresh database (no users, no data worth keeping),
skip to Phase 7.2 and just run migrations from scratch.

## 7.1 Dump from Neon (run on your Mac)

```bash
# Use the existing Neon connection string from backend/.env
pg_dump \
  --no-owner \
  --no-acl \
  --format=custom \
  --file=qk_neon_dump.sql \
  "postgresql://neondb_owner:npg_ONwe75zyVYjp@ep-restless-hat-amtkx32f.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

(If `pg_dump` is not installed on your Mac: `brew install postgresql@16`.)

## 7.2 Copy the dump to the VPS

```bash
scp qk_neon_dump.sql forge@68.178.164.38:/tmp/qk_neon_dump.sql
```

## 7.3 Restore into the local Postgres (run on the VPS)

```bash
pg_restore \
  --no-owner --no-acl \
  --dbname="postgresql://qk_app:STRONG_PASSWORD_HERE@localhost:5432/qk_prod" \
  /tmp/qk_neon_dump.sql

rm /tmp/qk_neon_dump.sql
```

## 7.4 Sanity check

```bash
psql "postgresql://qk_app:STRONG_PASSWORD_HERE@localhost:5432/qk_prod" \
  -c "\dt"                                       # list tables
psql "postgresql://qk_app:STRONG_PASSWORD_HERE@localhost:5432/qk_prod" \
  -c "SELECT COUNT(*) FROM \"User\";"            # spot-check row count
```

If counts match Neon, the migration succeeded.

✅ **End of Phase 7.** Data is on your VPS Postgres.

---

# Phase 8 — First manual deploy

Goal: get the app running on the VPS by hand once. Once it works, Phase 11
automates it.

## 8.1 Clone the repo on the VPS

```bash
cd /var/www/quantumkaizen
git clone -b shriyansh-backend https://github.com/forgequantumsolution/quantumkaizen.git src
cd src
```

> If the repo is private, you'll need a GitHub Personal Access Token or a
> deploy key. We set that up properly in Phase 10. For now, you can clone with
> HTTPS + token, or temporarily make the repo public.

## 8.2 Install deps & build

```bash
npm ci --no-audit --include=dev
npx prisma generate --schema backend/prisma/schema.prisma
VITE_API_BASE_URL=https://api.forgequantumsolution.com/api \
  npm run build --workspace=client
npm run build --workspace=backend
```

## 8.3 Create the production `.env` for the backend

```bash
nano /var/www/quantumkaizen/src/backend/.env
```

Paste (replace placeholders):

```
NODE_ENV=production
PORT=4000

DATABASE_URL=postgresql://qk_app:STRONG_PASSWORD_HERE@localhost:5432/qk_prod?schema=public
DIRECT_URL=postgresql://qk_app:STRONG_PASSWORD_HERE@localhost:5432/qk_prod?schema=public

# Upstash — keep the existing connection string from your old Render env vars
REDIS_URL=rediss://default:UPSTASH_PASSWORD@HOST.upstash.io:6379

# Generate a NEW secret (do NOT reuse the old one — it was exposed in git):
#   openssl rand -base64 48
JWT_SECRET=NEW_RANDOM_SECRET_HERE
JWT_EXPIRES_IN=7d

CORS_ORIGIN=https://forgequantumsolution.com
```

Lock down the file so only `forge` can read it:

```bash
chmod 600 /var/www/quantumkaizen/src/backend/.env
```

## 8.4 Apply Prisma migrations

```bash
cd /var/www/quantumkaizen/src/backend
npx prisma migrate deploy
```

## 8.5 Sync built assets into nginx's web root

```bash
rsync -a --delete /var/www/quantumkaizen/src/client/dist/ /var/www/quantumkaizen/client/
```

Open https://forgequantumsolution.com — you should see the real app shell
(no API calls succeed yet because backend isn't started).

## 8.6 Start backend & worker with PM2

Create a PM2 ecosystem file at the repo root on the VPS:

```bash
nano /var/www/quantumkaizen/src/ecosystem.config.cjs
```

Paste:

```js
module.exports = {
  apps: [
    {
      name: 'qk-api',
      cwd: '/var/www/quantumkaizen/src/backend',
      script: 'dist/index.js',
      instances: 1,
      max_memory_restart: '500M',
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'qk-worker',
      cwd: '/var/www/quantumkaizen/src/backend',
      script: 'dist/jobs/worker.js',
      instances: 1,
      max_memory_restart: '400M',
      env: { NODE_ENV: 'production' },
    },
  ],
};
```

Start:

```bash
cd /var/www/quantumkaizen/src
pm2 start ecosystem.config.cjs
pm2 status                       # both apps should show "online"
pm2 logs qk-api --lines 30       # check for boot errors, Ctrl+C to exit
```

Verify the API:

```bash
curl https://api.forgequantumsolution.com/health
# {"status":"ok"}
```

Open https://forgequantumsolution.com → log in → app should work end-to-end.

✅ **End of Phase 8.** App is fully live at your domain.

---

# Phase 9 — PM2 boot persistence

Right now PM2 will lose your processes if the VPS reboots. Fix it:

```bash
pm2 save
pm2 startup systemd -u forge --hp /home/forge
# Copy and run the `sudo env PATH=...` command it prints
```

Test:

```bash
sudo reboot
# Wait 30s, SSH back in
pm2 status                       # should show both apps already running
curl https://api.forgequantumsolution.com/health
```

✅ **End of Phase 9.** Apps survive reboots.

---

# Phase 10 — GitHub Actions secrets

We need GitHub Actions to be able to SSH into the VPS as a dedicated deploy
identity (not your personal key).

## 10.1 Generate a deploy keypair ON the VPS (as `forge`)

```bash
ssh-keygen -t ed25519 -N "" -C "github-actions" -f ~/.ssh/gh_actions_deploy
```

This creates `~/.ssh/gh_actions_deploy` (private) and
`~/.ssh/gh_actions_deploy.pub` (public).

## 10.2 Authorize the deploy key on the VPS

```bash
cat ~/.ssh/gh_actions_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## 10.3 Copy the PRIVATE key contents

```bash
cat ~/.ssh/gh_actions_deploy
```

Select and copy the **entire output**, including the
`-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----`
lines.

## 10.4 Add GitHub repo secrets

GitHub → your repo → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**. Add these four:

| Name | Value |
|------|---|
| `VPS_HOST` | `68.178.164.38` |
| `VPS_USER` | `forge` |
| `VPS_SSH_KEY` | The private key from step 10.3 (paste the whole thing) |
| `VPS_DEPLOY_DIR` | `/var/www/quantumkaizen/src` |

## 10.5 Delete the private key from the VPS (you don't need it there anymore)

```bash
shred -u ~/.ssh/gh_actions_deploy
# The .pub stays. authorized_keys already has the key. GitHub has the private.
```

✅ **End of Phase 10.** GitHub can now SSH into the VPS.

---

# Phase 11 — GitHub Actions workflow

Create the file in your repo (on your Mac, not the VPS):

`.github/workflows/deploy-vps.yml`

```yaml
name: Deploy to GoDaddy VPS

on:
  push:
    branches: [shriyansh-backend]
  workflow_dispatch:

concurrency:
  group: deploy-vps
  cancel-in-progress: false

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci --no-audit --include=dev

      - name: Generate Prisma Client
        run: npx prisma generate --schema backend/prisma/schema.prisma

      - name: Build client (Vite)
        env:
          VITE_API_BASE_URL: https://api.forgequantumsolution.com/api
        run: npm run build --workspace=client

      - name: Build backend (tsc)
        run: npm run build --workspace=backend

      - name: Load SSH key
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.VPS_SSH_KEY }}

      - name: Trust VPS host key
        run: |
          mkdir -p ~/.ssh
          ssh-keyscan -H ${{ secrets.VPS_HOST }} >> ~/.ssh/known_hosts

      - name: Rsync built frontend
        run: |
          rsync -avz --delete \
            client/dist/ \
            ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:/var/www/quantumkaizen/client/

      - name: Rsync built backend
        run: |
          rsync -avz --delete \
            --exclude='node_modules' --exclude='.env' \
            backend/dist/ \
            ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:${{ secrets.VPS_DEPLOY_DIR }}/backend/dist/

      - name: Rsync package manifests + prisma + ecosystem
        run: |
          rsync -avz \
            package.json package-lock.json ecosystem.config.cjs \
            ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:${{ secrets.VPS_DEPLOY_DIR }}/
          rsync -avz \
            backend/package.json \
            ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:${{ secrets.VPS_DEPLOY_DIR }}/backend/
          rsync -avz --delete \
            backend/prisma/ \
            ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:${{ secrets.VPS_DEPLOY_DIR }}/backend/prisma/

      - name: Install runtime deps, migrate, reload PM2
        run: |
          ssh ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }} bash -se <<'EOF'
            set -euo pipefail
            cd ${{ secrets.VPS_DEPLOY_DIR }}
            npm ci --omit=dev --no-audit --workspace=backend --include-workspace-root
            cd backend
            npx prisma generate
            npx prisma migrate deploy
            cd ..
            pm2 reload ecosystem.config.cjs --update-env
            pm2 save
          EOF
```

### Notes on this workflow

- **Builds on the GitHub runner** (7 GB RAM) so your $7 VPS doesn't OOM during
  `tsc` / `vite build`.
- **rsync** only transfers changed files → fast incremental deploys.
- **`pm2 reload`** is zero-downtime (vs `pm2 restart` which has a brief gap).
- **`ecosystem.config.cjs`** is shipped from the repo, so PM2 config is
  version-controlled (commit it).
- **`.env` is excluded** — it lives on the VPS only.
- **Branch trigger**: `shriyansh-backend` per your request. Change to `main`
  later if you want main → prod.

### Commit the workflow and the ecosystem file

```bash
# On your Mac, in the repo
git checkout shriyansh-backend
git add .github/workflows/deploy-vps.yml ecosystem.config.cjs GODADDY_VPS_DEPLOY.md
git commit -m "ci: add GoDaddy VPS deployment workflow"
git push origin shriyansh-backend
```

The push will trigger the workflow. Watch it at:
https://github.com/forgequantumsolution/quantumkaizen/actions

✅ **End of Phase 11.** Pushing to `shriyansh-backend` deploys automatically.

---

# Phase 12 — Smoke-test the pipeline

## 12.1 Watch the workflow

GitHub repo → **Actions** tab → click the latest run → expand each step.
First run takes ~5 min (cold npm cache). Subsequent runs: ~2 min.

## 12.2 Make a trivial visible change

Edit something obvious — e.g. the page title in `client/index.html`:

```bash
git checkout shriyansh-backend
# edit client/index.html: change <title>...</title>
git commit -am "test: trigger VPS deploy"
git push origin shriyansh-backend
```

Wait for the workflow green check, then reload https://forgequantumsolution.com
in an incognito window (to bypass cache). New title should appear.

## 12.3 Confirm backend redeployed

```bash
ssh forge@68.178.164.38
pm2 logs qk-api --lines 20    # look for restart timestamp
exit
```

✅ **End of Phase 12.** Auto-deploy works.

---

# Phase 13 — Decommission Render and Netlify

**Only do this AFTER Phase 12 succeeded** and you've verified the VPS-hosted
app works end-to-end (login, key flows, file uploads, whatever you care about).

## 13.1 Render

Dashboard → for each service (`qk-api`, `qk-worker`):
- **Settings** → **Suspend Service** (free, reversible) or **Delete** (permanent)

## 13.2 Netlify

Dashboard → site → **Site configuration** → **General** → **Danger zone** →
**Stop builds and serving** (free, reversible) or **Delete site** (permanent).

> Suggestion: **suspend** for 2 weeks first, then delete. If something breaks
> on the VPS during that window, you can un-suspend and switch DNS back in 5
> minutes.

## 13.3 Keep Neon running for a backup window

Don't delete the Neon database immediately — you have a Postgres snapshot on
your VPS but no live backup yet. Keep Neon as a cold backup for 30 days, then
delete it.

✅ **End of Phase 13.** Migration complete.

---

# Day-2 operations

## Deploying a change
```bash
git push origin shriyansh-backend
# GitHub Actions deploys automatically. ~2 min.
```

## Reading logs
```bash
ssh forge@68.178.164.38
pm2 logs                          # all apps, live tail
pm2 logs qk-api --lines 200       # just the API
pm2 logs qk-worker --lines 200    # just the worker
```

## Manual restart
```bash
pm2 reload qk-api                 # zero-downtime
pm2 restart qk-api                # quick restart (brief drop)
pm2 stop qk-api                   # stop without removing
pm2 delete qk-api                 # remove from PM2 entirely
```

## Database backups (set this up!)

Create `/home/forge/backup-db.sh`:

```bash
#!/bin/bash
set -e
BACKUP_DIR=/home/forge/db-backups
mkdir -p $BACKUP_DIR
DATE=$(date +%Y-%m-%d_%H-%M)
pg_dump "postgresql://qk_app:STRONG_PASSWORD_HERE@localhost:5432/qk_prod" \
  --format=custom \
  --file=$BACKUP_DIR/qk_prod_$DATE.dump
find $BACKUP_DIR -name 'qk_prod_*.dump' -mtime +14 -delete
```

Make executable, then schedule:

```bash
chmod +x /home/forge/backup-db.sh
crontab -e
# Add:
0 3 * * * /home/forge/backup-db.sh >> /home/forge/db-backup.log 2>&1
```

This runs every day at 3 AM, keeps the last 14 days.

For off-site backups: copy `~/db-backups/` to S3, Backblaze B2, or even your
Mac via a weekly rsync. Disk failure on a single VPS = data loss.

## SSL renewal
Automatic via certbot's systemd timer. Verify monthly:
```bash
sudo certbot renew --dry-run
```

## OS security updates
```bash
sudo apt update && sudo apt upgrade -y
sudo reboot                       # if kernel was updated
```

Schedule monthly. Or install `unattended-upgrades` for auto-patching:
```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

## Rollback a bad deploy

GitHub Actions doesn't have a one-click rollback. Two options:

**Option A — revert the commit:**
```bash
git revert HEAD
git push origin shriyansh-backend
# Triggers a new deploy with the previous code
```

**Option B — keep a `releases/` directory** (more advanced; not in this guide).

---

# Troubleshooting

### `502 Bad Gateway` on the API

Backend isn't listening on `:4000`. SSH in:
```bash
pm2 status                          # is qk-api "online"?
pm2 logs qk-api --lines 100         # boot errors?
sudo ss -tlnp | grep 4000           # is port bound?
```

Common causes: bad `.env` (Prisma can't connect), missing migration,
`prisma generate` not run.

### nginx test fails after editing config

```bash
sudo nginx -t                       # shows exact line + reason
```

Don't reload if `-t` fails — you'll break the live site.

### Let's Encrypt fails with "DNS problem"

The A records haven't propagated yet, or one is missing. Re-check:
```bash
dig +short api.forgequantumsolution.com
```

### GitHub Actions step `Trust VPS host key` fails

The VPS IP changed, or ufw is blocking the runner. SSH check:
```bash
ssh-keyscan 68.178.164.38           # should return ssh keys, not hang
```

### `pm2: command not found` after reboot

You didn't run `pm2 startup` correctly. Re-do Phase 9.

### `Cannot find module '@prisma/client'` on the VPS

Runtime deps weren't installed. The deploy workflow runs `npm ci --omit=dev`
— check that step's output. Manual fix:
```bash
cd /var/www/quantumkaizen/src
npm ci --omit=dev --workspace=backend --include-workspace-root
npx prisma generate --schema backend/prisma/schema.prisma
pm2 reload all
```

### CORS errors in browser console

`CORS_ORIGIN` in `backend/.env` must exactly match the frontend URL
(scheme + host, no trailing slash). For prod that's
`https://forgequantumsolution.com`. Restart after editing:
```bash
pm2 reload qk-api --update-env
```

### App works on `https://forgequantumsolution.com` but not `https://www.forgequantumsolution.com`

Both should — certbot covers both. If only one works, re-run certbot:
```bash
sudo certbot --nginx -d forgequantumsolution.com -d www.forgequantumsolution.com -d api.forgequantumsolution.com
```

### "Permission denied" when GitHub Actions tries to write to `/var/www`

`forge` doesn't own the directory. Fix once:
```bash
sudo chown -R forge:forge /var/www/quantumkaizen
```

---

# Cost & maintenance summary

| Item | Cost |
|---|---|
| GoDaddy VPS (whatever plan you bought) | ~$7–60 /mo |
| GoDaddy domain renewal | ~$15 /yr |
| Upstash Redis | $0 (free tier) |
| Let's Encrypt SSL | $0 |
| GitHub Actions | $0 (free for public + 2000 min/mo private) |
| **Total recurring** | **$7–60 /mo + $15 /yr** |

**Time cost of self-hosting** (vs. Render): ~1 hour/month — security patches,
log review, occasional rebuild. Plus whatever recovery time when something
inevitably breaks. Render was $0 and zero ops; this trade is for control, not
savings.

---

# Security checklist (revisit quarterly)

- [ ] SSH password auth disabled (`PasswordAuthentication no`)
- [ ] Root SSH disabled (`PermitRootLogin no`)
- [ ] UFW enabled, only 22/80/443 open
- [ ] fail2ban running
- [ ] OS packages up to date (or `unattended-upgrades` enabled)
- [ ] `backend/.env` is `chmod 600`, owned by `forge`
- [ ] JWT_SECRET is unique, never committed to git
- [ ] DB password is unique, never committed to git
- [ ] Postgres listens on `localhost` only (default — verify with `sudo ss -tlnp | grep 5432`)
- [ ] Daily DB backup runs and is being copied off-VPS
- [ ] Old `.env` secrets from Neon/Render have been rotated
- [ ] SSL auto-renewal verified (`sudo certbot renew --dry-run`)
