# Workflow System — Phase 1 Implementation Plan

**Status:** ✅ Complete (smoke-tested 2026-05-08); **versioning subsequently removed** — see `workflow-changes.md` §P1.8
**Owner:** Backend
**Target backend:** `backend/` (Node.js / TypeScript / Express / Prisma / PostgreSQL)
**Reference backend:** `../core-prod-scaling/backend/workflows/` (Django / DRF)

---

## 1. Context

The Django prod backend (`core-prod-scaling/backend/workflows/`) implements a sophisticated, compliance-first workflow engine: graph-based workflow definitions, parallel fork/join execution, multi-approval policies, SLA timers with business calendars, hash-chained audit logs (21 CFR Part 11), and form attachments. The current Node/TS backend has only auth/user/department/role/permission/site/organization modules — no workflow domain at all.

We're porting the system in **5 phases**:

| Phase | Scope |
|---|---|
| **Phase 1 (this doc)** | Workflow builder — graph definitions, versioning, validation. No runtime execution. |
| Phase 2 | Tickets + execution engine (transition layer, graph layer, decision layer, access layer, tracking layer) |
| Phase 3 | Approvals + SLA (business calendar, timers, thresholds, escalation) |
| Phase 4 | Audit trail (hash-chained log) + e-signatures |
| Phase 5 | Audit/periodic scheduling + dashboards + timeline projections |

This document covers **Phase 1 only**.

---

## 2. Phase 1 Goal

Stand up the **workflow definition layer** so the React Flow workflow builder UI in `client/` can:

1. Browse a list of workflows
2. Open a workflow as `{nodes, edges, settings}` and edit it
3. Save a new workflow (with structural validation)
4. Update a workflow (creating an immutable new version)
5. Save canvas layout without bumping the version
6. Compare two versions of a workflow
7. Soft-delete a workflow

After Phase 1, no ticket can be raised — only workflow definitions can be created and managed. Phase 2 introduces tickets and the execution engine.

---

## 3. Cross-cutting Decisions

These are locked in for Phase 1 (some are revisions made after a re-check pass):

| # | Decision | Rationale |
|---|---|---|
| 1 | **Single-tenant** — no `organizationId` on workflow rows | The app's `Organization` is a singleton (`findFirst`, no `User → Organization` FK), matching every other module. |
| 2 | **Consolidated save/update** — `PUT /api/workflows/:id` handles both | Mirrors prod's `update_workflow`, which delegates to `create_workflow` when no stages exist. |
| 3 | **Forms payload silently ignored** — returns `meta.warnings: ["Forms binding not yet supported"]` | Frontend can send forward-compatible payloads now without breaking. Real binding lands with the Forms phase. |
| 4 | **Version-on-update** — first save mutates the existing row; subsequent saves clone | Matches prod immutability semantics for audit trail. |
| 5 | **`WorkflowStageAction` (singular)** — not `WorkflowStageActions` like prod | Prisma convention; row-level naming. |
| 6 | **Prisma enums** for `StageType`, `SplitType`, `JoinType`, `StageActionBehavior`, `WorkflowApprovalStatus`, `WorkflowLifecycleStatus` | Type safety; cleaner than VARCHAR + check constraints. |
| 7 | **`createdById` / `deletedById`** FK on `Workflow` | Read from `req.user.userId`. Prod uses dual UUID+name pairs for Auth-Service migration; we don't need that. |
| 8 | **No `updatedById` on `Workflow`** | Updates create new versions; the new row's `createdById` records the editor. |
| 9 | **UUID v4** via Prisma `@default(uuid())` | Prod uses UUID v7 (`uuid7_default`); upgrade is non-blocking, can swap later. |
| 10 | **No async tasks in Phase 1** | No SLA timers, no Celery/BullMQ wiring required yet. |

---

## 4. Schema Changes

### 4.1 New Prisma Enums

```prisma
enum WorkflowApprovalStatus  { PENDING APPROVED REJECTED }
enum WorkflowLifecycleStatus { ACTIVE INACTIVE DRAFT DRAFT_UPDATE }
enum StageType               { STAGE FORK JOIN DECISION AUDIT_FORMS }
enum SplitType               { AND OR XOR }
enum JoinType                { AND OR }
enum StageActionBehavior     { FORWARD REJECT HOLD UNHOLD RETURN REASSIGN }
```

### 4.2 New Models (11 total)

