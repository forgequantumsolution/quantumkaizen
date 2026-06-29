import type { DocumentStatus } from '@/lib/api/dms';

const MAP: Record<DocumentStatus, { label: string; cls: string }> = {
  DRAFT:      { label: 'Draft',      cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  IN_REVIEW:  { label: 'In Review',  cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED:   { label: 'Approved',   cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  EFFECTIVE:  { label: 'Effective',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  SUPERSEDED: { label: 'Superseded', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  RETIRED:    { label: 'Retired',    cls: 'bg-red-50 text-red-700 border-red-200' },
};

export default function DocStatusBadge({ status }: { status: DocumentStatus }) {
  const s = MAP[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${s.cls}`}>
      {s.label}
    </span>
  );
}
