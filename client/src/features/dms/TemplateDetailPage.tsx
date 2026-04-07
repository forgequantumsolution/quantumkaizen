import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ChevronRight,
  Download,
  Copy,
  FileText,
  Calendar,
  Tag,
  Building2,
  Layers,
  Clock,
  User,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, Button, Badge, StatusBadge } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import { useTemplate } from './hooks';

const levelVariantMap: Record<string, 'info' | 'success' | 'warning' | 'purple' | 'danger' | 'default'> = {
  POLICY: 'danger',
  PROCEDURE: 'info',
  WORK_INSTRUCTION: 'success',
  FORM: 'warning',
  CHECKLIST: 'purple',
  REPORT: 'default',
};

export default function TemplateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: template, isLoading } = useTemplate(id!);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="py-32 text-center">
        <p className="text-slate-500">Template not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/dms/templates')}>
          Back to Templates
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <button onClick={() => navigate('/dms/templates')} className="hover:text-navy-700 transition-colors">
          Document Templates
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">{template.templateId}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">{template.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={levelVariantMap[template.documentLevel] || 'default'}>
              {template.documentLevel.replace(/_/g, ' ')}
            </Badge>
            <Badge variant="outline">{template.category}</Badge>
            <Badge variant="outline">{template.industry}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline">
            <Download className="h-4 w-4" />
            Download Template
          </Button>
          <Button onClick={() => navigate('/dms/documents/new')}>
            <Copy className="h-4 w-4" />
            Use This Template
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Preview */}
        <div className="space-y-6 lg:col-span-2">
          {/* Template Preview */}
          <Card>
            <CardHeader>
              <CardTitle>Template Preview</CardTitle>
            </CardHeader>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm leading-relaxed text-slate-600 mb-4">{template.description}</p>

              {/* Simulated template structure */}
              <div className="space-y-4 rounded-lg bg-white border border-slate-200 p-5">
                <div className="border-b border-slate-200 pb-3">
                  <div className="h-3 w-48 rounded bg-slate-200 mb-2" />
                  <div className="h-2 w-32 rounded bg-slate-100" />
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Template Sections</p>
                  {template.sections.map((section, idx) => (
                    <div key={idx} className="flex items-center gap-3 rounded border border-slate-100 px-3 py-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-navy-50 text-xs font-bold text-navy-700">
                        {idx + 1}
                      </span>
                      <span className="text-sm text-slate-700">{section}</span>
                    </div>
                  ))}
                </div>

                {template.fields.length > 0 && (
                  <div className="space-y-3 pt-3 border-t border-slate-200">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Form Fields</p>
                    <div className="grid grid-cols-2 gap-2">
                      {template.fields.map((field, idx) => (
                        <div key={idx} className="rounded border border-dashed border-slate-300 px-3 py-2">
                          <span className="text-xs text-slate-400">{field}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Usage Guidelines */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Guidelines</CardTitle>
            </CardHeader>
            <ul className="space-y-2">
              {template.guidelines.map((guideline, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-navy-400" />
                  {guideline}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Metadata */}
          <Card>
            <CardHeader>
              <CardTitle>Template Details</CardTitle>
            </CardHeader>
            <dl className="space-y-3 text-sm">
              {[
                { icon: Tag, label: 'Template ID', value: template.templateId },
                { icon: Layers, label: 'Category', value: template.category },
                { icon: Building2, label: 'Industry', value: template.industry },
                { icon: FileText, label: 'Document Level', value: template.documentLevel.replace(/_/g, ' ') },
                { icon: User, label: 'Author', value: template.author },
                { icon: Calendar, label: 'Created', value: formatDate(template.createdAt) },
                { icon: Clock, label: 'Last Updated', value: formatDate(template.updatedAt) },
                { icon: Download, label: 'Downloads', value: String(template.downloads) },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center justify-between">
                  <dt className="flex items-center gap-1.5 text-slate-500">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </dt>
                  <dd className="font-medium text-slate-900 text-right">{value}</dd>
                </div>
              ))}
            </dl>

            {template.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {template.tags.map((tag) => (
                  <Badge key={tag} variant="outline">{tag}</Badge>
                ))}
              </div>
            )}
          </Card>

          {/* Version History */}
          <Card>
            <CardHeader>
              <CardTitle>Version History</CardTitle>
            </CardHeader>
            <div className="space-y-3">
              {template.versions.map((v) => (
                <div key={v.version} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-navy-700">v{v.version}</span>
                    <span className="text-xs text-slate-400">{formatDate(v.date)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{v.changes}</p>
                  <p className="mt-0.5 text-xs text-slate-400">by {v.author}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Statistics</CardTitle>
            </CardHeader>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Total Downloads</span>
                <span className="font-medium text-slate-900">{template.downloads}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Documents Created</span>
                <span className="font-medium text-slate-900">{template.documentsCreated}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Active Users</span>
                <span className="font-medium text-slate-900">{template.activeUsers}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
