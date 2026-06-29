# Deploy a Frontend-Only App to a GoDaddy VPS

End-to-end guide for hosting a **static frontend** (React / Vite / Next export /
Vue / plain SPA) on a self-managed GoDaddy VPS, with automated deployment from
GitHub on every push.

> **Audience:** someone with zero VPS / Linux admin experience.
> Every command is copy-pasteable. Read each section top to bottom — do not skip.

> **This is the frontend-only sibling of `GODADDY_VPS_DEPLOY.md`.** There is no
> database, no Redis, no backend process, no PM2, no API subdomain. nginx just
> serves a folder of static files over HTTPS. That makes this *much* simpler —
> roughly half the steps.

---

## Fill these in first

This guide uses placeholders. Decide your values now and substitute them
everywhere you see them (or keep this table handy):

| Placeholder | Meaning | Example |
|---|---|---|
| `YOUR_VPS_IP` | The public IP of your VPS | `203.0.113.45` |
| `YOUR_DOMAIN` | Your apex domain | `myproject.com` |
| `YOUR_EMAIL` | Email for Let's Encrypt / SSH key | `info@forgequantumsolution.com` |
| `forge` | The sudo login user on the VPS | `forge` |
| `myproject` | Short slug used for the web-root folder | `myproject` |
| `main` | The git branch that triggers deploys | `main` |

> **Important — does your frontend call an API?**
> A purely static site needs no backend. But most React apps fetch from an API.
> If yours does, that API must already be hosted *somewhere* (Render, an
> existing VPS, etc.) and reachable over HTTPS. You'll point the frontend at it
> via a build-time env var (`VITE_API_BASE_URL` or similar) in Phase 8/10.
> This guide does **not** set up a backend — only the static frontend.

---

## Target architecture

```
                              Internet
                                 │
                  YOUR_DOMAIN  +  www.YOUR_DOMAIN
                                 │
                                 ▼
                       GoDaddy DNS (A records)
                                 │
                                 ▼
                  VPS  YOUR_VPS_IP  (Ubuntu 24.04)
                                 │
                                 ▼
                          nginx :80/:443
                       (TLS via Let's Encrypt)
                                 │
                                 ▼
                    static files (React/Vite build)
                    /var/www/myproject/
```

**Why this layout**
- **nginx** terminates HTTPS and serves the static build folder. That's the
  entire server side — no Node process runs in production.
- The build itself happens on the **GitHub Actions runner** (free, 7 GB RAM),
  so your small VPS never has to compile anything.
- **rsync** ships only changed files to the VPS → fast deploys.

---

## What you need before you start

- A GoDaddy VPS (Ubuntu 24.04 LTS) with a sudo user (`forge`) and its IP.
- A domain at GoDaddy (`YOUR_DOMAIN`).
- A Mac/Linux/WSL terminal that can SSH.
- Your GitHub repo with admin access (for Actions secrets in Phase 9–10).

---

## Phases at a glance

| # | Phase | What you do | Where |
|---|---|---|---|
| 1 | Harden the server | SSH keys, firewall, fail2ban, timezone | VPS |
| 2 | Install software | nginx, certbot, git, rsync | VPS |
| 3 | Configure DNS | A records pointing to VPS IP | GoDaddy |
| 4 | Configure nginx | One static server block | VPS |
| 5 | Issue SSL certs | Let's Encrypt via certbot | VPS |
| 6 | First manual deploy | Build locally, rsync `dist/` up | Mac + VPS |
| 7 | GitHub Actions secrets | Deploy key + secrets | VPS + GitHub |
| 8 | GitHub Actions workflow | `.github/workflows/deploy-frontend.yml` | Repo |
| 9 | Smoke test | Push, watch it deploy | Repo |

---

# Phase 1 — Harden the server

Goal: prevent random internet bots from compromising the box on day 1.

## 1.1 Confirm `forge` has sudo

```bash
ssh forge@YOUR_VPS_IP
sudo whoami           # should print: root
```

If not, get root creds from GoDaddy and run: `usermod -aG sudo forge`.

## 1.2 Set up SSH key login (and disable password login)

### 1.2a — Generate a key on your Mac (skip if you already have `~/.ssh/id_ed25519`)

```bash
# On your Mac, NOT the server
ssh-keygen -t ed25519 -C "YOUR_EMAIL"
# Press Enter to accept defaults
```

### 1.2b — Copy the public key to the VPS

```bash
ssh-copy-id forge@YOUR_VPS_IP
```

### 1.2c — Test key login works (CRITICAL — do not skip)

```bash
# Fresh terminal
ssh forge@YOUR_VPS_IP        # should log in WITHOUT a password
```

