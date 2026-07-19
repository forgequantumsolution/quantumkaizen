// Single source of truth for the ticket report's colors, mirroring the brand
// palette in tailwind.config.js so the PDF reads as part of the same system.
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
  white: '#FFFFFF',
} as const;

export type ReportColor = keyof typeof REPORT;
