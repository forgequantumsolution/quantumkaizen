# Generic Findings → Child Tickets (CAPA / Deviation)

**Status:** IMPLEMENTED (Phases 1–5) & verified on `kaizen_qms2`, 2026-07-16
**Author:** _drafted with Claude Code_
**Target DB:** `kaizen_qms2` (all-modules dump; never `quantumkaizen` legacy)

Bring the audit module's "findings → child ticket (CAPA)" capability to every other
QMS module (inspection, change control, deviation, …) as a **single reusable
mechanism**, rather than cloning audit's bespoke tables per module.

> **Playwright verification (2026-07-16, `kaizen_qms2`).** Confirmed live in the running app
> (login `admin@forgequantum.com`):
> - The modules **already exist** as `WorkflowType`s with active workflows and seeded tickets:
>   Inspection (35 tickets), Change Control (35), Deviation (35), Complaints (35), CAPA (38),
>   plus Maintenance/Risk/Supplier/Equipment/Calibration/etc. — 15 active types total. So Phase 4
>   is **not** "create the modules"; they're here. It flags which ones support findings and adds a
>   checklist to the ones missing one.
> - An **Inspection ticket detail** (`/tickets/:id`) today has exactly three tabs — **Details ·
>   Stage Forms · History** — and **no** Findings or Child section. Its stages are Inspection
>   Request → Sampling → Inspection Testing → Result Review → Disposition → Approval Closure.
> - The right sidebar already has a **"Linked Records"** card showing the WORKFLOW and the parent
>   ticket (renders **"No parent ticket"** when none) — see `TicketSidebar.tsx:81-117`. This is the
>   existing home for parent/child linkage; we extend it for children (Phase 3).
> - `WorkflowType.supportsFindings` returns `undefined` over the API — the flag doesn't exist yet
>   (as the plan assumes).
> - A pre-existing React *"Maximum update depth exceeded"* render loop on the ticket-detail page was
>   found and **FIXED** during this review (root cause in `useCountdown`) — see Gotcha #13.

---

## 1. How it works today (audit)

The current capability is an **audit-only chain of dedicated tables**:

```
AuditRegister → AuditProgram → AuditFinding → (promote) → NonConformance → (raise) → Capa → spawns CAPA workflow Ticket
```

- `AuditFinding`, `NonConformance`, `Capa`, `ActionItem` are dedicated tables tied to
  `AuditProgram` (`backend/prisma/schema.prisma:1779+`).
- A `Capa` is a first-class row that **also spawns a generic workflow `Ticket`** to run
  its lifecycle — the "spawn-and-link" pattern (`workflowId` / `workflowTicketId` plain
  columns + `customFields` back-reference). See `docs/capa-dynamic-workflow-plan.md`.
- `createCapa()` (`backend/src/modules/audit/capa.service.ts:398`) is **already a shared,
  cross-module service** — the OOS module calls it (`backend/src/modules/oos/oos.service.ts:148`).
- Frontend: the "Findings" module tab is actually a `NavLink` to the Non-Conformance page;
  findings render as a card on the program-execution page. The "Promote → NC" modal and
  "Raise CAPA" drawer are **inlined per-page, not shared components**.

## 2. Architectural facts that make reuse cheap

1. **Every non-audit module is just a `WorkflowType` row** rendered by one generic
   component, `client/src/features/modules/ModulePage.tsx`. Its tickets open the generic
   detail page at `/tickets/:id` (`ModulePage.tsx:712`). In `kaizen_qms2`, Inspection, Change
   Control, Deviation, Complaints, CAPA and ~10 more **already exist** as `WorkflowType`s with
   active workflows and ~35 tickets each (verified via Playwright above) — so no module creation
   is needed; we just add the findings capability on top.
2. **A generic child-ticket primitive already exists**: `Ticket.parentTicketId` +
   `spawnChild()` (`backend/src/modules/ticket/ticket.service.ts:548`) raises a child ticket
   of any workflow type from any ticket and emits a `CHILD_TICKET_SPAWNED` audit event.
   Fully built on the backend, **no frontend UI wired to it**.
