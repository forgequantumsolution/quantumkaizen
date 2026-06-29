# Quantum Kairoz — LIMS + DMS Phase-by-Phase Implementation Plan

> Status: PLAN (v1, 2026-06-24) · Owner: shriyansh
> Source vision: `quantum-kairoz-platform-stages.html` (10-phase QMS+LIMS lifecycle)
> Branch for this work: `shriyansh-phase-implemenation`

This plan maps the 10-phase platform vision onto the **existing codebase**, identifies
what to **reuse vs. build new**, and lays out an industry-standard (GxP / 21 CFR Part 11 /
ALCOA+) build sequence for the **LIMS**, **DMS**, and remaining modules. It is written to be
executed workstream-by-workstream; each workstream lists data models, APIs, UI, reuse,
regulatory hooks, and acceptance criteria.

---

## A. Current State — what already exists (reuse, don't rebuild)

58 Prisma models across 15 backend modules. The platform primitives below are the
**foundation the LIMS/DMS will be built on**:

| Capability | Models / modules | Reuse for LIMS/DMS |
|---|---|---|
| **Workflow / BPM engine** | `Workflow`, `WorkflowStage`, `WorkflowTransition`, `WorkflowStageAction/Status`, `WorkflowType`, `Ticket`, `TicketFlow`, `TicketStageTracking`, `ParallelBranchTracking`, `ChildWorkflowTrigger` | Drive every stateful lifecycle: sample → test → review → release, stability, deviation, document lifecycle |
| **Approvals** | `ApprovalPolicy`, `ApprovalInstance`, `ApprovalRecord` | Supervisor review, CoA release, document approval, spec approval |
| **SLA + calendars** | `SlaPolicy`, `SlaTimer`, `SlaThreshold`, `SlaExtension`, `BusinessCalendar` | Turnaround-time tracking, stability pull due dates, CAPA due dates |
| **Dynamic forms** | `Form`, `FormSection`, `FormField`, `FieldType`, `FormType`, `FormSubmission`, `StageFormBinding` | Configurable test worksheets, checklists, sample intake forms |
| **QMS records** | `Capa`, `NonConformance`, `ActionItem`, `AuditRegister/Program/Finding`, `AuditMaster`, ISO standards | OOS→CAPA auto-trigger, audit findings→CAPA, deviation handling |
| **Compliance (Part 11)** | `ESignature`, `AuditTrailEntry` | E-sign every GxP-critical action; append-only audit trail on all LIMS records |
| **Org + RBAC** | `User`, `Role`, `Permission` (catalog in `src/lib/rbac-catalog.ts`), `Department`, `Site`, `Organization` | Lab roles, per-module/tab access control (already enforced in nav) |
| **Lookups** | `Priority`, `Severity`, `FieldType`, `ActionType`, `ActionCriteria` | Reuse + add LIMS-specific lookups (units, storage conditions) |

**Architectural takeaways**
- New stateful processes should be **workflow-driven tickets** (raise a ticket on a workflow
  type), not bespoke status machines — reuse approvals/SLA/audit-trail for free. The audit
  module already demonstrates the pattern (`AuditRegister.workflowId` + raised ticket).
- New structured data capture should be **dynamic forms** bound to workflow stages
  (`StageFormBinding`) where the data is free-form; use **typed Prisma models** where the data
  is queried/aggregated (results, specs, QC points).
- Every GxP record integrates `AuditTrailEntry` (append-only) + `ESignature` (meaning-bound).

---

## B. Gap Analysis — 10 phases × current status

| Phase (from vision) | Capability | Status | Plan |
|---|---|---|---|
| 1. Onboarding/Config | Lab Registry, Partner labs, Equipment+Calibration, Certifications, Spec Library, Integrations | **NEW** (RBAC/SOP partial) | **W1 (LIMS master data)** |
| —, cross-cutting | SOP/Document control, Training & competency | **PARTIAL** (only "Document Review" workflow type) | **W2 (DMS)** + **W2b (Training)** |
| 2. Sample Intake | Sample registration, barcode, chain of custody, aliquot/storage, test requests | **NEW** | **W3 (Sample lifecycle)** |
| 3. Analytical Testing | Test worksheets, structured result entry, OOS/OOT, supervisor review/e-sign | **PARTIAL** (forms + approvals + e-sign exist) | **W4 (Testing & results)** |
| 4. Statistical QC | Levey-Jennings, Westgard rules, QC alerts | **NEW** | **W5 (QC charts)** |
| 5. CAPA & Deviation | CAPA, RCA, change control | **BUILT** (audit module) | **W4/W5 wire OOS→CAPA**; minor deviation entry |
| 6. CoA Issuance | Auto CoA, QR verify, archive | **NEW** | **W6 (CoA)** |
| 7. Stability | ICH Q1A protocols, pull reminders, trend | **NEW** | **W7 (Stability)** |
| 8. Audit Management | Scheduling, scoring, heatmap, report | **BUILT** (+ workflow integration) | polish: heatmap + PDF (**W9**) |
| 9. Partner Intelligence | Scorecards, SLA, **AI Lab Finder** | **NEW** | **W8 (Partner + AI)** |
| 10. Continuous Improvement | KPI dashboards, PQR/APR, mgmt review | **PARTIAL** (audit dashboard) | **W9 (Analytics/PQR)** |
| cross | ERP/instrument integrations | **NEW** | **W10 (Integrations)** |

