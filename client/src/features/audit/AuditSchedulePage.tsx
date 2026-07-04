import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Badge,
  Button,
  Calendar,
  Drawer,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  message,
} from 'antd';
import type { Dayjs } from 'dayjs';
import { Plus, Edit3, Trash2, RefreshCw } from 'lucide-react';
import { DataTable } from '@/components/ui';
import {
  useScheduleRules,
  useCreateScheduleRule,
  useUpdateScheduleRule,
  useDeleteScheduleRule,
  useRunScheduleSweep,
  useAuditCalendar,
  useAuditMasters,
  type AuditScheduleRule,
  type AuditScheduleRuleUpsert,
  type AuditFrequency,
  type CalendarAudit,
} from '@/lib/api/audit';
import { useAdminUsers } from '@/features/admin/users/hooks';
import { useForms } from '@/features/forms/hooks';
import { useWorkflows } from '@/lib/api/workflow';
import { useHasPermission } from '@/stores/authStore';
import { AuditStatusBadge } from './auditStatusBadge';

const FREQUENCIES: AuditFrequency[] = [
  'ONE_TIME',
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'HALF_YEARLY',
  'ANNUAL',
];

const STATUS_BADGE: Record<string, 'default' | 'processing' | 'success' | 'warning' | 'error'> = {
  DRAFT: 'default',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  CLOSED: 'default',
  REJECTED: 'error',
  CANCELLED: 'error',
};

