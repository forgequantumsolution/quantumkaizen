## Notification bell opened two things at once — 2026-07-28

Reported: clicking the bell in the navbar opened both the compact dropdown and
the full-height notification drawer simultaneously. Not committed.

- **`src/components/layout/Header.tsx`** — the bell's `onClick` called both
  `togglePanel()` (the store flag that renders `NotificationPanel`, the slide-in
  drawer) and `setShowNotifDropdown(...)` (the inline dropdown), so a single
  click fired both surfaces. Dropped `togglePanel()` from the handler; the bell
  now toggles only the dropdown, and the drawer opens solely from its
  "View all notifications →" footer link (`openPanel()`), which was already
  wired that way. `togglePanel` removed from the store destructure — it now has
  no callers anywhere in the app, though it remains on `notificationStore` as
  available API.

---

## Training matrix: auto-assign on join — 2026-07-28

UI for the new per-rule `autoAssignOnJoin` flag (backend rationale in
`backend/changes.md`). A matrix rule can now fire the moment a user lands in its
target rather than only on **Run sync**.

- `lib/api/lms.ts` — `auto_assign_on_join` on the `MatrixRule` type, plus a new
  `useUpdateMatrixRule()` hook so the flag can be flipped in place instead of
  deleting and re-adding a rule (`PATCH /lms/matrix/:id` already existed but was
  unused by the client).
- `features/lms/TrainingMatrixPage.tsx` — **Auto-assign on join** switch in the
  Add-rule modal, defaulting to **on** (the DB column defaults to `false`, so
  pre-existing rules stay sync-only until deliberately armed; new rules get the
  behaviour without extra thought). Plus an **On join** column with an inline
  switch, gated on `lms_matrix.write` — read-only users see a tag.
- `features/lms/AssignmentsPage.tsx` — one-line pointer to the Qualification
  Matrix. Assignments is where an admin looks for this, but it only does
  point-in-time assignment; the standing rules live under Configuration and were
  easy to miss from there.

Not committed.

---

## CAPA/Market/Change Control/Risk tracker — frontend-only fixes — 2026-07-28

Batch of frontend-only items from the KRZ tracker (see
`docs/CAPA-open-items-status-and-scoping.md`,
`docs/Market-Platform-open-items-status-and-scoping.md`,
`docs/Change-Control-open-items-status-and-scoping.md`,
`docs/Risk-Management-open-items-status-and-scoping.md`), each verified against
current source (and, where the tracker's premise needed confirming, the live
`kaizen_qms2` DB) before implementing. Not committed. Two items from this batch
(KRZ-CC-018, KRZ-RISK-022) were investigated and explicitly **not** built —
both need a backend aggregate/endpoint and would otherwise fight the
"everything derived client-side from already-loaded data, nothing fetched"
design rule those two analytics panels are built on; noted inline below.

- **`src/features/tickets/shared/RaiseTicketDrawer.tsx`** (KRZ-CAPA-005,
  KRZ-CAPA-018, KRZ-RISK-007, KRZ-RISK-018) — added `drawerTitle`/`submitLabel`
  overrides, a `titlePlaceholder`/`titleHelp` override, a `priorityHint`
  tooltip slot next to Priority, and `requireSeverity`/`requireClassification`
  flags (with a non-blocking "title looks very short" warning on the Title
  field). Wired per-module in `ModulePage.tsx`: CAPA gets a product/batch
  title placeholder + a Priority→severity-tier mapping tooltip; Risk gets
  "Initiate risk assessment" copy and required Severity/Classification.
- **`src/features/tickets/detail/StageFormSection.tsx`** (KRZ-CAPA-022) — after
  the CAPA Initiation form is submitted, cross-checks its
  `risk_to_patient_product`/`regulatory_reportable` answers (confirmed live in
  the DB, section "Impact") against the ticket's Priority (passed in from
  `TicketDetailPage.tsx`) and shows an amber banner when Priority is Low/unset
  but the form says otherwise. Informational only — the generic form runtime
  has no pre-submit cross-field validation hook to block on.
- **`src/features/lims/SuppliersPage.tsx`** + **`src/lib/api/supplier.ts`**
  (KRZ-MKT-007) — added a Risk Tier column/badge. The tier was already
  computed and stored server-side (`risk-gate.service.ts`) but never left the
  backend; see the matching `backend/changes.md` entry.
- **`src/features/lims/CertificationsPage.tsx`** (KRZ-MKT-014, KRZ-MKT-016) —
  added EMA/Health Canada/21 CFR Part 11/ICH Q10/CDSCO to the certificate-type
  suggestions, and switched the Type field from a closed `Select` to an
  `AutoComplete` so a new type can be typed in directly (the backend field was
  already free text — only the UI was rigid).
- **`src/components/shared/ChatBot.tsx`** (KRZ-CC-019) — floating launcher
  dropped from `zIndex: 9999` to `40` (was rendering above open
  modals/drawers, worse than the reported "covers the toolbar button" bug) and
  nudged further from the corner (52px→46px, 24px→28px offset).
- **`src/features/modules/ModuleDashboard.tsx`** (KRZ-CC-021) — added a
  `STAGE_PALETTE` cycling color set + `HColorBarOrEmpty`; the Stage Workload
  chart now colors each stage distinctly instead of one flat module-accent
  color (module-accent charts elsewhere are untouched — that's a deliberate,
  separate convention).
- **`src/components/analytics/metrics.ts`** — added `agingByCreationFine()`
  (finer 5-bucket aging with SLA-threshold red coloring, KRZ-RISK-020), kept
  separate from the existing `agingByCreation()` so other modules' charts are
  unaffected. Wired into `src/features/modules/analytics/RiskAnalytics.tsx`.
- **`src/features/modules/analytics/ChangeControlAnalytics.tsx`** (KRZ-CC-022)
  — "Open Change Aging" swapped from `agingByCreation` (age-since-creation) to
  the already-existing `dueDatePosture()` (on-time/due-soon/overdue against
  each change's due date), retitled "SLA Posture — Open Changes" to match.
- **`src/features/tickets/detail/TicketDetailsTab.tsx`** (KRZ-CC-024) —
  replaced a local, option-less `fmtDate` (browser-default format, e.g.
  `7/28/2026`) with the shared `formatDate` from `lib/utils.ts`
  (`28 Jul 2026`) already used everywhere else on the same page.
- **`src/components/shared/EntityAuditTrail.tsx`** (KRZ-CC-011) — added an
  `extraRefs` prop; folds in audit-trail rows for extra entities (e.g. a
  ticket's `FormSubmission`s) via `useQueries` against the existing generic
  `/audit-trail/:entityType/:entityId` endpoint (no backend change — the route
  and the underlying Prisma audit-diff extension were already fully generic),
  merged and sorted with the primary entity's rows.
  `src/features/tickets/TicketDetailPage.tsx` now passes the ticket's
  submission ids (from `useTicketFormHistory`) as `extraRefs`, so the History
  tab shows who changed a stage-form field ("Verified By", etc.), not just
  ticket-column edits.
- **`src/components/shared/StageProgressDots.tsx`** (new, KRZ-RISK-023) — dot
  row showing lifecycle position ("stage 3 of 6"), derived from the
  workflow's real `flow_json.nodes` graph (fork/join/decision nodes excluded,
  linear read). Wired into `src/features/modules/ModulePage.tsx`'s
  `TicketTable`, fetched once per distinct workflow id on the page via
  `useQueries` — not per row. Falls back to no dots (existing stage-name
  badge only) when the sequence can't be resolved, rather than guessing.
  Benefits every module's list view, not just Risk.
- **`src/features/risk/RiskFrameworkPage.tsx`** (KRZ-RISK-027) — added a Site
  selector to the framework editor (`RiskFramework.siteId` already existed
  end-to-end in the API types; the editor just never exposed it).

### Verification pass (Playwright, same day)

`tests/e2e/krz-frontend-fixes.spec.ts` **(new)** — 15 specs driving the real
app on :5173, one per tracker id plus explicit side-effect specs asserting the
shared components (RaiseTicketDrawer / ModuleDashboard / metrics.ts) did *not*
change behaviour for modules that didn't opt in, and that no page raises a
React hook/dependency error. All 15 green. Four defects were found by that pass
and fixed:

1. **Hooks-order violation (introduced by this batch)** —
   `EntityAuditTrail.tsx` called `useMemo` *after* the `if (!canRead) return`
   early return, and used a spread (`[data, ...queries.map(...)]`) as its dep
   array. The first crashes as soon as `canRead` flips when permissions resolve;
   the second changes the deps array's length between renders (`extraRefs`
   starts `[]`). Hooks moved above the early return and the fingerprint joined
   into one dep.
2. **CC-024 was only half-fixed** — the ticket detail page still rendered
   `7/28/2026` on the Stage Forms tab. Four more components had their own
   `new Date(...).toLocaleString()`: `StageFormSection`, `TicketFormHistory`,
   `SubmittedFormsCard`, `RequiredFormsCard` — all now use the shared
   `formatDateTime`. (`SlaPanel` deliberately left alone: it is timezone-aware
   and uses `dateStyle: 'medium'`, which never produces the ambiguous
   all-numeric form.)
3. **CC-011 missed the current stage** — `extraRefs` was derived only from
   `/tickets/:id/form-submissions`, which *deliberately* excludes the current
   stage ("StageFormSection renders those"), so the form being actively edited
   contributed nothing. Now merged with `useTicketStageForms`' per-binding
   `latestSubmission`.
4. **Merged audit rows were unattributable** — a folded-in form row rendered as
   a bare `CREATE  —` with nothing marking it as form-level. `buildTrailColumns`
   gained an opt-in `showSource` column (off everywhere except this merged
   view, so the global viewer is untouched), rendering `FormSubmission` as
   "Stage form".

Caveats worth knowing, both **pre-existing and unrelated to this batch** (each
proven so, and pinned by a spec so they can't be mistaken for a regression):

- **KRZ-MKT-007 cannot function until a migration runs.** `Supplier.riskTier`
  exists in `schema.prisma` but was never migrated into `kaizen_qms2`, so a bare
  `prisma.supplier.findMany()` — no `serialize()` involved — already fails with
  *"The column `Supplier.riskTier` does not exist"*. Every supplier query 500s;
  the new column renders but can never populate.
- **The ticket-id allocator can deadlock a prefix.** `generateUniqueTicketId`
  finds the highest id excluding child tickets but checks uniqueness *including*
  them, and retries only 5 times — so a run of ≥5 child tickets (CAPA-FQS-080…084
  today) permanently blocks new tickets on that prefix. New CAPA tickets cannot
  currently be raised at all.
- Form re-submission writes a **new** `FormSubmission` rather than mutating one,
  so the audit trail shows successive `CREATE` rows per submit rather than
  old→new field diffs. CC-011 surfaces *that a stage form was submitted, by whom
  and when*; true field-level diffs would need the backend to update in place.

## Submitted stage form labels/values hard to tell apart — 2026-07-27

`src/features/forms/FormFillEmbed.tsx` + `src/features/forms/FieldValueText.tsx`
— in the read-only submitted-form view (Stage Forms tab on a completed/past
stage), the field label (`text-[13px] font-medium text-slate-700`) and its
value (`text-sm text-gray-800`) were nearly the same size/weight/color, so a
filled form read as an undifferentiated block of text.
- `FormFillEmbed.tsx` — the field label is now a small caption
  (`text-[11px] font-semibold uppercase tracking-wide text-slate-500`) **only
  when `readOnly`**; the editable-fill label is untouched.
- `FieldValueText.tsx` — bumped every plain-text value renderer (`Text`
  helper, textarea/richtext, compliance, color, file/image) to
  `font-medium text-gray-900` so the answer reads bold and dark against the
  now-muted label above it. Table cells and chip values (checkbox/multi_text)
  were already visually distinct (borders/pills) and left as-is.
- Verified against INS-FQS-060's Approval Closure form — labels ("FINAL
  DISPOSITION") now read as small caption text, values ("Released") as bold
  dark text.
- **Follow-up** — the weight/color contrast alone still read as a flat wall
  of text with no separation between adjacent fields packed into the same
  row. Wrapped each read-only field in its own tile
  (`rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5`, grid gap
  tightened to `gap-3`) so every field is a visually distinct unit — mirrors
  the existing card-based look used throughout the app rather than
  introducing a new pattern. Fill-mode (editable) layout/spacing untouched.

## Stage Forms tab empty on completed tickets — 2026-07-27

`src/features/tickets/TicketDetailPage.tsx` — the "Stage Forms" tab
(`tab === 'forms'`) only rendered `TicketFormHistory` (which already knows
how to default to the last stage's submitted forms for a completed ticket —
see its own doc comment) when the user had manually clicked a past stage in
the flow band (`viewingPastStage`). With nothing clicked, a completed ticket
fell through to `StageFormSection`, which fetches forms for the ticket's
*current* stage — but a completed flow has no current stage
(`flow.currentStages` is empty by design), so it rendered nothing. Changed
the branch condition to `viewingPastStage || isCompleted`, so a completed
(or rejected — also `isCompleted`) ticket auto-selects its last stage and
shows those forms read-only without requiring a click first. Verified against
INS-FQS-060 (completed) — Approval Closure's submitted form now renders.

## Ticket description no longer capped to 70ch measure — 2026-07-27

`src/features/tickets/detail/TicketDetailsTab.tsx` — removed `.gmp-narrative`
from the ticket description field. That class caps text at a 70-character
line measure (`client/src/index.css:407`, added for the FQS-QK-UIUX-002 §8
narrative-readability rule and applied to CAPA/OOS/audit narratives). On the
ticket Details card it made the description wrap narrowly with a lot of
unused card width to its right — reported against
`/tickets/1c57e056-6b67-42e9-b536-959606ffd682`. User chose to drop the cap
for this field specifically rather than keep it consistent with
CAPA/OOS/audit; those narrative fields are untouched and still capped.

## Module list table — ID column alignment + URL-based tab routing — 2026-07-27

`src/features/modules/ModulePage.tsx` — the shared table behind every module's
Overview/My Tasks/Findings list (Inspection, CAPA, Deviations, etc.). Not
committed.

- **ID column alignment** — the `ID` header sat flush-left while each cell was
  pushed right by the child-ticket expand chevron (or its 18px spacer), so the
  header and values never lined up. Centered both, and gave the column
  `w-px whitespace-nowrap` so the table's auto-layout shrinks it to content
  width instead of stretching it with the row's leftover space (which also
  fixed IDs wrapping once centering was added). Reduced side padding
  (`px-4` → `px-2`) and added `shrink-0` to the chevron/spacer/id-text flex
  children so the column stays tight without wrapping.
- **Tab state moved to the URL** — Overview/My Tasks/Findings was local
  `useState`, so a refresh always bounced back to Overview. `tab` is now
  derived from the `?tab=` search param (`workspace`/`findings`/absent→
  `dashboard`), and `setTab` writes it via `setSearchParams(..., { replace:
  true })` (same pattern as `features/forms/FormListPage.tsx`). The
  module-switch reset effect no longer resets `tab` or depends on
  `searchParams` — it only clears filters on `typeId` change now, so it can't
  loop back and wipe `activeKpi`/`statusView` right after a KPI drill-through
  sets them via its own `setTab` call.

## Ticket escalation matrix UI — 2026-07-26

Front end for the escalation matrix (backend in `backend/changes.md`; design in
`docs/TICKETS-escalation-matrix-plan.md`). Assignee ownership, a per-department
config matrix, out-of-office scheduling, and a live notification feed. **Not
committed** — working tree only.

- **API clients** — `src/lib/api/escalation.ts` (rule CRUD hooks +
  `useThresholdNames`), `src/lib/api/notifications.ts` (`useNotifications` polling,
  mark-read/all + `toAppNotification` mapper), `src/lib/api/availability.ts`
  (OOO windows). Extended `src/lib/api/ticket.ts` — `assignee`/`escalationLevel`
  on `TicketSummary`, `useAssignTicket`, `assigneeId` list filter; and
  `DirectoryUser.isAvailable` in `features/admin/users/hooks.ts`.
- **Assignee on the ticket** — `features/tickets/detail/AssigneeCard.tsx`
  (assignee display + escalation-level badge + Assign/Reassign modal with an
  availability-aware people picker), mounted in `TicketSidebar.tsx` (gated on
  `canUpdate` from `TicketDetailPage.tsx`). `TicketsPage.tsx` gained an **Assignee**
  column with an `L{n}` escalation badge and an assignee filter dropdown.
- **Escalation matrix admin** — `features/admin/escalation/EscalationMatrixTab.tsx`:
  a global-default ladder editor + per-department overrides (each level = target
  MANAGER/DEPARTMENT_HEAD + a "when" trigger from the real SLA threshold names, or
  on breach). Flags departments with "· no head set". Registered as an **Escalation
  Matrix** tab in `pages/SettingsPage.tsx` (gated on `escalation.read`).
- **Out of Office (self-service)** — `features/profile/OutOfOfficePage.tsx` at
  `/out-of-office` (route in `App.tsx`, entry in the header user menu in
  `components/layout/Header.tsx`): schedule windows, pick a delegate, see how many
  tickets got reassigned on save.
- **Notifications wired live** — `components/layout/Header.tsx` now feeds the real
  `/api/notifications` into the store (removed the `MOCK_NOTIFICATIONS` stub) so the
  bell badge reflects real unread counts; `components/shared/NotificationPanel.tsx`
  persists reads to the backend and renders the new `ESCALATED` type;
  `stores/notificationStore.ts` union gained `ESCALATED`.
- **Department-head picker** (follow-up) — `features/admin/departments/DepartmentsTab.tsx`
  create/edit form gained a searchable **Head** select bound to `headUserId`,
  making `DEPARTMENT_HEAD` escalation configurable from the UI (was API-only).

## Audit Trail UI — global viewer, detail drawer, per-record history — 2026-07-24

Front end for the system-wide audit trail (backend in `backend/changes.md`). Not
committed. A trail nobody can read is not evidence, so this was pulled ahead of
the reason-for-change/e-signature phase.

- **API client** — `src/lib/api/auditTrail.ts`: `useAuditTrailList` (filtered +
  paginated), `useEntityHistory` (per-record), `useTrailFacets`, `useChainStatus`,
  and `downloadTrailCsv`.
- **Global viewer** — `src/features/admin/audit-trail/AuditTrailPage.tsx` at
  `/admin/audit-trail` (route in `App.tsx`, nav entry in
  `components/layout/Sidebar.tsx` under Compliance, gated on `audit_trail.read`).
  Filter bar (search, module, record type, action, criticality, user, date
  range), keyset pagination, an integrity-status banner, and CSV export (the
  export is itself audited).
- **Detail drawer** — `src/components/shared/AuditEntryDrawer.tsx`: click any row
  to see **everything** the entry holds, grouped What / Why / Who / When & where /
  Full record snapshot / Integrity — including IP, session, request id, full user
  agent, and the hash + prev-hash (with copy buttons). Empty fields are hidden
  rather than shown as dashes, so a `system` seed action shows no IP while a user
  LOGIN shows the full set.
- **Reusable history panel** — `src/components/shared/EntityAuditTrail.tsx`
  (`buildTrailColumns` shared with the viewer so the two never diverge), dropped
  onto the ticket (`features/tickets/TicketDetailPage.tsx`, History tab) and
  document (`features/dms/DocumentDetailPage.tsx`) detail pages.

### Table-layout iterations (from screenshot feedback)

- First pass overlapped: `whitespace-nowrap` timestamps ran under the next
  column and a 1200 px table overflowed a 942 px container. Fixed with sized
  columns + a two-line When cell.
- "Change" column duplicated "Record" and was empty on non-diff rows. Replaced
  with a **Details** column that summarises every action (field diff, "Signed in",
  "Password changed", the sign meaning, etc.) rather than repeating the record;
  pulled **Module** into its own column (populated for ~every row) to fill the
  space; middle-ellipsis on system keys (`wf_type.7ce2…read`) so the action
  suffix stays readable.
- Details ended up isolated at the far right because Record had no width and
  absorbed all slack on wide screens. Gave **every** column an explicit width so
  the fixed layout spreads extra space proportionally — uniform columns, Record
  (~390) and Details (~366) balanced side by side.

