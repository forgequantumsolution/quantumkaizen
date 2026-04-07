import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronRight } from 'lucide-react';
import { Card, Button } from '@/components/ui';
import { useCreateTemplate } from './hooks';
import toast from 'react-hot-toast';

const schema = z.object({
  name: z.string().min(1, 'Template name is required').max(200),
  description: z.string().max(2000).optional(),
  category: z.string().min(1, 'Category is required'),
  documentLevel: z.enum(['POLICY', 'PROCEDURE', 'WORK_INSTRUCTION', 'FORM', 'CHECKLIST', 'REPORT'], {
    required_error: 'Document level is required',
  }),
  industry: z.string().min(1, 'Industry is required'),
  applicableDepartments: z.array(z.string()).min(1, 'Select at least one department'),
  tags: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const CATEGORIES = [
  'SOPs',
  'Work Instructions',
  'Forms',
  'Checklists',
  'Audit Reports',
  'CAPA Forms',
  'Risk Assessment',
  'Training',
];

const DOC_LEVELS = [
  { value: 'POLICY',           label: 'Policy' },
  { value: 'PROCEDURE',        label: 'Procedure / SOP' },
  { value: 'WORK_INSTRUCTION', label: 'Work Instruction' },
  { value: 'FORM',             label: 'Form' },
  { value: 'CHECKLIST',        label: 'Checklist' },
  { value: 'REPORT',           label: 'Report' },
];

const INDUSTRIES = [
  'Pharmaceutical',
  'Chemical',
  'Food & Beverage',
  'Medical Devices',
  'Manufacturing',
  'General',
];

const DEPARTMENTS = [
  'Quality Assurance',
  'Quality Control',
  'Production',
  'Engineering',
  'HSE',
  'Laboratory',
  'Procurement',
  'Human Resources',
  'Regulatory Affairs',
];

const INPUT = 'w-full h-9 rounded border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-400/20';
const LABEL = 'block text-xs font-medium text-gray-700 mb-1.5';

export default function TemplateCreatePage() {
  const navigate = useNavigate();
  const { mutateAsync, isLoading } = useCreateTemplate();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { applicableDepartments: [] },
  });

  const onSubmit = async (values: FormValues) => {
    try {
      await mutateAsync({
        ...values,
        tags: values.tags ? values.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
      });
      toast.success('Template created successfully');
      navigate('/dms/templates');
    } catch {
      toast.error('Failed to create template');
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <button onClick={() => navigate('/dms/templates')} className="hover:text-gray-900 transition-colors">
          Templates
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-gray-900">New Template</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create Document Template</h1>
        <p className="mt-1 text-sm text-gray-500">
          Define a reusable document template for your organisation
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="max-w-3xl space-y-5">

          {/* Name */}
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className={LABEL}>Template Name <span className="text-red-500">*</span></label>
                <input
                  {...register('name')}
                  className={INPUT}
                  placeholder="e.g. SOP Template – Batch Manufacturing"
                />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
              </div>

              <div>
                <label className={LABEL}>Description</label>
                <textarea
                  {...register('description')}
                  rows={3}
                  className="w-full rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-yellow-500 focus:ring-2 focus:ring-yellow-400/20 resize-none"
                  placeholder="Describe the purpose and scope of this template"
                />
              </div>
            </div>
          </Card>

          {/* Classification */}
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Classification</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className={LABEL}>Category <span className="text-red-500">*</span></label>
                <select {...register('category')} className={INPUT}>
                  <option value="">Select category</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category.message}</p>}
              </div>

              <div>
                <label className={LABEL}>Document Level <span className="text-red-500">*</span></label>
                <select {...register('documentLevel')} className={INPUT}>
                  <option value="">Select level</option>
                  {DOC_LEVELS.map((l) => (
                    <option key={l.value} value={l.value}>{l.label}</option>
                  ))}
                </select>
                {errors.documentLevel && <p className="mt-1 text-xs text-red-600">{errors.documentLevel.message}</p>}
              </div>

              <div>
                <label className={LABEL}>Industry <span className="text-red-500">*</span></label>
                <select {...register('industry')} className={INPUT}>
                  <option value="">Select industry</option>
                  {INDUSTRIES.map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
                {errors.industry && <p className="mt-1 text-xs text-red-600">{errors.industry.message}</p>}
              </div>
            </div>
          </Card>

          {/* Departments */}
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Applicable Departments <span className="text-red-500">*</span></h2>
            <p className="text-xs text-gray-500 mb-3">Select all departments this template applies to</p>
            <Controller
              control={control}
              name="applicableDepartments"
              render={({ field }) => (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {DEPARTMENTS.map((dept) => {
                    const checked = field.value.includes(dept);
                    return (
                      <label
                        key={dept}
                        className="flex items-center gap-2 cursor-pointer group"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            if (checked) {
                              field.onChange(field.value.filter((d) => d !== dept));
                            } else {
                              field.onChange([...field.value, dept]);
                            }
                          }}
                          className="w-3.5 h-3.5 rounded accent-yellow-500 cursor-pointer"
                        />
                        <span className="text-sm text-gray-700 group-hover:text-gray-900">{dept}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            />
            {errors.applicableDepartments && (
              <p className="mt-2 text-xs text-red-600">{errors.applicableDepartments.message}</p>
            )}
          </Card>

          {/* Tags */}
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Tags</h2>
            <div>
              <label className={LABEL}>Tags</label>
              <input
                {...register('tags')}
                className={INPUT}
                placeholder="e.g. iso9001, manufacturing, gmp (comma-separated)"
              />
              <p className="mt-1 text-xs text-gray-400">Separate multiple tags with commas</p>
            </div>
          </Card>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dms/templates')}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isLoading}>
              {isLoading ? 'Creating…' : 'Create Template'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
