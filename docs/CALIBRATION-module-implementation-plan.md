# Quantum Kaizen — Calibration & Measuring Equipment Module

**Implementation plan — multi-industry (Pharmaceuticals · Automotive · FMCG)**

Status: plan · Author: engineering · Date: 2026-07-28

---

## A. Why this document

Calibration exists in the product today as **two disconnected half-implementations**,
neither of which an inspector would accept:

| What exists | Where | What it actually does | Why it is not enough |
|---|---|---|---|
| `Equipment` + `CalibrationRecord` | `backend/prisma/schema.prisma:2566-2611`, `backend/src/modules/lims/equipment.service.ts` | Flat log: `calibratedAt`, `result` (PASS/FAIL/CONDITIONAL), `certificateNo`, `nextDueAt`, `performedBy`, `remarks`. Recording a calibration advances `calibrationDueAt`. | No as-found / as-left. No calibration points, no tolerance, no measured values. No traceability to a reference standard. No review/approval, no e-signature. No out-of-tolerance handling. Lab-only (`labId`), so a production-floor gauge has nowhere to live. |
| "Calibration" ticket module | `WorkflowType` + `client/src/features/modules/analytics/CalibrationAnalytics.tsx` | Generic workflow tickets with a purpose-built KPI panel (compliance %, overdue, OOT keyword sniffing). | The panel infers OOT by **regex on the ticket title** (`/oot\|toleran/i`) because there is no OOT record to read. Tickets carry no `equipmentId` — the module cannot answer "when is balance BAL-004 next due?". |

The gap is not cosmetic. Three separate regulatory regimes ask questions this data model
physically cannot answer:

- **Pharma** — "Instrument HPLC-02 failed as-found calibration on 12-May. Show me every
  result reported from it since the previous calibration, and your impact assessment."
- **Automotive (IATF 16949 §7.1.5.2.1)** — "Show the as-received readings out of
  specification, your assessment of impact, and the customer notification you issued for
  suspect product already shipped."
- **FMCG (BRCGS §6.3 / FSSC)** — "Your metal detector failed the shift check at 14:00.
  What product is on hold back to the last passing check at 06:00?"

All three are the *same* question — *retrospective impact since the last known-good
state* — and none of them is answerable today.

This plan builds one **Calibration & Measuring Equipment** module that answers it, with
industry differences expressed as **seeded configuration**, never as code branches. That
is the pattern already proven by the audit module (`docs/audit-module-advanced-spec.md`
§1 "Tenant configuration model") and the risk framework
(`RiskFramework` / `RiskFactor` / `RiskMatrixCell`).

---

## B. Design principles

1. **One instrument registry, several lenses.** Do *not* create a second equipment
   master. `Equipment` is extended and promoted out of "LIMS-only"; LIMS keeps its
   existing view by filtering on instrument kind. Two registries would guarantee two
   different answers to "is this gauge calibrated?".
2. **Configuration, not forks.** Pharma / Automotive / FMCG differences live in
   `CalibrationConfig` + seeded master rows ("industry packs"). No `if (industry === …)`
   in service code. A chemical or medical-device tenant is then a new pack, not a sprint.
3. **The measurement is the record.** A calibration is a set of *readings at defined
   points*, evaluated against *tolerances*, using *traceable standards*. PASS/FAIL is a
   **derived** field, never a typed-in one.
4. **As-found is sacred.** As-left tells you the instrument is fine now. As-found is the
   only field that tells you whether the last six months of data are trustworthy. Every
   regime hangs its impact assessment on it.
5. **Reuse the platform.** Workflow engine, approvals, SLA, escalation, notification,
   dynamic forms, audit trail (`writeTrail`), `ESignature`, site scoping, ticket report
   PDF, module analytics registry — all exist. Calibration wires into them; it does not
   re-invent them.
6. **Blocking is a feature.** An overdue instrument must be *unusable* — the LIMS result
   entry path and the ticket path both refuse it — otherwise the module is a spreadsheet
   with a login screen.

---

## C. Scope decisions (made — flagged where they need confirmation)

| # | Decision | Rationale |
|---|---|---|
| C1 | **Extend `Equipment`; do not create `Instrument`.** Add `kind`, `siteId`, `departmentId`, `custodianId`, metrology attributes. | One registry (principle 1). Existing `SampleTest.equipmentId`, `Result.equipmentId`, `QcResult.equipmentId` FKs keep working unchanged — which is exactly what makes retrospective impact computable on day one. |
| C2 | **Retire `CalibrationRecord` into `CalibrationEvent`** via data migration, keeping the old table until Phase 4 cutover. | The existing rows are real seed/demo data; a lossy drop would break `EquipmentDetailPage`. |
| C3 | **Reference standards are `Equipment` rows** with `kind = REFERENCE_STANDARD`, not a separate table. | A reference standard is itself calibrated, on an interval, with a certificate and a traceability chain. Modelling it separately duplicates the entire module. |
| C4 | **External calibration agencies reuse `Supplier`** (`schema.prisma:2931`) with calibration-provider fields added. | Avoids a parallel vendor master; lets supplier-quality scoring see calibration performance. |
| C5 | **The Calibration workflow ticket stays**, but becomes *generated from* and *linked to* a `CalibrationEvent` (`event.ticketId`). | Preserves the existing module page, analytics panel, SLA and escalation wiring. The ticket becomes the human task; the event becomes the record. |
| C6 | **New top-level module** `Calibration` (nav) — not a LIMS sub-tab. | Automotive gage cribs and FMCG CCP devices are not lab objects. LIMS → Equipment stays, scoped to `kind = LAB_INSTRUMENT`. |
| C7 | **MSA / Gage R&R ships in Phase 5, gated by the Automotive pack.** | Statistically substantial; only IATF tenants require it. Building it behind a feature flag keeps Phase 1-4 shippable for all three industries. |
| C8 | ⚠ **Confirm:** does any tenant need *usage-based* intervals (operating hours / cycles / shots) in v1, or is calendar + risk-modulated enough? | Usage intervals require an `EquipmentUsageLog` and a metering integration. Plan carries it as Phase 5 optional. |

---

## D. Target data model

All additions follow existing conventions: `uuid` ids, `isDeleted` soft delete,
`createdById`, `createdAt`/`updatedAt`, snake_case API serialization in the service layer.

### D.1 Instrument master — extensions to `Equipment`

```prisma
enum EquipmentKind {
  LAB_INSTRUMENT      // HPLC, balance, pH meter — the current LIMS population
  PRODUCTION_GAUGE    // torque wrench, vernier, pressure gauge, plug gauge
  MONITORING_DEVICE   // metal detector, checkweigher, thermometer, data logger
  REFERENCE_STANDARD  // check weights, gauge blocks, master thermometer (C3)
  UTILITY             // autoclave, oven, chamber — qualified rather than calibrated
}

enum CalibrationStatus {
  CALIBRATED
  DUE_SOON            // inside the notification window
  OVERDUE
  UNDER_CALIBRATION   // physically out with the technician / agency
  LIMITED_USE         // conditional pass — restricted range, documented
  OUT_OF_SERVICE      // failed, quarantined
  NOT_REQUIRED        // indicative-only device, explicitly exempted with justification
}

enum InstrumentCriticality {
  CRITICAL            // GxP / CCP / safety-characteristic measurement
  MAJOR
  MINOR
  INDICATIVE          // reference only, no product decision taken from it
}

enum QualificationState { NOT_STARTED  IQ  OQ  PQ  QUALIFIED  REQUALIFICATION_DUE }
```

