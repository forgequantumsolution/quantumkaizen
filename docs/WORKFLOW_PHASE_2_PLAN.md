# Workflow System — Phase 2 Implementation Plan

**Status:** ✅ Complete (smoke-tested 2026-05-08)
**Owner:** Backend
**Depends on:** Phase 1 complete (workflow definitions, builder, lookups)
**Reference:** `core-prod-scaling/backend/workflows/{models/ticket.py, engine/}`

---

## 1. Phase 2 Goal

Make workflows **executable**. After Phase 2:

- Users can raise a ticket against an `ACTIVE` workflow
- The engine drives the ticket through stages via user actions, atomically
- Fork/join/decision logic respects the graph definitions from Phase 1
- Stage history is recorded as an immutable timeline
- Holds, returns, and reassignments all work
- The frontend can build a "My Tickets" view, ticket detail view, and an action button bar

**Out of scope (deferred to later phases):** approval policies, SLA timers, hash-chained audit log, e-signatures, form bindings, periodic schedules. Phase 2 emits **noop hooks** for these — they're wired in later phases without requiring Phase 2 changes.

---

## 2. Cross-cutting Decisions

These extend §2 of the master plan and need sign-off before code generation:

| # | Decision | Default | Alternatives |
|---|---|---|---|
| Q1 | **Ticket ID format** | `{TYPE_PREFIX}-FQS-{seq:003d}` per workflow | Per-org global seq, ULID, no human-readable ID |
| Q2 | **Counter source** | `SELECT MAX(seq) FOR UPDATE` per workflow | Separate `WorkflowCounter` row, Postgres sequence per workflow |
| Q3 | **Custom fields on Ticket** | Single `customFields Json?` column | Separate `TicketCustomField` rows, schemaful JSON-per-workflow |
| Q4 | **File upload** | Out of scope — `TicketDoc.fileUrl` is opaque string; presigned-URL flow added in DMS phase | S3 presigned upload now, multipart upload now |
| Q5 | **`ParallelBranchTracking` model** | In Phase 2 (needed for fork/join correctness) | Defer to "parallel-only" follow-up |
| Q6 | **`ChildWorkflowTrigger` execution** | Schema only in Phase 2; "spawn child" endpoint stubbed | Full implementation in Phase 2 |
| Q7 | **Comment threads** | Flat (no `parentCommentId`) — keeps Phase 2 small | Threaded with `parentCommentId` self-FK |
| Q8 | **Sample workflow seed** | Add a "Document Review" 3-stage workflow + 1 sample ticket to seed.ts so frontend has data to play with | Skip seed |
| Q9 | **Engine concurrency** | Optimistic — wrap `performAction` in `prisma.$transaction` with explicit `SELECT FOR UPDATE` on `Ticket` row | Pessimistic redis lock; advisory locks |
| Q10 | **"Audit event" hook contract** | Phase 2 defines `emitAuditEvent(tx, ctx, eventType, data, user)` as a noop function in `engine/audit.emitter.ts`. Phase 4 implements the body. | Skip the hook entirely; Phase 4 retroactively edits all call sites |

The defaults are recommended. Confirm or override before I generate code.

---

## 3. Schema Changes

### 3.1 New Prisma Enums

```prisma
enum TicketDeleteState {
  ACTIVE
  DELETED
}

enum DocType {
  ATTACHMENT
  EVIDENCE
  REPORT
  FORM_SUBMISSION
  OTHER
}

enum TicketHoldState {
  ACTIVE
  HELD
}

enum ChildTriggerMode {
  MANUAL
  AUTO
}

enum ParallelBranchStatus {
  ACTIVE
  COMPLETED
  CANCELLED
}
```

### 3.2 New Models (7)

