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

---

## I. Disconnected / abandoned features — wiring backlog (audit 2026-07-04)

A code audit (backend endpoints ↔ frontend hooks ↔ pages ↔ Prisma writes) found the
engine is sound and nearly everything is wired, but a cluster of features are **built
but not connected** — full CRUD pages whose data no operational flow ever reads, one
data model persisted but never rendered, and a handful of dead endpoints. None of this
is placeholder/mock code; it's *orphaned* wiring. This backlog logs each finding and
the concrete steps to connect it. All changes below are **working-tree only** until
reviewed (per project rule).

> **✅ IMPLEMENTED (2026-07-04, working tree — not committed).** All of W-1…W-5
> below were built and verified end-to-end in the running app (Playwright + API):
> - **W-5** seed now creates 8 units, 5 analytes, 4 sampling points, 3 customers, 3
>   suppliers and links them onto the demo samples.
> - **W-1d** `client/src/features/lims/UnitSelect.tsx` (catalog-backed, free-text-safe)
>   replaces the 6 free-text unit inputs.
> - **W-2 + W-1b(CoA)** template Header/Footer-HTML + Customer editor fields, generate-modal
>   Template + Customer pickers, `getCoa` template include, and a template-driven
>   `CoaDetailPage` (DOMPurify-sanitized HTML, section ordering). DOMPurify added to the client.
> - **W-1a/b/c** additive migration added `Sample.customerId/supplierId/samplingPointId`
>   (+ FKs, `ON DELETE SET NULL`) to `kaizen_qms`; register drawer now has Customer /
>   Sampling-Point pickers and a Supplier picker (shown for Raw Material); detail page shows them.
> - **W-3** `unassigned` filter on `GET /testing/tests` + new `useSampleTests` hook; the
>   worklist detail drawer can now attach unassigned tests and remove tests (wiring the
>   previously-dead `useRemoveTestFromWorklist`).
> - **W-4** delete action wired on the sample detail page (gated `sample.update`, REGISTERED
>   only, using `useDeleteSample`); dead `useSampleTest` and `useUpdateStudy` hooks removed.
>   `sample.delete` key not added — the DELETE route already enforces `sample.update`.
>
> Not done (deliberately deferred): `PUT /api/samples/:id` (sample edit) and `PUT
> /api/stability/:id` remain valid endpoints without a UI — left for a future edit screen.

### I.0 Summary

| ID | Feature | State today | Severity | Root cause |
|---|---|---|---|---|
| W-1a | **Sampling Points** | CRUD island | High | No column on `Sample`; no picker on login |
| W-1b | **Customers** | CRUD island | High | No column on `Sample`; CoA picker not wired (backend ready) |
| W-1c | **Suppliers / Vendor Mgmt** | CRUD island | Medium | No column on `Sample`; never referenced |
| W-1d | **Units of Measure** | CRUD island | Medium | Units entered as free-text everywhere; catalog unused |
| W-1e | **Certifications** | CRUD island | Low | Lab accreditation never surfaced outside its page |
| W-2 | **CoA Template → rendering** | model persisted, never rendered | High | `CoaDetailPage` hardcodes layout; ignores template |
| W-3 | **Worklist membership** | half-wired | Medium | No UI to attach/detach tests; remove endpoint dead |
| W-4 | **Dead endpoints/hooks** | orphaned | Low | 4–5 handlers/hooks with no caller |

Evidence lives in the audit; key files are cited per item below.

---

### W-1 — Reconnect the master-data islands

Five configuration pages are **write-only islands**: you can fill them in, but nothing
downstream reads them. `useUnits`, `useSamplingPoints`, `useCustomers`, `useSuppliers`,
`useCertifications` each have exactly **one consumer — their own page**. The fix pattern
is the same: give the master data a place to attach on an operational record, then a
picker on the form and a serializer field to read it back.