Added to `model Equipment`:

```prisma
  kind             EquipmentKind         @default(LAB_INSTRUMENT)
  categoryId       String?               // → EquipmentCategory (D.2), replaces free-text `category`
  siteId           String?               // site scoping (lib/audit-scope.ts pattern)
  departmentId     String?
  custodianId      String?               // owning user — the person notified

  criticality      InstrumentCriticality @default(MAJOR)
  calibrationStatus CalibrationStatus    @default(CALIBRATED)   // derived, maintained by the sweep
  isCalibrationRequired Boolean          @default(true)
  exemptionReason  String?               // required when isCalibrationRequired = false

  // Metrology attributes
  measurementRangeMin Decimal?  @db.Decimal(18, 6)
  measurementRangeMax Decimal?  @db.Decimal(18, 6)
  unitId           String?                // → UnitOfMeasure (exists, schema.prisma:2886)
  resolution       Decimal?  @db.Decimal(18, 6)
  accuracyClass    String?                // "Class II", "±0.5% FS", OIML class
  mpe              Decimal?  @db.Decimal(18, 6)   // maximum permissible error

  // Qualification (pharma AIQ / GAMP; automotive gage acceptance)
  qualificationState QualificationState  @default(NOT_STARTED)
  aiqGroup         String?                // USP <1058> A | B | C  (pharma pack)
  gampCategory     String?                // GAMP 5 category 1/3/4/5 (pharma pack)

  // Identification & control
  assetTag         String?
  qrToken          String?  @unique       // label QR → public status page (D.9)
  receivedAt       DateTime?
  warrantyUntil    DateTime?
  retiredAt        DateTime?
  retirementReason String?

  @@index([kind, calibrationStatus])
  @@index([siteId])
  @@index([custodianId])
```

`labId` stays optional and unchanged — a production gauge simply has none.

### D.2 Configuration masters (the industry-pack surface)

```prisma
model EquipmentCategory {
  id          String  @id @default(uuid())
  code        String  @unique               // BALANCE, HPLC, TORQUE_WRENCH, METAL_DETECTOR
  name        String
  kind        EquipmentKind
  siteId      String?
  industryPack String?                      // PHARMA | AUTOMOTIVE | FMCG | null (custom)

  // Defaults inherited by every plan created for this category
  defaultIntervalDays   Int?
  defaultCriticality    InstrumentCriticality @default(MAJOR)
  defaultToleranceType  ToleranceType?
  defaultToleranceValue Decimal? @db.Decimal(18, 6)
  requiresMsa           Boolean @default(false)   // automotive
  requiresInUseCheck    Boolean @default(false)   // FMCG CCP devices, pharma balances
  inUseCheckFrequency   InUseFrequency?

  pointTemplates CalibrationPointTemplate[]
  isDeleted Boolean @default(false)
  @@index([kind]) @@index([industryPack])
}

model CalibrationPointTemplate {
  id          String  @id @default(uuid())
  categoryId  String
  category    EquipmentCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  sequence    Int
  label       String                     // "10% of span", "Check weight 200 g"
  nominalValue Decimal? @db.Decimal(18, 6)
  nominalPercentOfSpan Decimal? @db.Decimal(6, 3)   // when nominal is span-relative
  unitId      String?
  toleranceType  ToleranceType
  toleranceValue Decimal @db.Decimal(18, 6)
  @@unique([categoryId, sequence])
}

enum ToleranceType { ABSOLUTE  PERCENT_OF_READING  PERCENT_OF_SPAN  MPE_MULTIPLE }
enum InUseFrequency { PER_SHIFT  DAILY  WEEKLY  PER_BATCH  MONTHLY }

/// One row per site (or org-wide when siteId is null). THE industry switch.
model CalibrationConfig {
  id           String  @id @default(uuid())
  siteId       String? @unique
  industryPack String                       // PHARMA | AUTOMOTIVE | FMCG | CUSTOM

  // Numbering
  eventNumberPrefix     String  @default("CAL")
  certificateNumberPrefix String @default("CC")

  // Scheduling policy
  dueSoonWindowDays     Int     @default(30)
  autoSpawnLeadDays     Int     @default(14)   // ticket created this far ahead of due
  graceDays             Int     @default(0)    // 0 = overdue the day after due
  allowEarlyCalibration Boolean @default(true)
  earlyWindowDays       Int     @default(15)
  intervalResetBasis    IntervalBasis @default(PERFORMED_DATE)

  // Enforcement
  blockUseWhenOverdue   Boolean @default(true)
  blockUseWhenFailed    Boolean @default(true)
  requireCompetencyToPerform Boolean @default(false)  // gate on LMS training record

  // Records & signatures — 21 CFR 11 / Annex 11
  requirePerformerSignature Boolean @default(true)
  requireReviewerSignature  Boolean @default(true)
  requireApproverSignature  Boolean @default(true)
  requireReasonForChange    Boolean @default(true)

  // Out-of-tolerance policy
  ootImpactAssessmentRequired Boolean @default(true)
  ootImpactWindow  OotWindow @default(SINCE_LAST_CALIBRATION)
  ootAutoSpawn     String[]  @default(["DEVIATION"])   // DEVIATION | CAPA | RISK
  ootRequiresCustomerNotification Boolean @default(false) // IATF 16949 §7.1.5.2.1
  ootRequiresProductHold          Boolean @default(false) // FMCG / BRCGS

  // Feature flags (pack-driven)
  enableMsa            Boolean @default(false)  // automotive
  enableInUseChecks    Boolean @default(false)  // FMCG + pharma balances
  enableLegalMetrology Boolean @default(false)  // FMCG weights & measures stamping
  enableAiqGroups      Boolean @default(false)  // pharma USP <1058>
  enableUsageIntervals Boolean @default(false)  // C8

  labelTemplate        Json?
  certificateTemplate  Json?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum IntervalBasis { PERFORMED_DATE  PREVIOUS_DUE_DATE }   // anniversary vs. drift-forward
enum OotWindow { SINCE_LAST_CALIBRATION  SINCE_LAST_PASSING_CHECK  FIXED_DAYS }
```

### D.3 Calibration plan (the schedule)

