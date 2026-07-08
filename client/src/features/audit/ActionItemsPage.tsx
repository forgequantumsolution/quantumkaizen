import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Drawer, Input, Modal, Select, Space, message } from 'antd';
import { Plus, Search, Edit3, Trash2, SlidersHorizontal, Check } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const PAGE_SIZE = 10;
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
import { useUserDirectory } from '@/features/admin/users/hooks';
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
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);

  const debouncedSearch = useDebouncedValue(search, 450);
  useEffect(() => setPage(1), [debouncedSearch, status]);

  const { data, isLoading } = useActionItems({
    page,
    page_size: PAGE_SIZE,
    status: status === 'ALL' ? undefined : status,
    search: debouncedSearch || undefined,
  });
  const rows = data?.data ?? [];
  const totalItems = data?.pagination?.total_items ?? rows.length;

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
      {/* Single toolbar row: title + search + filter + create. */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">Action Items</h2>
          <p className="text-xs text-gray-500">Assignable tasks across CAPAs, non-conformances and findings</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            allowClear
            prefix={<Search size={14} className="text-gray-400" />}
            placeholder="Search action # or title"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
          />
          <Button icon={<SlidersHorizontal size={14} />} onClick={() => setFilterOpen(true)}>
            Filter
            {status !== 'ALL' && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-gold-100 text-gold-700 text-[10px] font-semibold px-1.5 py-0.5 capitalize">
                {status.replace(/_/g, ' ').toLowerCase()}
              </span>
            )}
          </Button>
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
      </div>

      {/* Filter modal — status selection. */}
      <Modal
        open={filterOpen}
        onCancel={() => setFilterOpen(false)}
        title="Filter action items"
        footer={
          <div className="flex items-center justify-between">
            <Button type="text" onClick={() => setStatus('ALL')} disabled={status === 'ALL'}>
              Clear
            </Button>
            <Button type="primary" onClick={() => setFilterOpen(false)}>
              Done
            </Button>
          </div>
        }
      >
        <div className="py-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">
            Status
          </label>
          <div className="grid grid-cols-2 gap-2">
            {STATUSES.map((s) => {
              const active = status === s;
              return (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    active
                      ? 'border-gold-400 bg-gold-50 text-gold-800'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span>{s === 'ALL' ? 'All' : s.replace(/_/g, ' ').toLowerCase()}</span>
                  {active && <Check size={15} className="text-gold-600 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <DataTable<ActionItem>
          data={rows}
          isLoading={isLoading}
          emptyMessage="No action items found"
          serverPagination={{
            page,
            pageSize: PAGE_SIZE,
            totalItems,
            onPageChange: setPage,
          }}
          columns={[
            {
              key: 'action_number',
              header: 'Action #',
              render: (r) => <span className="font-mono text-blue-600">{r.action_number}</span>,
            },
            { key: 'title', header: 'Title' },
            { key: 'owner', header: 'Owner', sortable: false, render: (r) => r.owner?.name ?? '—' },
            {
              key: 'priority',
              header: 'Priority',
              sortable: false,
              render: (r) => <ActionPriorityBadge priority={r.priority as ActionItemPriority} />,
            },
            {
              key: 'source',
              header: 'Source',
              sortable: false,
              render: (r) =>
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
              key: 'due_date',
              header: 'Due',
              render: (r) => (r.due_date ? new Date(r.due_date).toLocaleDateString() : '—'),
            },
            {
              key: 'status',
              header: 'Status',
              sortable: false,
              render: (r) =>
                canUpdate ? (
                  <Select
                    size="small"
                    value={r.status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(s) => statusMut.mutate({ id: r.id, status: s })}
                    options={ALL_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))}
                    className="w-full min-w-[140px]"
                  />
                ) : (
                  <ActionStatusBadge status={r.status as ActionItemStatus} />
                ),
            },
            {
              key: 'actions',
              header: '',
              sortable: false,
              render: (r) => (
                <Space size={4}>
                  {canUpdate && (
                    <Button
                      size="small"
                      icon={<Edit3 size={12} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditing(r);
                        setDrawerOpen(true);
                      }}
                    />
                  )}
                  {canDelete && (
                    <Button
                      size="small"
                      danger
                      icon={<Trash2 size={12} />}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(r);
                      }}
                    />
                  )}
                </Space>
              ),
            },
          ]}
        />
      </div>

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
  const { data: usersData } = useUserDirectory();
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
