# DMS — Gap Analysis & Remediation Plan

> Date: 2026-06-27 · Branch: `shriyansh-phase-implemenation`
> Scope: the controlled-document module (`backend/src/modules/dms`, `client/src/features/dms`).
> Basis: full-lifecycle Playwright exercise (`tests/e2e/dms-flow.spec.ts`, **all green**)
> + source review of the service, routes, schema, Prisma models and RBAC catalog.
> Companion to `docs/LIMS-DMS-implementation-plan.md` (original build plan).

---

## 1. Summary

The DMS lifecycle **works end to end** today: create → save → submit → (reject) →
approve+e-sign → effective → assign/acknowledge reads → periodic review → revise →
re-issue → retire, each with an audit-trail entry and version locking. The UI list
and detail pages render with zero console errors.

The gaps are **not broken wiring** — they are **compliance-completeness and
state-model** gaps. Three are concrete defects (self-approval, an e-sign bypass
route, dead status values); one is a larger architectural decision (routing DMS
through the configurable workflow engine, as OOS→CAPA already is).

Verified lifecycle (API, from the spec):

| Step | Endpoint | Result |
|---|---|---|
| Create (editor) | `POST /dms/documents` | 201, `DOC-2026-NNNN`, DRAFT v1.0 |
| Save draft | `PUT /…/content` | 200 |
| Submit | `POST /…/submit` | 200 → IN_REVIEW |
| Reject | `POST /…/reject` | 200 → DRAFT |
| Approve + e-sign | `POST /…/approve` | 200 → EFFECTIVE, version locked |
| Acknowledge | `POST /…/acknowledge` | 200, receipt ACKNOWLEDGED |
| Mark reviewed | `POST /…/review` | 200, review date pushed |
| Revise → issue v2 | `POST /…/revise` + `/issue` | 200 → EFFECTIVE v2.0 |
| Retire | `POST /…/retire` | 200 → RETIRED |
| Delete retired (guarded) | `DELETE /…` | 400 (DRAFT-only) ✓ |

---

## 2. Gap inventory

| # | Gap | Severity | Evidence |
|---|---|---|---|
| G1 | ~~No separation of duties — author/owner can approve & e-sign their own document~~ **ACCEPTED BY DESIGN (2026-06-27): author/owner may approve & e-sign. No guard.** | — | decision |
| G2 | **E-sign bypass route** — `POST /…/issue` makes a doc EFFECTIVE with no signature | 🟠 High → ✅ **FIXED** | route removed; `/issue` now 404 |
| G3 | **`SUPERSEDED` status never set** — old effective versions aren't marked superseded | 🟡 Medium | enum `schema.prisma:1943`; never written in service. Test: after v2 issue both versions just `(locked)` |
| G4 | **`APPROVED` status is dead** — flow jumps IN_REVIEW→EFFECTIVE; no approved-not-yet-effective state, no future-dated effective | 🟡 Medium | enum `schema.prisma:1941`; dead UI branch `DocumentDetailPage.tsx:200` |
| G5 | **No structured review record / designated reviewer** — reject reason lives only in audit `reason`; anyone with `document.approve` can approve | 🟡 Medium | `rejectDocument()`; no reviewer-assignment step |
| G6 | **DMS sits outside the workflow engine** — approval is a hardcoded e-sign, not a routed/configurable workflow ticket (unlike OOS→CAPA) | 🟢 Architectural decision | OOS uses `findActiveCapaWorkflow` + `engineRaiseTicket` (`oos.service.ts:11,76`); DMS does not |

Notes:
- The UI never exposes G2 (it always routes Submit → Approve & Sign, including for
  revisions), so the bypass is API-only — but the route is open to any holder of
  `document.issue`.
- G3 at the **version** level is partly derivable today (`isLocked && id ≠ currentVersionId`).
  The gap is that it isn't made explicit/auditable, and **document-level** SUPERSEDED
  (one document replacing another) has no mechanism at all.

---

## 3. Remediation plan

