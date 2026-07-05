# Access Control Enhancement — Module × Action Matrix by Role / Department / User

**Status:** 📝 Draft — awaiting build approval
**Owner:** Backend (Prisma + Express) + Frontend (React/TS)
**Scope decided:** Full 3-dimension model · dynamic matrix columns · this doc first, build after approval
**Reference precedents in-repo:**
- `src/lib/rbac-catalog.ts` — canonical permission catalog (~250 `module.action` keys) synced at startup by `src/lib/rbac-sync.ts`
- `src/middleware/permissions.ts` — `requirePermission()` guard + 30 s `loadPermissions` cache
- `src/modules/role/role.service.ts#setPermissions` + `PUT /api/roles/:id/permissions` — the role-permission set precedent
- `client/src/lib/navAccess.ts` — Module → Tab → permission registry (drives sidebar + matrix)
- `client/src/features/admin/access-control/AccessControlTab.tsx` — the current admin UI being redesigned
- `WORKFLOW_FORM_ACCESS_CONTROL_PLAN.md` — role/user picker + deny-precedence precedent (different layer, same patterns)

---

## 1. Goal

Two problems, one feature.

1. **The Access Control UI is wrong.** The "Menu Access" matrix shows **one checkbox per tab**, and that checkbox only toggles the tab's `.read` key. There is no way to grant Create / Edit / Delete / Approve per module from the matrix — you have to drop into the raw, paginated "By Permission" list and tick 250 keys by hand. Users cannot see, at a glance, "what can this role do in this module."
2. **Access is role-only.** The backend resolves a user's permissions from their **single role**, full stop. **Department is just an org label** (never consulted by the guard) and **there are no per-user overrides.** The request is access control **by Role, Department, and User** — three real dimensions.

**Target:** one **Module × Action matrix** — rows are `Module → Tab`, columns are `View · Create · Edit · Delete · Approve · More` — that you can point at a **Role**, a **Department**, or an individual **User**, plus an **Access Analysis** view that answers "what can this person actually do, and where did each permission come from."

The good news from the audit: **the CRUD permission keys already exist** for nearly every module (`sample.read/create/update/delete`, `document.read/create/update/issue/approve/delete`, …). We are not inventing permissions — we are (a) surfacing the ones we have in a proper grid, and (b) adding two new **subjects** (Department, User) that permissions can attach to.

---

## 2. Current state (from code audit)

| Layer | File | Reality today |
|---|---|---|
| Catalog | `backend/src/lib/rbac-catalog.ts` | ~250 keys, `module.action`. Actions are **not uniform**: newer modules use `create/read/update/delete`; older (`doc/capa/nc/audit`) use `read/write/approve`; plus `issue/execute/transition/decide/manage`. |
| Sync | `backend/src/lib/rbac-sync.ts` | `ensureRbacCatalog()` upserts catalog at every boot; force-grants **all** keys to `SUPER_ADMIN`. |
| Data model | `backend/prisma/schema.prisma` | `Role ⇄ Permission` M2M (`RolePermissions`). `User.roleId` is a **single** optional role. **No** `UserPermission`, **no** department/site permission link. |
| Guard | `backend/src/middleware/permissions.ts` | `requirePermission(key)` → `loadPermissions(userId)` resolves **`User → one Role → permissions`** only. 30 s in-memory cache, `invalidatePermissionCache()`. 381 call-sites. |
| Login/me | `backend/src/modules/auth/auth.service.ts` | `/auth/login` + `/auth/me` flatten `role.permissions` → `permissions: string[]`. |
| Nav registry | `client/src/lib/navAccess.ts` | `NAV_ACCESS[]` = modules → tabs, **one `permission` (read key) per tab**. Drives both sidebar gating and the Menu Access matrix. |
| Admin UI | `client/src/features/admin/access-control/AccessControlTab.tsx` | 3 sub-views: **Menu Access** (1 read checkbox/tab), **By Permission** (raw flat list), **By User** (read-only role dump). Edits only Roles. |
| Auth store | `client/src/stores/authStore.ts` | `hasPermission(key) = permissions.includes(key)`. Flat array from login. |

**Net gap:** no CRUD columns in the matrix; department/user are not access dimensions in schema, resolver, endpoints, or UI.

---

## 3. Target access model & semantics

