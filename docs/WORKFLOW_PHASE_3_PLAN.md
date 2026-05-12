# Workflow System — Phase 3 Backend Implementation Plan

**Status:** 🟡 In progress — P3.1 (schema) landed and migrated; P3.2+ pending
**Owner:** Backend
**Depends on:** Phase 1 (workflow definitions) + Phase 2 (tickets, engine, action behaviors)
**Reference:** `core-prod-scaling/backend/workflows/{models/approval.py, models/sla_timer.py, engine/engines/approval_handler.py, engine/services/sla_scheduler.py}`
**Master plan section:** `docs/WORKFLOW_MASTER_PLAN.md` §5
**Revision history:**
- 2026-05-12: initial draft based on master plan
- 2026-05-12: **schema landed + Django-alignment revision applied** — see §3a. Signed-off decisions changed Q5 (rejection semantics), Q11 (cron architecture), Q13 (auto-transition target). Schema fields/enums revised to match Django reference verified by direct source read at `core-prod-scaling/backend/workflows/models/approval.py`, `sla_timer.py`, and `engine/engines/approval_handler.py`. Two migrations applied: `20260512161347_workflow_phase3_approvals_sla` + `20260512171857_workflow_phase3_django_alignment`.

---

## 1. Phase 3 Goal

Make stages **governable**. After Phase 3:

- Any (workflow, stage, action) combination can carry an **approval policy** that intercepts the action — the ticket holds in-stage until the policy is satisfied (single, all-required, quorum, sequential, or any-of-N approvers).
- Any stage can carry an **SLA policy** with a duration, a business-calendar (working hours / holidays), and a list of percentage thresholds. Timers start on stage entry, pause on hold, complete on exit, breach when the deadline is hit.
- A **BullMQ worker process** sweeps active timers on a cron and emits threshold / breach events; events route through the existing Phase 2 audit-emitter hook (still a noop until Phase 4 fills it in).
- Tickets have a **pending-approvals** view; the engine returns `pending_approval` instead of advancing when a policy is unsatisfied.
- The frontend gains: approval-decide modal, SLA progress ring, threshold banner, policy editors in the builder inspector, and a business-calendar admin page (covered in `WORKFLOW_PHASE_3_FRONTEND_PLAN.md`).

**Out of scope (deferred to later phases):** hash-chained audit log (Phase 4), e-signature requirements on actions (Phase 4), audit-schedule cadence (Phase 5), email/Slack notifications (cross-cutting; Phase 4+). Phase 3 emits **noop hooks** for these — they wire in later without re-touching Phase 3 call sites.

---

## 2. Cross-cutting Decisions

These extend §2 of the master plan and need sign-off before code generation. Defaults are recommended; flag any override.

| # | Decision | Default | Alternatives |
|---|---|---|---|
| Q1 | **Approval policy scoping** | Per `(workflowId, stageId, actionId)` — exactly the row in the master plan | Per stage (every action on the stage uses the same policy); per workflow-only (global policy) |
| Q2 | **Quorum default `requiredCount`** | `2` (created via API; UI exposes the field) | Force user to always specify; default = ceil(approvers / 2) |
| Q3 | **`approvalSequence` shape (mode = SEQUENTIAL)** | `Json` array of `{ kind: 'role' \| 'user', id: string, order: int }` | Separate `ApprovalPolicyStep` table |
| Q4 | **Self-approval** | `allowSelfApproval = false` by default — the user who triggered the action can't be one of the approvers | Default true; force-disabled at UI only |
| Q5 | **Approval rejection semantics** ✅ *signed-off 2026-05-12* | **Match Django: stay in stage on rejection.** Engine marks the instance `REJECTED`, fires `APPROVAL_REJECTED` audit event + plugin hook, returns `{ satisfied: false, decision: 'rejected' }` to the caller. Ticket stays where it is. To move the ticket back, a user must explicitly invoke a separate `REJECT`-behavior action. Verified at `core-prod-scaling/backend/workflows/engine/engines/approval_handler.py:194-239`. | (Earlier default: "fire existing REJECT behavior path" — overruled. Diverged from Django and risked unrecoverable tickets.) |
| Q6 | **`SlaPolicy` cardinality** | `parentStageId @unique` — exactly one SLA policy per stage (matches master plan) | Many-per-stage (priority-tiered); per (stage, priority) |
| Q7 | **`BusinessCalendar` requirement** | Optional on `SlaPolicy.calendarId`. If null, fallback is the seeded `default-24x7` calendar (no holidays, all hours). | Required FK; defer the field until requested |
| Q8 | **Hold pause behavior** | `pauseOnHold = true` by default — when `Ticket.isOnHold = true`, every active timer on that ticket pauses, accumulating into `totalPausedSec` on UNHOLD. | Always pause regardless of policy field; never pause |
| Q9 | **Threshold notification channel** | **In-app** only in Phase 3 — `SlaTimerEvent` rows are emitted; the frontend polls `/api/tickets/:id/sla` to surface them. Email/Slack is wired in later. | Email-via-Sendgrid in Phase 3; in-app + email |
| Q10 | **Async-task infrastructure** | **BullMQ + Redis** (master plan default) — gives us delayed/recurring jobs, retries, observability via Bull Board | `node-cron` + in-process timers (no Redis dep, but no retries/backoff/DLQ); pg-boss (Postgres-as-queue) |
| Q11 | **Cron architecture** ✅ *signed-off 2026-05-12* | **Single combined sweep every 15 min.** One `checkSlaTimers` job does thresholds → escalation-ticket transitions → breaches in one run. Mirrors Django's `workflows/engine/services/sla_scheduler.py:28-54` (`check_sla_timers()` calls `check_sla_thresholds()`, `_trigger_sla_workflow_transitions()`, and `check_sla_breaches()` in sequence). | (Earlier default: 3 separate jobs at 5/15/30 min — overruled. Combined is simpler and proven.) |
| Q12 | **Cron sweep vs delayed jobs** | **Cron-sweep both** thresholds and breaches. Predictable, easy to debug, idempotent. The sweeps are short (1 SQL each thanks to a single `WHERE` over `SlaTimer`). | Schedule a delayed BullMQ job per threshold per timer at create time (more queue traffic; more accurate firing time) |
| Q13 | **Threshold-driven stage transition** ✅ *signed-off 2026-05-12* | **Match Django: spawn a separate escalation ticket on `SlaPolicy.escalationWorkflowId`; the threshold cron only advances *that* child ticket, never the parent.** When the parent ticket enters an SLA-tracked stage AND `escalationWorkflowId` is set, the engine raises a child ticket against that workflow and stores its id on `SlaTimer.escalationTicketId`. When a threshold fires, `_advance_sla_ticket` (Django: `sla_scheduler.py:140-201`) moves *the escalation ticket* to `SlaThreshold.targetSlaStageId`. The parent ticket is never auto-moved by SLA cron. | (Earlier default: "transition the ticket to that stage" — ambiguous and would have moved the parent. Overruled because Django explicitly isolates escalation behavior to a separate child ticket.) |
| Q14 | **Audit / signature hooks** | Phase 3 calls `emitAuditEvent(tx, ctx, eventType, data, user)` (Phase 2 noop) at: approval started / decided / cancelled, timer started / paused / resumed / threshold-fired / breached / completed. Phase 4 implements the body — no Phase 3 changes needed. | Skip the hook; Phase 4 retro-edits all call sites |
| Q15 | **Permission keys** | New: `approval.read`, `approval.decide`, `approval.policy.read/create/update/delete`, `sla.policy.read/create/update/delete`, `sla.timer.read`, `sla.timer.extend`, `sla.timer.extend.approve`, `business-calendar.read/create/update/delete`. Granted to `SUPER_ADMIN`, `QMS_ADMIN` by default; `QUALITY_ENGINEER` gets read + decide + extend. | Reuse existing `workflow.update` for policy CRUD (less granular but fewer keys) |
| Q16 | **Approval state on `ParallelBranchTracking`** | Each branch independently honors its own per-action policies. A join's "first/all branches complete" semantics are unchanged. | Per-fork approval (block the join until all branches' approvals settle) |
| Q17 | **`SlaPolicy.responsibleRoles`/`responsibleUsers`** | Stored but not yet enforced in Phase 3 — used only for notification routing in `SlaThreshold.notify*`. Future phases use them for assignment / ownership. | Enforce in `access.layer` (only responsibles can move the ticket) |
| Q18 | **Sample seed** | Add an `ApprovalPolicy` (mode = `ALL_REQUIRED`, 2 approvers from `QUALITY_ENGINEER` role) on the **Review** stage of the seeded "Document Review v1" workflow + a 4-hour `SlaPolicy` on the **Submit** stage with one 75% threshold. The seed also adds the `default-24x7` `BusinessCalendar`. | Skip seed — leave admins to author manually |