```prisma
model Ticket {
  id              String   @id @default(uuid())
  uniqueId        String   @unique                    // "DOC-FQS-001"
  title           String
  description     String?
  ticketReason    String?

  parentTicketId  String?
  parentTicket    Ticket?  @relation("TicketParent", fields: [parentTicketId], references: [id], onDelete: SetNull)
  childTickets    Ticket[] @relation("TicketParent")

  parentTicketStageId String?
  parentTicketStage   WorkflowStage? @relation("TicketParentStage", fields: [parentTicketStageId], references: [id], onDelete: SetNull)

  priorityId      String?
  priority        Priority? @relation(fields: [priorityId], references: [id], onDelete: SetNull)

  departmentId    String?
  department      Department? @relation("TicketDepartment", fields: [departmentId], references: [id], onDelete: SetNull)

  siteId          String?
  site            Site?       @relation("TicketSite", fields: [siteId], references: [id], onDelete: SetNull)

  customFields    Json?

  isOnHold        Boolean  @default(false)
  holdReason      String?
  heldAt          DateTime?
  heldById        String?
  heldBy          User?    @relation("TicketHeldBy", fields: [heldById], references: [id], onDelete: SetNull)

  isDeleted       Boolean  @default(false)
  deletedAt       DateTime?
  deletedById     String?
  deletedBy       User?    @relation("TicketDeletedBy", fields: [deletedById], references: [id], onDelete: SetNull)

  createdById     String?
  createdBy       User?    @relation("TicketCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)

  flows           TicketFlow[]
  comments        TicketComment[]
  docs            TicketDoc[]
  stageTracking   TicketStageTracking[]
  parallelTracking ParallelBranchTracking[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([uniqueId])
  @@index([createdById, createdAt])
  @@index([priorityId, createdAt])
  @@index([isDeleted, createdAt])
  @@index([parentTicketId, isDeleted])
}

model TicketFlow {
  id              String   @id @default(uuid())
  ticketId        String
  ticket          Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  workflowId      String
  workflow        Workflow @relation(fields: [workflowId], references: [id], onDelete: Restrict)

  // Snapshots at creation
  workflowName    String
  workflowVersion Int

  isCompleted     Boolean  @default(false)
  completedAt     DateTime?
  statusUpdatedAt DateTime @default(now())

  // m2m: a ticket can be on multiple stages simultaneously during a fork
  currentStages   WorkflowStage[] @relation("TicketFlowCurrentStages")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([ticketId, workflowId])
  @@index([workflowId, isCompleted])
  @@index([ticketId, isCompleted])
}

model TicketStageTracking {
  id              String    @id @default(uuid())
  ticketId        String
  ticket          Ticket    @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  stageId         String?
  stage           WorkflowStage? @relation(fields: [stageId], references: [id], onDelete: SetNull)

  // Snapshots so deletion of stage doesn't lose history
  stageName       String
  stageWorkflowId String

  enteredAt       DateTime  @default(now())
  exitedAt        DateTime?
  durationSec     Int?

  isActive        Boolean   @default(true)
  isOnHold        Boolean   @default(false)
  holdReason      String?

  performedById   String?
  performedBy     User?     @relation("TicketStageTrackingPerformedBy", fields: [performedById], references: [id], onDelete: SetNull)

  // Snapshot of the action that caused exit
  postActionId    String?
  postAction      WorkflowStageAction? @relation("StageTrackingPostAction", fields: [postActionId], references: [id], onDelete: SetNull)

  // For RETURN behavior — which stage we returned from
  returnedFromStageId String?
  returnedFromStage   WorkflowStage? @relation("StageTrackingReturnedFrom", fields: [returnedFromStageId], references: [id], onDelete: SetNull)

  remarks         String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ticketId, stageId, isActive])
  @@index([ticketId, isActive])
  @@index([stageWorkflowId, isActive])
  @@index([enteredAt])
}

model TicketComment {
  id          String   @id @default(uuid())
  ticketId    String
  ticket      Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  body        String
  authorId    String?
  author      User?    @relation("TicketCommentAuthor", fields: [authorId], references: [id], onDelete: SetNull)

  isDeleted   Boolean  @default(false)
  deletedAt   DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ticketId, createdAt])
}

model TicketDoc {
  id          String   @id @default(uuid())
  ticketId    String
  ticket      Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  stageId     String?
  stage       WorkflowStage? @relation("TicketDocStage", fields: [stageId], references: [id], onDelete: SetNull)

  fileUrl     String                  // opaque — DMS or S3 URL
  fileName    String
  mimeType    String?
  fileSizeBytes Int?
  docType     DocType  @default(ATTACHMENT)

  uploadedById String?
  uploadedBy   User?   @relation("TicketDocUploadedBy", fields: [uploadedById], references: [id], onDelete: SetNull)

  isDeleted   Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ticketId, createdAt])
}

model ChildWorkflowTrigger {
  id              String        @id @default(uuid())
  parentStageId   String
  parentStage     WorkflowStage @relation("StageChildTriggers", fields: [parentStageId], references: [id], onDelete: Cascade)
  childWorkflowId String
  childWorkflow   Workflow      @relation("WorkflowChildTriggers", fields: [childWorkflowId], references: [id], onDelete: Restrict)

  triggerMode     ChildTriggerMode @default(MANUAL)
  isBlocking      Boolean   @default(false)
  allowMultiple   Boolean   @default(false)
  order           Int       @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model ParallelBranchTracking {
  id              String   @id @default(uuid())
  ticketId        String
  ticket          Ticket   @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  forkStageId     String
  forkStage       WorkflowStage @relation("ForkBranchTracking", fields: [forkStageId], references: [id], onDelete: Cascade)
  joinStageId     String?
  joinStage       WorkflowStage? @relation("JoinBranchTracking", fields: [joinStageId], references: [id], onDelete: SetNull)

  branchPath      Json                            // ordered list of stage canonicalIds for this branch
  status          ParallelBranchStatus @default(ACTIVE)
  startedAt       DateTime @default(now())
  completedAt     DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ticketId, forkStageId, status])
}
```

