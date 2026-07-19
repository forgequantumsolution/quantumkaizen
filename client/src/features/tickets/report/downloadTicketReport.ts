import { createElement } from 'react';
import { api } from '@/lib/api';
import type { TicketReportData } from './useTicketReportData';

/**
 * Imperatively builds and downloads a ticket's branded PDF report. Unlike the
 * `useTicketReportData` hook (used by the detail-page button where the data is
 * already in cache), this fetches everything on demand — for list rows that
 * only hold summary data. The @react-pdf engine + document are code-split so
 * they load only when a report is actually requested.
 */
export async function downloadTicketReport(ticketId: string, uniqueId: string): Promise<void> {
  const [org, ticket, timeline, commentsRes, docs, formsRes] = await Promise.all([
    api.get('/organization').then((r) => r.data),
    api.get(`/tickets/${ticketId}`).then((r) => r.data),
    api.get(`/tickets/${ticketId}/timeline`).then((r) => r.data),
    api.get(`/tickets/${ticketId}/comments`, { params: { pageSize: 100 } }).then((r) => r.data),
    api.get(`/tickets/${ticketId}/docs`).then((r) => r.data),
    api.get(`/tickets/${ticketId}/form-submissions`).then((r) => r.data),
  ]);

  const data: TicketReportData = {
    org,
    ticket,
    timeline,
    comments: commentsRes?.items ?? [],
    docs: docs ?? [],
    forms: formsRes?.submissions ?? [],
  };

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
