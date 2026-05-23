/**
 * Embeddable, route-agnostic form fill UI extracted from FormFillPage.
 *
 * Renders the form's sections and fields, runs visibility + validation, and
 * handles draft + submit. Used both by the standalone FormFillPage (which wraps
 * it with a page header + back button) and inline within the ticket detail
 * page so users never leave the ticket context to complete a stage form.
 */
import { useEffect, useMemo, useState } from 'react';
import { Send, Save, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { App } from 'antd';
import { Button } from '@/components/ui/Button';
import FieldRenderer from './FieldRenderer';
import { useFormDetail, useSubmitForm, useSubmission } from './hooks';
import { useCreateWorkflowSubmission } from '@/lib/api/stageForm';
import { evaluateVisibility } from './lib/dependency';
import { validateField } from './lib/validation';
import type { FormSectionDef } from './types';

type Errors = Record<string, Record<string, string>>;

export interface FormFillEmbedProps {
  formId: string;
  /** Workflow context — when present, submissions route through the workflow endpoint. */
  workflowCtx?: { ticketId: string; bindingId: string } | null;
  /** Existing submission to hydrate the form with (for resume / view). */
  submissionId?: string | null;
  /** Lock the form to read-only (e.g., submitted forms). */
  readOnly?: boolean;
  /** Visual variant: 'card' renders standalone sections, 'inline' fits inside another card. */
  variant?: 'card' | 'inline';
  /** Fired after a successful submit or save. */
  onSubmitted?: (status: 'IN_PROGRESS' | 'SUBMITTED') => void;
  /** Hide Save Draft + Submit buttons (caller renders its own). */
  hideActions?: boolean;
}

export default function FormFillEmbed({
  formId,
  workflowCtx = null,
  submissionId = null,
  readOnly = false,
  variant = 'card',
  onSubmitted,
  hideActions = false,
}: FormFillEmbedProps) {
  const { modal } = App.useApp();
  const { data: detail, isLoading: loadingForm } = useFormDetail(formId);
  const { data: existing, isLoading: loadingSubmission } = useSubmission(
    submissionId ?? undefined,
  );

  const submitMutation = useSubmitForm();
  const workflowSubmit = useCreateWorkflowSubmission(
    workflowCtx?.ticketId ?? '',
    formId,
  );

  const [pendingStatus, setPendingStatus] = useState<'IN_PROGRESS' | 'SUBMITTED' | null>(
    null,
  );
  const isBusy = pendingStatus !== null;

  const sections = useMemo<FormSectionDef[]>(
    () => (detail?.draft_data as { sections?: FormSectionDef[] })?.sections ?? [],
    [detail],
  );

  const [responses, setResponses] = useState<Record<string, Record<string, unknown>>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);

  useEffect(() => {
    setErrors({});
  }, [formId, submissionId]);

  useEffect(() => {
    if (!submissionId) {
      if (hydratedFor !== `${formId}::none`) {
        setResponses({});
        setHydratedFor(`${formId}::none`);
      }
      return;
    }
    if (!existing) return;
    if (hydratedFor === `${formId}::${submissionId}`) return;
    const data = (existing.responses ?? {}) as Record<
      string,
      Record<string, unknown>
    >;
    setResponses(data);
    setHydratedFor(`${formId}::${submissionId}`);
  }, [existing, submissionId, formId, hydratedFor]);

  const lookup = (sectionName: string, fieldName: string) =>
    responses[sectionName]?.[fieldName];

  const setFieldValue = (sectionName: string, fieldName: string, v: unknown) => {
    if (readOnly) return;
    setResponses((prev) => ({
      ...prev,
      [sectionName]: { ...(prev[sectionName] ?? {}), [fieldName]: v },
    }));
    setErrors((e) => {
      if (!e[sectionName]?.[fieldName]) return e;
      const sec = { ...e[sectionName] };
      delete sec[fieldName];
      return { ...e, [sectionName]: sec };
    });
  };

  const runSubmit = async (status: 'IN_PROGRESS' | 'SUBMITTED') => {
    if (readOnly) return;
    setPendingStatus(status);
    try {
      if (workflowCtx) {
        await workflowSubmit.mutateAsync({
          bindingId: workflowCtx.bindingId,
          status,
          responses: responses as Record<string, unknown>,
        });
      } else {
        await submitMutation.mutateAsync({ formId, responses, status });
      }
      toast.success(status === 'SUBMITTED' ? 'Form submitted' : 'Saved as draft');
      onSubmitted?.(status);
    } catch (e) {
      const msg =
        (e as { response?: { data?: { error?: { message?: string }; message?: string } } })
          .response?.data?.error?.message ??
        (e as { response?: { data?: { message?: string } } }).response?.data?.message ??
        (e as Error).message;
      toast.error(msg);
    } finally {
      setPendingStatus(null);
    }
  };

  const handleSubmitClick = () => {
    if (readOnly) return;
    const next: Errors = {};
    for (const sec of sections) {
      if (!evaluateVisibility(sec.dependency, lookup)) continue;
      for (const f of sec.fields) {
        if (!evaluateVisibility(f.dependency, lookup)) continue;
        const err = validateField(f, lookup(sec.section_name, f.name));
        if (err) {
          next[sec.section_name] = { ...(next[sec.section_name] ?? {}), [f.name]: err };
        }
      }
    }
    if (Object.keys(next).length) {
      setErrors(next);
      const total = Object.values(next).reduce((n, s) => n + Object.keys(s).length, 0);
      toast.error(`${total} field${total === 1 ? '' : 's'} need attention`);
      return;
    }
    setErrors({});

    modal.confirm({
      title: 'Submit form',
      content:
        'Are you sure you want to submit this form? Once submitted you will not be able to edit your responses.',
      okText: 'Submit',
      cancelText: 'Cancel',
      centered: true,
      onOk: () => runSubmit('SUBMITTED'),
    });
  };

  if (loadingForm || (submissionId && loadingSubmission)) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-xs">Loading form…</span>
      </div>
    );
  }

  if (!detail) {
    return <div className="p-8 text-slate-500">Form not found.</div>;
  }

  const sectionWrapCls =
    variant === 'inline'
      ? 'rounded-lg border border-gray-200 bg-white p-4'
      : 'rounded-xl border border-slate-200 bg-white p-6';

  return (
    <div className={variant === 'inline' ? 'space-y-3' : 'space-y-5'}>
      {sections.map((sec) => {
        if (!evaluateVisibility(sec.dependency, lookup)) return null;
        const description = (sec as { description?: string }).description;
        return (
          <section
            key={sec.section_id ?? sec.section_name}
            className={sectionWrapCls}
          >
            <header className="mb-4 pb-2 border-b border-slate-100">
              <h2
                className={
                  variant === 'inline'
                    ? 'text-sm font-semibold text-slate-800'
                    : 'text-lg font-semibold text-slate-800'
                }
              >
                {sec.section_name}
              </h2>
              {description && (
                <p className="text-sm text-slate-500 mt-1">{description}</p>
              )}
            </header>
            <div className="grid grid-cols-12 gap-4">
              {sec.fields.map((f) => {
                if (!evaluateVisibility(f.dependency, lookup)) return null;
                const span = widthToCols(f.width);
                const err = errors[sec.section_name]?.[f.name];
                const helpText = (f as { helpText?: string }).helpText;
                return (
                  <div key={f.field_id ?? f.name} className={`col-span-12 ${span}`}>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      {f.label}
                      {f.required && <span className="text-rose-500 ml-0.5">*</span>}
                    </label>
                    <div className={readOnly ? 'pointer-events-none' : ''}>
                      <FieldRenderer
                        field={f}
                        value={responses[sec.section_name]?.[f.name]}
                        onChange={(v) => setFieldValue(sec.section_name, f.name, v)}
                        disabled={readOnly}
                      />
                    </div>
                    {helpText && !err && (
                      <p className="mt-1 text-xs text-slate-500">{helpText}</p>
                    )}
                    {err && (
                      <p className="mt-1 text-xs text-rose-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {err}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {!hideActions && !readOnly && (
        <div className="flex justify-end gap-2 pt-1">
          <Button
            variant="outline"
            onClick={() => runSubmit('IN_PROGRESS')}
            isLoading={pendingStatus === 'IN_PROGRESS'}
            disabled={isBusy}
          >
            <Save className="h-4 w-4" />
            <span className="ml-1.5">Save Draft</span>
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmitClick}
            isLoading={pendingStatus === 'SUBMITTED'}
            disabled={isBusy}
          >
            <Send className="h-4 w-4" />
            <span className="ml-1.5">Submit Section</span>
          </Button>
        </div>
      )}
    </div>
  );
}

const widthToCols = (w?: string) => {
  switch (w) {
    case '25':
      return 'md:col-span-3';
    case '33':
      return 'md:col-span-4';
    case '50':
      return 'md:col-span-6';
    case '66':
      return 'md:col-span-8';
    case '75':
      return 'md:col-span-9';
    default:
      return 'md:col-span-12';
  }
};
