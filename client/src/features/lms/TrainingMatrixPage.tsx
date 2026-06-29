import { useState } from 'react';
import { App, Button, Empty, Input, InputNumber, Modal, Select, Switch, Table, Tag } from 'antd';
import { Grid3x3, Plus, Trash2, RefreshCw } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useHasPermission } from '@/stores/authStore';
import {
  useMatrixRules, useCreateMatrixRule, useDeleteMatrixRule, useSyncMatrix,
  useCourses, useCurricula,
  type MatrixRule, type MatrixTargetType, type MatrixRequiresType,
} from '@/lib/api/lms';
import { useRoles } from '@/features/admin/roles/hooks';
import { useDepartments } from '@/features/admin/departments/hooks';
import { useSites } from '@/lib/api/sites';

export default function TrainingMatrixPage() {
  const { message } = App.useApp();
  const canWrite = useHasPermission('lms_matrix.write');
  const { data: rules, isLoading } = useMatrixRules();
  const create = useCreateMatrixRule();
  const del = useDeleteMatrixRule();
  const sync = useSyncMatrix();

  const { data: rolesResp } = useRoles({ pageSize: 200 });
  const { data: deptResp } = useDepartments({ isActive: true, pageSize: 200 });
  const { data: sitesResp } = useSites({ pageSize: 200 });
  const { data: courses } = useCourses({ status: 'PUBLISHED', latest_only: true });
  const { data: curricula } = useCurricula();

  const [open, setOpen] = useState(false);
  const [targetType, setTargetType] = useState<MatrixTargetType>('ROLE');
  const [targetId, setTargetId] = useState<string>('');
  const [requiresType, setRequiresType] = useState<MatrixRequiresType>('COURSE');
  const [requiresId, setRequiresId] = useState<string>('');
  const [dueDays, setDueDays] = useState<number | null>(30);
  const [recurring, setRecurring] = useState(false);

  const reset = () => { setTargetType('ROLE'); setTargetId(''); setRequiresType('COURSE'); setRequiresId(''); setDueDays(30); setRecurring(false); };

  const nameLookup = (type: MatrixTargetType, id: string): string => {
    if (type === 'ROLE') return rolesResp?.items.find((r) => r.id === id)?.name ?? id;
    if (type === 'DEPARTMENT') return deptResp?.items.find((d) => d.id === id)?.name ?? id;
    if (type === 'SITE') return sitesResp?.items.find((s) => s.id === id)?.name ?? id;
    return id; // JOB_FUNCTION free text
  };
  const requiresLookup = (type: MatrixRequiresType, id: string): string => {
    if (type === 'COURSE') return courses?.data.find((c) => c.id === id)?.title ?? id;
    return curricula?.find((c) => c.id === id)?.title ?? id;
  };

  const submit = async () => {
    if (!targetId.trim()) { message.error('Select a target'); return; }
    if (!requiresId) { message.error('Select what is required'); return; }
    try {
      await create.mutateAsync({
        target_type: targetType, target_id: targetId.trim(),
        requires_type: requiresType, requires_id: requiresId,
        due_within_days: dueDays, recurring, is_active: true,
      });
      message.success('Rule added');
      setOpen(false); reset();
    } catch { message.error('Could not add rule'); }
  };

  const runSync = async () => {
    try {
      const res = await sync.mutateAsync();
      message.success(`Sync done — ${res.created} new, ${res.reopened} re-opened across ${res.rules} rules`);
    } catch { message.error('Sync failed'); }
  };

  const columns = [
    { title: 'Target', render: (_: unknown, r: MatrixRule) => (
      <span><Tag>{r.target_type.replace('_', ' ')}</Tag> {nameLookup(r.target_type, r.target_id)}</span>
    ) },
    { title: 'Requires', render: (_: unknown, r: MatrixRule) => (
      <span><Tag color="blue">{r.requires_type}</Tag> {requiresLookup(r.requires_type, r.requires_id)}</span>
    ) },
    { title: 'Due', dataIndex: 'due_within_days', width: 110, render: (d: number | null) => (d ? `${d} days` : '—') },
    { title: 'Recurring', dataIndex: 'recurring', width: 100, render: (v: boolean) => (v ? <Tag color="gold">Recurring</Tag> : '—') },
    ...(canWrite ? [{
      title: '', width: 60,
      render: (_: unknown, r: MatrixRule) => (
        <Trash2 size={14} className="text-gray-400 hover:text-red-500 cursor-pointer" onClick={() => del.mutate(r.id)} />
      ),
    }] : []),
  ];

  const targetSelect = () => {
    if (targetType === 'ROLE') return (
      <Select showSearch optionFilterProp="label" style={{ width: '100%' }} value={targetId || undefined} onChange={setTargetId} placeholder="Select role"
        options={(rolesResp?.items ?? []).map((r) => ({ value: r.id, label: r.name }))} />
    );
    if (targetType === 'DEPARTMENT') return (
      <Select showSearch optionFilterProp="label" style={{ width: '100%' }} value={targetId || undefined} onChange={setTargetId} placeholder="Select department"
        options={(deptResp?.items ?? []).map((d) => ({ value: d.id, label: d.name }))} />
    );
    if (targetType === 'SITE') return (
      <Select showSearch optionFilterProp="label" style={{ width: '100%' }} value={targetId || undefined} onChange={setTargetId} placeholder="Select site"
        options={(sitesResp?.items ?? []).map((s) => ({ value: s.id, label: s.name }))} />
    );
    return <Input value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="Job function / designation (exact match)" />;
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Grid3x3 size={22} className="text-gray-500" /> Training Matrix
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">Rules that auto-assign courses by role, department, site or job function.</p>
        </div>
        <div className="flex items-center gap-2">
          {canWrite && <Button icon={<RefreshCw size={14} />} loading={sync.isPending} onClick={runSync}>Run sync</Button>}
          {canWrite && <Button type="primary" icon={<Plus size={14} />} onClick={() => setOpen(true)}>Add rule</Button>}
        </div>
      </div>

      {isLoading ? null : (rules?.length ?? 0) === 0 ? (
        <Empty description="No matrix rules yet." />
      ) : (
        <Table rowKey="id" dataSource={rules} columns={columns} size="small" pagination={{ pageSize: 20 }} />
      )}

      <Modal title="Add matrix rule" open={open} onCancel={() => setOpen(false)} onOk={submit} okText="Add rule" confirmLoading={create.isPending} width={560}>
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Applies to</label>
              <Select value={targetType} onChange={(v) => { setTargetType(v); setTargetId(''); }} style={{ width: '100%' }}
                options={(['ROLE', 'DEPARTMENT', 'SITE', 'JOB_FUNCTION'] as MatrixTargetType[]).map((t) => ({ value: t, label: t.replace('_', ' ') }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Target</label>
              {targetSelect()}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Requires</label>
              <Select value={requiresType} onChange={(v) => { setRequiresType(v); setRequiresId(''); }} style={{ width: '100%' }}
                options={(['COURSE', 'CURRICULUM'] as MatrixRequiresType[]).map((t) => ({ value: t, label: t }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">{requiresType === 'COURSE' ? 'Course' : 'Curriculum'}</label>
              {requiresType === 'COURSE' ? (
                <Select showSearch optionFilterProp="label" style={{ width: '100%' }} value={requiresId || undefined} onChange={setRequiresId} placeholder="Select course"
                  options={(courses?.data ?? []).map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` }))} />
              ) : (
                <Select showSearch optionFilterProp="label" style={{ width: '100%' }} value={requiresId || undefined} onChange={setRequiresId} placeholder="Select curriculum"
                  options={(curricula ?? []).map((c) => ({ value: c.id, label: `${c.code} — ${c.title}` }))} />
              )}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Due within (days)</label>
              <InputNumber min={1} max={365} value={dueDays ?? undefined} onChange={(v) => setDueDays(v ?? null)} placeholder="none" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Recurring (recert)</label>
              <Switch checked={recurring} onChange={setRecurring} />
            </div>
          </div>
          <p className="text-[11px] text-gray-400">Recurring rules re-open a completed course for retraining once its validity period lapses (on the next sync).</p>
        </div>
      </Modal>
    </PageContainer>
  );
}
