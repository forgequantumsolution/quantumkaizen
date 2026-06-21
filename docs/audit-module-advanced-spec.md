# Advanced Audit Module — Design Specification

**Status:** Draft for review
**Author:** Generated for ForgeQuantum / Quantum Kaizen
**Date:** 2026-06-19
**Goal:** Evolve the existing audit module (~40% complete) into a TrackWise / Veeva Vault QMS–class audit management system, usable across **all industries** (Manufacturing/ISO 9001, Food/FSSC/HACCP, Pharma/Medical GxP, and generic) via **configuration**, not forks.

---

## 0. Design principles

1. **Config-driven, not industry-forked.** One codebase. Industry behavior is switched on per-tenant via an `AuditConfig` (feature flags + taxonomies). A pharma tenant turns on e-signatures + audit trail; a manufacturing tenant may not.
2. **ISO 19011 lifecycle as the spine.** Initiate → Prepare → Conduct → Report → Follow-up. Every state machine mirrors this.
3. **Objects, not pages.** Audit, Finding, NC, CAPA, Action Item are first-class records with their own lists, detail workspaces, and APIs — the TrackWise/Veeva pattern. Findings are no longer buried inside the program page.
4. **Tabbed record workspace.** Each audit opens into one workspace with tabs: Details · Checklist · Findings · Evidence · CAPA/Actions · Approvals & Signatures · Audit Trail. Status banner + role-driven action buttons on top.
5. **Keep the current look.** Ant Design + Tailwind, existing badge components, React Query + Zustand. We adopt the *structure*, not a visual redesign.
6. **Backward compatible.** Existing models (`AuditRegister`, `AuditProgram`, `AuditFinding`, `NonConformance`, `IsoStandard`) are extended, not replaced. Existing routes keep working during migration.

---

## 1. Tenant configuration model

Drives which features are visible/required per industry.

```prisma
model AuditConfig {
  id                  String  @id @default(uuid())
  // --- feature flags ---
  eSignaturesEnabled  Boolean @default(false)   // 21 CFR Part 11
  auditTrailEnabled   Boolean @default(true)
  riskBasedPlanning   Boolean @default(false)
  scoringEnabled      Boolean @default(true)
  capaModuleEnabled   Boolean @default(true)
  recurrenceEnabled   Boolean @default(true)
  // --- taxonomies (industry vocab) ---
  findingSeverities   Json    // [{key, label, color, slaDays}] overrides default enum
  ncCategories        Json    // [{key, label}]  e.g. HACCP CCP deviation, GMP deviation
  capaTypes           Json    // [{key, label}]  corrective / preventive / both
  // --- defaults ---
  defaultIndustry     String  // MANUFACTURING | FOOD | PHARMA | GENERIC
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}
```

> Severity/category taxonomies are stored as JSON so a Food tenant can use "CCP / Major / Minor" while a Pharma tenant uses "Critical / Major / Minor / Observation" without schema changes. The default enums remain the fallback.

---

## 2. Data model additions

All new models. Existing models extended in §2.9.

### 2.1 Audit program plan (annual / rolling plan)

```prisma
model AuditProgramPlan {
  id            String   @id @default(uuid())
  name          String                       // "FY2026 Internal Audit Programme"
  financialYear String
  status        AuditPlanStatus @default(DRAFT)  // DRAFT|ACTIVE|CLOSED
  riskBased     Boolean  @default(false)
  ownerId       String?
  owner         User?    @relation(fields: [ownerId], references: [id], onDelete: SetNull)
  registers     AuditRegister[]              // audits that belong to this plan
  scheduleRules AuditScheduleRule[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
enum AuditPlanStatus { DRAFT ACTIVE CLOSED }
```

### 2.2 Recurrence / scheduling rule

```prisma
model AuditScheduleRule {
  id            String   @id @default(uuid())
  planId        String?
  plan          AuditProgramPlan? @relation(fields: [planId], references: [id], onDelete: SetNull)
  auditMasterId String                       // template to spawn from
  auditMaster   AuditMaster @relation(fields: [auditMasterId], references: [id], onDelete: Cascade)
  frequency     AuditFrequency               // reuse existing enum
  anchorDate    DateTime                     // first occurrence
  leadTimeDays  Int      @default(14)        // auto-create register N days before due
  scopeSnapshot Json?                        // plant/dept/focus areas to copy onto each spawn
  defaultAuditorId String?
  isActive      Boolean  @default(true)
  lastSpawnedAt DateTime?
  nextRunAt     DateTime
  createdAt     DateTime @default(now())
  @@index([isActive, nextRunAt])
}
```

