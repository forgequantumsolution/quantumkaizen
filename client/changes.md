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
