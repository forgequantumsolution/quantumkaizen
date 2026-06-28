# Workflow System — Per-Form Access Control (Fill / View / Each-One) Plan

**Status:** 📝 Draft — not started
**Owner:** Backend + Frontend (single vertical slice)
**Depends on:** Phase 3.5 Forms Integration (`StageFormBinding`, embed-in-JSON canvas architecture), workflow access layer (`engine/access.layer.ts`), the approval-policy precedent (`ApprovalPolicy.approverRoles/approverUsers`), workflow versioning
**Reference precedents in-repo:**
- `WorkflowStageAction.allowedRoles/allowedUsers` + `engine/access.layer.ts#assertCanPerformAction` — action execution access
- `ApprovalPolicy.approverRoles/approverUsers` + `inspector/ApprovalPolicyEditor.tsx` — role/user picker UI + materialization
- `engine/form.layer.ts#findUnsatisfiedRequiredForms` — the required-form transition gate (will change for "Each one")

---

## 1. Goal

Today a stage's **actions** can declare who may perform them and who must approve them. **Forms attached to a stage have no access control** — any user who can see the ticket can read every attached form, and anyone with the global `form_submission.create` permission can fill any of them.

This change gives **each attached form (each `StageFormBinding`)** its own access configuration, set when the form is attached (and editable later). The configuration has **four parts**:

1. **Fill roles** (multi-select, **required — at least one**) — roles whose members may fill the form.
2. **Fill users** (multi-select, optional) — specific people who may fill, on top of the roles.
3. **Fill mode** — **Anyone** or **Each one** (defined in §2).
4. **View-only** roles + users (multi-select, optional) — people who may **see** the form and its submissions but may **never** fill it.

All four lists support a mix of roles and individual users, exactly like `ApprovalPolicy`.

### Confirmed product decisions
- **Editing access creates a new workflow version (§9).** Access config is not hot-patched on a live workflow. The Edit button changes the canvas draft; publishing produces a new version through the existing edit→publish→version path — same as changing an approver or an action today.
- **Role is required for fill (§7).** You must pick ≥1 fill role when attaching a form. Fill users and the view-only list are optional.
- **Read denial → locked, not hidden (§8.5/§9.2).** A user with no access still sees the form *row* on the ticket (lock icon, "No access", no buttons) so a blocking required form is never invisible. Its content/responses are never delivered to them.
- **"Each one" blocks until ALL copies are in (§8.4).** A required "Each one" form keeps the stage blocked until every expected person has submitted their own copy.
- **"Each one" expands roles per-person (§2).** One copy is required from *each member* of each selected fill role, plus each named fill user.
- **A separate View-only group exists (§2).** Distinct from fillers — view-only people can read but never fill, in either mode.
- **Full-stack in this pass** — schema, canvas, builder UI, publish materialization, runtime enforcement, frontend gating.

### Out of scope (deferred)
- **Per-field** access/visibility. Field-level `dependency` (conditional show/hide) already exists and is unrelated.
- **Standalone (non-workflow) form fills** (`dynamic-form/submission.*`) — no stage/binding context; behavior unchanged.
- **Snapshotting "Each one" membership at stage entry** — we compute the expected-submitter set dynamically from current role membership (§2, Q3).
- **Cross-stage / per-action form scoping** — bindings remain per `(stage, form)`.

---

## 2. Access model & semantics (the rules every combination must obey)

Per binding we store two audiences and a mode:

- **Fill group** `F` = (fill roles ∪ fill users). **Required to be non-empty** at author time.
- **View-only group** `V` = (view roles ∪ view users). Optional.
- **Fill mode** ∈ { `ANYONE`, `EACH` }.

For a user `u` (where `u ∈ G` means u's `roleId` is in G's roles **or** u's id is in G's users):

```
canFill(u) = u ∈ F                       // only the fill group may fill; view-only never fills
canRead(u) = u ∈ F  OR  u ∈ V            // fillers can always read; view-only can read
            (SUPER_ADMIN → canRead = canFill = true, matching approval.layer.ts)
u not in F and not in V → no access → locked row on the ticket
```