```prisma
enum IntervalType { DAYS  MONTHS  USAGE_HOURS  USAGE_CYCLES  RISK_MODULATED }

model CalibrationPlan {
  id           String  @id @default(uuid())
  equipmentId  String
  equipment    Equipment @relation(fields: [equipmentId], references: [id], onDelete: Cascade)
  version      Int     @default(1)          // superseded, never edited in place
  isActive     Boolean @default(true)

  intervalType   IntervalType @default(MONTHS)
  intervalValue  Int
  intervalJustification String?             // pharma: interval must be justified, not assumed

  methodDocId    String?                    // → Document (DMS) — the calibration SOP
  providerType   ProviderType @default(INTERNAL)
  providerId     String?                    // → Supplier (C4) when EXTERNAL
  estimatedDurationHours Decimal? @db.Decimal(6,2)

  requiresMsa        Boolean @default(false)
  requiredCourseId   String?                // → LmsCourse — competency to perform
  requiredStandardCategoryIds String[]      // which reference standards are acceptable

  nextDueAt     DateTime?
  lastEventId   String?

  points     CalibrationPoint[]
  events     CalibrationEvent[]
  supersededById String?
  isDeleted  Boolean @default(false)
  createdById String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([equipmentId, isActive]) @@index([nextDueAt])
}

enum ProviderType { INTERNAL  EXTERNAL  MANUFACTURER }

model CalibrationPoint {
  id        String @id @default(uuid())
  planId    String
  plan      CalibrationPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  sequence  Int
  label     String
  nominalValue  Decimal @db.Decimal(18, 6)
  unitId    String?
  toleranceType  ToleranceType
  toleranceValue Decimal @db.Decimal(18, 6)
  lowerLimit Decimal? @db.Decimal(18, 6)     // computed on save; stored for reporting fidelity
  upperLimit Decimal? @db.Decimal(18, 6)
  @@unique([planId, sequence])
}
```

**Why plans are versioned:** the tolerance an instrument was judged against three years
ago must still be reproducible from the record. Editing a plan in place silently rewrites
history — the exact data-integrity failure MHRA cites.

### D.4 Calibration execution (the record)

```prisma
enum CalibrationEventType { PERIODIC  INITIAL  AFTER_REPAIR  AFTER_RELOCATION  AD_HOC  VERIFICATION }
enum CalibrationEventStatus {
  PLANNED  SCHEDULED  IN_PROGRESS  PENDING_REVIEW  PENDING_APPROVAL
  APPROVED  REJECTED  CANCELLED
}
enum CalibrationOutcome { PASS  FAIL  CONDITIONAL  NOT_PERFORMED }

model CalibrationEvent {
  id          String @id @default(uuid())
  eventNo     String @unique                 // CAL-2026-00041
  equipmentId String
  equipment   Equipment @relation(fields: [equipmentId], references: [id], onDelete: Cascade)
  planId      String?
  plan        CalibrationPlan? @relation(fields: [planId], references: [id], onDelete: SetNull)
  planVersion Int?                           // frozen — see D.3 rationale

  type        CalibrationEventType @default(PERIODIC)
  status      CalibrationEventStatus @default(PLANNED)
  siteId      String?

  scheduledFor DateTime?
  startedAt    DateTime?
  performedAt  DateTime?
  performedById String?
  performedByExternal String?                // agency technician name when EXTERNAL
  providerType ProviderType @default(INTERNAL)
  providerId   String?

  // Environmental conditions at time of calibration (ISO 17025 §6.3)
  ambientTemperature Decimal? @db.Decimal(6,2)
  ambientHumidity    Decimal? @db.Decimal(6,2)
  environmentNotes   String?

  // Derived outcomes — never entered directly
  asFoundOutcome CalibrationOutcome?
  asLeftOutcome  CalibrationOutcome?
  overallOutcome CalibrationOutcome?
  adjustmentMade Boolean @default(false)

  certificateNo   String?
  certificateDocId String?                   // → Document (DMS) — the scanned/generated cert
  nextDueAt       DateTime?
  remarks         String?

  ticketId        String?                    // → Ticket (C5) — the human task
  reviewedById    String?
  reviewedAt      DateTime?
  approvedById    String?
  approvedAt      DateTime?
  rejectionReason String?

  readings   CalibrationReading[]
  standards  CalibrationStandardUse[]
  oot        OutOfToleranceAssessment?

  isDeleted Boolean @default(false)
  createdById String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([equipmentId, performedAt]) @@index([status]) @@index([siteId]) @@index([nextDueAt])
}

model CalibrationReading {
  id       String @id @default(uuid())
  eventId  String
  event    CalibrationEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  sequence Int
  label    String
  nominalValue   Decimal @db.Decimal(18, 6)
  unitId         String?
  lowerLimit     Decimal @db.Decimal(18, 6)   // frozen from the plan point
  upperLimit     Decimal @db.Decimal(18, 6)

  asFoundValue   Decimal? @db.Decimal(18, 6)
  asFoundError   Decimal? @db.Decimal(18, 6)  // computed
  asFoundInTolerance Boolean?                 // computed

  asLeftValue    Decimal? @db.Decimal(18, 6)
  asLeftError    Decimal? @db.Decimal(18, 6)
  asLeftInTolerance  Boolean?

  uncertainty    Decimal? @db.Decimal(18, 6)  // expanded uncertainty U (k=2)
  repeatability  Json?                        // optional replicate readings
  @@unique([eventId, sequence])
}

/// Traceability chain: which certified standard was used, and was it valid then?
model CalibrationStandardUse {
  id         String @id @default(uuid())
  eventId    String
  event      CalibrationEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  standardEquipmentId String                  // → Equipment (kind = REFERENCE_STANDARD)
  certificateNo       String?
  certificateValidUntil DateTime?
  traceableTo         String?                 // "NABL / NPL India", "NIST", "PTB"
  wasValidAtUse       Boolean @default(true)  // computed at save — a lapsed standard invalidates the calibration
  @@index([eventId]) @@index([standardEquipmentId])
}
```

### D.5 Out-of-tolerance & retrospective impact — the regulatory centrepiece

```prisma
enum OotStatus { OPEN  IMPACT_IN_PROGRESS  PENDING_QA_APPROVAL  CLOSED }
enum OotDisposition { NO_IMPACT  IMPACT_CONFIRMED  INCONCLUSIVE }

model OutOfToleranceAssessment {
  id        String @id @default(uuid())
  eventId   String @unique
  event     CalibrationEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  status    OotStatus @default(OPEN)

  // The window under suspicion — computed from CalibrationConfig.ootImpactWindow
  impactWindowFrom DateTime
  impactWindowTo   DateTime
  maxObservedError Decimal? @db.Decimal(18, 6)

  // Populated by the impact scan (D.6) — counts + ids, so the record is self-contained
  affectedResultIds   String[]     // LIMS Result rows produced on this instrument
  affectedQcResultIds String[]
  affectedSampleIds   String[]
  affectedBatchRefs   String[]     // free-form batch/lot refs for production gauges
  affectedTicketIds   String[]

  disposition   OotDisposition?
  justification String?
  qaComments    String?

  // Cross-module spawn (config-driven — CalibrationConfig.ootAutoSpawn)
  deviationTicketId String?
  capaTicketId      String?
  riskId            String?

  // Industry-specific obligations
  customerNotificationRequired Boolean @default(false)   // IATF 16949 §7.1.5.2.1
  customerNotifiedAt   DateTime?
  customerNotificationRef String?
  productHoldRequired  Boolean @default(false)           // BRCGS / FSSC
  productHoldRef       String?

  assessedById String?
  assessedAt   DateTime?
  approvedById String?
  approvedAt   DateTime?
  isDeleted Boolean @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([status])
}
```

### D.6 In-use verification checks (light-weight, high-frequency)

Not every control is a full calibration. A balance gets a daily check-weight
verification; a metal detector gets a test-piece pass every shift. These are the checks
FMCG lives on and pharma balance SOPs mandate — and they are what the *product-hold*
window is measured from.

