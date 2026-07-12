# Backend Changes Log

Backend-side change log for this repo. Companion to `client/changes.md`.

---

# Workflow site-ownership — backend (Phases A–D) — 2026-07-12

Workflows gain a **site owner** so different sites can have their own workflows,
while Super Admin can still make **global** ones. Layers on top of Phase 1
type-scoping. Full plan: `docs/workflow-site-ownership-plan.md`. Working tree only.

- **`prisma/schema.prisma` + migration `20260712111749_workflow_site_ownership`** —
  `Workflow.siteId String?` (nullable) + FK to `Site` (`onDelete: SetNull`) +
  `@@index([siteId])`; reverse relation `Site.workflows`. Nullable, no default →
  **every existing workflow is global** (`null`). No data backfill.
- **`src/modules/workflow/workflow.service.ts`**
  - `workflowSummarySelect` / `workflowDetailSelect` now select `site {id,code,name}`.
  - `createShell` sets `siteId`: `site.view_all` (Super Admin) → honours the
    requested `siteId` (null = global, or a validated real site); everyone else →
    **forced to the creator's own site** (client `siteId` ignored — hard boundary).
  - `list(query, scope, userId, siteScope)` and `directory(typeId, scope, siteScope)`
    add a site filter — `siteId IS NULL (global) OR siteId ∈ caller's sites` —
    composed with the Phase 1 type filter via `AND`. `site.view_all` skips it.
    Both now return `site` on each item; `getById` exposes `site`.
- **`src/modules/workflow/workflow.versioning.ts`** — `cloneIntoNewVersion` carries
  `siteId` onto the new version (a re-save must not globalize a site-owned workflow).
- **`src/modules/workflow/workflow.schema.ts`** — `CreateWorkflowShellSchema` gains
  optional `siteId` (only honoured for `site.view_all`).
- **`src/modules/workflow/workflow.controller.ts`** — `list`/`directory` resolve
  `resolveSiteScope(userId)` and pass it alongside the type scope.
- **`src/modules/user/user.controller.ts`** — `/users/directory` accepts optional
  `?siteId=`, bounded by the caller's scope via `siteFilterFor` (a scoped user can't
  reach another site; `view_all` may target any site, or all sites when omitted).
  Lets the workflow builder show the WORKFLOW's-site people, not just the caller's.
- **`src/modules/role/role.{controller,service}.ts`** — `/roles/directory` is now
  **site-scoped**: roles have no site column, so it returns roles held by ≥1 active
  user in the caller's site(s) (or a bounded `?siteId=`); `view_all` → all roles.

**Verified:** service-level 6/6 on local `kaizen_qms` — scoped PUNE user's new
workflow is forced to PUNE even when it requests HQ; Super Admin creates global
(null) or pins to any site; PUNE user's list shows global + PUNE with no HQ leak;
Super Admin sees HQ-owned; version-clone carries `siteId`. `tsc --noEmit` clean.
Frontend (create site picker, list badge, builder pickers passing the workflow's
site) is Phase E — pending. Not committed.

---

# Access-control data scoping — Phase 1 (workflow lists) — 2026-07-12

Follow-on to the per-module ticket work: the surfaces *around* tickets never got
row-filtered by access, so a user could see workflows of types they can't access.
Phase 1 scopes the workflow list + picker directory to the caller's readable types.
Full plan + decisions: `docs/access-control-data-scoping-plan.md`.

- **`src/middleware/permissions.ts`** — added `workflowTypeReadScope`, an alias of
  `ticketReadScope` (holding `wf_type.<id>.read` = "can see this type"). Aliased,
  not duplicated, so workflow- and ticket-list scoping share one source of truth.
