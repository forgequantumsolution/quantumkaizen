# CAPA Management — Gap Analysis & Improvement Plan

**Module:** CAPA (Corrective & Preventive Action), Quality System
**Date:** 2026-07-07
**Verification method:** Findings from the *CAPA Management* UX/GMP audit were re-verified against the **live running application** (client `:5173`, backend `:4000`, seeded DB) using Playwright — logging in, opening the CAPA module list, dashboard, a freshly-created CAPA record, the Initiation form, and forcing the stage-transition modal open. Each finding below is tagged with what was actually observed in the UI, not inferred from source.

> **Screens in scope**
> - **Screen 1 — CAPA List** → `client/src/features/modules/ModulePage.tsx` (route `/modules/:typeId`)
> - **Screen 2 — CAPA Dashboard** → `client/src/features/modules/ModuleDashboard.tsx`
> - **Screen 3 — Record Detail** → `client/src/features/tickets/TicketDetailPage.tsx` + `detail/ActionBar.tsx`, `detail/TicketHeaderCard.tsx`
> - **Initiation stage form** (admin-configurable) → seeded in `backend/prisma/seed-capa-workflow.ts`
>
> Note: there is a **second, more mature CAPA surface** in the audit module (`client/src/features/audit/CapaDetailPage.tsx` + `capa/*`) that already ships structured 5-Why/Ishikawa, 30/60/90 effectiveness check-ins, a History tab and e-signature capture. Several fixes below are *"wire the existing audit-module capability into the workflow screens"* rather than build-from-scratch.

---

## 1. Summary

| Bucket | Count | IDs |
|---|---|---|
| **Confirmed in live UI — actionable** | 15 | F-01, F-02, F-03, F-04, F-05, F-07, F-08, F-09, F-10, F-11, F-12, F-13*, F-14, F-15, F-18 |
| **Not reproduced on current build** (config/version drift — verify against the target tenant before scheduling) | 4 | F-16, F-17, F-19, F-20 |
| **Forward-looking recommendations** | 5 | FL-01…FL-05 (FL-03 already implemented in audit module) |

\* F-13 = year toggle *exists*; the real gap is the missing **site/plant / product-line** filter.

**Most important single finding: F-14 (CRITICAL)** — stage transitions capture **no electronic signature** (the transition modal contains only a free-text "Why this action?" box). This is a 21 CFR Part 11 / EU Annex 11 gap and should lead the roadmap.

---

## 2. Confirmed Findings (verified in the live UI)

### Screen 1 — CAPA List View

| ID | Sev | Finding | Evidence (observed) |
|----|-----|---------|---------------------|
| **F-01** | Critical | No structured Product / Batch-Lot / Test-Parameter capture; OOS data folded into free text | Initiation form fields observed: *Problem statement\*, Source\*, CAPA type\*, Severity\*, Affected product / process (free text), Date detected*. No validated product/batch/test fields. |
| **F-02** | Major | Non-completed stage badges are visually identical | Computed styles: `Initiation` & `Investigation & Root Cause` both `bg rgb(239,246,255) / text rgb(29,78,216)`; only `Completed` is green. |
| **F-03** | Major | No Priority or aging/SLA column in the list | List headers observed: `ID, Created Date, Process Name, Title, Current Stage, Department, Action`. |
| **F-04** | Major | Hard-delete offered as a peer row action | First-row action buttons: `Bookmark, View, Download, Delete`. (A confirm dialog exists behind it, but it is still a hard delete and uses Antd `modal.confirm` directly, not the shared `useConfirmDelete` convention.) |
| **F-05** | Minor | Title accepts unconstrained free text | Only length + required validation; `"gdgdgd"` passes. |
| **F-07** | Minor | Breadcrumb shows a raw UUID | Observed: `Modules › 0cce7541-9c02-4e04-bc0f-0cb31332b0f0`. |

### Screen 2 — CAPA Dashboard