> **Key blocker:** `Sample` has **no** `customerId`, `supplierId`, or `samplingPointId`
> column ([`schema.prisma` `model Sample`](../backend/prisma/schema.prisma)) — only
> `sourceSite`/`unit` free-text. So W-1a/b/c need an **additive migration** first, not
> just UI. `Coa`, by contrast, **already** has `templateId` + `customerId` columns.

#### W-1a — Sampling Points → Sample login
- [ ] **Schema**: add `Sample.samplingPointId String?` + relation
      `samplingPoint SamplingPoint? @relation(fields:[samplingPointId], references:[id], onDelete:SetNull)`
      and the back-relation on `SamplingPoint`. Additive migration (`prisma db execute`,
      per §H — verify the table/column exists after; Neon drift).
- [ ] **Backend**: `sample.schema.ts` add `sampling_point_id` to register/update;
      `sample.service.ts` set it on create/update and expose `sampling_point_id`
      (+ optional `sampling_point` label) in the serializer; add `include: { samplingPoint: true }`.
- [ ] **Frontend**: `lib/api/samples.ts` add the field to `RegisterSampleBody`/`SampleSummary`;
      `SampleListPage.tsx` register drawer — add a **Sampling Point** picker (`useSamplingPoints`),
      relevant for environmental/water/in-process types.
- **Acceptance**: register a sample with a sampling point; it shows on the detail page.

