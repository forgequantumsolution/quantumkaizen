/**
 * Open a print-friendly window for a controlled document and trigger the browser
 * print dialog (→ "Save as PDF"). Used to export editor-authored documents. The
 * HTML is internal, authored content so it is injected directly.
 */
interface PrintOpts {
  docNumber: string;
  title: string;
  type?: string;
  versionLabel?: string | null;
  effectiveDate?: string | null;
  html: string;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function printDocument({ docNumber, title, type, versionLabel, effectiveDate, html }: PrintOpts) {
  const w = window.open('', '_blank', 'width=920,height=1040');
  if (!w) {
    alert('Pop-up blocked — allow pop-ups to export this document.');
    return;
  }
  const eff = effectiveDate ? new Date(effectiveDate).toLocaleDateString() : '—';
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>${esc(docNumber)} — ${esc(title)}</title>
<style>
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; font-size: 12px; line-height: 1.6; }
  .doc-header { border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 18px; }
  .doc-header .num { font-family: monospace; font-size: 12px; color: #6b7280; letter-spacing: .04em; }
  .doc-header h1 { font-size: 20px; margin: 4px 0 8px; }
  .doc-meta { display: flex; gap: 20px; flex-wrap: wrap; font-size: 11px; color: #4b5563; }
  .doc-meta b { color: #111827; }
  .doc-body h1 { font-size: 18px; margin: 16px 0 6px; }
  .doc-body h2 { font-size: 15px; margin: 14px 0 6px; }
  .doc-body h3 { font-size: 13px; margin: 12px 0 4px; }
  .doc-body p { margin: 6px 0; }
  .doc-body ul { padding-left: 20px; list-style: disc; }
  .doc-body ol { padding-left: 20px; list-style: decimal; }
  .doc-body blockquote { border-left: 3px solid #d1d5db; padding-left: 12px; color: #4b5563; font-style: italic; }
  .doc-body table { border-collapse: collapse; width: 100%; margin: 10px 0; }
  .doc-body td, .doc-body th { border: 1px solid #9ca3af; padding: 5px 8px; vertical-align: top; }
  .doc-body th { background: #f3f4f6; text-align: left; }
  .doc-body a { color: #2563eb; }
  .doc-body hr { border: none; border-top: 1px solid #e5e7eb; margin: 14px 0; }
  .doc-footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; }
</style></head>
<body>
  <div class="doc-header">
    <div class="num">${esc(docNumber)}</div>
    <h1>${esc(title)}</h1>
    <div class="doc-meta">
      ${type ? `<span>Type: <b>${esc(type)}</b></span>` : ''}
      ${versionLabel ? `<span>Version: <b>${esc(versionLabel)}</b></span>` : ''}
      <span>Effective: <b>${esc(eff)}</b></span>
    </div>
  </div>
  <div class="doc-body">${html}</div>
  <div class="doc-footer">Controlled document — printed copies are uncontrolled. Generated ${new Date().toLocaleString()}.</div>
</body></html>`);
  w.document.close();
  w.focus();
  // Give the new document a tick to lay out before printing.
  setTimeout(() => w.print(), 300);
}