| ID | Sev | Finding | Evidence (observed) |
|----|-----|---------|---------------------|
| **F-08** | Major | "By priority" is ~100% Unassigned | One large `Unassigned` bar + a tiny `Low` bar. Ticket priority is **optional** on the raise form, so the chart is unusable. |
| **F-09** | Major | "By department" is mostly Unassigned | Dominant `Unassigned` bar; department optional on the form. |
| **F-10** | Minor | Status donut duplicates the stage-workload chart | Donut renders only `In Progress` vs `Completed`; the neighboring "Stage workload" already breaks In-Progress out per stage. |
| **F-11** | Minor | Stage-workload bars not in lifecycle order | Bars sorted by ticket count (`Investigation & Root Cause` above `Initiation`). |
| **F-12** | Obs | KPI cards use generic "PR" shorthand | Cards observed: `MY PR, MY DEPARTMENT PR, CREATED BY ME, ALL PR, PENDING, SAVED PR`. |
| **F-13** | Obs | No site/plant or product-line filter | Header year toggle `2024/2025/2026` **does** exist; the missing control is site/plant + product-line scoping. |

### Screen 3 — Record Detail

| ID | Sev | Finding | Evidence (observed) |
|----|-----|---------|---------------------|
| **F-14** | **Critical** | **No e-signature *on stage transitions*** | Forced the transition modal open (required form submitted, Forward enabled): the modal contains **only** a `Why this action?` textarea — no credential re-entry, no meaning-of-signature. *An e-sign capability exists but is a separate, optional action (see §5); it does not gate transitions.* |
| **F-15** | Major | No Audit Trail tab on the `/tickets/:id` surface | On `/tickets/:id`, history is only behind an icon-only "Activity" modal. *A real History tab (Change History + Electronic Signatures) already exists on `/audit/capa/:id` — see §5; this is a surface/discoverability gap, not a missing capability.* |
| **F-18** | Minor | Priority options don't map to documented severity tiers | Form has a required `Severity` field *and* an optional ticket-level `Priority` — two separate scales, no mapping between them or to the documented closure-window tiers. |

---

## 3. Findings NOT reproduced on the current build

These describe the record-detail screen but did not reproduce on a freshly-created CAPA in the current seed. Stage forms and stage actions are **admin-configurable / DB-driven**, so these likely reflect a different tenant configuration or an earlier build. **Confirm against the customer's actual configuration before scheduling work.**

| ID | Claim | What the current build shows |
|----|-------|------------------------------|
| **F-16** | Four grayed buttons, only "Resume" active, no explanation | Only a disabled `Approve / Forward` renders, and it **does** show a tooltip: *"Submit required forms first: CAPA Initiation."* |
| **F-17** | "Product / Batch Impacted" is a Yes/No toggle in an Impact section | No Impact section / no toggle; there is a free-text `Affected product / process` field (subsumed by F-01). |
| **F-19** | Fresh record's only active button is "Resume" | Fresh record shows a disabled `Approve / Forward`; "Resume" only appears when a ticket is on hold. |
| **F-20** | Icon-only header controls lack labels/tooltips | Header icons carry both `aria-label` and `title` (`Ticket details`, `View workflow`, `Activity`). |

---

## 4. Forward-Looking Recommendations

| ID | Recommendation | Status |
|----|----------------|--------|
| **FL-01** | Duplicate / recurring-issue detection at intake (match by product/test/line) | Not implemented — valid |
| **FL-02** | Auto-suggest Priority from Risk-to-Patient / Regulatory-Reportable answers | Not implemented; also requires those fields to exist first |
| **FL-03** | Structured RCA tools (5-Why + Ishikawa) | **Already implemented** in the audit-module CAPA (`capa/RootCauseTab.tsx`, `Fishbone.tsx`) — expose it on the workflow screens |
| **FL-04** | Structured effectiveness verification with verifier signature | Partial — 30/60/90 check-ins + method/conclusion exist; **verifier e-signature missing** |
| **FL-05** | Scheduled effectiveness-check reminders | Not implemented — `effectivenessDue` is stored but nothing acts on it |

