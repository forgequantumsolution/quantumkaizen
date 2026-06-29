# LIMS 2.0 — Industrial-Grade, Configuration-Driven Upgrade Plan

> Status: PLAN (v1, 2026-06-25) · Owner: shriyansh · Branch: `shriyansh-phase-implemenation`
> Goal: evolve the current "simple flow" LIMS into a **dynamic, config-driven, GxP**
> LIMS comparable in capability to LabWare / STARLIMS / Thermo SampleManager /
> LabVantage — without hard-coding lab processes.

This document analyses what exists today, benchmarks it against industry LIMS,
identifies the gaps, defines a **configuration-first target architecture** that
reuses this platform's existing strengths (workflow engine, dynamic forms,
approvals, e-signature, audit trail, RBAC), and lays out a phased roadmap.

---

## A. Current state (what we built) and why it feels "simple"

**Built (LIMS W1 + W3):**
- Master data: `Lab`, `Equipment` (+`CalibrationRecord`), `Certification`, `TestMethod`,
  `Specification` (+`SpecParameter`), `StorageLocation`.
- Samples: `Sample` (barcode, status enum) + `CustodyEvent` + `Aliquot`.
- Sample lifecycle is a **fixed status enum** REGISTERED → IN_TESTING → IN_REVIEW →
  RELEASED/REJECTED, with allowed-transition rules in code.

**Why it reads as a simple flow (the limitations to fix):**
1. **Hard-coded process** — the sample lifecycle is an enum + `if`-rules, not a
   configurable workflow. Real labs need different routes per sample type / product /
   market, with approvals and e-sign at each step.
2. **No tests or results** — a sample can't actually be *tested*. There's no
   Test/Analysis, no analyte/component result capture, no evaluation against spec.
   This is the heart of a LIMS and it's entirely missing.
3. **Static specifications** — specs hold parameters but aren't multi-stage
   (release vs stability vs in-process), grade/market-specific, or versioned-in-use;
   limits aren't yet wired to result evaluation, rounding, or significant figures.
4. **Thin master data** — no Products/Materials, Analytes/Components, Sampling Points,
   Units of Measure, Customers/Suppliers, Reagents/Reference-Standards.
5. **Not configurable** — no login templates, test plans/panels, label formats,
   calculation/formula engine, or configurable result grids. Everything is a fixed form.
6. **No OOS/OOT, QC charts, stability execution, CoA, instrument capture, scheduling,
   reagents/standards, second-person data review** — the operational depth of a LIMS.

**Existing platform assets to exploit (this is the unfair advantage):**
- A full **workflow/BPM engine** (stages, transitions, approvals, SLA, calendars,
  e-sign, audit trail) — already used by Audit/CAPA/DMS.
- A **dynamic form builder** (`Form`/`FormField`/`FieldType`/`FormSubmission`,
  stage-form bindings) — perfect for configurable test data sheets / login forms.
- **21 CFR Part 11** `ESignature` + append-only `AuditTrailEntry`, **RBAC**,
  **numbering/sequence**, and the W1/W3 LIMS data already in place.

> **Thesis:** "Industrial + dynamic" = stop hard-coding lab processes and instead
> **drive them from configuration** (master data + test definitions + spec versions)
> and from the **workflow engine + dynamic forms** we already have.

---

## B. What "industry-grade LIMS" means — capability benchmark

Pharma QC LIMS (LabWare/STARLIMS/SampleManager/LabVantage) are organised around
these capability domains. This is the target scope:

1. **Configurable master data** — Products/Materials, Grades, Markets, Analytes/
   Components, Units, Sampling Points, Customers/Suppliers, Reagents, Reference
   Standards, Instruments, Methods (versioned), Locations (with capacity).
2. **Sample management** — login by **template/plan**, multi-level
   (Lot → Sample → Aliquot → Test → Result), scheduling, **label/2D-barcode printing**,
   receipt, storage with capacity, chain of custody, retention & disposal.
3. **Test/Analysis management** — **test definitions** with analyte/component lists,
   **test plans/panels**, **calculations/formulas**, replicates, **worklists/batches**,
   instrument runs, **system suitability**, rounding & significant figures.
