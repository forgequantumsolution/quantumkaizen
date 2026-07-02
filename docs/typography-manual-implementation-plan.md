# FQS-QK-UIUX-002 — Typography Manual Implementation Plan

**Source spec:** _FQS-QK-UIUX-002 — Font Nomenclature & Typography Instruction Manual (v1.0)_
**Target app:** `client/` (React 18 + Vite + Tailwind 3 + Ant Design 5)
**Scope decided:** Full font switch (Inter + Roboto Mono) + high-impact mandates.
**Excluded this pass:** floor-display `+2px` variant tokens, print fonts (Calibri/Georgia), full token-rename migration, exhaustive per-component audit. See §11.

> **Working rule:** all edits in the working tree only — **no commits / no pushes** (project policy).

---

## 0. How to use this document

Each phase lists **exact files, line numbers, and current → new snippets**. Line numbers are from the state of the repo when this plan was written; re-confirm with a quick read before editing. Every phase ends with a **verification** block. §9 maps the work back to the manual's own pre-release checklist (§11 of the manual).

Recommended execution order (low-risk config first): **Phase 1 → Phase 2 → Phase 4 → Phase 3**.

---

## 1. Executive summary

The app already has a mature theming layer: an `appearanceStore` (Zustand, persisted) feeds `AppearanceProvider`, which writes CSS custom properties (`--font-sans`, `--font-mono`, `--color-*`, `--font-size-*`) onto `:root` at runtime. Tailwind + `index.css` provide bootstrap defaults; `antdTheme.ts` mirrors the font into Ant Design.

Consequences:
- The **font switch is configuration, not a rewrite** — Inter is *already wired* into both `SANS_FAMILIES` maps; we add Roboto Mono, flip defaults, and force-migrate persisted state.
- The **typography scale already exists and largely complies** with the manual's minimums; we enforce edges rather than rebuild.
- The **palette barely changes** — the app's navy/gold ≈ the manual's navy/amber. The genuine gap is a set of **semantic status _text_ colors** (`text-oos`, `text-approved`, …).
- **Label renames** are the largest hand-edit; they span the sidebar, per-page titles, and four DB-seeded workflow-type names.

---

## 2. Manual section-by-section disposition

| § | Manual section | Disposition | Where |
|---|----------------|-------------|-------|
| 1 | Why font nomenclature matters | Context only | — |
| 2 | Approved font stack (Inter / Roboto Mono / print) | **In scope** (UI + data). Print fonts deferred | Phase 1 |
| 3 | Font size hierarchy + minimums | **In scope** (enforce minimums; keep existing token names) | Phase 4 |
| 4 | Font weights | Mostly satisfied by existing scale; spot-check | Phase 4 |
| 5 | Character disambiguation (mono on data) | **In scope** — Roboto Mono + data-field audit | Phase 1 + 4 |
| 6 | UI label naming (14 changes) | **In scope** | Phase 3 |
| 7 | Colour & contrast (status text tokens, sidebar contrast, color-not-alone) | **In scope** | Phase 2 |
| 8 | Line height / letter spacing / 70ch | **In scope** (narratives) | Phase 4 |
| 9 | Manufacturing floor `+2px` variant | **Deferred** | §11 future |
| 10 | Do's & Don'ts | Applied as acceptance criteria throughout | §9 |
| 11 | Pre-release checklist | Used as the verification checklist | §9 |
| 12 | Implementation steps | Reconciled into this plan | — |

---

## 3. Architecture primer (read before editing)

**Runtime font/color flow:**
```
appearanceStore (persisted: 'qk-appearance', version 2)
  → AppearanceProvider.useEffect
      → applyTypography(): sets --font-sans, --font-mono, html.fontSize, --font-size-*
      → applyColors():     sets --color-*
      → buildAntdTheme():  feeds fontFamily + colors into antd ConfigProvider
  → index.css :root declares BOOTSTRAP defaults (used before hydrate)
  → tailwind.config.js fontFamily/colors back the static utility classes
```

**Two separate `SANS_FAMILIES` maps exist** — one in `AppearanceProvider.tsx`, one in `antdTheme.ts`. Both must be updated. Only `AppearanceProvider` has `MONO_FAMILIES`.

**Persisted-state trap:** `appearanceStore.migrate` spreads `...p.typography` over `defaultTypography`, so a persisted `sansFamily: 'outfit'` **wins over** a changed default. Simply changing the default is not enough for existing users — the v2→v3 migration must explicitly rewrite the old font keys.

---

## 4. Gap analysis (detail)

