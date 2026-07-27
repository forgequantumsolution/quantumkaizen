# Quantum Kaizen — Risk Module Cross-Module Integration Plan

> **Goal:** make the Risk module's scoring, controls, reviews and acceptance decisions
> *drive* the rest of the QMS — Change Control, Audit, DMS, LMS, CAPA/Deviation,
> LIMS (supplier/equipment/OOS), SLA/escalation, dashboards — instead of sitting in
> its own silo.
>
> Companion to `docs/RISK-MANAGEMENT-implementation-plan.md` §I, which listed the
> intended integrations but never specified or built them. This document is the
> spec + build order for that section.

---

## A. What the Risk module produces today (the "risk currency")

Everything below already exists and is verified in-repo. This is the raw material other
modules should consume — nothing here needs to be rebuilt.

| Artefact | Model / file | What it means to other modules |
|---|---|---|
| **Score + level** | `risk-scoring.service.ts` → `computeScore()` | The single source of a risk number. Standard-agnostic: ICH Q9 5×5, ISO 14971, AIAG-VDA AP, HACCP all reduce to `(framework, factors) → {score, level, actionPriority}` |
| **Level policy flags** | `RiskLevelDef` — `acceptance`, `requiresCapa`, `requiresApproval`, `requiresControl`, `reviewMonths`, `escalateToRoleId` | The *policy* a level implies. This is the hook every other module should read |
| **Three-stage score** | `Risk.initial* / residual* / target*` + `RiskScoreSnapshot` | Before controls / after controls / where treatment aims. Full re-score history with user, reason, formula |
| **Controls** | `RiskControl` (+ `ControlLibraryItem`) | Typed (PREVENTIVE/DETECTIVE/MITIGATING/CORRECTIVE) and hierarchy-classified (ELIMINATION…PPE). Already carries `capaId`, `actionItemId`, `documentId`, `lmsCourseId` columns |
| **Periodic review** | `RiskReview` + `jobs/sweeps/flagOverdueRiskReviews.ts` | Cadence derived from level (`reviewMonths`), auto-opened and flagged overdue |
| **Acceptance** | `RiskAcceptanceRecord` + `acceptRisk()` | 21 CFR Part 11 e-signed, ISO 14971 §8 benefit-risk rationale enforced on UNACCEPTABLE |
| **Assessments (FMEA/HACCP/HAZOP)** | `RiskAssessment` + `RiskAssessmentLine` | Versioned, framework-snapshotted, approve/reject with e-sign, promote-line-to-risk |
| **Registers, scoped** | `RiskRegister.scope` = SITE / PRODUCT / PROCESS / PROJECT / **SUPPLIER** / **EQUIPMENT** / SYSTEM / ENTERPRISE + `scopeRef` JSON | The register model *already* anticipates supplier and equipment risk — nothing reads it |
| **Links** | `RiskLink(entityType, entityId, relation, label)` | Generic n:m link to any QMS record. Relations: CAUSED_BY, MITIGATED_BY, APPLIES_TO, EVIDENCE, ESCALATED_TO |
| **Trigger provenance** | `RiskAssessment.triggerType` / `triggerId` | Designed for "this assessment was raised from Deviation DEV-2026-0031" |
| **Analytics** | `risk-analytics.service.ts`, `getHeatmap()`, `getSummary()` | Heat map by framework axes, level distribution, overdue/unscored counts |
| **PDF reports** | `client/src/features/risk/report/*` | Per-risk, per-assessment, per-register branded reports |

---

## B. Integration reality check — what actually exists

I audited every reference to risk outside `modules/risk/`. The result is stark.

### B.1 The only three live integrations

1. **Risk → CAPA (auto)** — `risk-control.service.ts:167 ensureCapaForRisk()`.
   Fires from `scoreRisk` (`risk.service.ts:445`), control create/verify/ineffective
   (`risk-control.service.ts:360, 526, 575`) and review outcome `ESCALATED`
   (`risk-review.service.ts:268`). Creates a `Capa` and a `RiskLink{entityType:'Capa'}`.
   Idempotent, best-effort, swallows its own errors. **This is the only automated
   outbound integration in the module.**

2. **`RiskControl` foreign-key columns** — `capaId`, `actionItemId`, `documentId`,
   `lmsCourseId` are validated on write (`risk-control.service.ts:125–153`: the target
   must exist) and echoed back in the serializer. **Nothing consumes them.** No DMS
   page shows "risks this SOP controls"; no LMS assignment is created; no ActionItem
   is generated.

3. **`RiskLink` manual entry** — `RiskDetailPage.tsx:1353 LinksTab`. The user picks a
   type from a hardcoded list (`Capa`, `NonConformance`, `Finding`, `Audit`, `Document`,
   `Supplier`, `Ticket`, `Deviation`, `ChangeControl`, `RiskAssessment`) and **pastes a
   raw UUID** (`RiskDetailPage.tsx:1492`), then types a display label by hand.

### B.2 What is missing — the gap list

| Gap | Evidence |
|---|---|
| **Zero inbound integration.** No module outside `modules/risk/` touches risk. | `grep -rn risk backend/src --include=*.ts \| grep -v modules/risk/` returns only `rbac-catalog.ts` (permission keys), `lib/audit-scope.ts` (trail entity registry) and the overdue-review sweep. Nothing else. |
| **`triggerType` / `triggerId` are dead columns.** | Written only from the assessment's own create/update body (`risk-assessment.service.ts:438`). No caller in any other module ever sets them. |
| **`RiskLink` targets are unvalidated and unresolvable.** | `risk.service.ts:630 addLink()` does not check that `entityId` exists, does not check `entityType` is a known type, and returns no route. The client renders the raw UUID when no manual label was typed (`RiskDetailPage.tsx:1435`). |
| **Links are one-directional.** | No `GET /links?entityType=…&entityId=…`. A CAPA, document or audit has no way to discover the risks pointing at it. |
| **Three of five level policy flags are inert.** | `requiresCapa` acts. `requiresApproval`, `requiresControl` and `escalateToRoleId` are stored, serialized (`risk.service.ts:459–460`), returned to the client — and enforced **nowhere**. A CRITICAL risk with `requiresControl` can be residual-scored and accepted with zero controls. |
| **No risk gate on Change Control.** | Change Control is a workflow ticket type. `ticket.service.ts transition()` has no risk-aware criteria. `ActionCriteria` exists as a model but carries only `name` — no evaluable predicate. |
| **Audit planning is risk-blind.** | `AuditScheduleRule` has a fixed `frequency` + `anchorDate`. `jobs/sweeps/spawnDueAudits.ts` never reads a residual level. `AuditRegister` scoping (`focusAreas`, `mainProcesses`) is manual JSON. |
| **DMS is risk-blind.** | `Document.reviewDueDate` is manual. A document that is a risk control can be retired without touching the risk. |
| **LMS is risk-blind.** | `LmsTrainingMatrixRule` has no risk driver. An ADMINISTRATIVE-hierarchy control naming a course creates no enrollment. |
| **Registers scoped SUPPLIER / EQUIPMENT are decorative.** | `Supplier` has no risk tier; `Equipment` calibration frequency is fixed; `scopeRef` JSON is never read by LIMS. |
| **Risk is absent from platform surfaces.** | `search.service.ts` `SearchType` = Sample \| CAPA \| Document \| Ticket \| OOS \| CoA — no Risk. `nav-counts` and `dashboard` have no risk queries. `sla` / `escalation` / `notification` have no risk references. |
| **Two parallel "Risk" concepts.** | There is a *workflow type* named Risk (ticket-based, `navAccess.ts:180 isRiskWorkflowTypeName`) folded into the static Risk module for access control, **and** the first-class `Risk` model. Nothing reconciles them. |

