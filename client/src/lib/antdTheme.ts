import type { ThemeConfig } from 'antd';
import type { AppearanceColors, AppearanceTypography } from '@/stores/appearanceStore';
import { defaultColors } from '@/components/theme/presets';
import { defaultTypography } from '@/stores/appearanceStore';

const SANS_FAMILIES: Record<string, string> = {
  inter:   'Inter, system-ui, -apple-system, sans-serif',
  outfit:  'Outfit, system-ui, -apple-system, sans-serif',
  system:  'system-ui, -apple-system, "Segoe UI", sans-serif',
};

interface BuildArgs {
  colors?: AppearanceColors;
  typography?: AppearanceTypography;
}

/**
 * Build an antd ThemeConfig from the appearance store's state.
 *
 * Called from AppearanceProvider on every store change. The static export
 * `antdTheme` below preserves the original behaviour for the bootstrap
 * ConfigProvider in main.tsx (which renders before the store hydrates).
 */
export function buildAntdTheme({ colors = defaultColors, typography = defaultTypography }: BuildArgs = {}): ThemeConfig {
  const fontFamily = SANS_FAMILIES[typography.sansFamily] ?? SANS_FAMILIES.inter;

  return {
    cssVar: true,
    hashed: false,
    token: {
      fontFamily,
      colorPrimary: colors.gold,
      colorInfo:    '#2563eb',
      colorSuccess: colors.success,
      colorWarning: colors.warning,
      colorError:   colors.danger,
      colorBgLayout: colors.bg,
      borderRadius: 8,
      borderRadiusSM: 6,
      borderRadiusLG: 12,
      fontSize: 14,
      controlHeight: 38,
    },
    components: {
      Button:     { controlHeight: 38, borderRadius: 8, fontWeight: 500 },
      Input:      { borderRadius: 8 },
      Select:     { borderRadius: 8 },
      DatePicker: { borderRadius: 8 },
      Modal:      { borderRadiusLG: 12, paddingContentHorizontal: 24 },
      Form:       { itemMarginBottom: 16 },
    },
  };
}

/**
 * Bootstrap theme used by the outermost ConfigProvider in main.tsx, before
 * AppearanceProvider has mounted. Equals the default-palette build.
 */
export const antdTheme: ThemeConfig = buildAntdTheme();