---

## 3. Schema Changes

> 🟡 **Note 2026-05-12:** The blocks below show the **as-originally-drafted** schema. The actually-shipped schema diverges per the Django-alignment revision in §3a. Specifically:
> - `ApprovalInstanceStatus` adds `SATISFIED`/`EXPIRED`/`INVALIDATED`, removes `APPROVED`
> - `SlaTimerStatus`: `ACTIVE → RUNNING`, adds `EXTENDED`
> - `SlaEventType`: `THRESHOLD_FIRED → THRESHOLD_HIT`, adds `SLA_TRANSITION` + `COMPLETED_LATE`
> - `ApprovalPolicy.isActive` field added
> - `ApprovalInstance` adds `currentSequenceOrder`, `invalidatedAt`, `invalidatedReason`
> - `ApprovalRecord` adds `approvedAsRoleId`, `sequenceOrder`, `stageSignatureId`
> - `SlaPolicy.escalationWorkflowId` added (FK to Workflow)
> - `SlaThreshold.name` added; `percentage` → `Float`; unique on `(policy, name)`
> - `SlaTimer` reworked: dropped `totalPausedSec/lastFiredPercentage/pausedAt/resumedAt`; added `elapsedBeforePauseSec/lastResumedAt/totalExtensionsSec/extensionCount/escalationTicketId`
> - `SlaTimerEvent` adds `thresholdName/thresholdPercentage/extensionAmountSec/newDeadline/triggeredById`
>
> **The authoritative schema lives at `backend/prisma/schema.prisma`** (search for `// Phase 3 — Approvals + SLA`). The diff blocks below preserve the original master-plan-derived design for historical reference. Future edits to §3 should match the schema file or be reflected in §3a.

### 3.1 New Prisma Enums (6)

```prisma
enum ApprovalMode {
  SINGLE          // existing behavior — no intercept (used as the "off" state of a row)
  ALL_REQUIRED    // every approver in the set must approve
  QUORUM          // any `requiredCount` of the set must approve
  SEQUENTIAL      // approvers act in `approvalSequence` order
  ANY             // any single approver suffices
}

enum ApprovalInstanceStatus { PENDING APPROVED REJECTED CANCELLED }
enum ApprovalDecision        { APPROVED REJECTED }

enum SlaTimerStatus {
  ACTIVE       // counting down
  PAUSED       // hold or pending extension; deadline frozen
  COMPLETED    // stage exited cleanly
  BREACHED     // deadline passed without exit
}

enum SlaEventType {
  STARTED
  PAUSED
  RESUMED
  THRESHOLD_FIRED
  EXTENDED
  COMPLETED
  BREACHED
}

enum ExtensionStatus { PENDING APPROVED REJECTED }
```

### 3.2 New Models (9)

#### Approvals (3 tables)

