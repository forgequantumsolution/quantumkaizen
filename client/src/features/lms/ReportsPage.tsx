import { useState } from 'react';
import { Button, Empty, Progress, Select, Spin, Table, Tag } from 'antd';
import { BarChart3, Download, FileText } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useComplianceReport, useTranscript, type ComplianceReport, type Transcript } from '@/lib/api/lms';
import { useAdminUsers } from '@/features/admin/users/hooks';

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

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${tone ?? 'text-gray-900'}`}>{value}</p>
    </div>
  );
}

export default function ReportsPage() {
  const { data: report, isLoading } = useComplianceReport();
  const { data: usersResp } = useAdminUsers({ isActive: true, pageSize: 200 });
  const [userId, setUserId] = useState<string>();
  const { data: transcript } = useTranscript(userId);

  const exportCompliance = (r: ComplianceReport) => {
    downloadCsv('lms-compliance-by-department.csv', [
      ['Department', 'Total', 'Completed', 'Overdue', 'Completion %'],
      ...r.by_department.map((d) => [d.name, d.total, d.completed, d.overdue, d.completion_rate]),
    ]);
  };

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
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <BarChart3 size={22} className="text-gray-500" /> Training Reports
        </h1>
        <p className="text-xs text-gray-500 mt-0.5">Compliance overview, expiring certificates, and per-employee transcripts.</p>
      </div>

      {isLoading || !report ? (
        <div className="flex justify-center py-20"><Spin /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            <Kpi label="Total" value={report.summary.total} />
            <Kpi label="Completed" value={report.summary.completed} tone="text-emerald-600" />
            <Kpi label="In progress" value={report.summary.in_progress} tone="text-amber-600" />
            <Kpi label="Overdue" value={report.summary.overdue} tone="text-red-600" />
            <Kpi label="Completion" value={`${report.summary.completion_rate}%`} />
            <Kpi label="Matrix coverage" value={`${report.summary.matrix_coverage}%`} />
          </div>

          {/* By department */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-700">Compliance by department</h3>
              <Button size="small" icon={<Download size={13} />} onClick={() => exportCompliance(report)}>Export CSV</Button>
            </div>
            {report.by_department.length === 0 ? <Empty description="No data" /> : (
              <Table
                rowKey="name" size="small" pagination={false} dataSource={report.by_department}
                columns={[
                  { title: 'Department', dataIndex: 'name' },
                  { title: 'Total', dataIndex: 'total', width: 80 },
                  { title: 'Completed', dataIndex: 'completed', width: 100 },
                  { title: 'Overdue', dataIndex: 'overdue', width: 90, render: (v: number) => v > 0 ? <span className="text-red-600">{v}</span> : v },
                  { title: 'Completion', dataIndex: 'completion_rate', width: 160, render: (v: number) => <Progress percent={v} size="small" /> },
                ]}
              />
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
