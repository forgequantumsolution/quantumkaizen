# Workflow site-ownership

**Status:** IMPLEMENTED (Phases A–F) on local `kaizen_qms` — working tree only,
not committed. Verified: backend service-level 6/6 + live HTTP 6/6, frontend `tsc`
clean. Production deploy pending (needs `prisma migrate deploy`). See
`backend/changes.md` + `client/changes.md`.
**Date:** 2026-07-12
**Related:** `docs/access-control-data-scoping-plan.md` (Phase 1 type-scoping, done),
`docs/site-scoping-plan.md` (the site machinery this reuses).

---

## Goal

Today workflows are **global templates** — one shared library, no site link
(`Workflow` has `typeId` but no `siteId`). The user wants workflows to be
**owned by a site**, so different sites can have their own workflows, while a
Super Admin can still create **global** workflows shared by everyone. The
roles/users a builder can pick *inside* a workflow follow the workflow's site.

## Decisions locked (from the user)

1. **Add `Workflow.siteId` (nullable).** `null` = **global** (visible to every
   site). A value = the workflow **belongs to that one site** (only that site sees
   and uses it).
2. **On create:**
   - A **site-scoped user** (no `site.view_all`) → `siteId` is **forced to their
     own site** (client cannot override — hard boundary).
   - **Super Admin / `site.view_all`** → gets a **picker**: create it **global**
     (`null`) or **pin it to any specific site**.
3. **Existing workflows → global.** The new column defaults to `null`, so every
   current workflow becomes global on deploy. **Nothing disappears for anyone**;
   site-ownership only governs workflows created *after* this ships.
4. **Visibility (list + directory):** a caller sees a workflow when
   `siteId IS NULL OR siteId ∈ their allowed sites`, **layered on top of** the
   Phase 1 type-scope (so: a type they can access AND (global or their site)).
   `site.view_all` → no site constraint (sees all).
5. **Roles/users inside the builder** are scoped to **the workflow's site**:
   - Site-owned workflow → pickers show that site's roles/users.
   - Global workflow (Super-Admin) → pickers show everyone (all sites).
   This is where "narrow the roles and users inside it, per site" lands. Because a
   site-owned workflow only ever runs that site's tickets, baking that site's
   people into its stages is correct — **no runtime re-resolution needed.**

## Non-goals

- Not making workflows *multi*-site (a workflow belongs to one site or is global —
  not "these three sites"). Super Admin duplicates if a second site needs its own.
- Not changing ticket site-scoping (already done) or Phase 1 type-scoping (done).
- No runtime per-site assignee resolution — site-ownership removes the need (see 5).

---

## Impact map

| Layer | Change |
|---|---|
| Schema | `Workflow.siteId String?` + FK to `Site` (`onDelete: SetNull`), `@@index([siteId])`. Migration. No data backfill (default `null` = global). |
| Create | `createShell` sets `siteId`: forced to creator's site for scoped users; from the request (global or chosen site) for `site.view_all`. |
| Versioning | `cloneIntoNewVersion` must carry `siteId` onto the new version row (a re-save must not silently globalize a site-owned workflow). |
| List / directory | `workflow.service.list`/`directory` add a site filter (`siteId null OR in scope`) alongside the existing type filter; controller resolves `resolveSiteScope`. |
| Builder pickers | The stage allowed-roles/users, approver, and form-audience pickers scope to the **workflow's** site (not blindly the caller's). Needs the directory endpoints to accept a bounded `siteId`, and the builder to pass `workflow.siteId`. |
| Frontend | Create modal: Super-Admin site picker (global / a site); scoped users see none (auto own-site). Workflow list: site badge/column (+ optional site filter). Builder: pass the workflow's `siteId` into the people/role pickers. |

---

## Phased plan

### Phase A — Schema + migration
- Add `siteId String?` + `site Site? @relation(...) onDelete: SetNull` + index to
  `Workflow`. Add the reverse relation on `Site`.
- `prisma migrate dev` on local `kaizen_qms`. Column is nullable, default `null` →
  every existing workflow is global. No backfill script.

### Phase B — Create + versioning
- `createShell(input, createdById)`:
  - Resolve the creator's site scope (`resolveSiteScope`).
  - `site.view_all` → accept `input.siteId` (validate it's a real site or `null`).
  - else → **ignore any client `siteId`**, set `siteId = creator's own site`.
  - Add `siteId` to `CreateWorkflowShellSchema` (optional; only honoured for
    view_all).
- `cloneIntoNewVersion` — copy `siteId` from the source row onto the new version.

### Phase C — List + directory site scoping
- `workflow.service.list` / `directory` accept a `SiteScope` and add
  `OR: [{ siteId: null }, { siteId: { in: scope.siteIds } }]` (skipped entirely
  when `scope.all`). Compose with the existing Phase 1 type filter.
- `workflow.controller` resolves `resolveSiteScope(userId)` and passes it
  (mirrors `ticket.controller.list`, which already does both scopes).
- Summary/detail selects add `site { id, code, name }` so the UI can show it.

### Phase D — Builder people/role pickers → workflow's site
- The people/role directories gain an optional, **scope-bounded** `siteId` param:
  a caller may request a site only within their own `resolveSiteScope` (a scoped
  user can't request another site; `view_all` may request any, or all for a global
  workflow). `/users/directory` is already site-scoped to the caller — extend it to
  accept an explicit target site for `view_all`; `/roles/directory` gets site
  scoping (this is the role-picker item from the data-scoping plan, done via site).
- Builder passes the open workflow's `siteId` into these pickers. Global workflow
  (`siteId null`) → unfiltered (all sites), which only Super-Admin can build anyway.

### Phase E — Frontend
- **Create modal** (`CreateWorkflowModal`): if `useHasPermission('site.view_all')`,
  show a Site select (Global + each site); otherwise omit (auto own-site). Send
  `siteId` only when view_all.
- **Workflow list** (`WorkflowsPage`): show a site badge/column ("Global" when
  null); optional site filter for view_all.
- **Builder**: thread `workflow.siteId` into the stage/approval/form pickers.

### Phase F — Verify + docs
- Playwright / live API: a Pune-scoped user sees global + Pune workflows only, and
  their new workflow auto-owns Pune; a Super-Admin can create a global or a
  Pune-pinned workflow; builder pickers show the workflow's-site people; existing
  workflows all read as Global. Update `changes.md` files + this doc's status.

---

## Edge cases & risks

- **Child / escalation workflows.** These reference other workflow *definitions*.
  A global parent can trigger a global child fine. If a site-owned parent triggers
  a child, the child definition keeps its own `siteId`; the runtime ticket carries
  the ticket's site regardless. No special handling beyond carrying `siteId` on
  clone — but call it out during Phase B/F testing.
- **Raise-ticket consistency.** The raise-ticket picker (`/workflows/directory`)
  now returns global + your-site workflows; a Pune user raising a ticket picks from
  those, and the ticket is Pune — consistent. Confirm the directory site filter and
  the ticket site scope agree.
- **Draft workflows** inherit the creator's site (same `createShell` path).
- **A `view_all` admin building a site-pinned workflow** needs the builder pickers
  to target *that* site, not the admin's — hence the explicit `siteId` param in
  Phase D, not just caller-site scoping.
- **Migration safety:** nullable + default null means zero downtime and no lockout;
  the only behavioural change is for *new* workflows. Reversible by dropping the
  column (no data depends on it until sites are assigned).

## Rollback

Drop `Workflow.siteId` (and the relation). All workflows revert to global behaviour
(the list/directory site filter treats everything as `siteId null`). No data loss —
site assignments were additive metadata.
