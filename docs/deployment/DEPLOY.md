# Deploy Quantum Kaizen

Production stack:

| Layer           | Provider     | Free tier? | Why                                                                 |
|-----------------|--------------|------------|---------------------------------------------------------------------|
| Frontend (SPA)  | **Vercel**   | Yes        | Best DX for Vite. Global CDN. Custom domain on free.                |
| Backend API     | **Render**   | Yes        | Push-to-deploy Node. Free tier sleeps after 15 min idle.            |
| BullMQ worker   | **Render**   | Yes        | Same Blueprint as the API. Runs SLA + approval crons.               |
| PostgreSQL      | **Neon**     | Yes        | Serverless Postgres. You already use it.                            |
| Redis           | **Upstash**  | Yes        | Serverless Redis. BullMQ-compatible.                                |

Total cost on free tiers: **$0/mo**. Pay $7/mo per Render service to remove cold starts.

---

## 0. Prerequisites

- A GitHub (or GitLab/Bitbucket) account with this repo pushed up.
- Accounts on: [Vercel](https://vercel.com), [Render](https://render.com), [Neon](https://neon.tech), [Upstash](https://upstash.com).

---

## 1. Provision the database — Neon

If you already have a Neon project (this repo currently points at `ep-restless-hat-amtkx32f.c-5.us-east-1.aws.neon.tech`), skip to step 1.3.

1.1. https://console.neon.tech → **New project** → pick a region close to your users → create.

1.2. Open the project's **Connection Details** panel. You need two strings:
- **Pooled connection** → `DATABASE_URL` (used by the app at runtime)
- **Direct connection** → `DIRECT_URL` (used by `prisma migrate deploy`)

Both end in `?sslmode=require`. Keep them — you'll paste them into Render in step 3.

1.3. Apply migrations once from your laptop (only needed the very first time, or if you provisioned a fresh DB):

```bash
cd backend
DATABASE_URL='<your-pooled-url>' DIRECT_URL='<your-direct-url>' npx prisma migrate deploy
```

After this, every Render deploy will run `prisma migrate deploy` automatically (see [render.yaml](render.yaml)).

---

## 2. Provision Redis — Upstash

2.1. https://console.upstash.com → **Create database** → Redis → Global (or Regional close to your Render region) → Free plan.

2.2. On the database page, copy the **`UPSTASH_REDIS_REST_URL`** — **no, wait** — you want the **TLS connection string**, not the REST URL. Find it under **Connect to your database** → **Node.js (ioredis)**. It looks like:

```
rediss://default:<password>@<host>.upstash.io:6379
```

Keep it. You'll paste this into Render as `REDIS_URL`.

---

## 3. Deploy the backend — Render Blueprint

3.1. Generate a JWT secret on your laptop:

```bash
openssl rand -base64 48
```

Copy the output.

3.2. https://dashboard.render.com → **New +** → **Blueprint** → connect your GitHub account → pick this repo → branch `main` (or whichever you deploy from).

Render reads [render.yaml](render.yaml) and proposes two services: **qk-api** (web) and **qk-worker** (worker). Click **Apply**.

3.3. Render prompts for the secret env vars. Paste:

| Variable        | Value                                                          |
|-----------------|----------------------------------------------------------------|
| `DATABASE_URL`  | Neon **pooled** connection string                              |
| `DIRECT_URL`    | Neon **direct** connection string                              |
| `REDIS_URL`     | Upstash `rediss://...` string                                  |
| `JWT_SECRET`    | Output of `openssl rand -base64 48`                            |
| `CORS_ORIGIN`   | Leave blank for now — fill in after step 4 with the Vercel URL |

Render builds both services (~5 min). When green, the API is live at `https://qk-api.onrender.com` (the exact subdomain is shown in the dashboard).

3.4. Verify the API:

```bash
curl https://qk-api.onrender.com/health
# {"status":"ok"}
```

---

## 4. Deploy the frontend — Vercel

4.1. https://vercel.com/new → **Import Git Repository** → pick this repo.

4.2. Vercel reads [vercel.json](vercel.json) and infers the rest. **Before you click Deploy**, expand **Environment Variables** and add:

| Variable               | Value                                              |
|------------------------|----------------------------------------------------|
| `VITE_API_BASE_URL`    | `https://qk-api.onrender.com/api` (from step 3.3) |

Vite reads `VITE_*` variables at **build time**, so this has to be set before the first build.

4.3. Click **Deploy**. ~2 min later, the app is live at `https://<project>.vercel.app`.

4.4. **Wire CORS back to Render.** Go back to the Render dashboard → **qk-api** → **Environment** → set `CORS_ORIGIN` to your Vercel URL (e.g. `https://your-app.vercel.app`). Render redeploys automatically.

---

## 5. Custom domain

5.1. **Frontend.** Vercel dashboard → project → **Settings** → **Domains** → add your domain. Vercel shows the DNS records to set at your registrar (one `A` for root, one `CNAME` for `www`). Vercel issues the TLS cert automatically.

5.2. **Backend (optional).** If you want the API on `api.yourdomain.com`:
- Render dashboard → **qk-api** → **Settings** → **Custom Domain** → add `api.yourdomain.com`. Set the `CNAME` it gives you at your registrar.
- Update Vercel's `VITE_API_BASE_URL` to `https://api.yourdomain.com/api` and redeploy.
- Update Render's `CORS_ORIGIN` to your real frontend domain (e.g. `https://yourdomain.com`).

---

## 6. Day-2 operations

**Re-deploy.** Push to your default branch. Vercel and Render both auto-deploy.

**Run a migration.** Edit `backend/prisma/schema.prisma` → `npx prisma migrate dev --name <change>` locally → commit + push. Render's `startCommand` runs `prisma migrate deploy` on every boot, so the next deploy applies it.

**Wake a sleeping free service.** First request after 15 min idle takes ~30 s. To eliminate this, switch the Render service plan to **Starter** ($7/mo).

**Logs.** Render dashboard → service → **Logs** tab. Vercel dashboard → project → **Logs** tab.

**Rollback.** Render → service → **Deploys** → pick an older green build → **Rollback**. Vercel → project → **Deployments** → **Promote to Production** on a previous one.

**Local development** is unchanged — see [README.md](README.md). The local stack uses [docker-compose.yml](docker-compose.yml) for Postgres and runs the apps with `npm run dev`.

---

## 7. Troubleshooting

**Build fails on Render with `Cannot find module '@prisma/client'`.** The build command must run `prisma generate` before `tsc`. The provided [render.yaml](render.yaml) already does this — confirm you haven't edited it.

**`prisma migrate deploy` fails on Render with "shadow database" error.** It shouldn't — `migrate deploy` doesn't need a shadow DB. If you see it, you're accidentally running `migrate dev`. Check the `startCommand`.

**API returns HTML instead of JSON in production.** That's the Vercel SPA fallback catching `/api/*`. Check that `VITE_API_BASE_URL` is set to the **Render** URL (absolute), not `/api`. The client's API interceptor at [client/src/lib/api.ts](client/src/lib/api.ts) detects this and logs an explicit error.

**CORS error in browser console.** `CORS_ORIGIN` on Render doesn't match the Vercel URL exactly (scheme + host, no trailing slash). Update Render env vars and wait for redeploy.

**Worker isn't picking up jobs.** Check `qk-worker` logs for `REDIS_URL` parse errors — Upstash strings use `rediss://` (TLS), not `redis://`.
