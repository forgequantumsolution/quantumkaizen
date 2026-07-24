import { Empty, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useHasPermission } from '@/stores/authStore';
import { useEntityHistory, type TrailRow } from '@/lib/api/auditTrail';

/**
 * Change history for a single record — drop onto any detail page as a tab:
 *
 *   <EntityAuditTrail entityType="Ticket" entityId={id} />
 *
 * Columns are built by `buildTrailColumns` so this and the global viewer stay
 * identical; the viewer adds a Record column, which is redundant here.
 */

export const ACTION_COLOR: Record<string, string> = {
  CREATE: 'green',
  UPDATE: 'blue',
  DELETE: 'red',
  SOFT_DELETE: 'volcano',
  RESTORE: 'cyan',
  TRANSITION: 'geekblue',
  APPROVE: 'green',
  REJECT: 'red',
  SIGN: 'purple',
  SCORE: 'gold',
  LOGIN: 'default',
  LOGIN_FAILED: 'red',
  LOGOUT: 'default',
  PASSWORD_CHANGE: 'orange',
  PERMISSION_GRANT: 'orange',
  PERMISSION_REVOKE: 'orange',
  ROLE_CHANGE: 'orange',
  VIEW: 'default',
  EXPORT: 'gold',
  DOWNLOAD: 'gold',
  CONFIG_CHANGE: 'magenta',
};

/** "24 Jul 2026, 09:25" — short enough not to wrap at the column width. */
const formatWhen = (iso: string) => {
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  };
};

/**
 * One-line value with an ellipsis. Audit values are frequently long opaque ids,
 * so they are clipped rather than wrapped — wrapping made row heights lurch
 * between one and four lines and turned the table into a wall.
 */
const Clip = ({ text, className = '' }: { text: string; className?: string }) => (
  <Tooltip title={text.length > 40 ? text : undefined}>
    <span className={`block truncate ${className}`}>{text}</span>
  </Tooltip>
);

/**
 * What actually changed. Renders the field diff when there is one; for events
 * that are not field edits (logins, transitions, exports) it shows the event
 * itself rather than repeating the record name, which is already in its own
 * column.
 */
const Details = ({ r, showRecord }: { r: TrailRow; showRecord: boolean }) => {
  const reason = r.reason ? (
    <div className="text-xs text-gray-500 truncate mt-0.5">
      <span className="text-gray-400">Reason: </span>
      <Tooltip title={r.reason.length > 50 ? r.reason : undefined}>{r.reason}</Tooltip>
    </div>
  ) : null;

  if (r.field && r.field !== 'workflowEvent') {
    return (
      <div className="min-w-0">
        <div className="text-xs font-medium text-gray-500 truncate">{r.field}</div>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-gray-500 line-through truncate max-w-[45%]">
            {r.old_value || '—'}
          </span>
          <ArrowRight size={11} className="text-gray-400 shrink-0" />
          <span className="text-gray-900 truncate max-w-[45%]">{r.new_value || '—'}</span>
        </div>
        {reason}
      </div>
    );
  }

  // Workflow-engine events carry the event name in new_value.
  const label = r.field === 'workflowEvent' && r.new_value
    ? r.new_value.replace(/_/g, ' ').toLowerCase()
    : null;

  if (label) {
    return (
      <div className="min-w-0">
        <span className="text-gray-900 capitalize">{label}</span>
        {reason}
      </div>
    );
  }

  // Nothing further to say beyond the action and the record itself. Repeating
  // the record here (as the first version did) filled the widest column with a
  // duplicate of the one beside it.
  if (!showRecord && r.entity_label) {
    return (
      <div className="min-w-0">
        <Clip text={r.entity_label} className="text-gray-700" />
        {reason}
      </div>
    );
  }
  return reason ?? <span className="text-gray-300">—</span>;
};

