import { createElement } from 'react';
import { assembleAssessmentReportData } from './assembleAssessmentReportData';

/**
 * Builds and downloads a risk assessment's branded PDF — the signed analysis
 * record: particulars, the full FMEA/matrix worksheet, promoted risks, the
 * scales actually used, the approval and the audit trail. The @react-pdf engine
 * and the document are code-split so they load only when a report is requested.
 */
export async function downloadAssessmentReport(
  assessmentId: string,
  assessmentNumber: string,
): Promise<void> {
  const data = await assembleAssessmentReportData(assessmentId);

  const [{ pdf }, { default: RiskAssessmentReportDocument }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./RiskAssessmentReportDocument'),
  ]);

  const element = createElement(RiskAssessmentReportDocument, data) as Parameters<typeof pdf>[0];
  const blob = await pdf(element).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${assessmentNumber}-assessment-report.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
