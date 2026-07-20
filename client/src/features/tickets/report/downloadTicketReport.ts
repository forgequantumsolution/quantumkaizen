import { createElement } from 'react';
import { assembleTicketReportData } from './assembleTicketReportData';

/**
 * Builds and downloads a ticket's branded PDF report — full detail incl. form
 * field values and child tickets. The @react-pdf engine + document are
 * code-split so they load only when a report is actually requested.
 */
export async function downloadTicketReport(ticketId: string, uniqueId: string): Promise<void> {
  const data = await assembleTicketReportData(ticketId);

  const [{ pdf }, { default: TicketReportDocument }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('./TicketReportDocument'),
  ]);

  const element = createElement(TicketReportDocument, data) as Parameters<typeof pdf>[0];
  const blob = await pdf(element).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${uniqueId}-report.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
