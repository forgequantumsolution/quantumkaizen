# Access-control data scoping — workflows, users & roles

**Status:** PLAN — not yet implemented
**Date:** 2026-07-12
**Follows:** `docs/per-module-ticket-master-plan.md` (per-module ticket access, Phases 1–4, complete locally)

---

## Goal

The per-module access-control work made **ticket lists** and **module (sidebar)
visibility** obey each user's per-workflow-type grants (`wf_type.<typeId>.*`).
But the *surrounding* list/dropdown data never got the same treatment, so the UI
leaks and mis-offers data the access-control matrix says a user shouldn't touch:

- **Workflows** (builder list AND the raise-ticket picker) show every workflow of
  every type, regardless of which types the user can access.
- **Workflow-type dropdowns** (filters, create-workflow modal) list every type.
- **People pickers** (CAPA owner, assignee, participant, approver) show every
  active user, filtered by site only — not by who can actually work that module.
- **Role pickers** show every role, filtered by nothing at all.

This plan scopes those surfaces to match the access model, so what a user sees to
*pick from* lines up with what the matrix already governs.

> **Follow-up that emerged mid-build (2026-07-12):** the user decided workflows
> should additionally be **owned by a site** (site-scoped users' workflows belong to
> their site; Super Admin can create global or site-pinned ones). That is a schema
> change and is planned separately in **`docs/workflow-site-ownership-plan.md`** —
> it layers on top of Phase 1's type-scoping, and subsumes the role-picker item
> here (roles/users inside a workflow get scoped by the workflow's site).

## Grounding — what's already shipped (verified against docs + changes.md)

This is **not** greenfield. Three prior efforts set the stage, and this plan must
extend them without regressing them:

1. **`docs/ACCESS-CONTROL-enhancement-plan.md` §11 explicitly deferred exactly
   this.** That plan built the permission (verb) model and states row-level data
   filtering is *"Explicitly out of scope — this is permission access, not record
   filtering. Noted for a separate future plan."* **This document is that deferred
   follow-up.** No conflict — it's the sanctioned next layer.

2. **Site scoping is live** (`docs/site-scoping-plan.md`). `resolveSiteScope`,
   `siteFilterFor`, and the `site.view_all` key exist and already scope tickets +
   the user directory. This plan **reuses** that machinery for roles.

3. **⚠️ The "Operational-access fixes" already built the directories AND migrated
   every picker** (root `changes.md`, "Operational-access fixes / picker
   endpoints"). Specifically, already DONE:
   - `GET /users/directory` exists and is **already site-scoped** (an AUDITOR on
     PUNE sees only PUNE users; `site.view_all` sees all).
   - `GET /roles/directory` and `GET /workflows/directory` exist (the latter
     already takes an optional `?typeId=`), both currently **unscoped**.
   - **Every people/workflow picker is already pointed at these directories** —
     audit, CAPA, DMS, LMS, training, ticket drawer. The frontend migration this
     plan needs is therefore *already done*; the only FE work left is **passing a
     `typeId`** into the already-wired hooks (plus one stale-code cleanup).
   - That effort's whole purpose was to **stop operational roles hitting 403s and
     seeing blank pickers.** It deliberately made these lists broadly *readable*.

   **What that leaves for THIS plan** is purely the *row-filtering* axis on top of
   the existing readability: add type-scope to workflows + people, add site-scope
   to roles. But see the **re-empty risk** below — tightening the people picker can
   undo bug #1 that effort fixed.

## Decisions locked (from the user)

1. **People picker → type-access AND site.** A workflow/ticket people-picker
   shows only users who **both** (a) have access to that workflow type and (b)
   are in a site the caller may see.
   - *Scope note:* this rule applies only to **workflow/ticket-driven** pickers
     (CAPA, audit, deviation, …). The same `useUserDirectory` hook also feeds
     **LMS training-assignment** and **DMS acknowledgement** pickers, which have
     no workflow-type context — those keep their current **site-only** scoping.
     Mechanism: type filter engages only when the caller passes a `typeId`.

2. **Workflow lists → scope both.** Both the operational raise-ticket directory
   AND the Settings → Workflows builder list restrict to the workflow types the
   caller can read. A CAPA-only user never sees Deviation workflows anywhere.
   - *Caveat (intended tightening):* an admin who holds the global `workflow.read`
     but has zero `wf_type.*.read` grants will now see an **empty** builder list.
     SUPER_ADMIN is unaffected (it holds every type key).
   - *Open edge:* **typeless** workflows (`typeId = null`). Under a
     `typeId in [...]` filter they disappear for scoped users. Production has
     zero typeless workflows (confirmed during the ticket-master work); local has
     only E2E test artifacts. Decision below (see Phase 1, step 4).

3. **Role picker → site-scoped, NOT type-scoped.** Keep all roles, but show only
   the roles "in that site."
   - *Interpretation (unavoidable):* the `Role` model has **no `siteId`** — a role
     touches a site only through the users who hold it (`role.users → user.siteId`).
     So "roles in that site" = **roles with ≥1 active user assigned in the
     caller's allowed site(s)**. Same site-scoping the user directory already uses.
   - *Caveat:* a brand-new role with no users yet appears in **no** site, so a
     site-scoped admin building a workflow wouldn't see it. SUPER_ADMIN / any
     `site.view_all` holder still sees all roles (no site constraint).

## Non-goals

- No change to the permission model, catalog, or enforcement guards — this is
  purely about **which rows list endpoints return**, not what actions are allowed.
  Action gating (buttons, route guards) already works per-type.
- No change to LMS/DMS people-pickers beyond their existing site scoping.
- Not touching single-record reads (`GET /workflows/:id`, `GET /tickets/:id`) —
  those are already guarded (`workflow.read` / `requireTicketAction('read')`).

---

## Current state (what's scoped vs. not)

| Surface | Endpoint | Today's scoping | Gap |
|---|---|---|---|
| Ticket list | `GET /tickets` | per-type ∩ per-site ✅ | none |
| Sidebar modules | `GET /workflow-lookups/types` + client `wfTypeReadKey` | client-filtered per-type ✅ | none (visibility only) |
| **Workflow builder list** | `GET /workflows` | global `workflow.read` only | all types leak |
| **Workflow picker** | `GET /workflows/directory` | **no guard** | all active workflows leak |
| **Type dropdowns** | `GET /workflow-lookups/types` | open by design | filters/modals show all types |
| **People picker** | `GET /users/directory` | site + active only | all users appear |
| **Role picker** | `GET /roles/directory` | **none** | all roles appear |

### Reusable primitives already in place (`backend/src/middleware/permissions.ts`)

- `ticketReadScope(keys) → { all:false, typeIds:[...] }` — derives readable type
  ids from the effective key set (scans `*.read` keys). **This already is exactly
  "workflow types the user can access"** — we reuse it, no new derivation needed.
- `resolveSiteScope(userId) → { all, siteIds }` and `siteFilterFor(scope, req)` —
  the site-scoping the user directory + ticket list already use.
- `getEffectivePermissionKeys(userId)` — cached effective `Set<string>`.

Nothing analogous exists for workflows or for people/role pickers today — that's
the work.

---

## Design

### A. Workflow scoping (Decision 2)

Introduce a workflow read scope that is literally the ticket read scope (same
derivation, same source of truth) — alias, don't duplicate:

```ts
// middleware/permissions.ts
/** Workflow types a caller may see in workflow lists — same set as ticket reads. */
export const workflowTypeReadScope = ticketReadScope;
```

- `workflow.service.list(query, scope)` — accept the scope; add
  `where.typeId = { in: scope.typeIds }` (see typeless edge, Phase 1 step 4).
- `workflow.service.directory(typeId, scope)` — when `typeId` given, 404/empty if
  it's outside `scope.typeIds`; otherwise constrain to `scope.typeIds`.
- Controllers compute the scope from `getEffectivePermissionKeys(userId)` and pass
  it in — mirrors `ticket.controller.list` exactly.
- SUPER_ADMIN holds every `wf_type.*.read` key → sees everything (no special case).

### B. People picker: type ∩ site (Decision 1)

`GET /users/directory?typeId=<id>` (typeId optional, backward compatible):

- **No `typeId`** → today's behaviour (site + active). LMS/DMS unaffected.
- **`typeId` present** → additionally restrict to users who effectively hold
  `wf_type.<typeId>.read`. Express the effective model (grant from
  role/department/override, deny wins) as one Prisma `where`, so we don't run
  `computeEffectivePermissions` per user:

```ts
const readKey = wfTypeKey(typeId, 'read');
where.AND = [
  { OR: [
    { role:       { permissions: { some: { key: readKey } } } },
    { department: { permissions: { some: { key: readKey } } } },
    { permissionOverrides: { some: { permission: { key: readKey }, effect: 'GRANT' } } },
  ] },
  { NOT: { permissionOverrides: { some: { permission: { key: readKey }, effect: 'DENY' } } } },
];
```

- Site scope still applies (the `siteId in [...]` clause stays) → the AND of both.
- SUPER_ADMIN users match via `role.permissions` (they hold the key) → still appear.
- Baseline verb = `.read` (must at least see the module to be assignable). If a
  future picker needs a stricter verb (e.g. only `transition`-holders as
  approvers), the helper takes the verb as a parameter — default `read`.

### C. Role picker: site-scoped (Decision 3)

`GET /roles/directory` resolves the caller's site scope and filters:

```ts
const scope = await resolveSiteScope(userId);
where = scope.all
  ? {}
  : { users: { some: { isActive: true, siteId: { in: scope.siteIds } } } };
```

- `site.view_all` / SUPER_ADMIN → all roles.
- Otherwise → roles with ≥1 active user in an allowed site (empty-role caveat above).

---

## Phased plan

> **Sequence:** Phase 0 (data check, defined under Primary risk) runs first and
> gates Phase 2/4's people-picker scoping. Phase 1 (workflows) and Phase 3 (roles)
> have no such dependency and can proceed regardless of Phase 0's outcome.

### Phase 1 — Backend: workflow list + directory scoping ✅ DONE (2026-07-12, local)

> Implemented + verified on local `kaizen_qms`: service-level 8/8 AND live HTTP
> 3/3 (throwaway CAPA-only user saw only CAPA in `/workflows/directory` +
> `/workflows`; SUPER_ADMIN saw all active types, no typeless). `tsc` clean.
> Files: `permissions.ts` (added `workflowTypeReadScope`), `workflow.service.ts`
> (`list`/`directory` take + apply the scope, typeless handling per step 4),
> `workflow.controller.ts` (resolve scope from caller keys). See `backend/changes.md`.

1. `middleware/permissions.ts` — export `workflowTypeReadScope = ticketReadScope`
   (alias + doc comment tying the two together).
2. `workflow.service.ts` — `list(query, scope)` and `directory(typeId, scope)`
   take the scope and apply the `typeId` filter (design A).
3. `workflow.controller.ts` — `list`/`directory` compute the scope from the
   caller's keys and pass it in (mirror `ticket.controller.list`).
4. **Typeless-workflow decision:** default to *excluding* typeless workflows for
   scoped users (consistent with tickets), BUT include a caller's own in-progress
   typeless drafts in the **builder** list so a new workflow isn't hidden from its
   author before a type is assigned:
   `OR: [{ typeId: { in: scope.typeIds } }, { typeId: null, createdById: userId }]`.
   The **directory** (operational) excludes typeless entirely (you can't raise a
   ticket on a typeless workflow anyway — no per-type key can grant it).
5. Leave the route guards as-is: `GET /workflows` stays behind `workflow.read`;
   `GET /workflows/directory` stays open (now returns a scoped set instead of all).

**Verify:** a CAPA-only role sees only CAPA workflows in both the builder list and
the raise-ticket picker; SUPER_ADMIN sees all; typeless drafts visible to author
only.

### Phase 2 — Backend: people picker (type ∩ site)

1. `user.schema.ts` — add optional `typeId` to the directory query schema.
2. `user.service.directory(siteIds, typeId?)` — add the effective-permission
   `where` (design B) when `typeId` is present.
3. `user.controller.directory` — pass `req.query.typeId` through.
4. Route/guard unchanged (still open, still site-scoped by default).

**Verify:** `/users/directory?typeId=<CAPA>` returns only users who can access CAPA
*and* are in-site; `/users/directory` (no typeId) is unchanged (LMS/DMS intact);
a user with a DENY override on that type is excluded; SUPER_ADMIN users included.

### Phase 3 — Backend: role picker (site scope)

1. `role.service.directory(siteScope)` — apply design C.
2. `role.controller.directory` — resolve `resolveSiteScope(userId)` and pass it.
3. Route/guard unchanged.

**Verify:** a site-scoped caller sees only roles with active users in their site;
`site.view_all`/SUPER_ADMIN sees all; empty roles hidden for scoped callers (known
caveat).

### Phase 4 — Frontend: thread type context + cleanup

> Note: the pickers are **already wired to the directory hooks** (prior
> "Operational-access fixes"). This phase does NOT migrate pickers — it only
> passes a `typeId` into the already-wired `useUserDirectory` calls where
> type-scoping was approved in Phase 0, and does the stale cleanup.

1. **People pickers in workflow/ticket contexts** — pass the workflow type id into
   `useUserDirectory(typeId)` so Phase 2 engages, **only for the pickers Phase 0
   cleared as safe.** Candidate consumers (authoritative list from `changes.md`,
   "Operational-access fixes" → Frontend files): Audit — `AuditRegisterFormPage`,
   `ActionItemsPage`, `AuditSchedulePage`, `CapaDetailPage`, `CapaListPage`.
   **Leave LMS/DMS/Training callers (`AssignmentsPage`, `ReportsPage`,
   `TrainingDetailPage`, `TrainingListPage`, `TrainingMatrixPage`,
   `AcknowledgementPanel`, `DocumentEditorPage`) with NO typeId** — site-scoped.
   ⚠️ Audit staffing pickers only get a `typeId` if Phase 0 proves the assignee
   pool actually holds the audit type key (see Primary risk).
2. `useUserDirectory` / `useRoleDirectory` hooks — thread the optional `typeId`
   param and key the query by it (cache-correctness).
3. Workflow/type dropdowns — no client change needed if the server scopes
   `/workflows*`; the type filter (`useWorkflowTypes`) stays whole for the sidebar,
   but review the **WorkflowsPage type filter** and **CreateWorkflowModal** to
   decide whether to narrow their type options to `workflowTypeReadScope` (low
   priority — the list rows are already scoped).
4. **Stale cleanup:** `client/src/features/modules/ModulePage.tsx:130-132` still
   ORs the retired global `ticket.${action}` key into `canForType` — remove it
   (dead post-Phase-3 of the ticket-master retirement; this file was touched by the
   "Operational-access fixes" but the stale OR survived).

### Phase 5 — Verify end-to-end + docs

1. Playwright against the live app, per-type role:
   - Workflows builder + raise-ticket picker show only accessible types.
   - CAPA owner/assignee picker shows only in-type, in-site users.
   - Role picker shows only in-site roles.
   - LMS/DMS pickers still show the full site-scoped user list (no regression).
2. Log changes into `changes.md`, `backend/changes.md`, `client/changes.md`
   (established format).
3. Update this doc's status to IMPLEMENTED with verification notes.

---

## ⚠️ Primary risk — re-emptying the pickers the last effort just fixed

The "Operational-access fixes" existed because operational roles were seeing
**blank** pickers. Decision 1 (type-scope the people picker) pushes in the
*opposite* direction — it *removes* people from those pickers. The concrete danger:

- The **Audit initiator form** (Lead Auditor / Approver / Team Members) was bug #1
  that effort fixed. If the people who staff an audit do **not** themselves hold
  `wf_type.<auditType>.read`, type-scoping empties that picker **again**.
- More generally: "who can be *assigned* to work an item" and "who has *ticket
  read access* to that module" are **not** the same set. An approver or team member
  may legitimately have no per-type ticket grant.

**Mitigations to weigh before building Phase 2/4:**
1. **Verify against real data first** — for each workflow type, does the intended
   assignee pool actually hold `wf_type.<type>.read`? If yes, Decision 1 is safe.
   If no, type-scoping is wrong for that picker. (Cheap to check with one query per
   type before writing any code — do this in Phase 0 below.)
2. **Consider read as the wrong verb** — maybe the assignable audience is "anyone
   in-site" (status quo) and only the *ticket list* needs type-scope (already done).
3. **Per-picker opt-in** — apply the `typeId` filter only to pickers where it's
   provably correct (e.g. "who can transition this ticket") and leave audit
   staffing pickers site-only. The `typeId`-optional design already supports this.

This is worth a decision checkpoint with the user **after Phase 0's data check**,
because it may revise Decision 1 for specific pickers.

### Phase 0 — Data check (do before Phase 2, no code)

Read-only query per workflow type: count active, in-site users who effectively hold
`wf_type.<type>.read`, and compare against who's currently assignable/assigned on
that module's items. If the readable pool is empty or tiny for a type whose picker
must be populated (audit staffing especially), flag it and revisit Decision 1 for
that picker before writing Phase 2/4.

**RESULT (local `kaizen_qms`, 2026-07-12) — inconclusive-but-not-alarming:**

| Type | Holders of `.read` | By site |
|---|---|---|
| CAPA | 7 / 7 | HQ:5 PUNE:2 |
| Audit | **6 / 7** | HQ:5 PUNE:1 |
| Document Review | 6 / 7 | HQ:5 PUNE:1 |
| (3 test types) | 6 / 7 | HQ:5 PUNE:1 |

Audit staffing cross-check: **15 registers but only 1 distinct staffer assigned**,
and that person holds the audit key → *"type-scoping is safe here."*

**Honest read of this:** reassuring but **not conclusive**. The local DB has only
7 users, nearly all high-privilege (that's why almost everyone holds almost every
key), and audit staffing is barely exercised (1 person). Note one PUNE user has
CAPA but **not** Audit — exactly the kind of operational user who *would* vanish
from a type-scoped audit picker — they're just not assigned to an audit yet. In
production, with many narrow-grant operational users, the risk is real.

**Conclusion:** build the people-picker type filter as **per-picker opt-in**
(pass `typeId` only where wanted, trivially removable), and **re-run this check
against production** before enabling type-scoping on the audit staffing picker
specifically. Workflows (Phase 1) and roles (Phase 3) are unaffected.

**RESULT (production `qk_prod`, run by user 2026-07-12) — decisive:**

| Finding | Value |
|---|---|
| Active users | 51 (sites: HQ:27, TEST:24) |
| Holders of `.read` **per type** | **51 / 51 for ALL 12 types** |
| Audit staff assigned | 8, **all HOLD the audit key** (incl. 1 inactive) |

**Interpretation — production access is NOT differentiated.** Every user holds
every `wf_type.*.read` key — the legacy of the retired global master (Phase 2's
backfill mirrored the "all tickets" master onto every per-type key for everyone).
So:

1. **Type-scoping breaks nothing in prod today** (audit staffing included) — but it
   also **does nothing visible**, because the filter's input is identical for all
   users. It only bites once an admin *narrows* a role/user's per-type grants in the
   Access Matrix (the intended use of the whole feature).
2. **This is likely a root cause of the reported symptom.** An operational user
   "seeing all workflows" in prod isn't only missing list-filtering — they
   *genuinely hold every type key*. Even a perfectly-scoped list shows them
   everything until their grants are tailored down.
3. **The audit-staffing coupling stays fragile.** "All 8 hold the key" is true only
   *because everyone holds everything*; it does NOT validate coupling assignability
   to `wf_type.<audit>.read` once access is tailored. **Decision: do NOT type-scope
   the audit staffing picker** — keep it site-only.
4. **Side note:** prod has a `TEST` site with 24 users (~half the base) — likely
   test accounts to clean up; not blocking.

**Revised build order:**
- **Phase 1 (workflows) + Phase 3 (roles/site): build now** — structurally needed,
  correct, effect appears as grants get tailored (Phase 3 has some immediate effect).
- **Phase 2 (people picker type filter): build opt-in, EXCLUDE audit staffing** —
  apply only to ticket-action pickers where "holds type read" = the real audience.
- **Config task (not code):** none of the type-scoping is *visible* in prod until
  someone actually narrows per-type grants in the Access Matrix.

## Risks & open items

- **Perf:** the people-picker `where` adds three relation `some`/`NOT some` sub-
  clauses. Directory lists are small (active users in-site); index on
  `Permission.key` + the M2M join tables covers it. Confirm with a query count if
  a site is large.
- **Empty pickers:** three tightenings can legitimately empty a list (admin with
  `workflow.read` but no type reads; site-scoped admin + empty role; type-picker in
  a module the user can't access). All are *correct* per the decisions — verify
  they don't strand a legitimate workflow-building admin (likely SUPER_ADMIN /
  view_all in practice).
- **Type context availability (frontend):** each workflow/ticket people-picker
  must know its workflow type id to pass it. Where a page doesn't have it handy,
  resolve it from the ticket/CAPA's workflow (`flows[0].workflow.typeId`) — the
  same source the per-type action gating already uses.
- **Baseline verb choice:** using `.read` as "has access to the type" for people
  pickers is the sensible default; revisit only if a picker needs a stricter
  audience (helper already parameterized for it).

## Rollback

Every phase is additive and independently revertible:
- Phase 1–3 revert = drop the scope argument / `where` clause; endpoints return to
  their current (unscoped) behaviour.
- Phase 4 revert = call the hooks without `typeId`.
No schema migration, no data backfill, no enforcement change — nothing to undo in
the DB.
