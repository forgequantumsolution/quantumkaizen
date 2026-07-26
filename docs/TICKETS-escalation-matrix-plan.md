# Tickets — Escalation Matrix Implementation Plan

**Status:** Draft · **Owner:** _TBD_ · **Date:** 2026-07-24

## 1. Goal

Automatically hand a ticket to someone else in the department when:

1. **SLA time is crossed** — a stage's SLA threshold is hit or the SLA is breached, or
2. **The current assignee is unavailable** — out-of-office / on-leave, either at assignment time or when they mark themselves out mid-work.

Escalation follows an ordered **ladder** per department: **assignee's manager → department head**, skipping anyone who is unavailable (falling through to their delegate / manager). Every hand-off is audited and the new assignee is notified.

## 2. What already exists (reuse, don't rebuild)

| Capability | Where | Reuse |
| --- | --- | --- |
| SLA timers, deadlines, business-calendar math | `backend/prisma/schema.prisma` (models `SlaPolicy`, `SlaThreshold`, `SlaTimer`, `SlaTimerEvent`), `workflow/engine/sla.handler.ts`, `workflow/engine/calendar.ts` | SLA **timing** is the trigger source — do not duplicate. |
| SLA sweep cron (thresholds, transitions, breaches) with `SELECT FOR UPDATE` locking + event-latch idempotency | `backend/src/jobs/sweeps/checkSlaTimers.ts`, scheduled in `backend/src/jobs/worker.ts` (BullMQ + Redis, `SLA_SWEEP_CRON` default 15 min) | Add a **4th step** here for reassignment. |
| Manager hierarchy | `User.managerId` self-relation (`"UserManager"`, with `reports`) | Escalation target `MANAGER`. |
| Department head | `Department.headUserId` (`"DepartmentHead"`) | Escalation target `DEPARTMENT_HEAD`. |
| Admin matrix-grid UI precedent | `client/src/features/admin/access-control/AccessMatrix.tsx` | Model for the escalation-matrix config tab. |
| Local notification store + panel (unfed) | `client/src/stores/notificationStore.ts`, `components/shared/NotificationPanel.tsx` (has `TASK_ASSIGNED` type) | Wire to a new backend `/notifications` endpoint. |

### Gaps this plan fills
- **No assignee field** — tickets have no `assigneeId`; "assignment" is implicit via workflow-stage role/user access (`workflow/engine/access.layer.ts`). Must introduce a real assignee.
- **No availability model** — `User` has only `isActive`. Add out-of-office windows + delegate.
- **No notification delivery** — `SlaThreshold.notifyUsers/Roles` are stored but never sent; frontend store has no backend feed. Add a minimal persisted `Notification` + API.

> **Naming note:** the existing `SlaPolicy.escalationWorkflowId` "escalation" spawns a **child ticket** on a separate workflow and never moves the parent (see `Q13` comments in `checkSlaTimers.ts:8` and `schema.prisma:1389-1394`). This feature is a **different** semantic — reassigning the parent ticket. Keep the two separate; do not overload the child-ticket path.

## 3. Design decisions (confirmed)

- **SLA trigger:** reuse existing SLA thresholds/breach — escalation levels map to SLA `%` thresholds, no separate escalation clock.
- **Availability:** out-of-office **windows** (`from`/`to`) + optional **delegate**, not a simple on/off flag.
- **Escalation targets:** **Department head** and **Manager chain** only (no round-robin, no per-rule named users in v1).

## 4. Data model (`backend/prisma/schema.prisma`)

