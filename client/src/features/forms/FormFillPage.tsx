// End-user fill view. Honors section + field visibility rules from the
// builder, runs validation on submit and shows inline errors.
//
// Workflow context (Phase 3.5): if the URL carries `ticketId` + `bindingId`
// query params, submission is routed through the workflow-bound endpoint
// (POST /tickets/:id/forms/:formId/submissions) so the resulting row carries
// the right FKs and counts toward `form.layer.findUnsatisfiedRequiredForms`.
//
// The actual form-rendering / save / submit lives in FormFillEmbed so the same
// component can be reused inline (e.g. inside the ticket detail page).
import { useMemo } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Lock } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import Spinner from '@/components/ui/Spinner';
import FormFillEmbed from './FormFillEmbed';
import { useFormDetail } from './hooks';
import { useTicketStageForms } from '@/lib/api/stageForm';

export default function FormFillPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const workflowCtx = useMemo(() => {
    const ticketId = params.get('ticketId');
    const bindingId = params.get('bindingId');
    return ticketId && bindingId ? { ticketId, bindingId } : null;
  }, [params]);
  const submissionId = params.get('submissionId');

  const nav = useNavigate();
  const { data: detail, isLoading } = useFormDetail(id);

  // Defense-in-depth: the backend gates fill/read, but resolve the binding's
  // access here too so we render read-only / no-access instead of letting the
  // user fill a whole form only to eat a 403 on submit.
  const { data: stageForms, isLoading: loadingAccess } = useTicketStageForms(
    workflowCtx?.ticketId,
  );
  const binding = useMemo(
    () =>
      workflowCtx
        ? stageForms?.bindings.find((b) => b.id === workflowCtx.bindingId) ?? null
        : null,
    [stageForms, workflowCtx],
  );

  if (isLoading || (workflowCtx && loadingAccess))
    return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!detail || !id) return <div className="p-8 text-slate-500">Form not found.</div>;

  // Workflow-bound + the user can't read this form → block the page entirely.
  if (workflowCtx && binding && !binding.canRead) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-3 py-16 text-slate-500">
          <Lock className="h-8 w-8 text-slate-400" />
          <p>You don’t have access to this form.</p>
          <button
            type="button"
            onClick={() => nav(`/tickets/${workflowCtx.ticketId}`)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to ticket</span>
          </button>
        </div>
      </PageContainer>
    );
  }

  // Can read but not fill → force the form into read-only mode.
  const forceReadOnly = !!workflowCtx && !!binding && !binding.canFill;

  return (
    <PageContainer>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-h1 text-gray-900">{detail.form_details.title}</h1>
        </div>
        <button
          type="button"
          onClick={() => nav(workflowCtx ? `/tickets/${workflowCtx.ticketId}` : '/forms')}
          className="shrink-0 mt-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 hover:border-slate-400 text-slate-700 hover:text-slate-900 px-3 py-1.5 text-sm font-medium shadow-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back</span>
        </button>
      </div>

      <FormFillEmbed
        formId={id}
        workflowCtx={workflowCtx}
        submissionId={submissionId}
        readOnly={forceReadOnly}
        variant="card"
        onSubmitted={(status) => {
          if (status === 'SUBMITTED') {
            nav(workflowCtx ? `/tickets/${workflowCtx.ticketId}` : '/forms');
          }
        }}
      />
    </PageContainer>
  );
}