---

## C. Cross-cutting GxP / engineering principles (apply to every workstream)

1. **Data integrity (ALCOA+).** All GxP records are Attributable, Legible, Contemporaneous,
   Original, Accurate (+ Complete, Consistent, Enduring, Available). Concretely:
   - Append-only `AuditTrailEntry` on create/update/transition/sign/delete of every LIMS record
     (reuse `writeTrail` from `audit/compliance.service`). No hard deletes of GxP data — soft
     delete (`isDeleted`, `deletedAt`, `deletedById`).
   - Server-stamped timestamps only (never trust client clocks); UTC stored, site-tz displayed.
2. **21 CFR Part 11 e-signatures.** Reuse `ESignature` (meaning + userName snapshot). Require
   re-auth (password) for any "approve / release / sign-off / verify" action. Each signature
   carries a *meaning* string (e.g. "Reviewed", "Approved & Released", "Verified").
3. **Reuse the workflow engine** for any multi-step, role-gated, approvable process. Add new
   `WorkflowType`s (Sample Testing, Stability, Document Control, Deviation) seeded in `seed.ts`.
4. **Master-data driven & config-first.** Specs, methods, equipment, storage conditions, units
   are master data — no hard-coding. Mirror the audit `AuditMaster` pattern.
5. **Numbering service.** One shared sequence helper (extend the audit `nextSeq`) for all
   human IDs: `SMP-2026-0001`, `WS-…`, `COA-…`, `STB-…`, `SOP-…`, `DOC-…`. Per-site/per-year,
   gap-free, collision-safe (transaction + count or a dedicated `Sequence` table).
6. **RBAC + nav access** already exists — every new module gets permission keys in
   `src/lib/rbac-catalog.ts` (auto-synced to SUPER_ADMIN) and entries in `client/src/lib/navAccess.ts`.
7. **Multi-site / multi-lab tenancy.** Most LIMS records carry `siteId` / `labId`; list/scope
   queries respect the user's site visibility.
8. **Schema hygiene.** Prefix LIMS models clearly (e.g. `Lab*`, `Sample*`, `Spec*`, `Qc*`,
   `Stability*`, `Coa*`); DMS models `Doc*`. Each migration is additive and self-contained.

---

## D. Build sequence (workstreams, in dependency order)

Each workstream is independently shippable. Effort is a rough engineering estimate (1 dev).

### W0 — Foundation prep (½ week) — *do first*
- **Shared `Sequence` table + numbering service** (`backend/src/lib/sequence.ts`) — replaces
  ad-hoc `AR-YYYY-NNNN` logic; used by all new modules.
- **LIMS lookups**: `UnitOfMeasure`, `StorageCondition` (e.g. 25°C/60%RH), `TestParameterType`.
- **Seed new `WorkflowType`s**: `Sample Testing`, `Stability Study`, `Document Control`,
  `Deviation` (CAPA/Change Control already exist).
- **RBAC**: add permission keys for every module below to `rbac-catalog.ts`.
- Acceptance: numbering helper unit-tested; lookups CRUD; SUPER_ADMIN holds new keys.

### W1 — LIMS master data (Phase 1) (1.5–2 weeks)
Foundational reference data everything else points at.
- **Models**: `Lab` (internal/partner, GMP class, site code, accreditation), `Equipment`
  (instrument, owner, capability matrix) + `CalibrationRecord` (frequency, due, status),
  `Certification` (type GMP/NABL/ISO/USFDA, number, validity, owner) + expiry alert job,
  `TestMethod` (SOP ref, parameters), `Specification` + `SpecParameter` (per-parameter
  min/max/target, unit, method link, pharmacopoeia ref), `SpecificationVersion` (approved
  versions — specs are controlled).