**Conclusion:** the risk module is a well-built, standards-correct engine with one
outbound wire (CAPA) and no inbound wires. Everything below is about wiring.

---

## C. Design — four shared mechanisms, then per-module wiring

Rather than 10 bespoke point-to-point integrations, build **four shared mechanisms**
once. Every module integration then becomes a thin adapter.

```
                 ┌──────────────────────────────────────────┐
                 │  C.1  Entity Registry (link resolution)  │
                 │       entityType → table/route/label     │
                 └──────────────────────────────────────────┘
                                     │
      ┌──────────────────────────────┼──────────────────────────────┐
      │                              │                              │
┌─────▼──────────────┐   ┌───────────▼────────────┐   ┌─────────────▼────────┐
│ C.2 Risk Profile   │   │ C.3 Policy Engine      │   │ C.4 Trigger Service  │
│ (READ side)        │   │ (ENFORCE side)         │   │ (WRITE side)         │
│ "how risky is X?"  │   │ level flags → actions  │   │ "assess risk from X" │
└────────────────────┘   └────────────────────────┘   └──────────────────────┘
      │                              │                              │
      └──────────────────────────────┼──────────────────────────────┘
                                     │
   Audit · DMS · LMS · Change Control · CAPA · LIMS · SLA · Dashboard adapters
```

### C.1 Entity Registry — make `RiskLink` real

**New file:** `backend/src/lib/risk-entity-registry.ts`

A single declarative table mapping each linkable `entityType` to how it is found,
labelled, routed and permission-gated:

```ts
export interface LinkableEntity {
  type: string;                 // 'Capa' | 'Document' | 'AuditRegister' | …
  label: string;                // "CAPA", "Document", "Audit"
  find: (id: string) => Promise<{ number: string; title: string } | null>;
  search: (q: string, take: number) => Promise<{ id: string; number: string; title: string }[]>;
  route: (id: string) => string;      // '/qms/capa/:id' — client detail route
  permission: string;                 // 'capa.read' — gates resolution for the caller
}
```

Registered types (all already have models): `Capa`, `ActionItem`, `NonConformance`,
`Finding`, `AuditFinding`, `AuditRegister`, `Document`, `Ticket`, `Supplier`,
`Equipment`, `Sample`, `OosInvestigation`, `LmsCourse`, `RiskAssessment`, `Risk`.

**Changes this unlocks:**

| Change | File |
|---|---|
| `addLink()` validates `entityType` is registered and `entityId` exists → 400 otherwise; auto-fills `label` from the registry (no hand-typed labels) | `risk.service.ts:630` |
| Serializer returns `entity_label` + `entity_route` so links are clickable | `risk.service.ts:258` |
| New `GET /api/risk/links?entityType=&entityId=` — **reverse lookup**, the single endpoint every other module's risk panel calls | `risk.routes.ts`, `risk.service.ts` |
| New `GET /api/risk/linkable?type=&q=` — typeahead search per type | ditto |
| Link drawer replaces the UUID input with an async-search `<Select>` | `RiskDetailPage.tsx:1490` |

**New shared client component:** `client/src/components/risk/RiskLinkPanel.tsx`

```tsx
<RiskLinkPanel entityType="Document" entityId={doc.id} />
```

Renders linked risks with residual-level chips, an "Assess risk" button (C.4, Phase 4)
and a "Link existing risk" action. **Drop-in for every module detail page** — this is
the single UI surface that makes risk visible across the platform.

> **Built (Phase 1).** `RiskLevelBadge` was *not* newly created — one already existed in
> `client/src/features/risk/riskStatusBadge.tsx` rendering the tenant's own configured
> band colours, and the panel reuses it rather than duplicating the colour logic.
> Registered types: Capa, ActionItem, NonConformance, Finding, AuditFinding,
> AuditRegister, Document, Ticket, Supplier, Equipment, Sample, OosInvestigation,
> StabilityStudy, Coa, LmsCourse, Risk, RiskAssessment (17).
>
> Two types needed per-record permission resolution rather than one catalog key, via a
> `permissionFor` hook on the registry entry: **Ticket** (the global `ticket.*` master
> was retired — access is per workflow type, `wf_type.<id>.read`) and **Finding**
> (`finding.<typeId>.read`). Without this the picker would have leaked ticket titles to
> anyone holding `risk.read`.

### C.2 Risk Profile — the read side ("how risky is X?")

Other modules must not run ad-hoc joins across `RiskLink` → `Risk` → `RiskLevelDef`
on every page load. Materialise it.

**New model** (migration `risk_integration_phase1`):

```prisma
model RiskProfile {
  id                String   @id @default(uuid())
  entityType        String   // 'Supplier' | 'Equipment' | 'Document' | 'Process' | …
  entityId          String
  openRiskCount     Int      @default(0)
  highestLevelCode  String?  // resolved from the max residual (fallback initial) level
  highestLevelLabel String?
  highestLevelColor String?
  highestLevelOrder Int?     // sortable severity rank
  acceptance        RiskAcceptanceLevel?
  maxResidualScore  Int?
  unacceptableCount Int      @default(0)
  overdueReviews    Int      @default(0)
  openControls      Int      @default(0)
  lastRiskEventAt   DateTime?
  recomputedAt      DateTime @updatedAt

  @@unique([entityType, entityId])
  @@index([highestLevelOrder])
  @@index([entityType, highestLevelOrder])
}
```

**New file:** `backend/src/modules/risk/risk-profile.service.ts`
- `recomputeProfile(entityType, entityId)` — idempotent recompute from `RiskLink`.
- `recomputeForRisk(riskId)` — recompute every profile this risk feeds.
- `getProfile(entityType, entityId)` / `getProfiles(entityType, ids[])` — batch read.

**Recompute triggers** (call `recomputeForRisk` after): `scoreRisk`, `acceptRisk`,
`updateRiskStatus`, `addLink`, `removeLink`, control create/verify/ineffective,
`completeReview`, and the overdue-review sweep.

**New endpoint:** `GET /api/risk/profile?entityType=&entityId=` (batch:
`?entityType=Supplier&ids=a,b,c`).

**New shared client hook + badge:** `useRiskProfile()` and
`client/src/components/risk/RiskProfileChip.tsx` — one coloured chip other modules
render in list rows and detail headers.

> **Built (Phase 2).** Two deviations from the spec above, both deliberate:
>
> 1. **`severityRank` replaces `highestLevelOrder`.** `RiskLevelDef.order` is only
>    comparable *within* one framework — a 6-band framework's order 3 is mid-range while
>    a 4-band framework's order 3 is top of scale, so ranking suppliers scored on
>    different frameworks against each other would have been meaningless. `severityRank`
>    is normalised 0–100: acceptance band dominates (ACCEPTABLE 0 / ALARP 40 /
>    UNACCEPTABLE 80) and relative position within the level's own framework refines
>    inside the band. Verified: 4-band HIGH → 53, 6-band mid-ALARP → 48, 6-band
>    top-ALARP → 55.
> 2. **`totalRiskCount` added alongside `openRiskCount`.** A CLOSED risk leaves the open
>    population but should not make the entity look untouched by risk.
>
> Semantics settled and verified against the live DB: an **ACCEPTED** risk still counts
> as open (accepted ≠ absent) but drops out of `unacceptableCount` — it is signed for, so
> it must stop tripping the downstream release gate for ever. A **CLOSED** risk leaves
> `openRiskCount` and contributes no level. When the last link goes, the row is **deleted**
> rather than zeroed, so "no profile" and "a profile that says zero" can never diverge;
> readers treat a missing row as a zeroed shape.
>
> Recompute is wired into: score, status change, delete (links read *before* the cascade),
> link add/remove, control create/status/verify/delete, review completion, risk acceptance,
> and the overdue-review sweep — that last one matters because the sweep never touches the
> risk row, so nothing else would have noticed a review tipping overdue.
>
> Endpoints are an OR-guard on `risk_profile.read` **or** `risk.read`, not the new key
> alone: existing roles keep working the day this ships, while the new key stays grantable
> on its own to someone who should see a supplier's risk level without the risk register.