```prisma
model InUseVerification {
  id        String @id @default(uuid())
  equipmentId String
  equipment Equipment @relation(fields: [equipmentId], references: [id], onDelete: Cascade)
  performedAt DateTime
  performedById String?
  shift      String?
  outcome    CalibrationOutcome
  readings   Json                    // [{label, nominal, observed, inTolerance}]
  batchRef   String?                 // what was running at the time
  remarks    String?
  // On failure, the hold window is [previous passing check, this check]
  holdTriggered Boolean @default(false)
  holdRef       String?
  createdAt DateTime @default(now())
  @@index([equipmentId, performedAt])
}
```

### D.7 MSA / Gage R&R (Automotive pack — Phase 5)

```prisma
enum MsaStudyType { GAGE_RR_CROSSED  GAGE_RR_NESTED  BIAS  LINEARITY  STABILITY  ATTRIBUTE_AGREEMENT }
enum MsaVerdict { ACCEPTABLE  CONDITIONAL  UNACCEPTABLE }

model MsaStudy {
  id        String @id @default(uuid())
  studyNo   String @unique
  equipmentId String
  type      MsaStudyType
  performedAt DateTime
  performedById String?
  partCount Int
  operatorCount Int
  trialCount Int
  // Computed results
  repeatabilityEv Decimal? @db.Decimal(10,4)   // equipment variation
  reproducibilityAv Decimal? @db.Decimal(10,4) // appraiser variation
  grrPercent    Decimal? @db.Decimal(10,4)
  ndc           Int?                            // number of distinct categories
  verdict       MsaVerdict?                     // <10% accept, 10-30% conditional, >30% reject
  toleranceUsed Decimal? @db.Decimal(18,6)
  trials    MsaTrial[]
  approvedById String?  approvedAt DateTime?
  isDeleted Boolean @default(false)
  createdAt DateTime @default(now())
  @@index([equipmentId])
}

model MsaTrial {
  id       String @id @default(uuid())
  studyId  String
  study    MsaStudy @relation(fields: [studyId], references: [id], onDelete: Cascade)
  partNo   Int
  operator Int
  trial    Int
  measured Decimal @db.Decimal(18,6)
  @@unique([studyId, partNo, operator, trial])
}
```

### D.8 Supplier extensions (C4)

```prisma
// added to model Supplier
  isCalibrationProvider Boolean @default(false)
  accreditationBody     String?      // NABL, A2LA, DAkkS, UKAS
  accreditationNo       String?
  accreditationScope    String?      // the measurement scope actually accredited
  accreditationExpiry   DateTime?
```

An external calibration certificate from a provider whose ISO/IEC 17025 accreditation had
lapsed is a finding in all three regimes; storing the expiry lets the sweep flag it.

### D.9 Label / QR status page

`Equipment.qrToken` backs a **public, unauthenticated** status endpoint following the
existing CoA QR-verify precedent (`app.use('/api/public/coa', …)`, `app.ts:111`):
scan the sticker on the instrument → calibration status, last calibrated, next due,
certificate number. Nothing else is exposed. This is the single feature that makes floor
adoption real in automotive and FMCG plants.

---

## E. State machines

**Instrument `calibrationStatus`** — maintained by the nightly sweep + event transitions:

```
NOT_REQUIRED ──(require)──► CALIBRATED
CALIBRATED ──(nextDue - dueSoonWindow)──► DUE_SOON
DUE_SOON ──(nextDue + graceDays passed)──► OVERDUE
{CALIBRATED,DUE_SOON,OVERDUE} ──(event → IN_PROGRESS)──► UNDER_CALIBRATION
UNDER_CALIBRATION ──(event APPROVED, overall PASS)──► CALIBRATED
UNDER_CALIBRATION ──(overall CONDITIONAL)──► LIMITED_USE
UNDER_CALIBRATION ──(overall FAIL)──► OUT_OF_SERVICE
OUT_OF_SERVICE ──(repair + AFTER_REPAIR event PASS)──► CALIBRATED
any ──(retire)──► (Equipment.status = RETIRED)
```

**`CalibrationEvent.status`:**

```
PLANNED → SCHEDULED → IN_PROGRESS → PENDING_REVIEW → PENDING_APPROVAL → APPROVED
                                          ▲                  │
                                          └──── REJECTED ◄────┘   (reason mandatory)
any non-APPROVED → CANCELLED (reason mandatory)
```

Signature gates are read from `CalibrationConfig`: `requireReviewerSignature = false`
collapses `PENDING_REVIEW`; `requireApproverSignature = false` collapses
`PENDING_APPROVAL`. FMCG typically runs performer-only; pharma runs all three.

**`OutOfToleranceAssessment.status`:**

```
OPEN → IMPACT_IN_PROGRESS → PENDING_QA_APPROVAL → CLOSED
```

An event cannot reach `APPROVED` while its OOT assessment is open and
`ootImpactAssessmentRequired = true`. That single rule is what makes the pharma and IATF
answers auditable.

---

## F. Industry packs — the multi-industry answer

A pack is **seed data**: one `CalibrationConfig` row + a set of `EquipmentCategory` rows
with `CalibrationPointTemplate` children. Selecting a pack in
**Calibration → Settings** applies it; every value stays editable afterwards. The pack is
suggested from `Organization.industry` (already collected —
`organization.schema.ts:29`, values include `Pharmaceuticals`, `Automotive`, `FMCG`).

### F.1 Configuration matrix

| Setting | **PHARMA** | **AUTOMOTIVE** | **FMCG** |
|---|---|---|---|
| Governing refs | 21 CFR 11 · EU GMP Annex 11 & 15 · USP ⟨1058⟩ · GAMP 5 · ICH Q7 §5.3 | IATF 16949 §7.1.5.1/§7.1.5.2/§7.1.5.3 · ISO 9001 §7.1.5 · AIAG MSA 4th ed · ISO/IEC 17025 | ISO 22000 §8.7 · FSSC 22000 · BRCGS Food §6.3 · HACCP · Legal Metrology |
| `dueSoonWindowDays` | 30 | 30 | 14 |
| `autoSpawnLeadDays` | 21 | 14 | 7 |
| `graceDays` | 0 | 0 | 0 |
| `intervalResetBasis` | `PREVIOUS_DUE_DATE` (no interval creep) | `PREVIOUS_DUE_DATE` | `PERFORMED_DATE` |
| `blockUseWhenOverdue` | true | true | true |
| `requireCompetencyToPerform` | true (LMS-gated) | true | false |
| Signatures (perform/review/approve) | ✔ / ✔ / ✔ | ✔ / ✔ / ✖ | ✔ / ✖ / ✖ |
| `requireReasonForChange` | true | true | false |
| `ootImpactAssessmentRequired` | true | true | true |
| `ootImpactWindow` | `SINCE_LAST_CALIBRATION` | `SINCE_LAST_CALIBRATION` | `SINCE_LAST_PASSING_CHECK` |
| `ootAutoSpawn` | `DEVIATION`, `RISK` | `DEVIATION`, `CAPA` | `DEVIATION` |
| `ootRequiresCustomerNotification` | false | **true** | false |
| `ootRequiresProductHold` | false | true | **true** |
| `enableMsa` | false | **true** | false |
| `enableInUseChecks` | true (balances) | false | **true** (CCP devices) |
| `enableLegalMetrology` | false | false | **true** |
| `enableAiqGroups` | **true** (USP ⟨1058⟩ A/B/C) | false | false |
| Certificate template | GxP cert: as-found/as-left table, uncertainty, standards chain, 3 signatures | IATF cert: as-received readings, conformity statement, impact assessment block | Simple cert: reading, tolerance, national-standard reference, stamp validity |

