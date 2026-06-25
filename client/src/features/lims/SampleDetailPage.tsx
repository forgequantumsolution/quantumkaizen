import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { App, Button, DatePicker, Input, InputNumber, Modal, Select, Spin, Table } from 'antd';
import { ArrowLeft, TestTube, History, Boxes, Plus, ArrowRightLeft } from 'lucide-react';
import type { Dayjs } from 'dayjs';
import { QRCodeSVG } from 'qrcode.react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useSample, useTransitionSample, useAddCustody, useAddAliquot, useStorageLocations,
  SAMPLE_STATUS_LABELS, type SampleStatus, type CustodyAction, type Aliquot,
} from '@/lib/api/samples';
import { STATUS_BADGE } from './SampleListPage';
import SampleTestsPanel from './SampleTestsPanel';

const NEXT: Record<SampleStatus, { status: SampleStatus; label: string; danger?: boolean }[]> = {
  REGISTERED: [{ status: 'IN_TESTING', label: 'Start Testing' }, { status: 'CANCELLED', label: 'Cancel', danger: true }],
  IN_TESTING: [{ status: 'IN_REVIEW', label: 'Send to Review' }, { status: 'REJECTED', label: 'Reject', danger: true }],
  IN_REVIEW: [{ status: 'RELEASED', label: 'Release' }, { status: 'IN_TESTING', label: 'Return to Testing' }, { status: 'REJECTED', label: 'Reject', danger: true }],
  RELEASED: [], REJECTED: [], CANCELLED: [],
};
const CUSTODY_ACTIONS: CustodyAction[] = ['RECEIVED', 'TRANSFERRED', 'STORED', 'RETURNED', 'DISPOSED'];

