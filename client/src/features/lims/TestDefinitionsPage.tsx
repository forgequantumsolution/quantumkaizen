import { useEffect, useState } from 'react';
import { App, Button, Drawer, Input, InputNumber, Select, Spin, Table } from 'antd';
import { FlaskConical, Plus, Search, Save, ShieldCheck, Trash2, X } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import UnitSelect from './UnitSelect';
import { useHasPermission } from '@/stores/authStore';
import {
  useTestDefinitions, useTestDefinition, useCreateTestDefinition, useUpdateTestDefinition,
  useApproveTestDefinition, useDeleteTestDefinition, useAnalytes, useMethods,
  TEST_STATUS_BADGE, TEST_DATA_TYPE_OPTIONS,
  type TestStatus, type TestDefinitionSummary, type TestAnalyte, type TestDefinitionUpsert,
} from '@/lib/api/testDefinition';

type AnalyteRow = Omit<TestAnalyte, 'id'>;
const emptyAnalyte = (sequence: number): AnalyteRow => ({
  analyte_id: null, name: '', unit: null, data_type: 'NUMERIC', decimals: null, calculation: null, sequence,
});

export default function TestDefinitionsPage() {
  const { message } = App.useApp();
  const canCreate = useHasPermission('test_definition.create');
  const [status, setStatus] = useState<TestStatus | undefined>();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useTestDefinitions({ status, search: search || undefined });
  const rows = data?.data ?? [];

  const [openId, setOpenId] = useState<string | null | undefined>(undefined); // undefined = closed, null = create

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><FlaskConical size={22} className="text-gray-500" />Test Definitions</h1>
          <p className="text-xs text-gray-500 mt-0.5">Reusable analytical tests with an ordered set of measured analytes.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={status} onChange={setStatus} allowClear placeholder="All statuses" style={{ width: 150 }}
            options={[{ value: 'DRAFT', label: 'Draft' }, { value: 'APPROVED', label: 'Approved' }, { value: 'RETIRED', label: 'Retired' }]} />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <Input placeholder="Search code / name / technique…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 260 }} />
          </div>
          {canCreate && <Button type="primary" icon={<Plus size={14} />} onClick={() => setOpenId(null)}>New Test</Button>}
        </div>
      </div>

      <Table<TestDefinitionSummary>
        size="small" rowKey="id" loading={isLoading} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        onRow={(r) => ({ onClick: () => setOpenId(r.id), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 120, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Name', dataIndex: 'name', width: 320, ellipsis: true },
          { title: 'Technique', dataIndex: 'technique', width: 200, render: (v: string | null) => v ?? '—' },
          { title: 'Analytes', dataIndex: 'analyte_count', width: 120 },
          {
            title: 'Status', width: 110,
            render: (_: unknown, r) => <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${TEST_STATUS_BADGE[r.status]}`}>{r.status}</span>,
          },
        ]}
      />

      {openId !== undefined && (
        <TestDefinitionDrawer id={openId} onClose={() => setOpenId(undefined)} onSaved={(id) => setOpenId(id)} message={message} />
      )}
    </PageContainer>
  );
}

function TestDefinitionDrawer({
  id, onClose, onSaved, message,
}: {
  id: string | null;
  onClose: () => void;
  onSaved: (id: string) => void;
  message: ReturnType<typeof App.useApp>['message'];
}) {
  const { modal } = App.useApp();
  const isCreate = id === null;
  const { data: def, isLoading } = useTestDefinition(id ?? undefined);
  const { data: methodsData } = useMethods();
  const { data: analytesData } = useAnalytes();
  const methods = methodsData?.data ?? [];
  const analytes = analytesData?.data ?? [];

  const canApprove = useHasPermission('test_definition.approve');
  const canDelete = useHasPermission('test_definition.delete');

  const [name, setName] = useState('');
  const [technique, setTechnique] = useState('');
  const [methodId, setMethodId] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [analyteRows, setAnalyteRows] = useState<AnalyteRow[]>([emptyAnalyte(0)]);
  const [hydrated, setHydrated] = useState(isCreate);

  useEffect(() => {
    if (!isCreate && def && !hydrated) {
      setName(def.name);
      setTechnique(def.technique ?? '');
      setMethodId(def.method_id ?? null);
      setDescription(def.description ?? '');
      setAnalyteRows(def.analytes.length ? def.analytes.map(({ id: _id, ...a }) => a) : [emptyAnalyte(0)]);
      setHydrated(true);
    }
  }, [isCreate, def, hydrated]);

  const createMut = useCreateTestDefinition();
  const updateMut = useUpdateTestDefinition(id ?? '');
  const approveMut = useApproveTestDefinition(id ?? '');
  const deleteMut = useDeleteTestDefinition();

  const editable = isCreate || def?.status === 'DRAFT';

  const setRow = (i: number, patch: Partial<AnalyteRow>) =>
    setAnalyteRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => setAnalyteRows((rs) => [...rs, emptyAnalyte(rs.length)]);
  const removeRow = (i: number) => setAnalyteRows((rs) => rs.filter((_, idx) => idx !== i).map((r, idx) => ({ ...r, sequence: idx })));

  const pickAnalyte = (i: number, analyteId: string | null) => {
    const a = analytes.find((x) => x.id === analyteId);
    setRow(i, {
      analyte_id: analyteId,
      ...(a ? { name: a.name, unit: a.default_unit } : {}),
    });
  };

  const buildBody = (): TestDefinitionUpsert => ({
    name: name.trim(),
    technique: technique || null,
    method_id: methodId || null,
    description: description || null,
    analytes: analyteRows.filter((a) => a.name.trim()).map((a, i) => ({ ...a, sequence: i })),
  });

  const handleSave = async () => {
    if (!name.trim()) return message.error('Test name is required');
    try {
      if (isCreate) {
        const created = await createMut.mutateAsync(buildBody());
        message.success('Test created');
        onSaved(created.id);
      } else {
        await updateMut.mutateAsync(buildBody());
        message.success('Saved');
      }
    } catch (e) { message.error(extractErr(e)); }
  };

  const handleApprove = () =>
    modal.confirm({
      title: 'Approve test definition?',
      content: 'Approved tests are locked and cannot be edited.',
      okText: 'Approve', centered: true,
      onOk: async () => { try { await approveMut.mutateAsync(); message.success('Approved'); } catch (e) { message.error(extractErr(e)); } },
    });

  const handleDelete = () =>
    modal.confirm({
      title: `Delete ${def?.code}?`, okText: 'Delete', okButtonProps: { danger: true }, centered: true,
      onOk: async () => { try { await deleteMut.mutateAsync(id!); message.success('Deleted'); onClose(); } catch (e) { message.error(extractErr(e)); } },
    });

  return (
    <Drawer
      open width={920} onClose={onClose} destroyOnClose
      title={
        <div className="flex items-center gap-2">
          {isCreate ? <span className="flex items-center gap-1.5"><FlaskConical size={16} /> New Test Definition</span> : (
            <>
              <span className="font-mono text-sm text-gray-700">{def?.code}</span>
              <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded border ${def ? TEST_STATUS_BADGE[def.status] : ''}`}>{def?.status} · v{def?.version}</span>
            </>
          )}
        </div>
      }
      extra={
        <div className="flex items-center gap-2">
          {editable && <Button type="primary" icon={<Save size={14} />} onClick={handleSave} loading={createMut.isPending || updateMut.isPending}>{isCreate ? 'Create' : 'Save'}</Button>}
          {!isCreate && def?.status === 'DRAFT' && canApprove && <Button type="primary" icon={<ShieldCheck size={14} />} onClick={handleApprove} loading={approveMut.isPending}>Approve</Button>}
          {!isCreate && def?.status === 'DRAFT' && canDelete && <Button danger icon={<Trash2 size={14} />} onClick={handleDelete}>Delete</Button>}
        </div>
      }
    >
      {!isCreate && isLoading ? (
        <div className="flex items-center justify-center py-32"><Spin /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-4">
            <Field label="Test name *" className="md:col-span-6"><Input value={name} disabled={!editable} onChange={(e) => setName(e.target.value)} placeholder="e.g. Assay by HPLC" /></Field>
            <Field label="Technique" className="md:col-span-6"><Input value={technique} disabled={!editable} onChange={(e) => setTechnique(e.target.value)} placeholder="e.g. HPLC" /></Field>
            <Field label="Method" className="md:col-span-6">
              <Select value={methodId ?? undefined} disabled={!editable} onChange={(v) => setMethodId(v ?? null)} allowClear showSearch optionFilterProp="label" placeholder="—" className="w-full"
                options={methods.map((m) => ({ value: m.id, label: `${m.code} — ${m.name}` }))} />
            </Field>
            <Field label="Description" className="md:col-span-12"><Input.TextArea value={description} disabled={!editable} onChange={(e) => setDescription(e.target.value)} autoSize={{ minRows: 1, maxRows: 3 }} /></Field>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Analytes</h3>
              {editable && <Button size="small" icon={<Plus size={13} />} onClick={addRow}>Add analyte</Button>}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-gray-500 border-b border-gray-100">
                    <th className="py-2 pr-2 w-[20%]">Name</th>
                    <th className="py-2 px-2 w-[18%]">Analyte</th>
                    <th className="py-2 px-2 w-[10%]">Unit</th>
                    <th className="py-2 px-2 w-[14%]">Data type</th>
                    <th className="py-2 px-2 w-[10%]">Decimals</th>
                    <th className="py-2 px-2 w-[20%]">Calculation</th>
                    {editable && <th className="py-2 pl-2 w-[4%]" />}
                  </tr>
                </thead>
                <tbody>
                  {analyteRows.map((a, i) => (
                    <tr key={i} className="border-b border-gray-50 align-top">
                      <td className="py-1.5 pr-2"><Input size="small" value={a.name} disabled={!editable} onChange={(e) => setRow(i, { name: e.target.value })} placeholder="e.g. Assay" /></td>
                      <td className="py-1.5 px-2">
                        <Select size="small" value={a.analyte_id ?? undefined} disabled={!editable} onChange={(v) => pickAnalyte(i, v ?? null)} allowClear showSearch optionFilterProp="label" placeholder="—" className="w-full"
                          options={analytes.map((x) => ({ value: x.id, label: `${x.code} — ${x.name}` }))} />
                      </td>
                      <td className="py-1.5 px-2"><UnitSelect size="small" value={a.unit} disabled={!editable} onChange={(v) => setRow(i, { unit: v })} placeholder="%" /></td>
                      <td className="py-1.5 px-2">
                        <Select size="small" value={a.data_type} disabled={!editable} onChange={(v) => setRow(i, { data_type: v })} className="w-full" options={TEST_DATA_TYPE_OPTIONS} />
                      </td>
                      <td className="py-1.5 px-2"><InputNumber size="small" value={a.decimals ?? undefined} disabled={!editable} min={0} max={10} onChange={(v) => setRow(i, { decimals: v ?? null })} className="w-full" /></td>
                      <td className="py-1.5 px-2"><Input size="small" value={a.calculation ?? ''} disabled={!editable} onChange={(e) => setRow(i, { calculation: e.target.value || null })} placeholder="formula…" /></td>
                      {editable && <td className="py-1.5 pl-2 text-right"><button onClick={() => removeRow(i)} className="text-gray-400 hover:text-red-600"><X size={14} /></button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
              {analyteRows.length === 0 && <div className="py-6 text-center text-sm text-gray-400">No analytes yet.</div>}
            </div>
          </div>
        </>
      )}
    </Drawer>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}

function extractErr(err: unknown): string {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Operation failed';
}
