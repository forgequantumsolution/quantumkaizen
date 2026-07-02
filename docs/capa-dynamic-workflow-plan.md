# CAPA — Dynamic Workflow-Driven Redesign

Plan for reworking the CAPA module so its lifecycle is driven by the dynamic
workflow engine (the same engine that powers tickets), and rebuilding the CAPA
detail page to a richer, data-backed design.

## Goals

- Drive CAPA phases from the **dynamic workflow engine** (admin-configurable
  stages, forks/joins, SLA, approvals, per-stage forms) instead of the fixed
  `CapaStatus` enum.
- Render the flow the **same way whether the CAPA is complete or not** — a
  compact current-stage strip inline plus the full DAG in a "View workflow"
  modal (**hybrid**).
- Keep CAPA-domain data (5-Why + fishbone, action items, 30/60/90 effectiveness
  check-ins) **fully persisted**, layered on top of whatever workflow is bound.
- Build the presentation as **custom Tailwind**, reusing existing ticket
  infrastructure where possible (antd only for form controls / tables / modals).

## Decisions (locked)

| Question | Decision |
| --- | --- |
| Phase source | **Full dynamic workflow (DAG)** — bind CAPA to the workflow engine |
| Flow rendering | **Hybrid** — inline current-stage strip + full graph canvas in a modal |
| Data depth | **Fully data-backed** — RCA + effectiveness persisted |
| Build style | **Custom Tailwind** components |

## Architecture: spawn-and-link (the AuditRegister pattern)

`Capa` stays a first-class row, but a **workflow `Ticket` drives its
lifecycle**. The CAPA links to that ticket and reads stage progress from it.
This reuses the entire engine (stages, transitions, SLA, approvals, per-stage
forms, real stage history) with no re-implementation, and follows code that
already ships: `AuditRegister` does exactly this via `workflowId` +
`workflowTicketId` + `workflowTicketUniqueId`
(`backend/prisma/schema.prisma:1668`).

```
NonConformance ──raise──▶ Capa (row: RCA, actions, effectiveness)
                            │  workflowId, workflowTicketId ─┐
                            ▼                                 ▼
              engineRaiseTicket(CAPA workflow) ──▶ Ticket + TicketFlow(currentStages[])
                                                        │
                       detail page reads flow_json + currentStages ──▶ hybrid stepper
```

### Why not the alternatives

- **Fixed `CapaStatus` enum + segmented bar** — simplest, but not
  admin-configurable and no SLA/approvals/per-stage forms. Rejected.
- **CAPA *is* a Ticket** (legacy `NonConformance.capaTicket` bridge,
  `schema.prisma:1777`) — works, but loses the first-class `Capa` object that
  owns RCA/actions/effectiveness. Rejected in favour of spawn-and-link.
- **Add a `CapaFlow`/`CapaStageTracking` mirror of the ticket tables** — cleanest
  domain object, but re-implements the flow engine for a second entity. Rejected
  as too much duplicated surface.

## What's dynamic vs. fixed

- **Dynamic (from the workflow):** phases, order, branches/forks, current
  stage(s), allowed actions, SLA, approvals, per-stage forms, stage history.
- **Fixed (CAPA domain):** RCA (5-Why / fishbone), action items, effectiveness
  check-ins, NC linkage — these ride on top of whatever workflow is bound.

## Relevant existing code

| Concern | Location |
| --- | --- |
| CAPA detail page (to be rewritten) | `client/src/features/audit/CapaDetailPage.tsx` |
| CAPA API types + hooks | `client/src/lib/api/audit.ts` (`Capa` at :997) |
| CAPA service (raise/status/NC-sync) | `backend/src/modules/audit/capa.service.ts` |
| Workflow / stage / transition models | `backend/prisma/schema.prisma:339-505` |
| Ticket ↔ workflow binding | `TicketFlow` / `TicketStageTracking` (`schema.prisma:620-668`) |
| Raise-ticket orchestrator | `backend/src/modules/workflow/engine/orchestrator.ts:110` |
| AuditRegister precedent | `schema.prisma:1668-1673`; audit-register service `engineRaiseTicket` |
| Flow graph canvas (reuse) | `client/src/features/tickets/detail/TicketFlowCanvas.tsx` |
| Current-stage strip (adapt) | `client/src/features/tickets/detail/StageStripBar.tsx` |
| Ticket hooks (reuse) | `client/src/lib/api/ticket.ts` — `useTicket`, `useAllowedActions`, `useTransition` |
| Workflow hook (reuse) | `client/src/lib/api/workflow.ts` — `useWorkflow` (returns `flow_json`) |

## Implementation plan

### Step 0 — Seed the CAPA workflow ✅ DONE

Added to `backend/prisma/seed.ts` (idempotent by workflow name + form
`templateKey`):

- **`CAPA` WorkflowType** (code prefix `CAPA-`).
- **`CAPA Handling v1`** workflow — `APPROVED / ACTIVE`, 6 linear stages, 5
  transitions, each stage with a **REQUIRED** bound form.