export default function SampleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { modal, message } = App.useApp();
  const canUpdate = useHasPermission('sample.update');

  const { data: s, isLoading } = useSample(id);
  const transitionMut = useTransitionSample(id ?? '');
  const { data: storage } = useStorageLocations();
  const storageOpts = (storage?.data ?? []).map((x) => ({ value: x.id, label: `${x.code} — ${x.name}` }));

  const [custodyOpen, setCustodyOpen] = useState(false);
  const [aliquotOpen, setAliquotOpen] = useState(false);

  if (isLoading || !s) {
    return <PageContainer><div className="flex items-center justify-center py-32"><Spin /></div></PageContainer>;
  }

  const doTransition = (status: SampleStatus, label: string, danger?: boolean) =>
    modal.confirm({
      title: `${label}?`, okText: label, okButtonProps: { danger }, centered: true,
      onOk: async () => { try { await transitionMut.mutateAsync({ status }); message.success('Status updated'); } catch (e) { message.error(extractErr(e)); } },
    });

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/lims/samples" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"><ArrowLeft size={14} /> Back</Link>
          <span className="text-gray-300">·</span>
          <span className="font-mono text-sm text-gray-700">{s.sample_number}</span>
          <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${STATUS_BADGE[s.status]}`}>{SAMPLE_STATUS_LABELS[s.status]}</span>
        </div>
        {canUpdate && (
          <div className="flex items-center gap-2 flex-wrap">
            {NEXT[s.status].map((t) => (
              <Button key={t.status} danger={t.danger} type={t.danger ? 'default' : 'primary'} onClick={() => doTransition(t.status, t.label, t.danger)} loading={transitionMut.isPending}>
                {t.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Info */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2"><TestTube size={18} className="text-gray-400" />{s.product_name}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <Field label="Batch" value={s.batch_no ?? '—'} />
            <Field label="Type" value={s.sample_type ?? '—'} />
            <Field label="Priority" value={s.priority ?? '—'} />
            <Field label="Specification" value={s.specification_label ?? '—'} />
            <Field label="Lab" value={s.lab_name ?? '—'} />
            <Field label="Quantity" value={s.quantity != null ? `${s.quantity} ${s.unit ?? ''}` : '—'} />
            <Field label="Source" value={s.source_site ?? '—'} />
            <Field label="Current Location" value={s.current_location_name ?? '—'} />
            <Field label="Collected" value={s.collected_at ? new Date(s.collected_at).toLocaleDateString() : '—'} />
            <Field label="Received" value={s.received_at ? new Date(s.received_at).toLocaleDateString() : '—'} />
          </div>
          {s.remarks && <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100">{s.remarks}</p>}
        </div>
        {/* Barcode */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col items-center justify-center text-center">
          <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-2">Sample Barcode</div>
          <QRCodeSVG value={s.barcode} size={120} />
          <div className="font-mono text-sm text-gray-800 mt-2">{s.barcode}</div>
        </div>
      </div>

      {/* Aliquots */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><Boxes size={15} className="text-gray-500" />Aliquots &amp; Storage ({s.aliquots.length})</h3>
          {canUpdate && s.status !== 'RELEASED' && s.status !== 'REJECTED' && <Button size="small" icon={<Plus size={13} />} onClick={() => setAliquotOpen(true)}>Add Aliquot</Button>}
        </div>
        <Table<Aliquot> size="small" rowKey="id" dataSource={s.aliquots} pagination={false}
          locale={{ emptyText: 'No aliquots drawn yet.' }}
          columns={[
            { title: 'Code', dataIndex: 'code', width: 180, render: (v: string) => <span className="font-mono">{v}</span> },
            { title: 'Storage', render: (_: unknown, r) => r.storage_location_name ?? '—' },
            { title: 'Temp', dataIndex: 'temp_zone', width: 100, render: (v: string | null) => v ?? '—' },
            { title: 'Qty', width: 100, render: (_: unknown, r) => (r.quantity != null ? `${r.quantity} ${r.unit ?? ''}` : '—') },
            { title: 'Expiry', width: 110, render: (_: unknown, r) => (r.expiry_at ? new Date(r.expiry_at).toLocaleDateString() : '—') },
          ]}
        />
      </div>

      {/* Tests & Results (LIMS 2.0 — assign → enter results → review → disposition) */}
      <div className="mb-4">
        <SampleTestsPanel sampleId={s.id} canRelease={s.status !== 'RELEASED' && s.status !== 'REJECTED'} />
      </div>

      {/* Chain of custody */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><History size={15} className="text-gray-500" />Chain of Custody ({s.custody_events.length})</h3>
          {canUpdate && s.status !== 'RELEASED' && s.status !== 'REJECTED' && <Button size="small" icon={<ArrowRightLeft size={13} />} onClick={() => setCustodyOpen(true)}>Record Event</Button>}
        </div>
        <ol className="relative border-l border-gray-200 ml-2">
          {s.custody_events.map((c) => (
            <li key={c.id} className="ml-4 pb-4 last:pb-0">
              <span className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white" />
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-900">{c.action.replace(/_/g, ' ')}</span>
                {(c.from_location_name || c.to_location_name) && (
                  <span className="text-[11px] text-gray-500">{c.from_location_name ?? '—'} → {c.to_location_name ?? '—'}</span>
                )}
                <span className="text-[11px] text-gray-400 ml-auto">{new Date(c.occurred_at).toLocaleString()}</span>
              </div>
              {(c.handler_name || c.remarks) && <div className="text-[11px] text-gray-500 mt-0.5">{[c.handler_name, c.remarks].filter(Boolean).join(' · ')}</div>}
            </li>
          ))}
        </ol>
      </div>

      <CustodyModal open={custodyOpen} onClose={() => setCustodyOpen(false)} id={id!} storageOpts={storageOpts} currentLocId={s.current_location_id} />
      <AliquotModal open={aliquotOpen} onClose={() => setAliquotOpen(false)} id={id!} storageOpts={storageOpts} />
    </PageContainer>
  );
}

function CustodyModal({ open, onClose, id, storageOpts, currentLocId }: { open: boolean; onClose: () => void; id: string; storageOpts: { value: string; label: string }[]; currentLocId: string | null }) {
  const { message } = App.useApp();
  const mut = useAddCustody(id);
  const [action, setAction] = useState<CustodyAction>('TRANSFERRED');
  const [toLoc, setToLoc] = useState<string | undefined>();
  const [handler, setHandler] = useState('');
  const [remarks, setRemarks] = useState('');
  const submit = async () => {
    try { await mut.mutateAsync({ action, from_location_id: currentLocId, to_location_id: toLoc ?? null, handler_name: handler || null, remarks: remarks || null }); message.success('Custody event recorded'); onClose(); setToLoc(undefined); setHandler(''); setRemarks(''); }
    catch (e) { message.error(extractErr(e)); }
  };
  return (
    <Modal title="Record Custody Event" open={open} onCancel={onClose} onOk={submit} okText="Record" okButtonProps={{ loading: mut.isPending }} centered>
      <div className="space-y-3">
        <F label="Action"><Select value={action} onChange={setAction} className="w-full" options={CUSTODY_ACTIONS.map((a) => ({ value: a, label: a }))} /></F>
        <F label="To location"><Select value={toLoc} onChange={setToLoc} allowClear showSearch optionFilterProp="label" placeholder="Destination" className="w-full" options={storageOpts} /></F>
        <F label="Handler"><Input value={handler} onChange={(e) => setHandler(e.target.value)} /></F>
        <F label="Remarks"><Input.TextArea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></F>
      </div>
    </Modal>
  );
}

function AliquotModal({ open, onClose, id, storageOpts }: { open: boolean; onClose: () => void; id: string; storageOpts: { value: string; label: string }[] }) {
  const { message } = App.useApp();
  const mut = useAddAliquot(id);
  const [loc, setLoc] = useState<string | undefined>();
  const [temp, setTemp] = useState('');
  const [qty, setQty] = useState<number | null>(null);
  const [unit, setUnit] = useState('');
  const [expiry, setExpiry] = useState<Dayjs | null>(null);
  const submit = async () => {
    try { await mut.mutateAsync({ storage_location_id: loc ?? null, temp_zone: temp || null, quantity: qty, unit: unit || null, expiry_at: expiry ? expiry.toISOString() : null }); message.success('Aliquot created'); onClose(); setLoc(undefined); setTemp(''); setQty(null); setUnit(''); setExpiry(null); }
    catch (e) { message.error(extractErr(e)); }
  };
  return (
    <Modal title="Add Aliquot" open={open} onCancel={onClose} onOk={submit} okText="Create" okButtonProps={{ loading: mut.isPending }} centered>
      <div className="space-y-3">
        <F label="Storage location"><Select value={loc} onChange={setLoc} allowClear showSearch optionFilterProp="label" className="w-full" options={storageOpts} /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Temp zone"><Input value={temp} onChange={(e) => setTemp(e.target.value)} placeholder="2-8°C" /></F>
          <F label="Expiry"><DatePicker value={expiry ?? undefined} onChange={(d) => setExpiry(d ?? null)} className="w-full" /></F>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F label="Quantity"><InputNumber value={qty ?? undefined} onChange={(v) => setQty(v ?? null)} min={0} className="w-full" /></F>
          <F label="Unit"><Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="mL" /></F>
        </div>
      </div>
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><div className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</div><div className="text-sm text-gray-900 mt-0.5">{value}</div></div>;
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
function extractErr(err: unknown): string {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Operation failed';
}
