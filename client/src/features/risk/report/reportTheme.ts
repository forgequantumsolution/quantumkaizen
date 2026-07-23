// Colors for the Risk PDF reports. The base palette is shared verbatim with the
// ticket report (features/tickets/report/reportTheme.ts) so every PDF the
// platform emits reads as one system; the risk-level colors are added on top
// because a risk report is unreadable without them.
export const REPORT = {
  gold: '#C9A84C',
  goldSoft: '#FDF2D0',
  goldLine: '#EDD9A3',
  navy: '#0D0E17',
  navySoft: '#EEEEF4',
  ink: '#111827',
  sub: '#6B7280',
  faint: '#9CA3AF',
  border: '#E5E7EB',
  rowAlt: '#F9FAFB',
  ok: '#16A34A',
  warn: '#B45309',
  info: '#1D4ED8',
  danger: '#DC2626',
  white: '#FFFFFF',
} as const;

/**
 * Fallback colors by risk-level code. A framework stores its own `color` per
 * level and that always wins — this map only covers levels whose color is
 * missing, and keeps the four standard bands consistent across reports.
 */
export const LEVEL_COLOR: Record<string, string> = {
  LOW: '#16A34A',
  MEDIUM: '#D97706',
  HIGH: '#EA580C',
  VERY_HIGH: '#DC2626',
  UNSCORED: '#9CA3AF',
};

/** Resolve a level's swatch: the framework's own color, else the standard band. */
export const levelColor = (
  code: string | null | undefined,
  color?: string | null,
): string => color || LEVEL_COLOR[String(code ?? '').toUpperCase()] || REPORT.sub;

/** Acceptance verdicts carry their own semantics, independent of the band color. */
export const ACCEPTANCE_COLOR: Record<string, string> = {
  ACCEPTABLE: REPORT.ok,
  ALARP: REPORT.warn,
  UNACCEPTABLE: REPORT.danger,
};

export type ReportColor = keyof typeof REPORT;
