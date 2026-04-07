import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'outline';

// Inline styles — guaranteed render
const variantStyleMap: Record<BadgeVariant, React.CSSProperties> = {
  default: { backgroundColor: '#F5F6F8',  color: '#4A5568',  border: '1px solid #E8ECF2' },
  success: { backgroundColor: '#F0FDF4',  color: '#16A34A',  border: '1px solid #BBF7D0' },
  warning: { backgroundColor: '#FFFBEB',  color: '#D97706',  border: '1px solid #FDE68A' },
  danger:  { backgroundColor: '#FEF2F2',  color: '#DC2626',  border: '1px solid #FECACA' },
  info:    { backgroundColor: '#FEFBF0',  color: '#A88937',  border: '1px solid #FDF2D0' },
  purple:  { backgroundColor: '#F5F3FF',  color: '#7C3AED',  border: '1px solid #DDD6FE' },
  outline: { backgroundColor: 'transparent', color: '#4A5568', border: '1px solid #E8ECF2' },
};

const dotColorMap: Record<BadgeVariant, string> = {
  default: '#94A3B8',
  success: '#22C55E',
  warning: '#F59E0B',
  danger:  '#EF4444',
  info:    '#C9A84C',
  purple:  '#8B5CF6',
  outline: '#94A3B8',
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

export function Badge({ variant = 'default', dot, className, children, style, ...props }: BadgeProps) {
  return (
    <span
      style={{ ...variantStyleMap[variant], ...style }}
      className={cn(
        'inline-flex items-center gap-1 rounded px-1.5 py-px',
        'text-xxs font-semibold leading-none whitespace-nowrap tracking-wide',
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: dotColorMap[variant] }}
        />
      )}
      {children}
    </span>
  );
}

// ── Status badge mapping ──────────────────────────────────────────────────────
const statusBadgeMap: Record<string, BadgeVariant> = {
  DRAFT:              'default',
  UNDER_REVIEW:       'info',
  PENDING_APPROVAL:   'warning',
  APPROVED:           'success',
  PUBLISHED:          'success',
  OBSOLETE:           'outline',
  ARCHIVED:           'outline',
  OPEN:               'warning',
  CONTAINMENT:        'info',
  INVESTIGATION:      'info',
  RCA:                'info',
  ROOT_CAUSE:         'info',
  CAPA_PLANNING:      'warning',
  CAPA_IMPLEMENTATION:'info',
  IMPLEMENTATION:     'info',
  EFFECTIVENESS:      'warning',
  VERIFICATION:       'warning',
  CLOSED:             'success',
  REJECTED:           'danger',
  IN_PROGRESS:        'info',
  PENDING:            'warning',
  COMPLETED:          'success',
  NOT_STARTED:        'default',
  OVERDUE:            'danger',
  CANCELLED:          'outline',
  SCHEDULED:          'info',
  ACTIVE:             'info',
  FINDING_REVIEW:     'warning',
  REPORT_ISSUED:      'warning',
  EXPIRED:            'danger',
  RENEWAL_DUE:        'warning',
  VALID:              'success',
};

const statusLabels: Record<string, string> = {
  UNDER_REVIEW:       'In Review',
  PENDING_APPROVAL:   'Pending Approval',
  CAPA_PLANNING:      'CAPA Planning',
  CAPA_IMPLEMENTATION:'CAPA Implementation',
  ROOT_CAUSE:         'Root Cause Analysis',
  NOT_STARTED:        'Not Started',
  IN_PROGRESS:        'In Progress',
  FINDING_REVIEW:     'Finding Review',
  REPORT_ISSUED:      'Report Issued',
  RENEWAL_DUE:        'Renewal Due',
};

export function StatusBadge({ status }: { status: string }) {
  const label = statusLabels[status] ?? status.replace(/_/g, ' ');
  const variant = statusBadgeMap[status] ?? 'default';
  return <Badge variant={variant} dot>{label}</Badge>;
}

const severityBadgeMap: Record<string, BadgeVariant> = {
  CRITICAL: 'danger',
  MAJOR:    'warning',
  MINOR:    'default',
};

export function SeverityBadge({ severity }: { severity: string }) {
  return <Badge variant={severityBadgeMap[severity] ?? 'default'} dot>{severity}</Badge>;
}

const typeBadgeMap: Record<string, BadgeVariant> = {
  DEVIATION:   'warning',
  PRODUCT_NC:  'danger',
  PROCESS_NC:  'info',
  OOS:         'danger',
  COMPLAINT:   'danger',
  CORRECTIVE:  'info',
  PREVENTIVE:  'info',
  OOT:         'warning',
};

export function TypeBadge({ type }: { type: string }) {
  return <Badge variant={typeBadgeMap[type] ?? 'default'}>{type.replace(/_/g, ' ')}</Badge>;
}
