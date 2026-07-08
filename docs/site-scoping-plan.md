# Plan — Site-scoped data with a navbar Site selector

Give every user and ticket a **Site** (organization / location) dimension, add a
**navbar Site selector**, and **hard-enforce** on the server that a user only sees
their site's data. Admins can view across sites.

> **Status:** implemented (backend + frontend typecheck clean). Not committed —
> all changes are in the working tree. Pending: manual/Playwright verification
> against the live dev servers.

---

## Decisions (confirmed with the user)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Data model | **Reuse the existing `Site` model as-is. Do NOT rename** it (model, table, `siteId` columns, `/api/sites`, `SitesTab` all stay named "Site"). UI is labeled "Site" to match the existing Sites admin tab. |
| 2 | Enforcement | **Hard, server-enforced scope** — a user assigned a site can only ever see that site's tickets; the API enforces it (mirrors the per-workflow-type access work). |
| 3 | Rollout | **Backfill existing users + tickets to a default `Headquarters` (HQ) site.** New sites are created via the Sites tab and assigned going forward. |

---

## What already exists (reuse, do NOT rebuild)

- **`Site` model** — `{ id, code, name, address, isActive }` with FKs to
  **`User.siteId`** and **`Ticket.siteId`**, both indexed. No relation migration needed.
- **Site CRUD backend** `/api/sites` (`site.routes.ts` / `.controller.ts` / `.service.ts`),
  gated on **`org.read` / `org.update`** (it reuses org permissions by design).
- **Frontend** — `SitesTab` admin UI + `lib/api/sites.ts` client already exist.
- **User** create/update **already persists `siteId`**; user list already filters by it.
- **Ticket** create (engine `raiseTicket`) **already persists `siteId`**; ticket detail
  already selects `site { id, name, code }`.
- **Seed already creates `Headquarters` (code `HQ`)** plus other sites — backfill reuses HQ.
- **Header** already has the **fiscal-year selector + Zustand store** (`fiscalYearStore`) —
  the exact pattern to clone for a site selector.
- **`/auth/me`** already *selects* `siteId`, but `shapeUser` drops it and `authStore`
  hard-codes `site: undefined` — needs wiring, not new plumbing.

---

## ⚠️ Side-effects / flags found during audit (each handled below)

1. **Siteless system-spawned tickets — the load-bearing risk.**
   CAPA (`capa.service.ts:89`), OOS (`oos.service.ts:167`), audit-register
   (`audit-register.service.ts:438`) and scheduled-audit (`audit-schedule.service.ts:223`)
   spawns call the engine **without a `siteId`** → the ticket gets `siteId = null`.
   Under hard enforcement **a null-site ticket is invisible to everyone without `viewAll`.**
   → **Fix:** `raiseTicket` must never produce a siteless ticket (see Backend §2).

2. **`GET /api/sites` is gated on `org.read`.** Regular users can't list sites, so the
   navbar dropdown must **not** call it (same class of bug as the `workflow.lookups.read`
   sidebar wipe).
   → **Fix:** navbar renders from `/auth/me`'s `allowedSites`; only the admin user-form
   picker calls `/api/sites` (admins already hold `org.read`).

3. **Hard-enforcement blast radius.** Every non-`viewAll` user gets scoped to one site.
   → **Neutralized by construction:** the backfill puts *all* existing users **and**
   tickets on HQ, so on deploy everyone still sees everything (all data is HQ). Scoping
   only differentiates once a *second* site exists. Add `site.viewAll` for real admins
   (SUPER_ADMIN gets it automatically via the ALL_KEYS bypass; grant `QMS_ADMIN` in seed).

4. **Site delete guard** already blocks deleting a site that still has users/tickets →
   after backfill, HQ is undeletable. Desirable; noted.

5. **LMS & Sample are independent.** LMS targets assignments by site (separate feature);
   `sample.sourceSite` is **free-text, not the Site FK**. Our changes touch neither.

6. **authStore persist migration** only rejects the old role-object shape; adding
   `site` / `allowedSites` is additive and safe. Bootstrap `refreshUser()` reseeds it.

7. **Ticket-list `where`** — `siteId` is a top-level AND that composes cleanly with the
   existing `flows` / `mine` / `OR`-search clauses.

---

## Implementation

### Backend