### F.2 Seeded equipment categories & point templates

**PHARMA** — `backend/prisma/seed-calibration-pharma.ts`

| Category | Kind | Interval | Criticality | Points (template) | Notes |
|---|---|---|---|---|---|
| Analytical Balance | LAB_INSTRUMENT | 180 d | CRITICAL | 10%, 50%, 100% of span (E2 check weights) | daily in-use check ON; AIQ group B |
| HPLC / UPLC | LAB_INSTRUMENT | 180 d | CRITICAL | Flow rate, wavelength accuracy, injector precision, column oven temp | AIQ group C; GAMP 4 |
| pH Meter | LAB_INSTRUMENT | 90 d | MAJOR | Buffer 4.01 / 7.00 / 10.01 | daily in-use check ON |
| Dissolution Apparatus | LAB_INSTRUMENT | 180 d | CRITICAL | RPM, temperature, vessel centering, wobble | |
| Autoclave | UTILITY | 365 d | CRITICAL | Chamber temp at 121 °C, pressure, cycle time | qualification, not calibration |
| Stability Chamber | UTILITY | 180 d | CRITICAL | 25 °C/60 %RH, 40 °C/75 %RH mapping points | ties to `StabilityStudy` |
| Thermometer / Data Logger | MONITORING_DEVICE | 365 d | MAJOR | 2 °C, 8 °C, 25 °C | cold chain |
| Reference Weight Set | REFERENCE_STANDARD | 730 d | CRITICAL | per OIML class | traceable to NPL/NIST |

**AUTOMOTIVE** — `seed-calibration-automotive.ts`

| Category | Kind | Interval | Criticality | Points | Notes |
|---|---|---|---|---|---|
| Torque Wrench | PRODUCTION_GAUGE | 180 d | CRITICAL | 20%, 60%, 100% of range, 3 trials each | MSA required |
| Vernier Caliper / Micrometer | PRODUCTION_GAUGE | 365 d | MAJOR | Gauge-block steps across range | MSA required |
| Dial Gauge / Bore Gauge | PRODUCTION_GAUGE | 365 d | MAJOR | 25%, 50%, 75%, 100% | |
| Plug / Ring / Snap Gauge | PRODUCTION_GAUGE | 365 d | MAJOR | Go / No-Go wear check | attribute MSA |
| CMM | PRODUCTION_GAUGE | 365 d | CRITICAL | Ball-bar / artefact verification | ISO 10360 |
| Pressure Gauge | MONITORING_DEVICE | 365 d | MAJOR | 25%, 50%, 75%, 100% FS | |
| Leak Test Machine | MONITORING_DEVICE | 180 d | CRITICAL | Master leak part verification | daily master check |
| Gauge Block Set | REFERENCE_STANDARD | 1095 d | CRITICAL | per grade | traceable, accredited lab |

Automotive-only behaviour: `requiresMsa = true` categories block plan activation until an
`MsaStudy` with `verdict != UNACCEPTABLE` exists; OOT assessments force the customer-
notification fields; the certificate template carries the **conformity statement** and
**as-received out-of-spec impact** blocks IATF §7.1.5.2.1 enumerates.

**FMCG** — `seed-calibration-fmcg.ts`

| Category | Kind | Interval | Criticality | Points | In-use check |
|---|---|---|---|---|---|
| Metal Detector | MONITORING_DEVICE | 180 d | CRITICAL | Fe / Non-Fe / SS test pieces, leading & trailing | **PER_SHIFT** |
| Checkweigher | MONITORING_DEVICE | 180 d | CRITICAL | Min, target, max weight | **PER_SHIFT** |
| X-Ray Inspection | MONITORING_DEVICE | 180 d | CRITICAL | Test card, contaminant standards | PER_SHIFT |
| Platform / Bench Scale | MONITORING_DEVICE | 365 d | CRITICAL | 10%, 50%, 100% capacity | DAILY; legal metrology stamp |
| Probe Thermometer | MONITORING_DEVICE | 180 d | CRITICAL | Ice point 0 °C, boiling 100 °C, 75 °C | DAILY |
| Chart Recorder / Data Logger | MONITORING_DEVICE | 365 d | MAJOR | Storage & process temperatures | WEEKLY |
| pH / Brix / Water-activity Meter | LAB_INSTRUMENT | 90 d | MAJOR | Buffer / standard solutions | DAILY |
| Certified Test Weights | REFERENCE_STANDARD | 730 d | CRITICAL | per class | traceable to national standard |

FMCG-only behaviour: `InUseVerification` failure computes the hold window back to the last
passing check and raises a **product hold** reference; legal-metrology stamp validity is a
second, independent expiry tracked on the instrument.

### F.3 How a pack is applied

`POST /api/calibration/config/apply-pack { pack: 'AUTOMOTIVE', mode: 'merge' | 'replace' }`

- upserts `CalibrationConfig` for the site,
- upserts `EquipmentCategory` + `CalibrationPointTemplate` rows tagged with
  `industryPack`,
- **never** touches existing instruments or plans (categories are suggestions until a
  plan is created),
- writes one `writeTrail` entry with the pack name and mode.

Multi-site tenants can run different packs per site — a pharma group with a captive
packaging plant is a real case, and `CalibrationConfig.siteId` handles it without a
second deployment.

---

## G. Cross-module integration

Each row is a concrete wiring, not an aspiration. Existing mechanisms are named.

| Module | Integration | Mechanism |
|---|---|---|
| **LIMS** | An instrument that is `OVERDUE` / `OUT_OF_SERVICE` cannot be selected for a `SampleTest` or `Result`. Existing `Result.equipmentId` FK makes the OOT impact scan a single query. | Guard in `sample-testing.service.ts` result entry; scan in `calibration-impact.service.ts` |
| **Deviation / CAPA** | OOT `FAIL` spawns a child ticket of the configured workflow type, pre-filled with instrument, window, affected counts. | Existing child-ticket spawn (`finding-sync.service.ts`, `ChildWorkflowTrigger`) |
| **Risk** | `Equipment` becomes a linkable entity in `lib/risk-entity-registry.ts`; `RISK_MODULATED` interval type reads the risk profile multiplier. Implements `RISK-cross-module-integration-plan.md` §D.16 concretely. | Entity registry entry + `resolveInterval()` |
| **DMS** | Calibration SOP (`plan.methodDocId`) and the certificate (`event.certificateDocId`) are controlled documents, versioned and access-gated. | `Document` / `DocumentVersion` |
| **LMS** | `plan.requiredCourseId` + `config.requireCompetencyToPerform` — a technician without a valid `LmsEnrollment` completion cannot be selected as performer. | `LmsEnrollment` lookup in the perform guard |
| **Audit** | Overdue-calibration and lapsed-standard queries become audit evidence; audit findings can link to an instrument. | `AuditFinding` link + evidence query |
| **Workflow / Tickets** | `CalibrationEvent.ticketId` — the event is the record, the ticket is the task, so SLA, escalation, comments, attachments and the module page all work unchanged. | Existing engine (C5) |
| **Approvals** | Review/approve steps route through `ApprovalPolicy` / `ApprovalInstance` when configured, instead of a bespoke two-field approval. | `modules/approval` |
| **SLA & Escalation** | Overdue calibration tickets escalate on the existing rules; a `CRITICAL` instrument escalates faster via severity. | `SlaPolicy`, `EscalationRule` |
| **Notification** | Due-soon, overdue, OOT-raised, certificate-expiring, standard-lapsed. | `Notification` + `NotificationType` additions |
| **Audit trail / e-sig** | Every state transition through `writeTrail`; performer/reviewer/approver via `ESignature` with `meaningCode` (`CALIBRATION_PERFORMED`, `CALIBRATION_REVIEWED`, `CALIBRATION_APPROVED`, `OOT_ASSESSED`). `recordHash` snapshots the event. | `modules/audit/compliance.service.ts` |
| **Sites** | `Equipment.siteId`, `CalibrationEvent.siteId`, `CalibrationConfig.siteId` scoped by the existing helpers. | `lib/audit-scope.ts`, `site.view_all` |
| **Business calendar** | Scheduled dates and SLA clocks respect working days. | `modules/business-calendar` |
| **Dashboard / Search / Nav counts** | Calibration KPIs on the command centre; instruments searchable by code/serial/asset tag; overdue count as a sidebar badge. | `modules/dashboard`, `modules/search`, `modules/nav-counts` |
| **Supplier quality** | External provider on-time performance and OOT rate feed supplier scoring. | `Supplier` (C4, D.8) |
| **Ticket report PDF** | Calibration certificate reuses the branded report pipeline (`@react-pdf/renderer`) and org logo/footer. | `docs/ticket-report-download-plan.md` |