#### W-1b — Customers → Sample + CoA (CoA backend is already ready)
- [ ] **Schema**: add `Sample.customerId String?` + relation (for contract/customer samples).
- [ ] **Backend**: wire `customer_id` through `sample.schema.ts`/`sample.service.ts` as above.
- [ ] **Frontend (Sample)**: `SampleListPage.tsx` — add a **Customer** picker (`useCustomers`).
- [ ] **Frontend (CoA) — the quick win**: the generate endpoint **already accepts
      `template_id` + `customer_id`** ([`coa.schema.ts:22-25`](../backend/src/modules/coa/coa.schema.ts#L22-L25))
      and stores them ([`coa.service.ts:71`](../backend/src/modules/coa/coa.service.ts#L71)).
      Just add a **Customer** dropdown (`useCustomers`) to the Generate modal in
      `CoaListPage.tsx`, defaulting from the picked sample's customer. No backend work.
- **Acceptance**: generate a CoA with a customer selected; `customer_id` persists and renders.

#### W-1c — Suppliers → Sample (raw materials)
- [ ] **Schema**: add `Sample.supplierId String?` + relation.
- [ ] **Backend/Frontend**: same pattern; show the **Supplier** picker only when
      `sampleType === 'Raw Material'` in `SampleListPage.tsx`.
- **Acceptance**: a raw-material sample records its supplier; visible on detail.

#### W-1d — Units of Measure → replace free-text unit inputs
Units are typed as free-text `<Input placeholder="%">` in **six** places, so the catalog
is cosmetic. Introduce one shared control and swap it in.
- [ ] **New component** `client/src/features/lims/_shared/UnitSelect.tsx` — an
      AntD `Select` (`showSearch`, `allowCreate`-style tags) sourced from `useUnits`,
      falling back to free-text so existing data still works.
- [ ] **Swap** the unit inputs in: `SpecDetailPage.tsx:155`, `SpecVersionsPage.tsx:272`,
      `TestDefinitionsPage.tsx:224`, `SampleListPage.tsx:126`, `QcMaterialsPage.tsx:111`,
      `SampleDetailPage.tsx:207`.
- [ ] (Optional) auto-fill unit from the chosen **Analyte**'s `default_unit` (already
      available in the test-def editor).
- **Acceptance**: unit fields offer the catalog; adding a unit in Units appears in the dropdowns.

#### W-1e — Certifications → surface lab accreditation
- [ ] **Lab view**: on a Lab detail/registry row, show that lab's certifications
      (`useCertifications({ lab_id })`) with an expiry badge (valid/expiring/expired —
      the seed already models all three).
- [ ] **CoA (optional)**: include the issuing lab's accreditation line in the CoA
      footer/signature block (ties into W-2).
- [ ] **Dashboard (optional)**: an "expiring certifications" tile on `LimsDashboardPage`.
- **Acceptance**: opening a lab shows its live certifications; expired ones are flagged.

---

### W-2 — Connect CoA Templates to CoA rendering (backend ready)

`CoaTemplate` (title, `sections`, `headerHtml`, `footerHtml`, `customerId`) is fully
persisted and round-tripped, and `Coa` **already stores `templateId`**
([`coa.service.ts:71`](../backend/src/modules/coa/coa.service.ts#L71)) — but
`CoaDetailPage.tsx:55-118` **hardcodes** the whole certificate and never reads the
template, so the "Sections to render" multiselect and `headerHtml`/`footerHtml` are inert.

- [ ] **Generate modal** (`CoaListPage.tsx`): add a **Template** picker (`useCoaTemplates`)
      and send `template_id` (endpoint already accepts it — no backend change).
- [ ] **Serializer** (`coa.service.ts` `getCoa`): add `include: { template: true }` and
      expose the template's `title`/`sections`/`header_html`/`footer_html` on the Coa read
      (currently only the bare `template_id` is returned).
- [ ] **Render** (`CoaDetailPage.tsx`): drive the layout from the template —
      render `headerHtml` (sanitised) at top, iterate `sections` **in the template's order**
      to emit the Description/Results/Conclusion/Signatures blocks, and `footerHtml` at
      bottom. Fall back to the current hardcoded default when `templateId` is null.
- [ ] **Template editor** (`CoaListPage.tsx:159-178`): add **Header HTML** / **Footer HTML**
      textareas and a **Customer** picker (the API + `customer_id` field already exist).
- **Acceptance**: a CoA issued against a template renders that template's header/footer and
      only the selected sections, in order; changing the template changes the output.

---

### W-3 — Complete worklist test membership

Backend supports membership — `WorklistUpsertSchema` accepts **`sample_test_ids`**
([`sample-testing.schema.ts:58`](../backend/src/modules/sample-testing/sample-testing.schema.ts#L58))
and `SampleTest.worklist_id` exists — but there's no UI to browse unassigned tests and
attach them, and the **remove-from-worklist** endpoint is dead (see W-4).

- [ ] **New frontend list hook** — there is **no `useSampleTests` list hook** today
      (only `useSampleTestsForSample` by sample and the dead `useSampleTest` by id), even
      though `GET /api/testing/tests` (`listTests`, perm `result.read`) exists. Add a
      `useSampleTests(query)` hook wrapping it.
- [ ] **Backend filter for unassigned tests** — `ListSampleTestQuerySchema` has
      `worklist_id` but **no "is-null / unassigned" option**, so you can't currently query
      "tests on no worklist". Add an `unassigned`/`worklist_id=null` semantic to the list
      handler (or filter client-side as a stopgap).
- [ ] **Attach UI**: in the worklist detail drawer (`WorklistsPage.tsx`), add an
      "Add tests" picker listing unassigned `IN_PROGRESS`/`PENDING` `SampleTest`s (via the
      new hook), submitting `sample_test_ids` through `useUpdateWorklist`.
- [ ] **Detach UI**: wire the existing `useRemoveTestFromWorklist`
      (`DELETE /api/testing/tests/:id/worklist`) to a per-row "remove" action in the drawer.
- [ ] (Optional) let **Assign Tests** drop new tests straight onto an open worklist.
- **Acceptance**: add/remove tests on a worklist from the UI; batched result entry then covers them.

---

### W-4 — Dead endpoints & hooks — wire or delete

Four handlers/hooks have no caller. Decide per item; default is the cheaper option noted.

| Endpoint / hook | Recommendation |
|---|---|
| `PUT /api/samples/:id` (no client at all) | **Wire**: add an "Edit sample" action on `SampleDetailPage` for `REGISTERED` samples (metadata edits), gated `sample.update`. Otherwise remove the handler. |
| `DELETE /api/samples/:id` ↔ `useDeleteSample` ([samples.ts:61](../client/src/lib/api/samples.ts#L61)) | **Wire**: a soft-delete action (already only allowed while `REGISTERED`) on the list/detail, or **delete** the hook. |
| `DELETE /api/testing/tests/:id/worklist` ↔ `useRemoveTestFromWorklist` | **Wire** as part of W-3. |
| `GET /api/testing/tests/:id` ↔ `useSampleTest` ([testing.ts:137](../client/src/lib/api/testing.ts#L137)) | **Remove** (inline detail from the list already covers it) unless a standalone test-detail view is wanted. |
| `useUpdateStudy` ([stability.ts:103](../client/src/lib/api/stability.ts#L103)) | **Wire** an edit action on DRAFT stability studies, or delete the hook. |

- **Acceptance**: every remaining endpoint has a caller; removed ones have no dangling hook.

---

### W-5 — Cross-cutting requirements (found on plan review — apply across W-1…W-4)

The per-item steps above assumed a few things that the codebase does **not** currently
provide. These are prerequisites, not optional polish.

- [ ] **Seed the islands — they are empty in every seed.** `prisma.customer/supplier/
      samplingPoint/unitOfMeasure/analyte.create` appears in **no** seed file
      (checked `seed-lims-data.ts`, `seed.ts`). So today the Customers/Suppliers/
      Sampling-Points/Units pages — **and the Analyte master that the test-def editor's
      dropdown reads** — are blank in the demo DB; any new picker would show nothing.
      Add idempotent (upsert-by-code) rows for each to `seed-lims-data.ts`, and set the
      new `Sample.customerId/supplierId/samplingPointId` on the 4 demo samples so the
      wiring is visible out of the box.
- [ ] **RBAC: add the missing `sample.delete` key.** `rbac-catalog.ts` has `sample.create`
      and `sample.update` but **no `sample.delete`** — W-4's delete action needs a new
      catalog key (+ grant to SUPER_ADMIN/relevant roles) or must reuse `sample.update`.
      All other keys the new work needs already exist: `customer.read`, `supplier.read`,
      `sampling_point.read`, `unit.read`, `worklist.update`, `coa.manage`.
- [ ] **Permission-gate the new pickers.** A master-data dropdown on the sample-login /
      CoA form reads that master, so render it only when the user holds the master's
      `.read` key (e.g. hide the Customer picker without `customer.read`) — same pattern
      the config nav already uses. Note this adds a soft cross-dependency: a sample
      registrar now also wants `customer.read`/`supplier.read`/`sampling_point.read`.
- [ ] **CoA HTML safety (W-2): there is no sanitizer dependency in the repo.** Rendering
      `headerHtml`/`footerHtml` via `dangerouslySetInnerHTML` is an XSS hole. Either add
      **DOMPurify** (client) / sanitize server-side on template save, or restrict the
      header/footer fields to plain text / a whitelisted tag subset. Decide before W-2
      renders template HTML.
- [ ] **Migrations (W-1a/b/c): additive only, verify after.** Per §H, apply the new
      `Sample` columns via additive SQL and **confirm the columns exist afterward** (Neon
      cold-starts have silently dropped migrations); a tracked migration is still needed
      before a prod `migrate deploy`, and the existing `Lms*` schema drift is a separate
      reconciliation.
- [ ] **`navAccess.ts`**: no new tabs are required (all island pages already have nav
      entries); only add entries if W-4 introduces a standalone test-detail view.

---

### I.1 Also worth a product decision (not dead, but redundant)

- **Two spec subsystems coexist**: the legacy `Specification` library (`/lims/specifications`,
  `/api/lims/specifications*`) and the runtime authority `SpecVersion` (`/lims/spec-versions`).
  Both are live and consumed (legacy `useSpecs` still feeds the sample-list filter), but the
  overlap confuses setup. Decide whether to **retire the legacy Specification** into SpecVersion
  (per L1 §E "migrate current `Specification`/`SpecParameter` into the versioned model") and
  keep one spec authority.
- **Manual OOS creation** (`OosListPage` "New Investigation") only takes a title + free-text
  Sample ID — no real sample/result binding. The meaningful path is the auto-raise; either
  upgrade the modal to a proper sample→test→result picker or drop manual creation.

### I.2 Effort & suggested order

Rough estimates, 1 dev, including seed + RBAC + verification per item (front = frontend
only; the ✅ backend-ready items are why they're cheap).

| Order | Item | Scope | Backend ready? | Effort |
|---|---|---|---|---|
| 1 | **W-2** CoA template → render | `getCoa` include + `CoaDetailPage` render + template editor fields (+ sanitizer) | ✅ (generate accepts `template_id`) | **1–1.5 d** |
| 2 | **W-1b-CoA** Customer on Generate modal | 1 dropdown, sends `customer_id` | ✅ | **0.5 d** |
| 3 | **W-1d** Units select | shared `UnitSelect` + swap 6 sites + seed units | ✅ | **1 d** |
| 4 | **W-1e** Certifications surfacing | lab-detail cert list (`lab_id` filter exists) + optional dashboard tile | ✅ | **0.5–1 d** |
| 5 | **W-1a/b/c** Sample masters | **1 shared migration** (3 cols+FKs) → schema/service/serializer → 3 pickers → seed | new columns | **2–3 d** |
| 6 | **W-3** Worklist membership | new `useSampleTests` hook + unassigned filter + attach/detach UI | partial (`sample_test_ids` ok) | **1.5 d** |
| 7 | **W-4** Dead endpoints | wire or delete (+ `sample.delete` key if kept) | mixed | **0.5–1 d** |
| — | **W-5** cross-cutting | folded into the items above (seed, RBAC, gating, sanitizer, migration) | — | — |

**Total ≈ 7.5–9.5 dev-days.** Do 1–4 first (all backend-ready, no migration, immediate
visible payoff); batch 5 behind its single migration; 6–7 are cleanup. Nothing here blocks
the L-phase roadmap — it closes the gap between "configurable" and "actually connected".

> **Verification note (final pass, 2026-07-04):** every claim in §I was checked against
> code — endpoint↔hook↔page cross-refs, `rbac-catalog.ts` keys (`sample.delete` absent;
> `sample.update` + all `*.read` present), seed files (islands + Analyte master unseeded),
> `Sample`/`Coa`/`CoaTemplate` columns, the `GenerateCoaSchema`/`WorklistUpsertSchema`/
> `ListSampleTestQuerySchema` shapes, `useCoaTemplates` (exists) vs `useSampleTests`
> (missing), and the absence of any HTML sanitizer dependency. Line-level references are
> inline above.
>
> **Live-app confirmation (Playwright against the running :5173 dev app, 2026-07-04):**
> a scripted UI probe (logged in as QMS ADMIN) confirmed the gaps in the actual UI, not
> just the code:
> - **Sample Register drawer** shows Product, Batch, Type, Specification, Lab, Priority,
>   Quantity, **Unit (a free-text input, placeholder "g, mL…" — not a dropdown)**,
>   Collected, Received, Source Site, Initial Storage, Remarks — and **no Customer, no
>   Supplier, no Sampling-Point** field (confirms W-1a/b/c + W-1d).
> - **CoA Template editor** exposes only Name, Title, "Sections to render", Active —
>   **no Header-HTML, no Footer-HTML, no Customer** input (confirms W-2).
> - **Every island list rendered empty** (Units/Customers/Suppliers/Sampling-Points/
>   Certifications/Analytes all `No data`). Note the running DB also had **no LIMS demo
>   data at all** (Samples/CoA/Worklists lists empty, `SMP-2026-0001` absent), i.e.
>   `seed-lims-data.ts` was not loaded — so run the seed before demoing, and note the
>   seed itself still creates zero island rows (W-5).
