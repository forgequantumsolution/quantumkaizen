import { Badge } from '@/components/ui';
import { Pause, CheckCircle, Circle, XCircle } from 'lucide-react';
import { ticketOutcome, type TicketSummary } from '@/lib/api/ticket';

export default function TicketStatusBadge({ ticket }: { ticket: TicketSummary }) {
  switch (ticketOutcome(ticket)) {
    case 'no-flow':
      return <Badge variant="default">No flow</Badge>;
    case 'rejected':
      return (
        <Badge variant="danger">
          <XCircle size={10} className="inline mr-1 -mt-px" />
          Rejected
        </Badge>
      );
    case 'completed':
      return (
        <Badge variant="success">
          <CheckCircle size={10} className="inline mr-1 -mt-px" />
          Completed
        </Badge>
      );
    case 'on-hold':
      return (
        <Badge variant="warning">
          <Pause size={10} className="inline mr-1 -mt-px" />
          On Hold
        </Badge>
      );
    default:
      return (
        <Badge variant="info">
          <Circle size={10} className="inline mr-1 -mt-px" />
          Open
        </Badge>
      );
  }
}
