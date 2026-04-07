import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ChevronRight, Plus, Trash2, Upload, Check } from 'lucide-react';
import { Card, CardTitle, Button, Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useCreateNC } from './hooks';

// ── Step Schemas ─────────────────────────────────────────────────────────────

const step1Schema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().min(1, 'Description is required').max(4000),
  type: z.enum(['DEVIATION', 'PRODUCT_NC', 'PROCESS_NC', 'OOS', 'COMPLAINT'], {
    required_error: 'NC type is required',
  }),
  severity: z.enum(['CRITICAL', 'MAJOR', 'MINOR'], {
    required_error: 'Severity is required',
  }),
  source: z.string().optional(),
  department: z.string().min(1, 'Department is required'),
  productProcess: z.string().optional(),
  batchLot: z.string().optional(),
});

const step3Schema = z.object({
  assignedTo: z.string().min(1, 'Assignee is required'),
  dueDate: z.string().min(1, 'Due date is required'),
  priorityJustification: z.string().optional(),
});

type Step1Values = z.infer<typeof step1Schema>;
type Step3Values = z.infer<typeof step3Schema>;

interface ContainmentRow {
  id: string;
  description: string;
  owner: string;
  dueDate: string;
}

const NC_TYPES = [
  { value: 'DEVIATION', label: 'Deviation' },
  { value: 'PRODUCT_NC', label: 'Product NC' },
  { value: 'PROCESS_NC', label: 'Process NC' },
  { value: 'OOS', label: 'OOS (Out of Specification)' },
  { value: 'COMPLAINT', label: 'Customer Complaint' },
];

const SEVERITIES = [
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'MAJOR', label: 'Major' },
  { value: 'MINOR', label: 'Minor' },
];

const SOURCES = [
  'In-Process Inspection',
  'Final Inspection',
  'Incoming Inspection',
  'Internal Audit',
  'External Audit',
  'Customer Complaint',
  'Shipping Inspection',
  'Management Review',
];

const DEPARTMENTS = [
  'Quality Assurance',
  'Quality Control',
  'Production',
  'Engineering',
  'HSE',
  'Procurement',
];

const USERS = [
  { id: 'u1', name: 'Priya Sharma' },
  { id: 'u2', name: 'Rajesh Kumar' },
  { id: 'u3', name: 'Anita Desai' },
  { id: 'u4', name: 'Vikram Patel' },
  { id: 'u5', name: 'Sunita Rao' },
  { id: 'u6', name: 'Deepak Nair' },
];

const STEPS = ['Details', 'Containment', 'Assignment'];

