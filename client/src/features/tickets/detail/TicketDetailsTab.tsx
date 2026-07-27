import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal, Select, Input, DatePicker, message } from 'antd';
import dayjs from 'dayjs';
import { Card, Button } from '@/components/ui';
import { useUpdateTicket, type TicketDetail } from '@/lib/api/ticket';
import { usePriorities } from '@/lib/api/workflowLookups';
import { useDepartments } from '@/features/admin/departments/hooks';

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString() : '—';

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-gray-900 truncate">{value}</div>
    </div>
  );
}

/**
 * In-page editable details card — the ticket equivalent of the CAPA "Details"
 * tab. Shared by every workflow module's detail page.
 */
export default function TicketDetailsTab({
  ticket,
  canEdit,
}: {
  ticket: TicketDetail;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const flow = ticket.flows[0];

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Details</h3>
        {canEdit && (
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            Edit
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
        <Info label="Module" value={flow?.workflow.name ?? '—'} />
        <Info label="Priority" value={ticket.priority?.name ?? '—'} />
        <Info label="Department" value={ticket.department?.name ?? '—'} />
        <Info label="Due date" value={fmtDate(ticket.dueDate)} />
        <Info label="Created by" value={ticket.createdBy?.name ?? '—'} />
        <Info label="Created" value={fmtDate(ticket.createdAt)} />
        {ticket.site && <Info label="Site" value={ticket.site.name} />}
        {ticket.severity && <Info label="Severity" value={ticket.severity.name} />}
      </div>

      {ticket.parentTicket && (
        <div className="mt-3 border-t border-gray-100 pt-3 text-sm">
          <div className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">
            Parent ticket
          </div>
          <Link
            to={`/tickets/${ticket.parentTicket.id}`}
            className="font-mono text-blue-600 hover:underline"
          >
            {ticket.parentTicket.uniqueId}
          </Link>
        </div>
      )}

      <div className="mt-3 border-t border-gray-100 pt-3">
        <div className="mb-1 text-[11px] uppercase tracking-wide text-gray-500">Description</div>
        {ticket.description ? (
          <p className="whitespace-pre-wrap text-sm text-gray-800">
            {ticket.description}
          </p>
        ) : (
          <p className="text-xs italic text-gray-400">No description.</p>
        )}
      </div>

      <EditTicketModal ticket={ticket} open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

function EditTicketModal({
  ticket,
  open,
  onClose,
}: {
  ticket: TicketDetail;
  open: boolean;
  onClose: () => void;
}) {
  const updateMut = useUpdateTicket(ticket.id);
  const { data: priorities = [] } = usePriorities();
  const { data: deptsResp } = useDepartments({ pageSize: 200 });
  const departments = deptsResp?.items ?? [];

  const [title, setTitle] = useState(ticket.title);
  const [priorityId, setPriorityId] = useState<string | undefined>(ticket.priority?.id);
  const [departmentId, setDepartmentId] = useState<string | undefined>(ticket.department?.id);
  const [dueDate, setDueDate] = useState<string | undefined>(ticket.dueDate ?? undefined);
  const [description, setDescription] = useState(ticket.description ?? '');

  useEffect(() => {
    if (open) {
      setTitle(ticket.title);
      setPriorityId(ticket.priority?.id);
      setDepartmentId(ticket.department?.id);
      setDueDate(ticket.dueDate ?? undefined);
      setDescription(ticket.description ?? '');
    }
  }, [open, ticket]);

  const submit = async () => {
    if (!title.trim()) {
      message.error('Title is required');
      return;
    }
    try {
      await updateMut.mutateAsync({
        title: title.trim(),
        priorityId: priorityId ?? null,
        departmentId: departmentId ?? null,
        dueDate: dueDate ?? null,
        description: description.trim() || null,
      });
      message.success('Ticket updated');
      onClose();
    } catch (err) {
      message.error(
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data
          ?.error?.message ?? 'Update failed',
      );
    }
  };

  return (
    <Modal
      title="Edit details"
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Save"
      okButtonProps={{ loading: updateMut.isPending }}
    >
      <div className="space-y-3">
        <Field label="Title">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Priority">
            <Select
              value={priorityId}
              onChange={setPriorityId}
              allowClear
              showSearch
              optionFilterProp="label"
              options={priorities.map((p) => ({ value: p.id, label: p.name }))}
              className="w-full"
              placeholder="Priority"
            />
          </Field>
          <Field label="Department">
            <Select
              value={departmentId}
              onChange={setDepartmentId}
              allowClear
              showSearch
              optionFilterProp="label"
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
              className="w-full"
              placeholder="Department"
            />
          </Field>
        </div>
        <Field label="Due date">
          <DatePicker
            value={dueDate ? dayjs(dueDate) : null}
            onChange={(d) => setDueDate(d ? d.format('YYYY-MM-DD') : undefined)}
            className="w-full"
          />
        </Field>
        <Field label="Description">
          <Input.TextArea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-gray-600">{label}</label>
      {children}
    </div>
  );
}
