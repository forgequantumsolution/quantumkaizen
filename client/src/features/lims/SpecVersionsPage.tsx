import { useEffect, useState } from 'react';
import { App, Button, Drawer, Input, InputNumber, Select, Spin, Switch, Table } from 'antd';
import { FileStack, Plus, Search, Save, ShieldCheck, GitBranch, Trash2, X, ArrowLeft } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import { useProducts } from '@/lib/api/product';
import { useAnalytes } from '@/lib/api/analyte';
import { useTestDefinitions } from '@/lib/api/testDefinition';
import {
  useSpecVersions, useSpecVersion, useCreateSpecVersion, useUpdateSpecVersion,
  useApproveSpecVersion, useReviseSpecVersion, useDeleteSpecVersion,
  SPEC_STAGE_LABELS, SPEC_VERSION_STATUS_BADGE,
  type SpecVersionSummary, type SpecStage, type SpecVersionStatus, type SpecLine, type SpecVersionUpsert,
} from '@/lib/api/specVersion';

const STAGE_OPTIONS = (Object.keys(SPEC_STAGE_LABELS) as SpecStage[]).map((v) => ({ value: v, label: SPEC_STAGE_LABELS[v] }));
const STATUS_OPTIONS: SpecVersionStatus[] = ['DRAFT', 'APPROVED', 'SUPERSEDED', 'RETIRED'];

function extractErr(err: unknown): string {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Operation failed';
}

