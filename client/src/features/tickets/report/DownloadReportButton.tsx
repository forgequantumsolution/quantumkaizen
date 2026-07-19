import { useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { downloadTicketReport } from './downloadTicketReport';

interface Props {
  ticketId: string;
  ticketUniqueId: string;
}

/**
 * Ticket-detail header action: builds and downloads the full branded PDF report
 * on click. Fetches its data on demand and lazy-loads the PDF engine, so nothing
 * heavy runs until the user asks for a report.
 */
export default function DownloadReportButton({ ticketId, ticketUniqueId }: Props) {
  const [generating, setGenerating] = useState(false);

  const handleClick = async () => {
    if (generating) return;
    setGenerating(true);
    const toastId = toast.loading('Preparing report…');
    try {
      await downloadTicketReport(ticketId, ticketUniqueId);
      toast.success('Report downloaded', { id: toastId });
    } catch (err) {
      console.error('Report generation failed', err);
      toast.error('Could not generate the report.', { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={generating}
      title="Download PDF report"
    >
      {generating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      <span className="ml-1">Report</span>
    </Button>
  );
}