**Precedence:** if a user is somehow in both F and V (e.g. their role is view-only but they're a named filler, or two of their roles land on each side), **Fill wins** — being able to fill implies being able to read, so they get fill rights.

### Fill mode

| Mode | Copies | Who completes it | Required-form gate (when `isRequired`) |
|---|---|---|---|
| **Anyone** | **One** shared copy | Any single member of `F` | Satisfied once **one** member of `F` has a `SUBMITTED` copy since stage entry |
| **Each one** | **One copy per person** | **Every** member of `F`, expanded per-person | Satisfied only when **every expected submitter** has their own `SUBMITTED` copy since stage entry |

**"Each one" expected-submitter set `S`:** expand every selected fill **role** to its current member users, union with the named fill **users**. `S` is the set of people each owing one copy. View-only people are never in `S`. `S` is computed **dynamically** from current role membership at gate-check time (so people who join/leave a role are added/removed naturally — see Q3 for the snapshot alternative).

### Every combination, verified

| F (fill) | V (view-only) | Mode | Behavior |
|---|---|---|---|
| {RoleA} | — | Anyone | Any RoleA member fills one copy; nobody else sees it |
| {RoleA} | {RoleB} | Anyone | Any RoleA member fills; RoleB sees it read-only |
| {Maker} | {Auditor} | Anyone | Maker fills, Auditor read-only — the classic maker/checker |
| {RoleA(5 ppl), userX} | — | Each one | 6 copies required (5 role members + userX); stage blocked until all 6 in |
| {RoleA} | {RoleA} | any | Conflict resolved by precedence → RoleA can fill (Fill wins) |
| {RoleA} | — | Each one | One copy per RoleA member; if RoleA has 1 member, behaves like Anyone-with-1 |

**Invariants the implementation must preserve:**
- Nobody can fill without being able to read (`canFill ⇒ canRead`, by construction).
- View-only users never appear in `S` and are always rejected by the fill gate.
- A user in neither group gets a locked row, never form content.

### Backward compatibility (important)
Forms attached **before** this feature have **no** fill roles saved. To avoid breaking them, the enforcement helper treats **an empty fill group as "legacy open"**: everyone can read and fill, mode = Anyone. The "role required" rule is enforced **only in the builder UI** for new/edited bindings (and as a soft Zod rule — see §4.2), *not* as a hard DB constraint, so old workflows still load, save, and re-publish.

---

## 3. Data model — `backend/prisma/schema.prisma`

Add an enum and five fields to `StageFormBinding` (four M2M relations + one mode), mirroring `WorkflowStageAction`/`ApprovalPolicy`:

```prisma
enum FormFillMode {
  ANYONE
  EACH
}

model StageFormBinding {
  // ... existing fields ...
  fillMode FormFillMode @default(ANYONE)

  allowedFillRoles Role[] @relation("FormBindingFillRoles")
  allowedFillUsers User[] @relation("FormBindingFillUsers")
  allowedViewRoles Role[] @relation("FormBindingViewRoles")   // read-only viewers
  allowedViewUsers User[] @relation("FormBindingViewUsers")
}
```

Add the four inverse relation fields on `Role` and `User`. Generate a migration: adds one enum, one column (`fillMode`, defaults `ANYONE`), four implicit M2M join tables. **No backfill** — existing bindings get `fillMode = ANYONE` and empty groups, which the helper reads as "legacy open" (§2). Purely additive and reversible.

**No new `FormSubmission` fields needed** — it already has `submittedById` + `bindingId` + `@@index([bindingId])`, which is everything "Each one" per-person tracking requires.

**Why on the binding, not the form?** Access is contextual to the placement — the same form on two stages can have different audiences — exactly like `isRequired`/`position` and `ApprovalPolicy(stageId, actionId)`.

---

## 4. Canvas state & validation

### 4.1 Frontend type — `client/src/features/workflows/builder/builder.types.ts`
```ts
export type FormFillMode = 'ANYONE' | 'EACH';

export interface EmbeddedFormBinding {
  formId: string;
  isRequired: boolean;
  position: number;
  formTitle?: string;
  formVersion?: number;
  // NEW
  fillMode: FormFillMode;            // default 'ANYONE'
  fillRoleIds: string[];            // required ≥1 (UI-enforced)
  fillUserIds: string[];
  viewRoleIds: string[];
  viewUserIds: string[];
  // NEW — denormalized labels for inspector display (same idea as formTitle).
  fillRoleLabels?: { id: string; name: string }[];
  fillUserLabels?: { id: string; name: string }[];
  viewRoleLabels?: { id: string; name: string }[];
  viewUserLabels?: { id: string; name: string }[];
}
```

### 4.2 Backend Zod — `backend/src/modules/workflow/workflow.schema.ts`
```ts
const EmbeddedFormBindingSchema = z.object({
  formId: z.string().uuid(),
  isRequired: z.boolean().default(true),
  position: z.number().int().min(0).max(1000).default(0),
  fillMode: z.enum(['ANYONE', 'EACH']).default('ANYONE'),
  // NOTE: NOT .min(1) — kept permissive so pre-feature workflows (empty fill
  // group = legacy-open) still validate on re-publish. "≥1 role" is enforced
  // in the builder UI for new/edited bindings only. See §2 back-compat.
  fillRoleIds: z.array(z.string().uuid()).max(200).default([]),
  fillUserIds: z.array(z.string().uuid()).max(200).default([]),
  viewRoleIds: z.array(z.string().uuid()).max(200).default([]),
  viewUserIds: z.array(z.string().uuid()).max(200).default([]),
});
```
Denormalized `*Labels` are display-only; `NodeSchema.data` is already `.passthrough()`, and the builder strips them when materializing.

---

## 5. Builder UI — `client/src/features/workflows/builder/inspector/`

### 5.1 `StageFormBindingEditor.tsx` — four access controls + mode
Below the Form picker + Position/Required row, add (reusing the Antd `mode="multiple"` + debounced search + label-cache pattern from `ApprovalPolicyEditor.tsx` lines 226–273, with `useRoles()` / `useAdminUsers()`):

1. **Fill — roles** (required; show inline error if empty on save)
2. **Fill — users** (optional)
3. **Fill mode** — segmented control / radio: **Anyone** vs **Each one**, with helper copy:
   - Anyone: *"One shared copy. Any of the people above can fill it."*
   - Each one: *"A separate copy for each person (every member of the selected roles, plus named users). The stage won't advance until everyone has submitted."*
4. **View only — roles** and **View only — users** (optional), helper: *"Can see the form and its responses, but can never fill it."*

Validation on Save: ≥1 fill role (toast + inline error). On attach, populate all id arrays **and** denormalized `*Labels` from the picker's in-hand option rows (no extra query).

### 5.2 Add-or-Edit mode (new capability)
Today the editor is **add-only** (`onAdd`); the inspector list only supports remove. Per the product decision, add a proper **Edit**:
- `StageInspector` Forms list (lines 377–415) gains an **Edit** button per form, opening the editor seeded with that binding (`value?: EmbeddedFormBinding`, `index?: number`).
- Editor calls `onSave(binding, index?)`; inspector **replaces** at index when editing, **appends** when adding.
- Keep `excludedIds` for the form dropdown but **don't exclude the form currently being edited**.
- Editing access mutates the canvas draft → on publish, a **new workflow version** is created by the normal flow (§9). Surface a subtle "Editing this form's access will create a new workflow version on publish" hint to set expectations.

### 5.3 Inspector summary
Under each form row, render a compact summary, e.g.:
`Fill: QA Team, +2 · Each one · View: Auditors`. Counts from id arrays, names from denormalized labels with "+N" overflow. Keep the amber/required affordance.

---

## 6. Publish materialization — `backend/src/modules/workflow/workflow.builder.ts`

`createMany` can't express M2M `connect`, so switch binding creation (lines 210–225) from the bulk push to **per-row `create`** inside the Phase-3 materialization block, mirroring how `ApprovalPolicy` is already created (lines 401–430):

```ts
for (const fb of embeddedForms) {
  await tx.stageFormBinding.create({
    data: {
      workflowId, stageId, formId: fb.formId,
      isRequired: fb.isRequired ?? true,
      position: fb.position ?? 0,
      fillMode: fb.fillMode ?? 'ANYONE',
      allowedFillRoles: connectIds(fb.fillRoleIds),
      allowedFillUsers: connectIds(fb.fillUserIds),
      allowedViewRoles: connectIds(fb.viewRoleIds),
      allowedViewUsers: connectIds(fb.viewUserIds),
    },
  });
}
// connectIds(ids) => ids?.length ? { connect: ids.map(id => ({ id })) } : undefined
```

**Stale-id resilience:** a referenced role/user could be deleted between authoring and publish; Prisma `connect` to a missing id **throws and aborts the whole publish**. Before connecting, resolve ids against existing `Role`/`User`, drop missing ones, and `warnings.push(...)` (e.g. *"Form '{title}' fill-access referenced 1 missing user — skipped"*), exactly like the stale approval-action-ref warning (lines 395–399). If a binding ends up with **zero** valid fill roles+users after pruning, push a louder warning (it will read as "legacy open" at runtime — call that out).

---

## 7. Round-trip on load — `backend/src/modules/workflow/workflow.service.ts`

So edit→republish **preserves** access (otherwise it silently wipes — highest-risk path):
- **`workflowDetailSelect.stages.formBindings.select`** (lines 117–126): add `fillMode` and the four relations:
  ```ts
  fillMode: true,
  allowedFillRoles: { select: { id: true, name: true } },
  allowedFillUsers: { select: { id: true, name: true } },   // match the name/email shape used elsewhere
  allowedViewRoles: { select: { id: true, name: true } },
  allowedViewUsers: { select: { id: true, name: true } },
  ```
- **`toFlowJson` formBindings map** (lines 238–244): emit `fillMode`, the four `*Ids` arrays, and the denormalized `*Labels`, mirroring how `approverRoleIds/approverUserIds` (lines 179–180) and `formTitle/formVersion` are emitted.

---

## 8. Runtime enforcement — `backend/src/modules/stage-form/` + `engine/form.layer.ts`

### 8.1 New helper — `stage-form.access.ts` (new file, modeled on `engine/access.layer.ts`)
```ts
isLegacyOpen(binding): boolean                       // fill group empty ⇒ true (back-compat)
canReadForm(tx, binding, userId): Promise<boolean>   // F ∪ V, SUPER_ADMIN, legacy-open
canFillForm(tx, binding, userId): Promise<boolean>   // F only (Fill wins over View), legacy-open
assertCanFillForm(tx, binding, userId): Promise<void>// throws Forbidden if !canFill
assertCanReadForm(tx, binding, userId): Promise<void>// throws Forbidden if !canRead
expectedSubmitterIds(tx, binding): Promise<string[]> // EACH mode: role members ∪ fill users (current membership)
```
Loads caller `{ roleId, role.name }` once (cache within request like `approval.layer.ts`). `binding` must arrive with the four relations + `fillMode` selected.

### 8.2 Fill gate — `stage-form.service.ts#createWorkflowSubmission` (lines 262–355)
After existing binding/stage validation, before creating the submission, load the binding's access relations and call `assertCanFillForm(tx, binding, submittedById)`. Applies to both `IN_PROGRESS` (save draft) and `SUBMITTED`. In **EACH** mode additionally assert the submitter is in `expectedSubmitterIds` (a fill-role member or named fill user) — which `assertCanFillForm` already covers, but document that each person's submission is *their own* copy (don't merge).

### 8.3 Read gate — `stage-form.service.ts#listForTicket` (lines 159–252)
- Select the four relations + `fillMode`; thread the requesting `userId` in from the controller (`req.user.id`) — currently it only takes `ticketId`.
- Per binding compute `canRead`, `canFill`, and for EACH mode the **progress**: `expectedCount`, `submittedCount`, `submittedByMe` (distinct `SUBMITTED` submitters among `S` since stage entry).
- **Do not drop** unreadable bindings (locked-row decision) but for `canRead === false` **null out `latestSubmission`/responses** so nothing leaks.

### 8.4 Required-form gate — `engine/form.layer.ts#findUnsatisfiedRequiredForms` (rewrite)
Currently "one `SUBMITTED` row since entry ⇒ satisfied". Generalize per mode:
- **Anyone:** satisfied if **≥1** `SUBMITTED` copy exists since `enteredAt` from **a member of `F`** (ignore submissions by non-fillers — shouldn't exist given the fill gate, but be defensive).
- **Each one:** compute `S = expectedSubmitterIds(binding)`; satisfied only if **every** `u ∈ S` has a `SUBMITTED` copy with `submittedById = u` since `enteredAt`. Otherwise unsatisfied, and the returned payload should carry progress (`submitted/total`) so the UI/ActionBar can show "3 of 5 submitted".
- Legacy-open binding (empty F): keep old behavior (any one `SUBMITTED` since entry).
- Keep the existing per-visit `enteredAt` logic (RETURN re-opens a fresh requirement) untouched.

**Edge — a required EACH submitter leaves the role:** because `S` is computed from *current* membership, they drop out of `S` and stop blocking. (If we ever snapshot `S` at entry — Q3 — a departed member would deadlock the stage; current dynamic approach avoids that.)

### 8.5 Single-submission read — `dynamic-form/submission.service.ts#get` (lines 104–111)
Serves both standalone and workflow-bound submissions. If `bindingId` present (workflow-bound), load the binding's access and `assertCanReadForm`; standalone (no binding) keeps current behavior. Closes the direct-URL bypass.

---

## 9. Workflow versioning — editing access bumps the version

Per the product decision, changing a form's access must produce a **new workflow version**, not mutate the live one. This already falls out of the embed-in-JSON architecture: the Edit button changes `node.data.formBindings` on the **draft** canvas; **Publish** re-materializes everything into a new version — the same path that already versions an approver change, an action change, or an SLA change.

**Action items:**
- Confirm the publish/versioning flow (the `WorkflowStatus` `DRAFT_UPDATE` path + the `version` field added in the recent commit) treats a `formBindings` diff as a real change that increments the version — i.e. editing access on a published workflow puts it into the "draft update → publish new version" lane and isn't silently dropped.
- If publish has any "skip unchanged stages" optimization, make sure a binding-only diff (same form, changed access) is detected as changed.
- The builder hint in §5.2 sets the user's expectation that Save→Publish creates a version.

*(If we later want access edits to bump the version even without a full re-publish, that's a bigger change to the versioning trigger — flagged as Q5, not planned here.)*

---

## 10. Frontend runtime — ticket detail

### 10.1 `RequiredFormsCard.tsx` (lines 56–156)
Drive each row off `canRead` / `canFill` / mode / progress from `listForTicket`:
- `!canRead` → **locked row**: lock icon, title, "No access", no buttons.
- `canRead && !canFill` → **View** only (read submitted content), never Fill/Resume.
- `canFill`, **Anyone** mode → existing logic: `Submitted → View`, `IN_PROGRESS → Resume`, else `Fill`.
- `canFill`, **Each one** mode → show **progress** ("3 of 5 submitted") and a CTA for *the current user's own copy*: if `submittedByMe` → **View your copy**; if a personal draft exists → **Resume**; else **Fill your copy**. Optionally let authorized viewers expand to see whose copies are in/out.

### 10.2 Fill page defense-in-depth — `FormFillPage.tsx` / `FormFillEmbed.tsx`
The fill page is reachable by direct URL. Backend §8.2 already blocks bad submits, but for UX: have the page learn `canFill` for `(ticketId, bindingId)` (reuse the stage-forms query) and force `readOnly` + hide submit when `!canFill`; show a "no access" state when `!canRead`.

### 10.3 API client types — `client/src/lib/api/stageForm.ts`
Add `fillMode`, the four access arrays (or at least derived `canRead`/`canFill`/`progress`) to `StageFormBinding` / `TicketStageFormBinding`.

### 10.4 ActionBar
The transition-blocking ActionBar already reacts to unsatisfied required forms. With EACH mode it should reflect the aggregate ("2 required form copies outstanding") from the §8.4 payload — verify it reads the generalized result.

---

## 11. Scenario checklist (verify implementation against each)

**Config / builder**
1. Attach with fill={QA}, mode=Anyone, no view-only → any QA fills one copy; others no access. ✅
2. Attach with fill roles empty → **UI blocks save** ("pick at least one fill role"). ✅ §5.1.
3. Attach with fill={Maker}, view-only={Auditor}, Anyone → Maker fills, Auditor read-only. ✅
4. Attach with fill={QA(5)}, mode=Each one, required → 5 copies needed; stage blocked till all 5. ✅ §8.4.
5. User in both fill and view-only lists → can fill (Fill wins). ✅ §2 precedence.
6. Edit an existing form's access, publish → **new workflow version** created. ✅ §9. **Test explicitly.**
7. Author references a role/user, it's deleted before publish → publish doesn't crash; warning surfaced. ✅ §6.
8. Save draft with full access config, reload builder → all four lists + mode round-trip intact. ✅ §7.
9. Re-edit a published workflow & re-publish → access preserved, not wiped. ✅ §7. **Highest-risk path.**

**Runtime — read**
10. View-only user opens ticket → sees form, can View submitted content, no Fill. ✅
11. User in no list → locked row, no content, no buttons (even if the form is required & blocking). ✅
12. Direct GET of a submission by a non-reader → 403. ✅ §8.5.
13. `latestSubmission`/responses not leaked to non-readers in the list response. ✅ §8.3.

**Runtime — fill, Anyone**
14. One filler submits → required gate clears for everyone. ✅
15. View-only user attempts submit via API → 403. ✅ §8.2.
16. Read-only/no-access user on the fill page → read-only or no-access screen, no submit. ✅ §10.2.

**Runtime — fill, Each one**
17. 4 of 5 submitted → stage still blocked; card shows "4 of 5". ✅ §8.4/§10.1.
18. All 5 submit their own copies → gate clears. ✅
19. A 6th person added to the fill role mid-stage → now 6 expected (dynamic S); card updates. ✅ §2/Q3.
20. A required submitter leaves the role mid-stage → drops out of S; remaining copies unblock. ✅ §8.4 edge.
21. Same user tries to submit twice → second is their updated copy, not a new required slot (count is by distinct submitter). ✅ verify de-dupe by `submittedById`.
22. After RETURN re-enters the stage → fresh round; prior visit's copies don't satisfy. ✅ existing `enteredAt`.

**Gate / engine / compat**
23. SUPER_ADMIN reads & fills everything regardless of lists. ✅ §8.1.
24. Pre-feature binding (empty fill group) behaves exactly as today: everyone reads & fills, Anyone. ✅ legacy-open.
25. Old canvas JSON (no new keys) validates and round-trips (Zod defaults). ✅ §4.2.
26. Standalone (non-workflow) fills unaffected. ✅ out of scope.

---

## 12. Open questions (defaults recommended)

| # | Question | Default | Alternatives |
|---|---|---|---|
| Q1 | View-only vs fill conflict (a user in both) | **Fill wins** (filling implies reading) | View wins (would let an explicit filler be blocked — rejected) |
| Q2 | Empty fill group (legacy rows) | **Treated as "open to all", Anyone** for back-compat; UI requires ≥1 for new | Hard DB `NOT NULL`/check (breaks old workflows — rejected) |
| Q3 | "Each one" expected-submitter set | **Dynamic** from current role membership at check time | Snapshot at stage entry (stable, but a departing member can deadlock; needs storage) |
| Q4 | "Each one" with `isRequired=false` | Everyone *may* fill their own copy, **nothing blocks** | Disallow Each-one on optional forms (simpler but less flexible) |
| Q5 | Does access-edit bump version only on publish, or immediately | **On publish** (normal flow) | Force a version bump the moment access changes (bigger versioning change) |
| Q6 | Binding creation on publish | **Per-row `create`** (mirrors ApprovalPolicy) | `createMany` + join inserts (rejected) |

---

## 13. File-change manifest

**Backend**
- `prisma/schema.prisma` — `FormFillMode` enum; `fillMode` + 4 relations on `StageFormBinding`; inverses on `Role`/`User`; migration.
- `src/modules/workflow/workflow.schema.ts` — extend `EmbeddedFormBindingSchema`.
- `src/modules/workflow/workflow.builder.ts` — per-row binding `create` with `connect` + `fillMode` + stale-id warnings.
- `src/modules/workflow/workflow.service.ts` — `workflowDetailSelect` binding select + `toFlowJson` emit (4 lists + mode + labels).
- `src/modules/stage-form/stage-form.access.ts` — **new** helper (canRead/canFill/assert*/expectedSubmitterIds/isLegacyOpen).
- `src/modules/stage-form/stage-form.service.ts` — fill gate in `createWorkflowSubmission`; read tagging + progress + `userId` param in `listForTicket`.
- `src/modules/stage-form/stage-form.controller.ts` — thread `req.user.id` into `listForTicket`.
- `src/modules/workflow/engine/form.layer.ts` — generalize `findUnsatisfiedRequiredForms` for Anyone/Each/legacy + progress payload.
- `src/modules/dynamic-form/submission.service.ts` — read gate in `get` for workflow-bound submissions.
- *(verify)* workflow versioning/publish path treats binding diffs as a real change (§9).

**Frontend**
- `src/features/workflows/builder/builder.types.ts` — `FormFillMode` + extend `EmbeddedFormBinding`.
- `src/features/workflows/builder/inspector/StageFormBindingEditor.tsx` — 4 access controls + mode + add/edit.
- `src/features/workflows/builder/inspector/StageInspector.tsx` — summary + Edit button + edit wiring.
- `src/features/tickets/detail/RequiredFormsCard.tsx` — locked/View/Fill + Each-one progress & per-user copy.
- `src/features/forms/FormFillPage.tsx` / `FormFillEmbed.tsx` — readOnly when `!canFill`; no-access state when `!canRead`.
- `src/lib/api/stageForm.ts` — types for access fields / `canRead` / `canFill` / progress.
- *(verify)* `ActionBar` reads the generalized required-forms payload (§10.4).

---

## 14. Suggested build order (each step independently reviewable)

1. **Schema + migration** — enum, `fillMode`, 4 relations. Generate client.
2. **Canvas contract** — `builder.types.ts` + `workflow.schema.ts` + round-trip (`toFlowJson` + detail select). Access now persists end-to-end, no UI yet.
3. **Materialization** — `workflow.builder.ts` per-row create + warnings.
4. **Builder UI** — `StageFormBindingEditor` (4 controls + mode + add/edit) + inspector summary. Authors can configure; still unenforced.
5. **Backend enforcement (read/fill)** — `stage-form.access.ts` + fill gate + read tagging + submission read gate.
6. **Each-one gate** — generalize `form.layer.ts` + progress payload + ActionBar wiring.
7. **Frontend gating** — `RequiredFormsCard` (locked/View/Fill + Each-one progress) + fill page read-only/no-access.
8. **Versioning check** — confirm access edits bump the workflow version on publish (§9).
9. **Run the §11 checklist** — focus on #6 & #9 (versioning + edit→republish round-trip), #17–22 (Each-one), #24 (legacy compat).

> Per repo policy, all changes stay in the working tree — no commits/pushes as part of this work.
