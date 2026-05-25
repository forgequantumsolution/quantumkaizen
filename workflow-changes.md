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
| Existing tickets (DOC-FQS-001/002/003) still link to workflow by snapshot | ✅ |
| Raise new ticket DOC-FQS-004 against simplified workflow | ✅ |

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
| `Ticket` | Workflow instance — `uniqueId` like `DOC-FQS-001`, `customFields Json?`, soft delete + hold flags |
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
- **`raiseTicket`**: Generates `{prefix}-FQS-{seq:003d}` ticket id with `SELECT ... FOR UPDATE` on the workflow row to serialise concurrent raises (Q1, Q2, Q9).
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
| `POST /api/tickets` → raise | ✅ uniqueId `DOC-FQS-001` allocated atomically |
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
| Submit modal → POST → redirect to `/tickets/:newId` | ✅ DOC-FQS-005 created |
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

**Status:** ✅ Complete (2026-05-14) — schema, modules (approval / SLA / business-calendar), engine integration, sweep functions, BullMQ wrapper, Vitest 44/44 + Playwright 2/2 green
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

## P3.6.b — BullMQ worker wrapper (2026-05-14)

Code-complete + tsc-clean. End-to-end smoke deferred to first production deploy — no local Redis available this session (no native Redis on Windows, Docker Desktop not running). The wrapper just schedules the already-smoke-verified sweep functions from P3.6, so the risk surface is the BullMQ wiring rather than the SLA logic.

### Files added

| File | Lines | Purpose |
|---|---|---|
| [`backend/src/jobs/queue.ts`](backend/src/jobs/queue.ts) | ~70 | Lazy `getConnection()` / `getSlaSweepQueue()` / `getApprovalDeadlineQueue()` factories. Each returns `null` when `REDIS_URL` is unset so the worker can decline-to-start cleanly. `closeAll()` for graceful shutdown. Queue + job name constants exported as strings. |
| [`backend/src/jobs/worker.ts`](backend/src/jobs/worker.ts) | ~115 | Separate Node entry point (`npm run worker`). On boot: <br>• Refuses if `REDIS_URL` is unset (logs message, exits 0). <br>• Schedules repeating jobs via `Queue.add(jobName, {}, { repeat: { pattern: env.SLA_SWEEP_CRON, key: 'sla-sweep-cron' } })` — fixed repeat keys so re-runs don't accumulate duplicates. <br>• Constructs two `Worker` instances (concurrency 1 each) wired to `checkSlaTimers` and `checkApprovalDeadlines` respectively. <br>• Logs every completed/failed job. <br>• SIGINT/SIGTERM → closes both Workers + both Queues + Redis + Prisma → exits 0. |

### Files modified

| File | Change |
|---|---|
| [`backend/src/config/env.ts`](backend/src/config/env.ts) | + `REDIS_URL: z.string().optional()`, + `SLA_SWEEP_CRON: z.string().default('every 15 min crontab')` (default `*/15 * * * *`), + `APPROVAL_DEADLINE_CRON: z.string().default('every 30 min crontab')` (default `*/30 * * * *`). API process never reads `REDIS_URL` — only the worker does. |
| [`backend/package.json`](backend/package.json) | + deps: `bullmq` `^5.76.8`, `ioredis` `^5.10.1` (18 packages added total). + scripts: `worker`, `worker:dev` (the latter via `tsx watch` for local iteration). |

### Verified locally

| Check | Result |
|---|---|
| `tsc --noEmit` | EXIT=0 |
| `npm run worker` with REDIS_URL unset | logs `[worker] REDIS_URL not set — worker not starting. Set REDIS_URL or use \`npm run sla:sweep\` for ad-hoc runs.` and exits 0 — graceful path works |
| `getConnection()` returns `null` when `REDIS_URL` undefined | ✓ in code |
| API process boots without Redis | ✓ — only the worker imports `./jobs/queue` |

### Production startup path (to verify on first deploy)

```bash
# 1. Provision Redis on your platform (Upstash, Render Redis, Aiven, etc.)
# 2. Set REDIS_URL in the worker service's env:
export REDIS_URL=rediss://default:<password>@oregon-redis.render.com:6379
# 3. Start the worker as a SEPARATE service (not in the API process):
npm run worker

# Verify in Bull Board or via Redis CLI:
redis-cli LRANGE bull:sla-sweep:wait 0 -1   # any queued jobs
redis-cli ZRANGE bull:sla-sweep:delayed 0 -1 WITHSCORES   # next firing time
```

The repeating-job pattern uses BullMQ's `Queue.add(name, data, { repeat: { pattern, key } })` API. The fixed `repeat.key` (`'sla-sweep-cron'` and `'approval-deadline-cron'`) makes re-starts idempotent — BullMQ deduplicates schedules by key.

### Notes

- **Worker concurrency = 1** for both queues. The sweep functions already lock per-row via `SELECT FOR UPDATE`; concurrency > 1 would serialize on the locks anyway and just add Redis contention.
- **`removeOnComplete: { count: 100 }` + `removeOnFail: { count: 200 }`** so the Redis job history doesn't grow unbounded. Tune via env if needed.
- **`Worker` is created per-queue** rather than one Worker handling both job names. Cleaner separation; BullMQ matches one Worker → one Queue.
- **The repeating jobs use the OLD-style `repeat: { pattern: '...' }`** (BullMQ v5 API). The newer `JobScheduler` API is also valid; we chose the older form because the docs are more stable and our cron strings are simple.

### Three open follow-ups for the eventual deploy

| Item | Note |
|---|---|
| Bull Board admin route | Add `@bull-board/express` + a route at `/api/admin/queues` for ops to inspect queues + manually trigger jobs. ~30 LoC; skipped now to keep this slice focused. |
| Render `worker` service in `render.yaml` | Single new service block: `type: worker`, `startCommand: npm run worker`, env injects `REDIS_URL` from a managed Redis. Not yet committed because the user's `render.yaml` was last touched pre-P3 and may need other updates. |
| `pg_cron` fallback | If Redis isn't desired in some environment, the same sweep functions can be triggered by a Postgres extension via a webhook endpoint on the API. Not built; sweep functions are already runner-agnostic. |

## P3.7 — Tests + verification (2026-05-14)

The pragmatic slice: Vitest for pure functions + one Playwright spec for the happy-and-reject e2e paths. Total ~3 hours of work, catches the 80% of regressions a future change would introduce.

### Vitest unit suite (44 tests, 333 ms)