> A BullMQ worker (you already run SLA + approval-deadline workers) sweeps `nextRunAt <= now` and creates a DRAFT `AuditRegister`, then advances `nextRunAt` by frequency.

### 2.3 Checklist templates & question bank

```prisma
model ChecklistTemplate {
  id          String   @id @default(uuid())
  templateKey String                         // groups versions
  title       String
  version     Int      @default(1)
  status      TemplateStatus @default(DRAFT) // DRAFT|PUBLISHED|ARCHIVED
  auditType   String?                        // links to AuditTypeMaster
  isoStandardId String?
  scoringMode ScoringMode @default(NONE)     // NONE|WEIGHTED|PERCENT
  passThreshold Float?                       // e.g. 80 = 80%
  sections    ChecklistSection[]
  createdById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([templateKey, version])
}
enum TemplateStatus { DRAFT PUBLISHED ARCHIVED }
enum ScoringMode { NONE WEIGHTED PERCENT }

model ChecklistSection {
  id          String @id @default(uuid())
  templateId  String
  template    ChecklistTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  title       String
  position    Int    @default(0)
  questions   ChecklistQuestion[]
}

model ChecklistQuestion {
  id             String @id @default(uuid())
  sectionId      String
  section        ChecklistSection @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  text           String
  responseType   ResponseType                // YESNO|SCALE|TEXT|NUMERIC|SINGLE_SELECT
  options        Json?                       // for select/scale
  weight         Float  @default(1)
  isoSubClauseId String?                     // link to ISO clause for traceability
  expectedAnswer String?
  guidance       String?                     // auditor help text
  allowNa        Boolean @default(true)
  position       Int    @default(0)
}
enum ResponseType { YESNO SCALE TEXT NUMERIC SINGLE_SELECT }
```

### 2.4 Checklist execution (responses)

```prisma
model ChecklistResponse {
  id          String @id @default(uuid())
  programId   String
  program     AuditProgram @relation(fields: [programId], references: [id], onDelete: Cascade)
  questionId  String
  questionSnapshot Json                      // frozen question text/weight at execution time
  answer      Json                           // value per responseType
  score       Float?                         // computed
  isFinding   Boolean @default(false)        // flagged non-conformance
  findingId   String?                        // link if a finding was raised
  note        String?
  respondedById String?
  respondedAt DateTime @default(now())
  @@index([programId])
}
```

> **This closes the biggest execution gap.** Findings can now be raised *from* a checklist item (traceable to ISO clause), and scoring rolls up to section + audit score automatically.

### 2.5 CAPA — first-class object

```prisma
model Capa {
  id             String @id @default(uuid())
  capaNumber     String @unique              // CAPA-YYYY-XXXX
  type           CapaType                    // CORRECTIVE|PREVENTIVE|BOTH
  status         CapaStatus @default(OPEN)
  title          String
  sourceNcId     String?                     // origin non-conformance
  sourceNc       NonConformance? @relation(fields: [sourceNcId], references: [id], onDelete: SetNull)
  rootCause      String?                     // RCA narrative / 5-why JSON
  rootCauseData  Json?                       // structured 5-why / fishbone
  correctiveAction String?
  preventiveAction String?
  ownerId        String?
  owner          User?  @relation("CapaOwner", fields: [ownerId], references: [id], onDelete: SetNull)
  dueDate        DateTime?
  implementedAt  DateTime?
  verifiedById   String?
  verifiedAt     DateTime?
  effectivenessCheck String?                 // verification narrative
  effectivenessDue DateTime?
  actionItems    ActionItem[]
  attachments    AuditAttachment[]
  createdById    String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  @@index([status])
}
enum CapaType { CORRECTIVE PREVENTIVE BOTH }
enum CapaStatus { OPEN INVESTIGATION PLAN IMPLEMENTATION VERIFICATION CLOSED CANCELLED }
```

> When a CAPA reaches `CLOSED`, a hook moves the linked `NonConformance` to `VERIFICATION`/`CLOSED` — closing the sync gap.

### 2.6 Action items (lightweight tasks)

```prisma
model ActionItem {
  id          String @id @default(uuid())
  title       String
  description String?
  status      ActionStatus @default(OPEN)    // OPEN|IN_PROGRESS|DONE|VERIFIED|CANCELLED
  priority    ActionPriority @default(MEDIUM)
  ownerId     String?
  owner       User? @relation(fields: [ownerId], references: [id], onDelete: SetNull)
  dueDate     DateTime?
  completedAt DateTime?
  // polymorphic parent — one of:
  capaId      String?
  capa        Capa? @relation(fields: [capaId], references: [id], onDelete: Cascade)
  ncId        String?
  findingId   String?
  registerId  String?
  createdById String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([status, dueDate])
  @@index([ownerId])
}
enum ActionStatus { OPEN IN_PROGRESS DONE VERIFIED CANCELLED }
enum ActionPriority { LOW MEDIUM HIGH CRITICAL }
```

