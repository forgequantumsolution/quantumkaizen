# Backend Changes Log

Backend-side change log for this repo. Companion to `client/changes.md`.

---

# Audit approval + checklist access — enforce the named approver & tie checklists to assignments — 2026-07-16

Fixes two audit-module holes surfaced by a multi-user Playwright diagnostic
(`tests/e2e/audit-access-diagnostic.spec.ts`): (1) the register's **Approver**
field was decorative — any holder of `audit_register.approve` could approve any
audit; (2) an audit's **checklists were open to everyone** — the per-ticket
virtual bindings were hardcoded `isRestricted:false`, so the `checklistAssignments`
you set on the register granted nobody access and blocked nobody. Working tree
only (not committed). Verified end-to-end against a throwaway backend on :4100
(the dev server's `tsx watch` was not hot-reloading) with the seed users.

- **`src/modules/audit/audit-register.service.ts`** — **fix #1: enforce the named
  approver.** New `assertIsNamedApprover(register, userId)` requires
  `userId === approverId` (SUPER_ADMIN bypasses, matching
  `stage-form.access.ts` / `approval.layer.ts`); called at the top of
  `approveAuditRegister` and `rejectAuditRegister`. Holding
  `audit_register.approve` now only gets you to the route — the decision is bound
  to the person named on the register. Added `Forbidden` to the httpError import.
  Verified: a non-super permission holder who isn't the approver → 403; the named
  approver (auditor@, who holds the perm) approves their own audit → 200; super
  admin bypasses.
- **`src/modules/stage-form/stage-form.service.ts`** — **fix #2: checklist access
  follows the register's assignments.** Replaced `auditChecklistFormIds` with
  `auditChecklistAccess(customFields)`, which derives per-ticket access from the
  linked `AuditRegister`: assigned members (∪ lead auditor ∪ team) may **fill**
  each checklist, the approver may **view** (read-only); `restrict` is true iff
  there's any basis to lock down by, so an unconfigured audit stays open-to-all
  (nobody locked out). `listForTicket` now builds the virtual `audit:<stageId>:<formId>`
  bindings with real `allowedFillUsers`/`allowedViewUsers` + `isRestricted` (was
  hardcoded open), and `createWorkflowSubmission` calls `assertCanFillForm` on the
  audit branch so the fill gate is enforced server-side, not just in the UI. This
  is per-ticket (from the register) and does NOT touch the shared per-workflow
  `StageFormBinding` rows, so one audit's audience never leaks onto another audit
  on the same workflow. Verified: assigning a login user to one checklist grants
  fill on THAT checklist only, gives the approver read-only, blocks unassigned
  users (canFill=false + 403 on submit); SUPER_ADMIN bypasses.
- **`prisma/seed.ts`** — **option (a): keep AUDITOR able to approve.** The AUDITOR
  role already holds `audit_register.approve` at the role level in the live DB, but
  the seed still granted only the legacy `audit.approve` key — a re-seed would have
  regressed it and (with fix #1) left only super admins able to approve. Added the
  real `audit_register.*` / `audit_master.*` / `audit_program.*` / `audit_finding.*`
  / `audit_schedule.*` / `audit_type.*` + `non_conformance.*` keys the live AUDITOR
  role holds to its `permissionKeys`, so the source of truth matches the working
  system. Approver-eligible roles remain SUPER_ADMIN, QMS_ADMIN, AUDITOR.
- **`tests/e2e/audit-access-diagnostic.spec.ts`** *(new, repo root `tests/`)* —
  multi-user diagnostic + regression: logs in as all 7 seed users, reports the
  register inventory + pre-existing data debt (approver-less approved registers,
  dangling/`404` checklist tickets — report-only, not fixed here), prints the
  checklist access matrix, and hard-asserts the approval enforcement (fix #1).
  `API_BASE` env overrides the target host. Green (5/5) against a patched server.

Not addressed (pre-existing data debt, needs a backfill not code): 15 historical
registers that reached APPROVED with `approverId=null`, and 2 registers whose
workflow ticket resolves but `/stage-forms` 404s (broken stage wiring). `tsc
--noEmit` clean. **The running `:4000` dev server must be restarted to pick up
these changes.**

---

# Phase 6 follow-up — childCount on the ticket list (for list nesting) — 2026-07-16

- **`src/modules/ticket/ticket.service.ts`** — `list()` now returns `childCount`
  per row: one `prisma.ticket.groupBy(['parentTicketId'])` over the page's ticket
  ids counts direct children. Lets the module list show an expander on parents and
  nest their children (which may be a different workflow type, e.g. a CAPA under a
  Change Control ticket, and so aren't in the module's own list). Cheap — one extra
  grouped query per page. `tsc --noEmit` clean.

---

# Findings Phase 6 — generic per-stage "raise child ticket" — backend — 2026-07-16

The generic entry point for child tickets: attach **allowed child workflows to a
stage** in the builder, and the ticket's stage view shows a "Raise <workflow>"
control that spawns a child (CAPA / Deviation / any workflow) nested under the
parent — no finding required. Reuses the existing `ChildWorkflowTrigger` model +
`spawnChild`; the work was (a) folding trigger config into the flow_json
embedded-policy pipeline and (b) a runtime endpoint to list a stage's triggers.
Plan: `docs/workflow/findings-child-tickets-plan.md` §Phase 6. Working tree only.

- **`src/modules/workflow/workflow.schema.ts`** — new typed
  `EmbeddedChildTriggerSchema` (`childWorkflowId`, `triggerMode` MANUAL|AUTO,
  `isBlocking`, `allowMultiple`, `order`) + `childTriggers` on `NodeSchema.data`
  (the old untyped `child_workflow_triggers` passthrough is kept for legacy JSON).
  Exports `EmbeddedChildTrigger`.
- **`src/modules/workflow/workflow.builder.ts`** — `buildWorkflowGraph` now
  collects `node.data.childTriggers` in Pass 1 and materialises them as
  `ChildWorkflowTrigger` rows in the execute phase (validating each
  `childWorkflowId` exists — FK is `onDelete: Restrict` — dropping missing ones
  with a warning). Removed the "child workflow triggers deferred to Engine phase"
  warning.
- **`src/modules/workflow/workflow.versioning.ts`** — deleted the explicit
  stage-by-stage `ChildWorkflowTrigger` clone (and the `old.stages.childTriggers`
  select + `newStageByCanonical` map that fed it). Triggers now ride flow_json,
  so `buildWorkflowGraph` re-materialises them on every version clone like every
  other policy; keeping the explicit clone would double-insert. Header docs updated.
- **`src/modules/workflow/workflow.service.ts`** — `workflowDetailSelect` selects
  `stage.childTriggers` (with `childWorkflow.name`); `toFlowJson` maps them back
  onto the node as `childTriggers` (incl. display-only `childWorkflowName`) so the
  builder round-trips them across edit/publish.
- **`src/modules/ticket/ticket.service.ts`** —
  - `listStageChildTriggers(ticketId)` (new): for the ticket's CURRENT stage(s),
    returns the MANUAL triggers, each resolved to the child workflow's **latest
    version** (workflows re-version on save), with an `already_raised` flag from
    the `allowMultiple=false` gate.
  - `spawnChild` now enforces `allowMultiple`: if a matching trigger
    (same stage, same workflow lineage) is `allowMultiple=false` and a child was
    already raised, it 400s. Findings-driven spawns (no matching trigger) are
    unaffected. Added a `workflowLineage()` helper (lineage root + latest version).
- **`src/modules/ticket/ticket.controller.ts` + `.routes.ts`** — new
  `GET /tickets/:id/child-triggers` (gated `requireTicketAction('read')`).

**Verified (API, local `kaizen_qms2`):** saved a `childTriggers` config into the
Inspection workflow's first stage → reloaded latest (v5) round-trips it with the
hydrated name; raised a fresh Inspection ticket → `GET /child-triggers` returns
the CAPA trigger → `spawn-child` 201 nested `CAPA-FQS-082` → `already_raised`
flips true → second spawn 400 (allowMultiple gate). `tsc --noEmit` clean.

---

# Generic findings → child tickets (CAPA / Deviation) — backend — 2026-07-16

Bring the audit module's "findings → child ticket" capability to every other QMS
module as ONE reusable mechanism, instead of cloning audit's bespoke tables per
module. A **Finding** is auto-generated from a ticket's checklist dispositions
(non-conformance → severity finding; observation too), then a **CAPA** or
**Deviation** child ticket is raised from it and nests under the parent. Applies
to types flagged `supportsFindings` (Inspection, Change Control, Deviation,
Supplier Quality). Full plan: `docs/workflow/findings-child-tickets-plan.md`. Verified on
local `kaizen_qms2` (all-modules dump). Working tree only — **not committed**.

- **`prisma/schema.prisma` + migration `20260716080013_add_generic_findings`** —
  new **`Finding`** model (`findingNumber` `F-YYYY-NNNN`, `sourceTicketId`,
  `sourceStageId?`, `severity`, `status`, `title/description/evidence?/
  recommendation?/reference?`, `childTickets`, `capas`, `createdById?`). Added
  `Ticket.sourceFindingId`/`sourceFinding`/`findings`, `Capa.findingId`/`finding`,
  `User.findingsCreated`, and **`WorkflowType.supportsFindings Boolean @default(false)`**
  (the per-type opt-in flag). Additive migration — 3 columns, 1 table, indexes, 4
  FKs, no drops.
- **`src/modules/finding/` (new)** — the whole module:
  - `finding.schema.ts` — Zod: `FindingUpsertSchema`, `FindingUpdateSchema`,
    `ListFindingQuerySchema` (`workflow_type_id`, `source_ticket_id`, `status`,
    `severity`, `department_id`, paging), `RaiseChildSchema`
    (`child_type: CAPA|DEVIATION` + capa_type/owner/dept/due), id/param schemas.
  - `finding-sync.service.ts` — auto-generation. Reuses audit's
    `collectSubmissionComplianceItems`/`collectTicketComplianceItems`;
    `syncSubmissionFindings(ticketId, submissionId)` +
    `syncTicketFindingsOnComplete(ticketId)` persist generic `Finding` rows with
    `F-YYYY-NNNN` numbering, deduped by `evidence.dedupeKey`.
  - `finding.service.ts` — `listFindingsForTicket`, `listFindings` (module
    register), `createFinding`/`updateFinding`/`deleteFinding`, `raiseChild`
    (CAPA → `createCapa` with `finding_id` + `parent_ticket_id`; DEVIATION →
    resolve the Deviation workflow + `spawnChild`, set `sourceFindingId`),
    `listFindingChildren`.
  - `finding.controller.ts` / `finding.routes.ts` — `GET /findings`,
    `GET /tickets/:ticketId/findings`, `POST/PUT/DELETE /findings`,
    `POST /findings/:id/raise-child`, `GET /findings/:id/children`.
- **`src/modules/audit/capa.service.ts`** — `raiseCapaWorkflowTicket` accepts
  `findingId` + `parentTicketId` (threaded to `engineRaiseTicket`; sets
  `ticket.sourceFindingId`); `createCapa` persists `findingId` and passes
  `parent_ticket_id` so a CAPA raised from a finding nests under the source ticket.
- **`src/modules/audit/audit.schema.ts`** — `CapaCreateSchema` gains optional
  `finding_id` + `parent_ticket_id`.
- **`src/modules/ticket/ticket.service.ts` + `.controller.ts` + `.routes.ts`** —
  new `listChildren(parentTicketId)` (resolves `capa_id`, dedups) + `GET
  /tickets/:id/children` powering the sidebar CHILD RECORDS card.
- **`src/modules/stage-form/stage-form.service.ts`** — best-effort
  `syncSubmissionFindings` hook after a generic submission is created.
- **`src/modules/workflow/engine/orchestrator.ts`** — `syncTicketFindingsOnComplete`
  hook on ticket completion.
- **`src/app.ts`** — mount `findingRoutes` under `/api`.

**Verified:** manual finding `F-2026-0001`; raise `CAPA-2026-0008` + `DEV-FQS-047`;
children dedupe. Auto-gen on `INS-FQS-051` (submitted checklist → `F-2026-0002`
MAJOR from non-conformance, `F-2026-0003` OBSERVATION; compliant items ignored).
`tsc --noEmit` clean.

---

# Findings access control — per-workflow-type (not one global key) — 2026-07-16

Follow-on to the feature above. Findings started with a single global `finding.*`
permission set; converted to **per-workflow-type** keys so Access Control can
grant/deny findings on each module independently — mirroring the per-module
**ticket** keys (`wf_type.<id>.*`). Key scheme `finding.<typeId>.{read,create,
update,delete}` (module `FINDING_TYPE`), only for `supportsFindings` types.
Working tree only — **not committed**.

- **`src/lib/rbac-findings.ts` (new)** — mirrors `rbac-workflow-types.ts` for
  findings: `findingTypeKey`, `typeIdFromFindingKey`, `ensure/grant/delete`
  helpers, and `syncFindingTypePermissions()` — upserts 4 keys for every
  `supportsFindings` type, prunes orphans (type gone OR findings turned off).
  Deliberately namespaced under `finding.` (not `wf_type.`) so no ticket-key
  logic (migration / system-role / `ticketReadScope`) ever picks it up.
- **`src/lib/rbac-sync.ts`** — call `syncFindingTypePermissions()` before the
  SUPER_ADMIN "hold everything" step (so the invariant covers it); new
  `pruneRetiredGlobalFindingKeys()` deletes the old module-`FINDING` master keys.
- **`src/lib/rbac-catalog.ts`** — removed the 4 static global `finding.*` rows
  (replaced by the dynamic per-type keys).
- **`src/middleware/permissions.ts`** — new `requireFindingAction(action, from)`
  guard: resolves the workflow type from the request (`ticketParam` /`body`
  `source_ticket_id` / `finding` id / `query` `workflow_type_id`) and checks
  `finding.<typeId>.<action>`. No type / non-findings type → no key can grant it.
- **`src/modules/finding/finding.routes.ts`** — swapped every
  `requirePermission('finding.*')` for `requireFindingAction(...)` (validate runs
  first so the resolver sees parsed params/body/query).
- **`src/modules/workflow/lookups/lookups.service.ts`** — hard-deleting a type now
  also `deleteFindingTypePermissions(id)`.

**Verified:** boot sync created **16 keys** (4 types × 4 verbs) for Inspection /
Change Control / Deviation / Supplier Quality; old global keys pruned. Enforcement
as admin: inspection & deviation findings → **200**, Batch Disposition
(non-findings type) → **403**. Migrated the demo `QMS_ADMIN` role's retired global
grant onto the 16 per-type keys so it keeps working. `tsc --noEmit` clean.

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
