# LIMS Gap Analysis — Quantum Kairoz vs. Standard LIMS Process

> **Date:** 2026-07-07
> **Scope:** The 11-phase standard LIMS process model, mapped against the current
> Quantum Kairoz codebase (`backend/prisma/schema.prisma`, `backend/src/modules/*`,
> `client/src/features/lims/*`).
> **Verdict:** The platform already implements the large majority of a compliant LIMS
> end-to-end. The gaps cluster into **five concrete features**, detailed at the bottom.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Built — schema **+** API **+** UI wired end-to-end |
| ⚠️ | Partial — modeled or half-wired; needs completion |
| ❌ | Missing — not present in the codebase |

---

## Phase-by-phase coverage

### Phase 1 — Sample Registration & Login

| Item | Status | Evidence / Notes |
|------|:------:|------------------|
| Sample receipt / registration | ✅ | `Sample` model, `SampleListPage`; `sampleNumber` + `barcode` auto-generated & unique |
| Metadata capture | ✅ | source site, `collectedAt`/`receivedAt`, `sampleType`, product/batch, `customerId`/`supplierId`/`samplingPointId` |
| Chain of custody begins | ✅ | `CustodyEvent` (action, from/to location, handler, timestamp) |
| Priority flagging | ⚠️ | `Sample.priority` = Low/Normal/High/Urgent — **no STAT / regulatory-submission tier** |
| Condition check (temp / integrity / packaging at login) | ❌ | No condition, temperature, integrity, or packaging fields on `Sample` |

### Phase 2 — Test Assignment & Scheduling

| Item | Status | Evidence / Notes |
|------|:------:|------------------|
| Test panel / method assignment | ✅ | `TestDefinition`, `TestPanel`, `SampleTest`; methods via `TestMethod`; spec auto-bind via `SpecVersion` |
| Analyst assignment | ✅ | `analystId` on `SampleTest` / `Worklist` (manual) |
| Reagent / standard calibration check before scheduling | ⚠️ | Equipment calibration tracked, but **not gated** before scheduling a test |
| Stability timepoint scheduling | ✅ | `StabilityStudy.timepointsMonths` → auto `StabilityPull` rows |
| Instrument slot booking / scheduling | ❌ | `instrumentId` is a reference only — no booking calendar / slots |
| Skill / workload-based auto-assignment | ❌ | Assignment is manual |

### Phase 3 — Sample Storage & Chain of Custody

| Item | Status | Evidence / Notes |
|------|:------:|------------------|
| Storage location assignment | ✅ | `StorageLocation`, `Sample.currentLocationId` |
| Movement logging | ✅ | `CustodyEvent` on every move |
| Aliquot / sub-sample lineage | ⚠️ | `Aliquot` model exists (parent-child) — thin, likely no dedicated UI |
| Retention tracking | ❌ | No retention-period fields anywhere |

### Phase 4 — Test Execution & Data Capture

| Item | Status | Evidence / Notes |
|------|:------:|------------------|
| Manual worksheet entry + auto formula / spec compare | ✅ | `Result` (`numericValue`, `evaluation`, `isOutOfSpec`, min/max snapshot) |
| Data-integrity controls (timestamp + user, no hard delete, audit) | ✅ | `AuditTrailEntry` (before/after + reason); `enteredById`/`enteredAt` |
| **Instrument integration (bidirectional / LES / middleware)** | ❌ | **Manual entry only** — no instrument interface, no CSV/file import of raw runs |

### Phase 5 — QC Checks & OOS Handling

| Item | Status | Evidence / Notes |
|------|:------:|------------------|
| Spec comparison Pass / Fail / OOT | ✅ | `Result.evaluation` = PASS/OOS/OOT |
| OOS workflow (Phase I/II, invalidate/confirm, CAPA) | ✅ | `OosInvestigation` (PHASE_1A→PHASE_2), classification, links to CAPA ticket |
| Retest / resample logic | ✅ | `retestRequired`, `resampleRequired` |
| Control charts (Levey-Jennings / Westgard) | ✅ | `QcResult` (zScore, Westgard `violatedRules`), `QcChartPage` |

### Phase 6 — Review & Approval Workflow

| Item | Status | Evidence / Notes |
|------|:------:|------------------|
| Multi-tier review | ✅ | `SampleTest.reviewStatus`, `DataReviewPage`; generic workflow/approval engine |
| Electronic signatures (21 CFR Part 11) | ✅ | `ESignature` (meaning, user, timestamp) |
| Comment / rejection loop | ✅ | Approval engine + `TicketComment` |

### Phase 7 — Certificate of Analysis & Reporting

| Item | Status | Evidence / Notes |
|------|:------:|------------------|
| CoA auto-generation | ✅ | `Coa` snapshots results; `CoaTemplate`; `CoaDetailPage` |
| Public verification | ✅ | QR `verifyToken` + `CoaVerifyPage` (beyond the standard list) |
| Batch release decision | ✅ | `Sample.disposition` RELEASED/REJECTED, e-signed |
| Dashboard / KPIs | ✅ | `LimsDashboardPage`, `lims-analytics` module |
| Report distribution (email / portal) | ⚠️ | Public link exists; **scheduled email distribution unclear** |

