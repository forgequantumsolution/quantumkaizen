# Quantum Kaizen — Risk Management (QRM) Module — Implementation Plan

> Status: PLAN (v1, 2026-07-20) · Owner: shriyansh
> Scope decision: **multi-industry, config-driven core** (ICH Q9 / ISO 14971 / ISO 31000 / ISO 45001 / HACCP ship as *risk frameworks*, not as forked code).
> Methodologies executed in-product (v1): **Risk Matrix** and **FMEA / FMECA**.
> Target parity: TrackWise Risk Management, Veeva Vault QMS Risk, MasterControl Risk, ETQ Reliance Risk.

---

## A. Why this module, and what "risk management" actually means in a QMS

Every regulated QMS treats risk as a **first-class object that other modules point at**, not as a
field on a form. Three things define a real risk module and separate it from a spreadsheet:

1. **A configurable scoring engine.** The scales, the matrix, the thresholds and the formula are
   *tenant configuration*, because a pharma site scores 5×5 Severity × Probability while a device
   maker scores per ISO 14971 with P1×P2 and an automotive-style FMEA uses S×O×D with an Action
   Priority table. Hard-coding one of these is what makes most home-grown risk modules unsellable
   outside the industry they were written for.
2. **Initial → residual → target scoring with a full history.** A risk is scored, controls are
   applied, it is *re-scored*, and the delta is the evidence an inspector asks for. Every rescore
   is an immutable snapshot.
3. **Bidirectional linkage to the rest of the QMS.** Risk drives CAPA, audit frequency, change
   control, supplier qualification, training assignment and validation effort — and is in turn fed
   by deviations, findings, OOS results and complaints.

### A.1 The standards, and how each one maps onto the same core

| Standard | Industry | Process shape | What the model must support |
|---|---|---|---|
| **ICH Q9(R1)** Quality Risk Management | Pharma / biotech | Initiate → Assess (identify / analyse / evaluate) → **Control** (reduce / accept) → Communicate → **Review** | Formal risk review cycle; risk-based decision records; tools FMEA, FMECA, FTA, HACCP, HAZOP, PHA, Risk Ranking & Filtering |
| **ISO 14971:2019** | Medical devices | Hazard → Hazardous situation → Harm; risk = f(P1 × P2, Severity) | Hazard/harm chain as explicit fields; risk control **option analysis** in hierarchy order; benefit-risk; production & post-production feedback |
| **ISO 31000:2018** | Enterprise / any | Context → Assessment → Treatment → Monitor & Review (+ communication) | Enterprise register, treatment strategies (avoid/reduce/share/accept), risk appetite & tolerance |
| **ISO 45001 / HIRA** | EHS / safety | Hazard identification → risk evaluation → **hierarchy of controls** | Control hierarchy levels (eliminate → substitute → engineering → administrative → PPE) |
| **HACCP (Codex)** | Food & beverage | 7 principles, CCP decision tree | Process-step-anchored analysis, CCP flag, critical limits, monitoring & verification (v2 methodology) |
| **ISO 27001 / NIST** | IT & data integrity | Asset → threat → vulnerability → risk | Asset-anchored risks, threat/vuln libraries |
| **21 CFR Part 11 / EU Annex 11** | All regulated | — | Append-only audit trail + e-signature on every assessment approval and residual-risk acceptance |

**The design consequence:** the *core* is one object graph (register → risk → assessment →
control → review), and each standard above is expressed as a **RiskFramework** config record that
supplies the vocabulary, the factors, the scales, the matrix and the acceptance rules. Nothing in
the core service layer names a standard.

---

## B. Current state — what already exists (reuse, do not rebuild)

The platform already has the hard parts. This module is mostly *composition*.

| Capability | Where it lives today | How Risk uses it |
|---|---|---|
| **RBAC permission keys `risk.*` / `fmea.*`** | `backend/src/lib/rbac-catalog.ts:57-60` — **already declared, never implemented** | Expand to full CRUD + approve/accept set; the placeholders confirm this module was always intended |
| **`RiskAnalytics.tsx` — already built** | `client/src/features/modules/analytics/RiskAnalytics.tsx` (184 lines), registered in the analytics registry under `['riskmanagement','risk']` | Today it fakes a 5×5 heat map by proxying *likelihood from ticket priority* and *severity from severity name*, because tickets carry no real scores. Phase 5 swaps the proxy for real `Risk` residual scores |
| **Sidebar icon + group already reserved** | `Sidebar.tsx` — `ICON_BY_KEY.risk = ShieldAlert`, `MODULE_GROUP.risk = "Quality System"` | Nav entry drops straight into the Quality System section |
| **Nav access registry** | `client/src/lib/navAccess.ts` — the single source of truth mapping permission key → Module/Tab for the Access Control matrix | A bespoke Risk module **must** add a `NavModuleAccess` entry here or it will be invisible to Menu Access administration |
| Org / Site / Department / User | `Organization`, `Site`, `Department`, `User` | Register scoping, ownership, site-level heat maps |
| Site scoping + `site.view_all` bypass | `rbac-catalog.ts`, `src/lib/site-defaults.ts`, `docs/site-scoping-plan.md` | A risk register belongs to a site; cross-site view is permission-gated |
| **Part 11 compliance** | `AuditTrailEntry`, `ESignature`, `writeTrail()` in `src/modules/audit/compliance.service.ts:20` | Trail every score change; e-sign assessment approval + residual acceptance |
| **CAPA + Action Items** | `Capa`, `ActionItem`, `src/modules/audit/capa.service.ts` | A risk control *is* implemented via a CAPA or an ActionItem — link, don't duplicate |
| Non-conformance / Findings | `NonConformance`, `Finding`, `AuditFinding` | Finding → risk assessment trigger; risk → justifies NC criticality |
| **Approval engine** | `ApprovalPolicy`, `ApprovalInstance`, `ApprovalRecord` | Multi-step QA/SME approval of an assessment before it becomes effective |
| **Dynamic workflow engine** | `Workflow`, `WorkflowStage`, `Ticket`, + `workflowId`/`workflowTicketId`/`workflowTicketUniqueId` link-triple (see `Capa`, `AuditRegister`) | Optional: drive assessment lifecycle through a configured workflow with stage-bound forms |
| **Dynamic forms** | `Form`, `FormSection`, `FormField`, `FormSubmission`, `StageFormBinding` | Methodology worksheets that a tenant wants to extend beyond typed columns |
| SLA + business calendar | `SlaPolicy`, `SlaTimer`, `BusinessCalendar` | Control implementation due dates, periodic review due dates |
| DMS | `Document`, `DocumentVersion` | Attach the risk assessment report / link the governing SOP |
| LMS | `LmsCourse`, `LmsTrainingMatrixRule` | An administrative control of type "training" auto-assigns a course |
| LIMS | `Equipment`, `TestMethod`, `Supplier`, `OosInvestigation`, `Specification` | Equipment criticality, supplier risk, method validation risk |
| Audit | `AuditMaster`, `AuditScheduleRule`, `AuditRegister` | **Risk-based audit planning** — audit frequency driven by supplier/process risk level |
| Numbering | `nextNumber()` + `withUniqueRetry()` in `capa.service.ts:23-43` | `RA-YYYY-0001`, `RISK-YYYY-0001`, `RC-YYYY-0001` |
| Global search, nav counts, dashboard | `src/modules/search`, `nav-counts`, `dashboard` | Register risks in search; overdue-review badge; command-center KPI |

