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
import { ArrowLeft } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import FormFillEmbed from './FormFillEmbed';
import { useFormDetail } from './hooks';

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

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!detail || !id) return <div className="p-8 text-slate-500">Form not found.</div>;

  return (
    <PageContainer>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => nav(workflowCtx ? `/tickets/${workflowCtx.ticketId}` : '/forms')}
        className="mb-2"
      >
        <ArrowLeft className="h-4 w-4" />{' '}
        {workflowCtx ? 'Back to ticket' : 'Back to forms'}
      </Button>
      <PageHeader
        title={detail.form_details.title}
        description={detail.form_details.description ?? undefined}
      />

      <FormFillEmbed
        formId={id}
        workflowCtx={workflowCtx}
        submissionId={submissionId}
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
