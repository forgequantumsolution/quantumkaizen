// End-user fill view. Honors section + field visibility rules from the
// builder, runs validation on submit and shows inline errors.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, Save, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import PageContainer from '@/components/layout/PageContainer';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import Spinner from '@/components/ui/Spinner';
import FieldRenderer from './FieldRenderer';
import { useFormDetail, useSubmitForm } from './hooks';
import { evaluateVisibility } from './lib/dependency';
import { validateField } from './lib/validation';
import type { FormSectionDef } from './types';

type Errors = Record<string, Record<string, string>>; // sectionName -> fieldName -> message

export default function FormFillPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { data: detail, isLoading } = useFormDetail(id);
  const submitMutation = useSubmitForm();

  const sections = useMemo<FormSectionDef[]>(
    () => (detail?.draft_data as { sections?: FormSectionDef[] })?.sections ?? [],
    [detail]
  );

  const [responses, setResponses] = useState<Record<string, Record<string, unknown>>>({});
  const [errors, setErrors] = useState<Errors>({});

  useEffect(() => {
    setResponses({});
    setErrors({});
  }, [id]);

  const lookup = (sectionName: string, fieldName: string) =>
    responses[sectionName]?.[fieldName];

  const setFieldValue = (sectionName: string, fieldName: string, v: unknown) => {
    setResponses((prev) => ({
      ...prev,
      [sectionName]: { ...(prev[sectionName] ?? {}), [fieldName]: v },
    }));
    // clear the error as soon as the user touches the field
    setErrors((e) => {
      if (!e[sectionName]?.[fieldName]) return e;
      const sec = { ...e[sectionName] };
      delete sec[fieldName];
      return { ...e, [sectionName]: sec };
    });
  };

  const handleSubmit = async (status: 'IN_PROGRESS' | 'SUBMITTED') => {
    if (!id) return;

    if (status === 'SUBMITTED') {
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
    }

    try {
      await submitMutation.mutateAsync({ formId: id, responses, status });
      toast.success(status === 'SUBMITTED' ? 'Form submitted' : 'Saved as draft');
      if (status === 'SUBMITTED') nav('/forms');
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } }).response?.data?.message
        ?? (e as Error).message;
      toast.error(msg);
    }
  };

  if (isLoading) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (!detail) return <div className="p-8 text-slate-500">Form not found.</div>;

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => nav('/forms')} className="mb-2">
        <ArrowLeft className="h-4 w-4" /> Back to forms
      </Button>
      <PageHeader
        title={detail.form_details.title}
        description={detail.form_details.description ?? undefined}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => handleSubmit('IN_PROGRESS')}
              disabled={submitMutation.isPending}
            >
              <Save className="h-4 w-4" /> Save progress
            </Button>
            <Button
              onClick={() => handleSubmit('SUBMITTED')}
              disabled={submitMutation.isPending}
            >
              <Send className="h-4 w-4" /> Submit
            </Button>
          </div>
        }
      />

      <div className="space-y-5">
        {sections.map((sec) => {
          if (!evaluateVisibility(sec.dependency, lookup)) return null;
          const description = (sec as { description?: string }).description;
          return (
            <section
              key={sec.section_id ?? sec.section_name}
              className="rounded-xl border border-slate-200 bg-white p-6"
            >
              <header className="mb-4 pb-2 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-800">{sec.section_name}</h2>
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
                      <FieldRenderer
                        field={f}
                        value={responses[sec.section_name]?.[f.name]}
                        onChange={(v) => setFieldValue(sec.section_name, f.name, v)}
                      />
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
      </div>
    </PageContainer>
  );
}

const widthToCols = (w?: string) => {
  switch (w) {
    case '25': return 'md:col-span-3';
    case '33': return 'md:col-span-4';
    case '50': return 'md:col-span-6';
    case '66': return 'md:col-span-8';
    case '75': return 'md:col-span-9';
    default:   return 'md:col-span-12';
  }
};
