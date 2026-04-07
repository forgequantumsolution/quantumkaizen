import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronRight, Download, FileText, History } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/DataTable';
import type { Column } from '@/components/ui/DataTable';
import { cn } from '@/lib/utils';
import { useCalibrationRecord, type CalibrationStatus } from './hooks';

const STATUS_CONFIG: Record<CalibrationStatus, { label: string; color: string }> = {
  CURRENT: { label: 'Current', color: 'bg-green-100 text-green-700' },
  DUE_SOON: { label: 'Due Soon', color: 'bg-amber-100 text-amber-700' },
  OVERDUE: { label: 'Overdue', color: 'bg-red-100 text-red-700' },
  OUT_OF_SERVICE: { label: 'Out of Service', color: 'bg-gray-100 text-gray-500' },
};

interface HistoryEntry {
  id: string;
  date: string;
  calibratedBy: string;
  certificate: string;
  result: string;
  nextDue: string;
}

const TABS = ['Overview', 'History', 'Certificate'];

export default function CalibrationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: record, isLoading } = useCalibrationRecord(id!);
  const [activeTab, setActiveTab] = useState('Overview');

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
        <p className="text-gray-500">Equipment record not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/calibration')}>
          Back to List
        </Button>
      </div>
    );
  }

  const cfg = STATUS_CONFIG[record.status];

  const mockHistory: HistoryEntry[] = [
    { id: 'h1', date: record.lastCalibrated, calibratedBy: record.calibratedBy, certificate: record.certificate, result: 'PASS', nextDue: record.nextDue },
    { id: 'h2', date: new Date(new Date(record.lastCalibrated).getTime() - record.frequency * 86400000).toISOString().slice(0, 10), calibratedBy: record.calibratedBy, certificate: 'CERT-PREV-001', result: 'PASS', nextDue: record.lastCalibrated },
    { id: 'h3', date: new Date(new Date(record.lastCalibrated).getTime() - record.frequency * 2 * 86400000).toISOString().slice(0, 10), calibratedBy: 'Internal Lab', certificate: 'CERT-PREV-000', result: 'PASS', nextDue: new Date(new Date(record.lastCalibrated).getTime() - record.frequency * 86400000).toISOString().slice(0, 10) },
  ];

  const historyColumns: Column<HistoryEntry>[] = [
    { key: 'date', header: 'Date', render: (row) => <span className="text-sm">{new Date(row.date).toLocaleDateString()}</span> },
    { key: 'calibratedBy', header: 'Calibrated By', render: (row) => <span className="text-sm text-gray-700">{row.calibratedBy}</span> },
    { key: 'certificate', header: 'Certificate', render: (row) => <span className="font-mono text-xs text-slate-900">{row.certificate}</span> },
    { key: 'result', header: 'Result', render: (row) => <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', row.result === 'PASS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>{row.result}</span> },
    { key: 'nextDue', header: 'Next Due', render: (row) => <span className="text-xs text-gray-500">{new Date(row.nextDue).toLocaleDateString()}</span> },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => navigate('/calibration')} className="hover:text-gray-900 transition-colors">
          Calibration Management
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-gray-900">{record.equipmentId}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-900">{record.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', cfg.color)}>
              {cfg.label}
            </span>
            <span className="font-mono text-xs font-semibold text-slate-900 bg-blue-600-pale px-1.5 py-0.5 rounded">
              {record.equipmentId}
            </span>
            <span className="text-xs text-gray-400">{record.category}</span>
          </div>
        </div>
        <Button variant="outline" onClick={() => navigate('/calibration/new', { state: { equipmentId: record?.equipmentId, name: record?.name, serialNumber: record?.serialNumber } })}>
          Record Calibration
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors',
              activeTab === tab
                ? 'border-b-2 border-navy-600 text-navy-700'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Equipment Specs */}
          <Card>
            <CardHeader>
              <CardTitle>Equipment Specifications</CardTitle>
            </CardHeader>
            <dl className="space-y-3 text-sm">
              {[
                ['Manufacturer', record.manufacturer],
                ['Model', record.model],
                ['Serial Number', record.serialNumber],
                ['Category', record.category],
                ['Location', record.location],
                ['Accuracy', record.accuracy],
                ['Range', record.range],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-gray-500 shrink-0">{label}</dt>
                  <dd className="font-medium text-gray-900 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          {/* Calibration Details */}
          <Card>
            <CardHeader>
              <CardTitle>Calibration Details</CardTitle>
            </CardHeader>
            <dl className="space-y-3 text-sm">
              {[
                ['Status', cfg.label],
                ['Last Calibrated', new Date(record.lastCalibrated).toLocaleDateString()],
                ['Next Due', new Date(record.nextDue).toLocaleDateString()],
                ['Frequency', `Every ${record.frequency} days`],
                ['Calibrated By', record.calibratedBy],
                ['Certificate No.', record.certificate],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-gray-500 shrink-0">{label}</dt>
                  <dd className="font-medium text-gray-900 text-right">{value}</dd>
                </div>
              ))}
            </dl>
            {record.notes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-700">{record.notes}</p>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'History' && (
        <Card noPadding>
          <div className="px-6 pt-6">
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-gray-400" />
                  Calibration History
                </div>
              </CardTitle>
            </CardHeader>
          </div>
          <DataTable
            columns={historyColumns}
            data={mockHistory}
            emptyMessage="No calibration history found"
          />
        </Card>
      )}

      {/* Certificate Tab */}
      {activeTab === 'Certificate' && (
        <Card>
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                Calibration Certificate
              </div>
            </CardTitle>
          </CardHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-gray-500 mb-0.5">Certificate Number</dt>
                <dd className="font-mono text-sm font-semibold text-slate-900">{record.certificate}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 mb-0.5">Issuing Laboratory</dt>
                <dd className="font-medium text-gray-900">{record.calibratedBy}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 mb-0.5">Issue Date</dt>
                <dd className="font-medium text-gray-900">{new Date(record.lastCalibrated).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 mb-0.5">Valid Until</dt>
                <dd className={cn('font-medium', record.status === 'OVERDUE' ? 'text-red-600' : record.status === 'DUE_SOON' ? 'text-amber-600' : 'text-gray-900')}>
                  {new Date(record.nextDue).toLocaleDateString()}
                </dd>
              </div>
            </dl>

            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs font-medium text-gray-500 mb-0.5">Equipment</dt>
                <dd className="font-medium text-gray-900">{record.name}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 mb-0.5">Manufacturer / Model</dt>
                <dd className="font-medium text-gray-900">{record.manufacturer} {record.model}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 mb-0.5">Serial Number</dt>
                <dd className="font-mono text-sm text-gray-900">{record.serialNumber}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 mb-0.5">Accuracy / Range</dt>
                <dd className="font-medium text-gray-900">{record.accuracy} | {record.range}</dd>
              </div>
            </dl>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                const certText = [
                  `CALIBRATION CERTIFICATE`,
                  `Equipment: ${record?.name}`,
                  `Certificate #: ${record?.certificate}`,
                  `Calibrated By: ${record?.calibratedBy}`,
                  `Last Calibrated: ${record?.lastCalibrated}`,
                  `Next Due: ${record?.nextDue}`,
                  `Accuracy: ${record?.accuracy}`,
                  `Range: ${record?.range}`,
                ].join('\n');
                const blob = new Blob([certText], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${record?.certificate ?? 'certificate'}.txt`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <Download size={16} />
              Download Certificate
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
