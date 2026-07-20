import { api } from '@/lib/api';
import type { FormDetailResponse, FormSectionDef } from '@/features/forms/types';
import type { SubmittedFormHistoryItem } from '@/lib/api/stageForm';
import { formatFieldValue } from './formatFieldValue';
import type { ReportForm, ReportFormSection, TicketReportData } from './reportTypes';

// Backend wraps some GETs in { status, data }. Unwrap defensively.
const unwrap = <T>(raw: unknown): T => {
  const r = raw as { data?: unknown };
  return (r?.data ?? raw) as T;
};

const sectionsOf = (detail: FormDetailResponse): FormSectionDef[] => {
  const dd = detail?.draft_data as { sections?: FormSectionDef[] } | undefined;
  return Array.isArray(dd?.sections) ? dd!.sections! : [];
};

// Resolve one submitted form to its schema-labelled section/field values.
async function enrichForm(h: SubmittedFormHistoryItem): Promise<ReportForm> {
  const base: ReportForm = {
    id: h.id,
    title: h.formTitle,
    stageName: h.stageName,
    status: h.status,
    submittedBy: h.submittedBy?.name ?? null,
    submittedAt: h.submittedAt,
    sections: [],
  };

  try {
    const sub = unwrap<{
      formId: string;
      responses: Record<string, Record<string, unknown>>;
    }>((await api.get(`/form-submissions/${h.id}`)).data);

    const detail = unwrap<FormDetailResponse>(
      (await api.get(`/forms/form/fields/get/${sub.formId ?? h.formId}/`)).data,
    );

    const responses = sub.responses ?? {};
    const sections: ReportFormSection[] = sectionsOf(detail)
      .map((sec) => {
        const bag = responses[sec.section_name] ?? {};
        const fields = (sec.fields ?? [])
          .map((f) => formatFieldValue(f, bag[f.name]))
          // Drop empty non-table answers to keep the report tight.
          .filter((rf) => rf.table || (rf.text && rf.text !== '—'));
        return { name: sec.section_name, fields };
      })
      .filter((s) => s.fields.length > 0);

    return { ...base, sections };
  } catch {
    // Schema/responses unavailable → keep the form's metadata row.
    return base;
  }
}

/**
 * Fetches and assembles the complete dataset for a ticket's PDF report,
 * including per-form field values (checklists/forms) and child tickets. Runs
 * once per download; no new backend endpoints — it composes existing ones.
 */
export async function assembleTicketReportData(ticketId: string): Promise<TicketReportData> {
  const [org, ticket, timeline, commentsRes, docs, formsHist, childrenRes] = await Promise.all([
    api.get('/organization').then((r) => r.data),
    api.get(`/tickets/${ticketId}`).then((r) => r.data),
    api.get(`/tickets/${ticketId}/timeline`).then((r) => r.data),
    api.get(`/tickets/${ticketId}/comments`, { params: { pageSize: 100 } }).then((r) => r.data),
    api.get(`/tickets/${ticketId}/docs`).then((r) => r.data),
    api.get(`/tickets/${ticketId}/form-submissions`).then((r) => r.data),
    api
      .get(`/tickets/${ticketId}/children`)
      .then((r) => r.data)
      .catch(() => ({ data: [] })),
  ]);

  const history = (formsHist?.submissions ?? []) as SubmittedFormHistoryItem[];
  const forms = await Promise.all(history.map(enrichForm));

  return {
    org,
    ticket,
    timeline,
    comments: commentsRes?.items ?? [],
    docs: docs ?? [],
    forms,
    children: childrenRes?.data ?? [],
  };
}
