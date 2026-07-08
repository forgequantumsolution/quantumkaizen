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