### 2.7 Evidence / attachments

```prisma
model AuditAttachment {
  id          String @id @default(uuid())
  fileName    String
  fileUrl     String                         // S3/MinIO key (you already run MinIO)
  mimeType    String?
  sizeBytes   Int?
  // polymorphic owner
  findingId   String?
  finding     AuditFinding? @relation(fields: [findingId], references: [id], onDelete: Cascade)
  registerId  String?
  capaId      String?
  capa        Capa? @relation(fields: [capaId], references: [id], onDelete: Cascade)
  responseId  String?
  uploadedById String?
  uploadedAt  DateTime @default(now())
}
```

### 2.8 Compliance: audit trail + e-signatures

```prisma
model AuditTrailEntry {
  id          String @id @default(uuid())
  entityType  String                         // "AuditRegister" | "Capa" | ...
  entityId    String
  action      String                         // CREATE|UPDATE|TRANSITION|SIGN|DELETE
  field       String?
  oldValue    String?
  newValue    String?
  reason      String?                        // change reason (Part 11)
  userId      String?
  userName    String                         // denormalized — immutable even if user deleted
  createdAt   DateTime @default(now())
  @@index([entityType, entityId])
}

model ESignature {
  id          String @id @default(uuid())
  entityType  String
  entityId    String
  meaning     String                         // "Approved", "Reviewed", "Closed"
  userId      String
  userName    String
  signedAt    DateTime @default(now())
  // verification handled at app layer via User.signaturePinHash
  @@index([entityType, entityId])
}
```

> Both are **append-only** (no update/delete endpoints). The audit trail is written by a Prisma middleware/service wrapper on every mutating audit operation when `auditTrailEnabled`.

### 2.9 Extensions to existing models

- `AuditRegister`: add `planId`, `riskScore Float?`, `riskLevel String?`, `closedAt`, `closedById`, `followUpOfId String?` (self-relation for repeat audits), `checklistTemplateId String?`.
- `AuditProgram`: add `closedAt`, `responses ChecklistResponse[]`, `overallScore Float?`, `scorePercent Float?`, `passed Boolean?`.
- `AuditFinding`: add `category String?`, `responseId String?`, `attachments AuditAttachment[]`, `targetCloseDate DateTime?`.
- `NonConformance`: add `category String?`, `capas Capa[]`, `rootCause String?`.
- `AuditStatus`: ensure `CLOSED` transition is actually used.

---

## 3. State machines

```
Plan:       DRAFT → ACTIVE → CLOSED
Register:   DRAFT → PENDING_APPROVAL → APPROVED → IN_PROGRESS → COMPLETED → CLOSED
                          ↘ REJECTED → DRAFT
Program:    PLANNED → IN_PROGRESS → COMPLETED → CLOSED
Finding:    OPEN → IN_REVIEW → ACCEPTED → CLOSED   (ACCEPTED can → promote NC)
                          ↘ REJECTED
NC:         OPEN → CAPA_RAISED → IN_PROGRESS → VERIFICATION → CLOSED  (↘ CANCELLED)
CAPA:       OPEN → INVESTIGATION → PLAN → IMPLEMENTATION → VERIFICATION → CLOSED  (↘ CANCELLED)
ActionItem: OPEN → IN_PROGRESS → DONE → VERIFIED  (↘ CANCELLED)
```

**Transition gates** (config-driven):
- When `eSignaturesEnabled`: closing an audit, approving a register, closing a CAPA require an `ESignature` (PIN re-auth).
- When `auditTrailEnabled`: every transition writes an `AuditTrailEntry`.
- CAPA `CLOSED` → auto-advance linked NC; all NCs of a register `CLOSED` → register eligible for `CLOSED`.

---

## 4. API surface (additions)

Keep `/api/audit/...` prefix and the existing permission pattern (`module.resource.action`).

### Plans & scheduling
```
GET    /api/audit/plans
POST   /api/audit/plans
PUT    /api/audit/plans/:id
POST   /api/audit/plans/:id/activate
GET    /api/audit/schedule-rules
POST   /api/audit/schedule-rules
PUT    /api/audit/schedule-rules/:id
GET    /api/audit/calendar?from=&to=        // calendar feed of planned audits
```