### Phase 8 — Instrument & Equipment Management

| Item | Status | Evidence / Notes |
|------|:------:|------------------|
| Calibration records + due dates | ✅ | `Equipment`, `CalibrationRecord`, `calibrationDueAt` |
| Certifications | ✅ | `Certification` model + page |
| **Preventive Maintenance schedule** | ❌ | "preventive" in codebase = CAPA only, not equipment PM |
| **IQ / OQ / PQ qualification docs** | ❌ | No qualification model |
| Out-of-calibration auto-lock | ⚠️ | Due date tracked; **hard block on overdue instrument not enforced** |
| Equipment logbook | ⚠️ | Usage implied via `SampleTest.instrumentId`; no dedicated digital logbook |

### Phase 9 — Stability Studies

| Item | Status | Evidence / Notes |
|------|:------:|------------------|
| Auto timepoint schedule | ✅ | `StabilityStudy` + `StabilityPull` (T=0,3,6…) |
| Pull flagging (DUE) | ✅ | Pull `status` SCHEDULED→DUE→PULLED→TESTED |
| Trend across timepoints | ⚠️ | Data present; **automated degradation plot not confirmed** |
| **Expiry / shelf-life statistical model** | ❌ | No regression / shelf-life calculation |

### Phase 10 — Regulatory Compliance & Audit Trail

| Item | Status | Evidence / Notes |
|------|:------:|------------------|
| Audit trail (who/what/when, before-after, immutable) | ✅ | `AuditTrailEntry` |
| E-sig / access control / RBAC | ✅ | `ESignature`; full RBAC (`Role`/`Permission`/`UserPermission`, `rbac-catalog`) |
| ISO 17025 / audit programs / findings / NC | ✅ | `IsoStandard`/`Clause`, `AuditProgram`, `AuditFinding`, `NonConformance`, `Capa` |
| Compendial method libraries (USP/BP/IP) | ⚠️ | `TestMethod` is free-form; **no bundled pharmacopoeia library** |

### Phase 11 — Sample Disposal & Archiving

| Item | Status | Evidence / Notes |
|------|:------:|------------------|
| **Retention period tracking** | ❌ | Not modeled |
| **Disposal alerts + physical disposal log** | ❌ | No disposal workflow / log |
| **Digital archiving (read-only)** | ❌ | Soft-delete only (`isDeleted`); no archive / export-to-archive |

---

## Scorecard

| Phase | Built ✅ | Partial ⚠️ | Missing ❌ |
|-------|:-------:|:----------:|:----------:|
| 1 — Registration & Login | 3 | 1 | 1 |
| 2 — Test Assignment | 3 | 1 | 2 |
| 3 — Storage & Custody | 2 | 1 | 1 |
| 4 — Test Execution | 2 | 0 | 1 |
| 5 — QC & OOS | 4 | 0 | 0 |
| 6 — Review & Approval | 3 | 0 | 0 |
| 7 — CoA & Reporting | 4 | 1 | 0 |
| 8 — Instrument & Equipment | 2 | 2 | 2 |
| 9 — Stability | 2 | 1 | 1 |
| 10 — Regulatory & Audit | 3 | 1 | 0 |
| 11 — Disposal & Archiving | 0 | 0 | 3 |
| **Total** | **28** | **8** | **11** |

**~60% fully built, ~17% partial, ~23% missing** — and Phases 5, 6, and 10 (the
compliance-critical core) are effectively complete.

---

## The five real gaps (prioritized)

### 1. Instrument integration — *the single biggest gap* 🔴
All results are hand-typed today; `instrumentId` is only a label. No bidirectional
interface, no file/CSV import of raw runs, no middleware/LES.
- **MVP:** CSV / file upload of an instrument run → parsed into `Result` rows.
- **Full:** bidirectional interface (LIMS sends order → instrument runs → result returns).

### 2. Phase 11 — Retention & Disposal (whole phase missing) 🔴
No retention clock, disposal log, or archiving.
- Add `retentionUntil` / `disposalStatus` to `Sample`, a disposal workflow with a
  physical-disposal log (who/method/witness), due-for-disposal alerts, and a read-only
  digital archive/export.

### 3. Equipment lifecycle beyond calibration 🟠
- Preventive Maintenance schedules.
- IQ/OQ/PQ qualification records.
- Out-of-calibration **auto-lock** (block selecting an overdue instrument on a test).
- Digital equipment logbook.

### 4. Sample login condition check + priority tiers 🟠
- Temperature / integrity / packaging acceptance fields at receipt.
- Add STAT / regulatory-submission priority tier.

### 5. Stability analytics 🟡
- Statistical shelf-life / expiry estimation (regression on timepoint data).
- Automated timepoint trend plots.

### Smaller polish
- Reagent/standard calibration gate before scheduling (Phase 2).
- Instrument slot booking (Phase 2).
- Compendial method library (USP/BP/IP) (Phase 10).
- Scheduled CoA email distribution (Phase 7).
- Aliquot management UI (Phase 3).

---

*See `LIMS-completion-implementation-plan.md` for the build plan, schema deltas, and
process flowcharts.*