1. **Default site + backfill (idempotent startup step).**
   `ensureDefaultSite()` → find-or-create HQ; backfill `User.siteId` and `Ticket.siteId`
   where `null` → HQ. Call it alongside `syncWorkflowTypePermissions()` in `rbac-sync`
   so dev and prod self-heal. Ship this **before** enforcement so nobody is locked out.

2. **Engine `raiseTicket` — never siteless (fixes flag #1).**
   Resolve a non-null `siteId` in this order:
   **parent ticket's site → actor's `user.siteId` → default HQ.**
   `ActorContext` is `{ id, name?, email? }`, so look up the actor's site by `id`.
   One change; covers the drawer *and* all four programmatic spawn callers.

3. **Scope + enforcement (mirror `TicketTypeScope`).**
   - Add `site.viewAll` permission to `rbac-catalog.ts` (module `SITE`). SUPER_ADMIN
     gets it via ALL_KEYS; grant `QMS_ADMIN` in `seed.ts`.
   - `middleware/permissions.ts`: `SiteScope = { all: boolean; siteIds: string[] }`;
     `resolveSiteScope(userId)` → `{ all: true }` if `site.viewAll`, else
     `{ all: false, siteIds: [user.siteId] }`; a `siteFilterFor(scope, requestedSiteId)`
     helper that intersects the client-requested site with the allowed scope
     (a requested site outside scope is **ignored, never widens** — the hard boundary).
   - `ticket.service.list()`: accept `siteScope` + optional `requestedSiteId`; add the
     resulting `where.siteId` (compose with the existing type-scope `where`).
   - `ticket.controller.list`: resolve site scope from the caller (as it already does
     for `ticketReadScope`) and read `?siteId=` from the query.
   - `ticket.service` create/update: reject a `siteId` outside the caller's scope.

4. **Expose sites to the client via `/auth/me`.**
   Extend `publicUserSelect` + `shapeUser` to include `site { id, code, name }` and
   `allowedSites` = all active sites if `site.viewAll`, else just the user's own site.

### Frontend

5. **`siteStore`** — new persisted Zustand store (clone `fiscalYearStore`):
   `{ siteId | 'all', setSiteId }`, initialized from `user.siteId`.

6. **`Header.tsx`** — Site dropdown rendered from `user.allowedSites`
   (add an **"All Sites"** option when `site.viewAll`; render a static label when the
   user has only one site). The ticket-list hook reads `siteStore.siteId`, passes
   `?siteId=` (omit for `all`), and adds `siteId` to the query key so switching refetches.

7. **`UsersTab.tsx`** — surface the **Site** picker under the existing "Organization"
   heading (schema + service already support `siteId`); options from `GET /api/sites`.
   Add an inline **"+ Add site"** modal (POST `/api/sites`, then select it). Uses the
   shared modal conventions; any deletes use `useConfirmDelete`.

8. **`RaiseTicketDrawer`** — default the new ticket's `siteId` to the navbar-selected
   site (require an explicit pick when "All Sites" is active). Server still validates scope.

9. **`authStore`** — map `site` + `allowedSites` from the `/me` payload into `AuthUser`
   (currently `site` is hard-coded `undefined`).

---

## Testing (Playwright, mirroring the existing access spec)

1. Backfill creates/uses HQ and assigns all existing users + tickets to it.
2. A site-scoped user's ticket list returns **only** their site — even with a forged
   `?siteId=` for another site (proves the hard boundary).
3. A CAPA/OOS spawn produces a ticket with a **non-null** site (inherited/defaulted).
4. A `site.viewAll` user sees all sites, can switch, and "All Sites" returns everything.
5. Creating a ticket while a site is selected assigns that site; a scoped user cannot
   create in another site.
6. Navbar renders the selector; the user-form site picker + inline-add work.

---

## Rollout / operational notes

- Order: **default-site backfill first**, then enforcement.
- Existing logged-in users receive `site` / `allowedSites` on next load via the existing
  bootstrap `refreshUser()`.
- The UI label reads **"Site"** (matches the Sites admin tab); switching it to
  "Organization" later is a one-line cosmetic change.
- Effort: ~2 backend files of real logic (permissions helper + ticket service/controller)
  plus the engine `siteId` default, catalog/seed, `/me` shaping; ~5 frontend touchpoints.
  Low risk — relations, CRUD, admin UI, and the scope pattern all already exist.
