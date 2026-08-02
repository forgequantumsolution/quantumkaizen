// Single source of truth for the "FY 25-26" label used across the app (audit
// register form, reports).
//
// This used to also hold a globally selectable year, driven by a top-bar
// selector. That selector was removed: no list, dashboard, or API query was
// ever scoped by it — its only effect was pre-filling the Audit Register form's
// Financial Year, which the current year does just as well. A global "filter"
// that filters nothing reads as broken, so it's gone rather than half-wired.
export const currentFiscalYear = () => new Date().getFullYear();

export const fyLabel = (year: number) =>
  `FY ${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;
