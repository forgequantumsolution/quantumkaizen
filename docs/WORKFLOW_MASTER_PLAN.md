# Workflow System — Master Implementation Plan (All Phases)

**Status:** Phase 1 in progress
**Owner:** Backend
**Target:** `backend/` (Node.js / TypeScript / Express / Prisma / PostgreSQL)
**Reference:** `../core-prod-scaling/backend/workflows/` (Django / DRF — production system to port)

---

## 0. Context

The Django prod backend at `core-prod-scaling/` implements a production-grade, compliance-first workflow engine for a regulated QMS (Quality Management System). It supports:

- Graph-based workflow definitions with parallel fork/join, decision branches
- Multi-approval policies (single, all-required, quorum, sequential, any)
- SLA timers with business calendars and threshold-based escalations
- Hash-chained audit log (21 CFR Part 11 compliant)
- E-signatures (immutable post-sign)
- Form attachments per stage (DMS-backed)
- Periodic audit scheduling
- Plugin/hook system for extensions
- Workflow versioning with stable cross-version identity

The current Node/TS backend has only auth/user/department/role/permission/site/organization. We're porting the workflow domain in **5 phases**, each a shippable increment that can be reviewed and merged independently.

---

## 1. Phase Map

Each backend phase is paired with a frontend phase. Default scheduling is **sequential** (BE Phase N → FE Phase N → BE Phase N+1) but can be **pipelined** (FE Phase N runs in parallel with BE Phase N+1) — see §8 Frontend Phasing.

| Phase | Theme | BE Tables | BE API | Engine | Frontend |
|---|---|---|---|---|---|
| **1** | Workflow Builder | 11 ✅ | Workflow CRUD, lookups ✅ (versioning removed P1.8; layout removed in P3.5+ refactor — now client-side dagre) | None (definitions only) | React Flow builder canvas, lookup admin ✅ |
| **2** | Tickets + Engine | 7 ✅ | Ticket CRUD, transitions, tracking, comments ✅ | Orchestrator, transitions, fork/join, decision ✅ | Ticket list/detail, action bar, timeline, comments, docs ✅ |
| **3** | Approvals + SLA | 9 ✅ | Approvals, SLA queries, business calendars ✅ | Approval intercept, SLA timers (BullMQ) ✅ | Approval modal, SLA badges, calendar admin ✅ |
| **3.5** | Forms ↔ Workflow Integration | +1 ✅ | (canvas-JSON-embedded — see refactor note) | Form-required intercept in orchestrator ✅ | Forms section in inspector, Forms card on ticket detail, ActionBar gating, FormFillPage workflow-bound submit ✅ |
| **4** | Audit + E-signatures | 4 | Audit query, integrity verify, sign actions | Hash-chained logging, signature gates | Audit log viewer, signature PIN modal |
| **5** | Audit Scheduling + Dashboards | 3 | Audit schedules, timeline, dashboards | Cron-spawned tickets, periodic review | Schedule admin, dashboard widgets |

Total new BE tables across all phases: **~35** (Phase 3.5 added `StageFormBinding`). Total new BE endpoints: **~55**.
Total new FE LoC across all phases: **~10,500** (revised — Phase 3.5+ refactor added ~1.8k LoC over plan; client-side dagre layout absorbed ~250 LoC; embed-in-JSON consolidated three editor surfaces).

Each backend phase is self-contained and independently shippable. Frontend phases follow per the §8 schedule.

### Architecture deltas from original plan (logged in workflow-changes.md)

- **Layout storage** dropped from the backend in P3.5+. `WorkflowStage.position` removed; the builder + detail-page renders compute positions on demand via `dagre`. No more `save-layout` endpoint, no per-drag autosave.
- **Save semantics split** in P3.5+. The Save button is now non-destructive — writes to `TemporaryWorkflow.flowJson`. A new **Publish** button does the destructive `buildWorkflowGraph` rebuild and flips `workflowStatus` to ACTIVE. The dedicated `PATCH /workflows/:id/status` endpoint handles status-only transitions without rebuilding.
- **Embed-in-JSON for policies (P3.5+)**: `ApprovalPolicy`, `SlaPolicy`, and `StageFormBinding` rows are still the source-of-truth for the engine, but their **intent** travels inside the canvas JSON (`node.data.approvalPolicies` / `node.data.sla` / `node.data.formBindings`). `buildWorkflowGraph` materialises rows from the JSON on Publish; `toFlowJson` embeds them back on read. The dedicated POST endpoints for each policy type still exist for surgical live edits, but the build flow no longer uses them.
- **Phase 4's `FORM_SUBMITTED` audit event** now has a meaningful `ticketId` to attach to (Phase 3.5 added the `FormSubmission.ticketId/stageId/flowId/bindingId` FKs).

---

## 2. Cross-cutting Decisions (apply to all phases)

These were locked in after exploring both backends:

