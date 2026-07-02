# FQS-QK-UIUX-003 — UI/UX Manual: Analysis & In-Depth Implementation Plan

**Source spec:** _FQS-QK-UIUX-003 — User Interface & User Experience Instruction Manual (v1.0)_
**Target app:** `client/` (React 18 + Vite + Tailwind 3 + Ant Design 5)
**Related, already-implemented:** _FQS-QK-UIUX-002_ (typography) — Phases 1–4 done; see `client/changes.md`.

> Working rule: edits in the working tree only — **no commits/pushes** (project policy).
> This document is **analysis + plan only** — nothing here is implemented yet. Line numbers are from the repo state when written; re-confirm before editing.

---

## 1. Executive summary

FQS-QK-UIUX-003 claims "38 changes across 3 phases." Audited against the code, they sort into four buckets:

1. **Already done** (by 002): 14 label renames, WCAG status *colours*, mono on data, sidebar contrast, active-state gold accent. ~10 line items.
2. **Already scaffolded, needs finishing**: keyboard shortcuts, recent items, global-search shell, header notification infra, e-signature modal, per-record audit trail, read-only rendering, field validation, units-adjacent.
3. **Cheap net-new design-system wins**: sidebar group headers, ~6 icon swaps, 6th status colour, compliance badge, `g l` shortcut, read-only banner.
4. **Large feature builds** (roadmap, not a UI pass): the **8 "missing modules" (0/8 exist)**, real global search (backend), live notification-count badges (backend), role/persona nav, full 12-module reorder (partly blocked).

**Headline:** the design-system + 21 CFR-UI polish (buckets 2–3) is a few days of tractable work and is what a pharma evaluator notices first. The "missing modules" (bucket 4) are multi-week feature projects — a roadmap, not this pass.

---

## 2. Section-by-section disposition

| § | Manual section | Status | Bucket |
|---|----------------|--------|--------|
| 1 | Overview / principles | context | — |
| 2 | Navigation order & 4 groups | Partial — accent done; order+groups not; full order blocked | 3 + 4 |
| 3 | Icons (8 swaps) | ~6 tractable, 1 already ok, 1 N/A | 3 |
| 4 | UX patterns (8) | shortcuts/recent/search-shell/notif-infra exist; badges/pins/personas/compliance-badge missing | 2 + 4 |
| 5 | Status colours (6) | 5/6 done (002); add neutral-grey; color+icon+text already ok | 1 + 3 |
| 6 | Missing modules (8) | 0/8 exist | 4 |
| 7 | Component standards | largely met; spot gaps | 2 |
| 8 | 21 CFR Part 11 UI | audit trail/read-only/validation/units exist; e-sig fields, global audit log, session/last-login missing | 2 |
| 9 | Accessibility (WCAG) | contrast done (002); focus ring exists; verify 200% zoom | 1 + 2 |
| 10 | Floor displays | not done (deferred in 002 too) | 4 |
| 11–12 | Do's/Don'ts, Checklist | acceptance criteria | — |
| 13 | Phases | reconciled in §4 | — |

---

## 3. Current-state analysis

### 3.1 Navigation — `client/src/components/layout/Sidebar.tsx`

- **Structure:** three `NavSection`s, all `title: ""` (lines 225, 321, 325): [A] hardcoded Dashboard / DMS / Training & Qualification / LIMS; [B] DB-driven workflow modules from `useWorkflowTypes()` (order = API order, no client sort); [C] hardcoded Configuration.
- **Group headers:** none — header render path (`hasHeader = !!section.title`, ~line 641) is dead because all titles are empty.
- **Icons:** `ICON_BY_KEY` (lines 75–94) + `pickIcon`. QC=`Activity`, Audit=`BookOpen`, My Training=`GraduationCap` (dup of parent), Qual Matrix=`Database`, Complaints→`Layers` fallback, CAPA=`Wrench`. Sample Management already `TestTubes` ✓.
- **Badges:** none — `NavItem` (lines 51–65) has no count field.
- **Active state:** gold 3px left-border + navy-mid bg + gold text — **already matches the manual**.
- **Pins/personas:** none; Recent-items exists (lines 710–782); nav is permission-gated only (`gate()`, 352–366).
- **Reorder blocker:** the manual's top-level Deviations / Change Control / Calibration / Vendor Management / Product Complaints are, in-app, dynamic workflow types (only CAPA seeded), a LIMS sub-page, and a LIMS config tab — so the exact interleave can't be reproduced until they exist as first-class modules.