4. **Specifications** — versioned, **multi-stage** (Release / Stability / In-Process /
   Raw-Material), product+grade+market-specific, conditional & pharmacopoeial limits.
5. **Result entry & evaluation** — configurable **result grids** bound to the spec
   version; automatic **pass/OOS/OOT** evaluation; reason-for-change; second-person
   **data review**; e-sign.
6. **OOS / OOT** — formal **investigation workflows** (Phase 1A/1B/2), retest/resample
   rules, deviation/CAPA linkage, OOT trending.
7. **QC statistics** — Levey-Jennings, **Westgard** rules, trend/CpK, control samples.
8. **Stability** — protocols, **storage stations**, **pull schedules/reminders**,
   condition tracking, trend & shelf-life.
9. **Certificate of Analysis** — **templated**, multi-format, customer-specific,
   electronic with **QR verification**, regenerate on revision.
10. **Instrument integration & logbooks** — CDS/instrument result capture, balance/
    pH feeds, instrument **use logbooks**, qualification + calibration status gating.
11. **Reagents / standards / consumables inventory** — lots, expiry, preparation,
    standardisation, traceability into results.
12. **Scheduling & workload** — analyst assignment, capacity, **TAT/SLA**, backlog.
13. **Dashboards & analytics** — role dashboards (backlog, OOS rate, TAT, instrument
    utilisation), management/quality KPIs, **PQR/APR** feeds.
14. **Data integrity & compliance** — ALCOA+, full audit-trail **review**, e-sign on
    every GxP action, no silent overwrite, configurable approvals.

---

## C. Gap analysis — current vs. target

| Domain | Today | Target | Gap |
|---|---|---|---|
| Master data | Lab, Equipment, Cert, Method, Spec, Storage | + Products, Analytes, Units, Sampling Points, Customers/Suppliers, Reagents, Reference Standards | **Large** |
| Sample login | Single fixed form | Templates / plans, multi-level, label print, scheduling | **Large** |
| Tests & results | **None** | Test defs, analytes, worklists, result grids, calculations | **Critical / missing** |
| Specs | Params only | Multi-stage, grade/market, versioned-in-use, rounding | **Medium** |
| OOS/OOT | None | Investigation workflows | **Large** |
| QC stats | None | L-J / Westgard / trend | **Large** |
| Stability | None | Protocols, stations, pulls | **Large** |
| CoA | None | Templated + QR | **Medium** |
| Instruments | Calibration only | Result capture + logbooks + gating | **Large** |
| Reagents/Standards | None | Inventory + traceability | **Medium** |
| Configurability | Hard-coded | Config-driven (workflow + forms + master data) | **Foundational** |
| Lifecycle | Status enum | Workflow-engine-driven | **Foundational** |

---

## D. Target architecture & guiding principles (the "dynamic" layer)

The upgrade is **config-first**. Concretely:

1. **Sample & test lifecycles run on the existing workflow engine.**
   Replace the `SampleStatus` enum machine with a **workflow ticket** raised on a
   "Sample Testing" workflow type (like CAPA/Audit already do). This gives
   configurable stages, role-gated transitions, approvals, SLA/TAT, e-sign and audit
   trail **for free** — and different products/markets can use different workflow
   versions. Keep a denormalised `status` mirror on `Sample` for fast lists.

2. **Test data capture uses configurable definitions, not fixed forms.**
   A **`TestDefinition`** lists **`Analyte`/Component** rows (name, unit, data type,
   decimals, calculation, limit source). Result entry renders a **dynamic grid** from
   the test definition + the bound **spec version** — no code per test. Free-text or
   complex sheets can additionally bind a **dynamic Form** (we already have the builder).

3. **Specifications become the limit authority.**
   `SpecVersion` (multi-stage, grade/market) holds `SpecLine`s per analyte with
   min/max/target/text + **rounding & significant figures**. Result evaluation reads
   the *effective* spec version → auto **PASS / OOS / OOT**.