### C.3 Policy Engine — make the level flags mean something

**New file:** `backend/src/modules/risk/risk-policy.service.ts`

Today only `requiresCapa` acts. Give the other three teeth:

| Flag | Enforcement to add | Where |
|---|---|---|
| `requiresControl` | Reject `POST /risks/:id/score` with `stage=RESIDUAL` unless the risk has ≥1 control in `IMPLEMENTED` or `VERIFIED`. Message names the count. | `risk.service.ts scoreRisk()` |
| `requiresApproval` | Reject `acceptRisk()` unless an `ApprovalInstance` for the risk is `APPROVED`. Raise that instance automatically on the score that first resolves to this level, using the existing `ApprovalPolicy` machinery. | `risk-control.service.ts:630 acceptRisk()` + new `raiseRiskApproval()` |
| `escalateToRoleId` | On a score resolving to this level, write an `EscalationEvent` + `Notification` to every user holding the role. Reuse `modules/escalation` and `modules/notification`. | new `escalateRisk()` called from `scoreRisk` |
| `requiresCapa` | *(already live — keep)* | `ensureCapaForRisk()` |

Add two **new** policy columns to `RiskLevelDef` (same migration):

| Column | Effect |
|---|---|
| `requiresTraining Boolean` | An ADMINISTRATIVE control on a risk at this level must name an `lmsCourseId` before it can reach `VERIFIED` (C.7) |
| `blocksChangeApproval Boolean` | A Change Control ticket linked to an open risk at this level cannot pass its approval stage (C.5) |

Every enforcement writes an audit-trail entry via the existing `writeTrail` so the
reason a transition was blocked is inspectable.

### C.4 Trigger Service — the write side ("assess risk from X")

**New file:** `backend/src/modules/risk/risk-trigger.service.ts`

One function every module calls to spin up risk work from its own record:

```ts
createRiskFromTrigger({
  triggerType,      // 'Finding' | 'NonConformance' | 'Capa' | 'OosInvestigation' | 'Ticket' | 'AuditRegister' | 'Document'
  triggerId,
  mode,             // 'RISK' (single risk in a register) | 'ASSESSMENT' (full FMEA/worksheet)
  registerId?,      // defaults per trigger type via new RiskTriggerRule config
  seed: { title, description, hazard?, cause?, consequence?, ownerId?, departmentId?, siteId?, categoryId? },
  severityHint?,    // maps FindingSeverity / TicketClassification → starting severity rank
}, userId)
```

It creates the `Risk` (or `RiskAssessment` with `triggerType`/`triggerId` **finally
populated**), writes the reciprocal `RiskLink`, writes the trail, and recomputes the
profile — atomically, in one transaction.

**New config model** so trigger routing is admin-configurable rather than hardcoded:

```prisma
model RiskTriggerRule {
  id             String   @id @default(uuid())
  triggerType    String            // 'Finding', 'OosInvestigation', …
  condition      Json?             // e.g. { severity: ['MAJOR','CRITICAL'] }
  mode           String            // 'RISK' | 'ASSESSMENT'
  registerId     String?
  frameworkId    String?
  categoryId     String?
  autoCreate     Boolean  @default(false)  // false = surface a button; true = fire automatically
  isActive       Boolean  @default(true)
  createdById    String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([triggerType, isActive])
}
```

`autoCreate=false` (the default) means the module shows an **"Assess risk"** button;
`autoCreate=true` fires the trigger on the module's own event. Configured under
`/risk/config/triggers` — a new tab in `RiskConfigLayout.tsx`.

**New shared client component:** `client/src/components/risk/AssessRiskButton.tsx` —
drops into any detail page, posts to `POST /api/risk/triggers`, navigates to the new
risk/assessment.

---

## D. Per-module integration specs

Each of these is now a thin adapter over C.1–C.4.

### D.1 Change Control (workflow ticket type)

Change Control is not a bespoke module — it is a `WorkflowType` driven by
`ticket.service.ts`. The integration is therefore a **workflow stage guard**, which
also serves Deviation, Supplier Change and any future gated type.

**Inbound (Change → Risk)**
- `AssessRiskButton` on the change ticket's detail sidebar (`TicketSidebar.tsx`) —
  raises a `RiskAssessment` with `triggerType='Ticket'`, `triggerId=ticket.id`.
- `RiskLinkPanel` in the same sidebar, showing every risk the change touches.

**Outbound (Risk → Change) — the gate**

`ActionCriteria` currently carries only a `name`. Give it an evaluable predicate:

```prisma
model ActionCriteria {
  // …existing…
  kind      String?  // 'RISK_ASSESSMENT_APPROVED' | 'NO_BLOCKING_RISK' | 'RISK_CONTROLS_VERIFIED'
  config    Json?    // { minLevelOrder?: number, relation?: string }
}
```

New evaluator `backend/src/lib/stage-criteria/risk-criteria.ts`, called from
`ticket.service.ts transition()` before the stage advances:

| `kind` | Blocks the transition when |
|---|---|
| `RISK_ASSESSMENT_APPROVED` | No `RiskAssessment` with `triggerType='Ticket'`, `triggerId=ticket.id` in status `APPROVED` |
| `NO_BLOCKING_RISK` | Any linked risk sits at a level with `blocksChangeApproval=true` and status not in (ACCEPTED, CLOSED) |
| `RISK_CONTROLS_VERIFIED` | Any linked risk has a control not yet `VERIFIED` |

The block message names the offending risk numbers — the same actionable-400 style the
risk module already uses.

**Change closure → risk re-review.** When a change ticket reaches a terminal stage,
open a `RiskReview` on every linked risk (`outcome` unset, `dueAt` = now). Rationale: an
implemented change invalidates the residual score that was computed before it. Hook in
`ticket.service.ts transition()` post-action, guarded by a config flag on the workflow
type.

**Risk-graded change classification.** Derive the change's risk class from the linked
assessment's max residual level and write it to `Ticket.classification` +
`Ticket.severityId`, so the existing SLA and approval-policy machinery — which already
keys off severity — automatically applies a stricter path to a high-risk change. No new
SLA code.

### D.2 Audit

**Risk-based audit scheduling** (the single highest-value audit integration; ISO 19011
§5.3 explicitly requires risk-based programme planning).

Add to `AuditScheduleRule`:

```prisma
  riskWeighted     Boolean @default(false)
  riskEntityType   String?   // 'Supplier' | 'Process' | 'Site' | 'Equipment'
  riskEntityId     String?
  minFrequencyDays Int?      // floor — never audit more often than this
  maxFrequencyDays Int?      // ceiling
```

`jobs/sweeps/spawnDueAudits.ts` reads `RiskProfile(riskEntityType, riskEntityId)` and
modulates the interval by `highestLevelOrder`:

| Residual level | Interval multiplier |
|---|---|
| Critical / Unacceptable | × 0.5 (clamped at `minFrequencyDays`) |
| High | × 0.75 |
| Medium | × 1.0 |
| Low | × 1.5 (clamped at `maxFrequencyDays`) |

The multiplier table lives in `RiskFramework.fieldConfig` so it is configurable per
framework, not hardcoded — consistent with the module's config-driven design.