### B.1 Conventions this module must follow (verified in-repo)

**Backend**
- Prisma: `id String @id @default(uuid())` (**never cuid**), human number `xxxNumber String @unique`,
  `createdById` + `createdBy User?` with a **named** relation and `onDelete: SetNull`,
  `createdAt @default(now())`, `updatedAt @updatedAt`, explicit `@@index([...])`.
- **Single-tenant deployment**: `Organization` is one row and **there is no `orgId` on records**.
  Multi-site is `siteId String?` + `site Site?`, currently only on `User`/`Ticket`/`Workflow`.
  New site-scoped transactional models carry `siteId` themselves.
- Config/master models use `isActive Boolean @default(true)` and hard-delete (the audit/CAPA
  convention); only `Ticket`/`Workflow`/`Document`/`Sample` use `isDeleted` soft delete.
- Multi-select snapshots stored as `Json?` (see `AuditRegister.teamMembers`), written through the
  `jsonOrNull()` helper so `undefined` becomes `Prisma.JsonNull`.
- Numbering is **application-level, not a DB sequence** — `nextNumber(model, field, prefix, year)`
  + `withUniqueRetry()` (`capa.service.ts:22-52`), retrying on `P2002`.
- Module folder = `<name>.routes.ts` + `<name>.controller.ts` + `<name>.service.ts` +
  `<name>.schema.ts` (zod schemas **and** `export type X = z.infer<typeof XSchema>`), mounted in
  `src/app.ts`. A complex module keeps **one routes file and one schema file** and splits only the
  controller/service by sub-domain (exactly how `modules/audit/` holds CAPA).
- Route middleware order is always `requirePermission(...)` → `validate(ParamSchema,'params')` →
  `validate(BodySchema)` → `asyncHandler(ctrl.fn)`, with `router.use(requireAuth)` at the top.
- Controllers are thin, have **no try/catch**, and respond via the `ok()` / `success()` envelope
  helpers in `modules/dynamic-form/dynamic-form.response.ts`. Services throw
  `NotFound/BadRequest/Conflict/Forbidden` from `src/lib/httpError.ts`.
- Services **snake_case their output** via a `serializeX()` function and share a
  `const xInclude = {...} satisfies Prisma.XInclude` + `type XRow = Prisma.XGetPayload<...>`.
- Site scoping is **not middleware** — services call `resolveSiteScope(userId)` and
  `siteFilterFor(scope, requestedSiteId)` themselves.
- Permission keys are **CRUD-style** `<module>.read|create|update|delete` (+ domain verbs like
  `approve`). Adding keys is just editing `rbac-catalog.ts`; `ensureRbacCatalog()` upserts them at
  API boot, re-grants everything to `SUPER_ADMIN`, and **prunes orphans by module name**.
- `writeTrail()` is best-effort (it swallows its own errors) — never depend on it for control flow.
- Background sweeps: add `src/jobs/sweeps/<name>.ts` and **piggyback the existing `audit-schedule`
  worker tick** rather than registering a new queue (what the last four sweeps did).
- There is **no email/notification infrastructure and no file storage** — attachments are stored
  inline in Postgres as base64 data URLs, and "notification" means a `/api/nav-counts` badge.

**Frontend**
- **No per-feature `api.ts`.** API clients live centrally in `src/lib/api/<domain>.ts`, each holding
  exported types → a `keys` factory → `useQuery` hooks → `useMutation` hooks → label/badge maps.
- **No `React.lazy` / `Suspense` anywhere** — every page is a static import in `App.tsx`; splitting
  is handled by `manualChunks` in `vite.config.ts`.
- **No `react-hook-form` / `formik` / `zod` in feature code** (they are in `package.json` but unused).
  Simple CRUD = antd `Drawer` + `Form` + local `useState`; large entities get a `*FormPage.tsx` route.
- UI is a mix: `components/ui` (`DataTable`, `KpiCard`, `Badge`/`StatusBadge`, `Card`, `Button`,
  `Modal`, `Tabs`, `EmptyState`) **plus antd directly** for Drawer/Tooltip/DatePicker/Select-with-search.
  Icons are lucide-react. Charts come only from `src/components/analytics` (recharts + `PALETTE`).
- Permission gating is `useHasPermission(key)` and conditional render — items are **hidden**, never
  disabled. There is no `<Can>` component.
- Deletes go through `useConfirmDelete`; e-signatures through `components/shared/ESignatureModal`.

---

## C. Target domain model

