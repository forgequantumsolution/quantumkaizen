# LIMS Flow — Verification Report & Fix Plan

> ✅ **FIXES APPLIED & RE-VERIFIED 2026-06-26.** All Critical (C1–C5), High (H1–H2)
> and Medium (M1) items below are implemented. A latent backend bug surfaced once
> the flow became reachable — the `assignTests`/`enterResults` interactive
> transactions exceeded Prisma's default 5 s window against the remote DB — and was
> fixed (timeout raised to 30 s). End-to-end now passes via API and Playwright UI:
> register-with-product → assign (product panel / panel pick / test pick, spec
> bound) → enter results → **OOS auto-raised** → second-person review → e-signed
> release → CoA generate → issue → public QR verify. See §6 for the applied changes.
>
> Note: the dev backend was restarted to load the new code. Restart your own
> `npm run dev` when you resume.

> Status: VERIFIED 2026-06-26 · Branch: `shriyansh-phase-implemenation`
> Method: Playwright UI sweep + direct API end-to-end against the running dev
> stack (frontend `:5173` → backend `:4000`, seeded Neon DB).
> Login used: `info@forgequantumsolution.com` / `Admin@123`.
>
> Scope: the LIMS flow described in `docs/LIMS-data-model.md`,
> `docs/LIMS-DMS-implementation-plan.md`, and `docs/LIMS-industrial-upgrade-plan.md`
> — i.e. **M-LIMS-B core testing**: sample → assign tests → enter results →
> OOS → review → release → Certificate of Analysis.

---

## 1. TL;DR

The **backend engine is sound**, but the **core testing flow is unreachable for a
real user** because the operational records are never wired to the L0/L1
configuration master data. Concretely: a `Sample` can't be linked to a `Product`,
a `Product` can't be linked to a default `TestPanel`, and the "Assign Tests" UI
only offers the (therefore always-failing) "auto-assign from product panel"
option. As a result, **no sample can be tested**, **OOS never triggers**, and the
demo database contains **zero** products / analytes / test-definitions / panels /
spec-versions and **zero** assigned tests.

- **Verified working (engine):** assign-by-id → result entry + auto PASS/OOS
  evaluation → test roll-up → CoA generate → CoA issue (e-sign + QR token) →
  public QR verification. All green when data is supplied directly via API.
- **Verified broken (user flow):** "Assign Tests" returns HTTP 400
  *"No tests to assign (provide test_definition_ids, panel_id, or a product with a
  default panel)"* — reproduced in the UI and the API.

---

## 2. What was verified

### 2.1 Playwright route sweep (23 LIMS routes)
All 23 routes render with **no crashes, no page errors, and no failing API calls
on load**. Login + navigation work. List pages with seeded data: samples (4),
labs (4), equipment (4), storage (4), certifications (4), methods (5),
specifications (3, legacy). Operational pages (worklists, OOS, QC, stability,
CoA) render but are empty.

### 2.2 Engine end-to-end (direct API, bypassing the wiring gap)
| Step | Result |
|---|---|
| Create + approve `TestDefinition` (numeric analyte) | ✅ 201 / 200 |
| Assign to a sample via `test_definition_ids` | ✅ 201 (`spec_version: null`) |
| Enter result `99.2` → auto-evaluate | ✅ test `COMPLETED`, overall `PASS` |
| Generate CoA from the sample | ✅ `COA-2026-0001`, `DRAFT` |
| Issue CoA (e-sign `credential`) | ✅ `ISSUED`, QR `verify_token` set |
| Public verify by token (`/api/public/coa/verify/:token`) | ✅ `valid: true` |

> ⚠️ This run left two artifacts in the dev DB: one `SampleTest` on **SMP-2026-0002**
> and certificate **COA-2026-0001**. Remove if a clean demo state is needed.

### 2.3 User flow (Playwright UI)
- Opened REGISTERED sample **SMP-2026-0002** → clicked **Assign Tests** →
  **"Auto-assign from product panel"** → **HTTP 400, error toast** *"No tests to
  assign…"*. The flow dead-ends at the very first testing action.

---

## 3. Findings (gaps & defects)

### 🔴 CRITICAL — the core flow cannot run

**C1. `Sample` is never linked to a `Product`.**
`Sample.productId` exists in the schema, but `RegisterSampleSchema` /
`UpdateSampleSchema` and `sample.service.ts` only capture `product_name` (free
text). So `productId` is always `null`.
→ `assignTests` → `effectiveSpecVersion(sample.productId)` and
`productDefaultPanel(sample.productId)` always return `null`.
- Files: `backend/src/modules/sample/sample.schema.ts`,
  `backend/src/modules/sample/sample.service.ts` (`registerSample`, `updateSample`).