**Risk-driven audit scoping.** On `createAuditRegister`, when the register names a
scoped area, prefill `focusAreas` / `criteria` from the top-N residual risks of the
matching `RiskRegister`. Surfaced as a "Pull from risk register" button rather than
silent prefill.

**Finding → Risk.** `finding.service.ts raiseChild()` gains a `RISK` kind alongside its
existing CAPA/Deviation kinds, delegating to `createRiskFromTrigger` with
`severityHint` mapped `FindingSeverity → severity rank` (CRITICAL→5, MAJOR→4, MINOR→2,
OBSERVATION→1 on a 5-point scale; normalised for 10-point frameworks by the existing
`maxRankOf` logic).

**Repeat-finding feedback.** When a finding is raised against an area that already has a
linked risk, propose an occurrence-factor increase on that risk — surfaced as a
suggested re-score on the risk detail page, never applied automatically (an automatic
re-score would be an unsigned change to a GxP record).

**Audit register → Risk panel.** `RiskLinkPanel` + `AssessRiskButton` on the audit
detail page.

### D.3 DMS

**Document as a risk control (reverse view).** `RiskControl.documentId` already exists
and is validated. Add:
- `RiskLinkPanel` on `DocumentDetailPage` showing "Risks this document controls",
  driven by a new `GET /api/risk/controls?documentId=` filter on the existing
  `listControls` (`risk-control.service.ts:254` — it already filters by riskId/status/
  owner, so this is one `where` clause).
- **Retire/revise guard:** `dms.service.ts retireDocument()` and `reviseDocument()` must
  check for controls referencing the document. Retiring blocks with a message naming the
  risks; revising opens a `RiskReview` on each (the control may no longer be effective).

**Risk-graded review periodicity.** `Document.reviewDueDate` is currently manual. When a
document controls risks, derive its review interval from the max controlled residual
level's `reviewMonths`, taking the shorter of (manual, risk-derived). Applied in
`issueDocument()` and `markReviewed()`.

**Risk-graded read receipts.** A document controlling a risk at a level with
`requiresTraining` automatically gets mandatory read receipts assigned to the risk's
department (`assignReaders`), rather than relying on someone remembering.

**Approved assessment → controlled document** *(answers open question #3 of the Risk
plan)*. On `approveAssessment()`, optionally file the generated assessment PDF as a
`Document` (type `PROTOCOL`, status `EFFECTIVE`, `docNumber` derived from the assessment
number) and write a reciprocal `RiskLink`. Config flag on `RiskFramework.fieldConfig`
(`fileApprovedAssessmentToDms: true`) so regulated frameworks can require it and
lightweight ones can skip it. The client-side `@react-pdf/renderer` pipeline already
produces the artefact; this needs a server-side render path or an upload-on-approve
handshake — **flagged as the one integration with real new infrastructure cost.**

### D.4 LMS

**Administrative control → training assignment.** A `RiskControl` with
`hierarchy='ADMINISTRATIVE'` (or `INFORMATION_FOR_SAFETY`) and an `lmsCourseId` should
create real training, not just store an id:

- On control create/update with `lmsCourseId` set, call `lms-assign.service.ts
  assignCourse()` for the risk's department (or `createMatrixRule()` with
  `targetType='DEPARTMENT'` when the control is recurring).
- **Verification gate:** a control naming a course cannot move to `VERIFIED` until the
  completion rate for that assignment ≥ a threshold (default 100 %, configurable on the
  level). Enforced in `verifyControl` — this is the LMS analogue of the `requiresControl`
  gate, and it is what makes "we trained everyone" auditable.
- Reverse panel on `LmsCourseDetailPage`: "Risks this course controls".

**Competency risk (LMS → Risk).** A `RiskTriggerRule` on overdue mandatory training:
when an enrollment breaches its due date on a course that controls a risk, raise or
escalate a risk in a dedicated "Training compliance" register. This closes the loop —
untrained staff on a critical control *is* a live risk, and today nothing records it.

**Risk-graded course config.** Courses controlling high-residual risks get a stricter
passing score and shorter validity, read from the level. Applied as defaults on course
creation when linked, not as a silent override of an existing course.

### D.5 CAPA / Deviation / Non-Conformance / Finding

Auto-CAPA already works. What is missing is the **return path**:

- **Reverse panel on CAPA detail** — "Raised from risk RISK-2026-0007", clickable.
  Uses the C.1 reverse-lookup endpoint. Currently a user on the CAPA has no idea it was
  risk-generated.
- **CAPA closure → residual re-score prompt.** On `updateCapaStatus(CLOSED)`, if the
  CAPA is linked to a risk, open a `RiskReview` on that risk with a note naming the
  CAPA. The residual score computed *before* the CAPA is stale by definition.
- **Effectiveness check FAIL → risk escalation.** `Capa.effectivenessData` check-ins
  already model 30/60/90-day outcomes. A `fail` on a risk-linked CAPA sets the risk
  status to `REOPENED` and fires the `escalateToRoleId` path. This is the ICH Q10
  feedback loop the platform currently lacks.
- **Deviation / NC → Risk.** `AssessRiskButton` on NC and Deviation detail pages, with a
  `RiskTriggerRule` allowing `autoCreate` for CRITICAL severity.

### D.6 LIMS — Supplier, Equipment, OOS, Stability

`RiskRegisterScope` already has `SUPPLIER` and `EQUIPMENT` values. Make them load-bearing.

**Supplier risk tier.** Add to `Supplier`:

```prisma
  riskTier          String?    // derived: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  riskTierUpdatedAt DateTime?
```