`tsc --noEmit` clean; verified in-browser with Playwright at 1280/1600/1920
widths (drawer contents, no horizontal scroll, uniform columns); e2e 37 passed /
14 pre-existing failures.

## Ticket fix — stray/duplicate "Resume" button in the stage action bar — 2026-07-16

A **Resume** button showed on tickets that were **not** on hold, and when a ticket
*was* held it appeared twice (the stage action + the real Resume). Not committed.

Root cause: `Resume` is a seeded **UNHOLD-behaviour stage status** wired to **283
stage actions** — essentially every stage of every workflow (CAPA, Document
Management, Audit Management, …) — so `/allowed-actions` returns it alongside
`Hold` on virtually every stage (e.g. "Verify Audit Details" returns
`Approve/Forward:FORWARD, Return:RETURN, Reject:REJECT, Hold:HOLD, Resume:UNHOLD`).
The action bar rendered it unconditionally, next to the separate `isOnHold`-gated
Resume button. That UNHOLD action is also **dead code**: the engine rejects every
action while a ticket is held (`orchestrator.ts` `performAction` →
"Ticket is on hold; resume before transitioning"), so it could only ever render
when unholding is meaningless. `POST /tickets/:id/resume` is the only working path.

- **`src/features/tickets/detail/ActionBar.tsx`** — filter `behavior !== 'UNHOLD'`
  out of each stage's actions before rendering, leaving the dedicated
  `isOnHold`-gated Resume as the single source of truth. The stage `map` callback
  now has a body (returns the row) so the filtered list can be computed per stage,
  and the "No actions configured" placeholder is suppressed while on hold (the
  Resume button is the action in that state).
- Verified in the running app with Playwright: on three not-on-hold tickets across
  the Audit / Document / Inspection workflows → **0** Resume buttons (was ≥1); on a
  held ticket with an active stage → **exactly 1**. The ticket was returned to
  not-on-hold afterwards. `tsc --noEmit` clean.

## Playwright coverage for terminal rejection — and two bugs it caught — 2026-07-20

Browser-driven regression suite for the change below, run against the real dev
stack. `tests/ui/rejected-status.spec.ts` + `rejected-status.config.ts` (both
gitignored with the rest of `tests/`). 4 tests, all passing:

    npx playwright test --config tests/ui/rejected-status.config.ts

Needs backend :4000 and client :5173 already running — unlike the other
`tests/ui` configs it does not spawn a `webServer`, because it needs auth, the DB
and live transitions. It raises a Document Management ticket over the API, walks
it FORWARD one stage, then REJECTs it mid-flow, so the graph has one stage behind
it, one it stopped on, and four it never reached — the shape that makes
"everything is green" visibly wrong. Every seeded workflow gates transitions on
required stage forms (including REJECT), so the helper submits them first.

**Two real bugs surfaced that type-checking and reading had missed:**

1. **The sidebar's Key Dates still said "Completed", in green, on a rejected
   ticket.** `TicketSidebar` renders a `completedAt` row, and rejection sets
   `completedAt` too. Now shows **Rejected** with `rejectedAt` in red.
2. **The rejection-point heuristic marked too many stages red.** The first
   version matched tracking rows sharing the latest `exitedAt`; the second
   widened that to a 5s burst (because `closeStageTracking` stamps its own `now`
   per stage, so parallel branches land milliseconds apart). Both were wrong —
   in the test the FORWARD exit was only 72ms before the rejection, so *both*
   stages rendered as the stop point. Replaced with a structural rule: **a stage
   left by moving on has a successor entered at or after its exit; the stage(s)
   the ticket stopped on have nothing entered after them.** That is timestamp-
   window-free, handles parallel branches, and also covers approval-driven
   rejection, where no REJECT-behaviour action is recorded on the tracking row.

Verified visually as well as by assertion: the stage band renders Draft Creation
green (worked through), Technical Review red (rejected here) and the remaining
four grey (never reached); the list KPI strip reads Completed 0 / Rejected 20
where it previously counted all 20 rejections as completions.

Two smaller notes from writing the suite:

- The list-view test filters by typing into the search box rather than by
  navigating to `/tickets?search=<id>` — `TicketsPage` doesn't read a `search`
  URL param, so the param form silently returned the unfiltered list and the
  assertion only passed because the new ticket happened to sort onto page one.
  Worth knowing if deep-linking a filtered ticket list is ever wanted.
- Also verified in passing that the backend contract the UI relies on holds:
  `POST /tickets/:id/transition` on a REJECT action returns
  `status: 'rejected'`, `isCompleted: true`, and the detail response carries
  `isRejected: true` with `rejectedAt` and zero `currentStages`.

**Note:** the probe/e2e runs left ~20 throwaway `DOC-FQS-*` tickets in the
`kaizen_qms2` dev database ("E2E reject-status …" / "Reject UI probe …"). Harmless
but worth deleting if the ticket list matters for a demo.

## Rejected tickets no longer read "Completed" — 2026-07-20

Follow-up to the terminal-reject change below. That change taught only
`TicketStatusBadge` and `TicketHeaderCard` about `isRejected`; ~20 other call
sites still asked `isCompleted` alone. Because terminal rejection works by
clearing the flow's current stages — the same signal a successful finish uses —
**every rejected flow is also `isCompleted`**, so all of those sites labelled
rejected tickets "Completed". Backend was correct throughout; this is entirely
client-side. Not committed. `tsc --noEmit` clean on client and backend; the
backend unit suite still passes 25/25.

**One shared derivation instead of twenty `if`s** — `src/lib/api/ticket.ts` gains
`ticketOutcome(ticket)` → `'no-flow' | 'rejected' | 'completed' | 'on-hold' |
'open'`, plus `isClosed` / `isCompletedSuccessfully` / `isRejected` and
`OUTCOME_LABEL`. Terminal states outrank `on-hold`: a hold placed before the flow
ended is stale once it has.

- **Status labels** — `TicketStatusBadge` now switches on `ticketOutcome`.
  `ModulePage` (row tint, stage chip, CSV export, status drill-through),
  `TicketsPage` (KPI strip, plus a new **Rejected** tile — grid widened to 5),
  `ModuleDashboard`, `CapaWorkflowBand`, `AuditRegisterDetailPage`, and the
  (currently unrendered) `StageStripBar` all distinguish rejected from completed.
- **Stage painting** — `StageTabs` and `TicketFlowCanvas` no longer blanket-mark
  every stage `done` when the flow is finished. On a rejected flow they take
  `visitedPersistedStageIds` + `rejectedAtPersistedStageIds` and render only
  visited stages green, the stop point red (new `rejected` StageStatus and a red
  `StageNode` theme), and never-reached stages as upcoming. `TicketDetailPage`
  derives both lists from `useTicketTrack`: visited = distinct tracking
  `stageId`s; the rejection point = the rows sharing the latest `exitedAt`, since
  terminal rejection closes every open stage in one instant.
- **Analytics semantics** — `components/analytics/metrics.ts` no longer exports
  the ambiguous `isCompleted`; removing it made the compiler enumerate all 11
  analytics modules so each had to pick. The rule applied:
  - *still on someone's plate?* → `isClosed`: `isOverdue`, `agingByCreation`,
    `dueDatePosture`, `avgOpenAge`, `onTimeClosureRate`, `avgCycleDays`, and
    every `open` / backlog filter in the module analytics.
  - *did we succeed?* → `isCompletedSuccessfully`: `closureRate`, the Completed
    slice of `statusSlices`, `stageCounts`, and the completed counts in CAPA /
    Document Approval / Inspection / Maintenance (incl. Maintenance MTTR — a
    rejected work order was never repaired).
  - `openClosedTrend` gains a `rejected` series kept out of `completed` but
    subtracted from the running open balance, so the "open" line still drains.
  - `ticketStatus` / `statusSlices` / `ModuleDashboard` gain a Rejected bucket.
  - `SupplierQualityAnalytics.isDisqualified` deliberately uses `isClosed`,
    preserving its existing behaviour exactly rather than reinterpreting that
    module's unusual "completed ⇒ disqualified" rule.
- `CapaWorkflowBand`'s refetch signature now includes `isRejected`, so rejecting
  a CAPA's ticket refreshes the CAPA.
- The new array props default to a module-level `EMPTY_IDS` constant rather than
  a `[]` literal. A fresh literal per render would change identity every render,
  invalidating the `useMemo` that runs `layoutGraph` — i.e. re-laying out the
  whole graph on every render of the canvas and the stage band.

**Not covered:** no client test runner exists, so all of this is verified by
type-check and reading only. A successfully completed flow still paints every
stage green (unchanged behaviour) — with `visitedPersistedStageIds` now plumbed
through, narrowing that to visited stages is a small follow-up.

## Terminal reject — ticket shows "Rejected" and locks — 2026-07-16

Frontend companion to the backend "reject is now terminal" change
(`backend/changes.md`). A rejected flow comes back `isCompleted: true` +
`isRejected: true` with no current stages, so the action bar and stage forms
already lock automatically; these changes surface the distinct **Rejected**
status. Not committed. `tsc --noEmit` clean.

- **`src/lib/api/ticket.ts`** — `TicketFlowSummary` gains `isRejected`; detail flow
  gains `rejectedAt`; `TransitionResult.status` adds `'rejected'`.
- **`src/features/tickets/shared/TicketStatusBadge.tsx`** — new **Rejected** badge
  (`danger` variant, `XCircle`), checked before `isCompleted` so a rejected flow
  reads "Rejected" not "Completed".
- **`src/features/tickets/detail/TicketHeaderCard.tsx`** — stage label shows
  "Rejected" and the header icon turns red when `flow.isRejected`.
- **`src/features/tickets/detail/ActionBar.tsx`** — transition toast handles
  `status === 'rejected'` → "Ticket rejected".
- **`src/features/tickets/detail/ApprovalDecideModal.tsx`** — reject toast now
  "Rejected — ticket closed" (was "ticket stays in this stage").
- **`src/lib/api/approval.ts`** — `useDecideApproval` also invalidates `['tickets']`
  so a rejection via the approval modal refreshes ticket status/actions/forms.

## Workflow builder — required type + mandatory per-action approval policies — 2026-07-16

Three related tweaks to workflow creation and the stage builder. Not committed.
`tsc --noEmit` clean.

- **Workflow type is now required.** `src/features/workflows/shared/CreateWorkflowModal.tsx`
  — the **Type** field lost its "(optional)" label (now a red `*`), the Create button
  is disabled until a type is picked, `handleSubmit` guards with a `Type is required`
  toast and sends `typeId` directly (was `typeId || null`), and the placeholder reads
  "— Select a type —".
- **Approver roles/users are shared across all actions on a stage.**
  `src/features/workflows/builder/inspector/StageInspector.tsx` — `upsertApprovalPolicy`
  now propagates a saved policy's `approverRoleIds`/`approverUserIds` to **every** action
  on the stage: actions without a policy get one cloned from the saved one; actions that
  already have a policy keep their own mode/flags but inherit the shared approver set.
  Removing a policy stays local to its action. Added an italic hint under the Approvals
  list explaining the shared behavior.
- **Publish is blocked when any action lacks a policy.**
  `src/features/workflows/builder/WorkflowBuilderPage.tsx` — new
  `collectMissingPolicyErrors(nodes)` walks every stage node and flags each primary/
  secondary action with no matching entry in `data.approvalPolicies`. `handlePublish`
  runs it **before** the confirm modal; on failure it populates the existing
  `ValidationErrorPanel` and toasts `N action(s) missing an approval policy` instead of
  publishing. Client-side guard only — no backend enforcement added.

## Sidebar fix — Master Data no longer stays highlighted across Configuration — 2026-07-16

Not committed.

- **`src/components/layout/Sidebar.tsx`** — the Configuration accordion's **Master
  Data** child pointed at bare `/settings`, while its siblings **Workflows** /
  **Forms** use `/settings?section=…`. In `isItemActive`, the "loose match" branch
  (`location.pathname.startsWith(item.path)` for query-less paths) fired for
  `/settings` on every `/settings*` URL, so Master Data stayed highlighted while on
  the Workflows and Forms sub-sections. Changed Master Data's path to
  `/settings?section=master-data` so it exact-matches only its own section
  (`SettingsPage` already treats any non-workflows/forms section as master-data, so
  the rendered view is unchanged). Now each Configuration child highlights only on
  its own section.

## Phase 6 follow-ups — stage-scoped Raise button + child nesting in the list — 2026-07-16

Two fixes from testing the raise-child feature. Not committed.

- **Raise button now follows the viewed stage.** `src/features/tickets/detail/ActionBar.tsx`
  gained a `selectedStageCanonicalId` prop (passed from `TicketDetailPage`); the
  "Raise <workflow>" buttons render only when the stage selected in the flow band
  matches the trigger's stage (or nothing is explicitly selected = current stage).
  Before, the button stayed visible while clicking through other stages in the
  band. Verified: on a Change Control ticket at Impact Assessment the button shows;
  selecting **Change Initiation** hides it; selecting **Impact Assessment** brings
  it back.
- **Child tickets now nest in the module list.** `src/features/modules/ModulePage.tsx`
  `TicketTable` rows with `childCount > 0` show an expander chevron in the ID cell;
  expanding renders the direct children (lazily via `useTicketChildren`) as indented
  rows directly under the parent — even when the child is a different workflow type
  (e.g. a CAPA under a Change Control ticket, which isn't in the module's own list).
  `TicketSummary` gained `childCount` (backend companion). Verified: expanding
  CC-FQS-047 reveals CAPA-FQS-084 nested below it. `tsc --noEmit` clean.

## Findings Phase 6 — per-stage "raise child ticket" — frontend — 2026-07-16

Configure allowed child workflows on a stage in the builder; the ticket's stage
view then shows a "Raise <workflow>" button that spawns a nested child (backend
companion in `backend/changes.md`). Verified end-to-end via Playwright + API on
local `kaizen_qms2`. Not committed.

- **`src/features/workflows/builder/builder.types.ts`** — new `EmbeddedChildTrigger`
  interface + `childTriggers?` on `StageNodeData`.
- **`src/features/workflows/builder/builder.serializer.ts`** — pass `childTriggers`
  through both ways (deserialize onto the node; serialize into the save payload,
  stripping the display-only `childWorkflowName`).
- **`src/features/workflows/builder/inspector/ChildTriggerEditor.tsx` (new)** —
  modal to allow a child workflow on a stage (workflow picker via
  `useWorkflowDirectory`, + Allow-multiple / Blocking toggles). No POST — writes to
  `node.data.childTriggers`, materialised on Publish.
- **`src/features/workflows/builder/inspector/StageInspector.tsx`** — new
  **"Child tickets"** section (list + add/edit/remove) mounting the editor,
  mirroring the Forms section.
- **`src/lib/api/workflow.ts`** — `BuilderNode.data.childTriggers` typed for the
  round-trip.
- **`src/lib/api/ticket.ts`** — `StageChildTrigger`/`SpawnChildInput` types,
  `ticketKeys.childTriggers`, `useStageChildTriggers(id)` query, `useSpawnChild(id)`
  mutation (invalidates detail + child-triggers + sidebar `['ticket-children']`).
- **`src/features/tickets/detail/ActionBar.tsx`** — per current-stage row now
  renders a **"Raise <workflow>"** button for each configured trigger (disabled +
  "Already raised" when the allowMultiple gate is hit); clicking opens a title/
  description modal → spawn-child → navigates to the new child (which nests in the
  sidebar CHILD RECORDS).

**Verified (Playwright):** on a fresh Inspection ticket at "Inspection Request",
the **Raise CAPA Management** button appears in Stage Actions; raising it creates
the CAPA and it shows under CHILD RECORDS; the builder stage inspector shows the
"Child tickets" section. `tsc --noEmit` clean.

## Generic findings → child tickets (CAPA / Deviation) — frontend — 2026-07-16

Surfaces the generic findings feature (backend companion in `backend/changes.md`)
in the UI: a **Findings** tab on tickets of `supportsFindings` types, a
**Findings register** per module, and **child records** nested under the parent
ticket. Findings auto-generate from checklist dispositions; from one you raise a
CAPA/Deviation child. Verified end-to-end via Playwright on local `kaizen_qms2`
(login `admin@forgequantum.com`). Not committed.

- **`src/lib/api/finding.ts` (new)** — React Query hooks: `useTicketFindings`,
  `useFindingsRegister`, `useFindingChildren`, `useCreateFinding`,
  `useUpdateFinding`, `useDeleteFinding`, `useRaiseChild`, `useTicketChildren` +
  `Finding`/`FindingSeverity`/`FindingStatus` types.
- **`src/features/tickets/detail/FindingsTab.tsx` (new)** — `DataTable` of a
  ticket's findings (severity/status/source badges; "Checklist" vs "Manual"
  origin) + `FindingDrawer` (manual add/edit fallback) + `RaiseChildDrawer`
  (raise CAPA/Deviation → routes to the created record). Delete via shared
  `useConfirmDelete`.
- **`src/features/modules/ModuleFindingsRegister.tsx` (new)** — module-wide
  findings register (severity/status filters, source-ticket + department columns,
  server pagination).
- **`src/features/tickets/detail/TicketSidebar.tsx`** — new **CHILD RECORDS** list
  in the Linked Records card (via `useTicketChildren`) — CAPAs/Deviations raised
  from this ticket's findings, one level deep.
- **`src/features/tickets/TicketDetailPage.tsx`** — Findings tab wired in
  (see per-type gating below).
- **`src/features/modules/ModulePage.tsx`** — Findings tab + register wired in
  (per-type gated).
- **`src/lib/api/workflowLookups.ts`** — `WorkflowType` gains `supportsFindings`.
- **`src/hooks/useCountdown.ts` (bug fix, found during this work)** — a
  *"Maximum update depth exceeded"* infinite render loop on ticket-detail pages
  with an active SLA: the effect dep array held a fresh `Date` each render.
  Changed deps to `[deadlineMs]` and rebuild the `Date` inside the effect.

**Verified (Playwright):** Findings tab shows the 2 auto-generated findings on
`INS-FQS-051`; "Raise" → CAPA drawer → `CAPA-2026-0009` created; back on the
ticket the sidebar shows **CHILD RECORDS (1)**; module **Findings** register lists
all findings. Note: the workflow-types lookup is cached in `localStorage`, so an
open tab needs a hard refresh to pick up the new `supportsFindings` flag.
`tsc --noEmit` clean.

## Findings access control — per-workflow-type rows in the matrix — 2026-07-16

Findings permission went from one global switch to **per-workflow-type** (backend
companion in `backend/changes.md`). The Access Control matrix now shows a
**Findings** row nested under each supporting module (Inspection, Change Control,
Deviation, Supplier Quality), granted independently of ticket access. Not committed.

- **`src/lib/navAccess.ts`** — added `findingTypeEntity` + `findingType{Read,
  Create,Update,Delete}Key` helpers. `workflowTypeModule(type)` now takes
  `supportsFindings` and, when true, appends a second **"Findings"** tab (entity
  `finding.<id>`, gate `finding.<id>.read`) beside "Workflow Tickets". (Reverted
  the interim single global "Findings" nav group.)
- **`src/features/admin/access-control/AccessControlTab.tsx`** — no change needed:
  `useWorkflowTypeModules` already passes the full type object, so `supportsFindings`
  flows through and the extra row renders per module.
- **`src/features/tickets/TicketDetailPage.tsx`** — Findings tab now shows only
  when `supportsFindings && hasPermission(finding.<typeId>.read)`; Add/Raise gated
  on `finding.<typeId>.create` (was the global `finding.create`).
- **`src/features/modules/ModulePage.tsx`** — module Findings tab + register gated
  on `finding.<typeId>.read`.

**Verified (Playwright):** Access Control → Master Data → search "finding" shows a
**Findings** row under all four modules (each with Read/Create/Update/Delete);
ticket Findings tab still renders for the admin. `tsc --noEmit` clean.

## LIMS Configuration table consistency — 2026-07-14

Layout/visual cleanup across the LIMS Configuration list tables so they read as
one family: fix a wrapping cell, standardize the "active" flag, and kill the big
empty gaps from unbounded flex columns. Verified page-by-page with Playwright
(local `kaizen_qms`, login `admin@forgequantum.com`).

