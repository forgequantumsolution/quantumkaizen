# Per-Module Ticket Master — Retire the Global `ticket.*` Master

**Status:** Phases 1-4 implemented + verified (local `kaizen_qms` end-to-end via
Playwright + direct API calls; production gate GREEN as of the Phase 1/2
deploy). Phase 5 (docs sweep) partially done — this doc is current; user-facing
docs (`PROJECT_USER_GUIDE.md`, `APPLICATION_WORKFLOW.md`) not yet swept. Not
committed anywhere — all changes are in the local working tree only; production
is still running the pre-Phase-3 code that was deployed for Phase 1/2.
**Owner:** TBD · **Created:** 2026-07-11

## 1. Goal

Today ticket access is governed by two layers:

1. A **global master** — the `ticket.{read,create,update,delete,transition}` catalog
   keys. In Access Control (`/settings?tab=access`) this is the row
   **"All Workflow Types (ticket master)"**. Holding it opens tickets across
   *every* workflow type at once.
2. **Per-workflow-type keys** — `wf_type.<typeId>.{read,create,update,delete,transition}`,
   generated per workflow type, each surfaced as its own module in the matrix.

Enforcement is an **OR-bridge**: a ticket action passes if the user holds *either*
the global `ticket.<action>` key *or* the type's `wf_type.<id>.<action>` key
(`backend/src/middleware/permissions.ts`).

**We are retiring the global master.** After this change the *only* thing that
grants ticket access is a per-type key. There is no override that unlocks all
types at once. This gives per-module control of tickets instead of one switch.

### Decisions locked
- **Audit handling: Option A** — the Audit workflow type stops being excluded and
  gets its own `wf_type.<auditTypeId>.*` keys, exactly like every other module.
  No second special case in the middleware.
- Implement as a reviewed markdown plan first (this document), then build.
- **Typeless workflows (`typeId = null`):** a ticket on a workflow with no
  assigned type has no per-type key that could ever grant it — after Phase 3 it
  becomes reachable by SUPER_ADMIN only. Investigated before Phase 3 shipped:
  local `kaizen_qms` has 12 typeless workflows / 7 live tickets, **all** clearly
  E2E test artifacts (`Audit E2E WF …`, `shape-probe …`, all dated
  2026-06-29–07-01, matching `tests/e2e/workflow-type-access.spec.ts`);
  production has **zero**. Decision: no special-case fallback code — "accept as
  literal" per the goal, given neither environment has real data affected. A
  reusable read-only report,
  `backend/src/scripts/check-typeless-workflows.ts` (`npm run
  check:typeless-workflows`, or `:prod` for the compiled version), is available
  to re-check any environment before a future Phase 3/4 deploy there.

### Non-goals
- No change to per-site scoping (`site.view_all` etc.) — orthogonal, untouched.
- No change to the workflow **engine** or ticket data model.
- No change to non-ticket audit surfaces (`audit_register.*`, `capa.*`, …). Those
  keys keep gating the audit *records*; only ticket reachability changes.

---

## 2. Impact map (everything that references the global master)

### Backend
| File | Reference | Action |
|------|-----------|--------|
| `backend/src/lib/rbac-catalog.ts:77-81` | Defines the 5 `ticket.*` rows | Remove in Phase 4 |
| `backend/src/lib/rbac-workflow-types.ts:34-35` | `isAuditTypeName` excludes Audit from key generation | Stop excluding (Option A) |
| `backend/src/middleware/permissions.ts:78` | `hasTicketAction` global fast-path | Remove in Phase 3 |
| `backend/src/middleware/permissions.ts:112` | `requireTicketAction` global fast-path | Remove in Phase 3 |
| `backend/src/middleware/permissions.ts:134-135` | `ticketReadScope` `ticket.read` → `all:true` | Remove `all` branch in Phase 3 |
| `backend/src/middleware/permissions.ts:161` | list-guard forbid message | Reword |
| `backend/src/modules/ticket/ticket.service.ts:119-130` | list scoping keyed on `scope.all` | Simplify once `all` is always false |
| `backend/prisma/seed.ts:79,100,119` | 3 system roles grant `ticket.*` | Replace with per-type keys |