### 3.1 Effective-permission resolution

```
grants(user)  =  role.permissions
              ∪  department.permissions            (the user's departmentId; §3.3 for hierarchy)
              ∪  user overrides where effect = GRANT
denies(user)  =  user overrides where effect = DENY
effective(user) = grants(user) \ denies(user)

SUPER_ADMIN role → effective = ALL keys (deny is ignored for SUPER_ADMIN)
```

**Rules (must hold everywhere):**
- **Deny wins.** An explicit per-user `DENY` removes a key even if the role or department grants it. This is the only way to say "this analyst is in QC but must not delete samples."
- **Grants are additive (union).** Role, department, and user-GRANT all add; there is no ordering among them.
- **User overrides are the only DENY channel.** Roles and departments only ever grant. (Keeps the mental model simple: subtractive access is always attributable to a named person's override.)
- **SUPER_ADMIN bypass is preserved** exactly as today (all keys, deny ignored) so an admin can never lock themselves out.
- **A user with no role, no dept grants, no overrides** → empty set → denied everything guarded (unchanged from today).

### 3.2 Precedence table (verify against these)

| Role has | Dept has | User override | Effective |
|---|---|---|---|
| ✔ | — | — | ✔ (as today) |
| — | ✔ | — | ✔ (new: dept grant) |
| ✔ | — | DENY | ✘ (deny wins) |
| — | — | GRANT | ✔ (new: user grant) |
| ✔ | ✔ | DENY | ✘ (deny wins over both) |
| — | ✔ | GRANT | ✔ (redundant, harmless) |
| SUPER_ADMIN | any | DENY | ✔ (super-admin bypass) |

### 3.3 Department hierarchy (decision embedded)

Departments already have `parentId`. **Default: direct department only** — a user inherits grants from `user.departmentId`, not its ancestors. Ancestor inheritance is a documented future toggle (an `inheritsParentAccess` flag on Department), deferred to keep resolution O(1) join and avoid surprising "why can Finance see everything" cascades. Called out here so the resolver is written to make adding it a one-line change.

---

## 4. Backend changes

### 4.1 Schema (`backend/prisma/schema.prisma`) — additive, reversible

```prisma
enum PermissionEffect {
  GRANT
  DENY
}

model UserPermission {
  id           String           @id @default(cuid())
  userId       String
  user         User             @relation("UserPermissionOverrides", fields: [userId], references: [id], onDelete: Cascade)
  permissionId String
  permission   Permission       @relation("UserPermissionPerm", fields: [permissionId], references: [id], onDelete: Cascade)
  effect       PermissionEffect
  reason       String?          // GxP: why this override exists
  grantedById  String?          // audit: who set it
  createdAt    DateTime         @default(now())

  @@unique([userId, permissionId])   // one row per (user, permission); effect flips GRANT↔DENY
  @@index([userId])
  @@index([permissionId])
}

// Department gains a permission M2M (mirrors Role):
model Department {
  // ...existing...
  permissions  Permission[]     @relation("DepartmentPermissions")
}

// User gains the override backref:
model User {
  // ...existing...
  permissionOverrides UserPermission[] @relation("UserPermissionOverrides")
}

// Permission gains the two new backrefs:
model Permission {
  // ...existing roles...
  departments  Department[]     @relation("DepartmentPermissions")
  userOverrides UserPermission[] @relation("UserPermissionPerm")
}
```

Migration adds: 1 enum, 1 table (`UserPermission`), 1 implicit M2M join (`_DepartmentPermissions`). **No backfill** — every existing user resolves identically (empty dept grants + no overrides). Fully reversible.

### 4.2 Shared resolver (single source of truth)

Today `loadPermissions` (guard) and `auth.service` compute permissions **separately**. Extract **one** function so the guard, `/login`, and `/me` can never drift:

`backend/src/lib/effective-permissions.ts`
```ts
export async function computeEffectivePermissions(userId: string): Promise<Set<string>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: { select: { name: true, permissions: { select: { key: true } } } },
      department: { select: { permissions: { select: { key: true } } } },
      permissionOverrides: { select: { effect: true, permission: { select: { key: true } } } },
    },
  });
  if (!user) return new Set();
  if (user.role?.name === 'SUPER_ADMIN') return new Set(ALL_KEYS); // §3.1 bypass

  const grants = new Set<string>();
  user.role?.permissions.forEach((p) => grants.add(p.key));
  user.department?.permissions.forEach((p) => grants.add(p.key));
  user.permissionOverrides
    .filter((o) => o.effect === 'GRANT')
    .forEach((o) => grants.add(o.permission.key));
  user.permissionOverrides
    .filter((o) => o.effect === 'DENY')
    .forEach((o) => grants.delete(o.permission.key)); // deny wins
  return grants;
}
```
- `middleware/permissions.ts#loadPermissions` calls this (keeps its 30 s cache).
- `auth.service` (`/login`, `/me`) calls this for the flattened `permissions[]`.

### 4.3 Cache invalidation (widen it)

`invalidatePermissionCache(userId?)` is called on role edits today. Extend the call sites:
- **Role perms changed** → invalidate every user with that role (or clear whole cache — simplest, 30 s TTL bounds the blast radius anyway).
- **Department perms changed** → invalidate every user in that department.
- **User override changed** → invalidate that one user.

Given the 30 s TTL, **clearing the entire cache on any access-config write** is acceptable and safest for v1; note the targeted option for later.

### 4.4 New / changed endpoints

| Method | Route | Guard | Purpose |
|---|---|---|---|
| `PUT` | `/api/departments/:id/permissions` | `department.update` | Set a department's permission set (mirrors role's `setPermissions`; `set` M2M + invalidate). |
| `GET` | `/api/departments/:id` | `department.read` | Include `permissions` in payload. |
| `GET` | `/api/users/:id/permissions` | `user.read` | Return `{ effective: string[], sources: { role: string[], department: string[], grants: string[], denies: string[] } }` for the Analysis + User matrix. |
| `PUT` | `/api/users/:id/permissions` | `user.update` | Set the user's override list: `[{ permissionId, effect, reason? }]`. Upserts/deletes `UserPermission` rows + invalidate. |
| `GET` | `/api/access/who-can/:permissionKey` | `role.read` | Reverse lookup: roles / departments / users that grant a key (Analysis). |