export default function NCCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateNC();
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1 form
  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
  });

  // Step 2 — dynamic containment actions
  const [containmentActions, setContainmentActions] = useState<ContainmentRow[]>([]);

  const addContainmentRow = () => {
    setContainmentActions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: '', owner: '', dueDate: '' },
    ]);
  };

  const removeContainmentRow = (id: string) => {
    setContainmentActions((prev) => prev.filter((r) => r.id !== id));
  };

  const updateContainmentRow = (id: string, field: keyof ContainmentRow, value: string) => {
    setContainmentActions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  };

  // Step 3 form
  const step3Form = useForm<Step3Values>({
    resolver: zodResolver(step3Schema),
  });

  const handleNext = async () => {
    if (currentStep === 0) {
      const valid = await step1Form.trigger();
      if (!valid) return;
    }
    setCurrentStep((s) => Math.min(s + 1, 2));
  };

  const handleBack = () => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  };

  const handleSubmit = async () => {
    const step3Valid = await step3Form.trigger();
    if (!step3Valid) return;

    const payload = {
      ...step1Form.getValues(),
      containmentActions: containmentActions.filter((a) => a.description),
      ...step3Form.getValues(),
      status: 'OPEN',
    };

    try {
      await createMutation.mutateAsync(payload);
      navigate('/qms/non-conformances');
    } catch {
      // error handled in hook
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Breadcrumb ───────────────────────────────────────────────────── */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <button
          onClick={() => navigate('/qms/non-conformances')}
          className="hover:text-navy-700 transition-colors"
        >
          Non-Conformances
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">Report NC</span>
      </nav>

      <h1 className="text-2xl font-bold text-slate-900">Report Non-Conformance</h1>

      {/* ── Step Indicator ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, idx) => (
          <React.Fragment key={label}>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                  idx < currentStep
                    ? 'bg-emerald-500 text-white'
                    : idx === currentStep
                      ? 'bg-navy-700 text-white'
                      : 'bg-slate-200 text-slate-500',
                )}
              >
                {idx < currentStep ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <span
                className={cn(
                  'text-sm font-medium',
                  idx === currentStep ? 'text-navy-700' : 'text-slate-400',
                )}
              >
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className="mx-1 h-px flex-1 bg-slate-200" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── Step Content ─────────────────────────────────────────────────── */}
      <Card className="max-w-3xl">
        {/* Step 1: Details */}
        {currentStep === 0 && (
          <div className="space-y-5">
            <CardTitle>NC Details</CardTitle>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                {...step1Form.register('title')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
                placeholder="Brief title describing the non-conformance"
              />
              {step1Form.formState.errors.title && (
                <p className="mt-1 text-xs text-red-600">{step1Form.formState.errors.title.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                {...step1Form.register('description')}
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
                placeholder="Describe the non-conformance in detail, including what was observed, where, and when"
              />
              {step1Form.formState.errors.description && (
                <p className="mt-1 text-xs text-red-600">{step1Form.formState.errors.description.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Type <span className="text-red-500">*</span>
                </label>
                <select
                  {...step1Form.register('type')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
                >
                  <option value="">Select type</option>
                  {NC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                {step1Form.formState.errors.type && (
                  <p className="mt-1 text-xs text-red-600">{step1Form.formState.errors.type.message}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Severity <span className="text-red-500">*</span>
                </label>
                <select
                  {...step1Form.register('severity')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
                >
                  <option value="">Select severity</option>
                  {SEVERITIES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
                {step1Form.formState.errors.severity && (
                  <p className="mt-1 text-xs text-red-600">{step1Form.formState.errors.severity.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Source</label>
                <select
                  {...step1Form.register('source')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
                >
                  <option value="">Select source</option>
                  {SOURCES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Department Affected <span className="text-red-500">*</span>
                </label>
                <select
                  {...step1Form.register('department')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
                >
                  <option value="">Select department</option>
                  {DEPARTMENTS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
                {step1Form.formState.errors.department && (
                  <p className="mt-1 text-xs text-red-600">{step1Form.formState.errors.department.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Product / Process
                </label>
                <input
                  {...step1Form.register('productProcess')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
                  placeholder="e.g., Heat Treatment"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Batch / Lot Number
                </label>
                <input
                  {...step1Form.register('batchLot')}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
                  placeholder="e.g., HT-2026-112"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Containment */}
        {currentStep === 1 && (
          <div className="space-y-5">
            <CardTitle>Immediate Containment Actions</CardTitle>
            <p className="text-sm text-slate-500">
              Define immediate actions to contain the non-conformance and prevent further impact.
            </p>

            {containmentActions.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 py-10 text-center">
                <p className="text-sm text-slate-400 mb-3">No containment actions added yet</p>
                <Button variant="outline" size="sm" onClick={addContainmentRow}>
                  <Plus className="h-4 w-4" />
                  Add Action
                </Button>
              </div>
            )}

            {containmentActions.map((action, idx) => (
              <div
                key={action.id}
                className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">Action {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeContainmentRow(action.id)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <input
                  value={action.description}
                  onChange={(e) => updateContainmentRow(action.id, 'description', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
                  placeholder="Describe the containment action"
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    value={action.owner}
                    onChange={(e) => updateContainmentRow(action.id, 'owner', e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
                    placeholder="Action owner"
                  />
                  <input
                    type="date"
                    value={action.dueDate}
                    onChange={(e) => updateContainmentRow(action.id, 'dueDate', e.target.value)}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
                  />
                </div>
              </div>
            ))}

            {containmentActions.length > 0 && (
              <Button variant="outline" size="sm" onClick={addContainmentRow}>
                <Plus className="h-4 w-4" />
                Add Another Action
              </Button>
            )}

            {/* Evidence Upload */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">Evidence</label>
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 transition hover:border-navy-400">
                <Upload className="mb-2 h-8 w-8 text-slate-400" />
                <p className="text-sm text-slate-600">
                  Drag & drop evidence files, or{' '}
                  <span className="cursor-pointer text-navy-600 underline">browse</span>
                </p>
                <p className="mt-1 text-xs text-slate-400">Photos, test reports, screenshots</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Assignment */}
        {currentStep === 2 && (
          <div className="space-y-5">
            <CardTitle>Assignment & Priority</CardTitle>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Assign To <span className="text-red-500">*</span>
              </label>
              <select
                {...step3Form.register('assignedTo')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
              >
                <option value="">Select assignee</option>
                {USERS.map((u) => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
              </select>
              {step3Form.formState.errors.assignedTo && (
                <p className="mt-1 text-xs text-red-600">{step3Form.formState.errors.assignedTo.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Due Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                {...step3Form.register('dueDate')}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
              />
              {step3Form.formState.errors.dueDate && (
                <p className="mt-1 text-xs text-red-600">{step3Form.formState.errors.dueDate.message}</p>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Priority Justification
              </label>
              <textarea
                {...step3Form.register('priorityJustification')}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20"
                placeholder="Explain why this NC requires urgent attention (if applicable)"
              />
            </div>
          </div>
        )}

        {/* ── Navigation ──────────────────────────────────────────────────── */}
        <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
          <div>
            {currentStep > 0 && (
              <Button variant="outline" onClick={handleBack}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/qms/non-conformances')}
            >
              Cancel
            </Button>
            {currentStep < 2 ? (
              <Button onClick={handleNext}>Next</Button>
            ) : (
              <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Submitting...' : 'Submit NC'}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
