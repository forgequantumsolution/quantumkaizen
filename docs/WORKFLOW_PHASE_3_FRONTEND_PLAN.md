# Workflow System — Phase 3 Frontend Plan

**Status:** ⏳ Draft — awaiting sign-off
**Owner:** Frontend
**Depends on:** Phase 3 backend complete (approval/SLA APIs + intercept response shape)
**Reference:** `WORKFLOW_PHASE_3_PLAN.md` (backend) + `core-prod-scaling/frontend/src/features/workflow/{ApprovalModal, SlaPanel}`
**Master plan section:** `docs/WORKFLOW_MASTER_PLAN.md` §5

---

## 1. Goal

Surface Phase 3's governance primitives in the UI:

- **On the ticket detail page:** when an action is intercepted by an approval policy, the user sees an "Awaiting approval" card listing remaining approvers; an approver sees a Decide modal with comment field. SLA progress is shown as a colored ring + bar with the next threshold and the deadline.
- **In the workflow builder:** stage / action inspector gains an "Approval policy" tab and an "SLA policy" tab. No new node types needed.
- **A new admin page** for `BusinessCalendar` CRUD (`/admin/business-calendars`) — same shape as the existing workflow-lookups admin.
- **A new dashboard tile** showing tickets with breaching SLAs (top of `/tickets`).

**Out of scope:** real-time push (events are fetched on detail-page mount + on action-bar click; no WebSockets in Phase 3). Email/Slack notification UI lives in Phase 4+.

---

## 2. Stack inventory

No new runtime deps. Reuse:

- `@tanstack/react-query` — already used; new query keys for approvals + sla
- `react-hook-form` + `zod` — for policy editor forms
- `date-fns` + `date-fns-tz` — already in client; used for SLA countdown rendering
- `lucide-react` — icons (`ShieldCheck`, `Timer`, `AlarmClock`, `UserCheck`)

The only addition is **`react-circular-progressbar`** (~5KB) for the SLA progress ring, OR a hand-rolled SVG component (preferred, zero dep).

---

## 3. Cross-cutting decisions

| # | Decision | Default |
|---|---|---|
| FE.Q1 | **SLA polling cadence** on ticket detail | every **30 seconds** while the page is mounted; query is paused when the document is hidden |
| FE.Q2 | **Approval modal entry points** | (a) the existing action button — when the engine returns `pending_approval`, swap the action card for an "Awaiting approval" card; (b) a "Decide" button inside the awaiting card that opens the modal |
| FE.Q3 | **Action button transition** | If a logged-in user is an approver for the open instance, the existing per-action button is replaced inline by a "Decide" button. Other users see a disabled action button + the awaiting card. |
| FE.Q4 | **SLA breached visual** | Red ring + flashing 1× pulse on entry to the page; not auto-dismissing. Threshold-fired uses amber ring + a thin chip badge. |
| FE.Q5 | **Builder inspector tabs** | Add "Approvals" tab (visible when an action is selected) + "SLA" tab (visible when a stage is selected). Existing "Settings" tab stays the default. |
| FE.Q6 | **Policy save semantics** | Approval/SLA policy edits autosave on blur (debounced 800ms), same pattern as the existing layout autosave. The user sees a small saved/saving indicator in the tab header. |
| FE.Q7 | **Optimistic UI for `decide`** | Yes. Mutation immediately marks the user's record as APPROVED in the local cache; rollback on server error. |
| FE.Q8 | **Top-of-page SLA tile on /tickets** | Single card showing count of breaching + threshold-warning tickets in the user's scope; click → filters the ticket list to that subset. |
| FE.Q9 | **Calendar editor UX** | Week grid with start/end pickers per day + a holidays input list (date picker → chip). No FullCalendar dep. |

---

## 4. Module layout

```
client/src/
├── lib/api/
│   ├── approval.ts          // useApprovalPolicies, useApprovalPolicy, useDecideApproval, types
│   ├── sla.ts               // useSlaPolicies, useSlaTimer, useExtendTimer, useSlaTimers (dashboard)
│   └── businessCalendar.ts  // useCalendars, useCalendar, useCreate/Update/Delete
├── features/
│   ├── tickets/
│   │   ├── components/
│   │   │   ├── ApprovalAwaitingCard.tsx   // shows when engine returned pending_approval
│   │   │   ├── ApprovalDecideModal.tsx    // approve/reject with comment
│   │   │   ├── ApprovalsTimeline.tsx      // audit-style list of records on this ticket
│   │   │   ├── SlaProgressRing.tsx        // SVG ring, colored by elapsed%
│   │   │   ├── SlaPanel.tsx               // ring + deadline + last event + extend button
│   │   │   └── SlaExtendModal.tsx
│   │   └── TicketDetailPage.tsx           // gains: <SlaPanel />, <ApprovalAwaitingCard />
│   ├── workflows/
│   │   └── builder/
│   │       └── inspector/
│   │           ├── ApprovalPolicyEditor.tsx  // new tab in StageInspector / action subpanel
│   │           └── SlaPolicyEditor.tsx       // new tab in StageInspector
│   ├── admin/
│   │   ├── business-calendars/
│   │   │   ├── BusinessCalendarsPage.tsx
│   │   │   ├── CalendarForm.tsx        // week grid + holidays
│   │   │   └── CalendarsList.tsx
│   │   └── workflow-lookups/             // unchanged
│   └── dashboard/
│       └── components/
│           └── SlaBreachTile.tsx          // top-of-list summary on /tickets
└── shared/hooks/
    └── useCountdown.ts                    // 1-Hz interval; pauses when doc hidden
```