Reuse existing guards (`department.update`, `user.update`, `role.read`) — no new catalog keys required. (Optional hardening: add `access_control.manage` later if you want to gate the whole console separately from CRUD on roles/users.)

### 4.5 Catalog: keep as-is, add a normalization map

Do **not** rewrite the 250 keys. Add a small **action-normalization table** (shared FE/BE) mapping each raw action to a matrix column so the dynamic grid renders consistently:

```
READ                         → View
CREATE, WRITE, ENTER, RESULT → Create
UPDATE, WRITE, MANAGE        → Edit      (WRITE spans Create+Edit for legacy modules)
DELETE                       → Delete
APPROVE, ISSUE, DECIDE,
  EXECUTE, TRANSITION, CLOSE,
  DISPOSE, REVIEW, PUBLISH   → Approve / More
```
Legacy `write` maps to **both** Create and Edit (it means both); the matrix ticks/unticks the single `write` key when either column is toggled and shows a small "W" affordance so admins know the two columns move together.

---

## 5. `navAccess.ts` — make tabs matrix-aware

Each tab needs to expose **all** its action keys, not just read. Two options; **recommend Option A** (least maintenance, self-syncing with the catalog).

**Option A — entity prefix (recommended).** Give each tab an `entity` (the key prefix). The matrix fetches the grouped catalog (`GET /api/permissions?grouped=true`) and auto-collects every key starting with `${entity}.`, then buckets by the normalization map. Columns appear only where a key exists → "dynamic columns" for free, and new catalog keys show up without touching `navAccess.ts`.

```ts
interface NavTabAccess {
  key: string;
  label: string;
  permission: string;   // the .read key — KEPT for sidebar gating (unchanged)
  entity: string;       // NEW: key prefix, e.g. 'sample', 'document', 'audit_register'
}
```
Sidebar behavior is untouched (still gates on `permission`). Tabs whose entity has extra actions (e.g. `coa.issue`) surface them under the **More** column.

**Option B — explicit `actions` map per tab.** More verbose, precise for tabs that span multiple entities. Use only for the handful of composite tabs (e.g. an "Audit" tab that touches `audit_register` + `audit_program` + `audit_finding`) — set `entity` for the common case, `actions` override for composites.