- **APIs**: CRUD for each + `GET /labs`, `/equipment`, `/specifications/:id` (with parameters).
  Spec approval = workflow ticket (Document Control type) or `ApprovalPolicy`.
- **Frontend**: a new "Labs" / "Masters" module area (mirror audit config layout): Lab Registry,
  Equipment + Calibration calendar, Certifications tracker (expiry dashboard), Specification
  Library builder (sections of parameters with limits).
- **Reuse**: numbering, audit trail, e-sign on spec approval, `BusinessCalendar` for calibration
  due dates, the Certifications expiry-alert reuses the SLA/cron sweep pattern.
- **Regulatory**: spec/method changes are version-controlled + e-signed; calibration overdue →
  equipment flagged "not for use".
- **Acceptance**: register a lab, instrument with calibration schedule, a 3-parameter spec with
  limits, a certification with a 30-day expiry alert firing.

### W2 — DMS: controlled document management (cross-cutting, high priority) (2–3 weeks)
A true controlled-document repository (SOPs, policies, specs-as-documents) — distinct from the
data-capture `Form` module.
- **Models**: `Document` (doc number, title, type SOP/Policy/Protocol/Form/WI, owner, dept,
  status DRAFT/IN_REVIEW/APPROVED/EFFECTIVE/SUPERSEDED/RETIRED, effectiveDate, reviewDueDate),
  `DocumentVersion` (version, file ref, change summary, author), `DocumentApproval` (reuse
  ApprovalPolicy/Instance), `DocumentDistribution` (controlled-copy recipients / read-ack),
  `DocumentReadReceipt` (read-and-understood, links to Training).
- **Lifecycle = workflow** ("Document Control" WorkflowType): Draft → Review → Approve (e-sign)
  → Effective → Periodic Review (scheduled) → Revise/Supersede/Retire.
- **APIs**: document CRUD + version upload, `POST /documents/:id/issue` (make effective + notify
  distribution), `POST /documents/:id/acknowledge` (read receipt), periodic-review cron.
- **Frontend**: DMS module — document list (by type/status/owner), version history, viewer,
  "my pending reads", periodic-review queue, approval via existing approval UI.
- **Reuse**: workflow engine for lifecycle, approvals + e-sign, audit trail, file storage
  (extend `TicketDoc` storage approach), SLA for review-due reminders.
- **Regulatory**: only one EFFECTIVE version at a time; superseded versions retained read-only;
  controlled distribution + read-and-understood logs; periodic review enforced.
- **Acceptance**: author an SOP, route for approval, e-sign to make effective, assign read-ack to
  a role, see periodic-review reminder.

### W2b — Training & Competency (1–1.5 weeks) — *pairs with W2*
- **Models**: `TrainingItem` (links to `Document` or course), `TrainingAssignment`
  (user, item, due, status), `CompetencyAssessment`, `TrainingMatrix` (role → required items).
- **Reuse**: read receipts from DMS feed training completion; role→requirement mapping uses RBAC.
- **Acceptance**: assign SOP read-training to a role; completion recorded on read-ack; matrix
  shows gaps.

### W3 — Sample lifecycle & chain of custody (Phase 2) (2–2.5 weeks)
- **Models**: `Sample` (barcode/unique id, product, batch, source site, collection date,
  spec link, status), `Aliquot` (parent sample, storage location, temp zone, expiry),
  `CustodyEvent` (append-only: handler, from→to location, timestamp, action),
  `StorageLocation` (freezer/zone, temp), `TestRequest` (sample → tests requested, pricing,
  priority).
- **Barcode**: generate + render (QR/Code128) on registration; scan endpoint resolves to sample.
- **Lifecycle = workflow** ("Sample Testing" type): Registered → In Testing → In Review →
  Released / Rejected.
- **APIs**: `POST /samples` (auto worksheet assignment), `/samples/:id/custody`, `/aliquots`,
  `/test-requests` (+ auto-pricing from method price list).
- **Frontend**: sample intake form, sample detail (custody timeline — reuse the ticket form-history
  timeline pattern), storage map, test-request board.
- **Reuse**: numbering, audit trail = custody backbone, forms for intake, workflow for status.
- **Regulatory**: unbroken custody chain — any gap flagged as data-integrity event (→ deviation).
- **Acceptance**: register a sample (barcode), create 2 aliquots to storage, full custody trail,
  auto-generated worksheet + priced test request.

