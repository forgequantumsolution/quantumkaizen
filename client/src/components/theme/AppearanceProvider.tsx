import { useEffect, type ReactNode } from 'react';
import { ConfigProvider } from 'antd';
import { useAppearanceStore, type AppearanceColors, type AppearanceTypography, type Mode } from '@/stores/appearanceStore';
import { buildAntdTheme } from '@/lib/antdTheme';

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
  'dm-mono':  "'DM Mono', 'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace",
  jetbrains:  "'JetBrains Mono', 'DM Mono', ui-monospace, monospace",
  system:     "ui-monospace, SFMono-Regular, Menlo, monospace",
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

function applyColors(root: HTMLElement, colors: AppearanceColors) {
  (Object.keys(COLOR_VAR) as (keyof AppearanceColors)[]).forEach((key) => {
    root.style.setProperty(COLOR_VAR[key], colors[key]);
  });
}

function applyTypography(root: HTMLElement, t: AppearanceTypography) {
  root.style.setProperty('--font-sans', SANS_FAMILIES[t.sansFamily]);
  root.style.setProperty('--font-mono', MONO_FAMILIES[t.monoFamily]);
  root.style.setProperty('--font-heading-weight', String(t.headingWeight));
  // Drives every rem-sized element across the app.
  root.style.fontSize = `${t.baseFontPx}px`;

  root.classList.remove('density-compact', 'density-comfortable', 'density-spacious');
  root.classList.add(`density-${t.density}`);
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