Also: fold the `HIDDEN_MODULES` set and `NAV_ACCESS` into one consistent source so "modules with no sidebar entry" (RISK, FMEA, SUPPLIER, CALIBRATION, INSPECTION, SLA, BUSINESS_CALENDAR, TRAINING) either get a home in the matrix under an **"Other / Advanced"** group or stay explicitly hidden — no silent drops.

---

## 6. Frontend UI redesign (`AccessControlTab.tsx`)

Replace the three ad-hoc sub-views with **two** clear ones plus a subject switcher.

### 6.1 The Matrix (primary view)

```
┌ Access Control ─────────────────────────────────────────────┐
│ Subject:  [ ● Role ]  [ Department ]  [ User ]     Analysis →│
│ [ Select: QUALITY_ENGINEER ▾ ]        23/250 · 5 users       │
│ Search modules…            [Reset] [Save Changes] (2 dirty)  │
├─────────────────────────────────────────────────────────────┤
│ MODULE / TAB              View  Create  Edit  Delete  Appr  ⋯│
│ ▸ LIMS — Operations       [▤]   [▤]     [▤]   [▤]     [▤]    │  ← module row: tri-state "all"
│    Samples                 ☑     ☑       ☑     ☐       —      │
│    Worklists               ☑     ☑       ☑     ☐       —      │
│    OOS Investigations      ☑     ☑       ☑     —       ☑     │  ← Appr = oos.close
│ ▸ Documents (DMS)          …                                 │
└─────────────────────────────────────────────────────────────┘
```

- **Rows** = `Module → Tab` from `NAV_ACCESS`. Modules collapse/expand. Module header cell = tri-state select-all for that column across the module's tabs.
- **Columns** = View · Create · Edit · Delete · Approve · **More⋯** (More opens a popover listing the leftover action keys — issue/execute/transition/etc. — as checkboxes).
- **Cells**: checkbox where the action-key exists for that entity; **`—` (disabled)** where it doesn't. Never a fake checkbox for a non-existent permission.
- **Column header** = select-all-in-column (across visible/filtered rows).
- **Dirty tracking + batched Save** exactly like the current implementation (draft `Set<permissionId>`, `PUT` on save). Reset restores.
- **Legacy `write`**: Create and Edit columns are linked for that entity (toggling either flips the one `write` key) with a "W" badge tooltip.

### 6.2 Subject = Role / Department / User

- **Role** → target `PUT /api/roles/:id/permissions` (existing). Ships in Phase 1 with **zero** backend change.
- **Department** → target `PUT /api/departments/:id/permissions` (Phase 2). Same matrix component, different save endpoint.
- **User** → **tri-state cells** because a user's access is inherited *plus* overridden:
  - **Inherited** (from role/dept): ghosted check ✓, gray — read-only baseline.
  - **Granted** (explicit user GRANT): solid check, blue.
  - **Denied** (explicit user DENY): ✕, red — overrides an inherited grant.
  - Clicking a cell cycles **Inherit → Grant → Deny → Inherit**. A hover chip shows the source ("via QUALITY_ENGINEER role" / "via QC department" / "explicit grant"). Saves via `PUT /api/users/:id/permissions`.

One `<AccessMatrix>` component, parameterized by subject + a `resolveCellState(entity, action)` and `onToggle` — so all three subjects share layout and only differ in state model and save target.

### 6.3 Access Analysis view (new)

Answers the questions an auditor/admin actually asks:
1. **Effective permissions for a user** — pick a user → full resolved list, each row annotated with its **source(s)** (role / department / grant) and any **deny**. Backed by `GET /api/users/:id/permissions`.
2. **Who can do X** — pick a permission (or module+action) → list every role, department, and user that grants it. Backed by `GET /api/access/who-can/:key`.
3. **Compare** — diff two roles (or a user vs a role) side by side: added / missing keys highlighted.
4. **Coverage stats** — per module: how many roles grant each action; flag "orphan" permissions granted to nobody and "god" roles near-100%.
5. **Export** — CSV/print of the effective matrix (GxP evidence for access reviews).

### 6.4 Sidebar note