---

## H. API surface

Mounted `app.use('/api/calibration', calibrationRoutes)` in `backend/src/app.ts`,
alongside a public router for the QR label.

```
# Instruments (the registry)
GET    /api/calibration/instruments              ?kind&status&calibration_status&site_id&department_id&category_id&criticality&due_within&search&page
POST   /api/calibration/instruments
GET    /api/calibration/instruments/:id          → + active plan, last event, next due, readiness
PUT    /api/calibration/instruments/:id
DELETE /api/calibration/instruments/:id
POST   /api/calibration/instruments/:id/retire       { reason }
POST   /api/calibration/instruments/:id/out-of-service { reason }
POST   /api/calibration/instruments/:id/exempt       { reason }
GET    /api/calibration/instruments/:id/history      → events + in-use checks + trail, merged timeline
GET    /api/calibration/instruments/:id/label        → QR + sticker payload
GET    /api/calibration/instruments/:id/drift        → as-found error per point over time (interval justification)

# Categories & point templates (config)
GET/POST/PUT/DELETE  /api/calibration/categories[/:id]
GET/POST/PUT/DELETE  /api/calibration/categories/:id/point-templates[/:ptId]

# Plans
GET    /api/calibration/instruments/:id/plans
POST   /api/calibration/instruments/:id/plans          → v1
PUT    /api/calibration/plans/:id                      → supersede (new version)
POST   /api/calibration/plans/:id/deactivate
GET/POST/PUT/DELETE  /api/calibration/plans/:id/points[/:pointId]

# Events (execution)
GET    /api/calibration/events        ?status&type&equipment_id&site_id&from&to&outcome&overdue
POST   /api/calibration/events                          { equipment_id, type, scheduled_for }
GET    /api/calibration/events/:id
PUT    /api/calibration/events/:id
POST   /api/calibration/events/:id/start
PUT    /api/calibration/events/:id/readings             { readings: [{sequence, as_found_value, as_left_value, uncertainty}] }
POST   /api/calibration/events/:id/standards            { standard_equipment_id, certificate_no, ... }
POST   /api/calibration/events/:id/submit               → evaluates tolerance, sets outcomes, → PENDING_REVIEW
POST   /api/calibration/events/:id/review               { decision, comments, signature }
POST   /api/calibration/events/:id/approve              { signature }        → advances nextDueAt, instrument status
POST   /api/calibration/events/:id/reject               { reason, signature }
POST   /api/calibration/events/:id/cancel               { reason }
GET    /api/calibration/events/:id/certificate          → PDF

# Out-of-tolerance
GET    /api/calibration/oot                 ?status&site_id
GET    /api/calibration/oot/:id
POST   /api/calibration/oot/:id/scan-impact             → recomputes affected results/samples/batches
PUT    /api/calibration/oot/:id                         { disposition, justification, affected_batch_refs }
POST   /api/calibration/oot/:id/spawn                   { kind: DEVIATION|CAPA|RISK }
POST   /api/calibration/oot/:id/notify-customer         { reference, notes }   (automotive)
POST   /api/calibration/oot/:id/product-hold            { reference }          (FMCG)
POST   /api/calibration/oot/:id/approve                 { signature }

# In-use verification checks
GET    /api/calibration/instruments/:id/checks
POST   /api/calibration/instruments/:id/checks          { performed_at, shift, readings, batch_ref }
GET    /api/calibration/checks/due                      → what is owed this shift

# Reference standards
GET    /api/calibration/standards                       → Equipment kind=REFERENCE_STANDARD + validity
GET    /api/calibration/standards/expiring              ?days=60

# MSA (automotive pack)
GET/POST  /api/calibration/msa[/:id]
POST      /api/calibration/msa/:id/trials
POST      /api/calibration/msa/:id/compute              → EV/AV/GRR/ndc/verdict
POST      /api/calibration/msa/:id/approve

# Config & packs
GET    /api/calibration/config                 ?site_id
PUT    /api/calibration/config
POST   /api/calibration/config/apply-pack      { pack, mode }
GET    /api/calibration/config/packs           → available packs + preview

# Analytics
GET    /api/calibration/analytics/summary      → compliance %, overdue, due-30, OOT rate, MTBOOT
GET    /api/calibration/analytics/schedule     → forward calendar
GET    /api/calibration/analytics/by-category  → performance per category
GET    /api/calibration/analytics/providers    → external provider on-time / OOT rate

# Public (no auth) — precedes the /api catch-all, per app.ts:111 precedent
GET    /api/public/calibration/verify/:qrToken
```

---

## I. RBAC keys (add to `backend/src/lib/rbac-catalog.ts`)

```
calibration_instrument.read | create | update | delete | retire
calibration_plan.read | create | update | delete
calibration_event.read | create | update | delete | perform | review | approve
calibration_oot.read | update | approve | notify
calibration_check.read | create
calibration_standard.read | create | update | delete
msa_study.read | create | update | approve
calibration_config.read | update
calibration_analytics.read
```

Verb mapping for the Access Matrix (`client/src/lib/accessActions.ts`): `perform`, `retire`
and `notify` are new verbs — add `perform → create`, `retire → approve`, `notify → approve`
to `VERB_COLUMN`, or accept them under **More⋯** (they surface either way; nothing is
silently dropped).

Nav registration in `client/src/lib/navAccess.ts`:

