import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  FileText,
  ClipboardList,
  ClipboardCheck,
  FileBarChart,
  Shield,
  BookOpen,
  Download,
  ArrowRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, Button, DataTable, Badge } from '@/components/ui';
import type { Column } from '@/components/ui';
import { cn, formatDate } from '@/lib/utils';
import { useTemplates } from './hooks';
import type { DocumentTemplate } from './hooks';

const CATEGORY_CARDS = [
  {
    id: 'sops',
    name: 'SOPs',
    description: 'Standard Operating Procedure templates for manufacturing and quality processes',
    icon: FileText,
    iconColor: 'bg-sky-50 text-sky-600',
  },
  {
    id: 'work-instructions',
    name: 'Work Instructions',
    description: 'Step-by-step task instruction templates for shop floor operations',
    icon: BookOpen,
    iconColor: 'bg-emerald-50 text-emerald-600',
  },
  {
    id: 'forms',
    name: 'Forms',
    description: 'Standardized data collection and recording form templates',
    icon: ClipboardList,
    iconColor: 'bg-violet-50 text-violet-600',
  },
  {
    id: 'checklists',
    name: 'Checklists',
    description: 'Verification and inspection checklist templates for audits and reviews',
    icon: ClipboardCheck,
    iconColor: 'bg-amber-50 text-amber-600',
  },
  {
    id: 'audit-reports',
    name: 'Audit Reports',
    description: 'Internal and external audit report templates with findings tracking',
    icon: FileBarChart,
    iconColor: 'bg-rose-50 text-rose-600',
  },
  {
    id: 'capa-forms',
    name: 'CAPA Forms',
    description: 'Corrective and Preventive Action documentation templates',
    icon: Shield,
    iconColor: 'bg-indigo-50 text-indigo-600',
  },
];

const levelVariantMap: Record<string, 'info' | 'success' | 'warning' | 'purple' | 'danger' | 'default' | 'outline'> = {
  POLICY: 'danger',
  PROCEDURE: 'info',
  WORK_INSTRUCTION: 'success',
  FORM: 'warning',
  CHECKLIST: 'purple',
  REPORT: 'default',
};

export default function TemplateListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const { data: templates, isLoading } = useTemplates({ search: search || undefined, category: categoryFilter || undefined });

  // Count templates per category
  const { data: allTemplates } = useTemplates({});
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (allTemplates || []).forEach((t) => {
      const cat = t.category.toLowerCase().replace(/\s+/g, '-');
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [allTemplates]);

  const columns: Column<DocumentTemplate>[] = [
    {
      key: 'templateId',
      header: 'Template ID',
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-navy-700">{row.templateId}</span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      render: (row) => <span className="max-w-xs truncate font-medium text-slate-900">{row.name}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      render: (row) => <Badge variant="outline">{row.category}</Badge>,
    },
    {
      key: 'industry',
      header: 'Industry',
      render: (row) => <span className="text-slate-600">{row.industry}</span>,
    },
    {
      key: 'documentLevel',
      header: 'Doc Level',
      render: (row) => (
        <Badge variant={levelVariantMap[row.documentLevel] || 'default'}>
          {row.documentLevel.replace(/_/g, ' ')}
        </Badge>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Last Updated',
      render: (row) => <span className="text-slate-500">{formatDate(row.updatedAt)}</span>,
    },
    {
      key: 'downloads',
      header: 'Downloads',
      render: (row) => (
        <div className="flex items-center gap-1 text-slate-600">
          <Download className="h-3 w-3" />
          <span className="text-xs font-medium">{row.downloads}</span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Document Templates</h1>
          <p className="mt-1 text-sm text-slate-500">
            Pre-built document templates for quality management, manufacturing, and compliance
          </p>
        </div>
        <Button onClick={() => navigate('/dms/templates/new')}>
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CATEGORY_CARDS.map((cat) => {
          const Icon = cat.icon;
          const count = categoryCounts[cat.id] || 0;
          const isActive = categoryFilter.toLowerCase().replace(/\s+/g, '-') === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                const catName = cat.name;
                setCategoryFilter(isActive ? '' : catName);
              }}
              className={cn(
                'text-left rounded-lg border p-4 transition-all hover:shadow-md',
                isActive
                  ? 'border-navy-500 bg-navy-50 shadow-sm ring-1 ring-navy-500/20'
                  : 'border-slate-200 bg-white hover:border-slate-300',
              )}
            >
              <div className="flex items-start justify-between">
                <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', cat.iconColor)}>
                  <Icon className="h-5 w-5" />
                </div>
                <span className="text-lg font-bold text-slate-900">{count}</span>
              </div>
              <p className="mt-3 text-sm font-semibold text-slate-900">{cat.name}</p>
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">{cat.description}</p>
            </button>
          );
        })}
      </div>

      {/* Search & Filters */}
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search templates..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
            />
          </div>
          {categoryFilter && (
            <div className="flex items-center gap-2">
              <Badge variant="info">
                Category: {categoryFilter}
              </Badge>
              <button
                onClick={() => setCategoryFilter('')}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card noPadding>
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={templates || []}
            onRowClick={(row) => navigate(`/dms/templates/${row.id}`)}
            emptyMessage="No templates match your search"
          />
        )}
      </Card>
    </div>
  );
}