Phased so the compliance-critical fixes ship first and independently. Each phase is
self-contained and leaves `tsc` clean both sides.

### Phase A — Compliance-critical (no schema change) · ✅ DONE (2026-06-27)

**A1 · Separation-of-duties guard on approval (G1) — ❌ NOT IMPLEMENTED (by decision)**
- Product decision 2026-06-27: the author/owner **is allowed** to approve and
  e-sign their own document. No guard was added; approval still requires a valid
  re-authenticated e-signature.

**A2 · Close the e-sign bypass (G2) — ✅ done**
- Removed `POST /…/issue` entirely: deleted the route (`dms.routes.ts`),
  `ctrl.issue` (`dms.controller.ts`), `issueDocument()` (`dms.service.ts`),
  `IssueSchema`/`IssueInput` (`dms.schema.ts`), and `useIssueDocument`
  (`client/src/lib/api/dms.ts`). `approve` (e-sign) is now the **only** path to
  EFFECTIVE; revisions re-enter via Submit → Approve & Sign. The `document.issue`
  permission is retained (still used by retire / mark-reviewed / assign-readers).

**A3 · Remove the dead `APPROVED` UI branch (G4, partial) — ✅ done**
- `DocumentDetailPage.tsx` — dropped the `|| doc.status === 'APPROVED'` arm on the
  Retire button (nothing ever sets APPROVED).

Verified: `tests/e2e/dms-flow.spec.ts` green — `/issue` → 404, revise→submit→approve
re-issues v2.0 as EFFECTIVE, full lifecycle intact, UI 0 console errors. `tsc` clean
both workspaces.

### Phase B — State model: real supersession (G3) · ✅ B1 DONE (2026-06-27)

**B1 · Mark prior version superseded on re-issue — ✅ done**
- Schema: added `DocumentVersion.supersededAt DateTime?` + `supersededById String?`
  (plain id, no FK — matches the module's convention). (Document-level `SUPERSEDED`
  status stays reserved for the doc-replaces-doc case in B3.)
- `approveDocument()` (the single effective path): inside the existing `$transaction`,
  when a prior `currentVersionId` exists and differs from the version being approved,
  stamps that prior version `supersededAt = now`, `supersededById = working.id`, and
  writes a `version_superseded` audit-trail entry (old→new label).
- Serializer exposes `is_superseded`, `superseded_at`, and a derived
  `superseded_by_version_label`; the version-history UI shows a **"Superseded → vN.N"**
  tag (`DocumentDetailPage.tsx`). Client `DocVersion` type extended (`dms.ts`).

**Migration applied (local DB):** the active `DATABASE_URL` is **local Postgres**
(`.env` line 21; the Neon lines 5 & 25 are commented). Columns added with idempotent
additive SQL via `prisma db execute`, recorded as a tracked migration
`20260627090000_dms_version_supersession` (`migrate resolve --applied`) and
`prisma generate` re-run, so a future `migrate deploy` reproduces it. No data reset.

Verified: `tests/e2e/dms-flow.spec.ts` green — after revise + re-approve, v1.0 is
`is_superseded=true, superseded_by=v2.0, superseded_at` stamped; v2.0 current and not
superseded. `tsc` clean both sides; UI 0 console errors.

**B2 · Use the `APPROVED` state for scheduled effectivity (G4) — ✅ DONE (2026-06-27)**
- Decision: **repurpose** `APPROVED` (not remove it) so future-dated effectivity is
  supported and the enum value earns its place.
- **No schema change** — reuses `Document.status = APPROVED` + `Document.effectiveDate`
  (holds the scheduled future date while APPROVED).
- `ApproveSchema` gains optional `effective_date` (`dms.schema.ts`). `approveDocument()`
  branches: a **future** date → e-sign, lock the version, status `APPROVED`,
  `effectiveDate` = the scheduled date, `reviewDueDate` = scheduled + period, and the
  prior version stays in force (no supersession yet); **omitted / past / now** →
  immediate `EFFECTIVE` (unchanged behaviour).