4. **A small LIMS configuration layer** drives login templates, test plans/panels,
   label formats, numbering masks and sample-type field sets — so admins configure the
   lab, engineers don't hard-code it. Reuse `FieldType`/dynamic-form primitives where
   possible.

5. **Everything GxP**: e-sign (reuse `recordSignature`) on result approval, review,
   release, CoA issue, OOS closure; append-only audit trail on every record; **second-
   person review** as a workflow stage; soft-delete only; reason-for-change on edits.

6. **Master-data driven & numbered**: products, analytes, units, sampling points,
   reagents, standards are master data; all records use the shared numbering service.

7. **Backwards compatible**: the W1/W3 entities stay; we *extend* them (e.g. add
   `TestRequest`/`SampleTest`/`Result` around `Sample`; add `SpecVersion` alongside
   `Specification`). No big-bang rewrite.

---

## E. Phased roadmap — "LIMS 2.0"

Each phase is shippable and reuses platform assets. Effort = rough (1 dev).

### L0 — Configuration & master-data depth (foundation) — 2 wks
- **Models**: `Product`/`Material` (code, name, grade, dosage form, markets),
  `Analyte`/`Component` (code, name, default unit, data type), `UnitOfMeasure`,
  `SamplingPoint`, `Customer`, `Supplier`. Seed/lookup CRUD + RBAC + nav.
- **Numbering masks** config (e.g. `SMP-{site}-{yyyy}-{seq}`) — extend numbering svc.
- Acceptance: products/analytes/units/sampling-points managed; samples reference a
  Product instead of free-text.

### L1 — Test & Analysis definitions + Spec versions — 2–2.5 wks
- **Models**: `TestDefinition` (+ `TestAnalyte` rows: analyte, unit, dataType,
  decimals, calculation expr, limit source), `TestPanel`/plan (group of tests),
  `SpecVersion` (stage Release/Stability/InProcess/RawMaterial, grade, market,
  status DRAFT/APPROVED/effective) + `SpecLine` (per analyte: min/max/target/text,
  rounding, sig-figs, mandatory).
- Migrate current `Specification`/`SpecParameter` into the versioned model.
- Acceptance: define a test with analytes + calculation; an approved multi-stage spec.

### L2 — Dynamic sample login + test assignment + labels — 2 wks
- **Login templates / sample plans**: pick Product → auto-attaches its test panel +
  effective spec; configurable field sets per sample type.
- **Models**: `SampleTest` (sample × test definition, status, analyst, instrument),
  optional `TestRequest` with pricing. **Label printing** (2D/QR, configurable format).
- Acceptance: log a sample from a template → tests auto-assigned from the product's
  panel + spec; print a labelled barcode.

### L3 — Worklists/batches + result entry grid + evaluation — 3 wks (**core**)
- **Worklist/Batch**: group `SampleTest`s for an analyst/instrument run; **system
  suitability** capture.
- **`Result`** per analyte: value, unit, instrument, analyst, **calculation engine**
  (formula eval with sig-figs/rounding), auto **PASS/OOS/OOT** vs effective spec line.
- **Result grid** rendered dynamically from `TestDefinition` + `SpecVersion`.
- **Second-person data review** + **e-sign** approval (workflow stage).
- Acceptance: enter results in a grid, breach a limit → OOS flagged, reviewer e-signs.

### L4 — OOS / OOT investigation workflows — 2 wks
- Reuse the **workflow engine**: OOS auto-raises an investigation ticket (Phase 1A lab
  investigation → 1B → Phase 2), retest/resample handling, **CAPA/deviation linkage**
  (we already have CAPA), OOT trend rules.
- Acceptance: an OOS result drives a controlled investigation to closure with e-sign.

### L5 — Sample lifecycle on the workflow engine — 1.5 wks
- Replace the enum machine: raise a **Sample Testing** workflow ticket on login; stages
  Login → Testing → Review → Approve/Release → Reject; status mirror on `Sample`.
  Per-product/market workflow selection. (Mirrors how audits already attach a workflow.)
- Acceptance: a sample follows a configurable, e-signed, SLA-tracked workflow.

