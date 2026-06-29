import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { App, Button, DatePicker, Input, Modal, Select, Spin, Table } from 'antd';
import { ArrowLeft, Gauge, CalendarCheck } from 'lucide-react';
import type { Dayjs } from 'dayjs';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useEquipmentItem,
  useRecordCalibration,
  EQUIPMENT_STATUS_LABELS,
  type CalibrationRecord,
  type CalibrationResult,
} from '@/lib/api/lims';

const RESULT_OPTIONS = [
  { value: 'PASS', label: 'Pass' },
  { value: 'FAIL', label: 'Fail' },
  { value: 'CONDITIONAL', label: 'Conditional' },
];

export default function EquipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { message } = App.useApp();
  const canUpdate = useHasPermission('equipment.update');
  const { data: e, isLoading } = useEquipmentItem(id);
  const recordMut = useRecordCalibration(id ?? '');

  const [open, setOpen] = useState(false);
  const [calAt, setCalAt] = useState<Dayjs | null>(null);
  const [result, setResult] = useState<CalibrationResult>('PASS');
  const [certNo, setCertNo] = useState('');
  const [nextDue, setNextDue] = useState<Dayjs | null>(null);
  const [performedBy, setPerformedBy] = useState('');
  const [remarks, setRemarks] = useState('');

  if (isLoading || !e) {
    return <PageContainer><div className="flex items-center justify-center py-32"><Spin /></div></PageContainer>;
  }

  const submit = async () => {
    if (!calAt) return message.error('Pick the calibration date');
    try {
      await recordMut.mutateAsync({
        calibrated_at: calAt.toISOString(),
        result,
        certificate_no: certNo || null,
        next_due_at: nextDue ? nextDue.toISOString() : null,
        performed_by: performedBy || null,
        remarks: remarks || null,
      });
      setOpen(false); setCalAt(null); setResult('PASS'); setCertNo(''); setNextDue(null); setPerformedBy(''); setRemarks('');
      message.success('Calibration recorded');
    } catch (err) {
      message.error((err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Failed');
    }
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/lims/equipment" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"><ArrowLeft size={14} /> Back</Link>
          <span className="text-gray-300">·</span>
          <span className="font-mono text-sm text-gray-700">{e.code}</span>
          <span className="text-[11px] text-gray-600 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">{EQUIPMENT_STATUS_LABELS[e.status]}</span>
          {e.calibration_overdue && <span className="text-[11px] font-medium text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">Calibration overdue</span>}
        </div>
        {canUpdate && <Button type="primary" icon={<CalendarCheck size={14} />} onClick={() => setOpen(true)}>Record Calibration</Button>}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2"><Gauge size={18} className="text-gray-400" />{e.name}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Field label="Category" value={e.category ?? '—'} />
          <Field label="Lab" value={e.lab_name ?? '—'} />
          <Field label="Serial No." value={e.serial_no ?? '—'} />
          <Field label="Location" value={e.location ?? '—'} />
          <Field label="Manufacturer" value={e.manufacturer ?? '—'} />
          <Field label="Model" value={e.model ?? '—'} />
          <Field label="Cal. Frequency" value={e.calibration_frequency_days ? `${e.calibration_frequency_days} days` : '—'} />
          <Field label="Last Calibrated" value={e.last_calibrated_at ? new Date(e.last_calibrated_at).toLocaleDateString() : '—'} />
          <div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wide">Calibration Due</div>
            <div className="text-sm text-gray-900 mt-0.5 flex items-center gap-1.5">
              {e.calibration_due_at ? new Date(e.calibration_due_at).toLocaleDateString() : '—'}
              {e.calibration_overdue && <span className="text-[10px] font-medium text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">Overdue</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Calibration History ({e.calibrations.length})</h3>
        <Table<CalibrationRecord>
          size="small"
          rowKey="id"
          dataSource={e.calibrations}
          pagination={false}
          columns={[
            { title: 'Date', width: 120, render: (_: unknown, r) => new Date(r.calibrated_at).toLocaleDateString() },
            {
              title: 'Result', width: 110,
              render: (_: unknown, r) => (
                <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${r.result === 'PASS' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : r.result === 'FAIL' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>{r.result}</span>
              ),
            },
            { title: 'Certificate', dataIndex: 'certificate_no', render: (v: string | null) => v ?? '—' },
            { title: 'Next Due', width: 120, render: (_: unknown, r) => (r.next_due_at ? new Date(r.next_due_at).toLocaleDateString() : '—') },
            { title: 'By', dataIndex: 'performed_by', width: 140, render: (v: string | null) => v ?? '—' },
            { title: 'Remarks', dataIndex: 'remarks', ellipsis: true, render: (v: string | null) => v ?? '—' },
          ]}
        />
      </div>

      <Modal title="Record Calibration" open={open} onCancel={() => setOpen(false)} onOk={submit} okText="Record" okButtonProps={{ loading: recordMut.isPending }} centered>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <F label="Calibration date *"><DatePicker value={calAt ?? undefined} onChange={(d) => setCalAt(d ?? null)} className="w-full" /></F>
            <F label="Result"><Select value={result} onChange={setResult} options={RESULT_OPTIONS} className="w-full" /></F>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <F label="Certificate No."><Input value={certNo} onChange={(ev) => setCertNo(ev.target.value)} /></F>
            <F label="Next due (optional)"><DatePicker value={nextDue ?? undefined} onChange={(d) => setNextDue(d ?? null)} className="w-full" /></F>
          </div>
          <F label="Performed by"><Input value={performedBy} onChange={(ev) => setPerformedBy(ev.target.value)} placeholder="Technician / agency" /></F>
          <F label="Remarks"><Input.TextArea rows={2} value={remarks} onChange={(ev) => setRemarks(ev.target.value)} /></F>
          {!nextDue && !e.calibration_frequency_days && (
            <p className="text-[11px] text-amber-600">No next-due date and no calibration frequency set — the next due date won't be computed.</p>
          )}
        </div>
      </Modal>
    </PageContainer>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-sm text-gray-900 mt-0.5">{value}</div>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