If this fails, **do not proceed to 1.2d** — you'll lock yourself out. Re-run
`ssh-copy-id`, or paste the key manually into `~/.ssh/authorized_keys`.

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

Open a **new terminal tab** and confirm `ssh forge@YOUR_VPS_IP` still works
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
sudo hostnamectl set-hostname myproject-prod
```

## 1.6 Update all packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt autoremove -y
# If the kernel updated:  sudo reboot
```

✅ **End of Phase 1.** Server is hardened. Firewall is up.

> **Note:** the full-stack guide added a 2 GB swap file because the VPS compiled
> the app. We build on the GitHub runner here, so the VPS never compiles —
> swap is optional. Add it if your plan has < 1 GB RAM (see the full-stack guide
> Phase 1.6).

---

# Phase 2 — Install software

A static site needs only a web server and an SSL tool. **No Node, no Postgres,
no Redis, no PM2 on the VPS.**

## 2.1 nginx

```bash
sudo apt install -y nginx
sudo systemctl enable --now nginx
curl http://localhost                          # nginx welcome HTML
```

## 2.2 certbot (Let's Encrypt SSL, via snap)

```bash
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot
certbot --version
```

## 2.3 git & rsync

```bash
sudo apt install -y git rsync
rsync --version | head -1
```

✅ **End of Phase 2.** Web server + SSL tooling installed.

---

# Phase 3 — Point your GoDaddy domain at the VPS

## 3.1 Open DNS in GoDaddy

https://account.godaddy.com → My Products → Domains → `YOUR_DOMAIN` → **DNS**.

## 3.2 Delete any conflicting records first

Remove existing `A` records named `@` or `www` that point at GoDaddy parking
pages (trash icon). **Don't touch `MX` records** — those are for email.

## 3.3 Add two A records

| Type | Name | Value (Points to) | TTL |
|------|------|-------------------|-----|
| A    | `@`  | `YOUR_VPS_IP`     | 600 seconds |
| A    | `www`| `YOUR_VPS_IP`     | 600 seconds |

