import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Drawer,
  Steps,
  Input as AntInput,
  Select as AntSelect,
  Button as AntButton,
  Space,
  Tag,
  Tooltip,
} from 'antd';
import {
  ArrowRight,
  ArrowLeft as ArrowLeftIcon,
  CheckCircle2,
  Paperclip,
  Workflow as WorkflowIcon,
  Flag,
} from 'lucide-react';
import { useRaiseTicket } from '@/lib/api/ticket';
import { useWorkflows } from '@/lib/api/workflow';
import { usePriorities } from '@/lib/api/workflowLookups';
import TicketFlowCanvas from '../detail/TicketFlowCanvas';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const PRIORITY_TONE: Record<string, string> = {
  critical: '#DC2626',
  high: '#F59E0B',
  medium: '#3B82F6',
  low: '#94A3B8',
};

export default function RaiseTicketDrawer({ isOpen, onClose }: Props) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [workflowId, setWorkflowId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priorityId, setPriorityId] = useState<string | undefined>(undefined);

  const { data: workflowsData, isLoading: loadingWorkflows } = useWorkflows({
    status: 'ACTIVE',
    pageSize: 100,
  });
  const { data: priorities = [] } = usePriorities();
  const raise = useRaiseTicket();

  const activeWorkflows = useMemo(
    () => (workflowsData?.items ?? []).filter((w) => w.workflowStatus === 'ACTIVE'),
    [workflowsData],
  );

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
                label: w.type ? `${w.name} (${w.type.name})` : w.name,
              }))}
            />
          </Field>

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

          {workflowId && (
            <Field
              label={
                <span className="flex items-center gap-1.5">
                  <WorkflowIcon size={12} className="text-gray-400" />
                  Workflow preview
                </span>
              }
              help="Read-only — this is the graph your ticket will move through."
            >
              <TicketFlowCanvas
                workflowId={workflowId}
                height={260}
                interactive={false}
                direction="TB"
              />
              {selectedWorkflow?.type && (
                <p className="mt-2 text-[11px] text-gray-500">
                  Type: <span className="font-medium">{selectedWorkflow.type.name}</span>
                </p>
              )}
            </Field>
          )}
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

          <Field label="Attachments">
            <Tooltip title="Add files after the ticket is raised, from the Documents tab.">
              <AntButton disabled icon={<Paperclip size={14} />}>
                Available after creation
              </AntButton>
            </Tooltip>
          </Field>

          {selectedWorkflow && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <div className="font-medium text-gray-800 mb-0.5">Summary</div>
              <div>
                <span className="text-gray-500">Workflow:</span>{' '}
                <span className="font-medium">{selectedWorkflow.name}</span>
              </div>
              {priorityId && (
                <div>
                  <span className="text-gray-500">Priority:</span>{' '}
                  {priorities.find((p) => p.id === priorityId)?.name ?? '—'}
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