### 3.3 Models Modified (Phase 1 tables get back-relations)

| Model | Add |
|---|---|
| `User` | `ticketsCreated`, `ticketsDeleted`, `ticketsHeld`, `commentsAuthored`, `docsUploaded`, `stageTrackingPerformed` |
| `Workflow` | `flows TicketFlow[]`, `childTriggers ChildWorkflowTrigger[]` |
| `WorkflowStage` | `currentForFlows TicketFlow[]` (m2m inverse), `stageTracking TicketStageTracking[]`, `parentTickets Ticket[]`, `forkBranches`, `joinBranches`, `childTriggers`, `docs`, `returnedFromTracking` |
| `WorkflowStageAction` | `postActionsTracking TicketStageTracking[]` |
| `Department` | `tickets Ticket[]` |
| `Site` | `tickets Ticket[]` |
| `Priority` | `tickets Ticket[]` |

(All inverse-only — no logic changes.)

---

## 4. Engine Architecture

```
backend/src/modules/workflow/engine/
├── orchestrator.ts          // public entry points: raiseTicket, getCurrentStageActions, performAction
├── transition.layer.ts      // ONLY place that mutates TicketFlow.currentStages, isCompleted
├── graph.layer.ts           // DAG traversal, resolves next stages via transitions
├── decision.layer.ts        // XOR branch evaluation (condition expressions)
├── access.layer.ts          // RBAC validation (allowedRoles + allowedUsers on action)
├── tracking.layer.ts        // Open/close TicketStageTracking rows
├── action.dispatcher.ts     // Dispatch by behavior: forward/reject/hold/unhold/return/reassign
├── parallel.handler.ts      // ParallelBranchTracking lifecycle (fork entry, join completion)
└── audit.emitter.ts         // NOOP in Phase 2; Phase 4 implements hash-chain
```

### 4.1 Orchestrator entry points

```ts
// engine/orchestrator.ts

export const raiseTicket = async (
  workflowId: string,
  payload: RaiseTicketInput,
  user: { id: string }
): Promise<{ ticket: Ticket; flow: TicketFlow }> => { /* ... */ };

export const getCurrentStageActions = async (
  ticketId: string,
  user: { id: string }
): Promise<{ stages: StageActionsView[] }> => { /* ... */ };

export const performAction = async (
  ticketId: string,
  actionId: string,
  user: { id: string },
  payload?: { remarks?: string; returnToStageId?: string; reassignToUserId?: string; reassignToRoleId?: string }
): Promise<{ status: 'completed' | 'transitioned' | 'held'; flow: TicketFlow }> => { /* ... */ };

export const holdTicket = async (
  ticketId: string,
  reason: string,
  user: { id: string }
) => { /* universal hold — works at any stage even without a configured Hold action */ };

export const resumeTicket = async (
  ticketId: string,
  user: { id: string }
) => { /* universal resume */ };
```

### 4.2 `raiseTicket` algorithm

```
1. Validate workflow:
   - Exists, not deleted
   - workflowStatus === 'ACTIVE'
   - isLatestVersion === true
2. Open prisma.$transaction:
   a. Generate uniqueId:
      - Lock the workflow's TicketFlow rows: SELECT MAX(unique_id_seq) ... FOR UPDATE
      - Or insert into a counter table (see Q2)
      - Format: `{type.codePrefix}-FQS-{n:03d}`
   b. Create Ticket
   c. Create TicketFlow with:
      - workflowName, workflowVersion snapshotted from workflow row
   d. Resolve initial stage (WorkflowStage.isInitialStage = true)
   e. Set flow.currentStages = [initialStage] via m2m connect
   f. Open TicketStageTracking row for the initial stage
   g. emitAuditEvent('TICKET_RAISED', {workflowId, ticketId})
3. Commit
4. Return ticket + flow
```

