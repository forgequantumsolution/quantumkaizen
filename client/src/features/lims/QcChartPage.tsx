import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { App, Button, DatePicker, Input, InputNumber, Modal, Space, Table } from 'antd';
import { Activity, ArrowLeft, Plus } from 'lucide-react';
import dayjs, { type Dayjs } from 'dayjs';
import {
  CartesianGrid, Dot, Line, LineChart, ReferenceLine, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useQcChart, useRecordQcResult, QC_STATUS_BADGE,
  type QcPoint, type QcControlLines, type RecordQcResultBody,
} from '@/lib/api/qc';

interface ChartRow {
  idx: number;
  label: string;
  value: number;
  status: QcPoint['status'];
}

export default function QcChartPage() {
  const { id } = useParams<{ id: string }>();
  const canRecord = useHasPermission('qc.result');
  const { data, isLoading } = useQcChart(id);
  const [open, setOpen] = useState(false);

  const material = data?.material;
  const lines = data?.control_lines;
  const points = data?.points ?? [];
  const summary = data?.summary ?? { total: 0, reject: 0, warn: 0 };

  const chartRows: ChartRow[] = points.map((p, i) => ({
    idx: i + 1,
    label: dayjs(p.measured_at).format('MM/DD HH:mm'),
    value: p.value,
    status: p.status,
  }));

  return (
    <PageContainer>
      <Link to="/lims/qc" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 mb-3">
        <ArrowLeft size={13} />Back to Quality Control
      </Link>

      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity size={22} className="text-gray-500" />
            {material ? material.name : 'Levey-Jennings Chart'}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {material ? (
              <>
                <span className="font-mono text-blue-600">{material.code}</span>
                {material.analyte_name ? ` · ${material.analyte_name}` : ''}
                {material.unit ? ` · ${material.unit}` : ''}
                {material.target_mean != null ? ` · mean ${material.target_mean}${material.target_sd != null ? ` ± ${material.target_sd}` : ''}` : ''}
              </>
            ) : 'Quality control trend with Westgard rule evaluation.'}
          </p>
        </div>
        {canRecord && <Button type="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>Record Result</Button>}
      </div>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Chip label="Total" value={summary.total} cls="bg-gray-50 text-gray-700 border-gray-200" />
        <Chip label="Warn" value={summary.warn} cls={QC_STATUS_BADGE.WARN.cls} />
        <Chip label="Reject" value={summary.reject} cls={QC_STATUS_BADGE.REJECT.cls} />
      </div>

      <div className="border border-gray-200 rounded-lg p-4 bg-white mb-5" style={{ height: 420 }}>
        {lines ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartRows} margin={{ top: 10, right: 56, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="idx" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip
                formatter={(v: number) => [v, 'Value']}
                labelFormatter={(l) => `#${l}`}
              />
              {referenceLines(lines)}
              <Line
                type="linear"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={1.5}
                isAnimationActive={false}
                dot={<QcDot />}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-gray-400">
            {isLoading ? 'Loading chart…' : 'No control limits configured for this material.'}
          </div>
        )}
      </div>

      <Table<QcPoint>
        size="small" rowKey="id" loading={isLoading} dataSource={points} pagination={{ pageSize: 20, showSizeChanger: false }}
        columns={[
          { title: 'Measured', dataIndex: 'measured_at', width: 150, render: (v: string) => new Date(v).toLocaleString() },
          { title: 'Value', dataIndex: 'value', width: 100, render: (v: number) => v },
          { title: 'Z-score', dataIndex: 'z_score', width: 90, render: (v: number | null) => (v != null ? v.toFixed(2) : '—') },
          {
            title: 'Status', width: 100,
            render: (_: unknown, r) => (
              <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${QC_STATUS_BADGE[r.status].cls}`}>{QC_STATUS_BADGE[r.status].label}</span>
            ),
          },
          {
            title: 'Violated Rules',
            render: (_: unknown, r) => (
              r.violated_rules.length ? (
                <span className="flex flex-wrap gap-1">
                  {r.violated_rules.map((rule) => (
                    <span key={rule} className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded border bg-red-50 text-red-700 border-red-200">{rule}</span>
                  ))}
                </span>
              ) : <span className="text-gray-400">—</span>
            ),
          },
          { title: 'Analyst', dataIndex: 'analyst_name', width: 140, render: (v: string | null) => v ?? '—' },
        ]}
      />

      {id && <RecordModal open={open} onClose={() => setOpen(false)} materialId={id} />}
    </PageContainer>
  );
}

function referenceLines(lines: QcControlLines) {
  const defs: Array<{ y: number; label: string; color: string; dash?: string }> = [
    { y: lines.plus3, label: '+3s', color: '#ef4444', dash: '5 4' },
    { y: lines.plus2, label: '+2s', color: '#9ca3af', dash: '4 4' },
    { y: lines.plus1, label: '+1s', color: '#d1d5db', dash: '4 4' },
    { y: lines.mean, label: 'mean', color: '#6b7280' },
    { y: lines.minus1, label: '-1s', color: '#d1d5db', dash: '4 4' },
    { y: lines.minus2, label: '-2s', color: '#9ca3af', dash: '4 4' },
    { y: lines.minus3, label: '-3s', color: '#ef4444', dash: '5 4' },
  ];
  return defs.map((d) => (
    <ReferenceLine
      key={d.label}
      y={d.y}
      stroke={d.color}
      strokeDasharray={d.dash}
      label={{ value: d.label, position: 'right', fontSize: 10, fill: d.color }}
    />
  ));
}

function QcDot(props: { cx?: number; cy?: number; payload?: ChartRow }) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload) return null;
  return <Dot cx={cx} cy={cy} r={4} fill={QC_STATUS_BADGE[payload.status].color} stroke="#fff" strokeWidth={1} />;
}

function Chip({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded border ${cls}`}>
      {label}<span className="font-semibold">{value}</span>
    </span>
  );
}

function RecordModal({ open, onClose, materialId }: { open: boolean; onClose: () => void; materialId: string }) {
  const { message } = App.useApp();
  const recordMut = useRecordQcResult(materialId);
  const [value, setValue] = useState<number | null>(null);
  const [analyst, setAnalyst] = useState('');
  const [remarks, setRemarks] = useState('');
  const [measuredAt, setMeasuredAt] = useState<Dayjs | null>(null);

  const reset = () => { setValue(null); setAnalyst(''); setRemarks(''); setMeasuredAt(null); };

  const submit = async () => {
    if (value == null) return message.error('Value is required');
    const body: RecordQcResultBody = {
      value,
      analyst_name: analyst || null,
      remarks: remarks || null,
      measured_at: measuredAt ? measuredAt.toISOString() : null,
    };
    try {
      const point = await recordMut.mutateAsync(body);
      if (point.status === 'REJECT') {
        message.error(`Rejected${point.violated_rules.length ? `: ${point.violated_rules.join(', ')}` : ''}`);
      } else if (point.status === 'WARN') {
        message.warning(`Warning${point.violated_rules.length ? `: ${point.violated_rules.join(', ')}` : ''}`);
      } else {
        message.success('Result recorded');
      }
      reset();
      onClose();
    } catch (e) {
      message.error((e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed to record');
    }
  };

  return (
    <Modal title="Record QC Result" open={open} onCancel={() => { reset(); onClose(); }} centered destroyOnClose
      onOk={submit} okText="Record" confirmLoading={recordMut.isPending}>
      <div className="space-y-3 pt-2">
        <F label="Value *"><InputNumber value={value ?? undefined} onChange={(v) => setValue(v ?? null)} className="w-full" autoFocus /></F>
        <F label="Analyst"><Input value={analyst} onChange={(e) => setAnalyst(e.target.value)} /></F>
        <F label="Measured At"><DatePicker showTime value={measuredAt ?? undefined} onChange={(d) => setMeasuredAt(d ?? null)} className="w-full" placeholder="Defaults to now" /></F>
        <F label="Remarks"><Input.TextArea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></F>
      </div>
    </Modal>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
