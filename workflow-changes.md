# Workflow System — Implementation Changelog

Running log of every backend and frontend change made to port the Django workflow engine (`core-prod-scaling/backend/workflows/`) to the Node/TS/Prisma backend and the React/Vite frontend.

**Convention:**
- Each phase has a section: backend changes, frontend changes, verification.
- New entries are appended chronologically inside their phase.
- File paths are repo-relative.

---

## Index

- [Phase 1 — Backend: Workflow Builder](#phase-1--backend--workflow-builder) — **DONE**
- [Phase 1 — Frontend: Builder UI integration](#phase-1--frontend--builder-ui-integration) — pending
- [Phase 2 — Backend: Tickets + Engine](#phase-2--backend--tickets--engine) — pending
- [Phase 2 — Frontend: Ticket UI](#phase-2--frontend--ticket-ui) — pending
- [Phase 3 — Backend: Approvals + SLA](#phase-3--backend--approvals--sla)
- [Phase 3 — Frontend: Approval & SLA UI](#phase-3--frontend--approval--sla-ui)
- [Phase 4 — Backend: Audit + E-Signatures](#phase-4--backend--audit--e-signatures)
- [Phase 4 — Frontend: Audit log + signature modal](#phase-4--frontend--audit-log--signature-modal)
- [Phase 5 — Backend: Audit Scheduling + Dashboards](#phase-5--backend--audit-scheduling--dashboards)
- [Phase 5 — Frontend: Schedule admin + dashboards](#phase-5--frontend--schedule-admin--dashboards)

---

# Phase 1 — Backend — Workflow Builder

**Status:** ✅ Complete (smoke-tested on 2026-05-08)
**Plan doc:** [`docs/WORKFLOW_PHASE_1_PLAN.md`](docs/WORKFLOW_PHASE_1_PLAN.md)
**Master plan:** [`docs/WORKFLOW_MASTER_PLAN.md`](docs/WORKFLOW_MASTER_PLAN.md)

## P1.1 — Prisma schema additions

**File:** `backend/prisma/schema.prisma`

### Enums added (6)

```prisma
enum WorkflowApprovalStatus  { PENDING APPROVED REJECTED }
enum WorkflowLifecycleStatus { ACTIVE INACTIVE DRAFT DRAFT_UPDATE }
enum StageType               { STAGE FORK JOIN DECISION AUDIT_FORMS }
enum SplitType               { AND OR XOR }
enum JoinType                { AND OR }
enum StageActionBehavior     { FORWARD REJECT HOLD UNHOLD RETURN REASSIGN }
```

### Tables added (11)

| Table | Purpose |
|---|---|
| `WorkflowType` | Workflow categories (e.g. "Document Review"). Has `codePrefix` for ticket ID generation. |
| `WorkflowIconConfig` | 1:1 to `WorkflowType` — icon name for builder UI |
| `WorkflowStageStatus` | Named action statuses with `behavior` enum (Approve/Reject/Hold/Unhold/Return/Reassign) |
| `ActionType` | Lookup (reserved for engine phase) |
| `ActionCriteria` | Soft-RBAC criteria (default seeded: "Anyone") |
| `Priority` | Ticket priority lookup (Low/Medium/High/Urgent) |
| `Workflow` | Workflow definition root, versioning chain via `previousVersionId`/`parentWorkflowId`, lifecycle status |
| `WorkflowStage` | DAG node — has `canonicalId` stable cross-version; type/split/join enums |
| `WorkflowStageAction` | Action attached to a stage; m2m to `Role` and `User` for `allowedRoles` / `allowedUsers` |
| `WorkflowTransition` | DAG edge — has `sourcePort`, `targetPort` for fork branches, `branchOrder`, `condition` (for XOR) |
| `TemporaryWorkflow` | Single autosave row per workflow (`workflowId @unique`); opaque `flowJson` |

### Tables modified (back-relations only)

- `User` — added `workflowsCreated`, `workflowsDeleted`, `stageActions`
- `Role` — added `stageActions`

### Migration

- Created migration: `npx prisma migrate dev --name workflow_phase1` (user ran)
- Migration directory under `backend/prisma/migrations/`

## P1.2 — Seed updates

**File:** `backend/prisma/seed.ts`

### Permissions added (6)

```ts
'workflow.read',           'workflow.create',         'workflow.update',
'workflow.delete',         'workflow.lookups.read',   'workflow.lookups.manage'
```

### Permission grants

- `SUPER_ADMIN`, `QMS_ADMIN`: all 6 (auto, by existing filter)
- `QUALITY_ENGINEER`, `AUDITOR`, `DOCUMENT_CONTROLLER`, `READ_ONLY`: `workflow.read` + `workflow.lookups.read`

### Seed data added

- `WorkflowStageStatus` — 6 default rows (Approve / Forward, Reject, Hold, Resume, Return, Reassign)
- `Priority` — 4 rows (Low, Medium, High, Urgent)
- `ActionCriteria` — 1 row ("Anyone")

## P1.3 — Source files added

### `backend/src/modules/workflow/`

| File | LoC | Purpose |
|---|---|---|
| `workflow.schema.ts` | ~140 | Zod input schemas — node/edge passthrough shape, save body, layout body, list/compare queries |
| `workflow.validator.ts` | ~210 | 9 structural checks: non-empty, single initial, valid edges, no orphans, fork structure, join structure, balanced fork/join, no cycles (Kahn's), unique stage names |
| `workflow.builder.ts` | ~210 | Three-pass save: stages+actions → fork/join wiring → transitions; identifier helpers (`toIdList`); `applyWorkflowSettings` |
| `workflow.versioning.ts` | ~330 | `cloneIntoNewVersion`, `listVersions` (lineage walk), `compareVersions` (canonical-id match), `saveLayout` |
| `workflow.service.ts` | ~410 | List/get/createShell/save/softDelete/upsertDraft/getDraft. `WorkflowValidationError` class. `prisma.$transaction` w/ 30s timeout. |
| `workflow.controller.ts` | ~95 | Thin HTTP handlers with `WorkflowValidationError` → 400 mapping |
| `workflow.routes.ts` | ~95 | Express router; `/compare` route registered before `/:id` to avoid catch-all conflict |
| `workflow.openapi.ts` | ~245 | Full OpenAPI 3.1 registrations under `Workflows` tag |

### `backend/src/modules/workflow/lookups/`

| File | LoC | Purpose |
|---|---|---|
| `lookups.schema.ts` | ~40 | Zod for create-workflow-type, create-stage-status, named-input |
| `lookups.service.ts` | ~135 | CRUD across 5 lookup tables (`WorkflowType`, `WorkflowStageStatus`, `ActionType`, `ActionCriteria`, `Priority`); soft delete with reactivation on re-create |
| `lookups.controller.ts` | ~50 | Thin handlers |
| `lookups.routes.ts` | ~70 | Express router under `/api/workflow-lookups` |
| `lookups.openapi.ts` | ~155 | OpenAPI registrations under `Workflow Lookups` tag |

## P1.4 — Files modified (wiring)

- **`backend/src/app.ts`** — registered `workflowRoutes` at `/api/workflows` and `workflowLookupRoutes` at `/api/workflow-lookups`
- **`backend/src/openapi/spec.ts`** — added `import` side-effects for `workflow.openapi.ts` and `lookups.openapi.ts`

## P1.5 — Pre-existing type errors fixed (surfaced after Prisma client regen)

Three modules had latent type errors that the new Prisma client made visible. Not Phase-1-introduced, but fixed in this phase since they blocked `tsc`:

- **`backend/src/modules/auth/auth.service.ts`**
  - Replaced `Awaited<ReturnType<typeof prisma.user.findUnique<{ select: ... }>>>` with `Prisma.UserGetPayload<{ select: ... }>`
  - Changed `as const` to `satisfies Prisma.UserSelect`
  - Added `import { Prisma } from '@prisma/client'`
- **`backend/src/modules/role/role.service.ts`**
  - Changed `as const` to `satisfies Prisma.RoleSelect` (the `as const` was making `orderBy` a readonly tuple incompatible with Prisma's mutable-array constraint)
- **`backend/src/modules/organization/organization.routes.ts`**
  - Removed `asyncHandler()` wrapper around the sync `industries` handler

## P1.6 — Bug fixes during smoke test

- **`backend/src/modules/workflow/workflow.service.ts`** — bumped Prisma transaction timeout to `{ timeout: 30_000, maxWait: 5_000 }` after first save hit the 5s default on a slow remote DB
- **`backend/src/modules/workflow/workflow.builder.ts`** — fixed Json field nullability: `position` is always defined per Zod schema, so cast as `Prisma.InputJsonValue`; `additionalData` cast as `Prisma.InputJsonValue | undefined` (let Prisma omit when nullish)
- **`backend/src/modules/workflow/workflow.service.ts`** — `flowJson` (autosave) uses `Prisma.JsonNull` sentinel when the input is null/undefined

## P1.7 — Verification

Manual smoke test executed end-to-end on local backend (port 4000) against Supabase:

| Test | Result |
|---|---|
| Login + JWT | ✅ |
| `GET /api/workflow-lookups/stage-statuses` | ✅ 6 rows |
| `GET /api/workflow-lookups/priorities` | ✅ 4 rows |
| `GET /api/workflow-lookups/action-criteria` | ✅ 1 row ("Anyone") |
| `POST /api/workflow-lookups/types` (with iconName) | ✅ codePrefix auto-derived → `DOC` |
| `POST /api/workflows` (empty shell) | ✅ |
| `PUT /api/workflows/:id` (3-stage linear graph, first save) | ✅ no version bump, version=1 |
| `GET /api/workflows/:id` round-trip | ✅ all 3 nodes, 2 edges |
| `PUT /api/workflows/:id` (renamed Review→Peer Review, added QA stage) | ✅ created new version v2 |
| `GET /api/workflows/:id/versions` | ✅ shows v1 (isLatest=false) + v2 (isLatest=true) with stage/transition counts |
| `GET /api/workflows/compare?v1=&v2=` | ✅ stagesAdded=["QA Check"], stagesModified=[name change], transitionsAdded/Removed precise |
| Validator: cycle | ✅ 400 with `validation_errors: [...]` |
| Validator: missing initial stage | ✅ 400 with proper error message |
| `POST /api/workflows/:id/save-layout` | ✅ updated 2 stages, no version bump |
| `DELETE /api/workflows/:id` | ✅ 204 |
| List filtering: `?includeDeleted=true` | ✅ deleted IDs visible |
| List filtering: default (deleted hidden) | ✅ deleted IDs absent |

> Some checks above (e.g. "created new version v2", `GET /:id/versions`, `GET /compare`) were valid at the time of Phase 1 sign-off; they no longer apply after the P1.8 revision below.

## P1.8 — Versioning removed (post-Phase-2 revision, 2026-05-08)

Per user request, the workflow versioning feature was removed entirely from the API and the runtime save behavior. The schema columns (`version`, `isLatestVersion`, `previousVersionId`, `parentWorkflowId`, `draftOfId`) are intentionally **kept in the database** so we can reintroduce versioning later without a destructive migration; they're just no longer read or written outside of legacy snapshot behavior.

### Backend changes

| File | Change |
|---|---|
| `backend/src/modules/workflow/workflow.service.ts` | `save()` no longer calls `cloneIntoNewVersion`. When the workflow already has stages, it deletes them (`deleteMany` on transitions then stages — cascade handles actions) and re-runs the builder against the **same** workflow row. `version` stays at 1 forever; `isLatestVersion` stays true. Response payload simplified to `{status, msg, workflow: {id}, meta}`. |
| `backend/src/modules/workflow/workflow.service.ts` | Removed `version`, `isLatestVersion`, `parentWorkflowId`, `previousVersionId`, `draftOfId` from `workflowSummarySelect`, `workflowDetailSelect`, and from `list()`/`getById()`/`createShell()` response shapes. |
| `backend/src/modules/workflow/workflow.schema.ts` | Removed `latestOnly` filter from `ListWorkflowsQuerySchema`. Removed `CompareVersionsQuerySchema` and `VersionsQuerySchema`. |
| `backend/src/modules/workflow/workflow.controller.ts` | Dropped `versions` and `compare` controller exports. Updated `saveLayout` import to come from new `workflow.layout.ts`. |
| `backend/src/modules/workflow/workflow.routes.ts` | Removed `GET /workflows/compare` and `GET /:id/versions`. |
| `backend/src/modules/workflow/workflow.openapi.ts` | Removed compare/versions registrations and stripped `version`/`isLatestVersion`/`parentWorkflowId`/etc. from response schemas. |
| `backend/src/modules/workflow/workflow.versioning.ts` | **Deleted**. The `cloneIntoNewVersion`, `listVersions`, `compareVersions` functions are gone. |
| `backend/src/modules/workflow/workflow.layout.ts` | **New** — extracted `saveLayout()` from the old versioning file. ~30 LoC. |
| `backend/src/modules/workflow/engine/orchestrator.ts` | Removed the `if (!workflow.isLatestVersion) throw …` check from `raiseTicket`. Kept selecting `workflow.version` for `TicketFlow.workflowVersion` snapshot (always 1 now). |

### What stays in the schema

- Columns `Workflow.version` (always 1), `isLatestVersion` (always true), `previousVersionId` (always null), `parentWorkflowId` (always null), `draftOfId` (always null)
- `TicketFlow.workflowName` and `TicketFlow.workflowVersion` snapshots — frozen at ticket-raise time, stay valid even if the workflow is later edited

### Verification

| Test | Result |
|---|---|
| `tsc --noEmit` | EXIT=0 |
| Re-save sample workflow → id stays the same | ✅ |
| Re-save with smaller graph (3 stages → 1 stage) → in-place update | ✅ |
| `GET /workflows/compare` | 400 (route gone, falls through to `/:id` which fails UUID validation) |
| `GET /workflows/:id/versions` | 404 (route not found) |
| Existing tickets (DOC-NEX-001/002/003) still link to workflow by snapshot | ✅ |
| Raise new ticket DOC-NEX-004 against simplified workflow | ✅ |

## P1.9 — Performance fixes + Playwright perf harness (post-launch, 2026-05-10)

User reported the workflow APIs felt slow. Investigation revealed two N+1 patterns in Phase 1 code path that made `Save` and the drag-time layout autosave painful on a remote DB. Diagnosis confirmed by direct curl timing:

- `GET /health` (1 RTT to Neon `us-east-1`) ≈ **480 ms** — i.e. every round-trip costs nearly half a second from this dev box.
- A 10-stage save was issuing ~50 sequential round-trips through Prisma (`tx.workflowStage.create` per node, `tx.workflowStageAction.create` per action, `tx.workflowTransition.create` per edge), so save wall-clock = ~24 s.
- Layout autosave (fires every 1.5 s while dragging) was looping `prisma.workflowStage.updateMany` once per node — 10 nodes ≈ 11 round-trips ≈ 5.3 s.

### Fix #1 — `workflow.layout.ts` bulk SQL UPDATE

| File | Change |
|---|---|
| `backend/src/modules/workflow/workflow.layout.ts` | Replaced the `for (const entry of body.positions)` loop with a single `prisma.$executeRaw` of `UPDATE "WorkflowStage" SET position = v.pos FROM (VALUES …) AS v(cid, pos) WHERE workflowId = $1 AND canonicalId = v.cid`. One round-trip regardless of node count. (An earlier `Promise.all` of `updateMany`s also helped but still serialized in practice on Neon's pooler — confirmed by timing — so we dropped to raw SQL for guaranteed parallelism.) |

### Fix #2 — `workflow.builder.ts` BUILD/EXECUTE batching

| File | Change |
|---|---|
| `backend/src/modules/workflow/workflow.builder.ts` | Split `buildWorkflowGraph` into two phases: an in-memory BUILD pass (no DB) that pre-generates UUIDs via `node:crypto.randomUUID()` and accumulates rows for stages, actions, fork-join updates, transitions, and m2m connect tuples; then an EXECUTE pass that ships everything in ~6 calls — `tx.workflowStage.createMany`, `tx.workflowStageAction.createMany`, two `tx.$executeRaw` bulk INSERTs into `_StageActionAllowedRoles` / `_StageActionAllowedUsers`, `Promise.all` of fork updates, and `tx.workflowTransition.createMany`. Behaviour unchanged: same validation order, same error messages, same `@@unique([workflowStageId, workflowActionId])` enforcement. |

Implicit m2m table names (`_StageActionAllowedRoles` with `A`=Role.id `B`=Action.id; `_StageActionAllowedUsers` with `A`=User.id `B`=Action.id) verified against [migration `20260508112732_workflow_phase1`](backend/prisma/migrations/20260508112732_workflow_phase1/migration.sql).

### Fix #3 — `getById` deep-include flatten — **attempted, reverted**

Tried two approaches to collapse the workflow detail tree (`workflow → stages → actions → m2m roles/users + transitions → from/toStage`) into one round-trip:

1. **`relationLoadStrategy: 'join'`** — Prisma 5.10+ runtime-GA on PostgreSQL, but the generated TypeScript types are gated behind the `relationJoins` previewFeature flag in the generator block. Adding the flag and running `npx prisma generate` failed with `EPERM` because `tsx watch` in the running backend process holds `query_engine-windows.dll.node` open.
2. **Raw `prisma.$queryRaw` with Postgres `jsonb_agg` / `jsonb_build_object`** — direct probe showed warm-state ~2.4 s for getById (still ~5 RTTs on Neon, not the targeted 1–2). Marginal improvement that didn't justify replacing the readable Prisma deep-select with a 60-line SQL block.

Reverted both. `workflow.service.ts:getById` is back to the original `prisma.workflow.findUnique({ select: workflowDetailSelect })`. Schema generator is back to the default (no preview features). To revisit later: stop the backend → `prisma generate` with `previewFeatures = ["relationJoins"]` → restart → re-add `relationLoadStrategy: 'join'`. Or wait for Prisma to expose the type without the preview flag.

### Test harness — Playwright perf suite

New top-level dev infrastructure for verifying these and future perf fixes:

| File | Purpose |
|---|---|
| `playwright.config.ts` | Single-worker Playwright config, points at `./e2e/`, no `webServer` (assumes dev servers already running). |
| `e2e/perf.spec.ts` | 3 perf tests + 1 UI smoke. Uses Playwright's `request` fixture for timing-critical paths (no browser overhead). UI smoke gracefully `test.skip()`s when the frontend dev server isn't responding so the harness still passes when only the backend is up. |
| `e2e/probe.mjs` | Standalone Node script (no Playwright dependency) for ad-hoc API timing. Useful for `is it the network or the code?` diagnostics — has its own login + workflow-create + save + save-layout-x3 flow with timing prints. |
| `package.json` | `@playwright/test` added to devDependencies. |
| `.gitignore` | `playwright-report/` and `test-results/` added. |

### Verification

Final perf-suite numbers, three consecutive runs against Neon `us-east-1`:

| Test (assertion) | Run 1 | Run 2 | Run 3 | Threshold | Pre-fix estimate |
|---|---|---|---|---|---|
| Save 10-stage / 1-action / 9-edge workflow | 4314 ms | 4456 ms | 4430 ms | < 8 s | ~24 s |
| Save 6-node fork+join workflow | 4096 ms | 4232 ms | 6047 ms | < 7 s | ~14 s |
| Layout autosave with 10 positions | 3054 ms | 1166 ms | 1166 ms | < 4 s | ~5.3 s |
| `tsc --noEmit` (backend) | EXIT=0 | — | — | — | — |
| UI smoke | skipped (frontend :3000 not up) | — | — | — | — |

Speedups: **~6× on save**, **~3–4× on layout autosave**. Residual time is pure network latency (RTT × number of round-trips left); to push further we'd either need to reduce remaining RTTs (a `SELECT FOR UPDATE` could fold the wf-existence check into the same statement as the body, saving 1 RTT in `save()`) or move the DB closer (Neon region change, or a local Postgres for dev).

### Phase 3 plan docs drafted

Same session, separate from the perf fixes:

| File | Lines | Scope |
|---|---|---|
| `docs/WORKFLOW_PHASE_3_PLAN.md` | 660 | Backend: 6 enums + 9 tables (approval policy/instance/record + SLA policy/threshold/timer/event/extension + business calendar), engine `performAction` intercept, `engine/sla.handler.ts`, `engine/calendar.ts`, BullMQ + Redis worker process with 3 cron sweeps, full API surface, sample seed, ~7 days / ~4,000 LoC. 18 cross-cutting decisions tabled for sign-off (Q1–Q18). |
| `docs/WORKFLOW_PHASE_3_FRONTEND_PLAN.md` | 388 | Frontend: SLA progress ring + countdown + extend modal on ticket detail, approval-awaiting card + decide modal + records timeline, two new builder-inspector tabs (approval policy + SLA policy editors) with autosave, `/admin/business-calendars` page (week-grid + holidays input), SLA breach tile on `/tickets`, ~5 days / ~2,500 LoC. No new runtime deps. 9 FE decisions tabled (FE.Q1–FE.Q9). |

`workflow-changes.md` Phase 3 backend + frontend section headers updated with one-line scope summary and doc links so the index is navigable.

---

# Phase 1 — Frontend — Builder UI integration

**Status:** ✅ Complete (smoke-tested 2026-05-08)
**Plan doc:** [`docs/WORKFLOW_PHASE_1_FRONTEND_PLAN.md`](docs/WORKFLOW_PHASE_1_FRONTEND_PLAN.md)

## FE.P1.1 — New deps

- `reactflow@^11` (canvas + node primitives)
- `openapi-typescript@dev` (deferred type-gen — script not yet added; manual types used)

## FE.P1.2 — API client

**Path:** `client/src/lib/api/`

| File | LoC | Purpose |
|---|---|---|
| `workflow.ts` | ~210 | Typed shapes (`WorkflowSummary`, `WorkflowDetailResponse`, `BuilderNode`, `BuilderEdge`, `SaveWorkflowBody`); TanStack Query hooks: `useWorkflows`, `useWorkflow`, `useCreateWorkflow`, `useSaveWorkflow`, `useSaveLayout`, `useSoftDeleteWorkflow`, `useWorkflowDraft`, `useSaveDraft`. `isWorkflowValidationFailure(err)` typeguard for 400 responses with `validation_errors[]`. |
| `workflowLookups.ts` | ~135 | Typed shapes for the 5 lookup tables; hooks: `useWorkflowTypes`/`useCreateWorkflowType`/`useDeleteWorkflowType`, `useStageStatuses`/`useCreateStageStatus`, `useActionTypes`/`useCreateActionType`, `useActionCriteria`/`useCreateActionCriteria`, `usePriorities`. |

Both files use the existing axios instance at `client/src/lib/api.ts` (with the `qk_token` Bearer interceptor).

## FE.P1.3 — Pages rewritten / added

### Rewritten

| File | Notes |
|---|---|
| `client/src/features/workflows/WorkflowsPage.tsx` (~250 LoC) | Replaced industry-themed mock list with live `useWorkflows()` data. Filters: search, status, type. "Create Workflow" button (perm-gated) opens `<CreateWorkflowModal>` → POST shell → navigate to builder. Permission-gated Edit / Delete buttons per card. Loading spinner + empty state + error fallback. |
| `client/src/features/workflows/WorkflowDetailPage.tsx` (~180 LoC) | Replaced 537 LoC mock detail page (industry/complexity/instances) with simple **read-only graph viewer**. Header: back link, name, status badge, Edit (→ builder), soft-delete. Body: read-only React Flow canvas (`nodesDraggable={false}`) + side panel listing each stage and its primary/secondary actions. Empty state when 0 stages. |

### New

| File | LoC | Purpose |
|---|---|---|
| `shared/WorkflowStatusBadge.tsx` | ~25 | Maps `workflowStatus` → `Badge` variant + label |
| `shared/CreateWorkflowModal.tsx` | ~95 | Name + type picker → `POST /api/workflows` → navigate to `/workflows/:id/builder` |
| `builder/builder.types.ts` | ~75 | Discriminated union for stage/fork/join/decision node data; `WorkflowReactFlowNode/Edge` aliases |
| `builder/builder.serializer.ts` | ~150 | Bidirectional: `deserializeFlow` (server `flow_json` → React Flow state) and `serializeFlow` (state → backend payload) |
| `builder/nodes/StageNode.tsx` | ~60 | Custom React Flow node — green border for initial stage, action chips, mail icon if `email_notification` |
| `builder/nodes/ForkNode.tsx` | ~50 | Multi-handle output (`branch-0..N-1`) per `branchCount`, purple theme |
| `builder/nodes/JoinNode.tsx` | ~50 | Multi-handle input, single output, purple theme |
| `builder/nodes/DecisionNode.tsx` | ~50 | XOR — multi-handle output, amber theme |
| `builder/nodes/index.ts` | ~10 | Exports `nodeTypes` map for React Flow |
| `builder/inspector/InspectorPanel.tsx` | ~70 | Right-rail dispatcher; switches by `selectedNode.type`. Has "Delete node" link. |
| `builder/inspector/StageInspector.tsx` | ~135 | RHF-free controlled form: name, isInitial checkbox, email checkbox, primary/secondary actions (each a `<Select>` of stage statuses + delete + add). |
| `builder/inspector/ForkInspector.tsx` | ~70 | label, branchCount (2-8), splitType (AND/OR/XOR), joinStageId picker (lists join nodes from canvas) |
| `builder/inspector/JoinInspector.tsx` | ~50 | label, branchCount, joinType (AND/OR) |
| `builder/inspector/DecisionInspector.tsx` | ~40 | label, branchCount |
| `builder/NodePalette.tsx` | ~45 | Left rail with click-to-add cards for Stage / Fork / Join / Decision |
| `builder/ValidationErrorPanel.tsx` | ~30 | Red toast-style panel that floats over the canvas when save returns `validation_errors[]`. Dismissable. |
| `builder/WorkflowBuilderPage.tsx` | ~200 | Main canvas page: 3-column layout (palette, canvas, inspector). React Flow with `useNodesState`/`useEdgesState`, `onConnect` adds edge. **Layout autosave** debounced 1.5s on node movement → `POST /save-layout`. **Save** button → `serializeFlow` → `PUT /api/workflows/:id`. Catches `WorkflowValidationFailure` → renders inline panel; other errors → toast. |
| `client/src/features/admin/workflow-lookups/WorkflowLookupsPage.tsx` | ~340 | Tabbed admin page with 5 tabs (Types / Stage Statuses / Action Types / Criteria / Priorities). Each tab is a sub-component using its own hooks. Modals for create. Permission-gated mutation buttons via `workflow.lookups.manage`. Priorities is read-only. |

## FE.P1.4 — Wiring

- **`client/src/App.tsx`** — added 2 new routes:
  - `/workflows/:id/builder` → `<WorkflowBuilderPage>`
  - `/admin/workflow-lookups` → `<WorkflowLookupsPage>`
- **`client/src/components/layout/Sidebar.tsx`** — added "Workflow Lookups" nav link under the "System" section.

## FE.P1.5 — Verification (Playwright)

Manual smoke test driven via the Playwright MCP server:

| Test | Result |
|---|---|
| Navigate to `/login`, fill credentials, submit → redirected to `/dashboard` | ✅ |
| Programmatic login (fetch + localStorage) on subsequent navigations | ✅ |
| `GET /api/workflows` from browser context (Vite proxy → backend) | ✅ 5 workflows |
| `/workflows` page renders live cards with status badges, stage counts, dates, Edit/Delete buttons | ✅ |
| `/workflows/:id` detail page: header + read-only React Flow graph + actions side panel | ✅ shows "INITIAL STAGE" marker + Approve/Forward chip |
| `/workflows/:id/builder`: 3-column layout, palette + canvas + inspector | ✅ |
| Click stage on canvas → inspector switches to Stage Settings with name input + initial checkbox + actions list | ✅ Approve / Forward (FORWARD) populated |
| Click "Stage" in palette → new node added to canvas, inspector switches to it | ✅ counter went 1 → 2 nodes |
| Navigate to `/admin/workflow-lookups`: 5 tabs, "Workflow Types" shows 1 row (Document Review / DOC / file-text) | ✅ |
| Switch to "Stage Statuses" tab: 6 rows with behavior badges | ✅ FORWARD/HOLD/REASSIGN/REJECT/UNHOLD/RETURN |
| Console errors during full session | **0 errors** (4 benign warnings: React Router v7 future flags, missing PWA icon, deprecated apple-mobile-web-app-capable meta) |
| `npx tsc --noEmit` | EXIT=0 |
| `npm run build` | ✓ built in 8s, no errors |

Screenshots saved in `.playwright-mcp/` (gitignored): `workflows-live.png`, `workflows-live-loaded.png`, `workflow-detail.png`, `workflow-builder.png`, `builder-inspector.png`, `builder-after-add.png`, `lookups-types.png`, `lookups-statuses.png`.

## FE.P1.6 — Deferred / known limitations

- **Mock `data.ts`** still in repo as backup — no other feature imports from it; safe to delete in a follow-up
- **Edges between nodes**: drag-and-connect works in React Flow but lacks visual indicators of validity (e.g. fork branches need to land on join). Validation happens server-side on Save.
- **Empty `WorkflowReactFlowEdge` data** prop — unused but kept for future fork-branch-name editor
- **Decision condition expressions per branch** — backend supports them; frontend deferred (planned for Engine Phase 3)
- **OpenAPI type generation** — `openapi-typescript` not yet wired; `client/src/lib/api/workflow.ts` types are hand-written. Generated types will be added later as a CI step.

## FE.P1.7 — Builder visual polish (post-launch fix, 2026-05-08)

User flagged that the original side-handle layout looked off and the small default React Flow handles were hard to grab for drag-to-connect. Three visual fixes:

### Changes

| File | Change |
|---|---|
| `nodes/StageNode.tsx` | Target handle moved from `Position.Left` → `Position.Top`. Source handle moved from `Position.Right` → `Position.Bottom`. Handle style upgraded to **12×12px** with white fill + 2px grey border (was default ~6×6 grey dot). Min-width bumped 180→200, max 240→260. |
| `nodes/ForkNode.tsx` | Single target handle on top; multi-branch source handles distributed along the bottom edge (was right edge). Handle style upgraded with purple border accent. |
| `nodes/JoinNode.tsx` | Multi-branch target handles on top; single source on bottom. Same purple accent. |
| `nodes/DecisionNode.tsx` | Target on top; multi-branch source handles along bottom. Amber accent. |
| `WorkflowBuilderPage.tsx` | New nodes added via palette now **stack vertically** (`y = lowestY + 180px`, fixed `x = 250`) instead of random offset — eliminates overlap. Added `defaultEdgeOptions={{ type: 'smoothstep', stroke: '#94A3B8' }}` for clean orthogonal edges. Added `connectionLineStyle` (gold, 2px) so the in-progress drag line is visible. |
| `WorkflowDetailPage.tsx` | Mirrored the `defaultEdgeOptions` so saved workflows render with the same clean smoothstep edges in the read-only view. |

### Verification

| Test | Result |
|---|---|
| Add 3 stages via palette → they stack vertically with 180px gaps | ✅ |
| Drag from stage 1 bottom handle → stage 2 top handle | ✅ edge connected first try |
| Drag stage 2 bottom → stage 3 top | ✅ second edge connected |
| Final layout: 3 stages stacked top-to-bottom with smooth vertical grey edges | ✅ |
| `3 nodes · 2 edges` reflected in toolbar counter | ✅ |

Hot-reload picked up both files automatically; no migration needed.

## FE.P1.8 — Builder UX fixes: auto-pan + tighter layout (post-launch, 2026-05-09)

User reported two issues with the builder UI: (1) clicking a palette item to add a new stage placed it at `lowestY + 180` but didn't move the viewport, so once the stack grew past the visible canvas the new node was added off-screen; (2) the page felt sparse — side panels left empty space below them and the inter-node gap was larger than necessary.

### Changes

| File | Change |
|---|---|
| `builder/WorkflowBuilderPage.tsx` | Imported `ReactFlowInstance` type and added a `useRef<ReactFlowInstance>` captured via `<ReactFlow onInit={...}>`. After `setNodes` in `handleAddNode`, a `requestAnimationFrame` callback calls `inst.setCenter(targetX, targetY, { duration: 350, zoom })` to smoothly pan the viewport to the freshly-added node. Current zoom is preserved with a 0.85 floor. `NODE_GAP` reduced 180→**140** (matches the actual ~90px node height). Added `fitViewOptions={{ padding: 0.18, maxZoom: 1, minZoom: 0.4 }}` so the initial fit on workflows with few nodes doesn't over-zoom. Body grid: `gap-3 p-3` → `gap-2 p-2`; `gridTemplateColumns` `200px 1fr 320px` → `180px 1fr 296px` (~44px more horizontal canvas room). Side wrapper divs gained `h-full min-h-0` so they cap to the column height. Canvas `<Card>` gained `h-full`. |
| `builder/NodePalette.tsx` | Card class `!p-3` → `!p-3 h-full flex flex-col`. Footer help text margin changed `mt-3` → `mt-auto pt-3` so it pins to the bottom of the now-stretched card instead of leaving empty space below. |
| `builder/inspector/InspectorPanel.tsx` | Both branches (empty-state Card and selected-node Card) gained `h-full` so the inspector fills the right column instead of floating at the top. |

### Verification

| Test | Result |
|---|---|
| `npx tsc --noEmit` (client) | EXIT=0, no output |
| Reasoning check: add 5+ stages → each one pans into view at center | Pending visual verification |
| Reasoning check: side panels visually anchor to full column height | Pending visual verification |

No backend changes, no migration. Hot-reload picks up all three files.

## FE.P1.9 — Page-wrapper / spacing fix (post-launch, 2026-05-09)

User reported that the workflow pages had inconsistent spacing on the sides compared to the rest of the app. Investigation revealed two distinct pre-existing layout bugs:

1. **Double `PageContainer` wrap.** `AppLayout` already wraps `<Outlet />` in `<PageContainer>` (`px-6 lg:px-8 xl:px-10 py-6`). The 5 newer feature pages — `WorkflowsPage`, `WorkflowDetailPage`, `TicketsPage`, `TicketDetailPage`, `WorkflowLookupsPage` — also self-wrap in `<PageContainer>`, producing **double padding** (~48-80px on sides, ~96px vertical). The other 51 pages don't self-wrap, so workflow pages were visibly wider-guttered than every QMS/DMS/LMS page.
2. **Builder height/padding mismatch.** `WorkflowBuilderPage` doesn't self-wrap, but `AppLayout`'s `PageContainer` still applied — pushing the toolbar inward and eating 48px of vertical space. The page's own `h-[calc(100vh-64px)]` also assumed a 64px header, but `Header.tsx` is `h-14` (56px) — the body overflowed the viewport by ~40px.

Per user's scope, fix is limited to workflow pages; tickets and lookups still have bug #1.

### Changes

| File | Change |
|---|---|
| `components/layout/AppLayout.tsx` | Imported `useLocation` from `react-router-dom`. Added `FULL_BLEED_PATTERNS: RegExp[] = [/^\/workflows\/[^/]+\/builder\/?$/]` and a derived `isFullBleed` flag. The `<main>` now conditionally renders either `<Outlet />` directly (full-bleed) or `<PageContainer><Outlet /></PageContainer>` (default). The exact-match regex avoids accidentally stripping padding from sibling/nested routes. |
| `features/workflows/WorkflowsPage.tsx` | Removed the redundant inner `<PageContainer>` wrap (replaced with `<>...</>`). Removed the now-unused `import PageContainer from '@/components/layout/PageContainer';`. The page now relies solely on `AppLayout`'s outer `PageContainer`, matching the convention used by 51 other pages. |
| `features/workflows/WorkflowDetailPage.tsx` | Removed **all 3** inner `<PageContainer>` wraps — loading state (now bare `<div>`), error state (now bare `<Card>`), and main return (now `<>`). Removed the now-unused import. |
| `features/workflows/builder/WorkflowBuilderPage.tsx` | `h-[calc(100vh-64px)]` → `h-[calc(100vh-56px)]` to match the actual `Header h-14` (56px). Combined with the `AppLayout` opt-out, the builder body now fills exactly viewport-height-minus-header with no overflow and no inherited PageContainer padding. |

### Verification

| Test | Result |
|---|---|
| `npx tsc --noEmit` (client) | EXIT=0, no output |
| Visual: `/workflows` list-page side gutter matches `/dashboard`, `/qms/*` | Pending visual confirmation |
| Visual: `/workflows/:id` detail-page side gutter matches list page | Pending visual confirmation |
| Visual: `/workflows/:id/builder` toolbar starts at content left edge, canvas reaches right edge, body fits viewport without scroll | Pending visual confirmation |

### Known follow-ups (not addressed this turn)

- `TicketsPage`, `TicketDetailPage`, `WorkflowLookupsPage` still self-wrap in `<PageContainer>` and therefore still have the double-padding bug. Same one-line removal each — defer until intentionally scoped.

No backend changes, no migration. Hot-reload picks up all four files.

---

# Phase 2 — Backend — Tickets + Engine

**Status:** ✅ Complete (smoke-tested 2026-05-08)
**Plan doc:** [`docs/WORKFLOW_PHASE_2_PLAN.md`](docs/WORKFLOW_PHASE_2_PLAN.md)

## P2.1 — Prisma schema additions

**File:** `backend/prisma/schema.prisma`

### Enums added (3)

```prisma
enum DocType              { ATTACHMENT EVIDENCE REPORT FORM_SUBMISSION OTHER }
enum ChildTriggerMode     { MANUAL AUTO }
enum ParallelBranchStatus { ACTIVE COMPLETED CANCELLED }
```

### Tables added (7)

| Table | Purpose |
|---|---|
| `Ticket` | Workflow instance — `uniqueId` like `DOC-NEX-001`, `customFields Json?`, soft delete + hold flags |
| `TicketFlow` | One per ticket+workflow; snapshots `workflowName`/`workflowVersion`; m2m to `WorkflowStage` for `currentStages` |
| `TicketStageTracking` | Immutable stage history — `enteredAt`, `exitedAt`, `durationSec`, `postActionId`, `returnedFromStageId`, snapshots `stageName`/`stageWorkflowId` so deletion of stage doesn't lose history |
| `TicketComment` | Flat comments (no threading per Q7 default) |
| `TicketDoc` | Document attachment with opaque `fileUrl` (presigned-URL flow deferred to DMS phase per Q4) |
| `ChildWorkflowTrigger` | Schema only (Q6) — spawn endpoint stubbed; full child orchestration in Engine phase |
| `ParallelBranchTracking` | Runtime state for fork/join correctness (Q5) — `branchPath` JSON, `status` enum |

### Tables modified (back-relations only)

- `User` — added `ticketsCreated`, `ticketsDeleted`, `ticketsHeld`, `commentsAuthored`, `docsUploaded`, `stageTrackingPerformed`
- `Department`, `Site`, `Priority` — added `tickets`
- `Workflow` — added `flows`, `childTriggers`
- `WorkflowStage` — added `currentForFlows` (m2m inverse), `stageTracking`, `parentTickets`, `forkBranches`, `joinBranches`, `childTriggers`, `docs`, `returnedFromTracking`
- `WorkflowStageAction` — added `postActionsTracking`

### Migration

- Migration file: `backend/prisma/migrations/20260508144335_workflow_phase2_tickets/migration.sql`
- Applied via `npx prisma migrate dev --name workflow_phase2_tickets`

## P2.2 — Seed updates

**File:** `backend/prisma/seed.ts`

### Permissions added (5)

```ts
'ticket.read', 'ticket.create', 'ticket.update', 'ticket.delete', 'ticket.transition'
```

### Permission grants

- `SUPER_ADMIN`, `QMS_ADMIN`: all 5 (auto via existing filter)
- `QUALITY_ENGINEER`: read, create, update, transition
- `AUDITOR`, `DOCUMENT_CONTROLLER`: read, transition
- `READ_ONLY`: read only (auto via filter)

### Sample workflow (Q8)

Seeded a `Document Review v1` workflow with 3 stages (Submit → Review → Approve) wired with FORWARD actions on each, plus a REJECT action on Review. Sample ticket NOT seeded — too much coupling between seed.ts and the engine; smoke test creates one manually.

Bumped seed transaction timeout to 30s (`{ timeout: 30_000, maxWait: 5_000 }`) — the multi-statement seed of the sample workflow was hitting the default 5s on Neon.

## P2.3 — Engine layer

**Path:** `backend/src/modules/workflow/engine/`

| File | LoC | Purpose |
|---|---|---|
| `types.ts` | ~30 | Shared types: `AuditEventType`, `ActorContext`, `PerformActionResult` |
| `audit.emitter.ts` | ~25 | NOOP for Phase 2 — Phase 4 fills the body. Logs to console in development. Signature is frozen so Phase 4 should not need to edit any call site. |
| `access.layer.ts` | ~40 | RBAC validation: action allowed iff allowedRoles+allowedUsers empty (open) OR user is in allowedUsers OR user's role is in allowedRoles |
| `tracking.layer.ts` | ~75 | `openStageTracking`, `closeStageTracking` (computes `durationSec`), `setHoldOnActiveTracking` |
| `decision.layer.ts` | ~95 | XOR condition evaluator. Tiny expression language: `${customFields.foo} == 'bar'`, supports `==`, `!=`, `>`, `<`, `>=`, `<=`, plus bare-variable truthy check |
| `graph.layer.ts` | ~75 | `resolveNextStages` (applies fork split AND/OR/XOR), `getPreviousActiveStageId` for REJECT |
| `parallel.handler.ts` | ~115 | `startBranches` (creates ParallelBranchTracking rows on fork entry), `markBranchCompleted` (handles AND/OR join semantics) |
| `transition.layer.ts` | ~40 | The ONLY place that mutates `TicketFlow.currentStages` and `isCompleted`. Atomic m2m connect/disconnect. |
| `orchestrator.ts` | ~580 | Public entry points: `raiseTicket`, `getCurrentStageActions`, `performAction`, `holdTicket`, `resumeTicket`. Action dispatch: FORWARD, REJECT, HOLD, UNHOLD, RETURN, REASSIGN |

Key behaviors:
- **`raiseTicket`**: Generates `{prefix}-NEX-{seq:003d}` ticket id with `SELECT ... FOR UPDATE` on the workflow row to serialise concurrent raises (Q1, Q2, Q9).
- **`performAction`**: `SELECT ... FOR UPDATE` on the Ticket row at start of transaction so concurrent transitions on the same ticket queue up.
- **Fork/Join (Q5)**: When entering a fork, creates `ParallelBranchTracking` rows. When arriving at a join, marks one branch completed and either advances past the join (AND: all complete; OR: first through wins, siblings cancelled).
- **REJECT**: Walks the most-recent inactive `TicketStageTracking` row to find the previous stage.
- **RETURN**: Validates the target stage is in the ticket's history, then walks back, recording `returnedFromStageId`.
- **HOLD/UNHOLD**: Sets `Ticket.isOnHold` AND `TicketStageTracking.isOnHold` on active rows. Universal hold endpoint (`/tickets/:id/hold`) sidesteps the action layer.

## P2.4 — Ticket module

**Path:** `backend/src/modules/ticket/`

| File | LoC | Purpose |
|---|---|---|
| `ticket.schema.ts` | ~95 | Zod schemas: raise/update/list, transition, hold, comments, docs, spawn-child |
| `ticket.service.ts` | ~430 | Ticket CRUD; engine pass-through; tracking/timeline/participants; comment + doc CRUD |
| `ticket.controller.ts` | ~120 | Thin HTTP handlers |
| `ticket.routes.ts` | ~85 | Express router `/api/tickets` with permissions |
| `ticket.openapi.ts` | ~250 | OpenAPI 3.1 registrations under `Tickets` tag |

### Endpoints (16)

```
POST   /api/tickets                          ticket.create
GET    /api/tickets                          ticket.read         (filters: status, mine, workflowId, search)
GET    /api/tickets/:id                      ticket.read
PATCH  /api/tickets/:id                      ticket.update
DELETE /api/tickets/:id                      ticket.delete       (soft)

GET    /api/tickets/:id/allowed-actions      ticket.read
POST   /api/tickets/:id/transition           ticket.transition
POST   /api/tickets/:id/hold                 ticket.transition
POST   /api/tickets/:id/resume               ticket.transition

GET    /api/tickets/:id/track                ticket.read
GET    /api/tickets/:id/timeline             ticket.read
GET    /api/tickets/:id/participants         ticket.read

POST   /api/tickets/:id/comments             ticket.update
GET    /api/tickets/:id/comments             ticket.read
DELETE /api/tickets/:id/comments/:commentId  ticket.update

POST   /api/tickets/:id/docs                 ticket.update
GET    /api/tickets/:id/docs                 ticket.read
DELETE /api/tickets/:id/docs/:docId          ticket.update

POST   /api/tickets/:id/spawn-child          ticket.create
```

## P2.5 — Files modified (wiring)

- **`backend/src/app.ts`** — registered `ticketRoutes` at `/api/tickets`
- **`backend/src/openapi/spec.ts`** — added `import` side-effect for `ticket.openapi.ts`

## P2.6 — Bug fixes during smoke test

- **`orchestrator.ts`**: changed `import type { Prisma, StageType }` to import `Prisma` as a value (needed for `Prisma.JsonNull` runtime usage)
- **`orchestrator.ts`**: changed `customFields: (input.customFields ?? null) as Prisma.InputJsonValue | null` to `Prisma.JsonNull` sentinel (Prisma's nullable Json input rejects bare `null`)
- **`orchestrator.ts`**: removed `::uuid` cast from `SELECT ... FOR UPDATE` raw queries — Prisma `@id @default(uuid())` columns are TEXT, not UUID, so the cast caused PostgreSQL `42883: operator does not exist: text = uuid`

## P2.7 — Verification

Manual smoke test executed against the local backend on port 4000 with a fresh seed:

| Test | Result |
|---|---|
| Login + JWT | ✅ |
| Sample workflow seeded as Document Review v1 (ACTIVE, isLatestVersion) | ✅ stageCount=3, transitionCount=2 |
| `POST /api/tickets` → raise | ✅ uniqueId `DOC-NEX-001` allocated atomically |
| `GET /api/tickets/:id` | ✅ shows `currentStages: ["Submit"]`, `flow_count: 1` |
| `GET /api/tickets/:id/allowed-actions` | ✅ Submit stage shows Approve action with `canPerform: true` |
| `POST /api/tickets/:id/transition` (Submit → Review) | ✅ exitedStages/enteredStages correct |
| `POST /transition` (Review reject → Submit) | ✅ ticket walks backward |
| `POST /transition` Submit → Review → Approve → terminal | ✅ `isCompleted: true`, currentStages empty |
| `GET /api/tickets/:id/track` after completion | ✅ 5 rows with durations + actions + reject path visible |
| `GET /api/tickets/:id/timeline` | ✅ 10 entries (5 enter + 5 exit) chronological |
| Universal hold on a 2nd ticket | ✅ 204 |
| Transition while held → 409 with proper message | ✅ |
| Resume → 204, ticket back at Submit | ✅ |
| Add comment + list comments | ✅ |
| Attach doc + verify | ✅ |
| List tickets (pagination) | ✅ 2 tickets, status filter works |

Note: First save / first ticket raise on Neon takes 5-9s due to cold connection + multi-statement transaction. Operations after warm-up are <1s. The 30s `prisma.$transaction({ timeout })` accommodates this comfortably.

---

# Phase 2 — Frontend — Ticket UI

**Status:** ✅ Complete (smoke-tested via Playwright 2026-05-08)

## FE.P2.1 — API client

**File:** `client/src/lib/api/ticket.ts` (~270 LoC)

Typed shapes for `TicketSummary`, `TicketDetail`, `AllowedAction`, `StageActionsView`, `RaiseTicketInput`, `TransitionInput`, `TransitionResult`, `TrackingRow`, `TimelineEntry`, `TicketComment`, `TicketDoc`. Hooks (TanStack Query):

- **List/CRUD**: `useTickets`, `useTicket`, `useRaiseTicket`, `useUpdateTicket`, `useDeleteTicket`
- **Engine**: `useAllowedActions`, `useTransition`, `useHoldTicket`, `useResumeTicket`
- **Tracking**: `useTicketTrack`, `useTicketTimeline`
- **Comments**: `useTicketComments`, `useAddComment`, `useDeleteComment`
- **Docs**: `useTicketDocs`, `useAttachDoc`, `useDeleteDoc`

All mutations invalidate the appropriate query keys (transition invalidates detail + allowed-actions + track + timeline + list).

## FE.P2.2 — Pages + components

**Path:** `client/src/features/tickets/`

| File | LoC | Purpose |
|---|---|---|
| `TicketsPage.tsx` | ~210 | List view with search/status/mine filters; "Raise Ticket" button (perm-gated `ticket.create`); ticket cards showing uniqueId pill, title, status badge, current stage, workflow name, last updated, creator. Empty state. |
| `TicketDetailPage.tsx` | ~210 | Custom-laid-out header (uniqueId pill + title + status badge + workflow ref), 2-col layout (main + Details sidebar). Tabs: Timeline / Comments / Documents. Hold-reason callout when held. Soft-delete button. |
| `shared/TicketStatusBadge.tsx` | ~30 | Maps `isOnHold` / `isCompleted` / open → Badge variant + label |
| `shared/RaiseTicketModal.tsx` | ~110 | Workflow picker (filtered to `workflowStatus=ACTIVE`) → Title → Description → Priority. Submits via `useRaiseTicket`, navigates to `/tickets/:id` on success. |
| `detail/ActionBar.tsx` | ~220 | Renders allowed-actions per current stage as styled buttons (icon by behavior, color by behavior). Confirm modal collects optional remarks. Universal Hold button + Resume button. Disabled state when ticket on hold or user lacks `ticket.transition`. |
| `detail/TimelineTab.tsx` | ~70 | Vertical timeline with stage-entered / stage-exited / comment events; colored icon rings; relative timestamps |
| `detail/CommentsTab.tsx` | ~110 | Inline add form (textarea + Send icon button), paginated list, delete button on own comments |
| `detail/DocsTab.tsx` | ~150 | Attach modal (URL + file name + doc type), table of docs with mime/size/uploader, external link + delete |

## FE.P2.3 — Wiring

- **`client/src/App.tsx`** — added `/tickets` and `/tickets/:id` routes
- **`client/src/components/layout/Sidebar.tsx`** — "Tickets" nav link (Ticket icon) added under Overview section, between "Workflows" and the QMS section

## FE.P2.4 — Verification (Playwright)

| Test | Result |
|---|---|
| Login, navigate to `/tickets` | ✅ 4 existing tickets render with status badges + current stage info |
| Click "Raise Ticket" → modal opens with workflow picker | ✅ |
| Submit modal → POST → redirect to `/tickets/:newId` | ✅ DOC-NEX-005 created |
| Detail page shows: header, description, **current stage card** (Single Stage pill), **stage actions card** (Approve / Forward + Hold), tabs | ✅ |
| Click "Approve / Forward" → confirm modal opens with behavior + remarks textarea | ✅ |
| Click Confirm → transition fires, status updates Open → Completed, action card shows "Completed — no further actions", timeline updates with both Entered + Exited events | ✅ |
| Switch to Comments tab, type comment, click Send → comment appears in list with author + timestamp + delete button | ✅ |
| Soft delete via API | ✅ 204 |
| `npx tsc --noEmit` | EXIT=0 |
| `npm run build` | ✓ 8s |
| Console errors | 2 (both expected 400s from intentional invalid-state tests during the transition session); 0 unexpected errors |

## FE.P2.5 — Known interaction with no-versioning

Tickets raised against a workflow before that workflow is edited in-place will end up with **no active stages** in the engine view (because `TicketFlow.currentStages` is an m2m relation; when stages are deleted during re-save, the m2m rows go with them). The UI handles this correctly — shows "No active stages" in the action card, and the timeline still preserves the historical Entered/Exited entries. This is a documented consequence of the no-versioning revision (P1.8) and is not a regression.

## FE.P2.6 — Deferred

- **Bulk actions** (multi-select tickets in list)
- **Pagination UI** (currently fetches up to 50)
- **Reassign action** flow (the UI button works, but no UI for picking the target user/role yet — needs Phase 3 assignee model)
- **Return action** flow (button exists, but doesn't yet show a stage picker for `returnToStageId`)
- **Spawn child** workflow trigger (endpoint exists, no UI)

---

# Phase 3 — Backend — Approvals + SLA

**Status:** 🟡 In progress — P3.1 (schema + seed) shipped + Django-aligned; P3.2 (Approval module) next
**Plan doc:** [`docs/WORKFLOW_PHASE_3_PLAN.md`](docs/WORKFLOW_PHASE_3_PLAN.md)
**Master plan:** [`docs/WORKFLOW_MASTER_PLAN.md`](docs/WORKFLOW_MASTER_PLAN.md) §5

Scope: 6 enums, 9 tables (approval policy/instance/record + SLA policy/threshold/timer/event/extension + business calendar), engine intercept on `performAction`, BullMQ worker process — single combined 15-min sweep (revised from 3 jobs per Q11 sign-off), spawn-separate-escalation-ticket pattern (Q13 sign-off), ~7 days, ~4,000 LoC. Q5/Q11/Q13 decisions locked after Django reference verification.

## P3.1 — Schema + seed + Django-aligned revision (2026-05-12)

Initial Phase 3 schema landed, then revised against the Django reference at `core-prod-scaling/backend/workflows/` once the user merged in companion code (Forms / ISO / AuditSchedule) that revealed the full target shape.

### Two migrations applied to Neon

| Migration | Tables / changes | How applied |
|---|---|---|
| `20260512161347_workflow_phase3_approvals_sla` | 6 enums + 9 tables (`ApprovalPolicy`, `ApprovalInstance`, `ApprovalRecord`, `BusinessCalendar`, `SlaPolicy`, `SlaThreshold`, `SlaTimer`, `SlaTimerEvent`, `SlaExtension`) + 6 m2m join tables (approver roles/users, responsible roles/users, threshold notify roles/users) + back-relations on `User`/`Role`/`Workflow`/`WorkflowStage`/`WorkflowStageAction`/`Ticket`. | `prisma migrate dev` failed with **P1017/P3016** (Neon pooler dropped the shadow-DB connection); fell back to `prisma migrate diff` → `awk`-filter unrelated drops → `prisma db execute --file` → `prisma migrate resolve --applied`. Generated migration includes only additive `CREATE` statements; 11 unrelated tables (Forms / ISO / AuditSchedule) that exist in Neon but weren't tracked were **preserved** by filtering out their `DROP TABLE` lines. |
| `20260512171857_workflow_phase3_django_alignment` | Field/enum revisions after Django source verification. See deltas table below. | Same pipeline — diff → filter → `db execute` → `resolve --applied`. The existing `SlaThreshold` row was backfilled with `name='warning'` via temporary `DEFAULT` then `DROP DEFAULT`. |

### Django-alignment revisions (R1–R12 in plan doc §3a)

Direct source verification at `core-prod-scaling/backend/workflows/{models/approval.py:70-258, models/sla_timer.py:26-296, engine/engines/approval_handler.py:194-239, engine/services/sla_scheduler.py:57-201}` revealed three architectural divergences in the initial draft that required signed-off corrections:

| Decision | Initial draft | Django-verified resolution | Schema impact |
|---|---|---|---|
| **Approval rejection (Q5)** | Auto-fire `REJECT` behavior on rejection (walks ticket back) | **Stay in stage** — mark instance `REJECTED`, fire `APPROVAL_REJECTED` audit + hook, return rejected status. User must explicitly invoke a `REJECT`-behavior action to move the ticket. | None (engine behavior only) |
| **Threshold auto-transition (Q13)** | Move "the ticket" to `targetSlaStageId` (ambiguous → would have moved the parent) | **Spawn a separate escalation child ticket** on `SlaPolicy.escalationWorkflowId` when parent enters SLA-tracked stage. Threshold cron only advances the **child** — parent is never auto-moved by SLA. Mirrors Django's `_advance_sla_ticket()` pattern. | + `SlaPolicy.escalationWorkflowId` (FK Workflow), + `SlaTimer.escalationTicketId` (FK Ticket), back-relations on Workflow + Ticket |
| **Cron architecture (Q11)** | 3 separate jobs at 5min thresholds / 15min breaches / 30min approval-deadline | **Single combined 15-min sweep** `checkSlaTimers` does thresholds → escalation-transitions → breaches in one run. Approval-deadline stays separate at 30min (different domain). | None (job layout only) |

Schema field-level deltas (Migration B):

| Model | Change |
|---|---|
| `ApprovalPolicy` | + `isActive Boolean @default(true)` (separate from `isDeleted`) |
| `ApprovalInstance` | status enum: − `APPROVED`, + `SATISFIED`/`EXPIRED`/`INVALIDATED`. + `currentSequenceOrder Int @default(1)`, + `invalidatedAt DateTime?`, + `invalidatedReason String?` |
| `ApprovalRecord` | + `approvedAsRoleId String?` (FK Role, audit trail for multi-role users), + `sequenceOrder Int @default(0)` (SEQUENTIAL mode), + `stageSignatureId String?` (Phase-4 e-sig placeholder) |
| `SlaPolicy` | + `escalationWorkflowId String?` (FK Workflow) per R1 |
| `SlaThreshold` | + `name String` required (e.g. 'warning', 'critical'); `percentage Int → Float`; unique swapped `(policy, percentage) → (policy, name)` |
| `SlaTimer` | DROPPED `totalPausedSec`, `lastFiredPercentage`, `pausedAt`, `resumedAt`. ADDED `elapsedBeforePauseSec Int @default(0)`, `lastResumedAt DateTime?`, `totalExtensionsSec Int @default(0)`, `extensionCount Int @default(0)`, `escalationTicketId String?` (FK Ticket). Status enum: `ACTIVE → RUNNING`, + `EXTENDED`. Elapsed-time accounting now matches Django: track working time, not paused time. Threshold latch moved from `lastFiredPercentage` column → query against `SlaTimerEvent` rows by `thresholdName`. |
| `SlaTimerEvent` | + `thresholdName String?`, `thresholdPercentage Float?` (actual % at fire time), `extensionAmountSec Int?`, `newDeadline DateTime?`, `triggeredById String?` (FK User). Event types: `THRESHOLD_FIRED → THRESHOLD_HIT`, + `SLA_TRANSITION`, + `COMPLETED_LATE`. |
| `SlaExtension` | **Kept as-drafted** — intentional divergence. Django has no extension-request approval workflow; QMS audit posture justifies the richer model. |

### Seed data

| Object | Source | Count |
|---|---|---|
| Permissions | New keys: `approval.*` (6), `sla.*` (7), `business-calendar.*` (4) | 17 new (66 total after seed) |
| `QUALITY_ENGINEER` role grants | + `approval.read/decide/policy.read`, `sla.policy.read/timer.read/timer.extend`, `business-calendar.read` | 7 keys added |
| `AUDITOR` role grants | + `approval.read/policy.read`, `sla.policy.read/timer.read`, `business-calendar.read` | 5 keys added |
| `DOCUMENT_CONTROLLER` role grants | + `approval.read/decide/policy.read`, `sla.policy.read/timer.read`, `business-calendar.read` | 6 keys added |
| `BusinessCalendar` | `default-24x7` (Mon-Fri 09:00-18:00 IST), `support-24x7` (24×7) | 2 |
| `SlaPolicy` | Sample policy on `Document Review v1` Submit stage: 4h duration, default-24x7 calendar, pauseOnHold | 1 |
| `SlaThreshold` | Sample threshold: 75% warning, notify QE role | 1 (`name='warning'` after Migration B backfill) |
| `ApprovalPolicy` | Sample policy on `Document Review v1` Review stage "Approve / Forward" action: mode `ALL_REQUIRED`, 2 QEs required, no self-approval, 24h SLA | 1 |

### Files touched

| File | Change |
|---|---|
| [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma) | + 6 enums, + 9 models, + back-relations on `User`/`Role`/`Workflow`/`WorkflowStage`/`WorkflowStageAction`/`Ticket`. Two waves — initial then Django-alignment revision. |
| [`backend/prisma/seed.ts`](backend/prisma/seed.ts) | + 17 permissions; updated explicit role grants for QE/AUDITOR/DOC_CONTROLLER; + sample calendar/SLA/approval-policy seeding block at end of `main()`; `SlaThreshold.name='warning'` for the seeded row. |
| [`backend/prisma/migrations/20260512161347_workflow_phase3_approvals_sla/migration.sql`](backend/prisma/migrations/20260512161347_workflow_phase3_approvals_sla/migration.sql) | Initial Phase 3 migration (filter-cleaned via `awk` to drop the unrelated `DROP TABLE` lines from `prisma migrate diff`). |
| [`backend/prisma/migrations/20260512171857_workflow_phase3_django_alignment/migration.sql`](backend/prisma/migrations/20260512171857_workflow_phase3_django_alignment/migration.sql) | Django-alignment revision migration with backfill for existing `SlaThreshold.name`. |
| [`docs/WORKFLOW_PHASE_3_PLAN.md`](docs/WORKFLOW_PHASE_3_PLAN.md) | Status flipped from ⏳ Draft → 🟡 In progress. Q5/Q11/Q13 marked signed-off. New §3a Django-alignment Revisions section. §4.1 rewritten for stay-in-stage rejection. §4.2 rewritten for escalation-ticket spawn + Django-aligned elapsed-time model (incl. §4.2a `computeElapsedSec` helper). §5.2/5.3/5.4 rewritten for single combined sweep + escalation-ticket-only transitions. §15 sign-off list closed. |

### Verification

| Check | Result |
|---|---|
| `npx prisma validate` | `valid 🚀` |
| `npx prisma migrate status` | 7 migrations found · "Database schema is up to date" |
| `npx prisma generate` | Client regenerated; Phase 3 model types exposed (`ApprovalPolicy`, `SlaPolicy`, `BusinessCalendar`, `SlaTimer`, etc.) |
| `npx tsc --noEmit` (backend) | EXIT=0 |
| Seed re-runs idempotently | ✓ — re-running `npm run db:seed` after Migration B applies cleanly with no constraint violations |
| Generated client has renamed enum values | ✓ `SATISFIED`, `THRESHOLD_HIT`, `SLA_TRANSITION`, `RUNNING`, `EXTENDED`, `COMPLETED_LATE`, `INVALIDATED`, `EXPIRED` all present |
| Backend up | ⚠️ Not restarted yet by user (was stopped to allow `prisma generate`) |

### Known follow-ups (not blockers)

- 11 untracked tables remain in Neon (`Form*`, `Iso*`, `AuditSchedule`) — they're now in `schema.prisma` after the user's merge, so they're tracked going forward; no historical migration covers their creation (they pre-date our migration history). Phase 5 (Audit Scheduling) and Phase 4 (Forms / e-sig) plans will need to account for `AuditSchedule` and `Form*` already existing, rather than introducing them. Flagged in [docs/WORKFLOW_PHASE_3_PLAN.md](docs/WORKFLOW_PHASE_3_PLAN.md) for downstream phases.
- `escalationWorkflowId` is nullable everywhere. If a workflow author leaves it null, the SLA timer still fires `THRESHOLD_HIT` events for notification routing, but no auto-transitions happen. This is the intended graceful-degradation path.

## P3.2 — Approval module: routes, controller, service, Zod, OpenAPI (2026-05-12)

Shipped the approval admin + read surface as 5 new module files mirroring the workflow/ticket module shape. The `/decide` endpoint is intentionally deferred to P3.5 (needs the engine intercept in `engine/approval.layer.ts`).

### Endpoints live (all gated by `approval.*` permissions seeded in P3.1)

| Method | Path | Permission | Behaviour |
|---|---|---|---|
| `GET` | `/api/workflows/:id/approval-policies` *(`?includeInactive=true&includeDeleted=true`)* | `approval.policy.read` | Lists policies on a workflow. Default filter: active and not-deleted. |
| `POST` | `/api/workflows/:id/approval-policies` | `approval.policy.create` | Creates a policy on `(stageId, actionId)`. Validates that stage belongs to workflow and action belongs to stage; surfaces 409 on duplicate active policy; **idempotently revives** a soft-deleted policy on the same `(stage, action)` by updating it instead of erroring. |
| `GET` | `/api/approval-policies/:id` | `approval.policy.read` | Single-policy expansion with approverRoles/approverUsers/stage/action.workflowAction. |
| `PATCH` | `/api/approval-policies/:id` | `approval.policy.update` | Partial update. Re-validates mode coherence on the merged-future view (e.g. switching to SEQUENTIAL without providing `approvalSequence` and the existing row has none → 400). |
| `DELETE` | `/api/approval-policies/:id` | `approval.policy.delete` | Soft-delete; also flips `isActive=false`. Idempotent — already-deleted returns 204. |
| `GET` | `/api/tickets/:id/approvals` | `approval.read` | Ticket's approval instances with records (approver + role + decision + comment), ordered by `decidedAt asc` per instance. |
| `GET` | `/api/approvals/:instanceId` | `approval.read` | Single instance with policy + records expansion. |

Deferred to P3.5 once `engine/approval.layer.ts` lands: `POST /api/approvals/:instanceId/decide`.

### Files added

| File | Lines | Purpose |
|---|---|---|
| [`backend/src/modules/approval/approval.schema.ts`](backend/src/modules/approval/approval.schema.ts) | ~105 | Zod schemas with mode-conditional refinements. `CreateApprovalPolicySchema` enforces "SEQUENTIAL → non-empty `approvalSequence`" and "non-SEQUENTIAL → at least one approverRole or approverUser". `UpdateApprovalPolicySchema` is fully partial but rejects empty bodies. `ApprovalSequenceStepSchema` enforces exactly-one of `{roleId, userId}` per step. |
| [`backend/src/modules/approval/approval.service.ts`](backend/src/modules/approval/approval.service.ts) | ~270 | CRUD + read. Imposes the same coherence validator on PATCH against the merged-future view of the policy (read existing row, project the patch, re-validate). Soft-delete revive path reuses the existing row ID, preserving any historical references. |
| [`backend/src/modules/approval/approval.controller.ts`](backend/src/modules/approval/approval.controller.ts) | ~40 | Thin handlers. |
| [`backend/src/modules/approval/approval.routes.ts`](backend/src/modules/approval/approval.routes.ts) | ~90 | 4 routers exported (workflow-scoped policy, policy-by-id, instance-by-id, ticket-scoped instance list) so they can mount under their natural paths without colliding with existing routers under `/api/workflows` and `/api/tickets`. |
| [`backend/src/modules/approval/approval.openapi.ts`](backend/src/modules/approval/approval.openapi.ts) | ~215 | 7 `registerPath` calls + 3 response schemas (`ApprovalPolicy`, `ApprovalInstance`, `ApprovalRecord`). |

### Wire-ins

| File | Change |
|---|---|
| [`backend/src/app.ts`](backend/src/app.ts) | + named imports of all 4 routers; + 4 `app.use(…)` lines after the existing modules. Both workflow-scoped and ticket-scoped routers coexist with the existing `workflowRoutes` / `ticketRoutes` at the same mount path — Express tries each in registration order. |
| [`backend/src/openapi/spec.ts`](backend/src/openapi/spec.ts) | + side-effect `import '../modules/approval/approval.openapi'` so the registry is populated at boot. |

### Smoke verification

Backend restarted, all endpoints exercised with curl. Each row below is a real HTTP response from the live API:

| # | Test | Result |
|---|---|---|
| 1 | `POST` create policy (ALL_REQUIRED, 2 QEs, 24h SLA) | **201** + full expansion |
| 2 | `GET` list policies for workflow | **200**, 1 row |
| 3 | `GET` single policy by id | **200**, matches list-row shape |
| 4 | `PATCH` flip `isActive=false` | **200**, field flipped + `updatedAt` advanced |
| 5 | `GET` list (default filter) | **200** `[]` — inactive correctly hidden |
| 6 | `GET` list with `?includeInactive=true` | **200**, 1 row |
| 7 | `DELETE` policy | **204** |
| 8 | `GET` list after delete (with `includeInactive`) | **200** `[]` — soft-deleted correctly hidden |
| 9 | `POST` again with same (stage, action) | **201**, **same ID** as #1 — idempotent revive working, new fields (mode=QUORUM) applied |
| 10 | `POST` once more (now active) | **409** `An approval policy already exists for this stage + action` |
| 11 | `POST` SEQUENTIAL mode without `approvalSequence` | **400** with Zod field detail `approvalSequence: ["SEQUENTIAL mode requires a non-empty approvalSequence"]` |
| 12 | `GET /api/tickets/:realTicketId/approvals` | **200** `[]` — empty as expected (no instances created yet; P3.5 wires the engine intercept that creates them) |
| 13 | `tsc --noEmit` (backend) | EXIT=0 |

### Side finding worth flagging (not a P3.2 issue)

The originally-seeded sample `ApprovalPolicy` + `SlaPolicy` rows on Document Review v1 were **gone** before the smoke run. Root cause: the workflow was rebuilt via the builder UI at some point (canonicalIds went from `sample-submit`/`sample-review` → `n1`/`node-mox8ekmq-1`), and the save-equals-rebuild pattern from P1.8 (no-versioning) cascade-deleted the FK-linked policies. **`BusinessCalendar` rows survived** because they're not stage-scoped.

Same dynamic that wipes `TicketFlow.currentStages` on workflow edits (already documented as a Phase 2 known-quirk in [FE.P2.5](#fep25--known-interaction-with-no-versioning)). The Phase 3 FE plan's "Approvals" inspector tab will need a UX story for "policy was lost because the stage was rebuilt." The seed is idempotent (`findFirst` + `if (!existing)`) so `npm run db:seed` will re-create the sample after any rebuild — but only if the rebuilt stages keep the original `sample-submit`/`sample-review` canonicalIds (they won't, because the FE generates fresh `node-{ts}-{n}` ids). To re-seed reliably we'd need to either:
- Match by stage `name` instead of `canonicalId` (current seed uses `canonicalId`)
- Or move sample-policy seeding out of `seed.ts` into a manual `seed:phase3-samples` script

Deferred — not blocking. Flagged for P3.5 / FE work.

## P3.3 — SLA module: policies, thresholds, timers, extensions (2026-05-13)

Shipped the SLA admin + read surface + extension request/approve flow as 5 new module files mirroring the P3.2 shape. Like P3.2, this is the **admin surface only** — `SlaTimer` rows are spawned by the engine when a ticket enters an SLA-tracked stage (P3.5). The extension request/approve endpoints work standalone (mutate an existing timer + emit an `EXTENDED` event) but won't have real timers to operate on until P3.5 lands.

### Endpoints live (all gated by `sla.*` permissions seeded in P3.1)

| Method | Path | Permission | Behaviour |
|---|---|---|---|
| `GET` | `/api/workflows/:id/sla-policies` *(`?includeDeleted=true`)* | `sla.policy.read` | Policies on this workflow (matched via `parentStage.workflowId`). Default filter: not-deleted. |
| `POST` | `/api/sla-policies` | `sla.policy.create` | Create on a `parentStageId` (1:1 with `WorkflowStage`). Validates stage + calendar + escalation-workflow existence; surfaces 409 on duplicate active policy; **idempotently revives** soft-deleted policy on same stage. |
| `GET` | `/api/sla-policies/:id` | `sla.policy.read` | Single policy with calendar + escalationWorkflow + responsibleRoles/Users + thresholds (sorted by percentage, each with notifyRoles/Users + targetSlaStage). |
| `PATCH` | `/api/sla-policies/:id` | `sla.policy.update` | Partial update. `calendarId: null` and `escalationWorkflowId: null` disconnect via Prisma's `disconnect: true`. |
| `DELETE` | `/api/sla-policies/:id` | `sla.policy.delete` | Soft-delete (idempotent). Does NOT cascade to `SlaThreshold` rows — see [§ side findings](#side-findings-not-blockers) below. |
| `POST` | `/api/sla-policies/:id/thresholds` | `sla.policy.update` | **Replace-all-by-name** upsert. Wraps writes in a 30s tx; the deep re-read runs post-commit to avoid Neon RTT × N work exceeding the default 5s tx timeout. |
| `DELETE` | `/api/sla-thresholds/:id` | `sla.policy.update` | Single threshold delete. |
| `GET` | `/api/sla/timers` *(`?status=&workflowId=&ticketId=&page=&pageSize=`)* | `sla.timer.read` | Paginated dashboard query. Joins through `policy.parentStage.workflowId` when `workflowId` is provided. |
| `GET` | `/api/tickets/:id/sla` | `sla.timer.read` | Returns `{ timers: [...] }` with each timer's full event history (THRESHOLD_HIT/EXTENDED/PAUSED/etc., ordered by `occurredAt`). |
| `POST` | `/api/sla/timers/:id/extend` | `sla.timer.extend` | Create `SlaExtension(PENDING)`. Refuses if the timer is `COMPLETED` or `BREACHED`. |
| `POST` | `/api/sla/extensions/:id/decide` | `sla.timer.extend.approve` | Approve/reject. On `APPROVED`: transactional path pushes `timer.deadline` by `extensionSec`, increments `totalExtensionsSec` + `extensionCount`, flips `RUNNING → EXTENDED` (preserves `PAUSED`), emits `SlaTimerEvent(EXTENDED, newDeadline, triggeredBy=approver)`. Self-approval blocked. |

### Files added

| File | Lines | Purpose |
|---|---|---|
| [`backend/src/modules/sla/sla.schema.ts`](backend/src/modules/sla/sla.schema.ts) | ~110 | Zod schemas. `duration` capped at 31 days, `extensionSec` at 30 days to catch unit typos. Threshold names free-form (matches Django). |
| [`backend/src/modules/sla/sla.service.ts`](backend/src/modules/sla/sla.service.ts) | ~410 | All CRUD + flows. Notable patterns: replace-all-by-name threshold upsert wraps writes only (re-read post-commit per the P2028 fix below); `decideExtension` is atomic across the timer update + event write + extension status flip; self-approval blocked at the service layer. |
| [`backend/src/modules/sla/sla.controller.ts`](backend/src/modules/sla/sla.controller.ts) | ~70 | Thin handlers. Extension endpoints pull `req.user.userId` from the JWT to populate `requestedById` / `approverId`. |
| [`backend/src/modules/sla/sla.routes.ts`](backend/src/modules/sla/sla.routes.ts) | ~110 | **Six routers exported** to keep mounts orthogonal (workflow-scoped, policy, threshold, timer, extension, ticket-scoped). |
| [`backend/src/modules/sla/sla.openapi.ts`](backend/src/modules/sla/sla.openapi.ts) | ~290 | 11 `registerPath` calls + 4 response schemas (`SlaPolicy`, `SlaTimer`, `SlaTimerWithEvents`, `SlaExtension`). |

### Wire-ins

| File | Change |
|---|---|
| [`backend/src/app.ts`](backend/src/app.ts) | + named imports of all 6 routers; + 6 `app.use(…)` lines. Same coexistence pattern as P3.2 — workflow-scoped + ticket-scoped routers share their mount path with the existing `workflowRoutes` / `ticketRoutes` (Express tries each in order). |
| [`backend/src/openapi/spec.ts`](backend/src/openapi/spec.ts) | + side-effect `import '../modules/sla/sla.openapi'` so the registry gets the SLA paths at boot. |

### Bug found + fixed during smoke (P2028 transaction-timeout in `upsertThresholds`)

First version wrapped both the writes AND the deep `findUnique` re-read inside a single `prisma.$transaction`. On Neon (us-east-1 RTT ~250-450ms from this dev box) a 2-threshold create with m2m notifyRole connects + the deep policy re-read hit ~15 round-trips, blowing through the default 5s interactive-tx timeout:

```
PrismaClientKnownRequestError: P2028
Transaction already closed: A query cannot be executed on an expired transaction.
The timeout for this transaction was 5000 ms, however 5239 ms passed since
the start of the transaction.
```

Fix in [`sla.service.ts:upsertThresholds`](backend/src/modules/sla/sla.service.ts):

1. **Bumped the tx options** to `{ timeout: 30_000, maxWait: 10_000 }` (same pattern `seed.ts` uses for the Document-Review-v1 transaction).
2. **Moved the deep re-read OUT of the tx** — writes commit first, then `prisma.slaPolicy.findUnique({ select: policySelect })` runs against the committed state. This is the right call architecturally regardless of timeout: the re-read does not need to be transactional with the writes.

Both changes together; the tx body is now write-only (well under 5s) and the re-read is a separate (slow but not transactional) query. Pattern documented in code comment so future tx-heavy edits know to follow it.

### Smoke verification

Backend restarted twice during the smoke (`tsx watch` failed to pick up new files on Windows + chokidar; documented in [§ side findings](#side-findings-not-blockers) below). Final pass on the fresh backend:

| # | Test | HTTP | Time | Verdict |
|---|---|---|---|---|
| 1 | `POST /api/sla-policies` (create on stage `4d30e794-…`) | **201** | ~10s | Idempotent revive returned same ID as a prior smoke; cold-start RTT. |
| 2 | `POST /api/sla-policies/:id/thresholds` — 2 thresholds with notifyRoles (the previously-failing P2028 case) | **200** | 9.4s | Replace-all completed; thresholds visible with `notify=1` (QE role connected). |
| 3 | `GET /api/sla-policies/:id` | **200** | 2.4s | Confirms `warning@50 + critical@75`, each with QE notifyRole. |
| 4 | `POST .../thresholds` again — drop `warning`, change `critical → 80`, add `breach@100` | **200** | 6.4s | Replace-by-name semantics working; `warning` row was deleted, `critical` updated, `breach` created. |
| 5 | `GET /api/sla-policies/:id` | **200** | 3.5s | Confirms `critical@80 + breach@100`. |
| 6 | `PATCH /api/sla-policies/:id` `{ duration: 28800 }` | **200** | 3.8s | Field updated. |
| 7 | `POST /api/sla-policies` (duplicate on same stage) | **409** | 0.5s | `Stage … already has an SLA policy`. |
| 8 | `GET /api/sla/timers` | **200** | 2.1s | `{ items: [], total: 0, page: 1, pageSize: 50 }` — no timers yet (engine spawns them in P3.5). |
| 9 | `GET /api/tickets/:realId/sla` | **200** | 0.9s | `{ timers: [] }`. |
| 10 | `POST /api/sla/timers/<bogus-uuid>/extend` | **404** | 0.5s | `SLA timer … not found`. |
| 11 | `POST /api/sla-policies` `{ duration: 30 }` (below min) | **400** | <10ms | Zod field detail `duration: ["Number must be greater than or equal to 60"]`. |
| 12 | `DELETE /api/sla-policies/:id` | **204** | <1s | Soft-delete. |
| 13 | `tsc --noEmit` (backend) | EXIT=0 | — | — |

Extension request/decide flow not smoke-tested end-to-end this turn — needs a real `SlaTimer` row, which only exists after P3.5 wires the engine. The code paths are exercised by tests 10 (timer-not-found) and the type-level checks (Zod schemas + service signatures).

### Side findings (not blockers)

1. **`tsx watch` is unreliable on Windows when new files are added.** First smoke attempt against my just-edited `app.ts` returned 404s on every SLA route because the watcher had only booted once and never reloaded despite multiple edits. The Approval routes (added in a previous edit cycle) worked because they were present at the original boot. Symptom: log header shows `Backend listening …` exactly once, with no reload messages. **Workaround:** kill the listening PID and `npm run dev:backend` fresh. This same pattern affected the [P3.1 `prisma generate`](backend/prisma/migrations/20260512171857_workflow_phase3_django_alignment) step (file-lock on DLL) — Windows + Node-watcher combos seem to be a running theme. Not worth fixing in code; just `taskkill /F /PID <pid>` when in doubt.
2. **Soft-deleting an SLA policy does NOT cascade to its `SlaThreshold` rows.** When `softDeletePolicy` flips `isDeleted=true`, the threshold rows remain. If the policy is later revived via the idempotent-revive path (same `parentStageId`), the old thresholds are still attached. Could be a feature (preserves intent across edits) or a footgun (admin doesn't expect ghost thresholds). The replace-all-by-name semantics of `POST /thresholds` give admins a clean way to reset (`{thresholds: []}` clears all). Flagging for the FE plan to decide whether the inspector tab should "remember" thresholds across delete/re-create.
3. **`POST` returns 201 on revive even when the policy already existed in soft-deleted state** — same pattern as P3.2. Matches Prisma's upsert semantics from the caller's view; not a bug.

## P3.4 — BusinessCalendar module: CRUD admin (2026-05-13)

Smallest of the Phase 3 module surfaces. Single resource, single router, full CRUD with name-unique enforcement, revive-by-name, and `affectedPolicies` count surfaced on delete so the admin UI can warn before nuking a referenced calendar.

### Endpoints live (all gated by `business-calendar.*` permissions seeded in P3.1)

| Method | Path | Permission | Behaviour |
|---|---|---|---|
| `GET` | `/api/business-calendars` *(`?search=&includeDeleted=true&withPolicyCount=true`)* | `business-calendar.read` | List, name-substring search (case-insensitive). `withPolicyCount=true` adds a flattened `policyCount` per row (count of non-deleted `SlaPolicy` rows pointing at the calendar) for the admin UI's delete-protection warning. |
| `POST` | `/api/business-calendars` | `business-calendar.create` | Create. Name unique (409 on duplicate active). **Revives soft-deleted on name match** — same ID, new fields applied. |
| `GET` | `/api/business-calendars/:id` | `business-calendar.read` | Single read. **Always** includes `policyCount` (no opt-in flag at the detail endpoint — the cost is one extra count, negligible). |
| `PATCH` | `/api/business-calendars/:id` | `business-calendar.update` | Partial update with rename-uniqueness check. Rejects empty body. |
| `DELETE` | `/api/business-calendars/:id` | `business-calendar.delete` | Soft-delete. Returns **`204` when no policies were referencing** the calendar; returns **`200 { affectedPolicies: N }`** when one or more active policies still point at it (the FK is `SetNull` on hard-delete only, so soft-delete doesn't auto-detach — admins must edit those policies). Idempotent — already-deleted returns `204`. |

### Schema validation

- **Time strings**: `^([01]\d|2[0-3]):[0-5]\d$` regex — strict 24h `HH:MM` (so `"9:00"` without the leading zero fails as a footgun).
- **Day hours**: each weekday key is optional; value is `null` for non-working OR `{ start, end }` with start < end (enforced via Zod `.refine`).
- **Holidays**: array of `YYYY-MM-DD` strings, max 366 entries.
- **Timezone**: free string up to 64 chars (IANA names like `"Asia/Kolkata"` / `"America/New_York"` are validated at the runtime layer rather than Zod — the IANA list is huge).

### Files added

| File | Lines | Purpose |
|---|---|---|
| [`backend/src/modules/business-calendar/business-calendar.schema.ts`](backend/src/modules/business-calendar/business-calendar.schema.ts) | ~90 | Zod schemas — strict `HH:MM` regex, `start < end` refinement per day, holiday-array shape. |
| [`backend/src/modules/business-calendar/business-calendar.service.ts`](backend/src/modules/business-calendar/business-calendar.service.ts) | ~115 | CRUD + revive-by-name + `policyCount` flatten + soft-delete returning `{ affectedPolicies }`. |
| [`backend/src/modules/business-calendar/business-calendar.controller.ts`](backend/src/modules/business-calendar/business-calendar.controller.ts) | ~30 | Thin handlers. Delete handler returns 204 vs 200 based on `affectedPolicies`. |
| [`backend/src/modules/business-calendar/business-calendar.routes.ts`](backend/src/modules/business-calendar/business-calendar.routes.ts) | ~55 | Single router (default export). |
| [`backend/src/modules/business-calendar/business-calendar.openapi.ts`](backend/src/modules/business-calendar/business-calendar.openapi.ts) | ~105 | 5 `registerPath` calls + `BusinessCalendar` response shape (with optional `policyCount`). DELETE endpoint documents both 204 and 200 response variants. |

### Wire-ins

| File | Change |
|---|---|
| [`backend/src/app.ts`](backend/src/app.ts) | + default import of the router; + `app.use('/api/business-calendars', businessCalendarRoutes)`. |
| [`backend/src/openapi/spec.ts`](backend/src/openapi/spec.ts) | + side-effect import for OpenAPI registration. |

### Smoke verification — 13/13 green

Backend restarted before smoke (per the documented `tsx watch` workaround from P3.3). Curl results against the live API:

| # | Test | HTTP | Time |
|---|---|---|---|
| 1 | `GET /api/business-calendars` (default filter) | **200** | 2.0s — 2 seeded rows (`default-24x7`, `support-24x7`) |
| 2 | `GET ?withPolicyCount=true` | **200** | 0.5s — `policyCount: 0` flattened on both rows |
| 3 | `GET ?search=24x7` | **200** | 0.5s — search filter working |
| 4 | `POST` "US East 9-5" (weekday hours + 2 US holidays) | **201** | 0.9s |
| 5 | `GET /:id` | **200** | 0.4s — always includes `policyCount` |
| 6 | `PATCH` `{ timezone: 'America/Los_Angeles' }` | **200** | 0.9s |
| 7 | `POST` duplicate name | **409** | 0.2s — `A business calendar named "US East 9-5" already exists` |
| 8 | `POST` invalid `"9:00"` (no leading zero) | **400** | <10ms — Zod stacked both regex + refinement errors |
| 9 | `POST` `start: 17:00 >= end: 09:00` | **400** | <10ms — `start must be earlier than end` |
| 10 | `PATCH` `{}` empty body | **400** | <10ms — rejected (see side finding below) |
| 11 | `DELETE` (no policies referenced) | **204** | 0.9s |
| 12 | `DELETE` again | **204** | 1.0s — idempotent |
| 13 | `POST` revive-by-name | **201** | 2.3s — **same ID** returned, new `weeklySchedule` applied |
| — | `tsc --noEmit` (backend) | EXIT=0 | — |

### Side finding (cosmetic, applies to P3.2/P3.3 too)

Test 10 returned `400` with `details: {}` empty. Root cause: schema-level `.refine((d) => Object.keys(d).length > 0, { message: '…' })` puts its error in Zod's **`formErrors`** (no field path), and our [`backend/src/middleware/validate.ts`](backend/src/middleware/validate.ts) only forwards `flatten().fieldErrors`. So the user sees the right status code but loses the explanatory message. Same shape applies to the empty-PATCH refinement in `approval.schema.ts` and `sla.schema.ts`. Easy fix later: either (a) attach a path like `{ path: ['_form'] }` on the refinement, or (b) merge `formErrors` into the details payload in the middleware. Cosmetic — flagged for a separate small PR.

## P3.5 — Engine integration: SLA hooks + approval intercept + `/decide` endpoint + transition-body plumbing (2026-05-13)

The Phase 3 admin/read surface from P3.2–P3.4 now actually fires on ticket actions. Three new engine layers, two existing engine files modified, plus the `/decide` endpoint deferred from P3.2 and a small additive plumb-through on `/transition`. End-to-end verified.

### Files added

| File | Purpose |
|---|---|
| [`backend/src/modules/workflow/engine/calendar.ts`](backend/src/modules/workflow/engine/calendar.ts) (~210 LoC) | `addBusinessSeconds(from, seconds, calendar)` + `elapsedBusinessSeconds(from, until, calendar)`. Iterative day-walk in the calendar's TZ using native `Intl.DateTimeFormat` — **no `date-fns-tz` dep added**. Falls back to wall-clock when `calendar` is null. 366-day safety cap to defeat infinite loops on pathological all-holiday calendars. DST-aware via per-day offset lookup (±1h drift possible at the exact transition minute — acceptable for SLA). |
| [`backend/src/modules/workflow/engine/sla.handler.ts`](backend/src/modules/workflow/engine/sla.handler.ts) (~230 LoC) | Four hook functions ridden by existing engine call-sites: `onStageEntered` (creates timer; spawns escalation child ticket inline when `policy.escalationWorkflowId` is set), `onStageExited` (settles timer → `COMPLETED` or `COMPLETED_LATE` based on whether deadline already passed), `onTicketHeld` (accumulates `elapsedBeforePauseSec += now − lastResumedAt`, status → `PAUSED`), `onTicketResumed` (re-arms `lastResumedAt`, status → `RUNNING` or `EXTENDED` based on `extensionCount`). All hooks ride on the caller's tx. Each writes a `SlaTimerEvent` row and calls the noop `audit.emitter`. |
| [`backend/src/modules/workflow/engine/approval.layer.ts`](backend/src/modules/workflow/engine/approval.layer.ts) (~290 LoC) | Pure logic + tx-aware mutators: `getPolicy`, `ensureInstance` (find-or-create PENDING per `(ticket, policy)`), `recordDecision` (with self-approval block, approver-eligibility check, unique-approver guard), `isPolicySatisfied` (pure — switches on mode: SINGLE / ANY / ALL_REQUIRED / QUORUM / SEQUENTIAL), `isPolicyUnsatisfiable` (Q5 short-circuit: any REJECTED on ALL_REQUIRED/SEQUENTIAL makes the policy unsatisfiable; QUORUM/ANY/SINGLE can still recover). Top-level `decide(tx, params)` is the entry point used by both the action intercept and the `/decide` endpoint. |

### Files modified

| File | Change |
|---|---|
| [`backend/src/modules/workflow/engine/types.ts`](backend/src/modules/workflow/engine/types.ts) | + 7 new `AuditEventType` values (`APPROVAL_DECISION_RECORDED`, `APPROVAL_SATISFIED`, `APPROVAL_REJECTED`, `SLA_TIMER_STARTED/COMPLETED/PAUSED/RESUMED`). + 2 new `PerformActionStatus` values: `'pending_approval'` and `'approval_rejected'`. + `PerformActionPayloadWithApproval` interface (extends `PerformActionPayload` with optional `approvalDecision`/`approvalComment`). + optional `approval: { instanceId, remaining? }` field on `PerformActionResult`. |
| [`backend/src/modules/workflow/engine/tracking.layer.ts`](backend/src/modules/workflow/engine/tracking.layer.ts) | + optional `actor` param on `openStageTracking`; calls `onStageEntered` after tracking-row create. `closeStageTracking` calls `onStageExited` after closing all active rows. No-op when stage has no policy. |
| [`backend/src/modules/workflow/engine/orchestrator.ts`](backend/src/modules/workflow/engine/orchestrator.ts) | + import `approvalLayer` + `{ onTicketHeld, onTicketResumed }`. + approval intercept block in `performAction` (after `assertCanPerformAction`, before behavior dispatch): calls `approvalLayer.getPolicy` and short-circuits with `'approval_rejected'` / `'pending_approval'` results when the policy isn't satisfied yet. Falls through to existing behavior dispatch when satisfied. + `onTicketHeld(tx, ticketId, actor)` call inside `holdTicket` and `onTicketResumed` inside `resumeTicket`. |
| [`backend/src/modules/approval/{schema,service,controller,routes,openapi}.ts`](backend/src/modules/approval/) | + `DecideApprovalSchema` (Zod). + `decideInstance` service (wraps `approvalLayer.decide` in a `prisma.$transaction` and returns the post-decision view via `getInstance`). + `decideInstance` controller + route at `POST /api/approvals/:instanceId/decide` (permission: `approval.decide`). + OpenAPI registration with the long description explaining the SATISFIED → caller-re-invokes-action loop and the REJECTED stays-in-stage semantics. **This is the endpoint deferred from P3.2.** |
| [`backend/src/modules/ticket/ticket.schema.ts`](backend/src/modules/ticket/ticket.schema.ts) | + `approvalDecision: z.enum(['APPROVED','REJECTED']).optional()` and `approvalComment: z.string().max(2000).optional()` on `TransitionBodySchema`, with an inline comment documenting the three response outcomes. Backwards-compatible — existing callers unaffected. **Engine already supported it** (P3.5 intercept reads `payload.approvalDecision`); the schema just had to let the fields through. |
| [`backend/src/modules/ticket/ticket.openapi.ts`](backend/src/modules/ticket/ticket.openapi.ts) | + `'pending_approval'` / `'approval_rejected'` on `TransitionResponse.status` enum. + optional `approval: { instanceId, remaining? }` field with `.describe()` annotation. |

### Verified end-to-end smoke

Smoke run 1 — **happy path through `/transition`** (logged in as `qa@forgequantum.com` = QE role):

| Step | Result |
|---|---|
| `POST /api/tickets { workflowId, title }` | 201 — ticket raised; `SlaTimer` auto-spawned by `onStageEntered`: `status=RUNNING`, `deadline=startedAt+300s`, `STARTED` event row written |
| `GET /api/tickets/:id/sla` | `timers[0].status=RUNNING events=[STARTED]` |
| `POST /api/tickets/:id/transition { actionId }` (no `approvalDecision` → defaults to APPROVED) | 200 — intercept fires → `ApprovalInstance` created → APPROVED record (`approvedAsRole=QUALITY_ENGINEER`) → `isPolicySatisfied` returns true (`QUORUM` 1-of-1) → falls through to behavior dispatch → ticket advances `Single Stage → New Stage`. Response: `status: 'transitioned', enteredStages: [{New Stage}], exitedStages: [{Single Stage}]` |
| `GET /api/tickets/:id/approvals` | 1 instance, `status=SATISFIED`, 1 record (APPROVED by Priya Sharma, `approvedAsRole=QUALITY_ENGINEER`) |
| `GET /api/tickets/:id/sla` after transition | `timer.status=COMPLETED completedAt=…` + `events=[STARTED, COMPLETED]` (closed by `onStageExited` hook) |

Smoke run 2 — **REJECTED via `/decide` endpoint** (Q5 stay-in-stage):

| Step | Result |
|---|---|
| Pre-create `PENDING ApprovalInstance` via Prisma | manual setup (real flow would have the intercept create it) |
| `POST /api/approvals/:id/decide { decision: 'REJECTED', comment }` | 200 — instance flips `REJECTED`, record persisted with comment, returns the post-decision view |
| `GET /api/tickets/:id` | `currentStages: ["Single Stage"]` — **ticket did NOT move** (Q5 verified) |
| `POST /api/approvals/:id/decide` second time | 400 `"Approval instance is already REJECTED"` (idempotency guard) |

Smoke run 3 — **REJECTED via `/transition`** (after P3.5.b transition-body fix):

| Step | Result |
|---|---|
| `POST /api/tickets/:id/transition { actionId, approvalDecision: 'REJECTED', approvalComment: 'smoke reject' }` | 200 — response shape: `status: 'approval_rejected', enteredStages: [], exitedStages: [], approval: { instanceId: '…' }`. No stages moved. |
| `GET /api/tickets/:id` | `currentStages: ["Single Stage"]` — stays put |
| `GET /api/tickets/:id/approvals` | 1 instance `status=REJECTED`, 1 record `decision=REJECTED comment="smoke reject"` |
| `tsc --noEmit` (backend) | EXIT=0 |

### Three coherent approval paths the FE can use

| Path | Use case |
|---|---|
| `POST /transition` (no `approvalDecision`) | Happy path; defaults to APPROVED via intercept; ticket advances when policy is satisfied. |
| `POST /transition` with `approvalDecision: 'APPROVED' \| 'REJECTED'` + `approvalComment?` | Explicit decision through the same endpoint the FE already uses. Single-call workflow. |
| `POST /api/approvals/:instanceId/decide` | Approver-only flow when the approver is NOT the actor who'll later move the ticket forward (e.g. a doc controller approves a QE's submission, then the QE hits `/transition` later). |

### Notes + flagged items

- **`tsx watch` was killed + restarted** twice during P3.5 smoke work — same Windows + chokidar reliability quirk as P3.3. No code fix needed; `taskkill /F /PID <pid>` then `npm run dev:backend` works.
- **Escalation child ticket spawn** is wired but not exercised in smoke — `policy.escalationWorkflowId` was null in all smoke runs. The code path is `sla.handler.ts:onStageEntered` lines 78-127: creates a child `Ticket` + `TicketFlow` + initial `TicketStageTracking` with `parentTicketId` and `parentTicketStageId` set, and `SlaTimer.escalationTicketId` populated. Plan to smoke this in P3.7.
- **`ApprovalInstance` lacks `@@unique([ticket, policy])`** that Django has. Multiple ApprovalInstance rows per (ticket, policy) are permitted in our schema — useful for retry-after-rejection. The `ensureInstance` function in `approval.layer.ts` uses a `findFirst({ status: 'PENDING' })` query to enforce "at most one open per (ticket, policy)" instead. Documented in code.
- **Pure-function satisfaction checks** for `ALL_REQUIRED` use a simplified `Set(approvers).size >= requiredCount` rather than enumerating the role-or-user union as Django does. Edge case: if a policy has `approverRoles=[QE], requiredCount=1` and 1 QE approves, we're satisfied. If `requiredCount=2`, we need 2 distinct approvers (could be 2 QEs or 1 QE + 1 user). Adequate for Phase 3; can refine later if QMS audit semantics need stricter enumeration.

## P3.6 — Sweep functions + CLI runner (2026-05-14)

The cron-driven half of Phase 3. **Pure DB-only sweep functions** with no Redis dependency yet — the BullMQ wrapper that schedules these is P3.6.b. Today they're triggerable via `npm run sla:sweep` (CLI runner) or any host-level scheduler (PG cron, GitHub Actions, Render Cron, etc.). Each function is idempotent and concurrency-safe via `SELECT FOR UPDATE` locks.

### Files added

| File | Lines | Purpose |
|---|---|---|
| [`backend/src/jobs/sweeps/computeElapsed.ts`](backend/src/jobs/sweeps/computeElapsed.ts) | ~50 | Pure helpers: `computeElapsedSec(timer, now)` returns working-time elapsed (RUNNING/EXTENDED add the current run period; PAUSED freezes at `elapsedBeforePauseSec`; COMPLETED/BREACHED also terminal-frozen). `computePercentageConsumed(timer, policy, now)` returns `(elapsed / (duration + totalExtensionsSec)) * 100`. Mirrors `core-prod-scaling/backend/workflows/models/sla_timer.py:198-226`. |
| [`backend/src/jobs/sweeps/checkSlaTimers.ts`](backend/src/jobs/sweeps/checkSlaTimers.ts) | ~310 | The Q11 combined sweep. Three sub-functions called in sequence: <br>• `checkThresholds` — for every `RUNNING/EXTENDED` timer, compute elapsed%, write `THRESHOLD_HIT` for any configured threshold past its % that hasn't already fired. Captures **actual elapsed %** in `thresholdPercentage` (distinct from configured `percentage`). <br>• `triggerSlaTransitions` — for every `THRESHOLD_HIT` without a matching `SLA_TRANSITION` AND whose threshold has `targetSlaStageId` AND whose timer has `escalationTicketId`: advance the escalation child ticket via direct `TicketFlow.currentStages` mutation (bypasses `orchestrator.performAction` to avoid recursion). Writes `SLA_TRANSITION` event. **Parent ticket is never touched** (Q13). <br>• `checkBreaches` — timers `RUNNING/EXTENDED` AND `deadline <= now()` → flip to `BREACHED`, snapshot final `elapsedBeforePauseSec`, write `BREACHED` event. |
| [`backend/src/jobs/sweeps/checkApprovalDeadlines.ts`](backend/src/jobs/sweeps/checkApprovalDeadlines.ts) | ~60 | Independent sweep (separate cron in production — different domain): finds `ApprovalInstance` rows with `status = PENDING AND deadlineAt <= now()`, flips to `EXPIRED`. Ticket unaffected (same Q5 semantic — admins can re-trigger or the user can re-invoke the action). |
| [`backend/src/jobs/run-once.ts`](backend/src/jobs/run-once.ts) | ~35 | CLI entry point. `npm run sla:sweep` runs both; `-- --sla` or `-- --approval` scope to one. Per-phase results JSON-printed at the end. Exits cleanly with `prisma.$disconnect()`. |
| [`backend/package.json`](backend/package.json) | +1 line | New `sla:sweep` script. |

### Idempotency + concurrency design

- Each timer is locked via `await tx.$queryRaw\`SELECT id FROM "SlaTimer" WHERE id = ${cand.id} FOR UPDATE\`` inside a per-timer `prisma.$transaction({ timeout: 15_000 })` block. Two concurrent sweep runs serialize on the row lock.
- Threshold firing is latched by **existing `SlaTimerEvent` rows**: re-runs of the sweep skip a `(timer, thresholdName)` pair that already has a `THRESHOLD_HIT`. Same for `SLA_TRANSITION` events latching auto-transitions.
- Errors are caught per-timer/per-instance and accumulated into the result's `errors` array. One pathological row never aborts the sweep — the next 99 still process.

### Bug found + fixed during the first smoke run

First `npm run sla:sweep` against the live DB returned errors on every breach attempt:

```
Invalid prisma.$queryRaw() invocation:
Raw query failed. Code: 42883. Message: operator does not exist: text = uuid
HINT: No operator matches the given name and argument types. You might need to add explicit type casts.
```

Root cause: I wrote `WHERE id = ${cand.id}::uuid` — but `SlaTimer.id` is Prisma `String` → Postgres `TEXT`, not UUID. Stripped the `::uuid` cast from all three lock-statement sites. (Same applies to anywhere else that locks a Prisma `String @id` row via raw SQL — worth remembering as a Phase 3/4 gotcha.)

### Smoke verification

First run against the live DB (4 stale timers leftover from P3.5 smokes — already past their 300s deadlines):

```
SLA sweep: {
  "timersInspected": 4,
  "thresholdsFired": 8,        // multiple thresholds × 4 timers all met
  "transitionsTriggered": 0,   // none of them had escalation tickets attached
  "breachesFound": 4,          // all past deadline → flipped to BREACHED
  "errors": []
}
Approval deadline sweep: { "inspected": 0, "expired": 0, "errors": [] }
```

Controlled smoke (fresh 1-hour policy + 2 thresholds, manual fast-forward via Prisma direct write):

| Scenario | Setup | Sweep result | Events after |
|---|---|---|---|
| Fresh timer at 0% | raise ticket → auto-spawn | (no sweep run yet) | `STARTED` |
| Cross 50% threshold | set `elapsedBeforePauseSec=1900` (~53% of 3600) → sweep | `thresholdsFired: 1` | + `THRESHOLD_HIT warning pct=53.0` *(actual elapsed % captured)* |
| Re-run at 53% (idempotency) | same state → sweep again | `thresholdsFired: 0` | unchanged — latch works |
| Cross 75% threshold | set `elapsedBeforePauseSec=2900` (~80%) → sweep | `thresholdsFired: 1` | + `THRESHOLD_HIT critical pct=80.8` |
| Breach check at 80% | deadline still 1h future → sweep | `breachesFound: 0` | not breached (deadline in future) ✓ |
| `tsc --noEmit` (backend) | — | EXIT=0 | — |

The `thresholdPercentage` column on `SlaTimerEvent` captures the **actual elapsed %** at fire time (53.0, 80.8), distinct from the configured `SlaThreshold.percentage` (50, 75) — same audit-trail pattern as Django (`workflows/models/sla_timer.py:288-289`). Lets dashboards show "threshold was 75%, actually fired at 80.8%".

### Production scheduling — three options

The sweep functions are runner-agnostic. Until P3.6.b ships, ops have a few options:

| Path | How |
|---|---|
| Host scheduler (Render Cron / GitHub Actions) | Add a 15-min cron that runs `npm run sla:sweep -- --sla` from a build artifact; separate 30-min cron for `-- --approval`. Already works today. |
| `pg_cron` extension on Neon | Trigger via a Postgres extension that POSTs to a webhook endpoint on the API — needs a `POST /api/cron/sla-sweep` handler. Not built yet. |
| **BullMQ + Redis worker (planned in P3.6.b)** | Separate Node process running `npm run worker`, scheduled internally. Adds Redis to infra. Sign-off received 2026-05-14 to build. |

---

# Phase 3 — Frontend — Approval & SLA UI

**Status:** ⏳ Not started — plan drafted
**Plan doc:** [`docs/WORKFLOW_PHASE_3_FRONTEND_PLAN.md`](docs/WORKFLOW_PHASE_3_FRONTEND_PLAN.md)

Scope: SLA progress ring + countdown on ticket detail, approval-awaiting card + decide modal, two new inspector tabs (approval policy + SLA policy) on the workflow builder, business-calendar admin page, SLA breach tile on `/tickets`, ~5 days, ~2,500 LoC. No new runtime deps. Sign-off needed on FE.Q1–FE.Q9 in §3 of the plan.

---

# Phase 4 — Backend — Audit + E-Signatures

**Status:** ⏳ Not started

# Phase 4 — Frontend — Audit log + signature modal

**Status:** ⏳ Not started

---

# Phase 5 — Backend — Audit Scheduling + Dashboards

**Status:** ⏳ Not started

# Phase 5 — Frontend — Schedule admin + dashboards

**Status:** ⏳ Not started

---

# Frontend Phasing

The frontend has its own paired phase per backend phase. Two scheduling options:

### Option A — Sequential (default)

Backend phase N completes → frontend phase N starts → backend phase N+1 starts after frontend phase N done.

Pro: easy to track, clean handoffs.
Con: longest critical path. Backend team idle while frontend catches up.

### Option B — Pipelined (recommended for delivery speed)

Backend phase N+1 starts immediately after backend phase N. Frontend phase N starts in parallel with backend phase N+1.

Pro: backend team always working; frontend follows ~1 phase behind.
Con: needs explicit API contract freeze at end of each backend phase so frontend can build against stable types.

### Cadence per phase

| | Backend LoC | Frontend LoC (est.) | Total weeks (Option B) |
|---|---|---|---|
| Phase 1 | ~1,800 ✅ | ~2,500 (builder canvas + version compare) | 1.5 |
| Phase 2 | ~3,180 | ~2,000 (ticket list + detail + actions) | 2 |
| Phase 3 | ~4,000 | ~1,500 (approval modal + SLA badges + calendar admin) | 2 |
| Phase 4 | ~2,000 | ~1,000 (audit log viewer + signature PIN modal) | 1 |
| Phase 5 | ~2,500 | ~1,800 (schedule admin + dashboard widgets) | 1.5 |

**Frontend total**: ~8,800 LoC (rough; includes typed API client, hooks, and pages).

### Default plan unless you say otherwise

**Option A — Sequential.** I'll finish backend Phase 2 first (per the open Phase 2 plan), then circle back to frontend Phase 1 + 2 together (since the React Flow builder UI is tightly coupled to the workflow definition API). This avoids API churn during builder development.

If you want **Option B** instead — say so and I'll write a `WORKFLOW_PHASE_1_FRONTEND_PLAN.md` and start work on the builder UI in parallel with backend Phase 2.

---

## Convention for future entries

Each new phase section should include:

```
## P{phase}.{counter} — {Topic}
**File:** {path}
{summary}

### Added / Modified / Removed
{bullet list}

### Verification
{cURL commands or test results}
```

Bug fixes go inline at the bottom of the most relevant subsection, prefixed with the date.