3. **No generic "findings" entity exists** — findings only exist as audit's `AuditFinding`.

## 3. Chosen approach (decisions)

- **Approach:** Generic shared capability — one reusable `Finding` entity + reusable
  Findings tab + Raise-Child action, available to any `WorkflowType` module.
- **Scope (now):** Build the generic capability once, and add a **compliance checklist** to these four
  modules so findings auto-generate for them: **Inspection, Supplier Quality, Change Control,
  Deviation**. Supplier Quality already has a checklist form (2 forms with `compliance_status`); the
  other three need a checklist field added to their stage form (Gotcha #15 / Phase 4). Other modules
  get the manual-entry Findings tab only, for now.
- **Scope (later — see Phase 6):** a generic **per-stage checklist** any workflow can attach to a
  stage, where completing the checklist drives **child-ticket creation** from a UI at that stage. This
  generalizes findings→child beyond the four seeded modules; deferred.
- **Findings are GENERATED from the ticket's checklist data — not typed by hand (primary path).**
  This mirrors audit exactly: the inspector fills the workflow's **checklist form**, marking each item
  Compliant / Non-Conformance / Observation (a "compliance" disposition). On submit (and on ticket
  completion), a sync routine reads those answers and **auto-creates a Finding for every
  Non-Conformance / Observation item** — the finding's description = the checklist item, severity =
  the disposition. Idempotent via a dedupe key (submission × section × field), so re-submitting never
  duplicates. We **reuse audit's existing engine** (`extractComplianceItems` /
  `collectSubmissionComplianceItems` / `persistFindingsFromItems` in
  `audit-compliance-sync.service.ts`), generalized to write the generic `Finding` table. **Manual
  "Add finding" stays as a fallback**, but is not the main way findings appear.
- **Auto-generation only exists for modules with a checklist form (matches audit's model).** A module
  gets auto-findings **only if** one of its stage-bound forms has a disposition field (`compliance`
  type, or a `table` with a `compliance_status` column). I mapped this across `kaizen_qms2`: **only
  Supplier Quality** has one today; Inspection / Change Control / Deviation / Complaints / etc. have
  plain forms with no disposition column, and audit's checklists attach via audit's own mechanism (not
  stage bindings). So auto-findings are a **checklist-module feature**: they light up wherever a
  checklist exists, and other modules run **manual-entry-only** until a checklist field is added to
  their form. Full per-module breakdown in Gotcha #15.
- **Mirror audit, but with NO NonConformance step.** The generic flow is **Finding → raise CAPA /
  Deviation** directly — the **Finding itself is the actionable record** (its audit analog is the NC).
  We do **not** build a generic `NonConformance` table and there is **no promote step**. Everything
  else stays audit-shaped: a findings tab/list per ticket, a raise-child action, children nested under
  the parent.
- **No severity gate — observations can raise children too.** Audit blocks `OBSERVATION`-severity
  findings from becoming NCs; the generic flow deliberately drops that restriction. A finding of **any**
  severity (including OBSERVATION) can raise a CAPA/Deviation. Severity stays as an informational field.
- **Child *ticket* types raiseable from a finding: CAPA + Deviation** (both are real `WorkflowType`s,
  each also creatable standalone).
- **Not child-only.** CAPA and Deviation are **full modules in their own right** — each is a
  `WorkflowType` that appears in the sidebar and can be created **directly/standalone** as well as
  from a finding. Raising one from a finding is just an additional entry point that also **links it
  as a child** of the source ticket. (No `isChildOnly` flag — they stay visible everywhere.)
- **Per-module findings register (decided).** Each findings-enabled module gets a **"Findings" tab on
  its `ModulePage`** that lists **every finding across that module's tickets** (faceted filters:
  severity, status, department, source ticket) — the same idea as audit's Findings rollup, but scoped
  to a single module. This is *in addition to* the per-ticket Findings tab. It's just a filtered read
  over the `Finding` table (`workflowType` scope), so it's cheap and additive.
