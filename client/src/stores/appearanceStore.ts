import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { presets, type PresetKey, defaultColors } from '@/components/theme/presets';

export type Mode = 'light' | 'dark' | 'system';
export type Density = 'compact' | 'comfortable' | 'spacious';
export type SansFamily = 'outfit' | 'inter' | 'system';
export type MonoFamily = 'dm-mono' | 'jetbrains' | 'system';
export type HeadingWeight = 600 | 700 | 800;

/**
 * The 13 color tokens that mirror the CSS custom properties declared in
 * src/index.css. Keeping the keys in lock-step with the variable names lets
 * AppearanceProvider write them back to :root with a tiny mapping.
 */
export interface AppearanceColors {
  gold: string;
  goldDark: string;
  navy: string;
  navyMid: string;
  bg: string;
  surface: string;
  border: string;
  success: string;
  warning: string;
  danger: string;
  ink: string;
  ink2: string;
  ink3: string;
}

export interface AppearanceTypography {
  baseFontPx: number;        // 12..18, drives html { font-size }
  density: Density;          // applied as html.density-* class for spacing hooks
  sansFamily: SansFamily;
  monoFamily: MonoFamily;
  headingWeight: HeadingWeight;
}

export interface AppearanceConfig {
  mode: Mode;
  preset: PresetKey | 'custom';
  colors: AppearanceColors;
  typography: AppearanceTypography;
}

interface AppearanceState extends AppearanceConfig {
  setMode: (mode: Mode) => void;
  applyPreset: (preset: PresetKey) => void;
  patchColors: (patch: Partial<AppearanceColors>) => void;
  patchTypography: (patch: Partial<AppearanceTypography>) => void;
  resetAll: () => void;
  importConfig: (config: AppearanceConfig) => void;
  exportConfig: () => AppearanceConfig;
}

export const defaultTypography: AppearanceTypography = {
  baseFontPx: 16,
  density: 'comfortable',
  sansFamily: 'outfit',
  monoFamily: 'dm-mono',
  headingWeight: 700,
};

export const defaultConfig: AppearanceConfig = {
  mode: 'light',
  preset: 'default',
  colors: defaultColors,
  typography: defaultTypography,
};

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set, get) => ({
      ...defaultConfig,

      setMode: (mode) => set({ mode }),

      applyPreset: (preset) =>
        set({
          preset,
          colors: presets[preset].colors,
        }),

      // Any individual color edit drops us out of a named preset so the UI
      // doesn't lie about which preset is active.
      patchColors: (patch) =>
        set((s) => ({
          colors: { ...s.colors, ...patch },
          preset: 'custom',
        })),

      patchTypography: (patch) =>
        set((s) => ({ typography: { ...s.typography, ...patch } })),

      resetAll: () => set({ ...defaultConfig }),

      importConfig: (config) => {
        // Defensive merge — accept partial JSON without breaking the store
        // shape. Missing keys fall back to defaults.
        set({
          mode: config.mode ?? defaultConfig.mode,
          preset: config.preset ?? 'custom',
          colors: { ...defaultColors, ...(config.colors ?? {}) },
          typography: { ...defaultTypography, ...(config.typography ?? {}) },
        });
      },

      exportConfig: () => {
        const { mode, preset, colors, typography } = get();
        return { mode, preset, colors, typography };
      },
    }),
    {
      name: 'qk-appearance',
      partialize: (s) => ({
        mode: s.mode,
        preset: s.preset,
        colors: s.colors,
        typography: s.typography,
      }),
    },
  ),
);