| Model | Purpose | Notes |
|---|---|---|
| `WorkflowType` | Workflow categories (e.g. "Document Review", "CAPA") | `codePrefix` used to generate ticket IDs (later phase) |
| `WorkflowIconConfig` | 1:1 to `WorkflowType` — icon name for builder UI | Cosmetic |
| `WorkflowStageStatus` | Named action statuses with behavior | Seeded with 6 default rows mapping to `StageActionBehavior` enum |
| `ActionType` | Lookup table for action types | Reserved for engine phase |
| `ActionCriteria` | Soft-RBAC criteria reference | Reserved for engine phase |
| `Priority` | Ticket priority lookup (Low/Medium/High/Urgent) | Used by tickets in Phase 2 |
| `Workflow` | Workflow definition root | Versioning chain, lifecycle status, lineage |
| `WorkflowStage` | DAG node | `canonicalId` is stable cross-version |
| `WorkflowStageAction` | Action attached to a stage | m2m to `Role` and `User` for `allowedRoles` / `allowedUsers` |
| `WorkflowTransition` | DAG edge | `sourcePort` / `targetPort` for fork branches |
| `TemporaryWorkflow` | Single autosave row per workflow | `flowJson` is opaque; no validation |

### 4.3 Models Modified

| Model | Change |
|---|---|
| `User` | Added back-relations: `workflowsCreated`, `workflowsDeleted`, `stageActions` (m2m) |
| `Role` | Added back-relation: `stageActions` (m2m) |

### 4.4 Models Deferred (not in schema yet)

These have placeholder semantics in payloads but no rows in DB:

- `WorkflowDependency` — cross-stage prerequisite actions (Engine phase)
- `ApprovalPolicy`, `ApprovalInstance`, `ApprovalRecord` — multi-approval (Phase 3)
- `WorkflowSla`, `SlaPolicy`, `SlaThreshold`, `SlaTimer`, `SlaTimerEvent`, `BusinessCalendar` — SLA (Phase 3)
- `WorkflowChecklist`, `WorkflowChecklistTemp` — form bindings (Forms phase)
- `ChildWorkflowTrigger` — child workflow spawning (Engine phase)
- `CrossStageFormDependency` — show/hide form rules (Forms phase)
- `EvaluationRoles`, `CustomStageAccess`, `CustomAccessTrack` — per-instance access overrides (later)
- `WorkflowEditRequest` — governance for edits (later)
- `ForkJoinMapping`, `ParallelBranchTracking` — partial-join + runtime parallel state (Engine phase)

The builder will accept these fields in payloads and silently warn (`meta.warnings`).

### 4.5 Indexes

- `Workflow @@index([isLatestVersion, isDeleted])` — list-latest queries
- `Workflow @@index([typeId])`, `@@index([parentWorkflowId])`, `@@index([draftOfId])`
- `WorkflowStage @@index([workflowId, isInitialStage])` — find initial stage fast
- `WorkflowStage @@index([canonicalId])` — cross-version diffs
- `WorkflowTransition @@index([fromStageId])`, `@@index([toStageId])`, `@@index([workflowId])`

---

## 5. Module Layout

```
backend/src/modules/workflow/
├── workflow.routes.ts          # Express router wiring
├── workflow.controller.ts      # HTTP handlers (thin)
├── workflow.service.ts         # Orchestration: validate → version → save
├── workflow.builder.ts         # Two-pass save (port of builder.py)
├── workflow.validator.ts       # 9 structural checks
├── workflow.versioning.ts      # Lineage queries, compare, layout-save
├── workflow.schema.ts          # Zod input schemas
├── workflow.openapi.ts         # OpenAPI route registration
└── lookups/
    ├── lookups.routes.ts       # workflow-types, stage-statuses, action-types, etc.
    ├── lookups.controller.ts
    ├── lookups.service.ts
    ├── lookups.schema.ts
    └── lookups.openapi.ts
```

Wired into `src/app.ts`:
```ts
app.use('/api/workflows', workflowRoutes);
app.use('/api/workflow-lookups', lookupsRoutes);
```

OpenAPI imports added to `src/openapi/spec.ts`.

---

## 6. API Surface

All routes guarded by `requireAuth` + `requirePermission(<key>)`.