> No `api` record needed — this is frontend-only. (If your separate API is on
> this same VPS, that's a different setup — see the full-stack guide.)

## 3.4 Wait for DNS propagation

Check https://dnschecker.org for `YOUR_DOMAIN`. Verify from your Mac:

```bash
dig +short YOUR_DOMAIN
dig +short www.YOUR_DOMAIN
# Both should print: YOUR_VPS_IP
```

**Do not proceed to Phase 5 (SSL) until both resolve correctly.**

✅ **End of Phase 3.** Your domain points at your VPS.

---

# Phase 4 — Configure nginx

One server block serving a static SPA build.

## 4.1 Create the web root

```bash
sudo mkdir -p /var/www/myproject
sudo chown -R forge:forge /var/www/myproject
echo '<h1>myproject — coming soon</h1>' > /var/www/myproject/index.html
```

## 4.2 Frontend nginx config

```bash
sudo nano /etc/nginx/sites-available/YOUR_DOMAIN
```

Paste (replace `YOUR_DOMAIN` and `myproject`):

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name YOUR_DOMAIN www.YOUR_DOMAIN;

    root /var/www/myproject;
    index index.html;

    # SPA fallback: every unknown path serves index.html so client-side
    # routing (React Router / Vue Router) works on refresh & deep links.
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Long-cache hashed Vite/webpack assets (filenames change per build).
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

> If your build outputs hashed files somewhere other than `/assets/` (e.g.
> Create-React-App uses `/static/`), change the `location` block to match.

## 4.3 Enable the site and disable the default

```bash
sudo ln -s /etc/nginx/sites-available/YOUR_DOMAIN /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo nginx -t                # must say "syntax is ok" + "test is successful"
sudo systemctl reload nginx
```

## 4.4 Smoke test

Visit `http://YOUR_DOMAIN` → should show "myproject — coming soon".

✅ **End of Phase 4.** nginx serves the static folder.

---

# Phase 5 — Issue Let's Encrypt SSL certificates

```bash
sudo certbot --nginx \
  -d YOUR_DOMAIN \
  -d www.YOUR_DOMAIN \
  --agree-tos -m YOUR_EMAIL \
  --redirect
```

certbot reads your nginx config, proves ownership over HTTP, fetches certs,
adds HTTPS server blocks, sets up auto-renewal, and (via `--redirect`) adds
HTTP→HTTPS 301 redirects — all in one command.

Verify:

```bash
curl -I https://YOUR_DOMAIN          # 200 OK with cert
curl -I http://YOUR_DOMAIN           # 301 → https://...
sudo certbot renew --dry-run         # simulate renewal — should succeed
```

Certs renew automatically via certbot's systemd timer.

✅ **End of Phase 5.** HTTPS works. All HTTP redirects to HTTPS.

---

# Phase 6 — First manual deploy

Do this once by hand to confirm the build & file paths work. Phase 8 automates it.

## 6.1 Build the frontend on your Mac

From your repo's frontend folder:

```bash
# If the whole repo IS the frontend:
npm ci
npm run build

# If the frontend lives in a subfolder (e.g. a "frontend/" or "client/" dir):
cd frontend
npm ci
npm run build
```

If your app calls an API, set the API URL at build time. Vite example:

```bash
VITE_API_BASE_URL=https://api.example.com/api npm run build
```

This produces a `dist/` folder (Vite/Vue) or `build/` folder (CRA/Next export).

## 6.2 Rsync the build up to the VPS

```bash
# From the folder that contains dist/ (adjust dist/ → build/ if needed)
rsync -avz --delete dist/ forge@YOUR_VPS_IP:/var/www/myproject/
```

The trailing slashes matter: `dist/` copies the *contents* into
`/var/www/myproject/`.

## 6.3 Verify

Open `https://YOUR_DOMAIN` in an incognito window → your real app should load.
Click around / refresh a deep link → SPA fallback should keep it working.

✅ **End of Phase 6.** App is live at your domain.

---

# Phase 7 — GitHub Actions secrets

We need GitHub Actions to SSH into the VPS as a dedicated deploy identity (not
your personal key).

## 7.1 Generate a deploy keypair ON the VPS (as `forge`)

```bash
ssh-keygen -t ed25519 -N "" -C "github-actions" -f ~/.ssh/gh_actions_deploy
```

## 7.2 Authorize the deploy key on the VPS

```bash
cat ~/.ssh/gh_actions_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

## 7.3 Copy the PRIVATE key contents

```bash
cat ~/.ssh/gh_actions_deploy
```

Copy the **entire output**, including the `-----BEGIN/END OPENSSH PRIVATE KEY-----`
lines.

## 7.4 Add GitHub repo secrets

GitHub → repo → **Settings** → **Secrets and variables** → **Actions** →
**New repository secret**. Add:

| Name | Value |
|------|-------|
| `VPS_HOST` | `YOUR_VPS_IP` |
| `VPS_USER` | `forge` |
| `VPS_SSH_KEY` | The private key from step 7.3 (paste the whole thing) |
| `VPS_WEB_ROOT` | `/var/www/myproject` |

If your app needs a build-time API URL, also add it as a secret (or a plain
repo *variable*), e.g. `VITE_API_BASE_URL`.

## 7.5 Delete the private key from the VPS

```bash
shred -u ~/.ssh/gh_actions_deploy
# The .pub stays in authorized_keys. GitHub holds the private key now.
```

✅ **End of Phase 7.** GitHub can SSH into the VPS.

---

# Phase 8 — GitHub Actions workflow

Create `.github/workflows/deploy-frontend.yml` in your repo.

> **Adjust two things** for your repo layout:
> - `working-directory:` if the frontend is in a subfolder (remove it if the
>   repo root *is* the frontend).
> - the rsync source path `dist/` → `build/` if your tool outputs `build/`.

```yaml
name: Deploy Frontend to GoDaddy VPS

on:
  push:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: deploy-frontend
  cancel-in-progress: true

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          # If frontend is in a subfolder, point cache at its lockfile:
          # cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        # working-directory: frontend       # uncomment if in a subfolder
        run: npm ci --no-audit

      - name: Build
        # working-directory: frontend       # uncomment if in a subfolder
        env:
          VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}   # remove if unused
        run: npm run build

      - name: Load SSH key
        uses: webfactory/ssh-agent@v0.9.0
        with:
          ssh-private-key: ${{ secrets.VPS_SSH_KEY }}

      - name: Trust VPS host key
        run: |
          mkdir -p ~/.ssh
          ssh-keyscan -H ${{ secrets.VPS_HOST }} >> ~/.ssh/known_hosts

      - name: Rsync build to VPS
        # If in a subfolder, prefix the source: frontend/dist/
        # If your tool outputs build/, change dist/ → build/
        run: |
          rsync -avz --delete \
            dist/ \
            ${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}:${{ secrets.VPS_WEB_ROOT }}/
