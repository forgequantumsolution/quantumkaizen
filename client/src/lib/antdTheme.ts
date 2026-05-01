import type { ThemeConfig } from 'antd';

// Match the existing slate / blue palette so antd widgets blend with the
// rest of the Tailwind-styled UI.
export const antdTheme: ThemeConfig = {
  cssVar: true,
  hashed: false,
  token: {
    fontFamily: 'Outfit, system-ui, -apple-system, sans-serif',
    colorPrimary: '#0f172a',           // slate-900
    colorInfo: '#2563eb',              // blue-600
    colorSuccess: '#16a34a',           // green-600
    colorWarning: '#d97706',           // amber-600
    colorError: '#dc2626',             // red-600
    colorBgLayout: '#f8fafc',          // slate-50
    borderRadius: 8,
    borderRadiusSM: 6,
    borderRadiusLG: 12,
    fontSize: 14,
    controlHeight: 38,
  },
  components: {
    Button: {
      controlHeight: 38,
      borderRadius: 8,
      fontWeight: 500,
    },
    Input: { borderRadius: 8 },
    Select: { borderRadius: 8 },
    DatePicker: { borderRadius: 8 },
    Modal: { borderRadiusLG: 12, paddingContentHorizontal: 24 },
    Form: { itemMarginBottom: 16 },
  },
};