```
RiskFramework (config, per-org; e.g. "ICH Q9 5x5", "ISO 14971", "AIAG-VDA FMEA")
   ├──< RiskFactor        (SEVERITY | OCCURRENCE | DETECTABILITY | ...)  ordered
   │       └──< RiskFactorLevel   (rank, label, description, guidance, color)
   ├──< RiskMatrixCell    (factorALevel x factorBLevel -> RiskLevel)
   └──< RiskLevel         (label, min/max score, color, acceptance: ACCEPTABLE|ALARP|UNACCEPTABLE,
                           requiresCapa, requiresApproval, reviewMonths)

RiskCategory      (taxonomy tree: Patient Safety / Product Quality / Data Integrity / EHS / Supply / Cyber ...)
HazardLibraryItem (reusable hazard, cause, consequence catalogue — the differentiator vs. spreadsheets)
ControlLibraryItem(reusable control measures, typed + hierarchy level)

RiskRegister  (scope container: site / product / process / project / supplier / system)
   └──< Risk  ("RISK-2026-0001")
          ├── framework snapshot + category + owner + status
          ├── initial score  ──> RiskScoreSnapshot (immutable history, every rescore)
          ├── residual score
          ├── target score
          ├──< RiskControl ("RC-2026-0001")  --> links to Capa / ActionItem / Document / LmsCourse
          ├──< RiskReview  (periodic review record, next-due driven by RiskLevel.reviewMonths)
          ├──< RiskAcceptance (formal residual acceptance + e-signature)
          └──< RiskLink    (polymorphic: Capa | NonConformance | Finding | Document | Supplier |
                            Equipment | Ticket | Product | Site | LmsCourse | AuditRegister)

RiskAssessment ("RA-2026-0001")   the *event*: who assessed what, when, with which method
   ├── methodology: MATRIX | FMEA | FMECA   (v2: HACCP | HAZOP | PHA | FTA | BOWTIE)
   ├── framework (version-pinned), team (Json snapshot), scope, status, approval, e-sign
   ├── optional workflow link-triple (workflowId / workflowTicketId / workflowTicketUniqueId)
   └──< RiskAssessmentLine   (the worksheet row)
           FMEA:   item/function -> failure mode -> effect(S) -> cause(O) -> current control(D)
                   -> RPN / criticality / action priority -> recommended action
                   -> post-action S/O/D -> residual RPN
           MATRIX: hazard -> cause -> consequence -> S x L -> level -> treatment
           (each line may be promoted into a standalone `Risk` in the register)
```

### C.1 Key modelling decisions

1. **Framework is version-pinned onto the assessment.** When QA edits the 5×5 matrix next year,
   last year's approved assessment must still render and re-compute exactly as signed. The
   assessment stores `frameworkId` **and** a `frameworkSnapshot Json` of the scales/matrix/levels
   in force at approval. This is the single most important compliance decision in the module.
2. **`Risk` and `RiskAssessmentLine` are separate but linkable.** A worksheet line is analysis
   working-paper; a `Risk` is a tracked object with an owner and a review clock. A line can be
   *promoted* to a `Risk` (`RiskAssessmentLine.riskId`). This mirrors the existing
   `Finding → NonConformance → Capa` promotion chain and keeps registers from filling with noise.
3. **Score is computed server-side, never trusted from the client**, and every computation writes a
   `RiskScoreSnapshot` + `AuditTrailEntry`. The formula lives in one pure function
   (`risk-scoring.service.ts`) so it is unit-testable without a DB.
4. **Controls link to existing execution objects rather than re-implementing tasks.** A control's
   *implementation* is a `Capa` or an `ActionItem`; the control record holds the risk-specific
   metadata (type, hierarchy level, effectiveness verification).
5. **Polymorphic `RiskLink`** (`entityType` + `entityId`, mirroring the `AuditTrailEntry` pattern
   already used in-repo) avoids adding 12 nullable FK columns and lets future modules link without
   a migration.

---

## D. Prisma schema (Phase 1 + 2)

> Additive only. No existing table is altered in Phase 1; the `Capa.riskId` / `Supplier.riskLevel`
> convenience columns land in Phase 3 with the integration work.

### D.1 Enums

```prisma
enum RiskMethodology     { MATRIX FMEA FMECA HACCP HAZOP PHA FTA BOWTIE CUSTOM }
enum RiskFactorKind      { SEVERITY OCCURRENCE PROBABILITY DETECTABILITY EXPOSURE CUSTOM }
enum RiskScoreFormula    { PRODUCT SUM MATRIX_LOOKUP WEIGHTED_PRODUCT ACTION_PRIORITY }
enum RiskAcceptance      { ACCEPTABLE ALARP UNACCEPTABLE }
enum RiskRegisterScope   { SITE PRODUCT PROCESS PROJECT SUPPLIER EQUIPMENT SYSTEM ENTERPRISE }
enum RiskStatus          { IDENTIFIED UNDER_ASSESSMENT TREATMENT_PLANNED TREATMENT_IN_PROGRESS
                           RESIDUAL_ASSESSED ACCEPTED MONITORED CLOSED REOPENED ESCALATED }
enum RiskTreatment       { AVOID REDUCE TRANSFER ACCEPT }
enum RiskAssessmentStatus{ DRAFT IN_ASSESSMENT PENDING_REVIEW PENDING_APPROVAL APPROVED
                           REJECTED PERIODIC_REVIEW SUPERSEDED CLOSED CANCELLED }
enum RiskControlType     { PREVENTIVE DETECTIVE MITIGATING CORRECTIVE }
enum RiskControlHierarchy{ ELIMINATION SUBSTITUTION ENGINEERING ADMINISTRATIVE PPE
                           INHERENT_SAFETY PROTECTIVE_MEASURE INFORMATION_FOR_SAFETY }
enum RiskControlStatus   { PLANNED IN_PROGRESS IMPLEMENTED VERIFIED INEFFECTIVE CANCELLED }
enum RiskReviewOutcome   { NO_CHANGE RESCORED CONTROLS_ADDED ESCALATED CLOSED }
enum RiskScoreStage      { INITIAL RESIDUAL TARGET REVIEW }
```

`RiskControlHierarchy` deliberately carries **both** the ISO 45001 hierarchy and the ISO 14971
risk-control option order in one enum; the framework config decides which subset a tenant sees.

### D.2 Configuration models