Added Vitest as a devDep + `npm run test:unit` script. **Tests live under `tests/` at the repo root, which is gitignored** (so the test artefacts don't bloat PR diffs). The Vitest scripts in `backend/package.json` pass `--dir ../tests/unit` so they resolve correctly from the backend cwd. Playwright config uses `testMatch: ['e2e/**/*.spec.ts', 'tests/e2e/**/*.spec.ts']` to scan both committed + local-only specs.

| File | Tests | Covers |
|---|---|---|
| `tests/unit/approval.layer.test.ts` *(gitignored)* | 21 | `isPolicySatisfied` across all 5 modes (SINGLE, ANY, ALL_REQUIRED, QUORUM, SEQUENTIAL) with edge cases: empty records, all-rejected, duplicate same-approver, ignoring REJECTED in distinct-approver count. `isPolicyUnsatisfiable` returns true for ALL_REQUIRED/SEQUENTIAL with rejection, false for QUORUM/ANY/SINGLE (can still recover). |
| `tests/unit/computeElapsed.test.ts` *(gitignored)* | 11 | `computeElapsedSec` for every status (COMPLETED + BREACHED frozen; PAUSED + null-lastResumedAt frozen at elapsedBeforePauseSec; RUNNING + EXTENDED accumulate current running period; clamps negatives from clock skew). `computePercentageConsumed` accounts for `totalExtensionsSec` in denominator and handles `duration=0` divide-by-zero. |
| `tests/unit/calendar.test.ts` *(gitignored)* | 12 | `addBusinessSeconds` wall-clock fallback, single-day add, cross-day-boundary jumps, weekend skipping, holiday skipping, before-business-hours jumps. `elapsedBusinessSeconds` zero on `until <= from`, wall-clock fallback, single-day, multi-day-span-with-weekend correctness, 24x7 calendar near wall-clock. |
| **Total** | **44** | **All pure logic** — no DB, no HTTP, no Prisma. Pure functions stay pure. |

```
$ npm run test:unit
 Test Files  3 passed (3)
      Tests  44 passed (44)
   Duration  333ms
```

### Playwright e2e (2 tests, ~1.4 min)

Codifies the manual P3.5 smokes into a repeatable regression spec. Lives in `tests/e2e/phase3.spec.ts` *(gitignored)* alongside the existing committed perf suite (`e2e/perf.spec.ts`). Boots against the running `:4000` backend; doesn't spin its own server up. `playwright.config.ts` scans both directories via `testMatch`.

| Test | What it verifies |
|---|---|
| **Happy path** | Create SLA + approval policy on the Single Stage of Document Review v1 → QE raises a ticket → assert SLA timer auto-spawned (`RUNNING`, `STARTED` event) → `POST /transition { actionId }` (no `approvalDecision` → defaults to APPROVED via intercept) → assert response `status='transitioned'`, ticket advances `Single Stage → New Stage` → assert approval instance `SATISFIED` with 1 APPROVED record + `approvedAsRole='QUALITY_ENGINEER'` → assert SLA timer flipped to `COMPLETED` with `COMPLETED` event written. |
| **Reject path** | Create approval policy → QE raises → `POST /transition { actionId, approvalDecision: 'REJECTED', approvalComment }` → assert response `status='approval_rejected'`, `enteredStages=[]`, `exitedStages=[]` → assert ticket still on `["Single Stage"]` (Q5 stay-in-stage verified) → assert instance `REJECTED` with comment captured on record. |

```
$ npx playwright test e2e/phase3.spec.ts
  ok 1 [chromium] › happy path: raise → SLA spawn → /transition → SATISFIED + ticket advances + timer COMPLETED (46.4s)
  ok 2 [chromium] › reject path: /transition with approvalDecision=REJECTED → ticket stays in stage (Q5) (27.4s)
  2 passed (1.4m)
```

The spec uses `beforeEach` to wipe SLA + approval policies on the test stage so tests are independent. Tickets created during runs are tracked in a top-level array and cleaned up in `afterAll`. The seeded `Document Review v1` / `Single Stage` IDs are referenced as constants; if those ever change in the seed, the spec needs updating (flagged in the spec comments).

### What's deferred to a separate slice

| Item | Why deferred |
|---|---|
| Concurrency tests (two simultaneous `/decide` calls; hold + threshold race) | Hard to write reliably without a time-mocking infrastructure. The schema-level guarantees (`@@unique([instanceId, approverId])` on `ApprovalRecord`, `SELECT FOR UPDATE` in the sweep, `prisma.$transaction` around `recordDecision`) are documented; mechanical tests can come later. |
| BullMQ worker end-to-end test | Requires running Redis. Deferred to the first production deploy (see P3.6.b). |
| Escalation child ticket spawn smoke | The code path in `sla.handler.ts:onStageEntered` runs when `policy.escalationWorkflowId` is set; never exercised in this session because we didn't have a second workflow set up to serve as the escalation. The e2e spec could grow a 3rd test for this; left for the FE work where the UI will exercise it naturally. |
| `pg_cron` fallback | Sweep functions are runner-agnostic; building the webhook endpoint is non-blocking. |

### Phase 3 backend — final close-out summary

| Slice | What shipped | State |
|---|---|---|
| P3.1 | 6 enums + 9 models + back-relations + Django-alignment migration + seed (calendars + sample policies) | ✅ |
| P3.2 | Approval module: 7 endpoints + Zod + OpenAPI | ✅ smoke 13/13 |
| P3.3 | SLA module: 11 endpoints (policies + thresholds + timer read + extensions) + P2028 tx-timeout fix | ✅ smoke 13/13 |
| P3.4 | BusinessCalendar admin module: 5 endpoints + revive-by-name + affectedPolicies-on-delete | ✅ smoke 13/13 |
| P3.5 | Engine: `calendar.ts`, `sla.handler.ts`, `approval.layer.ts`, tracking hooks, `performAction` intercept, `/decide` endpoint, `TransitionBodySchema` plumbing | ✅ smoke 4 scenarios + Q5 verified |
| P3.6 | Sweep functions: `checkSlaTimers` (thresholds + escalation transitions + breaches) + `checkApprovalDeadlines` + CLI runner | ✅ smoke 5 scenarios |
| P3.6.b | BullMQ wrapper: `queue.ts`, `worker.ts`, env config, graceful no-Redis path | ✅ tsc clean + graceful path verified (e2e on prod) |
| P3.7 | Vitest 44/44 + Playwright 2/2 | ✅ |

**Total LoC added across Phase 3 backend:** ~3,800 (rough count from the file tables). **Migrations applied:** 2 (initial + Django-alignment revision). **Permissions seeded:** 17 new (`approval.*` × 6, `sla.*` × 7, `business-calendar.*` × 4). **Deferred follow-ups:** 6 minor items captured in the per-slice "side findings" sections.

### Phase 3 backend → Phase 3 frontend handoff

The FE has everything it needs:

- **Admin endpoints** are stable (`POST /api/{sla,approval}-policies`, `/api/business-calendars`, etc.) — the FE can build the inspector tabs + business-calendar admin page against this surface.
- **Ticket-side endpoints** are stable (`GET /tickets/:id/approvals`, `GET /tickets/:id/sla`, `POST /transition` with optional `approvalDecision/approvalComment`, `POST /approvals/:id/decide`) — the FE can build the SLA progress ring, approval-awaiting card, and decide modal against this surface.
- **Engine intercept is live** — calls to `/transition` on actions with policies will block & return `pending_approval` or `approval_rejected` as appropriate, OR advance the ticket if satisfied. The FE handles these as documented in `WORKFLOW_PHASE_3_FRONTEND_PLAN.md`.
- **Cron sweep can be exercised** via `npm run sla:sweep` for FE testing — drag a timer past 75% via DB poke, run the sweep, watch the SLA progress ring's notification badge update.

P3.7 closed; Phase 3 backend done. Phase 3 frontend is next.

---

# Phase 3 — Frontend — Approval & SLA UI

**Status:** ✅ Complete (2026-05-14)
**Plan doc:** [`docs/WORKFLOW_PHASE_3_FRONTEND_PLAN.md`](docs/WORKFLOW_PHASE_3_FRONTEND_PLAN.md)

Scope shipped: typed API client (approval/SLA/business-calendar), live SLA progress ring + countdown on ticket detail, approval-awaiting card + decide modal, all-instances approvals timeline tab, two builder-inspector flows (per-action approval policy + per-stage SLA policy with thresholds), `/admin/business-calendars` admin page, and an SLA breach/at-risk tile at the top of `/tickets`. No new runtime deps. Backend touched once (one field added to flow_json — see P3F.5).

## P3F.1 — API client modules

**Files:**
- `client/src/lib/api/approval.ts` (new, ~230 LoC)
- `client/src/lib/api/sla.ts` (new, ~295 LoC)
- `client/src/lib/api/businessCalendar.ts` (new, ~125 LoC)

Typed React-Query hooks for every Phase 3 endpoint:

- `useApprovalPoliciesForWorkflow`, `useApprovalPolicy`, `useCreate/Update/DeleteApprovalPolicy`
- `useTicketApprovals`, `useApprovalInstance`, `useDecideApproval`
- `useSlaPoliciesForWorkflow`, `useSlaPolicy`, `useCreate/Update/DeleteSlaPolicy`, `useUpsertThresholds`, `useDeleteThreshold`
- `useSlaTimers` (paginated, status-filtered), `useTicketSla` (live — 30s poll, paused while `document.hidden`, FE.Q1 signed off)
- `useRequestExtension`, `useDecideExtension`
- `useCalendars`, `useCalendar`, `useCreate/Update/DeleteCalendar` (the delete hook normalises the dual 204/200 response shape — `{ affectedPolicies }`)

## P3F.2 — Live SLA panel + ring + countdown

**Files:**
- `client/src/hooks/useCountdown.ts` (new, 1Hz countdown w/ document.visibilitychange pause/resume)
- `client/src/features/tickets/detail/SlaProgressRing.tsx` (SVG ring with FE.Q4 colour bands: green <50%, amber 50–79%, red ≥80%/BREACHED; PAUSED renders a pause glyph)
- `client/src/features/tickets/detail/SlaPanel.tsx` (one card per active timer — ring + countdown + last-fired threshold chip + extend button)
- `client/src/features/tickets/detail/SlaExtendModal.tsx` (hours + reason form → `useRequestExtension`)

Elapsed math mirrors backend (`elapsedBeforePauseSec + (now - lastResumedAt)` while RUNNING/EXTENDED; frozen on PAUSED/COMPLETED/BREACHED). Panel returns `null` when the ticket has no timers.

## P3F.3 — Approval-awaiting card + decide modal + timeline

**Files:**
- `client/src/features/tickets/detail/ApprovalAwaitingCard.tsx` (PENDING-only; "Decide" visible only to eligible approvers — user.id ∈ approverUsers OR user.role.name ∈ approverRoles — and only when the user holds `approval.decide` AND hasn't already recorded a decision)
- `client/src/features/tickets/detail/ApprovalDecideModal.tsx` (approve/reject radio + optional comment; toast surfaces SATISFIED / REJECTED / pending outcomes from the API response)
- `client/src/features/tickets/detail/ApprovalsTimeline.tsx` (audit view — all instances, newest first, with full record list per instance)

## P3F.4 — Wire panels into ticket detail page

**File:** `client/src/features/tickets/TicketDetailPage.tsx`

- `SlaPanel` lives in the right-hand sidebar above `Details`.
- `ApprovalAwaitingCard` lives above `ActionBar` so approvers see "Decide" before trying to transition (the orchestrator's approval intercept would block them anyway, but this is the friendlier UX).
- New "Approvals" tab inserted between "Timeline" and "Comments" — mounts `ApprovalsTimeline`.

## P3F.5 — Builder inspector flows

**Files:**
- `client/src/features/workflows/builder/inspector/ApprovalPolicyEditor.tsx` (modal — create/update/remove `ApprovalPolicy` for a single (stage, action) tuple; all modes except SEQUENTIAL fully editable, SEQUENTIAL's `approvalSequence` deferred to API)
- `client/src/features/workflows/builder/inspector/SlaPolicyEditor.tsx` (modal — create/update/remove `SlaPolicy` for a single stage; thresholds editable inline, name + percentage only; notify-roles/users deferred)
- `client/src/features/workflows/builder/inspector/StageInspector.tsx` (modified — added "SLA" section below secondary actions and a per-action approval link beneath each saved action)
- `client/src/features/workflows/builder/inspector/InspectorPanel.tsx` (now takes `workflowId` and forwards to `StageInspector`)
- `client/src/features/workflows/builder/WorkflowBuilderPage.tsx` (passes `id` as `workflowId` into the inspector)
- `client/src/features/workflows/builder/builder.types.ts` + `builder.serializer.ts` (added `persistedStageId?: string` on `StageNodeData`; serializer round-trips it from the backend response)
- `backend/src/modules/workflow/workflow.service.ts` (one-line addition — `data.persistedStageId = stage.id` in `toFlowJson` so the canvas can reach the real WorkflowStage UUID without an extra fetch)
- `client/src/lib/api/workflow.ts` (mirrored the new optional `persistedStageId` field on `BuilderNode.data`)

Editor buttons are gated on `persistedStageId` (for SLA) or `action.id` (for approvals) being set — both are populated only after the workflow has been saved, so the inspector copy explains: "Save the workflow first to configure an SLA on this stage."

## P3F.6 — Business-Calendars admin page

**Files:**
- `client/src/features/admin/business-calendars/BusinessCalendarsPage.tsx` (new — list with search, in-place create/edit modal, soft-delete with `affectedPolicies` warning, weekly-schedule grid w/ enable + start/end time per day, free-text holidays)
- `client/src/App.tsx` (added `/admin/business-calendars` route)

Default new-calendar timezone is `Intl.DateTimeFormat().resolvedOptions().timeZone` (user's browser). Weekly schedule defaults to Mon–Fri 09:00–17:00, weekends off.

## P3F.7 — SLA breach tile on `/tickets`

**Files:**
- `client/src/features/tickets/SlaBreachTile.tsx` (new — two stat cells: `BREACHED` count from server, plus client-computed `at risk` = RUNNING/EXTENDED timers ≥ 80% consumed; renders `null` for tenants without SLA usage)
- `client/src/features/tickets/TicketsPage.tsx` (mounted above the filter card)

## P3F.8 — Verification + Playwright suite (2026-05-15)

Static checks:
- `npx tsc --noEmit` clean on the client after every slice (P3F.2 through P3F.7).
- `npx tsc --noEmit` clean on the backend after the `persistedStageId` addition.
- No new runtime deps.

End-to-end Playwright coverage. All specs live under the gitignored `tests/e2e/` root, scanned via the existing `playwright.config.ts` `testMatch`.

**Harness changes**
- `playwright.config.ts`: bumped per-test `timeout` 60s → 120s (the warm happy-path needs ~50s against Neon; cold runs were timing out). `baseURL` flipped from `http://localhost:3000` → `http://localhost:5173` (FE is on Vite's default port).
- New shared `tests/e2e/_helpers.ts` — Prisma client wired to `backend/.env`, seeded user/role/workflow IDs, login + `seedAuthAndGoto` (writes the zustand-persist `qk-auth` key the protected route gate actually reads, not just raw `qk_token`), sweep CLI runners via `execSync npm run sla:sweep -- --sla|--approval`, plus `fastForwardTimer` / `expireApproval` time-travel helpers.

**Cache-invalidation fix shipped during testing** ([client/src/lib/api/ticket.ts:236-274](client/src/lib/api/ticket.ts#L236-L274))
`useTransition` / `useHoldTicket` / `useResumeTicket` now invalidate `approvalKeys.ticketInstances(id)` and `slaKeys.ticketSla(id)` on success. Without this the `ApprovalAwaitingCard` + `SlaPanel` lagged a full 30s poll behind every state change. The `ApprovalDecideModal` UI test in `phase3-ui-flows.spec.ts` exercises this path (decide → awaiting card must disappear).

**Backend bug caught + fixed** ([backend/src/jobs/sweeps/checkApprovalDeadlines.ts:39](backend/src/jobs/sweeps/checkApprovalDeadlines.ts#L39))
The approval-deadline sweep's `SELECT FOR UPDATE` raw query cast `id::uuid`, but `ApprovalInstance.id` is `String` in Prisma (TEXT at the DB layer). Postgres rejected with `ERROR: operator does not exist: text = uuid` every sweep run — the sweep was silently no-op'ing in production. Same class of bug as the SlaTimer one fixed in P3.6. Dropped the cast; the deadline-expiry test now sees PENDING → EXPIRED.

**Spec inventory** (18 tests, ~10.8 min wall clock)

| File | Test | Coverage |
|---|---|---|
| `phase3.spec.ts` | happy path (raise → SLA spawn → /transition → SATISFIED + COMPLETED) | API |
| `phase3.spec.ts` | reject path (Q5 stay-in-stage on REJECTED) | API |
| `phase3-backend-modes.spec.ts` | SINGLE — one approval satisfies | API |
| `phase3-backend-modes.spec.ts` | ANY — first APPROVED wins | API |
| `phase3-backend-modes.spec.ts` | ALL_REQUIRED(N=2) — PENDING after 1, SATISFIED after 2 | API |
| `phase3-backend-modes.spec.ts` | QUORUM(N=2) of 3 — 2nd satisfies; 3rd is rejected | API |
| `phase3-backend-modes.spec.ts` | PATCH mode + approver set takes effect on next instance | API |
| `phase3-backend-modes.spec.ts` | Approval-deadline sweep flips PENDING → EXPIRED | API + sweep CLI |
| `phase3-ui.spec.ts` | TicketDetailPage mounts SlaPanel + Approvals tab | UI |
| `phase3-ui.spec.ts` | TicketsPage mount path with running timer | UI |
| `phase3-ui.spec.ts` | Workflow builder inspector finds persisted stage + SLA section | UI |
| `phase3-ui-flows.spec.ts` | ApprovalDecideModal end-to-end (decide → awaiting card disappears) | UI + invalidation |
| `phase3-ui-flows.spec.ts` | ApprovalsTimeline tab shows recorded entry | UI |
| `phase3-ui-flows.spec.ts` | Builder SlaPolicyEditor create → inspector summary updates | UI |
| `phase3-ui-flows.spec.ts` | Builder ApprovalPolicyEditor create → action label updates | UI |
| `phase3-ui-flows.spec.ts` | SlaExtendModal request flow | UI |
| `phase3-ui-flows.spec.ts` | BusinessCalendarsPage create + list + delete | UI |
| `phase3-ui-flows.spec.ts` | SlaBreachTile renders with a BREACHED timer (DB-seeded) | UI |

**Gaps still untested** (deferred per scope):
- Backend SLA timer pause/resume on hold/unhold.
- SLA extension request → admin approval → deadline shift end-to-end.
- SLA threshold firing + breach detection + escalation child-ticket spawn (the sweep code path; the SlaBreachTile test only seeds the BREACHED row directly).
- BullMQ worker (`worker.ts`) — sweeps are exercised via the `run-once.ts` CLI; the cron wrapper isn't.
- BusinessCalendar duration math in production timers (the calendar component is covered by 44 vitest unit tests in `tests/unit/calendar.test.ts`).
- SEQUENTIAL approval mode.

---

# Phase 3.5 — Forms ↔ Workflow Integration

**Status:** 🟡 Code complete, tests pending (2026-05-16)
**Plan doc:** [`docs/WORKFLOW_PHASE_3_5_PLAN.md`](docs/WORKFLOW_PHASE_3_5_PLAN.md)

Scope: stages can declare required (or optional) forms; the engine blocks `/transition` until each required form is submitted on the ticket. `FormSubmission` rows gain optional `ticketId`/`stageId`/`flowId`/`bindingId` FKs so the existing standalone `/forms` flow keeps working unchanged.

## P3.5.BE.1 — Schema + migration

**Files:**
- `backend/prisma/schema.prisma` — new `StageFormBinding` model + four optional FKs on `FormSubmission` (`ticketId`, `stageId`, `flowId`, `bindingId`). Back-relations added on `User`, `Workflow`, `WorkflowStage`, `Form`, `Ticket`, `TicketFlow`.
- Migration `20260516120000_add_stage_form_bindings` applied via `prisma db execute` + `prisma migrate resolve --applied` (filtered diff output dropped unrelated drift in the live DB).
- `backend/package.json` — added `"predev": "prisma generate"` so a fresh-checkout dev never starts against a stale client.

## P3.5.BE.2 — Binding CRUD module

**New module** `backend/src/modules/stage-form/`:
- `stage-form.schema.ts` — Zod schemas (`CreateStageFormBindingSchema`, `UpdateStageFormBindingSchema`, `CreateWorkflowSubmissionSchema`, plus params + query schemas).
- `stage-form.service.ts` — `listForWorkflow`, `getBinding`, `createBinding`, `updateBinding`, `softDeleteBinding`, `listForTicket` (returns bindings + latest submission for the ticket's current stage(s)), `createWorkflowSubmission` (validates the binding belongs to a current stage and the route's `formId` matches before stamping all four FKs).
- `stage-form.controller.ts` — thin request→service shim.
- `stage-form.routes.ts` — four routers: workflow-scoped (GET/POST `/:id/stage-form-bindings`), binding (GET/PATCH/DELETE `/:id`), ticket-scoped list (GET `/:id/stage-forms`), ticket-scoped submission (POST `/:id/forms/:formId/submissions`).

**Wiring:** `backend/src/app.ts` — four `app.use` lines mounting under `/api/workflows`, `/api/stage-form-bindings`, `/api/tickets`.

**Permissions** (in `backend/prisma/seed.ts`): new `stage-form.{read,create,update,delete}` keys. Granted to `SUPER_ADMIN` + `QMS_ADMIN` by default; `QUALITY_ENGINEER` + `DOCUMENT_CONTROLLER` get `stage-form.read` + `form.read` + `form_submission.read`/`create` so they can see and fill bindings on tickets they work; `AUDITOR` gets read-only.

## P3.5.BE.3 — Engine integration

**Files:**
- New `backend/src/modules/workflow/engine/form.layer.ts` — single `findUnsatisfiedRequiredForms(tx, ticketId, stageId)` entry point. Loads all `isRequired=true` bindings for the stage, looks up SUBMITTED submissions for `(ticketId, stageId, formId)`, returns the binding rows with no matching submission.
- `backend/src/modules/workflow/engine/orchestrator.ts` — `performAction()` gains a Phase 3.5 intercept right after the approval intercept and before behavior dispatch. Unmet required forms → `BadRequest('Required forms not submitted', { formsRequired: [...] })` so the FE can render which forms are blocking.

The approval intercept stays the outermost gate (per Q8 commentary in the plan doc) — approvers see "Decide" first; once they decide APPROVED, the form check kicks in.

## P3.5.FE.1 — API client

**File:** `client/src/lib/api/stageForm.ts` — typed hooks for every endpoint:
- `useStageFormBindings(workflowId, opts)`, `useStageFormBinding(id)`
- `useCreateStageFormBinding(workflowId)`, `useUpdateStageFormBinding(id)`, `useDeleteStageFormBinding`
- `useTicketStageForms(ticketId)` — returns bindings + latest submission per binding
- `useCreateWorkflowSubmission(ticketId, formId)` — invalidates `stageFormKeys.ticket(ticketId)` so the awaiting card re-renders right after a fill

## P3.5.FE.2 — Builder inspector

**Files:**
- `client/src/features/workflows/builder/inspector/StageFormBindingEditor.tsx` — new modal. antd `Select` (single-pick, backend-search via the existing `useForms({ search })` hook, debounced 250 ms via `useDebouncedValue`), position number, required/optional toggle.
- `client/src/features/workflows/builder/inspector/StageInspector.tsx` — new "Forms" section below SLA. Lists every binding with form title + version + required pill + position + remove button. "Attach form" button at the section header opens the editor with `excludeFormIds` so already-attached forms don't surface in the picker.

## P3.5.FE.3 — Ticket detail

**Files:**
- `client/src/features/tickets/detail/RequiredFormsCard.tsx` — new card listing every binding for the ticket's current stage(s) with status pill (Not started / Draft saved / Submitted), "Fill"/"Resume"/"View" CTA that deep-links to `FormFillPage` with `?ticketId=…&bindingId=…&submissionId=…`.
- `client/src/features/tickets/TicketDetailPage.tsx` — mounts `RequiredFormsCard` between `ApprovalAwaitingCard` and `ActionBar`.
- `client/src/features/tickets/detail/ActionBar.tsx` — reads `useTicketStageForms(ticketId)`, computes `unsubmittedRequiredForms`, disables every transition button while any required form is unsubmitted. Tooltip surfaces the blocking form names.

## P3.5.FE.4 — FormFillPage workflow-bound path

**File:** `client/src/features/forms/FormFillPage.tsx` — reads `ticketId` + `bindingId` from `useSearchParams`. When both are present:
- Submit POSTs to the workflow-bound endpoint via `useCreateWorkflowSubmission`.
- Back button returns to the ticket detail instead of `/forms`.
- Toast errors unwrap the new `{ error: { message } }` envelope shape too.

Standalone fills (no query params) take the existing `useSubmitForm` path unchanged.

## P3.5.Verification — Static checks

- `npx tsc --noEmit` clean on backend after every slice.
- `npx tsc --noEmit` clean on client after every slice.
- Migration applied to the live DB; Prisma client regenerated.
- No new runtime deps (FE uses existing `antd`, `lucide-react`, `dagre` was already added in the layout slice).

End-to-end Playwright suite is pending — to come in a follow-up.

---

# Phase 3.5+ — Architecture refactors (post-feedback)

**Status:** ✅ Code complete (2026-05-16). Playwright suite pending.

After the initial Phase 3.5 shipped, four UX/architecture issues surfaced through real use. This section captures the fixes; the underlying philosophy shifted from "policies live in their own tables, attached via API" to **"canvas JSON is the single source of truth; policies materialise on Publish"**.

## P3.5+.1 — Workflow lifecycle: Save → draft + Publish split

**Problem:** the Save button hit `PUT /workflows/:id` which wipes and rebuilds every stage. Saving twice silently cascade-deletes all attached approval/SLA/form policies.

**Backend:**
- `service.setStatus()` — new status-only update at `PATCH /api/workflows/:id/status`. Touches `Workflow.workflowStatus` ONLY; doesn't rebuild stages. Refuses to activate a workflow with zero stages.
- `service.deleteDraft()` — new at `DELETE /api/workflows/:id/draft`. Drops the `TemporaryWorkflow` row so the next builder load sees the published state (not the stale draft).
- The existing `POST /api/workflows/:id/draft` (non-destructive draft save) was always present but wasn't wired to anything — now it's the primary Save path.

**Frontend:**
- `WorkflowDetailPage.tsx` — Activate / Deactivate buttons surface based on current `workflowStatus`. Calls `useSetWorkflowStatus(id)`.
- `WorkflowBuilderPage.tsx` — Save button rebound to `useSaveDraft` (draft only). New Publish button calls `useSaveWorkflow` with `workflow_settings.workflowStatus: 'ACTIVE'` + then `useDeleteDraft` to clear the draft. Confirms with a warning that attached policies will be re-built.
- Builder load effect prefers draft over published. Reload after Save Draft shows what you saved; after Publish the draft is gone and the canvas hydrates from the published `flow_json`.

## P3.5+.2 — Embed-in-JSON: policies live on the canvas, materialise on Publish

**Problem (the deep one):** even with Save→draft fixed, every Publish still nuked policies because `buildWorkflowGraph()` wipes + rebuilds stages, cascading approval/SLA/form rows. The user proposed: stop storing policy intent in side tables during the build phase — put it INSIDE the canvas JSON, and have Publish materialise everything in one transaction.

**Backend:**
- `workflow.schema.ts` — `NodeSchema.data` accepts three new optional shapes:
  - `formBindings: Array<{ formId, isRequired, position }>`
  - `sla: { duration, calendarId, escalationWorkflowId, pauseOnHold, pauseOnExtensionPending, thresholds[] } | null`
  - `approvalPolicies: Array<{ actionType, actionIndex, mode, requiredCount, ... approverRoleIds, approverUserIds, ... }>`
  - Approval policies key by `(actionType, actionIndex)` since actions don't have stable canonicalIds. Builder resolves to the just-created action UUID via an `actionIdByRef` map.
- `workflow.builder.ts buildWorkflowGraph()` — after the existing stage/action/transition inserts, three new write blocks:
  - Bulk `stageFormBinding.createMany` from `formBindings`
  - Per-stage `slaPolicy.create` + `slaThreshold.createMany` from `sla` (resolves `targetStageCanonicalId` → stage UUID via the just-built map; warns on unknown canonicalIds)
  - Per-policy `approvalPolicy.create` from `approvalPolicies`, with `approverRoles`/`approverUsers` m2m connections. SUPER_ADMIN-style validation kept on the engine side.
- `workflow.service.ts toFlowJson()` — selects `slaPolicy`, `formBindings`, and `approvalPolicies` (via `actions.approvalPolicies`) on workflow read, embeds them back into `node.data.sla` / `node.data.formBindings` / `node.data.approvalPolicies` so the canvas hydrates with everything.

**Frontend:**
- `builder.types.ts` — added `EmbeddedFormBinding`, `EmbeddedSla`, `EmbeddedApprovalPolicy` types and threaded them through `StageNodeData`. The serializer round-trips them verbatim.
- `lib/api/workflow.ts` — `BuilderNode.data` types extended to match.
- **StageInspector** rewritten: Approvals / SLA / Forms sections source from `data.approvalPolicies` / `data.sla` / `data.formBindings` (canvas state) and edit via `onChange`. The `persistedStageId` gate is gone — attachments work on a fresh canvas, no save required.
- **All three editors** (`SlaPolicyEditor`, `ApprovalPolicyEditor`, `StageFormBindingEditor`) rewritten to accept `value` + `onSave(next | null)` props and write to canvas state. No POSTs to `/api/sla-policies` / `/api/approval-policies` / `/api/stage-form-bindings` from inside the build flow. (The standalone live-edit endpoints still exist; they're just not used during build.)
- The Phase 3.5 standalone API surface (binding CRUD via dedicated endpoints) is now redundant during the build flow but kept for future surgical live edits.

**Caveat:** Publish remains destructive — every Publish rebuilds stages with new UUIDs. That's intentional now: the canvas JSON is the source of truth, so re-publishing wipes and re-creates from it. The pre-existing "stage reconciliation refactor" idea is no longer needed because policies travel WITH the canvas, not as orphan rows.

## P3.5+.3 — Ticket-id allocator: cross-workflow collisions

**Problem:** the allocator in `engine/orchestrator.generateUniqueTicketId` scoped its "find last ticket" query per-workflow, but `Ticket.uniqueId` is globally unique. Multiple workflows sharing the same `WorkflowType.codePrefix` (or no prefix → default `WF`) would each start at `001` and collide with already-issued ids on a sibling workflow.

**Fix:** dropped the per-workflow filter; the allocator now finds the highest existing ticket starting with the prefix across the whole table. Tickets with `parentTicketId != null` (SLA escalation children, named `{parent}-SLA`) are still excluded to keep the counter increment monotonic.

## P3.5+.4 — Approval self-approval: SUPER_ADMIN + explicit user grants

**Problem:** `recordDecision()` blocked any ticket creator from approving their own ticket unless `policy.allowSelfApproval` was on, even if:
- The caller was a SUPER_ADMIN (god-mode role should bypass everything)
- The caller was explicitly listed in `approverUserIds` — the policy author put them there on purpose

**Fix:** self-approval check now passes if any of:
1. `allowSelfApproval` is on
2. caller is SUPER_ADMIN (resolved via `user.role.name`)
3. caller is in `approverUserIds` directly (explicit per-user grant overrides the role-based block)

Approver eligibility check also gets the SUPER_ADMIN bypass — admins can decide on any policy without being listed.

## P3.5+.5 — Sample data: workflow-bound forms in the seed

**Files:** `backend/prisma/seed.ts` — adds two sample forms (`Submission Confirmation`, `Document Review Checklist`) with section + field definitions, and two `StageFormBinding` rows binding them to the seeded `Document Review v1`'s `Submit` (optional) and `Review` (required, blocks the Approve forward) stages. Upsert-style binding logic un-deletes soft-deleted bindings on re-seed so stale test debris doesn't poison fresh runs.

## P3.5+.6 — Verification (static)

- `npx tsc --noEmit` clean on backend + client across the entire refactor.
- Migration `20260516120000_add_stage_form_bindings` already applied from the initial Phase 3.5 ship (no new migrations needed in this refactor — schema changes are pure JSON-blob additions).
- Manually verified via PowerShell probes: ticket raise → Submit transition → Review stage → transition blocked with `formsRequired` → POST submission to workflow-bound endpoint → transition succeeds.

Playwright e2e is pending and will cover the new draft/Publish split, embed-in-JSON round-trip, and the activate flow.

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

## Misc — Ticket ID prefix rename (NEX → FQS)

**Date:** 2026-05-21
**File:** [`backend/src/modules/workflow/engine/orchestrator.ts`](backend/src/modules/workflow/engine/orchestrator.ts)

Ticket IDs are now generated as `{TYPE_PREFIX}-FQS-{seq:003d}` (e.g. `DOC-FQS-001`) instead of `…-NEX-…`. Reflects the ForgeQuantum Solution brand.

### Modified
- `generateUniqueTicketId` in `orchestrator.ts` — swapped the literal `NEX` for `FQS` in the prefix lookup (`startsWith`) and candidate string. Doc comment updated.
- Plan docs (`WORKFLOW_MASTER_PLAN.md`, `WORKFLOW_PHASE_2_PLAN.md`) and this changelog updated to match.

### Behaviour notes
- Existing `…-NEX-…` tickets in the DB are untouched and remain valid (uniqueId is still unique).
- The sequence lookup matches `{prefix}-FQS-` only, so the per-workflow counter restarts at `001` for the first FQS ticket. It does **not** continue from existing NEX sequence numbers. No migration was run.
- `QMS-Backend-Build-Guide.pdf` still references the old prefix — PDF not regenerated.

---

## Misc — Ticket UX pass (delete + table + stage-form refresh bug)

**Date:** 2026-05-21

Five small, related changes to the ticket UI plus one regression test.

### 1. Bug fix — next stage's form didn't appear without page refresh after a transition

**File:** [`client/src/lib/api/ticket.ts`](client/src/lib/api/ticket.ts)

`useTransition.onSuccess` was invalidating `ticket.detail`, `allowed-actions`, `track`, `timeline`, the `tickets.all` list, plus the Phase-3 `approval` and `sla` keys — but **not** `stageFormKeys.ticket(id)`. So after a transition the `RequiredFormsCard` (driven by `useTicketStageForms`) kept serving the previous stage's bindings from cache until a manual reload.

- Added `import { stageFormKeys } from './stageForm';`
- Added `qc.invalidateQueries({ queryKey: stageFormKeys.ticket(id) });` to `useTransition.onSuccess`
- Hold/resume are untouched — they don't change `currentStages`, so the cached binding list is still valid.

### 2. Delete-ticket UX (no soft-delete wording, centered antd modal)

**Files:** [`client/src/features/tickets/TicketDetailPage.tsx`](client/src/features/tickets/TicketDetailPage.tsx), [`client/src/features/tickets/TicketsPage.tsx`](client/src/features/tickets/TicketsPage.tsx)

`useDeleteTicket()` already existed; only the UI was missing. Added gated by the existing `ticket.delete` permission:

- **Detail page** — red `<Trash2>` ghost button in the header next to "View stages". On success, `navigate('/tickets')`.
- **List page** — a delete column in the table (see #3 below) with the same trash button. `e.stopPropagation()` so the row-click navigation doesn't fire.
- Both call `App.useApp().modal.confirm({ title: 'Delete ticket', content: 'Are you sure you want to delete <uniqueId>?', okText: 'Delete', okButtonProps: { danger: true }, centered: true })`. Replaced the earlier `window.confirm(...)` alert; dropped the "soft-delete" wording per request.

### 3. Tickets list switched to antd `<Table>`

**File:** [`client/src/features/tickets/TicketsPage.tsx`](client/src/features/tickets/TicketsPage.tsx)

The grid-of-cards + alternate list-view + grid/list toggle was replaced with a single antd `Table`.

- Removed: `viewMode` state, `VIEW_STORAGE_KEY` localStorage entry, the grid/list segmented toggle, the inline `TicketListView`, and the `TicketCard` import.
- Added: `buildColumns({ canDelete, onDelete })` returning `ColumnsType<TicketSummary>` — columns are **ID** (mono chip), **Title**, **Workflow · Stage** (with `Network` icon), **Priority**, **Status** (via existing `TicketStatusBadge`), **Updated**, and a conditional **delete** column.
- Row click via `onRow(t)` → `navigate('/tickets/' + t.id)`; cursor styled `pointer`.
- KPI strip, filter bar (search, status tabs, mine/all toggle, priority, workflow), "Load 50 more" pagination, and the `RaiseTicketDrawer` are all unchanged.
- Removed unused icon imports (`LayoutGrid`, `Rows3`, `ChevronRight`, `Clock`).

### 4. Deleted unused `TicketCard.tsx`

**File removed:** `client/src/features/tickets/shared/TicketCard.tsx`

After #3 nothing else imports it — verified via grep. Deleted rather than leaving a dead file behind. `npx tsc --noEmit` still clean.

### 5. Playwright regression test

**File:** [`tests/e2e/stage-form-refresh.spec.ts`](tests/e2e/stage-form-refresh.spec.ts)

Guards the #1 fix end-to-end:

1. Logs in via API, raises a fresh ticket on the existing "demo" workflow (`5c7eb9e7-…`) which has two stages each with a form binding (`CAPA Closure` → `CAPA Assessment`).
2. Submits stage 1's required form via `POST /tickets/:id/forms/:formId/submissions` so the FORWARD action isn't gated.
3. Drives the UI: opens the ticket detail page, clicks `Approve / Forward`, waits for the modal body (`Behavior: FORWARD`) to appear, clicks `Confirm`, and `page.waitForResponse('/transition' POST)` to gate on the actual mutation.
4. Without reloading, asserts:
   - `CAPA Assessment` (stage 2's form) is visible.
   - The "Forms for this stage" card contains `CAPA Assessment`.
   - At least one `GET /tickets/:id/stage-forms` request fired during the transition window (the invalidation refetch — direct evidence the cache fix is live).

Race-condition note inlined in the test: clicking `Confirm` before the modal mounts hits a background button and silently no-ops, which masked the bug as "fix doesn't work" during initial investigation. The explicit `waitFor('Behavior: FORWARD')` is what made the test reliable.

Run: `npx playwright test tests/e2e/stage-form-refresh.spec.ts` — passes in ~32s against Neon `us-east-1`.

### Verification

| Test | Result |
|---|---|
| `npx tsc --noEmit` (client) | EXIT=0 |
| `tests/e2e/stage-form-refresh.spec.ts` | ✅ 1 passed (33s) |
| Manual: delete-ticket modal renders centered, "Are you sure you want to delete DOC-FQS-…?" wording, no mention of soft-delete | Pending user confirm |
| Manual: tickets table — row click navigates, delete trash button stops propagation, filter bar still filters | Pending user confirm |

---

## Misc — Form submit UX + Approvals empty-state clarification

**Date:** 2026-05-21

Two unrelated UX tweaks on the ticket-detail flow.

### 1. Form fill — confirmation modal + button loading state

**File:** [`client/src/features/forms/FormFillPage.tsx`](client/src/features/forms/FormFillPage.tsx)

The workflow-bound form submission (`useCreateWorkflowSubmission`) was perceived as unresponsive: the request can take several seconds on Neon, but the page had no in-flight indicator and the `disabled={submitMutation.isPending}` guard only watched the standalone-fill mutation — the workflow-bound mutation's `isPending` was never read, so the button stayed enabled with no spinner during the slow round-trip.

Changes:

- Added `App.useApp().modal` and a centered `modal.confirm({ title: 'Submit form', content: 'Are you sure you want to submit this form? Once submitted you will not be able to edit your responses.', okText: 'Submit', cancelText: 'Cancel', centered: true })` ahead of the SUBMITTED mutation. Save-progress is unchanged (still a direct one-click).
- Refactored the submit path into `runSubmit(status)` (the network call) + `handleSubmitClick` (validate + open modal) + `handleSaveDraft` (call runSubmit directly).
- New local state `pendingStatus: 'IN_PROGRESS' | 'SUBMITTED' | null`, set at the start of `runSubmit` and cleared in `finally`. Drives both `disabled={isBusy}` on both buttons and per-button `isLoading={pendingStatus === '…'}` so the right button shows its spinner.
- Because `onOk: () => runSubmit('SUBMITTED')` returns the promise, antd also keeps the modal's OK button in its own loading state until the mutation settles — two visual cues during the slow POST.

Net effect: clicking Submit pops a confirmation, OK shows loading until the server replies, and the underlying Submit button also spins until navigation to the ticket detail kicks in. The previous silent-button-while-network-in-flight gap is gone.

### 2. Approvals tab — informative empty state

**File:** [`client/src/features/tickets/detail/ApprovalsTimeline.tsx`](client/src/features/tickets/detail/ApprovalsTimeline.tsx)

Reported confusion: the *Approvals* tab said "No approvals on this ticket." while the *Timeline* tab showed entries like "Exited New Stage via Approve / Forward", which read as approvals. Backend verification (`GET /tickets/.../approvals` and `GET /workflows/demo/approval-policies?includeInactive=true&includeDeleted=true` both `[]`) confirmed there genuinely were no `ApprovalInstance` rows — the `demo` workflow has zero `ApprovalPolicy` rows, so the engine's approval-intercept never fires. The "Approve / Forward" text in the Timeline is the seeded `WorkflowStageStatus.name` for FORWARD-behavior actions, an unrelated name collision with the approval concept.

Changes:

- Pulled in `useTicket(ticketId)` to derive `workflow.id`, then `useApprovalPoliciesForWorkflow(workflowId)` so the empty state can distinguish two cases.
- When `activePolicyCount === 0` (no `isActive && !isDeleted` policies exist): "No approvals on this ticket. This workflow has no approval policies configured, so its actions run through directly without an approval gate."
- When policies exist but no instances yet: "No approval decisions yet — approvals will appear here once a gated action is performed."

Initial draft also included a third paragraph explaining the "Approve / Forward" naming collision — trimmed back on user feedback to keep the empty state short.

### Verification

| Test | Result |
|---|---|
| `npx tsc --noEmit` (client) | EXIT=0 |
| Backend probe — DOC-FQS-001 timeline shows 4 stage events via "Approve / Forward"; approvals API returns `[]`; demo workflow has 0 policies (all flags) | ✅ confirms the empty state is correct, not a wiring bug |
| Manual — form Submit click triggers centered antd modal, OK shows loading until server reply, page Submit button shows spinner until navigation | Pending user confirm |
| Manual — Approvals tab on a `demo`-workflow ticket now shows the "no policies configured" copy | Pending user confirm |

---

## Misc — Ticket breadcrumb shows uniqueId instead of UUID

**Date:** 2026-05-21
**File:** [`client/src/components/layout/Header.tsx`](client/src/components/layout/Header.tsx)

Breadcrumb on `/tickets/<uuid>` was reading "Tickets ▸ 42595562-a603-4973-9586-010c373b07e7" because the segment-to-label map had no entry for the UUID and fell back to the raw string with a capitalised first letter.

Changes:

- Imported `useTicket` from `@/lib/api/ticket`.
- Detect the ticket-route shape: when `segments[0] === 'tickets'` and `segments[1]` exists, treat `segments[1]` as a candidate ticket id and pass it to `useTicket`. The hook gates itself on a truthy id, so it's a no-op on every other route.
- When building the breadcrumb labels, replace the matched UUID segment with `ticket.uniqueId` (e.g. `DOC-FQS-001`) when the query has resolved; fall back to the raw segment while loading.
- Shares the same `ticketKeys.detail(id)` queryKey as `TicketDetailPage`, so TanStack dedupes — no extra network request.

Trade-off: on a cold first visit there's a sub-second window where the raw UUID is shown before the ticket query resolves; on revisits the cache is already populated and the swap is instant. Accepted over blocking the breadcrumb render.

### Verification

| Test | Result |
|---|---|
| `npx tsc --noEmit` (client) | EXIT=0 |
| Manual — `/tickets/<uuid>` shows "Tickets ▸ DOC-FQS-…"; other routes unaffected | Pending user confirm |

---

## P1.10 — Workflow versioning restored (reverses P1.8)

**Date:** 2026-05-22
**Plan:** none — direct fix for a reported integrity bug.

### Why

P1.8 (2026-05-08) intentionally removed versioning. `save()` was reduced to "delete this workflow's stages + transitions, run `buildWorkflowGraph` over the same row." That worked for greenfield editing but breaks the moment a live ticket FK-references those stage rows: cascade-delete on `WorkflowStage` nukes `_TicketFlowCurrentStages`, `WorkflowStageAction`, `ApprovalPolicy`, `SlaPolicy`, `StageFormBinding`, `TicketStageTracking`, `SlaTimer`, `ChildWorkflowTrigger`, `ParallelBranchTracking`. The ticket ends up with empty `currentStages` and effectively wedges — no action bar, no transition possible, no path back except a manual DB poke.

The schema columns from the original versioning design (`Workflow.version`, `isLatestVersion`, `previousVersionId`, `parentWorkflowId`, `draftOfId`) were kept in P1.8 precisely so this could be reintroduced without a migration. They're now back in use.

### Backend changes

| File | Change |
|---|---|
| `backend/src/modules/workflow/workflow.versioning.ts` | **New** (~330 LoC). Exports `cloneIntoNewVersion(tx, oldId, body, userId)` and `resolveLatestVersion(tx, workflowId)`. `cloneIntoNewVersion` creates a new `Workflow` row with `version = old + 1`, `isLatestVersion = true`, `previousVersionId = old.id`, `parentWorkflowId = old.parentWorkflowId ?? old.id`; reruns `buildWorkflowGraph` on the new id; then re-creates `ApprovalPolicy`, `SlaPolicy` + `SlaThreshold` (responsibleRoles/Users + notifyRoles/Users m2m carried over), `StageFormBinding`, and `ChildWorkflowTrigger` on the new stages via `canonicalId` → newStageId mapping. Actions are matched by `(stageCanonicalId, workflowActionId)` because `WorkflowStageAction` has no canonicalId of its own (it's keyed on `@@unique([workflowStageId, workflowActionId])`). Old row is `UPDATE … SET isLatestVersion = false`; its stages/policies are otherwise untouched so live tickets still resolve their FKs. Note in the imports: **must not** import from `workflow.service` — that forms a circular dep that under tsx-watch silently leaves `cloneIntoNewVersion` undefined at runtime (a save that should have version-bumped instead falls back to the previous in-place path). Bit me during implementation; the comment now explicitly flags it. |
| `backend/src/modules/workflow/workflow.service.ts` | `save()` split into two paths. First save on an empty shell (`_count.stages === 0`) still mutates in place and returns `{ workflow: { id }, meta: { versionBumped: false } }`. Any save after stages exist calls `cloneIntoNewVersion` and returns `{ workflow: { id: newId, previousVersionId: oldId }, meta: { versionBumped: true } }`. Also added: `400 Bad Request` if `existing.isLatestVersion === false` — older versions are immutable. `list()` defaults to filtering `isLatestVersion = true`; opt out with `?includeAllVersions=true`. |
| `backend/src/modules/workflow/workflow.schema.ts` | Added `includeAllVersions: 'true'|'false'` to `ListWorkflowsQuerySchema`. |
| `backend/src/modules/workflow/engine/orchestrator.ts` | `raiseTicket` now calls `resolveLatestVersion(tx, input.workflowId)` before reading the workflow, so a ticket raised against a stale id silently routes to the lineage head. `TicketFlow.workflowVersion` is meaningful again (the snapshot of the version the ticket was actually raised against). |

### Frontend changes

| File | Change |
|---|---|
| `client/src/lib/api/workflow.ts` | `SaveWorkflowResponse.workflow` now typed `{ id: string; previousVersionId?: string }`; `meta.versionBumped?: boolean`. |
| `client/src/features/workflows/builder/WorkflowBuilderPage.tsx` | `handlePublish` reads `res.meta.versionBumped` — when `true`, `navigate('/workflows/<newId>/builder', { replace: true })` so the next save targets the new latest version (otherwise the FE would PUT against the now-frozen old id and hit the 400 from above). Publish-confirm wording rewritten: removed the old "WARNING: policies will be re-created" text and replaced with "Existing tickets stay on the previous version they were raised against. New tickets will use this new version." (The first wording was true under P1.8 and misleading now.) |

### Behavioural contract (new)

| Operation | Before | After |
|---|---|---|
| `PUT /workflows/:id` on a shell with no stages | In-place rebuild | In-place rebuild (unchanged) |
| `PUT /workflows/:id` on a workflow with stages | In-place wipe-and-rebuild, same id, breaks live tickets | Creates new `Workflow` row, returns its id; old row pinned `isLatestVersion=false` with stages intact |
| `PUT /workflows/:id` when the row is `isLatestVersion=false` | (Never happened — versioning was off.) | 400 with `Cannot edit an older workflow version` |
| `POST /tickets` with a stale workflowId | Engine errored or raised on the wrong (stale) graph | Engine resolves lineage head and raises against latest |
| `GET /workflows` | Returns everything | Defaults to `isLatestVersion=true`; old versions hidden unless `?includeAllVersions=true` |
| `GET /workflows/:id` | Returns the row | Unchanged (lets the engine inspect any specific historic version) |

### Tests

| File | Result |
|---|---|
| `tests/e2e/workflow-versioning.spec.ts` — **new** API-level spec. Walks shell → first save (in-place, no bump) → raise ticket → second save (bump) → assert old workflow still alive with original stage UUIDs → assert ticket's `currentStages` still references the **old** stage row → assert default list hides the old version → assert raising against the old id auto-routes to the latest. | ✅ 42s |
| `tests/e2e/stage-form-refresh.spec.ts` — earlier regression test for the form-refresh cache fix | ✅ 42s (still green) |
| `npx tsc --noEmit` (backend + client) | EXIT=0 |

### P1.10.1 — Same-day follow-up: duplicate-clone bug on re-save

User reported `Unique constraint violation` on `(stageId, formId)` the first time they tried to add a stage to a workflow with form bindings already attached (the `demo` workflow).

**Root cause:** `buildWorkflowGraph` already materialises `StageFormBinding`, `ApprovalPolicy`, and `SlaPolicy` (with thresholds) rows from the embedded `formBindings` / `approvalPolicies` / `sla` blocks the FE serializes into `flow_json` per stage. My initial `cloneIntoNewVersion` was *also* cloning them from the old workflow, so the new workflow ended up with two binding rows pointing at the same `(stageId, formId)` and the @@unique constraint fired inside the transaction.

**Fix:** trimmed `cloneIntoNewVersion` to only clone `ChildWorkflowTrigger` explicitly (the one association the builder doesn't yet re-materialise from `flow_json`). Form bindings, approval policies, and SLA policies/thresholds now flow through `buildWorkflowGraph` alone, the same way they do on a first save. File: [`workflow.versioning.ts`](backend/src/modules/workflow/workflow.versioning.ts) (~330 LoC → ~190 LoC). Added explanatory comments calling this out so the next maintainer doesn't add the redundant clones back.

**New UI-level Playwright spec:** [`tests/e2e/workflow-versioning-ui.spec.ts`](tests/e2e/workflow-versioning-ui.spec.ts) — drives the actual browser builder: opens a pre-existing ticket on v1, opens the builder, renames a stage via the inspector, clicks Publish, accepts the confirm dialog, captures the PUT response (`versionBumped: true`, new `workflow.id`), waits for the URL to swap to `/workflows/<v2>/builder`, reopens the ticket and asserts the old stage name + same `currentStages[0].id` are still there, then raises a fresh ticket against the OLD workflow id and asserts the engine routes it to v2's renamed stage.

**Verification:** new regression spec [`tests/e2e/workflow-versioning-formbindings.spec.ts`](tests/e2e/workflow-versioning-formbindings.spec.ts) — creates a workflow with a form binding on its only stage, saves it (in-place), then re-saves it (version bumps), and asserts:
- save2 succeeds (no @@unique violation),
- v2 has exactly one `StageFormBinding` row pointing at the same `formId`.

Re-ran the full set together — all green:

| Spec | Result |
|---|---|
| `workflow-versioning.spec.ts` (API) | ✅ 40s |
| `workflow-versioning-ui.spec.ts` (browser builder → publish → ticket pinning) | ✅ 53s |
| `workflow-versioning-formbindings.spec.ts` (this bug) | ✅ 22s |
| `stage-form-refresh.spec.ts` (cache-invalidation regression from earlier) | ✅ 33s |

### P1.10.2 — Publish confirmation: antd modal instead of window.confirm

**Date:** 2026-05-22
**File:** [`client/src/features/workflows/builder/WorkflowBuilderPage.tsx`](client/src/features/workflows/builder/WorkflowBuilderPage.tsx)

The Publish button in the builder used a native `window.confirm()` alert — inconsistent with the rest of the app (ticket delete, form submit) which uses centered antd `modal.confirm`. Swapped over.

- Imported `App` from `antd` and pulled `modal` via `App.useApp()`.
- Split the old `handlePublish` into two pieces: `runPublish()` does the actual work (serialize → mutateAsync → cache invalidation → toast → navigate on version bump), and `handlePublish()` just opens the modal. `onOk: () => runPublish()` returns the promise so the modal's OK button stays in its own loading state until the backend responds — layered on top of the toolbar Publish button's existing `isLoading={publish.isPending}` spinner.
- Modal copy: title "Publish workflow", body "A new version of this workflow will be created and activated. Existing tickets stay on the previous version they were raised against; new tickets will use this version.", buttons "Cancel" / "Publish", `centered: true` (same styling as the delete-ticket and form-submit modals).

**Spec update:** [`tests/e2e/workflow-versioning-ui.spec.ts`](tests/e2e/workflow-versioning-ui.spec.ts) — the previous version of the spec used `page.once('dialog', d => d.accept())` to handle the browser `confirm()`. With the modal-based flow that listener never fires; the spec now scopes the OK click to `.ant-modal-confirm` and clicks the inner `Publish` button via `getByRole('button', { name: 'Publish', exact: true })`. Re-ran the spec: ✅ 60s.

### Known follow-ups (not addressed this turn)

- The detail page (`WorkflowDetailPage`) doesn't yet show "this version was superseded — view latest" when viewing an `isLatestVersion=false` row; the builder will at least block the save with a 400 if the user lands on a stale URL via bookmark.
- Per-stage SLA escalation `targetSlaStage` lookup currently re-resolves against the escalation workflow by canonicalId — if the escalation workflow itself has versioned in between, the new threshold's `targetSlaStageId` may be `null`. The original threshold survives on the old version; only the *cloned* one on the new version may lose the target. Worth verifying in a real escalation chain; left as a TODO.
- Old version cleanup / GC isn't implemented; a workflow that's been heavily edited will accumulate rows. Acceptable for now (typed UUIDs, no perf impact on the hot path), but eventually we'll want a `prune` admin op that drops historic versions with no live tickets pointing at them.

## P1.11 — Form versioning (mirrors workflow versioning from P1.10)

**Date:** 2026-05-23
**Files:**
- [`backend/src/modules/dynamic-form/dynamic-form.service.ts`](backend/src/modules/dynamic-form/dynamic-form.service.ts)
- [`backend/src/modules/dynamic-form/dynamic-form.controller.ts`](backend/src/modules/dynamic-form/dynamic-form.controller.ts)
- [`backend/src/modules/dynamic-form/dynamic-form.schema.ts`](backend/src/modules/dynamic-form/dynamic-form.schema.ts)
- [`client/src/features/forms/hooks.ts`](client/src/features/forms/hooks.ts)
- [`client/src/features/forms/FormBuilderPage.tsx`](client/src/features/forms/FormBuilderPage.tsx)

### Why

User report: "the form versioning is not working — we don't save forms as different versions currently. I want the same behaviour as workflow versions: if the form is not attached to any workflow and has no ticket, update in place; if it's attached to a workflow that has a ticket, the workflow keeps using the old version until the new version is explicitly attached; new workflows always use the latest." The `Form` schema already had `templateKey` / `version` / `versionId` columns and `StageFormBinding.formId` / `FormSubmission.formId` already pinned to specific version rows — the save path just never bumped, so every publish was an in-place destructive rebuild against the single row. Same lesson workflows learned in P1.10, applied to forms.

### Behavioural contract (new)

| Operation | Before | After |
|---|---|---|
| `POST /forms/form/fields/create/:id` on a form with **no** bindings | In-place rebuild | In-place rebuild (unchanged) |
| `POST /forms/form/fields/create/:id` on a form bound to a workflow that has **no ticket yet** | In-place rebuild | In-place rebuild (unchanged) |
| `POST /forms/form/fields/create/:id` on a form bound to a workflow that **has a ticket** | In-place rebuild — silently mutated the schema in-flight tickets were filling | Clones a new `Form` row (same `templateKey`, `version = MAX+1`, fresh `versionId`); writes sections+fields against the new row; old row + old `StageFormBinding` + old `FormSubmission`s untouched |
| `POST /forms/form_draft/save/:id` (Save Draft) | Upserts `FormDraft` only | Unchanged — drafts never bump |
| `GET /forms/form/get/` | Returns every `Form` row (e.g. "Test Form" three times after two bumps) | Defaults to one row per `templateKey` (highest version); each row's `all_versions` list lets the UI dropdown reach old versions. Opt out with `?include_all_versions=true` |
| Stage form-binding picker (`StageFormBindingEditor`) | Same `useForms` hook → showed duplicates after bumps | Inherits the latest-only dedupe automatically; new bindings pick the latest version |
| Response shape from publish | `{ status, message }` | `{ status, message, data: { form_id, version, version_id, version_bumped } }` so the client can show "saved as v2" |

### Changes

- **`dynamic-form.service.ts`**:
  - New `shouldBumpVersion(formId)` — single Prisma query: a `StageFormBinding` where `formId` matches AND `workflow.flows.some({ ticket: { isDeleted: false } })`. Workflow has no direct `tickets` relation; the path is `Workflow → TicketFlow → Ticket` (initially tripped a TS error here, fixed).
  - `saveFormFields(id, input)`: decides bump-or-rebuild up front; computes `nextVersion` as `MAX(version per templateKey) + 1` (not `loaded.version + 1`) so a direct URL nav to an older row can't produce a duplicate version number. Either:
    - **In-place**: drop sections on `id` → recreate sections → recreate fields → drop draft → patch form details on `id` (the existing path, unchanged).
    - **Bump**: create new `Form` row with all carried-over metadata (formType, location/mainProcess/criteria/pdcaApproved, workflowName/workflowType, createdById) → recreate sections on the **new** row → recreate fields → drop draft on the **old** row (the draft represented "WIP that just got published"). Old sections/fields/bindings/submissions untouched.
  - Single `prisma.$transaction([...])` for the whole save.
  - Return type now `{ form_id, version, version_id, version_bumped }`.
  - `listForms`: when `include_all_versions !== 'true'` (default), `groupBy({ by: ['templateKey'], _max: { version } })` then `findMany({ id: { in: latestIds } })` → paginated against the deduped set so `obj_count` reflects "logical forms", not "rows". The existing per-row `all_versions` list still populates correctly because it groups all versions of the appearing templateKeys.
- **`dynamic-form.schema.ts`**: added `include_all_versions: z.enum(['true', 'false']).optional()` to `ListFormsQuerySchema`.
- **`dynamic-form.controller.ts`**: `saveFormFields` forwards the version result; toast text becomes `Form saved as v{n}` when bumped, plain `Form saved` otherwise.
- **`client/src/features/forms/hooks.ts`**: exported `SaveFormFieldsResult` type; `useSaveFormFields` returns the unwrapped `r.data?.data` instead of the whole envelope, and invalidates *both* the old `['form', vars.id]` cache and the new `['form', result.form_id]` cache on bump (the old id no longer reflects current schema).
- **`client/src/features/forms/FormBuilderPage.tsx`**: `onPublish` reads `result.version_bumped` and shows the long-form toast when true: `"{Noun} saved as v{n} (older version stays attached to in-flight tickets)"`. `FormCreatePage` is left as-is — a brand-new form can never have a binding yet, so `version_bumped` is always false there.

### Why these specific decisions (recorded from the question/answer round with the user before coding)

- **Bump trigger** = "bound to workflow AND that workflow has a ticket". The user explicitly chose this over the broader "any binding OR any submission" trigger to keep version churn down for standalone fills. If a standalone form gets filled in a few times, in-place is fine — there's no in-flight workflow whose schema we're going to invalidate.
- **Drafts never bump.** Save Draft only touches `FormDraft`, which is per-form scratch state, not the published schema. Bumping on every keystroke would create dozens of garbage version rows.
- **Picker shows only latest per `templateKey`.** Matches "all new workflows will use the latest form version". Old versions are still reachable via the existing `all_versions` dropdown on each list row; nothing is hidden, just deduped.
- **Old bindings are NOT auto-rolled forward.** The user said the workflow keeps using the old version "until the new form version is attached to it" — that means an explicit re-attach step in the workflow builder. By design.

### Verification

| Test | Result |
|---|---|
| `npx tsc --noEmit` (backend) | EXIT=0 |
| `npx tsc --noEmit` (client) | EXIT=0 |
| [`tests/e2e/form-versioning.spec.ts`](tests/e2e/form-versioning.spec.ts) — full lifecycle: create form → pub (in-place) → bind to workflow → pub (in-place, no ticket yet) → raise ticket → pub (BUMP) → v1 schema frozen → binding still pinned to v1 → v2 has both fields → list dedupes default; `include_all_versions=true` returns both | ✅ 47s |
| Manual (user) — attach form to a workflow stage, raise a ticket on that workflow, then edit the form and publish; verify "saved as v2" toast + workflow stage still showing v1 | Pending user confirm |

### P1.11.1 — Stage inspector shows form name + version instead of UUID stub

**Date:** 2026-05-23
**Files:**
- [`backend/src/modules/workflow/workflow.service.ts`](backend/src/modules/workflow/workflow.service.ts)
- [`client/src/features/workflows/builder/builder.types.ts`](client/src/features/workflows/builder/builder.types.ts)
- [`client/src/features/workflows/builder/inspector/StageFormBindingEditor.tsx`](client/src/features/workflows/builder/inspector/StageFormBindingEditor.tsx)
- [`client/src/features/workflows/builder/inspector/StageInspector.tsx`](client/src/features/workflows/builder/inspector/StageInspector.tsx)
- [`client/src/features/forms/hooks.ts`](client/src/features/forms/hooks.ts) (param widening — kept from earlier draft)

User report: "the forms attached in the workflow which show while editing show the uuid instead of the form name, it should show the form name." The stage inspector's form-bindings list was rendering `Form abc12345…` because the canvas-state binding (`EmbeddedFormBinding`) only carried `{formId, isRequired, position}` — no title, no version.

**First attempt — discarded:** I added a `useForms({ include_all_versions: 'true', page_size: 200 })` lookup inside `StageInspector`, built a `Map<formId, {title, version}>`, and fell back to the UUID stub when the lookup missed. The user immediately pushed back: *"why does it fallback to the uuid why cant we just render the form name, is it not coming the api."* Correct call — the workflow API already had the Form FK right there in the `formBindings` Prisma select and just wasn't including the title field. Client-side fetch-then-map was the wrong abstraction.

**Actual fix — denormalise title + version into the canvas state at source:**

- **Backend (`workflow.service.ts`)** — `workflowDetailSelect.stages.formBindings` now also selects `form: { select: { title: true, version: true } }`; `toFlowJson` maps the joined title/version into each `formBindings[]` entry. Single Prisma join, no N+1 — the existing `select` was already loading `stage.formBindings`.
- **Canvas type (`builder.types.ts`)** — `EmbeddedFormBinding` gained optional `formTitle?: string` and `formVersion?: number`. Optional so legacy canvas state (saved before this field) still type-checks; new attaches + every backend reload populate them.
- **Picker (`StageFormBindingEditor.tsx`)** — `handleAdd` now stashes the picked form's title + version into the binding it hands to `onAdd`. The picker already had the form row in hand from its `useForms` call — zero extra cost. Newly-attached bindings render their name *immediately*, no round-trip needed.
- **Inspector (`StageInspector.tsx`)** — back to direct render: `b.formTitle ? `{b.formTitle} (v{b.formVersion})` : `Form {…}…``. Dropped the `useForms` lookup, the `useMemo` map, and the loading window. The UUID stub remains only as a literal-edge-case fallback for canvas state that predates this field on a form-deleted edge case.

The version suffix matters because P1.11 made forms versioned — a stage can be pinned to v1 while v3 is the latest, and the user needs to see which version is attached to decide whether to re-attach.

**Side change kept from the first attempt:** widened the `useForms` hook's params type to include `include_all_versions?: 'true' | 'false'` — the backend already accepted it but the client type didn't expose it. Other callers may still want it.

### Verification

| Test | Result |
|---|---|
| `npx tsc --noEmit` (backend) | EXIT=0 |
| `npx tsc --noEmit` (client) | EXIT=0 |
| Manual (user) — open workflow builder, click a stage with attached forms; rows should show "{form title} (v{n})" instead of "Form abc12345…". Attach a new form via the picker; the row should show the name immediately on add, before any save | Pending user confirm |

### Known follow-ups

- **Bump trigger may be too permissive — flagged 2026-05-23 for revisit.** Current rule (binding-exists AND workflow-has-ticket) allows in-place edits during the window between "form attached to workflow" and "first ticket raised on that workflow". User observed this in practice: attached form → edited → no bump → raised ticket → next edit bumped. Two alternatives if we tighten:
  - **(a) Bump as soon as any active binding exists** (simplest mental model; standalone forms still update freely).
  - **(b) Check tickets across the entire workflow lineage** (root + versions), not just the binding's specific workflow row — fixes the specific edge case where a workflow has tickets on v1 but the new binding is on v2.
  User chose to leave it as-is for now; revisit if the in-place-then-bump surprise causes a real incident.
- No "you are editing an older version" guard on the builder yet — if someone hits `/forms/<oldVersionId>/builder` via a stale URL, the publish will create v(n+1) off of MAX (correct numerically) but the user might be confused about which row they were editing. The forms list always serves the latest id so direct-URL is the only way to hit it.
- `FormCreatePage` discards the save result — fine today (new form, no bindings ever), but if we ever let users clone-from-existing in the create flow, this assumption needs re-examining.
- Old-version GC: same situation as workflows. A form bumped twenty times leaves twenty rows + their section/field trees. No perf concern at typical scale; eventually wants a `prune` admin op that drops rows with no live ticket pointing at them.

---

## Misc — Settings → Forms / Workflows: kill doubled PageHeader + nested PageContainer

**Files:**
- `client/src/pages/SettingsPage.tsx`
- `client/src/features/forms/FormListPage.tsx`
- `client/src/features/workflows/WorkflowsPage.tsx`
- `client/src/App.tsx`
- `client/src/features/forms/FormBuilderPage.tsx`

User screenshot showed `/settings?section=forms` rendering two stacked page headers: "Forms / Browse and configure dynamic forms." (from `SettingsPage`) and right below it "Form Builder / Build and version dynamic forms for any process" (from the embedded `FormListPage`). Same shape existed on `/settings?section=workflows`. Root cause: `SettingsPage` already wraps its body in `<PageContainer><PageHeader/>`, then embeds `<FormListPage />` / `<WorkflowsPage />` directly — and those pages ALSO wrapped themselves in `<PageContainer><PageHeader/>`. Two headers + nested padding.

Sidebar links go to `/settings?section=...` ([Sidebar.tsx:122-123](client/src/components/layout/Sidebar.tsx)) so the embedded path is the primary route; the standalone `/forms` and `/workflows` routes still exist in `App.tsx` but aren't linked from anywhere in the nav.

### Approach (after one iteration)

First pass introduced a `PageActionsContext` with `PageActionsProvider` + `useHoistPageActions` hook so embedded pages could register action buttons that would render in the outer SettingsPage's PageHeader. Over-engineered for two embedded sections: caused a render flash (effect-based registration), spread the "what's in this header" logic across three files, and required per-page inline fallback rendering. Ripped it out and replaced with explicit hardcoded actions in SettingsPage.

### Changed

- **`FormListPage`** — dropped its own `<PageContainer>` and `<PageHeader>`. Returns tabs / KPIs / toolbar / grid as a fragment. No action buttons rendered here at all; SettingsPage's PageHeader provides "Field types" + "New form".
- **`WorkflowsPage`** — same treatment: dropped `<PageContainer>` and `<PageHeader>`. Now accepts an optional `onCreateWorkflow?: () => void` prop. When provided (embedded case), the page skips its own header button + `CreateWorkflowModal`, and the EmptyState's "Create" action delegates to the parent. When omitted (standalone /workflows), the page keeps its self-managed inline button + modal so create still works.
- **`SettingsPage`** — single PageHeader, single PageContainer. `headerActions` is computed per-section:
  - `forms` → "Field types" + "New form/checklist" buttons (the kind label is derived from the `?tab=checklists` query param SettingsPage already reads).
  - `workflows` → "Create Workflow" button (gated on the `workflow.create` permission, read via `useAuthStore`); SettingsPage owns the `createWorkflowOpen` state and renders `CreateWorkflowModal` itself, passing `onCreateWorkflow` down to `WorkflowsPage`.
  - `master-data` → unchanged Save Changes button.
- **`App.tsx`** — standalone `/forms` and `/workflows` routes wrapped in `<PageContainer>` at the route level so direct URL access still gets the standard padding.

Standalone `/forms` has no header buttons (the route isn't linked from the sidebar; URL-only access). Standalone `/workflows` keeps the inline self-managed Create flow that was there before this refactor.

### Earlier in this session (unrelated to the duplicate)

`FormBuilderPage` also moved from `<div className="min-h-screen bg-slate-50">` + `w-full py-6` to `<PageContainer noSpacing>` (with `-mx-4 sm:-mx-6 px-4 sm:px-6` on its sticky top bar so it still bleeds edge-to-edge). Different problem — the builder canvas was flush against both edges with no horizontal padding when the app sidebar was open. Fix kept; doesn't interact with the doubled-header issue. `FormCreatePage` has a similar `min-h-screen` outer wrapper but already applies `px-6` on its inner divs, so it doesn't have the squeeze problem and was left alone.

---

## Misc — Ticket breadcrumb: stop flashing the raw UUID on cold visits

**Date:** 2026-05-23
**File:** [`client/src/components/layout/Header.tsx`](client/src/components/layout/Header.tsx)

Follow-up to the 2026-05-21 entry ("Ticket breadcrumb shows uniqueId instead of UUID"). That fix swapped the UUID for `ticket.uniqueId` once the query resolved, but fell back to the raw UUID while loading — so on a cold first visit you'd see `Tickets ▸ 4259…` for a moment before it became `Tickets ▸ DOC-FQS-001`. User reported this as confusing ("shows the uuid and then it shows the ticket id").

### Changed

- Compute `visibleSegments` by dropping the ticket-id segment entirely while `ticket?.uniqueId` is undefined. Breadcrumb reads `Tickets` during the loading window, then becomes `Tickets ▸ DOC-FQS-001` once the query resolves. UUID is never user-visible.
- `breadcrumbs.map` now iterates `visibleSegments` (so `isLast` and crumb paths stay correct when the segment is dropped).

`useTicket` call in Header is unchanged — still piggybacks on the same `ticketKeys.detail(id)` cache as `TicketDetailPage`, so no extra request.

### Verification

| Test | Result |
|---|---|
| Manual — cold load of `/tickets/<uuid>`: breadcrumb shows `Tickets` briefly, then `Tickets ▸ DOC-FQS-…`; no UUID flash | Pending user confirm |

---

## Misc — Create Workflow modal: inline "+ New type" create

**Date:** 2026-05-25
**Files:**
- [`client/src/features/workflows/shared/CreateWorkflowModal.tsx`](client/src/features/workflows/shared/CreateWorkflowModal.tsx)
- [`tests/e2e/workflow-create-inline-type.spec.ts`](tests/e2e/workflow-create-inline-type.spec.ts) (new)

Users could only pick an existing Workflow Type while creating a workflow — to add a new one they had to leave the flow and go to Settings → Workflow Types. The Create Workflow modal now exposes a small "+ New type" button beside the Type Select that opens a nested modal (name + code prefix + optional icon). On save it calls the existing `POST /workflow-lookups/types` (via `useCreateWorkflowType`), auto-selects the new type in the parent Select, and closes the nested modal.

### Changed

- Wrapped the existing modal body in a fragment and rendered a second `Modal` (`NewWorkflowTypeModal`) controlled by local `newTypeOpen` state.
- Added a `<button type="button">` "+ New type" on the same row as the "Type (optional)" label, right-aligned. Lucide `Plus` icon, `text-blue-600` to match other inline CTAs.
- `NewWorkflowTypeModal` is co-located in the same file (only call-site, and matches the "prefer concrete over abstraction" rule from feedback memory). Fields:
  - `name` (required, autofocus, max 250)
  - `codePrefix` (optional, uppercased on input, max 20, `font-mono uppercase` styling)
  - `iconName` (optional, max 100)
- On success it calls `onCreated({id, name})` which sets `typeId` in the parent, closes the nested modal, and resets local field state. Toast: "Type created".
- Uses the existing `useCreateWorkflowType` hook — its `onSuccess` already invalidates `lookupKeys.types`, so the parent Select repopulates with the new entry; React Query then renders it as the selected option (we set `typeId` to the freshly returned `t.id`).
- Parent modal now resets its state (`name`, `typeId`, `newTypeOpen`) on every close path — backdrop click, Escape, X button, Cancel button, and the post-create success path. Previously only the success path cleared state, so cancelling and reopening showed the stale form. The nested `NewWorkflowTypeModal` already cleared its own state on close.

### Verification

| Test | Result |
|---|---|
| `npx tsc --noEmit` (client) | ✅ Clean |
| `tests/e2e/workflow-create-inline-type.spec.ts` — open modal, click "+ New type", fill name + prefix, create, assert nested closes + parent Select auto-selects the new type, fill workflow name, submit, assert navigation to `/workflows/<id>/builder`. Cleans up via Prisma. | ✅ Passed (17.9s) |

---

## Misc — Workflow Types tab: add Create + Delete UI

**Date:** 2026-05-25
**File:** [`client/src/features/admin/workflow-types/WorkflowTypesTab.tsx`](client/src/features/admin/workflow-types/WorkflowTypesTab.tsx)

The Workflow Types tab under Settings → Master Data was previously read-only — types could only be created via seed scripts. The backend already exposed `POST /workflow-lookups/types` and `DELETE /workflow-lookups/types/:id` (gated on `workflow.lookups.manage`), plus the corresponding `useCreateWorkflowType` / `useDeleteWorkflowType` React Query hooks. Only the UI was missing.

### Changed

- Added an **Add Workflow Type** button (top-right, antd primary + lucide `Plus`), only rendered when the user has `workflow.lookups.manage`.
- Added an actions column with a `Trash2` icon button per row. Same permission gate; hidden on already-deleted rows (which the list query filters out anyway).
- Create modal mirrors `SeveritiesTab` (centered antd `Modal`, custom footer, `loading={create.isPending}` on OK). Fields: `name` (required, autofocus, max 250), `codePrefix` (optional, uppercased on input, max 20, `font-mono uppercase`), `iconName` (optional, max 100). Below the icon field are 9 chip suggestions of lucide names the sidebar already maps (`file-text`, `wrench`, `git-branch`, etc.) so users don't have to guess.
- Delete confirmation: short title + "Delete <Name>?" + one-line note that the type is removed from the sidebar and new-workflow picker while existing workflows/tickets remain intact. Avoids the "soft-delete" jargon per the tight-copy rule.
- API errors surface inline at the top of each modal via the shared `extractApiError` helper. The backend already returns a friendly `Conflict` message for hard-delete attempts when workflows reference the type — soft-delete (the default this UI uses) never hits that path.
- Replaced the existing `<Alert>` load-error block with the same inline-error pattern the rest of the admin tabs use, for visual consistency.

### Behavior notes

- Delete is soft — the backend route defaults to `?hard=false`, marking `isDeleted: true`. `listWorkflowTypes` already filters `isDeleted: false`, so the deleted row disappears from this table, from the sidebar Modules group, and from the Create Workflow type picker after the React Query cache invalidates. Existing workflows snapshot the type so they continue to render normally.
- Creating a type with the same name as a previously soft-deleted one revives it (existing backend behavior in `createWorkflowType` — un-sets `isDeleted` and updates `codePrefix`). This is how the UI's "restore" story works: just re-add by name; no separate Restore button needed.

### Verification

| Test | Result |
|---|---|
| `npx tsc --noEmit` (client) | pending |
| Playwright e2e (create → assert appears in sidebar Modules + table; delete → assert disappears from both) | pending — not added this turn |

---

## Misc — Workflows list: show version on each card

**Date:** 2026-05-25
**Files:**
- [`backend/src/modules/workflow/workflow.service.ts`](backend/src/modules/workflow/workflow.service.ts)
- [`backend/src/modules/workflow/workflow.openapi.ts`](backend/src/modules/workflow/workflow.openapi.ts)
- [`client/src/lib/api/workflow.ts`](client/src/lib/api/workflow.ts)
- [`client/src/features/workflows/WorkflowsPage.tsx`](client/src/features/workflows/WorkflowsPage.tsx)

The `Workflow.version` column has existed since P1.10 (versioning restore), but the list endpoint never surfaced it, so the Settings → Workflows cards couldn't show which version of a lineage each row represented. With `includeAllVersions=false` (the default), the list shows only the head of each chain, but two cards with the same name might still have very different version numbers when older live tickets force a bump on save — operators need that signal at a glance.

### Changed

- **Backend** — added `version: true` to `workflowSummarySelect` and `version: w.version` to the list mapping in `workflow.service.ts`. Added `version: z.number().int()` to `WorkflowSummarySchema` in `workflow.openapi.ts` so the OpenAPI contract reflects the new field.
- **Frontend (API)** — added `version: number` to the `WorkflowSummary` interface in `client/src/lib/api/workflow.ts`.
- **Frontend (UI)** — in `WorkflowsPage.tsx` `WorkflowCard`, rendered a small `v{n}` chip immediately to the left of the existing `WorkflowStatusBadge` (gray background, same row, `title` tooltip "Workflow version N"). Kept the rest of the card unchanged so the existing layout (name, type, stage/transition count, updated date, creator, actions) is undisturbed.

### Verification

| Test | Result |
|---|---|
| `npx tsc --noEmit` (backend) | pass |
| `npx tsc --noEmit` (client) | pass |
| Playwright e2e (assert version chip renders on each card) | pending — not added this turn |

---

## Misc — Fix: RETURN action never works from the ticket detail page

**Date:** 2026-05-25
**File:** [`client/src/features/tickets/detail/ActionBar.tsx`](client/src/features/tickets/detail/ActionBar.tsx)

The orchestrator's `RETURN` behavior requires a `returnToStageId` in the transition payload (`engine/orchestrator.ts:443` — `throw BadRequest('returnToStageId is required for RETURN')`). The ticket detail `ActionBar` modal only collected `actionId` + `remarks`, so clicking any RETURN-behavior action button always errored out with "returnToStageId is required for RETURN." Users reported "return to previous stage is not working" — root cause was the missing picker, not anything engine-side.

### Changed

- Added `useTicketTrack(ticketId)` to fetch the ticket's stage tracking history.
- Computed `returnTargets` from tracking rows: distinct visited `stageId`s minus the current stage. This mirrors the backend's "must have visited" check in `returnAction` (`engine/orchestrator.ts:702`), so the dropdown can't offer an invalid target.
- Added a `Select` inside the action modal that only renders when `pending.action.behavior === 'RETURN'`. Required field (red asterisk). Empty-state copy when the ticket has no prior stages.
- New `returnToStageId` state; cleared every time the modal opens for a new action.
- `handlePerform` now passes `returnToStageId` for RETURN and short-circuits with a toast if none is selected. The Confirm button is also disabled until a target is picked (or when there are no targets at all).
- Imports: added `useEffect`, `Select`, `useTicketTrack`.

### Verification

| Test | Result |
|---|---|
| `npx tsc --noEmit` (client) | pass |
| Playwright e2e (ticket with prior stage → click RETURN → confirm picker appears → submit → ticket lands on chosen stage) | pending — recommend adding to `tests/e2e/tickets/` |

---

## Misc — Required forms re-fillable on RETURN

**Date:** 2026-05-25
**Files:**
- [`backend/src/modules/workflow/engine/form.layer.ts`](backend/src/modules/workflow/engine/form.layer.ts)
- [`backend/src/modules/stage-form/stage-form.service.ts`](backend/src/modules/stage-form/stage-form.service.ts)

Stage form bindings were "satisfied for life" — any past SUBMITTED `FormSubmission` matching `(ticketId, stageId, formId)` permanently unlocked the gate. So after a RETURN to a stage that had a required form, the engine would let the next FORWARD through without a fresh submission, and the ticket detail UI showed the old "Submitted" pill with no way to re-fill. That defeated the purpose of returning the ticket for re-review.

### Changed

- **Engine gate** (`findUnsatisfiedRequiredForms`): look up the active `TicketStageTracking` row for `(ticketId, stageId)` and only count `FormSubmission` rows with `submittedAt >= enteredAt`. Every stage entry (including via RETURN) opens a fresh tracking row in `orchestrator.openStageTracking`, so this naturally scopes "satisfied" to the current visit. Falls back to `new Date(0)` if no active tracking exists, which shouldn't happen on the transition path but keeps the function defensive.
- **`listForTicket`** (stage-form service): for each current stage, find the active tracking row's `enteredAt`; when computing `latestSubmission` per binding, skip any submission whose `createdAt` is older than the visit start. Used `createdAt` (not `submittedAt`) here so IN_PROGRESS drafts saved during the current visit still surface as "Draft saved". `createdAt` was added to the internal select and stripped before assembling the response so the wire contract stays the same.
- The frontend (`RequiredFormsCard`, `ActionBar` form-block check) already drives off `latestSubmission?.status`, so with the backend filter in place a returned-to stage shows "Not started" + "Fill" again and the transition gate blocks until the new submission lands. No client change required.

### Behavior notes

- Prior submissions are preserved (audit-safe). `createWorkflowSubmission` always inserts a new row, so each visit produces its own submission with the correct `submittedAt`.
- Parallel-fork stages: each fork branch has its own `TicketStageTracking` row keyed by `stageId`, so the per-stage `enteredByStage` map handles them correctly.
- Stand-alone fills (no `ticketId`) are unaffected — the filter only kicks in when there's a current visit to scope against.

### Verification

| Test | Result |
|---|---|
| `npx tsc --noEmit` (backend) | pass |
| Playwright e2e (submit form → FORWARD → RETURN → assert "Not started" pill + Fill button + transition gate re-blocks until re-submit) | pending — recommend `tests/e2e/tickets/return-refill.spec.ts` |

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
