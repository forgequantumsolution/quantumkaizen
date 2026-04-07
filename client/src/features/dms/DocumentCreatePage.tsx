import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronRight, Upload } from 'lucide-react';
import { Card, CardTitle, Button } from '@/components/ui';
import { useCreateDocument } from './hooks';

const schema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  level: z.enum(['POLICY', 'PROCEDURE', 'WORK_INSTRUCTION', 'FORM', 'EXTERNAL'], {
    required_error: 'Document level is required',
  }),
  category: z.string().optional(),
  department: z.string().min(1, 'Department is required'),
  tags: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const LEVELS = [
  { value: 'POLICY', label: 'Policy' },
  { value: 'PROCEDURE', label: 'Procedure / SOP' },
  { value: 'WORK_INSTRUCTION', label: 'Work Instruction' },
  { value: 'FORM', label: 'Form' },
  { value: 'EXTERNAL', label: 'External' },
];

const CATEGORIES = [
  'Quality',
  'Manufacturing',
  'Engineering',
  'HSE',
  'Laboratory',
  'Inspection',
  'Standards',
  'Training',
  'Regulatory',
];

const DEPARTMENTS = [
  'Quality Assurance',
  'Quality Control',
  'Production',
  'Engineering',
  'HSE',
  'Human Resources',
  'Procurement',
];

export default function DocumentCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateDocument();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (values: FormValues) => {
    const payload = {
      ...values,
      tags: values.tags
        ? values.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
      status: 'DRAFT',
    };
    try {
      await createMutation.mutateAsync(payload);
      navigate('/dms/documents');
    } catch {
      // error handled in hook
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <button onClick={() => navigate('/dms/documents')} className="hover:text-navy-700 transition-colors">
          Documents
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">New</span>
      </nav>

      <h1 className="text-2xl font-bold text-slate-900">Create New Document</h1>

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="max-w-3xl space-y-6">
          {/* Title */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              {...register('title')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
              placeholder="Enter document title"
            />
            {errors.title && (
              <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Description</label>
            <textarea
              {...register('description')}
              rows={4}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
              placeholder="Describe the purpose and scope of this document"
            />
          </div>

          {/* Level & Category */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Level <span className="text-red-500">*</span>
              </label>
              <select
                {...register('level')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
              >
                <option value="">Select level</option>
                {LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
              {errors.level && (
                <p className="mt-1 text-xs text-red-600">{errors.level.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Category</label>
              <select
                {...register('category')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
              >
                <option value="">Select category</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Department */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Department <span className="text-red-500">*</span>
            </label>
            <select
              {...register('department')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
            >
              <option value="">Select department</option>
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            {errors.department && (
              <p className="mt-1 text-xs text-red-600">{errors.department.message}</p>
            )}
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Tags</label>
            <input
              {...register('tags')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
              placeholder="Enter tags separated by commas"
            />
            <p className="mt-1 text-xs text-slate-400">Separate multiple tags with commas</p>
          </div>

          {/* File Upload Area */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Attachments</label>
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 transition hover:border-navy-400 hover:bg-slate-100">
              <Upload className="mb-3 h-10 w-10 text-slate-400" />
              <p className="text-sm font-medium text-slate-600">
                Drag & drop files here, or{' '}
                <span className="cursor-pointer text-navy-600 underline">browse</span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                PDF, DOCX, XLSX, or image files up to 25 MB
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/dms/documents')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save as Draft'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