export default function AuditSchedulePage({
  embedded = false,
  section = 'all',
}: {
  embedded?: boolean;
  /** 'calendar' → just the calendar; 'rules' → actions + rules tables; 'all' → both. */
  section?: 'calendar' | 'rules' | 'all';
} = {}) {
  const showCalendar = section === 'calendar' || section === 'all';
  const showRules = section === 'rules' || section === 'all';
  const canCreate = useHasPermission('audit_schedule.create');
  const canUpdate = useHasPermission('audit_schedule.update');
  const canDelete = useHasPermission('audit_schedule.delete');

  const { data: calResp } = useAuditCalendar();
  const audits = calResp?.data ?? [];
  const { data: rulesResp, isLoading } = useScheduleRules();
  const rules = rulesResp?.data ?? [];
  const { data: wfResp } = useWorkflows({ status: 'ACTIVE', pageSize: 200 });
  const workflows = wfResp?.items ?? [];
  const wfName = (id: string | null) =>
    id ? workflows.find((w) => w.id === id)?.name ?? 'Workflow' : '—';

  const runSweep = useRunScheduleSweep();
  const deleteMut = useDeleteScheduleRule();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<AuditScheduleRule | null>(null);

  // Map planned audits by YYYY-MM-DD for the calendar cells.
  const byDate = useMemo(() => {
    const m = new Map<string, CalendarAudit[]>();
    for (const a of audits) {
      const key = a.planned_date.slice(0, 10);
      const arr = m.get(key) ?? [];
      arr.push(a);
      m.set(key, arr);
    }
    return m;
  }, [audits]);

  const runNow = async () => {
    try {
      const res = await runSweep.mutateAsync();
      const n = (res as { data?: { spawned_count?: number } })?.data?.spawned_count ?? 0;
      message.success(n > 0 ? `Generated ${n} audit(s) from due rules` : 'No rules are due right now');
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  const handleDelete = async (r: AuditScheduleRule) => {
    if (!confirm(`Delete schedule rule "${r.name}"?`)) return;
    try {
      await deleteMut.mutateAsync(r.id);
      message.success('Rule deleted');
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <>
      {showRules && (
        <div
          className={`flex items-center gap-3 mb-3 flex-wrap ${
            embedded ? 'justify-end' : 'justify-between'
          }`}
        >
          {!embedded && (
            <div>
              <h2 className="text-base font-semibold text-gray-900">Audit Schedule</h2>
              <p className="text-xs text-gray-500">
                Recurrence rules auto-generate audits; planned audits show on the calendar.
              </p>
            </div>
          )}
          <Space>
            {canCreate && (
              <Button icon={<RefreshCw size={14} />} onClick={runNow} loading={runSweep.isPending}>
                Generate due audits
              </Button>
            )}
            {canCreate && (
              <Button
                type="primary"
                icon={<Plus size={14} />}
                onClick={() => {
                  setEditing(null);
                  setDrawerOpen(true);
                }}
              >
                New Rule
              </Button>
            )}
          </Space>
        </div>
      )}

      {/* Calendar of planned audits */}
      {showCalendar && (
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4">
        <Calendar
          fullscreen={false}
          cellRender={(current: Dayjs, info) => {
            if (info.type !== 'date') return info.originNode;
            const items = byDate.get(current.format('YYYY-MM-DD')) ?? [];
            if (items.length === 0) return null;
            return (
              <ul className="m-0 p-0 list-none">
                {items.slice(0, 3).map((a) => (
                  <li key={a.id} className="truncate">
                    <Badge status={STATUS_BADGE[a.status] ?? 'default'} text={
                      <span className="text-[11px]">{a.title}</span>
                    } />
                  </li>
                ))}
                {items.length > 3 && (
                  <li className="text-[11px] text-gray-400">+{items.length - 3} more</li>
                )}
              </ul>
            );
          }}
        />
      </div>
      )}

      {/* Schedule rules */}
      {showRules && (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Recurrence Rules</h3>
        <DataTable<AuditScheduleRule>
          data={rules}
          isLoading={isLoading}
          pageSize={1000}
          emptyMessage="No schedule rules yet"
          columns={[
            {
              key: 'name',
              header: 'Name',
              render: (r) => <span className="font-medium text-gray-800">{r.name}</span>,
            },
            {
              key: 'audit_master',
              header: 'Audit Master',
              sortable: false,
              render: (r) => r.audit_master?.name ?? '—',
            },
            {
              key: 'workflow',
              header: 'Workflow',
              sortable: false,
              render: (r) =>
                r.workflow_id ? (
                  <span className="text-gray-700">{wfName(r.workflow_id)}</span>
                ) : (
                  <span className="text-gray-400">—</span>
                ),
            },
            {
              key: 'frequency',
              header: 'Frequency',
              render: (r) => r.frequency.replace(/_/g, ' '),
            },
            {
              key: 'next_run_at',
              header: 'Next run',
              render: (r) => new Date(r.next_run_at).toLocaleDateString(),
            },
            {
              key: 'is_active',
              header: 'Active',
              render: (r) => (
                <span className={`text-xs ${r.is_active ? 'text-emerald-700' : 'text-gray-400'}`}>
                  {r.is_active ? 'Active' : 'Paused'}
                </span>
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
                      onClick={() => {
                        setEditing(r);
                        setDrawerOpen(true);
                      }}
                    />
                  )}
                  {canDelete && (
                    <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => handleDelete(r)} />
                  )}
                </Space>
              ),
            },
          ]}
        />
      </div>
      )}

      {/* Upcoming list (compact, complements the calendar) */}
      {showRules && audits.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Planned Audits</h3>
          <DataTable<CalendarAudit>
            data={[...audits].sort((a, b) => a.planned_date.localeCompare(b.planned_date))}
            pageSize={10}
            emptyMessage="No planned audits"
            columns={[
              {
                key: 'planned_date',
                header: 'Date',
                render: (r) => new Date(r.planned_date).toLocaleDateString(),
              },
              {
                key: 'title',
                header: 'Audit',
                render: (r) => (
                  <Link to={`/audit/register/${r.id}`} className="text-blue-600 hover:underline">
                    {r.title}
                  </Link>
                ),
              },
              {
                key: 'register_number',
                header: 'Reg #',
                render: (r) => (
                  <span className="font-mono text-xs text-gray-500">{r.register_number}</span>
                ),
              },
              {
                key: 'status',
                header: 'Status',
                sortable: false,
                render: (r) => <AuditStatusBadge status={r.status} />,
              },
            ]}
          />
        </div>
      )}

      {showRules && (
        <RuleDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} record={editing} />
      )}
    </>
  );
}

