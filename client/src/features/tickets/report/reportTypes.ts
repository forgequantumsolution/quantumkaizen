import type { Organization } from '@/features/admin/organization/hooks';
import type {
  TicketDetail,
  TimelineEntry,
  TicketComment,
  TicketDoc,
} from '@/lib/api/ticket';
import type { TicketChild } from '@/lib/api/finding';

// A single answered field on a submitted form/checklist. Either a scalar `text`
// value or a nested `table` (for table-type fields).
export interface ReportField {
  label: string;
  type: string;
  text: string;
  table?: { columns: string[]; rows: string[][] };
}

export interface ReportFormSection {
  name: string;
  fields: ReportField[];
}

// A submitted form/checklist enriched with its schema-resolved field values.
export interface ReportForm {
  id: string;
  title: string;
  stageName: string | null;
  status: string;
  submittedBy: string | null;
  submittedAt: string | null;
  /** Empty when the schema or responses couldn't be resolved. */
  sections: ReportFormSection[];
}

// Everything the ticket PDF report renders. Assembled imperatively so the
// per-form schema/response fan-out (a dynamic count) stays out of React hooks.
export interface TicketReportData {
  org: Organization;
  ticket: TicketDetail;
  timeline: TimelineEntry[];
  comments: TicketComment[];
  docs: TicketDoc[];
  forms: ReportForm[];
  children: TicketChild[];
}