| Stage (`canonicalId`) | → `CapaStatus` | Required form (fields) | Fill / View | Actions |
| --- | --- | --- | --- | --- |
| Initiation `capa-initiation` (start) | OPEN | CAPA Initiation (6) | QE / QMS_ADMIN, AUDITOR | Approve/Forward |
| Investigation & Root Cause `capa-investigation` | INVESTIGATION | Root Cause Analysis (8 — 5-Why + category) | QE / … | Forward, Return |
| Action Plan `capa-action-plan` | PLAN | CAPA Action Plan (5) | QE / … | Forward, Return |
| Implementation `capa-implementation` | IMPLEMENTATION | Implementation Record (4) | QE / … | Forward, Return |
| Effectiveness Verification `capa-verification` | VERIFICATION | Effectiveness Verification (5 — 30/60/90) | QE / … | Forward, Return |
| Closure `capa-closure` | CLOSED | CAPA Closure (4 — QA sign-off) | QMS_ADMIN / QE, AUDITOR | Approve/Forward |

Stage `canonicalId`s deliberately line up with the `CapaStatus` enum so the
later stage→status sync is a straight map. The existing `rca-5whys` e2e fixture
form was **not** touched (this is a separate `capa-rca` form).

Run with `npm run db:seed` (backend). Active DB: `localhost/kaizen_qms`.

### Step 1 — Data model

Add to `Capa` (mirror `AuditRegister`), plus CAPA-domain JSON:

- `workflowId String?`
- `workflowTicketId String?`
- `workflowTicketUniqueId String?`
- `effectivenessData Json?` — 30/60/90 check-ins `{ checkIns: [{ day, status, notes }] }`
  (RCA already has `rootCauseData Json?`).

Keep `CapaStatus` as a **derived mirror** synced from the ticket's current stage,
so existing list filters, badges (`auditStatusBadge.tsx`) and NC-close logic keep
working. The stepper renders from the workflow, not the enum.

Run `prisma migrate dev` against `kaizen_qms`.

### Step 2 — Backend: raise + sync ✅ DONE

Implemented in `backend/src/modules/audit/capa.service.ts`:

- **Raise on create** — `createCapa` resolves the latest ACTIVE `CAPA`-type
  workflow (`resolveCapaWorkflowId`) and calls the orchestrator's
  `engineRaiseTicket`, persisting `workflowId` / `workflowTicketId` /
  `workflowTicketUniqueId` onto the `Capa`. Best-effort (try/catch) so a missing
  or inactive workflow never blocks CAPA creation. The ticket carries
  `capa_id` / `capa_number` / `non_conformance_id` in `customFields`.
- **Stage → status sync** — `syncCapaStatusFromTicket` maps the ticket flow's
  current stage `canonicalId` (or `isCompleted`) to a `CapaStatus` via
  `CAPA_STATUS_FOR_STAGE`, and updates the `Capa` (+ `implementedAt`/`closedAt`
  + NC-sync) when it differs. Called from `getCapa`, so opening a CAPA reflects
  transitions performed on the ticket. Never overrides a manual `CANCELLED`; the
  ticket owns the authoritative audit trail (no duplicate CAPA trail entry).
- **Response fields** — `serializeCapa` now exposes `effectiveness_data`,
  `workflow_id`, `workflow_ticket_id`, `workflow_ticket_unique_id`. The frontend
  fetches current stages / graph via the existing ticket + workflow hooks using
  `workflow_ticket_id` (no flow summary embedded in the CAPA response).
- **Effectiveness persistence** — `effectiveness_data` added to
  `CapaUpdateSchema` + `updateCapa`, and to the `Capa` / `CapaUpdate` frontend
  types in `client/src/lib/api/audit.ts`.

Verified end-to-end: creating a CAPA spawns `CAPA-FQS-00N` on `CAPA Handling v1`
sitting on `capa-initiation` (status → OPEN), links persist, `getCapa` syncs
correctly. Backend `tsc --noEmit` clean.

> Note: list views (`listCapas`) are not per-item synced (avoids N extra
> queries); the mirror updates when a CAPA is opened or transitioned. Manual
> `updateCapaStatus` (the legacy "Advance") remains for CAPAs with no workflow.

### Step 3 — Frontend: dynamic CAPA detail page ✅ DONE (pending live review)

Implemented. `client/src/features/audit/CapaDetailPage.tsx` rewritten to compose a
new `features/audit/capa/` folder, reusing ticket infra. Decision taken: **keep
bespoke editors too** (fishbone + 30/60/90) alongside the workflow forms.

New files:
- `capa/capaData.ts` — typed parsers for `rootCauseData` (5-Why + fishbone +
  conclusion) and `effectivenessData` (30/60/90 check-ins).
- `capa/Fishbone.tsx` — read-only SVG Ishikawa diagram (6 categories).
- `capa/RootCauseTab.tsx` — 5-Why inputs + fishbone diagram + per-category cause
  editors + corrective/preventive text; saves to `root_cause_data`.
- `capa/EffectivenessTab.tsx` — 30/60/90 pending/pass/fail cards + notes; saves to
  `effectiveness_data`.