**C2. `Product` is never linked to a default `TestPanel`.**
`Product.defaultPanelId` exists, but `ProductUpsertSchema` has no
`default_panel_id` field, so it can't be set via API/UI.
- File: `backend/src/modules/lims-master/product.schema.ts` (+ `product.service.ts`).

**C3. "Assign Tests" UI only offers the broken path.**
`AssignModal` hardcodes `mutateAsync({ from_product: true })` with no manual
test/panel/spec picker. With C1+C2 unsatisfied, this **always** 400s.
- File: `client/src/features/lims/SampleTestsPanel.tsx` (`AssignModal`).

**C4. Spec evaluation / OOS never triggers in practice.**
Because tests are assigned without a resolved `SpecVersion`, every `Result` is
created with `minValue/maxValue = null`. `evaluateValue` then returns `PASS`/`NA`
and the OOS auto-raise in `enterResults` is never reached. The entire OOS /
investigation track (`/lims/oos`) is dead-on-arrival through the normal flow.
- Files: `backend/src/modules/sample-testing/sample-testing.service.ts`
  (`assignTests`, `effectiveSpecVersion`, `enterResults`).

**C5. The LIMS seed omits all L0/L1 config and assigns no tests.**
`backend/prisma/seed-lims-data.ts` seeds **0** products, analytes,
test-definitions, panels, spec-versions, units, customers, suppliers — and
assigns **0** tests to the 4 samples. Samples reference the **legacy
`Specification`**, not the new `SpecVersion`. The demo therefore cannot show the
flagship "test a sample and evaluate against spec" flow.

### 🟠 HIGH

**H1. Two conflicting "Release" paths shown at once.**
On a sample detail page both appear simultaneously:
- header **enum transition** "Release" → `transitionSample` (no e-sign, no
  gating), and
- panel **disposition** "Release" → `disposeSample` (e-signed, gated on all tests
  review-approved + no OOS).
The enum path bypasses the GxP gating the disposition path enforces. On a
REGISTERED sample the panel "Release" is even offered before any testing.
Per `LIMS-industrial-upgrade-plan.md` L5, the enum machine should be replaced by
the workflow engine; until then the two paths must be reconciled.
- Files: `client/src/features/lims/SampleDetailPage.tsx` (header `NEXT`),
  `SampleTestsPanel.tsx` (disposition), `sample.service.ts` vs
  `sample-testing.service.ts`.

**H2. Second-person review blocks the only seeded actor.**
`reviewTest` correctly forbids the analyst from reviewing their own test, but with
a single demo user the happy path can't be completed end-to-end in the UI. Seed a
second QC/reviewer user (and assign analyst vs reviewer) so the review → release
→ CoA chain is demonstrable.

### 🟡 MEDIUM

**M1. CoA generation UX.** CoA is only generated from `/lims/coa` via a modal that
takes a **raw sample-id string** (paste a UUID). There is **no "Generate CoA"
action on the sample detail page**, and no sample picker in the modal.
- File: `client/src/features/lims/CoaListPage.tsx` (`GenerateModal`).

**M2. Legacy `Specification` vs new `SpecVersion` duality.** Samples bind
`specification_id` (legacy), while result evaluation reads `SpecVersion`. The
`LIMS-data-model` migrate step (legacy → versioned) is not wired; pick one source
of truth for limits.

**M3. Sample login templates / plans (docs L2) not implemented.** No way at login
to pick a Product and have its panel + effective spec auto-attach — which is the
intended trigger for the whole flow.

---

## 4. Fix plan (ordered)

### Phase 1 — make the flow reachable (unblocks everything)
1. **C2** — add `default_panel_id` to `ProductUpsertSchema` + `product.service.ts`;
   surface a panel selector on the Products config page.
2. **C1** — add `product_id` to `RegisterSampleSchema`/`UpdateSampleSchema` and set
   `productId` in `registerSample`/`updateSample`; add a **Product** selector to
   the sample registration form (keep `product_name` as denormalised display).
3. **C3** — extend `AssignModal` to support, in priority order:
   (a) auto from product panel, (b) pick a **TestPanel**, (c) pick individual
   **TestDefinitions**. Pass `panel_id` / `test_definition_ids` accordingly.
