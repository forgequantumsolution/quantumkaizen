import { useState, useEffect } from 'react';
import { App, Button, Drawer, Input, InputNumber, Select, Space, Table } from 'antd';
import { Layers, TestTube, Plus, Search } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useWorklists, useWorklist, useCreateWorklist, useUpdateWorklist, useCloseWorklist, useEnterResults,
  WORKLIST_STATUS_BADGE, WORKLIST_STATUS_LABELS, SAMPLE_TEST_STATUS_BADGE, SAMPLE_TEST_STATUS_LABELS,
  EVALUATION_BADGE, EVALUATION_LABELS, OVERALL_RESULT_BADGE, specLimitLabel,
  type Worklist, type WorklistStatus, type WorklistUpsert, type SampleTest, type Result,
} from '@/lib/api/testing';

function extractErr(err: unknown): string {
  return (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? 'Operation failed';
}

export default function WorklistsPage() {
  const canCreate = useHasPermission('worklist.create');
  const [status, setStatus] = useState<WorklistStatus | undefined>();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useWorklists({ status, search: search || undefined });
  const rows = data?.data ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><Layers size={22} className="text-gray-500" />Worklists</h1>
          <p className="text-xs text-gray-500 mt-0.5">Group sample tests into analyst worklists for batched result entry.</p>
        </div>
        {canCreate && <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>New Worklist</Button>}
      </div>

      <div className="flex items-center justify-end gap-2 mb-3">
        <Select value={status} onChange={setStatus} allowClear placeholder="All statuses" style={{ width: 160 }}
          options={Object.entries(WORKLIST_STATUS_LABELS).map(([v, label]) => ({ value: v, label }))} />
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
          <Input placeholder="Search code / name…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 260 }} />
        </div>
      </div>

      <Table<Worklist>
        size="small" rowKey="id" loading={isLoading} dataSource={rows} pagination={{ pageSize: 20, showSizeChanger: false }}
        onRow={(r) => ({ onClick: () => setDetailId(r.id), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 140, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Name', dataIndex: 'name', ellipsis: true },
          { title: 'Analyst', dataIndex: 'analyst_name', width: 150, render: (v: string | null) => v ?? '—' },
          { title: '# Tests', dataIndex: 'test_count', width: 80 },
          {
            title: 'Status', width: 120,
            render: (_: unknown, r) => <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${WORKLIST_STATUS_BADGE[r.status]}`}>{WORKLIST_STATUS_LABELS[r.status]}</span>,
          },
          { title: 'Created', width: 110, render: (_: unknown, r) => new Date(r.created_at).toLocaleDateString() },
        ]}
      />

      <CreateDrawer open={createOpen} onClose={() => setCreateOpen(false)} onDone={(id) => { setCreateOpen(false); setDetailId(id); }} />
      <DetailDrawer id={detailId} onClose={() => setDetailId(null)} />
    </PageContainer>
  );
}

function CreateDrawer({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: (id: string) => void }) {
  const { message } = App.useApp();
  const mut = useCreateWorklist();
  const [f, setF] = useState<WorklistUpsert>({ name: '' });
  const set = <K extends keyof WorklistUpsert>(k: K, v: WorklistUpsert[K]) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.name?.trim()) return message.error('Name is required');
    try {
      const created = await mut.mutateAsync({ ...f, analyst_name: f.analyst_name || undefined, instrument_id: f.instrument_id || undefined, notes: f.notes || undefined });
      message.success(`Created ${created.code}`);
      setF({ name: '' });
      onDone(created.id);
    } catch (e) { message.error(extractErr(e)); }
  };

  return (
    <Drawer title="New Worklist" open={open} onClose={onClose} width={460} destroyOnClose
      footer={<Space className="flex justify-end"><Button onClick={onClose}>Cancel</Button><Button type="primary" onClick={submit} loading={mut.isPending}>Create</Button></Space>}>
      <div className="space-y-3">
        <F label="Name *"><Input value={f.name} onChange={(e) => set('name', e.target.value)} /></F>
        <F label="Analyst"><Input value={f.analyst_name ?? ''} onChange={(e) => set('analyst_name', e.target.value)} /></F>
        <F label="Instrument"><Input value={f.instrument_id ?? ''} onChange={(e) => set('instrument_id', e.target.value)} /></F>
        <F label="Notes"><Input.TextArea rows={3} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></F>
      </div>
    </Drawer>
  );
}

function DetailDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { message } = App.useApp();
  const canUpdate = useHasPermission('worklist.update');
  const { data: wl, isLoading } = useWorklist(id ?? undefined);
  const updateMut = useUpdateWorklist(id ?? '');
  const closeMut = useCloseWorklist(id ?? '');

  const [suitability, setSuitability] = useState('');
  useEffect(() => { setSuitability(wl?.system_suitability ?? ''); }, [wl?.id, wl?.system_suitability]);

  const saveSuitability = async () => {
    if (!wl) return;
    try {
      await updateMut.mutateAsync({ name: wl.name, analyst_name: wl.analyst_name ?? undefined, instrument_id: wl.instrument_id ?? undefined, notes: wl.notes ?? undefined, system_suitability: suitability || undefined, status: wl.status });
      message.success('Worklist saved');
    } catch (e) { message.error(extractErr(e)); }
  };

  const close = async () => {
    try { await closeMut.mutateAsync(); message.success('Worklist closed'); }
    catch (e) { message.error(extractErr(e)); }
  };

  return (
    <Drawer
      title={wl ? <span className="flex items-center gap-2"><TestTube size={16} className="text-gray-400" /><span className="font-mono text-blue-600">{wl.code}</span><span className="text-gray-900">{wl.name}</span></span> : 'Worklist'}
      open={id != null} onClose={onClose} width={760} destroyOnClose
      footer={wl && canUpdate && wl.status !== 'CLOSED' ? (
        <Space className="flex justify-end"><Button danger onClick={close} loading={closeMut.isPending}>Close Worklist</Button></Space>
      ) : undefined}>
      {isLoading || !wl ? (
        <div className="text-sm text-gray-400 py-6 text-center">Loading…</div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${WORKLIST_STATUS_BADGE[wl.status]}`}>{WORKLIST_STATUS_LABELS[wl.status]}</span>
            {wl.analyst_name && <span className="text-gray-600">Analyst: {wl.analyst_name}</span>}
            {wl.instrument_id && <span className="text-gray-600">· Instrument: {wl.instrument_id}</span>}
            <span className="text-gray-500">· {wl.test_count} test(s)</span>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1">System Suitability</label>
            <Input.TextArea rows={2} value={suitability} onChange={(e) => setSuitability(e.target.value)} disabled={!canUpdate || wl.status === 'CLOSED'} />
            {canUpdate && wl.status !== 'CLOSED' && (
              <div className="mt-2 flex justify-end"><Button size="small" onClick={saveSuitability} loading={updateMut.isPending}>Save</Button></div>
            )}
          </div>

          <div className="space-y-3">
            {(wl.tests ?? []).length === 0 ? (
              <div className="text-sm text-gray-400 py-4 text-center">No tests in this worklist.</div>
            ) : (
              (wl.tests ?? []).map((t) => <WorklistTestCard key={t.id} test={t} editable={canUpdate && wl.status !== 'CLOSED'} />)
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}

function WorklistTestCard({ test, editable }: { test: SampleTest; editable: boolean }) {
  const { message } = App.useApp();
  const enterMut = useEnterResults(test.id);
  const [edits, setEdits] = useState<Record<string, { numeric_value?: number | null; text_value?: string | null }>>({});
  useEffect(() => { setEdits({}); }, [test.id, test.results.length]);

  const isText = (r: Result) => r.min_value == null && r.max_value == null;
  const canEdit = editable && test.status !== 'REVIEWED' && test.status !== 'CANCELLED';

  const save = async () => {
    const results = Object.entries(edits)
      .filter(([, v]) => v.numeric_value !== undefined || v.text_value !== undefined)
      .map(([result_id, v]) => ({ result_id, ...v }));
    if (results.length === 0) return message.info('No changes to save');
    try { await enterMut.mutateAsync({ results }); message.success('Results saved'); setEdits({}); }
    catch (e) { message.error(extractErr(e)); }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {test.sample_number && <span className="font-mono text-[12px] text-blue-600">{test.sample_number}</span>}
          {test.product_name && <span className="text-[11px] text-gray-500">{test.product_name}</span>}
          <span className="text-sm font-medium text-gray-900">{test.test_name}</span>
          <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${SAMPLE_TEST_STATUS_BADGE[test.status]}`}>{SAMPLE_TEST_STATUS_LABELS[test.status]}</span>
          {test.overall_result && (
            <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${OVERALL_RESULT_BADGE[test.overall_result]}`}>{test.overall_result}</span>
          )}
        </div>
        {canEdit && <Button size="small" type="primary" loading={enterMut.isPending} onClick={save}>Save Results</Button>}
      </div>

      <Table<Result>
        size="small" rowKey="id" dataSource={test.results} pagination={false}
        locale={{ emptyText: 'No analytes.' }}
        columns={[
          { title: 'Analyte', dataIndex: 'analyte_name', ellipsis: true },
          { title: 'Spec Limit', width: 120, render: (_: unknown, r) => specLimitLabel(r) },
          { title: 'Unit', dataIndex: 'unit', width: 70, render: (v: string | null) => v ?? '—' },
          {
            title: 'Result', width: 150,
            render: (_: unknown, r) => {
              if (!canEdit) return <span className="text-sm text-gray-900">{r.numeric_value ?? r.text_value ?? '—'}</span>;
              if (isText(r)) {
                const val = edits[r.id]?.text_value ?? r.text_value ?? '';
                return <Input size="small" value={val} onChange={(e) => setEdits((p) => ({ ...p, [r.id]: { text_value: e.target.value } }))} />;
              }
              const val = edits[r.id]?.numeric_value ?? r.numeric_value ?? undefined;
              return <InputNumber size="small" className="w-full" value={val ?? undefined} onChange={(v) => setEdits((p) => ({ ...p, [r.id]: { numeric_value: v ?? null } }))} />;
            },
          },
          {
            title: 'Eval', width: 100,
            render: (_: unknown, r) => <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${EVALUATION_BADGE[r.evaluation]}`}>{EVALUATION_LABELS[r.evaluation]}</span>,
          },
        ]}
      />
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>{children}</div>;
}
