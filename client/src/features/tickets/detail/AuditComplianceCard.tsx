/**
 * Audit-compliance summary shown inside an audit workflow ticket.
 *
 * When the ticket is linked to an audit register (customFields.audit_register_id),
 * this card surfaces every checklist disposition submitted against the audit —
 * Compliant / Non-Conformance / Observation / N-A — with a per-status count and
 * the individual items grouped by section. Non-conformance/observation items that
 * were promoted show their NC number so the parent ticket carries the full audit
 * outcome in one place.
 */
import { useMemo } from 'react';
import { ClipboardCheck } from 'lucide-react';
import { Card } from '@/components/ui';
import { COMPLIANCE_OPTIONS } from '@/features/forms/fieldCatalog';
import { useComplianceResults, type ComplianceResultRow } from '@/lib/api/audit';

interface Props {
  registerId: string;
}

// Display order + label/colour, reusing the shared disposition vocabulary.
const META = new Map(COMPLIANCE_OPTIONS.map((o) => [o.value, o]));
const ORDER: ComplianceResultRow['result'][] = [
  'NON_CONFORMANCE',
  'OBSERVATION',
  'COMPLIANT',
  'NOT_APPLICABLE',
];

function Badge({ result }: { result: ComplianceResultRow['result'] }) {
  const meta = META.get(result);
  const color = meta?.color ?? '#64748b';
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ color, backgroundColor: `${color}1a` }}
    >
      {meta?.label ?? result}
    </span>
  );
}

export default function AuditComplianceCard({ registerId }: Props) {
  const { data, isLoading } = useComplianceResults({ register_id: registerId });
  const rows = data?.data ?? [];

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.result] = (c[r.result] ?? 0) + 1;
    return c;
  }, [rows]);

  // Group the items by their checklist section, preserving first-seen order.
  const sections = useMemo(() => {
    const map = new Map<string, ComplianceResultRow[]>();
    for (const r of rows) {
      const key = r.section || 'General';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()];
  }, [rows]);

  // Nothing to show until a checklist has been submitted for this audit.
  if (isLoading || rows.length === 0) return null;

  return (
    <Card className="!p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ClipboardCheck size={16} className="text-[#C9A84C]" />
        <h3 className="text-sm font-semibold text-gray-800">Audit Compliance</h3>
        <span className="text-[11px] text-gray-400">{rows.length} items</span>
      </div>

      {/* Per-disposition summary */}
      <div className="flex flex-wrap gap-2">
        {ORDER.filter((r) => counts[r]).map((r) => (
          <div
            key={r}
            className="flex items-center gap-1.5 rounded-md border border-gray-100 bg-gray-50 px-2.5 py-1"
          >
            <Badge result={r} />
            <span className="text-xs font-semibold text-gray-700">{counts[r]}</span>
          </div>
        ))}
      </div>

      {/* Items grouped by checklist section */}
      <div className="space-y-3">
        {sections.map(([section, items]) => (
          <div key={section}>
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              {section}
            </div>
            <ul className="space-y-1">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="flex items-start justify-between gap-3 rounded-md border border-gray-100 px-2.5 py-1.5"
                >
                  <span className="text-xs text-gray-700">{it.label}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {it.nc && (
                      <span className="text-[11px] font-medium text-[#B45309]">
                        {it.nc.nc_number}
                      </span>
                    )}
                    <Badge result={it.result} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Card>
  );
}
