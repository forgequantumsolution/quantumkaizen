// Live preview that mirrors how the form will render for an end user.
// Reuses the same renderer/dependency/validation as the real fill page —
// "Submit" runs validation and reports findings without persisting.
import { useState } from 'react';
import { AlertCircle, CheckCircle2, Send, Smartphone, Monitor } from 'lucide-react';
import { Button as AntButton, Segmented } from 'antd';
import FieldRenderer from '../FieldRenderer';
import { evaluateVisibility } from '../lib/dependency';
import { validateField } from '../lib/validation';
import type { FormSectionDef } from '../types';

interface Props {
  title: string;
  description: string;
  sections: FormSectionDef[];
}

type Errors = Record<string, Record<string, string>>;
type Device = 'desktop' | 'mobile';

export default function FormPreview({ title, description, sections }: Props) {
  const [responses, setResponses] = useState<Record<string, Record<string, unknown>>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [device, setDevice] = useState<Device>('desktop');
  const [submittedOk, setSubmittedOk] = useState(false);

  const lookup = (sectionName: string, fieldName: string) =>
    responses[sectionName]?.[fieldName];

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
    <div className="space-y-3">
      {/* Device toggle + helper */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm text-slate-600">
            <span className="font-medium">Live preview</span>
            <span className="ml-2 text-slate-400">— this is exactly what users will see</span>
          </p>
        </div>
        <Segmented
          size="small"
          value={device}
          onChange={(v) => setDevice(v as Device)}
          options={[
            { label: <span className="inline-flex items-center gap-1"><Monitor className="h-3.5 w-3.5" /> Desktop</span>, value: 'desktop' },
            { label: <span className="inline-flex items-center gap-1"><Smartphone className="h-3.5 w-3.5" /> Mobile</span>, value: 'mobile' },
          ]}
        />
      </div>

      {/* Frame */}
      <div className="bg-slate-100 rounded-2xl p-4 sm:p-8">
        <div
          className={
            'mx-auto bg-white rounded-2xl shadow-sm overflow-hidden transition-all ' +
            (device === 'mobile' ? 'max-w-[420px]' : 'max-w-3xl')
          }
        >
          <div className="px-6 py-5 border-b border-slate-100">
            <h1 className="text-xl font-semibold text-slate-900">
              {title || 'Untitled form'}
            </h1>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>

          <div className="px-6 py-5 space-y-6">
            {sections.length === 0 || sections.every((s) => s.fields.length === 0) ? (
              <p className="text-sm text-slate-400 py-12 text-center">
                Add a section and some fields to see the preview here.
              </p>
            ) : (
              sections.map((sec) => {
                if (!evaluateVisibility(sec.dependency, lookup)) return null;
                return (
                  <section key={sec.section_id ?? sec.section_name}>
                    <header className="mb-3">
                      <h2 className="text-base font-semibold text-slate-800">
                        {sec.section_name}
                      </h2>
                      {sec.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{sec.description}</p>
                      )}
                    </header>
                    <div className="grid grid-cols-12 gap-3">
                      {sec.fields.map((f) => {
                        if (!evaluateVisibility(f.dependency, lookup)) return null;
                        const span = device === 'mobile' ? 'col-span-12' : widthToCols(f.width);
                        const err = errors[sec.section_name]?.[f.name];
                        const helpText = (f as { helpText?: string }).helpText;
                        return (
                          <div key={f.field_id ?? f.name} className={'col-span-12 ' + span}>
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              {f.label}
                              {f.required && <span className="text-rose-500 ml-0.5">*</span>}
                            </label>
                            <FieldRenderer
                              field={f}
                              value={responses[sec.section_name]?.[f.name]}
                              onChange={(v) => setFieldValue(sec.section_name, f.name, v)}
                            />
                            {helpText && !err && (
                              <p className="mt-1 text-[11px] text-slate-500">{helpText}</p>
                            )}
                            {err && (
                              <p className="mt-1 text-[11px] text-rose-600 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> {err}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })
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