### 3.2 UX patterns

| # | Pattern | State | File |
|---|---------|-------|------|
| 1 | Global search | **Stub** — ⌘K palette over a 4-item static `SEARCH_INDEX` (lines 8–13); comment says wire to `GET /api/search`. | `components/shared/GlobalSearch.tsx` |
| 2 | Notification badges | Infra exists (header bell + `NotificationPanel`) but bound to `MOCK_NOTIFICATIONS = []`. No nav badges. | `components/layout/Header.tsx` |
| 3 | Role/persona nav | **No** — permission gating only. | `Sidebar.tsx` |
| 4 | Keyboard shortcuts | **Yes** — `ROUTE_MAP` = `g d/f/w/t`, plus `n`/`Esc`/⌘K. No `g l`. | `hooks/useKeyboardShortcuts.ts` |
| 5 | Pinned / Recent | Recent yes; pinned no. | `stores/recentItemsStore.ts` |
| 6 | Compliance-mode badge | **No.** | — |

### 3.3 21 CFR Part 11 UI

| # | Requirement | State | File |
|---|-------------|-------|------|
| 7 | E-signature dialog | Partial — meaning dropdown + entity + legal notice + password. **Missing printed name + date/time**; button = generic "Apply Signature" (line 54); 3 separate impls (shared, CAPA, DMS). | `components/shared/ESignatureModal.tsx` |
| 8 | Audit trail | Per-record (CAPA "Change History"). **No global Audit Log page** — header "View all" (Header line 258) navigates to `/dashboard`, and **no `/audit-log` route exists** in App.tsx. | `features/audit/CapaDetailPage.tsx` |
| 9 | Read-only records | Functional (`.form-readonly`) but **no prominent "Approved — Read Only" banner**. | `index.css`, `TicketFormHistory.tsx` |
| 10 | Field-level validation | Yes (shared `Input` `error`); adoption inconsistent. | `components/ui/Input.tsx` |
| 11 | Units adjacent | Yes (`${qty} ${unit}`). | `lims/SampleDetailPage.tsx` |
| 12 | Session timeout / last login | No UI — Settings field + `lastLoginAt` data only. | `pages/SettingsPage.tsx` |

### 3.4 Missing modules — 0/8 implemented

Batch Records, Environmental Monitoring, Recall, Batch Disposition, Cleaning Validation, Regulatory Affairs = **absent** (prose only in mock `features/workflows/data.ts`). Risk = **orphan** `risk.read/write` permission + `/qms/risks` mock link, no route/folder/model. Equipment = **partial** (LIMS instrument register + `CalibrationRecord`; no PM/lifecycle/IQ-OQ-PQ). Dynamic workflow backbone (`workflows`+`forms`+`tickets`+`modules`) exists → several could be workflow types rather than bespoke code.

### 3.5 Already delivered by 002 (do not redo)

Label renames; `state.oos/oot/approved/progress/quarantine` text tokens; mono on lot/batch/result/timestamp; `.gmp-narrative`; sidebar `#FFF3DC` check; Inter + Roboto Mono.

---

## 4. Implementation plan — code-level detail

### PHASE A — Design-system quick wins (~1–1.5 days, low risk)

---

#### A1. Sidebar group headers + achievable grouping (manual §2/§4)

**Goal:** the 4 groups — Lab Operations / Quality System / Compliance / Admin — with muted uppercase divider labels. The render path already exists; today it's dead because titles are empty.

**Approach:** (a) give sections real `title`s; (b) route each module to a group. Hardcoded items go to fixed groups; DB workflow modules are distributed by a name→group map with a sensible default.

Add near `WF_DISPLAY_NAME` in `Sidebar.tsx`:
```ts
// Which sidebar group each module belongs to (FQS-QK-UIUX-003 §2). DB-driven
// workflow types are matched by name; unknowns default to Quality System.
const MODULE_GROUP: Record<string, 'Quality System' | 'Compliance'> = {
  CAPA: 'Quality System',
  Deviation: 'Quality System',
  Complaints: 'Quality System',
  'Change Control': 'Quality System',
  Audit: 'Compliance',
};
const DEFAULT_MODULE_GROUP = 'Quality System';
```