- **Children render nested under the parent — one level only (decided).** When a CAPA/Deviation is
  raised from a finding, it becomes a child of the source ticket (`parentTicketId`) and is displayed
  **below the parent ticket as a nested child** on the parent's detail page. Only **direct** children
  are shown — grandchildren are seen by drilling into the child. See Phase 3 + Gotcha #11.
- **Child Tickets view keys purely off `parentTicketId`** (decided). Only tickets explicitly parented
  — i.e. raised from a finding — nest under the ticket. A CAPA created **directly** from the CAPA
  module (no parent) does **not** appear here, by design. A manual "link an existing ticket as a
  child" action is **out of scope** for now; it can be added later if that need arises.
- **Coexistence, not migration:** audit's existing chain stays as-is. The generic `Finding`
  is designed so audit *could* migrate later, but that migration is **out of scope**.
- **CAPA uses the rich path** (`createCapa` → first-class `Capa` + CAPA workflow ticket);
  **Deviation uses the lightweight `spawnChild`** (a plain child ticket). This matches how
  CAPA vs. plain tickets already differ in the codebase. **Both paths set `parentTicketId` =
  source ticket** so every raised child nests under the parent uniformly. Both link back to the
  originating finding via `sourceFindingId` — replacing what the NC row does in audit.

---

## 4. Implementation phases

### Phase 1 — Data model (Prisma migration)

New generic `Finding` model:

```prisma
model Finding {
  id             String          @id @default(uuid())
  findingNumber  String          @unique          // "F-YYYY-NNNN" via nextNumber()
  sourceTicketId String                            // the module ticket (inspection/CC/etc.)
  sourceTicket   Ticket          @relation("TicketFindings", fields: [sourceTicketId], references: [id], onDelete: Cascade)
  sourceStageId  String?                           // optional: stage it was raised on
  severity       FindingSeverity                   // reuse existing enum
  status         FindingStatus   @default(OPEN)    // reuse existing enum
  title          String
  description    String
  evidence       Json?
  recommendation String?
  reference      String?                           // clause/spec/section ref
  childTickets   Ticket[]        @relation("FindingChildTickets")
  capas          Capa[]          @relation("CapaFinding")
  createdById    String?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  @@index([sourceTicketId])
  @@index([status])
}
```

Additive columns (all nullable → no backfill):

- `Ticket.sourceFindingId String?` + `sourceFinding Finding? @relation("FindingChildTickets", … onDelete: SetNull)`
  and back-relation `findings Finding[] @relation("TicketFindings")`.
- `Capa.findingId String?` + `finding Finding? @relation("CapaFinding", … onDelete: SetNull)`.
- `WorkflowType.supportsFindings Boolean @default(false)` — gates the Findings tab per module.

The existing `Ticket.parentTicketId` / `childTickets` self-relation (`schema.prisma:590-592`) is
reused as-is for the parent→child nesting — no schema change needed there. (No `isChildOnly` flag:
CAPA and Deviation remain full, directly-creatable modules.)

Reuse existing enums `FindingSeverity` / `FindingStatus`. Add RBAC keys
`finding.{read,create,update,delete}` to `backend/src/lib/rbac-catalog.ts`.

### Phase 2 — Backend: new `finding` module

New `backend/src/modules/finding/` (routes / controller / service / schema), mirroring the
audit module:

- **Finding generation from form data (the primary source).** Generalize audit's
  `audit-compliance-sync.service.ts` into a shared `finding-sync.service.ts`:
  `extractComplianceItems` / `collectSubmissionComplianceItems` already read compliance dispositions
  out of any `FormSubmission` — reuse them unchanged; only `persistFindingsFromItems` needs a variant
  that writes the **generic `Finding`** (keyed by `sourceTicketId`) instead of `AuditFinding`, keeping
  the same `dedupeKey` idempotency (stored on `Finding.evidence`) and the NON_CONFORMANCE/OBSERVATION
  filter. **Hook it into the generic form-submission path** — when a form is submitted on a
  `supportsFindings` ticket (and on ticket/stage completion), run the sync best-effort so findings
  appear automatically. Find the submit handler in `backend/src/modules/stage-form` /
  `dynamic-form` (the `FormSubmission` write) and call the sync there, mirroring how audit calls
  `syncSubmissionComplianceFindings` on checklist submit.
