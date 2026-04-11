import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ClipboardList, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { StatsCard } from '@/components/ui/StatsCard';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { cn } from '@/lib/utils';
import { useInspectionRecords, type InspectionRecord, type InspectionType, type InspectionResult } from './hooks';

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

export default function InspectionListPage() {
  const navigate = useNavigate();
  const [typeFilter, setTypeFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');

  const { data: records = [], isLoading } = useInspectionRecords({
    type: typeFilter || undefined,
    result: resultFilter || undefined,
  });

  const total = records.length;
  const passCount = records.filter(r => r.result === 'PASS').length;
  const failCount = records.filter(r => r.result === 'FAIL').length;
  const pendingCount = records.filter(r => r.result === 'PENDING').length;

  const columns: Column<InspectionRecord>[] = [
    {
      key: 'inspectionNumber',
      header: 'Inspection #',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-slate-900">{row.inspectionNumber}</span>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (row) => {
        const cfg = TYPE_CONFIG[row.type];
        return <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cfg.color)}>{cfg.label}</span>;
      },
    },
    {
      key: 'partNumber',
      header: 'Part Number',
      render: (row) => <span className="font-mono text-xs text-gray-700">{row.partNumber}</span>,
    },
    {
      key: 'partName',
      header: 'Part Name',
      render: (row) => <span className="text-sm font-medium text-gray-900">{row.partName}</span>,
    },
    {
      key: 'batchNumber',
      header: 'Batch #',
      render: (row) => <span className="text-xs text-gray-500">{row.batchNumber}</span>,
    },
    {
      key: 'inspector',
      header: 'Inspector',
      render: (row) => <span className="text-xs text-gray-600">{row.inspector}</span>,
    },
    {
      key: 'inspectedAt',
      header: 'Date',
      render: (row) => (
        <span className="text-xs text-gray-500">{new Date(row.inspectedAt).toLocaleDateString()}</span>
      ),
    },
    {
      key: 'defectsFound',
      header: 'Defects',
      render: (row) => (
        <span className={cn('text-xs font-semibold tabular-nums', row.defectsFound > 0 ? 'text-red-600' : 'text-gray-500')}>
          {row.defectsFound}
        </span>
      ),
    },
    {
      key: 'result',
      header: 'Result',
      render: (row) => {
        const cfg = RESULT_CONFIG[row.result];
        return <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cfg.color)}>{cfg.label}</span>;
      },
    },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inspection Records</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage incoming, in-process, and final inspection records
          </p>
        </div>
        <Button onClick={() => navigate('/inspection/new')}>
          <Plus size={16} />
          New Inspection
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard title="Total" value={total} icon={ClipboardList}
          onClick={() => setResultFilter('')} />
        <StatsCard title="Pass" value={passCount} icon={CheckCircle2} iconColor="bg-green-50 text-green-600"
          onClick={() => setResultFilter('PASS')} />
        <StatsCard title="Fail" value={failCount} icon={XCircle} iconColor="bg-red-50 text-red-600"
          onClick={() => setResultFilter('FAIL')} />
        <StatsCard title="Pending" value={pendingCount} icon={Clock} iconColor="bg-gray-100 text-gray-500"
          onClick={() => setResultFilter('PENDING')} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
        >
          <option value="">All Types</option>
          <option value="INCOMING">Incoming</option>
          <option value="IN_PROCESS">In-Process</option>
          <option value="FINAL">Final</option>
          <option value="RECEIVING">Receiving</option>
        </select>
        <select
          value={resultFilter}
          onChange={e => setResultFilter(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
        >
          <option value="">All Results</option>
          <option value="PASS">Pass</option>
          <option value="FAIL">Fail</option>
          <option value="CONDITIONAL_PASS">Conditional Pass</option>
          <option value="PENDING">Pending</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-surface-border shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={records}
          isLoading={isLoading}
          emptyMessage="No inspection records found"
          onRowClick={(row) => navigate(`/inspection/${row.id}`)}
        />
      </div>
    </div>
  );
}