No change required to `Sidebar.tsx` behavior — it keeps gating on the `.read` `permission`. Because the matrix now writes the same keys, granting "Create/Edit" without "View" would hide the module while allowing writes via deep link; the matrix should **auto-enable View when any other action in a row is checked** (and warn if you uncheck View while other actions remain) to prevent that footgun.

---

## 7. GxP / audit-trail requirement

This is a 21 CFR 11 / EU Annex 11 system (the sidebar advertises it). **Every access-control change must be audited.** Reuse the existing audit-log infrastructure:
- On role-perm / dept-perm / user-override writes, record actor, subject, before→after permission diff, timestamp, and the `reason` (required field on user overrides).
- Consider an **e-signature** gate (the app already has `signaturePinHash`) on privilege escalation — granting an approval/issue/delete key or any user-level override — deferred to Phase 5 but designed for now (endpoints accept an optional `signaturePin`).

---

## 8. Phasing (each phase independently shippable)

| Phase | Deliverable | Backend risk | Ships value |
|---|---|---|---|
| **0** | `navAccess.ts` gains `entity`; FE+BE action-normalization map; catalog exposed grouped (already is). No behavior change. | none | wiring |
| **1** | **Matrix UI for Role** — dynamic columns, module rows, batched save via existing `PUT /roles/:id/permissions`. Replaces "Menu Access" + "By Permission". | **none** (no migration) | ✅ the CRUD grid you asked for, immediately |
| **2** | **Schema migration** (`UserPermission`, `Department.permissions`, enum) + `computeEffectivePermissions()` + resolver/cache/invalidation + new endpoints. | migration (additive) | dept & user become real dimensions |
| **3** | **Department + User subjects** in the matrix (tri-state overrides, source chips). | none | full 3-D control |
| **4** | **Access Analysis** view (effective viewer, who-can-do-X, diff, coverage, export). | read-only endpoints | audit/ops usability |
| **5** | **Hardening** — audit trail on every write, optional e-sign on escalation, targeted cache invalidation, tests. | none | GxP compliance |

Phase 1 alone fixes the "UI is not correct" complaint with no migration. Phases 2–3 deliver "by Department and User." Phase 4–5 make it audit-grade.

---

## 9. Testing & verification

- **Resolver unit tests** — every row of the §3.2 precedence table, incl. SUPER_ADMIN bypass and deny-wins.
- **Migration test** — pre-migration users resolve to an identical permission set post-migration (snapshot before/after for a sample of roles).
- **Guard integration** — a route protected by `sample.delete`: denied for a QC user, allowed after a user GRANT, denied again after a user DENY (proving deny beats a role grant), all within the cache TTL after invalidation.
- **Cache** — dept-perm change invalidates all members; user override invalidates only that user.
- **UI** — dirty/reset/save on each subject; disabled cells never save a non-existent key; auto-enable-View footgun guard; tri-state cycle for users.
- **`/verify`** the end-to-end flow (log in as a restricted user, confirm sidebar + a write action reflect the matrix) before shipping each phase.

---

## 10. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Deny-precedence surprises admins | Source chips + Analysis view make every effective bit attributable; deny is only ever a named per-user override. |
| Locking someone (or SUPER_ADMIN) out | SUPER_ADMIN bypass preserved; matrix warns on removing View while writes remain; overrides require a `reason`. |
| Catalog non-uniformity (`write` vs `create/update`) | Normalization map + linked Create/Edit for legacy `write`; `—` for absent actions; **More** column for the long tail. |
| Cache staleness after dept edit | v1 clears whole cache on any access write (30 s TTL bounds it); targeted invalidation in Phase 5. |
| GxP: unaudited privilege change | Phase 5 audit trail + optional e-sign; `reason`/`grantedById` captured from Phase 2. |
| Scope creep into row-level (department-scoped *data*) access | Explicitly **out of scope** — this is permission (verb) access, not record (row) filtering. Noted for a separate future plan. |

---

## 11. Out of scope (this plan)

- **Row-level / department-scoped data filtering** (e.g. "only see your department's tickets") — a separate concern from permission grants.
- **Multi-role per user** — staying single-role; user overrides cover the "role + a bit extra/less" need.
- **Department ancestor inheritance** — designed-for, toggled off (§3.3).
- **Rewriting the 250-key catalog to be uniform** — normalization map instead.
</content>
</invoke>