- **`src/features/lims/EquipmentListPage.tsx`** — the **Lab** column (`width: 140`)
  wrapped names like "Central QC Laboratory" onto 2–3 lines. Widened to `190` +
  `ellipsis: true`. `Name` also bounded (`width: 240`) — see gap fix.
- **`src/components/ui/Badge.tsx` + `index.ts`** — new `ActiveBadge({ active })`:
  a dotted `success`/`default` `Badge` (green **Active** / muted **Inactive**)
  that matches the existing `StatusBadge`. Master-data tables showed the boolean
  `is_active` as plain **"Yes"/"No"** text — inconsistent with the lifecycle
  badges. Swapped `(v ? 'Yes' : 'No')` → `<ActiveBadge active={v} />` (col
  `width: 90`) in `AnalytesPage`, `CustomersPage`, `LabRegistryPage`,
  `MethodsPage`, `ProductsPage`, `SamplingPointsPage`, `StorageLocationsPage`,
  `SuppliersPage`, `UnitsPage`.
- **Column-gap fix** — each sparse table had one column with **no `width`**
  (usually `Name`) that swallowed all leftover space → one big mid-table gap.
  Gave the descriptive column(s) an explicit `width` so AntD distributes leftover
  **proportionally across all columns** (full width, even spacing): `UnitsPage`,
  `AnalytesPage`, `CustomersPage`, `MethodsPage`, `ProductsPage`, `SuppliersPage`
  (Name 240); `SamplingPointsPage` (Name 220 / Description 260);
  `StorageLocationsPage` (Name 220 / Location 200); `CertificationsPage`
  (Number 160 / Lab 220); `TestDefinitionsPage` (Name 320, Technique 200,
  Analytes 120); `SpecListPage` (Product 300; `Pharmacopoeia` 120 → 140, which
  also stopped its header wrapping).
- **`LabRegistryPage` — intentionally NOT bounded.** Bounding its columns pushed
  the dense 8-col table past the container and clipped the actions column (no
  horizontal scroll); reverted. `SpecVersionsPage` left as-is (already balanced).
- **`src/features/lims/TestPanelsPage.tsx`** — was only `Code | Name | Tests`
  (looked bare). Added a **Description** column (280) and an **Active** column
  (`is_active` via `ActiveBadge` — the only config table missing it); bounded
  `Name` (260). Now `Code | Name | Description | Tests | Active`.

Trade-offs: bounded widths mean long values ellipsize with a hover tooltip;
Test Definitions has only 5 columns so it keeps some even inter-column spacing on
wide screens.

`tsc --noEmit` clean (client). Not committed.

## Modal portals to `document.body` — 2026-07-12

The shared `Modal` used `position: fixed` but rendered in-place in the React tree.
Inside the workflow builder's inspector (an `overflow-hidden` panel nested under
transformed ancestors), a `fixed` child resolves against the transformed ancestor,
not the viewport — so the "Attach form" / "Edit form access" modal was trapped and
crushed inside the narrow inspector column.

- **`src/components/ui/Modal.tsx`** — wrapped the dialog in `createPortal(…,
  document.body)`. It now escapes every `transform`/`overflow` ancestor and centers
  on the full viewport. Fixes the builder form-binding editor and any other modal
  mounted inside a transformed/clipped subtree. Behaviour is otherwise unchanged
  (React context and events still flow through the React tree).
- **`StageFormBindingEditor.tsx` / `ApprovalPolicyEditor.tsx`** — both inspector
  modals bumped from the default `md` to `size="lg"` (max-w-2xl) for breathing room.
- **`src/index.css`** — added `* { scrollbar-width: thin; scrollbar-color: … }`.
  The "thin, clean" scrollbar was only styled for WebKit (`::-webkit-scrollbar`);
  Firefox fell back to the chunky OS bar. Now both are slim app-wide.

`tsc --noEmit` clean (client). Not committed.

## Stale `ticket.*` fallback cleanup — 2026-07-12

Dead code left over from the per-module ticket master retirement (the global
`ticket.*` keys were removed from the catalog, so these always resolved false).

- **`src/features/modules/ModulePage.tsx`** — `canForType` dropped the
  `|| hasPermission('ticket.<action>')` OR-bridge; now strictly
  `wf_type.<typeId>.<action>`.
- **`backend/src/modules/stage-form/stage-form.service.ts`** — corrected a stale
  doc comment ("`ticket.read` is enforced…") to name the per-type
  `wf_type.<typeId>.read` via `requireTicketAction('read')`.

`tsc --noEmit` clean (client). Not committed.

## Workflow site-ownership (frontend, Phase E) — 2026-07-12

Frontend for workflow site-ownership (backend: `backend/changes.md`; plan:
`docs/workflow-site-ownership-plan.md`). Workflows now belong to a site (or are
global); the create flow, list, and builder role/user pickers reflect it. Working
tree only.

- **`src/lib/api/workflow.ts`** — new `SiteRef`; `site: SiteRef | null` added to
  `WorkflowSummary`, `WorkflowDetailResponse.workflow`, `WorkflowDirectoryEntry`,
  and the create-mutation return; `siteId?: string | null` added to the create
  input (only honoured for `site.view_all`).
- **`src/features/admin/users/hooks.ts`** — `useUserDirectory(siteId?)`: optional
  `siteId` query param (keyed into the query). **`src/features/admin/roles/hooks.ts`**
  — `useRoleDirectory(siteId?)` likewise. Both stay backward-compatible (no arg =
  caller's own site).
- **`src/features/workflows/shared/CreateWorkflowModal.tsx`** — Super Admin
  (`site.view_all`) gets a **Site** picker (Global / a specific site from
  `allowedSites`); sends `siteId` only then. Scoped users see no picker (server
  forces their own site).
- **`src/features/workflows/WorkflowsPage.tsx`** — each card shows a **Global**
  (blue) or **site-code** (grey) chip with an explanatory tooltip.
- **Builder role/user pickers now site-scoped.** `ApprovalPolicyEditor.tsx`
  (approver roles/users) and `StageFormBindingEditor.tsx` (fill/view roles+users)
  switched from the admin `useRoles`/`useAdminUsers` (server-search) to the
  site-scoped `useRoleDirectory(siteId)`/`useUserDirectory(siteId)` with client-side
  `optionFilterProp="label"` search. The workflow's `siteId` is threaded
  `WorkflowBuilderPage → InspectorPanel → StageInspector →` both editors (new
  `workflowSiteId` prop at each level). Global workflow (null) → all sites.

**Verified:** `tsc --noEmit` clean; backend contracts these consume verified live
(create with `siteId`, `?siteId=` on both directories). Not committed.

## Per-module ticket master (frontend) — 2026-07-12

Access Control matrix changes supporting the retirement of the global ticket
master (backend + overall plan: repo-root `changes.md` top section and
`docs/per-module-ticket-master-plan.md`). Working tree only.

- **`src/features/admin/access-control/AccessMatrix.tsx`** — new optional
  `extraTabsByModule?: Record<string, NavTabAccess[]>` prop; the group builder
  merges those tabs into the matching existing module (used to fold the Audit
  ticket keys into the Audit module instead of a duplicate "Audit" group).
- **`src/features/admin/access-control/AccessControlTab.tsx`** — new
  `useAuditTicketTabs()` hook resolves the live Audit workflow-type id and emits a
  **"Workflow Tickets"** row (`entity = wf_type.<auditId>`) under the static
  `audit` module; passed as `extraTabsByModule` to the Role / Department / User
  matrices.

Verified via Playwright in the live app: for a role holding the ticket master,
the Audit "Workflow Tickets" row + per-type modules show read/create/update
checked (delete off) — matching the role's grants. `tsc --noEmit` clean.

**Follow-up fix (same day):** every generated per-type module's single row was
labeled with the type's name again (e.g. module "CAPA" → row "CAPA"), reading
as a duplicate of the module header. `src/lib/navAccess.ts`'s
`workflowTypeModule()` now labels that row **"Workflow Tickets"** — matching
Audit's row — for every type. Verified via Playwright across all 6 live
workflow-type modules (Audit, CAPA, Document Review, gdgdgdg, teest, testing
workflow): no module's row duplicates its own header anymore.

## Per-module ticket master — Phase 4 (frontend) — 2026-07-12

Completes the frontend side of the master's retirement (backend: `backend/changes.md`;
overall plan: `docs/per-module-ticket-master-plan.md`). Working tree only.

- **`src/lib/navAccess.ts`** — deleted the `workflow-tickets-master` module
  block ("All Workflow Types (ticket master)"). Added `wfTypeCreateKey` /
  `wfTypeUpdateKey` / `wfTypeDeleteKey` / `wfTypeTransitionKey` next to the
  existing `wfTypeReadKey`.
- **`src/components/layout/Sidebar.tsx`** — both workflow-type nav entries
  (the generic per-type modules and "Document Approval") switched from
  `anyPermission: [wfTypeReadKey(id), "ticket.read"]` to a plain `permission:
  wfTypeReadKey(id)` — visibility is strictly the per-type read key now.
- **`src/features/audit/AuditModuleLayout.tsx`** — "My Tasks" moved out of the
  static tab list; now resolves the Audit workflow type via `useWorkflowTypes()`
  and gates on `wfTypeReadKey(auditTypeId)` (empty key, i.e. hidden, until the
  type loads).
- **`src/features/audit/capa/CapaWorkflowBand.tsx`** — the transition-button
  gate switched from `useHasPermission('ticket.transition')` to
  `useHasPermission(ticketTypeId ? wfTypeTransitionKey(ticketTypeId) : '')`,
  reading the ticket's own `flows[0].workflow.typeId`.
- **`src/features/tickets/TicketsPage.tsx`** — `canCreate`/`canDelete` (button
  visibility only — the API always enforced per-type) now use a new
  `useHasAnyPermissionMatching(predicate)` selector (added to
  `src/stores/authStore.ts`), checking for any held key matching
  `/^wf_type\.[^.]+\.(create|delete)$/` — there's no single master key to check
  against anymore.

**Verified:** full Playwright pass (9/9, see `backend/changes.md` for the full
list) — the master module is gone from the Access Control matrix; no row with
bare entity `ticket` remains anywhere; CAPA/Audit per-type rows for
QUALITY_ENGINEER are unchanged (regression check); SUPER_ADMIN's "Raise
Ticket" button is visible; DOCUMENT_CONTROLLER's (read+transition only, no
create grant on any type) is hidden. `tsc --noEmit` clean.

---

Summary of changes made across all six Quantum frontends in this session.

## Objective

1. Disable the landing page on every project and make the login page the default view at `/`.
2. Redesign every project's login page to match Quantum Kairoz's login design (dark split-screen, glassmorphic card, gold `#b07d1a`, Cormorant Garamond + DM Sans + DM Mono fonts, pulsing "System Online" status, gold-bordered feature pills, uppercase sign-in button).

Each project keeps its own brand name, logo (where available), and domain-specific feature pills.

---

## 1. Quantum Kairoz (reference — route swap only)

Folder: `Quantum-Kairoz-main/frontend/`

- **`src/App.tsx`**
  - Commented out `LandingPage` import.
  - Commented out `<Route path="/" element={<LandingPage />} />`.
  - Added `<Route path="/" element={<LoginPage />} />` so `/` serves the login.
  - `/login` route untouched.
  - `/*` fallback still redirects to `/` (which is now login).

No visual design changes — Kairoz is the reference.

---

## 2. Quantum Eyewall (route swap + login redesign)

Folder: `quantumeyewall-main/quantum-eyewall/frontend/`

- **`src/App.jsx`**
  - Commented out `Landing` import.
  - Commented `<Route path="/" element={<Landing />} />`; added `<Route path="/" element={<Login />} />`.

- **`src/pages/Login.jsx`** — rewritten to match Kairoz structure:
  - Split-screen layout with left brand panel + right floating glass card.
  - Lucide icons (`Mail`, `Lock`, `Eye`, `EyeOff`, `AlertCircle`).
  - Brand name "Quantum EyeWall" preserved; domain pills = `Visitor Sessions, Camera Control, Gate Terminal, Session Logs, Real-time Dashboard`.
  - Eyebrow: "Admin Portal". Headline: "Secure Access. / Intelligent Control."
  - Preserves existing `useAuth()` hook, `isAuthenticated` redirect, and error handling.

- **`src/pages/Login.css`** — new file, clone of Kairoz's `LoginPage.css`. Initially used an Eyewall-themed CSS-gradient background; superseded by a real image (see below).

- **Background image added**: `src/assets/security-bg.jpg` — a dark server-room / network-cabling shot (1920×1077, ~455 KB, downloaded from Unsplash). Wired via a bundled `import securityBg from '../assets/security-bg.jpg'` and applied as `style={{ backgroundImage: `url(${securityBg})` }}`. The CSS-gradient override class was removed so the image shows through under Kairoz's standard dark `105deg` overlay.

- **`index.html`** — added Cormorant Garamond, DM Sans, DM Mono Google Fonts alongside existing Playfair/IBM Plex Sans/JetBrains Mono.

---

## 3. Quantum Invenza (route swap + login redesign)

Folder: `Quantuminvenza-main/frontend/`

- **`src/router/AppRouter.tsx`**
  - Commented out lazy `LandingPage` import.
  - Commented `<Route path="/" element={<LandingPage />} />`; added `<Route path="/" element={<LoginPage />} />`.

- **`src/pages/Auth/LoginPage.tsx`** — rewritten to match Kairoz structure:
  - Uses existing `/Warehouse.jpg` from `public/` as the background image.
  - Shows existing `/logo3.png` as the card logo.
  - Brand name "Quantum Invenza" preserved; domain pills = `GRN Tracking, Cold Chain, QA Management, Dispatch, AI Analytics`.
  - Eyebrow: "Warehouse Management System". Headline: "Smart Inventory. / Seamless Control."
  - Lucide icons (`lucide-react` already installed).
  - Preserves existing mock-auth logic, `useAuthStore().login(user, token)` signature, and `react-hot-toast` integration. Added an inline error banner in addition to toasts.

- **`src/pages/Auth/LoginPage.css`** — new file cloned from Kairoz's `LoginPage.css`.

- **`index.html`** — no change needed (Cormorant Garamond, DM Sans, DM Mono were already loaded).

---

## 4. Quantum Kaizen (route swap + login redesign + copy correction)

Folder: `quantumkaizen-main/client/`

- **`src/App.tsx`**
  - Commented out `LandingPage` import.
  - Commented `<Route path="/" element={<LandingPage />} />`; added `<Route path="/" element={<LoginPage />} />`.

- **`src/pages/LoginPage.tsx`** — rewritten to match Kairoz structure. After user corrections, copy was finalized as an Enterprise QMS platform (not lab management):
  - Eyebrow: "Enterprise Quality Management".
  - Headline: "Uncompromising Quality. / Continuous Improvement."
  - Description: framed around manufacturing & regulated industries with Document Control, CAPA, Risk, Training, Audits, 21 CFR Part 11 e-signatures.
  - Domain pills: `Document Control, CAPA, Risk Management, Training & LMS, Audits, 21 CFR Part 11`.
  - Card logo: **reused Kairoz's `golden_blue_logo.png`** (copied to `public/golden_blue_logo.png`), sized 340×160 with `brightness(1.3)` filter (same as Kairoz).
  - Background image: **`/factory-bg.jpg`** — a stainless-steel industrial piping photo (1920×1280, ~367 KB), downloaded from Unsplash, fitting a manufacturing/regulated-industries QMS theme.
  - Preserves React Hook Form + Zod validation, `useAuthStore.login(email, password, tenantCode)` signature, and the existing `AURORA-PH` tenant code.

- **`src/pages/LoginPage.css`** — new file cloned from Kairoz's `LoginPage.css`. Kaizen-specific CSS-gradient override was removed after the real factory image was added, so the background image now shows through under the same dark `105deg` gradient overlay.

- **`index.html`** — added Cormorant Garamond + DM Sans (DM Mono was already present). Also swapped the favicon from `favicon.svg` to `favicon.png` and added an `apple-touch-icon` link — matches the Kairoz favicon setup.

- **Assets added to `public/`:**
  - `golden_blue_logo.png` — copied from `Quantum-Kairoz-main/frontend/src/assets/`.
  - `factory-bg.jpg` — stainless-steel industrial piping photo.
  - `favicon.png` — copied from `Quantum-Kairoz-main/frontend/public/favicon.png` (shared gold "Quantum" brand mark, 37 KB). The old `favicon.svg` is left on disk, no longer referenced.

### Copy correction history (Kaizen)

Initial draft incorrectly labelled Kaizen as "Lab Management System" (re-used Kairoz copy). After user correction, rewritten twice to:
- Drop the lab-management framing.
- Remove `lab-bg.jpg` (wrong theme, briefly copied from Kairoz).
- Replace with manufacturing/QMS copy and the factory image.

---

## 5. Quantum Optimizer (route swap + login redesign)

Folder: `quantumoptimizer-main/client/`

- **`src/App.jsx`**
  - Commented out `LandingPage` import.
  - Commented `<Route path="/" element={<LandingPage />} />`; added `<Route path="/" element={<SignInPage />} />`.
  - `/signin` legacy route kept for any existing links.