```prisma
model RiskFramework {
  id           String           @id @default(uuid())
  code         String?          @unique          // "ICH_Q9_5X5", "ISO_14971", "AIAG_VDA"
  name         String
  description  String?
  standard     String?                            // display-only: "ICH Q9(R1)"
  methodology  RiskMethodology  @default(MATRIX)
  formula      RiskScoreFormula @default(PRODUCT)
  version      Int              @default(1)
  isActive     Boolean          @default(true)
  isDefault    Boolean          @default(false)
  // Tenant vocabulary override: { risk: "Risk", hazard: "Hazard", control: "Control Measure" }
  terminology  Json?
  // Which optional fields the worksheet shows (hazard chain, CCP, benefit-risk ...)
  fieldConfig  Json?
  siteId       String?
  site         Site?            @relation(fields: [siteId], references: [id], onDelete: SetNull)

  factors      RiskFactor[]
  levels       RiskLevelDef[]
  matrixCells  RiskMatrixCell[]
  registers    RiskRegister[]
  assessments  RiskAssessment[]
  risks        Risk[]

  createdById  String?
  createdBy    User?    @relation("RiskFrameworkCreatedBy", fields: [createdById], references: [id], onDelete: SetNull)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@index([isActive, methodology])
}

model RiskFactor {
  id          String         @id @default(uuid())
  frameworkId String
  framework   RiskFramework  @relation(fields: [frameworkId], references: [id], onDelete: Cascade)
  kind        RiskFactorKind
  key         String                         // "S" | "O" | "D" | "P1" | "P2"
  label       String                         // "Severity of Harm"
  description String?
  weight      Float          @default(1)     // used by WEIGHTED_PRODUCT
  order       Int            @default(0)
  levels      RiskFactorLevel[]

  @@unique([frameworkId, key])
  @@index([frameworkId, order])
}

model RiskFactorLevel {
  id        String     @id @default(uuid())
  factorId  String
  factor    RiskFactor @relation(fields: [factorId], references: [id], onDelete: Cascade)
  rank      Int                              // 1..N — the numeric value used in scoring
  label     String                           // "Catastrophic"
  definition String?                         // the anchoring text an auditor wants to see
  guidance  String?
  color     String?                          // "#dc2626"

  @@unique([factorId, rank])
  @@index([factorId])
}

model RiskLevelDef {
  id            String         @id @default(uuid())
  frameworkId   String
  framework     RiskFramework  @relation(fields: [frameworkId], references: [id], onDelete: Cascade)
  code          String                        // "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH"
  label         String
  color         String
  order         Int            @default(0)
  minScore      Int?                          // inclusive band for PRODUCT/SUM formulas
  maxScore      Int?
  acceptance    RiskAcceptance @default(ALARP)
  requiresCapa      Boolean @default(false)   // auto-raise CAPA when a risk lands here
  requiresApproval  Boolean @default(false)   // residual acceptance needs e-signed approval
  requiresControl   Boolean @default(false)
  reviewMonths      Int?                      // drives the periodic-review clock
  escalateToRoleId  String?
  escalateToRole    Role?   @relation("RiskLevelEscalationRole", fields: [escalateToRoleId], references: [id], onDelete: SetNull)

  matrixCells   RiskMatrixCell[]
  @@unique([frameworkId, code])
  @@index([frameworkId, order])
}

model RiskMatrixCell {
  id          String        @id @default(uuid())
  frameworkId String
  framework   RiskFramework @relation(fields: [frameworkId], references: [id], onDelete: Cascade)
  rowFactorKey String                        // e.g. "S"
  rowRank      Int
  colFactorKey String                        // e.g. "O"
  colRank      Int
  score        Int?                          // optional explicit score for MATRIX_LOOKUP
  levelId      String
  level        RiskLevelDef  @relation(fields: [levelId], references: [id], onDelete: Cascade)

  @@unique([frameworkId, rowFactorKey, rowRank, colFactorKey, colRank])
  @@index([frameworkId])
}

model RiskCategory {
  id          String  @id @default(uuid())
  code        String? @unique
  name        String
  description String?
  parentId    String?
  parent      RiskCategory?  @relation("RiskCategoryTree", fields: [parentId], references: [id], onDelete: SetNull)
  children    RiskCategory[] @relation("RiskCategoryTree")
  color       String?
  isActive    Boolean @default(true)
  risks       Risk[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  @@index([parentId, isActive])
}
```

### D.3 Library models (Phase 2)

```prisma
model HazardLibraryItem {
  id          String  @id @default(uuid())
  code        String? @unique
  name        String
  type        String?             // "Hazard" | "Cause" | "Consequence" | "FailureMode" | "Threat"
  description String?
  categoryId  String?
  category    RiskCategory? @relation(...)
  defaultSeverityRank Int?
  tags        Json?
  isActive    Boolean @default(true)
  ...audit columns
  @@index([type, isActive])
}

model ControlLibraryItem {
  id          String  @id @default(uuid())
  code        String? @unique
  name        String
  type        RiskControlType
  hierarchy   RiskControlHierarchy?
  description String?
  effectivenessRank Int?          // typical detectability improvement
  isActive    Boolean @default(true)
  ...audit columns
}
```

### D.4 Operational models