Note: prod auto-exits the initial stage immediately. We won't — initial stage is presented to the user with its actions; they take the first action explicitly.

### 4.3 `performAction` algorithm

```
1. Open prisma.$transaction:
   a. Load ticket, flow, current stages, action (with roles/users), action's stage
      - Verify action.stageId is in flow.currentStages (else 400)
   b. AccessLayer.assertCanPerform(action, user):
      - If action.allowedUsers includes user.id → OK
      - Else if user has any role in action.allowedRoles → OK
      - Else throw Forbidden
   c. Switch on action.workflowAction.behavior:
      FORWARD → forwardAction()
      REJECT  → rejectAction()
      HOLD    → holdAction()
      UNHOLD  → unholdAction()
      RETURN  → returnAction()
      REASSIGN → reassignAction()
   d. emitAuditEvent('ACTION_PERFORMED', {actionId, behavior, ...})
2. Commit
3. Return updated flow
```

### 4.4 `forwardAction` (the common case)

```
1. TrackingLayer.closeStageTracking(ticket, currentStage, user, action)
   — sets exitedAt, durationSec, isActive=false, postActionId=action.id

2. GraphLayer.resolveNextStages(currentStage):
   - Query WorkflowTransition WHERE fromStageId = currentStage.id
   - For each transition:
     - If currentStage.stageType === FORK:
       - Apply splitType:
         AND → all branches activated
         OR  → all branches activated (any one needs to complete at join)
         XOR → DecisionLayer.evaluateCondition(transition.condition) — only matching branch
     - If decision/normal:
       - Either single transition or XOR-evaluated single transition
   - Return list of next stages

3. If currentStage.stageType === FORK:
   - For each activated branch, create ParallelBranchTracking row
   - branchPath computed by walking the graph from branch start until joinStageId

4. If next stage.stageType === JOIN:
   - Find ParallelBranchTracking rows for this fork
   - Apply joinType:
     AND → check all branches completed → if yes, advance past join; else mark this branch completed and stop
     OR  → first branch through marks join completed, rest are cancelled

5. TransitionLayer.advance(flow, nextStages):
   - flow.currentStages.disconnect(currentStage)
   - flow.currentStages.connect(nextStages)
   - For each new stage: TrackingLayer.openStageTracking(ticket, stage)

6. If nextStages is empty (terminal stage):
   - flow.isCompleted = true
   - flow.completedAt = now
   - emitAuditEvent('TICKET_COMPLETED')
```

### 4.5 Other behaviors (sketches)

- **REJECT**: Find previous active tracking row → reopen its stage → close current.
- **HOLD**: Set `Ticket.isOnHold = true`, `tracking.isOnHold = true` for active rows. Universal hold endpoint sidesteps the action layer.
- **UNHOLD**: Reverse hold flags.
- **RETURN**: Action payload includes `returnToStageId` (must exist in `TicketStageTracking` history). Validate and route back. Set `tracking.returnedFromStageId` for audit.
- **REASSIGN**: Records a `ReassignmentRecord` (Phase 2-lite — just logs the change; full assignee model is Phase 3+). Updates `Ticket.assignedToId` if we add that field, OR just an audit event.

---

## 5. API Surface

All endpoints under `/api/tickets`. Permissions: `ticket.read`, `ticket.create`, `ticket.update`, `ticket.delete`, `ticket.transition`.

### 5.1 Ticket CRUD

| Method | Path | Permission | Body / Query |
|---|---|---|---|
| POST | `/api/tickets` | `ticket.create` | `{ workflowId, title, description?, priorityId?, departmentId?, siteId?, customFields? }` |
| GET | `/api/tickets` | `ticket.read` | `?page=1&pageSize=20&workflowId=&status=open\|completed&assigneeMine=true&search=` |
| GET | `/api/tickets/:id` | `ticket.read` | — |
| PATCH | `/api/tickets/:id` | `ticket.update` | `{ title?, description?, priorityId?, departmentId?, customFields? }` |
| DELETE | `/api/tickets/:id` | `ticket.delete` | Soft delete |

### 5.2 Engine