- **`src/pages/SignInPage.jsx`** — rewritten to match Kairoz structure:
  - Split-screen layout with gold "Q" monogram logo mark in the card header (no logo asset available).
  - Brand name "Quantum Optimizer" preserved; domain pills = `Demand Forecasting, Scenario Planning, Supply Planning, Consensus, AI Analytics`.
  - Eyebrow: "Supply Chain Optimization". Headline: "Smarter Supply. / Optimised Control."
  - Inline Lucide-spec SVG icons (no `lucide-react` dependency — Optimizer doesn't have it installed, so icons are inlined as small SVG components to avoid adding a dep).
  - Preserves existing `authService.login()`, `setAuth(user, token)`, and `useToastStore` integrations; kept `ToastContainer` mount.

- **`src/pages/SignInPage.css`** — new file cloned from Kairoz's `LoginPage.css` with an Optimizer-themed CSS-gradient background (dark + gold grid, no image asset).

- **`index.html`** — added DM Mono + additional Cormorant Garamond weights (others were already loaded).

---

## 6. Quantum Vorvex (state-default flip + login redesign)

Folder: `quantumvorvex-main/client/`

Vorvex does not use React Router — its unauthenticated view was controlled by a local `page` state flag (`'landing' | 'login'`). The landing page was the default.

- **`src/App.jsx`**
  - Commented out `LandingPage` import.
  - Commented out the `page === 'landing'` branch that rendered `<LandingPage />`.
  - Removed the `[page, setPage]` state declaration (no longer used).
  - `<LoginPage />` now renders unconditionally for unauthenticated users, with no `onBack` prop needed.

- **`src/components/auth/LoginPage.jsx`** — rewritten to match Kairoz structure:
  - Split-screen layout with gold "Q" monogram logo mark in the card header.
  - Brand name "Quantum Vorvex" preserved; domain pills = `Check-In, Billing, Housekeeping, Reports, AI Insights`.
  - Eyebrow: "Hotel Management System". Headline: "Seamless Operations. / Intelligent Control."
  - Inline Lucide-spec SVG icons (no `lucide-react` dependency).
  - Preserves existing `authApi.login()` call and `useStore.login(token, user)` signature.
  - Demo account quick-fill chips (Owner / Manager / Staff) preserved and restyled as Kairoz-style bottom-of-card chips.
  - Forgot-password multi-step modal was removed in this pass (it's a separate feature surface; can be re-added as its own route later).

- **`src/components/auth/LoginPage.css`** — new file cloned from Kairoz's `LoginPage.css` with a Vorvex-themed CSS-gradient background (dark + warm gold "hotel ambience", no image asset). Includes `.login-demo-section` / `.login-demo-chip` styles for the demo buttons.

- **`index.html`** — added Cormorant Garamond, DM Sans, DM Mono alongside existing Playfair Display, Inter, Syne, JetBrains Mono.

---

## Design-token parity (all projects)

| Token | Value | Notes |
|---|---|---|
| Primary accent | `#b07d1a` (gold) | Hover: `#c9922a` |
| Status green | `#16A34A` | Pulsing dot, `System Online` |
| Error red | `#DC2626` | Inline error banner |
| Card background | `rgba(255,255,255,0.1)` + `backdrop-filter: blur(24px)` | Glassmorphism |
| Overlay | `linear-gradient(105deg, rgba(5,5,12,0.82) 0%, rgba(8,8,18,0.75) 45%, rgba(5,5,12,0.60) 100%)` | Over whatever bg image/gradient |
| Serif | Cormorant Garamond 700 | Headlines + card title |
| Sans | DM Sans 300/400/500/600 | Body + form |
| Mono | DM Mono 400/500 | Eyebrow, status label, footer |
| Card max-width | 520px | 420px on mobile |
| Breakpoint | 768px | Below: left brand panel hidden |

## Dependencies — no new ones installed

- **Already had `lucide-react`**: Kairoz, Eyewall, Invenza, Kaizen → used the real library.
- **No `lucide-react`**: Optimizer, Vorvex → used inline Lucide-shaped SVG components to avoid adding a dependency.

## Verification performed

- Every modified JS/TS/TSX/JSX/CSS file parses cleanly with `esbuild@0.23.1` (no syntax errors).
- All imported symbols confirmed to exist in their respective modules (`useAuth`, `useAuthStore`, `authService`, `authApi`, `ToastContainer`, etc.).
- All asset paths referenced (`/Warehouse.jpg`, `/logo3.png`, `/golden_blue_logo.png`, `/factory-bg.jpg`) confirmed to exist on disk.
- All three strict-TS projects have `noUnusedLocals: false` in their tsconfig, so commented-out landing imports won't raise errors.
- Full `npm run build` / `tsc --noEmit` was NOT run — none of the projects have `node_modules` installed locally.

## What was NOT changed

- Existing landing page components remain on disk (unreachable but preserved). Re-enable by uncommenting the import and route in each project's App/router file.
- No component outside of login was restyled — the broader dashboard/internal pages are unchanged.
- No dependency versions changed.
- No auth logic / API contract changed; only presentation + route default.

---

## Session 2 — Backend wiring + env cleanup (commit `d6f1405`)

Author: Abhishek Kumar — *"feat: update environment variables and add database check scripts; modify API base URL and service worker registration logic"*

### `backend/.env.example`
- Reworked the example env file: clarified comments and added the variables the new Express + Prisma stack reads at boot.

### `backend/scripts/check-db.mjs` (new)
- Quick connectivity probe: connects to the Postgres URL in `DATABASE_URL`, runs a trivial query, prints success / failure with a sane error message. Useful after bringing the stack up locally to confirm Prisma can reach the DB before running migrations.

### `backend/scripts/check-password.mjs` (new)
- One-off helper to verify a bcrypt hash against a plaintext password (e.g. when debugging seeded credentials). Reads the user's hash from the DB and `bcrypt.compare`s.

### `client/src/lib/api.ts` — base URL alignment
- Default `baseURL` changed from `/api/v1` → `/api`. The new backend mounts routes at `/api/*` (see `backend/src/app.ts`), so the v1 prefix no longer matches anything.
- Comment updated to reflect the new convention; cross-origin deploys should set `VITE_API_BASE_URL=https://…/api` (no `/v1`).
- The SPA-fallback detection comment was updated for the same reason.

### `client/src/main.tsx` — service-worker dev hygiene
- In production: same as before (`navigator.serviceWorker.register('/sw.js')`).
- In dev: actively *unregisters* any leftover SW from a prior prod build. The SW was intercepting Vite's `/src/*` and `/@vite/*` requests and serving cached `index.html` on misses, which broke HMR with a MIME-type error. Without this, devs had to manually clear site data after every prod→dev switch.

### `client/src/stores/authStore.ts` — login response shape
- Old code expected `response.data.data.{user, accessToken}` (a wrapped envelope from the previous backend).
- New backend returns `{ user, token }` directly in the response body. Code now reads `response.data.{user, token}` and stores `token` (not `accessToken`).
- Token key in `localStorage` (`qk_token`) is unchanged so existing sessions don't break.

### `client/vite.config.ts` — dev proxy port
- `/api` proxy target: `localhost:5000` → `localhost:4000`. The new Express backend defaults to port 4000.

### `package-lock.json`
- A single lockfile churn line (no real package change).

---

## Session 3 — Settings page tabs + login 401 handling

### `client/src/pages/SettingsPage.tsx` — sidebar → top tabs
- The settings page previously rendered a 192px-wide left rail (`w-48 shrink-0`) with five vertically stacked nav buttons (`General`, `Users & Roles`, `Workflows`, `Notifications`, `Security`) sitting beside the content. With the global app sidebar already on the left, this produced two stacked nav columns and squeezed the form/table area to roughly 870px on a 1440-wide viewport.
- Replaced that inner sidebar with a **horizontal tab bar** placed above the content:
  - Container: `border-b border-gray-200`, tabs in a `flex gap-1 overflow-x-auto -mb-px` row.
  - Tab style: `border-b-2 border-transparent` by default, `border-slate-900 text-slate-900` when active (underline indicator, no dark pill). Hover lifts to `text-gray-900` + light gray underline.
  - Each tab still shows its lucide icon (16px) next to the label.
  - Accessibility: added `role="tablist"`, `role="tab"`, and `aria-selected` on each tab.
- Content column lost its flex constraint, so forms and the users table now span ~1100px on a 1440-wide viewport.
- Verified with Playwright (login → /settings → screenshot before & after, then click "Users & Roles" → confirm `aria-selected="true"` follows the click). Screenshots in `scripts/scratch/snapshots/` (gitignored).

### `client/src/lib/api.ts` — don't redirect on login 401
- The 401 interceptor was redirecting to `/login` on every 401, including the 401 returned by `POST /auth/login` itself when credentials are wrong.
- Effect: bad-credential submits triggered a full-page reload to `/login`, wiping the form's error banner before the user could read it.
- Fix: detect login requests by URL (`error.config.url.includes('/auth/login')`) and skip the redirect for them, so the form can surface the auth error inline. Existing demo-token bypass and the redirect for *other* 401s are unchanged.

### `scripts/scratch/` (new, gitignored)
- One-off Playwright analysis script (`analyze-settings.mjs`) and its full-page screenshots (`snapshots/`) used to verify the settings tab redesign. Lives under `scripts/scratch/` to keep it separate from the real project scripts (`security-audit.sh`, `smoke-test.sh`, `validate-env.sh`).
- Added `scripts/scratch/` to `.gitignore` — these artifacts aren't needed past the one-off verification and shouldn't enter version control.

---

## Session 4 — Central page wrapper + reusable page header

**Goal:** unify the per-page chrome (outer container, side padding, heading typography) so every dashboard route looks consistent, and stop capping content at 1440px on wider monitors.

### Problem with the old layout

`AppLayout` rendered every route inside:
```tsx
<main className="flex-1 p-5 max-w-dashboard mx-auto w-full">
  <div className="page-enter"><Outlet /></div>
</main>
```
On a 1920-wide monitor that capped the content column at 1440px and centered it, leaving ~240px of empty surface on each side of the content (the visible "empty bands" the user was complaining about). Every page also re-implemented its own header (`<h1>` + description + actions on the right) with slightly different typography — `text-h1` on Settings vs `text-2xl font-bold` on AuditLog, etc.

### `client/src/components/layout/PageContainer.tsx` (new)
- Single, centralized wrapper for every dashboard route.
- `w-full px-6 lg:px-8 xl:px-10 py-6` — full width with responsive side padding (24 / 32 / 40 px) so content always fills the available column with breathing room from the screen edge, regardless of viewport.
- Owns the `page-enter` fade-in animation that used to live inline in `AppLayout`.
- Optional `className` prop so an individual page can extend or override (e.g. swap the vertical padding on a special-case full-bleed canvas).

### `client/src/components/layout/PageHeader.tsx` (new)
- Opt-in component for the standard "title + description + actions row" pattern. Pages compose it; nothing forces them.
- Props: `title` (string), `description` (optional `ReactNode`), `actions` (optional `ReactNode` slot for buttons), `className`.
- Uses the canonical design tokens from `tailwind.config.js`: `text-h1` (1.375rem / bold / -0.015em tracking) for the title, `text-body` (0.875rem) `text-gray-500` for the description.
- Layout: `flex items-start justify-between gap-4`, with `min-w-0` on the text column so long titles truncate cleanly and `shrink-0 flex items-center gap-2` on the actions slot so buttons hug the right edge.
- Pages with non-standard headers (icons inline with the title, decorated subtitles with separators, breadcrumbs, etc.) are free to skip `PageHeader` entirely — see DashboardPage below.

### `client/src/components/layout/AppLayout.tsx`
- Removed `max-w-dashboard mx-auto p-5` from `<main>`. Result: content fills the full available width inside the sidebar offset (1184px at 1440 viewport, 1664px at 1920 viewport) with no centered-with-empty-sides effect.
- Replaced `<div className="page-enter"><Outlet /></div>` with `<PageContainer><Outlet /></PageContainer>`. The `page-enter` animation now lives inside `PageContainer` so the behavior is identical, just centralized.
- `<main>` is now just `flex-1 w-full`. The wrapper owns the padding.

### `client/src/pages/SettingsPage.tsx` — migrated to `PageHeader`
- Old: bespoke `<div className="flex items-center justify-between"><div><h1 className="text-h1 …">Settings</h1><p className="text-body …">…</p></div><Button …>Save Changes</Button></div>`.
- New:
  ```tsx
  <PageHeader
    title="Settings"
    description="Manage your organization's configuration and preferences"
    actions={
      <Button variant="primary" onClick={handleSave}>
        {saved ? <Check size={15} /> : <Save size={15} />}
        {saved ? 'Saved!' : 'Save Changes'}
      </Button>
    }
  />
  ```
- Save button behavior (the `saved` toggle, icon swap, label flip) is preserved verbatim.

### `client/src/pages/AuditLogPage.tsx` — migrated to `PageHeader`
- Old: `<h1 className="text-2xl font-bold text-slate-900">Audit Trail</h1>` + `<p className="mt-1 text-sm text-slate-500">…</p>` + Export `<Button>`. The typography (`text-2xl`, `text-slate-500`) drifted from Settings's (`text-h1`, `text-gray-500`).
- New: same `<PageHeader …>` call shape as Settings — heading typography is now identical across the two pages.
- Side benefit: the description text style now matches the rest of the app (`text-body text-gray-500` instead of the one-off `text-sm text-slate-500`).

### `client/src/features/dashboard/DashboardPage.tsx` — intentionally NOT migrated
- The dashboard's header is custom: inline-styled `<h1>` at 26px / weight 800 (heavier than `text-h1`'s 22/700), and a description with dot separators (`Quality Management · GMP Compliance · Updated 22:11`) plus a date-range pill group on the right.
- These are deliberate visual differentiators for the executive landing page and don't fit the `title + description + actions` shape cleanly.
- Per the "PageHeader is opt-in" design, dashboard keeps its bespoke header. PageContainer still wraps it via `AppLayout`, so it benefits from the consistent outer padding and the dropped width cap.

### Verification
- Playwright (`scripts/scratch/analyze-pages.mjs`, gitignored) captures `/settings`, `/audit-log`, `/dashboard` at 1440 × 900 and 1920 × 1080. Metrics confirm:
  - 1440 viewport → main content = 1184px (= 1440 − 256 sidebar). ✓
  - 1920 viewport → main content = 1664px (= 1920 − 256 sidebar). Previously capped at 1184px with ~480px empty surface on the right.
  - `document.documentElement.scrollWidth === viewport.width` on every run → no horizontal overflow at any breakpoint.
- Visual check (screenshots in `scripts/scratch/snapshots/`):
  - `settings-1920.png`: form fields and the Organization Identity card stretch across the full width; Save button hugs the right edge.
  - `audit-1920.png`: filter row and table fill the available width; heading typography matches Settings.
  - `dashboard-1440.png`: KPI cards still flow correctly across the wider column; bespoke 26px heading is preserved.

### Knock-on cleanup deferred
- `client/src/pages/SettingsPage.tsx` still imports `Trash2`, `ChevronDown`, `Eye`, `EyeOff` from `lucide-react` — none are used after the tabs/header refactor (TS hint `6133`). Left in place this round; can be cleaned up in a follow-up.
- `tailwind.config.js` `maxWidth.dashboard` (`1440px`) now has zero consumers but was left in place to avoid touching tokens that other developers may still reference.

---

## Session 5 — Typography rebase to web-standard 16px + semantic scale

**Goal:** the UI was rendering noticeably small. Restore the web-standard 16px rem baseline, add a clear semantic font-size scale, and migrate inline-styled headings to the global tokens.

### Root cause

`client/src/index.css:35` had `html { font-size: 14px }`, which shrinks every Tailwind `rem`-based token by ~14% from its advertised value. Effective sizes were:
- `text-base` (1rem) → 14px (advertised 16px)
- `text-sm` (0.875rem) → 12.25px (advertised 14px)
- `text-xs` (0.75rem) → 10.5px (advertised 12px)

Bumping individual tokens without fixing this would just paper over the symptom. The codebase has 634 `text-xs` and 612 `text-sm` usages — the right move was to fix the rem base once and let everything snap to its proper size.

### `client/src/index.css` — rem baseline restored
- `html { font-size: 14px }` → `16px`. Single line. Auto-corrects all 1200+ `text-*` usages in one shot.

### `client/tailwind.config.js` — typography scale rewritten
- Reorganised the `fontSize` block into raw + semantic groups with px reference comments next to each token.
- **Raw** (Tailwind-style): `xxs` 11, `xs` 12, `sm` 14, `base` 16, `md` 16, `lg` 18.
  - Note: `lg` was 22px (custom override). Bringing it back to the standard 18px is a small breaking change for the few callers using `text-lg`, but matches the rest of the Tailwind ecosystem and removes the typography-drift trap. Old 22px callers should switch to `text-h1` if they wanted a heading.
- **Semantic — headings**: `display` 28 / 700, `h1` 24 / 700, `h2` 18 / 600, `h3` 16 / 600, `h4` 14 / 600 (new).
- **Semantic — body**: `body-lg` 16 (new), `body` 14, `body-md` 14 / 500 (medium weight), `body-sm` 13 (new), `caption` 12 (new).
- **Form labels**: `label` 12 / 500 / 0.06em tracking (unchanged token, larger effective size after rem fix).
- **Mono**: `mono-sm` 12, `mono-xs` 11 (unchanged tokens).
- Inline comment block in the config explains the system so future edits stay consistent.

### `client/src/features/dashboard/DashboardPage.tsx` — inline `<h1>` style dropped
- Old: `<h1 style={{ fontSize: '26px', fontWeight: 800, color: '#0D0E17', letterSpacing: '-0.025em', lineHeight: 1.1 }}>Executive Dashboard</h1>`. Hardcoded inline values that bypassed the design tokens.
- New: `<h1 className="text-h1 text-gray-900">Executive Dashboard</h1>`. Same visual hierarchy as Settings and AuditLog page titles, now driven by the global `h1` token (24px / 700 / -0.015em).
- Net effect: the dashboard heading is 2px smaller than before but is now consistent with every other page title and any future scale tweak applies uniformly.

### `client/src/components/layout/Header.tsx` — knock-on layout fix
After the rem bump, the sticky top header broke on routes with deep breadcrumbs (e.g. `/qms/suppliers/scorecards` → `Quality > Suppliers > Scorecards`). The three center pills wrapped their text inside their fixed 28px height, the language flag and user-name wrapped to two lines, and the FY year toggle was clipped.

Three coordinated changes fixed the layout:

1. **Pills no longer wrap**: each of the three center pills (`Expiry Alerts`, `Open CAPAs`, `GMP Compliant`) got `whitespace-nowrap shrink-0`. They now render single-line at their natural width, regardless of how much horizontal space the section receives.
2. **Pills section won't expand or collapse**: the center container changed from `hidden md:flex flex-1 justify-center` to `hidden xl:flex justify-center min-w-0 shrink-0`. It only shows at ≥1280px (where there's room for both deep breadcrumbs and pills) and takes its natural width when shown — neither growing nor shrinking. (Below 1280, pills are hidden; the route-level alerts they reflect are still reachable via the relevant pages.)
3. **Right section won't shrink**: the search/EN-flag/year-toggle/role/notifications/user-menu cluster got `shrink-0` on its container. The flag, name, and toggle now stay on one line at every viewport.
4. **Breadcrumb truncates instead of pushing**: each breadcrumb segment got `truncate` and `min-w-0`, and the chevron got `shrink-0`. On deep paths at 1440 viewport the segments truncate to short ellipses (e.g. `Q… > Su… > Sco…`), keeping the whole header on one line. The full label is still in the DOM (and could be exposed via a tooltip in a future pass).

### Verification

Playwright (`scripts/scratch/analyze-pages.mjs`, gitignored) at 1440 × 900 across:
- `/dashboard`, `/settings`, `/audit-log`
- `/analytics`, `/qms/non-conformances`, `/qms/capa`, `/qms/risks`
- `/qms/suppliers/scorecards` (deep breadcrumb worst-case)
- `/lms/competency`, `/workflows`, `/dms/documents`

Results across all 11 routes:
- `document.documentElement.scrollWidth === innerWidth` → no horizontal overflow.
- Header pill heights all 28px → no internal text wrapping.
- StatsCard / DataTable / Card layouts unchanged (no overflow into adjacent cards).

Visual confirmation (screenshots in `scripts/scratch/snapshots/`):
- Body copy is comfortably readable (14px effective) — was 12.25px.
- Page-title hierarchy is clearer: `text-h1` at 24px is visibly heavier than `text-h2` at 18px and `text-h3` at 16px.
- KPI card labels (e.g. `CAPA CLOSURE RATE`, `TRAINING COMPLIANCE`) stay on one line; sub-card labels (e.g. `PENDING APPROVALS`) wrap exactly the same way they did before — no new wrapping introduced.
- Header pills, FY toggle, and user menu all single-line on every tested route, including the worst-case `/qms/suppliers/scorecards`.

### Knock-on cleanup deferred
- 57 places in feature code use `text-2xl font-bold` (or `text-xl font-bold`) for page titles — they should be migrated to `text-h1` for consistency with PageHeader. Not done in this round; would touch ~25 files and is best handled as a sweep in a separate session.
- The `text-lg` value changed from 22px to 18px. 18 callers exist; if any of them were leaning on the 22px size as a stand-in heading, they'll now look smaller and should switch to `text-h1` or `text-h2`. None spotted as broken in Playwright verification, but worth a manual sweep.
- DashboardPage's description (`Quality Management · GMP Compliance · Updated 22:24`) still uses `text-xs` — could be standardised to `text-body-sm` (13px) for consistency with the rest of the app's secondary-text convention. Tiny ergonomic tweak, deferred.

### Follow-up — breadcrumb color contrast (Header.tsx)
- Non-active breadcrumb segments were `text-ink-tertiary` (`#718096`) on white → **4.12:1** contrast. Fails WCAG AA for normal text (4.5:1).
- The chevron separator was `text-ink-disabled` (`#A0ADB8`) → **2.69:1**. Fails non-text contrast for icons (3:1).
- Fix: non-active segments → `text-ink-secondary` (`#4A5568`, **6.4:1**, passes AA). Chevron → `text-ink-tertiary` (`#718096`, **4.12:1**, passes for icons). Bumped chevron size 11 → 12 and the inter-crumb gap `gap-1` → `gap-1.5` so the path reads with more breathing room.
- The active (last) segment stays `text-ink` `font-semibold` — already had strong contrast.

---

## 7. Appearance settings page (color scheme + typography config)

Adds a user-facing **Appearance** page in the System section of the sidebar that drives global color and typography tokens at runtime via CSS custom properties. No backend work — config persists to `localStorage` per user via Zustand `persist`.

### Goal
- One place to configure color scheme and font sizing for the entire site.
- Theme changes propagate live to anything using the `--color-*` CSS variables, including the sidebar (after a small de-hardcoding fix) and antd widgets (via a dynamic `ConfigProvider`).
- Tailwind utilities like `bg-pharma`/`text-gold` continue to bake at build time — out of scope this round, called out as known limitation.

### Files created

