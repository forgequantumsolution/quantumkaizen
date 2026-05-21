# Workflow System — Phase 3.5 Forms Integration Plan

**Status:** ✅ Shipped + refactored to embed-in-JSON architecture (2026-05-16)
**Owner:** Backend + Frontend (single slice)
**Depends on:** Phase 1 (workflow definitions), Phase 2 (tickets, engine, action behaviors), the existing `dynamic-form` module
**Reference:** `core-prod-scaling/backend/workflows/{models/stage_form.py, engine/engines/form_handler.py}` (Django port) and the existing `backend/src/modules/dynamic-form/`
**Master plan section:** `docs/WORKFLOW_MASTER_PLAN.md` §0 (called out as "Form attachments per stage (DMS-backed)" — never broken out into its own phase)
**Revision history:**
- 2026-05-16: initial draft. Inserted between Phase 3 and Phase 4 because Phase 4's `FORM_SUBMITTED` audit event has nothing to attach to without this binding.
- 2026-05-16: **shipped + immediately refactored** following real-use feedback. The plan-doc-as-drafted assumed `StageFormBinding` rows would be created via dedicated CRUD endpoints (`POST /api/workflows/:id/stage-form-bindings`). After live testing surfaced the "saving wipes my policies" cascade-delete bug, the architecture was reshaped to **embed-in-JSON**: form binding intent (alongside SLA + approval intent) lives inside `node.data` on the canvas; the backend materialises rows on Publish. The plan body below is preserved for historical context — see workflow-changes.md §"Phase 3.5+ — Architecture refactors" for the post-refactor architecture as it actually shipped.

---

## 1. Phase 3.5 Goal

Make **forms blockers**. After Phase 3.5:

- A workflow stage can declare a list of **required forms** that must be submitted before a ticket can transition out of that stage.
- A workflow stage can declare a list of **optional forms** that an actor may fill but isn't blocked on.
- Each `FormSubmission` can carry an optional `(ticketId, stageId)` binding — distinguishing **standalone** (one-off `/forms` fills) from **workflow-bound** submissions. The existing standalone path keeps working unchanged.
- The engine's `access.layer.assertCanPerformAction` gains a check: if the current stage has unsatisfied required-form bindings, the action is rejected with a clear `formsRequired` payload.
- The frontend gains: a "Forms" section in `StageInspector` for attaching forms to stages, a "Forms" card on `TicketDetailPage` showing pending vs submitted forms with deep-links into `FormFillPage`, and an `ActionBar` that disables transitions while required forms are unsubmitted.