Restructure the `sections` build so the four groups carry titles, e.g.:
- `{ title: '', items: [Dashboard] }` (ungrouped top)
- `{ title: 'Lab Operations', items: [LIMS, DMS] }`
- `{ title: 'Quality System', items: [...moduleItems where group === 'Quality System'] }`
- `{ title: 'Compliance', items: [...moduleItems where group === 'Compliance', (Audit)] }`
- `{ title: 'Admin', items: [Training & Qualification, Configuration] }`

**Render tweak:** the group header already renders when `section.title` is non-empty (lines ~636–687). Confirm the collapsed-sidebar divider still looks right. No new render code needed — this is mostly data restructuring.

**Scope note:** Calibration & Vendor Management aren't top-level modules (they live under LIMS), so the Compliance group will hold Audit (+ any Calibration/Vendor modules once they exist). Don't fabricate empty modules — group what exists. This is the "achievable grouping"; the exact 12-item interleave is C3.

*Effort:* ~3–4h (restructure + verify gating still drops empty groups).

---

#### A2. Icon swaps (manual §3)

Edits in `Sidebar.tsx`. Add imports (`Microscope`, `Grid3x3`, `Award`, `MessageSquareWarning`, `RefreshCw`) and change:

| Item | Where | Current → New |
|------|-------|---------------|
| Quality Control | LIMS child (line ~281) | `Activity → Microscope` |
| Audit | `ICON_BY_KEY.audit` (line 92) | `BookOpen → ClipboardCheck` |
| My Training | LMS child (line ~244) | `GraduationCap → Award` (de-dupe from parent) |
| Qualification Matrix | LMS child (line ~249) | `Database → Grid3x3` |
| Complaints | `ICON_BY_KEY` (add key) | fallback `Layers → MessageSquareWarning` (add `complaints`/`productcomplaints`) |
| CAPA | `ICON_BY_KEY.capa` (line 87) | `Wrench → RefreshCw` (loop) — *confirm preference* |

Sample Management already `TestTubes` ✓. Calibration N/A (not surfaced).

*Effort:* ~1h. *Risk:* trivial. **Decision:** confirm the CAPA loop-icon change (Wrench is arguably fine).

---

#### A3. 6th status colour (manual §5)

Complete the 6-colour system — add neutral grey for inactive/closed to the `state` group in `tailwind.config.js` (added in 002 Phase 2):
```js
state: {
  oos:        '#C53030',
  oot:        '#C98A00',
  approved:   '#1A6B3D',
  progress:   '#1A5C9E',
  quarantine: '#B84E00',
  closed:     '#5A6B7D', // 5.1:1 AA — inactive / archived / closed
},
```
Apply `text-state-closed` to closed/archived/obsolete status text where useful (e.g. `Badge.tsx` `default`/`outline` variants, closed CAPA/audit states). "Color + icon + text" is already compliant (002 audit).

*Effort:* ~1h.

---

#### A4. `g l` LIMS shortcut (+ cheap extras) (manual §4)

`hooks/useKeyboardShortcuts.ts`, extend `ROUTE_MAP` (lines 4–9):
```ts
const ROUTE_MAP: Record<string, string> = {
  'g d': '/dashboard',
  'g l': '/lims/samples',   // LIMS
  'g c': '/audit/capa',     // CAPA
  'g a': '/audit/register', // Audit
  'g f': '/forms',
  'g w': '/workflows',
  'g t': '/tickets',
};
```
The chord engine already handles any `g <letter>` (lines 43–52) — this is data-only.

*Effort:* ~15min.

---

#### A5. Compliance-mode badge (manual §4/§8)

Small static chip in the sidebar footer (`Sidebar.tsx`, near the user-identity block ~775–806, shown only when expanded):
```tsx
{!sidebarCollapsed && (
  <div style={{ borderTop: '1px solid ' + DIVIDER }} className="px-3 py-2">
    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-wide"
          style={{ color: ACCENT }}>
      <ShieldCheck size={11} /> GMP · 21 CFR 11 · EU Annex 11
    </span>
  </div>
)}
```
Static text using existing tokens; no data dependency.

*Effort:* ~30min.

