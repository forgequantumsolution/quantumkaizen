import { Badge } from '@/components/ui';
import { Pause, CheckCircle, Circle, XCircle } from 'lucide-react';
import type { TicketSummary } from '@/lib/api/ticket';

export default function TicketStatusBadge({ ticket }: { ticket: TicketSummary }) {
  if (ticket.isOnHold) {
    return (
      <Badge variant="warning">
        <Pause size={10} className="inline mr-1 -mt-px" />
        On Hold
      </Badge>
    );
  }
  const flow = ticket.flows[0];
  if (!flow) return <Badge variant="default">No flow</Badge>;
  // Rejected takes precedence over completed — a rejected flow is also
  // isCompleted (no current stages), but its status must read "Rejected".
  if (flow.isRejected) {
    return (
      <Badge variant="danger">
        <XCircle size={10} className="inline mr-1 -mt-px" />
        Rejected
      </Badge>
    );
  }
  if (flow.isCompleted) {
    return (
      <Badge variant="success">
        <CheckCircle size={10} className="inline mr-1 -mt-px" />
        Completed
      </Badge>
    );
  }
  return (
    <Badge variant="info">
      <Circle size={10} className="inline mr-1 -mt-px" />
      Open
    </Badge>
  );
}
