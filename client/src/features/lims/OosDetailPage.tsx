import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { App, Button, DatePicker, Input, Modal, Radio, Select, Spin, Switch } from 'antd';
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
  useCapaInitForm,
  PHASE_LABELS,
  STATUS_BADGE,
  CLASSIFICATION_LABELS,
  type OosPhase,
  type OosClassification,
  type Investigation,
  type CapaInitField,
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
            <div className="text-[11px] text-gray-500 uppercase tracking-wide">CAPA Workflow Ticket</div>
            {inv.capa_ticket ? (
              <Link to={`/tickets/${inv.capa_ticket.id}`} className="text-sm text-blue-600 hover:text-blue-800 inline-flex items-center gap-1 mt-0.5">
                {inv.capa_ticket.unique_id ?? 'View ticket'} <ExternalLink size={12} />
              </Link>
            ) : (
              <div className="text-sm text-gray-400 mt-0.5">— none</div>
            )}
          </div>
          <div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wide">CAPA Record</div>
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
      <RaiseCapaModal open={capaOpen} onClose={() => setCapaOpen(false)} oos={inv} />
    </PageContainer>
  );
}

// Renders one CAPA-initiation field by its form type.
function InitFieldInput({ field, value, onChange }: { field: CapaInitField; value: unknown; onChange: (v: unknown) => void }) {
  const opts = (field.options ?? []).map((o) => ({ value: o.value, label: o.label }));
  switch (field.type) {
    case 'textarea':
      return <Input.TextArea rows={3} value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
    case 'select':
    case 'dropdown':
      return <Select className="w-full" allowClear value={(value as string) || undefined} onChange={(v) => onChange(v ?? '')} options={opts} placeholder="Select…" />;
    case 'radio':
      return <Radio.Group value={value} onChange={(e) => onChange(e.target.value)} options={opts} />;
    case 'multi_text':
      return <Select mode="tags" className="w-full" value={(value as string[]) ?? []} onChange={(v) => onChange(v)} options={opts} placeholder="Type and press Enter…" tokenSeparators={[',']} />;
    default:
      return <Input value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value)} />;
  }
}

function RaiseCapaModal({ open, onClose, oos }: { open: boolean; onClose: () => void; oos: Investigation }) {
  const { message } = App.useApp();
  const mut = useCreateCapaFromOos(oos.id);
  const { data: schema, isLoading } = useCapaInitForm(open);
  const form = schema?.form ?? null;

  const [type, setType] = useState<CapaType>('CORRECTIVE');
  const [due, setDue] = useState<Dayjs | null>(null);
  // responses keyed by { sectionName: { fieldName: value } }
  const [resp, setResp] = useState<Record<string, Record<string, unknown>>>({});

  // Pre-fill the initiation fields from the investigation when the schema arrives.
  useEffect(() => {
    if (!open) return;
    setType('CORRECTIVE');
    setDue(null);
    if (!form) { setResp({}); return; }
    const next: Record<string, Record<string, unknown>> = {};
    for (const s of form.sections) {
      next[s.name] = {};
      for (const f of s.fields) {
        const lbl = f.label.toLowerCase();
        let v: unknown = f.type === 'multi_text' ? [] : '';
        if (/title/.test(lbl)) v = oos.title;
        else if (/desc/.test(lbl)) v = `Raised from OOS investigation ${oos.code}: ${oos.title}.`;
        else if (/affected|area/.test(lbl)) v = f.type === 'multi_text' ? [oos.sample_id ? `Sample ${oos.sample_id}` : 'See investigation'] : '';
        next[s.name][f.name] = v;
      }
    }
    setResp(next);
  }, [open, form, oos]);

  const setField = (section: string, field: string, value: unknown) =>
    setResp((p) => ({ ...p, [section]: { ...(p[section] ?? {}), [field]: value } }));

  const toast = (res: Awaited<ReturnType<typeof mut.mutateAsync>>) =>
    message.success(
      res.capa_ticket
        ? `Raised ${res.capa.capa_number} + CAPA ticket ${res.capa_ticket.unique_id ?? ''} (initiation filled)`
        : `Raised ${res.capa.capa_number} (CAPA workflow ticket not raised — see logs)`,
    );

  const submit = async () => {
    if (!form) {
      try { toast(await mut.mutateAsync({ type, due_date: due ? due.toISOString() : null })); onClose(); }
      catch (e) { message.error(extractErr(e)); }
      return;
    }
    // Required-field validation.
    for (const s of form.sections) {
      for (const f of s.fields) {
        if (!f.required) continue;
        const val = resp[s.name]?.[f.name];
        const empty = val == null || val === '' || (Array.isArray(val) && val.length === 0);
        if (empty) return message.error(`${f.label} is required`);
      }
    }
    // Derive the CAPA record title/description from the matching init fields.
    let title = oos.title;
    let description: string | undefined;
    for (const s of form.sections) {
      for (const f of s.fields) {
        const lbl = f.label.toLowerCase();
        const val = resp[s.name]?.[f.name];
        if (/title/.test(lbl) && val) title = String(val);
        if (/desc/.test(lbl) && val) description = String(val);
      }
    }
    try {
      toast(await mut.mutateAsync({ title, description, type, due_date: due ? due.toISOString() : null, init_form_id: form.form_id, init_responses: resp }));
      onClose();
    } catch (e) { message.error(extractErr(e)); }
  };

  return (
    <Modal title="Raise CAPA from this OOS" open={open} onCancel={onClose} onOk={submit} okText="Raise & link" okButtonProps={{ loading: mut.isPending }} centered destroyOnClose width={580}>
      <p className="text-sm text-gray-600 mb-3">Creates a CAPA record and a ticket on the CAPA workflow, with its <b>initiation stage pre-filled</b> from this investigation. Review the details below before raising.</p>
      {isLoading ? (
        <div className="py-8 text-center"><Spin /></div>
      ) : (
        <div className="space-y-3 max-h-[60vh] overflow-auto pr-1">
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="CAPA type"><Select value={type} onChange={setType} className="w-full" options={CAPA_TYPES.map((t) => ({ value: t, label: t.charAt(0) + t.slice(1).toLowerCase() }))} /></Labeled>
            <Labeled label="Target due date"><DatePicker value={due ?? undefined} onChange={(d) => setDue(d ?? null)} className="w-full" /></Labeled>
          </div>
          {form ? (
            form.sections.map((s) => (
              <div key={s.name} className="space-y-3">
                {form.sections.length > 1 && <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide pt-1">{s.name}</div>}
                {s.fields.map((f) => (
                  <Labeled key={f.name} label={`${f.label}${f.required ? ' *' : ''}`}>
                    <InitFieldInput field={f} value={resp[s.name]?.[f.name]} onChange={(v) => setField(s.name, f.name, v)} />
                  </Labeled>
                ))}
              </div>
            ))
          ) : (
            <div className="text-sm text-amber-600">No CAPA initiation form is configured on the active CAPA workflow — a CAPA record and ticket will still be created.</div>
          )}
        </div>
      )}
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
