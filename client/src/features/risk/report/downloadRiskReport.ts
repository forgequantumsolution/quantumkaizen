import { createElement } from 'react';
import { assembleRiskReportData } from './assembleRiskReportData';

/**
 * Builds and downloads a single risk's branded PDF report — identification,
 * evaluation, the framework scales behind the score, controls, links, reviews,
 * acceptance and audit trail. The @react-pdf engine and the document are
 * code-split so they load only when a report is actually requested.
 */
export async function downloadRiskReport(riskId: string, riskNumber: string): Promise<void> {
  const data = await assembleRiskReportData(riskId);

  const [{ pdf }, { default: RiskReportDocument }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./RiskReportDocument'),
  ]);

  const element = createElement(RiskReportDocument, data) as Parameters<typeof pdf>[0];
  const blob = await pdf(element).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${riskNumber}-report.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