```prisma
model RiskRegister {
  id             String            @id @default(uuid())
  registerNumber String            @unique          // RR-2026-0001
  name           String
  description    String?
  scope          RiskRegisterScope @default(SITE)
  // Free-form scope anchor — { entityType: "Supplier", entityId: "...", label: "..." }
  scopeRef       Json?
  frameworkId    String?
  framework      RiskFramework?    @relation(fields: [frameworkId], references: [id], onDelete: SetNull)
  siteId         String?
  site           Site?             @relation(fields: [siteId], references: [id], onDelete: SetNull)
  departmentId   String?
  department     Department?       @relation("RiskRegisterDepartment", fields: [departmentId], references: [id], onDelete: SetNull)
  ownerId        String?
  owner          User?             @relation("RiskRegisterOwner", fields: [ownerId], references: [id], onDelete: SetNull)
  isActive       Boolean           @default(true)
  risks          Risk[]
  assessments    RiskAssessment[]
  ...audit columns
  @@index([siteId, isActive])
  @@index([scope])
}

model Risk {
  id          String @id @default(uuid())
  riskNumber  String @unique                        // RISK-2026-0001
  title       String
  description String?

  registerId  String
  register    RiskRegister @relation(fields: [registerId], references: [id], onDelete: Cascade)
  frameworkId String?
  framework   RiskFramework? @relation(fields: [frameworkId], references: [id], onDelete: SetNull)
  categoryId  String?
  category    RiskCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)

  // ISO 14971 hazard chain — optional, shown when framework.fieldConfig enables it
  hazard             String?
  hazardousSituation String?
  harm               String?
  cause              String?
  consequence        String?

  status      RiskStatus     @default(IDENTIFIED)
  treatment   RiskTreatment?

  // Scores — factor values live in Json so an N-factor framework needs no schema change.
  // { "S": 4, "O": 3, "D": 2 }
  initialFactors  Json?
  initialScore    Int?
  initialLevelId  String?
  residualFactors Json?
  residualScore   Int?
  residualLevelId String?
  targetFactors   Json?
  targetScore     Int?
  targetLevelId   String?

  ownerId      String?
  owner        User?       @relation("RiskOwner", fields: [ownerId], references: [id], onDelete: SetNull)
  departmentId String?
  department   Department? @relation("RiskDepartment", fields: [departmentId], references: [id], onDelete: SetNull)
  siteId       String?
  site         Site?       @relation("RiskSite", fields: [siteId], references: [id], onDelete: SetNull)

  identifiedAt DateTime  @default(now())
  acceptedAt   DateTime?
  closedAt     DateTime?
  nextReviewAt DateTime?                            // driven by RiskLevelDef.reviewMonths

  // Optional dynamic-workflow drive (same link-triple as Capa / AuditRegister)
  workflowId             String?
  workflowTicketId       String?
  workflowTicketUniqueId String?

  controls    RiskControl[]
  snapshots   RiskScoreSnapshot[]
  reviews     RiskReview[]
  acceptances RiskAcceptanceRecord[]
  links       RiskLink[]
  lines       RiskAssessmentLine[]
  ...audit columns

  @@index([registerId, status])
  @@index([ownerId])
  @@index([nextReviewAt])
  @@index([residualScore])
}

model RiskAssessment {
  id               String  @id @default(uuid())
  assessmentNumber String  @unique                  // RA-2026-0001
  title            String
  objective        String?
  scopeText        String?
  methodology      RiskMethodology @default(MATRIX)
  status           RiskAssessmentStatus @default(DRAFT)

  registerId  String?
  register    RiskRegister?  @relation(fields: [registerId], references: [id], onDelete: SetNull)
  frameworkId String
  framework   RiskFramework  @relation(fields: [frameworkId], references: [id], onDelete: Restrict)
  // Immutable copy of factors/levels/matrix as of approval — Part 11 reconstructability.
  frameworkSnapshot Json?

  // Version chain — an approved assessment is immutable; revising creates v+1.
  version      Int     @default(1)
  parentId     String?
  parent       RiskAssessment?  @relation("RiskAssessmentVersions", fields: [parentId], references: [id], onDelete: SetNull)
  versions     RiskAssessment[] @relation("RiskAssessmentVersions")

  teamMembers  Json?                                // [{ id, name, role }]
  leadId       String?
  lead         User?     @relation("RiskAssessmentLead", fields: [leadId], references: [id], onDelete: SetNull)
  siteId       String?
  site         Site?     @relation("RiskAssessmentSite", fields: [siteId], references: [id], onDelete: SetNull)

  startedAt    DateTime?
  completedAt  DateTime?
  approvedAt   DateTime?
  approvedById String?
  approvedBy   User?     @relation("RiskAssessmentApprovedBy", fields: [approvedById], references: [id], onDelete: SetNull)
  rejectionReason String?
  conclusion   String?
  nextReviewAt DateTime?

  // Trigger provenance — what caused this assessment (deviation, finding, change, periodic)
  triggerType  String?
  triggerId    String?

  workflowId             String?
  workflowTicketId       String?
  workflowTicketUniqueId String?

  lines  RiskAssessmentLine[]
  links  RiskLink[]
  ...audit columns

  @@index([status, methodology])
  @@index([registerId])
  @@index([nextReviewAt])
}

model RiskAssessmentLine {
  id           String @id @default(uuid())
  assessmentId String
  assessment   RiskAssessment @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  lineNumber   Int
  // FMEA columns
  itemFunction String?                     // process step / component / function
  failureMode  String?
  effect       String?
  cause        String?
  currentControls String?
  // Matrix columns reuse hazard/consequence
  hazard       String?
  consequence  String?

  initialFactors Json?                     // { S: 4, O: 3, D: 2 }
  initialScore   Int?                      // RPN or matrix score
  initialLevelId String?
  actionPriority String?                   // AIAG-VDA H/M/L when formula = ACTION_PRIORITY

  recommendedAction String?
  ownerId      String?
  owner        User?     @relation("RiskLineOwner", fields: [ownerId], references: [id], onDelete: SetNull)
  dueDate      DateTime?

  residualFactors Json?
  residualScore   Int?
  residualLevelId String?

  // Promotion into the register (working paper -> tracked risk)
  riskId String?
  risk   Risk?  @relation(fields: [riskId], references: [id], onDelete: SetNull)

  isCritical Boolean @default(false)       // CCP flag for HACCP, "critical characteristic" for FMECA
  notes      String?
  ...audit columns

  @@unique([assessmentId, lineNumber])
  @@index([assessmentId])
  @@index([riskId])
}

model RiskControl {
  id            String @id @default(uuid())
  controlNumber String @unique                       // RC-2026-0001
  riskId        String
  risk          Risk   @relation(fields: [riskId], references: [id], onDelete: Cascade)
  title         String
  description   String?
  type          RiskControlType      @default(PREVENTIVE)
  hierarchy     RiskControlHierarchy?
  status        RiskControlStatus    @default(PLANNED)

  ownerId     String?
  owner       User?     @relation("RiskControlOwner", fields: [ownerId], references: [id], onDelete: SetNull)
  dueDate     DateTime?
  implementedAt DateTime?

  // Effectiveness verification (mirrors Capa's effectiveness pattern)
  verifiedById  String?
  verifiedBy    User?     @relation("RiskControlVerifiedBy", fields: [verifiedById], references: [id], onDelete: SetNull)
  verifiedAt    DateTime?
  effectiveness String?
  isEffective   Boolean?

  // Execution is delegated to existing objects — never re-implemented here.
  capaId        String?
  actionItemId  String?
  documentId    String?
  lmsCourseId   String?

  libraryItemId String?
  ...audit columns

  @@index([riskId, status])
  @@index([ownerId, dueDate])
}

model RiskScoreSnapshot {
  id        String @id @default(uuid())
  riskId    String
  risk      Risk   @relation(fields: [riskId], references: [id], onDelete: Cascade)
  stage     RiskScoreStage
  factors   Json                       // { S: 4, O: 3, D: 2 }
  score     Int
  levelCode String
  levelLabel String
  formula   RiskScoreFormula
  frameworkId String?
  reason    String?
  userId    String?
  userName  String
  createdAt DateTime @default(now())

  @@index([riskId, createdAt])
}

model RiskReview {
  id        String @id @default(uuid())
  riskId    String
  risk      Risk   @relation(fields: [riskId], references: [id], onDelete: Cascade)
  dueAt     DateTime
  reviewedAt DateTime?
  reviewedById String?
  reviewedBy   User?  @relation("RiskReviewedBy", fields: [reviewedById], references: [id], onDelete: SetNull)
  outcome   RiskReviewOutcome?
  findings  String?
  nextReviewAt DateTime?
  ...audit columns
  @@index([riskId, dueAt])
  @@index([dueAt, reviewedAt])
}

model RiskAcceptanceRecord {
  id        String @id @default(uuid())
  riskId    String
  risk      Risk   @relation(fields: [riskId], references: [id], onDelete: Cascade)
  justification String
  residualScore Int?
  residualLevelCode String?
  // Benefit-risk statement (ISO 14971 §8) when residual risk stays unacceptable
  benefitRiskRationale String?
  acceptedById String?
  acceptedBy   User?  @relation("RiskAcceptedBy", fields: [acceptedById], references: [id], onDelete: SetNull)
  acceptedAt   DateTime @default(now())
  eSignatureId String?
  @@index([riskId])
}

model RiskLink {
  id        String @id @default(uuid())
  riskId    String?
  risk      Risk?  @relation(fields: [riskId], references: [id], onDelete: Cascade)
  assessmentId String?
  assessment   RiskAssessment? @relation(fields: [assessmentId], references: [id], onDelete: Cascade)
  entityType String            // "Capa" | "NonConformance" | "Finding" | "Document" | "Supplier" | ...
  entityId   String
  label      String?
  relation   String?           // "CAUSED_BY" | "MITIGATED_BY" | "APPLIES_TO" | "EVIDENCE"
  createdById String?
  createdAt  DateTime @default(now())

  @@unique([riskId, entityType, entityId, relation])
  @@index([entityType, entityId])
}
```