| Method | Path | Body |
|---|---|---|
| GET | `/api/tickets/:id/allowed-actions` | — |
| POST | `/api/tickets/:id/transition` | `{ actionId, remarks?, returnToStageId?, reassignToUserId?, reassignToRoleId? }` |
| POST | `/api/tickets/:id/hold` | `{ reason }` |
| POST | `/api/tickets/:id/resume` | — |

### 5.3 Tracking & Timeline

| Method | Path | Returns |
|---|---|---|
| GET | `/api/tickets/:id/track` | All `TicketStageTracking` rows ordered chronologically |
| GET | `/api/tickets/:id/timeline` | Same as `/track` plus comments + actions interleaved by `createdAt`. Phase 5 enriches into `TimelineProjection`. |
| GET | `/api/tickets/:id/participants` | Distinct users from tracking + comments |

### 5.4 Comments

| Method | Path | Body |
|---|---|---|
| POST | `/api/tickets/:id/comments` | `{ body }` |
| GET | `/api/tickets/:id/comments` | `?page=1&pageSize=20` |
| DELETE | `/api/tickets/:id/comments/:commentId` | — (soft delete; only own comment unless admin) |

### 5.5 Documents

Phase 2 keeps it minimal — frontend uploads to S3/DMS first, sends back URL.

| Method | Path | Body |
|---|---|---|
| POST | `/api/tickets/:id/docs` | `{ fileUrl, fileName, mimeType?, fileSizeBytes?, docType?, stageId? }` |
| GET | `/api/tickets/:id/docs` | — |
| DELETE | `/api/tickets/:id/docs/:docId` | Soft delete |

### 5.6 Child workflows

| Method | Path | Body |
|---|---|---|
| POST | `/api/tickets/:id/spawn-child` | `{ childWorkflowId, title, description? }` — creates child ticket linked via `parentTicketId` |

---

## 6. Sample Seed Data

If Q8 confirmed, seed.ts adds:

```ts
// 1. Create "Document Review" workflow type (already covered in Phase 1 smoke test)
// 2. Create a Workflow row for "Document Review v1" with version=1, workflowStatus='ACTIVE'
// 3. Save a 3-stage linear graph via the builder: Submit → Review → Approve
// 4. Raise one sample Ticket "Sample CAPA-001" against it
//    → exposes /api/tickets endpoints to the frontend without manual setup
```

---

## 7. Permissions

Add 5 new permission keys (matches lookups pattern):

```ts
{ key: 'ticket.read',       module: 'TICKET', action: 'READ',       description: 'View tickets' },
{ key: 'ticket.create',     module: 'TICKET', action: 'CREATE',     description: 'Raise tickets' },
{ key: 'ticket.update',     module: 'TICKET', action: 'UPDATE',     description: 'Edit ticket fields' },
{ key: 'ticket.delete',     module: 'TICKET', action: 'DELETE',     description: 'Soft-delete tickets' },
{ key: 'ticket.transition', module: 'TICKET', action: 'TRANSITION', description: 'Perform stage actions on tickets' },
```

Role grants (mirrors Phase 1):
- `SUPER_ADMIN`, `QMS_ADMIN`: all 5
- `QUALITY_ENGINEER`: read, create, update, transition
- `AUDITOR`, `DOCUMENT_CONTROLLER`: read, transition
- `READ_ONLY`: read only

---

## 8. Module Layout

```
backend/src/modules/ticket/
├── ticket.routes.ts
├── ticket.controller.ts
├── ticket.service.ts            // Ticket CRUD + comments + docs
├── ticket.schema.ts             // Zod schemas
├── ticket.openapi.ts
└── ...

backend/src/modules/workflow/engine/
├── orchestrator.ts
├── transition.layer.ts
├── graph.layer.ts
├── decision.layer.ts
├── access.layer.ts
├── tracking.layer.ts
├── action.dispatcher.ts
├── parallel.handler.ts
└── audit.emitter.ts             // NOOP in Phase 2
```

The engine is tucked under `workflow/` to share types and avoid an additional top-level module.

---

## 9. Test Plan

### 9.1 Unit-level (manual / cURL)