---

## 5. API client modules

### 5.1 `lib/api/approval.ts`

```ts
export type ApprovalMode = 'SINGLE' | 'ALL_REQUIRED' | 'QUORUM' | 'SEQUENTIAL' | 'ANY';

export type ApprovalPolicy = {
  id: string;
  workflowId: string;
  stageId: string;
  actionId: string;
  mode: ApprovalMode;
  requiredCount: number;
  allowSelfApproval: boolean;
  approverRoles: { id: string; name: string }[];
  approverUsers: { id: string; name: string; email: string }[];
  approvalSlaHours: number | null;
};

export type ApprovalInstance = {
  id: string;
  ticketId: string;
  policyId: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  startedAt: string;
  completedAt: string | null;
  deadlineAt: string | null;
  records: ApprovalRecord[];
  remaining: { roles: string[]; users: string[] };  // computed server-side
};

export const useApprovalPoliciesForWorkflow = (workflowId: string) =>
  useQuery({ queryKey: ['approval-policies', workflowId], ... });

export const useTicketApprovals = (ticketId: string) =>
  useQuery({ queryKey: ['ticket-approvals', ticketId], ... });

export const useDecideApproval = (instanceId: string) =>
  useMutation({ mutationFn: ({ decision, comment }) => ... });

export const useUpsertApprovalPolicy = (workflowId: string) => useMutation({...});
export const useDeleteApprovalPolicy = () => useMutation({...});
```

### 5.2 `lib/api/sla.ts`

```ts
export type SlaTimerStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'BREACHED';

export type SlaPolicy = {
  id: string;
  parentStageId: string;
  duration: number;            // seconds
  calendarId: string | null;
  pauseOnHold: boolean;
  thresholds: { id: string; percentage: number; targetSlaStageId: string | null }[];
};

export type SlaTimer = {
  id: string;
  ticketId: string;
  stageId: string;
  status: SlaTimerStatus;
  startedAt: string;
  pausedAt: string | null;
  deadline: string;
  completedAt: string | null;
  totalPausedSec: number;
  lastFiredPercentage: number | null;
  events: SlaTimerEvent[];
};

export const useTicketSla = (ticketId: string) =>
  useQuery({
    queryKey: ['ticket-sla', ticketId],
    refetchInterval: (q) => (document.hidden ? false : 30_000),
    ...
  });

export const useExtendTimer = (timerId: string) => useMutation({...});
```

### 5.3 `lib/api/businessCalendar.ts`

Mirrors `workflowLookups.ts` shape — just `useCalendars`, `useCalendar(id)`, `useCreate/Update/Delete`.

---

## 6. Ticket detail page additions

### 6.1 `<SlaPanel />`

Renders only when `useTicketSla` returns a timer for the current stage:

```
┌────────────────────────────────────────────┐
│ SLA — Submit                          ⏵    │
│  ╭───╮                                     │
│  │72%│   2h 14m  remaining                 │
│  ╰───╯   deadline: 2026-05-10 18:00 IST    │
│                                            │
│  Last threshold: 50% fired 1h ago          │
│  [ Request extension ]                     │
└────────────────────────────────────────────┘
```

- Ring colors: green (<50%), amber (50–80%), red (≥80% or BREACHED).
- The countdown text uses `useCountdown(deadline)` — 1-Hz interval, pauses on `document.hidden` (saves laptop battery).
- "Request extension" opens `<SlaExtendModal />` (form: hours + reason).
- If `status = 'PAUSED'`: ring shows pause glyph; deadline label adds "(paused, +X paused so far)".
- If `status = 'BREACHED'`: red ring, `Breached 1h ago` label.

### 6.2 `<ApprovalAwaitingCard />`

Replaces the per-action button row when the engine response was `pending_approval`:

```
┌────────────────────────────────────────────┐
│ ⓘ Awaiting approval                        │
│   Mode: ALL_REQUIRED · 1 of 2 received     │
│   Pending: Quality Engineer (any 1)        │
│                                            │
│   Records:                                 │
│   ✔ Alice (QE)  approved · 12m ago         │
│                                            │
│   [ Decide ]   ← only if you're an approver│
└────────────────────────────────────────────┘
```

- Approval state is loaded from `useTicketApprovals(ticketId)`. The page mounts both queries in parallel.
- The "Decide" button is hidden if the user already has a record on the open instance, or isn't in the `remaining.users`/`remaining.roles` set.
- For `SEQUENTIAL` mode: the awaiting card surfaces "Up next: Bob (DocController)" instead of "Pending …".

### 6.3 `<ApprovalDecideModal />`

```
┌────────────────────────────────────────────┐
│ Decide approval                       [×]  │
│                                            │
│ Action: Approve / Forward                  │
│ Stage:  Review                             │
│                                            │
│ ( ) Approve                                │
│ (•) Reject                                 │
│                                            │
│ Comment (optional):                        │
│ [                                       ]  │
│                                            │
│              [ Cancel ]  [ Submit ]        │
└────────────────────────────────────────────┘
```

- Form: `react-hook-form` + Zod; comment max 500 chars.
- On submit: `useDecideApproval(instanceId).mutate(...)` with optimistic update — instance.records is patched in-cache to add the user's record immediately; rollback on error.
- On policy-now-satisfied response: show "Approved — moving to next stage" toast, refetch `useTicket(ticketId)`.

### 6.4 `<ApprovalsTimeline />`

Tab beside the existing "Comments" + "Audit" tabs on the ticket detail page. Shows all instances for this ticket (open + closed), each instance expandable to its `ApprovalRecord` list.

---

## 7. Builder inspector tabs

`InspectorPanel.tsx` currently switches on `kind` (stage / fork / join / decision). Phase 3 adds two **sub-tabs** inside the inspector:

```
┌── Inspector ──────────────────────────────┐
│ [ Settings ] [ Approvals ] [ SLA ]   ✓saved│
└────────────────────────────────────────────┘
```

### 7.1 `<ApprovalPolicyEditor />`

