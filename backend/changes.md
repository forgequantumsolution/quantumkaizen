# Backend Changes Log

Backend-side change log for this repo. Companion to `client/changes.md`.

---

# Per-module ticket master — Phases 1–2 + gate — 2026-07-12

Follow-on to per-workflow-type access control: retiring the global `ticket.*`
master in phases so ticket access becomes strictly per module. Phases 1–2 done +
verified on local `kaizen_qms` (6 types); working tree only. Full plan:
`docs/per-module-ticket-master-plan.md`.

- **`src/lib/rbac-workflow-types.ts`** — Audit no longer excluded: removed the
  `isAuditTypeName` early-returns in `ensureWorkflowTypePermissions`,
  `grantWorkflowTypePermissionsToSuperAdmin`, and the filter in
  `syncWorkflowTypePermissions`, so the Audit type gets `wf_type.<id>.*` keys like
  any other. `isAuditTypeName` kept exported for non-ticket callers.
- **`src/lib/rbac-ticket-migration.ts`** (new) — `backfillPerTypeTicketGrants()`:
  idempotent, self-terminating backfill mirroring each `ticket.<verb>` grant onto
  `wf_type.<id>.<verb>` for every type — roles + departments (additive connect)
  and user overrides (replicates GRANT/DENY, never clobbers an existing per-type
  override). SUPER_ADMIN skipped (holds all via sync + resolver bypass).
- **`src/lib/rbac-sync.ts`** — `ensureRbacCatalog()` now calls
  `backfillPerTypeTicketGrants()` after `syncWorkflowTypePermissions()` and the
  SUPER_ADMIN hold-all step.
- **`src/scripts/check-ticket-grants.ts`** (new) + **`package.json`** script
  `gate:ticket-grants` — Phase 3 GO/NO-GO gate: exits 0 (GREEN) when every
  `ticket.*` subject has full per-type coverage, else 1 (RED) listing gaps. Run
  per environment before Phase 3 (the boot backfill is fire-and-forget in
  `src/index.ts:13`, so "server up" ≠ "grants migrated").

**Verified:** roles holding `ticket.<verb>` 0/6 → 6/6 after backfill (idempotent
on re-run); dept + GRANT/DENY-override + non-clobber paths proven with a
self-cleaning test; gate GREEN when clean, RED (exit 1) when a per-type key is
removed; `tsc --noEmit` clean. Not committed.

**Deferred (NOT done):** Phase 3 — remove the `ticket.*` OR-bridge in
`src/middleware/permissions.ts` (per-type enforcement only). Phase 4 — remove
`ticket.*` from `src/lib/rbac-catalog.ts` + update `prisma/seed.ts` system roles.

---

# Ticket form access control — enforce per-form fill/view groups — 2026-07-06

**Problem:** Inside a ticket, users who were **not** in a form's fill/view group could still see and interact with the form. The backend resolver already returned the right `canRead`/`canFill` and the submit endpoint enforced `assertCanFillForm`, but "openness" was inferred from an *empty fill group* — so any binding created without a group (and every virtual audit checklist) was silently open to everyone. Working tree only — **not committed**.

Three parts: A (frontend gate) is in `client/changes.md`; B & C are below. Verified end-to-end: `tests/e2e/ticket-form-access.spec.ts` → **3/3 pass**; backend reloaded with no type errors.

DB context: local Postgres `localhost:5432/kaizen_qms`; `prisma migrate status` clean (45 migrations after this change).

### Part C — Make per-form openness explicit (`isRestricted`), secure by default
Openness is no longer guessed from "empty fill group" — an explicit column decides it, and **new bindings default to restricted**.

- **`prisma/schema.prisma`** — `StageFormBinding` gains `isRestricted Boolean @default(true)`. `true` (default for NEW rows) = only the fill/view groups (plus SUPER_ADMIN) may access; `false` = open to all (ANYONE semantics).
- **`prisma/migrations/20260706211840_stage_form_binding_is_restricted/migration.sql`** (new) — adds the column, then **backfills existing rows to preserve behaviour exactly**: bindings that already had a fill/view group → stay restricted; groupless ("legacy open") bindings → set open. Verified after apply: doc@ perspective **16 open / 25 restricted** (identical to pre-migration); backfill integrity `openRowsWithAGroup=0`, `restrictedRowsWithNoGroup=0`; column default `true, NOT NULL`.
- **`src/modules/stage-form/stage-form.access.ts`** — `bindingAccessSelect` + `BindingAccess` now include `isRestricted`; `isLegacyOpen(b)` (empty-group check) replaced by **`isOpenToAll(b) = !b.isRestricted`**; `canFillForm` / `canReadForm` / `expectedSubmitterIds` use it.
- **`src/modules/workflow/engine/form.layer.ts`** — import `isOpenToAll` instead of `isLegacyOpen`; per-binding `access` object carries `isRestricted`.
- **`src/modules/stage-form/stage-form.service.ts`** — `isRestricted` carried through `listForTicket` (real-binding map + the `access` object driving `canRead`/`canFill`). Virtual audit-checklist bindings set `isRestricted: false` **intentionally** (kept open-to-all to preserve behaviour; locking them down needs a config surface on the audit register — follow-up).

### Part B — Configurable audiences on the standalone binding API
The standalone `/stage-form-bindings` endpoint previously could not set access groups at all (only the workflow builder could), so anything it created was groupless → open. Now it has parity + a secure default.

- **`src/modules/stage-form/stage-form.schema.ts`** — `CreateStageFormBindingSchema` adds `isRestricted` (default **true**), `fillMode`, and `fillRoleIds` / `fillUserIds` / `viewRoleIds` / `viewUserIds`; `UpdateStageFormBindingSchema` adds the same as optional.
- **`src/modules/stage-form/stage-form.service.ts`** — `createBinding` connects the group ids and sets `isRestricted` / `fillMode`; `updateBinding` maps the group id arrays to `set` (replace membership) and passes scalar fields through (absent arrays leave membership untouched).

### Tests
- **`tests/e2e/ticket-form-access.spec.ts`** (new) — API: restricted form reports `canRead=false`/`canFill=false` and hides submission content to a non-audience user; API: submitting a restricted form is rejected `403`; UI: the form is not rendered and a "restricted" notice is shown instead.

### Notes / follow-ups
- Audit-checklist forms remain open-to-all by design (see Part C).
- Pre-existing, unrelated: `qa@forgequantum.com` and `auditor@forgequantum.com` return `401` for the seed password (`Admin@123`); not touched by this work.

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