- **`src/stores/appearanceStore.ts`** — Zustand store with `persist` middleware (`qk-appearance` key).
  - State shape: `mode` (`'light' | 'dark' | 'system'`), `preset` (`'default' | 'sapphire' | 'emerald' | 'slate' | 'custom'`), `colors` (13 tokens), `typography` (5 tokens: `baseFontPx`, `density`, `sansFamily`, `monoFamily`, `headingWeight`).
  - Actions: `setMode`, `applyPreset`, `patchColors` (auto-flips `preset` to `'custom'`), `patchTypography`, `resetAll`, `importConfig`, `exportConfig`.

- **`src/components/theme/presets.ts`** — Four named palettes:
  - `Default Gold` — original Quantum Kaizen palette, mirrors `:root` in `index.css`.
  - `Sapphire` — blue accent on deep navy chrome.
  - `Emerald` — green accent on forest sidebar.
  - `Slate` — monochrome, slate-500 accent.
  - Exports `defaultColors` and a `presetList` array for the page UI.

- **`src/components/theme/AppearanceProvider.tsx`** — bridge between the store and the live document. Mounted at the top of `App.tsx`. On every store change:
  1. Writes 13 color tokens onto `:root` as `--color-*` (`gold`, `goldDark` → `--color-gold`, `--color-gold-dark`, etc.).
  2. Writes typography tokens (`--font-sans`, `--font-mono`, `--font-heading-weight`) and sets `html.style.fontSize = "${baseFontPx}px"`.
  3. Toggles `html.dark` based on `mode`, including `(prefers-color-scheme: dark)` listener for `'system'`.
  4. Toggles `html.density-{compact|comfortable|spacious}` for future spacing hooks.
  5. Re-emits an inner `<ConfigProvider>` from antd with `buildAntdTheme(state)` so antd widgets follow the theme (nearest `ConfigProvider` wins).

- **`src/components/theme/ColorField.tsx`** — combined `<input type="color">` + hex text input. Keeps a local draft so users can mid-type partial hex values without immediate state thrash; commits on blur or Enter, reverts on Escape or invalid hex.

- **`src/components/theme/AppearancePreview.tsx`** — pure presentational mini sidebar + page-body preview. Reads from props (the *staged* state on the page), not the store, so users see uncommitted edits before pressing Save.

- **`src/pages/AppearancePage.tsx`** — the page itself. Tab-based, modeled on `SettingsPage.tsx`:
  - **Theme** tab — Light/Dark/System mode tri-toggle; preset cards with swatch rows.
  - **Colors** tab — 10 base color tokens with `ColorField`; 3 status colors (success/warning/danger) gated behind a "Show advanced" toggle to discourage accidentally inverting traffic-light semantics.
  - **Typography** tab — base font size slider (12–18px), density tri-toggle, sans family dropdown (Outfit / Inter / System), mono family dropdown (DM Mono / JetBrains Mono / System), heading weight (600/700/800).
  - **Header actions** — Import (file picker for JSON), Export (downloads `qk-appearance-YYYY-MM-DD.json`), Reset (factory defaults), Save (disabled until staged differs from store).
  - **Live preview pane** — sticky on `lg:` breakpoints, renders entirely from staged state.
  - All edits live in a *staged* local copy (`useState`); only `Save` writes to the store.

### Files modified

- **`src/App.tsx`**
  - Imported `AppearancePage` from `@/pages/AppearancePage` (System section import block).
  - Imported `AppearanceProvider` from `@/components/theme/AppearanceProvider`.
  - Wrapped the entire `<Routes>` tree in `<AppearanceProvider>` so the bridge runs once for the whole app and the inner antd `ConfigProvider` overrides the bootstrap one in `main.tsx`.
  - Added `<Route path="/appearance" element={<AppearancePage />} />` inside the System block.

- **`src/components/layout/Sidebar.tsx`**
  - Added `Palette` to the `lucide-react` import.
  - Added `{ label: 'Appearance', path: '/appearance', icon: Palette }` to the System nav section, between Audit Log and Settings.
  - Replaced the hardcoded design-token JS constants with CSS-variable references:
    - `BG = '#0D0E17'` → `'var(--color-navy)'`
    - `ACTIVE_BG = '#1E2035'` → `'var(--color-navy-mid)'`
    - `ACCENT = '#F59E0B'` → `'var(--color-gold)'` *(also fixes a long-standing mismatch — the constant was set to amber-500 but the actual brand gold is `#C9A84C`; via the variable the sidebar now uses true brand gold)*
    - `ACTIVE_CLR = '#F59E0B'` → `'var(--color-gold)'`
  - Section/inactive/hover colors stay hardcoded — they're cosmetic neutrals that don't need to track the user's preset.
  - All inline `style={{ backgroundColor: ACCENT, ... }}` / `style={{ borderLeft: '3px solid ' + ACCENT }}` usages still work — strings serialize to valid CSS and the browser resolves the variable.

- **`src/lib/antdTheme.ts`** — refactored from a static export into `buildAntdTheme({ colors, typography })`:
  - Pulls `colorPrimary` from `colors.gold`, `colorSuccess`/`colorWarning`/`colorError` from corresponding store tokens, `colorBgLayout` from `colors.bg`, and `fontFamily` from the resolved sans-family string.
  - Static export `antdTheme` retained — equals `buildAntdTheme()` (default palette) — so the bootstrap `<ConfigProvider>` in `main.tsx` keeps working before the store hydrates.

- **`src/index.css`**
  - Extended the Google Fonts `@import` to also load Inter and JetBrains Mono, since the typography options expose them.
  - Added `--font-heading-weight: 700;` to `:root` for AppearanceProvider to overwrite.
  - Added a comment noting that AppearanceProvider rewrites these properties at runtime.
  - Added an `html.dark { ... }` block that overrides `--color-bg`, `--color-surface`, `--color-border`, `--color-ink`, `--color-ink-2`, `--color-ink-3` for dark mode. Minimal scope — only flips variable-driven surfaces, not every Tailwind utility (deep dark mode is a separate larger effort).

### Architecture notes

- **Why CSS variables, not a Tailwind config rebuild.** Tailwind classes resolve at build time; rewriting them at runtime would require a full theme runtime. The existing CSS in `index.css` already references `var(--color-...)` everywhere it matters for chrome (bg, surfaces, ink, sidebar via the now-fixed constants). Rewriting the variables retroactively re-themes most of the app for free.
- **Why staged state on the page.** Lets users walk away with Reset without polluting the live theme, and the preview is honest about whether changes are committed.
- **Why disable Save when not dirty.** Cheap UX signal; computed via JSON-stringify equality on `colors`/`typography` plus shallow check on `mode`/`preset`.
- **Why inner `ConfigProvider` instead of replacing the one in `main.tsx`.** The bootstrap provider has to render before the React tree mounts (and before the Zustand store rehydrates). Stacking a second provider inside `App` is the antd-idiomatic way to override theme reactively without timing risk.
- **Persistence is local-only.** No backend endpoint, no `User.appearancePrefs` column. Per-user across devices would need a `/users/me/preferences` endpoint — flagged as a follow-up but out of scope.

### Verification

- `npx tsc --noEmit` in `client/` — exit 0, no errors.
- All new files conform to the project's existing TS/React patterns (Zustand for state, lucide-react for icons, `@/` path alias, `cn` utility for class merging, inline `style` for guaranteed render).

---

## 6. Rebrand: "Quantum Kaizen" → "Quantum Kairoz"

Replaced the visible product name across all user-facing surfaces. Infrastructure references left untouched (database names `quantumkaizen`/`kaizen_qms`, the `quantumkaizen.io` email domain and API hostnames, and `client/dist/` build artifacts).

### Files modified

- **`client/index.html`** — `<title>` and `apple-mobile-web-app-title` (`Q-Kaizen` → `Q-Kairoz`).
- **`client/public/manifest.json`** — PWA `name` and `short_name`.
- **`client/src/pages/LoginPage.tsx`** — logo `alt`, header wordmark, footer "Powered by" line.
- **`client/src/pages/LandingPage.tsx`** — all body copy and footer brand mentions.
- **`client/src/components/layout/Sidebar.tsx`** — sidebar brand wordmark.
- **`client/src/components/shared/ChatBot.tsx`** — assistant response copy and the intent-match regex.
- **`client/src/components/theme/presets.ts`** — theme description string and comment.
- **`client/Dockerfile`** — image `LABEL description`.
- **`backend/src/openapi/spec.ts`** — API doc `title` and `description`.
- **`backend/src/openapi/index.ts`** — Swagger `customSiteTitle`.
- **`backend/Dockerfile`** — header comment.

### Known limitations / out of scope

- **Tailwind utility classes** (`bg-pharma`, `text-gold`, status pill colors via `bg-status-*`) don't re-theme. They bake at build time.
- **Dark mode is partial.** Only variable-driven surfaces flip; gold-branded buttons and many Tailwind-class-styled components remain in their light styling. Full dark mode would require a `dark:` variant sweep across the codebase.
- **No cross-device sync.** Per-user, per-browser via `localStorage`. Adding a backend `userPreferences` blob is the natural next step.
- **No org-wide / admin-set theme.** All users get their own theme. A "lock theme to org" toggle would need an org-scoped Prisma field plus permission gating.

### 7.1 — Per-token font sizes (follow-up)

The first cut only exposed a single base-font-px slider, which scales every `rem` proportionally but doesn't let users tune the heading-vs-body relationship. Added explicit controls for each token in the Tailwind semantic typography scale.

#### Files modified

- **`src/stores/appearanceStore.ts`**
  - New `AppearanceFontSizes` interface — 9 numeric rem values: `display`, `h1`, `h2`, `h3`, `h4`, `bodyLg`, `body`, `bodySm`, `caption`. Mirrors the keys in `tailwind.config.js`'s `fontSize` block.
  - `AppearanceTypography` extended with a `fontSizes: AppearanceFontSizes` field.
  - New exported `defaultFontSizes` constant — values match the rem defaults in the Tailwind config (28/24/18/16/14 px headings; 16/14/13/12 px body+caption at 16 px base).
  - `defaultTypography` updated to include `fontSizes: defaultFontSizes`.
  - `importConfig` now deep-merges `fontSizes` (one level) so a partial override doesn't blank the rest of the scale.

- **`src/components/theme/AppearanceProvider.tsx`**
  - Imported `AppearanceFontSizes` type.
  - New `FONT_SIZE_VAR` map: `display → --font-size-display`, `h1 → --font-size-h1`, etc.
  - `applyTypography` extended to write `--font-size-*` variables as `${value}rem`. Storing as numeric rem (rather than absolute px) keeps the per-token sizes proportional to the base-font-px slider — users get global *and* per-token control without conflict.

- **`src/index.css`**
  - Added 9 `--font-size-*` declarations in `:root` with values mirroring the Tailwind defaults.
  - Added override rules for the matching Tailwind utility classes:
    - `.text-display`, `.text-h1`, `.text-h2`, `.text-h3`, `.text-h4`
    - `.text-body-lg`, `.text-body`, `.text-body-md` (mapped to `--font-size-body` since it shares the body px and only differs in weight), `.text-body-sm`, `.text-caption`
  - Each rule sets only `font-size` from the corresponding variable. CSS resolves each property independently, so `line-height`, `font-weight`, and `letter-spacing` keep coming from the original Tailwind utility — we only override the size.
  - Specificity is a tie (single class selector); our rules are placed AFTER `@tailwind utilities;` in the cascade, so they win on tie-break.

- **`src/pages/AppearancePage.tsx`**
  - Imported `defaultFontSizes` and `AppearanceFontSizes` from the store.
  - `handleReset` extended to seed `fontSizes: defaultFontSizes` in the staged copy.
  - New `SizeRow` interface and metadata arrays `HEADING_ROWS` (display + h1–h4) and `BODY_ROWS` (body-lg, body, body-sm, caption) — each row carries label, hint string showing the underlying Tailwind class (`.text-h1`, etc.), and a min/max rem range.
  - New `FontSizeSlider` row component — 3-column grid: label + Tailwind class hint │ slider │ rem · px readout + per-row reset button. Step is `0.0625rem` (≈1px at 16px base). Reset button is dimmed and disabled when the value matches the default.
  - Inside `TypographyTab`:
    - Helpers `setSize`, `resetSize`, `resetAllSizes` that patch `t.fontSizes` while preserving the rest of the typography object.
    - New "Heading sizes" section — bordered card containing display + h1–h4 sliders, with a "Reset all sizes" link in the section header.
    - New "Body & caption sizes" section — bordered card containing body-lg, body, body-sm, caption sliders.
    - Footnote on the existing base-font-px slider updated to call out that it scales the heading/body sizes below.

- **`src/components/theme/AppearancePreview.tsx`**
  - Now reads from `typography.fontSizes` (aliased as `fs`) and renders representative tokens at their staged sizes:
    - h1 (page title) and h2 (section heading) with the staged heading weight and original letter-spacing.
    - h3 inside the surface card, body for the main copy, body-sm for supporting text.
    - Sidebar nav rows render at body-sm; status pills and buttons at caption / body sizes.
  - Effect: editing any heading or body slider on the page now visibly resizes the matching element in the preview before Save.

#### How the override actually applies

CSS cascade resolution for `<h1 class="text-h1">`:

1. `@tailwind utilities` expands to `.text-h1 { font-size: 1.5rem; line-height: 1.2; font-weight: 700; letter-spacing: -0.015em; }`.
2. Our later rule `.text-h1 { font-size: var(--font-size-h1); }` has equal specificity but appears later — wins for `font-size`.
3. The other three properties (line-height, weight, tracking) keep the Tailwind values because our rule doesn't restate them.
4. AppearanceProvider writes `--font-size-h1: 1.625rem` (etc.) at runtime — `font-size` resolves to that value.

Net: zero changes to consumer code. Every existing `text-h1`/`text-body-sm`/etc. usage in the app picks up the new size automatically.

#### Verification

- `npx tsc --noEmit` — exit 0, no errors.
- Per-token sliders are stored as `rem`, so the existing base-font-px slider continues to scale them proportionally — both controls compose without conflict.

#### Known limitations (still)

- **Raw Tailwind size utilities** (`text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xxs`, `text-label`, `text-mono-*`) are not exposed as configurable. They're intended for fine-grained one-offs and stay rem-based against the html font-size, so the base-px slider still scales them. Promoting them to per-token controls would just clutter the UI.

### 7.2 — Hotfix: persisted-blob crash on rehydrate

#### Symptom

```
chunk-NT5JDPQU.js?v=…:16718 Uncaught TypeError: Cannot read properties of undefined (reading 'display')
    at AppearanceProvider.tsx:80:53
    at Array.forEach (<anonymous>)
    at applyTypography (AppearanceProvider.tsx:79:65)
```

Threw on first render after upgrading to 7.1, before the page mounted — so users with a `qk-appearance` blob in `localStorage` from the 7.0 era were greeted by a blank screen.

#### Root cause

Zustand's `persist` middleware does a **shallow** merge on rehydrate. When the persisted blob is `{ typography: { baseFontPx: 16, density: 'comfortable', sansFamily: 'outfit', monoFamily: 'dm-mono', headingWeight: 700 } }` (no `fontSizes` — the v7.0 shape), rehydrate replaces the in-memory default `typography` (which *does* include `fontSizes: defaultFontSizes`) with the persisted shape verbatim. `t.fontSizes` is then `undefined`, and `applyTypography` calls `Object.keys(FONT_SIZE_VAR).forEach(k => root.style.setProperty(…, t.fontSizes[k]))` — explodes on the first iteration.

Anyone adding a nested field to a persisted Zustand store hits this — the canonical fix is a `version` bump plus a `migrate` function (or a custom `merge`).

#### Files modified

- **`src/stores/appearanceStore.ts`** — added persist `version` and `migrate`:
  - `version: 2`. The pre-7.1 blobs were unversioned, so Zustand treats them as v0 and routes them through `migrate(persisted, 0 | undefined)`.
  - `migrate(persisted, _from)` returns a canonical v2 `AppearanceConfig` by spreading `defaultColors`/`defaultTypography`/`defaultFontSizes` *underneath* the persisted values:
    ```ts
    typography: {
      ...defaultTypography,
      ...(p.typography ?? {}),
      fontSizes: { ...defaultFontSizes, ...(p.typography?.fontSizes ?? {}) },
    }
    ```
    Persisted user values still win where present; defaults backfill anything missing.
  - `onRehydrateStorage` belt-and-braces callback that force-fills `state.colors`, `state.typography`, and `state.typography.fontSizes` if any are still missing after `migrate`. Cheap insurance for cache-mid-state edge cases (HMR, partial DevTools deletes).

- **`src/components/theme/AppearanceProvider.tsx`** — defensive guards in `applyColors` / `applyTypography`:
  - Both accept `undefined` and early-return / fall back to defaults instead of crashing.
  - Imported `defaultFontSizes` and `defaultColors`. Every key access uses `?? defaults[key]` so a partially-shaped object can't produce `undefined → setProperty(…, undefined)`.
  - Specifically: `t.fontSizes ?? defaultFontSizes`, `t.baseFontPx ?? 16`, `t.density ?? 'comfortable'`, `t.headingWeight ?? 700`, `SANS_FAMILIES[t.sansFamily] ?? SANS_FAMILIES.outfit`, etc.

- **`src/pages/AppearancePage.tsx`** — staged-state initializer now spread-merges defaults under `store.typography`:
  ```ts
  typography: {
    ...{ baseFontPx: 16, density: 'comfortable', /* … */, fontSizes: defaultFontSizes },
    ...(store.typography ?? {}),
    fontSizes: { ...defaultFontSizes, ...(store.typography?.fontSizes ?? {}) },
  }
  ```
  Means even if a render slips in *before* migrate, the page's `staged.typography.fontSizes` is always populated, so the new `FontSizeSlider` rows can render without throwing.

- **`src/components/theme/AppearancePreview.tsx`** — `typography.fontSizes ?? defaultFontSizes` and `typography.baseFontPx ?? 16` for the same reason.

#### Behavior after fix

1. First load after deploying the fix: `migrate` runs once, rewrites the persisted blob from `version: undefined` to `version: 2` with `typography.fontSizes` populated.
2. All subsequent loads: `migrate` is a no-op (already at v2). Provider reads a fully-formed object. Page renders normally.
3. If a future schema change is needed, bump to `version: 3` and add a v2→v3 branch in `migrate`.

#### Verification

- `npx tsc --noEmit` — exit 0.
- The defensive guards mean the failure mode is now "renders with defaults" instead of "blank screen" if any future shape mismatch occurs.

#### Lesson for future store changes

Whenever adding a nested field to a Zustand `persist` store, you must either:
- Bump `version` and write a `migrate` that backfills the new field, or
- Pass a custom `merge` function that deep-merges (the default is `Object.assign`-shallow), or
- Both, plus per-call defensive `?? default` guards on read sites.

The crash here was a textbook example — the addition in 7.1 (`fontSizes` field added to `AppearanceTypography`) needed exactly this treatment from the start.

### 7.3 — Larger live preview on the Appearance page

The preview pane in 7.0 was 360 px wide with a 280 px min-height — readable but cramped, especially because the inner sidebar+body grid (140 / 1fr) made the body column tiny. Made the preview much more legible.

#### Files modified

- **`src/pages/AppearancePage.tsx`** — wider right column with a higher breakpoint:
  - Old: `grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start`
  - New: `grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(520px,560px)] gap-8 items-start`
  - Side-by-side now kicks in at the `xl:` breakpoint (1280 px) instead of `lg:` (1024 px). Below that, preview stacks under the form full-width — better than squeezing it into 360 px on a laptop.
  - Right column: 520–560 px instead of fixed 360 px (44–56 % more horizontal room).
  - `gap-6` → `gap-8` so the preview doesn't crowd the form.
  - The "Live preview" label row now also shows a `staged · not saved` mono caption on the right so users have a visual cue that they're looking at uncommitted edits.
  - Sticky behavior moved from `lg:sticky` to `xl:sticky` to match the new breakpoint.

