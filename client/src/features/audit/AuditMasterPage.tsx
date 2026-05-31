import { useNavigate } from 'react-router-dom';
import { Button, Space, Spin, Table, message } from 'antd';
import { Plus, Edit3, Trash2 } from 'lucide-react';
import {
  useAuditMasters,
  useDeleteAuditMaster,
  type AuditFrequency,
  type AuditMaster,
  type AuditType,
} from '@/lib/api/audit';
import { useHasPermission } from '@/stores/authStore';

export default function AuditMasterPage() {
  const nav = useNavigate();
  const canCreate = useHasPermission('audit_master.create');
  const canUpdate = useHasPermission('audit_master.update');
  const canDelete = useHasPermission('audit_master.delete');

  const { data, isLoading } = useAuditMasters({ page_size: 200 });
  const rows: AuditMaster[] = data?.data ?? [];
  const deleteMut = useDeleteAuditMaster();

  const handleDelete = async (m: AuditMaster) => {
    if (!confirm(`Delete master "${m.code}"?`)) return;
    try {
      await deleteMut.mutateAsync(m.id);
      message.success('Audit master deleted');
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Audit Master</h2>
          <p className="text-xs text-gray-500">
            Reusable audit templates — type, frequency, default checklist and ISO standard.
          </p>
        </div>
        {canCreate && (
          <Button
            type="primary"
            icon={<Plus size={14} />}
            onClick={() => nav('/audit/master/new')}
          >
            New Master
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-32">
          <Spin />
        </div>
      ) : (
        <Table<AuditMaster>
          size="small"
          rowKey="id"
          dataSource={rows}
          pagination={{ pageSize: 30, showSizeChanger: false }}
          columns={[
            { title: 'Name', dataIndex: 'name', ellipsis: true },
            {
              title: 'Type',
              dataIndex: 'audit_type',
              width: 120,
              render: (v: AuditType) => (
                <span className="text-xs font-medium text-gray-700">
                  {v.replace(/_/g, ' ')}
                </span>
              ),
            },
            {
              title: 'Frequency',
              dataIndex: 'frequency',
              width: 110,
              render: (v: AuditFrequency) => v.replace(/_/g, ' '),
            },
            {
              title: 'Checklist',
              width: 220,
              render: (_: unknown, r) =>
                r.checklist_forms.length
                  ? r.checklist_forms.map((c) => c.title).join(', ')
                  : '—',
            },
            {
              title: 'ISO Standard',
              width: 160,
              render: (_: unknown, r) => r.default_iso_standard?.name ?? '—',
            },
            {
              title: 'Active',
              dataIndex: 'is_active',
              width: 80,
              render: (v: boolean) => (
                <span className={`text-xs ${v ? 'text-emerald-700' : 'text-gray-400'}`}>
                  {v ? 'Active' : 'Inactive'}
                </span>
              ),
            },
            {
              title: 'Actions',
              width: 100,
              render: (_: unknown, r) => (
                <Space size={4}>
                  {canUpdate && (
                    <Button
                      size="small"
                      icon={<Edit3 size={12} />}
                      onClick={() => nav(`/audit/master/${r.id}/edit`)}
                    />
                  )}
                  {canDelete && (
                    <Button
                      size="small"
                      danger
                      icon={<Trash2 size={12} />}
                      onClick={() => handleDelete(r)}
                    />
                  )}
                </Space>
              ),
            },
          ]}
        />
      )}
    </>
  );
}

function extractErr(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
      ?.error?.message ?? 'Operation failed'
  );
}