### W4 — Analytical testing, results & OOS/OOT (Phase 3) (2.5–3 weeks)
- **Models**: `TestWorksheet` (sample, method, analyst, status), `TestResult` (parameter, value,
  unit, entered-by, instrument link), `ResultEvaluation` (PASS / OOS / OOT, auto-computed vs
  spec), `OosEvent` (links result → CAPA). Worksheet structure can also be a bound `Form` for
  configurable layouts; **results are typed models** (queried for QC/trend).
- **OOS/OOT engine**: on result save, compare to `SpecParameter` limits → flag; OOT via trend
  rules (see W5). OOS auto-creates a `Capa`/deviation (reuse existing CAPA) and blocks progress
  until acknowledged.
- **Supervisor review**: stage transition gated by `ApprovalPolicy` + e-sign (reuse) → unlocks CoA.
- **APIs**: `POST /worksheets/:id/results` (batch), evaluation runs server-side; `/oos-events`.
- **Frontend**: analyst worksheet (spec limits inline, structured entry, instrument import),
  live OOS banner, supervisor review/e-sign screen.
- **Reuse**: approvals, e-sign, CAPA auto-trigger, audit trail, forms for non-numeric capture.
- **Regulatory**: zero-latency OOS flag; analyst cannot bypass; e-signed review; full trail.
- **Acceptance**: enter results, breach a limit → OOS flagged + CAPA created + progress blocked;
  supervisor e-signs; CoA becomes available.

### W5 — Statistical QC (Levey-Jennings + Westgard) (Phase 4) (1.5–2 weeks)
- **Models**: `QcControlPoint` (parameter/method, value, run, date), `QcChartConfig` (mean, SD,
  ±1/2/3SD), `WestgardEvaluation` (rule 1-3s/1-2s/10-mean, pass/violation), `QcViolation`
  (→ alert/investigation).
- **Engine**: every `TestResult` (or dedicated QC sample) feeds the L-J series; Westgard rules
  evaluated on each point; violation → alert (Lab Head) + optional CAPA.
- **Frontend**: L-J chart per parameter (mean/SD bands), violation list, investigation link.
- **Reuse**: charting libs already in client (audit dashboards), CAPA, alerting/cron.
- **Acceptance**: 20 points plotted; a 1-3s breach raises a violation + alert; 10-mean drift
  detected before OOS.

### W6 — Certificate of Analysis (Phase 6) (1.5 weeks)
- **Models**: `Coa` (sample, version, results snapshot, analyst+reviewer identities, status,
  QR token, issuedAt, archive ref).
- **Engine**: auto-generate from approved worksheet (snapshot results + signatures); render PDF;
  embed QR linking to a **public verification endpoint** that confirms authenticity.
- **APIs**: `POST /coa/from-worksheet/:id`, `GET /coa/:id/pdf`, `GET /public/coa/verify/:token`.
- **Frontend**: CoA preview/issue, issued-CoA archive, public verify page.
- **Reuse**: PDF/report service (extend audit report PDF), e-sign, audit trail, numbering.
- **Acceptance**: approve worksheet → CoA auto-populated → issue with QR → scan verifies live.

### W7 — Stability studies (Phase 7) (2 weeks)
- **Models**: `StabilityStudy` (product, batch, protocol, status), `StabilityProtocol`
  (ICH Q1A conditions + timepoints 0/3/6/12/24/36m), `StabilityTimepoint` (due date, pull
  status, linked worksheet), `StabilityTrend` (per-parameter degradation series).
- **Lifecycle = workflow** ("Stability Study" type) + SLA-driven pull reminders (7/3 days before).
- **APIs**: protocol setup, timepoint scheduling, pull reminders cron, trend aggregation; feeds
  PQR (W9). Stability failure → deviation/CAPA.
- **Frontend**: study setup, timepoint calendar, pull reminders, trend charts (shelf-life).
- **Reuse**: workflow, SLA/cron reminders, worksheets (W4), CAPA, charts.
- **Acceptance**: define a protocol; pull reminders fire; timepoint results trend; an OOT trend
  flags shelf-life risk; data exportable for APR.

### W8 — Partner intelligence + AI Lab Finder (Phase 9) (2 weeks)
- **Models**: `PartnerScorecard` (quality, TAT, CAPA closure, compliance — derived metrics),
  `PartnerSla`, `LabCapability` (test → lab capability + accreditation).