- **`src/modules/workflow/workflow.service.ts`** — `list(query, scope, userId)` and
  `directory(typeId, scope)` now take the caller's type scope. List restricts to
  `typeId IN scope` (a requested `typeId` outside scope → empty page, can't widen);
  typeless workflows surface only to their own author (`typeId=null AND createdById`)
  as in-progress drafts. Directory restricts to `typeId IN scope`, honours an
  in-scope `typeId`, and excludes typeless entirely (unraisable — no per-type key).
- **`src/modules/workflow/workflow.controller.ts`** — `list`/`directory` resolve the
  scope via `workflowTypeReadScope(getEffectivePermissionKeys(userId))` and pass it
  down (mirrors `ticket.controller.list`). No user → closed default.

**Behaviour note:** `GET /workflows` stays behind `workflow.read`; it is now ALSO
type-scoped, so an admin with `workflow.read` but no `wf_type.*.read` sees only
their own typeless drafts. SUPER_ADMIN holds every type key → sees all (unchanged).
In production every user currently holds every type key (per-module access not yet
tailored), so this is invisible there until grants are narrowed.

**Verified:** service-level checks (8/8) on local `kaizen_qms` — empty scope →
nothing; single-type scope → only that type; out-of-scope `typeId` can't widen
(directory + list); typeless excluded from directory; full scope → all active
workflows. **Live HTTP check** (throwaway CAPA-only user vs SUPER_ADMIN, cleaned
up after): scoped user's `/workflows/directory` + `/workflows` return only CAPA,
SUPER_ADMIN sees all active types with no typeless — 3/3 PASS. `tsc --noEmit`
clean. Not committed.

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

---

# Per-module ticket master — Phases 3–4 (retirement complete) — 2026-07-12

Completes the per-module ticket master work above: enforcement now grants
ticket access **only** via per-type `wf_type.<id>.<verb>` keys; the global
`ticket.*` master is gone from the catalog. Verified end-to-end on local
`kaizen_qms`; working tree only. Full plan: `docs/per-module-ticket-master-plan.md`.
Production has only Phase 1–2 so far — see the plan doc's rollout section.

- **`src/middleware/permissions.ts`** — `hasTicketAction` / `requireTicketAction`
  dropped the global `ticket.<action>` fast-path; only the per-type key grants
  now. `ticketReadScope` always returns `all: false`. Forbid messages name the
  specific missing `wf_type.<id>.<verb>` key.
- **`src/modules/ticket/ticket.service.ts`** — default scope hard-falsed
  (`{ all: false, typeIds: [] }`); removed the now-dead `if (!scope.all)` wrapper.
- **`src/lib/effective-permissions.ts`** — **bug fix (pre-existing, found during
  verification):** the SUPER_ADMIN bypass returned `new Set(ALL_KEYS)` where
  `ALL_KEYS` was the **static** catalog only — it never included the
  dynamically-generated `wf_type.*` keys (DB-only rows, never part of the
  static array). This was invisible before because SUPER_ADMIN also always held
  the static `ticket.*` key, and the old OR-bridge let that alone grant every
  ticket action. Once the OR-bridge and `ticket.*` were removed, SUPER_ADMIN's
  bypassed set granted *no* ticket action. Fixed: both
  `computeEffectivePermissions` and `computeEffectiveWithSources`'s SUPER_ADMIN
  branches now read `user.role.permissions` (the actual DB relation) instead of
  the static list — correct because `rbac-sync.ts` already guarantees that
  relation holds every permission row, static and dynamic, as a boot invariant.
  `ALL_KEYS` export removed (no other consumers).
- **`src/lib/rbac-catalog.ts`** — removed the 5 `ticket.*` rows.
- **`src/lib/rbac-sync.ts`** — new `pruneRetiredTicketMasterKeys()` (deletes any
  `module: 'TICKET'` permission row not in the current catalog — the upsert
  loop never deleted orphans on its own); calls the new
  `ensureSystemRoleTicketGrants()` after the Phase 2 backfill; calls
  `findUnmigratedTicketGrants()` at the end and `console.warn`s (non-fatal) if
  anything is still uncovered.
- **`src/lib/rbac-system-role-tickets.ts`** (new) — fresh-install safety net:
  grants the documented default ticket verbs to each of the 5 named system
  roles, per current workflow type, but **only** when that role currently holds
  zero `wf_type.*` permissions — so an admin's deliberate per-type customization
  is never overwritten on a later boot.
- **`src/lib/rbac-ticket-migration.ts`** — extracted `findUnmigratedTicketGrants()`
  (previously duplicated inline in the gate script) so the boot warning and the
  CLI gate share one implementation.
- **`src/scripts/check-ticket-grants.ts`** — now imports the shared gap-finder;
  GREEN message distinguishes "fully migrated" from "master already retired,
  nothing to gate".
- **`prisma/seed.ts`** — removed the literal `'ticket.*'` strings from
  QUALITY_ENGINEER/AUDITOR/DOCUMENT_CONTROLLER; added comments on all 5 system
  roles pointing at `ensureSystemRoleTicketGrants()` as the new source of
  fresh-install ticket access.

**Verified:**
- `pruneRetiredTicketMasterKeys()`: 5 → 0 `TICKET`-module rows; every role's
  `wf_type.*` set byte-identical before/after (only `ticket.*` rows removed).
- `ensureSystemRoleTicketGrants()`: stripped READ_ONLY's `wf_type.*` grants →
  function restored the **exact** original set; a role with existing grants
  (QUALITY_ENGINEER) left completely untouched.
- `gate:ticket-grants`: GREEN, "no master keys remain here — nothing to gate".
- Full Playwright pass (9/9): master module gone from the Access Control UI; no
  row with bare entity `ticket`; CAPA/Audit per-type rows for QUALITY_ENGINEER
  unchanged (regression); SUPER_ADMIN's Raise Ticket button visible;
  DOCUMENT_CONTROLLER's hidden (read+transition only, no create anywhere).
- Direct API calls (bypassing the UI): DOCUMENT_CONTROLLER `POST /tickets` on a
  real CAPA workflow → `403 {"message":"Missing required permission:
  wf_type.<capaId>.create"}`; SUPER_ADMIN same call → `201`, then cleaned up
  (soft-deleted).
- `tsc --noEmit` clean (backend + client); `npx tsc` (full build) clean,
  `dist/` rebuilt.

**Methodology note:** the local dev backend was discovered to be a stale,
non-watching `tsx src/index.ts` process (started before this session's edits,
not via `npm run dev`'s `tsx watch`). Restarted properly before Phase 3
verification — that restart is what surfaced the SUPER_ADMIN bug above; earlier
phases' checks had passed against the stale process because they only
exercised unmodified DB-reading endpoints, never live enforcement code.

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