**Phase A verification:** extend the existing real-login Playwright harness (`tests/ui/labels.spec.ts` pattern) to assert the 4 group headers render, the new icons are present (by `aria`/title or SVG), and the compliance chip shows. CSS-emission check for `text-state-closed`.

---

### PHASE B — 21 CFR Part 11 UI polish (~1.5–2 days, medium risk)

---

#### B1. E-signature modal completion (manual §8)

`components/shared/ESignatureModal.tsx`. Three gaps: no printed name, no date/time, generic button label.

1. Import the current user: `import { useAuthStore } from '@/stores/authStore';` → `const user = useAuthStore(s => s.user);`
2. Add a signer block to the context panel (after line 75):
```tsx
<div className="mt-2 pt-2 border-t border-gray-200 flex justify-between text-xs">
  <span className="text-gray-500">Signer: <span className="font-medium text-gray-700">{user?.name ?? '—'}</span></span>
  <span className="font-mono text-mono-xs text-gray-500">{new Date().toLocaleString()}</span>
</div>
```
   *(Display-only timestamp for the operator; the authoritative signing time is server-set.)*
3. Make the confirm button reflect the meaning (line 52–55):
```tsx
<Button variant="primary" onClick={handleSign} isLoading={isLoading} disabled={!password}>
  <ShieldCheck size={15} /> {meaning === 'Rejected' ? 'Reject' : meaning} & Sign
</Button>
```
   So it reads "Approve & Sign", "Review & Sign", etc. instead of "Apply Signature".

**Decision:** the CAPA (`CapaDetailPage.tsx` ~552) and DMS (`DocumentDetailPage.tsx` ~292) signing UIs are separate AntD implementations. Recommend **field-parity now** (mirror name/date/meaning-button in those two) and defer consolidating all three onto the shared modal to a later refactor.

*Effort:* ~0.5 day incl. the two ad-hoc sites.

---

#### B2. "Approved — Read Only" banner (manual §8)

New `components/ui/ReadOnlyBanner.tsx`:
```tsx
import { Lock } from 'lucide-react';
export function ReadOnlyBanner({ label = 'Record Approved — Read Only' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-state-closed/30 bg-surface-secondary px-3 py-2 text-xs font-medium text-state-closed">
      <Lock size={13} /> {label}
    </div>
  );
}
```
Render it where completed GMP records show: submitted stage forms (`TicketFormHistory.tsx` — already read-only), effective DMS docs (`DocumentDetailPage.tsx`, on `is_locked`/Effective), closed CAPAs (`CapaDetailPage.tsx`). The `.form-readonly` plumbing exists — this adds the visible affordance the manual wants.

*Effort:* ~0.5 day (component + 3 call sites).

---

#### B3. Global Audit Log — link fix / page (manual §8)

Today Header line 258 navigates to `/dashboard`, and **no `/audit-log` route exists** (though the breadcrumb map at Header line 25 has a label for it).

Two options:
- **Cheap:** repoint the header link to an existing audit surface (e.g. `/audit/dashboard` or `/audit/register`) so "View all in Audit Log" isn't a dead-end. ~15min.
- **Fuller:** add a real global `/audit-log` page aggregating change-history across records (needs a backend list endpoint). Larger — treat as C-tier.

Recommend the cheap repoint now + note the aggregate page as future work.

*Deferred in §8:* session-timeout countdown + last-login display — needs auth/session plumbing; separate small task.

**Phase B verification:** Playwright — open a signing dialog, assert the signer name + timestamp + dynamic button label; assert the read-only banner renders on a submitted form; assert the header audit link no longer lands on `/dashboard`.

---

### PHASE C — Data-backed interaction features (needs backend; scope each first)

**C1. Notification badges on nav (manual §4).** Add `count?: number` to `NavItem`; a `useNavCounts()` query hook; render a small pill in `renderNavItem`. **Requires** a backend `GET /api/nav-counts` → `{ capa: 5, deviations: 3, oos: 2, … }` (open/overdue counts per module). The header notification infra is real but mock-bound — same underlying data need. *Effort:* ~1–1.5 days incl. backend.

