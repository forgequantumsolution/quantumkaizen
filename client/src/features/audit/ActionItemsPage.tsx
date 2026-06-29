import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Drawer, Input, Select, Space, Spin, Table, message } from 'antd';
import { Plus, Search, Edit3, Trash2 } from 'lucide-react';
import {
  useActionItems,
  useCreateActionItem,
  useUpdateActionItem,
  useUpdateActionItemStatus,
  useDeleteActionItem,
  type ActionItem,
  type ActionItemPriority,
  type ActionItemStatus,
  type ActionItemUpsert,
} from '@/lib/api/audit';
import { useAdminUsers } from '@/features/admin/users/hooks';
import { useHasPermission } from '@/stores/authStore';
import { ActionPriorityBadge, ActionStatusBadge } from './auditStatusBadge';

const STATUSES: (ActionItemStatus | 'ALL')[] = [
  'ALL',
  'OPEN',
  'IN_PROGRESS',
  'DONE',
  'VERIFIED',
  'CANCELLED',
];
const PRIORITIES: ActionItemPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const ALL_STATUSES: ActionItemStatus[] = ['OPEN', 'IN_PROGRESS', 'DONE', 'VERIFIED', 'CANCELLED'];

export default function ActionItemsPage() {
  const canCreate = useHasPermission('action_item.create');
  const canUpdate = useHasPermission('action_item.update');
  const canDelete = useHasPermission('action_item.delete');

  const [status, setStatus] = useState<ActionItemStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ActionItem | null>(null);

  const { data, isLoading } = useActionItems({
    status: status === 'ALL' ? undefined : status,
    search: search || undefined,
  });
  const rows = data?.data ?? [];

  const statusMut = useUpdateActionItemStatus();
  const deleteMut = useDeleteActionItem();

  const handleDelete = async (a: ActionItem) => {
    if (!confirm(`Delete ${a.action_number}?`)) return;
    try {
      await deleteMut.mutateAsync(a.id);
      message.success('Action item deleted');
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Action Items</h2>
          <p className="text-xs text-gray-500">Assignable tasks across CAPAs, non-conformances and findings</p>
        </div>
        {canCreate && (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => {
              setEditing(null);
              setDrawerOpen(true);
            }}
          >
            New Action
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                status === s
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {s.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <Input
          allowClear
          prefix={<Search size={14} className="text-gray-400" />}
          placeholder="Search action # or title"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <Spin />
        </div>
      ) : (
        <Table<ActionItem>
          size="small"
          rowKey="id"
          dataSource={rows}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          columns={[
            {
              title: 'Action #',
              dataIndex: 'action_number',
              width: 120,
              render: (v: string) => <span className="font-mono text-blue-600">{v}</span>,
            },
            { title: 'Title', dataIndex: 'title', ellipsis: true },
            { title: 'Owner', width: 130, render: (_: unknown, r) => r.owner?.name ?? '—' },
            {
              title: 'Priority',
              dataIndex: 'priority',
              width: 100,
              render: (v: ActionItemPriority) => <ActionPriorityBadge priority={v} />,
            },
            {
              title: 'Source',
              width: 130,
              render: (_: unknown, r) =>
                r.capa ? (
                  <Link to={`/audit/capa/${r.capa.id}`} className="font-mono text-blue-600 hover:underline">
                    {r.capa.capaNumber}
                  </Link>
                ) : r.non_conformance ? (
                  <span className="font-mono text-emerald-700">{r.non_conformance.ncNumber}</span>
                ) : r.finding ? (
                  <span className="font-mono text-gray-600">{r.finding.findingNumber}</span>
                ) : (
                  '—'
                ),
            },
            {
              title: 'Due',
              dataIndex: 'due_date',
              width: 110,
              render: (v: string | null) => (v ? new Date(v).toLocaleDateString() : '—'),
            },
            {
              title: 'Status',
              dataIndex: 'status',
              width: 150,
              render: (v: ActionItemStatus, r) =>
                canUpdate ? (
                  <Select
                    size="small"
                    value={v}
                    onChange={(s) => statusMut.mutate({ id: r.id, status: s })}
                    options={ALL_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
                    className="w-full"
                  />
                ) : (
                  <ActionStatusBadge status={v} />
                ),
            },
            {
              title: '',
              width: 80,
              render: (_: unknown, r) => (
                <Space size={4}>
                  {canUpdate && (
                    <Button
                      size="small"
                      icon={<Edit3 size={12} />}
                      onClick={() => {
                        setEditing(r);
                        setDrawerOpen(true);
                      }}
                    />
                  )}
                  {canDelete && (
                    <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => handleDelete(r)} />
                  )}
                </Space>
              ),
            },
          ]}
        />
      )}

      <ActionItemDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} record={editing} />
    </>
  );
}

function ActionItemDrawer({
  open,
  onClose,
  record,
}: {
  open: boolean;
  onClose: () => void;
  record: ActionItem | null;
}) {
  const createMut = useCreateActionItem();
  const updateMut = useUpdateActionItem(record?.id ?? '');
  const { data: usersData } = useAdminUsers({ pageSize: 200, isActive: true });
  const users = usersData?.items ?? [];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<ActionItemPriority>('MEDIUM');
  const [ownerId, setOwnerId] = useState<string | undefined>();
  const [dueDate, setDueDate] = useState('');

  useEffect(() => {
    if (open) {
      setTitle(record?.title ?? '');
      setDescription(record?.description ?? '');
      setPriority(record?.priority ?? 'MEDIUM');
      setOwnerId(record?.owner?.id);
      setDueDate(record?.due_date ? record.due_date.slice(0, 10) : '');
    }
  }, [open, record]);

  const submit = async () => {
    if (!title.trim()) {
      message.error('Title is required');
      return;
    }
    const body: ActionItemUpsert = {
      title: title.trim(),
      description: description || null,
      priority,
      owner_id: ownerId ?? null,
      due_date: dueDate || null,
      // Preserve any existing parent link when editing.
      capa_id: record?.capa?.id ?? null,
      non_conformance_id: record?.non_conformance?.id ?? null,
      finding_id: record?.finding?.id ?? null,
    };
    try {
      if (record) {
        await updateMut.mutateAsync(body);
        message.success('Action item updated');
      } else {
        await createMut.mutateAsync(body);
        message.success('Action item created');
      }
      onClose();
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <Drawer
      title={record ? `Edit ${record.action_number}` : 'New Action Item'}
      open={open}
      onClose={onClose}
      width={460}
      destroyOnClose
      footer={
        <Space className="flex justify-end">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={submit} loading={createMut.isPending || updateMut.isPending}>
            {record ? 'Save' : 'Create'}
          </Button>
        </Space>
      }
    >
      <div className="space-y-3">
        <Labeled label="Title *">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Labeled>
        <Labeled label="Priority">
          <Select
            value={priority}
            onChange={setPriority}
            options={PRIORITIES.map((p) => ({ value: p, label: p }))}
            className="w-full"
          />
        </Labeled>
        <Labeled label="Owner">
          <Select
            value={ownerId}
            onChange={setOwnerId}
            allowClear
            showSearch
            optionFilterProp="label"
            options={users.map((u) => ({ value: u.id, label: u.name }))}
            className="w-full"
          />
        </Labeled>
        <Labeled label="Due date">
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Labeled>
        <Labeled label="Description">
          <Input.TextArea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Labeled>
      </div>
    </Drawer>
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
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
      ?.message ?? 'Operation failed'
  );
}