---

## E. The scoring engine (`risk-scoring.service.ts`)

One pure, DB-free module — the only place a score is ever produced.

```ts
computeScore(framework, factors) -> { score, levelCode, levelLabel, color, acceptance, actionPriority? }
```

| Formula | Computation | Typical use |
|---|---|---|
| `PRODUCT` | `Π rank(f)` | 5×5 matrix (S×L), FMEA RPN (S×O×D) |
| `SUM` | `Σ rank(f)` | additive enterprise scoring |
| `WEIGHTED_PRODUCT` | `Π rank(f)^weight(f)` | weighted pharma criticality |
| `MATRIX_LOOKUP` | `RiskMatrixCell[row, col].score/level` | non-linear matrices where 3×4 ≠ 4×3 |
| `ACTION_PRIORITY` | AIAG-VDA S/O/D → H·M·L table | RPN-free modern FMEA |

Level resolution: `MATRIX_LOOKUP` → cell's level; otherwise the first `RiskLevelDef` whose
`[minScore, maxScore]` band contains the score. Unmapped score ⇒ hard error, never a silent null —
an unclassifiable risk is a configuration bug and must surface at save time.

**Side effects of every score write (in the service, in one transaction):**
1. Persist `initial|residual|target` factors + score + levelId on the `Risk`.
2. Insert an immutable `RiskScoreSnapshot`.
3. `writeTrail({ entityType: 'Risk', entityId, action: 'SCORE', field, oldValue, newValue, reason })`.
4. Apply level policy: set `nextReviewAt` from `reviewMonths`; if `requiresCapa` and no open CAPA
   is linked, auto-raise one via `capa.service` and record a `RiskLink`; if `requiresApproval`,
   block `status → ACCEPTED` until an e-signed `RiskAcceptanceRecord` exists.

---

## F. State machines

**RiskAssessment**
```
DRAFT ──> IN_ASSESSMENT ──> PENDING_REVIEW ──> PENDING_APPROVAL ──> APPROVED ──> PERIODIC_REVIEW
  │              │                 │                  │                │              │
  └──> CANCELLED ┘                 └──── REJECTED ────┘                │              └──> (new version)
                                                                        └──> SUPERSEDED / CLOSED
```
- `APPROVED` freezes `frameworkSnapshot` and makes lines read-only; edits require a new version.
- Transition to `APPROVED` requires an `ESignature` with meaning `"Approved risk assessment"`.

**Risk**
```
IDENTIFIED ─> UNDER_ASSESSMENT ─> TREATMENT_PLANNED ─> TREATMENT_IN_PROGRESS ─> RESIDUAL_ASSESSED
                                                                                      │
                                                       ┌──────────────────────────────┤
                                                       v                              v
                                                   ACCEPTED ──> MONITORED ──> CLOSED
                                                       │                        │
                                                    ESCALATED <──── REOPENED <──┘
```

**RiskControl:** `PLANNED → IN_PROGRESS → IMPLEMENTED → VERIFIED`, with `INEFFECTIVE` reachable
from `VERIFIED` (re-opens the parent risk and clears its residual score).

Transitions are enforced by an explicit adjacency map in the service, matching how the audit module
guards `AuditStatus`; an illegal transition returns 422, never a silent no-op.

---

## G. API surface (`/api/risk`)

Mounted in `src/app.ts` as `app.use('/api/risk', riskRoutes);`.

**Configuration**
```
GET/POST      /api/risk/frameworks                  risk_framework.read | .create
GET/PUT/DEL   /api/risk/frameworks/:id              risk_framework.read | .update | .delete
POST          /api/risk/frameworks/:id/clone        risk_framework.create      (version bump)
GET/PUT       /api/risk/frameworks/:id/matrix       risk_framework.read | .update
GET/POST      /api/risk/categories                  risk_category.read | .create
GET/POST      /api/risk/hazard-library              risk_library.read | .create
GET/POST      /api/risk/control-library             risk_library.read | .create
```

