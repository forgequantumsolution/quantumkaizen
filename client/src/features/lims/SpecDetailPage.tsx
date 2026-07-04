import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { App, Button, Input, InputNumber, Select, Spin } from 'antd';
import { ArrowLeft, Save, ShieldCheck, Archive, Trash2, Plus, X, ScrollText } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import UnitSelect from './UnitSelect';
import { useHasPermission } from '@/stores/authStore';
import {
  useSpec, useCreateSpec, useUpdateSpec, useApproveSpec, useRetireSpec, useDeleteSpec,
  useMethods, type SpecParameter, type SpecUpsert,
} from '@/lib/api/lims';

type ParamRow = Omit<SpecParameter, 'id' | 'method_name'>;
const emptyParam = (position: number): ParamRow => ({
  name: '', unit: null, min_value: null, max_value: null, target_value: null,
  text_criteria: null, method_id: null, pharmacopoeia_ref: null, position,
});

export default function SpecDetailPage() {
  const { id } = useParams<{ id: string }>();
  const isCreate = !id;
  const nav = useNavigate();
  const { modal, message } = App.useApp();

  const { data: spec, isLoading } = useSpec(id);
  const { data: methodsData } = useMethods();
  const methods = methodsData?.data ?? [];

  const canApprove = useHasPermission('specification.approve');
  const canDelete = useHasPermission('specification.delete');

  const [productName, setProductName] = useState('');
  const [pharmacopoeia, setPharmacopoeia] = useState('');
  const [description, setDescription] = useState('');
  const [params, setParams] = useState<ParamRow[]>([emptyParam(0)]);
  const [hydrated, setHydrated] = useState(isCreate);

  useEffect(() => {
    if (!isCreate && spec && !hydrated) {
      setProductName(spec.product_name);
      setPharmacopoeia(spec.pharmacopoeia ?? '');
      setDescription(spec.description ?? '');
      setParams(spec.parameters.length ? spec.parameters.map(({ id: _id, method_name: _m, ...p }) => p) : [emptyParam(0)]);
      setHydrated(true);
    }
  }, [isCreate, spec, hydrated]);

  const createMut = useCreateSpec();
  const updateMut = useUpdateSpec(id ?? '');
  const approveMut = useApproveSpec(id ?? '');
  const retireMut = useRetireSpec(id ?? '');
  const deleteMut = useDeleteSpec();

  const editable = isCreate || spec?.status === 'DRAFT';

  const setParam = (i: number, patch: Partial<ParamRow>) =>
    setParams((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const addParam = () => setParams((ps) => [...ps, emptyParam(ps.length)]);
  const removeParam = (i: number) => setParams((ps) => ps.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, position: idx })));

  const buildBody = (): SpecUpsert => ({
    product_name: productName.trim(),
    pharmacopoeia: pharmacopoeia || null,
    description: description || null,
    parameters: params.filter((p) => p.name.trim()).map((p, i) => ({ ...p, position: i })),
  });

  const handleSave = async () => {
    if (!productName.trim()) return message.error('Product name is required');
    try {
      if (isCreate) {
        const created = await createMut.mutateAsync(buildBody());
        message.success('Specification created');
        nav(`/lims/specifications/${created.id}`);
      } else {
        await updateMut.mutateAsync(buildBody());
        message.success('Saved');
      }
    } catch (e) { message.error(extractErr(e)); }
  };

  const handleApprove = () =>
    modal.confirm({
      title: 'Approve specification?',
      content: 'Approved specifications are locked and become effective.',
      okText: 'Approve', centered: true,
      onOk: async () => { try { await approveMut.mutateAsync(); message.success('Approved'); } catch (e) { message.error(extractErr(e)); } },
    });

  const handleRetire = () =>
    modal.confirm({ title: 'Retire specification?', okText: 'Retire', okButtonProps: { danger: true }, centered: true,
      onOk: async () => { try { await retireMut.mutateAsync(); message.success('Retired'); } catch (e) { message.error(extractErr(e)); } } });

  const handleDelete = () =>
    modal.confirm({ title: `Delete ${spec?.code}?`, okText: 'Delete', okButtonProps: { danger: true }, centered: true,
      onOk: async () => { try { await deleteMut.mutateAsync(id!); message.success('Deleted'); nav('/lims/specifications'); } catch (e) { message.error(extractErr(e)); } } });

  if (!isCreate && isLoading) {
    return <PageContainer><div className="flex items-center justify-center py-32"><Spin /></div></PageContainer>;
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/lims/specifications" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"><ArrowLeft size={14} /> Back</Link>
          <span className="text-gray-300">·</span>
          {isCreate ? <h2 className="text-base font-semibold text-gray-900 flex items-center gap-1.5"><ScrollText size={16} /> New Specification</h2> : (
            <>
              <span className="font-mono text-sm text-gray-700">{spec?.code}</span>
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded border bg-gray-50 text-gray-600 border-gray-200">{spec?.status} · v{spec?.version}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => nav(isCreate ? '/lims/specifications' : `/lims/specifications`)}>Cancel</Button>
          {editable && <Button type="primary" icon={<Save size={14} />} onClick={handleSave} loading={createMut.isPending || updateMut.isPending}>{isCreate ? 'Create' : 'Save Draft'}</Button>}
          {!isCreate && spec?.status === 'DRAFT' && canApprove && <Button type="primary" icon={<ShieldCheck size={14} />} onClick={handleApprove} loading={approveMut.isPending}>Approve</Button>}
          {!isCreate && spec?.status === 'APPROVED' && canApprove && <Button icon={<Archive size={14} />} onClick={handleRetire}>Retire</Button>}
          {!isCreate && spec?.status === 'DRAFT' && canDelete && <Button danger icon={<Trash2 size={14} />} onClick={handleDelete}>Delete</Button>}
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3 grid grid-cols-1 md:grid-cols-12 gap-3">
        <Field label="Product / Material *" className="md:col-span-6"><Input value={productName} disabled={!editable} onChange={(e) => setProductName(e.target.value)} placeholder="e.g. Paracetamol Tablets 500mg" /></Field>
        <Field label="Pharmacopoeia" className="md:col-span-3"><Input value={pharmacopoeia} disabled={!editable} onChange={(e) => setPharmacopoeia(e.target.value)} placeholder="IP / BP / USP" /></Field>
        <Field label="Description" className="md:col-span-12"><Input value={description} disabled={!editable} onChange={(e) => setDescription(e.target.value)} /></Field>
      </div>

      {/* Parameters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Parameters &amp; Acceptance Limits</h3>
          {editable && <Button size="small" icon={<Plus size={13} />} onClick={addParam}>Add parameter</Button>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-2 w-[22%]">Parameter</th>
                <th className="py-2 px-2 w-[10%]">Unit</th>
                <th className="py-2 px-2 w-[10%]">Min</th>
                <th className="py-2 px-2 w-[10%]">Max</th>
                <th className="py-2 px-2 w-[10%]">Target</th>
                <th className="py-2 px-2 w-[16%]">Text criteria</th>
                <th className="py-2 px-2 w-[18%]">Method</th>
                {editable && <th className="py-2 pl-2 w-[4%]" />}
              </tr>
            </thead>
            <tbody>
              {params.map((p, i) => (
                <tr key={i} className="border-b border-gray-50 align-top">
                  <td className="py-1.5 pr-2"><Input size="small" value={p.name} disabled={!editable} onChange={(e) => setParam(i, { name: e.target.value })} placeholder="e.g. Assay" /></td>
                  <td className="py-1.5 px-2"><UnitSelect size="small" value={p.unit} disabled={!editable} onChange={(v) => setParam(i, { unit: v })} placeholder="%" /></td>
                  <td className="py-1.5 px-2"><InputNumber size="small" value={p.min_value ?? undefined} disabled={!editable} onChange={(v) => setParam(i, { min_value: v ?? null })} className="w-full" /></td>
                  <td className="py-1.5 px-2"><InputNumber size="small" value={p.max_value ?? undefined} disabled={!editable} onChange={(v) => setParam(i, { max_value: v ?? null })} className="w-full" /></td>
                  <td className="py-1.5 px-2"><InputNumber size="small" value={p.target_value ?? undefined} disabled={!editable} onChange={(v) => setParam(i, { target_value: v ?? null })} className="w-full" /></td>
                  <td className="py-1.5 px-2"><Input size="small" value={p.text_criteria ?? ''} disabled={!editable} onChange={(e) => setParam(i, { text_criteria: e.target.value || null })} placeholder="Complies…" /></td>
                  <td className="py-1.5 px-2">
                    <Select size="small" value={p.method_id ?? undefined} disabled={!editable} onChange={(v) => setParam(i, { method_id: v ?? null })} allowClear showSearch optionFilterProp="label" placeholder="—" className="w-full"
                      options={methods.map((m) => ({ value: m.id, label: `${m.code} — ${m.name}` }))} />
                  </td>
                  {editable && <td className="py-1.5 pl-2 text-right"><button onClick={() => removeParam(i)} className="text-gray-400 hover:text-red-600"><X size={14} /></button></td>}
                </tr>
              ))}
            </tbody>
          </table>
          {params.length === 0 && <div className="py-6 text-center text-sm text-gray-400">No parameters yet.</div>}
        </div>
      </div>
    </PageContainer>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}

function extractErr(err: unknown): string {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Operation failed';
}
