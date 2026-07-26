import { useMemo, useState } from 'react';
import { Button, DatePicker, Empty, Progress, Segmented, Select, Spin, Table, Tag } from 'antd';
import { BarChart3, Download, FileText, RotateCcw } from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import dayjs, { type Dayjs } from 'dayjs';
import PageContainer from '@/components/layout/PageContainer';
import {
  useComplianceReport,
  useTranscript,
  downloadEnrollmentsCsv,
  type ReportFilter,
  type ReportBreakdownRow,
  type Transcript,
} from '@/lib/api/lms';
import { useCourses } from '@/lib/api/lms';
import { useUserDirectory } from '@/features/admin/users/hooks';
import { useRoleDirectory } from '@/features/admin/roles/hooks';
import { useDepartments } from '@/features/admin/departments/hooks';
import { useSites } from '@/lib/api/sites';
import { KpiCard } from '@/components/ui';

function downloadCsv(filename: string, rows: (string | number | null)[][]) {
  const esc = (v: string | number | null) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Dimension = 'Department' | 'Role' | 'Site';

export default function ReportsPage() {
  // ── Filters ──
  const [deptId, setDeptId] = useState<string>();
  const [roleId, setRoleId] = useState<string>();
  const [siteId, setSiteId] = useState<string>();
  const [courseId, setCourseId] = useState<string>();
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [dim, setDim] = useState<Dimension>('Department');

  const filter = useMemo<ReportFilter>(
    () => ({
      department_id: deptId,
      role_id: roleId,
      site_id: siteId,
      course_id: courseId,
      from: range?.[0] ? range[0].startOf('day').toISOString() : undefined,
      to: range?.[1] ? range[1].endOf('day').toISOString() : undefined,
    }),
    [deptId, roleId, siteId, courseId, range],
  );

  const { data: report, isLoading, isFetching } = useComplianceReport(filter);

  // Option lists for the filter bar + transcript picker.
  const { data: usersResp } = useUserDirectory();
  const { data: rolesResp } = useRoleDirectory();
  const { data: deptResp } = useDepartments({ isActive: true, pageSize: 200 });
  const { data: sitesResp } = useSites({ pageSize: 200 });
  const { data: courses } = useCourses({ status: 'PUBLISHED', latest_only: true });

  const [userId, setUserId] = useState<string>();
  const { data: transcript } = useTranscript(userId);

  const hasFilters = !!(deptId || roleId || siteId || courseId || range?.[0]);
  const resetFilters = () => {
    setDeptId(undefined); setRoleId(undefined); setSiteId(undefined);
    setCourseId(undefined); setRange(null);
  };

  const breakdown: ReportBreakdownRow[] =
    dim === 'Department' ? report?.by_department ?? []
    : dim === 'Role' ? report?.by_role ?? []
    : report?.by_site ?? [];

  const exportTranscript = (t: Transcript) => {
    downloadCsv(`transcript-${t.user_name ?? t.user_id}.csv`, [
      ['Code', 'Course', 'Status', 'Score', 'Assigned', 'Completed', 'Certificate', 'Cert expires'],
      ...t.items.map((i) => [
        i.course_code, i.course_title, i.status, i.score ?? '',
        new Date(i.assigned_at).toLocaleDateString(),
        i.completed_at ? new Date(i.completed_at).toLocaleDateString() : '',
        i.certificate_serial ?? '',
        i.certificate_expires_at ? new Date(i.certificate_expires_at).toLocaleDateString() : '',
      ]),
    ]);
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2 shrink-0">
          <BarChart3 size={22} className="text-gray-500" /> Training Reports
        </h1>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Select allowClear showSearch optionFilterProp="label" style={{ width: 160 }} value={deptId} onChange={setDeptId}
            placeholder="All departments"
            options={(deptResp?.items ?? []).map((d) => ({ value: d.id, label: d.name }))} />
          <Select allowClear showSearch optionFilterProp="label" style={{ width: 140 }} value={roleId} onChange={setRoleId}
            placeholder="All roles"
            options={(rolesResp?.items ?? []).map((r) => ({ value: r.id, label: r.name }))} />
          <Select allowClear showSearch optionFilterProp="label" style={{ width: 140 }} value={siteId} onChange={setSiteId}
            placeholder="All sites"
            options={(sitesResp?.items ?? []).map((s) => ({ value: s.id, label: s.name }))} />
          <Select allowClear showSearch optionFilterProp="label" style={{ width: 190 }} value={courseId} onChange={setCourseId}
            placeholder="All courses"
            options={(courses?.data ?? []).map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` }))} />
          <DatePicker.RangePicker value={range as [Dayjs, Dayjs] | null} onChange={(v) => setRange(v as [Dayjs | null, Dayjs | null] | null)} placeholder={['Assigned from', 'to']} />
          {hasFilters && (
            <Button icon={<RotateCcw size={13} />} onClick={resetFilters}>Reset</Button>
          )}
          {isFetching && !isLoading && <Spin size="small" />}
          <Button type="primary" icon={<Download size={14} />} onClick={() => downloadEnrollmentsCsv(filter)}>
            Export records (CSV)
          </Button>
        </div>
      </div>

      {isLoading || !report ? (
        <div className="flex justify-center py-20"><Spin /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            <KpiCard label="Total" value={report.summary.total} accent="slate" />
            <KpiCard label="Completed" value={report.summary.completed} accent="emerald" />
            <KpiCard label="In progress" value={report.summary.in_progress} accent="amber" />
            <KpiCard label="Overdue" value={report.summary.overdue} accent="red" />
            <KpiCard label="Completion" value={`${report.summary.completion_rate}%`} accent="slate" />
            <KpiCard label="Matrix coverage" value={`${report.summary.matrix_coverage}%`} accent="slate" />
          </div>

          {/* Charts — enrollment status + assessment outcomes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <ChartPanel title="Enrollment status" subtitle="Across the filtered population">
              <ReportDonut
                data={[
                  { name: 'Completed', value: report.summary.completed, color: '#22c55e' },
                  { name: 'In progress', value: report.summary.in_progress, color: '#f59e0b' },
                  { name: 'Overdue', value: report.summary.overdue, color: '#ef4444' },
                ].filter((d) => d.value > 0)}
              />
            </ChartPanel>
            <ChartPanel title="Assessment outcomes" subtitle="Exam attempts — passed vs failed">
              <ReportDonut
                data={[
                  { name: 'Passed', value: report.assessment.passed, color: '#22c55e' },
                  { name: 'Failed', value: report.assessment.failed, color: '#ef4444' },
                ].filter((d) => d.value > 0)}
              />
            </ChartPanel>
          </div>

          {/* Assessment (exam) analytics */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Assessment results</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard label="Attempts" value={report.assessment.attempts} accent="slate" />
              <KpiCard label="Passed" value={report.assessment.passed} accent="emerald" />
              <KpiCard label="Failed" value={report.assessment.failed} accent="red" />
              <KpiCard label="Pass rate" value={`${report.assessment.pass_rate}%`} accent="slate" />
              <KpiCard label="Avg score" value={`${report.assessment.avg_score}%`} accent="slate" />
              <KpiCard label="Learners" value={report.assessment.learners} accent="slate" />
            </div>
          </div>

          {/* Completion breakdown by dimension */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-gray-700">Completion by {dim.toLowerCase()}</h3>
              <Segmented options={['Department', 'Role', 'Site']} value={dim} onChange={(v) => setDim(v as Dimension)} />
            </div>
            {breakdown.length === 0 ? <Empty description="No data" /> : (
              <>
                <ResponsiveContainer width="100%" height={Math.max(160, breakdown.length * 40)}>
                  <BarChart data={breakdown} layout="vertical" margin={{ top: 5, right: 40, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#64748B' }} width={140} />
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 11 }} formatter={(v: number) => [`${v}%`, 'Completion']} />
                    <Bar dataKey="completion_rate" name="Completion" radius={[0, 6, 6, 0]}>
                      {breakdown.map((r) => (
                        <Cell key={r.key} fill={r.completion_rate >= 80 ? '#22c55e' : r.completion_rate >= 50 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <Table
                  className="mt-4"
                  rowKey="key" size="small" pagination={false} dataSource={breakdown}
                columns={[
                  { title: dim, dataIndex: 'name' },
                  { title: 'Total', dataIndex: 'total', width: 80 },
                  { title: 'Completed', dataIndex: 'completed', width: 100 },
                  { title: 'Overdue', dataIndex: 'overdue', width: 90, render: (v: number) => v > 0 ? <span className="text-red-600">{v}</span> : v },
                  { title: 'Completion', dataIndex: 'completion_rate', width: 200, render: (v: number) => (
                    <div className="flex items-center gap-2 flex-nowrap">
                      <Progress percent={v} size="small" showInfo={false} style={{ width: 120, margin: 0 }} />
                      <span className="text-xs text-gray-600 w-9 shrink-0 text-right">{v}%</span>
                    </div>
                  ) },
                ]}
                />
              </>
            )}
          </div>

          {/* Expiring certs */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Certificates expiring (next 60 days)</h3>
            {report.expiring_certificates.length === 0 ? <Empty description="None expiring soon" /> : (
              <Table
                rowKey="id" size="small" pagination={false} dataSource={report.expiring_certificates}
                columns={[
                  { title: 'Serial', dataIndex: 'serial', render: (s: string) => <span className="font-mono text-xs">{s}</span> },
                  { title: 'Course', dataIndex: 'course_title' },
                  { title: 'Holder', dataIndex: 'holder_name', render: (n: string | null) => n ?? '—' },
                  { title: 'Expires', dataIndex: 'expires_at', width: 130, render: (d: string | null) => d ? <Tag color="gold">{new Date(d).toLocaleDateString()}</Tag> : '—' },
                ]}
              />
            )}
          </div>

          {/* Transcript */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><FileText size={15} /> Employee transcript</h3>
              <div className="flex items-center gap-2">
                <Select
                  showSearch optionFilterProp="label" style={{ width: 260 }} value={userId} onChange={setUserId}
                  placeholder="Select an employee"
                  options={(usersResp?.items ?? []).map((u) => ({ value: u.id, label: u.name }))}
                />
                {transcript && <Button size="small" icon={<Download size={13} />} onClick={() => exportTranscript(transcript)}>Export CSV</Button>}
              </div>
            </div>
            {!userId ? (
              <Empty description="Select an employee to view their transcript" />
            ) : transcript ? (
              <Table
                rowKey="enrollment_id" size="small" pagination={{ pageSize: 15 }} dataSource={transcript.items}
                columns={[
                  { title: 'Code', dataIndex: 'course_code', width: 130, render: (c: string) => <span className="font-mono text-xs">{c}</span> },
                  { title: 'Course', dataIndex: 'course_title' },
                  { title: 'Status', dataIndex: 'status', width: 120, render: (s: string) => <Tag>{s.replace('_', ' ')}</Tag> },
                  { title: 'Score', dataIndex: 'score', width: 80, render: (s: number | null) => s != null ? `${s}%` : '—' },
                  { title: 'Completed', dataIndex: 'completed_at', width: 120, render: (d: string | null) => d ? new Date(d).toLocaleDateString() : '—' },
                  { title: 'Certificate', dataIndex: 'certificate_serial', width: 150, render: (s: string | null) => s ? <span className="font-mono text-xs">{s}</span> : '—' },
                ]}
              />
            ) : <div className="flex justify-center py-8"><Spin /></div>}
          </div>
        </>
      )}
    </PageContainer>
  );
}

function ChartPanel({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function ReportDonut({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  if (data.length === 0) return <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">No data yet</div>;
  const total = data.reduce((s, x) => s + x.value, 0);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={54} outerRadius={86} paddingAngle={2}>
            {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 11 }} />
          <Legend verticalAlign="bottom" iconType="circle" iconSize={8} />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 top-[86px] flex flex-col items-center">
        <div className="text-2xl font-bold text-gray-900 leading-none">{total}</div>
        <div className="text-[10px] uppercase tracking-wide text-gray-400 mt-0.5">Total</div>
      </div>
    </div>
  );
}