**Registers & risks**
```
GET/POST      /api/risk/registers                   risk_register.read | .create
GET/PUT/DEL   /api/risk/registers/:id               risk_register.*
GET           /api/risk/registers/:id/risks         risk.read
GET/POST      /api/risk/risks                       risk.read | .create
GET/PUT/DEL   /api/risk/risks/:id                   risk.read | .update | .delete
PATCH         /api/risk/risks/:id/status            risk.update      (guarded transition)
POST          /api/risk/risks/:id/score             risk.update      body: { stage, factors, reason }
GET           /api/risk/risks/:id/history           risk.read        (score snapshots)
POST          /api/risk/risks/:id/accept            risk.accept      (e-sign + justification)
POST          /api/risk/risks/:id/links             risk.update
DELETE        /api/risk/links/:id                   risk.update
POST          /api/risk/risks/:id/workflow          risk.update      (attach dynamic workflow)
```

**Assessments & worksheets**
```
GET/POST      /api/risk/assessments                 risk_assessment.read | .create
GET/PUT/DEL   /api/risk/assessments/:id             risk_assessment.*
PATCH         /api/risk/assessments/:id/status      risk_assessment.update
POST          /api/risk/assessments/:id/approve     risk_assessment.approve   (e-sign)
POST          /api/risk/assessments/:id/reject      risk_assessment.approve
POST          /api/risk/assessments/:id/revise      risk_assessment.create    (new version)
GET/POST      /api/risk/assessments/:id/lines       risk_assessment.read | .update
PUT/DELETE    /api/risk/lines/:id                   risk_assessment.update
POST          /api/risk/lines/:id/promote           risk.create      (line -> Risk)
POST          /api/risk/lines/bulk                  risk_assessment.update    (grid paste/save)
```

**Controls, reviews, compliance, analytics**
```
GET/POST      /api/risk/risks/:id/controls          risk_control.read | .create
PUT/PATCH/DEL /api/risk/controls/:id                risk_control.*
POST          /api/risk/controls/:id/verify         risk_control.approve
GET/POST      /api/risk/risks/:id/reviews           risk_review.read | .create
POST          /api/risk/reviews/:id/complete        risk_review.update
GET           /api/risk/trail/:entityType/:entityId risk.read
POST          /api/risk/sign                        risk.update
GET           /api/risk/analytics/heatmap           risk.read   ?registerId&siteId&stage
GET           /api/risk/analytics/summary           risk.read   (by level / category / status / dept)
GET           /api/risk/analytics/trend             risk.read   (score movement over time)
GET           /api/risk/analytics/overdue           risk.read   (reviews + controls past due)
GET           /api/risk/risks/:id/report            risk.read   (PDF payload)
```

### G.1 RBAC keys to add to `rbac-catalog.ts`

Replacing the two placeholder keys with a proper set (the existing `risk.read` / `risk.write` /
`fmea.read` / `fmea.write` keys are kept as aliases for one release so nothing regresses):

| Module | Keys |
|---|---|
| `RISK` | `risk.read`, `risk.create`, `risk.update`, `risk.delete`, `risk.accept`, `risk.view_all` |
| `RISK_REGISTER` | `risk_register.read/create/update/delete` |
| `RISK_ASSESSMENT` | `risk_assessment.read/create/update/delete/approve` |
| `RISK_CONTROL` | `risk_control.read/create/update/delete/approve` |
| `RISK_REVIEW` | `risk_review.read/create/update` |
| `RISK_FRAMEWORK` | `risk_framework.read/create/update/delete` (config — QA/admin only) |
| `RISK_CATEGORY` | `risk_category.read/create/update/delete` |
| `RISK_LIBRARY` | `risk_library.read/create/update/delete` |

---

## H. Frontend plan (`client/src/features/risk/`)

### H.0 Why a bespoke feature folder, and not a workflow type

The platform offers two ways to add a QMS module:

- **Path A — dynamic workflow type.** Seed a `WorkflowType` row named "Risk"; the sidebar entry,
  `/modules/:typeId` page, `wf_type.<id>.*` permissions, KPI tabs, findings register and PDF report
  all appear with **zero frontend code**. This is how Deviation and Change Control work.
- **Path B — bespoke feature folder** (what `audit` and `lims` do), for modules with real entities
  of their own.

**Risk must be Path B.** A risk register needs configurable scales, an N×M matrix, computed
initial/residual/target scores with history, FMEA worksheets and a review clock — none of which a
generic ticket can represent. `RiskAnalytics.tsx` proving this: it has to *fake* likelihood from
ticket priority because ticket records carry no scores.

**But it borrows Path A for lifecycle.** Exactly as CAPA does, a `Risk`/`RiskAssessment` optionally
carries the `workflowId`/`workflowTicketId`/`workflowTicketUniqueId` triple, so a tenant that wants
a configured approval route with stage-bound forms gets it without a code change. Ticket creation
failure must never block record creation (try/catch + log, per `capa.service.ts`).

### H.1 Registration checklist (all four are required, none are automatic on Path B)

1. `src/lib/api/risk.ts` — types + `riskKeys` factory + query/mutation hooks.
2. Static route imports + routes in `App.tsx`: a `RiskModuleLayout` layout route for tabbed
   operational pages, with **detail/editor pages declared outside it** (full-page, no tab bar) —
   the exact shape `audit` uses.
3. `Sidebar.tsx` — a `NavItem` in the **Quality System** section with `icon: ShieldAlert`
   (already mapped), `permission: 'risk.read'`, `activeForPrefixes: ['/risk']`.
4. `src/lib/navAccess.ts` — a `NavModuleAccess` entry listing every tab and its permission key, so
   Risk appears in the Access Control → Menu Access role×tab matrix. **Skipping this makes the
   module unmanageable by administrators.**

### H.2 Screens

