import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { App, Button, DatePicker, Input, Modal, Select, Spin, Switch } from 'antd';
import { AlertTriangle, ArrowLeft, ShieldPlus, ExternalLink } from 'lucide-react';
import type { Dayjs } from 'dayjs';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useInvestigation,
  useUpdateInvestigation,
  useAdvancePhase,
  useCloseInvestigation,
  useCreateCapaFromOos,
  PHASE_LABELS,
  STATUS_BADGE,
  CLASSIFICATION_LABELS,
  type OosPhase,
  type OosClassification,
} from '@/lib/api/oos';
import { useCapas, type CapaType } from '@/lib/api/audit';

const CAPA_TYPES: CapaType[] = ['CORRECTIVE', 'PREVENTIVE', 'BOTH'];

const ADVANCE_FLOW: OosPhase[] = ['PHASE_1A', 'PHASE_1B', 'PHASE_2'];
const CLASSIFICATIONS: OosClassification[] = ['LAB_ERROR', 'NON_LAB_ERROR', 'CONFIRMED_OOS', 'INVALIDATED'];

export default function OosDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { message } = App.useApp();
  const canUpdate = useHasPermission('oos.update');
  const canClose = useHasPermission('oos.close');
  const canCreateCapa = useHasPermission('capa.create');

  const { data: inv, isLoading } = useInvestigation(id);
  const updateMut = useUpdateInvestigation(id ?? '');
  const advanceMut = useAdvancePhase(id ?? '');

  const [closeOpen, setCloseOpen] = useState(false);
  const [capaOpen, setCapaOpen] = useState(false);
  const [hypothesis, setHypothesis] = useState('');
  const [summary, setSummary] = useState('');
  const [retest, setRetest] = useState(false);
  const [resample, setResample] = useState(false);

  useEffect(() => {
    if (inv) {
      setHypothesis(inv.hypothesis ?? '');
      setSummary(inv.investigation_summary ?? '');
      setRetest(inv.retest_required);
      setResample(inv.resample_required);
    }
  }, [inv]);

  if (isLoading || !inv) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-32">
          <Spin />
        </div>
      </PageContainer>
    );
  }

  const closed = inv.status === 'CLOSED' || inv.phase === 'CLOSED';

  const nextPhase = (() => {
    const i = ADVANCE_FLOW.indexOf(inv.phase);
    return i >= 0 && i < ADVANCE_FLOW.length - 1 ? ADVANCE_FLOW[i + 1] : null;
  })();

  const save = async () => {
    try {
      await updateMut.mutateAsync({
        hypothesis: hypothesis || null,
        investigation_summary: summary || null,
        retest_required: retest,
        resample_required: resample,
      });
      message.success('Saved');
    } catch (e) {
      message.error(extractErr(e));
    }
  };

  const advance = async () => {
    if (!nextPhase) return;
    try {
      await advanceMut.mutateAsync({ phase: nextPhase as 'PHASE_1B' | 'PHASE_2' });
      message.success(`Advanced to ${PHASE_LABELS[nextPhase]}`);
    } catch (e) {
      message.error(extractErr(e));
    }
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/lims/oos" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
            <ArrowLeft size={14} /> Back
          </Link>
          <span className="text-gray-300">·</span>
          <span className="font-mono text-sm text-gray-700">{inv.code}</span>
          <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border bg-slate-50 text-slate-700 border-slate-200">
            {PHASE_LABELS[inv.phase]}
          </span>
          <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${STATUS_BADGE[inv.status]}`}>
            {inv.status.replace(/_/g, ' ')}
          </span>
        </div>
        {!closed && (
          <div className="flex items-center gap-2 flex-wrap">
            {canCreateCapa && !inv.capa && (
              <Button icon={<ShieldPlus size={14} />} onClick={() => setCapaOpen(true)}>
                Raise CAPA
              </Button>
            )}
            {canUpdate && nextPhase && (
              <Button type="primary" onClick={advance} loading={advanceMut.isPending}>
                Advance to {PHASE_LABELS[nextPhase]}
              </Button>
            )}
            {canClose && (
              <Button danger onClick={() => setCloseOpen(true)}>
                Close Investigation
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <AlertTriangle size={18} className="text-gray-400" />
          {inv.title}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <Field label="Sample" value={inv.sample_id ?? '—'} />
          <Field label="Opened" value={new Date(inv.opened_at).toLocaleString()} />
          <Field
            label="Classification"
            value={
              inv.classification
                ? CLASSIFICATION_LABELS[inv.classification as OosClassification] ?? inv.classification
                : '—'
            }
          />
          <Field label="Retest required" value={inv.retest_required ? 'Yes' : 'No'} />
          <Field label="Resample required" value={inv.resample_required ? 'Yes' : 'No'} />
          <Field label="Closed" value={inv.closed_at ? new Date(inv.closed_at).toLocaleString() : '—'} />
          <div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wide">Linked CAPA</div>
            {inv.capa ? (
              <Link to={`/audit/capa/${inv.capa.id}`} className="text-sm text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 mt-0.5">
                {inv.capa.capa_number} <span className="text-[10px] text-gray-400">({inv.capa.status})</span> <ExternalLink size={12} />
              </Link>
            ) : (
              <div className="text-sm text-gray-400 mt-0.5">— none</div>
            )}
          </div>
        </div>
        {inv.conclusion && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">Conclusion</div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{inv.conclusion}</p>
          </div>
        )}
      </div>

      {canUpdate && !closed && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Investigation</h3>
          <Labeled label="Hypothesis">
            <Input.TextArea
              rows={3}
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="Probable assignable cause"
            />
          </Labeled>
          <Labeled label="Investigation summary">
            <Input.TextArea
              rows={4}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Findings, checks performed and outcome"
            />
          </Labeled>
          <div className="flex items-center gap-8">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <Switch checked={retest} onChange={setRetest} /> Retest required
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <Switch checked={resample} onChange={setResample} /> Resample required
            </label>
          </div>
          <div className="flex justify-end">
            <Button type="primary" onClick={save} loading={updateMut.isPending}>
              Save
            </Button>
          </div>
        </div>
      )}

      <CloseModal open={closeOpen} onClose={() => setCloseOpen(false)} id={id ?? ''} />
      <RaiseCapaModal open={capaOpen} onClose={() => setCapaOpen(false)} id={id ?? ''} defaultTitle={inv.title} />
    </PageContainer>
  );
}

function RaiseCapaModal({ open, onClose, id, defaultTitle }: { open: boolean; onClose: () => void; id: string; defaultTitle: string }) {
  const { message } = App.useApp();
  const mut = useCreateCapaFromOos(id);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<CapaType>('CORRECTIVE');
  const [due, setDue] = useState<Dayjs | null>(null);

  useEffect(() => { if (open) { setTitle(defaultTitle ?? ''); setType('CORRECTIVE'); setDue(null); } }, [open, defaultTitle]);

  const submit = async () => {
    try {
      const res = await mut.mutateAsync({ title: title.trim() || undefined, type, due_date: due ? due.toISOString() : null });
      message.success(`Raised ${res.capa.capa_number} and linked it to this investigation`);
      onClose();
    } catch (e) { message.error(extractErr(e)); }
  };

  return (
    <Modal title="Raise CAPA from this OOS" open={open} onCancel={onClose} onOk={submit} okText="Raise & link" okButtonProps={{ loading: mut.isPending }} centered destroyOnClose>
      <p className="text-sm text-gray-600 mb-3">Creates a QMS corrective/preventive action and links it back to this investigation. The CAPA opens in the Audit/QMS module for root-cause, actions and verification.</p>
      <div className="space-y-3">
        <Labeled label="Title *"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="CAPA title" /></Labeled>
        <Labeled label="Type"><Select value={type} onChange={setType} className="w-full" options={CAPA_TYPES.map((t) => ({ value: t, label: t.charAt(0) + t.slice(1).toLowerCase() }))} /></Labeled>
        <Labeled label="Target due date"><DatePicker value={due ?? undefined} onChange={(d) => setDue(d ?? null)} className="w-full" /></Labeled>
      </div>
    </Modal>
  );
}

function CloseModal({ open, onClose, id }: { open: boolean; onClose: () => void; id: string }) {
  const { message } = App.useApp();
  const closeMut = useCloseInvestigation(id);
  const { data: capas } = useCapas();
  const capaOpts = (capas?.data ?? []).map((c) => ({ value: c.id, label: `${c.capa_number} — ${c.title} (${c.status})` }));
  const [classification, setClassification] = useState<OosClassification>('LAB_ERROR');
  const [conclusion, setConclusion] = useState('');
  const [capaId, setCapaId] = useState<string | undefined>();
  const [credential, setCredential] = useState('');

  const submit = async () => {
    try {
      await closeMut.mutateAsync({
        classification,
        conclusion: conclusion || null,
        capa_id: capaId || null,
        credential: credential || null,
      });
      message.success('Investigation closed');
      onClose();
      setConclusion('');
      setCapaId(undefined);
      setCredential('');
    } catch (e) {
      message.error(extractErr(e));
    }
  };

  return (
    <Modal
      title="Close Investigation"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Close"
      okButtonProps={{ danger: true, loading: closeMut.isPending }}
      centered
    >
      <div className="space-y-3">
        <Labeled label="Classification *">
          <Select
            value={classification}
            onChange={setClassification}
            className="w-full"
            options={CLASSIFICATIONS.map((c) => ({ value: c, label: CLASSIFICATION_LABELS[c] }))}
          />
        </Labeled>
        <Labeled label="Conclusion">
          <Input.TextArea rows={3} value={conclusion} onChange={(e) => setConclusion(e.target.value)} />
        </Labeled>
        <Labeled label="Link CAPA">
          <Select
            value={capaId}
            onChange={setCapaId}
            allowClear
            showSearch
            optionFilterProp="label"
            className="w-full"
            placeholder="Link an existing CAPA (optional)"
            options={capaOpts}
          />
        </Labeled>
        <Labeled label="Signature PIN / password">
          <Input.Password
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            placeholder="••••••"
            onPressEnter={submit}
          />
        </Labeled>
      </div>
    </Modal>
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
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
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