```prisma
model ApprovalPolicy {
  id                     String   @id @default(uuid())
  workflowId             String
  workflow               Workflow @relation("WorkflowApprovalPolicies", fields: [workflowId], references: [id], onDelete: Cascade)
  stageId                String
  stage                  WorkflowStage @relation("StageApprovalPolicies", fields: [stageId], references: [id], onDelete: Cascade)
  actionId               String
  action                 WorkflowStageAction @relation("ActionApprovalPolicies", fields: [actionId], references: [id], onDelete: Cascade)

  mode                   ApprovalMode
  requiredCount          Int       @default(1)
  strictRoleMatch        Boolean   @default(false)
  allowSelfApproval      Boolean   @default(false)
  requireUniqueApprovers Boolean   @default(true)
  approvalSequence       Json?     // [{ kind: 'role'|'user', id, order }]
  approvalSlaHours       Int?      // per-instance SLA; if breached → instance status = REJECTED + audit event

  approverRoles          Role[]    @relation("ApprovalPolicyApproverRoles")
  approverUsers          User[]    @relation("ApprovalPolicyApproverUsers")

  instances              ApprovalInstance[]

  isDeleted Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([stageId, actionId])      // 1:1 — one policy per (stage, action)
  @@index([workflowId])
}

model ApprovalInstance {
  id          String   @id @default(uuid())
  ticketId    String
  ticket      Ticket   @relation("TicketApprovalInstances", fields: [ticketId], references: [id], onDelete: Cascade)
  policyId    String
  policy      ApprovalPolicy @relation(fields: [policyId], references: [id], onDelete: Restrict)
  triggeringActionId String?    // snapshot of which action the user invoked
  triggeringAction   WorkflowStageAction? @relation("ActionTriggeringInstances", fields: [triggeringActionId], references: [id], onDelete: SetNull)

  status      ApprovalInstanceStatus @default(PENDING)
  startedAt   DateTime @default(now())
  completedAt DateTime?
  deadlineAt  DateTime?              // computed from policy.approvalSlaHours

  records     ApprovalRecord[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([ticketId, status])
  @@index([policyId, status])
  @@index([deadlineAt])
}

model ApprovalRecord {
  id          String   @id @default(uuid())
  instanceId  String
  instance    ApprovalInstance @relation(fields: [instanceId], references: [id], onDelete: Cascade)
  approverId  String
  approver    User     @relation("UserApprovalRecords", fields: [approverId], references: [id], onDelete: Restrict)

  decision    ApprovalDecision
  comment     String?
  decidedAt   DateTime @default(now())

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([instanceId, approverId])
  @@index([instanceId])
}
```

#### SLA (6 tables)

```prisma
model BusinessCalendar {
  id              String  @id @default(uuid())
  name            String  @unique
  timezone        String  @default("Asia/Kolkata")
  weeklySchedule  Json    // { mon: { start: "09:00", end: "18:00" }, tue: {...}, ..., sun: null }
  holidays        Json    // ["2026-01-26", "2026-08-15", ...]
  isActive        Boolean @default(true)
  isDeleted       Boolean @default(false)

  policies        SlaPolicy[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model SlaPolicy {
  id                     String   @id @default(uuid())
  parentStageId          String   @unique
  parentStage            WorkflowStage @relation("StageSlaPolicy", fields: [parentStageId], references: [id], onDelete: Cascade)

  duration               Int                            // seconds
  calendarId             String?
  calendar               BusinessCalendar? @relation(fields: [calendarId], references: [id], onDelete: SetNull)

  pauseOnHold            Boolean @default(true)
  pauseOnExtensionPending Boolean @default(false)

  responsibleRoles       Role[]   @relation("SlaPolicyResponsibleRoles")
  responsibleUsers       User[]   @relation("SlaPolicyResponsibleUsers")

  thresholds             SlaThreshold[]
  timers                 SlaTimer[]

  isDeleted Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([calendarId])
}

model SlaThreshold {
  id              String   @id @default(uuid())
  policyId        String
  policy          SlaPolicy @relation(fields: [policyId], references: [id], onDelete: Cascade)
  percentage      Int                       // 0-100
  targetSlaStageId String?
  targetSlaStage  WorkflowStage? @relation("SlaThresholdTargetStage", fields: [targetSlaStageId], references: [id], onDelete: SetNull)
  notifyRoles     Role[]   @relation("SlaThresholdNotifyRoles")
  notifyUsers     User[]   @relation("SlaThresholdNotifyUsers")

  events          SlaTimerEvent[] @relation("ThresholdFireEvents")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([policyId, percentage])
}

model SlaTimer {
  id              String   @id @default(uuid())
  ticketId        String
  ticket          Ticket   @relation("TicketSlaTimers", fields: [ticketId], references: [id], onDelete: Cascade)
  stageId         String
  stage           WorkflowStage @relation("StageSlaTimers", fields: [stageId], references: [id], onDelete: Cascade)
  policyId        String
  policy          SlaPolicy @relation(fields: [policyId], references: [id], onDelete: Restrict)

  status          SlaTimerStatus @default(ACTIVE)
  startedAt       DateTime @default(now())
  pausedAt        DateTime?
  resumedAt       DateTime?
  deadline        DateTime           // recomputed on each pause/resume
  completedAt     DateTime?
  totalPausedSec  Int      @default(0)

  // last-fired-threshold tracker so the cron sweep doesn't re-fire
  lastFiredPercentage Int?

  events          SlaTimerEvent[]
  extensions      SlaExtension[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([status, deadline])
  @@index([ticketId, status])
  @@index([stageId, status])
}

model SlaTimerEvent {
  id          String   @id @default(uuid())
  timerId     String
  timer       SlaTimer @relation(fields: [timerId], references: [id], onDelete: Cascade)
  eventType   SlaEventType
  thresholdId String?
  threshold   SlaThreshold? @relation("ThresholdFireEvents", fields: [thresholdId], references: [id], onDelete: SetNull)
  eventData   Json?    // { firedAtPercentage, elapsedSec, deadlineDelta, ... } — shape per eventType
  occurredAt  DateTime @default(now())

  createdAt DateTime @default(now())

  @@index([timerId, occurredAt])
}

model SlaExtension {
  id              String   @id @default(uuid())
  timerId         String
  timer           SlaTimer @relation(fields: [timerId], references: [id], onDelete: Cascade)

  requestedById   String
  requestedBy     User     @relation("SlaExtensionRequestedBy", fields: [requestedById], references: [id], onDelete: Restrict)

  approverId      String?
  approver        User?    @relation("SlaExtensionApprover", fields: [approverId], references: [id], onDelete: SetNull)

  status          ExtensionStatus @default(PENDING)
  reason          String
  extensionSec    Int                                // how much to push the deadline by, on approval
  decidedAt       DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([timerId, status])
}
```

### 3.3 Models Modified (back-relations only)

