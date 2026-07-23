import { createElement } from 'react';
import { assembleRegisterReportData } from './assembleRegisterReportData';

/**
 * Builds and downloads a risk register's branded PDF report — profile, residual
 * heat map, the full risk table and the exception list. The @react-pdf engine +
 * document are code-split so they load only when a report is actually requested.
 */
export async function downloadRegisterReport(
  registerId: string,
  registerNumber: string,
): Promise<void> {
  const data = await assembleRegisterReportData(registerId);

  const [{ pdf }, { default: RiskRegisterReportDocument }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./RiskRegisterReportDocument'),
  ]);

  const element = createElement(RiskRegisterReportDocument, data) as Parameters<typeof pdf>[0];
  const blob = await pdf(element).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${registerNumber}-register-report.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