| Concern | Manual | Current | Notes |
|---------|--------|---------|-------|
| UI font | Inter | Outfit (`defaultTypography.sansFamily = 'outfit'`) | `inter` already in both family maps |
| Data font | Roboto Mono | DM Mono (`monoFamily = 'dm-mono'`) | Roboto Mono not loaded, not in maps, not a `MonoFamily` type member |
| Font loading | — | `index.css:1` imports Outfit, Inter, DM Mono, JetBrains Mono | Add Roboto Mono; Inter already loaded |
| Size scale | 12px floor / 13px nav / 14px data | `text-xxs`=11px, `caption`=12px, `body`=14px, `bodySm`=13px | 11px token exists — must not back data/nav text |
| Status text color | `#C53030`/`#1A6B3D`/`#C98A00`/`#1A5C9E`/`#B84E00` | only bg tokens (`status.*`, `severity.*`) | Add `colors.text.*` |
| Color-not-alone | color + icon/text | `StatusBadge` already renders **dot + text** ✓ | Sweep for _ad hoc_ color-only spots only |
| Sidebar contrast | `#FFF3DC` on navy = FAIL | inactive nav = `#FFFFFF` ✓ | Confirm no muted token uses `#FFF3DC` |
| Data-field mono | all lot/batch/result/timestamp | `.record-id`/`.timestamp`/`.esig-meta` ✓ | Audit LIMS result tables |

---

## 5. Phase 1 — Fonts (Outfit → Inter, DM Mono → Roboto Mono)

Seven touch points. Do them together; the app won't be consistent until all land.