1. Login → JWT
2. List active workflows → grab the latest version's id
3. `POST /api/tickets` → ticket created, uniqueId assigned, initial stage tracked
4. `GET /api/tickets/:id` → confirm currentStages = [initial], track has 1 active row
5. `GET /api/tickets/:id/allowed-actions` → returns initial stage's actions filtered by RBAC
6. `POST /api/tickets/:id/transition` with first action → moves to next stage
7. `GET /api/tickets/:id/track` → 2 rows: first closed (with durationSec), second active
8. Continue transitioning until terminal stage → `flow.isCompleted = true`
9. Hold/resume cycle on a mid-flight ticket
10. Reject → ticket walks backward
11. Add comments, list them, soft-delete one
12. Attach a doc URL, list it
13. Multi-stage workflow with fork/join: confirm both branches activate in AND mode and join waits for both

### 9.2 Engine concurrency (script)

```bash
# 10 concurrent transitions on different tickets — none should collide
for i in $(seq 1 10); do
  curl -X POST .../tickets/$TID_$i/transition -d '{"actionId":"..."}' &
done
wait
```

Verify: zero deadlocks, every ticket advanced exactly once.

### 9.3 Edge cases

- Transition on a ticket that's already on hold → 409
- Transition with action not in current stage → 400
- Transition with action user can't perform → 403
- Save action on a ticket whose workflow was soft-deleted → 409
- Transition through fork/join with mixed AND/OR semantics

---

## 10. Effort Estimate

| Component | LoC |
|---|---|
| Schema + migration | ~250 |
| Seed (sample workflow + ticket) | ~80 |
| Engine layers (8 files) | ~1,400 |
| Orchestrator | ~400 |
| Ticket service + controller + routes | ~500 |
| Schemas (Zod) | ~200 |
| OpenAPI | ~250 |
| Tests/smoke scripts | ~100 |
| **Total** | **~3,180 LoC** |

Roughly **5-7 days** of focused work. The engine is the bulk; ticket CRUD is straightforward.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Concurrent transitions on the same ticket | `SELECT ... FOR UPDATE` on `Ticket` row at start of `performAction` tx; or advisory lock on `ticket.id` |
| Fork/join correctness with nested forks | Phase 2 supports flat fork/join only. Nested fork requires `ForkJoinMapping` (deferred). |
| `currentStages` m2m updates inside a transaction | Test thoroughly — Prisma m2m connect/disconnect must use `tx` not `prisma`. |
| Phase 4 audit hook contract drift | Define `emitAuditEvent` signature now and keep it stable. Phase 4 should only add the body. |
| Decision layer expression syntax | Phase 2 supports simple `${field} == 'value'` expressions; full Jexl/JsonLogic deferred. |
| UniqueId race conditions | Test: 2 concurrent `raiseTicket`s for same workflow shouldn't produce dupe IDs. The `FOR UPDATE` lock handles this. |

---

## 12. What Phase 3 Inherits

Phase 3 (Approvals + SLA) needs from Phase 2:

- ✅ `engine/orchestrator.performAction` is the integration point for approval intercept
- ✅ `tracking.layer.openStageTracking` is the hook for SLA timer creation
- ✅ `engine/audit.emitter.emitAuditEvent` exists as a noop — Phase 4 fills it; Phase 3 calls it for SLA events anyway
- ✅ `WorkflowStageAction` has stable IDs that approval policies can target

No schema changes to Phase 2 tables required for Phase 3.

---

## 13. Deliverable Checklist

- [ ] Schema additions in `prisma/schema.prisma`
- [ ] Migration applied (you run `npx prisma migrate dev --name workflow_phase2_tickets`)
- [ ] `seed.ts` updated (5 permissions, sample workflow, sample ticket if Q8)
- [ ] `src/modules/ticket/` — 5 files
- [ ] `src/modules/workflow/engine/` — 9 files
- [ ] Wired into `src/app.ts` and `src/openapi/spec.ts`
- [ ] `tsc --noEmit` clean
- [ ] Manual smoke test pass (§9.1)
- [ ] Concurrency smoke pass (§9.2)
- [ ] Phase 2 doc updated with "Done" checkmarks

---

## 14. Sign-off Required

Before I generate code, please confirm or override the **10 Q's in §2**. Defaults are listed there. Most important to lock in:

- **Q1/Q2** — ticket ID generation strategy (affects schema + a hot-path query)
- **Q3** — custom fields shape
- **Q8** — should the seed include a sample workflow + ticket
- **Q9** — transaction locking strategy
- **Q10** — defining the `emitAuditEvent` noop hook now vs retroactively in Phase 4

Once you confirm, I'll start with the schema additions, pause for migration review, then build the engine layers + ticket module.
