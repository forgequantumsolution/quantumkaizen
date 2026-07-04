# Backend Changes Log

Backend-side change log for this repo. Companion to `client/changes.md`.

---

# LIMS "disconnected features" wiring — 2026-07-04

Backend half of the LIMS orphaned-feature backlog (plan: `docs/LIMS-industrial-upgrade-plan.md` §I; frontend half in `client/changes.md`). Working tree only — **not committed**. Verified end-to-end (Playwright + direct API). `tsc --noEmit` clean.

DB context: real database is local Postgres `localhost:5432/kaizen_qms`; migration history is clean (`prisma migrate status` → up to date, 43 migrations after this change).

### W-1a/b/c — Customer / Supplier / Sampling Point on `Sample` (+ tracked migration)
Samples had no place to attach these masters (only `sourceSite`/`unit` free-text).
- **`prisma/schema.prisma`** — added `Sample.customerId` / `supplierId` / `samplingPointId` (nullable) + relations (`onDelete: SetNull`); added `samples Sample[]` back-relations on `Customer`, `Supplier`, `SamplingPoint`.
- **`prisma/migrations/20260704120000_add_sample_partner_provenance_links/migration.sql`** (new) — additive `ADD COLUMN` ×3 + `ADD CONSTRAINT` FK ×3, matching Prisma's canonical DDL style. Columns were first applied to the live dev DB via `prisma db execute` (additive, idempotent) to avoid touching unrelated history; the migration was then **validated against a throwaway shadow DB** (`migrate diff` of all migrations vs schema → empty) and recorded on dev via `prisma migrate resolve --applied` (so `migrate deploy` won't re-run it). Fresh/prod DBs get it normally via `prisma migrate deploy`.
- **`src/modules/sample/sample.schema.ts`** — `customer_id` / `supplier_id` / `sampling_point_id` on the register/update schema.
- **`src/modules/sample/sample.service.ts`** — `registerSample`/`updateSample` set the three columns; `serializeSample` exposes the ids on the summary and resolves `customer_name` / `supplier_name` / `sampling_point_name` on the full read.
- No new RBAC key needed (register/update already gated by `sample.create`/`sample.update`).
- Verified: `GET /api/samples/:id` returns the partner/provenance names for the demo + newly-registered samples.

### W-2 + W-1b (CoA) — expose the template on the certificate read
Generate already accepted/stored `template_id`+`customer_id`; the read didn't surface the template, so the UI couldn't render it.
- **`src/modules/coa/coa.service.ts`** — `getCoa` now `include: { template: true, customer: true }` and returns `customer_name` + a `template { id, name, title, header_html, footer_html, sections[] }` block. (Generate/schema were already wired — no change there.)

### W-3 — "unassigned" filter for worklist attach
- **`src/modules/sample-testing/sample-testing.schema.ts`** — `unassigned` (coerced bool) on `ListSampleTestQuerySchema`.
- **`src/modules/sample-testing/sample-testing.service.ts`** — `listSampleTests` applies `where.worklistId = null` when `unassigned` is set, so the UI can list tests on no worklist. (`updateWorklist` already appends via `sample_test_ids`; `removeTestFromWorklist` already existed — both now driven from the UI.)

### W-5 — demo seed for the previously-empty islands
The Units / Analytes / Sampling-Points / Customers / Suppliers masters had **zero** seed rows.
- **`prisma/seed-lims-data.ts`** — idempotent upserts for 8 Units, 5 Analytes, 4 Sampling Points, 3 Customers, 3 Suppliers; links the 4 demo samples to a customer/supplier/sampling-point (SMP-0003 = Raw Material → supplier). Extended the completion-count log.

### Not changed (deliberate)
- `PUT /api/samples/:id` and `PUT /api/stability/:id` remain valid endpoints with no UI — left for a future edit screen rather than removing working routes.