export default function SpecVersionsPage() {
  const canCreate = useHasPermission('spec_version.create');
  const [stage, setStage] = useState<SpecStage | undefined>();
  const [status, setStatus] = useState<SpecVersionStatus | undefined>();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useSpecVersions({ stage, status, search: search || undefined });
  const rows = data?.data ?? [];

  // editor state: undefined = closed, null = create new, string = edit id
  const [editorId, setEditorId] = useState<string | null | undefined>(undefined);

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FileStack size={22} className="text-gray-500" />Specification Versions</h1>
          <p className="text-xs text-gray-500 mt-0.5">Versioned, multi-stage specifications — the limit authority for result evaluation.</p>
        </div>
        {canCreate && <Button type="primary" icon={<Plus size={14} />} onClick={() => setEditorId(null)}>New Spec Version</Button>}
      </div>

      <div className="flex items-center justify-end gap-2 mb-3 flex-wrap">
        <Select value={stage} onChange={setStage} allowClear placeholder="All stages" style={{ width: 160 }} options={STAGE_OPTIONS} />
        <Select value={status} onChange={setStatus} allowClear placeholder="All statuses" style={{ width: 150 }}
          options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))} />
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
          <Input placeholder="Search code / name…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 240 }} />
        </div>
      </div>

      <Table<SpecVersionSummary>
        size="small" rowKey="id" loading={isLoading} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        onRow={(r) => ({ onClick: () => setEditorId(r.id), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 120, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Name', dataIndex: 'name', ellipsis: true },
          { title: 'Product', dataIndex: 'product_name', width: 180, ellipsis: true, render: (v: string | null) => v ?? '—' },
          { title: 'Stage', dataIndex: 'stage', width: 120, render: (v: SpecStage) => <span className="inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border bg-indigo-50 text-indigo-700 border-indigo-200">{SPEC_STAGE_LABELS[v]}</span> },
          { title: 'Grade / Market', width: 150, render: (_: unknown, r) => [r.grade, r.market].filter(Boolean).join(' / ') || '—' },
          { title: 'Ver', dataIndex: 'version', width: 60, render: (v: number) => `v${v}` },
          { title: 'Lines', dataIndex: 'line_count', width: 70 },
          { title: 'Status', width: 110, render: (_: unknown, r) => <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${SPEC_VERSION_STATUS_BADGE[r.status]}`}>{r.status}</span> },
        ]}
      />

      <Drawer
        open={editorId !== undefined}
        onClose={() => setEditorId(undefined)}
        width={920}
        destroyOnClose
        title={
          <span className="flex items-center gap-2 text-sm">
            <button onClick={() => setEditorId(undefined)} className="text-gray-400 hover:text-gray-900"><ArrowLeft size={16} /></button>
            {editorId === null ? 'New Spec Version' : 'Spec Version'}
          </span>
        }
      >
        {editorId !== undefined && (
          <SpecVersionEditor
            id={editorId}
            onCreated={(id) => setEditorId(id)}
            onDeleted={() => setEditorId(undefined)}
          />
        )}
      </Drawer>
    </PageContainer>
  );
}

type LineRow = Omit<SpecLine, 'id'>;
const emptyLine = (sequence: number): LineRow => ({
  analyte_id: null, test_definition_id: null, name: '', unit: null,
  min_value: null, max_value: null, target_value: null, text_criteria: null,
  decimals: null, sig_figs: null, mandatory: true, sequence,
});

function SpecVersionEditor({ id, onCreated, onDeleted }: { id: string | null; onCreated: (id: string) => void; onDeleted: () => void }) {
  const isCreate = id === null;
  const { modal, message } = App.useApp();

  const { data: spec, isLoading } = useSpecVersion(id ?? undefined);
  const { data: productsData } = useProducts();
  const { data: analytesData } = useAnalytes();
  const { data: defsData } = useTestDefinitions();
  const products = productsData?.data ?? [];
  const analytes = analytesData?.data ?? [];
  const defs = defsData?.data ?? [];

  const canApprove = useHasPermission('spec_version.approve');
  const canUpdate = useHasPermission('spec_version.update');
  const canDelete = useHasPermission('spec_version.delete');

  const [name, setName] = useState('');
  const [productId, setProductId] = useState<string | null>(null);
  const [stage, setStage] = useState<SpecStage>('RELEASE');
  const [grade, setGrade] = useState('');
  const [market, setMarket] = useState('');
  const [pharmacopoeia, setPharmacopoeia] = useState('');
  const [lines, setLines] = useState<LineRow[]>([emptyLine(0)]);
  const [hydrated, setHydrated] = useState(isCreate);

  useEffect(() => {
    if (!isCreate && spec && !hydrated) {
      setName(spec.name);
      setProductId(spec.product_id);
      setStage(spec.stage);
      setGrade(spec.grade ?? '');
      setMarket(spec.market ?? '');
      setPharmacopoeia(spec.pharmacopoeia ?? '');
      setLines(spec.lines.length ? spec.lines.map(({ id: _id, ...l }) => l) : [emptyLine(0)]);
      setHydrated(true);
    }
  }, [isCreate, spec, hydrated]);

  const createMut = useCreateSpecVersion();
  const updateMut = useUpdateSpecVersion(id ?? '');
  const approveMut = useApproveSpecVersion(id ?? '');
  const reviseMut = useReviseSpecVersion(id ?? '');
  const deleteMut = useDeleteSpecVersion();

  const editable = isCreate || spec?.status === 'DRAFT';

  const setLine = (i: number, patch: Partial<LineRow>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, emptyLine(ls.length)]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i).map((l, idx) => ({ ...l, sequence: idx })));

  const onAnalyte = (i: number, analyteId: string | null) => {
    const a = analytes.find((x) => x.id === analyteId);
    setLine(i, {
      analyte_id: analyteId,
      ...(a ? { name: lines[i].name || a.name, unit: lines[i].unit || a.default_unit } : {}),
    });
  };

  const buildBody = (): SpecVersionUpsert => ({
    name: name.trim(),
    product_id: productId,
    stage,
    grade: grade || null,
    market: market || null,
    pharmacopoeia: pharmacopoeia || null,
    lines: lines.filter((l) => l.name.trim()).map((l, i) => ({ ...l, sequence: i })),
  });

  const handleSave = async () => {
    if (!name.trim()) return message.error('Name is required');
    try {
      if (isCreate) {
        const created = await createMut.mutateAsync(buildBody());
        message.success('Spec version created');
        onCreated(created.id);
      } else {
        await updateMut.mutateAsync(buildBody());
        message.success('Saved');
      }
    } catch (e) { message.error(extractErr(e)); }
  };

  const handleApprove = () =>
    modal.confirm({
      title: 'Approve spec version?',
      content: 'Approving locks this version, sets it effective and supersedes any other approved version with the same product/stage/grade/market.',
      okText: 'Approve', centered: true,
      onOk: async () => { try { await approveMut.mutateAsync(); message.success('Approved'); } catch (e) { message.error(extractErr(e)); } },
    });

  const handleRevise = () =>
    modal.confirm({
      title: 'Revise spec version?',
      content: 'Creates a new DRAFT copy with an incremented version number.',
      okText: 'Revise', centered: true,
      onOk: async () => { try { const created = await reviseMut.mutateAsync(); message.success('Revision created'); onCreated(created.id); } catch (e) { message.error(extractErr(e)); } },
    });

  const handleDelete = () =>
    modal.confirm({
      title: `Delete ${spec?.code}?`, okText: 'Delete', okButtonProps: { danger: true }, centered: true,
      onOk: async () => { try { await deleteMut.mutateAsync(id!); message.success('Deleted'); onDeleted(); } catch (e) { message.error(extractErr(e)); } },
    });

  if (!isCreate && isLoading) {
    return <div className="flex items-center justify-center py-32"><Spin /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          {!isCreate && (
            <>
              <span className="font-mono text-sm text-gray-700">{spec?.code}</span>
              <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${spec ? SPEC_VERSION_STATUS_BADGE[spec.status] : ''}`}>{spec?.status} · v{spec?.version}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editable && <Button type="primary" icon={<Save size={14} />} onClick={handleSave} loading={createMut.isPending || updateMut.isPending}>{isCreate ? 'Create' : 'Save Draft'}</Button>}
          {!isCreate && spec?.status === 'DRAFT' && canApprove && <Button type="primary" icon={<ShieldCheck size={14} />} onClick={handleApprove} loading={approveMut.isPending}>Approve</Button>}
          {!isCreate && spec?.status === 'APPROVED' && canUpdate && <Button icon={<GitBranch size={14} />} onClick={handleRevise} loading={reviseMut.isPending}>Revise</Button>}
          {!isCreate && spec?.status !== 'APPROVED' && canDelete && <Button danger icon={<Trash2 size={14} />} onClick={handleDelete}>Delete</Button>}
        </div>
      </div>

      {/* Header fields */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3 grid grid-cols-1 md:grid-cols-12 gap-3">
        <Field label="Name *" className="md:col-span-6"><Input value={name} disabled={!editable} onChange={(e) => setName(e.target.value)} placeholder="e.g. Paracetamol 500mg — Release Spec" /></Field>
        <Field label="Product" className="md:col-span-6">
          <Select value={productId ?? undefined} disabled={!editable} onChange={(v) => setProductId(v ?? null)} allowClear showSearch optionFilterProp="label" placeholder="—" className="w-full"
            options={products.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))} />
        </Field>
        <Field label="Stage" className="md:col-span-3"><Select value={stage} disabled={!editable} onChange={(v) => setStage(v)} className="w-full" options={STAGE_OPTIONS} /></Field>
        <Field label="Grade" className="md:col-span-3"><Input value={grade} disabled={!editable} onChange={(e) => setGrade(e.target.value)} placeholder="e.g. IP" /></Field>
        <Field label="Market" className="md:col-span-3"><Input value={market} disabled={!editable} onChange={(e) => setMarket(e.target.value)} placeholder="e.g. EU / US" /></Field>
        <Field label="Pharmacopoeia" className="md:col-span-3"><Input value={pharmacopoeia} disabled={!editable} onChange={(e) => setPharmacopoeia(e.target.value)} placeholder="IP / BP / USP" /></Field>
      </div>

      {/* Acceptance criteria grid */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Acceptance Criteria</h3>
          {editable && <Button size="small" icon={<Plus size={13} />} onClick={addLine}>Add line</Button>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-2 w-[16%]">Analyte</th>
                <th className="py-2 px-2 w-[14%]">Name</th>
                <th className="py-2 px-2 w-[8%]">Unit</th>
                <th className="py-2 px-2 w-[8%]">Min</th>
                <th className="py-2 px-2 w-[8%]">Max</th>
                <th className="py-2 px-2 w-[8%]">Target</th>
                <th className="py-2 px-2 w-[12%]">Text criteria</th>
                <th className="py-2 px-2 w-[7%]">Dec</th>
                <th className="py-2 px-2 w-[7%]">Sig</th>
                <th className="py-2 px-2 w-[8%]">Mand.</th>
                {editable && <th className="py-2 pl-2 w-[4%]" />}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b border-gray-50 align-top">
                  <td className="py-1.5 pr-2">
                    <Select size="small" value={l.analyte_id ?? undefined} disabled={!editable} onChange={(v) => onAnalyte(i, v ?? null)} allowClear showSearch optionFilterProp="label" placeholder="—" className="w-full"
                      options={analytes.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` }))} />
                  </td>
                  <td className="py-1.5 px-2"><Input size="small" value={l.name} disabled={!editable} onChange={(e) => setLine(i, { name: e.target.value })} placeholder="e.g. Assay" /></td>
                  <td className="py-1.5 px-2"><Input size="small" value={l.unit ?? ''} disabled={!editable} onChange={(e) => setLine(i, { unit: e.target.value || null })} placeholder="%" /></td>
                  <td className="py-1.5 px-2"><InputNumber size="small" value={l.min_value ?? undefined} disabled={!editable} onChange={(v) => setLine(i, { min_value: v ?? null })} className="w-full" /></td>
                  <td className="py-1.5 px-2"><InputNumber size="small" value={l.max_value ?? undefined} disabled={!editable} onChange={(v) => setLine(i, { max_value: v ?? null })} className="w-full" /></td>
                  <td className="py-1.5 px-2"><InputNumber size="small" value={l.target_value ?? undefined} disabled={!editable} onChange={(v) => setLine(i, { target_value: v ?? null })} className="w-full" /></td>
                  <td className="py-1.5 px-2"><Input size="small" value={l.text_criteria ?? ''} disabled={!editable} onChange={(e) => setLine(i, { text_criteria: e.target.value || null })} placeholder="Complies…" /></td>
                  <td className="py-1.5 px-2"><InputNumber size="small" min={0} max={12} value={l.decimals ?? undefined} disabled={!editable} onChange={(v) => setLine(i, { decimals: v ?? null })} className="w-full" /></td>
                  <td className="py-1.5 px-2"><InputNumber size="small" min={0} max={12} value={l.sig_figs ?? undefined} disabled={!editable} onChange={(v) => setLine(i, { sig_figs: v ?? null })} className="w-full" /></td>
                  <td className="py-1.5 px-2"><Switch size="small" checked={l.mandatory} disabled={!editable} onChange={(v) => setLine(i, { mandatory: v })} /></td>
                  {editable && <td className="py-1.5 pl-2 text-right"><button onClick={() => removeLine(i)} className="text-gray-400 hover:text-red-600"><X size={14} /></button></td>}
                </tr>
              ))}
            </tbody>
          </table>
          {lines.length === 0 && <div className="py-6 text-center text-sm text-gray-400">No acceptance lines yet.</div>}
        </div>

        {defs.length > 0 && (
          <p className="mt-3 text-[11px] text-gray-400">Tip: link lines to test definitions or analytes from master data to drive automated result evaluation.</p>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
