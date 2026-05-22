import { useMemo, useState } from 'react';
import {
  Button as AntButton,
  Modal as AntModal,
  Input as AntInput,
  InputNumber as AntInputNumber,
  Table as AntTable,
  Tag as AntTag,
  Form as AntForm,
  Empty,
  type TableColumnsType,
} from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import {
  useSeverities,
  useCreateSeverity,
  useDeleteSeverity,
  type Severity,
} from '@/lib/api/workflowLookups';
import { useHasPermission } from '@/stores/authStore';

const extractApiError = (err: unknown, fallback = 'Save failed'): string =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? fallback;

const COLOR_HINTS: { label: string; value: string }[] = [
  { label: 'Critical (red)', value: '#DC2626' },
  { label: 'Major (amber)',  value: '#F59E0B' },
  { label: 'Minor (blue)',   value: '#3B82F6' },
];

export default function SeveritiesTab() {
  const [search, setSearch] = useState('');
  const { data: items = [], isLoading } = useSeverities();
  const create = useCreateSeverity();
  const remove = useDeleteSeverity();

  const canManage = useHasPermission('workflow.lookups.manage');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((s) => s.name.toLowerCase().includes(q));
  }, [items, search]);

  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [level, setLevel] = useState<number>(0);
  const [color, setColor] = useState<string>('');

  const [confirmDelete, setConfirmDelete] = useState<Severity | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setLevel(0);
    setColor('');
    setFormError(null);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setFormError('Name is required');
      return;
    }
    setFormError(null);
    try {
      await create.mutateAsync({
        name: name.trim(),
        level,
        color: color.trim() || null,
      });
      setShowForm(false);
      reset();
    } catch (err) {
      setFormError(extractApiError(err));
    }
  };

  const submitDelete = async () => {
    if (!confirmDelete) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(confirmDelete.id);
      setConfirmDelete(null);
    } catch (err) {
      setDeleteError(extractApiError(err, 'Delete failed'));
    }
  };

  const columns: TableColumnsType<Severity> = [
    {
      title: 'Severity',
      dataIndex: 'name',
      render: (n: string, s: Severity) => (
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full border border-gray-200"
            style={{ background: s.color ?? '#94A3B8' }}
          />
          <span className="font-medium text-gray-900">{n}</span>
        </span>
      ),
    },
    {
      title: 'Level',
      dataIndex: 'level',
      width: 120,
      sorter: (a, b) => a.level - b.level,
      defaultSortOrder: 'descend',
      render: (lvl: number) => (
        <span className="text-xs text-gray-600">{lvl}</span>
      ),
    },
    {
      title: 'Colour',
      dataIndex: 'color',
      width: 140,
      render: (c: string | null) =>
        c ? (
          <span className="text-xs text-gray-600 font-mono">{c}</span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      title: 'Status',
      dataIndex: 'isDeleted',
      width: 110,
      render: (deleted: boolean) => (
        <AntTag color={deleted ? 'default' : 'success'}>
          {deleted ? 'Deleted' : 'Active'}
        </AntTag>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, s) =>
        canManage && !s.isDeleted ? (
          <AntButton
            type="text"
            size="small"
            danger
            icon={<Trash2 size={14} />}
            onClick={() => { setConfirmDelete(s); setDeleteError(null); }}
          />
        ) : (
          <span className="text-xs text-gray-300">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <AntInput.Search
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search severities…"
            allowClear
            style={{ flex: 1 }}
          />
        </div>
        {canManage && (
          <AntButton type="primary" icon={<Plus size={14} />} onClick={() => { reset(); setShowForm(true); }}>
            Add Severity
          </AntButton>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <AntTable<Severity>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No severities defined yet."
              />
            ),
          }}
        />
      </div>

      <AntModal
        title="Add Severity"
        open={showForm}
        onCancel={() => { setShowForm(false); reset(); }}
        width={460}
        destroyOnClose
        footer={[
          <AntButton key="cancel" onClick={() => { setShowForm(false); reset(); }}>
            Cancel
          </AntButton>,
          <AntButton
            key="ok"
            type="primary"
            loading={create.isPending}
            onClick={handleSubmit}
          >
            Create Severity
          </AntButton>,
        ]}
      >
        {formError && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {formError}
          </div>
        )}
        <AntForm layout="vertical">
          <AntForm.Item label="Name" required>
            <AntInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Critical / Major / Minor"
              maxLength={80}
            />
          </AntForm.Item>
          <AntForm.Item
            label="Level"
            help="Higher = more severe. Used for ordering in lists and dashboards."
          >
            <AntInputNumber
              value={level}
              onChange={(v) => setLevel(typeof v === 'number' ? v : 0)}
              min={0}
              max={1000}
              style={{ width: '100%' }}
            />
          </AntForm.Item>
          <AntForm.Item
            label="Colour"
            help="Hex (e.g. #DC2626). Optional — used by badges and dot indicators."
          >
            <AntInput
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="#DC2626"
              maxLength={7}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {COLOR_HINTS.map((h) => (
                <button
                  key={h.value}
                  type="button"
                  onClick={() => setColor(h.value)}
                  className="inline-flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-900 px-2 py-1 rounded border border-gray-200 hover:border-gray-300"
                >
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ background: h.value }}
                  />
                  {h.label}
                </button>
              ))}
            </div>
          </AntForm.Item>
        </AntForm>
      </AntModal>

      <AntModal
        title="Delete Severity"
        open={!!confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        width={420}
        footer={[
          <AntButton key="cancel" onClick={() => setConfirmDelete(null)}>Cancel</AntButton>,
          <AntButton
            key="delete"
            danger
            type="primary"
            loading={remove.isPending}
            onClick={submitDelete}
          >
            Delete
          </AntButton>,
        ]}
      >
        {deleteError && (
          <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {deleteError}
          </div>
        )}
        <p className="text-sm text-gray-700 mb-2">
          Delete <span className="font-semibold">{confirmDelete?.name}</span>?
        </p>
        <p className="text-xs text-gray-500 mb-0">
          Soft-delete — existing tickets referencing this severity are preserved.
        </p>
      </AntModal>
    </div>
  );
}