```ts
{
  key: 'calibration',
  label: 'Calibration & Equipment',
  description: 'Measuring equipment registry, calibration schedule, execution, and out-of-tolerance impact.',
  tabs: [
    { key: 'cal.dashboard',   label: 'Dashboard',            permission: 'calibration_analytics.read',   entity: 'calibration_analytics' },
    { key: 'cal.instruments', label: 'Instruments',          permission: 'calibration_instrument.read',  entity: 'calibration_instrument' },
    { key: 'cal.schedule',    label: 'Schedule',             permission: 'calibration_event.read',       entity: 'calibration_event' },
    { key: 'cal.events',      label: 'Calibrations',         permission: 'calibration_event.read',       entity: 'calibration_event' },
    { key: 'cal.oot',         label: 'Out of Tolerance',     permission: 'calibration_oot.read',         entity: 'calibration_oot' },
    { key: 'cal.checks',      label: 'In-Use Checks',        permission: 'calibration_check.read',       entity: 'calibration_check' },
    { key: 'cal.standards',   label: 'Reference Standards',  permission: 'calibration_standard.read',    entity: 'calibration_standard' },
    { key: 'cal.msa',         label: 'MSA / Gage R&R',       permission: 'msa_study.read',               entity: 'msa_study' },
    { key: 'cal.categories',  label: 'Categories',           permission: 'calibration_config.read',      entity: 'calibration_config' },
    { key: 'cal.settings',    label: 'Settings',             permission: 'calibration_config.update',    entity: 'calibration_config' },
  ],
}
```

`cal.msa` and `cal.checks` are hidden when the corresponding `CalibrationConfig` flag is
off — permission gates *who*, config gates *whether the capability exists here at all*.

---

## J. Background jobs

New sweeps in `backend/src/jobs/sweeps/`, registered on the existing worker
(`backend/src/jobs/worker.ts`), following `flagExpiringCertifications.ts` and
`spawnDueAudits.ts`:

| Sweep | Cadence | Does |
|---|---|---|
| `refreshCalibrationStatus.ts` | hourly | Recomputes `Equipment.calibrationStatus` from `nextDueAt`, `dueSoonWindowDays`, `graceDays`. The single writer of that field. |
| `spawnDueCalibrations.ts` | daily | Creates `CalibrationEvent` (PLANNED→SCHEDULED) + its ticket `autoSpawnLeadDays` ahead of due. Idempotent on `(planId, scheduledFor)`. |
| `flagLapsedStandards.ts` | daily | Reference standards past due, and provider accreditations expiring within 60 days. Flags every event that used a since-lapsed standard. |
| `flagMissedInUseChecks.ts` | hourly | Instruments with `requiresInUseCheck` whose shift/day check is missing — FMCG's real daily control. |
| `notifyCalibrationDue.ts` | daily | Custodian + department head digests. |

---

## K. Frontend

New feature folder `client/src/features/calibration/`, routes under `/calibration/*`,
mirroring the LIMS layout pattern (`LimsModuleLayout.tsx` / `LimsConfigLayout.tsx`).

| File | Screen |
|---|---|
| `CalibrationModuleLayout.tsx` | Tab shell, config-driven tab visibility |
| `CalibrationDashboardPage.tsx` | Compliance gauge, overdue by criticality, 90-day forward calendar, OOT trend, provider scorecard — built on `@/components/analytics` |
| `InstrumentListPage.tsx` | Registry: filter by kind / status / criticality / site / due-window; bulk label print; CSV export via `lib/export.ts` |
| `InstrumentDetailPage.tsx` | **The workspace.** Header status chip + next-due countdown; tabs: Overview · Plan · Calibration History · In-Use Checks · Drift Chart · Documents · Audit Trail · Linked Risks |
| `CalibrationPlanEditor.tsx` | Interval, provider, method SOP, competency, calibration points grid with live tolerance-limit preview |
| `CalibrationSchedulePage.tsx` | Month/quarter calendar + list; drag to reschedule within the early window |
| `CalibrationEventPage.tsx` | Execution: as-found / as-left grid with per-cell in/out-of-tolerance colouring, standards-used picker (invalid standards blocked), environment block, e-signature modal |
| `OotListPage.tsx` / `OotDetailPage.tsx` | Impact scan results (affected results / samples / batches), disposition, spawn buttons, customer-notification / product-hold panels shown per pack |
| `InUseChecksPage.tsx` | Shift-check entry, "due now" list, failure → hold banner |
| `ReferenceStandardsPage.tsx` | Standards + certificate validity + traceability chain |
| `MsaStudyPage.tsx` | Trial data grid, computed EV/AV/GRR/ndc, verdict chip (Phase 5) |
| `EquipmentCategoriesPage.tsx` | Category + point-template master |
| `CalibrationSettingsPage.tsx` | Config form + **Apply Industry Pack** with a diff preview before commit |

**Reuse, don't rebuild:** `KpiCard`, `ChartCard`, `ComplianceGauge`, `AgingBucketChart`,
`TrendLineChart`, `CalendarList`, `DonutChart` all exist in
`client/src/components/analytics/`. `CalibrationAnalytics.tsx` is **rewritten** to read
real `CalibrationEvent` / OOT data instead of regex-matching ticket titles — that is the
first honest KPI panel the module gets.

---

## L. Phased delivery

Each phase is independently shippable and leaves the app in a working state.

### Phase 0 — Foundation (≈1 sprint)
- Migration: extend `Equipment` (D.1); add `EquipmentCategory`, `CalibrationPointTemplate`, `CalibrationConfig`; extend `Supplier`.
- Backfill: existing equipment → `kind = LAB_INSTRUMENT`, `siteId = HQ` (reuse `lib/site-defaults.ts` idiom), free-text `category` → `EquipmentCategory` rows.
- RBAC keys + nav registration + empty module shell.
- **Exit:** LIMS → Equipment unchanged and green; new Calibration module visible with an empty registry.

### Phase 1 — Instrument registry & status engine (≈1.5 sprints)
- Instrument CRUD with metrology fields, criticality, custodian, exemptions.
- `calibrationStatus` state machine + `refreshCalibrationStatus` sweep.
- QR token, label print, public verify endpoint.
- Instrument detail workspace (Overview / Documents / Audit Trail).
- **Exit:** every measuring device in the plant is registered, statused and labelled.

### Phase 2 — Plans & scheduling (≈1.5 sprints)
- Versioned `CalibrationPlan` + `CalibrationPoint` with tolerance-limit computation.
- `spawnDueCalibrations` + `notifyCalibrationDue` sweeps; ticket linkage (C5).
- Schedule calendar; due/overdue dashboards; nav-count badge.
- **Exit:** the schedule runs itself; nobody tracks due dates in Excel.

### Phase 3 — Execution & records (≈2 sprints)
- `CalibrationEvent` lifecycle, as-found/as-left readings, derived outcomes.
- Reference-standard traceability with validity enforcement.
- Review/approve gates driven by config; `ESignature` + `writeTrail` on every transition.
- Certificate PDF via the branded report pipeline.
- Migrate `CalibrationRecord` → `CalibrationEvent`; LIMS equipment page reads the new source.
- **Exit:** a calibration certificate generated by the system is inspection-grade.

### Phase 4 — Out-of-tolerance & impact (≈1.5 sprints) — *the highest-value phase*
- OOT assessment record + impact scan across `Result`, `QcResult`, `Sample`, tickets.
- Config-driven spawn of Deviation / CAPA / Risk.
- Approval gate: event cannot close with an open OOT.
- Use-blocking guards in LIMS result entry and ticket assignment.
- **Exit:** "show me everything measured by this instrument since it last passed" is one click.

