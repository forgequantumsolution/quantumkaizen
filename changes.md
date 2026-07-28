# Changes — KPI card icon sizing across all dashboards

Reported: KPI tile icons "not the correct size or aligned properly in all the
dashboards" (raised against the LIMS Overview *Key Metrics* strip, but the same
tiles appear on every dashboard).

> Status: **Implemented + verified with Playwright.** Working tree only, not
> committed. One file changed.

## Diagnosis (Playwright)

Screenshotted every dashboard — Quality Command Center, DMS, LIMS, Audit, Risk,
Risk Controls/Reviews, Tickets and all 12 `/modules/:id` pages — at 1600px and
900px, then measured the DOM boxes rather than eyeballing.

Two findings, only the second of which was the real bug:

- **Alignment was never broken.** Every chip measured 36×36 with the icon
  centred to the pixel (9px on all sides), identical on every dashboard, because
  they all render the one shared `KpiCard`. Nothing was misaligned.
- **The icons looked undersized because they were.** Lucide glyphs carry their
  own whitespace inside a fixed 24×24 grid, and the fill varies a lot per glyph
  — measured via `getBBox()`: `Percent` filled ~44% of its box, `AlertTriangle`
  ~63%, `FlaskConical` 83% tall but only 61% wide. At an 18px render inside a
  36px chip, the sparse glyphs read as floating in empty space next to the
  denser ones, which is what made the row look inconsistent.

## Fix

`client/src/components/ui/KpiCard.tsx` — the icon chip: **36×36 → 44×44**, icon
**18px → 24px** (`strokeWidth` unchanged at 2).

Note the chip grew too. Scaling only the icon scales the glyph's built-in
whitespace along with it, so it never actually closes the gap; and pushing the
icon to the chip's own size makes the glyph visually spill past the tinted
background instead. Growing both lands the icon at a substantial size *and*
keeps an even 10px of tint around it.

Single shared component, so every dashboard picked this up — no per-page edits.

## Verification

Re-screenshotted at 4× device scale and re-measured: chip 44×44, icon 24×24,
10px margin on all four sides. Checked both card variants (plain, and with the
footer/subtitle row as on Risk Controls) plus Tickets — no clipping against the
rounded corners in any of them.

---

# Changes — Per-module ticket master (retire the global switch)

Follow-on to *Per-Workflow-Type Access Control* (below). Goal: retire the single
global **"All Workflow Types (ticket master)"** switch so ticket access is
controlled **strictly per module**. Rolled out in phases so no one loses access.

> Status: **Phases 1–4 implemented + verified end-to-end** on local `kaizen_qms`
> (Playwright through the live app + direct API calls). Production
> (`68.178.164.38:8080`) has only Phase 1–2 deployed so far; its gate was
> GREEN under that code but has NOT been re-checked for a Phase 3/4 deploy.
> **Not committed** — working tree only. Full plan + rollout/rollback:
> `docs/per-module-ticket-master-plan.md`.

## Phase 1 — Audit now gets per-type ticket keys (supersedes "Audit excluded")

The earlier feature deliberately excluded Audit from per-type keys. Reversed: the
Audit workflow type now generates `wf_type.<auditId>.*` keys like every other
type, so audit tickets keep working once the master is removed.

- `backend/src/lib/rbac-workflow-types.ts` — dropped the `isAuditTypeName`
  early-returns in `ensureWorkflowTypePermissions`,
  `grantWorkflowTypePermissionsToSuperAdmin`, and the filter in
  `syncWorkflowTypePermissions`. `isAuditTypeName` kept for non-ticket callers.
- `client/src/features/admin/access-control/AccessMatrix.tsx` — new
  `extraTabsByModule` prop folds extra tabs into an existing module.
- `client/src/features/admin/access-control/AccessControlTab.tsx` —
  `useAuditTicketTabs()` surfaces the audit keys as a **"Workflow Tickets"** row
  **inside the existing Audit module** (avoids a duplicate "Audit" group).
- Verified: boot backfills the 5 audit keys + grants SUPER_ADMIN; the row renders.

## Phase 2 — Backfill existing grants (so removing the master won't lock anyone out)

