import { useNavigate } from 'react-router-dom';
import { Button, Space } from 'antd';
import { Plus, Edit3, Trash2 } from 'lucide-react';
import { DataTable } from '@/components/ui';
import {
  useAuditMasters,
  useDeleteAuditMaster,
  type AuditMaster,
} from '@/lib/api/audit';
import { useHasPermission } from '@/stores/authStore';
import { useConfirmDelete } from '@/components/shared/useConfirmDelete';

export default function AuditMasterPage() {
  const nav = useNavigate();
  const canCreate = useHasPermission('audit_master.create');
  const canUpdate = useHasPermission('audit_master.update');
  const canDelete = useHasPermission('audit_master.delete');

  const { data, isLoading } = useAuditMasters({ page_size: 200 });
  const rows: AuditMaster[] = data?.data ?? [];
  const deleteMut = useDeleteAuditMaster();
  const confirmDelete = useConfirmDelete();

  const handleDelete = (m: AuditMaster) =>
    confirmDelete({
      entityLabel: 'audit master',
      name: m.name,
      mutate: () => deleteMut.mutateAsync(m.id),
      invalidateKey: ['audit', 'masters'],
    });

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

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <DataTable<AuditMaster>
          data={rows}
          isLoading={isLoading}
          pageSize={30}
          emptyMessage="No audit masters found"
          columns={[
            { key: 'name', header: 'Name' },
            {
              key: 'audit_type',
              header: 'Type',
              render: (r) => (
                <span className="text-xs font-medium text-gray-700">
                  {r.audit_type.replace(/_/g, ' ')}
                </span>
              ),
            },
            {
              key: 'frequency',
              header: 'Frequency',
              render: (r) => r.frequency.replace(/_/g, ' '),
            },
            {
              key: 'checklist',
              header: 'Checklist',
              sortable: false,
              render: (r) =>
                r.checklist_forms.length
                  ? r.checklist_forms.map((c) => c.title).join(', ')
                  : '—',
            },
            {
              key: 'iso',
              header: 'ISO Standard',
              sortable: false,
              render: (r) => r.default_iso_standard?.name ?? '—',
            },
            {
              key: 'is_active',
              header: 'Active',
              render: (r) => (
                <span className={`text-xs ${r.is_active ? 'text-emerald-700' : 'text-gray-400'}`}>
                  {r.is_active ? 'Active' : 'Inactive'}
                </span>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              sortable: false,
              render: (r) => (
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
      </div>
    </>
  );
}