function RuleDrawer({
  open,
  onClose,
  record,
}: {
  open: boolean;
  onClose: () => void;
  record: AuditScheduleRule | null;
}) {
  const createMut = useCreateScheduleRule();
  const updateMut = useUpdateScheduleRule(record?.id ?? '');
  const { data: mastersResp } = useAuditMasters({ page_size: 200, is_active: true });
  const masters = mastersResp?.data ?? [];
  const { data: usersData } = useAdminUsers({ pageSize: 200, isActive: true });
  const users = usersData?.items ?? [];
  const { data: wfResp } = useWorkflows({ status: 'ACTIVE', pageSize: 200 });
  const workflows = wfResp?.items ?? [];
  const { data: formsResp } = useForms({ kind: 'CHECKLIST', page_size: 200 });
  const checklists = formsResp?.forms ?? [];

  const [name, setName] = useState('');
  const [masterId, setMasterId] = useState<string | undefined>();
  const [frequency, setFrequency] = useState<AuditFrequency>('ANNUAL');
  const [anchorDate, setAnchorDate] = useState('');
  const [leadTime, setLeadTime] = useState('14');
  const [plant, setPlant] = useState('');
  const [auditorId, setAuditorId] = useState<string | undefined>();
  const [workflowId, setWorkflowId] = useState<string | undefined>();
  const [checklistId, setChecklistId] = useState<string | undefined>();
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (open) {
      setName(record?.name ?? '');
      setMasterId(record?.audit_master?.id);
      setFrequency(record?.frequency ?? 'ANNUAL');
      setAnchorDate(record?.anchor_date ? record.anchor_date.slice(0, 10) : '');
      setLeadTime(String(record?.lead_time_days ?? 14));
      setPlant(record?.plant ?? '');
      setAuditorId(record?.default_auditor_id ?? undefined);
      setWorkflowId(record?.workflow_id ?? undefined);
      setChecklistId(record?.checklist_form_id ?? undefined);
      setActive(record?.is_active ?? true);
    }
  }, [open, record]);

  const submit = async () => {
    if (!name.trim() || !masterId || !anchorDate) {
      message.error('Name, audit master and anchor date are required');
      return;
    }
    const body: AuditScheduleRuleUpsert = {
      name: name.trim(),
      audit_master_id: masterId,
      frequency,
      anchor_date: anchorDate,
      lead_time_days: Number(leadTime) || 0,
      plant: plant || null,
      default_auditor_id: auditorId ?? null,
      workflow_id: workflowId ?? null,
      checklist_form_id: checklistId ?? null,
      is_active: active,
    };
    try {
      if (record) {
        await updateMut.mutateAsync(body);
        message.success('Rule updated');
      } else {
        await createMut.mutateAsync(body);
        message.success('Rule created');
      }
      onClose();
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <Drawer
      title={record ? `Edit ${record.name}` : 'New Schedule Rule'}
      open={open}
      onClose={onClose}
      width={480}
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
        <Labeled label="Name *">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Quarterly internal audit — Line A" />
        </Labeled>
        <Labeled label="Audit Master *">
          <Select
            value={masterId}
            onChange={setMasterId}
            showSearch
            optionFilterProp="label"
            options={masters.map((m) => ({ value: m.id, label: m.name }))}
            className="w-full"
            placeholder="Template to generate from"
          />
        </Labeled>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Frequency *">
            <Select
              value={frequency}
              onChange={setFrequency}
              options={FREQUENCIES.map((f) => ({ value: f, label: f.replace(/_/g, ' ') }))}
              className="w-full"
            />
          </Labeled>
          <Labeled label="First occurrence *">
            <Input type="date" value={anchorDate} onChange={(e) => setAnchorDate(e.target.value)} />
          </Labeled>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Labeled label="Lead time (days)">
            <Input type="number" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} />
          </Labeled>
          <Labeled label="Plant">
            <Input value={plant} onChange={(e) => setPlant(e.target.value)} />
          </Labeled>
        </div>
        <Labeled label="Default auditor">
          <Select
            value={auditorId}
            onChange={setAuditorId}
            allowClear
            showSearch
            optionFilterProp="label"
            options={users.map((u) => ({ value: u.id, label: u.name }))}
            className="w-full"
          />
        </Labeled>
        <Labeled label="Workflow (optional)">
          <Select
            value={workflowId}
            onChange={setWorkflowId}
            allowClear
            showSearch
            optionFilterProp="label"
            options={workflows.map((w) => ({ value: w.id, label: w.name }))}
            className="w-full"
            placeholder="Generated audits will follow this workflow"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            When set, each generated audit raises a ticket on this workflow — its stage checklist
            and progress drive the audit.
          </p>
        </Labeled>
        <Labeled label="Audit checklist">
          <Select
            value={checklistId}
            onChange={setChecklistId}
            allowClear
            showSearch
            optionFilterProp="label"
            options={checklists.map((f) => ({ value: f.id, label: f.title }))}
            className="w-full"
            placeholder="Checklist used when performing the audit"
          />
          <p className="text-[11px] text-gray-400 mt-1">
            This checklist is attached to every audit this rule generates and is one click to fill
            when performing the audit. Falls back to the audit master's default if unset.
          </p>
        </Labeled>
        <Labeled label="Active">
          <Switch checked={active} onChange={setActive} />
        </Labeled>
        {frequency === 'ONE_TIME' && (
          <p className="text-[11px] text-amber-600">
            One-time rules generate a single audit then deactivate automatically.
          </p>
        )}
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
