import { useEffect, useState } from 'react';
import { App, Button, Drawer, Input, Select, Spin, Table } from 'antd';
import { Layers, Plus, Search, Save, Trash2, X, ArrowUp, ArrowDown } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useTestPanels, useTestPanel, useCreateTestPanel, useUpdateTestPanel, useDeleteTestPanel,
  useTestDefinitions,
  type TestPanelSummary, type TestPanelUpsert,
} from '@/lib/api/testDefinition';

interface ItemRow { test_definition_id: string }

export default function TestPanelsPage() {
  const { message } = App.useApp();
  const canCreate = useHasPermission('test_panel.create');
  const [search, setSearch] = useState('');
  const { data, isLoading } = useTestPanels({ search: search || undefined });
  const rows = data?.data ?? [];

  const [openId, setOpenId] = useState<string | null | undefined>(undefined);

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Layers size={22} className="text-gray-500" />Test Panels</h1>
          <p className="text-xs text-gray-500 mt-0.5">Reusable bundles of test definitions for fast assignment in testing.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
            <Input placeholder="Search code / name…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 260 }} />
          </div>
          {canCreate && <Button type="primary" icon={<Plus size={14} />} onClick={() => setOpenId(null)}>New Panel</Button>}
        </div>
      </div>

      <Table<TestPanelSummary>
        size="small" rowKey="id" loading={isLoading} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        onRow={(r) => ({ onClick: () => setOpenId(r.id), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 120, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Name', dataIndex: 'name', ellipsis: true },
          { title: 'Tests', dataIndex: 'item_count', width: 90 },
        ]}
      />

      {openId !== undefined && (
        <TestPanelDrawer id={openId} onClose={() => setOpenId(undefined)} onSaved={(id) => setOpenId(id)} message={message} />
      )}
    </PageContainer>
  );
}

function TestPanelDrawer({
  id, onClose, onSaved, message,
}: {
  id: string | null;
  onClose: () => void;
  onSaved: (id: string) => void;
  message: ReturnType<typeof App.useApp>['message'];
}) {
  const { modal } = App.useApp();
  const isCreate = id === null;
  const { data: panel, isLoading } = useTestPanel(id ?? undefined);
  const { data: defsData } = useTestDefinitions();
  const defs = defsData?.data ?? [];

  const canDelete = useHasPermission('test_panel.delete');

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<ItemRow[]>([]);
  const [hydrated, setHydrated] = useState(isCreate);

  useEffect(() => {
    if (!isCreate && panel && !hydrated) {
      setName(panel.name);
      setDescription(panel.description ?? '');
      setItems(panel.items.map((i) => ({ test_definition_id: i.test_definition_id })));
      setHydrated(true);
    }
  }, [isCreate, panel, hydrated]);

  const createMut = useCreateTestPanel();
  const updateMut = useUpdateTestPanel(id ?? '');
  const deleteMut = useDeleteTestPanel();

  const addItem = () => setItems((xs) => [...xs, { test_definition_id: '' }]);
  const setItem = (i: number, val: string) => setItems((xs) => xs.map((x, idx) => (idx === i ? { test_definition_id: val } : x)));
  const removeItem = (i: number) => setItems((xs) => xs.filter((_, idx) => idx !== i));
  const move = (i: number, dir: -1 | 1) => setItems((xs) => {
    const j = i + dir;
    if (j < 0 || j >= xs.length) return xs;
    const next = [...xs];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const buildBody = (): TestPanelUpsert => ({
    name: name.trim(),
    description: description || null,
    items: items.filter((x) => x.test_definition_id).map((x, i) => ({ test_definition_id: x.test_definition_id, sequence: i })),
  });

  const handleSave = async () => {
    if (!name.trim()) return message.error('Panel name is required');
    try {
      if (isCreate) {
        const created = await createMut.mutateAsync(buildBody());
        message.success('Panel created');
        onSaved(created.id);
      } else {
        await updateMut.mutateAsync(buildBody());
        message.success('Saved');
      }
    } catch (e) { message.error(extractErr(e)); }
  };

  const handleDelete = () =>
    modal.confirm({
      title: `Delete ${panel?.code}?`, okText: 'Delete', okButtonProps: { danger: true }, centered: true,
      onOk: async () => { try { await deleteMut.mutateAsync(id!); message.success('Deleted'); onClose(); } catch (e) { message.error(extractErr(e)); } },
    });

  return (
    <Drawer
      open width={640} onClose={onClose} destroyOnClose
      title={
        <div className="flex items-center gap-2">
          {isCreate ? <span className="flex items-center gap-1.5"><Layers size={16} /> New Test Panel</span> : <span className="font-mono text-sm text-gray-700">{panel?.code}</span>}
        </div>
      }
      extra={
        <div className="flex items-center gap-2">
          <Button type="primary" icon={<Save size={14} />} onClick={handleSave} loading={createMut.isPending || updateMut.isPending}>{isCreate ? 'Create' : 'Save'}</Button>
          {!isCreate && canDelete && <Button danger icon={<Trash2 size={14} />} onClick={handleDelete}>Delete</Button>}
        </div>
      }
    >
      {!isCreate && isLoading ? (
        <div className="flex items-center justify-center py-32"><Spin /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 mb-4">
            <Field label="Panel name *"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Finished Product Release" /></Field>
            <Field label="Description"><Input.TextArea value={description} onChange={(e) => setDescription(e.target.value)} autoSize={{ minRows: 1, maxRows: 3 }} /></Field>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Tests</h3>
              <Button size="small" icon={<Plus size={13} />} onClick={addItem}>Add test</Button>
            </div>
            <div className="space-y-2">
              {items.map((it, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-[11px] text-gray-400 w-5 text-right">{i + 1}.</span>
                  <Select value={it.test_definition_id || undefined} onChange={(v) => setItem(i, v)} showSearch optionFilterProp="label" placeholder="Select test…" className="flex-1"
                    options={defs.map((d) => ({ value: d.id, label: `${d.code} — ${d.name}` }))} />
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowUp size={14} /></button>
                  <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="text-gray-400 hover:text-gray-700 disabled:opacity-30"><ArrowDown size={14} /></button>
                  <button onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-600"><X size={14} /></button>
                </div>
              ))}
              {items.length === 0 && <div className="py-6 text-center text-sm text-gray-400">No tests yet.</div>}
            </div>
          </div>
        </>
      )}
    </Drawer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}

function extractErr(err: unknown): string {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Operation failed';
}
