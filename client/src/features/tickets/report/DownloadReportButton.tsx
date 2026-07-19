import { createElement, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { useTicketReportData } from './useTicketReportData';

interface Props {
  ticketId: string;
  ticketUniqueId: string;
}

/**
 * Downloads a branded PDF report for a ticket. The @react-pdf/renderer engine
 * and the report document are code-split — imported only on first click so they
 * stay out of the main bundle. If the underlying data is still loading when the
 * user clicks, generation is deferred until it resolves.
 */
export default function DownloadReportButton({ ticketId, ticketUniqueId }: Props) {
  const { ready, isError, data } = useTicketReportData(ticketId);
  const [generating, setGenerating] = useState(false);
  const wantsDownload = useRef(false);

  const generate = async () => {
    if (!data) return;
    setGenerating(true);
    try {
      const [{ pdf }, { default: TicketReportDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./TicketReportDocument'),
      ]);
      const element = createElement(TicketReportDocument, data) as Parameters<typeof pdf>[0];
      const blob = await pdf(element).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${ticketUniqueId}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Report generation failed', err);
      toast.error('Could not generate the report.');
    } finally {
      setGenerating(false);
      wantsDownload.current = false;
    }
  };

  // If the user clicked before the data resolved, fire once it's ready.
  useEffect(() => {
    if (wantsDownload.current && ready && data && !generating) {
      void generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, data]);

  const handleClick = () => {
    if (generating) return;
    if (isError) {
      toast.error('Report data failed to load.');
      return;
    }
    if (!ready || !data) {
      wantsDownload.current = true;
      toast('Preparing report…');
      return;
    }
    void generate();
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={generating}
      title="Download PDF report"
    >
      {generating ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <Download size={14} />
      )}
      <span className="ml-1">Report</span>
    </Button>
  );
}