`backend/src/lib/rbac-ticket-migration.ts` **(new)** —
`backfillPerTypeTicketGrants()` mirrors every `ticket.<verb>` grant onto
`wf_type.<id>.<verb>` for every type, across roles, departments and user
overrides (replicates GRANT **and** DENY; never clobbers an existing per-type
override). Idempotent + self-terminating (no-op once `ticket.*` is removed in
Phase 4). Wired into `backend/src/lib/rbac-sync.ts` at boot, after
`syncWorkflowTypePermissions()`.

- Verified on local DB (6 types): every role holding `ticket.<verb>` went 0/6 →
  6/6; department + GRANT/DENY-override + non-clobber paths proven with a
  self-cleaning test.
- `seed.ts` + `ticket.*` catalog removal deliberately **deferred to Phase 4**; the
  master is kept live so Phase 2 stays purely additive.

## Phase 2 → 3 GO/NO-GO gate

`backend/src/scripts/check-ticket-grants.ts` **(new)** + `npm run gate:ticket-grants`
(`backend/package.json`). Exits **0 = GREEN** (safe to ship Phase 3) / **1 = RED**
(prints each gap). Needed because the boot backfill is fire-and-forget
(`backend/src/index.ts:13`), so "server up" ≠ "grants migrated". Run it, and be
GREEN, on **each** environment before Phase 3 lands there. Verified GREEN/RED +
exit codes locally.

**Rollout:** ship Phase 1+2 → boot → gate GREEN per environment → then ship Phase
3+4 as a **separate** release (backfill is idempotent, so no boot-window race).
Startup left non-blocking by design.

## Phase 3 — Flip enforcement to strictly per-module

`backend/src/middleware/permissions.ts`: `hasTicketAction` / `requireTicketAction`
dropped the global `ticket.<action>` fast-path — only the per-type
`wf_type.<id>.<action>` key grants a ticket action now. `ticketReadScope` always
returns `all: false`. Forbid messages name the specific missing key.
`ticket.service.ts`'s default scope hard-falsed (no fail-open default).