### Phase 5 — Industry packs (≈2 sprints)
- Pack seeds for PHARMA / AUTOMOTIVE / FMCG (F.2) + `apply-pack` with diff preview.
- `InUseVerification` + `flagMissedInUseChecks` (FMCG, pharma balances) + hold window.
- MSA / Gage R&R (automotive): studies, trials, EV/AV/GRR/ndc, verdict gate on plan activation.
- Customer notification (IATF) and product hold (BRCGS) panels.
- Legal-metrology stamp tracking; AIQ group / GAMP category fields.
- **Exit:** a new tenant picks their industry and gets a working calibration system on day one.

### Phase 6 — Intelligence & closure (≈1.5 sprints)
- Drift analysis per calibration point → **interval justification** recommendations (the pharma "why 6 months?" answer, and IATF's data-driven interval review).
- Risk-modulated intervals (`RISK_MODULATED`) wired to the risk profile (`RISK-cross-module-integration-plan.md` §D.16).
- Provider scorecard into supplier quality.
- Audit-readiness pack: one export bundling registry, schedule compliance, OOT log, standards traceability, signature log for a date range.
- Rewritten `CalibrationAnalytics.tsx` on real data.
- **Exit:** the module produces evidence, not just records.

---

## M. Migrations

| # | Migration | Risk | Mitigation |
|---|---|---|---|
| M1 | `Equipment` column additions | Low — all nullable/defaulted | — |
| M2 | Free-text `Equipment.category` → `EquipmentCategory` FK | Medium — dirty strings | Distinct-value report first; auto-create a category per distinct value; keep `category` as a deprecated column for one release |
| M3 | `CalibrationRecord` → `CalibrationEvent` | Medium — history must survive | Copy, don't move. Map `calibratedAt→performedAt`, `result→overallOutcome`, mark `asFoundOutcome = null` (unknown, and honestly so). Keep the old table read-only for one release, then drop |
| M4 | `Equipment.siteId` backfill | Low | Reuse `ensureDefaultSite()` (`lib/site-defaults.ts`) — only fills NULLs, never reassigns |
| M5 | `qrToken` generation | Low | Lazy on first label print, plus a one-off backfill script |
| M6 | RBAC catalog sync | Low | Existing `lib/rbac-sync.ts` upserts new keys at startup; grant the new keys to SUPER_ADMIN automatically, everything else opt-in |

⚠ **Do not** drop `CalibrationRecord` in the same release that adds `CalibrationEvent`.
`EquipmentDetailPage` and `seed-lims-data.ts` both read it.

---

## N. Open decisions

1. **C8** — usage-based intervals (hours/cycles) in v1? Needs a meter-reading source.
2. **Uncertainty budgets** — store the full budget components, or only expanded
   uncertainty `U`? Full budgets matter if a tenant runs an accredited internal lab under
   ISO/IEC 17025 (common in automotive per §7.1.5.3.1).
3. **External provider ingestion** — manual certificate entry only, or a CSV/PDF import
   for agencies that calibrate 200 gauges at once? Recommendation: CSV import in Phase 5;
   PDF parsing is not worth it.
4. **Offline shift checks** — do FMCG plants need the in-use check entry to work offline
   on the floor? That is a PWA/queueing decision affecting far more than this module.
5. **Qualification vs. calibration** — `UTILITY` equipment (autoclaves, chambers) is
   *qualified* (IQ/OQ/PQ), not calibrated. This plan carries the qualification state field
   but not a full qualification protocol engine. Confirm that is acceptable for v1, or
   scope a separate Equipment Qualification module.
6. **Interval-change control** — should shortening/lengthening an interval require a
   Change Control ticket? Pharma tenants will expect yes; it is a two-line hook to
   `ChildWorkflowTrigger` if confirmed.

---

## O. Standards conformance matrix

| Requirement | Standard / clause | Where satisfied |
|---|---|---|
| Documented calibration programme with defined intervals | ISO 9001 §7.1.5.2 · ICH Q7 §5.3 | `CalibrationPlan` (D.3) |
| Traceability to national/international standards | ISO 9001 §7.1.5.2(a) · ISO/IEC 17025 §6.5 · BRCGS §6.3 | `CalibrationStandardUse` (D.4) |
| Identification of calibration status | ISO 9001 §7.1.5.2(b) | `calibrationStatus` + QR label (D.1, D.9) |
| Safeguarding from adjustment invalidating results | ISO 9001 §7.1.5.2(c) | `blockUseWhenOverdue`, plan versioning |
| Assessment of validity of previous results when found defective | ISO 9001 §7.1.5.2 · IATF §7.1.5.2.1 | `OutOfToleranceAssessment` (D.5) |
| As-received readings out of specification recorded | IATF 16949 §7.1.5.2.1 | `asFoundValue` / `asFoundOutcome` |
| Customer notification for suspect product shipped | IATF 16949 §7.1.5.2.1 | `customerNotificationRequired` (D.5, F.1) |
| Statements of conformity after calibration | IATF 16949 §7.1.5.2.1 | Certificate template (F.1) |
| Measurement systems analysis | IATF 16949 §7.1.5.1.1 · AIAG MSA | `MsaStudy` (D.7) |
| Internal/external laboratory scope & accreditation | IATF 16949 §7.1.5.3 · ISO/IEC 17025 | `Supplier` accreditation fields (D.8) |
| Monitoring & measuring of CCPs | ISO 22000 §8.7 · HACCP principle 4 | `InUseVerification` (D.6) |
| Calibration of equipment critical to food safety; action on out-of-calibration product | BRCGS Food §6.3 · FSSC 22000 | OOT + `productHoldRequired` (D.5, F.1) |
| Analytical instrument qualification (A/B/C) | USP ⟨1058⟩ | `aiqGroup`, `qualificationState` (D.1) |
| Computerised system / record integrity | 21 CFR 11 · EU GMP Annex 11 | `writeTrail`, `ESignature`, `recordHash`, `requireReasonForChange` |
| ALCOA+ attributable, contemporaneous, original, accurate | MHRA DI guidance | Existing audit-trail infrastructure (`docs/AUDIT-TRAIL-ALCOA-compliance-plan.md`) |
| Qualification of equipment | EU GMP Annex 15 · GAMP 5 | `qualificationState`, `gampCategory` (v1: state tracking — see decision N.5) |
| Risk-based interval setting | ICH Q9 · GAMP 5 | `RISK_MODULATED` interval (Phase 6, §G) |

---

## P. Effort summary

| Phase | Scope | Est. |
|---|---|---|
| 0 | Foundation, migrations, RBAC, shell | 1.0 sprint |
| 1 | Instrument registry & status engine | 1.5 |
| 2 | Plans & scheduling | 1.5 |
| 3 | Execution & records | 2.0 |
| 4 | OOT & retrospective impact | 1.5 |
| 5 | Industry packs (pharma / auto / FMCG), in-use checks, MSA | 2.0 |
| 6 | Drift, risk intervals, audit-readiness pack, analytics | 1.5 |
| | **Total** | **≈11 sprints** |

**Minimum credible release** is Phases 0-4 (≈7.5 sprints): a complete, inspection-ready
calibration system for all three industries, with the differences configured by hand.
Phase 5 turns that hand-configuration into a one-click industry pack, which is what makes
the module sellable rather than merely deployable.