### L6 — QC statistics (Levey-Jennings + Westgard) — 2 wks
- `QcResult` series per analyte/method; L-J chart, Westgard rules, trend, control limits.
- Acceptance: control results plot; Westgard violation raises an alert/investigation.

### L7 — Stability execution — 2 wks
- `StabilityStudy` + `StabilityProtocol` (ICH conditions/timepoints) + `StabilityStation`
  + **pull schedule/reminders** (reuse the cron sweep) + trend/shelf-life; pulls create
  samples/tests automatically.
- Acceptance: a study schedules pulls; a timepoint generates testable samples; trends plot.

### L8 — Certificate of Analysis (templated + QR) — 1.5 wks
- `CoaTemplate` (configurable header/sections/customer variants) + `Coa` generated from
  approved results; **QR public verification**; regenerate on revision; archive.
- Acceptance: approved sample → templated CoA with QR that verifies live.

### L9 — Reagents, reference standards & inventory — 2 wks
- `Reagent`/`ReferenceStandard` (lot, expiry, potency, preparation, standardisation),
  consumption traceability into results; expiry sweep.
- Acceptance: results reference the standard/reagent lot used; expired lots blocked.

### L10 — Instruments: logbooks + result capture + gating — 2–3 wks
- Instrument **use logbooks**, **qualification/calibration gating** ("not for use" when
  overdue — partly built), file/CSV result import into worklists (CDS interfacing is a
  larger integration track).
- Acceptance: an out-of-calibration instrument can't be selected for a run; a result
  file imports into a worklist.

### L11 — Scheduling, workload & TAT — 1.5 wks
- Analyst assignment, capacity/backlog board, TAT/SLA (reuse SLA engine), due/overdue.
- Acceptance: a workload board shows backlog and TAT breaches.

### L12 — Dashboards, data-review & analytics — 2 wks
- Role dashboards (backlog, OOS rate, TAT, instrument utilisation), **audit-trail review**
  screens, PQR/APR feeds (ties into the QMS analytics plan).
- Acceptance: a QC manager dashboard with live KPIs; an audit-trail review workflow.

---

## F. Sequencing & priorities

```
M-LIMS-A (Foundation)   L0 → L1                 [config + test defs + spec versions]
M-LIMS-B (Core testing) L2 → L3 → L4 → L5       [login→test→result→OOS, on workflow]   ← biggest value
M-LIMS-C (Science)      L6 (QC) + L7 (Stability)
M-LIMS-D (Output)       L8 (CoA) + L11 (TAT) + L12 (dashboards)
M-LIMS-E (Depth)        L9 (reagents) + L10 (instruments)
```

Rationale: L0–L1 unlock configurability; **M-LIMS-B is the heart** — it makes the LIMS
actually *test samples and evaluate against spec*, which is what's missing today. QC/
stability/CoA build on results. Reagents/instrument integration add depth last.

---

## G. Immediate next steps (to start)

1. **L0 schema**: add `Product`, `Analyte`, `UnitOfMeasure`, `SamplingPoint`,
   `Customer`, `Supplier`; wire `Sample.productId`. CRUD + RBAC + nav + seed.
2. **L1 schema**: `TestDefinition`/`TestAnalyte`, `TestPanel`, `SpecVersion`/`SpecLine`;
   migrate existing specs. This is the configurability backbone.
3. Then **L3 result entry** (the demoable "wow"): a dynamic result grid that evaluates
   against the spec and flags OOS — the single biggest jump from "simple" to "real LIMS".

## H. Conventions (per phase, same as the platform)
- [ ] Additive migration; **verify tables exist after** (Neon cold-starts have silently
      dropped migrations — always check).
- [ ] Numbering via the shared sequence service / configurable masks.
- [ ] Audit trail + e-sign on every GxP action; soft-delete only; reason-for-change.
- [ ] Stateful processes on the **workflow engine**; data capture via **dynamic forms**
      / configurable grids — not hard-coded.
- [ ] RBAC keys in `rbac-catalog.ts` + nav entry in `navAccess.ts`; idempotent seed.