**Bug found + fixed during verification (pre-existing, not a regression):**
`effective-permissions.ts`'s SUPER_ADMIN bypass read a **static** catalog list
that never included the dynamically-generated `wf_type.*` keys — invisible
before because the old OR-bridge's `ticket.*` fast path always covered
SUPER_ADMIN regardless. Once the OR-bridge and `ticket.*` were removed,
SUPER_ADMIN's bypassed permission set granted no ticket action at all. A live
Playwright run against a freshly-restarted backend caught it (Raise Ticket
button vanished for SUPER_ADMIN). Fixed by reading `user.role.permissions` (the
actual DB relation, guaranteed complete by `rbac-sync.ts`'s invariant) instead
of the static list. Verified via direct API calls post-fix.

## Phase 4 — Remove the master from UI + catalog

- `client/src/lib/navAccess.ts` — deleted the master module block; added
  `wfTypeCreateKey`/`UpdateKey`/`DeleteKey`/`TransitionKey` helpers.
- `client/src/components/layout/Sidebar.tsx`,
  `client/src/features/audit/AuditModuleLayout.tsx`,
  `client/src/features/audit/capa/CapaWorkflowBand.tsx`,
  `client/src/features/tickets/TicketsPage.tsx` — all switched from the global
  `ticket.*` fallback to per-type keys (new `useHasAnyPermissionMatching`
  selector in `authStore.ts` for the "any type" button-visibility cases).
- `backend/src/lib/rbac-catalog.ts` — removed the 5 `ticket.*` rows.
- `backend/src/lib/rbac-sync.ts` — new `pruneRetiredTicketMasterKeys()` (the
  catalog upsert never deleted orphaned rows on its own); new fresh-install
  safety net `ensureSystemRoleTicketGrants()` (`rbac-system-role-tickets.ts`,
  new) for environments seeded after Phase 4 that never held `ticket.*` to
  mirror from — scoped to only touch a system role with zero `wf_type.*`
  grants, so admin customizations are never overwritten; new boot-time
  observability warning via `findUnmigratedTicketGrants()` (shared with the
  gate script).
- `prisma/seed.ts` — removed the literal `ticket.*` strings; documented the new
  reconciler as the source of fresh-install ticket access.

**Verification:** full Playwright pass (9/9) — master module gone from the
matrix, per-type rows unchanged (regression check), SUPER_ADMIN's Raise Ticket
button visible, DOCUMENT_CONTROLLER's hidden (no create grant anywhere). Direct
API calls: 403 naming the exact missing key for a restricted role; 201 create +
cleanup for SUPER_ADMIN. `gate:ticket-grants` GREEN with an updated
"nothing to gate" message; `pruneRetiredTicketMasterKeys` and
`ensureSystemRoleTicketGrants` both proven via targeted before/after tests.

**Methodology note:** the local dev backend was found to be a stale,
non-watching `tsx src/index.ts` process (started before this session's edits) —
restarted via `npm run dev` (`tsx watch`) before Phase 3 verification, which is
what surfaced the SUPER_ADMIN bug above. Earlier phases' checks had passed
against that same stale process because they only exercised unmodified
DB-reading endpoints.

---
---

# Changes — Per-Workflow-Type Access Control

Each workflow type (CAPA, Deviation, Complaints, …) now gets its **own switch** in
Access Control, instead of a single shared `ticket.*` key gating every type at
once. The switch genuinely enforces: the ticket API and the sidebar are gated
per type. Also fixes two bugs that prevented granted access from showing up.

> Status: implemented + verified end-to-end with Playwright. **Not committed** —
> all changes are in the working tree.

---

## 1. Design decisions

- **Key scheme** — each workflow type gets 5 permission keys, keyed on its stable
  id so renames never break grants:
  `wf_type.<typeId>.{read,create,update,delete,transition}` (module `WF_TYPE`).
- **OR-bridge (backward compatible)** — a ticket action is allowed if the user
  holds **either** the per-type key **or** the global `ticket.<action>` master
  key. The global key acts as an **"All Workflow Types"** master, so no existing
  role loses access on deploy. To restrict a role, don't grant it the global key
  and grant only the per-type switches you want.
- **Audit excluded** — Audit keeps its own `audit_*` permission model and bespoke
  sidebar/matrix treatment; it does not get generated per-type keys.

---

## 2. Backend changes

| File | Change |
|------|--------|
| `backend/src/lib/rbac-workflow-types.ts` **(new)** | Per-type key generation, SUPER_ADMIN grant, hard-delete cleanup, and a startup `syncWorkflowTypePermissions()` that backfills existing types and prunes orphans. Audit is skipped. |
| `backend/src/lib/rbac-sync.ts` | Calls `syncWorkflowTypePermissions()` on startup, before the SUPER_ADMIN "hold everything" step, so the invariant covers the dynamic keys. |
| `backend/src/modules/workflow/lookups/lookups.service.ts` | Creating / reviving a workflow type provisions its keys + grants SUPER_ADMIN + invalidates the permission cache. Hard-delete removes its keys (soft-delete keeps them so a restore is seamless). |
| `backend/src/middleware/permissions.ts` | New `requireTicketAction(action, from)` guard (per-type OR global), `requireTicketListAccess`, `ticketReadScope()` helper, and exported cached `getEffectivePermissionKeys`. |
| `backend/src/modules/ticket/ticket.routes.ts` | All 19 ticket routes swapped from the flat `requirePermission('ticket.*')` to the per-type guards. |
| `backend/src/modules/ticket/ticket.controller.ts` | List controller computes the caller's readable-type scope and passes it to the service. |
| `backend/src/modules/ticket/ticket.service.ts` | `list()` scopes results to the readable workflow types (unless the user holds the global master); ticket detail now exposes `workflow.typeId`. |
| `backend/src/modules/stage-form/stage-form.routes.ts` | The two per-ticket `ticket.read` gates swapped to the per-type guard (closes a cross-type read leak). |
| `backend/src/modules/workflow/lookups/lookups.routes.ts` | **Bug fix:** `GET /types` no longer requires `workflow.lookups.read` — the type list is navigation metadata every user needs to render their modules. Create/delete still require `workflow.lookups.manage`. |

---

## 3. Frontend changes

| File | Change |
|------|--------|
| `client/src/lib/navAccess.ts` | Per-type module helpers (`workflowTypeModule`, `wfTypeReadKey`, `isAuditWorkflowTypeName`). Moved the global `ticket` master out of the Audit module into its own top-level module **"All Workflow Types (ticket master)"** with an explanatory description. |
| `client/src/features/admin/access-control/AccessMatrix.tsx` | New `extraModules` prop — the matrix now renders the static `NAV_ACCESS` list **plus** one dynamic module per workflow type. |
| `client/src/features/admin/access-control/AccessControlTab.tsx` | Builds the per-type modules from the workflow-types list and passes them to the Role / Department / User matrices. |
| `client/src/components/layout/Sidebar.tsx` | Workflow-type modules gate on `wf_type.<id>.read` **OR** `ticket.read` (new `anyPermission` support in the nav gate). |
| `client/src/features/modules/ModulePage.tsx` | Create / Delete / workspace-viewer buttons gate per-type (OR global). |
| `client/src/features/tickets/TicketDetailPage.tsx` | Transition / Update / Delete gate per-type using the ticket's workflow type (OR global). |
| `client/src/lib/api/ticket.ts` | `TicketDetail.flows[].workflow` now includes `typeId`. |
| `client/src/App.tsx` | **Bug fix:** on every page load, reconcile permissions with the server via `/auth/me`. Previously a browser refresh only re-read the cached permissions, so access granted/revoked in Access Control didn't show until a full re-login. |

---

## 4. Bugs found & fixed during testing

1. **Granted access didn't appear until re-login.** The app never re-fetched
   permissions on a browser refresh — it rehydrated the persisted copy from the
   last login. Fixed by refreshing from `/auth/me` on app bootstrap
   (`client/src/App.tsx`).

2. **A user could see *no* workflow modules at all** (e.g. the auditor showed only
   "Configuration"). The sidebar builds every workflow module from
   `GET /api/workflow-lookups/types`, which required the Configuration-admin
   permission `workflow.lookups.read`. Users without it got a 403, wiping the
   entire DB-driven sidebar. Fixed by making the type **list** readable by any
   authenticated user (`backend/src/modules/workflow/lookups/lookups.routes.ts`).

---

## 5. Testing

- `tests/e2e/workflow-type-access.spec.ts` **(new)** — Playwright e2e proving:
  1. creating a type generates its 5 per-type keys in the catalog;
  2. the keys are granted to SUPER_ADMIN;
  3. the ticket-list guard enforces per-type read (403 without any read, 200 with
     the per-type read alone — the OR-bridge);
  4. the type shows as its own module in the Access matrix (UI);
  5. hard-deleting the type prunes its keys.
- Backend and frontend both typecheck clean (`tsc --noEmit`).
- All 5 spec tests pass against the live dev servers (API :4000, app :5173).

---

## 6. How to use / operational notes

- **New workflow types** get their switch immediately. **Existing types** get
  their keys on the next backend restart (the startup backfill) — already picked
  up here via `tsx watch`.
- **After deploy**, users who were already logged in should log out/in once so
  their cached permissions reseed with the app-bootstrap refresh in place.
- **To restrict a role to specific modules:** in Access Control, untick
  **"All Workflow Types (ticket master)" → Read** for that role, then tick only
  the per-type switches you want, and Save.
- Two spots still gate on the global `ticket.*` key (the global `/tickets` page
  buttons and the CAPA band) — harmless, since the API enforces per-type
  regardless; can be made per-type later if desired.

---
---

# Changes — Site-scoped data + navbar Site selector

Every user and ticket now belongs to a **Site** (organization / location). A
navbar Site selector filters ticket data to the active site, and the API
**hard-enforces** that a user only ever sees their own site's tickets (admins
with `site.view_all` see across sites). Reuses the existing `Site` model as-is
(no rename); existing data is backfilled to a default **Headquarters (HQ)** site.

> Status: implemented + verified live (curl) with backend + frontend typecheck
> clean. **Not committed** — all changes are in the working tree. See also
> `docs/site-scoping-plan.md` for the design + the side-effect audit.

## Design decisions

- **Reuse `Site`** (already FK'd to `User.siteId` + `Ticket.siteId`, indexed) —
  no rename, no relation migration. UI labels it "Site".
- **Hard, server-enforced scope** — the navbar selection can never *widen*
  access; it only narrows within the caller's allowed sites.
- **Backfill to HQ** — every pre-existing user + ticket is attached to HQ so
  nothing is orphaned when enforcement turns on (all existing data stays visible
  because it's all HQ; scoping only bites once a second site exists).

## Backend

| File | Change |
|------|--------|
| `backend/src/lib/site-defaults.ts` **(new)** | `ensureDefaultSite()` (find-or-create HQ, cached) + `ensureDefaultSiteAndBackfill()` (sets `siteId = HQ` on every NULL-site user + ticket). Idempotent. |
| `backend/src/index.ts` | Runs `ensureDefaultSiteAndBackfill()` on startup (non-fatal), alongside the RBAC sync. |
| `backend/src/modules/workflow/engine/orchestrator.ts` | **Linchpin fix:** `raiseTicket` never creates a site-less ticket — resolves `siteId` as explicit → parent ticket's site → actor's site → HQ. Covers CAPA/OOS/audit spawns that pass no site. |
| `backend/src/lib/rbac-catalog.ts` | New `site.view_all` permission (module `SITE`, action `MANAGE`). QMS_ADMIN + SUPER_ADMIN get it automatically; READ_ONLY does not (stays scoped). |
| `backend/src/middleware/permissions.ts` | `SiteScope`, `resolveSiteScope(userId)` (viewAll → all, else the user's own site), `siteFilterFor(scope, requested)` (intersect; requested-out-of-scope is ignored — the hard boundary), `canUseSite(scope, siteId)`, `SITE_VIEW_ALL`. |
| `backend/src/modules/ticket/ticket.schema.ts` | List query accepts optional `siteId` (navbar selection). |
| `backend/src/modules/ticket/ticket.controller.ts` | `list` resolves the caller's site scope + requested site; `create`/`patch` reject a `siteId` outside scope; `get` returns **404** if the ticket's site is outside the caller's scope (no existence leak). |
| `backend/src/modules/ticket/ticket.service.ts` | `list()` applies `siteFilterFor` to `where.siteId`, composed with the existing type-scope/`mine`/search clauses. |
| `backend/src/modules/auth/auth.service.ts` | `/auth/me` (+ login) now returns `site {id,code,name}` and `allowedSites` (all active sites if `site.view_all`, else the user's own). |

## Frontend

| File | Change |
|------|--------|
| `client/src/stores/siteStore.ts` **(new)** | Persisted active-site store (`selectedSiteId \| null`; `null` = "All Sites"). |
| `client/src/components/layout/Header.tsx` | `SiteSelector` next to the FY selector: static label for single-site users, dropdown with "All Sites" for `site.view_all`. Self-reconciles a stale/persisted selection against the user's allowed sites. |
| `client/src/lib/api/ticket.ts` | `useTickets` auto-injects the active site as `?siteId=` and into the query key (switching site refetches). |
| `client/src/stores/authStore.ts` | New `SiteRef`; maps `site` + `allowedSites` from `/me` (previously `site` was hard-coded `undefined`). |
| `client/src/features/admin/users/UsersTab.tsx` | Site picker under the "Organization" heading + inline **"+ add site"** (POST `/sites`, then selects it). |
| `client/src/features/tickets/shared/RaiseTicketDrawer.tsx` | New tickets default their `siteId` to the navbar's active site. |

## Verification (live, curl)

- Users split HQ (5) / PUNE (2). Auditor (PUNE, no `view_all`) → ticket + people
  lists scoped to PUNE; super-admin (`view_all`) → everything.
- A forged `?siteId=<other-site>` for a scoped user does **not** widen results.
- `site.view_all` auto-granted to SUPER_ADMIN via the ALL_KEYS bypass.

## Operational notes

- Ship the HQ backfill before enforcement (already wired into startup).
- On an already-seeded live DB, QMS_ADMIN does **not** retroactively receive
  `site.view_all` (startup only re-grants SUPER_ADMIN) — grant it via the
  access-control UI or a re-seed. Since all existing data is HQ, nobody loses
  access in the meantime.
- Label is "Site"; switching it to "Organization" later is a one-line change.

---
---

# Changes — Operational-access fixes (metadata / picker endpoints)

Site scoping + the per-workflow-type model exposed a recurring bug class:
**operational forms were blank because the list endpoints that feed their
pickers were gated behind Configuration-admin permissions** the operational role
doesn't have. A role granted *only* per-type ticket access (the whole point of
that feature), or the AUDITOR role, hit **403s** loading workflows, users,
priorities, departments, etc. — so the pickers rendered empty.

Fix philosophy (matching the earlier `/workflow-lookups/types` relaxation):
**reference / pick-list metadata is readable by any authenticated user; the
actual protected records and all mutations stay gated.** Where a list carried
more than a picker needs, a dedicated lightweight **directory** endpoint was
added instead of relaxing the rich admin list.

> Status: implemented + verified live (curl, as the AUDITOR account) with
> backend + frontend typecheck clean. **Not committed.**

## New directory endpoints (any authenticated user)

| Endpoint | Returns | Notes |
|----------|---------|-------|
| `GET /users/directory` | `id, name, email, designation, employeeId, roleId, departmentId, siteId` + nested `role/department/site` | **Site-scoped** (mirrors ticket scoping): a scoped user only sees colleagues in their own site; `site.view_all` sees all. Placed before `/:id`. |
| `GET /roles/directory` | `id, name, isSystem, _count.users` | No permission keys. Placed before `/:id`. |
| `GET /workflows/directory` | ACTIVE, latest-version workflows: `id, name, version, workflowStatus, type` | Optional `?typeId=`. Full definitions stay behind `workflow.read` on `/:id`. |

## Relaxed GET guards (mutations still gated)

| Endpoint(s) | Was | Now |
|-------------|-----|-----|
| `/workflow-lookups/{priorities,severities,stage-statuses,action-types,action-criteria}` | `workflow.lookups.read` | any authenticated user |
| `/departments`, `/departments/tree` | `department.read` | any authenticated user (detail `/:id` + mutations stay gated) |

(The `/workflow-lookups/types` GET was already relaxed in the per-type work.)

## Backend files

| File | Change |
|------|--------|
| `backend/src/modules/user/user.{routes,controller,service}.ts` | New `directory` — site-scoped, enriched select (email/role/department/site). |
| `backend/src/modules/role/role.{routes,controller,service}.ts` | New `directory` — id/name/isSystem/user-count. |
| `backend/src/modules/workflow/workflow.{routes,controller,service}.ts` | New `directory` — ACTIVE latest-version workflows, optional `typeId`. |
| `backend/src/modules/workflow/lookups/lookups.routes.ts` | Dropped `workflow.lookups.read` from the 5 lookup GET lists. |
| `backend/src/modules/department/department.routes.ts` | Dropped `department.read` from `/` and `/tree`. |

## Frontend files

| File | Change |
|------|--------|
| `client/src/features/admin/users/hooks.ts` | `useUserDirectory()` + enriched `DirectoryUser` type. |
| `client/src/features/admin/roles/hooks.ts` | `useRoleDirectory()` + `RoleDirectoryEntry` type. |
| `client/src/lib/api/workflow.ts` | `useWorkflowDirectory(typeId?)` + `WorkflowDirectoryEntry` type. |
| **Audit** — `AuditRegisterFormPage`, `ActionItemsPage`, `AuditSchedulePage`, `CapaDetailPage`, `CapaListPage` | People picker → `useUserDirectory`; workflow picker → `useWorkflowDirectory`. |
| **Tickets** — `shared/RaiseTicketDrawer`, `modules/ModulePage`, `TicketsPage` | Workflow picker/filter → `useWorkflowDirectory` (priorities/severities/departments unblocked by the relaxations). |
| **DMS** — `DocumentEditorPage`, `AcknowledgementPanel` | People picker → `useUserDirectory`. |
| **Training** — `TrainingDetailPage`, `TrainingListPage` | People + role pickers → `useUserDirectory` / `useRoleDirectory`. |
| **LMS** — `AssignmentsPage`, `ReportsPage`, `TrainingMatrixPage` | People + role pickers → directories (`AssignmentsPage` uses the enriched user directory for its role/dept/site filtering + `_count.users`). |

## Bugs this resolved (as reported, in order)

1. **Audit initiator form — empty Lead Auditor / Approver / Team Members.** The
   AUDITOR role lacks `user.read`, so `GET /users` 403'd. Added the site-scoped
   `/users/directory` and pointed the audit-module people pickers at it.
2. **Directory showed *all* users regardless of the logged-in user's site.**
   Made `/users/directory` site-scoped via `resolveSiteScope` (auditor on PUNE →
   only PUNE users; `view_all` → all).
3. **Empty "Audit Workflow" dropdown** (`Missing required permission:
   workflow.read`). Added `/workflows/directory` and switched the operational
   workflow pickers (audit form + schedule, ticket drawer, module, tickets page).
4. **Broad sweep** — same class across DMS/LMS/Training user & role pickers, plus
   ticket-raising priorities/severities/departments. Fixed via the role/user
   directories + the lookup/department GET relaxations.

## Verification (live, curl as AUDITOR)

All previously-403 endpoints now return **200**: `/workflows/directory` (8),
`/roles/directory` (6), `/users/directory` (2 — PUNE-scoped, enriched),
`/workflow-lookups/{priorities,severities,stage-statuses,action-types}`,
`/departments`, `/departments/tree`.

## Net security posture

- **Readable by any authenticated user:** workflow types + workflow names
  (directory), priorities/severities/stage-statuses/action-types/action-criteria,
  department list/tree, role directory (name + count), user directory
  (**site-scoped**; includes email + role/department/site).
- **Still gated:** tickets (site + per-type scoped), full workflow definitions
  (`workflow.read` on `/:id`), user admin (`/users`, `user.read`), role admin
  with permission keys (`/roles`, `role.read`), department detail, and every
  create / update / delete.
- **Flag:** the user directory exposes colleagues' **email** to any authenticated
  user within their site — normal for an internal QMS staff picker, but trivially
  removable if undesired.

---
---

# Changes — Facilities (Sites) as a Configuration module in Access Control

**Facilities / Sites** is now a first-class, permission-gated module in Access
Control (Configuration → Facilities), instead of an always-on tab backed by
borrowed `org.*` keys. Managing facilities is gated by granular `site.*` CRUD
keys; the list stays broadly readable so the operational site pickers keep working.

> Status: implemented + verified end-to-end with Playwright (5/5). Backend +
> frontend typecheck clean. **Not committed** — all changes are in the working tree.

## Design decisions

- **Granular `site.*` keys** (`site.read/create/update/delete`, module `SITE`) live
  under the **same `site.` prefix** as the existing `site.view_all`, so the Access
  Matrix buckets them into **one "Facilities" row** (View/Create/Edit/Delete, with
  `site.view_all` overflowing to the "More" popover).
- **Non-breaking list access** — the sites **list/detail** is served both to admins
  (`site.read`) and to operational pickers that only hold the broader `org.read`
  (ticket site selector, LMS targeting). A new `requireAnyPermission(...)` OR-guard
  keeps both audiences working **with no re-seed and no regression**; only the
  writes moved to the granular keys.

## Backend

| File | Change |
|------|--------|
| `backend/src/lib/rbac-catalog.ts` | New `site.read/create/update/delete` (module `SITE`), alongside `site.view_all`. QMS_ADMIN gets them via its module filter; SUPER_ADMIN via the rbac-sync invariant. |
| `backend/src/middleware/permissions.ts` | New `requireAnyPermission(...anyOf)` guard — passes when the user holds **any** of the given keys. |
| `backend/src/modules/site/site.routes.ts` | List/detail → `requireAnyPermission('site.read','org.read')`; `POST/PATCH/DELETE` → `site.create/update/delete` (was `org.read`/`org.update` throughout). |
| `backend/prisma/seed.ts` | Granted `site.read` to the operational roles that already hold `department.read` (QUALITY_ENGINEER, AUDITOR, DOCUMENT_CONTROLLER). |

## Frontend

| File | Change |
|------|--------|
| `client/src/lib/navAccess.ts` | Added a **Facilities** tab to the **Configuration** module (entity `site`, gate `site.read`) — renders in the Access Matrix with the standard action columns. |
| `client/src/pages/SettingsPage.tsx` | The Facilities settings tab is now gated on `site.read` (was `permission: undefined` = always shown). |
| `client/src/features/admin/sites/SitesTab.tsx` | Create/Update/Delete buttons gate on `site.create/update/delete` (was `org.update` for all three). |

## Testing

- `tests/e2e/site-access.spec.ts` **(new)** — Playwright e2e, **5/5 passing**:
  1. catalog exposes the granular `site.*` keys with the right module/action;
  2. SUPER_ADMIN holds every `site.*` key and can list facilities;
  3. write guards — full CRUD lifecycle on a throwaway site (201 → 200 → 204 → 404);
  4. **non-breaking** — DOCUMENT_CONTROLLER (holds `org.read`, not `site.create`)
     lists sites **200** via the OR-fallback but is **403** on create;
  5. UI — the Facilities row renders in the Access Matrix and the gated Facilities
     tab is reachable by a `site.read` holder.
- Idempotent (throwaway site with a PID-derived code, deleted in `finally`).

## Operational notes

- On an already-seeded live DB the new keys reach the catalog at startup
  (`ensureRbacCatalog`) and are granted to **SUPER_ADMIN** immediately. **QMS_ADMIN
  and the operational roles** get `site.read` on the next `prisma db seed`; until
  then only SUPER_ADMIN sees the Facilities *tab*, but the sites **list API already
  works for everyone** (via the `org.read` fallback), so no picker breaks.

---
---

# Changes — Sidebar "Configuration" hidden for roles with no config access

**Bug (reported):** an AUDITOR with **no** configuration permissions still saw the
**Configuration** group in the sidebar.

**Root cause:** the Configuration parent had no gate of its own — it relied on its
children — but two children, **"Master Data"** and **"Appearance"**, had *no
permission* set, so they always survived the gate and kept the group visible for
every role. (The header's "Profile & Preferences" button is a dead no-op, so those
were the only home for personal settings.)

**Fix:** mirror the existing "LIMS Configuration" pattern (which gates its parent) —

| File | Change |
|------|--------|
| `client/src/components/layout/Sidebar.tsx` | The **Configuration** parent now carries `anyPermission` = the union of its config keys (`workflow.read`, `form.read`, `user.read`, `role.read`, `department.read`, `site.read`, `workflow.lookups.read`) → the whole group hides when the user holds none. The **Master Data** child gates on the admin-tab keys (`user/role/department/site.read`, `workflow.lookups.read`) so it isn't shown to a workflow-only user. |

## Testing

- `tests/e2e/sidebar-config-access.spec.ts` **(new)** — Playwright e2e (passing):
  a real browser login shows Configuration → deny every config key (user override)
  → **Configuration disappears** → restore → it comes back. Idempotent (overrides
  cleared in `finally`).
- Cross-checked against **live role data**: AUDITOR → hidden; every role holding ≥1
  config key (DOCUMENT_CONTROLLER, QMS_ADMIN, QUALITY_ENGINEER, READ_ONLY,
  SUPER_ADMIN) → shown. Frontend typecheck clean.

## Consequence to note

For a role with **no** config keys, "Appearance" (theme) and the always-on personal
tabs (Notifications / Security / Org Profile) are now hidden too, since they were
only reachable via this group. If theming should stay universal, relocate
"Appearance" out of Configuration — e.g. wire the currently-dead **"Profile &
Preferences"** header button to `/appearance`. (Not done — flagged for a decision.)

## Audit "perform audit" — next checklist now auto-advances on submit

**Bug (reported):** in the audit *perform* flow, submitting one stage-form
checklist did not surface the next checklist — it stayed on the just-completed
(now read-only) form until a manual page refresh.

**Root cause:** the checklist data *did* refresh (the submit mutation invalidates
the ticket stage-forms query, so chips + progress bar update instantly). The
problem was **which** checklist stayed active. The auto-select effect in
`client/src/features/tickets/detail/StageFormSection.tsx` only picks the first
pending checklist when `activeBindingId` is empty or points at a binding that no
longer exists. After submit, `activeBindingId` still pointed at the just-submitted
binding — which is still in the list, just now `SUBMITTED` — so the effect
early-returned and never advanced. A refresh remounts the component with a null
`activeBindingId`, so it then correctly jumped to the first pending checklist.

**Fix:** `StageFormSection` now passes an `onSubmitted` handler to `FormFillEmbed`.
On a successful `SUBMITTED`, it advances `activeBindingId` to the next
non-submitted checklist (computed from current order, excluding the one just
submitted; stays put if none remain). Draft saves (`IN_PROGRESS`) are ignored.

- An effect-based alternative (advance whenever the active binding is `SUBMITTED`)
  was rejected: it can't distinguish *just submitted* from *clicked a green chip to
  review*, so it would block reviewing completed checklists. `onSubmitted` only
  fires on an actual submit, preserving manual review.
- Advances before the refetch lands (by design); no race — when the refetch lands,
  `activeBindingId` already points at the next binding, so the effect early-returns.

| File | Change |
|------|--------|
| `client/src/features/tickets/detail/StageFormSection.tsx` | Added `onSubmitted` to the embedded `FormFillEmbed`; on `SUBMITTED` it selects the next non-submitted binding. |

Frontend typecheck clean. Not yet verified live in-app (submit checklist #1 → #2 should appear without refresh).