| # | Decision | Rationale |
|---|---|---|
| 1 | **Single-tenant** (no `organizationId` on workflow rows) | App's `Organization` is a singleton (`findFirst`, no User→Org FK). Matches every other module. |
| 2 | **Prisma enums** for all status/type fields | Type safety; cleaner than VARCHAR + check constraints. |
| 3 | **Soft delete** via `isDeleted` + `deletedAt` + `deletedById` FK | Mirrors prod's audit-friendly pattern. |
| 4 | **Creator/deleter tracking** via `createdById` / `deletedById` FK to `User` | Read from `req.user.userId` (already on JWT payload). |
| 5 | **Snake-case JSON payload fields**, camelCase DB columns | Frontend (React Flow) sends snake_case; we map at the boundary. |
| 6 | **Shared error response shape** — `{ status: false, msg, validation_errors?, error_count?, details? }` | Matches prod for frontend reuse of error rendering. |
| 7 | **OpenAPI auto-registered** per module via `@asteasolutions/zod-to-openapi` | Matches existing `auth.openapi.ts` pattern. |
| 8 | **BullMQ + Redis** for async tasks (Phase 3+) | Closest fit to prod's Celery beat. node-cron rejected — breaks under multi-instance. |
| 9 | **Single migration per phase** | Easier to review/rollback than per-feature migrations. |
| 10 | **No multi-tenant scoping**, no auth-service dual mode, no UUID v7 | Simplifications vs prod, none affect compliance behavior. |

---

## 3. Phase 1 — Workflow Builder ✅ Complete

**Detailed plan: see `WORKFLOW_PHASE_1_PLAN.md`**

### Goal

Stand up the workflow definition layer. After Phase 1, the React Flow workflow builder UI can save, load, validate, and version workflows. No tickets, no execution.

### Schema (11 tables)

```
WorkflowType              -- workflow categories (e.g. "CAPA", "Document Review")
WorkflowIconConfig        -- 1:1 to WorkflowType, icon name for UI
WorkflowStageStatus       -- named action statuses (Approve/Reject/Hold/Resume/Return/Reassign)
ActionType                -- lookup
ActionCriteria            -- lookup (defaults: "Anyone")
Priority                  -- ticket priority lookup (Low/Medium/High/Urgent)
Workflow                  -- workflow definition root, versioning chain
WorkflowStage             -- DAG node (canonicalId stable across versions)
WorkflowStageAction       -- action attached to a stage; m2m to Role/User
WorkflowTransition        -- DAG edge (sourcePort/targetPort for fork branches)
TemporaryWorkflow         -- single autosave row per workflow
```

### API Surface (12 + 9 lookups)

```
POST   /api/workflows                      -- create empty shell
GET    /api/workflows                      -- list (filter: latest, type, status, search)
GET    /api/workflows/:id                  -- get full {nodes, edges, settings}
PUT    /api/workflows/:id                  -- save graph (version-bump on subsequent saves)
DELETE /api/workflows/:id                  -- soft delete
POST   /api/workflows/:id/save-layout      -- positions only, no version bump
GET    /api/workflows/:id/versions         -- lineage walk
GET    /api/workflows/compare              -- diff v1 vs v2
POST   /api/workflows/:id/draft            -- TemporaryWorkflow upsert (autosave)
GET    /api/workflows/:id/draft            -- get autosave snapshot

GET/POST/DELETE  /api/workflow-lookups/types
GET/POST         /api/workflow-lookups/stage-statuses
GET/POST         /api/workflow-lookups/action-types
GET/POST         /api/workflow-lookups/action-criteria
GET              /api/workflow-lookups/priorities
```

### Key Logic