| Model | Add |
|---|---|
| `Workflow` | `approvalPolicies ApprovalPolicy[] @relation("WorkflowApprovalPolicies")` |
| `WorkflowStage` | `approvalPolicies ApprovalPolicy[] @relation("StageApprovalPolicies")`, `slaPolicy SlaPolicy? @relation("StageSlaPolicy")`, `slaTimers SlaTimer[] @relation("StageSlaTimers")`, `slaThresholdTargets SlaThreshold[] @relation("SlaThresholdTargetStage")` |
| `WorkflowStageAction` | `approvalPolicies ApprovalPolicy[] @relation("ActionApprovalPolicies")`, `triggeredApprovalInstances ApprovalInstance[] @relation("ActionTriggeringInstances")` |
| `Ticket` | `approvalInstances ApprovalInstance[] @relation("TicketApprovalInstances")`, `slaTimers SlaTimer[] @relation("TicketSlaTimers")` |
| `User` | `approvalRecords ApprovalRecord[] @relation("UserApprovalRecords")`, `slaExtensionsRequested SlaExtension[] @relation("SlaExtensionRequestedBy")`, `slaExtensionsApproved SlaExtension[] @relation("SlaExtensionApprover")` |
| `Role` | `approvalPolicyApprovers ApprovalPolicy[] @relation("ApprovalPolicyApproverRoles")`, `slaPolicyResponsibles SlaPolicy[] @relation("SlaPolicyResponsibleRoles")`, `slaThresholdNotifies SlaThreshold[] @relation("SlaThresholdNotifyRoles")` |

(All inverse-only — no logic changes on Phase 1/2 tables.)

### 3.4 Migration

