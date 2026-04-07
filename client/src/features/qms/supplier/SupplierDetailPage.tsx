import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Edit,
  Building2,
  Mail,
  Phone,
  MapPin,
  Award,
  ClipboardCheck,
  FileText,
  History,
  Star,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Badge,
  StatusBadge,
} from '@/components/ui';
import Tabs from '@/components/ui/Tabs';
import { cn, formatDate } from '@/lib/utils';
import { useSupplier } from './hooks';
import type { SupplierCategory, SupplierStatus } from './hooks';

function getCategoryBadge(category: SupplierCategory) {
  const map: Record<SupplierCategory, { variant: 'danger' | 'warning' | 'default'; label: string }> = {
    CRITICAL: { variant: 'danger', label: 'Critical' },
    MAJOR: { variant: 'warning', label: 'Major' },
    MINOR: { variant: 'default', label: 'Minor' },
  };
  const c = map[category];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

function getSupplierStatusBadge(status: SupplierStatus) {
  const map: Record<SupplierStatus, { variant: 'success' | 'warning' | 'info' | 'danger'; label: string }> = {
    APPROVED: { variant: 'success', label: 'Approved' },
    CONDITIONAL: { variant: 'warning', label: 'Conditional' },
    PENDING: { variant: 'info', label: 'Pending' },
    DISQUALIFIED: { variant: 'danger', label: 'Disqualified' },
  };
  const c = map[status];
  return <Badge variant={c.variant}>{c.label}</Badge>;
}

const detailTabs = [
  { id: 'profile', label: 'Profile' },
  { id: 'performance', label: 'Performance' },
  { id: 'scorecard', label: 'Scorecard' },
  { id: 'documents', label: 'Documents' },
  { id: 'audits', label: 'Audits' },
  { id: 'history', label: 'History' },
];

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const { data: supplier, isLoading } = useSupplier(id || '');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-navy-600" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="text-center py-20">
        <p className="text-slate-500">Supplier not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/qms/suppliers')}>
          Back to List
        </Button>
      </div>
    );
  }

  const perf = supplier.performance;

  // Radar chart data points (simplified SVG)
  const radarMetrics = [
    { label: 'Quality', value: perf.quality },
    { label: 'Delivery', value: perf.delivery },
    { label: 'Cost', value: perf.cost },
    { label: 'Responsiveness', value: perf.responsiveness },
    { label: 'Innovation', value: perf.innovation },
  ];

  // Calculate SVG points for radar chart
  const centerX = 150;
  const centerY = 150;
  const maxRadius = 120;

  function getPoint(index: number, value: number, total: number) {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    const radius = (value / 100) * maxRadius;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  }

  const radarPoints = radarMetrics
    .map((m, i) => {
      const p = getPoint(i, m.value, radarMetrics.length);
      return `${p.x},${p.y}`;
    })
    .join(' ');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/qms/suppliers')}
            className="mt-1 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-sm font-semibold text-slate-500">{supplier.code}</span>
              {getSupplierStatusBadge(supplier.status)}
              {getCategoryBadge(supplier.category)}
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{supplier.name}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {supplier.city}, {supplier.state} | Contact: {supplier.contactPerson}
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => navigate('/qms/suppliers', { state: { editId: supplier?.id } })}>
          <Edit className="h-4 w-4" />
          Edit Supplier
        </Button>
      </div>

      {/* Tabs */}
      <Tabs tabs={detailTabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  Contact Information
                </span>
              </CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky-50">
                  <Mail className="h-4 w-4 text-sky-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Email</p>
                  <p className="text-sm font-medium text-slate-700">{supplier.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50">
                  <Phone className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Phone</p>
                  <p className="text-sm font-medium text-slate-700">{supplier.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
                  <MapPin className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Address</p>
                  <p className="text-sm font-medium text-slate-700">
                    {supplier.address}, {supplier.city}, {supplier.state}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Products & Services</CardTitle>
            </CardHeader>
            <div className="flex flex-wrap gap-2">
              {supplier.productsServices.map((p, i) => (
                <Badge key={i} variant="info">{p}</Badge>
              ))}
            </div>

            <div className="mt-6">
              <CardTitle>Certifications</CardTitle>
              <div className="mt-3 space-y-2">
                {supplier.certifications.map((cert) => (
                  <div
                    key={cert.id}
                    className="flex items-center justify-between rounded-lg border border-surface-border-light px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <Award className="h-4 w-4 text-sky-500" />
                      <span className="text-sm font-medium text-slate-700">{cert.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">Exp: {formatDate(cert.expiryDate)}</span>
                      <Badge
                        variant={
                          cert.status === 'VALID'
                            ? 'success'
                            : cert.status === 'EXPIRING_SOON'
                              ? 'warning'
                              : 'danger'
                        }
                      >
                        {cert.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Performance Tab */}
      {activeTab === 'performance' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Performance Scorecard</CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Overall:</span>
                <span
                  className={cn(
                    'text-lg font-bold',
                    perf.overallScore >= 80
                      ? 'text-emerald-600'
                      : perf.overallScore >= 60
                        ? 'text-amber-600'
                        : 'text-red-600',
                  )}
                >
                  {perf.overallScore}/100
                </span>
              </div>
            </CardHeader>

            {/* Radar Chart (SVG) */}
            {perf.overallScore > 0 ? (
              <div className="flex justify-center">
                <svg width="300" height="300" viewBox="0 0 300 300">
                  {/* Grid rings */}
                  {[20, 40, 60, 80, 100].map((pct) => {
                    const points = radarMetrics
                      .map((_, i) => {
                        const p = getPoint(i, pct, radarMetrics.length);
                        return `${p.x},${p.y}`;
                      })
                      .join(' ');
                    return (
                      <polygon
                        key={pct}
                        points={points}
                        fill="none"
                        stroke="#e2e8f0"
                        strokeWidth="1"
                      />
                    );
                  })}

                  {/* Axis lines */}
                  {radarMetrics.map((_, i) => {
                    const p = getPoint(i, 100, radarMetrics.length);
                    return (
                      <line
                        key={i}
                        x1={centerX}
                        y1={centerY}
                        x2={p.x}
                        y2={p.y}
                        stroke="#e2e8f0"
                        strokeWidth="1"
                      />
                    );
                  })}

                  {/* Data polygon */}
                  <polygon
                    points={radarPoints}
                    fill="rgba(59, 130, 246, 0.15)"
                    stroke="rgb(59, 130, 246)"
                    strokeWidth="2"
                  />

                  {/* Data points */}
                  {radarMetrics.map((m, i) => {
                    const p = getPoint(i, m.value, radarMetrics.length);
                    return (
                      <circle
                        key={i}
                        cx={p.x}
                        cy={p.y}
                        r="4"
                        fill="rgb(59, 130, 246)"
                        stroke="white"
                        strokeWidth="2"
                      />
                    );
                  })}

                  {/* Labels */}
                  {radarMetrics.map((m, i) => {
                    const p = getPoint(i, 115, radarMetrics.length);
                    return (
                      <text
                        key={i}
                        x={p.x}
                        y={p.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="text-[11px] fill-slate-600 font-medium"
                      >
                        {m.label} ({m.value})
                      </text>
                    );
                  })}
                </svg>
              </div>
            ) : (
              <p className="text-center py-10 text-sm text-slate-400 italic">
                No performance data available yet
              </p>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Trend</CardTitle>
            </CardHeader>
            {perf.monthlyTrend.length > 0 ? (
              <div className="space-y-3">
                {perf.monthlyTrend.map((entry) => (
                  <div key={entry.month} className="flex items-center gap-3">
                    <span className="w-10 text-xs font-medium text-slate-500">{entry.month}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-500',
                          entry.score >= 80
                            ? 'bg-emerald-500'
                            : entry.score >= 60
                              ? 'bg-amber-500'
                              : 'bg-red-500',
                        )}
                        style={{ width: `${entry.score}%` }}
                      />
                    </div>
                    <span className="w-10 text-xs font-bold text-slate-700 text-right">
                      {entry.score}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center py-10 text-sm text-slate-400 italic">
                No trend data available
              </p>
            )}

            {/* Score breakdown */}
            {perf.overallScore > 0 && (
              <div className="mt-6 pt-4 border-t border-surface-border-light">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">Score Breakdown</p>
                <div className="grid grid-cols-2 gap-3">
                  {radarMetrics.map((m) => (
                    <div key={m.label} className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">{m.label}</span>
                      <span
                        className={cn(
                          'text-sm font-bold',
                          m.value >= 80
                            ? 'text-emerald-600'
                            : m.value >= 60
                              ? 'text-amber-600'
                              : 'text-red-600',
                        )}
                      >
                        {m.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Scorecard Tab */}
      {activeTab === 'scorecard' && (() => {
        const scorecardData = [
          { month: 'Oct', quality: 88, delivery: 92, cost: 85 },
          { month: 'Nov', quality: 91, delivery: 88, cost: 87 },
          { month: 'Dec', quality: 85, delivery: 95, cost: 88 },
          { month: 'Jan', quality: 93, delivery: 90, cost: 90 },
          { month: 'Feb', quality: 89, delivery: 93, cost: 86 },
          { month: 'Mar', quality: 94, delivery: 91, cost: 92 },
        ];
        return (
          <div className="space-y-5">
            {/* KPI summary pills */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Quality Score', value: '92%', trend: '+3%', color: 'text-green-600', bg: 'bg-green-50' },
                { label: 'Delivery Score', value: '91%', trend: '+1%', color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Cost Score', value: '89%', trend: '+6%', color: 'text-purple-600', bg: 'bg-purple-50' },
              ].map(({ label, value, trend, color, bg }) => (
                <div key={label} className={cn('rounded-xl p-4 border', bg, 'border-gray-200')}>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={cn('text-2xl font-bold mt-1', color)}>{value}</p>
                  <p className="text-xs text-green-600 mt-0.5">{trend} vs last quarter</p>
                </div>
              ))}
            </div>

            {/* Trend chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Performance Trend (6 Months)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={scorecardData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis domain={[70, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: any) => `${v}%`} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="quality" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} name="Quality" />
                  <Line type="monotone" dataKey="delivery" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Delivery" />
                  <Line type="monotone" dataKey="cost" stroke="#a855f7" strokeWidth={2} dot={{ r: 3 }} name="Cost" />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* AVL Status */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Approved Vendor List (AVL) Status</h3>
                <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">AVL Approved</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'AVL Category', value: 'Tier 1 — Critical' },
                  { label: 'Last Audit', value: 'Jan 2026' },
                  { label: 'Next Audit Due', value: 'Jan 2027' },
                  { label: 'Qualification Status', value: 'Full Approval' },
                  { label: 'Contingency Supplier', value: 'Acme Backup Ltd' },
                  { label: 'Single Source Risk', value: 'Low — 2 alternatives' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="font-medium text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit schedule */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Scheduled Audits</h3>
                <Button variant="outline" size="sm" onClick={() => navigate('/qms/audits/new', { state: { supplierName: supplier?.name } })}>
                  Schedule Audit
                </Button>
              </div>
              <div className="space-y-2">
                {[
                  { date: 'Apr 15, 2026', type: 'Annual Supplier Audit', auditor: 'David Kim', status: 'Planned' },
                  { date: 'Oct 10, 2025', type: 'Follow-up Audit', auditor: 'Sarah Johnson', status: 'Completed' },
                ].map((a, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <ClipboardCheck size={14} className="text-gray-400 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{a.type}</p>
                      <p className="text-xs text-gray-400">{a.date} · {a.auditor}</p>
                    </div>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium',
                      a.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700')}>
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                Certifications & Documents
              </span>
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">Certificate</th>
                  <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">Certificate No.</th>
                  <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">Issued By</th>
                  <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">Issued Date</th>
                  <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">Expiry Date</th>
                  <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {supplier.certifications.map((cert) => {
                  const isExpired = new Date(cert.expiryDate) < new Date();
                  const isExpiringSoon =
                    !isExpired &&
                    new Date(cert.expiryDate) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
                  return (
                    <tr key={cert.id} className="border-b border-surface-border-light last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Award className="h-4 w-4 text-sky-500" />
                          <span className="font-medium text-slate-700">{cert.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{cert.certificateNumber}</td>
                      <td className="px-4 py-3 text-slate-600">{cert.issuedBy}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(cert.issuedDate)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'text-sm',
                            isExpired && 'font-semibold text-red-600',
                            isExpiringSoon && 'font-semibold text-amber-600',
                          )}
                        >
                          {formatDate(cert.expiryDate)}
                        </span>
                        {isExpired && (
                          <span className="ml-2">
                            <Badge variant="danger">Expired</Badge>
                          </span>
                        )}
                        {isExpiringSoon && (
                          <span className="ml-2">
                            <Badge variant="warning">Expiring Soon</Badge>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            cert.status === 'VALID'
                              ? 'success'
                              : cert.status === 'EXPIRING_SOON'
                                ? 'warning'
                                : 'danger'
                          }
                        >
                          {cert.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {supplier.certifications.length === 0 && (
            <p className="text-center py-10 text-sm text-slate-400 italic">
              No certifications on file
            </p>
          )}
        </Card>
      )}

      {/* Audits Tab */}
      {activeTab === 'audits' && (
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-slate-400" />
                Audit History
              </span>
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">Type</th>
                  <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">Date</th>
                  <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">Auditor</th>
                  <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">Score</th>
                  <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">NCs</th>
                  <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">Status</th>
                  <th className="px-4 py-2.5 text-xxs font-semibold uppercase tracking-wider text-gray-500">Findings</th>
                </tr>
              </thead>
              <tbody>
                {supplier.audits.map((audit) => (
                  <tr key={audit.id} className="border-b border-surface-border-light last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-700">{audit.type}</td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(audit.date)}</td>
                    <td className="px-4 py-3 text-slate-600">{audit.auditor}</td>
                    <td className="px-4 py-3">
                      {audit.score > 0 ? (
                        <span
                          className={cn(
                            'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold',
                            audit.score >= 80
                              ? 'bg-emerald-100 text-emerald-700'
                              : audit.score >= 60
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700',
                          )}
                        >
                          {audit.score}%
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {audit.ncCount > 0 ? (
                        <Badge variant="danger">{audit.ncCount} NCs</Badge>
                      ) : audit.status === 'COMPLETED' ? (
                        <span className="text-xs text-emerald-600">None</span>
                      ) : (
                        <span className="text-xs text-slate-400">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          audit.status === 'COMPLETED'
                            ? 'success'
                            : audit.status === 'SCHEDULED'
                              ? 'info'
                              : 'danger'
                        }
                      >
                        {audit.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                      {audit.findings || <span className="text-slate-400 italic">--</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {supplier.audits.length === 0 && (
            <p className="text-center py-10 text-sm text-slate-400 italic">
              No audits recorded
            </p>
          )}
        </Card>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <Card>
          <CardHeader>
            <CardTitle>
              <span className="flex items-center gap-2">
                <History className="h-4 w-4 text-slate-400" />
                Supplier History
              </span>
            </CardTitle>
          </CardHeader>
          <div className="space-y-4">
            <div className="flex items-start gap-4 border-l-2 border-emerald-200 pl-4 pb-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-900">{formatDate(supplier.updatedAt)}</span>
                  <Badge variant="success">Updated</Badge>
                </div>
                <p className="text-sm text-slate-600">Supplier record updated. Performance review completed.</p>
              </div>
            </div>
            {supplier.audits
              .filter((a) => a.status === 'COMPLETED')
              .map((audit) => (
                <div key={audit.id} className="flex items-start gap-4 border-l-2 border-sky-200 pl-4 pb-4">
                  <ClipboardCheck className="h-5 w-5 text-sky-500 mt-0.5" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-slate-900">{formatDate(audit.date)}</span>
                      <Badge variant="info">{audit.type}</Badge>
                    </div>
                    <p className="text-sm text-slate-600">
                      Audit completed by {audit.auditor}. Score: {audit.score}%.
                      {audit.ncCount > 0 && ` ${audit.ncCount} non-conformance(s) raised.`}
                    </p>
                  </div>
                </div>
              ))}
            <div className="flex items-start gap-4 border-l-2 border-slate-200 pl-4 pb-4">
              <Building2 className="h-5 w-5 text-slate-400 mt-0.5" />
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-900">{formatDate(supplier.createdAt)}</span>
                  <Badge variant="default">Created</Badge>
                </div>
                <p className="text-sm text-slate-600">Supplier record created in the system.</p>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
