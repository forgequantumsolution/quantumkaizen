import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { App, Button, DatePicker, Select, Spin, Table } from 'antd';
import { ArrowLeft, GraduationCap, Trash2, UserPlus, FileText } from 'lucide-react';
import type { Dayjs } from 'dayjs';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useTrainingItem,
  useAssignTraining,
  useDeleteTrainingItem,
  type TrainingAssignment,
} from '@/lib/api/training';
import { useUserDirectory } from '@/features/admin/users/hooks';
import { useRoleDirectory } from '@/features/admin/roles/hooks';

export default function TrainingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { modal, message } = App.useApp();
  const canWrite = useHasPermission('training.write');

  const { data: item, isLoading } = useTrainingItem(id);
  const { data: usersData } = useUserDirectory();
  const users = usersData?.items ?? [];
  const { data: rolesResp } = useRoleDirectory();
  const roles = rolesResp?.items ?? [];

  const assignMut = useAssignTraining(id ?? '');
  const deleteMut = useDeleteTrainingItem();

  const [pickUsers, setPickUsers] = useState<string[]>([]);
  const [pickRole, setPickRole] = useState<string | undefined>();
  const [due, setDue] = useState<Dayjs | null>(null);

  if (isLoading || !item) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-32"><Spin /></div>
      </PageContainer>
    );
  }

  const pct = item.assigned_count ? Math.round((item.completed_count / item.assigned_count) * 100) : 0;
  const roleName = item.role_id ? roles.find((r) => r.id === item.role_id)?.name : null;

  const assign = async () => {
    if (!pickUsers.length && !pickRole) return message.error('Pick users or a role');
    try {
      await assignMut.mutateAsync({ user_ids: pickUsers.length ? pickUsers : undefined, role_id: pickRole, due_date: due ? due.toISOString() : null });
      setPickUsers([]); setPickRole(undefined); setDue(null);
      message.success('Assigned');
    } catch (e) { message.error(extractErr(e)); }
  };

  const remove = () =>
    modal.confirm({
      title: `Delete ${item.code}?`,
      okText: 'Delete', okButtonProps: { danger: true }, centered: true,
      onOk: async () => { try { await deleteMut.mutateAsync(item.id); message.success('Deleted'); nav('/training'); } catch (e) { message.error(extractErr(e)); } },
    });

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Link to="/training" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"><ArrowLeft size={14} /> Back</Link>
          <span className="text-gray-300">·</span>
          <span className="font-mono text-sm text-gray-700">{item.code}</span>
          {!item.is_active && <span className="text-[11px] text-gray-500 bg-gray-100 border border-gray-200 px-1.5 py-0.5 rounded">Inactive</span>}
        </div>
        {canWrite && <Button danger icon={<Trash2 size={14} />} onClick={remove}>Delete</Button>}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-1 flex items-center gap-2">
          <GraduationCap size={18} className="text-gray-400" />
          {item.title}
        </h2>
        {item.description && <p className="text-sm text-gray-600 mb-3">{item.description}</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-[11px] text-gray-500 uppercase tracking-wide">Linked Document</div>
            {item.document_id ? (
              <Link to={`/dms/${item.document_id}`} className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1 mt-0.5">
                <FileText size={13} /> Open document
              </Link>
            ) : <div className="text-sm text-gray-400 mt-0.5">—</div>}
          </div>
          <Field label="Required for role" value={roleName ?? '—'} />
          <Field label="Assigned" value={String(item.assigned_count)} />
          <Field label="Completed" value={`${item.completed_count} (${pct}%)`} />
        </div>
      </div>

      {canWrite && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5"><UserPlus size={15} className="text-gray-500" /> Assign Training</h3>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-end">
            <div className="md:col-span-5">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Users</label>
              <Select mode="multiple" value={pickUsers} onChange={setPickUsers} showSearch optionFilterProp="label" placeholder="Select users" maxTagCount="responsive" className="w-full"
                options={users.map((u) => ({ value: u.id, label: u.name }))} />
            </div>
            <div className="md:col-span-3">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">…or whole role</label>
              <Select value={pickRole} onChange={setPickRole} allowClear showSearch optionFilterProp="label" placeholder="Role" className="w-full"
                options={roles.map((r) => ({ value: r.id, label: r.name }))} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[11px] font-medium text-gray-600 mb-1">Due date</label>
              <DatePicker value={due ?? undefined} onChange={(d) => setDue(d ?? null)} className="w-full" />
            </div>
            <div className="md:col-span-2">
              <Button icon={<UserPlus size={14} />} onClick={assign} loading={assignMut.isPending} block>Assign</Button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Assignees ({item.assignments.length})</h3>
        <Table<TrainingAssignment>
          size="small"
          rowKey="id"
          dataSource={item.assignments}
          pagination={false}
          columns={[
            { title: 'User', render: (_: unknown, r) => r.user_name ?? r.user_id },
            { title: 'Status', width: 130, render: (_: unknown, r) => (
              <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded border ${r.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                {r.status === 'COMPLETED' ? 'Completed' : 'Assigned'}
              </span>
            ) },
            { title: 'Due', width: 120, render: (_: unknown, r) => (r.due_date ? new Date(r.due_date).toLocaleDateString() : '—') },
            { title: 'Completed', width: 140, render: (_: unknown, r) => (r.completed_at ? new Date(r.completed_at).toLocaleDateString() : '—') },
          ]}
        />
      </div>
    </PageContainer>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-sm text-gray-900 mt-0.5">{value}</div>
    </div>
  );
}

function extractErr(err: unknown): string {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
    'Operation failed'
  );
}
