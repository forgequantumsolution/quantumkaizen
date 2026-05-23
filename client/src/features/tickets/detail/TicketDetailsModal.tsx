import { useNavigate } from 'react-router-dom';
import { User as UserIcon, Calendar, Building2, Link2 } from 'lucide-react';
import { Modal } from '@/components/ui';
import { formatDate } from '@/lib/utils';
import type { TicketDetail } from '@/lib/api/ticket';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  ticket: TicketDetail;
}

export default function TicketDetailsModal({ isOpen, onClose, ticket }: Props) {
  const navigate = useNavigate();

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Ticket details" size="md">
      <div className="space-y-5">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
          {ticket.createdBy && (
            <Row icon={UserIcon} label="Created by" value={ticket.createdBy.name} />
          )}
          <Row icon={Calendar} label="Created" value={formatDate(ticket.createdAt)} />
          {ticket.department && (
            <Row icon={Building2} label="Department" value={ticket.department.name} />
          )}
          {ticket.priority && <Row label="Priority" value={ticket.priority.name} />}
          {ticket.parentTicket && (
            <Row
              icon={Link2}
              label="Parent ticket"
              value={
                <button
                  onClick={() => {
                    onClose();
                    navigate(`/tickets/${ticket.parentTicket!.id}`);
                  }}
                  className="text-blue-600 hover:underline truncate text-left"
                >
                  {ticket.parentTicket.uniqueId}
                </button>
              }
            />
          )}
        </dl>

        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
            Description
          </div>
          {ticket.description ? (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {ticket.description}
            </p>
          ) : (
            <p className="text-xs text-gray-400 italic">No description.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}

interface RowProps {
  icon?: React.ElementType;
  label: string;
  value: React.ReactNode;
}

function Row({ icon: Icon, label, value }: RowProps) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      {Icon ? (
        <Icon size={14} className="text-gray-400 shrink-0 mt-0.5" />
      ) : (
        <div className="w-3.5 shrink-0" />
      )}
      <div className="min-w-0">
        <div className="text-[11px] text-gray-500">{label}</div>
        <div className="truncate text-gray-800">{value}</div>
      </div>
    </div>
  );
}
