import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Download, Upload, X, FileText } from 'lucide-react';
import { exportToCSV } from '@/lib/export';
import { cn, formatDate } from '@/lib/utils';
import { Card, Button, DataTable, StatusBadge, Badge } from '@/components/ui';
import type { Column } from '@/components/ui';
import type { Document, DocumentStatus } from '@/types';
import { useDocuments } from './hooks';

const STATUS_TABS: { label: string; value: DocumentStatus | 'ALL' }[] = [
  { label: 'All', value: 'ALL' },
  { label: 'Published', value: 'PUBLISHED' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Under Review', value: 'UNDER_REVIEW' },
  { label: 'Pending Approval', value: 'PENDING_APPROVAL' },
  { label: 'Obsolete', value: 'OBSOLETE' },
];

const LEVELS = ['', 'POLICY', 'PROCEDURE', 'WORK_INSTRUCTION', 'FORM', 'EXTERNAL'];
const DEPARTMENTS = ['', 'Quality Assurance', 'Quality Control', 'Production', 'Engineering', 'HSE'];

export default function DocumentListPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [levelFilter, setLevelFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [search, setSearch] = useState('');

  // ── Bulk upload state ────────────────────────────────────────────────────
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);

  const filters = useMemo(
    () => ({
      status: activeTab === 'ALL' ? undefined : activeTab,
      level: levelFilter || undefined,
      department: deptFilter || undefined,
      search: search || undefined,
    }),
    [activeTab, levelFilter, deptFilter, search],
  );

  const { data: result, isLoading } = useDocuments(filters);
  const documents = result?.data ?? [];

  const columns: Column<Document>[] = [
    {
      key: 'documentNumber',
      header: 'Doc Number',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-navy-700">{row.documentNumber}</span>
      ),
    },
    {
      key: 'title',
      header: 'Title',
      render: (row) => <span className="max-w-xs truncate font-medium text-slate-900">{row.title}</span>,
    },
    {
      key: 'level',
      header: 'Level',
      render: (row) => <Badge variant="outline">{row.level.replace(/_/g, ' ')}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    { key: 'department', header: 'Department' },
    {
      key: 'version',
      header: 'Version',
      render: (row) => <span className="font-mono text-xs">v{row.version}</span>,
    },
    { key: 'owner', header: 'Owner' },
    {
      key: 'effectiveDate',
      header: 'Effective Date',
      render: (row) => <span className="text-slate-500">{formatDate(row.effectiveDate)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Documents</h1>
          <p className="mt-1 text-sm text-slate-500">
            Manage controlled documents across the organization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToCSV('documents', ['Doc #', 'Title', 'Type', 'Status', 'Department', 'Revision'], documents.map(d => [d.documentNumber, d.title, d.level, d.status, d.department || '', d.version || '']))}>
            <Download size={14} />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => setShowBulkUpload(true)}>
            <Upload size={15} />
            Bulk Upload
          </Button>
          <Button onClick={() => navigate('/dms/documents/new')}>
            <Plus className="h-4 w-4" />
            New Document
          </Button>
        </div>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
            />
          </div>
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="">All Levels</option>
            {LEVELS.filter(Boolean).map((l) => (
              <option key={l} value={l}>
                {l.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
          >
            <option value="">All Departments</option>
            {DEPARTMENTS.filter(Boolean).map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 border-b border-slate-200">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'border-b-2 border-navy-600 text-navy-700'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <Card noPadding>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={documents}
            onRowClick={(row) => navigate(`/dms/documents/${(row as unknown as Document).id}`)}
            emptyMessage="No documents match your filters"
          />
        )}
      </Card>

      {/* ── Bulk Upload Modal ─────────────────────────────────────────────── */}
      {showBulkUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Bulk Upload Documents</h2>
              <button
                onClick={() => { setShowBulkUpload(false); setUploadFiles([]); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const files = Array.from(e.dataTransfer.files);
                setUploadFiles((f) => [...f, ...files]);
              }}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer',
                dragOver ? 'border-slate-700 bg-slate-50' : 'border-gray-300 hover:border-gray-400'
              )}
              onClick={() => document.getElementById('bulk-file-input')?.click()}
            >
              <Upload size={24} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-medium text-gray-600">Drop files here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">PDF, DOCX, XLSX — up to 50MB each</p>
              <input
                id="bulk-file-input"
                type="file"
                multiple
                accept=".pdf,.docx,.xlsx,.doc"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    setUploadFiles((f) => [...f, ...Array.from(e.target.files!)]);
                  }
                }}
              />
            </div>
            {uploadFiles.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {uploadFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <FileText size={14} className="text-slate-700 shrink-0" />
                    <span className="flex-1 truncate text-gray-700">{file.name}</span>
                    <span className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                    <button
                      onClick={() => setUploadFiles((f) => f.filter((_, i) => i !== idx))}
                      className="text-gray-300 hover:text-red-400"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button variant="outline" onClick={() => { setShowBulkUpload(false); setUploadFiles([]); }}>
                Cancel
              </Button>
              <Button
                disabled={uploadFiles.length === 0}
                onClick={() => {
                  alert(`Uploading ${uploadFiles.length} files... (API integration pending)`);
                  setShowBulkUpload(false);
                  setUploadFiles([]);
                }}
              >
                <Upload size={14} />
                Upload {uploadFiles.length > 0 ? `${uploadFiles.length} Files` : ''}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
