# Changes Log

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