- **`src/components/theme/AppearancePreview.tsx`** — bigger and more representative:
  - Outer card: `shadow-sm` → `shadow-md`.
  - Inner grid: `grid-cols-[140px_1fr] min-h-[280px]` → `grid-cols-[180px_1fr] min-h-[480px]`. Sidebar 28 % wider, total height 71 % taller — closer to a real screen's proportions.
  - Sidebar:
    - Padding `p-3` → `p-4`, gap `gap-2` → `gap-1.5` (tighter rows).
    - Brand row: logo `w-6 h-6` → `w-7 h-7`, font 0.75rem → 0.875rem, bottom margin `mb-2` → `mb-3`.
    - New uppercase "Overview" section header above the nav rows so the preview matches the real sidebar's grouping convention.
    - Nav rows: padding `px-2 py-1.5` → `px-3 py-2`. Added a 5th row (Analytics) so users can see active vs. inactive contrast against more rows.
  - Body column:
    - Padding `p-4` → `p-6`, gap `gap-3` → `gap-4`.
    - Card: `rounded p-3` → `rounded-md p-4`, body text now has explicit `lineHeight: 1.55` and a slightly longer sample sentence so heading-vs-body proportion is honest.
    - Status pills relabeled `Success/Warning/Danger` → `Approved/Pending/Overdue` to match the platform's domain language; padding `px-1.5 py-0.5` → `px-2 py-0.5`.
    - Buttons: `px-3 py-1.5` → `px-4 py-2`.

#### Why these specific numbers

- **520–560 px** — wide enough that the inner 180 px sidebar leaves ~340 px for the body column at minimum, which is enough to render `text-h1` (24 px default) on a single line without pushing the layout.
- **480 px min-height** — fits all three preview sections (heading group, surface card, button row) without scroll while still being shorter than typical viewport heights, so the sticky positioning still works.
- **`xl:` breakpoint (1280 px)** — keeps the full-width stack on standard laptops where 1024–1279 px is common, avoiding a cramped two-column on small screens.

#### Verification

- `npx tsc --noEmit` — exit 0.
- Side-by-side preview kicks in at 1280 px viewport width and above; at 1024–1279 px the preview stacks below the form full-width.

---

## CAPA — Dynamic Workflow Integration

Reworked CAPA so its lifecycle is driven by the dynamic workflow engine (like tickets) instead of a fixed status enum, and rebuilt the CAPA detail page. Design/rationale in `docs/capa-dynamic-workflow-plan.md`. DB work targeted the local `kaizen_qms` database. Nothing committed — all changes are in the working tree.

### Database

- **`backend/prisma/schema.prisma`** — `Capa` gains `effectivenessData Json?` (30/60/90 check-ins) plus `workflowId`, `workflowTicketId`, `workflowTicketUniqueId` (spawn-and-link to a workflow ticket, mirroring `AuditRegister`).
- **Migrations** (created + applied to `kaizen_qms`):
  - `20260701172958_oos_investigation_capa_ticket_link/` — pre-existing `OosInvestigation.capaTicketId` / `capaTicketUniqueId` drift, split into its own migration.
  - `20260701172959_capa_workflow_link_and_effectiveness/` — the four `Capa` columns above.
  - `prisma migrate dev` first bundled both; split into two single-purpose migrations and history re-recorded (no data loss, `migrate diff` reports zero drift).

### Seed

- **`backend/prisma/seed.ts`** — added a `CAPA` `WorkflowType` (prefix `CAPA-`) and the **`CAPA Handling v1`** workflow: 6 linear stages (Initiation → Investigation & Root Cause → Action Plan → Implementation → Effectiveness Verification → Closure), each with a **required** stage form (6 new published forms). Stage `canonicalId`s map 1:1 to `CapaStatus`. Idempotent by workflow name + form `templateKey`.

### Backend — service / API

- **`backend/src/modules/audit/capa.service.ts`**
  - `resolveCapaWorkflowId()` — latest ACTIVE `CAPA`-type workflow.
  - `raiseCapaWorkflowTicket()` — raises a ticket via the orchestrator and persists the link (shared by create + attach).
  - `createCapa` — best-effort raises + links a workflow ticket on create.
  - `attachCapaWorkflow()` — new; links an existing CAPA. Guards: not already linked, and **OPEN-only** (a fresh ticket starts at the initial stage, which would otherwise reset a mid-lifecycle CAPA's status).
  - `CAPA_STATUS_FOR_STAGE` + `deriveCapaStatusFromFlow` + `syncCapaStatusFromTicket` — stage→status mirror, run from `getCapa` (keeps `implementedAt`/`closedAt` + NC-sync; never overrides `CANCELLED`).
  - `serializeCapa` — exposes `effectiveness_data`, `workflow_id`, `workflow_ticket_id`, `workflow_ticket_unique_id`.
  - `updateCapa` — persists `effectiveness_data`.
- **`backend/src/modules/audit/capa.controller.ts`** — `attachCapaWorkflow` handler.
- **`backend/src/modules/audit/audit.routes.ts`** — `POST /audit/capas/:id/workflow` (`capa.update` permission).
- **`backend/src/modules/audit/audit.schema.ts`** — `effectiveness_data` on `CapaUpdateSchema`.

### Frontend

- **`client/src/lib/api/audit.ts`** — `Capa` + `CapaUpdate` gain the new fields; new `useAttachCapaWorkflow` hook.
- **`client/src/features/audit/CapaDetailPage.tsx`** — rewritten: header + workflow band + two-column (tabs + sidebar). Tabs: Details, Stage Forms (workflow-linked only), Root Cause, Actions (+ timeline), Effectiveness, History.
- **`client/src/features/audit/capa/`** (new folder):
  - `capaData.ts` — typed parsers for `rootCauseData` / `effectivenessData`.
  - `Fishbone.tsx` — SVG Ishikawa diagram.
  - `RootCauseTab.tsx` — 5-Why + fishbone + corrective/preventive editor.
  - `EffectivenessTab.tsx` — 30/60/90 pending/pass/fail cards.
  - `CapaSidebar.tsx` — Metadata / Linked Records / Key Dates.
  - `CapaWorkflowBand.tsx` — hybrid flow (strip + `TicketFlowCanvas` modal + `ActionBar`) plus the legacy fallback (attach / advance).
  - `CapaEnumStepper.tsx` — segmented enum stepper for unlinked CAPAs.
  - Reuses ticket components `ActionBar`, `TicketFlowCanvas`, `StageFormSection`, `TicketFormHistory`.

### Tests

- **`tests/e2e/capa-workflow.spec.ts`** (new; path is git-ignored) — Playwright, 2 tests, both passing:
  1. Create a CAPA → ticket raised + linked (OPEN); detail page renders the flow band, Root Cause (5-Why + fishbone), Effectiveness (30/60/90), the seeded "CAPA Initiation" stage form, and the "View workflow" DAG modal.
  2. API attach guards return 400 ("Only OPEN…" / "already runs…"); a seeded `INVESTIGATION` CAPA renders the enum-stepper fallback + Advance, no attach.
  - Screenshots: `test-results/capa-0{1..6}-*.png`.

### Verification

- `tsc --noEmit` clean on both backend and frontend (0 errors).
- Both Playwright tests pass against backend :4000 + client :5173.

### Deferred

- Status-preserving **bulk** migration of existing mid-lifecycle CAPAs (opt-in attach is OPEN-only).
- Per-CAPA workflow **picker** (defaults to the one canonical CAPA workflow).

### Fix — detail page stale after a stage transition

- **Symptom:** advancing/completing the CAPA ticket moved the Stage Forms to the next stage, but the header status badge, flow band and sidebar stayed on the old stage — the page "looked the same" while the forms were on a different stage.
- **Cause:** the ticket transition hooks (`useTransition`) only invalidate ticket-side queries; the CAPA record query (`useCapa`, whose derived status is reconciled server-side in `getCapa`) was never refetched.
- **Fix:** `client/src/features/audit/capa/CapaWorkflowBand.tsx` now watches the linked ticket's flow signature (`isCompleted` + current stage ids) and invalidates `auditKeys.capa(id)` whenever it changes, so the header/badge/sidebar live-update in step with the flow.
- **Verified:** `tests/e2e/capa-workflow.spec.ts` 3rd test — submit the required Initiation form (API), then Approve/Forward in-page; the header badge live-updates `OPEN → INVESTIGATION` and the flow band shows "Investigation & Root Cause" with no reload. Screenshot `test-results/capa-07-live-advance.png`. All 3 spec tests pass.

### Fix — CAPA status now syncs engine-side on transition

- **Symptom:** completing/advancing the workflow ticket from the Tickets module left the CAPA record stale (e.g. ticket completed but CAPA still `OPEN` in the DB + CAPA list) until someone opened the CAPA detail page.
- **Cause:** the stage→status mirror (`syncCapaStatusFromTicket`) only ran on `getCapa` (detail read). Transitions performed elsewhere never touched the CAPA record.
- **Fix:** added `syncCapaFromTicketId(ticketId)` in `backend/src/modules/audit/capa.service.ts` and call it post-commit after every transition in `backend/src/modules/workflow/engine/orchestrator.ts` `performAction` (alongside the existing `syncTicketComplianceFindings` hook). Best-effort; no-op when no CAPA is bound. So completing/advancing the ticket updates the CAPA status / `implementedAt` / `closedAt` / NC roll-up immediately, everywhere.
- **Note:** the CAPA↔orchestrator import is a runtime-safe cycle (both sides call across the boundary only inside function bodies) — backend boots and typechecks clean.
- **Verified:** `tests/e2e/capa-workflow.spec.ts` 4th test — transition a CAPA's ticket via API, then read the **list** endpoint (which does not run the on-read sync); it already shows `INVESTIGATION`, proving the engine synced at transition time. All 4 spec tests pass.

### Clarification — the CAPA page vs the workflow ticket

- The rich CAPA UI (Details / Stage Forms / Root Cause fishbone / Actions / Effectiveness / History + sidebar) is the **CAPA detail page** at `/audit/capa/<id>` (Audit → CAPA). The item titled "CAPA-YYYY-NNNN — <title>" in the **Tickets** module is the underlying workflow ticket (generic stages + forms) that drives it — not the CAPA page.
- The bespoke Root Cause (fishbone) and Effectiveness (30/60/90) tabs read the CAPA's own `rootCauseData` / `effectivenessData`, which are **separate** from the workflow stage-form submissions (per the "keep bespoke editors too" decision) — so they render empty on a CAPA whose data was captured via the stage forms. Wiring stage-form data into those tabs is a pending decision.

### Feature — mirror stage-form data into the bespoke tabs

Decision: **populate from stage forms**. Workflow-driven CAPAs now auto-fill the fishbone / 30-60-90 tabs from the submitted stage forms (read-only), so there's no double entry.

- **Backend** `backend/src/modules/audit/capa.service.ts` — `deriveCapaFormData(ticketId)` reads the latest `SUBMITTED` submissions of the `capa-rca` and `capa-effectiveness` forms and maps their responses (`{ section: { field: value } }`) into the `rootCauseData` / `effectivenessData` shapes: `why1..5` → 5-Why, `rootCauseCategory` + `confirmedRootCause` → fishbone bone + conclusion; `check30/60/90` → 30/60/90 status, `verificationMethod` / `effectivenessConclusion` → notes. `getCapa` overlays this onto the response for workflow-linked CAPAs (compute-on-read; no DB write, no clobbering manual/legacy data).
- **Frontend** — `CapaDetailPage` passes `mirrored` + `canEdit={... && !hasWorkflow}` to `RootCauseTab` / `EffectivenessTab`; both now render read-only with a "Mirrored from the workflow's … stage form — edit it under the Stage Forms tab" banner when workflow-linked. Legacy (unlinked) CAPAs keep the editors editable.
- **Verified** — `tests/e2e/capa-workflow.spec.ts` 5th test: submit Initiation → forward → submit the RCA form, then the CAPA detail's `root_cause_data` mirrors it (conclusion, 5-Why, `fishbone.Machine`). Screenshot `test-results/capa-08-rca-mirrored.png` (fishbone + 5-Why filled, read-only, banner shown). All 5 spec tests pass; both `tsc --noEmit` clean.

### Deploy — standalone CAPA-workflow seed (prod-safe)

The dynamic-workflow feature needs the `CAPA Handling v1` workflow + its 6 stage forms to exist in the target DB. The base `seed.ts` creates them but also seeds demo users/roles (password `Admin@123`) — not safe to run wholesale on production.

- **`backend/prisma/seed-capa-workflow.ts`** (new) — seeds ONLY the `CAPA` WorkflowType, the `CAPA Handling v1` workflow (6 stages + actions + transitions) and its 6 forms. Looks up its dependencies (workflow stage statuses, built-in field types, roles) instead of creating users/roles; exits with a clear message if the base seed hasn't run. Idempotent (guarded by WorkflowType name / workflow name / form templateKey).
- **`backend/package.json`** — added script `db:seed:capa` (`tsx prisma/seed-capa-workflow.ts`).
- **Deploy runbook:** (1) commit + push (code + the 2 migrations — nothing is committed yet); (2) deploy → `prisma migrate deploy` auto-applies the schema (per `render.yaml` startCommand); (3) run `npm run db:seed:capa` once against the server DB. Without step 3 there is no CAPA workflow, so new CAPAs fall back to the legacy enum UI. Migrations are additive/safe; the test CAPAs are local-only and won't appear on the server.

---

## Typography Manual (FQS-QK-UIUX-002) — Phase 1: Font switch to Inter + Roboto Mono

Implements the font mandate from the _Font Nomenclature & Typography Instruction Manual_: UI font **Outfit → Inter**, data/mono font **DM Mono → Roboto Mono**. Full plan (all 4 phases) lives in `docs/typography-manual-implementation-plan.md`; this is Phase 1 only. Nothing committed — working tree only.

### Why this is more than a one-line font change

Fonts flow through a runtime theming layer: `appearanceStore` (persisted Zustand) → `AppearanceProvider` writes `--font-sans`/`--font-mono` onto `:root` → `index.css` holds bootstrap defaults → `tailwind.config.js` + `antdTheme.ts` back the static utilities and antd widgets. Changing the font means touching every layer, plus migrating existing users' persisted `localStorage` blob (which would otherwise pin them to Outfit/DM Mono).

### Files modified (7 touch points)

- **`client/src/index.css`** — font `@import` now loads **Inter** + **Roboto Mono** first (Outfit/DM Mono/JetBrains kept as fallbacks). Bootstrap `:root` defaults: `--font-sans: 'Inter', …`, `--font-mono: 'Roboto Mono', 'DM Mono', …`.
- **`client/src/components/theme/AppearanceProvider.tsx`** — added `'roboto-mono'` to `MONO_FAMILIES`; changed the `applyTypography` fallbacks so a missing key resolves to Inter / Roboto Mono (was Outfit / DM Mono).
- **`client/src/stores/appearanceStore.ts`** — `MonoFamily` union gains `'roboto-mono'`; `defaultTypography` now `sansFamily: 'inter'`, `monoFamily: 'roboto-mono'`. **Persist `version: 2 → 3`** with a v2→v3 `migrate` branch that force-swaps `outfit → inter` and `dm-mono → roboto-mono` **only when the persisted value equals the old default** — so a user who deliberately picked `'system'` keeps it. (Same reasoning as the 7.2 hotfix: nested/persisted store changes need a version bump + migrate.)
- **`client/tailwind.config.js`** — `fontFamily.sans` → Inter-first, `fontFamily.mono` → Roboto Mono-first.
- **`client/src/lib/antdTheme.ts`** — the second `SANS_FAMILIES` map reordered Inter-first; `buildAntdTheme` fallback `outfit → inter` so antd widgets follow.
- **`client/src/pages/AppearancePage.tsx`** — font-picker option lists relabeled ("Inter (default)" / "Roboto Mono (default)", old fonts kept as non-default choices); the two hardcoded reset-to-default fallbacks (staged initializer + `handleReset`) updated `outfit`/`dm-mono` → `inter`/`roboto-mono`.

### Migration behavior

- New users / cleared storage → default path → Inter + Roboto Mono.
- Existing users on the old default (Outfit / DM Mono) → v2→v3 migrate rewrites them to Inter / Roboto Mono on next load.
- Users who chose "System UI" / "System Monospace" → preserved (migrate only rewrites the retired defaults).

### Verification

- `npx tsc --noEmit` (client) — exit 0.
- `npx vite build` — clean (pre-existing chunk-size warning only).
- **Playwright UI check** — new `tests/ui/font.spec.ts` + `tests/ui/font.config.ts` (serves `client/dist` via `vite preview`; no backend/login needed, runs on the public route). 3/3 pass:
  1. `getComputedStyle(document.body).fontFamily` = `Inter, system-ui, …`.
  2. Runtime CSS vars (written by `AppearanceProvider`) — `--font-sans` = `'Inter', …`, `--font-mono` = `'Roboto Mono', 'DM Mono', …` (proves the store→provider path, not just the bootstrap).
  3. After rendering a probe span in each family, `document.fonts.check` → `inter: true, robotoMono: true` (faces actually download & render). Caught a lazy-load false-negative first — browsers only fetch a webfont when an element uses it — and fixed the test to force a mono render.
- Run: `npx playwright test --config tests/ui/font.config.ts`.

### Not done in Phase 1 (see plan doc)

- Phase 2 — semantic status **text** color tokens (`text-oos` etc.) + "never color alone" a11y sweep.
- Phase 3 — the 14 GMP label renames (blocked on the DB-vs-override decision for workflow-type names).
- Phase 4 — min-size / line-height enforcement + mono audit on LIMS data fields.
- Out of scope entirely: floor `+2px` variant, print fonts (Calibri/Georgia), full token rename.

---

## Typography Manual (FQS-QK-UIUX-002) — Phase 2: Semantic status text tokens + a11y audit

Adds the manual's WCAG-rated status **text** colours (§7) as design-system tokens and applies them to the most safety-critical status text (analytical result flags). Also audited the two accessibility mandates from §7 — both already satisfied. Working tree only; nothing committed.

### Audit findings (§6.2 / §6.3 of the plan)

- **Sidebar contrast** — the manual flags `#FFF3DC` on navy as a 2.1:1 FAIL. Grep across `client/src`: `#FFF3DC` is **not used as a text colour anywhere** (it only exists as a Tailwind `gold-100`/`amber-light` swatch value). No-op — nothing to fix.
- **"Colour never the sole status indicator"** — audited the status renderers: `Badge.tsx` (`StatusBadge`/`SeverityBadge`/`TypeBadge`) always pair a coloured dot **with a text label**; the LIMS `EVALUATION_BADGE` carries `EVALUATION_LABELS` text; the live OOS warning uses `⚠ Out of spec …` (icon + words). All already WCAG 1.4.1-compliant. No colour-only indicators found.

### Files modified

- **`client/tailwind.config.js`** — new `state` colour group with the five semantic status text tokens from the manual, each annotated with its WCAG ratio:
  - `state.oos` `#C53030` (7.2:1 AAA), `state.oot` `#C98A00` (5.5:1 AA), `state.approved` `#1A6B3D` (7.8:1 AAA), `state.progress` `#1A5C9E` (6.4:1 AA), `state.quarantine` `#B84E00` (6.6:1 AA). Usable as `text-state-oos`, `bg-state-*`, etc.
- **`client/src/lib/api/testing.ts`** — `EVALUATION_BADGE` (the single shared source for analytical result-flag styling, fanned out to sample tests / OOS views) now uses the semantic tokens for its text colour: `OOS`/`FAIL` → `text-state-oos`, `OOT` → `text-state-oot`, `PASS` → `text-state-approved`. Light `bg-*`/`border-*` kept as-is; only the foreground moves to the WCAG-AAA value. Each badge still renders its label, so colour is never alone.
- **`client/src/features/lims/SampleTestsPanel.tsx`** — the ad-hoc live "⚠ Out of spec" flag on a result field switched `text-red-600` → `text-state-oos` (keeps the ⚠ icon + text).

### Rationale / scope

- No wholesale repaint of existing status badges — the app's navy/gold ≈ the manual's navy/amber, and the generic badges already pass contrast (plan §1). Only the safety-critical OOS/OOT/pass result flags were moved onto the exact WCAG-rated tokens, at one shared source.

### Verification

- `npx tsc --noEmit` (client) — exit 0.
- `npx vite build` — clean (pre-existing chunk-size warning only).
- **CSS-emission check** on the built bundle confirms the tokens ship with the manual's exact hexes (and are present only because they're referenced — Tailwind purges unused, so this also proves the `EVALUATION_BADGE` wiring):
  - `.text-state-oos{…color:rgb(197 48 48)}` = `#C53030` ✓
  - `.text-state-approved{…color:rgb(26 107 61)}` = `#1A6B3D` ✓
  - `.text-state-oot{…color:rgb(201 138 0)}` = `#C98A00` ✓
