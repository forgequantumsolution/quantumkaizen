import { useEffect, type ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import {
  useAppearanceStore,
  defaultFontSizes,
  type AppearanceColors,
  type AppearanceFontSizes,
  type AppearanceTypography,
  type Mode,
} from '@/stores/appearanceStore';
import { buildAntdTheme } from '@/lib/antdTheme';
import { defaultColors } from '@/components/theme/presets';

/**
 * Bridge between the Zustand appearance store and the live document.
 *
 * Side effects on every store change:
 *   1. Writes the 13 color tokens onto :root as --color-*
 *   2. Writes typography tokens onto :root (--font-sans, --font-mono, --font-heading-weight)
 *   3. Sets html.style.fontSize from typography.baseFontPx
 *   4. Toggles `dark` class on <html> based on mode (with system support)
 *   5. Toggles density-{compact|comfortable|spacious} on <html>
 *
 * Re-emits an antd ConfigProvider underneath so antd widgets follow the theme.
 *
 * Mounted once near the top of App.tsx — there is no provider context, just
 * a place where we can subscribe to the store at the React tree's root.
 */

const SANS_FAMILIES: Record<string, string> = {
  outfit:  "'Outfit', system-ui, -apple-system, sans-serif",
  inter:   "'Inter', system-ui, -apple-system, sans-serif",
  system:  "system-ui, -apple-system, 'Segoe UI', sans-serif",
};

const MONO_FAMILIES: Record<string, string> = {
  'roboto-mono': "'Roboto Mono', 'DM Mono', ui-monospace, monospace",
  'dm-mono':     "'DM Mono', 'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace",
  jetbrains:     "'JetBrains Mono', 'DM Mono', ui-monospace, monospace",
  system:        "ui-monospace, SFMono-Regular, Menlo, monospace",
};

// Maps store key → CSS custom property name.
const COLOR_VAR: Record<keyof AppearanceColors, string> = {
  gold:     '--color-gold',
  goldDark: '--color-gold-dark',
  navy:     '--color-navy',
  navyMid:  '--color-navy-mid',
  bg:       '--color-bg',
  surface:  '--color-surface',
  border:   '--color-border',
  success:  '--color-success',
  warning:  '--color-warning',
  danger:   '--color-danger',
  ink:      '--color-ink',
  ink2:     '--color-ink-2',
  ink3:     '--color-ink-3',
};

// Same idea for the typography scale tokens.
const FONT_SIZE_VAR: Record<keyof AppearanceFontSizes, string> = {
  display: '--font-size-display',
  h1:      '--font-size-h1',
  h2:      '--font-size-h2',
  h3:      '--font-size-h3',
  h4:      '--font-size-h4',
  bodyLg:  '--font-size-body-lg',
  body:    '--font-size-body',
  bodySm:  '--font-size-body-sm',
  caption: '--font-size-caption',
};

function applyColors(root: HTMLElement, colors: AppearanceColors | undefined) {
  // Belt-and-braces — a stale persisted blob could in principle land here
  // before the store's migrate runs. Falling back to defaults beats throwing.
  const safe = colors ?? defaultColors;
  (Object.keys(COLOR_VAR) as (keyof AppearanceColors)[]).forEach((key) => {
    root.style.setProperty(COLOR_VAR[key], safe[key] ?? defaultColors[key]);
  });
}

function applyTypography(root: HTMLElement, t: AppearanceTypography | undefined) {
  if (!t) return;
  root.style.setProperty('--font-sans', SANS_FAMILIES[t.sansFamily] ?? SANS_FAMILIES.inter);
  root.style.setProperty('--font-mono', MONO_FAMILIES[t.monoFamily] ?? MONO_FAMILIES['roboto-mono']);
  root.style.setProperty('--font-heading-weight', String(t.headingWeight ?? 700));
  // Drives every rem-sized element across the app.
  root.style.fontSize = `${t.baseFontPx ?? 16}px`;

  // Per-token sizes. Stored as numeric rem; written as `${value}rem` so they
  // remain proportional to the base-font-px slider. Falls back per-key to
  // defaults so a partially-migrated blob can't crash the provider.
  const sizes = t.fontSizes ?? defaultFontSizes;
  (Object.keys(FONT_SIZE_VAR) as (keyof AppearanceFontSizes)[]).forEach((key) => {
    const v = sizes[key] ?? defaultFontSizes[key];
    root.style.setProperty(FONT_SIZE_VAR[key], `${v}rem`);
  });

  root.classList.remove('density-compact', 'density-comfortable', 'density-spacious');
  root.classList.add(`density-${t.density ?? 'comfortable'}`);
}

function applyMode(root: HTMLElement, mode: Mode) {
  const dark =
    mode === 'dark' ||
    (mode === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', dark);
}

interface Props {
  children: ReactNode;
}

export default function AppearanceProvider({ children }: Props) {
  const mode       = useAppearanceStore((s) => s.mode);
  const colors     = useAppearanceStore((s) => s.colors);
  const typography = useAppearanceStore((s) => s.typography);

  useEffect(() => {
    const root = document.documentElement;
    applyColors(root, colors);
    applyTypography(root, typography);
    applyMode(root, mode);
  }, [colors, typography, mode]);

  // Re-evaluate dark mode when the OS preference flips and the user picked
  // 'system'. Only registers a listener while in 'system' mode.
  useEffect(() => {
    if (mode !== 'system' || typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyMode(document.documentElement, 'system');
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [mode]);

  // Inner ConfigProvider — its theme overrides the static one in main.tsx
  // because antd uses the nearest ConfigProvider in the tree.
  return (
    <ConfigProvider theme={buildAntdTheme({ colors, typography })}>
      {children}
    </ConfigProvider>
  );
}