```

### Notes on this workflow

- **Builds on the GitHub runner** so the VPS never compiles anything.
- **`--delete`** removes stale files from the web root so old hashed assets
  don't pile up. Safe here because the web root holds *only* the build output.
- **No PM2 reload / migrations** — there's no server process to restart. Once
  the files land, nginx serves them immediately.
- **`cancel-in-progress: true`** — for a static deploy it's fine to cancel an
  older in-flight deploy when a newer push arrives.

### Commit it

```bash
git checkout main
git add .github/workflows/deploy-frontend.yml FRONTEND_VPS_DEPLOY.md
git commit -m "ci: add GoDaddy VPS frontend deployment workflow"
git push origin main
```

✅ **End of Phase 8.** Pushing to `main` deploys automatically.

---

# Phase 9 — Smoke-test the pipeline

1. GitHub repo → **Actions** tab → watch the latest run go green (~1–2 min).
2. Make a visible change (e.g. edit a heading or the `<title>`), commit, push.
3. Reload `https://YOUR_DOMAIN` in an **incognito** window (bypass cache) →
   the change should appear.

✅ **End of Phase 9.** Auto-deploy works.

---

# Day-2 operations

## Deploying a change
```bash
git push origin main          # GitHub Actions deploys automatically (~1–2 min)
```

## Manual redeploy (bypass CI)
```bash
npm run build
rsync -avz --delete dist/ forge@YOUR_VPS_IP:/var/www/myproject/
```

## SSL renewal
Automatic via certbot's timer. Verify monthly:
```bash
sudo certbot renew --dry-run
```

## OS security updates
```bash
sudo apt update && sudo apt upgrade -y
# Or enable auto-patching:
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

## Rollback a bad deploy
```bash
git revert HEAD
git push origin main          # redeploys the previous build
```

---

# Troubleshooting

### Page loads but refreshing a deep link gives 404
The SPA fallback isn't working. Confirm the `try_files $uri $uri/ /index.html;`
line is in your nginx `location /` block, then `sudo nginx -t && sudo systemctl reload nginx`.

### Old version still showing after deploy
Browser cache. Hard-reload or use incognito. Hashed assets under `/assets/`
are cached 1 year by design — but `index.html` references the *new* hashes, so
a fresh `index.html` fetch pulls the new build. If `index.html` itself is being
cached by a CDN/proxy in front, disable caching for `index.html`.

### nginx test fails after editing config
```bash
sudo nginx -t        # shows exact line + reason — don't reload until it passes
```

### Let's Encrypt fails with "DNS problem"
A records haven't propagated, or one is missing:
```bash
dig +short YOUR_DOMAIN
dig +short www.YOUR_DOMAIN
```

### GitHub Actions `Trust VPS host key` step hangs/fails
VPS IP changed, or ufw is blocking the runner:
```bash
ssh-keyscan YOUR_VPS_IP        # should return keys, not hang
```

### `Permission denied` when Actions rsyncs into `/var/www`
`forge` doesn't own the web root:
```bash
sudo chown -R forge:forge /var/www/myproject
```

### Blank white page, console shows asset 404s
The `root` path or the asset `location` block doesn't match your build output.
SSH in and `ls /var/www/myproject/` — confirm `index.html` and the assets
folder are actually there and the nginx `location` matches that folder name.

### API calls fail (CORS / mixed content)
- Mixed content: the API must be served over **HTTPS** (you're on HTTPS now).
- CORS: the API's allowed-origins must include `https://YOUR_DOMAIN`. That's
  configured on the **API server**, not here.
- Wrong URL baked in: the build-time `VITE_API_BASE_URL` must be set in the
  Actions workflow / repo secret, not only on your laptop.

---

# Cost & maintenance summary

| Item | Cost |
|---|---|
| GoDaddy VPS | ~$7–60 /mo |
| GoDaddy domain renewal | ~$15 /yr |
| Let's Encrypt SSL | $0 |
| GitHub Actions | $0 (free for public + 2000 min/mo private) |
| **Total recurring** | **$7–60 /mo + $15 /yr** |

A static-only site is nearly zero-ops: no DB to back up, no process to babysit.
Realistically ~15 min/month for OS patches and an occasional SSL sanity check.

> **Cheaper alternative:** a frontend-only site is the *ideal* candidate for
> free static hosts (Netlify, Vercel, Cloudflare Pages, GitHub Pages) — $0,
> global CDN, zero ops. Use this VPS guide only if you specifically want
> everything on your own GoDaddy box.

---

# Security checklist (revisit quarterly)

- [ ] SSH password auth disabled (`PasswordAuthentication no`)
- [ ] Root SSH disabled (`PermitRootLogin no`)
- [ ] UFW enabled, only 22/80/443 open
- [ ] fail2ban running
- [ ] OS packages up to date (or `unattended-upgrades` enabled)
- [ ] SSL auto-renewal verified (`sudo certbot renew --dry-run`)
- [ ] Web root owned by `forge`, contains only build output
