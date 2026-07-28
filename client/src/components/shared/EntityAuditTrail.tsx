import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { Empty, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useHasPermission } from '@/stores/authStore';
import { api } from '@/lib/api';
import { useEntityHistory, type TrailRow } from '@/lib/api/auditTrail';
import AuditEntryDrawer from './AuditEntryDrawer';

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

  // A short human summary for actions that aren't field edits, so the column
  // reads for logins, signatures and access events instead of sitting blank.
  let summary: string | null = null;
  if (r.field === 'workflowEvent' && r.new_value) {
    summary = r.new_value.replace(/_/g, ' ').toLowerCase();
  } else if (r.action === 'SIGN' && r.new_value) {
    summary = `Signed: ${r.new_value}`;
  } else if (r.action === 'LOGIN') {
    summary = 'Signed in';
  } else if (r.action === 'LOGIN_FAILED') {
    summary = r.reason ?? 'Sign-in failed';
  } else if (r.action === 'PASSWORD_CHANGE') {
    summary = 'Password changed';
  } else if (['VIEW', 'EXPORT', 'DOWNLOAD', 'PRINT'].includes(r.action)) {
    summary = { VIEW: 'Viewed', EXPORT: 'Exported', DOWNLOAD: 'Downloaded', PRINT: 'Printed' }[r.action] ?? null;
  }

  if (summary) {
    return (
      <div className="min-w-0">
        <span className="text-gray-800 capitalize truncate block">{summary}</span>
        {r.action !== 'LOGIN_FAILED' && reason}
      </div>
    );
  }

  // CREATE / DELETE / RESTORE add nothing beyond the Action tag and the Record
  // beside them; a reason is the only thing worth surfacing when present.
  return reason ?? <span className="text-gray-300">—</span>;
};

export const buildTrailColumns = (opts: {
  showRecord: boolean;
  /**
   * Adds a narrow "Source" column naming the entity each row came from. Set
   * only when a view merges more than one entity's history (e.g. a ticket plus
   * its form submissions) — without it a form-level event is indistinguishable
   * from a ticket-level one, which on a Part 11 trail is worse than useless.
   */
  showSource?: boolean;
}): ColumnsType<TrailRow> => {
  const cols: ColumnsType<TrailRow> = [
    {
      title: 'When',
      dataIndex: 'created_at',
      width: 150,
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
      width: 210,
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
      width: 150,
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
    // Module is populated for almost every row and was previously buried in the
    // Record subtitle; as its own column it fills space the Details column left
    // empty on non-diff rows, and is filterable to scan against.
    cols.push({
      title: 'Module',
      dataIndex: 'module',
      width: 130,
      render: (v: string | null) =>
        v ? (
          <span className="text-xs font-medium text-gray-600">{v}</span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    });
    cols.push({
      title: 'Record',
      key: 'record',
      // Explicit width so no single column absorbs all the slack on a wide
      // screen; with every column sized, the browser's fixed layout distributes
      // any extra width proportionally, keeping the columns uniform.
      width: 320,
      render: (_v, r) => {
        const label = r.entity_label ?? r.entity_type;
        // System keys like "wf_type.<uuid>.read" carry their meaning in the
        // suffix, which end-truncation hides. Middle-ellipsis keeps both ends
        // ("wf_type.7ce2…read") so the action is still readable.
        const isKey = /^[a-z_]+\.[0-9a-f-]{20,}\./i.test(label);
        const shown = isKey && label.length > 30
          ? `${label.slice(0, 14)}…${label.slice(-10)}`
          : label;
        return (
          <div className="leading-tight min-w-0">
            <Tooltip title={shown !== label ? label : undefined}>
              <span className="block truncate text-gray-900">{shown}</span>
            </Tooltip>
            <div className="text-xs text-gray-400 truncate">{r.entity_type}</div>
          </div>
        );
      },
    });
  }

  if (opts.showSource) {
    cols.push({
      title: 'Source',
      dataIndex: 'entity_type',
      width: 120,
      render: (v: string) => (
        <span className="text-xs font-medium text-gray-600">
          {v === 'FormSubmission' ? 'Stage form' : v}
        </span>
      ),
    });
  }

  cols.push({
    title: 'Details',
    key: 'details',
    // In the global view every column is sized, so the fixed layout spreads any
    // extra width evenly rather than piling it into one column. In the entity
    // view Details stays flexible — it is the main content column there.
    width: opts.showRecord ? 300 : undefined,
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
  /**
   * Extra records whose history should be folded into this view — e.g. a
   * ticket's own audit trail only covers Ticket-column edits, not the
   * FormSubmission rows holding its stage-form answers. Pass those submission
   * ids here so field-level edits to "Verified By", "Implementation Verified",
   * etc. show up alongside the ticket-level events instead of being invisible.
   */
  extraRefs?: Array<{ entityType: string; entityId: string }>;
}

export default function EntityAuditTrail({ entityType, entityId, compact, extraRefs = [] }: Props) {
  const canRead = useHasPermission('audit_trail.read');
  const { data, isLoading } = useEntityHistory(entityType, entityId, canRead);

  const extraQueries = useQueries({
    queries: extraRefs.map((ref) => ({
      queryKey: ['audit-trail', 'history', ref.entityType, ref.entityId],
      queryFn: () =>
        api.get(`/audit-trail/${ref.entityType}/${ref.entityId}`).then((r) => r.data as { data: TrailRow[] }),
      enabled: canRead,
    })),
  });

  const [selected, setSelected] = useState<TrailRow | null>(null);

  const extraLoading = extraQueries.some((q) => q.isLoading);
  // `extraRefs` grows from [] once the caller's own query resolves, so the
  // fingerprint is joined into ONE dep rather than spread — a spread would
  // change the deps array's length between renders, which React rejects.
  const extraFingerprint = extraQueries.map((q) => q.dataUpdatedAt).join(',');
  const rows = useMemo(() => {
    const merged: TrailRow[] = [...(data?.data ?? [])];
    for (const q of extraQueries) {
      if (q.data?.data) merged.push(...q.data.data);
    }
    return merged.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, extraFingerprint]);

  // Kept below every hook: an early return above them would change the hook
  // order as soon as `canRead` resolves from the auth store.
  if (!canRead) {
    return (
      <div className="py-10 text-center text-sm text-gray-500">
        You do not have permission to view the audit trail.
      </div>
    );
  }

  return (
    <>
      <Table<TrailRow>
        rowKey="id"
        size="small"
        loading={isLoading || extraLoading}
        dataSource={rows}
        columns={buildTrailColumns({ showRecord: false, showSource: extraRefs.length > 0 })}
        onRow={(record) => ({
          onClick: () => setSelected(record),
          className: 'cursor-pointer',
        })}
        pagination={
          rows.length > 15 ? { pageSize: 15, showSizeChanger: false, size: 'small' } : false
        }
        locale={{
          emptyText: (
            <Empty description="No recorded changes yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ),
        }}
        className={compact ? 'audit-trail-compact' : undefined}
      />
      <AuditEntryDrawer row={selected} open={!!selected} onClose={() => setSelected(null)} />
    </>
  );
}
