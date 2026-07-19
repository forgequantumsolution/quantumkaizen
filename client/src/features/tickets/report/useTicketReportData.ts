import { useOrganization, type Organization } from '@/features/admin/organization/hooks';
import {
  useTicket,
  useTicketTimeline,
  useTicketComments,
  useTicketDocs,
  type TicketDetail,
  type TimelineEntry,
  type TicketComment,
  type TicketDoc,
} from '@/lib/api/ticket';
import {
  useTicketFormHistory,
  type SubmittedFormHistoryItem,
} from '@/lib/api/stageForm';

export interface TicketReportData {
  org: Organization;
  ticket: TicketDetail;
  timeline: TimelineEntry[];
  comments: TicketComment[];
  docs: TicketDoc[];
  forms: SubmittedFormHistoryItem[];
}

/**
 * Composes every query the ticket report needs into one gate. `ready` flips
 * true only once all sources have resolved, so the PDF is built from a
 * complete dataset. No new backend endpoints — every field is already served.
 */
export function useTicketReportData(id: string | undefined) {
  const org = useOrganization();
  const ticket = useTicket(id);
  const timeline = useTicketTimeline(id);
  const comments = useTicketComments(id);
  const docs = useTicketDocs(id);
  const forms = useTicketFormHistory(id);

  const queries = [org, ticket, timeline, comments, docs, forms];
  const isLoading = queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  const ready =
    !!org.data &&
    !!ticket.data &&
    !!timeline.data &&
    !!comments.data &&
    !!docs.data &&
    !!forms.data;

  const data: TicketReportData | null = ready
    ? {
        org: org.data!,
        ticket: ticket.data!,
        timeline: timeline.data!,
        comments: comments.data!.items,
        docs: docs.data!,
        forms: forms.data!.submissions,
      }
    : null;

  return { ready, isLoading, isError, data };
}