| Route | Screen | Notes |
|---|---|---|
| `/risk` | **Risk dashboard** | Heat map (interactive matrix, cell → filtered list), risks by level/category, overdue reviews, top-10 by residual score, trend line |
| `/risk/registers` | Register list | Filter by scope/site/owner |
| `/risk/registers/:id` | **Register workspace** | Risk grid + inline heat map + bulk actions |
| `/risk/risks` | Risk register (flat) | Server-side filter/sort/paginate; saved views |
| `/risk/risks/:id` | **Risk workspace** *(the key screen)* | Tabs: Overview · Scoring (initial/residual/target + score history chart) · Controls · Links · Reviews · Acceptance · Audit Trail. Mirrors the audit-register workspace pattern |
| `/risk/assessments` | Assessment list | By methodology/status/site |
| `/risk/assessments/:id` | **Assessment workspace** | Header + team + **worksheet grid** (FMEA or matrix columns driven by framework config), promote-to-risk, approve with e-sign, version history |
| `/risk/controls` | Control tracker | Cross-risk view of due/overdue controls, owner workload |
| `/risk/reviews` | Periodic review queue | Due / overdue, one-click "review & rescore" |
| `/risk/library` | Hazard & control libraries | Config |
| `/risk/settings` | **Framework builder** | Scales editor, drag-to-paint matrix builder, level bands + acceptance policy, terminology, field toggles |

Existing pieces to reuse rather than rebuild: `DataTable` with `serverPagination`, `KpiCard`,
`ListPageHeader`, `useConfirmDelete`, `ESignatureModal`, `FilterPresetBar`, `exportToCSV`,
`components/analytics` (`HeatMapMatrix`, `TrendLineChart`, `CategoryParetoChart`, `ChartCard`,
`PALETTE`), and — if a risk is workflow-driven — the whole of `features/tickets/detail/`
(`StageStripBar`, `ApprovalsTimeline`, `SlaPanel`, `RequiredFormsCard`).

Two components carry most of the product value and must be built as new reusable primitives:

1. **`RiskMatrixGrid`** — renders an N×M matrix from a framework config; used read-only as the
   dashboard heat map (cells show risk counts) and editable in the framework builder (paint cells
   with levels). One component, two modes.
2. **`RiskWorksheetGrid`** — a spreadsheet-style editable grid whose **columns are derived from
   `framework.methodology` + `fieldConfig`**, with keyboard navigation, paste-from-Excel, per-row
   live score/level computation and inline validation. This is what makes FMEA usable and is the
   single biggest differentiator versus a form-per-row implementation.

Scores displayed anywhere are the server's computed values; the client re-computes only for
optimistic in-grid feedback and never persists a client-side score.

---

## I. Cross-module integration (this is what makes it a QMS module, not an app)

| Direction | Integration | Where |
|---|---|---|
| Risk → CAPA | Level with `requiresCapa` auto-raises a CAPA; manual "Raise CAPA from risk" | `capa.service.ts` + `RiskLink` |
| Risk → Action Item | Control implementation task | `ActionItem` |
| Deviation / NC / Finding → Risk | "Assess risk" action creates a `RiskAssessment` with `triggerType`/`triggerId` | finding + audit modules |
| Risk → Audit planning | `AuditScheduleRule` frequency modulated by supplier/process residual risk level | audit module (Phase 5) |
| Risk → Change control | A change ticket requires a linked, approved risk assessment before its approval stage passes | workflow engine stage guard |
| Risk → DMS | Governing SOP link; generated assessment report filed as a controlled document | `Document` |
| Risk → LMS | Administrative control of type "training" creates an `LmsTrainingMatrixRule` | LMS module |
| Supplier / Equipment → Risk | Supplier qualification tier and equipment criticality read from residual risk | LIMS master data |
| OOS / Stability → Risk | Confirmed OOS raises product-quality risk | LIMS |
| Risk → Dashboard / Search / Nav counts | KPI tiles, global search over risk numbers/titles, overdue-review badge | `dashboard`, `search`, `nav-counts` |
| Risk → SLA | Control due dates and review due dates as SLA timers on business calendars | `sla` module |
| Risk → PDF report | Per-risk and per-assessment branded report using the `@react-pdf/renderer` pipeline from the ticket-report work | `docs/ticket-report-download-plan.md` |

---

## J. Phased delivery

| Phase | Content | Exit criteria |
|---|---|---|
| **1. Foundation** *(this run)* | Enums + config models + register/risk/snapshot/link models; migration; RBAC keys; `risk-scoring.service.ts`; risk + register + framework CRUD API; trail on every write; seed of 3 default frameworks (ICH Q9 5×5, ISO 14971, AIAG-VDA FMEA) + a starter category tree | Can create a framework, a register and a risk via API; scoring returns correct level; every change appears in the audit trail |
| **2. Assessments & FMEA** | `RiskAssessment` + `RiskAssessmentLine`, versioning, framework snapshot, approve/reject with e-sign, promote-line-to-risk, bulk line save | An FMEA can be authored, approved, frozen and revised |
| **3. Treatment & integration** | `RiskControl`, effectiveness verification, auto-CAPA on threshold, `RiskLink` UI, CAPA/ActionItem/DMS/LMS wiring | Residual scoring only unlocks once controls are verified |
| **4. Governance** | `RiskReview` + periodic review job (`src/jobs`), escalation rules, SLA timers, notifications | Overdue reviews surface on the dashboard and escalate automatically |
| **5. Analytics & reporting** | Heat map, trend, summary endpoints; per-module analytics panel; PDF risk & assessment reports; risk-based audit scheduling | Heat map cell click → filtered register; signed PDF report downloads |
| **6. Frontend completion** | Full `features/risk` surface, framework builder, worksheet grid, libraries | All routes in §H live and permission-gated |

---

## K. Open questions

1. **Risk appetite / tolerance at org level** — do you want an org-wide "risk appetite" statement
   per category (ISO 31000 §6.3.4) that flags risks exceeding tolerance, or is per-framework
   acceptance sufficient for v1?
2. **HACCP in Phase 2 or later?** It is the one methodology whose worksheet shape (process step →
   CCP decision tree → critical limits → monitoring → verification) differs enough from
   matrix/FMEA to need its own line model or a heavier `fieldConfig`.
3. **Does an approved assessment require a controlled-document output** filed in DMS automatically,
   or is the in-app record plus PDF-on-demand sufficient?
4. **Change control** — is there a dedicated change-control workflow type today that risk should
   gate, or is that also driven by the generic ticket engine?
