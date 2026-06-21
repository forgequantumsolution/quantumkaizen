import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Modal, Select, Space, Spin, Table, message } from 'antd';
import { Plus, Search } from 'lucide-react';
import {
  useCapas,
  useCreateCapa,
  type Capa,
  type CapaStatus,
  type CapaType,
  type CapaCreate,
} from '@/lib/api/audit';
import { useAdminUsers } from '@/features/admin/users/hooks';
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
  const [status, setStatus] = useState<CapaStatus | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useCapas({
    status: status === 'ALL' ? undefined : status,
    search: search || undefined,
  });
  const rows = data?.data ?? [];

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-900">CAPA</h2>
          <p className="text-xs text-gray-500">
            Corrective &amp; preventive actions raised from non-conformances
          </p>
        </div>
        {canCreate && (
          <Button type="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
            New CAPA
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
          placeholder="Search CAPA # or title"
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
        <Table<Capa>
          size="small"
          rowKey="id"
          dataSource={rows}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          onRow={(r) => ({ onClick: () => nav(`/audit/capa/${r.id}`), className: 'cursor-pointer' })}
          columns={[
            {
              title: 'CAPA #',
              dataIndex: 'capa_number',
              width: 140,
              render: (v: string) => <span className="font-mono text-blue-600">{v}</span>,
            },
            { title: 'Title', dataIndex: 'title', ellipsis: true },
            { title: 'Type', dataIndex: 'type', width: 110, render: (v: string) => v },
            {
              title: 'Status',
              dataIndex: 'status',
              width: 130,
              render: (v: CapaStatus) => <CapaStatusBadge status={v} />,
            },
            {
              title: 'Source NC',
              width: 130,
              render: (_: unknown, r) =>
                r.non_conformance ? (
                  <span className="font-mono text-emerald-700">{r.non_conformance.ncNumber}</span>
                ) : (
                  '—'
                ),
            },
            { title: 'Owner', width: 140, render: (_: unknown, r) => r.owner?.name ?? '—' },
            {
              title: 'Actions',
              dataIndex: 'action_item_count',
              width: 80,
              render: (v: number) => v,
            },
            {
              title: 'Due',
              dataIndex: 'due_date',
              width: 110,
              render: (v: string | null) => (v ? new Date(v).toLocaleDateString() : '—'),
            },
          ]}
        />
      )}

      <CreateCapaModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

function CreateCapaModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const createMut = useCreateCapa();
  const { data: usersData } = useAdminUsers({ pageSize: 200, isActive: true });
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