### Frontend
| File | Reference | Action |
|------|-----------|--------|
| `client/src/lib/navAccess.ts:141-151` | `workflow-tickets-master` module ("All Workflow Types (ticket master)") | Delete |
| `client/src/lib/navAccess.ts:160` | `isAuditWorkflowTypeName` excludes Audit from per-type modules | Stop excluding (Option A) |
| `client/src/lib/navAccess.ts:166` | only `wfTypeReadKey` helper exists | Add create/update/delete/transition helpers |
| `client/src/features/admin/access-control/AccessControlTab.tsx:35-44` | filters Audit out of per-type modules | Stop excluding (Option A) |
| `client/src/components/layout/Sidebar.tsx:236,261` | `anyPermission: [wfTypeReadKey, "ticket.read"]` | Drop `"ticket.read"` |
| `client/src/features/audit/AuditModuleLayout.tsx:13` | "My Tasks" gates on `ticket.read` | Gate on the Audit type read key |
| `client/src/features/audit/capa/CapaWorkflowBand.tsx:26` | `useHasPermission('ticket.transition')` | Gate on the ticket's per-type transition key |
| `client/src/features/tickets/TicketsPage.tsx:81-82` | `ticket.create` / `ticket.delete` button gates | Aggregate to "any type" |

### Docs (update references)
`PROJECT_USER_GUIDE.md`, `docs/APPLICATION_WORKFLOW.md`, and any `changes.md`
lines that describe the `ticket.read` master / OR-bridge.

---

## 3. Phased plan

The ordering matters: **add the Audit key and migrate grants BEFORE removing the
master**, so effective access never drops between deploys.

### Phase 1 — Close the Audit gap (non-breaking)
Give Audit tickets an explicit per-type key so that, once the master is gone,
Audit is still reachable.

- `rbac-workflow-types.ts`: remove the `isAuditTypeName` early-returns in
  `ensureWorkflowTypePermissions`, `grantWorkflowTypePermissionsToSuperAdmin`,
  and the filter in `syncWorkflowTypePermissions` so the Audit workflow type
  gets `wf_type.<auditTypeId>.*` rows. Keep `isAuditTypeName` exported if other
  call sites still need "is this the audit type" for *non-ticket* reasons —
  audit only stops being special **for ticket keys**.
- Frontend mirror: remove the Audit exclusion in `navAccess.ts`
  (`isAuditWorkflowTypeName` usage) and `AccessControlTab.tsx` so the Audit
  module's ticket verbs render in the matrix.
  - ⚠️ **Duplicate-Audit fix (decided):** the matrix renders one group per module
    from `[...NAV_ACCESS, ...extraModules]`. The static `audit` module (records:
    `audit_register.*`, `capa.*`, …) and a generated per-type module (label
    `"Audit"`, gated by `wf_type.<auditId>.*`) would both title themselves
    "Audit". Fix = **render the audit ticket keys as one extra row inside the
    existing Audit module**, not as a standalone group:
    1. Keep `useWorkflowTypeModules()` **excluding** Audit (no standalone group).
    2. Add `extraTabsByModule?: Record<string, NavTabAccess[]>` to `AccessMatrix`
       and merge in the group builder: `[...module.tabs, ...(extraTabsByModule?.[module.key] ?? [])]`
       (`AccessMatrix.tsx:90`).
    3. In `AccessControlTab`, resolve the Audit type id from `useWorkflowTypes()`
       and pass `extraTabsByModule={{ audit: [{ key:'audit.tickets',
       label:'Workflow Tickets', permission: wfTypeReadKey(auditId),
       entity: wfTypeEntity(auditId) }] }}`.
    The `wf_type.<auditId>.*` keys are enforced identically to every other type;
    only their display location changes. Fallback (if not touching AccessMatrix):
    relabel the generated Audit module to `"Audit — Workflow Tickets"` — two
    groups but clearly distinguished.
- Run/verify `syncWorkflowTypePermissions()` on boot backfills the Audit keys and
  grants them to SUPER_ADMIN.
- **At the end of Phase 1 the global master still works** — nothing breaks;
  Audit now *also* has per-type keys.

### Phase 2 — Migrate existing grants (reversible) — ✅ IMPLEMENTED
Preserve today's effective access as explicit per-type grants.

**Built as an idempotent boot-time reconciler** (chosen over a one-shot script so
it auto-applies on every environment at deploy — important because prod/remote
backends must not lose access when Phase 3/4 ships):
`backend/src/lib/rbac-ticket-migration.ts` → `backfillPerTypeTicketGrants()`,
called from `ensureRbacCatalog()` in `rbac-sync.ts` after
`syncWorkflowTypePermissions()`.