- **AI Lab Finder**: ranking service scoring labs by capability match + live certification status
  + recent audit score + open CAPA count + TAT + proximity. Start rules-based/weighted scoring;
  optionally call Claude (Anthropic API) for natural-language requirement → ranked recommendation
  with risk flags. (If/when adding an LLM, use the latest Claude model.)
- **Frontend**: partner scorecards (radar), SLA tracking, partner portal view (scoped access),
  AI Lab Finder search → ranked results with rationale.
- **Reuse**: partner data from W1 labs, audit scores, CAPA, RBAC for partner-scoped access.
- **Acceptance**: scorecards compute from live data; Lab Finder ranks labs for a given test with
  explainable factors.

### W9 — Analytics, PQR/APR & management review (Phase 10, + Phase 8 polish) (2 weeks)
- **Models**: mostly aggregation/materialized views; `PqrDataset` (compiled per product/period),
  `KpiPin` (per-user pinned KPIs).
- **Engine**: cross-module aggregation (OOS rate, CAPA cycle time, audit scores, stability,
  cert health); Annual Product Review compiler (ICH Q10); one-click management-review pack (PDF).
- **Frontend**: multi-site command-centre dashboard (extend existing dashboard), pinnable KPI
  cards, PQR builder, audit finding **heatmap** + submission-ready PDF (Phase 8 polish).
- **Reuse**: existing dashboard/charts, audit data, report PDF service.
- **Acceptance**: live KPI dashboard across sites; PQR dataset compiles; mgmt-review pack exports.

### W10 — Integrations (ERP / instruments) (cross-cutting, 2–3 weeks; can run parallel later)
- **Connectors**: SAP/Oracle/MES (sample/batch master in, results out), instrument data import
  (CSV/LIMS-standard) into worksheets. Inbound webhook + outbound event bus.
- **Models**: `Integration` (connector config), `IntegrationLog` (audit of exchanges).
- **Reuse**: worker/queue infra (BullMQ) already present for jobs.
- **Acceptance**: a mock instrument file imports results to a worksheet; an ERP batch creates a
  sample.

---

## E. Recommended sequencing & milestones

```
M1 (Foundations)      W0 → W1                         [LIMS master data live]
M2 (Documents/People) W2 (DMS) + W2b (Training)       [controlled docs + training]
M3 (Core LIMS flow)   W3 → W4 → W6                    [sample → test → CoA, with OOS→CAPA]
M4 (Quality science)  W5 (QC) + W7 (Stability)        [L-J/Westgard + stability]
M5 (Intelligence)     W8 (Partner/AI) + W9 (Analytics)[scorecards, AI finder, PQR, dashboards]
M6 (Integrations)     W10                              [ERP/instrument connectors]
```

Rationale: master data (W1) and the sample→test→CoA spine (M3) deliver the demoable LIMS core
fastest; DMS (M2) is high-value and decoupled so it can run in parallel with M3 if a second dev
is available. QC/stability build on results from M3. Analytics/AI come last (need data to be
meaningful).

---

## F. Immediate next steps (to start now)

1. **W0**: add `backend/src/lib/sequence.ts` (+ optional `Sequence` model & migration), seed the
   new `WorkflowType`s, add LIMS lookups, and register all new permission keys in
   `src/lib/rbac-catalog.ts` + `client/src/lib/navAccess.ts`.
2. **W1 schema**: draft the Prisma models for `Lab`, `Equipment`/`CalibrationRecord`,
   `Certification`, `TestMethod`, `Specification`/`SpecParameter`/`SpecificationVersion` in one
   additive migration; scaffold the backend module (`backend/src/modules/lims-masters/`) and a
   client feature area (`client/src/features/lims/`).
3. Stand up the **Lab Registry + Specification Library** UI first (most-referenced master data).
4. Each PR: additive migration + module + RBAC keys + nav entry + audit-trail wiring + tests.

---

## G. Conventions checklist (per workstream PR)

- [ ] Additive, self-contained Prisma migration; soft-delete on GxP records.
- [ ] Numbering via shared sequence service.
- [ ] `AuditTrailEntry` on create/update/transition/sign/delete.
- [ ] `ESignature` (with meaning + re-auth) on every approve/release/verify.
- [ ] Permission keys in `rbac-catalog.ts` (+ nav entry in `navAccess.ts`).
- [ ] Stateful processes raised as workflow tickets where possible.
- [ ] Site/lab scoping on list endpoints.
- [ ] Unit/integration tests for evaluation engines (OOS, Westgard, numbering).
```
