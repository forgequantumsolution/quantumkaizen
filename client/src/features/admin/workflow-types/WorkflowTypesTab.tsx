import { useMemo, useState } from 'react';
import {
  Input as AntInput,
  Table as AntTable,
  Tag as AntTag,
  Empty,
  Alert,
  type TableColumnsType,
} from 'antd';
import { useWorkflowTypes, type WorkflowType } from '@/lib/api/workflowLookups';

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
        <span className="text-xs text-gray-500">
          {data ? `${data.length} total` : ''}
        </span>
      </div>

      {isError && (
        <Alert
          type="error"
          showIcon
          message="Failed to load workflow types"
          description={(error as Error | undefined)?.message ?? 'Unknown error'}
        />
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
    </div>
  );
}