### Checklist templates
```
GET    /api/audit/checklist-templates
GET    /api/audit/checklist-templates/:id
POST   /api/audit/checklist-templates
PUT    /api/audit/checklist-templates/:id
POST   /api/audit/checklist-templates/:id/publish
POST   /api/audit/checklist-templates/:id/clone   // new version
```

### Execution (responses)
```
GET    /api/audit/programs/:id/checklist          // questions + saved responses
PUT    /api/audit/programs/:id/responses          // bulk upsert (offline-friendly)
POST   /api/audit/programs/:id/responses/:qid/raise-finding
GET    /api/audit/programs/:id/score              // computed rollup
```

### CAPA
```
GET    /api/audit/capas
GET    /api/audit/capas/:id
POST   /api/audit/capas                            // optionally from ?ncId=
PUT    /api/audit/capas/:id
PATCH  /api/audit/capas/:id/status
POST   /api/audit/capas/:id/verify                 // effectiveness check + sign
```

### Action items
```
GET    /api/audit/action-items?owner=&status=&parent=
POST   /api/audit/action-items
PATCH  /api/audit/action-items/:id/status
GET    /api/audit/my-tasks                          // dashboard inbox
```

### Evidence
```
POST   /api/audit/attachments                       // presigned MinIO upload
DELETE /api/audit/attachments/:id
```

### Reporting & dashboard
```
GET    /api/audit/dashboard/kpis
GET    /api/audit/dashboard/trends?metric=
GET    /api/audit/registers/:id/report              // generate PDF
```

### Compliance
```
GET    /api/audit/:entityType/:id/trail             // audit trail (read-only)
POST   /api/audit/signatures                         // record e-signature (PIN verified)
GET    /api/audit/config                             // tenant AuditConfig
PUT    /api/audit/config
```

New permissions: `audit_plan.*`, `checklist_template.*`, `capa.*`, `action_item.*`, `audit_report.read`, `audit_config.update`, plus split `audit_register.submit` / `.reject` from `.approve`.

---

## 5. Screen-by-screen UI spec

### 5.1 Navigation restructure

**Operations layout** (`AuditModuleLayout`) — left/tab nav:
| Item | Route | Status |
|---|---|---|
| Dashboard | `/audit/dashboard` | **new** |
| Schedule / Calendar | `/audit/schedule` | **new** |
| Audit Register | `/audit/register` | exists |
| Audit Programs | `/audit/program` | exists |
| Findings | `/audit/findings` | **new** (promote from inside program) |
| Non-Conformance | `/audit/non-conformance` | exists |
| CAPA | `/audit/capa` | **new** |
| Action Items | `/audit/actions` | **new** |
| Reports | `/audit/reports` | **new** |

**Config layout** (`AuditConfigLayout`):
| Item | Route | Status |
|---|---|---|
| Audit Masters | `/audit/master` | exists |
| Checklist Templates | `/audit/checklists` | **new** |
| ISO Standards | `/audit/iso-standards` | exists |
| Audit Types | `/audit/audit-types` | exists |
| Focus Areas | `/audit/focus-areas` | exists |
| Audit Settings | `/audit/settings` | **new** (AuditConfig flags/taxonomies) |

### 5.2 Dashboard (`/audit/dashboard`) — new

- **KPI cards:** Audits planned vs completed (this FY), On-time completion %, Open findings by severity, Overdue CAPAs, Average audit score.
- **My Tasks inbox:** audits assigned to me, findings to review, CAPAs/actions due (from `/my-tasks`).
- **Charts** (Recharts — already a dependency): findings-by-severity over time, CAPA aging buckets, audit score trend by site/auditor, NC closure rate.
- Filters: financial year, plant, audit type.

### 5.3 Schedule / Calendar (`/audit/schedule`) — new

- **Calendar view** (month/quarter/year) of planned audits, color-coded by status.
- **Annual program panel:** list of `AuditProgramPlan`s; create plan, attach schedule rules.
- **Schedule-rule editor:** pick audit master + frequency + anchor → preview the generated occurrences; toggle active.
- Overdue / upcoming audit chips.

### 5.4 Audit record workspace (the key pattern) — `/audit/register/:id`

Replace the current single detail page with a **tabbed workspace**:

```
┌──────────────────────────────────────────────────────────────┐
│ AR-2026-0001 · Internal Audit – Packaging Line   [APPROVED ▸]  │  ← status banner
│ Lead: J. Doe · Planned: 12 Jul · Score: 86%   [Start][Report]  │  ← role-driven actions
├──────────────────────────────────────────────────────────────┤
│ Details │ Checklist │ Findings │ Evidence │ CAPA/Actions │     │  ← tabs
│ Approvals & Signatures │ Audit Trail │                         │
└──────────────────────────────────────────────────────────────┘
```

