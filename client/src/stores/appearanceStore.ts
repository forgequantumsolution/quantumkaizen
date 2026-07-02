import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { presets, type PresetKey, defaultColors } from '@/components/theme/presets';

export type Mode = 'light' | 'dark' | 'system';
export type Density = 'compact' | 'comfortable' | 'spacious';
export type SansFamily = 'outfit' | 'inter' | 'system';
export type MonoFamily = 'roboto-mono' | 'dm-mono' | 'jetbrains' | 'system';
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

/**
 * Per-token font sizes in rem, mirroring the semantic scale in
 * tailwind.config.js (text-display, text-h1, …, text-caption). Values are
 * stored as numeric rem (e.g. 1.5) and the provider writes them as
 * `${value}rem`. Because they're rem-based, the base-font-px slider still
 * scales them proportionally — users get both global and per-token control.
 */
export interface AppearanceFontSizes {
  display: number;
  h1: number;
  h2: number;
  h3: number;
  h4: number;
  bodyLg: number;
  body: number;
  bodySm: number;
  caption: number;
}

export interface AppearanceTypography {
  baseFontPx: number;        // 12..18, drives html { font-size }
  density: Density;          // applied as html.density-* class for spacing hooks
  sansFamily: SansFamily;
  monoFamily: MonoFamily;
  headingWeight: HeadingWeight;
  fontSizes: AppearanceFontSizes;
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

/** Defaults match the rem values in tailwind.config.js's `fontSize` block. */
export const defaultFontSizes: AppearanceFontSizes = {
  display: 1.75,    // 28px @ 16px base
  h1:      1.5,     // 24px
  h2:      1.125,   // 18px
  h3:      1,       // 16px
  h4:      0.875,   // 14px
  bodyLg:  1,       // 16px
  body:    0.875,   // 14px
  bodySm:  0.8125,  // 13px
  caption: 0.75,    // 12px
};

export const defaultTypography: AppearanceTypography = {
  baseFontPx: 16,
  density: 'comfortable',
  sansFamily: 'inter',
  monoFamily: 'roboto-mono',
  headingWeight: 700,
  fontSizes: defaultFontSizes,
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
        // shape. Missing keys fall back to defaults. fontSizes is merged
        // one level deep so a partial override doesn't blank the rest.
        set({
          mode: config.mode ?? defaultConfig.mode,
          preset: config.preset ?? 'custom',
          colors: { ...defaultColors, ...(config.colors ?? {}) },
          typography: {
            ...defaultTypography,
            ...(config.typography ?? {}),
            fontSizes: {
              ...defaultFontSizes,
              ...(config.typography?.fontSizes ?? {}),
            },
          },
        });
      },

      exportConfig: () => {
        const { mode, preset, colors, typography } = get();
        return { mode, preset, colors, typography };
      },
    }),
    {
      name: 'qk-appearance',
      version: 3,                    // bump when persisted shape changes
      partialize: (s) => ({
        mode: s.mode,
        preset: s.preset,
        colors: s.colors,
        typography: s.typography,
      }),

      // v0/v1 → v2: typography.fontSizes was added. Older blobs lack the
      // field entirely, which crashed AppearanceProvider when it tried to
      // iterate fontSizes[key]. Backfill defaults for anything missing.
      // v2 → v3: Inter + Roboto Mono replaced Outfit + DM Mono as the product
      // default (FQS-QK-UIUX-002). Force the swap ONLY for blobs still on the
      // old defaults, so a user who deliberately chose 'system' keeps it.
      migrate: (persisted: unknown, from) => {
        const p = (persisted ?? {}) as Partial<AppearanceConfig>;
        const base = {
          mode:   p.mode   ?? defaultConfig.mode,
          preset: p.preset ?? defaultConfig.preset,
          colors: { ...defaultColors, ...(p.colors ?? {}) },
          typography: {
            ...defaultTypography,
            ...(p.typography ?? {}),
            fontSizes: {
              ...defaultFontSizes,
              ...(p.typography?.fontSizes ?? {}),
            },
          },
        } as AppearanceConfig;

        if (from < 3) {
          if (base.typography.sansFamily === 'outfit')  base.typography.sansFamily = 'inter';
          if (base.typography.monoFamily === 'dm-mono') base.typography.monoFamily = 'roboto-mono';
        }
        return base;
      },

      // Belt-and-braces: even after migrate, if a persisted blob from a
      // partially-broken cache state somehow lands here, force-fill the
      // critical fields so the provider never sees `undefined`.
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!state.colors) state.colors = defaultColors;
        if (!state.typography) state.typography = defaultTypography;
        if (!state.typography.fontSizes) state.typography.fontSizes = defaultFontSizes;
      },
    },
  ),
);
