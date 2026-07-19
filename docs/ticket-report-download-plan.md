# Ticket Report Download — Implementation Plan

**Goal:** Add a **"Download Report"** action to every ticket that produces a proper, branded, multi-page PDF containing all of the ticket's ("PR") data. The company **logo** and **footer text** are configured once in **Master Data (Organization settings)**, and the report reuses the existing **brand colors** (gold `#C9A84C` + navy `#0D0E17`).

## Decisions (locked)

| Topic | Choice |
|-------|--------|
| PDF engine | **`@react-pdf/renderer`** — client-side, pixel-precise, repeating branded header + footer with page numbers. No server infra. |
| Logo storage | **Base64 data-URL** stored inline on the `Organization` record (self-contained, works offline in the PDF). |
| Configurable in master data | **Company logo + footer text** (accent color defaults to brand gold/navy). |

---

## Part A — Master Data configuration (logo + footer)

The `Organization` model already has `logoUrl`. We add `reportFooterText` and repurpose `logoUrl` to hold a base64 data-URL.

### A1. Prisma / DB — `backend/prisma/schema.prisma`
```prisma
model Organization {
  ...
  logoUrl          String?   // now holds a data:image/...;base64,... string
  reportFooterText String?   // NEW — footer line printed on every report page
  ...
}
```
- Add the column and run a migration (`prisma migrate dev --name org_report_config`).
- `logoUrl` is `String?` (Text) already — base64 fits; no size type change needed for a small (≤~200 KB) logo.

### A2. Backend schema/service
- `backend/src/modules/organization/organization.schema.ts`
  - Relax `logoUrl` to accept a data-URL **or** empty string (drop the strict `.url()`; validate `^data:image\/(png|jpe?g|svg\+xml);base64,` OR `^https?://` OR `''`).
  - Add `reportFooterText: z.string().max(200).optional().nullable()`.
- `backend/src/modules/organization/organization.service.ts`
  - In `update`, persist `reportFooterText` (mirror the existing `logoUrl === '' ? null` pattern).
- `organization.openapi.ts` — add the new field to the response/request docs.

### A3. Client — enable logo upload + footer field in `GeneralTab.tsx`
File: `client/src/features/admin/organization/GeneralTab.tsx`
- Add `logoUrl` and `reportFooterText` to `FormValues` and `initialValues`.
- **Logo upload:** replace the disabled `Upload logo` button with a working one:
  - `antd` `Upload` with `beforeUpload` → read file via `FileReader.readAsDataURL`, validate type (png/jpg/svg) and size (≤ 2 MB), set `logoUrl` field, mark dirty.
  - Show a live preview (the `<div>` swatch currently shows "QK" → render `<img src={logoUrl}>` when present).
- **Footer field:** add a new "Report Branding" card with:
  - `AppForm.Item name="reportFooterText"` → `AntInput` (placeholder: `Confidential — {Company} — printed {date}`), `maxLength 200`.
- Include both in the `handleFinish` payload.
- `client/src/features/admin/organization/hooks.ts` — add `reportFooterText: string | null` to the `Organization` interface (already exposes `logoUrl`).

> Result: Admins set logo + footer once; every ticket report picks them up via `useOrganization()`.

---

## Part B — The PDF report

### B1. Dependency
```
cd client && npm i @react-pdf/renderer
```
Vite-compatible; import lazily so it doesn't bloat the main bundle (see B5).

### B2. Shared report theme — `client/src/features/tickets/report/reportTheme.ts`
Single source of truth mirroring `tailwind.config.js` so the PDF matches the app:
```ts
export const REPORT = {
  gold: '#C9A84C', goldSoft: '#FDF2D0', navy: '#0D0E17', navySoft: '#EEEEF4',
  ink: '#111827', sub: '#6B7280', border: '#E5E7EB', ok: '#22C55E', warn: '#F59E0B',
  font: 'Helvetica',
};
```
Status/severity colors reuse the ticket's own `severity.color` where present.