---

## 5. Existing infrastructure — verify before building (do NOT rebuild)

Several audit recommendations are **partially or fully satisfied by code that already ships.** These were verified in source/endpoints, not assumed. The remediation plan below is scoped to the *delta* on top of these — do not re-implement them.

| Capability | Already exists | Evidence |
|---|---|---|
| **E-signature (21 CFR 11)** — credential re-entry + meaning + immutable record | ✅ **Full stack** | `ESignature` + `AuditTrailEntry` models (`schema.prisma:1966+`); `POST /audit/signatures` verifies credential (signature-PIN or login password) and writes an `ESignature` row + `SIGN` trail entry (`compliance.service.ts:91`, `audit.routes.ts:153-154`); Sign modal with meanings `Reviewed / Approved / Verified & Closed / Acknowledged` (`CapaDetailPage.tsx:466-587`). |
| **Audit trail / Change History UI** | ✅ **Exists on the CAPA page** | `useAuditTrail('Capa', id)` → `GET /audit/trail/:type/:id`; rendered as a **History tab** (Change History + Electronic Signatures) on `/audit/capa/:id` (`CapaDetailPage.tsx` tab `history` L72, `TrailTab` L466). **Absent** only on `/tickets/:id` (which has an *Activity* modal instead). |
| **Structured RCA (5-Why + Ishikawa)** | ✅ **Exists** | `capa/RootCauseTab.tsx` (5-Why chain + fishbone) + `capa/Fishbone.tsx`; Root Cause tab on `/audit/capa/:id` (`CapaDetailPage.tsx:69`). Workflow RCA stage form mirrors into it (`seed-capa-workflow.ts` RCA section). |
| **Effectiveness verification (30/60/90)** | ✅ **Partial** | `capa/EffectivenessTab.tsx` (30/60/90 check-ins + pass/fail + method/conclusion). Missing only a **signed** verifier determination. |
| **OOS → CAPA creation & linking** | ✅ **Exists** | `useCreateCapaFromOos`, "Raise CAPA" button (`OosDetailPage.tsx:116-118`); links a CAPA record + workflow ticket. Missing only structured product/batch/test **fields** to carry over. |
| **Delete confirmation dialog** | ✅ **Exists** | `handleDelete` → Antd `modal.confirm` (`ModulePage.tsx:271-291`). It is still a **hard delete** and bypasses the shared `useConfirmDelete` convention — that is the real gap, not "no confirm." |
| **SLA timers** | ✅ **Exists (detail only)** | `slaKeys.ticketSla(id)` (`ticket.ts`); SLA deadline/breach shown on the record header. Not surfaced as a **list column**. |
| **Site capture** | ✅ **Field exists (optional)** | `Site (optional)` on the raise form. No **filter** by site on the dashboard/list (`ModulePage` filter modal offers only Priority + Workflow). |

**Net effect on the doc's recommendations:** F-14, F-15, F-03, F-04, F-13 and FL-03/FL-04 are **not greenfield** — they are "connect / enforce / surface what exists." Only F-01 (structured fields), F-02 (colors), F-11/F-12/F-07/F-10 (dashboard cosmetics), and FL-01/FL-05 are genuinely net-new.

---

## 6. Remediation Plan — *recommendation → what exists → delta to apply*

Effort is the **delta only** (S ≤ 1d, M ≈ 2–4d, L ≈ 1–2wk), i.e. assuming the Section-5 infrastructure is reused.

### Phase 0 — Compliance-critical (do first)