- New `activateScheduledDocuments()` sweep flips `APPROVED → EFFECTIVE` once the date
  arrives — points `currentVersionId` at the approved version and supersedes the
  prior one (B1). Wired into the worker cron tick (`worker.ts`) and the audit-sweep
  CLI (`audit-sweep-once.ts`) via `jobs/sweeps/activateScheduledDocuments.ts`.
- `reviseDocument()` now blocks revising an `IN_REVIEW`/`APPROVED` doc (keeps the
  pending version stable).
- UI (`DocumentDetailPage.tsx`): approve modal has an optional **Effective date**
  picker (empty = immediate); the header shows **Effective From + "Scheduled"** while
  APPROVED; Retire is available on APPROVED (cancel a scheduled issue).

Verified: Playwright — future-date approve → `APPROVED`, `effective_from` in the
future, not in force, version locked, revise → 400. Time-traveled sweep flips the
doc to `EFFECTIVE` with `currentVersionId` set and the effective date preserved.
`tsc` clean both sides; UI 0 console errors.

**B3 · (optional) Document-level supersession**
- Add `Document.supersededByDocumentId String?`; a "Supersede with new document"
  action sets the old doc `SUPERSEDED` and links the replacement. Defer unless the
  business needs doc-replaces-doc (vs. in-place revisions).

### Phase C — Workflow-engine integration (G5, G6) · architectural, ~2–4 days

Only if parity with the team's canonical workflow engine is the goal (OOS→CAPA was
reworked this way in §3.6c). Mirror that pattern:
- Resolve an **ACTIVE "Document Control" workflow** (analogue of `findActiveCapaWorkflow`).
- On submit, `raiseTicket` carrying doc context in `customFields`; approval/rejection
  becomes a workflow stage action (configurable reviewers, multi-stage routing,
  notifications) instead of the hardcoded e-sign.
- Keep the e-signature at the approval stage for Part 11.
- This subsumes G5 (designated reviewer, structured review record) for free.

**Decision required before C:** is DMS change-control meant to live in the workflow
engine, or stay a standalone module? This is a product call, not a bug — list it for
sign-off rather than building speculatively.

---

## 4. Recommended order & effort

| Order | Items | Effort | Ships independently |
|---|---|---|---|
| 1 | **Phase A** (A1–A3) | ~½ day | ✅ no migration |
| 2 | **Phase B1** (supersession marking) | ~1 day | needs additive migration |
| 3 | Phase B2/B3 | ~1 day | only if scheduled-effectivity / doc-supersession needed |
| 4 | **Phase C** | 2–4 days | only after the product decision |

**Minimum to call DMS compliance-credible: Phase A + B1.** Phase A alone closes the
two real defects (self-approval, e-sign bypass).

---

## 5. Risks & open decisions

1. **Self-approval default (A1)** — on by default breaks single-admin demo envs.
   Mitigation: config flag, default on, documented for demos.
2. **Removing `/issue` (A2)** — confirm no external caller/integration uses it
   (UI doesn't). Grep before deleting.
3. **Migration on a drifted live DB (B1)** — must use additive `prisma db execute`;
   do **not** `db push`. Pre-existing `Lms*` drift remains a separate cleanup.
4. **`APPROVED`/`SUPERSEDED` enum values** — either wire them up (B2/B3) or remove
   them; leaving defined-but-unused states is itself an audit-readiness smell.
5. **Workflow-engine integration (C)** — needs explicit product sign-off on whether
   DMS is in or out of the canonical engine.

---

## 6. Verification plan (per phase)

- **A:** spec asserts self-approval → 400; second user approval → 200/EFFECTIVE;
  `/issue` → 404; happy path intact.
- **B1:** after revise+re-issue, prior version carries `superseded_at` and
  `superseded_by_version_id`; current version does not; history UI shows "Superseded".
- **All:** `tsc --noEmit` clean both workspaces; `tests/e2e/dms-flow.spec.ts` green;
  audit trail written for every transition; e-signature still recorded on approval.

> Per project rule, all work stays in the working tree — nothing is committed.