4. **Acceptance:** register a sample against a product whose panel has tests →
   "Assign Tests" succeeds → result rows show spec limits (non-null min/max).

### Phase 2 — prove OOS + GxP gating
5. **C4 (verify)** — with C1–C3 fixed, enter an out-of-spec value → confirm
   `Result.isOutOfSpec`, test `overall_result = OOS`, and an auto `OosInvestigation`
   appears in `/lims/oos`.
6. **H1** — remove the header enum "Release/Reject" (and "Send to Review") in favour
   of the e-signed `disposeSample` path, OR gate the enum transitions behind the
   same checks. Hide the disposition section until tests exist + are reviewed.
7. **H2** — seed a dedicated reviewer user; document analyst≠reviewer in the demo.

### Phase 3 — demo data + UX polish
8. **C5** — extend `seed-lims-data.ts` to seed: Units, Analytes, ≥2
   TestDefinitions (numeric, with analytes), a TestPanel, Products (each with
   `defaultPanelId`), an **APPROVED** `SpecVersion` per product (with `SpecLine`s
   whose names match the analytes), link the 4 samples to products, and pre-assign
   tests to ≥1 sample so each lifecycle stage is visible. Include one sample wired
   to breach a limit so OOS is demoable out of the box.
9. **M1** — add a **"Generate CoA"** button on the sample detail page (released
   samples), and replace the raw-UUID input with a sample picker in `GenerateModal`.
10. **M2/M3** — decide spec source-of-truth (`SpecVersion`) and add a login
    template/product-driven auto-attach of panel + effective spec.

---

## 5. Reproduction notes
- Servers were already running (backend `:4000`, frontend `:5173`).
- Verification scripts (Playwright + API) were run from the repo root with
  `NODE_PATH` pointed at the repo `node_modules`; they are scratch artifacts and
  were not committed.
- Endpoints exercised: `POST /api/testing/samples/:id/assign`,
  `POST /api/testing/tests/:id/results`, `POST /api/coa/generate`,
  `POST /api/coa/:id/issue`, `GET /api/public/coa/verify/:token`.

---

## 6. Applied changes (2026-06-26)

**Backend**
- `modules/lims-master/product.schema.ts`, `product.service.ts` — `default_panel_id`
  added to upsert + serializer (**C2**).
- `modules/sample/sample.schema.ts`, `sample.service.ts` — `product_id` added to
  register/update; sets `productId` and denormalises `productName` from the linked
  product; serializer exposes `product_id` (**C1**).
- `modules/sample-testing/sample-testing.service.ts` — raised the `assignTests` and
  `enterResults` interactive-transaction timeout to 30 s (`maxWait` 10 s) to fix a
  `Transaction already closed` 500 that surfaced once panels with multiple
  tests/analytes were actually assigned (**bug fix**).
- `prisma/seed-lims-data.ts` — seeds Test Definitions, Test Panels, Products (with
  `defaultPanelId`), approved Spec Versions (+ lines), links samples to products +
  spec versions (backfilling pre-existing rows), and pre-assigns the Paracetamol
  panel to SMP-2026-0001 with one **OOS** result + investigation (**C5**).
- `prisma/seed.ts` — added `reviewer@forgequantum.com` (QC Reviewer) so the
  second-person review (analyst ≠ reviewer) is demonstrable (**H2**).

**Frontend**
- `features/lims/ProductsPage.tsx` + `lib/api/product.ts` — Default Test Panel
  selector on the product drawer (**C2**).
- `features/lims/SampleListPage.tsx` + `lib/api/samples.ts` — Product master picker
  on registration (auto-fills the name) (**C1**).
- `features/lims/SampleTestsPanel.tsx` — Assign modal now supports three modes
  (product panel / pick a panel / pick tests); disposition section gated to appear
  only when tests exist, with Release enabled only when in review + all approved +
  no OOS (**C3**, **H1**).
- `features/lims/SampleDetailPage.tsx` — header enum no longer offers Release/Reject
  (moved to the e-signed disposition); adds a **Generate CoA** button on released
  samples (**H1**, **M1**).
- `features/lims/CoaListPage.tsx` — Generate CoA modal uses a sample picker instead
  of a raw UUID field (**M1**).

**Verified post-fix:** product/panel/spec wiring resolves, assign succeeds in all
three modes with the spec bound, OOS auto-raises on a limit breach, CoA issues and
verifies by QR, and the reviewer account logs in. Demo DB left at 4 samples / 4
products / 3 panels / 3 approved spec versions, with SMP-2026-0001 mid-testing
showing a live OOS.