### 5.1 `client/src/index.css` — load Roboto Mono + bootstrap defaults
**Line 1** — update the font `@import` (Inter already present; add Roboto Mono, keep DM Mono as fallback source or drop if unused):
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Roboto+Mono:wght@400;500;600&family=Outfit:wght@300;400;500;600;700;800&display=swap');
```
**Lines 11–12** — bootstrap defaults:
```css
/* was */ --font-sans: 'Outfit', system-ui, -apple-system, sans-serif;
/* was */ --font-mono: 'DM Mono', 'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace;
/* new */ --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
/* new */ --font-mono: 'Roboto Mono', 'DM Mono', ui-monospace, SFMono-Regular, monospace;
```

### 5.2 `client/src/components/theme/AppearanceProvider.tsx` — add mono family + fallbacks
**Line ~36** — add Roboto Mono to `MONO_FAMILIES`:
```ts
const MONO_FAMILIES: Record<string, string> = {
  'roboto-mono': "'Roboto Mono', 'DM Mono', ui-monospace, monospace",
  'dm-mono':     "'DM Mono', 'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace",
  jetbrains:     "'JetBrains Mono', 'DM Mono', ui-monospace, monospace",
  system:        "ui-monospace, SFMono-Regular, Menlo, monospace",
};
```
**Lines 83–84** — change the fallbacks so a missing key resolves to the new defaults:
```ts
root.style.setProperty('--font-sans', SANS_FAMILIES[t.sansFamily] ?? SANS_FAMILIES.inter);
root.style.setProperty('--font-mono', MONO_FAMILIES[t.monoFamily] ?? MONO_FAMILIES['roboto-mono']);
```

### 5.3 `client/src/stores/appearanceStore.ts` — types, defaults, and forced migration
**Line 8** — extend the union type:
```ts
export type MonoFamily = 'roboto-mono' | 'dm-mono' | 'jetbrains' | 'system';
```
**Lines 93–94** (`defaultTypography`):
```ts
sansFamily: 'inter',
monoFamily: 'roboto-mono',
```
**Lines 156–184** — bump `version: 2 → 3` and add a v2→v3 step that **forces** the swap for anyone still on the old defaults (but preserves a deliberate `'system'` choice):
```ts
version: 3,
migrate: (persisted, from) => {
  const p = (persisted ?? {}) as Partial<AppearanceConfig>;
  const base = {
    mode:   p.mode   ?? defaultConfig.mode,
    preset: p.preset ?? defaultConfig.preset,
    colors: { ...defaultColors, ...(p.colors ?? {}) },
    typography: {
      ...defaultTypography,
      ...(p.typography ?? {}),
      fontSizes: { ...defaultFontSizes, ...(p.typography?.fontSizes ?? {}) },
    },
  } as AppearanceConfig;

  // v2 → v3: retire Outfit/DM Mono as the product default. Only rewrite the
  // *old defaults* so a user who intentionally picked 'system' keeps it.
  if (from < 3) {
    if (base.typography.sansFamily === 'outfit')  base.typography.sansFamily = 'inter';
    if (base.typography.monoFamily === 'dm-mono') base.typography.monoFamily = 'roboto-mono';
  }
  return base;
},
```

### 5.4 `client/tailwind.config.js` — static utility fonts (lines 168–171)
```js
fontFamily: {
  sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
  mono: ['Roboto Mono', 'DM Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
},
```

### 5.5 `client/src/lib/antdTheme.ts` — second family map + fallback (lines 6–10, 25)
```ts
const SANS_FAMILIES: Record<string, string> = {
  inter:   'Inter, system-ui, -apple-system, sans-serif',
  outfit:  'Outfit, system-ui, -apple-system, sans-serif',
  system:  'system-ui, -apple-system, "Segoe UI", sans-serif',
};
// line 25:
const fontFamily = SANS_FAMILIES[typography.sansFamily] ?? SANS_FAMILIES.inter;
```

### 5.6 `client/src/pages/AppearancePage.tsx` — picker labels + reset fallbacks
**Lines 492–502** — relabel option lists:
```ts
const sansOptions = [
  { value: 'inter',  label: 'Inter (default)' },
  { value: 'outfit', label: 'Outfit' },
  { value: 'system', label: 'System UI' },
];
const monoOptions = [
  { value: 'roboto-mono', label: 'Roboto Mono (default)' },
  { value: 'dm-mono',     label: 'DM Mono' },
  { value: 'jetbrains',   label: 'JetBrains Mono' },
  { value: 'system',      label: 'System Monospace' },
];
```
**Lines 73 & 126–127** — update the hardcoded reset-to-default fallbacks from `'outfit'`/`'dm-mono'` to `'inter'`/`'roboto-mono'` so "reset" restores the new defaults.

### Phase 1 verification
- Run `npm run dev` in `client/`; confirm UI renders in Inter, `.record-id`/timestamps in Roboto Mono.
- Clear `localStorage['qk-appearance']`, reload → still Inter/Roboto Mono (default path).
- Load an app build that had `version:2` persisted with Outfit → reload → auto-migrates to Inter (migration path).
- Set font to "System UI" on v2, migrate → stays System (deliberate-choice preserved).
- Eyeball character pairs at 14px in a data field: `0 O o`, `1 l I`, `5 S`, `8 B`, `6 G`.

---

## 6. Phase 2 — Status text tokens + "never color alone"

### 6.1 `client/tailwind.config.js` — add semantic text tokens
Inside `theme.extend.colors` add (values + WCAG ratio per manual §7):
```js
text: {
  oos:        '#C53030', // 7.2:1  AAA
  oot:        '#C98A00', // 5.5:1  AA
  approved:   '#1A6B3D', // 7.8:1  AAA
  progress:   '#1A5C9E', // 6.4:1  AA
  quarantine: '#B84E00', // 6.6:1  AA
},
```
Usable as `text-text-oos` etc. (or rename group to avoid the `text-text-` stutter — e.g. `state: { oos: … }` → `text-state-oos`). **Decision:** use `state` as the group name to read cleanly. Update this snippet accordingly when implementing.

### 6.2 Sidebar contrast audit
Manual flags `#FFF3DC` on navy as 2.1:1 **FAIL**. `Sidebar.tsx` inactive label = `#FFFFFF` (21:1, pass). Grep the codebase for `#FFF3DC` used as a *text* color on a dark background and replace with `#C4CFD8` (manual's `sidebar-inactive`, 10.4:1) if any exist.

### 6.3 Color-not-alone sweep
`components/ui/Badge.tsx` `StatusBadge`/`SeverityBadge` already pair a colored dot **with a text label** → WCAG 1.4.1 compliant. Work here is limited to finding **ad-hoc** indicators that use color alone:
- bare colored dots/rings without adjacent text,
- red/amber text with no icon or label in tables/detail headers.
Where the manual wants an OOS/OOT/quarantine emphasis, apply the new `state.*` text token **and** ensure an icon or word accompanies it. Prefer fixing at shared components (`Badge`, `Card`, KPI tiles) so it propagates.

### Phase 2 verification
- New tokens compile and render (`className="text-state-oos"`).
- No text-on-navy uses `#FFF3DC`.
- Spot-check OOS/OOT/quarantine surfaces: each conveys status by icon/text, not hue alone (test with a grayscale filter).

---

## 7. Phase 3 — 14 GMP label renames

### 7.A Hardcoded in `client/src/components/layout/Sidebar.tsx` (lines 214–307)
| Old label | New label | Sidebar line (approx) |
|-----------|-----------|-----------------------|
| LMS | Training & Qualification | 231 |
| My Learning | My Training | 233 |
| Curricula | Training Programs | 236 |
| Training Matrix | Qualification Matrix | 238 |
| Grading | Assessment Results | 239 |
| Samples | Sample Management | 256 |
| OOS Investigations | OOS / OOT Investigations | 280 |
| Certificates (CoA) | CoA Management | 286 |
| Audit Master | Audit Program | 158 |
| Suppliers | Vendor Management | (LIMS config / `SuppliersPage`) |

> Note: the app also has a separate top-level "Audit" entry and an "Audit Program" tab already under audit ops — confirm the manual's "Audit Master → Audit Program" doesn't collide with the existing `AuditProgram*` pages before renaming; may just be a config-tab label change.

### 7.B Page titles / breadcrumbs to match the sidebar
Grep each old label and update the `<h1>`/header/breadcrumb in its feature page so nav and page agree:
- `client/src/features/lims/OosListPage.tsx`, `OosDetailPage.tsx`
- `client/src/features/lims/SampleListPage.tsx`, `SampleDetailPage.tsx`
- `client/src/features/lims/CoaListPage.tsx`, `CoaDetailPage.tsx`
- `client/src/features/lims/SuppliersPage.tsx`
- `client/src/features/lms/CurriculaPage.tsx`, `MyLearningPage.tsx`, `TrainingMatrixPage.tsx`
- LMS grading page (Assessment Results)
- `client/src/features/audit/` master/program pages
- Also check `document.title` / route metadata and `GlobalSearch` result labels.

### 7.C DB-driven workflow-type names (decision required)
`CAPA → CAPA Management`, `Deviation → Deviations`, `Complaints → Product Complaints`, `Document Review → Document Approval` are seeded workflow-type **`name`s**:
- `backend/prisma/seed.ts:985` (`CAPA`), `:377` (`Document Review`)
- `backend/prisma/seed-capa-workflow.ts:58` (`CAPA`)
- rendered via `t.name` in `Sidebar.tsx` (`moduleItems`).

The seeds use `where: { name: 'CAPA' }` for idempotency, and services may look up by name → **renaming the raw `name` is risky**.

**Recommended (low-risk):** keep internal `name`s; add a display-name override in the sidebar:
```ts
const WF_DISPLAY_NAME: Record<string, string> = {
  'CAPA': 'CAPA Management',
  'Deviation': 'Deviations',
  'Complaints': 'Product Complaints',
  'Document Review': 'Document Approval',
};
// in moduleItems map: label: WF_DISPLAY_NAME[t.name] ?? t.name
// also apply to the docReview child label and any breadcrumb derived from t.name
```
**Alternative (higher-risk):** rename the seed `name`s and every `where:{name}` reference + verify services/permission keys. Not recommended unless the display name must persist to the DB (e.g. for reports/exports).

> Before relying on the override map, confirm whether `Deviation` and `Complaints` workflow types are actually seeded (grep returned CAPA + Document Review; Deviation/Complaints may not exist yet, in which case those two renames are no-ops for now).

### Phase 3 verification
- Sidebar shows all new labels; expand each group.
- Navigate into each renamed area → page title matches the nav label.
- `GlobalSearch` and breadcrumbs show new terminology.
- No console errors from workflow-type lookups (confirms internal names untouched).

---

## 8. Phase 4 — Min-size, line-height & mono data-field enforcement

### 8.1 Minimum sizes (manual §3)
- Floor rules: nav-label ≥ 13px, body/data ≥ 14px, nothing meaningful < 12px.
- The scale already meets this; the risk is the **11px `text-xxs`** token backing data/nav text. Grep `text-xxs` and `text-[11px]` usages; keep 11px only for non-data micro-meta (badge chrome, counts), never for lot/batch/result values or nav labels.

### 8.2 Line height + measure (manual §8)
- Add `line-height: 1.65` and `max-width: 70ch` to deviation/CAPA/audit **narrative** and rich-text description blocks (TipTap `.dms-doc .ProseMirror` already uses 1.7 — good reference).
- Confirm badge/uppercase labels keep positive letter-spacing (existing `.label`/`field-label` tokens do).

### 8.3 Mono on all data values (manual §5)
Already mono: `.record-id`, `.timestamp`, `.esig-meta`. Audit these for raw values still in the proportional font and wrap in `font-mono`/`.record-id`:
- `client/src/features/lims/SampleDetailPage.tsx` (sample IDs, quantities)
- `client/src/features/lims/OosDetailPage.tsx` (result values, batch)
- `client/src/features/lims/CoaDetailPage.tsx` (CoA numbers, analytical results)
- LIMS result tables (QC, stability) rendering numeric results.

### Phase 4 verification
- No data/nav text below the manual minimum (inspect computed font-size in DevTools).
- Narrative fields wrap at ~70ch and read at LH 1.65.
- Every lot/batch/result/timestamp renders in Roboto Mono.

---

## 9. Cross-cutting: acceptance checklist (from manual §11)

Run before declaring done:
- [ ] Inter (UI) + Roboto Mono (data) applied app-wide; fallbacks intact for offline.
- [ ] Roboto Mono on every lot/batch/analytical value/timestamp.
- [ ] No nav/data text < 13/14px; nothing < 12px.
- [ ] Status conveyed by icon/text + color, never color alone (grayscale test).
- [ ] Sidebar: active #FFFFFF (21:1), inactive readable; no `#FFF3DC` text on navy.
- [ ] All 14 label changes applied; no old terminology in nav, titles, search, breadcrumbs.
- [ ] New `state.*` status text tokens used for OOS/OOT/approved/quarantine emphasis.
- [ ] Narrative text ≤ 70ch, LH ≥ 1.6.
- [ ] UI verified at 150% and 200% browser zoom without horizontal scroll.
- [ ] Persisted-appearance migration verified (existing users land on new fonts).

---

## 10. Risks, rollback & effort

**Risks**
- *Persisted state (5.3):* forgetting the `version` bump + forced migrate leaves existing users on Outfit/DM Mono. Highest-likelihood miss.
- *DB labels (7.C):* renaming seed `name`s can break idempotent seeds and lookups. Mitigation: display-name override map.
- *11px token (8.1):* silent min-size violations on data screens.
- *Two font maps (5.2 / 5.5):* updating only one leaves antd widgets on the old font.

**Rollback**
- Frontend-only and config-centric. Revert the working-tree edits; no DB migration is created if the override-map approach is used for 7.C.

**Rough effort**
- Phase 1: ~0.5 day (mechanical, but test the migration).
- Phase 2: ~0.5 day.
- Phase 3: ~1 day (many page files + label decision).
- Phase 4: ~0.5–1 day (audit-driven).

---

## 11. Explicitly out of scope (future phase)

- **Floor `+2px` variant** (manual §9): `font-ui-floor`/`font-data-floor` tokens, 44px touch targets, `#F3F6FA` (not white) backgrounds, 18px bold alerts. Needs a floor build target/theme — separate effort.
- **Print fonts** (manual §2/§7): Calibri/Georgia for exported CoA/batch records/PDF; ties into the reporting/export pipeline.
- **Full token rename** to the manual's names (`display-module`, `nav-label`, `data-value`…): the existing `display/h1/body/label` scale is kept; only aliases would be added if desired later.

---

## 12. Master file-touch list

**Frontend**
| File | Change | Phase |
|------|--------|-------|
| `client/src/index.css` | font `@import` + bootstrap `--font-sans`/`--font-mono` | 1 |
| `client/src/components/theme/AppearanceProvider.tsx` | `MONO_FAMILIES` + fallbacks | 1 |
| `client/src/stores/appearanceStore.ts` | `MonoFamily` type, defaults, `version:3` + migrate | 1 |
| `client/tailwind.config.js` | `fontFamily` + `state.*` status text tokens | 1, 2 |
| `client/src/lib/antdTheme.ts` | `SANS_FAMILIES` + fallback | 1 |
| `client/src/pages/AppearancePage.tsx` | picker labels + reset fallbacks | 1 |
| `client/src/components/layout/Sidebar.tsx` | labels + `WF_DISPLAY_NAME` map | 3 |
| `client/src/features/lims/*` (Oos/Sample/Coa/Suppliers…) | page titles + mono data fields | 3, 4 |
| `client/src/features/lms/*` (Curricula/MyLearning/Matrix/grading) | page titles | 3 |
| `client/src/features/audit/*` (master/program) | tab/page labels | 3 |
| `client/src/components/ui/Badge.tsx` / `Card.tsx` | color-not-alone + status token use | 2 |
| narrative/rich-text blocks | LH 1.65 + 70ch | 4 |

**Backend** — only if 7.C uses the *seed-rename* alternative (not recommended):
| File | Change |
|------|--------|
| `backend/prisma/seed.ts` | workflow-type `name`s + `where:{name}` refs |
| `backend/prisma/seed-capa-workflow.ts` | `CAPA` name refs |