Populated from `RiskProfile('Supplier', id).highestLevelCode` on recompute. Drives:
- Incoming-sampling level (higher tier → more samples / tighter spec checks)
- Requalification audit frequency (via D.2's `riskWeighted` schedule rule)
- A risk chip on the supplier list and on every sample sourced from that supplier

**Equipment criticality → calibration frequency.** Same pattern: `RiskProfile
('Equipment', id)` modulates the calibration interval in the certification/calibration
sweep. GAMP 5 risk-based qualification, expressed in the data rather than in a spreadsheet.

**Confirmed OOS → product risk.** `RiskTriggerRule` on `OosInvestigation` with
`condition: { status: ['CONFIRMED'] }` and `autoCreate: true`, targeting the PRODUCT-scoped
register resolved from the sample's product. This is the highest-signal automatic
trigger in the whole plan — a confirmed OOS is by definition a product-quality risk.

**Stability trend → risk.** A failing stability pull raises a risk in the same product
register. Lower priority than OOS; same mechanism.

### D.7 SLA, Escalation, Notification

No new concepts — reuse the existing engines:

- **`RiskControl.dueDate` and `RiskReview.dueAt` as SLA timers.** Register a
  `SlaPolicy` for entity types `RiskControl` / `RiskReview` and start timers on create.
  The existing `checkSlaTimers` sweep, business calendars and threshold escalations then
  apply for free.
- **`escalateToRoleId` → `EscalationRule`.** C.3's `escalateRisk()` writes an
  `EscalationEvent`, so the risk escalation appears in the same ladder view as ticket
  escalations.
- **Notifications** on: risk assigned, control due/overdue, review due/overdue,
  acceptance signed, level escalation. Add `NotificationType` values `RISK_*` and emit
  from the risk services.

### D.8 Platform surfaces — Search, Nav counts, Dashboard

Small, high-visibility, cheap:

| Surface | Change | File |
|---|---|---|
| **Global search** | Add `'Risk'` and `'RiskAssessment'` to `SearchType`; query `riskNumber`/`title`/`hazard` and `assessmentNumber`/`title` | `modules/search/*.service.ts:11,28` |
| **Nav counts** | Overdue reviews + unaccepted-unacceptable risks as a sidebar badge on Risk | `modules/nav-counts` |
| **Main dashboard** | Risk heat-map tile + "risks awaiting acceptance" + "controls overdue" — `getHeatmap()`/`getSummary()` already return exactly this data | `modules/dashboard`, `features/dashboard/components/AuditsRiskSection.tsx` (already exists, currently mock) |
| **Module analytics** | Wire the existing `RiskAnalytics.tsx` panel to the real endpoints | `features/modules/analytics/RiskAnalytics.tsx` |

### D.9 Reconcile the two "Risk" concepts

There is a workflow type named Risk (ticket-based) *and* the first-class `Risk` model,
already folded together for access control (`navAccess.ts:180`). Decide and document:

**Recommendation:** keep the workflow type as the *intake/approval wrapper* (it gives
risks a configurable stage flow, forms, SLA and approvals for free — `Risk.workflowId`,
`workflowTicketId`, `workflowTicketUniqueId` columns already exist for exactly this)
and keep the `Risk` model as the *record of the risk itself*. Wire `attachRiskWorkflow()`
mirroring the existing `attachCapaWorkflow()` (`capa.service.ts:479`) — the pattern is
already proven for CAPA and AuditRegister. Do **not** let users create risk tickets that
have no `Risk` row; that is how the two concepts drift apart.

### D.10 Approval engine — risk-graded approval routing

Two changes, both of which the existing engine almost supports.

**1. `ApprovalInstance` must be able to attach to non-ticket records.** Today it is
`ticketId`-only (`ApprovalInstance.ticketId` is a required FK). C.3's `requiresApproval`
needs to raise an approval on a `Risk` or a `RiskAssessment`, neither of which is a
ticket. Add a polymorphic anchor:

```prisma
model ApprovalInstance {
  ticketId   String?   // was required — now optional
  entityType String    @default("Ticket")   // 'Ticket' | 'Risk' | 'RiskAssessment' | 'Document'
  entityId   String                          // backfilled from ticketId in the migration
  @@index([entityType, entityId])
}
```

This is the single most reusable change in the plan — it also unblocks approvals on
documents and assessments, which DMS and Risk both currently hand-roll.

**2. Risk-graded policy selection.** Add `ApprovalPolicy.minRiskLevelOrder Int?`. When a
stage has several policies, `approval.service.ts` picks the one whose
`minRiskLevelOrder` is the highest value still satisfied by the record's
`RiskProfile.highestLevelOrder`. Effect: a routine change gets a 1-approver policy; the
same stage on a change touching a CRITICAL risk demands sequential QA-head sign-off. No
new approval concepts — just policy selection driven by risk instead of by stage alone.

*Standard:* ICH Q9 §4.4 "the level of effort, formality and documentation should be
commensurate with the level of risk".

### D.11 Dynamic forms & stage forms — risk-scored checklists

The form engine (`Form` → `FormSection` → `FormField` → `FormSubmission`) is what audit
checklists, stage forms and inspection records are built from. Three integrations:

**Risk-scoring fields.** Add to `FormField`:

```prisma
  riskFactorKey String?   // 'S' | 'O' | 'D' | any framework factor key
  riskRankMap   Json?     // { "Yes": 1, "Partial": 3, "No": 5 } — answer → factor rank
  raisesRisk    Boolean   @default(false)
  riskSeverity  String?   // hint passed to createRiskFromTrigger
```

On submission, `dynamic-form/submission.controller.ts` collects every field carrying a
`riskFactorKey`, maps the answers to ranks and calls the **existing** `computeScore()` —
so an audit checklist produces a real, framework-validated risk score rather than a
bespoke "score" invented by the form. Any field with `raisesRisk` answered adversely
fires `createRiskFromTrigger` (C.4) with `triggerType='FormSubmission'`.

This is the mechanism that makes risk-based checklists work the way TrackWise and Veeva
do it, and it costs almost nothing because the scoring engine is already pure and
DB-free.

**Assessment worksheets as forms.** `RiskAssessmentLine` has a fixed FMEA-shaped column
set. Methodologies whose worksheet differs — HACCP (process step → decision tree →
critical limit → monitoring → verification), HAZOP (node → deviation → guideword) — bind
a `Form` through `RiskFramework.fieldConfig.worksheetFormId` and store answers in
`RiskAssessmentLine.notes`-adjacent JSON. **Resolves open question #2 of the original
risk plan** without a second line model.

**Stage forms gate.** `stage-form.access.ts` already governs which forms a stage
requires. A stage can now require the *risk form* — i.e. the change cannot advance until
the risk-impact form is submitted. Complements D.1's criteria gate for cases where the
evidence is a form rather than a full assessment.

### D.12 QC — Levey-Jennings / Westgard

`QcResult` already computes `zScore`, `status` (ACCEPT/WARN/REJECT) and `violatedRules`.
That is a live risk signal about an instrument and a method, and nothing consumes it.

- **QC → Risk.** A `RiskTriggerRule` on `QcResult` with
  `condition: { status: ['REJECT'] }` or a run of `WARN`s on the same
  `qcMaterialId`+`instrumentId` raises a risk in the EQUIPMENT- or SYSTEM-scoped
  register. A rejected control run is a lab-system risk by definition.
- **Risk → QC.** `RiskProfile('Equipment', instrumentId)` selects the Westgard rule set:
  high-risk instruments get the stricter multirule set and a shorter QC interval;
  low-risk instruments run the base rules. Configured per level, not hardcoded.

*Standard:* ISO/IEC 17025 §7.7 (assuring validity of results) and §8.5 (risks and
opportunities); USP <1058> instrument qualification tiers.

### D.13 Stability (ICH Q1A)

- **Failing / out-of-trend pull → Risk.** `StabilityPull` reaching `TESTED` with an
  adverse result fires `createRiskFromTrigger` against the PRODUCT-scoped register.
  Shelf-life risk is the archetypal ICH Q1A risk and today it lives only in a person's
  head.
- **Risk → study design.** A product at high residual risk mandates extra conditions or
  timepoints — surfaced as a warning on `StabilityStudy` creation when
  `RiskProfile('Product', productId)` exceeds a threshold, rather than silently editing
  the protocol (a protocol change must be a deliberate, signed act).

### D.14 CoA — the release gate

This is the sharpest quality gate in the platform and it does not exist yet.

`coa.service.ts` issue path gains a check: a CoA **cannot be issued** when the sample's
product, batch or supplier carries an open risk at an `UNACCEPTABLE` acceptance level
that has no `RiskAcceptanceRecord`. The block message names the risk numbers.

Rationale: certifying a batch whose product-quality risk is unresolved is precisely the
failure mode ICH Q9 exists to prevent. Same override policy as D.1 — e-signed, trailed,
justified (see §H decision 2).

Same gate on `Sample.disposition = 'RELEASED'` in `sample.service.ts`, which is the
earlier and more important of the two decision points.

*Standard:* EU GMP Annex 16 (QP certification), ICH Q10 §3.1.

### D.15 Sample, sample-testing, spec versions, test definitions

**Risk-based sampling.** The number of samples and the test set applied to an incoming
lot should scale with combined supplier + product risk. Derive a sampling level from
`max(RiskProfile('Supplier', s), RiskProfile('Product', p))` and surface it as a default
on sample login (`sample.service.ts`) — reduced / normal / tightened, the same three
tiers every sampling standard uses.

**Spec version change → risk.** A `SpecVersion` transition to effective is a change to a
registered control. `RiskTriggerRule` on `SpecVersion` raises an assessment; for
regulated products this should be `autoCreate: true`.

**Test criticality → second-person review.** A `TestDefinition` supporting a
high-risk-controlled CQA requires a second-person result review before
`Sample.reviewedById` can be set. Read from the risk profile of the linked product.

*Standard:* ICH Q9 Annex II.6 (materials management) and II.8 (laboratory control);
FDA Process Validation Guidance §III (risk-based CPP/CQA).

### D.16 Equipment, calibration, certification

- **Calibration interval from risk.** `Equipment.calibrationFrequencyDays` becomes
  risk-modulated using the same multiplier table as D.2's audit scheduling, reading
  `RiskProfile('Equipment', id)`. GAMP 5 / USP <1058> risk-based qualification expressed
  in data rather than in a spreadsheet.
- **Failed calibration → Risk + impact.** `CalibrationRecord.result = FAIL` fires
  `createRiskFromTrigger` and flags every `Result` and `QcResult` produced by that
  instrument since `lastCalibratedAt` for impact assessment — the retrospective-impact
  question every inspector asks after a calibration failure.
- **Certification expiry → Risk.** `Certification.expiryFlaggedAt` (already set by the
  existing expiry sweep) raises a compliance risk in the SITE register when a GMP / NABL
  / ISO 17025 certificate lapses.

### D.17 Organization, Site, Department — risk appetite and management review

**Risk appetite** *(answers open question #1 of the original risk plan)*:

```prisma
model RiskAppetite {
  id             String   @id @default(uuid())
  organizationId String?
  siteId         String?
  categoryId     String?          // null = applies to all categories
  toleranceLevelId String         // RiskLevelDef — the highest level tolerated
  statement      String?          // ISO 31000 §6.3.4 appetite statement
  requiresBoardReview Boolean @default(false)
  isActive       Boolean  @default(true)
  createdById    String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([organizationId, siteId, categoryId])
}
```

Most specific match wins (category+site → site → org). A risk resolving above tolerance
is flagged `out_of_appetite` on every serializer, escalated per C.3, and blocked from
`ACCEPTED` unless `requiresBoardReview` sign-off is recorded. This is the piece that
turns a risk register into risk *governance*.

**Management review pack** (ICH Q10 §4, ISO 9001 §9.3): a per-site, per-period export
combining the heat map, level distribution trend, out-of-appetite risks, overdue
reviews, control effectiveness rate and top-10 residual risks. Reuses
`risk-analytics.service.ts` plus the existing `@react-pdf/renderer` pipeline — this is
an assembly job, not new analytics.

**Roll-ups.** `RiskProfile` gains entityTypes `Site`, `Department` and `Organization`,
recomputed from the risks scoped to them, so the dashboard can show risk by site without
scanning.

### D.18 Access control, roles, permissions, users — competency and scoping

- **Data scoping.** Risk queries must honour the platform's site/department scoping
  (`lib/audit-scope.ts`, `docs/access-control-data-scoping-plan.md`). `Risk` already
  carries `siteId`/`departmentId`; `listRisks` filters by them only when the caller
  passes them explicitly — it must instead *enforce* the caller's scope.
- **Reverse-lookup permission filtering.** As noted in §G: a user who cannot read CAPAs
  must not learn CAPA numbers through the risk link panel.
- **Competency gate on assignment.** A user may only be set as a `Risk.ownerId` or a
  control `verifiedById` when their LMS record shows the required qualification current.
  This is the LMS integration in reverse and it is what makes "the verifier was
  qualified" auditable.

### D.19 Business calendar — due dates that respect working time

`nextReviewDateFor()` (`risk-scoring.service.ts:211`) does naive month arithmetic. Risk
review and control due dates should resolve through `BusinessCalendar` like SLA timers
do, so a review never falls due during a plant shutdown. Small change, real operational
value, and it keeps risk consistent with how every other deadline in the platform is
computed.

### D.20 Legacy training module — explicitly out of scope

`TrainingItem` / `TrainingAssignment` are superseded by LMS (`prisma/migrate-training-to-lms.ts`
exists). **No risk wiring goes into legacy training.** Everything routes through LMS
(D.4). Recorded here so the omission is deliberate rather than an oversight.

---

## E. Phased delivery

Each phase is independently shippable and leaves the system in a working state.

| Phase | Content | Exit criteria |
|---|---|---|
| **1. Foundations** ✅ **DONE** | C.1 entity registry + link validation/resolution + reverse-lookup endpoint + typeahead; `RiskLinkPanel` shared component; link drawer stops asking for UUIDs | ✅ Any risk link is clickable and resolves to a real record; a CAPA page can show the risks pointing at it |
| **2. Risk Profile** ✅ **DONE** | C.2 `RiskProfile` model + service + recompute hooks + batch endpoint + `useRiskProfile` hook; `RiskProfileChip` on equipment list + document/CAPA detail | ✅ `GET /api/risk/profile?entityType=Document&entityId=…` returns a live level; recompute fires on scoring, status, link, control, review, acceptance, delete and the overdue sweep |
| **3. Policy enforcement** | C.3 — `requiresControl`, `requiresApproval`, `escalateToRoleId` enforcement; `requiresTraining` + `blocksChangeApproval` columns; notifications | A CRITICAL risk cannot be residual-scored without a verified control, nor accepted without an approved instance |
| **4. Triggers** | C.4 trigger service + `RiskTriggerRule` config + admin tab + `AssessRiskButton`; wired into Finding, NC, Deviation, CAPA | "Assess risk" from a finding creates an assessment with `triggerType`/`triggerId` populated and a reciprocal link |
| **5. Change Control gate** | D.1 — `ActionCriteria.kind`/`config`, risk criteria evaluator in `transition()`, risk-graded classification, closure → review | A change ticket cannot pass approval with an unapproved risk assessment; the block message names the risk |
| **6. Audit** | D.2 — risk-weighted scheduling in `spawnDueAudits`, risk-driven scoping prefill, finding → risk, repeat-finding suggestion | A supplier at CRITICAL residual risk is scheduled for audit at half the base interval |
| **7. DMS + LMS** | D.3, D.4 — control-document reverse view + retire/revise guards + risk-graded review period; training assignment from administrative controls + verification gate | Retiring an SOP that controls a risk is blocked; a control naming a course cannot be verified until training completes |
| **8. LIMS + platform** | D.5 return paths, D.6 supplier tier / equipment criticality / OOS trigger, D.7 SLA + escalation, D.8 search/nav/dashboard | A confirmed OOS auto-raises a product risk; risk numbers are findable in global search |
| **9. Assessment → DMS filing** | D.3 controlled-document filing of approved assessments (server-side PDF render path) | An approved FMEA is filed as an EFFECTIVE controlled document |
| **10. Approval + forms** | D.10 polymorphic `ApprovalInstance` + risk-graded policy selection; D.11 risk-scoring form fields, worksheet-as-form, stage-form gate | An audit checklist answer produces a framework-validated risk score; a CRITICAL change routes to the stricter approval policy |
| **11. LIMS deep** | D.12 QC/Westgard, D.13 stability, D.14 CoA + disposition release gate, D.15 risk-based sampling + spec-change trigger, D.16 calibration interval + failed-calibration impact | A CoA cannot be issued against an unresolved UNACCEPTABLE product risk; a failed calibration flags every result since the last good one |
| **12. Governance** | D.17 `RiskAppetite` + out-of-appetite flagging + management review pack; D.19 business-calendar due dates; site/department roll-ups | A risk above site tolerance is flagged, escalated and blocked from acceptance; a management review pack exports for any site and period |
| **13. Competency & scoping** | D.18 risk data scoping enforcement, permission-filtered reverse lookup, LMS competency gate on owner/verifier assignment | An unqualified user cannot be recorded as a control verifier |

Phases 1–4 are the load-bearing ones — everything from 5 onward is an adapter that
becomes small once those exist. **Recommended first slice: Phases 1 + 2**, because they
are what makes risk *visible* everywhere, and every later phase depends on them.

**Sequencing note.** Phase 10's polymorphic `ApprovalInstance` change is a dependency of
Phase 3's `requiresApproval` enforcement. Either pull that one schema change forward into
Phase 3, or scope Phase 3's `requiresApproval` to ticket-backed risks only and complete it
in Phase 10. Recommendation: pull it forward — it is a small, additive migration that
unblocks approvals on documents and assessments too.

---

## F. Migrations

| Migration | Contents |
|---|---|
| `risk_integration_phase1` | `RiskProfile` model |
| `risk_integration_phase2` | `RiskLevelDef.requiresTraining`, `RiskLevelDef.blocksChangeApproval` |
| `risk_integration_phase3` | `RiskTriggerRule` model |
| `risk_integration_phase4` | `ActionCriteria.kind`, `ActionCriteria.config` |
| `risk_integration_phase5` | `AuditScheduleRule.riskWeighted`, `.riskEntityType`, `.riskEntityId`, `.minFrequencyDays`, `.maxFrequencyDays` |
| `risk_integration_phase6` | `Supplier.riskTier`, `.riskTierUpdatedAt` |
| `risk_integration_phase7` | `ApprovalInstance.entityType` / `.entityId` (+ `ticketId` made optional, backfilled); `ApprovalPolicy.minRiskLevelOrder` |
| `risk_integration_phase8` | `FormField.riskFactorKey`, `.riskRankMap`, `.raisesRisk`, `.riskSeverity` |
| `risk_integration_phase9` | `RiskAppetite` model |

All additive; no destructive changes; each is independently reversible. Follows the
module's existing convention (`schema.prisma` §Risk management) that only
riskId/frameworkId/categoryId/libraryItemId/assessmentId carry real FKs — cross-module
ids stay plain scalar columns resolved through the entity registry.

---

## G. New RBAC keys

Added to `backend/src/lib/rbac-catalog.ts` alongside the existing 40 risk keys:

| Key | Description |
|---|---|
| `risk_link.read` / `.create` / `.delete` | Link management, separable from `risk.update` |
| `risk_trigger.read` / `.create` / `.update` / `.delete` | Trigger-rule configuration |
| `risk_profile.read` | Read the risk profile of any entity (other modules require this to render the badge) |
| `risk_appetite.read` / `.create` / `.update` / `.delete` | Org/site risk-appetite configuration (§D.17) |
| `risk.override_gate` | Override a risk-driven block (change approval, CoA issue, sample release) with an e-signature and justification |

Reverse-lookup results are additionally filtered by the *target* entity's own read
permission via the registry's `permission` field — a user who cannot read CAPAs must not
learn CAPA numbers through the risk link panel.

---

## H. Decisions needed before Phase 5+

1. **Assessment → DMS filing**: server-side PDF render (new infra: headless renderer in
   the backend) vs. client-uploads-on-approve (simpler, but the artefact depends on a
   browser session). Phase 9 is scoped for the latter unless you want the former.
2. **Change Control gate strictness**: hard block, or block-with-override that requires an
   e-signature and a documented justification? A hard block is more defensible in an
   inspection; an override is more operable. Recommendation: block-with-e-signed-override,
   reusing `recordSignature()`.
3. **Auto-trigger appetite**: which `RiskTriggerRule`s ship with `autoCreate: true`?
   Recommendation: confirmed OOS only. Everything else starts as a button, and customers
   opt in per site.
4. **Supplier risk tier authority**: is the tier purely derived from `RiskProfile`
   (read-only in the supplier UI), or manually overridable with justification?
   Recommendation: derived, with a manual override that is trailed and expires on the next
   recompute.
5. **CoA / release gate strictness**: same question as #2, applied to batch release. This
   one is harder to argue for an override — a QP certifying against an open unacceptable
   risk is the exact failure mode the gate exists to stop. Recommendation: e-signed
   override, restricted to a dedicated `risk.override_gate` permission granted to QA
   heads only, with the override surfaced permanently on the CoA record.

---

## I. Standards conformance matrix

The engine is already standard-agnostic by construction (`risk-scoring.service.ts` header:
"ICH Q9, ISO 14971, ISO 31000 and AIAG-VDA differ only in the framework rows fed to it").
What the integrations add is conformance for the clauses that are about *the rest of the
quality system*, not about scoring. Each row states the clause, what it requires, and
which section of this plan delivers it.

### I.1 Quality risk management core

| Standard & clause | Requirement | Status | Delivered by |
|---|---|---|---|
| **ICH Q9(R1) §4.4** — formality commensurate with risk | Effort, formality and documentation scale with risk level | ✗ today | §D.10 risk-graded approval routing; §C.3 policy engine |
| **ICH Q9(R1) §4.4** — risk review | Review output of the QRM process against new knowledge | ◐ partial (`RiskReview` + sweep exist) | §D.1/D.3/D.5 event-driven reviews on change closure, document revision, CAPA closure |
| **ICH Q9(R1) Annex II.1** — integrated quality management | QRM integrated with deviation, CAPA, change, audit, training | ✗ today | §D.1–D.5 in full — this is the clause the whole plan exists to satisfy |
| **ICH Q9(R1) Annex II.4** — facilities, equipment, utilities | Risk-based qualification and maintenance intervals | ✗ today | §D.16 calibration interval + failed-calibration impact |
| **ICH Q9(R1) Annex II.6** — materials management | Risk-based supplier evaluation and incoming control | ✗ today | §D.6 supplier tier; §D.15 risk-based sampling |
| **ICH Q9(R1) Annex II.8** — laboratory control & stability | Risk-based OOS handling and stability design | ✗ today | §D.6 OOS trigger; §D.12 QC; §D.13 stability |
| **ISO 31000 §6.3.4** — risk criteria / appetite | Define the amount and type of risk the organisation will take | ✗ today | §D.17 `RiskAppetite` |
| **ISO 31000 §6.6** — monitoring and review | Planned monitoring embedded across the organisation | ◐ partial | §C.2 `RiskProfile` + §D.8 dashboards + §D.17 management review pack |
| **ISO 31000 §6.7** — recording and reporting | Risk reporting to inform decisions at all levels | ◐ partial (reports exist, not routed) | §D.17 management review pack; §D.8 platform surfaces |
| **ISO 9001 §6.1 / §9.3** — risks & opportunities, management review | Risk-based thinking with management review input | ✗ today | §D.17 |
| **ISO/IEC 17025 §8.5** — actions to address risks (labs) | Lab risks identified and acted on | ✗ today | §D.12 QC, §D.15, §D.16 |

### I.2 Medical device / design risk

| Standard & clause | Requirement | Status | Delivered by |
|---|---|---|---|
| **ISO 14971 §7.1** — risk control option analysis | Controls chosen in priority order: inherent safety → protective measures → information for safety | ✓ **already implemented** — `RiskControlHierarchy` encodes exactly this alongside the ISO 45001 hierarchy | existing `RiskControl` |
| **ISO 14971 §8** — residual risk evaluation & benefit-risk | Benefit-risk rationale required for unacceptable residual risk | ✓ **already implemented** — enforced in `acceptRisk()` with e-signature | existing |
| **ISO 14971 §7.4** — risks arising from controls | New risks introduced by a control must be assessed | ✗ today | §C.4 trigger from `RiskControl` — a control implemented is itself a change |
| **ISO 14971 §9** — production & post-production information | Field/production information fed back into risk | ✗ today | §D.5 CAPA effectiveness → risk reopen; §D.6 OOS/complaint triggers |
| **ISO 13485 §7.1 / 21 CFR 820.30(g)** — risk management in realization | Risk management applied across product realization | ✗ today | §D.15 spec/test criticality; §D.13 stability |

### I.3 GMP operational

| Standard & clause | Requirement | Status | Delivered by |
|---|---|---|---|
| **ICH Q10 §3.2** — CAPA system | CAPA driven by risk-ranked sources | ◐ partial (auto-CAPA exists, no return path) | §D.5 CAPA closure → review, effectiveness-fail → reopen |
| **ICH Q10 §3.3** — change management | Risk assessment mandatory in change evaluation | ✗ today | §D.1 change-control gate |
| **ICH Q10 §3.4 / §4** — management review | Risk data as management review input | ✗ today | §D.17 management review pack |
| **EU GMP Ch.1 §1.4(xiv)** — QRM as part of PQS | QRM applied prospectively and retrospectively | ◐ partial | whole plan |
| **EU GMP Ch.5** — supplier qualification | Supplier control proportionate to risk | ✗ today | §D.6 supplier tier + §D.2 risk-weighted supplier audits |
| **EU GMP Annex 15** — qualification & validation | Risk-based scope of qualification | ✗ today | §D.16 equipment; §D.15 spec versions |
| **EU GMP Annex 16** — QP certification | Batch certification considers all quality risks | ✗ today | §D.14 CoA + release gate |
| **ICH Q7 §13** — change control (API) | Changes evaluated for impact | ✗ today | §D.1 |
| **ICH Q1A** — stability | Stability programme informs shelf-life risk | ✗ today | §D.13 |
| **ISO 19011 §5.3** — audit programme | Programme established on a risk basis | ✗ today | §D.2 risk-weighted `AuditScheduleRule` |
| **GAMP 5 (2nd ed)** — risk-based CSV | System validation effort scaled to risk | ✗ today | §D.16 + §C.2 profiles on SYSTEM-scoped registers |
| **FDA Process Validation Guidance §III** | Risk-based identification of CPPs/CQAs | ✗ today | §D.15 test criticality |
| **USP <1058>** — analytical instrument qualification | Instrument risk tiers drive qualification depth | ✗ today | §D.12 / §D.16 |

### I.4 Records, signatures, data integrity

| Standard & clause | Requirement | Status | Delivered by |
|---|---|---|---|
| **21 CFR Part 11** — e-records / e-signatures | Signed, attributable, non-repudiable records | ✓ **already implemented** — `recordSignature()` re-authenticates and writes an `ESignature` + SIGN trail entry on risk acceptance | existing |
| **21 CFR Part 11 / ALCOA+** — audit trail | Every change attributable, contemporaneous, original, accurate | ✓ **already implemented** — `writeTrail` on every risk write; see `docs/AUDIT-TRAIL-ALCOA-compliance-plan.md` | existing |
| **ALCOA+ — Complete** | The record must include the *reason* an action was blocked, not just that it succeeded | ✗ today | §C.3 — every policy block writes a trail entry naming the rule and the offending records |
| **21 CFR 820.100 / ICH Q10** — CAPA closure evidence | Effectiveness verified before closure | ◐ partial | §D.4 training-completion verification gate; §D.5 effectiveness-fail loop |

### I.5 Sector methodologies already supported

`RiskMethodology` covers MATRIX, FMEA, FMECA, HACCP, HAZOP, PHA, FTA, BOWTIE, CUSTOM, and
`RiskScoreFormula` covers PRODUCT, SUM, WEIGHTED_PRODUCT, MATRIX_LOOKUP and AIAG-VDA
ACTION_PRIORITY. **No new methodology work is needed** — §D.11 (worksheet-as-form) is the
only gap, and it exists solely so HACCP and HAZOP worksheets are not forced into the
FMEA-shaped `RiskAssessmentLine`.

---

## J. Complete module coverage

Every backend module in `backend/src/modules/`, with its risk integration or an explicit
statement that none is warranted. Nothing is left unconsidered.

| Module | Integration | Section | Phase |
|---|---|---|---|
| `risk` | *(source)* — entity registry, profile, policy engine, trigger service | C.1–C.4 | 1–4 |
| `ticket` + `workflow` | Change-control gate via evaluable `ActionCriteria`; risk-graded classification; closure → review; risk workflow wrapper | D.1, D.9 | 5 |
| `audit` | Risk-weighted scheduling, risk-driven scoping, finding → risk, repeat-finding feedback | D.2 | 6 |
| `finding` | `raiseChild` gains a RISK kind; severity → severity-rank mapping | D.2 | 4 |
| `audit` (CAPA half) | Reverse panel, closure → review, effectiveness-fail → reopen | D.5 | 8 |
| `dms` | Control-document reverse view, retire/revise guards, risk-graded review period + read receipts, assessment filing | D.3 | 7, 9 |
| `lms` | Administrative control → assignment, verification gate on completion, competency risk, risk-graded course config | D.4 | 7 |
| `approval` | Polymorphic `ApprovalInstance`; risk-graded policy selection | D.10 | 10 *(pull forward)* |
| `dynamic-form` + `stage-form` | Risk-scoring form fields, worksheet-as-form, stage-form gate | D.11 | 10 |
| `qc` | Westgard REJECT → risk; risk-driven rule set + QC interval | D.12 | 11 |
| `stability` | Failing pull → product risk; risk-driven study design warning | D.13 | 11 |
| `coa` | Issue gate on unresolved unacceptable risk | D.14 | 11 |
| `sample` + `sample-testing` | Risk-based sampling level; release/disposition gate; second-person review | D.15, D.14 | 11 |
| `spec-version` | Spec effectiveness → assessment trigger | D.15 | 11 |
| `test-definition` | Test criticality → review requirement | D.15 | 11 |
| `lims` + `lims-master` | Equipment calibration interval, failed-calibration impact, certification expiry → risk, supplier tier | D.16, D.6 | 8, 11 |
| `oos` | Confirmed OOS → auto product risk *(the one recommended `autoCreate: true` rule)* | D.6 | 8 |
| `sla` | `RiskControl.dueDate` / `RiskReview.dueAt` as SLA timers | D.7 | 8 |
| `escalation` | `escalateToRoleId` → `EscalationEvent` in the existing ladder | D.7, C.3 | 3, 8 |
| `notification` | `RISK_*` notification types on assignment, due, overdue, escalation, acceptance | D.7 | 8 |
| `search` | `Risk` + `RiskAssessment` added to `SearchType` | D.8 | 8 |
| `nav-counts` | Overdue-review + unaccepted-unacceptable badge | D.8 | 8 |
| `dashboard` | Heat-map tile, awaiting-acceptance, overdue controls; wire up the existing mock `AuditsRiskSection` | D.8 | 8 |
| `lims-analytics` | Risk overlay on LIMS KPI panels (reuses `RiskProfile`, no new analytics) | D.8 | 8 |
| `organization` + `site` + `department` | `RiskAppetite`, out-of-appetite flagging, management review pack, roll-up profiles | D.17 | 12 |
| `business-calendar` | Review/control due dates resolve through working calendars | D.19 | 12 |
| `access` + `role` + `permission` + `user` | Risk data scoping enforcement, permission-filtered reverse lookup, LMS competency gate on owner/verifier | D.18, G | 13 |
| `auth` | **None warranted.** Risk acceptance already re-authenticates via `recordSignature()`; no further coupling is appropriate | — | — |
| `training` (legacy) | **None — deliberate.** Superseded by `lms`; a migration script already exists | D.20 | — |

**Coverage: 37 of 37 backend modules considered; 35 integrated, 2 deliberately excluded
with a stated reason.**

Frontend surfaces follow from the three shared components — `RiskLinkPanel`,
`RiskLevelBadge`, `AssessRiskButton` — dropped into each module's detail page. No module
gets a bespoke risk UI.