- **Manual CRUD (fallback)** scoped to `sourceTicketId`: `GET/POST/PUT/DELETE /findings`,
  `GET /tickets/:id/findings`. A manually-added finding has no `dedupeKey`, so it's never touched by
  the sync.
- **Module register list** — `GET /findings?workflowTypeId=…&severity=…&status=…&department=…` returns
  **every finding across that module's tickets** (join `Finding.sourceTicket` → its flow's
  `WorkflowType`), filtered + paginated, for the per-module Findings register page (Phase 3). Filter
  out `isDeleted` source tickets.
- **`POST /findings/:id/raise-child`** — dispatcher, body `{ childType: 'CAPA'|'DEVIATION', title, description, … }`
  (NC is a table, not a child-ticket type — see Gotcha #14).
  **Every path sets `parentTicketId = finding.sourceTicketId`** so the raised ticket nests under the
  source ticket, plus `sourceFindingId = finding.id` for finding-level linkage:
  - `CAPA` → call shared `createCapa()` (extended with optional `finding_id` **and `parent_ticket_id`**;
    sets `Capa.findingId` + `customFields.finding_id`, and threads `parentTicketId` into the CAPA's
    spawned workflow ticket — see Gotcha #5). Then set that ticket's `sourceFindingId`.
  - `DEVIATION` → resolve the Deviation `WorkflowType`'s active workflow, call
    `spawnChild(finding.sourceTicketId, { childWorkflowId, title, … })` (already sets `parentTicketId`),
    then set the child's `sourceFindingId`.
- **`GET /findings/:id/children`** — the children of that finding (by `sourceFindingId`), for the
  finding-row expander. Distinct from the ticket-level children view below.
- **`GET /tickets/:id/children`** (or extend `getTicket`) — all child tickets of a ticket
  (by `parentTicketId`, `isDeleted=false`), for the "Child Tickets" section on the detail page.
- Extend `createCapa` input/Zod schema with optional `finding_id` **and `parent_ticket_id`**
  (both backward-compatible; audit + OOS callers omit them).
- Extract `nextNumber` / `withUniqueRetry` from `capa.service.ts` to a shared util (or duplicate).
- Register routes in `backend/src/app.ts`.

### Phase 3 — Frontend: reusable Findings tab + Raise-Child

- `client/src/lib/api/finding.ts` — React Query hooks (list / raiseChild / children, plus create /
  update / delete for the manual fallback).
- **`<FindingsTab ticketId workflowTypeId />`** in `client/src/features/tickets/detail/` — primarily a
  **read + act** view (not a data-entry form): it lists the findings **auto-generated from the ticket's
  checklist** (via the generic `DataTable`), showing each item's disposition/severity and its source
  checklist item. Per-row **"Raise CAPA / Deviation"** opens shared **`<RaiseChildDrawer>`**. A
  secondary **"Add finding"** (shared `<FindingDrawer>`) covers the manual fallback. These extract the
  currently-inlined audit drawers into reusable components. This matches audit, where the tab surfaces
  generated dispositions rather than asking the user to type findings.
- **Child-tickets display** — a `<ChildTicketsCard>` (generic, parent-ticket-scoped) listing all
  child tickets by `parentTicketId`: each row shows the child's `uniqueId`, title, module
  (workflow-type), current stage/status, and which finding it came from, linking to the child
  (CAPA → `/audit/capa/:id` when it backs a first-class Capa, else `/tickets/:id`). Generalizes
  today's audit-only `AuditCapaChildrenCard.tsx` (which lists by `registerId`).
  **Placement (grounded in the live UI):** the detail sidebar already has a **"Linked Records"**
  card (`TicketSidebar.tsx:81-117`) that renders the workflow + the **parent** ticket (or
  "No parent ticket"). Extend that same card with a **"Child records"** list directly under the
  parent line — the minimal, consistent home for the reverse direction. If a richer nested view is
  wanted, additionally render `<ChildTicketsCard>` as a full-width section **below the tab body** in
  the main column. Recommend starting with the Linked Records extension; add the below-body section
  only if the sidebar list feels cramped.
- Backend + client type change: include `childTickets` in the ticket payload (or a
  `useTicketChildren(id)` hook) — `getTicket` currently returns `parentTicket` but **not**
  `childTickets` (`ticket.service.ts:73`), and the client `Ticket` type (`ticket.ts:52`) has no
  children field. Add both.
- Wire into `client/src/features/tickets/TicketDetailPage.tsx`: render `<ChildTicketsCard>` below the
  ticket body, and add a conditional **Findings** tab
  to `TABS` (line 24) when the ticket's `WorkflowType.supportsFindings` is true. The page has
  `typeId` (`ticket.flows[0].workflow.typeId`, line 56) but must also call `useWorkflowTypes()`
  to read the flag (see Gotcha #1). Gate actions on the new `finding.*` permissions.
- Add `supportsFindings` to the client `WorkflowType` interface (`workflowLookups.ts:7`) and to
  the backend workflow-types list response.
- **Per-module Findings register** — add a **"Findings" tab to `ModulePage.tsx`** (shown only when the
  module's `supportsFindings` is true), rendering a filtered `DataTable` over
  `GET /findings?workflowTypeId=<this module>` with facets (severity / status / department / source
  ticket) and a row link to the source ticket's Findings tab. This is the module-level rollup —
  audit's Findings tab, generalized. Reuses the same `finding.ts` hooks.

### Phase 4 — Config & checklists for the four scoped modules

The modules **already exist** in `kaizen_qms2` with active workflows + tickets (verified via
Playwright), so this phase is **flagging + adding checklists**, not creating modules:

- Set `supportsFindings = true` on the four scoped modules: **Inspection, Supplier Quality, Change
  Control, Deviation**. A one-off SQL/seed update, plus an admin toggle for future types.
- **Add a compliance checklist to the three that lack one.** Supplier Quality already has a checklist
  form (2 forms with `compliance_status`). **Inspection, Change Control, Deviation** need a checklist
  field added to one of their stage forms — either a `table` field with a `compliance_status` column
  or a scalar `compliance` field (the two shapes audit's sync already understands, Gotcha #15).
  Pick the natural stage per module (e.g. Inspection's "Inspection Testing", Change Control's
  assessment/review stage). Edit the bound `Form` (add the field) so submissions carry dispositions.
- **CAPA** and **Deviation** are the child types raised from a finding — both already exist as
  `WorkflowType`s with active workflows in `kaizen_qms2` (CAPA has 7). No NC type is needed (Gotcha #14).
  (Deviation is both a source module *and* a raiseable child type — fine; it's just a `WorkflowType`.)
- Admin toggle for `supportsFindings` in `client/src/features/admin/workflow-types/WorkflowTypesTab.tsx`.
- `syncWorkflowTypePermissions()` already minted `wf_type.<id>.*` keys for every existing type.

### Phase 5 — Verify end-to-end

Use `/run` (or `/verify`) to drive: create an Inspection ticket → fill its **checklist form** marking
an item **Non-Conformance** and another **Observation** → submit → **confirm findings were
auto-generated** from those items on the Findings tab (and that re-submitting doesn't duplicate them) →
Raise CAPA from a generated finding (confirm first-class `Capa` + CAPA workflow ticket, **and that the
CAPA ticket's `parentTicketId` = the Inspection ticket**) → Raise Deviation (confirm child ticket with
`parentTicketId` + `sourceFindingId` + `CHILD_TICKET_SPAWNED`) → confirm the **Child Tickets section
renders all of them nested below the parent** and each links to the right detail page. Also confirm
each child type can still be created **directly** from its own module. Repeat across the four scoped
modules (Inspection, Supplier Quality, Change Control, Deviation) — Supplier Quality is the useful
regression check since its checklist already exists.

### Phase 6 — LATER (future): generic per-stage checklist → child-ticket creation

Not in the current scope — captured so we build Phases 1–5 in a way that extends to it.

Today (Phases 1–5) findings come from a **checklist form** and the four scoped modules get one. The
future generalization: let **any workflow attach a checklist to a specific stage**, and have that
stage expose a **UI to raise a child ticket** (pick one of the workflow types — CAPA / Deviation /
etc.) directly from the checklist's failed items — so a module doesn't need a hand-built checklist
form; it's configured per stage.

- **Reuses an engine primitive that already exists:** `ChildWorkflowTrigger`
  (`schema.prisma:769-782`) already models "on this stage, a child workflow can be triggered"
  (`triggerMode` MANUAL/…, `isBlocking`, `allowMultiple`). The backend `spawnChild` is wired; there's
  just **no stage-level UI** for it yet. Phase 6 = attach a checklist to the stage + surface the
  "raise child" action there, driven by the stage's configured `ChildWorkflowTrigger`s.
- **Shape:** in the workflow builder, a stage gains (a) an optional checklist config and (b) a list of
  allowed child workflow types. At runtime, the ticket's stage view shows the checklist and a
  "Raise <type>" control for each configured trigger; raising goes through the same `raise-child`
  path built in Phase 2 (so `parentTicketId` / `sourceFindingId` linkage and the nested child display
  all just work).
- **Why deferred:** it needs workflow-builder UI + stage-config schema work on top of Phases 1–5.
  Building Phases 1–5 on the generic `Finding` + `raise-child` + `parentTicketId` foundation means
  Phase 6 is additive (a new entry point into the same machinery), not a rewrite.

---

## 5. Gotchas & side effects (verified against code)

1. **Frontend must expose `supportsFindings`.** `TicketDetailPage` today only knows `typeId`
   (`TicketDetailPage.tsx:56`); it doesn't fetch the `WorkflowType`. To show the tab it must call
   `useWorkflowTypes()` and look up the flag, **and** the backend workflow-types list + client
   `WorkflowType` interface (`workflowLookups.ts:7`) must carry the new field. Small extra fetch,
   but easy to miss on both ends.

2. **New `finding.*` permissions only auto-grant to SUPER_ADMIN.** `ensureRbacCatalog()`
   (`backend/src/lib/rbac-sync.ts:43`) upserts catalog keys on startup and guarantees SUPER_ADMIN
   holds everything, but **deliberately leaves other roles untouched**. QA/reviewer roles won't
   see the Findings tab or be able to create findings until an admin grants the keys via the UI
   (or a seed adds them). Same for the child-raise keys (`capa.create`, and the Deviation
   `wf_type.<id>.create`).

3. **Child WorkflowTypes need an ACTIVE, published workflow with an initial stage.** `raiseTicket`
   (`backend/src/modules/workflow/engine/orchestrator.ts:136-144`) throws if the workflow isn't
   `ACTIVE` or has no `isInitialStage`, so "Raise CAPA/Deviation" would fail at runtime without one.
   Verified: CAPA and Deviation both already have active workflows in `kaizen_qms2`, so this is
   satisfied today — just re-check if either type is ever deactivated.

4. **CAPA workflow spawn is best-effort.** `createCapa` only spawns + links the CAPA ticket when an
   `ACTIVE` `WorkflowType` named exactly `'CAPA'` exists (`resolveCapaWorkflowId`,
   `capa.service.ts:89`); otherwise the `Capa` row is created with **no** workflow ticket and falls
   back to the legacy enum stepper. So "Raise CAPA" from a finding still works without the CAPA
   workflow, but the CAPA won't run on the engine — ensure the CAPA workflow is published per env.

5. **`createCapa` is shared by audit + OOS — extend, don't break.** Adding `finding_id` **and
   `parent_ticket_id`** to `CapaCreateInput` must be `.optional()` in the Zod schema; both existing
   callers (`audit.routes.ts:139`, `oos.service.ts:148`) omit them. Threading `parent_ticket_id` also
   means passing it down `createCapa → raiseCapaWorkflowTicket → engineRaiseTicket` (which already
   accepts `parentTicketId`, `orchestrator.ts:107`) so the CAPA's spawned workflow ticket nests under
   the source ticket. **Without this, a CAPA raised from a finding would NOT appear as a child** —
   `createCapa` today spawns a standalone CAPA ticket with no parent (`capa.service.ts:106-142`).
   `Capa.findingId` and `Capa.nonConformanceId` are both nullable — a generic-finding CAPA sets
   `findingId` only; an audit CAPA sets `nonConformanceId` only. Don't let both be set for one CAPA.

6. **`nextNumber` / `withUniqueRetry` are private to `capa.service.ts`** (lines 23, 42). The finding
   module needs its own sequential numbering; extract these to a shared util (cleaner, small blast
   radius) or duplicate. Keep the unique-retry to survive concurrent inserts.

7. **Prisma relation-name uniqueness.** `Ticket` will gain `sourceFinding` + `findings` alongside
   existing `parentTicket` / `childTickets` / `nonConformanceCapa`; `Capa` gains `finding` alongside
   `nonConformance`. Each `@relation` name must be unique per model. Use `onDelete: SetNull` for
   `Ticket.sourceFindingId` and `Capa.findingId` (deleting a finding must not nuke a raised
   CAPA/child), and `Cascade` for `Finding.sourceTicket`.

8. **Soft-delete interaction.** Tickets use `isDeleted` (soft delete), not row deletion, so
   `Finding.sourceTicket onDelete: Cascade` rarely fires. Findings-list and children queries must
   filter `isDeleted` so a soft-deleted inspection doesn't leak findings and the children card hides
   soft-deleted children (mirror existing ticket-query filters).

9. **Two findings surfaces (both included).** (a) A **per-ticket** Findings tab on the ticket detail
   (the findings of that one inspection/CC record), and (b) a **per-module** Findings register tab on
   `ModulePage` (every finding across that module's tickets, filtered). The per-module register is the
   direct analog of audit's module-level Findings rollup; there is **no** single cross-module screen.

10. **New WorkflowTypes auto-surface in the sidebar + get a full generic ModulePage** — this is
    intended. `useWorkflowTypes()` drives the sidebar (`client/src/components/layout/Sidebar.tsx:223-241`),
    so Inspection/Change Control/Deviation/CAPA all appear as nav items with complete module pages,
    and each can be created **directly/standalone**. Raising one from a finding is an extra entry point
    that additionally links it as a child — it does **not** make the type child-only.

11. **Child display keys off `parentTicketId`; the CAPA path is the trap.** Deviation via
    `spawnChild` sets `parentTicketId` for free. CAPA via `createCapa` does **not** unless
    `parent_ticket_id` is threaded through (Gotcha #5) — so the "Child Tickets" section, which lists
    by `parentTicketId`, would silently miss CAPAs otherwise. The section links a child to
    `/audit/capa/:id` when the child ticket backs a first-class `Capa` (look it up via
    `Capa.workflowTicketId`), else `/tickets/:id`. Filter `isDeleted`. `sourceFindingId` records which
    finding a child came from (shown in the row); `GET /findings/:id/children` uses it for the
    per-finding expander.

12. **Migration safety.** All schema changes are additive: one new table, nullable columns, one
    boolean default. No backfill, no impact to the legacy `quantumkaizen` DB. Applies to `kaizen_qms2`
    (the active all-modules DB, already schema-in-sync across all 46 migrations).

13. **Pre-existing render loop on the ticket-detail page — FIXED (2026-07-16).** Playwright traced the
    repeating *"Maximum update depth exceeded"* error to `useCountdown` (`client/src/hooks/useCountdown.ts`):
    its effect listed `deadlineDate` (a fresh `Date` object built every render) in its dependency
    array, so it re-ran every render and `setState(compute())` (a new object each call) re-rendered,
    looping forever. Only bit ticket-detail pages with an **active SLA timer** (like the Inspection
    tickets). Fixed by depending only on the primitive `deadlineMs` and rebuilding the `Date` inside
    the effect; verified 0 console errors + SLA countdown still renders. Still: keep the new
    Findings tab/children effects on stable deps so nothing like this returns.

14. **No NC entity in the generic flow (decided).** Audit has `Finding → promote → NonConformance →
    CAPA`. The generic flow **drops the NC step**: the **Finding is the actionable record** and CAPA /
    Deviation are raised **directly** from it. No generic `NonConformance` table, no promote step, and
    **no severity gate** (unlike audit, an `OBSERVATION` finding can still raise a child). The
    raise-child dispatcher's `childType` is `'CAPA' | 'DEVIATION'`. The link the NC row provided in
    audit is replaced by `Ticket.sourceFindingId` / `Capa.findingId`.

15. **Auto-generation only applies to modules that have a CHECKLIST form — and today almost none do.**
    Auto-generation reads compliance dispositions (a `table` column named `compliance_status`, or a
    scalar `compliance` field) out of `FormSubmission` responses. I mapped every module's stage-bound
    forms in `kaizen_qms2` (StageFormBinding → Form → FormField):

    | Module | Stage-bound forms | …with a `table` field | …with a `compliance_status` (checklist) |
    |---|---|---|---|
    | **Supplier Quality** | 12 | 6 | **2** ✅ |
    | Inspection | 12 | 2 | 0 |
    | Change Control | 12 | 2 | 0 |
    | Deviation | 12 | 4 | 0 |
    | Complaints | 12 | 2 | 0 |
    | CAPA | 15 | 10 | 0 |
    | Everything else | — | some | 0 |

    So **only Supplier Quality** currently has a disposition checklist bound to a stage. Audit's 14
    checklists exist but attach via audit's **bespoke** mechanism (register `checklistFormId` /
    program `checklistSubmissionId`), **not** `StageFormBinding` — which is why Audit shows 0 here.
    Every other module has plain `table` fields (data grids), not compliance checklists.

    **Implication:** findings auto-generate **only where a bound form has a `compliance_status`
    column**. Out of the box that's **Supplier Quality only**; every other module has the Findings tab
    in **manual-entry mode** until a checklist field is added. This matches the intent: *auto-findings
    live only on checklist-style modules, like audit.* **Decided (Phase 4):** add a checklist field to
    **Inspection, Change Control, Deviation** (Supplier Quality already has one); the rest stay
    manual-only until they get a checklist (the Phase 6 generic mechanism handles them later).

16. **Where to hook the generation.** Audit calls its sync from audit-specific entry points
    (checklist submit, program/ticket completion). The generic version must hook the **shared**
    `FormSubmission` write path (`stage-form` / `dynamic-form`) so any `supportsFindings` ticket
    triggers it — and must be **best-effort** (a sync failure must never block the form submit or a
    workflow transition), exactly as audit's callers swallow errors.

---

## 6. Open questions

- ~~NC table / promote step?~~ **Resolved:** no NC table, no promote step, no severity gate — a Finding
  of any severity raises CAPA/Deviation directly (Gotcha #14).
- ~~Cross-module vs per-ticket findings view?~~ **Resolved:** each findings-enabled module gets its
  own **per-module findings register** (a "Findings" tab on that module's `ModulePage`, listing every
  finding across that module's tickets with filters) — mirrors audit's Findings rollup, scoped to one
  module. Not a single cross-module screen. See Phase 3.
- ~~Child view recursive or one level?~~ **Resolved:** **one level** — a ticket shows only its direct
  children. Drill into a child to see its own children. (Even though a Deviation raised from an
  Inspection can itself have findings/children, we don't render the full tree.)