- **Details:** scope, team (lead/auditors/auditee), dates, type, ISO standard, linked plan, risk score. (Existing form fields, reorganized.)
- **Checklist:** the execution grid — sections → questions, response inputs, per-question score, "Raise finding" button, evidence attach per item. Section + overall score rollup at top. Offline-friendly bulk save.
- **Findings:** child list of findings for this audit (severity/status chips), inline add/edit drawer (existing `FindingDrawer`, extended with category + attachments + ISO clause select).
- **Evidence:** gallery of all attachments across findings/checklist.
- **CAPA/Actions:** linked CAPAs + action items, with create-from-finding flow.
- **Approvals & Signatures:** approval timeline (exists) + e-signature log when enabled.
- **Audit Trail:** read-only change log (when `auditTrailEnabled`).

### 5.5 Findings list (`/audit/findings`) — new

Cross-audit findings list with filters (severity, status, audit, clause, owner). Each row → finding detail drawer. "Promote to NC" and "Create CAPA" actions.

### 5.6 CAPA workspace (`/audit/capa` + `/audit/capa/:id`) — new

- List with status/type/owner/due filters, overdue highlighting.
- Detail workspace tabs: **Details · Root Cause (5-Why/Fishbone) · Actions · Verification · Evidence · Audit Trail**.
- RCA tab supports structured 5-Why (stored in `rootCauseData`).
- Verification tab: effectiveness check narrative + sign-off (e-signature when enabled) → closes CAPA → syncs NC.

### 5.7 Action Items (`/audit/actions`) — new

- Kanban or list by status (OPEN/IN_PROGRESS/DONE/VERIFIED).
- "My actions" default filter. Create from any finding/NC/CAPA.

### 5.8 Checklist Template builder (`/audit/checklists`) — new (config)

- Template list (versioned, publish/clone).
- Builder: sections → questions, set response type, weight, ISO clause link, guidance, scoring mode + pass threshold. Mirrors your existing ISO-standard nested-editor pattern.

### 5.9 Audit Settings (`/audit/settings`) — new (config)

- Feature flags (e-signatures, audit trail, risk-based planning, scoring, recurrence).
- Taxonomy editors (severities, NC categories, CAPA types) — drives the JSON in `AuditConfig`.

---

## 6. Phased delivery plan

Each phase ships independently and leaves the app working.

### Phase 1 — Execution depth (highest ROI)
- Checklist templates + question bank (`ChecklistTemplate/Section/Question`) + builder UI.
- Scored checklist execution (`ChecklistResponse`) wired into program workspace; score rollup.
- Findings raised from checklist items; dedicated Findings list.
- Evidence/attachment upload (MinIO presigned) on findings + checklist items.
- **Refactor register detail → tabbed workspace.**

### Phase 2 — CAPA & Action Items as first-class objects
- `Capa` model + lifecycle + workspace (RCA, verification, NC sync).
- `ActionItem` model + list/kanban + "create from finding/NC/CAPA".
- Verification/closure gates; auto-advance NC on CAPA close.

### Phase 3 — Scheduling & dashboard
- `AuditProgramPlan` + `AuditScheduleRule` + BullMQ recurrence worker.
- Calendar / annual program view.
- Dashboard KPIs + trend charts + My Tasks inbox.

### Phase 4 — Compliance & reporting (regulated industries)
- `AuditConfig` + Settings screen (feature flags + taxonomies).
- E-signatures on gated transitions (reuse `User.signaturePinHash`).
- Immutable `AuditTrailEntry` via service wrapper + Audit Trail tab.
- Notifications/escalations (reminders for pending approvals, due findings, overdue CAPAs) — extend existing worker infra.
- PDF audit report generation.
- Risk-based planning + follow-up/repeat-audit linkage.

---

## 7. Open questions for the team
1. Risk-based planning: do you have an existing risk register/scoring source, or should the audit module compute risk itself?
2. PDF generation: server-side (Puppeteer/PDF lib) or client-side? Affects infra.
3. Offline mobile execution: is a true offline PWA needed (field/supplier audits), or is online-only acceptable for v1?
4. Reuse vs. replace: the current NC↔Ticket CAPA link — keep as an optional bridge, or fully migrate to the new first-class `Capa`?
5. Multi-tenancy: is `AuditConfig` per-organization or global? (Affects whether industry config is per-tenant.)
```