- **Playwright UI check** — `tests/ui/state-colors.spec.ts` + `.config.ts` (serves `client/dist` via `vite preview`). 4/4 pass: each of the three applied tokens computes to its exact `rgb()` in a real browser, and an OOS result badge renders `#C53030` **with** its text label (colour-not-alone). Run: `npx playwright test --config tests/ui/state-colors.config.ts`. (The tokens only render because app code references them; progress/quarantine are defined-but-unused so their utilities aren't emitted yet — noted in the spec.)

### Not done in Phase 2

- Phases 3 (14 label renames) and 4 (min-size / line-height / mono data-field audit) — see `docs/typography-manual-implementation-plan.md`.

---

## Typography Manual (FQS-QK-UIUX-002) — Phase 3: GMP nav label renames

Applies the manual's §6 terminology to navigation labels + matching page titles. DB-driven workflow-type modules are relabelled via a display-name override (no seed/DB changes — internal names untouched). Working tree only; nothing committed.

### Approach for DB-driven labels (decision)

Chose the **sidebar display-name override map** over renaming seed `name`s. The workflow type's stored `name` is the internal key used by seeds / idempotency guards (`where: { name: 'CAPA' }`) / permissions, so it's left intact; only the sidebar label is remapped. Zero DB/migration/seed risk, fully reversible.

### Files modified

- **`client/src/components/layout/Sidebar.tsx`**
  - New `WF_DISPLAY_NAME` map applied in `moduleItems` (`label: WF_DISPLAY_NAME[t.name] ?? t.name`): `CAPA → CAPA Management`, `Deviation → Deviations`, `Complaints → Product Complaints`. (Deviation/Complaints workflow types aren't seeded yet, so those entries are harmless future-proofing; CAPA is live.)
  - Hardcoded labels: `Document Review → Document Approval` (the DMS-grouped workflow child); LMS group `LMS → Training & Qualification` with children `My Learning → My Training`, `Curricula → Training Programs`, `Training Matrix → Qualification Matrix`, `Grading → Assessment Results`; LIMS children `Samples → Sample Management`, `OOS Investigations → OOS / OOT Investigations`, `Certificates (CoA) → CoA Management`. Updated the stale LMS comment.
- **`client/src/features/lims/LimsConfigLayout.tsx`** — Partners tab `Suppliers → Vendor Management`.
- **Page titles aligned to the nav labels** (`<h1>`): `SampleListPage` (Samples → Sample Management), `SuppliersPage` (Suppliers → Vendor Management), `lms/CurriculaPage` (Curricula → Training Programs), `lms/MyLearningPage` (My Learning → My Training), `lms/TrainingMatrixPage` (Training Matrix → Qualification Matrix), `lms/GradingPage` (Grading Queue → Assessment Results).

### Deliberately NOT done

- **`Audit Master → Audit Program`** — SKIPPED. The app's "Audit Master" is the master-**data** config (focus areas, audit types, ISO standards), and an **"Audit Program"** feature already exists separately (`/audit/program`, `AuditProgramListPage` — the ISO-19011 operational program). Renaming would collide and be semantically wrong; the manual's intent is already met by the existing Audit Program. Left as-is.
- Page titles that are already descriptive and not the old nav string were left: `OosListPage` h1 was already "OOS / OOT Investigations"; `CoaListPage` h1 stays "Certificates of Analysis" (correct expansion of CoA).

### Verification

- `npx tsc --noEmit` (client) — exit 0. `npx vite build` — clean.
- Grep audit: no user-facing old nav labels remain (only a code comment mentioned "My Learning", since fixed).
- **Playwright UI check (real login)** — `tests/ui/labels.spec.ts` + `.config.ts`, run against the Vite **dev** server (proxies `/api` to the live backend :4000; `vite preview` doesn't proxy). Logs in as `admin@forgequantum.com` and asserts the live sidebar. 2/2 pass:
  1. "Training & Qualification" group visible; expands to show My Training / Training Programs / Qualification Matrix / Assessment Results; old My Learning / Curricula / Training Matrix / Grading absent.
  2. LIMS group shows Sample Management / OOS / OOT Investigations / CoA Management; old OOS Investigations / Certificates (CoA) / Samples absent.
  - Run: `npx playwright test --config tests/ui/labels.config.ts` (needs backend up + seeded).

### Not done in Phase 3

- Phase 4 — min-size / line-height enforcement + mono audit on LIMS data fields. See the plan doc.

---

## Typography Manual (FQS-QK-UIUX-002) — Phase 4: mono data fields + narrative measure/line-height

Final pass: enforce the data typeface on GMP-critical values (§5) and the narrative measure/line-height (§8). Audit-driven and deliberately targeted — the codebase already broadly complies, so this closes specific gaps rather than sweeping. Working tree only; nothing committed.

### Audit results

- **Mono on data (§5)** — already widely applied: `font-mono` appears 42× across 30 LIMS files (sample numbers, barcodes, codes, IDs). Gaps found and fixed were specific fields, not systemic.
- **Min sizes (§3)** — the Session-5 rem rebase already puts body/data at 14px and nav at 13–17px (Sidebar spans render 15–17px). The remaining `text-[11px]`/`text-xxs` usages are **field labels and micro-meta** (uppercase caption labels, counts, badge chrome) — which the manual permits — not data/nav text. No mass resize done: it would be high-churn, low-safety-value, and risks regressions. Noted as a minor, acceptable deviation (field labels sit ~1px under the manual's 12–13px label floor).
- **Colour-not-alone / sidebar contrast** — already handled in Phase 2.

### Files modified — mono on GMP-critical values (§5)

- **`client/src/features/lims/SampleListPage.tsx`** — Batch column now renders `<span className="font-mono">` (was plain text). Batch codes need 0/O·8/B·1/l disambiguation.
- **`client/src/features/lims/SampleDetailPage.tsx`** — `Field` helper gained an optional `mono` prop (applies `font-mono` to the value); the **Batch** field now passes `mono`.
- **`client/src/features/lims/SampleTestsPanel.tsx`** — the read-only analytical **result value** now renders `font-mono tabular` (was `text-gray-900` proportional), so numeric results align and disambiguate.

### Files modified — narrative measure + line-height (§8)

- **`client/src/index.css`** — new `.gmp-narrative` utility in the `@layer utilities` block: `line-height: 1.65; max-width: 70ch; text-align: left`. Caps GMP narrative text at a 65–75ch measure with ≥1.6 line height per §8 (wider lines slow reading / raise transcription error against printed records).
- Applied `.gmp-narrative` to the GMP narratives the manual names:
  - `lims/OosDetailPage.tsx` — OOS investigation **conclusion**.
  - `audit/CapaDetailPage.tsx` — CAPA **description**.
  - `audit/AuditProgramExecutionPage.tsx` — program **summary**.
  - `audit/AuditReportPage.tsx` — audit register **description** + program **summary**.

### Verification

- `npx tsc --noEmit` (client) — exit 0. `npx vite build` — clean.
- CSS-emission check: `.gmp-narrative{line-height:1.65;max-width:70ch;text-align:left}` present in the bundle.
- **Playwright UI check** — `tests/ui/narrative.spec.ts` + `.config.ts` (serves `client/dist` via `vite preview`). 2/2 pass:
  1. `.gmp-narrative` → computed `line-height: 26.4px` (1.65×16), `max-width: 603.75px` (70ch resolved), `text-align: left`.
  2. `.font-mono` → `font-family` resolves to `"Roboto Mono", …` (data typeface reaches data values).
  - Run: `npx playwright test --config tests/ui/narrative.config.ts`.

### Phase 4 done — high-impact scope of FQS-QK-UIUX-002 complete

Phases 1–4 (fonts, status text tokens + a11y, 14 label renames, mono/narrative enforcement) are implemented and tested. Still out of scope (future work, per the plan doc): floor `+2px` variant tokens (§9), print fonts Calibri/Georgia (§2/§7), and a full rename of the existing typography tokens to the manual's `display-module`/`nav-label`/… names.

---

## UI/UX Manual (FQS-QK-UIUX-003) — Phase A: sidebar groups, icons, status colour, shortcuts, compliance badge

First tranche of the second manual (UI/UX). Design-system quick wins only — the low-risk items that a pharma evaluator notices first. Analysis + full 4-phase plan in `docs/uiux-manual-implementation-plan.md`. Working tree only; nothing committed. (Phases B–D — 21 CFR-UI polish, data-backed features, the 8 missing modules — not started.)

### A1 — Sidebar group headers + GMP grouping (§2/§4)

The sidebar previously rendered three untitled sections (hardcoded block → DB workflow block → Configuration); the group-header render path existed but was dead because every `NavSection.title` was empty. Restructured into the manual's **4 groups**:
- **`client/src/components/layout/Sidebar.tsx`** — added a `MODULE_GROUP` map + `groupForModule()` that tags each DB-driven workflow module `"Quality System"` (CAPA/Deviation/Complaints/Change/Risk) or `"Compliance"` (Audit/Calibration), defaulting to Quality System. Extracted the hardcoded modules into consts (`dashboardItem`/`dmsItem`/`limsItem`/`trainingItem`/`configItem`) and assembled five titled sections: `""` (Dashboard, ungrouped) · **Lab Operations** (LIMS, DMS) · **Quality System** (`qualityItems`) · **Compliance** (`complianceItems`) · **Admin** (Training & Qualification, Configuration). Empty groups are dropped by the existing `items.length > 0` filter, so unseeded groups don't show. No render-code change needed — the header path was already there.
- Scope note: the exact 12-item interleave (LIMS #2, Deviations #4, …) from §2 is **not** done — it's blocked on Deviations/Change Control/Calibration/Vendor Management existing as first-class modules (they're dynamic types / LIMS sub-pages today). This is the "achievable grouping"; full reorder is Phase C3.

### A2 — Icon swaps (§3)

`Sidebar.tsx` — imported `Microscope`, `Grid3x3`, `MessageSquareWarning`, `RefreshCw` and applied:
- Quality Control `Activity → Microscope` · My Training `GraduationCap → Award` (de-duped from the parent's graduation cap) · Qualification Matrix `Database → Grid3x3`.
- `ICON_BY_KEY`: CAPA `Wrench → RefreshCw` (corrective/preventive loop) · Audit `BookOpen → ClipboardCheck` (inspection checklist) · added `complaints`/`productcomplaints → MessageSquareWarning` (was falling back to the generic `Layers`).
- Sample Management already used `TestTubes` ✓. Calibration N/A (not a top-level module).

### A3 — 6th status colour (§5)

`client/tailwind.config.js` — added `state.closed: '#5A6B7D'` (5.1:1 AA, neutral grey for inactive/archived/closed), completing the manual's 6-colour system on top of the five added for FQS-QK-UIUX-002 Phase 2.

### A4 — Keyboard shortcuts (§4)

`client/src/hooks/useKeyboardShortcuts.ts` — extended `ROUTE_MAP` with `g l → /lims/samples`, `g c → /audit/capa`, `g a → /audit/register` (the `g`-chord engine already existed).

### A5 — Compliance-mode badge (§4/§8)

`Sidebar.tsx` — a static `🛡 GMP · 21 CFR 11 · EU Annex 11` chip in the sidebar footer (expanded only), using the gold accent token — reassures QA/inspectors that data-integrity controls are active.

### A6 — Nav label sizing (follow-up)

The top-level nav labels rendered at **17px**, which crowded long labels ("Training & Qualification", "CAPA Management") against the expand chevron and read oversized. Reduced to **15px** top-level / **14px** children in `Sidebar.tsx` (`renderNavItem`), keeping the parent > child hierarchy and moving toward the typography manual's nav-label spec (13–14px web). Verified by screenshot — long labels now sit comfortably on one line.

### Verification

- `npx tsc --noEmit` (client) — exit 0. `npx vite build` — clean.
- **Playwright UI check (real login)** — `tests/ui/nav-groups.spec.ts` + `.config.ts`, against the Vite dev server (proxies to backend :4000), logging in as `admin@forgequantum.com`. 4/4 pass:
  1. Group headers **Lab Operations / Quality System / Admin** render.
  2. LIMS + DMS in Lab Operations; Training & Qualification + Configuration in Admin.
  3. Compliance badge `GMP · 21 CFR 11 · EU Annex 11` visible in the footer.
  4. Pressing `g` then `l` navigates to `/lims/samples`.
  - Run: `npx playwright test --config tests/ui/nav-groups.config.ts` (needs backend up + seeded).
- Icon swaps: verified they compile/import and the affected items still render; exact glyph is a visual change (lucide SVGs aren't text-assertable).

### Not done in Phase A

- Phase B (e-sig name/date/meaning button, read-only banner, audit-log link), Phase C (notification badges + real global search + full nav reorder + persona nav — need backend), Phase D (8 missing modules — roadmap). See the plan doc.

---

## UI/UX Manual (FQS-QK-UIUX-003) — Phase B: 21 CFR Part 11 UI polish

Finishes the partially-built Part 11 UI affordances (§8). Working tree only; nothing committed.

### B1 — E-signature modal completion (§8)

`client/src/components/shared/ESignatureModal.tsx` — 21 CFR Part 11 requires the signer's **printed name**, **date/time**, and **meaning** all visible at the point of signing. The modal already had the meaning dropdown; added the missing two and fixed the button:
- Imported `useAuthStore`; added a signer row to the context panel — `Signer: <user.name>` + a `new Date().toLocaleString()` stamp (display-only operator confirmation; the authoritative signing time stays server-set).
- Confirm button `Apply Signature → Sign as {meaning}` (e.g. "Sign as Approved", "Sign as Reviewed") so it reflects the signature meaning rather than a generic verb.
- **Deferred:** the two ad-hoc AntD signing UIs (`features/audit/CapaDetailPage.tsx`, `features/dms/DocumentDetailPage.tsx`) still lack name/date parity and aren't consolidated onto the shared modal — a follow-up (kept out of this pass to limit churn/risk).

### B2 — "Approved — Read Only" banner (§8)

- New `client/src/components/ui/ReadOnlyBanner.tsx` — lock icon + "Record Approved — Read Only", styled with the new `state.closed` token.
- Applied to the primary submitted-GMP-record surface: `features/tickets/detail/TicketFormHistory.tsx` (above the existing subtle "Read-only · …" caption). The `.form-readonly` plumbing already existed; this adds the prominent lock affordance the manual asks for. Ready to drop into the DMS effective-doc and closed-CAPA views next.

### B3 — Fix the dead "Audit Log" link (§8)

`client/src/components/layout/Header.tsx` — the notification dropdown's footer button navigated to `/dashboard` and was mislabeled "View all in Audit Log" (no `/audit-log` route exists).
- Relabeled to **"View all notifications →"** and repointed to open the full `NotificationPanel`.
- **Correctness fix caught during review:** the header bell's own `onClick` already calls `togglePanel()`, so calling `togglePanel()` again from the footer would have *closed* the panel. Added a deterministic `openPanel()` action to `stores/notificationStore.ts` (`set({ isOpen: true })`) and used it in the footer, so the link always opens the panel regardless of prior state.

### Verification

- `npx tsc --noEmit` (client) — exit 0. `npx vite build` — clean.
- **Bundle-string check** on the built JS confirms all three shipped and the dead label is gone: `Sign as ` ✓, `Signer:` ✓, `Record Approved — Read Only` ✓, `View all notifications` ✓, `View all in Audit Log` → **0 occurrences**.
- **Playwright UI check (real login)** — `tests/ui/notif-link.spec.ts` + `.config.ts` (Vite dev server → backend :4000). 1/1 pass: from `/lims/samples`, open the bell dropdown → the footer reads "View all notifications" (old label absent) → clicking it opens the `NotificationPanel` (`<h2>Notifications</h2>`) and stays on `/lims/samples` (no dead jump to `/dashboard`).
- B1 (e-sig) and B2 (banner) render inside flows that need specific data/interaction (LMS exam/course signing; a completed ticket's submitted forms), so they were verified by tsc + build + bundle-string presence + code review rather than a driven e2e.

### Not done in Phase B

- E-sig parity in the CAPA/DMS ad-hoc signers; global aggregate audit-log page; session-timeout countdown + last-login display. Phase C (notification badges + real global search + full nav reorder + persona nav — need backend) and Phase D (8 missing modules — roadmap). See the plan doc.

---

## UI/UX Manual (FQS-QK-UIUX-003) — Phase C1: sidebar notification badges

The manual's highest-impact/demo item (§4, U-01: "CAPA: 5 open"-style badges, benchmarked against Veeva/MasterControl). First data-backed feature — adds a real backend counts endpoint + frontend badges. Working tree only; nothing committed. (The rest of Phase C — real global search, full 12-module reorder, persona nav — not started.)

### Backend — new `GET /api/nav-counts` endpoint (read-only aggregation, no schema change)

New module `backend/src/modules/nav-counts/` (service + controller + routes), mirroring the `lims-analytics` pattern; registered in `backend/src/app.ts` at `/api/nav-counts` (auth-only, no extra permission — counts are non-sensitive aggregates of what the user can already navigate to). Returns:
```json
{ "workflowTypes": { "<typeId>": <openTickets> }, "oos": <n>, "capa": <n> }
```
- **workflowTypes** — open tickets grouped by workflow type. Open work lives on `TicketFlow.isCompleted = false` (Ticket has no status/type column), and the type is two hops away, so: `groupBy(TicketFlow, workflowId)` where not-completed and `ticket.isDeleted = false`, then map `workflowId → Workflow.typeId` and sum.
- **oos** — `OosInvestigation` where `status != 'CLOSED'`.
- **capa** — `Capa` where `status notIn (CLOSED, CANCELLED)` (via the `CapaStatus` enum).

### Frontend — badges in the sidebar

- **`client/src/lib/api/navCounts.ts`** (new) — `useNavCounts()` react-query hook (`staleTime 60s`, `refetchInterval 120s`, refetch on focus) — badges are ambient, never block.
- **`client/src/components/layout/Sidebar.tsx`** — `NavItem` gains `count?`; a module-level `NavBadge` (amber pill on the dark sidebar, hidden at zero, `99+` cap); a `badgeCount(item)` helper that rolls descendant counts up to parents so a collapsed group still surfaces attention. Counts are attached in the nav memo: each DB workflow module gets `navCounts.workflowTypes[t.id]`; the LIMS→OOS child gets `navCounts.oos`. Badges render on both parent rows (before the chevron) and leaf rows (right-aligned), expanded sidebar only.
- Also fixed a latent inconsistency found here: an earlier font-size edit (A6) only matched the **parent** label span (indentation differed), leaving **leaf** labels at 17px. Brought leaves in line at 15px/14px so Dashboard/CAPA-Management match the parent rows.

### Verification

- Backend `npx tsc --noEmit` — exit 0. Client `npx tsc --noEmit` + `vite build` — clean.
- **Live endpoint test** — ran a throwaway backend instance on `:4001` (same DB; the running `:4000` predates the new route) and hit `GET /api/nav-counts` with a real admin token → `200` in ~42ms, returning real data: `{"workflowTypes":{"…":23,"…":17},"oos":0,"capa":21}`. Prisma logs confirm the three intended queries.
- **Badge UI test (Playwright, real login + mocked counts for determinism)** — `tests/ui/nav-badges.spec.ts` + `.config.ts`. 2/2 pass: with `oos:7`, the **LIMS parent** rolls up and shows `7`, and expanding LIMS shows the **OOS leaf** `7`; with all-zero counts, no badge renders.

### ⚠ Operational note

The running `:4000` backend did **not** hot-reload the new route (it 404s `/api/nav-counts` while existing routes work). **It needs a restart** (`npm run dev:backend`) to serve the endpoint. Until then the frontend's nav-counts call 404s and badges simply don't render — graceful, no crash.

### Not done in Phase C

- C2 real global search (needs a backend `/api/search`), C3 full 12-module reorder (blocked on Deviations/Change Control/Calibration/Vendor existing as modules), C4 persona nav. Phase D (8 missing modules) remains a roadmap.

---

## UI/UX Manual (FQS-QK-UIUX-003) — Phase C2: real global search

Replaces the 4-item static ⌘K palette (which only linked to Dashboard/Forms/Workflows/Tickets) with a real cross-module search — the manual's §4 use case: "find a sample by lot number, CAPA by ID, or SOP by document number… essential during inspections." Working tree only; nothing committed.

### Backend — new `GET /api/search?q=` endpoint (read-only)

New module `backend/src/modules/search/` (service + controller + routes), registered in `backend/src/app.ts` at `/api/search` (auth-only). Runs six `findMany` in parallel (case-insensitive `contains`, `take 5` each) across the entities an analyst/inspector looks up by reference:
- **Sample** — `sampleNumber` / `barcode` / `batchNo` / `productName` (soft-delete filtered) → `/lims/samples/:id`
- **Capa** — `capaNumber` / `title` / `description` → `/audit/capa/:id`
- **Document** (DMS) — `docNumber` / `title` / `description` (soft-delete) → `/dms/:id`
- **Ticket** — `uniqueId` / `title` / `description` (soft-delete) → `/tickets/:id`
- **OosInvestigation** — `code` / `title` → `/lims/oos/:id`
- **Coa** — `coaNumber` / `productName` / `batchNo` (soft-delete) → `/lims/coa/:id`

Each hit is normalised to `{ type, id, title, subtitle, path }`. Min query length 2. **Known limitation** (documented in the service): results are auth-gated but not yet scoped to per-entity read permissions — a follow-up.

### Frontend — wire the palette to the API

`client/src/components/shared/GlobalSearch.tsx` rewritten to fetch from the endpoint instead of the static `SEARCH_INDEX`: a debounced (200ms) `useQuery(['global-search', q])` enabled at ≥2 chars, a per-type icon/colour map (Sample/CAPA/Document/Ticket/OOS/CoA), monospace titles (they're reference codes), and loading / too-short / empty states. The existing palette shell — ⌘K open, ↑↓ navigation, ↵ open, Esc close — is preserved.

### Verification

- Backend + client `npx tsc --noEmit` — exit 0.
- **Live endpoint test** — throwaway backend on `:4001` (same DB; killed cleanly by port afterwards), `GET /api/search?q=capa` → real CAPA hits with correct `{type,title,subtitle,path}` (e.g. `CAPA-2026-0007 → /audit/capa/<id>`). `q=sample` → 0 (no samples seeded — correct).
- **Palette UI test (Playwright, real login + mocked results)** — `tests/ui/search.spec.ts` + `.config.ts`. 2/2 pass: typing "capa" renders the returned CAPA + Sample hits and clicking navigates to `/audit/capa/<id>`; a 1-char query shows "Type at least 2 characters…" and fires **no** API call.

### ⚠ Operational note

Same as C1: the running `:4000` backend has `nav-counts` (from the earlier restart) but **404s `/api/search`** — its watcher isn't reloading new module files. **Restart it** (`npm run dev:backend`) to serve search. Until then the palette shows "No results" (the 404 yields an empty list — graceful, no crash).

### Not done in Phase C

- C3 full 12-module reorder (blocked on Deviations/Change Control/Calibration/Vendor existing as first-class modules), C4 persona nav, and per-entity permission scoping of search. Phase D (8 missing modules) remains a roadmap.

---

# LIMS "disconnected features" wiring — 2026-07-04

Frontend half of the LIMS orphaned-feature backlog (plan: `docs/LIMS-industrial-upgrade-plan.md` §I; backend half in `backend/changes.md`). Connects master data that was write-only, makes CoA templates actually render, completes worklist membership, and clears dead client code. Working tree only — **not committed**. Every item verified end-to-end in the running app (Playwright + API). Both workspaces `tsc --noEmit` clean.

### W-1d — Units-of-Measure catalog wired into the forms
The Units master (`/lims/units`) was a write-only island; every unit field was free text.
- **`src/features/lims/UnitSelect.tsx`** (new) — shared AntD `AutoComplete` sourced from `useUnits`, keeps free-text so legacy values still work.
- Swapped the 6 free-text unit `<Input>`s for `<UnitSelect>`: `SpecDetailPage.tsx`, `SpecVersionsPage.tsx`, `TestDefinitionsPage.tsx`, `SampleListPage.tsx`, `QcMaterialsPage.tsx`, `SampleDetailPage.tsx`.
- Verified: register-drawer Unit field shows all 8 seeded units with search.

### W-2 + W-1b (CoA) — templates now drive the certificate
`CoaTemplate` was fully persisted but `CoaDetailPage` hardcoded the layout and ignored it; template Header/Footer HTML + Customer were unsettable.
- **`src/lib/api/coa.ts`** — `Coa` gains `customer_name` + `template { title, header_html, footer_html, sections }`.
- **`src/features/lims/CoaListPage.tsx`** — Generate modal gets **Template** + **Customer** pickers (`useCoaTemplates`/`useCustomers`, sends `template_id`/`customer_id`; template pre-fills its default customer); template editor gets **Header HTML** / **Footer HTML** textareas + a **Customer** select.
- **`src/features/lims/CoaDetailPage.tsx`** — renders from the template: title from `template.title`, header/footer HTML **sanitized with DOMPurify**, body sections in the template's order, a signatures block; falls back to the hardcoded default when no template.
- **`package.json`** — added `dompurify@^3` (HTML sanitization for the CoA header/footer).
- Verified: created a template with header/footer/customer, generated a CoA against it, certificate rendered all of them.

### W-1a/b/c — Customer / Supplier / Sampling Point on samples
Those masters had nowhere to attach on a sample (no columns existed — see backend log for the migration).
- **`src/lib/api/samples.ts`** — `customer_id`/`supplier_id`/`sampling_point_id` on `SampleSummary` + `RegisterSampleBody`; `customer_name`/`supplier_name`/`sampling_point_name` on `SampleDetail`.
- **`src/features/lims/SampleListPage.tsx`** — register drawer adds **Customer** + **Sampling Point** pickers, plus a **Supplier / Vendor** picker shown only when Type = `Raw Material` (`useCustomers`/`useSuppliers`/`useSamplingPoints`).
- **`src/features/lims/SampleDetailPage.tsx`** — header meta shows Sampling Point, and Customer / Supplier when present.
- Verified: registered SMP-2026-0005 (Raw Material) with all three; detail page shows them.

### W-3 — worklist test membership
Backend accepted `sample_test_ids` but there was no attach/detach UI, and `useRemoveTestFromWorklist` was dead.
- **`src/lib/api/testing.ts`** — new **`useSampleTests(params)`** list hook (wraps `GET /testing/tests`, supports `unassigned`).
- **`src/features/lims/WorklistsPage.tsx`** — detail drawer gets an **"Add tests to this worklist"** multiselect of unassigned tests (→ `useUpdateWorklist` with `sample_test_ids`) and a per-card **Remove** button (wires `useRemoveTestFromWorklist`).
- Verified: add 2 → "2 test(s)", remove 1 → "1 test(s)".

### W-4 — dead client code resolved
- **`src/features/lims/SampleDetailPage.tsx`** — wired a **Delete** action (gated `sample.update`, REGISTERED only, `useDeleteSample`).
- Removed unused **`useSampleTest`** (`src/lib/api/testing.ts`) and **`useUpdateStudy`** (`src/lib/api/stability.ts`).
- `useRemoveTestFromWorklist` is now used (W-3). `PUT /samples/:id` edit UI intentionally deferred.

### Docs
- Added `docs/LIMS-module-guide.md` (flow + setup guide) and the §I "disconnected features" backlog in `docs/LIMS-industrial-upgrade-plan.md`.

---

## Session — Workflow canvas rendering fix + delete modal (2026-07-06)

### Workflow detail canvas rendered no node cards (only a stray connector)

**Symptom:** On `/workflows/:id`, an ACTIVE workflow with stages showed an empty canvas with just a floating arrow — no stage cards — even though the "Stages & actions" side panel listed the stages correctly. The builder (`/workflows/:id/builder`) rendered fine.

**Root cause:** `JsPlumbCanvas` renders node `<div>`s via React but hands them to jsPlumb's `manage()`. jsPlumb's `destroy()` → `BrowserJsPlumbInstance.reset()` runs `container.querySelectorAll("[data-jtk-managed], .jtk-endpoint, .jtk-connector, .jtk-overlay").forEach(el => el.remove())`, and jsPlumb tags every managed element with `data-jtk-managed` — including our `.wf-node` divs. So `destroy()` **physically deletes React's node DOM**. Under React 18 `<React.StrictMode>` (`src/main.tsx`), every component mounts twice in dev (mount → unmount → remount); the throwaway unmount fires the effect cleanup → `destroy()` → nodes deleted. On remount the `nodes` array reference is unchanged, so React never rebuilds them → connectors paint, cards don't. Only the read-only detail page showed it — the builder mutates `nodes` on edit, which makes React re-create the DOM and masks the bug.

**Diagnosis:** mounted `JsPlumbCanvas` in isolation via a temporary Vite entry + Playwright, A/B-tested StrictMode on/off (`.wf-node` count 0 vs 2), and patched `Node.prototype.removeChild` to capture the removal stack — which pointed straight at `BrowserJsPlumbInstance.reset()`.

- **`src/features/workflows/builder/JsPlumbCanvas.tsx`** — in the instance-creation effect cleanup, loop `managed` and call `instance.unmanage(el, false)` before `instance.destroy()`. `unmanage(el, false)` strips the `data-jtk-managed` attribute **without** removing the DOM element (removeElement=false), so `reset()`'s selector no longer matches the React node divs and they survive. Also hardens against HMR and any real remount, not just StrictMode.
- Verified with the isolated Playwright repro: StrictMode ON post-fix → 2 cards render ("INITIAL STAGE first" → "STAGE second") + connector, no page errors; StrictMode OFF unregressed. Temp debug harness removed after diagnosis.

### Workflow delete used the native `confirm()` dialog

Deleting a workflow popped the plain browser `confirm()` instead of the app's styled modal. Rewired both pages to the shared `useConfirmDelete()` hook (`src/components/shared/useConfirmDelete.tsx`) — centered Antd `modal.confirm` with red trash icon, Delete/Cancel, mutation + query invalidation + toast.

- **`src/features/workflows/WorkflowsPage.tsx`** — `handleDelete` now calls `confirmDelete({ entityLabel: 'workflow', name, extraWarning, mutate: () => softDelete.mutateAsync(wf.id), invalidateKey: workflowKeys.all, successMessage: 'Workflow deleted' })` instead of `if (!confirm(...)) return`.
- **`src/features/workflows/WorkflowDetailPage.tsx`** — same swap; the post-delete `navigate('/workflows')` is folded into the async `mutate` callback so it only runs on success.

### Workflow detail view — clickable stages with full details

The read-only detail view only listed stage names + a couple of action chips — the actions, attached forms, SLA, and approval policies that already ship in `flow_json` weren't surfaced. Made the canvas interactive: clicking a stage selects it (gold ring) and a side panel renders its full configuration.

- **`src/features/workflows/WorkflowStageDetails.tsx`** (new) — read-only stage inspector. Sections: **Primary/Secondary actions** (status name + behavior + criteria name + allowed role/user counts), **Attached forms** (title, version, required/optional, Fill/View access by name via the denormalized `*Labels` on the binding), **SLA** (human-formatted duration + threshold chips), **Approval policies** (mapped to their action, mode label, quorum count, approver role/user counts, approval SLA hours). Non-stage nodes render a small type stub.
- **`src/features/workflows/WorkflowDetailPage.tsx`** — added `selectedId` state; passes `selectedId`/`onSelect`/`onPaneClick` to `JsPlumbCanvas`. Side panel is now a **Stages** navigator (clickable list, highlights + drives selection, syncs with canvas clicks) plus the selected-stage `WorkflowStageDetails` (or a "select a stage…" hint). Action-criteria ids resolved to names via `useActionCriteria()` (cached lookup). Also computes per-stage incoming/outgoing transition labels from `edges` and passes them to the details panel. Right column widened 320→340px.
- Verified via an isolated Playwright harness with a data-rich mock stage: clicking the node selects it and the panel renders all sections correctly (actions with counts, form with Fill/View names, SLA `2d` + Warning/Breach thresholds, Quorum policy). `tsc --noEmit` (client) → exit 0.

**Follow-up — "actions not showing" + surface everything.** Confirmed against the live DB (read-only Prisma dump of the "testing users" workflow) that its stages genuinely have `primary_actions: []` / `secondary_actions: []` — there are **no actions** to show; the real content is form bindings. So the panel was reworked to make empty state explicit and show all available detail:
- Actions and Attached-forms sections now **always render** with an explicit empty line ("No actions on this stage." / "No forms attached.") so a form-only stage reads as intentional rather than broken.
- Form rows gained a `fillMode` chip ("shared copy" / "one per filler").
- New **Flow** section shows the stage's incoming ("From: …") and outgoing ("To: …") stage names, derived from the graph edges.
- Re-verified with the exact real `flow_json`: stage "first" → `initial` · No actions · Effectiveness Verification (v1, required, shared copy, Fill/View QUALITY_ENGINEER) · Flow To: second.

### Ticket workflow — segmented progress stepper instead of stage cards

Inside a ticket the workflow rendered as a row of bordered stage **cards** (`StageTabs`). Reworked the presentation into a horizontal **progress stepper** — a thin colored bar per stage with the label beneath — matching the requested design.

- **`src/features/tickets/detail/StageTabs.tsx`** — kept the existing data pipeline (deserialize → LR layout → order → `done`/`current`/`upcoming` status, plus click-to-select driving the form-history filter) and replaced only the presentation: each stage is now a full-width `rounded-full` bar (done = `emerald-500`, current = `blue-500`, upcoming = `gray-200`) with a color-matched label below (green / blue-semibold / gray). Dropped the per-card border/badge/connector chrome, the header, and the legend. Selected stage is indicated by a label underline (not a box) to stay clean. Removed now-unused imports (`Check`, `CircleDot`, `Circle`, `Flag`) and the `Legend`/`StageTabButton` components.
- No change to `TicketDetailPage` wiring — same `StageTabs` props, so selection and the `workflowOpen` toggle behave as before.
- Verified via an isolated Playwright harness (seeded React Query so `useWorkflow` serves without an API call — `staleTime: Infinity` avoids the 401→`/login` redirect the axios interceptor otherwise triggers) rendering a 7-stage flow (Initiated…Closed, current = Root Cause): bars and labels match the target design. `tsc --noEmit` (client) → exit 0.

### Submitted form data — render as plain text, not disabled form widgets

The read-only submission viewer (`InlineSubmissionViewer`, used by `RequiredFormsCard` + `SubmittedFormsCard`) re-rendered each answer with `<FieldRenderer … disabled>` — i.e. greyed-out inputs/selects/tables. Hard to read. Now it renders values as document-style text.

- **`src/features/forms/FieldValueText.tsx`** (new) — maps a `FormFieldDef` + submitted value to readable output for every field type: text/textarea/richtext → text (multi-line preserved); number/slider/time → text; range/date_range/time_range → "a – b"; date → `DD MMM YYYY`; select/radio → the option **label** (not the raw stored value); compliance → colored dot + label; checkbox/multi_text → chips; switch → Yes/No; color → swatch + hex; file/image → file icon + name; password → masked; table → a read-only bordered grid with per-column cell formatting. Unknown types fall back to `String(value)`.
- **`src/features/tickets/detail/InlineSubmissionViewer.tsx`** — swapped `FieldRenderer` for `FieldValueText`; the per-field label is now a small uppercase caption above the value, and the "Not answered" placeholder is plain italic text. Removed the `pointer-events-none form-readonly` wrapper. All interactive/builder `FieldRenderer` usages (fill page, preview, builder) are untouched.
- Verified via an isolated Playwright harness across textarea, select, checkbox, date, compliance, switch, file, multi_text, empty, and a table field — all render as clean text/chips/grid (e.g. select "hi" → "High", compliance → red dot "Non-Conformance", table dates formatted, boolean cell → ✓/—). `tsc --noEmit` (client) → exit 0.

**Follow-up — the ticket actually renders the filled form via `FormFillEmbed`, not `InlineSubmissionViewer`.** `StageFormSection` (the component `TicketDetailPage` mounts) renders `FormFillEmbed` with `readOnly` when a form is submitted (or the user is view-only). In `readOnly` mode `FormFillEmbed` was still using `<FieldRenderer … disabled>` (greyed inputs), so the first change had no visible effect on the ticket.
- **`src/features/forms/FormFillEmbed.tsx`** — in the field loop, when `readOnly` render `FieldValueText` (with a plain italic "Not answered" for empty answers) instead of the disabled `FieldRenderer`; the interactive (fill) branch is unchanged. Dropped the `pointer-events-none form-readonly` wrapper.
- Verified end-to-end with a Playwright harness that seeds React Query (`['form', id]` + `['form-submission', id]`) and renders the real `FormFillEmbed` read-only: **0** input/select widgets in the DOM — the submitted form shows as section header + label/value text, compliance dot, multi-select chips, formatted dates, and a read-only table. `tsc --noEmit` (client) → exit 0.

---

# Ticket form access control — gate the stage-form UI on canRead/canFill — 2026-07-06

**Problem:** Inside a ticket, users who were **not** in a form's fill/view group could still see the form's content and type into it. The API already returned per-binding `canRead`/`canFill` (and the submit endpoint enforced access), but the live ticket form component ignored those flags entirely. (Backend half — explicit `isRestricted`, secure-by-default, migration with behaviour-preserving backfill — is in `backend/changes.md`.) Working tree only — **not committed**. Verified: `tests/e2e/ticket-form-access.spec.ts` → **3/3 pass**.

**Root cause (frontend):** `src/features/tickets/detail/StageFormSection.tsx` (the component actually rendered by `TicketDetailPage`) rendered every binding's `FormFillEmbed` regardless of `canRead`/`canFill`, gating only on submitted-status. The correctly-gated `RequiredFormsCard.tsx` existed but was dead code (not wired anywhere).

### `src/features/tickets/detail/StageFormSection.tsx` — Part A gate + restricted notice
- Only forms the user may **read** are shown with content: `bindings = data.bindings.filter(b => b.canRead)`. Non-readable forms are no longer rendered (no chip, no title, no `FormFillEmbed` — so form questions/answers never leak).
- **View-only** forms (`canRead && !canFill`) render **read-only** — `readOnly = isActiveSubmitted || !active.canFill` is passed to `FormFillEmbed`, and the read-only banner now reads "view access (you cannot fill this form)" for that case.
- **Restricted notice instead of a blank panel** (UX follow-up): when the stage has forms but the user can read **none** of them, a locked `Card` is shown — "This stage has a form restricted to other users — you don't have permission to view or fill it. Someone with access will complete it." No form title is leaked.
- **Mixed case:** when the user can read *some* forms but others are restricted, a footer note is appended — "N more form(s) on this stage are restricted to other users."
- Added the `Lock` icon import from `lucide-react`; derived `totalCount` / `restrictedCount` from the unfiltered `data.bindings`.

### Notes
- No change needed to the client stage-form types — `TicketStageFormBinding` already exposed `canRead`/`canFill` (the contract was there; only the component ignored it).
- The submit path was already blocked server-side (403) for restricted forms; this change removes the misleading UI that let unauthorized users view/type before that rejection.

---

# Module breadcrumb — show workflow type name instead of UUID — 2026-07-09

**Problem:** Opening a module page (`/modules/<typeId>`, where `typeId` is the workflow type's UUID) showed the raw UUID in the header breadcrumb instead of the module (workflow type) name. The breadcrumb builder only had a static `breadcrumbMap` and otherwise capitalized the raw path segment, so UUID segments passed straight through.

### `src/components/layout/Header.tsx`
- Detect the `/modules/<typeId>` segment and resolve it to the workflow type name via `useWorkflowTypes()` — the same localStorage-cached list that drives the sidebar's Modules group, so the name is usually available immediately with no extra network flash.
- Mirrors the existing ticket-UUID handling: the UUID segment is **hidden** until it resolves to a name (rather than flashing the raw UUID), then rendered as the workflow type `name`.
- Added the `useWorkflowTypes` import from `@/lib/api/workflowLookups`.
