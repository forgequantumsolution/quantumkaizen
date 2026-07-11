import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Modal, Select, Tooltip, message } from 'antd';
import { Plus, Search, SlidersHorizontal, Check, Eye, Trash2 } from 'lucide-react';
import { DataTable, type Column } from '@/components/ui';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const PAGE_SIZE = 10;
import {
  useCapas,
  useCreateCapa,
  useDeleteCapa,
  type Capa,
  type CapaStatus,
  type CapaType,
  type CapaCreate,
} from '@/lib/api/audit';
import { useUserDirectory } from '@/features/admin/users/hooks';
import { useDepartments } from '@/features/admin/departments/hooks';
import { useHasPermission } from '@/stores/authStore';
import { CapaStatusBadge } from './auditStatusBadge';

const STATUSES: (CapaStatus | 'ALL')[] = [
  'ALL',
  'OPEN',
  'INVESTIGATION',
  'PLAN',
  'IMPLEMENTATION',
  'VERIFICATION',
  'CLOSED',
  'CANCELLED',
];
const TYPES: CapaType[] = ['CORRECTIVE', 'PREVENTIVE', 'BOTH'];

export default function CapaListPage() {
  const nav = useNavigate();
  const canCreate = useHasPermission('capa.create');
  const canDelete = useHasPermission('capa.delete');
  const deleteMut = useDeleteCapa();
  const [status, setStatus] = useState<CapaStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const activeStatusLabel = status === 'ALL' ? 'All' : status.replace(/_/g, ' ');

  const debouncedSearch = useDebouncedValue(search, 450);
  useEffect(() => setPage(1), [debouncedSearch, status]);

  const { data, isLoading } = useCapas({
    page,
    page_size: PAGE_SIZE,
    status: status === 'ALL' ? undefined : status,
    search: debouncedSearch || undefined,
  });
  const rows = data?.data ?? [];
  const totalItems = data?.pagination?.total_items ?? rows.length;

  const handleDelete = (capa: Capa) => {
    Modal.confirm({
      title: `Delete ${capa.capa_number}?`,
      content: (
        <span>
          This permanently removes the CAPA and its action items. This cannot be undone.
        </span>
      ),
      okText: 'Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await deleteMut.mutateAsync(capa.id);
          message.success(`${capa.capa_number} deleted`);
        } catch (err) {
          message.error(extractErr(err));
          throw err; // keep the modal open on failure
        }
      },
    });
  };

  const columns = useMemo<Column<Capa>[]>(
    () => [
      ...CAPA_BASE_COLUMNS,
      {
        key: 'actions',
        header: 'Actions',
        sortable: false,
        // Pinned to the right edge so it's always visible while the wide table
        // scrolls horizontally.
        className:
          'sticky right-0 bg-white text-right border-l border-gray-100 ' +
          'shadow-[-8px_0_10px_-8px_rgba(0,0,0,0.12)]',
        render: (r) => (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Tooltip title="View">
              <Button
                type="text"
                size="small"
                icon={<Eye size={15} />}
                onClick={() => nav(`/audit/capa/${r.id}`)}
              />
            </Tooltip>
            {canDelete && (
              <Tooltip title="Delete">
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<Trash2 size={15} />}
                  onClick={() => handleDelete(r)}
                />
              </Tooltip>
            )}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canDelete],
  );

  return (
    <>
      {/* Single toolbar row: title + search + filter + create. */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">CAPA</h2>
          <p className="text-xs text-gray-500">
            Corrective &amp; preventive actions raised from non-conformances
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            allowClear
            prefix={<Search size={14} className="text-gray-400" />}
            placeholder="Search CAPA # or title"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
          />
          <Button icon={<SlidersHorizontal size={14} />} onClick={() => setFilterOpen(true)}>
            Filter
            {status !== 'ALL' && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-gold-100 text-gold-700 text-[10px] font-semibold px-1.5 py-0.5 capitalize">
                {activeStatusLabel.toLowerCase()}
              </span>
            )}
          </Button>
          {canCreate && (
            <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
              New CAPA
            </Button>
          )}
        </div>
      </div>

      {/* Filter modal — status selection. */}
      <Modal
        open={filterOpen}
        onCancel={() => setFilterOpen(false)}
        title="Filter CAPAs"
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
        <DataTable<Capa>
          data={rows}
          isLoading={isLoading}
          emptyMessage="No CAPAs found"
          onRowClick={(r) => nav(`/audit/capa/${r.id}`)}
          columns={columns}
          serverPagination={{
            page,
            pageSize: PAGE_SIZE,
            totalItems,
            onPageChange: setPage,
          }}
        />
      </div>

      <CreateCapaModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

const CAPA_BASE_COLUMNS: Column<Capa>[] = [
  {
    key: 'capa_number',
    header: 'CAPA #',
    render: (r) => <span className="font-mono text-blue-600">{r.capa_number}</span>,
  },
  {
    key: 'title',
    header: 'Title',
    className: 'max-w-[360px]',
    render: (r) => (
      <span className="block truncate" title={r.title}>
        {r.title}
      </span>
    ),
  },
  { key: 'type', header: 'Type' },
  {
    key: 'status',
    header: 'Status',
    sortable: false,
    render: (r) => <CapaStatusBadge status={r.status as CapaStatus} />,
  },
  {
    key: 'source_nc',
    header: 'Source NC',
    sortable: false,
    render: (r) =>
      r.non_conformance ? (
        <span className="font-mono text-emerald-700">{r.non_conformance.ncNumber}</span>
      ) : (
        '—'
      ),
  },
  { key: 'owner', header: 'Owner', sortable: false, render: (r) => r.owner?.name ?? '—' },
  {
    key: 'action_item_count',
    header: 'Items',
    render: (r) => r.action_item_count,
  },
  {
    key: 'due_date',
    header: 'Due',
    render: (r) => (r.due_date ? new Date(r.due_date).toLocaleDateString() : '—'),
  },
];

function CreateCapaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const createMut = useCreateCapa();
  const { data: usersData } = useUserDirectory();
  const { data: deptsResp } = useDepartments({ pageSize: 200 });
  const users = usersData?.items ?? [];
  const departments = deptsResp?.items ?? [];

  const [title, setTitle] = useState('');
  const [type, setType] = useState<CapaType>('CORRECTIVE');
  const [ownerId, setOwnerId] = useState<string | undefined>();
  const [departmentId, setDepartmentId] = useState<string | undefined>();

  const submit = async () => {
    if (!title.trim()) {
      message.error('Title is required');
      return;
    }
    const body: CapaCreate = {
      title: title.trim(),
      type,
      owner_id: ownerId ?? null,
      department_id: departmentId ?? null,
    };
    try {
      const res = await createMut.mutateAsync(body);
      message.success('CAPA created');
      onClose();
      setTitle('');
      const id = (res as { data?: { id?: string } })?.data?.id;
      if (id) nav(`/audit/capa/${id}`);
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <Modal
      title="New CAPA"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Create"
      okButtonProps={{ loading: createMut.isPending }}
    >
      <div className="space-y-3">
        <Field label="Title *">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="CAPA title" />
        </Field>
        <Field label="Type">
          <Select
            value={type}
            onChange={setType}
            options={TYPES.map((t) => ({ value: t, label: t }))}
            className="w-full"
          />
        </Field>
        <Field label="Owner">
          <Select
            value={ownerId}
            onChange={setOwnerId}
            allowClear
            showSearch
            optionFilterProp="label"
            options={users.map((u) => ({ value: u.id, label: u.name }))}
            className="w-full"
            placeholder="Assign owner"
          />
        </Field>
        <Field label="Department">
          <Select
            value={departmentId}
            onChange={setDepartmentId}
            allowClear
            showSearch
            optionFilterProp="label"
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
            className="w-full"
            placeholder="Responsible department"
          />
        </Field>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
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