### B3. Report document — `client/src/features/tickets/report/TicketReportDocument.tsx`
A `@react-pdf/renderer` `<Document>` built from props (no hooks inside — pure render):
- **Props:** `{ org, ticket, timeline, comments, docs, formHistory }`.
- **Repeating header** (`fixed`): company logo (from `org.logoUrl`), company name + address on the left; report title + ticket `uniqueId` on the right; gold rule under it.
- **Repeating footer** (`fixed`): `org.reportFooterText` left; `Page X of Y` right (via `render={({pageNumber,totalPages})=>...}`); generated timestamp.
- **Body sections** (each a styled card/table, page-break-aware):
  1. **Summary** — title, status (open/completed), priority, severity, classification, department, site, due date, created by/at, on-hold state.
  2. **Description & Reason** — `description`, `ticketReason`.
  3. **Workflow** — flow name/version, current stage(s), completion state.
  4. **Timeline** — from `useTicketTimeline`: stage entered/exited (+ action) and comments, chronological.
  5. **Stage Forms** — from `useTicketFormHistory`: each submitted form's stage, submitter, timestamp, and field/value pairs rendered as a table (read-only flatten of the submission JSON).
  6. **Comments** — author, time, body.
  7. **Attachments** — file name, type, uploaded by/at, URL (docs are URL refs).
  8. **Custom fields** — flatten `ticket.customFields` JSON into a table.
- Colors strictly from `reportTheme` (gold accents, navy headings).

### B4. Data assembly hook — `client/src/features/tickets/report/useTicketReportData.ts`
Composes existing hooks so the report has everything in one place:
```ts
useOrganization(), useTicket(id), useTicketTimeline(id),
useTicketComments(id), useTicketDocs(id), useTicketFormHistory(id)
```
Returns `{ ready, data }` (all queries resolved). No new backend endpoints required — every field is already served.

### B5. Download trigger — button in `ActionBar.tsx` / `TicketHeaderCard.tsx`
- Add a **"Download Report"** button (guarded by existing `ticket read` permission).
- On click:
  - Ensure report data is loaded (prefetch the 6 queries or gate the button on `ready`).
  - Lazy-load the renderer: `const { pdf } = await import('@react-pdf/renderer')`.
  - `const blob = await pdf(<TicketReportDocument {...data} />).toBlob();`
  - Download as `${ticket.uniqueId}-report.pdf` (reuse the blob→anchor pattern from `export.ts`).
  - Loading + error toasts (`react-hot-toast` is already used).

### B6. (Optional) dedicated route
Add `/tickets/:id/report` in `App.tsx` rendering a `<PDFViewer>` preview page for large reports. Not required for download; include only if in-app preview is wanted.

---

## Files touched (summary)

**Backend**
- `prisma/schema.prisma` (+ migration) — `reportFooterText`
- `modules/organization/organization.schema.ts` — logo data-URL + footer validation
- `modules/organization/organization.service.ts` — persist footer
- `modules/organization/organization.openapi.ts` — docs

**Client**
- `features/admin/organization/GeneralTab.tsx` — logo upload + footer field
- `features/admin/organization/hooks.ts` — `reportFooterText` on `Organization`
- `features/tickets/report/reportTheme.ts` *(new)*
- `features/tickets/report/TicketReportDocument.tsx` *(new)*
- `features/tickets/report/useTicketReportData.ts` *(new)*
- `features/tickets/detail/ActionBar.tsx` (or `TicketHeaderCard.tsx`) — Download button
- `package.json` — `@react-pdf/renderer`
- `App.tsx` *(optional)* — preview route

---

## Sequencing
1. **A1–A3** Master data (logo upload + footer) — ship + verify admins can save a logo and footer.
2. **B1–B4** Report theme, document, data hook.
3. **B5** Wire the Download button; verify a full ticket produces a correct multi-page branded PDF.
4. **B6** Optional preview route.

## Verification
- Save a logo + footer in Organization settings → reload → both persist.
- Open a ticket with forms/comments/docs/timeline → Download Report → PDF opens with: logo header on every page, footer text + `Page X of Y`, all sections populated, brand gold/navy colors, correct `uniqueId` filename.
- Ticket with empty sections → those sections render "None" gracefully, no crash.
- Logo > 2 MB or wrong type → upload rejected with a clear message.
