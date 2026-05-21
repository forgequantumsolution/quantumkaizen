# Workflow System — Phase 4 Plan: Audit Trail + E-Signatures

**Status:** ⏳ Drafted — pending sign-off on cross-cutting questions (Q1–Q11)
**Owner:** Backend + Frontend (single slice; FE follows BE by ~1 day)
**Depends on:** Phase 1 (workflow definitions), Phase 2 (tickets + engine + `emitAuditEvent` noop hooks), Phase 3 (approval/SLA call sites already emit noop events), Phase 3.5+ (embed-in-JSON architecture — `requireSignature` will follow the same pattern)
**Reference:** `core-prod-scaling/backend/workflows/{models/audit_log_entry.py, models/esignature.py, services/audit_logger.py, services/signature_service.py}` (Django port); `WORKFLOW_MASTER_PLAN.md §6` for the original scope.
**Revision history:**
- 2026-05-16: initial draft.

---

## 1. Phase 4 Goal

Make every state change **tamper-evident** and certain actions **physically signed**.

After Phase 4:
- Every business event lands in a hash-chained `AuditLogEntry` row (SHA-256 of `prev_hash + payload`, sequential per ticket).
- A `GET /api/audit/verify?ticketId=…` endpoint walks the chain, recomputes hashes, flags broken sequences.
- Workflow actions can carry a `requireSignature` flag (embedded in the canvas JSON via the P3.5+ pattern). When set, the engine blocks the transition until the actor signs with their PIN.
- Users enroll a PIN + signature "meaning" once; signing stores an immutable `EsignatureRecord` + `WorkflowStageSignature` snapshot (user name/email captured at sign-time, survives user deletion).
- The frontend gains: audit log page with filters + integrity badge, signature PIN modal (+ enrollment flow), inspector toggle for action-level signature requirement.

**Out of scope (deferred):**
- Per-stage signatures triggered on stage ENTRY rather than action (Django has both; we ship action-level only for now).
- Multiple signatures per action (witness signatures, dual-signature like FDA Part 11 §11.200(b)). Single-signer in Phase 4.
- Certificate-based signing (X.509). PIN-based only; the `EsignatureRecord.certificateUsed/certificateData` columns are scaffolded but unused.
- Background re-validation cron. Verify on demand via `/audit/verify` only.
- Signed-tamper alerting / email notifications.

---

## 2. Cross-cutting Decisions

Defaults are recommended; flag any override before code generation.