- Visible **when an action is selected within a stage** (drill-down from the Settings tab's action list).
- Mode select (5 options) → conditionally shows: requiredCount (QUORUM only); approvalSequence builder (SEQUENTIAL only); allowSelfApproval / requireUniqueApprovers booleans; approvalSlaHours (number).
- Approver picker: two combobox lists (roles + users), seeded by `useRoles()` + `useUsers()`.
- Save: autosaves on field blur (FE.Q6) — calls `useUpsertApprovalPolicy(workflowId)`.

### 7.2 `<SlaPolicyEditor />`

- Visible **when a stage is selected** (one policy per stage, master plan).
- Fields: duration (hours + minutes input → converts to seconds for the API), calendar select (`useCalendars()`), pauseOnHold checkbox, responsible roles/users pickers.
- Thresholds: a small editable list — add row → percentage (0–100), optional target stage (select from this workflow's stages excluding the current one), notify roles/users.
- Same autosave pattern.

### 7.3 Status indicators on the canvas

Stage nodes that have an SLA policy get a small ⏱ badge in the corner.
Action chips that have an approval policy get a small ✔ badge.
(Both are pulled from `useWorkflow(id)` so no extra round-trip.)

---

## 8. Admin: Business Calendars

`/admin/business-calendars` — new route. Same wrapper / table convention as `/admin/workflow-lookups`.

- List page: table of calendars (name, timezone, isActive), with row actions "Edit" / "Soft delete".
- Edit form (`<CalendarForm />`):
  - Name + timezone (select from `Intl.supportedValuesOf('timeZone')`)
  - Week grid: 7 rows (Mon–Sun) × `[start, end]` time pickers, or a "Day off" toggle
  - Holidays: list of dates (date picker + add → chip; click chip ✕ to remove)
  - Save button — single PATCH; cache invalidation triggers list refetch

---

## 9. Test plan (manual smoke + Playwright)

### 9.1 Manual smoke

| Step | Expected |
|---|---|
| 1. Open builder for the seeded "Document Review v1" workflow | Builder loads, Submit stage shows ⏱ badge (SLA seeded), Review stage's Approve action shows ✔ badge (Approval seeded) |
| 2. Open Settings tab → SLA tab on Submit | Form pre-filled with 4h duration, default-24x7 calendar, one 75% threshold |
| 3. Raise a fresh ticket via `/tickets` modal | Detail page opens; SlaPanel shows "Submit — 4h 0m remaining", green ring |
| 4. Click "Approve / Forward" on Submit | Ticket transitions to Review; SlaPanel disappears (no SLA on Review); ApprovalAwaitingCard appears with "ALL_REQUIRED · 0 of 2 received" |
| 5. Decide as Alice (QE) | Records "Alice approved"; awaiting card updates "1 of 2 received"; Bob still listed in remaining |
| 6. Decide as Bob (QE) | Toast "Approved — moving to next stage"; ticket advances; awaiting card unmounts |
| 7. Hold the ticket on Submit (separate test) | SlaPanel ring shows pause glyph; deadline label "+0s paused" then ticks |
| 8. Unhold | Ring resumes counting; `totalPausedSec` increases as expected |
| 9. Wait past 75% threshold (or stub clock) | Ring turns amber; "Last threshold: 75% fired Xs ago" appears |
| 10. Wait past deadline | Ring red; "Breached" label; if `targetSlaStageId` set, ticket auto-transitions |

### 9.2 Playwright (`e2e/phase3.spec.ts`)

- Login → seeded workflow → raise ticket → assert SlaPanel renders with expected initial values
- Approver flow: log in as Alice → click Decide → Approve → assert toast + DOM update
- Reject flow: 1st approves, 2nd rejects → assert `Awaiting approval` card disappears, ticket walks back

(Builds on the existing `e2e/perf.spec.ts` infra — same auth helpers, same `request` fixture for setup.)

---

## 10. Effort estimate

| Slice | Effort |
|---|---|
| API client modules (approval + sla + calendar) | 0.5 d |
| Ticket detail additions (SlaPanel, ApprovalAwaitingCard, modals) | 1.5 d |
| Builder inspector tabs (ApprovalPolicyEditor + SlaPolicyEditor + canvas badges) | 1.5 d |
| BusinessCalendars admin page | 0.5 d |
| Dashboard SLA breach tile | 0.25 d |
| Manual smoke + Playwright suite | 0.75 d |
| **Total** | **~5 days, ~2,500 LoC** |

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| **Polling cadence** — 30s feels stale for breach situations | Surface `useCountdown` ticks at 1Hz so the user *feels* the timer move; the underlying SLA refetch is still 30s, but the visible second-by-second updates are local. |
| **Action button vs awaiting card** swap can flicker on slow networks | Use `useTicketApprovals` as a direct gate: render the awaiting card if `instances.some(i => i.status === 'PENDING')`, otherwise render the existing action bar. No race window. |
| **Builder inspector autosave** could confuse — invalid form state saved as junk | Block autosave on validation errors; show a non-blocking "Fix these to save" tag. |
| **Calendar TZ confusion** — server stores UTC times, user sees local | Render every deadline + event time using the calendar's `timezone` (with a hover tooltip showing UTC). |

---

## 12. Phase 3 FE → Phase 4 FE handoff

Phase 4 inherits this UI surface unchanged. New additions in Phase 4:

- `<SignatureModal />` — replaces `<ApprovalDecideModal />`'s submit when the action requires signature
- An **Audit log** tab on the ticket detail page (we already left a tab slot)
- Hash-chained log viewer in `/audit-log` (already a route, currently a placeholder)

No Phase 3 component changes needed for Phase 4.

---

## 13. Deliverable checklist

- [ ] `lib/api/approval.ts`, `lib/api/sla.ts`, `lib/api/businessCalendar.ts`
- [ ] `<SlaPanel />` + `<SlaProgressRing />` + `useCountdown`
- [ ] `<ApprovalAwaitingCard />` + `<ApprovalDecideModal />` + `<ApprovalsTimeline />`
- [ ] `<ApprovalPolicyEditor />` + `<SlaPolicyEditor />` integrated into `InspectorPanel`
- [ ] Stage / action canvas badges (⏱ / ✔)
- [ ] `/admin/business-calendars` page + form
- [ ] `<SlaBreachTile />` on `/tickets`
- [ ] Routing updates in `App.tsx` (calendars route)
- [ ] `npx tsc --noEmit` clean on client
- [ ] `npm run build` clean
- [ ] Manual smoke checklist green
- [ ] `e2e/phase3.spec.ts` 3+ tests green against a fresh seeded DB
- [ ] `workflow-changes.md` Phase 3 frontend section filled in

---

## 14. Sign-off needed

Decisions to confirm before implementation starts:

- **FE.Q1** (poll cadence) — 30s OK or shorter for the demo?
- **FE.Q4** (breach pulse) — single pulse or persistent flashing? I'd push back on flashing (accessibility).
- **FE.Q6** (autosave on policy edits) — same pattern as the layout autosave; OK or do we want explicit Save buttons on these forms?
- **FE.Q9** (calendar editor without FullCalendar) — confirms no new heavy dep.