For every **role**, **department**, and **user override** holding
`ticket.<verb>`, it mirrors the grant onto `wf_type.<id>.<verb>` for **every
workflow type (Audit included)**:
  - Roles / departments: additive M2M `connect` (idempotent).
  - User overrides: replicate the **effect** (GRANT *and* DENY), but **never
    overwrite** an existing explicit per-type override (admin's per-module choice
    wins).
  - SUPER_ADMIN skipped (holds all keys via rbac-sync + resolver bypass).

Key properties: **idempotent** (safe every boot) and **self-terminating** —
gated on the global `ticket.*` catalog rows still existing, so once Phase 4
removes them it becomes a no-op.

- `seed.ts` system-role changes **deferred to Phase 4**: fresh installs seed with
  `ticket.*`, and the first boot's backfill expands them to per-type keys, so
  seed only needs editing when the `ticket.*` catalog rows are removed.
- **`ticket.*` grants NOT removed** — master stays live so Phase 2 is additive
  and verifiable.

**Verification (done, against local `kaizen_qms`, 6 workflow types):**
- Every role holding `ticket.<verb>` went from `0/6` → `6/6` per-type `<verb>`
  keys; second run made no changes (idempotent). Full coverage: ALL ✓.
- Controlled edge test (temp data, self-cleaned): department `ticket.read` → 6/6;
  user GRANT create → 5/5 with a pre-existing per-type DENY **preserved** (not
  clobbered); user DENY transition → 6/6; zero leftovers after cleanup. ✓

### Phase 3 — Flip enforcement to strictly per-module — ✅ IMPLEMENTED
- `permissions.ts`: `hasTicketAction` now only checks the per-type key (`if
  (!typeId) return false; return keys.has(wfTypeKey(typeId, action));`).
  `requireTicketAction` dropped the global fast-path. `ticketReadScope` always
  returns `all: false` (kept in the type for signature stability — see open
  item 3). Forbid messages now name the specific missing `wf_type.<id>.<verb>`
  key (or explain a typeless ticket has no grantable key).
- `ticket.service.ts`: default `scope` hard-falsed to `{ all: false, typeIds: [] }`
  (no fail-open default); removed the now-dead `if (!scope.all)` wrapper since
  it was always true — the `typeIds` filter always applies.
- `rbac-workflow-types.ts` + `ticket.routes.ts` header comments updated — no
  more OR-bridge.

