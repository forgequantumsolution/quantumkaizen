import { Drawer, Tag, Tooltip } from 'antd';
import { ArrowRight, ShieldCheck, ShieldAlert, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { ACTION_COLOR } from './EntityAuditTrail';
import type { TrailRow } from '@/lib/api/auditTrail';

/**
 * Full detail for one audit entry.
 *
 * The table stays scannable by showing only what a reader needs at a glance;
 * everything the record holds — provenance, the full diff, and the integrity
 * hashes — lives here, one click away. Nothing captured is hidden from view.
 */

const CopyBtn = ({ text }: { text: string }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="text-gray-400 hover:text-gray-700 shrink-0"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
    >
      {done ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
    </button>
  );
};

/** One label/value row. `mono` for ids and hashes, `copy` adds a copy button. */
const Field = ({
  label,
  value,
  mono,
  copy,
  breakAll,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  copy?: string;
  breakAll?: boolean;
}) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 py-2 border-b border-gray-100 last:border-0">
      <div className="text-xs font-medium text-gray-500 pt-0.5">{label}</div>
      <div
        className={`text-sm text-gray-900 flex items-start gap-1.5 ${mono ? 'font-mono text-xs' : ''} ${
          breakAll ? 'break-all' : ''
        }`}
      >
        <span className="min-w-0">{value}</span>
        {copy && <CopyBtn text={copy} />}
      </div>
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-5">
    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
      {title}
    </div>
    <div className="bg-gray-50 rounded-lg px-3">{children}</div>
  </div>
);

const prettyDiff = (diff: unknown): string | null => {
  if (diff === null || diff === undefined) return null;
  try {
    return JSON.stringify(diff, null, 2);
  } catch {
    return String(diff);
  }
};

interface Props {
  row: TrailRow | null;
  open: boolean;
  onClose: () => void;
}

export default function AuditEntryDrawer({ row, open, onClose }: Props) {
  if (!row) return <Drawer open={open} onClose={onClose} width={520} title="Audit entry" />;

  const when = new Date(row.created_at);
  // `client_tz_offset_min` follows getTimezoneOffset() (UTC minus local), so the
  // sign flips. Rendered as hh:mm because not every zone is a whole hour off.
  const tz =
    row.client_tz_offset_min != null
      ? (() => {
          const abs = Math.abs(row.client_tz_offset_min);
          const pad = (n: number) => String(n).padStart(2, '0');
          return `UTC${row.client_tz_offset_min <= 0 ? '+' : '-'}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
        })()
      : null;
  const diffText = prettyDiff(row.diff);
  const isFieldChange = row.field && row.field !== 'workflowEvent';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={560}
      title={
        <div className="flex items-center gap-2">
          <Tag color={ACTION_COLOR[row.action] ?? 'default'} className="!mr-0">
            {row.action.replace(/_/g, ' ')}
          </Tag>
          <span className="text-sm font-medium text-gray-900 truncate">
            {row.entity_label ?? row.entity_type}
          </span>
          {row.criticality === 'CRITICAL' && (
            <Tooltip title="Critical — included in the periodic audit-trail review">
              <ShieldCheck size={15} className="text-amber-500 shrink-0" />
            </Tooltip>
          )}
        </div>
      }
    >
      <Section title="What changed">
        <Field label="Record type" value={row.entity_type} />
        <Field label="Record" value={row.entity_label ?? row.entity_id} copy={row.entity_id} breakAll />
        <Field label="Record ID" value={row.entity_id} mono copy={row.entity_id} breakAll />
        <Field label="Module" value={row.module} />
        <Field label="Action" value={row.action.replace(/_/g, ' ')} />
        {isFieldChange && (
          <>
            <Field label="Field" value={row.field} />
            <Field
              label="Change"
              value={
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-gray-500 line-through break-all">{row.old_value || '—'}</span>
                  <ArrowRight size={12} className="text-gray-400 shrink-0" />
                  <span className="text-gray-900 break-all">{row.new_value || '—'}</span>
                </span>
              }
            />
          </>
        )}
        {!isFieldChange && row.new_value && (
          <Field label="Event" value={row.new_value.replace(/_/g, ' ')} />
        )}
        {row.value_type && <Field label="Value type" value={row.value_type} />}
      </Section>

      {(row.reason || row.reason_code || row.signature_id) && (
        <Section title="Why">
          <Field label="Reason" value={row.reason} />
          <Field label="Reason code" value={row.reason_code} />
          <Field label="E-signature" value={row.signature_id} mono copy={row.signature_id ?? undefined} breakAll />
        </Section>
      )}

      <Section title="Who">
        <Field label="User" value={row.user_name} />
        <Field label="Role" value={row.user_role} />
        <Field label="Department" value={row.user_department} />
        <Field label="Employee ID" value={row.user_employee_id} />
        <Field label="On behalf of" value={row.on_behalf_of_id} mono />
        <Field label="Actor type" value={row.actor_type} />
        <Field label="User ID" value={row.user_id} mono copy={row.user_id ?? undefined} breakAll />
      </Section>

      <Section title="When & where">
        <Field
          label="Timestamp"
          value={
            <span>
              {when.toLocaleString(undefined, {
                day: '2-digit', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit',
              })}
              {tz && <span className="text-gray-400 text-xs ml-1">({tz})</span>}
            </span>
          }
        />
        <Field label="IP address" value={row.ip_address} mono copy={row.ip_address ?? undefined} />
        <Field label="Source" value={row.source} />
        <Field label="Session" value={row.session_id} mono copy={row.session_id ?? undefined} breakAll />
        <Field label="Request" value={row.request_id} mono copy={row.request_id ?? undefined} breakAll />
        <Field label="User agent" value={row.user_agent} breakAll />
      </Section>

      {diffText && (
        <Section title="Full record snapshot">
          <pre className="text-[11px] leading-relaxed text-gray-700 whitespace-pre-wrap break-all py-2 max-h-72 overflow-auto">
            {diffText}
          </pre>
        </Section>
      )}

      <Section title="Integrity">
        <Field
          label="Status"
          value={
            row.sealed ? (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <ShieldCheck size={14} /> Chained — alteration would be detectable
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-amber-600">
                <ShieldAlert size={14} /> Awaiting the next chain seal
              </span>
            )
          }
        />
        <Field label="Sequence" value={row.seq} mono />
        <Field label="Chain (day)" value={row.chain_key} mono />
        <Field label="Hash" value={row.hash} mono copy={row.hash ?? undefined} breakAll />
        <Field label="Prev hash" value={row.prev_hash} mono copy={row.prev_hash ?? undefined} breakAll />
      </Section>
    </Drawer>
  );
}