```prisma
model Ticket {
  // ...existing fields...
  assigneeId       String?
  assignee         User?    @relation("TicketAssignee", fields: [assigneeId], references: [id], onDelete: SetNull)
  escalationLevel  Int      @default(0)   // 0 = original owner, 1..N = ladder position
  escalationEvents EscalationEvent[]
  @@index([assigneeId])
}

model UserAvailability {
  id           String    @id @default(uuid())
  userId       String
  user         User      @relation("UserAvailability", fields: [userId], references: [id], onDelete: Cascade)
  from         DateTime
  to           DateTime
  reason       String?
  delegateToId String?
  delegateTo   User?     @relation("UserDelegate", fields: [delegateToId], references: [id], onDelete: SetNull)
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  @@index([userId, from, to])
}

model EscalationRule {
  id           String            @id @default(uuid())
  departmentId String?           // null = global default rule
  department   Department?       @relation(fields: [departmentId], references: [id], onDelete: Cascade)
  isActive     Boolean           @default(true)
  levels       EscalationLevel[]
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt
  @@unique([departmentId])       // one rule per department (+ one global)
  @@index([departmentId])
}

model EscalationLevel {
  id              String           @id @default(uuid())
  ruleId          String
  rule            EscalationRule   @relation(fields: [ruleId], references: [id], onDelete: Cascade)
  order           Int              // 1, 2, 3...
  target          EscalationTarget // MANAGER | DEPARTMENT_HEAD
  atThresholdName String?          // SLA threshold name that fires this level; null = fire on breach
  @@unique([ruleId, order])
}

model EscalationEvent {
  id         String           @id @default(uuid())
  ticketId   String
  ticket     Ticket           @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  fromUserId String?
  fromUser   User?            @relation("EscalationFrom", fields: [fromUserId], references: [id], onDelete: SetNull)
  toUserId   String?
  toUser     User?            @relation("EscalationTo",   fields: [toUserId],   references: [id], onDelete: SetNull)
  reason     EscalationReason // SLA_THRESHOLD | SLA_BREACH | ASSIGNEE_UNAVAILABLE
  levelOrder Int
  detail     String?
  createdAt  DateTime         @default(now())
  @@index([ticketId, levelOrder])   // idempotency latch: one event per (ticket, level)
}

enum EscalationTarget { MANAGER DEPARTMENT_HEAD }
enum EscalationReason { SLA_THRESHOLD SLA_BREACH ASSIGNEE_UNAVAILABLE }
```

Add `User` back-relations: `assignedTickets Ticket[] @relation("TicketAssignee")`, `availability UserAvailability[] @relation("UserAvailability")`, `delegateFor UserAvailability[] @relation("UserDelegate")`, `escalationsFrom EscalationEvent[] @relation("EscalationFrom")`, `escalationsTo EscalationEvent[] @relation("EscalationTo")`.

Migration: additive only (all new/nullable) — safe against `kaizen_qms2`. Never target legacy `quantumkaizen`.

## 5. Backend logic

### 5.1 Shared resolver — `backend/src/modules/escalation/resolveTarget.ts`
- `isAvailable(userId, at): Promise<boolean>` — false if any `UserAvailability` window covers `at`.
- `resolveNextAssignee(ticket, levelOrder): Promise<{ toUserId, levelOrder } | null>`
  - Look up department's `EscalationRule` → fall back to the global rule.
  - Take the level's `target`: `MANAGER` → current assignee's `managerId`; `DEPARTMENT_HEAD` → `ticket.department.headUserId`.
  - If the target is unavailable, follow `delegateTo`, then `managerId`, until an available user is found (cap the walk depth to avoid cycles).
  - Return `null` if no target resolvable (log, leave ticket in place).

### 5.2 SLA-crossing trigger — extend `checkSlaTimers.ts`
- Add step 4 `applyEscalations()`, called after `checkBreaches` in `checkSlaTimers()`.
- For each timer with a fresh `THRESHOLD_HIT` (match `EscalationLevel.atThresholdName`) or `BREACHED` (levels with `atThresholdName = null`):
  - Skip if an `EscalationEvent` already exists at that `(ticketId, levelOrder)` — the idempotency latch, mirroring the `SLA_TRANSITION` check in step 2.
  - `resolveNextAssignee` → update `Ticket.assigneeId`, bump `escalationLevel`, write `EscalationEvent` (reason `SLA_THRESHOLD` / `SLA_BREACH`), enqueue notification — all inside the per-timer `SELECT FOR UPDATE` transaction.
- Extend `SweepResult` with `escalationsApplied`.

### 5.3 Unavailability trigger
- **At assign time:** wherever `assigneeId` is first set (ticket raise / stage entry in `ticket.service.ts` / workflow engine), if the resolved assignee is unavailable, immediately walk the ladder (reason `ASSIGNEE_UNAVAILABLE`).
- **On availability change:** when a `UserAvailability` window covering *now* is created, sweep that user's open `assignedTickets` and reassign via the resolver.

### 5.4 New module — `backend/src/modules/escalation/`
Flat convention (`*.controller.ts / *.routes.ts / *.service.ts / *.schema.ts / *.openapi.ts`):
- `EscalationRule` + `EscalationLevel` CRUD (admin-guarded).
- `GET /tickets/:id/escalations` (audit trail for the detail page).
- `UserAvailability` CRUD — add to the existing `user` module (`GET/POST/DELETE /users/:id/availability`, self-service + admin).

### 5.5 Assignment surface — extend `ticket` module
- `PATCH /tickets/:id/assign` `{ assigneeId }` — manual (re)assignment, writes an `EscalationEvent` with `reason` omitted/manual, respects availability. **Preserves `escalationLevel`** (does not reset — see §9.3).
- Include `assignee` in `TicketSummary` / `TicketDetail`.