export const buildTrailColumns = (opts: { showRecord: boolean }): ColumnsType<TrailRow> => {
  const cols: ColumnsType<TrailRow> = [
    {
      title: 'When',
      dataIndex: 'created_at',
      width: 132,
      render: (v: string) => {
        const { date, time } = formatWhen(v);
        return (
          <div className="leading-tight">
            <div className="text-gray-900">{date}</div>
            <div className="text-xs text-gray-400">{time}</div>
          </div>
        );
      },
    },
    {
      title: 'Who',
      dataIndex: 'user_name',
      width: 176,
      render: (v: string, r) => (
        // Provenance (IP, session, source) lives in the tooltip: it matters for
        // an investigation but is noise in every row of a normal read.
        <Tooltip
          title={
            <div className="text-xs">
              {r.user_role && <div>Role: {r.user_role}</div>}
              {r.user_department && <div>Dept: {r.user_department}</div>}
              {r.ip_address && <div>IP: {r.ip_address}</div>}
              {r.session_id && <div>Session: {r.session_id.slice(0, 8)}…</div>}
              <div>Source: {r.source ?? r.actor_type}</div>
            </div>
          }
        >
          <div className="leading-tight min-w-0">
            <div className="text-gray-900 truncate">{v}</div>
            {r.user_role && <div className="text-xs text-gray-400 truncate">{r.user_role}</div>}
          </div>
        </Tooltip>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      width: 138,
      render: (v: string, r) => (
        <div className="flex items-center gap-1">
          <Tag color={ACTION_COLOR[v] ?? 'default'} className="!mr-0">
            {v.replace(/_/g, ' ')}
          </Tag>
          {r.criticality === 'CRITICAL' && (
            <Tooltip title="Critical — included in the periodic audit-trail review">
              <ShieldCheck size={13} className="text-amber-500 shrink-0" />
            </Tooltip>
          )}
        </div>
      ),
    },
  ];

  if (opts.showRecord) {
    cols.push({
      title: 'Record',
      key: 'record',
      width: 210,
      render: (_v, r) => (
        <div className="leading-tight min-w-0">
          <Clip text={r.entity_label ?? r.entity_type} className="text-gray-900" />
          <div className="text-xs text-gray-400 truncate">
            {r.entity_label ? r.entity_type : `${r.entity_type} · ${r.entity_id.slice(0, 8)}`}
            {r.module ? ` · ${r.module}` : ''}
          </div>
        </div>
      ),
    });
  }

  cols.push({
    title: 'Details',
    key: 'details',
    // No width: takes the remaining space, so the table fits its container
    // instead of forcing a horizontal scrollbar.
    render: (_v, r) => <Details r={r} showRecord={opts.showRecord} />,
  });

  cols.push({
    title: '',
    key: 'sealed',
    width: 36,
    align: 'center',
    render: (_v, r) =>
      r.sealed ? (
        <Tooltip title="Chained — any later alteration would be detectable">
          <ShieldCheck size={13} className="text-emerald-500 inline" />
        </Tooltip>
      ) : (
        <Tooltip title="Awaiting the next chain seal (runs every 30 seconds)">
          <span className="text-gray-300 text-xs">○</span>
        </Tooltip>
      ),
  });

  return cols;
};

interface Props {
  entityType: string;
  entityId: string | undefined;
  compact?: boolean;
}

export default function EntityAuditTrail({ entityType, entityId, compact }: Props) {
  const canRead = useHasPermission('audit_trail.read');
  const { data, isLoading } = useEntityHistory(entityType, entityId, canRead);

  if (!canRead) {
    return (
      <div className="py-10 text-center text-sm text-gray-500">
        You do not have permission to view the audit trail.
      </div>
    );
  }

  const rows = data?.data ?? [];

  return (
    <Table<TrailRow>
      rowKey="id"
      size="small"
      loading={isLoading}
      dataSource={rows}
      columns={buildTrailColumns({ showRecord: false })}
      pagination={rows.length > 15 ? { pageSize: 15, showSizeChanger: false, size: 'small' } : false}
      locale={{
        emptyText: (
          <Empty description="No recorded changes yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ),
      }}
      className={compact ? 'audit-trail-compact' : undefined}
    />
  );
}
