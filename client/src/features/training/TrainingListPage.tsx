import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { App, Button, Input, Modal, Select, Switch, Table } from 'antd';
import { GraduationCap, Plus, Search, CheckCircle2 } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useTrainingItems,
  useMyTraining,
  useCreateTrainingItem,
  useCompleteTraining,
  type TrainingItemSummary,
} from '@/lib/api/training';
import { useDocuments } from '@/lib/api/dms';
import { useRoleDirectory } from '@/features/admin/roles/hooks';

export default function TrainingListPage() {
  const nav = useNavigate();
  const { message } = App.useApp();
  const canWrite = useHasPermission('training.write');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useTrainingItems({ search: search || undefined });
  const { data: my } = useMyTraining();
  const rows = data?.data ?? [];

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <GraduationCap size={22} className="text-gray-500" />
            Training &amp; Competency
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Assign training (often a controlled SOP) and track read-and-understood completion.
          </p>
        </div>
        {canWrite && (
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
            New Training
          </Button>
        )}
      </div>

      {/* My training */}
      {my && my.items.length > 0 && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-900">My Training</h3>
            {my.pending > 0 && (
              <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                {my.pending} pending
              </span>
            )}
          </div>
          <ul className="divide-y divide-gray-100">
            {my.items.map((it) => (
              <MyRow key={it.assignment_id} item={it} onOpen={() => nav(`/training/${it.training_item_id}`)} onDone={() => message.success('Marked complete')} />
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-end mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none z-10" />
          <Input placeholder="Search code / title…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" style={{ width: 260 }} />
        </div>
      </div>

      <Table<TrainingItemSummary>
        size="small"
        rowKey="id"
        loading={isLoading}
        dataSource={rows}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        onRow={(r) => ({ onClick: () => nav(`/training/${r.id}`), style: { cursor: 'pointer' } })}
        columns={[
          { title: 'Code', dataIndex: 'code', width: 150, render: (v: string) => <span className="font-mono text-blue-600">{v}</span> },
          { title: 'Title', dataIndex: 'title', ellipsis: true },
          {
            title: 'Completion',
            width: 160,
            render: (_: unknown, r) => {
              const pct = r.assigned_count ? Math.round((r.completed_count / r.assigned_count) * 100) : 0;
              return (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-20 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[11px] text-gray-500">{r.completed_count}/{r.assigned_count}</span>
                </div>
              );
            },
          },
          { title: 'Active', dataIndex: 'is_active', width: 80, render: (v: boolean) => (v ? 'Yes' : 'No') },
        ]}
      />

      <CreateTrainingModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </PageContainer>
  );
}

function MyRow({ item, onOpen, onDone }: { item: { assignment_id: string; training_item_id: string; code: string; title: string; status: string; due_date: string | null }; onOpen: () => void; onDone: () => void }) {
  const { message } = App.useApp();
  const completeMut = useCompleteTraining(item.training_item_id);
  return (
    <li className="flex items-center gap-3 py-2.5 text-sm">
      <button onClick={onOpen} className="font-mono text-blue-600 w-32 text-left hover:underline">{item.code}</button>
      <span className="flex-1 text-gray-800 truncate">{item.title}</span>
      {item.status === 'COMPLETED' ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700"><CheckCircle2 size={13} /> Completed</span>
      ) : (
        <Button size="small" type="primary" loading={completeMut.isPending} onClick={async () => { try { await completeMut.mutateAsync(); onDone(); } catch { message.error('Failed'); } }}>
          Mark complete
        </Button>
      )}
    </li>
  );
}

function CreateTrainingModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { message } = App.useApp();
  const createMut = useCreateTrainingItem();
  const { data: docs } = useDocuments({ status: 'EFFECTIVE', page_size: 200 });
  const { data: rolesResp } = useRoleDirectory();
  const roles = rolesResp?.items ?? [];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [documentId, setDocumentId] = useState<string | undefined>();
  const [roleId, setRoleId] = useState<string | undefined>();
  const [isActive, setIsActive] = useState(true);

  const reset = () => { setTitle(''); setDescription(''); setDocumentId(undefined); setRoleId(undefined); setIsActive(true); };

  const submit = async () => {
    if (!title.trim()) return message.error('Title is required');
    try {
      await createMut.mutateAsync({ title: title.trim(), description: description || null, document_id: documentId ?? null, role_id: roleId ?? null, is_active: isActive });
      message.success('Training created');
      reset();
      onClose();
    } catch {
      message.error('Failed to create');
    }
  };

  return (
    <Modal title="New Training" open={open} onCancel={() => { reset(); onClose(); }} onOk={submit} okText="Create" okButtonProps={{ loading: createMut.isPending }} centered>
      <div className="space-y-3">
        <FieldLabel label="Title *"><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. SOP-001 Sampling — read & understand" /></FieldLabel>
        <FieldLabel label="Description"><Input.TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></FieldLabel>
        <FieldLabel label="Linked document (auto-completes on read-ack)">
          <Select value={documentId} onChange={setDocumentId} allowClear showSearch optionFilterProp="label" placeholder="Optional — link a controlled document" className="w-full"
            options={(docs?.data ?? []).map((d) => ({ value: d.id, label: `${d.doc_number} — ${d.title}` }))} />
        </FieldLabel>
        <FieldLabel label="Required for role">
          <Select value={roleId} onChange={setRoleId} allowClear showSearch optionFilterProp="label" placeholder="Optional — assign to all users in a role" className="w-full"
            options={roles.map((r) => ({ value: r.id, label: r.name }))} />
        </FieldLabel>
        <div className="flex items-center gap-2"><Switch checked={isActive} onChange={setIsActive} /><span className="text-sm text-gray-700">Active</span></div>
      </div>
    </Modal>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