**C2. Real global search (manual §4).** Replace the 4-item `SEARCH_INDEX` with debounced calls to `GET /api/search?q=` returning typed hits (sample by lot/number, CAPA by id, document by SOP no., ticket). The palette UI (keyboard nav, grouping) already exists — only the data source + a result-type→route/icon map change. **Requires** the backend endpoint (cross-module search). *Effort:* ~1.5–2 days incl. backend.

**C3. Nav reorder to the 12-module GMP order (manual §2).** Add an explicit `order` alongside `MODULE_GROUP` (A1) and sort within groups. **Partly blocked:** Deviations/Change Control/Vendor Management/Calibration must exist as first-class nav modules for the full interleave. Do achievable ordering in A1; full order once those modules exist. *Effort:* ~0.5 day (unblocked portion).

**C4. Role/persona nav views (manual §4).** Per-persona ordering/visibility beyond permissions (QC Analyst → LIMS first, etc.). Define personas, add a persona→layout map, likely a user preference. *Effort:* ~2–3 days; design personas first.

---

### PHASE D — Missing modules (manual §6) — ROADMAP, not this pass

0/8 exist; each is a feature project. Recommended approach **per module**:

| Module | Recommended path | Rough size |
|--------|------------------|-----------|
| Risk Management | **Dynamic workflow type** + forms (FMEA/HACCP templates); wire the orphan `risk.read/write` perm | M |
| Change Control | **Dynamic workflow type** (like CAPA) | M |
| Recall Management | **Dynamic workflow type** | M |
| Batch Disposition | **Dynamic workflow type** gating on LIMS release | M |
| Cleaning Validation | **Dynamic workflow type** + forms | M |
| Equipment Management | **Extend** existing LIMS Equipment + `CalibrationRecord` (PM schedule, IQ/OQ/PQ) | M–L |
| Environmental Monitoring | **Bespoke** (time-series, cleanroom classes, limits) | L |
| Batch Records (EBR/MBR) | **Bespoke** (large domain) | L |

Per the manual (§6 "Evaluator Impact"), for the **Critical** ones (Batch Records, Environmental Monitoring, Recall) prepare a **roadmap answer + mock** before pharma demos rather than building blind. Do **not** attempt these in a UI pass.

---

## 5. Decisions to resolve

1. **CAPA icon** (A2): change `Wrench → RefreshCw`, or keep Wrench? (cosmetic)
2. **Nav grouping vs. full reorder** (A1/C3): ship groups + achievable order now, defer exact 12-item interleave until missing modules exist? (recommended)
3. **E-sig: parity vs. consolidation** (B1): mirror fields in the 3 signing UIs now, consolidate later? (recommended parity)
4. **Audit Log** (B3): cheap repoint now vs. build an aggregate page? (recommended repoint)
5. **Missing modules** (D): workflow-type vs. bespoke, per module — and which (if any) to build vs. roadmap-only.
6. **Backend endpoints** (C1/C2): build `/api/nav-counts` and `/api/search`, or defer these two patterns?
7. **Floor +2px / 44px targets (§10) + session-timeout UI:** confirm deferred (as in 002).
8. **Icon library:** stay on **lucide-react** (covers all needed glyphs; no new dep) rather than Tabler/Phosphor? (recommended)

---

## 6. Suggested sequencing

**A (design-system) → B (21 CFR UI polish) → C (data-backed, per-item) → D (module roadmap, separate track).**

A + B are a faithful implementation of everything in FQS-QK-UIUX-003 that is genuinely UI/UX and not a new product module, and are the highest-signal for pharma evaluators (groups, icons, 6-colour status, compliance badge, e-sig fields, read-only banner). C and D need product/back-end decisions first.

## 7. Files likely touched

**Phase A:** `Sidebar.tsx` (groups, icons, compliance chip), `tailwind.config.js` (`state.closed`), `hooks/useKeyboardShortcuts.ts`.
**Phase B:** `components/shared/ESignatureModal.tsx`, `features/audit/CapaDetailPage.tsx` + `features/dms/DocumentDetailPage.tsx` (e-sig parity), new `components/ui/ReadOnlyBanner.tsx` + call sites, `components/layout/Header.tsx` (audit link).
**Phase C (if pursued):** `Sidebar.tsx` + new `useNavCounts` hook + backend; `components/shared/GlobalSearch.tsx` + backend.
**Phase D:** new feature folders or seed workflow types per §D table.
