import { useState } from 'react';
import toast from 'react-hot-toast';
import { UserCheck, UserPlus } from 'lucide-react';
import { Card, Button, Modal, Select, Textarea } from '@/components/ui';
import { useUserDirectory } from '@/features/admin/users/hooks';
import { useAssignTicket, type TicketDetail } from '@/lib/api/ticket';

/**
 * Assignee rail card — shows who is currently responsible for the ticket and,
 * for users who can update it, lets them (re)assign. Manual reassignment
 * preserves the escalation ladder position; automatic escalation on SLA
 * breach / assignee-unavailable is handled server-side.
 */
export default function AssigneeCard({
  ticket,
  canUpdate,
}: {
  ticket: TicketDetail;
  canUpdate: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string>(ticket.assignee?.id ?? '');
  const [note, setNote] = useState('');
  const { data: directory } = useUserDirectory(ticket.site?.id);
  const assign = useAssignTicket(ticket.id);

  const people = directory?.items ?? [];

  const openModal = () => {
    setSelected(ticket.assignee?.id ?? '');
    setNote('');
    setOpen(true);
  };

  const save = async () => {
    try {
      await assign.mutateAsync({
        assigneeId: selected || null,
        note: note.trim() || undefined,
      });
      toast.success(selected ? 'Ticket assigned' : 'Assignment cleared');
      setOpen(false);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Failed to assign';
      toast.error(msg);
    }
  };

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Assignee</h3>
        {canUpdate && (
          <button
            type="button"
            onClick={openModal}
            className="text-xs font-medium text-blue-600 hover:text-blue-800"
          >
            {ticket.assignee ? 'Reassign' : 'Assign'}
          </button>
        )}
      </div>

      {ticket.assignee ? (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
            <UserCheck size={16} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-gray-900">
              {ticket.assignee.name}
            </div>
            {ticket.assignee.email && (
              <div className="truncate text-xs text-gray-500">{ticket.assignee.email}</div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <UserPlus size={15} /> Unassigned
        </div>
      )}
      {ticket.escalationLevel > 0 && (
        <div className="mt-2 inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
          Escalated · level {ticket.escalationLevel}
        </div>
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Assign ticket"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} disabled={assign.isPending}>
              {assign.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Select
            label="Assignee"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            placeholder="Unassigned"
            options={[
              { value: '', label: 'Unassigned' },
              ...people.map((p) => {
                const base = p.designation ? `${p.name} · ${p.designation}` : p.name;
                return {
                  value: p.id,
                  label: p.isAvailable ? base : `${base} (out of office)`,
                };
              }),
            ]}
          />
          <Textarea
            label="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why is this being reassigned?"
            rows={2}
          />
        </div>
      </Modal>
    </Card>
  );
}