- Migration A: `backend/prisma/migrations/20260512161347_workflow_phase3_approvals_sla/migration.sql` — initial Phase 3 tables (6 enums, 9 models, 6 m2m join tables, indexes, FKs).
- Migration B: `backend/prisma/migrations/20260512171857_workflow_phase3_django_alignment/migration.sql` — corrective revisions documented in §3a below.
- Applied via `prisma db execute --file …` + `prisma migrate resolve --applied …` (the Neon pooler intermittently dropped `prisma migrate dev`'s shadow-database step with P1017; the diff path is reliable).
- Both migrations are tracked in `_prisma_migrations`; `prisma migrate status` reports "Database schema is up to date".

---

## 3a. Django-alignment Revisions (post-P3.1, 2026-05-12)

After the initial schema landed, the Django reference at `core-prod-scaling/backend/workflows/` was read directly and the verified patterns were back-ported. The diff between my initial schema and Django was substantive enough to warrant a corrective migration. **All changes here are reflected in §3.1–§3.3 above** — this section captures the rationale.

### Sources verified (file:line)

| Claim | Verified at |
|---|---|
| `ApprovalPolicy` fields incl. `strict_role_match`, `is_active`, `approval_sequence` shape | `workflows/models/approval.py:70-143` |
| `ApprovalInstance` status enum (`pending\|satisfied\|rejected\|expired\|invalidated`), `current_sequence_order`, `invalidated_at/reason` | `workflows/models/approval.py:146-185` |
| `ApprovalRecord` has `approved_as_role`, `sequence_order`, `stage_signature` FK; rejection writes record + flips status + fires hook **without moving ticket** | `workflows/models/approval.py:188-258` + `workflows/engine/engines/approval_handler.py:194-239` |
| `SlaPolicy.sla_workflow` FK (the escalation workflow) | `workflows/models/sla_timer.py:70-74` |
| `SlaTimer.sla_ticket` FK (the spawned escalation child); status uses `RUNNING/PAUSED/EXTENDED/COMPLETED/BREACHED`; elapsed tracked via `elapsed_before_pause + last_resumed_at`; `extension_count` + `total_extensions` | `workflows/models/sla_timer.py:131-242` |
| `SlaThreshold` requires `name` field (e.g. 'warning', 'critical'); `(policy, name)` unique | `workflows/models/sla_timer.py:100-126` |
| Threshold sweep advances **only the escalation child** to `target_sla_stage`; parent ticket never auto-moved | `workflows/engine/services/sla_scheduler.py:71-201` |
| `SlaTimerEvent` event types include `THRESHOLD_HIT`, `SLA_TRANSITION`, `COMPLETED_LATE`; threshold state is queried from event rows (no `lastFiredPercentage` column) | `workflows/models/sla_timer.py:250-260` |
| `WorkflowChecklist` is the static form↔stage binding (Phase 3 scope does not touch this) | `workflows/models/workflow.py:332-340` |

### Deltas applied to the schema

| Model | Change | Rationale |
|---|---|---|
| `ApprovalPolicy` | + `isActive Boolean @default(true)` (separate from `isDeleted`) | Django's `is_active` lets you retire a policy without losing instances |
| `ApprovalInstance` | enum: removed `APPROVED`, added `SATISFIED`/`EXPIRED`/`INVALIDATED`; + `currentSequenceOrder Int @default(1)`, `invalidatedAt DateTime?`, `invalidatedReason String?` | Semantic — an instance is "satisfied" (policy mode rules met) not "approved"; `INVALIDATED` lets a policy edit void an in-flight instance |
| `ApprovalRecord` | + `approvedAsRoleId String?` (FK Role), `sequenceOrder Int @default(0)`, `stageSignatureId String?` (placeholder for Phase 4) | Multi-role users — audit trail must record *which* role they acted under; signature link reserved for Phase 4 |
| `SlaPolicy` | + `escalationWorkflowId String?` (FK Workflow) | Required for the spawn-escalation-ticket pattern |
| `SlaThreshold` | + `name String` required; `percentage Float` (was `Int`); unique swapped from `(policy, percentage)` → `(policy, name)` | Names make events queryable through rename of the percentage; Django uses Float for fractional thresholds |
| `SlaTimer` | DROPPED `totalPausedSec`, `lastFiredPercentage`, `pausedAt`, `resumedAt`; ADDED `elapsedBeforePauseSec Int @default(0)`, `lastResumedAt DateTime?`, `totalExtensionsSec Int @default(0)`, `extensionCount Int @default(0)`, `escalationTicketId String?` (FK Ticket); status enum revised to `RUNNING/PAUSED/EXTENDED/COMPLETED/BREACHED` | The elapsed-time model now tracks *working time elapsed* (Django pattern) rather than accumulating paused time. `lastFiredPercentage` was a flawed latch — threshold firing is tracked through `SlaTimerEvent` rows by `thresholdName`. `EXTENDED` is a UI-distinguishable status from plain `RUNNING`. |
| `SlaTimerEvent` | + `thresholdName String?`, `thresholdPercentage Float?` (actual % at fire), `extensionAmountSec Int?`, `newDeadline DateTime?`, `triggeredById String?` (FK User); event types renamed `THRESHOLD_FIRED → THRESHOLD_HIT`, added `SLA_TRANSITION`, `COMPLETED_LATE` | Richer event payload so consumers don't need to JSON-parse `eventData`; `thresholdPercentage` distinguishes "configured 75% / actually fired at 75.3%" |
| Back-relations | Added on `Role.approvalRecordsAsRole`, `User.slaTimerEventsTriggered`, `Workflow.usedAsSlaEscalation`, `Ticket.slaTimersAsEscalation` | Pair with the new FKs |

### Decisions that intentionally diverge from Django

| Area | Phase 3 (this plan) | Django | Why diverge |
|---|---|---|---|
| `SlaExtension` model | Full `requestedBy → admin approve → push deadline` flow with own table, `ExtensionStatus` enum | No model — extensions are direct timer mutations + `EXTENDED` event | Audit posture: QMS needs an approval trail on extension requests |
| `ApprovalInstance.deadlineAt` | Persisted column | Computed at check time from `policy.approval_sla_hours + startedAt` | Lets the BullMQ deadline-cron query indexed column instead of computing per-policy |

### Migration apply log

```
2026-05-12 16:13:47 UTC — workflow_phase3_approvals_sla (initial)
  └─ 6 enums + 9 tables + 6 m2m + indexes + FKs applied via prisma db execute
  └─ resolved as applied via prisma migrate resolve --applied
  └─ seed populated: 2 BusinessCalendars + 1 SlaPolicy + 1 SlaThreshold + 1 ApprovalPolicy

2026-05-12 17:18:57 UTC — workflow_phase3_django_alignment (revisions)
  └─ 3 AlterEnum (status/event renames + new values via _new shadow type pattern)
  └─ 7 AlterTable (additions + drops)
  └─ 4 CreateIndex + 1 DropIndex + 4 AddForeignKey
  └─ Backfilled existing SlaThreshold row with name='warning' via temp DEFAULT then DROP DEFAULT
  └─ resolved as applied; tsc clean; client regenerated
```

---

## 4. Engine Architecture

### 4.1 Approval intercept

Insert in `engine/orchestrator.ts:performAction`, after `access.layer` validates the user but **before** `transition.layer` mutates `currentStages`:

```ts
// Pseudocode
const policy = await approvalLayer.getPolicy(tx, stageId, actionId);
if (policy && policy.mode !== 'SINGLE') {
  const instance = await approvalLayer.ensureInstance(tx, ticket, policy, triggeringActionId);
  await approvalLayer.recordDecision(tx, instance, user, payload.decision, payload.comment);

  // ── Rejection path: ticket STAYS in stage (Django-aligned, Q5 signed-off) ──
  if (decision === 'rejected') {
    await approvalLayer.recordDecision(tx, instance, user, 'rejected', comment);
    instance.status = 'REJECTED';
    await tx.approvalInstance.update({ where: { id: instance.id }, data: { status: 'REJECTED' } });
    await emitAuditEvent(tx, ctx, 'APPROVAL_REJECTED', { policy_mode: policy.mode, reason: comment, ... });
    await runPluginHook('APPROVAL_REJECTED', { ticket, stage, action, instance, user });
    return {
      status: 'rejected',
      instanceId: instance.id,
      message: 'Approval rejected. Ticket remains in current stage.',
    };
    // NOTE: ticket is NOT moved. To advance/walk back, the caller must invoke
    // a separate REJECT-behavior action.
  }

  // ── Approval path: record decision, check satisfaction ─────────────────
  await approvalLayer.recordDecision(tx, instance, user, 'approved', comment);

  if (!approvalLayer.isPolicySatisfied(instance, policy)) {
    await emitAuditEvent(tx, ctx, 'APPROVAL_DECISION_RECORDED', { ... });
    return {
      status: 'pending_approval',
      instanceId: instance.id,
      remaining: approvalLayer.getRemainingApprovers(instance, policy),
    };
  }

  await approvalLayer.markInstanceSatisfied(tx, instance);
  // Fall through to the existing transition logic.
}
```

Key points:
- **One policy per (stage, action)** (enforced by `@@unique`).
- The first call to `performAction` with a policy creates the `ApprovalInstance`; subsequent calls record additional `ApprovalRecord`s against that instance.
- **Rejection does NOT auto-move the ticket** (verified at `core-prod-scaling/backend/workflows/engine/engines/approval_handler.py:194-239`). The engine writes a `REJECTED` record, flips the instance status, fires `APPROVAL_REJECTED` audit + hook, and returns. To recover/move the ticket the user must explicitly invoke a `REJECT`-behavior action via the existing Phase-2 path.
- Instance status nomenclature follows Django: pending → **`SATISFIED`** (policy met) / `REJECTED` / `EXPIRED` (deadline cron) / `INVALIDATED` (policy edit mid-flow) / `CANCELLED` (external).
- All approval mutations live inside the same `prisma.$transaction` as the action — atomicity preserved.

### 4.2 SLA handler hooks

`engine/sla.handler.ts` is a thin shim called from existing engine touch-points. Hooks **now also spawn an escalation child ticket** when the policy has `escalationWorkflowId` set (Q13 signed-off):

| Hook (existing in Phase 2) | New behavior |
|---|---|
| `tracking.layer.openStageTracking` | Look up `SlaPolicy` on the entered stage. If present: (1) create `SlaTimer` with `deadline = computeDeadline(now, policy.duration, policy.calendar)` and `lastResumedAt = now()`, status `RUNNING`. (2) If `policy.escalationWorkflowId` is set, raise a child `Ticket` against that workflow via `orchestrator.raiseTicket` (linked back via `Ticket.parentTicketId`), store its id on `SlaTimer.escalationTicketId`. (3) Emit `STARTED` event. |
| `tracking.layer.closeStageTracking` | Find timers for `(ticketId, stageId)` with status in `RUNNING/PAUSED/EXTENDED`. Compute final `elapsedTime`; set `completedAt = now()`. If deadline was already past → status `BREACHED` + `COMPLETED_LATE` event. Else → status `COMPLETED` + `COMPLETED` event. Settle the escalation ticket if open (transition it to a terminal stage). |
| `orchestrator.holdTicket` | For each `RUNNING`/`EXTENDED` timer on the ticket where `policy.pauseOnHold = true`: accumulate `elapsedBeforePauseSec += (now - lastResumedAt)`, set `status = PAUSED`, clear `lastResumedAt`, emit `PAUSED`. |
| `orchestrator.resumeTicket` | Reverse: set `status = RUNNING` (or `EXTENDED` if `extensionCount > 0`), `lastResumedAt = now()`. **Do NOT touch deadline** — the elapsed-time model already accounts for paused periods because we only count time while running. Emit `RESUMED`. |

Design constraint: **no new transactional surface** — every SLA mutation rides on the engine's existing transactions. The escalation child ticket is raised inside the same tx as the parent's stage entry so they're atomic.

### 4.2a Elapsed-time computation (Django-aligned)

Pure read-side helper:

```ts
function computeElapsedSec(timer: SlaTimer, now: Date = new Date()): number {
  // Frozen for terminal statuses.
  if (timer.status === 'COMPLETED' || timer.status === 'BREACHED') {
    return timer.elapsedBeforePauseSec;
  }
  // Paused — no current running period.
  if (timer.status === 'PAUSED' || !timer.lastResumedAt) {
    return timer.elapsedBeforePauseSec;
  }
  // Running / Extended — accumulated + current running period.
  const currentPeriodSec = Math.floor((now.getTime() - timer.lastResumedAt.getTime()) / 1000);
  return timer.elapsedBeforePauseSec + currentPeriodSec;
}

function computePercentageConsumed(timer: SlaTimer & { policy: SlaPolicy }, now?: Date): number {
  const totalAllowedSec = timer.policy.duration + timer.totalExtensionsSec;
  if (totalAllowedSec === 0) return 100;
  return (computeElapsedSec(timer, now) / totalAllowedSec) * 100;
}
```

Cron sweep calls `computePercentageConsumed` against active timers and compares to each threshold's `percentage`; misses are caught up on the next run because `SlaTimerEvent` rows latch by `(timer, threshold_name)`.

### 4.3 Business-calendar arithmetic

`engine/calendar.ts` exports two functions:

```ts
// Adds `seconds` of business time to `from`, respecting weekly schedule + holidays.
addBusinessSeconds(from: Date, seconds: number, calendar: BusinessCalendar | null): Date

// Inverse — given a deadline, returns business seconds elapsed from `from` to now.
elapsedBusinessSeconds(from: Date, until: Date, calendar: BusinessCalendar | null): number
```

If `calendar` is `null`, both fall back to wall-clock (24×7). Implementation is iterative (walk day-by-day) — fine because durations are typically hours/days, never months. Library: `date-fns-tz` (already in `client/`; add to `backend/`).

### 4.4 Approval layer module

`engine/approval.layer.ts`:

- `getPolicy(tx, stageId, actionId)` — single SELECT with relations to approverRoles / approverUsers
- `ensureInstance(tx, ticket, policy, triggeringActionId)` — finds the open `PENDING` instance for `(ticket, policy)` or creates one
- `recordDecision(tx, instance, user, decision, comment)` — upserts `ApprovalRecord` (unique on `(instance, approver)`); blocks on self-approval if `policy.allowSelfApproval = false`; blocks on uniqueness if `policy.requireUniqueApprovers = true`
- `isPolicySatisfied(instance, policy)` — pure function over loaded records:
  - `ANY` → any APPROVED record
  - `SINGLE` → unreachable (intercept skipped)
  - `ALL_REQUIRED` → every required approver has APPROVED
  - `QUORUM` → ≥ `requiredCount` APPROVED
  - `SEQUENTIAL` → records APPROVED in `approvalSequence` order, no skips
- `getRemainingApprovers(instance, policy)` — for the UI's "still waiting on" list
- `markInstanceComplete(tx, instance, status)` — sets `status` + `completedAt`, emits audit event

---

## 5. Async Tasks (BullMQ + Redis)

### 5.1 Stack additions

- **Runtime deps:** `bullmq`, `ioredis`, `date-fns-tz`
- **Env:** `REDIS_URL` (e.g. `redis://localhost:6379` or `rediss://default:...@oregon-redis.render.com:6379`)
- **Render service:** a second worker service running `npm run worker`, sharing the same env

### 5.2 Module layout

```
backend/src/jobs/
├── queue.ts                 // BullMQ Queue + QueueScheduler factories, shared connection
├── sla.scheduler.ts         // SINGLE combined sweep — thresholds + transitions + breaches
├── approval.deadline.checker.ts  // every 30 min — find PENDING instances past `deadlineAt`, mark EXPIRED
├── handlers/
│   ├── threshold.handler.ts // emit SlaTimerEvent(THRESHOLD_HIT), look up active escalation tickets
│   ├── escalation.handler.ts// advance the escalation ticket via TransitionLayer; emit SLA_TRANSITION
│   └── breach.handler.ts    // emit BREACHED event, notify (in-app)
└── worker.ts                // entry point — registers handlers, listens to Redis
```

### 5.3 Cron schedule (Q11 signed-off — single combined sweep)

| Cron | Job | Action |
|---|---|---|
| `*/15 * * * *` | `checkSlaTimers` | **One combined sweep, matches Django's `sla_scheduler.check_sla_timers()`.** In sequence: (1) `checkThresholds` — for each `RUNNING/EXTENDED` timer, compute elapsed%, compare against each `SlaThreshold` not yet in events for `(timer, name)` → write `THRESHOLD_HIT` event. (2) `triggerSlaTransitions` — for each `THRESHOLD_HIT` event without a matching `SLA_TRANSITION`, advance the *escalation* ticket to `threshold.targetSlaStageId` and write `SLA_TRANSITION` event. (3) `checkBreaches` — timers with `deadline ≤ now()` and `status ∈ {RUNNING, EXTENDED}` → flip to `BREACHED`, emit `BREACHED`. |
| `*/30 * * * *` | `checkApprovalDeadlines` | `ApprovalInstance` rows where `status = 'PENDING' AND deadlineAt ≤ now()` → flip status to `EXPIRED`, emit audit event. (Separate from SLA sweep because it touches approvals, not timers.) |

Idempotency:
- Threshold firing latches via `SlaTimerEvent` rows: a `(timer, threshold_name)` already in events for `event_type = THRESHOLD_HIT` is skipped.
- Auto-transition latches via `(timer, threshold_name)` not yet in `event_type = SLA_TRANSITION`.
- Breach latches via terminal status (timer no longer `RUNNING/EXTENDED`).

### 5.4 Auto-transition on threshold (Q13 signed-off — escalation ticket only)

When a `THRESHOLD_HIT` event has no corresponding `SLA_TRANSITION` event AND the threshold's `targetSlaStageId` is set:

1. Resolve `SlaTimer.escalationTicketId` — if null, skip (notification-only threshold).
2. Lock the timer row via `SELECT FOR UPDATE` so concurrent sweeps don't race.
3. Move the escalation ticket through `TransitionLayer.exitStage` + `TransitionLayer.enterStages` (not the full orchestrator — avoids recursion since the escalation workflow itself may have SLA on its stages).
4. Write `SLA_TRANSITION` `SlaTimerEvent` row with the `threshold_name`.
5. **The parent ticket is NEVER touched.** Mirrors Django's `_advance_sla_ticket()` (`workflows/engine/services/sla_scheduler.py:140-201`).

If `Sla​Threshold.targetSlaStageId` is **null** OR `SlaTimer.escalationTicketId` is **null**, the threshold simply fires its event for notification routing (`SlaThreshold.notifyRoles`/`notifyUsers`). No transition occurs anywhere.

---

## 6. API Surface

### 6.1 Approvals

```
GET    /api/workflows/:id/approval-policies
POST   /api/workflows/:id/approval-policies
PATCH  /api/approval-policies/:id
DELETE /api/approval-policies/:id

GET    /api/tickets/:id/approvals                     // list this ticket's instances
GET    /api/approvals/:instanceId                     // one instance + records
POST   /api/approvals/:instanceId/decide              // body: { decision, comment }
```

### 6.2 SLA policies + thresholds

```
GET    /api/workflows/:id/sla-policies
POST   /api/sla-policies                              // create (body has stageId)
PATCH  /api/sla-policies/:id
DELETE /api/sla-policies/:id

POST   /api/sla-policies/:id/thresholds               // batch upsert thresholds
DELETE /api/sla-thresholds/:id
```

### 6.3 SLA timers + extensions

```
GET    /api/sla/timers?status=ACTIVE&workflowId=...   // dashboard query
GET    /api/tickets/:id/sla                           // ticket-page summary (active timer, events)
POST   /api/sla/timers/:id/extend                     // body: { extensionSec, reason }
POST   /api/sla/extensions/:id/decide                 // body: { decision }   (admin-only)
```

### 6.4 Business calendars

```
GET    /api/business-calendars
POST   /api/business-calendars
PATCH  /api/business-calendars/:id
DELETE /api/business-calendars/:id
```

### 6.5 Engine integration

Existing `POST /api/tickets/:id/actions/:actionId/perform` gains:

- New response shape when policy intercept fires:
  ```json
  {
    "status": "pending_approval",
    "instanceId": "...",
    "remaining": { "roles": [...], "users": [...] }
  }
  ```
- New body field `approvalDecision` (when called by an approver against an existing pending instance): `'APPROVED' | 'REJECTED'` plus `approvalComment`.

The frontend currently expects `{ status: 'ok', ... }`; this is an additive change.

---

## 7. Sample Seed Data

`backend/prisma/seed.ts` adds (idempotent upserts):

1. `BusinessCalendar` named `default-24x7`: weeklySchedule 09:00–18:00 Mon–Fri, holidays = [].
2. `BusinessCalendar` named `support-24x7`: every day 00:00–24:00, holidays = [].
3. `SlaPolicy` on the **Submit** stage of the seeded Document Review workflow: duration = 4 hours (14400s), calendar = `default-24x7`, one threshold at 75% notifying `QUALITY_ENGINEER` role.
4. `ApprovalPolicy` on the **Review** stage's "Approve / Forward" action: mode = `ALL_REQUIRED`, approverRoles = `[QUALITY_ENGINEER]`, `requiredCount = 2`, `allowSelfApproval = false`, `approvalSlaHours = 24`.

This gives the frontend a real workflow to demo: raise a ticket → SLA timer ticks on Submit → forward → at Review, two QEs must approve before it moves on.

---

## 8. Permissions

New keys (added to seed.ts):

| Key | Granted to |
|---|---|
| `approval.read` | SUPER_ADMIN, QMS_ADMIN, QUALITY_ENGINEER, AUDITOR, READ_ONLY |
| `approval.decide` | SUPER_ADMIN, QMS_ADMIN, QUALITY_ENGINEER |
| `approval.policy.read` | All roles |
| `approval.policy.create / update / delete` | SUPER_ADMIN, QMS_ADMIN |
| `sla.policy.read` | All roles |
| `sla.policy.create / update / delete` | SUPER_ADMIN, QMS_ADMIN |
| `sla.timer.read` | All roles |
| `sla.timer.extend` | SUPER_ADMIN, QMS_ADMIN, QUALITY_ENGINEER |
| `sla.timer.extend.approve` | SUPER_ADMIN, QMS_ADMIN |
| `business-calendar.read` | All roles |
| `business-calendar.create / update / delete` | SUPER_ADMIN, QMS_ADMIN |

(`access.layer` already gates action invocation; approvals add a second check via `approval.decide`.)

---

## 9. Module Layout

```
backend/src/modules/
├── approval/
│   ├── approval.routes.ts         // policies + instances + decide
│   ├── approval.controller.ts
│   ├── approval.service.ts
│   ├── approval.schema.ts         // Zod
│   └── approval.openapi.ts
├── sla/
│   ├── sla.routes.ts              // policies + timers + extensions
│   ├── sla.controller.ts
│   ├── sla.service.ts
│   ├── sla.schema.ts
│   └── sla.openapi.ts
├── business-calendar/
│   └── (CRUD module — same shape as workflow-lookups)
└── workflow/
    └── engine/
        ├── approval.layer.ts      // (new)
        ├── sla.handler.ts         // (new)
        ├── calendar.ts            // (new)
        └── orchestrator.ts        // touched: performAction intercept + systemTransition entry
backend/src/jobs/
├── queue.ts
├── sla.threshold.checker.ts
├── sla.breach.checker.ts
├── approval.deadline.checker.ts
├── handlers/
│   ├── threshold.handler.ts
│   └── breach.handler.ts
└── worker.ts
```

---

## 10. Test Plan

### 10.1 Unit (Vitest, no DB)

- `approval.layer.isPolicySatisfied` — table-driven test for each `ApprovalMode` × edge cases (no records, partial, duplicate user, etc.)
- `engine/calendar.ts` — `addBusinessSeconds` over week boundaries, holidays, timezones (Asia/Kolkata, UTC, America/New_York)

### 10.2 Integration (against seeded DB)

- Approval `ALL_REQUIRED` path: create instance → 1st QE approves (returns `pending_approval`) → 2nd QE approves (transition fires) → ticket moves to next stage
- Approval REJECT path: 1st QE approves, 2nd QE rejects → instance flips to `REJECTED`, `APPROVAL_REJECTED` hook fires, **ticket stays in the Review stage** (per Q5). Caller can then invoke `Reject`-behavior action separately to walk back.
- Approval self-approval block: triggering user tries to approve the same instance → 403
- SLA happy path with escalation: enter stage → timer created, **escalation child ticket spawned on `policy.escalationWorkflowId`**, deadline computed against calendar → exit stage → timer `COMPLETED`, escalation ticket settled
- SLA hold/unhold: timer pauses (`elapsedBeforePauseSec` snapshots elapsed working time), resume re-arms `lastResumedAt`; deadline is NOT mutated — elapsed-time math handles it
- Threshold cron: stub `now()` past 75%, run `checkSlaTimers`, verify `THRESHOLD_HIT` event emitted exactly once across two runs (idempotency via `(timer, threshold_name)` event uniqueness)
- Auto-transition: threshold with `targetSlaStageId` fires → **escalation ticket** advanced via `TransitionLayer.exit/enterStages`, `SLA_TRANSITION` event written. Parent ticket unchanged.
- Breach cron: timer past deadline → status `BREACHED`, `BREACHED` event emitted, idempotent on second run

### 10.3 Concurrency

- Two QEs hit `/decide` simultaneously on the same instance → `@@unique([instanceId, approverId])` ensures exactly-one record per approver, no race
- Hold + threshold-firing race: timer paused mid-cron-sweep — threshold handler checks `status ∈ {RUNNING, EXTENDED}` before firing (skips paused)
- Two cron runs concurrent on the same timer: `SELECT FOR UPDATE` on the timer + idempotency via `SlaTimerEvent` ensures one-and-only-one threshold event per `(timer, threshold_name)`

### 10.4 Frontend smoke (Playwright)

Out of scope for this doc — covered in `WORKFLOW_PHASE_3_FRONTEND_PLAN.md` §9.

---

## 11. Effort Estimate

| Slice | Effort |
|---|---|
| Schema + migration + seed | 1 d |
| Approval layer + module + API | 1.5 d |
| SLA layer + module + calendar arithmetic + API | 2 d |
| BullMQ + worker process + 3 cron sweeps | 1 d |
| Engine integration (`performAction` intercept, `systemTransition`, hooks) | 0.5 d |
| Tests (unit + integration) | 1 d |
| **Total** | **~7 days, ~4,000 LoC** (matches master-plan estimate) |

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| **Redis dep adds infra surface** (Render service, env, monitoring) | Document in `DEPLOY.md`; `node-cron`-fallback sketch included if Redis unavailable; queue-up health-checks in `/health` |
| **Calendar arithmetic correctness** (DST, multi-day weekends, holidays in different TZ) | Pin `date-fns-tz`; unit-test corners; default to Asia/Kolkata to avoid TZ jumps in dev |
| **Threshold firing drift** (cron at 5-min intervals → threshold fires up to 5 min late) | Document in API; thresholds are best-effort; if precise firing matters, switch to per-timer delayed jobs (Q12 alternative) |
| **Concurrent approvals on the same instance** | `@@unique([instanceId, approverId])` + `prisma.$transaction` around `recordDecision` |
| **Threshold-transition cycles** (a stage's threshold transitions to a stage whose threshold transitions back) | Detection in `orchestrator.systemTransition`: refuse to transition if the same `(ticket, threshold)` pair has fired in the last 5 minutes; also surface as an audit event |
| **Worker process drift from API** (different code versions) | Same git SHA on both Render services; `npm run worker` calls into the same `dist/` |

---

## 13. What Phase 4 Inherits

Phase 4 (Audit + E-Signatures) plugs into hooks already wired by Phase 3:

- The `emitAuditEvent` calls inside `approval.layer` and `sla.handler` become real audit-log writes — no Phase 3 code changes.
- `WorkflowStageAction` gains a Phase-4 `requiresSignature: Boolean` field; the engine's existing `access.layer` runs the signature check **before** the approval intercept.
- `SlaTimerEvent` and `ApprovalRecord` rows are referenced by the audit log but live in their existing tables.

---

## 14. Deliverable Checklist

- [ ] Schema migration applied + Prisma client regenerated
- [ ] Seed adds `default-24x7` calendar, sample SLA policy, sample approval policy
- [ ] Approval module + routes + OpenAPI
- [ ] SLA module + routes + OpenAPI
- [ ] Business-calendar module + routes
- [ ] `engine/approval.layer.ts` with all 5 modes covered by unit tests
- [ ] `engine/sla.handler.ts` wired into existing tracking hooks
- [ ] `engine/calendar.ts` with TZ + holiday tests
- [ ] BullMQ worker entry + 3 cron sweeps
- [ ] `npm run worker` script + Render service definition in `render.yaml`
- [ ] Smoke-tested end-to-end: raise ticket → SLA ticks → forward → 2-of-2 approval → next stage
- [ ] `npx tsc --noEmit` clean on backend
- [ ] `npm run build` clean
- [ ] `workflow-changes.md` Phase 3 sections filled in chronologically

---

## 15. Sign-off Status

| Question | Status | Resolution |
|---|---|---|
| Q1–Q4, Q6–Q9, Q12, Q14–Q18 | ✅ accepted defaults | Implemented as drafted |
| **Q5** (rejection semantics) | ✅ **signed-off 2026-05-12** | Match Django — stay in stage on rejection (NOT walk back). See §4.1. |
| **Q10** (BullMQ vs node-cron) | ✅ accepted default | BullMQ + Redis (separate worker process via `npm run worker`) |
| **Q11** (cron architecture) | ✅ **signed-off 2026-05-12** | Single combined 15-min `checkSlaTimers` sweep (overrules earlier 3-job split) |
| **Q13** (threshold-driven transitions) | ✅ **signed-off 2026-05-12** | Match Django — spawn separate escalation child ticket; threshold cron only advances the child, never the parent. See §4.2, §5.4, and the `SlaPolicy.escalationWorkflowId` + `SlaTimer.escalationTicketId` fields. |

All §2 decisions are now closed. P3.2+ proceeds against the schema currently in `backend/prisma/schema.prisma` (Migration A + B applied).
