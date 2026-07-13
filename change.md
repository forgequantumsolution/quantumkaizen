# Changelog

## 2026-07-13

### Fix: reset scroll to top on page navigation

Navigating between pages (e.g. switching a module's dashboard tabs like
`/lims/dashboard` → `/lims/samples`, or any module dashboard → dashboard) left
the new page scrolled wherever the previous page was. React Router preserves the
window scroll position across route changes by default, and the app scrolls at
the window level (no inner `overflow-y-auto` region), so the new page inherited
the old scroll offset.

**Change:**
- Added `client/src/components/layout/ScrollToTop.tsx` — a component that resets
  the window scroll to the top whenever the route `pathname` changes. Keyed on
  `pathname` only (not the query string), so in-page `?tab=` toggles and filters
  don't cause a scroll jump.
- Mounted `<ScrollToTop />` inside `client/src/components/layout/AppLayout.tsx`
  so it applies across the protected app shell.
- Scroll uses `behavior: 'smooth'` for an animated scroll-up.

### Enhance: fuller LIMS Sample Management table

The samples table (`/lims/samples`) looked sparse — only a few columns were
shown even though the `SampleSummary` API response carries more fields.

**Change (`client/src/features/lims/SampleListPage.tsx`):**
- Added three columns using data already returned by the API: **Barcode**
  (monospace scan code), **Priority** (color-coded badge — Low/Normal/High/
  Urgent), and **Quantity** (`quantity + unit`, right-aligned).
- Widened the fixed columns, right-aligned the numeric ones (Quantity,
  Aliquots), and gave the flexible Product column a set width.
- Added `scroll={{ x: 'max-content' }}` so the wider table scrolls horizontally
  instead of crushing columns on narrower screens.

### Perf: defer LIMS Register-Sample drawer lookups until it opens

Visiting `/lims/samples` fired 8 dropdown lookup queries (specifications, labs,
storage, products, customers, suppliers, sampling-points, units) on page load —
even though they only populate the "Register Sample" drawer, which most visitors
never open. The drawer component was mounted unconditionally, so its React Query
hooks ran immediately.

**Change (`client/src/features/lims/SampleListPage.tsx`):**
- Split `RegisterDrawer` into an outer shell (owns the `Drawer`, form state,
  submit, footer — stays mounted so the open/close animation is preserved) and
  an inner `RegisterFields` component that holds all the lookup queries + form
  body and is rendered only via `{open && <RegisterFields … />}`.
- Result: page load makes just the table + shell calls; the 8 lookups fire on
  first drawer open instead. No shared hook signatures were changed.

### Fix: sparse tables on other LIMS tabs (CoA, OOS, Worklists)

Same defect as the Samples table: each list had a single `ellipsis` text column
(Product / Title / Name) with **no width**, so it stretched to absorb all slack
and left a large empty band across the row.

**Changes:**
- `CoaListPage.tsx` — bounded the Product column, added **Customer** and
  **Created** columns.
- `OosListPage.tsx` — bounded the Title column, added a **CAPA** column
  (linked CAPA number).
- `WorklistsPage.tsx` — bounded the Name column, added an **Instrument**
  column, right-aligned **# Tests**.
- All three: added `scroll={{ x: 'max-content' }}` so columns cluster left and
  scroll instead of one column stretching.

Additionally, after seeding sample QC/stability data to view them populated, the
same defect was confirmed and fixed on two more tabs:
- `QcMaterialsPage.tsx` — bounded the Name column, added a **Lot No** column,
  right-aligned **#Results**.
- `StabilityListPage.tsx` — bounded the Title column (Product names were being
  truncated by the stretch), right-aligned **Pulls**.
Both also got `scroll={{ x: 'max-content' }}`.

Verified each via Playwright screenshots. (`data-review` was already dense and
left unchanged.)