**Out of scope (deferred):**
- Per-action form scoping — bindings only key on `stageId`. (Signed-off Q1 below.) If we ever need "only block the `Approve` action, not `Reject`", we'll extend `StageFormBinding` with an optional `actionId` then.
- Auto-spawn submissions on stage entry (i.e. "pre-create an IN_PROGRESS submission so users don't see an empty Forms tab"). The MVP starts submissions on-demand when the user clicks "Fill".
- Form versioning behavior on the binding — a binding stores `formId` (logical form), not `versionId`. Submitting the latest published version is what counts. If a form is re-versioned between binding and submission, the engine accepts any submission of the same logical form.
- Audit log entries (`FORM_SUBMITTED` event) — fired in Phase 4 once the audit chain lands. The integration points emit a noop `emitAuditEvent` so Phase 4 doesn't have to re-touch them.
- Cross-stage form dependencies (the Django reference's `CrossStageFormDependency`). Phase 3.5 keeps bindings local to one stage.

---

## 2. Cross-cutting Decisions

Defaults are recommended; flag any override.

| # | Decision | Default | Alternatives |
|---|---|---|---|
| Q1 | **Binding scope** ✅ *signed-off 2026-05-16* | **Per STAGE.** A binding row keys on `(workflowId, stageId, formId)` with no `actionId`. All transitions out of the stage are blocked equally until required forms are submitted. | Per (stage, action) tuple; or both — see "Out of scope" above. |
| Q2 | **`FormSubmission` shape** ✅ *signed-off 2026-05-16* | **Keep standalone + workflow-bound.** Add optional `ticketId`/`stageId`/`flowId` to `FormSubmission`. Standalone fills leave these null. Workflow-bound fills populate them. No new table. | New `WorkflowFormSubmission` table joining FormSubmission → Ticket (cleaner separation but doubles the indexing surface). |
| Q3 | **What counts as "required-form-satisfied"** ✅ *signed-off 2026-05-16* | A `FormSubmission` row exists with `formId = binding.formId`, `ticketId = currentTicket.id`, `stageId = currentStage.id`, `status = SUBMITTED`. The submission's `versionId` is allowed to differ from any past version — when a form is edited it's saved as a new version, and the latest version is what the FE serves at fill time. Bindings reference the logical form, not a pinned version. | (Earlier alternative: pin to a specific versionId — overruled because editing a form mid-flight would invalidate in-flight bindings.) |
| Q4 | **Who can fill a workflow-bound form** ✅ *signed-off 2026-05-16* | The same rules as the action that fills the form: any user with `form.fill` permission AND who can reach the ticket (`ticket.read`). No per-binding role gating in Phase 3.5. | Add `allowedRoleIds`/`allowedUserIds` to `StageFormBinding`. |
| Q5 | **Optional forms semantics** | A binding with `isRequired = false` is purely informational — it surfaces in the FE "Forms" card but doesn't block. Submissions are still recorded with the ticket binding. | Don't allow optional bindings at all in Phase 3.5 — keep it simple. |
| Q6 | **Form-binding ordering** ✅ *signed-off 2026-05-16* | `position: Int` on the binding row. The FE renders bindings in ascending position. No dependency between bindings — you can fill form B before form A even if A is `position: 1`. | Require strict order (form B blocked until form A submitted). |
| Q7 | **Permission keys** | New: `stage-form.read`, `stage-form.create`, `stage-form.update`, `stage-form.delete`. Granted to `SUPER_ADMIN` + `QMS_ADMIN` by default. Filling forms reuses the existing `form.fill` permission. | Roll all four under existing `workflow.update`. |
| Q8 | **Engine error shape on blocked transition** | `400 Bad Request` with body `{ error: { message: "Required forms not submitted", details: { formsRequired: [{ formId, title, bindingId }] } } }`. Mirrors the existing `validation_errors` envelope. | Use a new `423 Locked` HTTP code. |

---

## 3. Schema Changes

### 3.1 New model

```prisma
model StageFormBinding {
  id         String @id @default(uuid())
  workflowId String
  workflow   Workflow @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  stageId    String
  stage      WorkflowStage @relation(fields: [stageId], references: [id], onDelete: Cascade)

  formId     String
  form       Form @relation(fields: [formId], references: [id], onDelete: Restrict)

  isRequired Boolean @default(true)
  position   Int     @default(0)

  isActive   Boolean @default(true)
  isDeleted  Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  createdById String?
  createdBy   User?  @relation("StageFormBindingCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)

  @@unique([stageId, formId])
  @@index([workflowId, stageId])
  @@index([formId])
}
```

### 3.2 Modified models

**`FormSubmission`** — three optional FKs added:

```prisma
model FormSubmission {
  // ... existing fields ...

  ticketId   String?
  ticket     Ticket?  @relation(fields: [ticketId], references: [id], onDelete: SetNull)
  stageId    String?
  stage      WorkflowStage? @relation(fields: [stageId], references: [id], onDelete: SetNull)
  flowId     String?
  flow       TicketFlow?    @relation(fields: [flowId], references: [id], onDelete: SetNull)

  bindingId  String?
  binding    StageFormBinding? @relation(fields: [bindingId], references: [id], onDelete: SetNull)

  @@index([ticketId, stageId])
  @@index([bindingId])
  // Existing indexes preserved.
}
```

Notes:
- All four FKs nullable so existing standalone submissions remain valid.
- `bindingId` is a snapshot — if the binding is later soft-deleted, the submission still points at the historical binding for audit purposes.
- `(ticketId, stageId)` index supports the engine's "find submissions for this ticket on this stage" query.

**Back-relations** added on `Workflow`, `WorkflowStage`, `Form`, `User`, `Ticket`, `TicketFlow`.

### 3.3 Migration

One Prisma migration: `add_stage_form_bindings`. Drops nothing. Adds one table + four FK columns on FormSubmission. ~30 LoC of SQL. Safe to apply at any time.

---

## 4. API

All routes under `/api`. Permissions in parens.

### 4.1 Binding CRUD

| Method | Path | Permission | Body |
|---|---|---|---|
| `GET` | `/workflows/:id/stage-form-bindings` | `stage-form.read` | (none — query params: `?stageId=` to filter) |
| `POST` | `/workflows/:id/stage-form-bindings` | `stage-form.create` | `{ stageId, formId, isRequired?, position? }` |
| `PATCH` | `/stage-form-bindings/:id` | `stage-form.update` | `{ isRequired?, position?, isActive? }` |
| `DELETE` | `/stage-form-bindings/:id` | `stage-form.delete` | (none — soft-delete) |

### 4.2 Ticket-scoped binding view

| Method | Path | Permission | Returns |
|---|---|---|---|
| `GET` | `/tickets/:id/stage-forms` | `ticket.read` | `{ bindings: Array<{ binding, form, latestSubmission \| null }> }` for the ticket's current stage(s) |

### 4.3 Workflow-bound submission creation

| Method | Path | Permission | Body |
|---|---|---|---|
| `POST` | `/tickets/:id/forms/:formId/submissions` | `form.fill` + `ticket.read` | `{ bindingId, status, responses, meta? }` |

The existing `/forms/...` submission routes are unchanged — they create standalone (unbound) submissions. The new workflow-scoped route guarantees the right `ticketId`/`stageId`/`flowId`/`bindingId` get stamped onto the row.

### 4.4 Listing for the builder

The existing `/dynamic-form/form/get/` listing endpoint is fine for picking a form to bind — no new endpoint needed.

---

## 5. Engine Integration

### 5.1 New layer: `engine/form.layer.ts`

Pure-ish layer with one entry point:

```ts
/**
 * Returns the list of required-but-unsubmitted form bindings for a ticket
 * on a given stage. Empty array = no blockers.
 */
export const findUnsatisfiedRequiredForms = async (
  tx: Tx,
  ticketId: string,
  stageId: string,
): Promise<Array<{ bindingId: string; formId: string; title: string }>>;
```

Implementation: one query joining `StageFormBinding` ⋈ `FormSubmission` (left join), filtered to `binding.stageId = stageId AND binding.isRequired = true AND binding.isDeleted = false`, where there's no matching submission with `status = SUBMITTED` for the same `(formId, ticketId, stageId)`.

### 5.2 Integration point

`engine/access.layer.ts:assertCanPerformAction` gains one new check, AFTER existing approval/permission checks and BEFORE behavior dispatch:

```ts
const unmet = await formLayer.findUnsatisfiedRequiredForms(tx, ticket.id, currentStage.id);
if (unmet.length > 0) {
  throw BadRequest('Required forms not submitted', {
    formsRequired: unmet,
  });
}
```

The orchestrator's existing approval intercept happens BEFORE this check — so an approval action with an unsubmitted required form still surfaces the approval intercept first. (Decisions about whether the approval-intercept or form-required check should be the *outermost* gate are bikeshed-tier — we pick approval-first because the approval modal lets the user see who has decided what, while a forms-required error is a simple "go fill these" message.)

### 5.3 Hook for the form-fill path

`FormSubmission` POST handler (`dynamic-form.service.ts:saveSubmission`) — when the body includes a `ticketId` or `bindingId`, validate:
1. The user can reach the ticket (`ticket.read` + ticket's current actor list).
2. The binding belongs to the ticket's current stage.
3. The form id on the binding matches the route param.

If any check fails → 403. Otherwise the submission is created with the FKs populated.

### 5.4 No engine code re-touched in Phase 4

`emitAuditEvent(tx, ctx, 'FORM_SUBMITTED', { submissionId, bindingId, formId })` is called from the submission service. Phase 4's audit-chain implementation just wires the function body; no Phase 3.5 call sites move.

---

## 6. Frontend

### FE.P3.5.1 — API client

New `client/src/lib/api/stageForm.ts` (~120 LoC):
- Types: `StageFormBinding`, `CreateStageFormBindingBody`, `UpdateStageFormBindingBody`, `TicketStageFormsResponse`.
- Hooks: `useStageFormBindings(workflowId, stageId?)`, `useCreate/Update/DeleteStageFormBinding`, `useTicketStageForms(ticketId)`, `useCreateWorkflowBoundSubmission(ticketId, formId)`.

### FE.P3.5.2 — Builder inspector

`StageInspector.tsx` — new **Forms** section below `Approvals` / `SLA`:
- Heading + per-binding row showing form title, required/optional badge, drag handle for position, edit + remove buttons.
- "Add form" → modal (`StageFormBindingEditor`) with an antd multi-select (backend-search, same pattern as the approver pickers in `ApprovalPolicyEditor`) and `isRequired` toggle.
- Gated on `persistedStageId` (same as Approvals/SLA sections).

### FE.P3.5.3 — Ticket detail

`TicketDetailPage.tsx` — new `RequiredFormsCard` between `ApprovalAwaitingCard` and `ActionBar`:
- Lists every binding for the ticket's current stage.
- For each binding: form title, status pill (Not started / Draft / Submitted), "Fill" / "Resume" / "View" CTA.
- "Fill" navigates to `/forms/:formId/fill?ticketId=...&stageId=...&bindingId=...`.
- `ActionBar` reads `useTicketStageForms(ticketId)` and **disables transition buttons** when any required binding is unsubmitted; tooltip shows "Submit required forms first".

### FE.P3.5.4 — FormFillPage update

Existing `FormFillPage` reads `ticketId` / `bindingId` from query params. On submit:
- If params present → POSTs to the workflow-bound submission endpoint.
- Else → existing standalone POST.

### FE.P3.5.5 — Tests

- Backend (Playwright): seed a binding → raise ticket → assert `/transition` returns 400 with `formsRequired`; submit form via workflow-bound route → `/transition` returns 200.
- Frontend (Playwright): build flow asserts the inspector form binding editor + the ticket "Forms" card + blocked transition button when forms unsubmitted.

---

## 7. Effort estimate

| Slice | LoC | Wall time |
|---|---|---|
| BE schema + migration | ~100 | 0.25d |
| BE binding CRUD (routes/controller/service/schema/openapi) | ~350 | 0.5d |
| BE engine integration (form.layer + access hook + submission hook + audit emit) | ~250 | 0.5d |
| BE seed update (one binding on the seeded Review stage) | ~30 | 0.1d |
| FE API client | ~150 | 0.25d |
| FE inspector + binding editor modal | ~300 | 0.5d |
| FE ticket-detail Required Forms card + ActionBar gating | ~250 | 0.5d |
| FE FormFillPage workflow-bound path | ~80 | 0.25d |
| Tests (BE + FE) | ~250 | 0.5d |
| Plan doc + changelog | (this) | 0.1d |
| **Total** | **~1,750** | **~3.5 days** |

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Form versioning surprise — a binding's form is re-versioned mid-flight, and an old submission gets accepted | Q3 picks "templated, not pinned" — submission against the latest version always satisfies. Document in user-facing copy. Add a Phase 4 audit event when the bound form's `versionId` differs from what existed at binding time, so the gap is visible. |
| Standalone form submissions now have to round-trip a permission check that previously didn't exist | The permission check only fires when `ticketId` is set in the POST body. Existing standalone callers pass no `ticketId`; their path is unchanged. Add a unit test that confirms standalone POST still works. |
| Builder inspector grows too tall once Forms section is added | Forms section is collapsed by default in the inspector when empty (`No required forms`); only the heading + "Add form" button shows. Open-on-content keeps height reasonable. |
| Engine validation order between approval intercept + form-required check could surprise users | Explicit doc + a runbook entry on what error the user sees in each scenario. The "approval intercept fires before form check" is the chosen default (Q8 commentary). |

---

## 9. Sign-off status

- Q1 — Per-stage binding scope. ✅ confirmed 2026-05-16.
- Q2 — Keep both standalone + workflow-bound. ✅ confirmed 2026-05-16.
- Q3 — Latest version used at fill time (no version pinning on bindings). ✅ confirmed 2026-05-16.
- Q4 — `form.fill` + `ticket.read`, no per-binding role gating. ✅ confirmed 2026-05-16.
- Q5 — Optional bindings allowed; informational only. Default stands.
- Q6 — Fill in any order; no inter-binding dependencies. ✅ confirmed 2026-05-16.
- Q7 — New `stage-form.*` permission keys. Default stands.
- Q8 — `400 Bad Request` with `formsRequired` detail array. Default stands.

All blocking sign-offs cleared. Ready to code.