### 6.1 Workflow CRUD

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/workflows` | `workflow.read` | List (filter: latest-only, type, status, search). Default: latest only, not deleted. |
| GET | `/api/workflows/:id` | `workflow.read` | Returns `{ workflow, nodes, edges, settings }` shaped for React Flow |
| POST | `/api/workflows` | `workflow.create` | Empty shell — body: `{ name, typeId? }`. Returns `{ id }`. |
| PUT | `/api/workflows/:id` | `workflow.update` | Save graph. First save → mutates row (no version bump). Subsequent → new version row, old marked `isLatestVersion=false`. |
| POST | `/api/workflows/:id/save-layout` | `workflow.update` | Position-only update. Body: `[{ canonicalId, position: { x, y } }]`. No validation, no version bump. |
| DELETE | `/api/workflows/:id` | `workflow.delete` | Soft delete: sets `isDeleted=true`, `deletedAt`, `deletedById`. |

### 6.2 Versioning

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/workflows/:id/versions` | `workflow.read` | Lineage walk via `parentWorkflowId`. Returns version metadata: `{ id, version, isLatestVersion, stageCount, transitionCount, createdAt, status, workflowStatus }` |
| GET | `/api/workflows/compare?v1=&v2=` | `workflow.read` | Diff matched on `canonicalId`. Returns `{ stagesAdded[], stagesRemoved[], stagesModified[], transitionsAdded[], transitionsRemoved[] }` |

### 6.3 Draft autosave

| Method | Path | Permission | Purpose |
|---|---|---|---|
| POST | `/api/workflows/:id/draft` | `workflow.update` | Upsert `TemporaryWorkflow.flowJson` |
| GET | `/api/workflows/:id/draft` | `workflow.read` | Get the autosave snapshot (or `null`) |

### 6.4 Lookups

| Method | Path | Permission | Purpose |
|---|---|---|---|
| GET | `/api/workflow-lookups/types` | `workflow.lookups.read` | List `WorkflowType` (with `iconConfig`) |
| POST | `/api/workflow-lookups/types` | `workflow.lookups.manage` | Create. Auto-derives `codePrefix` from name if missing. |
| DELETE | `/api/workflow-lookups/types/:id` | `workflow.lookups.manage` | Soft delete (or `?hard=true` for permanent — only if no `Workflow` references it) |
| GET | `/api/workflow-lookups/stage-statuses` | `workflow.lookups.read` | List `WorkflowStageStatus` with behavior |
| POST | `/api/workflow-lookups/stage-statuses` | `workflow.lookups.manage` | Create. Body: `{ name, behavior }`. |
| GET | `/api/workflow-lookups/action-types` | `workflow.lookups.read` | List `ActionType` |
| POST | `/api/workflow-lookups/action-types` | `workflow.lookups.manage` | Create |
| GET | `/api/workflow-lookups/action-criteria` | `workflow.lookups.read` | List `ActionCriteria` |
| POST | `/api/workflow-lookups/action-criteria` | `workflow.lookups.manage` | Create |
| GET | `/api/workflow-lookups/priorities` | `workflow.lookups.read` | List `Priority` |

---

## 7. Validator (`workflow.validator.ts`)

Function signature:
```ts
export const validateWorkflowStructure = (
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[]
): string[] => { /* returns array of error strings, empty if valid */ }
```

Runs **before** opening the Prisma transaction. Returns HTTP 400 with `{ status: false, msg: "Workflow validation failed", validation_errors: [...], error_count: N }` on any failure — same shape as prod for frontend reuse.

### Checks

1. **Non-empty** — at least one node.
2. **Single initial stage** — exactly one node with `data.basic_details.is_initial_stage === true`.
3. **Edges reference valid nodes** — every `source` and `target` is a known node id.
4. **No orphans** — multi-node workflows must have all non-structural nodes connected; initial stage must have ≥1 outgoing edge.
5. **Fork structure** — each `fork` node has 1 incoming, N outgoing matching `parallelConfig.branchCount`. Source handles `branch-0`..`branch-N-1` must all be wired.
6. **Join structure** — each `join` node has N incoming matching `branchCount`, 1 outgoing, `joinType ∈ {AND, OR}`. Target handles `branch-0`..`branch-N-1` must all be wired.
7. **Balanced fork/join** — `count(forks) === count(joins)`.
8. **No cycles** — Kahn's topological sort: visited count must equal node count.
9. **Unique stage names** — non-structural nodes must have distinct (case-insensitive) names.

