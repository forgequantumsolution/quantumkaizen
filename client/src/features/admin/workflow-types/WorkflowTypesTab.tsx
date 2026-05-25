import { useMemo, useState } from 'react';
import {
  Button as AntButton,
  Modal as AntModal,
  Input as AntInput,
  Table as AntTable,
  Tag as AntTag,
  Form as AntForm,
  Empty,
  type TableColumnsType,
} from 'antd';
import { Plus, Trash2 } from 'lucide-react';
import {
  useWorkflowTypes,
  useCreateWorkflowType,
  useDeleteWorkflowType,
  type WorkflowType,
} from '@/lib/api/workflowLookups';
import { useHasPermission } from '@/stores/authStore';

const extractApiError = (err: unknown, fallback = 'Save failed'): string =>
  (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
    ?.message ?? fallback;

const ICON_HINTS = [
  'file-text',
  'wrench',
  'git-branch',
  'shield-alert',
  'alert-triangle',
  'file-warning',
  'layers',
  'beaker',
  'book-open',
];

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

export default function WorkflowTypesTab() {
  const [search, setSearch] = useState('');
  const { data, isLoading, isError, error } = useWorkflowTypes();
  const create = useCreateWorkflowType();
  const remove = useDeleteWorkflowType();

  const canManage = useHasPermission('workflow.lookups.manage');

  const filtered = useMemo(() => {
    const items = data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.codePrefix ?? '').toLowerCase().includes(q),
    );
  }, [data, search]);

  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [codePrefix, setCodePrefix] = useState('');
  const [iconName, setIconName] = useState('');

  const [confirmDelete, setConfirmDelete] = useState<WorkflowType | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setCodePrefix('');
    setIconName('');
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
        codePrefix: codePrefix.trim() || undefined,
        iconName: iconName.trim() || undefined,
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
      await remove.mutateAsync({ id: confirmDelete.id });
      setConfirmDelete(null);
    } catch (err) {
      setDeleteError(extractApiError(err, 'Delete failed'));
    }
  };

  const columns: TableColumnsType<WorkflowType> = [
    {
      title: 'Name',
      dataIndex: 'name',
      render: (name: string) => (
        <span className="font-medium text-gray-900">{name}</span>
      ),
    },
    {
      title: 'Code Prefix',
      dataIndex: 'codePrefix',
      width: 140,
      render: (prefix: string | null) =>
        prefix ? (
          <span className="font-mono text-xs font-semibold text-slate-900">
            {prefix}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      title: 'Icon',
      dataIndex: ['iconConfig', 'iconName'],
      width: 140,
      render: (iconName: string | undefined) =>
        iconName ? (
          <span className="text-xs text-gray-600">{iconName}</span>
        ) : (
          <span className="text-gray-300">—</span>
        ),
    },
    {
      title: 'Status',
      dataIndex: 'isDeleted',
      width: 110,
      render: (isDeleted: boolean) => (
        <AntTag color={isDeleted ? 'default' : 'success'}>
          {isDeleted ? 'Deleted' : 'Active'}
        </AntTag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      width: 200,
      render: (iso: string) => (
        <span className="text-xs text-gray-600">{formatDate(iso)}</span>
      ),
    },
    {
      title: 'Updated',
      dataIndex: 'updatedAt',
      width: 200,
      render: (iso: string) => (
        <span className="text-xs text-gray-600">{formatDate(iso)}</span>
      ),
    },
    {
      title: '',
      key: 'actions',
      width: 60,
      render: (_, t) =>
        canManage && !t.isDeleted ? (
          <AntButton
            type="text"
            size="small"
            danger
            icon={<Trash2 size={14} />}
            onClick={() => { setConfirmDelete(t); setDeleteError(null); }}
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
            placeholder="Search by name or code prefix…"
            allowClear
            style={{ flex: 1 }}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            {data ? `${data.length} total` : ''}
          </span>
          {canManage && (
            <AntButton type="primary" icon={<Plus size={14} />} onClick={() => { reset(); setShowForm(true); }}>
              Add Workflow Type
            </AntButton>
          )}
        </div>
      </div>

      {isError && (
        <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          {(error as Error | undefined)?.message ?? 'Failed to load workflow types'}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <AntTable<WorkflowType>
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No workflow types found."
              />
            ),
          }}
        />
      </div>

      <AntModal
        title="Add Workflow Type"
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
            Create Workflow Type
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
              placeholder="Document Review, Change Control…"
              maxLength={250}
              autoFocus
            />
          </AntForm.Item>
          <AntForm.Item
            label="Code Prefix"
            help="Used to generate ticket IDs (e.g. DOC-FQS-001). Auto-derived from name if blank."
          >
            <AntInput
              value={codePrefix}
              onChange={(e) => setCodePrefix(e.target.value.toUpperCase())}
              placeholder="DOC"
              maxLength={20}
              className="font-mono uppercase"
            />
          </AntForm.Item>
          <AntForm.Item
            label="Icon"
            help="Lucide icon name. Optional — used in the sidebar Modules group."
          >
            <AntInput
              value={iconName}
              onChange={(e) => setIconName(e.target.value)}
              placeholder="file-text"
              maxLength={100}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {ICON_HINTS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setIconName(h)}
                  className="inline-flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-900 px-2 py-1 rounded border border-gray-200 hover:border-gray-300"
                >
                  {h}
                </button>
              ))}
            </div>
          </AntForm.Item>
        </AntForm>
      </AntModal>

      <AntModal
        title="Delete Workflow Type"
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
          Removes the type from the sidebar and new workflow picker. Existing workflows and tickets of this type stay intact.
        </p>
      </AntModal>
    </div>
  );
}
