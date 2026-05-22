import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Drawer,
  Steps,
  Input as AntInput,
  Select as AntSelect,
  Button as AntButton,
  DatePicker as AntDatePicker,
  Space,
  Tag,
  Tooltip,
} from 'antd';
import {
  ArrowRight,
  ArrowLeft as ArrowLeftIcon,
  CheckCircle2,
  Paperclip,
  Flag,
  AlertOctagon,
  CalendarDays,
  Tag as TagIcon,
  Building2,
  MapPin,
} from 'lucide-react';
import dayjs, { type Dayjs } from 'dayjs';
import {
  useRaiseTicket,
  type TicketClassification,
} from '@/lib/api/ticket';
import { useWorkflows } from '@/lib/api/workflow';
import { usePriorities, useSeverities } from '@/lib/api/workflowLookups';
import { useSites } from '@/lib/api/sites';
import { useDepartments } from '@/features/admin/departments/hooks';
import { displayWorkflowName } from '@/lib/utils';

const CLASSIFICATION_OPTIONS: { value: TicketClassification; label: string }[] = [
  { value: 'PRODUCT',       label: 'Product' },
  { value: 'PROCESS',       label: 'Process' },
  { value: 'SYSTEM',        label: 'System' },
  { value: 'EQUIPMENT',     label: 'Equipment' },
  { value: 'DOCUMENTATION', label: 'Documentation' },
  { value: 'TRAINING',      label: 'Training' },
  { value: 'OTHER',         label: 'Other' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /**
   * When set, the workflow dropdown is restricted to workflows of this type.
   * If exactly one matches, it is auto-selected.
   */
  workflowTypeId?: string;
}

const PRIORITY_TONE: Record<string, string> = {
  critical: '#DC2626',
  high: '#F59E0B',
  medium: '#3B82F6',
  low: '#94A3B8',
};

export default function RaiseTicketDrawer({ isOpen, onClose, workflowTypeId }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [workflowId, setWorkflowId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priorityId, setPriorityId] = useState<string | undefined>(undefined);
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
  const [siteId, setSiteId] = useState<string | undefined>(undefined);
  const [severityId, setSeverityId] = useState<string | undefined>(undefined);
  const [dueDate, setDueDate] = useState<Dayjs | null>(null);
  const [classification, setClassification] =
    useState<TicketClassification | undefined>(undefined);

  const { data: workflowsData, isLoading: loadingWorkflows } = useWorkflows({
    status: 'ACTIVE',
    typeId: workflowTypeId,
    pageSize: 100,
  });
  const { data: priorities = [] } = usePriorities();
  const { data: severities = [] } = useSeverities();
  const { data: sitesData } = useSites({ isActive: 'true', pageSize: 200 });
  const sites = sitesData?.items ?? [];
  const { data: deptData } = useDepartments({ isActive: true, pageSize: 200 });
  const departments = deptData?.items ?? [];
  const raise = useRaiseTicket();

  const activeWorkflows = useMemo(
    () => (workflowsData?.items ?? []).filter((w) => w.workflowStatus === 'ACTIVE'),
    [workflowsData],
  );

  // Auto-select when the type narrows the list to a single workflow.
  useEffect(() => {
    if (workflowTypeId && activeWorkflows.length === 1 && !workflowId) {
      setWorkflowId(activeWorkflows[0].id);
    }
  }, [workflowTypeId, activeWorkflows, workflowId]);

  const selectedWorkflow = useMemo(
    () => activeWorkflows.find((w) => w.id === workflowId),
    [activeWorkflows, workflowId],
  );

  const reset = () => {
    setStep(0);
    setWorkflowId(undefined);
    setTitle('');
    setDescription('');
    setPriorityId(undefined);
    setDepartmentId(undefined);
    setSiteId(undefined);
    setSeverityId(undefined);
    setDueDate(null);
    setClassification(undefined);
  };

  const handleClose = () => {
    if (raise.isPending) return;
    reset();
    onClose();
  };

  const canAdvance = !!workflowId;
  const canSubmit = !!workflowId && title.trim().length > 0;

  const handleSubmit = async () => {
    if (!workflowId) return toast.error('Pick a workflow');
    if (!title.trim()) return toast.error('Title is required');
    try {
      const result = await raise.mutateAsync({
        workflowId,
        title: title.trim(),
        description: description.trim() || undefined,
        priorityId: priorityId || null,
        departmentId: departmentId || null,
        siteId: siteId || null,
        severityId: severityId || null,
        dueDate: dueDate ? dueDate.toISOString() : null,
        classification: classification ?? null,
      });
      toast.success(`Ticket ${result.uniqueId} raised`);
      reset();
      onClose();
      navigate(`/tickets/${result.ticketId}`);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Failed to raise ticket';
      toast.error(msg);
    }
  };

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold">Raise a new ticket</span>
          <Tag color="gold" style={{ marginInlineEnd: 0 }}>
            Step {step + 1} / 2
          </Tag>
        </div>
      }
      open={isOpen}
      onClose={handleClose}
      width={560}
      placement="right"
      destroyOnClose
      maskClosable={!raise.isPending}
      footer={
        <div className="flex items-center justify-between gap-2">
          <AntButton onClick={handleClose} disabled={raise.isPending}>
            Cancel
          </AntButton>
          <Space>
            {step === 1 && (
              <AntButton
                icon={<ArrowLeftIcon size={14} />}
                onClick={() => setStep(0)}
                disabled={raise.isPending}
              >
                Back
              </AntButton>
            )}
            {step === 0 ? (
              <AntButton
                type="primary"
                onClick={() => canAdvance && setStep(1)}
                disabled={!canAdvance}
              >
                Continue
                <ArrowRight size={14} style={{ marginLeft: 6 }} />
              </AntButton>
            ) : (
              <AntButton
                type="primary"
                onClick={handleSubmit}
                loading={raise.isPending}
                disabled={!canSubmit}
                icon={<CheckCircle2 size={14} />}
              >
                Raise ticket
              </AntButton>
            )}
          </Space>
        </div>
      }
    >
      <div className="pb-2">
        <Steps
          size="small"
          current={step}
          items={[
            { title: 'Workflow & context' },
            { title: 'Details' },
          ]}
        />
      </div>

      {step === 0 && (
        <div className="mt-6 space-y-5">
          <Field
            label="Workflow"
            required
            help="The ticket will be created on the latest active version of this workflow."
          >
            <AntSelect
              value={workflowId}
              onChange={(v) => setWorkflowId(v)}
              loading={loadingWorkflows}
              showSearch
              optionFilterProp="label"
              placeholder="Pick an active workflow…"
              size="large"
              style={{ width: '100%' }}
              options={activeWorkflows.map((w) => ({
                value: w.id,
                label: displayWorkflowName(w),
              }))}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label={
                <span className="flex items-center gap-1.5">
                  <Flag size={12} className="text-gray-400" />
                  Priority <span className="text-gray-400 font-normal">(optional)</span>
                </span>
              }
            >
              <AntSelect
                value={priorityId}
                onChange={(v) => setPriorityId(v)}
                allowClear
                placeholder="No priority"
                size="large"
                style={{ width: '100%' }}
                options={priorities.map((p) => {
                  const tone = PRIORITY_TONE[p.name.toLowerCase()] ?? '#94A3B8';
                  return {
                    value: p.id,
                    label: (
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="inline-block w-2 h-2 rounded-full"
                          style={{ background: tone }}
                        />
                        {p.name}
                      </span>
                    ),
                  };
                })}
              />
            </Field>

            <Field
              label={
                <span className="flex items-center gap-1.5">
                  <AlertOctagon size={12} className="text-gray-400" />
                  Severity <span className="text-gray-400 font-normal">(optional)</span>
                </span>
              }
            >
              <AntSelect
                value={severityId}
                onChange={(v) => setSeverityId(v)}
                allowClear
                placeholder="No severity"
                size="large"
                style={{ width: '100%' }}
                options={severities.map((s) => ({
                  value: s.id,
                  label: (
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block w-2 h-2 rounded-full"
                        style={{ background: s.color ?? '#94A3B8' }}
                      />
                      {s.name}
                    </span>
                  ),
                }))}
              />
            </Field>

            <Field
              label={
                <span className="flex items-center gap-1.5">
                  <Building2 size={12} className="text-gray-400" />
                  Department <span className="text-gray-400 font-normal">(optional)</span>
                </span>
              }
            >
              <AntSelect
                value={departmentId}
                onChange={(v) => setDepartmentId(v)}
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="No department"
                size="large"
                style={{ width: '100%' }}
                options={departments.map((d) => ({
                  value: d.id,
                  label: `${d.code} · ${d.name}`,
                }))}
              />
            </Field>

            <Field
              label={
                <span className="flex items-center gap-1.5">
                  <MapPin size={12} className="text-gray-400" />
                  Site <span className="text-gray-400 font-normal">(optional)</span>
                </span>
              }
            >
              <AntSelect
                value={siteId}
                onChange={(v) => setSiteId(v)}
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="No site"
                size="large"
                style={{ width: '100%' }}
                options={sites.map((s) => ({
                  value: s.id,
                  label: `${s.code} · ${s.name}`,
                }))}
              />
            </Field>
          </div>

        </div>
      )}

      {step === 1 && (
        <div className="mt-6 space-y-5">
          <Field label="Title" required>
            <AntInput
              size="large"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={250}
              placeholder="e.g. Q3 supplier audit"
              autoFocus
              showCount
            />
          </Field>

          <Field
            label={
              <span>
                Description <span className="text-gray-400 font-normal">(optional)</span>
              </span>
            }
          >
            <AntInput.TextArea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={5000}
              rows={5}
              placeholder="Brief context for reviewers…"
              showCount
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label={
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={12} className="text-gray-400" />
                  Due date <span className="text-gray-400 font-normal">(optional)</span>
                </span>
              }
            >
              <AntDatePicker
                value={dueDate}
                onChange={(d) => setDueDate(d)}
                size="large"
                style={{ width: '100%' }}
                format="DD MMM YYYY"
                disabledDate={(d) => d.isBefore(dayjs().startOf('day'))}
                placeholder="Pick a target date"
              />
            </Field>

            <Field
              label={
                <span className="flex items-center gap-1.5">
                  <TagIcon size={12} className="text-gray-400" />
                  Classification <span className="text-gray-400 font-normal">(optional)</span>
                </span>
              }
            >
              <AntSelect
                value={classification}
                onChange={(v) => setClassification(v)}
                allowClear
                placeholder="Uncategorised"
                size="large"
                style={{ width: '100%' }}
                options={CLASSIFICATION_OPTIONS}
              />
            </Field>
          </div>

          <Field label="Attachments">
            <Tooltip title="Add files after the ticket is raised, from the Documents tab.">
              <AntButton disabled icon={<Paperclip size={14} />}>
                Available after creation
              </AntButton>
            </Tooltip>
          </Field>

          {selectedWorkflow && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 space-y-0.5">
              <div className="font-medium text-gray-800 mb-0.5">Summary</div>
              <div>
                <span className="text-gray-500">Workflow:</span>{' '}
                <span className="font-medium">{displayWorkflowName(selectedWorkflow)}</span>
              </div>
              {priorityId && (
                <div>
                  <span className="text-gray-500">Priority:</span>{' '}
                  {priorities.find((p) => p.id === priorityId)?.name ?? '—'}
                </div>
              )}
              {severityId && (
                <div>
                  <span className="text-gray-500">Severity:</span>{' '}
                  {severities.find((s) => s.id === severityId)?.name ?? '—'}
                </div>
              )}
              {departmentId && (
                <div>
                  <span className="text-gray-500">Department:</span>{' '}
                  {departments.find((d) => d.id === departmentId)?.name ?? '—'}
                </div>
              )}
              {siteId && (
                <div>
                  <span className="text-gray-500">Site:</span>{' '}
                  {sites.find((s) => s.id === siteId)?.name ?? '—'}
                </div>
              )}
              {dueDate && (
                <div>
                  <span className="text-gray-500">Due:</span>{' '}
                  {dueDate.format('DD MMM YYYY')}
                </div>
              )}
              {classification && (
                <div>
                  <span className="text-gray-500">Classification:</span>{' '}
                  {CLASSIFICATION_OPTIONS.find((o) => o.value === classification)?.label}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

interface FieldProps {
  label: React.ReactNode;
  help?: string;
  required?: boolean;
  children: React.ReactNode;
}

function Field({ label, help, required, children }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
      {help && <p className="mt-1 text-[11px] text-gray-500">{help}</p>}
    </div>
  );
}