(Prod has a 10th check on dependency action references; deferred since `WorkflowDependency` isn't in Phase 1.)

---

## 8. Builder (`workflow.builder.ts`)

The save logic, ported from `core-prod-scaling/backend/workflows/builder/services/builder.py:create_workflow` and `update_workflow`.

### 8.1 Two-pass algorithm

Inside `prisma.$transaction`:

**Pass 1 — Create stages and actions:**
```
for each node in nodes:
  - Validate at most one is_initial_stage already created in this workflow
  - Create WorkflowStage with canonicalId = node.id (frontend node ID)
    Fields: name, isInitialStage, position, sendEmail, additionalData
            (strip "workflow_types" key from additionalData, matches prod)
            stageType, splitType, joinType
  - For each action in (primary_actions + secondary_actions):
    - Create WorkflowStageAction
      isPrimary = action.type !== 'secondary'
      workflowActionId = action.stage_status_id
      criteriaId = action.action_criteria_id ?? "Anyone" criteria
    - Set allowedRoles m2m via convertRoleIdentifiersToIds(action.roles_id)
    - Set allowedUsers m2m via convertUserIdentifiersToUserIds(action.employees_id)
```

**Pass 2 — Wire fork/join links:**
```
for each fork node:
  - Look up parallelConfig.joinStageId in stage_instances
  - Verify the referenced stage has stageType === JOIN (else throw)
  - Set fork.joinPointId = join.id
```

**Pass 3 — Create transitions:**
```
for each edge:
  - Resolve fromStage = stage_instances[edge.source]
  - Resolve toStage = stage_instances[edge.target]
  - Create WorkflowTransition with:
    sourcePort = edge.sourceHandle
    targetPort = edge.targetHandle
    branchName = edge.branchInfo?.branchName ?? edge.label
    condition = edge.branchInfo?.condition
    branchOrder = edge.branchInfo?.order ?? idx
```

If anything throws, the entire transaction rolls back automatically. The service returns `{ status, msg, error?, validation_errors?, meta?: { warnings: [...] } }` — same shape as prod for response consistency.

### 8.2 Identifier helpers

Ported helpers (subset — Phase 1 doesn't need EMP-XXX legacy lookups since we have direct UUIDs):

```ts
const convertRoleIdentifiersToIds = (input: unknown[]): string[] => {
  // Accepts: string UUID, { value: UUID }, { id: UUID }
  // Filters: empty/null entries
  // Phase 1: no "ROLE-XXXXXXXX" code lookup (prod-only legacy format)
};

const convertUserIdentifiersToUserIds = (input: unknown[]): string[] => {
  // Accepts: string UUID, { value: UUID }, { id: UUID }
  // Filters: empty/null entries
};
```

If the frontend ever sends legacy `ROLE-XXX` / `EMP-XXX` codes, we'll add lookup branches. Not required for Phase 1.

### 8.3 Settings application

Ported `_apply_workflow_settings`:
```ts
const applyWorkflowSettings = (
  tx: Prisma.TransactionClient,
  workflowId: string,
  settings?: { maxExecutionsPerDay?: number; timeoutSeconds?: number; workflowStatus?: WorkflowLifecycleStatus }
) => {
  // Update only fields explicitly present in payload
  // null is a valid reset (matches prod is-not-None semantics)
};
```

---

## 9. Versioning (`workflow.versioning.ts`)

### 9.1 Update flow

`PUT /api/workflows/:id`:

```
1. Validate payload structure → 400 if errors
2. Open prisma.$transaction:
   a. Load existing workflow (404 if not found)
   b. Count existing stages
      - If 0 stages → first save: just call builder.save() against current row, no version bump
      - If >0 stages → version bump:
        i.   Insert new Workflow row:
             - version = old.version + 1
             - isLatestVersion = true
             - previousVersionId = old.id
             - parentWorkflowId = old.parentWorkflowId ?? old.id
             - Carry forward maxExecutionsPerDay, timeoutSeconds (or override from payload)
             - createdById = req.user.userId
        ii.  Mark old row: isLatestVersion = false
        iii. Run builder.save() against the new row
3. Commit
4. Return new workflow id and version
```

### 9.2 Lineage walk

`GET /api/workflows/:id/versions`:

```
1. Load the workflow (404 if not found)
2. Resolve root: workflow.parentWorkflow ?? workflow
3. Query:
   prisma.workflow.findMany({
     where: {
       OR: [{ id: root.id }, { parentWorkflowId: root.id }],
       isDeleted: false (unless ?include_deleted=true)
     },
     include: {
       _count: { select: { stages: true, transitions: true } },
       type: { select: { id: true, name: true } },
       previousVersion: { select: { id: true } }
     },
     orderBy: { version: 'asc' }
   })
4. For each version, build:
   { id, name, version, isLatestVersion, status, workflowStatus,
     stageCount, transitionCount, createdAt, updatedAt,
     previousVersionId, nextVersionId,
     activeTicketCount: 0, totalTicketCount: 0 }   // 0 in Phase 1; wired in Phase 2
5. Walk version map to backfill nextVersionId
```

### 9.3 Compare

`GET /api/workflows/compare?v1=&v2=`:

```
1. Load both workflows (404 if not found)
2. Verify they share a lineage (same root via parentWorkflowId)
3. Index stages by canonicalId
4. Compute diff:
   - stagesAdded   = canonicalIds in v2 not in v1
   - stagesRemoved = canonicalIds in v1 not in v2
   - stagesModified = canonicalIds in both, where (name, stageType, additionalData) differs
5. Index transitions by (fromCanonicalId, toCanonicalId, sourcePort, targetPort, branchName)
6. Compute transitionsAdded/Removed by tuple set diff
7. Return diff payload
```

### 9.4 Layout save

`POST /api/workflows/:id/save-layout`:

```ts
body: { positions: Array<{ canonicalId: string; position: { x: number; y: number } }> }
```

Single update per row; no transaction needed. Rejects if the workflow `isDeleted`. Does **not** bump version, does **not** validate the graph.

---

## 10. Seed Updates

### 10.1 New permission keys (6)

```ts
{ key: 'workflow.read',           module: 'WORKFLOW', action: 'READ',   description: 'View workflows' },
{ key: 'workflow.create',         module: 'WORKFLOW', action: 'CREATE', description: 'Create workflow shells' },
{ key: 'workflow.update',         module: 'WORKFLOW', action: 'UPDATE', description: 'Edit/version workflows' },
{ key: 'workflow.delete',         module: 'WORKFLOW', action: 'DELETE', description: 'Soft-delete workflows' },
{ key: 'workflow.lookups.read',   module: 'WORKFLOW', action: 'READ',   description: 'View workflow lookup tables' },
{ key: 'workflow.lookups.manage', module: 'WORKFLOW', action: 'MANAGE', description: 'Manage workflow lookup tables (types, statuses, criteria)' },
```

### 10.2 Permission grants

| Role | Granted |
|---|---|
| `SUPER_ADMIN` | All 6 |
| `QMS_ADMIN` | All 6 |
| `QUALITY_ENGINEER` | `workflow.read`, `workflow.lookups.read` |
| `AUDITOR` | `workflow.read`, `workflow.lookups.read` |
| `DOCUMENT_CONTROLLER` | `workflow.read`, `workflow.lookups.read` |
| `READ_ONLY` | `workflow.read`, `workflow.lookups.read` |

### 10.3 Default WorkflowStageStatus rows (6)

```ts
{ name: 'Approve / Forward', behavior: 'FORWARD'  },
{ name: 'Reject',            behavior: 'REJECT'   },
{ name: 'Hold',              behavior: 'HOLD'     },
{ name: 'Resume',            behavior: 'UNHOLD'   },
{ name: 'Return',            behavior: 'RETURN'   },
{ name: 'Reassign',          behavior: 'REASSIGN' },
```

### 10.4 Default Priority rows (4)

```ts
{ name: 'Low' },
{ name: 'Medium' },
{ name: 'High' },
{ name: 'Urgent' },
```

### 10.5 Default ActionCriteria

```ts
{ name: 'Anyone' },  // matches prod's default
```

---

## 11. Request / Response Schemas

### 11.1 Save workflow (PUT)

```ts
const SaveWorkflowSchema = z.object({
  workflow_id: z.string().uuid().optional(),  // also in URL params
  flow_json: z.object({
    nodes: z.array(z.object({
      id: z.string(),
      type: z.string().optional(),
      position: z.object({ x: z.number(), y: z.number() }),
      data: z.object({
        label: z.string(),
        nodeType: z.enum(['stage', 'fork', 'join', 'decision', 'audit_forms']).optional(),
        basic_details: z.object({
          is_initial_stage: z.boolean().optional(),
          email_notification: z.boolean().optional(),
        }).passthrough(),
        primary_actions: z.array(z.any()).optional(),
        secondary_actions: z.array(z.any()).optional(),
        forms: z.array(z.any()).optional(),       // ignored in Phase 1
        sla: z.array(z.any()).optional(),         // ignored in Phase 1
        dependency: z.array(z.any()).optional(),  // ignored in Phase 1
        parallelConfig: z.object({
          branchCount: z.number().optional(),
          splitType: z.enum(['AND', 'OR', 'XOR']).optional(),
          joinType: z.enum(['AND', 'OR']).optional(),
          joinStageId: z.string().optional(),
        }).optional(),
        additional_data: z.record(z.any()).optional(),
      }).passthrough(),
    })),
    edges: z.array(z.object({
      source: z.string(),
      target: z.string(),
      sourceHandle: z.string().nullish(),
      targetHandle: z.string().nullish(),
      label: z.string().optional(),
      branchInfo: z.object({
        branchName: z.string().optional(),
        condition: z.string().optional(),
        order: z.number().optional(),
      }).optional(),
    })),
  }),
  workflow_roles: z.array(z.string()).optional(),  // participant_roles, ignored in Phase 1
  workflow_settings: z.object({
    maxExecutionsPerDay: z.number().nullable().optional(),
    timeoutSeconds: z.number().nullable().optional(),
    workflowStatus: z.enum(['ACTIVE', 'INACTIVE', 'DRAFT', 'DRAFT_UPDATE']).optional(),
  }).optional(),
});
```

### 11.2 Get workflow (GET response)

```ts
{
  workflow: {
    id, name, version, isLatestVersion, status, workflowStatus,
    typeId, type: { id, name } | null,
    parentWorkflowId, previousVersionId,
    createdAt, updatedAt,
    settings: { maxExecutionsPerDay, timeoutSeconds }
  },
  flow_json: {
    nodes: [...],   // built from stages + actions
    edges: [...]    // built from transitions
  },
  meta: {
    warnings: ["Forms binding not yet supported", ...]
  }
}
```

The shape mirrors what the React Flow builder expects.

### 11.3 List workflows (GET response)

```ts
{
  items: [{
    id, name, version, isLatestVersion, status, workflowStatus,
    type: { id, name } | null,
    stageCount, transitionCount,
    createdAt, updatedAt,
    createdBy: { id, name, email } | null
  }],
  total, page, pageSize
}
```

---

## 12. Error Response Shape

Following prod's pattern for builder errors:

```ts
// Success
{ status: true, data: {...}, msg: "..." }

// Validation failure (400)
{
  status: false,
  msg: "Workflow validation failed",
  validation_errors: ["...", "..."],
  error_count: 2,
  details: "Please fix the validation errors listed above and try again."
}

// Not found (404), conflict (409), forbidden (403), 500 etc.
// Use existing httpError helpers (NotFound, Conflict, Forbidden, ...)
```

The 4xx/5xx flow uses the existing `errorHandler` middleware in `src/middleware/error.ts`.

---

## 13. OpenAPI Coverage

Every endpoint registered in `*.openapi.ts` files using `@asteasolutions/zod-to-openapi` (matching `auth.openapi.ts` pattern). Tags: `Workflow`, `Workflow Lookups`. Operations grouped by domain so `/api/docs` renders cleanly.

---

## 14. Test Plan

### 14.1 Manual smoke tests (post-migration)

1. Login as SUPER_ADMIN → get JWT
2. `GET /api/workflow-lookups/stage-statuses` → 6 rows present
3. `POST /api/workflow-lookups/types` → create "Document Review"
4. `POST /api/workflows` → create empty shell with that type
5. `PUT /api/workflows/:id` → save 3-stage linear graph (Initial → Review → Approve)
6. `GET /api/workflows/:id` → verify nodes/edges round-trip
7. `PUT /api/workflows/:id` again with modified graph → version bump to v2
8. `GET /api/workflows/:id/versions` → see v1 (isLatestVersion=false) and v2 (true)
9. `GET /api/workflows/compare?v1=v1Id&v2=v2Id` → diff shows changes
10. `PUT /api/workflows/:id` with cycle → 400 with `validation_errors`
11. `POST /api/workflows/:id/save-layout` → positions update, no version bump
12. `DELETE /api/workflows/:id` → soft delete sets `isDeleted=true`

### 14.2 Validator unit checklist (manual via API)

For each of the 9 checks, send a deliberately broken payload and verify the right error string comes back.

### 14.3 Permission tests

- READ_ONLY user can `GET` but not `POST`/`PUT`/`DELETE`
- Missing permission key → 403 with `Forbidden` message

---

## 15. Out of Scope (Phase 1)

These exist in prod but are **not** in Phase 1:

- ❌ Tickets, ticket flows, stage tracking
- ❌ Workflow execution engine (orchestrator, transition layer)
- ❌ Approval policies and approval intercept
- ❌ SLA timers, business calendars, escalations
- ❌ Form bindings (`WorkflowChecklist`)
- ❌ Cross-stage form dependencies
- ❌ Child workflow triggers
- ❌ Audit log (hash-chained)
- ❌ E-signatures
- ❌ Audit scheduling, periodic review
- ❌ Workflow edit governance (`WorkflowEditRequest`)
- ❌ Export / import bundles
- ❌ Custom stage access overrides
- ❌ Plugin / hook system
- ❌ Async tasks (no Celery / BullMQ wiring yet)

---

## 16. Deliverable Checklist

- [x] Schema changes drafted in `prisma/schema.prisma`
- [x] Migration applied (`npx prisma migrate dev --name workflow_phase1`)
- [x] `seed.ts` updated with 6 permissions, 6 stage statuses, 4 priorities, 1 action criteria; permission grants on existing roles
- [x] `seed.ts` runs cleanly (`npm run db:seed`)
- [x] `src/modules/workflow/lookups/*` — 5 files
- [x] `src/modules/workflow/workflow.validator.ts`
- [x] `src/modules/workflow/workflow.builder.ts`
- [x] `src/modules/workflow/workflow.versioning.ts`
- [x] `src/modules/workflow/workflow.service.ts` (orchestration entry points)
- [x] `src/modules/workflow/workflow.schema.ts` (Zod input schemas)
- [x] `src/modules/workflow/workflow.controller.ts`
- [x] `src/modules/workflow/workflow.routes.ts`
- [x] `src/modules/workflow/workflow.openapi.ts`
- [x] `src/app.ts` wired
- [x] `src/openapi/spec.ts` imports new openapi files
- [x] `tsc` clean
- [x] Manual smoke tests pass (§14)

---

## 17. Effort Estimate

~2-3 days of focused work:

| Component | LoC estimate | Notes |
|---|---|---|
| Schema + migration | ~250 | Done |
| Seed updates | ~60 | |
| Validator | ~200 | 9 checks, port of prod logic |
| Builder | ~400 | 3-pass, port of prod 1600-line file (most prod size is approval/SLA/deps we defer) |
| Versioning | ~200 | Lineage, compare, layout |
| Service + controller + routes | ~250 | Thin orchestration |
| Lookups module | ~200 | 5 lookup tables × CRUD |
| OpenAPI | ~150 | Route registrations |
| Schemas (Zod) | ~120 | Input validation |
| **Total** | **~1830 LoC** | |

---

## 18. Risks / Open Questions

| Risk | Mitigation |
|---|---|
| Frontend payload shape may have undocumented quirks | Pull frontend code if shape deviates from prod; the `passthrough()` Zod calls make us tolerant of extra fields |
| `convertRoleIdentifiersToIds` simplifications | If frontend sends legacy `ROLE-XXX` codes, add lookup branches |
| UUID v4 vs UUID v7 | Phase 1 doesn't depend on time-sortable IDs; revisit before Phase 2 (ticket IDs) if needed |
| Compare diff granularity | Phase 1 reports stage-level changes only. Action-level / form-level diffs deferred. |

---

## 19. Phase 1 → Phase 2 Handoff

Phase 2 (tickets + engine) will need from Phase 1:

- ✅ `Workflow.id`, `WorkflowStage.id`, `WorkflowStageAction.id` available
- ✅ `WorkflowStage.canonicalId` for stable cross-version stage references
- ✅ `WorkflowStage.stageType`, `splitType`, `joinType`, `joinPointId` for engine traversal
- ✅ `WorkflowTransition` with `sourcePort`, `targetPort`, `branchName`, `condition` for fork/decision dispatch
- ✅ `WorkflowStageAction.workflowAction.behavior` for action dispatch (forward/reject/hold/...)
- ✅ `WorkflowStageAction.allowedRoles` / `allowedUsers` for AccessLayer

No schema changes required to start Phase 2 — the engine layer is purely new tables (`Ticket`, `TicketFlow`, `TicketStageTracking`).
