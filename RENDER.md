# Deploy Quantum Kaizen on Render

Render hosts the stack as three pieces, defined in [render.yaml](render.yaml):

1. **qk-db** — managed PostgreSQL 16 (free tier, 256 MB).
2. **qk-api** — Node web service running the Express/Prisma backend.
3. **qk-web** — static site for the Vite React client.

You can also keep the client on Vercel and only deploy **qk-db** + **qk-api** on Render — see "Vercel + Render" at the bottom.

---

## One-time setup (Blueprint deploy)

1. Push the current branch (including [render.yaml](render.yaml)) to GitHub.
2. In the [Render dashboard](https://dashboard.render.com/) click **New +** → **Blueprint**.
3. Pick the `forgequantumsolution/quantumkaizen` repo and the branch to deploy.
4. Render reads `render.yaml` and proposes the three resources. Click **Apply**.
5. Render auto-generates `JWT_SECRET` and `JWT_REFRESH_SECRET` (see `generateValue: true`). The Postgres `DATABASE_URL` is wired automatically.
6. Wait ~5 min for the first build (`npm ci` + `prisma generate` + `tsc` + `vite build`).

On first boot, [server/start-render.sh](server/start-render.sh) runs:

- `prisma db push` — creates the schema (no migrations file needed).
- `seed.ts` — creates tenant `AURORA-PH`, 10 users, base data. Controlled by `SEED_ON_START=1`.
- `seedMore.ts` — idempotent expansion (40 compliance reqs, 20 NCs, 15 CAPAs, etc.).

### Wire the client to the API

After **qk-api** is "Live", its URL will look like `https://qk-api-xxxx.onrender.com`.

1. Go to **qk-web** → **Environment** → set
   ```
   VITE_API_BASE_URL = https://qk-api-xxxx.onrender.com/api/v1
   ```
2. Go to **qk-api** → **Environment** → set
   ```
   CORS_ORIGIN = https://qk-web-xxxx.onrender.com
   ```
   (comma-separated if you also use a custom domain).
3. Trigger a manual redeploy on **qk-web** so Vite picks up the env var.

Open the **qk-web** URL and log in with the seeded admin:

- **Email:** `admin@aurorabiopharma.com`
- **Password:** `QuantumK@izen2026`

---

## Vercel (client) + Render (api + db)

Keep your existing `quantumkaizen.forgequantumsolution.com` Vercel deployment and just add a Render API + DB.

1. In the Render dashboard, deploy only the **qk-db** and **qk-api** parts of the blueprint (delete the `qk-web` block from your `render.yaml`, or uncheck it when applying).
2. In Render → **qk-api** → **Environment**, set
   ```
   CORS_ORIGIN = https://quantumkaizen.forgequantumsolution.com
   ```
3. In Vercel → Project → **Settings** → **Environment Variables**, add
   ```
   VITE_API_BASE_URL = https://qk-api-xxxx.onrender.com/api/v1
   ```
4. Redeploy the Vercel project.

The frontend will now POST to Render instead of trying to hit a nonexistent `/api/v1/*` on Vercel (the cause of the original 405).

---

## Operating

- **Logs:** Render dashboard → service → **Logs** tab (live tail).
- **Shell:** Render dashboard → service → **Shell** (Bash into the instance). Useful to run `npx prisma studio --browser none --port 5555` or `psql $DATABASE_URL`.
- **Redeploys:** `git push` to the Blueprint's tracking branch — Render auto-deploys.
- **Environment changes:** Update in dashboard → service auto-redeploys.

---

## Free-tier gotchas

1. **API spins down after 15 min of inactivity.** First request after sleep takes 30–60 s (cold start). Normal for Render free. Upgrade to Starter ($7/mo) to keep it warm.
2. **Free Postgres is wiped after 90 days.** Back up regularly with
   ```
   pg_dump "$DATABASE_URL" > backup.sql
   ```
   or move to the Starter plan ($6/mo) which has no expiry.
3. **No Redis on free tier.** The server code doesn't actually connect Redis at startup, so leave `REDIS_URL` blank — it's fine.
4. **File uploads need S3.** MinIO/S3 aren't deployed here. Set `S3_ENDPOINT` / `S3_ACCESS_KEY` / `S3_SECRET_KEY` to real AWS S3 or Cloudflare R2 if/when the document-upload flow is used.

---

## Troubleshooting

**Build fails at `prisma generate`.**
`schema.prisma` lists `debian-openssl-3.0.x` as a binary target. If Render changes base image to a newer OpenSSL, add `debian-openssl-3.1.x` too.

**API returns 503 from `/health/ready`.**
`qk-db` hasn't finished provisioning yet, or `DATABASE_URL` is wrong. Check the **qk-api** logs for Prisma connection errors.

**Login returns 401 on correct credentials.**
`CORS_ORIGIN` on **qk-api** must exactly match the frontend origin (scheme + host, no trailing slash). Mismatches silently drop the `Authorization` header.

**`GET /api/v1/...` returns 405.**
Frontend is hitting its own origin instead of the Render API. Check that `VITE_API_BASE_URL` was set **before** the last Vite build, and that the build artifact was redeployed.

**Fresh data on every deploy.**
Set `SEED_ON_START=0` once the base seed has run, so redeploys only run the idempotent `seedMore.ts` top-up (no duplicate base records).
