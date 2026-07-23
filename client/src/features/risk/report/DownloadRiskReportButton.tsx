/**
 * One button for all three Risk PDF reports.
 *
 * Data assembly and the @react-pdf engine are both loaded on demand — nothing
 * heavy runs until a report is actually requested — mirroring
 * features/tickets/report/DownloadReportButton.tsx.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';

export type RiskReportKind = 'risk' | 'register' | 'assessment';

interface Props {
  kind: RiskReportKind;
  /** Record id to report on. */
  id: string;
  /** Human-readable number — used for the filename and the toast. */
  number: string;
  label?: string;
  variant?: 'outline' | 'primary' | 'ghost';
  size?: 'sm' | 'md';
}

const TITLE: Record<RiskReportKind, string> = {
  risk: 'Download risk report (PDF)',
  register: 'Download register report (PDF)',
  assessment: 'Download assessment report (PDF)',
};

export default function DownloadRiskReportButton({
  kind,
  id,
  number,
  label = 'Report',
  variant = 'outline',
  size = 'sm',
}: Props) {
  const [generating, setGenerating] = useState(false);

  const handleClick = async () => {
    if (generating || !id) return;
    setGenerating(true);
    const toastId = toast.loading(`Preparing ${number} report…`);
    try {
      // Code-split per report kind so a page only pulls the document it can emit.
      if (kind === 'risk') {
        const { downloadRiskReport } = await import('./downloadRiskReport');
        await downloadRiskReport(id, number);
      } else if (kind === 'register') {
        const { downloadRegisterReport } = await import('./downloadRegisterReport');
        await downloadRegisterReport(id, number);
      } else {
        const { downloadAssessmentReport } = await import('./downloadAssessmentReport');
        await downloadAssessmentReport(id, number);
      }
      toast.success('Report downloaded', { id: toastId });
    } catch (err) {
      console.error('Risk report generation failed', err);
      toast.error('Could not generate the report.', { id: toastId });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={generating}
      title={TITLE[kind]}
    >
      {generating ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      <span className="ml-1">{label}</span>
    </Button>
  );
}
