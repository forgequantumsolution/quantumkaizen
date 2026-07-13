import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Input, Modal, Select, Table } from 'antd';
import { AlertTriangle, Plus, Search } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useInvestigations,
  useOpenInvestigation,
  PHASE_LABELS,
  STATUS_BADGE,
  CLASSIFICATION_LABELS,
  type Investigation,
  type OosPhase,
  type OosStatus,
  type OosClassification,
} from '@/lib/api/oos';

const STATUSES: OosStatus[] = ['OPEN', 'IN_PROGRESS', 'CLOSED'];
const PHASES: OosPhase[] = ['PHASE_1A', 'PHASE_1B', 'PHASE_2', 'CLOSED'];

export default function OosListPage() {
  const nav = useNavigate();
  const canCreate = useHasPermission('oos.create');
  const [status, setStatus] = useState<OosStatus | undefined>();
  const [phase, setPhase] = useState<OosPhase | undefined>();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useInvestigations({ status, phase, search: search || undefined });
  const rows = data?.data ?? [];
  const [open, setOpen] = useState(false);

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle size={22} className="text-gray-500" />OOS / OOT Investigations
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Out-of-specification and out-of-trend investigations through a phased lab review.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={status}
            onChange={setStatus}
            allowClear
            placeholder="All statuses"
            style={{ width: 160 }}
            options={STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
          />
          <Select
            value={phase}
            onChange={setPhase}
            allowClear
            placeholder="All phases"
            style={{ width: 170 }}
            options={PHASES.map((p) => ({ value: p, label: PHASE_LABELS[p] }))}
          />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <Input
              placeholder="Search code / title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              style={{ width: 280 }}
            />
          </div>
          {canCreate && (
            <Button type="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>
              New Investigation
            </Button>
          )}
        </div>
      </div>

      <Table<Investigation>
        size="small"
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        scroll={{ x: 'max-content' }}
        onRow={(r) => ({ onClick: () => nav(`/lims/oos/${r.id}`), style: { cursor: 'pointer' } })}
        columns={[
          {
            title: 'Code',
            dataIndex: 'code',
            width: 150,
            render: (v: string) => <span className="font-mono text-blue-600">{v}</span>,
          },
          { title: 'Title', dataIndex: 'title', ellipsis: true, width: 320 },
          {
            title: 'Phase',
            width: 150,
            render: (_: unknown, r) => (
              <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border bg-slate-50 text-slate-700 border-slate-200">
                {PHASE_LABELS[r.phase]}
              </span>
            ),
          },
          {
            title: 'Status',
            width: 130,
            render: (_: unknown, r) => (
              <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${STATUS_BADGE[r.status]}`}>
                {r.status.replace(/_/g, ' ')}
              </span>
            ),
          },
          {
            title: 'Classification',
            width: 150,
            render: (_: unknown, r) =>
              r.classification
                ? CLASSIFICATION_LABELS[r.classification as OosClassification] ?? r.classification
                : '—',
          },
          {
            title: 'CAPA',
            width: 140,
            render: (_: unknown, r) =>
              r.capa?.capa_number
                ? <span className="font-mono text-xs text-blue-600">{r.capa.capa_number}</span>
                : '—',
          },
          {
            title: 'Opened',
            width: 120,
            render: (_: unknown, r) => new Date(r.opened_at).toLocaleDateString(),
          },
        ]}
      />

      <NewInvestigationModal
        open={open}
        onClose={() => setOpen(false)}
        onDone={(id) => {
          setOpen(false);
          nav(`/lims/oos/${id}`);
        }}
      />
    </PageContainer>
  );
}

function NewInvestigationModal({
  open,
  onClose,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  onDone: (id: string) => void;
}) {
  const { message } = App.useApp();
  const openMut = useOpenInvestigation();
  const [title, setTitle] = useState('');
  const [sampleId, setSampleId] = useState('');

  const submit = async () => {
    if (!title.trim()) {
      message.error('Title is required');
      return;
    }
    try {
      const created = await openMut.mutateAsync({ title: title.trim(), sample_id: sampleId.trim() || null });
      message.success(`Opened ${created.code}`);
      setTitle('');
      setSampleId('');
      onDone(created.id);
    } catch (e) {
      message.error(extractErr(e));
    }
  };

  return (
    <Modal
      title="New Investigation"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Open"
      okButtonProps={{ loading: openMut.isPending }}
      centered
    >
      <div className="space-y-3">
        <F label="Title *">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Investigation title" />
        </F>
        <F label="Sample ID">
          <Input value={sampleId} onChange={(e) => setSampleId(e.target.value)} placeholder="Optional sample reference" />
        </F>
      </div>
    </Modal>
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
function extractErr(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
    'Operation failed'
  );
}