**⚠️ Bug found and fixed during Phase 3 verification (pre-existing, not a
regression from this work):** `effective-permissions.ts`'s SUPER_ADMIN bypass
returned `new Set(ALL_KEYS)` where `ALL_KEYS` was every key in the **static**
`rbac-catalog.ts` array — which **never included the dynamically-generated
`wf_type.*` keys** (those only exist as DB rows, created at runtime). This bug
predates this entire body of work. It was invisible before because SUPER_ADMIN
always also held the static `ticket.*` master key, and the old OR-bridge fast
path let that alone grant every ticket action. Once Phase 3 removed the
OR-bridge and Phase 4 removed `ticket.*` from the catalog, SUPER_ADMIN's
bypassed permission set no longer contained anything that could grant a ticket
action — a live Playwright run against a freshly-restarted backend caught this
immediately (SUPER_ADMIN's "Raise Ticket" button vanished; a real `POST
/tickets` would have 403'd). **Fix:** both `computeEffectivePermissions` and
`computeEffectiveWithSources`'s SUPER_ADMIN branches now read
`user.role.permissions` (the actual DB relation) instead of the static
`ALL_KEYS` list — correct because `rbac-sync.ts`'s "hold everything" step
already guarantees that relation contains every permission row, static and
dynamic, as a boot-time invariant. `ALL_KEYS` export removed (no other
consumers). Verified via direct API calls post-fix: SUPER_ADMIN successfully
created and deleted a real ticket; a role with no create grant on a type got a
403 naming the exact missing `wf_type.<id>.create` key.

**Methodology note:** this bug was only caught because the dev backend was
verified to be running a **stale, non-watching** `tsx src/index.ts` process
(started before any of this session's edits, not `npm run dev`'s `tsx watch`).
Earlier phases' Playwright checks passed against that same stale process
because they only exercised unmodified read endpoints reflecting DB state
changed via standalone scripts — they never exercised live enforcement code.
Restarting via `npm run dev` (so future edits hot-reload) before testing
enforcement changes is what surfaced this. Worth remembering for any future
phase: verifying against a long-lived dev server that predates your edits can
silently validate the wrong code.

### Phase 4 — Remove the master from UI + catalog — ✅ IMPLEMENTED
- `navAccess.ts`: deleted the `workflow-tickets-master` module block. Added
  `wfTypeCreateKey` / `wfTypeUpdateKey` / `wfTypeDeleteKey` /
  `wfTypeTransitionKey` next to `wfTypeReadKey`.
- `Sidebar.tsx`: both workflow-type nav entries switched from `anyPermission:
  [wfTypeReadKey(id), "ticket.read"]` to a plain `permission: wfTypeReadKey(id)`
  (a 1-element `anyPermission` array behaves identically but `permission` is
  simpler) — visibility is strictly the per-type read key.
- `AuditModuleLayout.tsx`: "My Tasks" tab moved out of the static `TABS` array
  and is now spliced in with a permission resolved from `useWorkflowTypes()` +
  `wfTypeReadKey(auditTypeId)` (empty string, i.e. always-false, until the type
  loads).
- `CapaWorkflowBand.tsx`: `useHasPermission('ticket.transition')` replaced with
  `useHasPermission(ticketTypeId ? wfTypeTransitionKey(ticketTypeId) : '')`,
  reading `ticket.flows[0].workflow.typeId`. Confirms the plan's hook-nuance
  guidance worked as designed — the hook is always called, just with a
  possibly-empty key.
- `TicketsPage.tsx`: `canCreate`/`canDelete` now use a new
  `useHasAnyPermissionMatching(predicate)` selector added to `authStore.ts`,
  checking for any held key matching `/^wf_type\.[^.]+\.(create|delete)$/`.
- `rbac-catalog.ts`: removed the 5 `ticket.*` rows. `rbac-sync.ts` gained an
  explicit `pruneRetiredTicketMasterKeys()` step (the static catalog upsert
  loop never deleted rows on its own) that deletes any `module: 'TICKET'` row
  not in the current code catalog — cascades to remove role/department/user
  grants referencing it. Runs before `syncWorkflowTypePermissions()` so the
  Phase 2 backfill and the boot warning both see the post-prune state on the
  same boot.
- **New: fresh-install safety net** (`rbac-system-role-tickets.ts`,
  `ensureSystemRoleTicketGrants()`) — Phase 2's backfill only helps
  environments that once held `ticket.*` to mirror from; a brand-new install
  seeded after Phase 4 never does. This grants the documented default ticket
  verbs (matching the historical `ticket.*` grants — see seed.ts comments) to
  each of the 5 named system roles, for every current workflow type, but
  **only** when that role currently holds zero `wf_type.*` permissions at all
  — so it never overwrites an admin's deliberate per-type customization
  (consistent with rbac-sync.ts's "admin customizations survive" principle).
  Wired into `ensureRbacCatalog()` after the Phase 2 backfill.
- **New: boot-time observability warning** — `findUnmigratedTicketGrants()`
  (factored out of the gate script into `rbac-ticket-migration.ts`, shared by
  both) runs at the end of every boot; if any subject still has incomplete
  per-type coverage relative to a `ticket.*` grant, logs a loud `console.warn`
  (non-fatal). Trivially a no-op once `ticket.*` is pruned (which happens
  earlier in the same boot), so this is cheap insurance against a partial or
  mixed rollout rather than something expected to ever fire in steady state.
- `seed.ts`: removed the literal `'ticket.read'` / `'ticket.create'` /
  `'ticket.update'` / `'ticket.transition'` strings from QUALITY_ENGINEER,
  AUDITOR, DOCUMENT_CONTROLLER; added comments on all 5 system roles (including
  QMS_ADMIN and READ_ONLY, whose lists are filter-derived and needed no literal
  edit) pointing at `ensureSystemRoleTicketGrants()` as the new source of their
  ticket access on a fresh install.

**Verification (local `kaizen_qms`, after restarting the backend under `npm run
dev` — see methodology note above):**
- `pruneRetiredTicketMasterKeys()`: 5 → 0 `TICKET`-module rows; every existing
  role's `wf_type.*` grant set byte-identical before/after (only the `ticket.*`
  rows themselves were removed, confirmed against exact per-role literal-key
  counts from the original seed.ts).
- `ensureSystemRoleTicketGrants()`: direct behavioural test — stripped
  READ_ONLY's `wf_type.*` grants, ran the function, got back the **exact**
  original set (all read-verb, one per type); a role with existing grants
  (QUALITY_ENGINEER) was left completely untouched.
- `gate:ticket-grants`: GREEN with an updated message once `ticket.*` is gone
  ("no master keys remain here — nothing to gate").
- `check:typeless-workflows`: unchanged (12 test-artifact workflows, 7 tickets;
  same as the earlier pre-flight check — see §Typeless-ticket decision below).
- **Playwright, full login → matrix → API flow, 9/9 checks:** master module
  gone from the Access Control UI; no row with bare entity `ticket` remains;
  CAPA/Audit per-type rows for QUALITY_ENGINEER unchanged (regression check);
  SUPER_ADMIN's "Raise Ticket" button visible; DOCUMENT_CONTROLLER (read +
  transition only, no create/delete on any type) can open `/tickets` but the
  button is hidden.
- **Direct API calls** (bypassing the UI entirely): DOCUMENT_CONTROLLER's `POST
  /tickets` against a real CAPA workflow → `403 {"message":"Missing required
  permission: wf_type.<capaId>.create"}`; SUPER_ADMIN's `POST /tickets` on the
  same workflow → `201`, ticket created, then cleaned up (soft-deleted) as part
  of the test.

### Phase 5 — Verify & document — partially done
- **Test matrix — done, via Playwright + direct API calls (local only):**
  | Subject | Expectation | Verified |
  |---------|-------------|----------|
  | Role with only CAPA type keys | Sees/creates/transitions CAPA tickets only | ✅ (DOCUMENT_CONTROLLER-style test: no create grant → 403 naming the exact CAPA key) |
  | Role with only Audit type keys | Sees Audit "My Tasks" + audit tickets only | ✅ (Phase 1 row renders; AuditModuleLayout gates on the resolved audit type key) |
  | SUPER_ADMIN | Sees/acts on all types (holds all `wf_type.*`) | ✅ (real `POST /tickets` → 201, after the effective-permissions.ts fix) |
  | User override DENY on one type | Loses that type only | Not re-verified after Phase 3/4 (was proven for the Phase 2 backfill mechanism itself; the DENY-still-wins resolution logic in `computeEffectivePermissions` is untouched by Phase 3/4) |
  | `/tickets` list page | Rows + Raise/Delete buttons respect per-type scope | ✅ (DOCUMENT_CONTROLLER: list loads, Raise button hidden) |
  | Direct API `GET /tickets/:id` cross-type | 403 without that type's read key | Not explicitly re-tested this round (covered by `requireTicketAction('read')` using the same `hasTicketAction` verified for `create`) |
- **Docs still to update:** `PROJECT_USER_GUIDE.md` (§ tickets, § modules),
  `docs/APPLICATION_WORKFLOW.md` (the "type read / `ticket.read`" rows). Code
  changes are logged in `changes.md` (root + `backend/changes.md` +
  `client/changes.md`).

---

## 3a. Phase 2 → Phase 3 GO/NO-GO gate — ✅ IMPLEMENTED

`backend/src/scripts/check-ticket-grants.ts` (run: `npm run gate:ticket-grants`).
Exits **0 = GREEN** (every `ticket.*` subject has full per-type coverage → safe
to ship Phase 3) or **1 = RED** (prints each gap → do NOT ship). Must be run, and
be GREEN, on **each** environment before Phase 3 lands there.

Why a gate is required (not just "did it boot"): `ensureRbacCatalog()` — which
runs the Phase 2 backfill — is **fire-and-forget and non-fatal** inside the
`app.listen` callback (`backend/src/index.ts:13`). The server serves requests
before the backfill finishes, and a backfill error is only logged. So "server is
up" does NOT imply "grants are migrated"; the gate checks the DB state directly.

Verified on local `kaizen_qms` (6 types): GREEN/exit 0 when clean; break one
per-type key → RED/exit 1 naming the exact gap; idempotent backfill restores →
GREEN again.

## 4. Rollout & rollback

- **Deploy order = phase order, and Phase 3 ships SEPARATELY from Phase 2.**
  Ship Phase 1+2 → let each environment boot → run `npm run gate:ticket-grants`
  until GREEN on that environment → only then ship Phase 3+4. Because the
  backfill is idempotent, by the time the Phase 3 release boots the grants are
  already migrated from the Phase 2 release, so the fire-and-forget boot-window
  race does not exist. **Do NOT bundle Phase 2 and Phase 3 in one release** — that
  reintroduces the window where enforcement is live but grants may not be
  migrated yet.
- **Startup intentionally left non-blocking.** `ensureRbacCatalog` does NOT
  block `listen` (that would trade the resilient non-fatal boot for a new
  failure mode where a transient RBAC-sync error stops the API entirely). The
  staged deploy + gate solves the race without that trade. Phase 3 added a loud
  non-fatal boot warning (`findUnmigratedTicketGrants`) if any un-migrated
  subject remains — observability without fatal startup — implemented as
  described.
- **Rollback:** if Phase 3/4 misbehaves, re-add the `ticket.*` catalog rows
  (revert `rbac-catalog.ts`) and the global fast-paths (revert `permissions.ts`
  + `ticket.service.ts`). The per-type grants added in Phase 2 remain valid and
  harmless, so rollback restores the old OR-bridge behavior without data loss.
  Note: `pruneRetiredTicketMasterKeys()` will have already deleted the DB
  `ticket.*` permission rows on any environment that booted post-Phase-4; a
  rollback's next boot recreates them via the restored catalog upsert, and
  `backfillPerTypeTicketGrants()` will NOT re-mirror anything to them (no
  subject holds the now-fresh rows yet) — a rollback restores **code** behavior
  immediately but grants on the master itself would need re-granting via Access
  Control if truly needed. In practice this is moot: since every subject
  already got its per-type grants during Phase 2, reverting Phase 3/4's code
  alone (leaving `ticket.*` catalog removal reverted too) restores the exact
  pre-Phase-3 OR-bridge behavior on top of the still-intact per-type grants.
- **Cache:** effective-permission cache TTL is 30 s (`permissions.ts:8`).
  `invalidatePermissionCache()` is called on grant changes; migration should
  invalidate (or accept ≤30 s propagation).
- **Deployment status as of this writing:** Phases 1-4 are implemented and
  verified on the **local** dev environment only. **Production
  (`68.178.164.38:8080`) is still running the code deployed for Phase 1/2** —
  it has NOT received Phase 3/4. Per the rollout rule above, do not deploy
  Phase 3/4 to production without re-running `npm run gate:ticket-grants:prod`
  there first (it was GREEN under Phase 1/2's code; must be re-confirmed GREEN
  immediately before the Phase 3/4 deploy too, since grants could have changed
  via Access Control in the interim).

## 5. Open items — resolution status
1. ~~Duplicate Audit module in the matrix~~ **Resolved (Phase 1):** folded the
   audit ticket keys into the existing Audit module as a "Workflow Tickets" row
   via `extraTabsByModule`. Verified via Playwright — exactly one "Audit" group
   renders.
2. ~~Seed strategy for install-specific type ids~~ **Resolved (Phase 4):**
   moved out of `seed.ts` entirely into a boot-time reconciler
   (`ensureSystemRoleTicketGrants` in `rbac-system-role-tickets.ts`) that
   resolves current type ids at every boot rather than at seed time — handles
   fresh installs AND any workflow type created later via any path (UI or
   auxiliary seed scripts), which a seed-time-only approach could not.
3. ~~Whether to keep `TicketTypeScope.all`~~ **Resolved:** kept in the type,
   hard-falsed (smaller diff) — `ticket.service.ts`'s dead `if (!scope.all)`
   conditional was removed for clarity since the guard was always true, but the
   field itself stays for signature stability.
4. ~~Confirm `rbac-sync` prunes orphaned `TICKET`-module catalog rows + grants~~
   **Resolved:** it did not before Phase 4 (only `wf_type.*` orphans were
   pruned) — added `pruneRetiredTicketMasterKeys()` specifically for this.
   Verified: 5 → 0 `TICKET`-module rows after boot, cascading grant removal
   confirmed via unchanged `wf_type.*` sets (only `ticket.*` rows dropped).
5. **New, found during Phase 3 verification:** the SUPER_ADMIN
   effective-permission bypass never included dynamically-generated `wf_type.*`
   keys (pre-existing bug, masked by the OR-bridge). **Resolved** — see the bug
   writeup under Phase 3 above.

---

*Per project rule, implementation is tree-only — no commits/pushes without
explicit instruction.*
