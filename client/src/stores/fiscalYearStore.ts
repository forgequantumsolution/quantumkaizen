import { create } from 'zustand';

// Fiscal years are derived from the current calendar year so the top-bar
// selector never goes stale — no code edit needed each new year. We surface the
// last two years plus the current one (e.g. in 2026 → 2024, 2025, 2026).
const CURRENT_YEAR = new Date().getFullYear();
export const FISCAL_YEARS = [CURRENT_YEAR - 2, CURRENT_YEAR - 1, CURRENT_YEAR] as const;
export type FiscalYear = (typeof FISCAL_YEARS)[number];

// Single source of truth for the "FY 25-26" label used across the app (top-bar
// selector, audit register form, reports).
export const fyLabel = (year: number) =>
  `FY ${String(year).slice(-2)}-${String(year + 1).slice(-2)}`;

interface FiscalYearState {
  year: number;
  setYear: (year: number) => void;
}

export const useFiscalYearStore = create<FiscalYearState>((set) => ({
  year: CURRENT_YEAR,
  setYear: (year) => set({ year }),
}));