| # | Decision | Default | Alternatives |
|---|---|---|---|
| Q1 | **Hash algorithm** | `SHA-256` via `node:crypto` (matches Django reference + master plan §6). | SHA-512, BLAKE3 (faster, third-party dep), HMAC-SHA-256 with a server-side secret (better against forgery but breaks portable verification). |
| Q2 | **Chain scope** | **Per-ticket** — each ticket has an independent chain (`@@unique([ticketId, sequenceNumber])`). Tampering with ticket A doesn't break the chain of ticket B; verify endpoint runs on a single ticket's chain in O(N) of that ticket's events only. | Per-workflow (cross-ticket chain on the same workflow definition); global (one chain across the whole system). Both are higher contention + harder to verify; per-ticket is the Django default. |
| Q3 | **Workflow-level events** | Workflow CRUD events (`WORKFLOW_CREATED`, `WORKFLOW_UPDATED`, `WORKFLOW_DELETED`, `WORKFLOW_PUBLISHED`) get `workflowId` set and `ticketId = null`. They form their own per-workflow chain via `@@unique([workflowId, sequenceNumber])` (composite index for ticket-less entries). | Skip workflow-level chains entirely; only ticket events get audited. Cheaper but workflow definition changes go untracked. |
| Q4 | **PIN hashing** | **bcrypt** with `BCRYPT_ROUNDS=12` (matches existing `User.passwordHash`). `User.signaturePinHash` column already scaffolded. | Argon2id (better resistance to GPU attacks; adds `argon2` dep); scrypt. |
| Q5 | **PIN length** | 6–12 digits, numeric only. Validated at enrollment. Stored hashed. | 4-digit (weaker but more familiar); alphanumeric (stronger but UX cost). |
| Q6 | **Signature scope** | Action-level. A `WorkflowStageAction` can declare `requireSignature: true` (embedded in canvas JSON via P3.5+ pattern). The signature gates the action's transition. | Stage-level (every action out of the stage requires a signature) + action-level override. Heavier UX. |
| Q7 | **Audit event emission point** | All existing engine layers already invoke `emitAuditEvent(tx, ctx, type, data, user)` as noops. Phase 4 fills in the body — **no engine call sites move**. New events for Phase 4 (`SIGNATURE_RECORDED`, `SIGNATURE_INVALIDATED`) get added at the new sign/invalidate routes. | Re-route all events through a publisher pattern (more flexible but heavier; deferred to Phase 5 if dashboards need it). |
| Q8 | **Signature invalidation** | Admins with `signature.invalidate` permission can mark a signature `isInvalidated=true` with a reason. The signature ROW STAYS — invalidation is recorded, not deleted. A new `SIGNATURE_INVALIDATED` audit entry is appended to the ticket's chain. | Hard-delete + audit. Loses the original signature data; not 21 CFR Part 11 compatible. |
| Q9 | **Audit retention** | Never auto-delete. Audit rows survive soft-deleted tickets (the `Ticket.isDeleted` flag doesn't cascade). | Cold-storage archive after N days (cheaper but harder to verify; cron job + S3). |
| Q10 | **Verify endpoint authorization** | Anyone with `audit.read` permission can verify any ticket they can also read (`ticket.read`). | Restrict to QMS_ADMIN only (more cautious for regulated environments). |
| Q11 | **Existing `signaturePinHash`/`signatureMeaning`/`signatureEnrolledAt` columns on User** | **Already scaffolded** in `prisma/schema.prisma` from an earlier phase. No migration needed for the User model itself — only the four new tables + the AuditEventType enum get a migration. | Migrate them out if they collide with another module. (No conflict observed.) |

---

## 3. Schema Changes

One Prisma migration: `add_audit_chain_and_signatures`.

### 3.1 New enum

```prisma
enum AuditEventType {
  // Workflow lifecycle
  WORKFLOW_CREATED
  WORKFLOW_UPDATED
  WORKFLOW_PUBLISHED      // status flipped to ACTIVE
  WORKFLOW_DEACTIVATED    // ACTIVE → INACTIVE
  WORKFLOW_DELETED

  // Ticket lifecycle
  TICKET_RAISED
  TICKET_UPDATED
  TICKET_DELETED
  TICKET_HELD
  TICKET_RESUMED

  // Stage transitions
  STAGE_ENTERED
  STAGE_EXITED
  ACTION_PERFORMED        // covers FORWARD/REJECT/RETURN/REASSIGN behaviors
  PARALLEL_BRANCH_STARTED
  PARALLEL_BRANCH_COMPLETED

  // Comments / docs
  COMMENT_ADDED
  COMMENT_DELETED
  DOC_UPLOADED
  DOC_DELETED

  // Approvals
  APPROVAL_INSTANCE_OPENED
  APPROVAL_DECISION_RECORDED
  APPROVAL_SATISFIED
  APPROVAL_REJECTED
  APPROVAL_EXPIRED

  // SLA
  SLA_TIMER_STARTED
  SLA_THRESHOLD_HIT
  SLA_TIMER_COMPLETED
  SLA_TIMER_BREACHED
  SLA_EXTENSION_REQUESTED
  SLA_EXTENSION_DECIDED

  // Forms
  FORM_SUBMITTED          // workflow-bound submissions (ticketId set)

  // E-signatures
  SIGNATURE_RECORDED
  SIGNATURE_INVALIDATED
}
```

### 3.2 New tables

```prisma
model AuditLogEntry {
  id              String         @id @default(uuid())
  ticketId        String?
  ticket          Ticket?        @relation("TicketAuditLog", fields: [ticketId], references: [id], onDelete: SetNull)
  workflowId      String?
  workflow        Workflow?      @relation("WorkflowAuditLog", fields: [workflowId], references: [id], onDelete: SetNull)

  eventType       AuditEventType
  eventData       Json           // arbitrary per-event payload; snapshot of relevant fields
  performedById   String?
  performedBy     User?          @relation("AuditPerformedBy", fields: [performedById], references: [id], onDelete: SetNull)
  performedByName String?        // snapshot — survives user deletion

  sequenceNumber  Int            // monotonic per chain (per ticket OR per workflow)
  entryHash       String         // SHA-256(payload), hex
  previousHash    String?        // SHA-256 of the prior entry; null for the first

  // Validation cache — populated by /audit/verify reads
  isValidated     Boolean        @default(false)
  validationErrors Json?
  lastValidatedAt DateTime?

  occurredAt      DateTime       @default(now())

  @@unique([ticketId, sequenceNumber])     // chain integrity for ticket events
  @@unique([workflowId, sequenceNumber])   // chain integrity for workflow events (one of the two FKs is always null)
  @@index([eventType])
  @@index([occurredAt])
  @@index([performedById])
}

model EsignatureRecord {
  id                  String   @id @default(uuid())
  signedById          String
  signedBy            User     @relation("EsigUser", fields: [signedById], references: [id], onDelete: SetNull)
  signedByName        String                          // snapshot
  signedByEmail       String                          // snapshot
  meaning             String                          // e.g. "I attest these results are accurate"
  pinHashVerified     Boolean                         // always true today; reserved for cert flow
  certificateUsed     Boolean  @default(false)
  certificateData    Json?

  ipAddress           String?
  userAgent           String?
  signedAt            DateTime @default(now())

  signature           WorkflowStageSignature?
}

model WorkflowStageSignature {
  id                  String        @id @default(uuid())
  ticketId            String
  ticket              Ticket        @relation("TicketSignatures", fields: [ticketId], references: [id], onDelete: Cascade)
  stageId             String
  stage               WorkflowStage @relation("StageSignatures", fields: [stageId], references: [id], onDelete: Restrict)
  actionId            String?       // which action triggered the sign
  action              WorkflowStageAction? @relation("ActionSignatures", fields: [actionId], references: [id], onDelete: SetNull)

  signedByUuid        String                           // snapshot (in case user deleted)
  signedByName        String                           // snapshot
  signedByEmail       String                           // snapshot

  esignatureRecordId  String        @unique
  esignatureRecord    EsignatureRecord @relation(fields: [esignatureRecordId], references: [id], onDelete: Cascade)

  useCertificate      Boolean       @default(false)
  isInvalidated       Boolean       @default(false)
  invalidatedReason   String?
  invalidatedAt       DateTime?
  invalidatedById     String?
  invalidatedBy       User?         @relation("SignatureInvalidatedBy", fields: [invalidatedById], references: [id], onDelete: SetNull)
  signedAt            DateTime      @default(now())

  @@index([ticketId])
  @@index([stageId])
}

model ReturnPath {
  // Track explicit returns so the audit + future "return to previous stage"
  // UX has a stable place to look. Lightweight — one row per return.
  id              String   @id @default(uuid())
  ticketId        String
  ticket          Ticket   @relation("TicketReturnPaths", fields: [ticketId], references: [id], onDelete: Cascade)
  fromStageId     String
  toStageId       String
  reason          String?
  returnedById    String?
  returnedBy      User?    @relation("ReturnedBy", fields: [returnedById], references: [id], onDelete: SetNull)
  returnedAt      DateTime @default(now())

  @@index([ticketId, returnedAt])
}
```

### 3.3 Modified models

**`WorkflowStageAction`** — one column:

```prisma
model WorkflowStageAction {
  // ... existing fields ...
  requireSignature Boolean @default(false)
  signatures       WorkflowStageSignature[] @relation("ActionSignatures")
}
```

**Back-relations** added on `Ticket`, `Workflow`, `User`, `WorkflowStage` per the new FKs above.

**`User`** — no schema change (`signaturePinHash`, `signatureMeaning`, `signatureEnrolledAt` already exist).

### 3.4 Embed-in-JSON delta

To stay consistent with P3.5+, the `requireSignature` flag travels inside `node.data.primary_actions[i].requireSignature` / `node.data.secondary_actions[i].requireSignature`. `workflow.builder.ts buildWorkflowGraph` reads it and sets the column; `workflow.service.ts toFlowJson` round-trips it back.

---

## 4. API Surface

All routes under `/api`. Permissions listed.

### 4.1 Audit (read-only)

| Method | Path | Permission | Body / Query |
|---|---|---|---|
| `POST` | `/audit/query` | `audit.read` | `{ ticketId?, workflowId?, eventTypes?[], dateRange?, performedById?, page, pageSize }` |
| `GET` | `/audit/verify?ticketId=…` | `audit.read` + `ticket.read` | (none) — returns `{ valid, brokenAt?, totalEntries, lastValidatedAt }` |
| `GET` | `/audit/verify?workflowId=…` | `audit.read` + `workflow.read` | (none) — same shape for workflow chain |
| `GET` | `/audit/statistics` | `audit.read` | (none) — `{ byType[], byUser[], byDay[] }` |

### 4.2 Signature

| Method | Path | Permission | Body |
|---|---|---|---|
| `POST` | `/users/me/signature-pin` | (authed) | `{ pin, meaning }` — enroll or rotate |
| `DELETE` | `/users/me/signature-pin` | (authed) | (none) — clear enrollment |
| `POST` | `/tickets/:id/sign` | `ticket.transition` + `signature.create` | `{ actionId, pin, meaning? }` — sign + perform |
| `GET` | `/tickets/:id/signatures` | `ticket.read` | (none) — list ticket signatures |
| `POST` | `/signatures/:id/invalidate` | `signature.invalidate` | `{ reason }` |

**Note on `/sign`:** this is a *combined* sign-and-perform endpoint. Internally it verifies the PIN, creates the records, calls the existing `engine.performAction` in the same transaction. The frontend's existing `useTransition` hook gains a thin wrapper that branches to `/sign` when the selected action's `requireSignature=true`.

### 4.3 No changes to existing endpoints

All existing engine call sites already invoke the noop `emitAuditEvent` — Phase 4 fills the body. No new routes on `/api/tickets/:id/transition`, `/sla/*`, `/approval-policies/*`, `/stage-form-bindings/*`.

---

## 5. Engine Integration

### 5.1 audit.emitter implementation

`backend/src/modules/workflow/engine/audit.emitter.ts` — currently a noop. The body becomes:

```ts
export const emitAuditEvent = async (
  tx: Tx,
  ctx: { ticketId?: string; workflowId?: string },
  eventType: AuditEventType,
  eventData: Record<string, unknown>,
  actor: ActorContext | null,
): Promise<void> => {
  // Resolve performer snapshot (name + email) once
  let performedByName: string | null = null;
  if (actor?.id) {
    const u = await tx.user.findUnique({
      where: { id: actor.id },
      select: { name: true, email: true },
    });
    performedByName = u?.name ?? actor.id;
  }

  // Locate the last entry in this chain
  const where = ctx.ticketId
    ? { ticketId: ctx.ticketId }
    : { workflowId: ctx.workflowId! };
  const last = await tx.auditLogEntry.findFirst({
    where,
    orderBy: { sequenceNumber: 'desc' },
    select: { sequenceNumber: true, entryHash: true },
  });

  const sequenceNumber = (last?.sequenceNumber ?? 0) + 1;
  const previousHash = last?.entryHash ?? null;
  const occurredAt = new Date();

  // Compute hash deterministically — payload field order matters
  const payload = canonicalStringify({
    sequenceNumber,
    eventType,
    eventData,
    performedById: actor?.id ?? null,
    occurredAt: occurredAt.toISOString(),
    previousHash,
    ticketId: ctx.ticketId ?? null,
    workflowId: ctx.workflowId ?? null,
  });
  const entryHash = crypto.createHash('sha256').update(payload).digest('hex');

  await tx.auditLogEntry.create({
    data: {
      ticketId: ctx.ticketId ?? null,
      workflowId: ctx.workflowId ?? null,
      eventType,
      eventData: eventData as Prisma.InputJsonValue,
      performedById: actor?.id ?? null,
      performedByName,
      sequenceNumber,
      previousHash,
      entryHash,
      occurredAt,
    },
  });
};
```

Notes:
- `canonicalStringify` enforces stable key ordering so the same logical payload always produces the same hash.
- The `@@unique([ticketId, sequenceNumber])` constraint protects against concurrent inserts — the second tx fails and retries with a higher sequence number.
- All inserts happen inside the caller's transaction, so audit + business mutation commit atomically.

### 5.2 Signature gate in the orchestrator

`orchestrator.performAction` gains a new intercept BEFORE the approval intercept:

```ts
if (action.requireSignature) {
  // Caller must use POST /tickets/:id/sign for this action; the
  // /transition endpoint refuses on signature-required actions to keep
  // signing strictly authenticated.
  throw BadRequest('Signature required for this action', {
    signatureRequired: { actionId: action.id, behavior: action.workflowAction.behavior },
  });
}
```

The signing route bypasses this guard because it explicitly verifies the PIN before invoking the same `performAction` internals.

### 5.3 Signature service

```ts
// backend/src/modules/signature/signature.service.ts
export const sign = async (
  ticketId: string,
  input: { actionId: string; pin: string; meaning?: string },
  userId: string,
) => {
  return prisma.$transaction(async (tx) => {
    // 1. Verify PIN
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { signaturePinHash: true, signatureMeaning: true, name: true, email: true },
    });
    if (!user?.signaturePinHash) throw BadRequest('Enroll a signature PIN first');
    const ok = await bcrypt.compare(input.pin, user.signaturePinHash);
    if (!ok) throw Unauthorized('Invalid PIN');

    // 2. Create EsignatureRecord
    const esig = await tx.esignatureRecord.create({
      data: {
        signedById: userId,
        signedByName: user.name,
        signedByEmail: user.email,
        meaning: input.meaning ?? user.signatureMeaning ?? 'I attest',
        pinHashVerified: true,
        ipAddress: null, // populated by controller from req.ip
        userAgent: null, // populated by controller from req.headers
      },
      select: { id: true },
    });

    // 3. Resolve action + stage
    const action = await tx.workflowStageAction.findUnique({
      where: { id: input.actionId },
      select: { id: true, workflowStageId: true, requireSignature: true },
    });
    if (!action) throw NotFound('Action not found');
    if (!action.requireSignature)
      throw BadRequest('This action does not require a signature; use /transition');

    // 4. Create WorkflowStageSignature
    await tx.workflowStageSignature.create({
      data: {
        ticketId,
        stageId: action.workflowStageId,
        actionId: action.id,
        signedByUuid: userId,
        signedByName: user.name,
        signedByEmail: user.email,
        esignatureRecordId: esig.id,
      },
    });

    // 5. Emit SIGNATURE_RECORDED
    await emitAuditEvent(
      tx,
      { ticketId },
      'SIGNATURE_RECORDED',
      { actionId: action.id, esignatureRecordId: esig.id },
      { id: userId },
    );

    // 6. Perform the underlying action (signature-bypass path through performAction)
    return performAction(tx, ticketId, input.actionId, { id: userId }, { __signatureVerified: true });
  });
};
```

`performAction` gains an internal `__signatureVerified` payload flag that skips the `requireSignature` intercept when set by the signing service. External callers can't pass this flag (validated at the Zod schema layer).

---

## 6. Frontend

### FE.P4.1 — Audit API client

`client/src/lib/api/audit.ts` (~120 LoC):
- `useAuditQuery(filters)`, `useAuditVerifyTicket(id)`, `useAuditVerifyWorkflow(id)`, `useAuditStatistics()`.
- Filters: ticketId, workflowId, eventTypes[], dateRange, performedById, page, pageSize.

### FE.P4.2 — Audit log viewer page

`client/src/features/audit/AuditLogPage.tsx`:
- New route `/audit` mounted in App.tsx; permission-gated on `audit.read`.
- Filter sidebar (event type multi-select, date range picker, ticket/user pickers).
- Table: timestamp, event type, ticket/workflow, performer, payload preview, row → expand to full eventData JSON.
- Header chip showing integrity status for the selected scope: green ✓ "Valid" / red "Broken at sequence #N" / spinner during recompute.

### FE.P4.3 — Signature enrollment

`client/src/features/auth/SignaturePinModal.tsx`:
- New section in user profile (or first-time prompt when signing).
- PIN field (6–12 digits, validated client-side), meaning textarea.
- POST `/users/me/signature-pin`; on success store `signatureEnrolledAt` in auth store.

### FE.P4.4 — Sign-and-perform modal

`client/src/features/tickets/detail/SignActionModal.tsx`:
- Triggered when ActionBar detects `action.requireSignature=true`.
- Shows the action label + meaning text + PIN field.
- POST `/tickets/:id/sign`; on success, behaves like a normal transition success (invalidates ticket queries, toast).
- Inline enrollment CTA when user hasn't enrolled yet — modal pivots to the SignaturePinModal flow.

### FE.P4.5 — Inspector: per-action signature toggle

`client/src/features/workflows/builder/inspector/StageInspector.tsx`:
- Each primary/secondary action row gains a small "🔏 Require signature" checkbox.
- Writes `data.primary_actions[i].requireSignature` to canvas state via the existing `onChange` path. Materialises on Publish (P3.5+ pattern).

### FE.P4.6 — ActionBar gating

`client/src/features/tickets/detail/ActionBar.tsx`:
- Read `requireSignature` from each `AllowedAction` (already in the existing `useAllowedActions` payload — needs one backend field added).
- For signature-required actions, clicking opens `SignActionModal` instead of the existing confirmation modal.

---

## 7. Tests

Backend (Playwright + Prisma):
1. Insert a ticket-scoped audit event chain → verify the integrity walk passes.
2. Tamper with one entry's `entryHash` directly via Prisma → verify the walk flags the right `sequenceNumber`.
3. Concurrent inserts produce monotonic, non-colliding sequence numbers.
4. Workflow-scoped events use the workflowId chain; the per-ticket and per-workflow chains don't interleave sequences.
5. `/sign` happy path: enrolled user → PIN matches → signature row + audit event + ticket advances.
6. `/sign` rejected path: wrong PIN → 401 + NO signature row + NO audit event (transaction rollback).
7. `/sign` on a non-signature action → 400.
8. `/transition` on a signature-required action → 400 with `signatureRequired` detail.
9. Invalidation: signature row stays + new `SIGNATURE_INVALIDATED` audit event appended.

Frontend (Playwright UI):
1. Audit log page renders + filters by event type.
2. Signature modal: PIN entry → submit → ticket advances.
3. Builder inspector toggle round-trips through Save draft + Publish.

---

## 8. Effort

| Slice | LoC | Wall time |
|---|---|---|
| BE schema + migration + Prisma regen | ~80 | 0.25d |
| BE audit.emitter implementation (hash chain) | ~120 | 0.5d |
| BE audit module (routes/controller/service/schema/openapi) | ~350 | 0.75d |
| BE signature module (enrollment + sign + invalidate) | ~300 | 0.75d |
| BE engine integration (signature gate in orchestrator + bypass flag) | ~100 | 0.25d |
| BE embed-in-JSON for `requireSignature` on actions | ~80 | 0.25d |
| BE seed update (permissions + sample signed action on Document Review) | ~50 | 0.25d |
| FE audit API client + query hooks | ~120 | 0.25d |
| FE audit log viewer page | ~400 | 0.75d |
| FE signature enrollment modal | ~180 | 0.25d |
| FE sign-and-perform modal + ActionBar wiring | ~250 | 0.5d |
| FE inspector signature toggle | ~50 | 0.1d |
| Tests (BE + FE) | ~500 | 1.0d |
| Plan doc + changelog | (this) | 0.15d |
| **Total** | **~2,580** | **~6 days** (3.5 BE + 1.5 FE + 1 tests) |

Master plan §9 budgeted 3-4 BE days + ~1 FE day. Actual estimate is ~50% higher because the master plan didn't separate tests and didn't account for embed-in-JSON propagation (which adds ~0.5 day across BE + FE).

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Hash payload field order — JS object key iteration order is mostly deterministic but not guaranteed pre-ES2015; future changes to `eventData` shape could silently break verification | `canonicalStringify` sorts keys alphabetically at every nesting level. Add a unit test that re-hashes a known payload after a key-insertion change and confirms stability. |
| Concurrent inserts → sequence collision | `@@unique([ticketId, sequenceNumber])` is the atomic guard. Retry-on-conflict in `emitAuditEvent` (re-read last, increment, re-insert) for the rare collision case. |
| Audit logs balloon the DB | Each row is ~1 KB. 100 tickets × 50 events ≈ 5 MB. Phase 5 introduces archival; no compaction in Phase 4. Add an index hint test that confirms `byTicket` queries stay under 50 ms at 100k rows. |
| PIN reset UX — user forgets PIN | Profile gains a "Reset signature PIN" action that DELETEs + re-enrolls. Loses any cached "meaning" string. The old `EsignatureRecord` rows persist (they're snapshots). |
| Lost signing UA / IP on test harness | `req.ip` and `req.headers['user-agent']` are populated only when behind a real proxy. Playwright tests skip these assertions. |
| Cascade-delete of `WorkflowStageSignature` when stage is removed | We use `onDelete: Restrict` on the stage FK — re-publishing a workflow that has signatures attached to a now-removed stage will fail loudly. Better than silent loss. |

---

## 10. Sign-off needed before code

- Q1 — SHA-256. Default stands unless flagged.
- Q2 — Per-ticket chain. Confirm or override to per-workflow.
- Q3 — Workflow-level chain in addition to per-ticket. Adopt or skip.
- Q4 — bcrypt for PIN hashing. Confirm or override to Argon2.
- Q5 — PIN length 6–12 digits. Confirm or override.
- Q6 — Action-level signatures only. Confirm or extend to stage-level.
- Q7 — Fill existing noop hooks. Default stands.
- Q8 — Invalidation appends a new audit entry. Default stands.
- Q9 — No auto-deletion of audit rows. Default stands.
- Q10 — `audit.read` + `ticket.read` to verify. Default stands.
- Q11 — `User.signaturePinHash` etc. reuse the existing columns. Default stands.

All non-default answers welcome before I cut code. Estimate refresh: ~6 days end-to-end if defaults stand; +1-2 days if Q2 flips to per-workflow OR Q6 extends to stage-level.