## 6. Notifications (new, minimal)
- `Notification` model: `userId`, `type` (`TASK_ASSIGNED` | `OVERDUE` | `SYSTEM`...), `title`, `body`, `entityType`, `entityId`, `readAt`, `createdAt`.
- `GET /notifications`, `POST /notifications/:id/read`, unread count.
- Escalation step + assign endpoint call a `notify(userId, payload)` seam.
- Wire `NotificationPanel` / `notificationStore` to the endpoint (replace local-only state).
- Email is a **separate later increment** — no SMTP infra exists today; `notify()` is the seam it plugs into.

## 7. Frontend
- **Assignee widget + reassign action** in `features/tickets/detail/TicketSidebar.tsx` / `ActionBar.tsx`; assignee column + filter on `TicketsPage.tsx`.
- **Escalation-matrix admin tab** under `client/src/features/admin/`, modeled on `admin/access-control/AccessMatrix.tsx` — per-department ordered ladder (target + firing threshold).
- **Availability panel** — "My out-of-office" (profile or small admin tab): create windows + pick delegate.
- **Escalation history** on the ticket detail (consume `GET /tickets/:id/escalations`).
- **API clients:** new `lib/api/escalation.ts`, `lib/api/notifications.ts`; extend `lib/api/ticket.ts` (assignee), `lib/api/user.ts` (availability).

## 8. Sequencing
1. ✅ **Schema + migration** — `assigneeId`, `UserAvailability`, `EscalationRule`/`Level`, `EscalationEvent`. Foundation. *(migration `20260724172032_escalation_matrix`)*
2. ✅ **Resolver + assign/reassign service + assignee UI** — makes assignment real and manually testable.
3. ✅ **SLA-sweep escalation step + admin matrix UI** — the SLA-crossing path.
4. ✅ **Availability windows + reassign-on-OOO** — the "unavailable" path.
5. ✅ **Notification model/API + panel wiring** — so escalations are seen.
6. ✅ **Department-head picker** (follow-up) — Departments admin form can now set `headUserId`, making `DEPARTMENT_HEAD` levels configurable from the UI (previously API-only).

Steps 1–2 are load-bearing: without a real `assigneeId` nothing else has anything to move.

**Status:** Steps 1–6 implemented, typechecked, and verified end-to-end via Playwright (`tests/e2e/escalation-matrix.spec.ts` + `tests/e2e/escalation-sla-breach.spec.ts`, 5/5) against the live `kaizen_qms2` stack. Change logs: `backend/changes.md`, `client/changes.md`. **Not committed** — working tree only.

## 8a. Deferred — Approval on assignment  ⏳ LATER (not started)

> **TODO / remember:** add an optional approval gate so a (re)assignment or an
> escalation must be approved before it takes effect. **Decision pending** — do
> we want this at all, and if so for which paths?

Today assignment is **immediate** on all paths (manual assign, SLA-breach
escalation, OOO reassignment) — no sign-off anywhere. The workflow `ApprovalPolicy`
system only intercepts **stage transitions**, not assignment, so assignment never
touches it.

Rough shape when we build it:
- New pending-assignment state: `proposedAssigneeId` (+ requester, reason) on the
  ticket, or a small `AssignmentApproval` model, distinct from the applied
  `assigneeId`.
- Flow: propose → approver decides → on approve, apply `assigneeId` + write the
  `EscalationEvent` + notify; on reject, leave as-is.
- Open questions: which paths need it (manual only, or auto-escalation too?);
  who approves (department head / manager / a role?); should auto-escalation on
  SLA breach be blockable by an approval, or is that too slow for an SLA path?

## 9. Resolved decisions
1. **Ladder depth:** fixed two steps — `[MANAGER, DEPARTMENT_HEAD]`. No multi-level manager-chain walk. (The delegate → manager fallthrough in the resolver applies only when skipping an *unavailable* target, not as extra ladder rungs.)
2. **Breach with no resolvable target:** leave the assignee unchanged and **notify admins** (do not silently drop the escalation).
3. **Manual reassignment:** **preserve** the current `escalationLevel` (do not reset to 0) — a manual hand-off keeps the ladder position.
4. **Return from OOO:** reassigned tickets **stay** with the escalated owner; nothing auto-reverts when the user returns.
```

## Testing
- Unit: `resolveNextAssignee` (unavailable → delegate → manager fallthrough, cycle cap, global-rule fallback), `isAvailable` window boundaries.
- Integration: SLA sweep fires exactly one `EscalationEvent` per `(ticket, level)` across repeated runs (idempotency); OOO-create reassigns open tickets.
- Use `backend/src/jobs/run-once.ts` to exercise the sweep without Redis.