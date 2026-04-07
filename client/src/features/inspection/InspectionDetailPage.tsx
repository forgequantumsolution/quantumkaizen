import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { useInspectionRecord, type InspectionType, type InspectionResult } from './hooks';

const TYPE_CONFIG: Record<InspectionType, { label: string; color: string }> = {
  INCOMING: { label: 'Incoming', color: 'bg-blue-100 text-blue-700' },
  IN_PROCESS: { label: 'In-Process', color: 'bg-purple-100 text-purple-700' },
  FINAL: { label: 'Final', color: 'bg-indigo-100 text-indigo-700' },
  RECEIVING: { label: 'Receiving', color: 'bg-cyan-100 text-cyan-700' },
};

const RESULT_CONFIG: Record<InspectionResult, { label: string; color: string }> = {
  PASS: { label: 'Pass', color: 'bg-green-100 text-green-700' },
  FAIL: { label: 'Fail', color: 'bg-red-100 text-red-700' },
  CONDITIONAL_PASS: { label: 'Conditional Pass', color: 'bg-amber-100 text-amber-700' },
  PENDING: { label: 'Pending', color: 'bg-gray-100 text-gray-500' },
};

export default function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: record, isLoading } = useInspectionRecord(id!);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
      </div>
    );
  }

  if (!record) {
    return (
      <div className="py-32 text-center">
        <p className="text-gray-500">Inspection record not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/inspection')}>
          Back to List
        </Button>
      </div>
    );
  }

  const typeCfg = TYPE_CONFIG[record.type];
  const resultCfg = RESULT_CONFIG[record.result];

  // AQL: defects found / sampled quantity as percentage
  const defectRate = record.sampledQuantity > 0
    ? ((record.defectsFound / record.sampledQuantity) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => navigate('/inspection')} className="hover:text-gray-900 transition-colors">
          Inspection Records
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-gray-900">{record.inspectionNumber}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">{record.partName}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', resultCfg.color)}>
              {resultCfg.label}
            </span>
            <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', typeCfg.color)}>
              {typeCfg.label}
            </span>
            <span className="font-mono text-xs font-semibold text-slate-900">
              {record.inspectionNumber}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {record.result === 'FAIL' && (
            <Button
              variant="danger"
              onClick={() => navigate('/qms/non-conformances/new', {
                state: {
                  title: `NC from Inspection ${record?.inspectionNumber}`,
                  source: 'Inspection',
                  batchLot: record?.batchNumber,
                  productProcess: record?.partName,
                }
              })}
            >
              <AlertTriangle size={15} />
              Initiate NC
            </Button>
          )}
          <Button variant="outline" onClick={() => navigate('/inspection')}>
            Back to List
          </Button>
        </div>
      </div>

      {/* Main Content — 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Inspection Details */}
        <Card>
          <CardHeader>
            <CardTitle>Inspection Details</CardTitle>
          </CardHeader>
          <dl className="space-y-3 text-sm">
            {[
              ['Inspection Number', record.inspectionNumber],
              ['Part Number', record.partNumber],
              ['Part Name', record.partName],
              ['Supplier', record.supplier ?? '—'],
              ['Batch / Work Order', record.batchNumber],
              ['Inspector', record.inspector],
              ['Inspection Date', new Date(record.inspectedAt).toLocaleDateString()],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="text-gray-500 shrink-0">{label}</dt>
                <dd className="font-medium text-gray-900 text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        {/* Right: Results */}
        <Card>
          <CardHeader>
            <CardTitle>Inspection Results</CardTitle>
          </CardHeader>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Total Quantity</dt>
              <dd className="font-medium text-gray-900 tabular-nums">{record.quantity.toLocaleString()}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Sampled Quantity</dt>
              <dd className="font-medium text-gray-900 tabular-nums">{record.sampledQuantity}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Defects Found</dt>
              <dd className={cn('font-semibold tabular-nums', record.defectsFound > 0 ? 'text-red-600' : 'text-gray-900')}>
                {record.defectsFound}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">Defect Rate</dt>
              <dd className={cn('font-semibold tabular-nums', record.defectsFound > 0 ? 'text-amber-600' : 'text-gray-900')}>
                {defectRate}%
              </dd>
            </div>
            <div className="pt-3 border-t border-slate-100">
              <dt className="text-xs font-medium text-gray-500 mb-1">Disposition</dt>
              <dd className="text-sm text-gray-700">{record.disposition}</dd>
            </div>
          </dl>
        </Card>
      </div>

      {/* Notes */}
      {record.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <p className="text-sm text-gray-700 leading-relaxed">{record.notes}</p>
        </Card>
      )}

      {/* FAIL callout */}
      {record.result === 'FAIL' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Inspection Failed</p>
            <p className="text-sm text-red-600 mt-0.5">
              This inspection has failed. Consider initiating a Non-Conformance to formally document, investigate,
              and resolve the issue.
            </p>
            <Button
              className="mt-3"
              variant="danger"
              onClick={() => navigate('/qms/non-conformances/new', {
                state: {
                  title: `NC from Inspection ${record?.inspectionNumber}`,
                  source: 'Inspection',
                  batchLot: record?.batchNumber,
                  productProcess: record?.partName,
                }
              })}
            >
              <AlertTriangle size={14} />
              Initiate Non-Conformance
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