**P0.1 · Bind e-signature to Part-11 transitions — F-14** — *M (not L)*
- **Doc recommends:** a signature-capture modal (credential + meaning-of-signature) on Part-11-relevant transitions, at minimum Approval/Closure.
- **Exists:** the whole e-sign stack (models, credential-verifying `POST /audit/signatures`, meaning options, Sign modal). Today signing is a **separate, optional** button on the History tab — **not** connected to any transition. Transitions (`ActionBar.tsx` modal L209-276 on `/tickets/:id`; `CapaWorkflowBand.tsx` on `/audit/capa/:id`) capture only a free-text "Why this action?".
- **Delta to apply:**
  1. Add a `requiresSignature` (+ allowed meanings) flag to the **stage-action definition** so specific actions (Approval/Closure, Effectiveness Verification) are gated.
  2. In the transition modal, when the action is gated, require credential + meaning inline (reuse the existing Sign modal fields).
  3. In the transition layer (`backend/src/modules/workflow/engine/transition.layer.ts`), **reject** a gated transition unless a valid signature accompanies it — verify the credential server-side via the existing `recordSignature` path and link the `SIGN` entry to the transition.
- **Acceptance:** a gated transition cannot complete without a valid credential + meaning; the signature appears in the existing Change History with meaning + timestamp, tied to the prior→new stage.

**P0.2 · Surface the existing Audit Trail on the record users actually open — F-15** — *S (not M)*
- **Doc recommends:** an Audit Trail / History tab directly on the record.
- **Exists:** a full **History tab** (Change History + Electronic Signatures) already on `/audit/capa/:id` (`TrailTab`). The gap is only that `/tickets/:id` lacks it (history there is behind the icon-only *Activity* modal).
- **Delta to apply:** decide the canonical CAPA detail surface. Either (a) route CAPA users to `/audit/capa/:id` (where it already exists — near-zero work), or (b) port `TrailTab`/`useAuditTrail` into `TicketDetailPage.tsx` as a labeled tab. **Do not build a new audit trail.**
- **Acceptance:** the record users land on exposes a labeled Audit Trail tab (who/what/when + prior→new + signatures) without opening a menu.

### Phase 1 — Data model & GMP integrity

**P1.1 · Structured Product / Batch / Test capture — F-01** — *L (genuinely net-new fields)*
- **Doc recommends:** validated Product (master-linked), Batch/Lot (repeatable), Test/Parameter (controlled vocab), numeric spec-limit + observed-result; pre-populate from OOS.
- **Exists:** only a free-text `Affected product / process` field; **OOS→CAPA linking already exists** (`useCreateCapaFromOos`).
- **Delta to apply:** add the structured fields to the `Capa` model (`schema.prisma`) + the seeded Initiation form (`seed-capa-workflow.ts`); populate them from the linked OOS at creation (`OosDetailPage.tsx` path already carries the OOS context). **Reuse the existing link — build only the fields + mapping.**
- **Acceptance:** list/dashboard can filter and trend by product/batch/test; batch numbers validated.

**P1.2 · Priority ↔ severity ↔ SLA alignment — F-18** — *M*
- **Doc recommends:** map Priority options to the documented severity tiers (Critical/Major/Minor/Observation) with closure windows.
- **Exists:** two separate scales today — a required `Severity` (`FINDING_SEVERITIES`) and an optional ticket `Priority` (`ACTION_ITEM_PRIORITIES`); SLA engine already exists but isn't tied to a documented tier→day-count.
- **Delta:** pick one canonical field for the closure clock, render the tier→window mapping at selection, and feed the SLA engine from it. Unblocks F-03/P3.3.

**P1.3 · Make Priority/Department reliable — F-08, F-09** — *S*
- **Doc recommends:** enforce/derive so the charts populate.
- **Exists:** fields exist but are **optional** (verified: `Priority (optional)`, `Department (optional)`).
- **Delta:** make required, or auto-derive Department from the initiating user's profile/role. **Acceptance:** by-priority / by-department charts populated for new records.

### Phase 2 — List & triage UX