- **9-check structural validator** — single initial, edge ref valid, no orphans, fork/join structure, balanced fork/join, no cycles (Kahn's), unique stage names
- **Two-pass save** inside `prisma.$transaction`: stages+actions → fork/join wiring → transitions
- **Version-on-update** — first save mutates row; subsequent saves clone with `version+1`, mark old `isLatestVersion=false`
- **Lineage queries** via `parentWorkflowId` chain
- **Stage diff matched on `canonicalId`** (stable across versions)

### Out of Scope (deferred)

`WorkflowDependency`, `ApprovalPolicy`, `WorkflowSla`, `WorkflowChecklist`, `ChildWorkflowTrigger`, `CrossStageFormDependency`, `EvaluationRoles`, `WorkflowEditRequest`, `ForkJoinMapping`, export/import, plugins.

### Effort

~2-3 days, ~1,800 LoC.

---

## 4. Phase 2 — Tickets + Execution Engine ✅ Complete

### Goal

Make workflows executable. Users can raise a ticket against a workflow, and the engine drives the ticket through stages via user actions, respecting fork/join/decision logic and recording stage history.

### Schema (7 new tables)

```prisma
model Ticket {
  id              String  @id @default(uuid())
  uniqueId        String  @unique           -- "CAPA-FQS-001" (prefix from WorkflowType.codePrefix)
  title           String
  description     String?
  parentTicketId  String?                    -- nested tickets
  parentTicket    Ticket? @relation(...)
  childTickets    Ticket[]
  priorityId      String?
  priority        Priority? @relation(...)
  departmentId    String?
  department      Department? @relation(...)
  siteId          String?
  site            Site? @relation(...)
  createdById     String?
  createdBy       User? @relation(...)
  isDeleted       Boolean @default(false)
  deletedAt       DateTime?
  deletedById     String?
  customFields    Json?                      -- user-defined fields
  ...timestamps...

  ticketFlows     TicketFlow[]
  comments        TicketComment[]
  docs            TicketDoc[]
  ...
}

model TicketFlow {
  id             String   @id @default(uuid())
  ticketId       String
  ticket         Ticket   @relation(...)
  workflowId     String
  workflow       Workflow @relation(...)
  workflowName   String                      -- snapshot at creation
  workflowVersion Int                        -- snapshot at creation
  isCompleted    Boolean  @default(false)
  completedAt    DateTime?
  currentStages  WorkflowStage[]             -- m2m, multi-stage during fork
  ...timestamps...

  stageTracking  TicketStageTracking[]
  parallelTracking ParallelBranchTracking[]
}

model TicketStageTracking {
  id              String   @id @default(uuid())
  ticketFlowId    String
  ticketFlow      TicketFlow @relation(...)
  stageId         String
  stage           WorkflowStage @relation(...)
  stageName       String                      -- snapshot
  enteredAt       DateTime @default(now())
  exitedAt        DateTime?
  durationSec     Int?
  isActive        Boolean  @default(true)
  performedById   String?                     -- who exited the stage
  performedBy     User? @relation(...)
  postActions     Json?                       -- action that caused exit
  ...
}

model ParallelBranchTracking {
  id             String   @id @default(uuid())
  ticketFlowId   String
  ticketFlow     TicketFlow @relation(...)
  forkStageId    String
  forkStage      WorkflowStage @relation(...)
  branchPath     Json                          -- list of stage IDs in this branch
  isCompleted    Boolean @default(false)
  completedAt    DateTime?
  ...
}

model TicketComment {
  id          String  @id @default(uuid())
  ticketId    String
  ticket      Ticket  @relation(...)
  authorId    String
  author      User    @relation(...)
  body        String
  parentCommentId String?                       -- threaded comments
  ...timestamps + soft delete...
}

model TicketDoc {
  id          String  @id @default(uuid())
  ticketId    String
  ticket      Ticket  @relation(...)
  stageId     String?
  stage       WorkflowStage? @relation(...)
  fileUrl     String                            -- S3 / DMS URL
  fileName    String
  mimeType    String?
  fileSize    Int?
  docType     DocType                            -- ATTACHMENT/EVIDENCE/REPORT/FORM_SUBMISSION/OTHER
  uploadedById String
  ...
}

model ChildWorkflowTrigger {
  id              String  @id @default(uuid())
  parentStageId   String
  parentStage     WorkflowStage @relation(...)
  childWorkflowId String
  childWorkflow   Workflow      @relation(...)
  triggerMode     TriggerMode    -- MANUAL / AUTO
  isBlocking      Boolean
  allowMultiple   Boolean
  order           Int
}
```

### Execution Engine (`workflow/engine/`)

Five layers, each in its own file:

```
backend/src/modules/workflow/engine/
├── orchestrator.ts        -- Entry points: raiseTicket, getCurrentStageActions, performAction
├── transition.layer.ts    -- ONLY place that mutates TicketFlow.currentStages, isCompleted
├── graph.layer.ts          -- DAG traversal, resolves next stages via transitions
├── decision.layer.ts       -- XOR branch evaluation (condition expressions)
├── access.layer.ts         -- RBAC validation (roles + users on action), cached
├── tracking.layer.ts       -- Writes TicketStageTracking, fires audit events (Phase 4 hook)
└── action.dispatcher.ts    -- Behavior dispatch: forward/reject/hold/unhold/return/reassign
```

### API Surface

```
POST   /api/tickets                          -- raise ticket against workflow
GET    /api/tickets                          -- list (filter: status, workflow, assignee, mine)
GET    /api/tickets/:id                      -- full ticket detail
PATCH  /api/tickets/:id                      -- update fields (title, desc, priority)
DELETE /api/tickets/:id                      -- soft delete

GET    /api/tickets/:id/allowed-actions      -- current stage actions filtered by RBAC
POST   /api/tickets/:id/transition           -- perform action, drives engine
POST   /api/tickets/:id/hold                 -- universal hold (any stage)
POST   /api/tickets/:id/resume               -- universal resume

GET    /api/tickets/:id/track                -- TicketStageTracking entries
GET    /api/tickets/:id/timeline             -- chronological timeline (Phase 5 enriches)
GET    /api/tickets/:id/participants         -- users who interacted

POST   /api/tickets/:id/comments             -- add comment
GET    /api/tickets/:id/comments             -- paginated
DELETE /api/tickets/:id/comments/:commentId  -- soft delete

POST   /api/tickets/:id/docs                 -- attach file (S3 presigned URL flow)
GET    /api/tickets/:id/docs                 -- list ticket docs
DELETE /api/tickets/:id/docs/:docId

POST   /api/tickets/:id/spawn-child          -- spawn child workflow ticket
```

### Key Logic

**`raiseTicket(workflowId, payload, user)`**:
1. Validate workflow is `ACTIVE` and `isLatestVersion=true`
2. Generate `uniqueId` from `WorkflowType.codePrefix` (atomic counter via SELECT FOR UPDATE)
3. Create `Ticket`, `TicketFlow` (snapshotting workflow name+version)
4. Resolve initial stage; set `TicketFlow.currentStages = [initialStage]`
5. Auto-exit initial stage (it's a "raise" event, not a user action) — runs through transition logic
6. Return new ticket detail

**`performAction(ticketId, actionId, user)`**:
1. AccessLayer: verify user has permission to perform this action
2. Load action behavior from `WorkflowStageStatus.behavior`
3. Dispatch by behavior:
   - `FORWARD` → GraphLayer resolves next stages via transitions; if fork, create `ParallelBranchTracking` rows; if join, check completion
   - `REJECT` → return to previous stage (TrackingLayer reads history)
   - `HOLD` → set `Ticket.isOnHold=true` (or stage-level hold flag)
   - `UNHOLD` → reverse hold
   - `RETURN` → return to specific past stage (uses `ReturnPath` table — Phase 4)
   - `REASSIGN` → delegate to user/role (writes `ReassignmentRecord`)
4. TransitionLayer atomically updates `TicketFlow.currentStages`
5. TrackingLayer closes old `TicketStageTracking` row (sets `exitedAt`, `durationSec`), opens new ones
6. If at terminal stage (no outgoing transitions), set `TicketFlow.isCompleted=true`
7. Phase 4 hook: emit `STAGE_EXITED` / `STAGE_ENTERED` audit events

**Fork/Join logic** (in GraphLayer):
- Fork: read `WorkflowStage.splitType` (AND/OR/XOR)
  - `AND` → activate all branches → create `currentStages` entries for each
  - `OR` → activate all but only one needs to complete (handled at join)
  - `XOR` → DecisionLayer evaluates conditions; only one branch activated
- Join: read `WorkflowStage.joinType` (AND/OR)
  - `AND` → check all `ParallelBranchTracking` rows for this fork are completed
  - `OR` → first branch to arrive triggers join

### Effort

~5-7 days, ~3,500 LoC.

---

## 5. Phase 3 — Approvals + SLA

### Goal

Make stages governable. Multi-approval policies hold transitions until approvers agree. SLA timers track stage duration and fire escalations when thresholds breach.

### Schema (9 new tables)

```prisma
// Approvals
model ApprovalPolicy {
  id              String         @id @default(uuid())
  workflowId      String
  workflow        Workflow       @relation(...)
  stageId         String
  stage           WorkflowStage  @relation(...)
  actionId        String         -- which action triggers approval intercept
  action          WorkflowStageAction @relation(...)
  mode            ApprovalMode    -- SINGLE / ALL_REQUIRED / QUORUM / SEQUENTIAL / ANY
  requiredCount   Int            @default(1)
  strictRoleMatch Boolean        @default(false)
  allowSelfApproval Boolean      @default(false)
  requireUniqueApprovers Boolean @default(true)
  approvalSequence Json?          -- ordered role/user list for SEQUENTIAL mode
  approvalSlaHours Int?           -- per-approval SLA
  approverRoles   Role[]   @relation("ApprovalPolicyApproverRoles")
  approverUsers   User[]   @relation("ApprovalPolicyApproverUsers")
}

model ApprovalInstance {
  id              String  @id @default(uuid())
  ticketId        String
  ticket          Ticket  @relation(...)
  policyId        String
  policy          ApprovalPolicy @relation(...)
  status          ApprovalInstanceStatus -- PENDING / APPROVED / REJECTED / CANCELLED
  startedAt       DateTime @default(now())
  completedAt     DateTime?
  records         ApprovalRecord[]
}

model ApprovalRecord {
  id          String   @id @default(uuid())
  instanceId  String
  instance    ApprovalInstance @relation(...)
  approverId  String
  approver    User     @relation(...)
  decision    ApprovalDecision -- APPROVED / REJECTED
  comment     String?
  decidedAt   DateTime @default(now())
}

// SLA
model BusinessCalendar {
  id              String   @id @default(uuid())
  name            String   @unique
  timezone        String   @default("Asia/Kolkata")
  weeklySchedule  Json     -- { mon: {start: "09:00", end: "18:00"}, tue: {...}, ... }
  holidays        Json     -- ["2026-01-26", "2026-08-15", ...]
  isActive        Boolean  @default(true)
  ...
}

model SlaPolicy {
  id              String   @id @default(uuid())
  parentStageId   String   @unique         -- 1:1 with WorkflowStage
  parentStage     WorkflowStage @relation(...)
  duration        Int                       -- seconds (Prisma doesn't have DurationField)
  calendarId      String?
  calendar        BusinessCalendar? @relation(...)
  pauseOnHold     Boolean  @default(true)
  pauseOnExtensionPending Boolean @default(false)
  responsibleRoles Role[]  @relation("SlaPolicyResponsibleRoles")
  responsibleUsers User[]  @relation("SlaPolicyResponsibleUsers")
  thresholds      SlaThreshold[]
}

model SlaThreshold {
  id              String   @id @default(uuid())
  policyId        String
  policy          SlaPolicy @relation(...)
  percentage      Int                       -- 0-100
  targetSlaStageId String?                  -- stage to transition to at threshold
  targetSlaStage  WorkflowStage? @relation(...)
  notifyRoles     Role[]   @relation("SlaThresholdNotifyRoles")
  notifyUsers     User[]   @relation("SlaThresholdNotifyUsers")
}

model SlaTimer {
  id              String   @id @default(uuid())
  ticketId        String
  ticket          Ticket   @relation(...)
  stageId         String
  stage           WorkflowStage @relation(...)
  policyId        String
  policy          SlaPolicy @relation(...)
  status          SlaTimerStatus -- ACTIVE / PAUSED / COMPLETED / BREACHED
  startedAt       DateTime @default(now())
  pausedAt        DateTime?
  resumedAt       DateTime?
  deadline        DateTime
  completedAt     DateTime?
  totalPausedSec  Int      @default(0)
  events          SlaTimerEvent[]
}

model SlaTimerEvent {
  id          String   @id @default(uuid())
  timerId     String
  timer       SlaTimer @relation(...)
  eventType   SlaEventType -- THRESHOLD_BREACHED / THRESHOLD_FIRED / PAUSED / RESUMED / EXTENDED / COMPLETED / BREACHED
  eventData   Json?
  occurredAt  DateTime @default(now())
}

model SlaExtension {
  id          String   @id @default(uuid())
  timerId     String
  timer       SlaTimer @relation(...)
  requestedById String
  requestedBy User     @relation("SlaExtensionRequestedBy", fields:[...], references:[id])
  approverId  String?
  approver    User?    @relation("SlaExtensionApprover", fields:[...], references:[id])
  status      ExtensionStatus -- PENDING / APPROVED / REJECTED
  reason      String
  extensionSec Int
  ...timestamps...
}
```

### Async Tasks (BullMQ + Redis)

```
backend/src/jobs/
├── queue.ts                 -- BullMQ queue setup
├── sla.checker.ts           -- runs every 5 min: check thresholds, fire events
├── sla.breach.checker.ts    -- runs every 15 min: mark BREACHED, notify
└── worker.ts                -- worker process entry point
```

Cron schedule:
- `*/5 * * * *` — `checkSlaThresholds`: walks active timers, computes elapsed%, fires threshold events
- `*/15 * * * *` — `checkSlaTimers`: marks breached timers, sends notifications

### Engine integration

`engine/orchestrator.ts:performAction` gains an **approval intercept**:

```ts
// After AccessLayer, before TransitionLayer:
const policy = await getApprovalPolicy(stageId, actionId);
if (policy && policy.mode !== 'SINGLE') {
  const instance = await ensureApprovalInstance(ticket, policy);
  const decision = await recordApprovalDecision(instance, user, payload);

  if (!isPolicySatisfied(instance, policy)) {
    return { status: 'pending_approval', remaining: getRemainingApprovers(instance, policy) };
  }
  // Else: policy satisfied, proceed to transition
}
```

`engine/sla.handler.ts`:
- On `STAGE_ENTERED` (Phase 4 audit hook): create `SlaTimer` with `deadline = now + policy.duration` (computed via business calendar)
- On `STAGE_EXITED`: mark timer `COMPLETED`
- On `HOLD`: pause timer (if `policy.pauseOnHold`)
- On `UNHOLD`: resume timer (track `totalPausedSec`)

### API Surface

```
POST   /api/tickets/:id/approvals/:instanceId/decide   -- approve/reject

GET    /api/sla/policies                              -- list SLA policies
POST   /api/sla/policies                              -- create
PATCH  /api/sla/policies/:id                          -- update
GET    /api/sla/timers?status=ACTIVE                  -- query timers
POST   /api/sla/timers/:id/extend                     -- request extension

GET    /api/business-calendars                        -- list
POST   /api/business-calendars                        -- create
PATCH  /api/business-calendars/:id                    -- update

GET    /api/tickets/:id/approvals                     -- ticket's approval instances
GET    /api/tickets/:id/sla                           -- ticket's SLA state
```

### Effort

~5-7 days, ~4,000 LoC.

---

## 6. Phase 4 — Audit Trail + E-Signatures

### Goal

Make every state change tamper-evident. Every business event lands in a hash-chained audit log. Stages can require e-signatures; signatures are immutable post-sign.

### Schema (4 new tables)

```prisma
model AuditLogEntry {
  id              String      @id @default(uuid())
  ticketId        String?
  ticket          Ticket?     @relation(...)
  workflowId      String?
  workflow        Workflow?   @relation(...)
  eventType       AuditEventType -- 25+ values: WORKFLOW_CREATED, WORKFLOW_UPDATED, TICKET_RAISED, STAGE_ENTERED, STAGE_EXITED, ACTION_PERFORMED, FORM_SUBMITTED, APPROVAL_SUBMITTED, SLA_VIOLATED, SIGNATURE_RECORDED, ...
  eventData       Json
  performedById   String?
  performedBy     User?       @relation(...)
  performedByName String?     -- snapshot
  sequenceNumber  Int                                -- sequential per ticket/workflow
  entryHash       String                              -- SHA-256 of (prev + payload)
  previousHash    String?
  isValidated     Boolean     @default(false)
  validationErrors Json?
  lastValidatedAt DateTime?
  occurredAt      DateTime    @default(now())

  @@unique([ticketId, sequenceNumber])
  @@index([eventType])
  @@index([occurredAt])
}

model EsignatureRecord {
  id                  String   @id @default(uuid())
  signedById          String
  signedBy            User     @relation(...)
  signedByName        String                          -- snapshot
  signedByEmail       String                          -- snapshot
  meaning             String                          -- "I attest these results are accurate"
  pinHashVerified     Boolean
  certificateUsed     Boolean  @default(false)
  certificateData     Json?                           -- if cert-based
  ipAddress           String?
  userAgent           String?
  signedAt            DateTime @default(now())
  signature           WorkflowStageSignature?
}

model WorkflowStageSignature {
  id                  String  @id @default(uuid())
  ticketId            String
  ticket              Ticket  @relation(...)
  stageId             String
  stage               WorkflowStage @relation(...)
  signedByUuid        String                           -- snapshot (in case user deleted)
  signedByName        String                           -- snapshot
  signedByEmail       String                           -- snapshot
  esignatureRecordId  String  @unique
  esignatureRecord    EsignatureRecord @relation(...)
  useCertificate      Boolean @default(false)
  isInvalidated       Boolean @default(false)
  invalidatedReason   String?
  invalidatedAt       DateTime?
  invalidatedById     String?
  invalidatedBy       User?   @relation(...)
  signedAt            DateTime @default(now())
}

model ReturnPath {
  id              String  @id @default(uuid())
  ticketId        String
  ticket          Ticket  @relation(...)
  fromStageId     String  -- where we returned from
  toStageId       String  -- where we returned to
  reason          String
  returnedById    String
  returnedBy      User    @relation(...)
  returnedAt      DateTime @default(now())
}
```

### Hash Chain

```ts
const computeEntryHash = (entry: AuditLogEntry): string => {
  const payload = JSON.stringify({
    sequenceNumber: entry.sequenceNumber,
    eventType: entry.eventType,
    eventData: entry.eventData,
    performedById: entry.performedById,
    occurredAt: entry.occurredAt.toISOString(),
    previousHash: entry.previousHash ?? null,
  });
  return sha256(payload);  -- node:crypto
};

// Insert path:
const last = await tx.auditLogEntry.findFirst({
  where: { ticketId },
  orderBy: { sequenceNumber: 'desc' },
});
const entry = await tx.auditLogEntry.create({
  data: {
    ticketId, eventType, eventData, performedById,
    sequenceNumber: (last?.sequenceNumber ?? 0) + 1,
    previousHash: last?.entryHash ?? null,
    entryHash: '',  -- computed below
  }
});
const hash = computeEntryHash(entry);
await tx.auditLogEntry.update({ where: { id: entry.id }, data: { entryHash: hash } });
```

### Engine integration

All state-change layers (transition, hold, approvals, signatures, SLA timer events) emit audit events via:

```ts
// engine/audit.emitter.ts
export const emitAuditEvent = async (
  tx: Prisma.TransactionClient,
  ctx: { ticket?: Ticket; workflow?: Workflow },
  eventType: AuditEventType,
  eventData: object,
  user: { id: string; name: string }
) => { ...inserts hash-chained row... };
```

Wired into the transaction at every mutation point. Atomic guarantees prevent gaps.

### Verification endpoint

```ts
// GET /api/audit/verify?ticketId=...
// Walks the chain, recomputes each hash, compares to stored value.
// Returns { valid: bool, brokenAt?: sequenceNumber, totalEntries }
```

### E-signature flow

When a stage action requires signature (`WorkflowStageAction.requireSignature` — added in this phase):

```
1. Frontend prompts for PIN
2. POST /api/tickets/:id/sign with { actionId, pin, meaning }
3. Backend:
   a. bcrypt.compare(pin, user.signaturePinHash)
   b. Create EsignatureRecord
   c. Create WorkflowStageSignature
   d. Emit SIGNATURE_RECORDED audit event
   e. Continue transition (engine resumes)
```

### API Surface

```
POST   /api/audit/query                   -- filter by ticket, eventType, dateRange, user
GET    /api/audit/verify?ticketId=...     -- chain integrity check
GET    /api/audit/statistics              -- counts by type, stage, user

POST   /api/users/me/signature-pin        -- enroll signature PIN
POST   /api/tickets/:id/sign              -- sign action with PIN
GET    /api/tickets/:id/signatures        -- list ticket signatures
POST   /api/tickets/:id/signatures/:sigId/invalidate  -- post-hoc invalidation (logged)
```

### Effort

~3-4 days, ~2,000 LoC.

---

## 7. Phase 5 — Audit Scheduling + Dashboards

### Goal

Recurring audits spawn tickets automatically. Dashboards show activity timelines, ticket pipelines, and SLA health at a glance.

### Schema (3 new tables)

```prisma
model AuditSchedule {
  id              String   @id @default(uuid())
  name            String
  workflowId      String                              -- which workflow to spawn
  workflow        Workflow @relation(...)
  recurrence      RecurrenceType  -- NONE / DAILY / WEEKLY / MONTHLY / QUARTERLY / YEARLY
  startDate       DateTime
  endDate         DateTime?
  nextRunAt       DateTime?                            -- materialized for fast cron query
  lastRunAt       DateTime?
  financialYear   String?
  plant           String?
  leadAuditorId   String?
  leadAuditor     User?    @relation("AuditScheduleLeadAuditor", fields:[...], references:[id])
  auditTeam       User[]   @relation("AuditScheduleAuditTeam")
  auditeeDepartmentId String?
  auditeeDepartment Department? @relation(...)
  auditeeContactId String?
  auditeeContact  User?    @relation("AuditScheduleAuditeeContact", fields:[...], references:[id])
  advancedOverrides Boolean @default(false)            -- per-row override mode
  isActive        Boolean  @default(true)
  ...timestamps + soft delete...
}

model TimelineProjection {
  id              String   @id @default(uuid())
  ticketId        String
  ticket          Ticket   @relation(...)
  eventType       String                              -- enriched event for UI rendering
  title           String                              -- "John Doe approved CAPA-001"
  description     String?
  iconName        String?
  color           String?
  performedById   String?
  performedBy     User?    @relation(...)
  occurredAt      DateTime
  metadata        Json?
  @@index([ticketId, occurredAt])
}

model PeriodicReviewConfig {
  id              String   @id @default(uuid())
  documentTypeId  String?                              -- DMS doc type if applicable
  reviewIntervalDays Int                                -- e.g. 365 for annual review
  workflowId      String                                -- workflow used for reviews
  workflow        Workflow @relation(...)
  ...
}
```

### Async Jobs

- `*/0 6 * * *` (daily 6 AM) — `triggerAuditSchedules`: find `AuditSchedule.nextRunAt <= now AND isActive`, spawn tickets, advance `nextRunAt` based on recurrence
- `*/0 6 * * *` — `schedulePeriodicReview`: find documents past their review interval, spawn review tickets

### Timeline Projection

`TimelineProjection` is a denormalized read model. Built reactively from audit events (Phase 4):

```ts
// engine/timeline.projector.ts
on AUDIT_EVENT:
  switch (eventType) {
    case TICKET_RAISED:
      insert TimelineProjection { iconName: 'plus', color: 'green', title: `${user} raised ${ticket.uniqueId}` }
    case STAGE_ENTERED:
      insert ... { iconName: 'arrow-right', title: `Entered ${stageName}` }
    case ACTION_PERFORMED:
      insert ... { title: `${user} performed ${actionName}` }
    case APPROVAL_SUBMITTED:
      insert ... { iconName: 'check-circle', color: 'blue' }
    case SLA_VIOLATED:
      insert ... { iconName: 'alert-triangle', color: 'red' }
    case SIGNATURE_RECORDED:
      insert ... { iconName: 'pen', color: 'purple' }
    ...
  }
```

### API Surface

```
GET    /api/audit-schedules
POST   /api/audit-schedules
PATCH  /api/audit-schedules/:id
DELETE /api/audit-schedules/:id
POST   /api/audit-schedules/:id/run-now              -- manual trigger

GET    /api/tickets/:id/timeline                     -- TimelineProjection
GET    /api/dashboards/my-tickets                    -- assigned to me
GET    /api/dashboards/sla-health                    -- breach % by workflow/dept
GET    /api/dashboards/workflow-throughput           -- tickets/day by workflow
GET    /api/dashboards/activity-feed                 -- org-wide recent events
```

### Effort

~3-5 days, ~2,500 LoC.

---

## 8. Frontend Phasing

Each backend phase has a paired frontend phase. The frontend lives in `client/src/features/` and the existing `workflows/` feature folder currently uses mock data (`data.ts`) — it'll be wired to the real API per phase.

### Frontend deliverables per phase

| BE Phase | Paired FE work | Key components |
|---|---|---|
| **1** | API client + Builder UI + Lookup admin | Replace mock `data.ts` → typed fetchers in `lib/api/workflow.ts`; React Flow canvas for graph editing; node palette; inspector panel; version compare diff; admin pages for `WorkflowType` / `StageStatus` / `ActionCriteria` / `Priority` |
| **2** | Ticket UI | Ticket list (filters), Ticket detail (header + tabs), Action button bar (driven by `/allowed-actions`), comments section, timeline component, doc upload widget |
| **3** | Approval & SLA UI | Approval modal (multi-approver progress), SLA badge on ticket cards, business calendar admin form, escalation banners |
| **4** | Audit & e-signature | Audit log query/filter page, integrity-verify badge, signature PIN modal (PIN entry + meaning + confirm), enrollment flow |
| **5** | Schedule admin + dashboards | Audit schedule builder (recurrence picker), "My Tickets" dashboard, SLA health widget, activity feed, throughput chart |

### Scheduling options

#### Option A — Sequential (default)

```
BE-1 ✅ ─→ FE-1 ─→ BE-2 ─→ FE-2 ─→ BE-3 ─→ FE-3 ─→ ...
```

Pro: clean handoffs, no API churn.
Con: longest critical path.

#### Option B — Pipelined

```
BE-1 ✅ ─→ BE-2 ─→ BE-3 ─→ ...
            │       │
           FE-1 ─→ FE-2 ─→ ...
```

Pro: backend never idle. Frontend follows ~1 phase behind.
Con: requires API contract freeze at end of each backend phase. Frontend builds against frozen OpenAPI types.

### Recommended cadence

**Sequential for Phase 1 + 2** (the React Flow builder + ticket UI are tightly coupled to the API shape — pipelining here would cause rework).
**Pipelined from Phase 3 onwards** (approvals/SLA/audit are additive — frontend can build against frozen Phase 2 types while backend layers Phase 3 features).

### Frontend approach

- **Stack**: existing — React + Vite + TypeScript + Tailwind + lucide-react + (TanStack Query — to add). React Flow already implied by the prod system; install `reactflow` for builder.
- **API client pattern**: one file per backend module under `client/src/lib/api/{module}.ts`. Each file exports typed fetchers and TanStack Query hooks. Uses generated types from the OpenAPI spec (run `openapi-typescript` against `/api/docs`).
- **Auth**: existing JWT in localStorage; reuse the existing axios/fetch wrapper if any.
- **State**: TanStack Query handles server state. Local UI state with `useState`. Forms use React Hook Form + Zod (matches backend Zod schemas).

### Cross-cutting frontend conventions

- **Permissions**: hide buttons + routes the user can't access using existing permission helper (extend if needed).
- **Error rendering**: backend's `validation_errors` array is rendered as a list under the form. Standard error envelope `{error: {message, details?}}` shows toast.
- **Loading states**: skeletons for lists, spinners for inline loads.
- **Empty states**: every list page has an illustrated empty state with primary CTA.

---

## 9. Total Effort

| Phase | Estimate | Status | Cumulative LoC |
|---|---|---|---|
| Phase 1 | 2-3 days | ✅ Shipped | ~1,800 |
| Phase 2 | 5-7 days | ✅ Shipped | ~5,300 |
| Phase 3 | 5-7 days | ✅ Shipped | ~9,300 |
| Phase 3.5 + 3.5+ refactor | 1 day planned → 3 days actual | ✅ Shipped (tests pending) | ~12,400 |
| Phase 4 | 3-4 days | ⏳ Next | ~14,400 |
| Phase 5 | 3-5 days | ⏳ Queued | ~17,000 |
| **Total** | **20-28 days** (~5 weeks) | | **~17,000** |

LoC estimate revised up by ~3,200 vs original plan due to Phase 3.5 not being scoped in the original five-phase map plus the embed-in-JSON refactor.

This compares to ~50,000 LoC in the prod Django backend's `workflows/` app — we're shedding the auth-service migration shim, dual-mode FK fields, plugin/circuit-breaker infrastructure, and some governance features.

---

## 10. Phase Boundaries — Hard Rules

To keep phases shippable, **never** cross these lines:

| Phase 1 | **MUST NOT** introduce ticket/execution code. If a "future use" import would help, defer it. |
| Phase 2 | **MUST NOT** introduce SLA, approvals, or audit hash chain. Engine emits noop hooks; Phase 4 wires them. |
| Phase 3 | **MUST NOT** require the audit log. SLA events go to `SlaTimerEvent` (own table), not the audit chain. |
| Phase 4 | **MUST** retroactively wire all Phase 2/3 mutation points to emit audit events. This is the bulk of Phase 4's risk. |
| Phase 5 | **MUST NOT** require new mutations. Pure read-side enrichment (timeline projection) + cron-spawn. |

---

## 11. Risks Across Phases

| Risk | Phase | Mitigation |
|---|---|---|
| React Flow payload shape drifts from prod's | 1, 2 | Use Zod `.passthrough()`, log unknown fields, document expected shape |
| Approval intercept correctness on parallel branches | 3 | Approval is per-stage-per-action; parallel branches may need separate `ApprovalInstance` rows. Test with multi-fork scenario. |
| Hash chain perf on high-throughput tickets | 4 | Index `(ticketId, sequenceNumber)`, batch verify, lazy validation |
| BullMQ requires Redis infra | 3 | Confirm with ops; fallback to in-process `node-cron` only if multi-instance not needed |
| UUID v4 vs v7 for ticket IDs | 2 | v4 is fine for IDs; if sortable timestamps needed, use a `createdAt` index instead |
| E-signature legal validity | 4 | PIN-based covers FDA Part 11 §11.200; cert-based deferred unless required |
| Cron task drift between environments | 3, 5 | Use BullMQ `repeatOpts` with explicit pattern; document timezone (UTC) |

---

## 12. Migration Path from Prod (if data needs to come over)

Out of scope for this plan, but if migration becomes a requirement:

1. **Schema diff tool** — generate column mapping from Django models to Prisma schema
2. **Bulk export** from Django (`manage.py dumpdata`) to JSON per app
3. **Loader scripts** in `backend/scripts/migrate-from-django/` that:
   - Map UUID v7 → UUID (preserve as-is, both are 128-bit UUIDs)
   - Translate `auth_service_uuid` fields → direct FK
   - Skip plugin/circuit-breaker tables
4. **Audit chain replay** — recompute hashes since prod uses different chain semantics
5. **Validation pass** — count rows, verify FK integrity, sample-test workflow execution

Not part of any phase above. Add as Phase 6 if needed.

---

## 13. Phase Acceptance Criteria

Each phase is "done" when:

- [ ] All schema changes migrated cleanly on a fresh DB
- [ ] All endpoints registered in OpenAPI, visible at `/api/docs`
- [ ] Manual smoke test plan from the phase doc passes end-to-end
- [ ] `tsc` clean, no `any` types in service layer
- [ ] Permissions seeded; existing roles get appropriate grants
- [ ] No new `npm` dependencies beyond what the phase needs
- [ ] Phase doc updated with "Done" checkmarks and any deviations from plan

---

## 14. Active Document Set

| Doc | Purpose |
|---|---|
| `WORKFLOW_MASTER_PLAN.md` | This file — high-level phasing |
| `WORKFLOW_PHASE_1_PLAN.md` | Phase 1 detailed plan ✅ |
| `WORKFLOW_PHASE_2_PLAN.md` | Phase 2 detailed plan ✅ |
| `WORKFLOW_PHASE_3_PLAN.md` | TBD — written before Phase 3 starts |
| `WORKFLOW_PHASE_4_PLAN.md` | TBD |
| `WORKFLOW_PHASE_5_PLAN.md` | TBD |
| `workflow/workflow-changes.md` | Running changelog of every code change made |

The master plan stays at the level of "what each phase covers". Detailed schema, request/response shapes, and implementation algorithms go in the per-phase doc.

---

## 15. Open Questions (to revisit before each phase)

| Phase | Question |
|---|---|
| 2 | Ticket ID format — confirm `{TYPE_PREFIX}-FQS-{seq:003d}` matches frontend expectation, or is `seq` global vs per-workflow? |
| 2 | Custom fields on Ticket — one `Json` column, or separate `TicketCustomField` rows? |
| 3 | BullMQ vs `node-cron` — is Redis available in your infra? |
| 3 | Approval SLA — separate timer or sub-clock of stage SLA? |
| 4 | Signature certificate support — required for compliance, or PIN-only OK? |
| 5 | Dashboard caching — Redis-backed projections, or compute on read? |

These don't block Phase 1; flag as we approach each phase.
