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
import FieldValueText from './FieldValueText';
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
      // Wait for the form to load so we can seed each field's default value
      // (e.g. a table field's pre-filled default rows) before first render.
      if (!detail) return;
      if (hydratedFor !== `${formId}::none`) {
        const defaults: Record<string, Record<string, unknown>> = {};
        for (const sec of sections) {
          for (const f of sec.fields) {
            if (f.value !== undefined && f.value !== null) {
              defaults[sec.section_name] = {
                ...(defaults[sec.section_name] ?? {}),
                [f.name]: f.value,
              };
            }
          }
        }
        setResponses(defaults);
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
  }, [existing, submissionId, formId, hydratedFor, detail, sections]);

  // Tolerate stale dependency rules whose `sectionName` points at a section
  // that was later renamed in the builder. Field names are random-suffixed so
  // a cross-section collision is vanishingly rare; first match wins.
  const lookup = (sectionName: string, fieldName: string) => {
    const direct = responses[sectionName]?.[fieldName];
    if (direct !== undefined) return direct;
    if (!(sectionName in responses)) {
      for (const sec of Object.values(responses)) {
        if (sec && fieldName in sec) return sec[fieldName];
      }
    }
    return undefined;
  };

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
      ? 'rounded-lg border border-slate-200 bg-white px-5 py-5'
      : 'rounded-xl border border-slate-200 bg-white px-6 py-6';

  const errorCount = Object.values(errors).reduce(
    (n, s) => n + Object.keys(s).length,
    0,
  );

  let visibleSectionIndex = 0;

  return (
    <div className={variant === 'inline' ? 'space-y-4' : 'space-y-5'}>
      {sections.map((sec) => {
        if (!evaluateVisibility(sec.dependency, lookup)) return null;
        visibleSectionIndex += 1;
        const description = (sec as { description?: string }).description;
        const sectionErrorCount = Object.keys(errors[sec.section_name] ?? {}).length;
        return (
          <section
            key={sec.section_id ?? sec.section_name}
            className={sectionWrapCls}
          >
            <header className="mb-5 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-semibold ring-1 ring-indigo-100">
                  {visibleSectionIndex}
                </span>
                <h2
                  className={
                    variant === 'inline'
                      ? 'text-sm font-semibold text-slate-800'
                      : 'text-base font-semibold text-slate-800'
                  }
                >
                  {sec.section_name}
                </h2>
                {sectionErrorCount > 0 && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 ring-1 ring-rose-100">
                    <AlertCircle className="h-3 w-3" />
                    {sectionErrorCount} issue{sectionErrorCount === 1 ? '' : 's'}
                  </span>
                )}
              </div>
              {description && (
                <p className="text-sm text-slate-500 mt-1.5">{description}</p>
              )}
            </header>
            <div className="grid grid-cols-12 gap-x-5 gap-y-4">
              {sec.fields.map((f) => {
                if (!evaluateVisibility(f.dependency, lookup)) return null;
                const span = widthToCols(f.width);
                const err = errors[sec.section_name]?.[f.name];
                const helpText = (f as { helpText?: string }).helpText;
                const value = responses[sec.section_name]?.[f.name];
                const hasValue =
                  value !== undefined &&
                  value !== null &&
                  value !== '' &&
                  !(Array.isArray(value) && value.length === 0);
                return (
                  <div key={f.field_id ?? f.name} className={`col-span-12 ${span} min-w-0`}>
                    <label className="block text-[13px] font-medium text-slate-700 mb-1.5 leading-tight">
                      {f.label}
                      {f.required && <span className="text-rose-500 ml-0.5">*</span>}
                    </label>
                    {readOnly ? (
                      // Submitted / view-only: render the answer as plain readable
                      // text instead of a disabled input widget.
                      hasValue ? (
                        <FieldValueText field={f} value={value} />
                      ) : (
                        <span className="text-sm italic text-slate-400">Not answered</span>
                      )
                    ) : (
                      <FieldRenderer
                        field={f}
                        value={value}
                        onChange={(v) => setFieldValue(sec.section_name, f.name, v)}
                        protectDefaultRows
                      />
                    )}
                    {helpText && !err && (
                      <p className="mt-1 text-[11px] text-slate-500 leading-snug">{helpText}</p>
                    )}
                    {err && (
                      <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1 leading-snug">
                        <AlertCircle className="h-3 w-3 shrink-0" /> {err}
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
        <div className="flex items-center justify-end gap-2 pt-1">
          {errorCount > 0 && (
            <span className="mr-auto inline-flex items-center gap-1.5 text-xs text-rose-600">
              <AlertCircle className="h-3.5 w-3.5" />
              {errorCount} field{errorCount === 1 ? '' : 's'} need attention
            </span>
          )}
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