**P2.1 · Distinct stage colors — F-02** — *S* — net-new. Assign each of the six stages a distinct color; keep list badge (`ModulePage.tsx:872-884`) and detail stepper consistent.

**P2.2 · Priority + aging/SLA columns — F-03** — *M* (depends on P1.2) — **SLA data already exists** at ticket level; the delta is surfacing a Priority column + computed days-remaining/overdue column in `COLUMN_CONFIG` (`ModulePage.tsx:66-75`) and including SLA in the list query.

**P2.3 · Void/cancel instead of hard delete — F-04** — *M* — **confirm dialog already exists**; the delta is changing the *semantics*: a Void/Cancel that requires a reason, keeps the record inactive, writes to the audit trail, and routes through the shared `useConfirmDelete` convention. Reserve true delete for a logged admin-only path.

**P2.4 · Title guidance — F-05** — *S* — placeholder + light validation; optional auto-suggest from Product+Test after P1.1.

### Phase 3 — Dashboard & cosmetics (net-new, mostly S)

**P3.1 · CAPA-specific KPI labels — F-12** — *S* — rename `MY PR / ALL PR / SAVED PR` → `My CAPAs / …` (`ModulePage.tsx:85-90`).
**P3.2 · Lifecycle-ordered stage workload — F-11** — *S* — order bars by process sequence, not count (`ModuleDashboard.tsx:187`).
**P3.3 · Replace/augment status donut — F-10** — *S* — swap for on-track vs at-risk (depends on P1.2 SLA).
**P3.4 · Site/product-line filter — F-13** — *M* — **Site field already captured**; the delta is a filter control on the dashboard/list (+ optional product-line once P1.1 lands). No new field needed.
**P3.5 · Readable breadcrumb — F-07** — *S* — resolve `/modules/:typeId` UUID to the workflow-type name (`Header.tsx:96-109`), mirroring the existing `/tickets/` uniqueId swap.

### Phase 4 — Forward-looking

**P4.1 · Duplicate/recurring detection — FL-01** — *M* — net-new; flag matches by product/test/line at intake (depends on P1.1).
**P4.2 · Expose RCA on the workflow surface — FL-03** — *S* — **already built** (`RootCauseTab`/`Fishbone` on `/audit/capa/:id`); only surface it if the workflow `/tickets/:id` view is the canonical one. No rebuild.
**P4.3 · Effectiveness verifier signature — FL-04** — *S–M* — **effectiveness UI + e-sign both exist**; delta = add a signed effective/not-effective determination reusing P0.1.
**P4.4 · Scheduled effectiveness reminders — FL-05** — *M* — net-new job on `effectivenessDue`; model on the existing recurring-audit sweep (`audit-schedule.service.ts`).
**P4.5 · Auto-suggested priority — FL-02** — *M* — blocked on Risk-to-Patient / Regulatory-Reportable fields not existing yet.

---

## 7. Suggested sequencing

1. **Phase 0** (F-14 enforce, F-15 surface) — compliance-critical, both are *connect existing*, not build.
2. **Phase 1** (F-01 fields, F-18 mapping, F-08/09 required) — data foundation.
3. **Phase 2** (F-02, F-03, F-04, F-05) — triage-grade list.
4. **Phase 3** (F-07, F-10–13) — cosmetics/quick wins.
5. **Phase 4** — forward-looking; FL-03 is effectively free (already built).

**Two decisions gate the plan:**
- **Canonical CAPA detail surface** — `/audit/capa/:id` (has History/RCA/Effectiveness/e-sign already) vs the workflow `/tickets/:id` (leaner). This single choice resolves F-15, FL-03, and part of F-14 with little-to-no build.
- **Config vs. code for F-16/F-17/F-19/F-20** — these did not reproduce on the current seed; re-check them against the customer's actual stage-form/workflow configuration before scheduling any work.

> **DB note (project rule):** all schema/migration work (P1.1, F-04 status, P1.2) targets `kaizen_qms` — never the legacy `quantumkaizen` database.
