/**
 * "Assess risk" — the drop-in that lets any module raise risk work from its own
 * record.
 *
 *   <AssessRiskButton
 *     entityType="Ticket"
 *     entityId={ticket.id}
 *     defaultTitle={`${ticket.uniqueId} — ${ticket.title}`}
 *   />
 *
 * The host page supplies what it knows and nothing else: where the risk lands
 * (register, framework, category) and whether a full assessment or a single risk
 * is appropriate come from the configured trigger rule, not from this component.
 * That is what stops every module growing its own opinion about risk routing.
 *
 * Idempotent by construction — the backend returns the existing record when risk
 * work already exists for this source, so two people pressing this on the same
 * finding get one risk and both get taken to it.
 *
 * See docs/RISK-cross-module-integration-plan.md §C.4.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Drawer, Form, Input, message } from 'antd';
import { ShieldPlus } from 'lucide-react';
import { useHasPermission } from '@/stores/authStore';
import { useRunTrigger, type TriggerBody } from '@/lib/api/risk';

const extractErr = (err: unknown): string => {
  const res = (err as { response?: { data?: { error?: { message?: string }; message?: string } } })
    ?.response?.data;
  return res?.error?.message ?? res?.message ?? (err as { message?: string })?.message ?? 'Could not raise risk work';
};

export interface AssessRiskButtonProps {
  /** A type the backend registry knows — Ticket, Finding, Capa, OosInvestigation… */
  entityType: string;
  entityId: string;
  /** Prefills the title; the user can refine it before submitting. */
  defaultTitle: string;
  defaultDescription?: string | null;
  /** Matched against the trigger rule's condition, e.g. { severity: 'MAJOR' }. */
  attributes?: Record<string, unknown>;
  relation?: string;
  size?: 'small' | 'middle' | 'large';
  block?: boolean;
}

export default function AssessRiskButton({
  entityType,
  entityId,
  defaultTitle,
  defaultDescription,
  attributes,
  relation,
  size = 'small',
  block = false,
}: AssessRiskButtonProps) {
  const nav = useNavigate();
  const canCreate = useHasPermission('risk.create');
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm<{ title: string; description?: string; cause?: string }>();
  const mut = useRunTrigger();

  if (!canCreate) return null;

  const submit = async () => {
    const v = await form.validateFields();
    const body: TriggerBody = {
      triggerType: entityType,
      triggerId: entityId,
      ...(relation ? { relation } : {}),
      ...(attributes ? { attributes } : {}),
      seed: {
        title: v.title.trim(),
        description: v.description?.trim() || defaultDescription || null,
        cause: v.cause?.trim() || null,
      },
    };
    try {
      const result = await mut.mutateAsync(body);
      setOpen(false);
      message.success(
        result.reused
          ? `${result.number} already covers this record`
          : `${result.number} raised`,
      );
      nav(result.mode === 'ASSESSMENT' ? `/risk/assessments/${result.id}` : `/risk/risks/${result.id}`);
    } catch (err) {
      message.error(extractErr(err));
    }
  };

  return (
    <>
      <Button
        size={size}
        block={block}
        icon={<ShieldPlus size={14} />}
        onClick={() => {
          setOpen(true);
          setTimeout(() =>
            form.setFieldsValue({
              title: defaultTitle.slice(0, 300),
              description: defaultDescription ?? '',
              cause: '',
            }),
          );
        }}
      >
        Assess risk
      </Button>

      <Drawer
        title="Raise risk work"
        width={480}
        open={open}
        onClose={() => setOpen(false)}
        destroyOnClose
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="primary" loading={mut.isPending} onClick={submit}>
              Raise
            </Button>
          </div>
        }
      >
        <p className="mb-4 text-xs text-gray-500">
          The register, framework and category this lands in are set by your organisation&rsquo;s
          risk trigger rules. If risk work already exists for this record you will be taken to it
          rather than creating a duplicate.
        </p>
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item name="title" label="Risk title" rules={[{ required: true, message: 'A title is required' }]}>
            <Input maxLength={300} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} maxLength={5000} />
          </Form.Item>
          <Form.Item name="cause" label="Cause" extra="What about this record gives rise to the risk.">
            <Input.TextArea rows={2} maxLength={2000} />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
