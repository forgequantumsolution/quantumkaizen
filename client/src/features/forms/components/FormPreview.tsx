// Live preview that mirrors how the form will render for an end user.
// Reuses the same renderer/dependency/validation as the real fill page —
// "Submit" runs validation and reports findings without persisting.
import { useState } from 'react';
import { AlertCircle, CheckCircle2, Send } from 'lucide-react';
import { Button as AntButton } from 'antd';
import FieldRenderer from '../FieldRenderer';
import { evaluateVisibility } from '../lib/dependency';
import { validateField } from '../lib/validation';
import type { FormSectionDef } from '../types';

export type PreviewDevice = 'desktop' | 'mobile';

interface Props {
  title: string;
  description: string;
  sections: FormSectionDef[];
  device?: PreviewDevice;
}

type Errors = Record<string, Record<string, string>>;

export default function FormPreview({ title, description, sections, device = 'desktop' }: Props) {
  const [responses, setResponses] = useState<Record<string, Record<string, unknown>>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [submittedOk, setSubmittedOk] = useState(false);

  // Tolerate stale dependency rules whose `sectionName` points at a section
  // that was later renamed; mirrors FormFillEmbed.lookup.
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
    setResponses((p) => ({
      ...p,
      [sectionName]: { ...(p[sectionName] ?? {}), [fieldName]: v },
    }));
    setErrors((e) => {
      if (!e[sectionName]?.[fieldName]) return e;
      const sec = { ...e[sectionName] };
      delete sec[fieldName];
      return { ...e, [sectionName]: sec };
    });
    setSubmittedOk(false);
  };

  const handleValidate = () => {
    const next: Errors = {};
    let total = 0;
    for (const sec of sections) {
      if (!evaluateVisibility(sec.dependency, lookup)) continue;
      for (const f of sec.fields) {
        if (!evaluateVisibility(f.dependency, lookup)) continue;
        const err = validateField(f, lookup(sec.section_name, f.name));
        if (err) {
          next[sec.section_name] = { ...(next[sec.section_name] ?? {}), [f.name]: err };
          total++;
        }
      }
    }
    setErrors(next);
    setSubmittedOk(total === 0);
  };

  return (
    <div>
      {/* Frame */}
      <div className="bg-slate-100 rounded-2xl p-4 sm:p-6">
        <div
          className={
            'mx-auto bg-white rounded-2xl shadow-sm overflow-hidden transition-all ' +
            (device === 'mobile' ? 'max-w-[420px]' : 'w-full')
          }
        >
          <div className="px-6 py-5 border-b border-slate-100">
            <h1 className="text-xl font-semibold text-slate-900 leading-tight">
              {title || 'Untitled form'}
            </h1>
            {description && (
              <p className="mt-1.5 text-sm text-slate-500">{description}</p>
            )}
          </div>

          <div className="px-6 py-6 space-y-7">
            {sections.length === 0 || sections.every((s) => s.fields.length === 0) ? (
              <p className="text-sm text-slate-400 py-12 text-center">
                Add a section and some fields to see the preview here.
              </p>
            ) : (
              (() => {
                let visibleIdx = 0;
                return sections.map((sec) => {
                  if (!evaluateVisibility(sec.dependency, lookup)) return null;
                  visibleIdx += 1;
                  return (
                    <section key={sec.section_id ?? sec.section_name}>
                      <header className="mb-4">
                        <div className="flex items-center gap-2.5">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-semibold ring-1 ring-indigo-100">
                            {visibleIdx}
                          </span>
                          <h2 className="text-base font-semibold text-slate-800 leading-tight">
                            {sec.section_name}
                          </h2>
                        </div>
                        {sec.description && (
                          <p className="text-xs text-slate-500 mt-1.5 ml-9">{sec.description}</p>
                        )}
                      </header>
                      <div className="grid grid-cols-12 gap-x-4 gap-y-4">
                        {sec.fields.map((f) => {
                          if (!evaluateVisibility(f.dependency, lookup)) return null;
                          const span = device === 'mobile' ? 'col-span-12' : widthToCols(f.width);
                          const err = errors[sec.section_name]?.[f.name];
                          const helpText = (f as { helpText?: string }).helpText;
                          return (
                            <div key={f.field_id ?? f.name} className={'col-span-12 min-w-0 ' + span}>
                              <label className="block text-[13px] font-medium text-slate-700 mb-1.5 leading-tight">
                                {f.label}
                                {f.required && <span className="text-rose-500 ml-0.5">*</span>}
                              </label>
                              <FieldRenderer
                                field={f}
                                value={responses[sec.section_name]?.[f.name]}
                                onChange={(v) => setFieldValue(sec.section_name, f.name, v)}
                              />
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
                });
              })()
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 flex-wrap">
            {submittedOk ? (
              <p className="text-sm text-emerald-700 inline-flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4" /> All checks passed — would submit successfully.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Try filling the form to test validation rules.
              </p>
            )}
            <AntButton type="primary" icon={<Send className="h-4 w-4" />} onClick={handleValidate}>
              Test submit
            </AntButton>
          </div>
        </div>
      </div>
    </div>
  );
}

const widthToCols = (w?: string) => {
  switch (w) {
    case '25': return 'sm:col-span-3';
    case '33': return 'sm:col-span-4';
    case '50': return 'sm:col-span-6';
    case '66': return 'sm:col-span-8';
    case '75': return 'sm:col-span-9';
    default:   return 'sm:col-span-12';
  }
};
