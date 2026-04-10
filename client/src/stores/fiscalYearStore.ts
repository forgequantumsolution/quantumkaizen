import { create } from 'zustand';

interface FiscalYearState {
  year: number;
  setYear: (year: number) => void;
}

export const FISCAL_YEARS = [2024, 2025, 2026] as const;
export type FiscalYear = typeof FISCAL_YEARS[number];

export const useFiscalYearStore = create<FiscalYearState>((set) => ({
  year: 2026,
  setYear: (year) => set({ year }),
}));
