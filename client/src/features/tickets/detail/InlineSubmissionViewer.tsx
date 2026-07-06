/**
 * Read-only inline view of a single FormSubmission. Used inside ticket detail
 * cards (RequiredFormsCard / SubmittedFormsCard) so users can see what was
 * filled without navigating away to FormFillPage.
 */
import { useMemo } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import FieldValueText from '@/features/forms/FieldValueText';
import { useFormDetail, useSubmission } from '@/features/forms/hooks';
import { evaluateVisibility } from '@/features/forms/lib/dependency';
import type { FormSectionDef } from '@/features/forms/types';

interface Props {
  formId: string;
  submissionId: string;
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

export default function InlineSubmissionViewer({ formId, submissionId }: Props) {
  const { data: formDetail, isLoading: loadingForm } = useFormDetail(formId);
  const { data: submission, isLoading: loadingSubmission } = useSubmission(submissionId);

  const sections = useMemo<FormSectionDef[]>(
    () => (formDetail?.draft_data as { sections?: FormSectionDef[] })?.sections ?? [],
    [formDetail],
  );

  const responses = useMemo<Record<string, Record<string, unknown>>>(
    () => (submission?.responses ?? {}) as Record<string, Record<string, unknown>>,
    [submission],
  );

  const lookup = (sectionName: string, fieldName: string) =>
    responses[sectionName]?.[fieldName];

  if (loadingForm || loadingSubmission) {
    return (
      <div className="flex items-center justify-center py-6 text-gray-400 gap-2">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-xs">Loading submission…</span>
      </div>
    );
  }

  if (!formDetail || !submission) {
    return (
      <div className="flex items-center justify-center py-6 text-gray-400 gap-2">
        <AlertCircle size={14} />
        <span className="text-xs">Could not load this submission.</span>
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="py-6 text-center text-xs text-gray-400 italic">
        This form has no fields.
      </div>
    );
  }

  return (
    <div className="bg-gray-50/60 border-t border-gray-100 px-4 py-4 space-y-4">
      <div className="text-[11px] text-gray-500 flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Read-only view of submitted responses
      </div>

      {sections.map((sec) => {
        if (!evaluateVisibility(sec.dependency, lookup)) return null;
        const description = (sec as { description?: string }).description;
        const sectionResponses = responses[sec.section_name] ?? {};
        const visibleFields = sec.fields.filter((f) =>
          evaluateVisibility(f.dependency, lookup),
        );

        return (
          <section
            key={sec.section_id ?? sec.section_name}
            className="rounded-lg border border-gray-200 bg-white p-4"
          >
            <header className="mb-3 pb-2 border-b border-gray-100">
              <h4 className="text-sm font-semibold text-gray-800">
                {sec.section_name}
              </h4>
              {description && (
                <p className="text-xs text-gray-500 mt-0.5">{description}</p>
              )}
            </header>
            <div className="grid grid-cols-12 gap-3">
              {visibleFields.map((f) => {
                const span = widthToCols(f.width);
                const value = sectionResponses[f.name];
                const hasValue =
                  value !== undefined &&
                  value !== null &&
                  value !== '' &&
                  !(Array.isArray(value) && value.length === 0);

                return (
                  <div key={f.field_id ?? f.name} className={`col-span-12 ${span}`}>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-gray-400 mb-0.5">
                      {f.label}
                      {f.required && <span className="text-rose-400 ml-0.5">*</span>}
                    </div>
                    {hasValue ? (
                      <FieldValueText field={f} value={value} />
                    ) : (
                      <span className="text-sm text-gray-400 italic">Not answered</span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