- `capa/CapaSidebar.tsx` — Metadata / Linked Records / Key Dates.
- `capa/CapaWorkflowBand.tsx` — hybrid flow: current-stage strip + "View workflow"
  modal (`TicketFlowCanvas`) + `ActionBar` transitions; "Run on workflow" attach
  button when unlinked.

Reused ticket components: `ActionBar`, `TicketFlowCanvas`, `StageFormSection`,
`TicketFormHistory`. Tabs: Details, **Stage Forms** (only when workflow-linked),
Root Cause, Actions (+ timeline), Effectiveness, History (audit trail + e-sig).

Backend support added for testing/migration (Step 4 pulled forward):
`POST /audit/capas/:id/workflow` → `attachCapaWorkflow` (extracted
`raiseCapaWorkflowTicket` helper shared with create). Frontend hook
`useAttachCapaWorkflow`.

Both frontend + backend `tsc --noEmit` clean. **Verified via Playwright**
(`tests/e2e/capa-workflow.spec.ts`): creating a CAPA raises + links a ticket
(status OPEN), and the detail page renders the flow band (current = Initiation),
the Root Cause 5-Why + fishbone, the 30/60/90 Effectiveness cards, the seeded
"CAPA Initiation" stage form, and the "View workflow" modal showing the full
6-stage DAG with the current stage highlighted. Screenshots under `test-results/`.

Original tab intent (for reference):

- **Hybrid flow:**
  - Inline: adapt `StageStripBar` → current-stage chips + SLA mini + "View
    workflow", styled to match the header band.
  - Modal: reuse `TicketFlowCanvas` as-is — it renders the DAG from `flow_json`
    and already supports `isCompleted` (all-green) and `isCurrent` highlighting,
    i.e. the same flow whether the CAPA is done or not.
- **Header "Advance" → real transitions:** replace the linear enum bump with
  `useAllowedActions(ticketId)` + `useTransition(ticketId)` — actions gated by
  role/criteria, with approvals/SLA handled by the engine.
- **Tabs:**
  - **Details** — mockup grid (description, source, dept, product/process,
    owner, due, severity, status).
  - **Root Cause** — numbered 5-Why list + custom SVG fishbone (Ishikawa) with
    the 6 category cards, read/write off `rootCauseData`.
  - **Actions** — action-items table + Gantt-style timeline (derived from action
    due/completed dates + status).
  - **Effectiveness** — 30/60/90 check-in cards (pending/pass/fail + notes),
    persisted to `effectivenessData`.
  - **History** — vertical timeline sourced from real `TicketStageTracking`
    (entered/exited/duration/who) plus the audit trail + e-signatures.
- **Sidebar:** Metadata (Owner, Dept, Created, Age, Created By) / Linked Records
  (Source NC, Risk Register) / Key Dates (Initiated, Due, Last Updated).

### Step 4 — Migration & fallbacks ✅ DONE

- **Attach action** — `POST /audit/capas/:id/workflow` → `attachCapaWorkflow`
  (shared `raiseCapaWorkflowTicket` helper), frontend `useAttachCapaWorkflow`.
  Guarded **OPEN-only**: a freshly-raised ticket starts on the initial stage, so
  attaching a mid-lifecycle CAPA would drive the status mirror back to OPEN —
  rejected with 400. Also 400 if already linked.
- **Legacy fallback** — unlinked CAPAs render `capa/CapaEnumStepper.tsx` (the
  segmented Open→…→Closed bar) plus the manual "Advance →" control
  (`updateCapaStatus`) and a "Run on workflow" button shown **only when OPEN**.
  No "Stage Forms" tab for unlinked CAPAs.
- **Workflow selection** — defaults to the one canonical `CAPA` `WorkflowType`
  (`resolveCapaWorkflowId`); a per-CAPA picker is deliberately deferred.

Verified via Playwright (`tests/e2e/capa-workflow.spec.ts`, 2nd test): API guards
return 400 ("Only OPEN…" / "already runs…"), and a seeded `INVESTIGATION` CAPA
renders the enum stepper + Advance with no attach button. Screenshot
`test-results/capa-06-legacy-fallback.png`.

> Note: mid-lifecycle seeded CAPAs stay on the legacy enum path — a
> status-preserving bulk migration (raise ticket + reposition flow to the
> matching stage) was scoped out; opt-in attach is OPEN-only.

## Sequencing

1. Seed CAPA workflow + stage forms ✅
2. Schema fields + migration (`workflowId`, `workflowTicketId`, `effectivenessData`) ✅
3. Backend raise-on-create + stage→status sync + expanded detail response ✅
4. Frontend shell + hybrid strip/canvas ✅
5. Transitions wired to allowed-actions ✅
6. Tabs (RCA/fishbone, Actions timeline, Effectiveness, stage-tracking History) ✅
7. Verify end-to-end against a raised CAPA ticket ✅ (Playwright, screenshots)

## Open items to confirm before building beyond Step 0

- Confirm fallback behaviour for pre-existing enum-only CAPAs (attach-workflow
  migration path).
- Confirm one canonical CAPA workflow vs. selectable-per-CAPA at raise time.
