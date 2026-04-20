import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, Button, Badge } from '@/components/ui';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import { useCreateCAPA } from './hooks';

// ── Types ───────────────────────────────────────────────────────────────────

interface WhyRow {
  whyNumber: number;
  question: string;
  answer: string;
}

interface FishboneSub {
  id: string;
  text: string;
}

interface ActionRow {
  id: string;
  description: string;
  type: 'CORRECTIVE' | 'PREVENTIVE';
  owner: string;
  dueDate: string;
}

interface FormData {
  title: string;
  description: string;
  source: string;
  severity: string;
  department: string;
  productProcess: string;
  linkedSourceRecord: string;
  whys: WhyRow[];
  fishbone: Record<string, FishboneSub[]>;
  actions: ActionRow[];
  effectivenessCriteria: string;
  monitoringPeriodDays: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Details' },
  { id: 2, label: 'Root Cause' },
  { id: 3, label: 'Actions' },
  { id: 4, label: 'Review' },
];

const SOURCE_OPTIONS = [
  { value: 'NC', label: 'Non-Conformance' },
  { value: 'AUDIT', label: 'Audit Finding' },
  { value: 'COMPLAINT', label: 'Customer Complaint' },
  { value: 'PROACTIVE', label: 'Proactive / Improvement' },
  { value: 'MANAGEMENT', label: 'Management Review' },
  { value: 'CUSTOMER', label: 'Customer Feedback' },
];

const SEVERITY_OPTIONS = [
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'MAJOR', label: 'Major' },
  { value: 'MINOR', label: 'Minor' },
];

const DEPARTMENT_OPTIONS = [
  { value: 'Quality Assurance', label: 'Quality Assurance' },
  { value: 'Quality Control', label: 'Quality Control' },
  { value: 'Production', label: 'Production' },
  { value: 'Engineering', label: 'Engineering' },
  { value: 'HSE', label: 'Health, Safety & Environment' },
  { value: 'Maintenance', label: 'Maintenance' },
];

const MONITORING_OPTIONS = [
  { value: '30', label: '30 Days' },
  { value: '60', label: '60 Days' },
  { value: '90', label: '90 Days' },
  { value: '180', label: '180 Days' },
];

const FISHBONE_BRANCHES = [
  { key: 'man', label: 'Man', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { key: 'machine', label: 'Machine', color: 'bg-violet-50 border-violet-200 text-violet-700' },
  { key: 'material', label: 'Material', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { key: 'method', label: 'Method', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
  { key: 'measurement', label: 'Measurement', color: 'bg-sky-50 border-sky-200 text-sky-700' },
  { key: 'environment', label: 'Environment', color: 'bg-orange-50 border-orange-200 text-orange-700' },
] as const;

const ACTION_TYPE_OPTIONS = [
  { value: 'CORRECTIVE', label: 'Corrective' },
  { value: 'PREVENTIVE', label: 'Preventive' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

let idCounter = 0;
const newId = () => `temp-${++idCounter}`;

const initialFormData: FormData = {
  title: '',
  description: '',
  source: '',
  severity: '',
  department: '',
  productProcess: '',
  linkedSourceRecord: '',
  whys: [
    { whyNumber: 1, question: '', answer: '' },
    { whyNumber: 2, question: '', answer: '' },
    { whyNumber: 3, question: '', answer: '' },
  ],
  fishbone: {
    man: [],
    machine: [],
    material: [],
    method: [],
    measurement: [],
    environment: [],
  },
  actions: [],
  effectivenessCriteria: '',
  monitoringPeriodDays: '90',
};

// ── Validation ──────────────────────────────────────────────────────────────

function validateStep(step: number, form: FormData): Record<string, string> {
  const errors: Record<string, string> = {};
  if (step === 1) {
    if (!form.title.trim()) errors.title = 'Title is required';
    if (!form.description.trim()) errors.description = 'Description is required';
    if (!form.source) errors.source = 'Source is required';
    if (!form.severity) errors.severity = 'Severity is required';
    if (!form.department) errors.department = 'Department is required';
  }
  if (step === 2) {
    const minWhys = form.severity === 'CRITICAL' || form.severity === 'MAJOR' ? 3 : 1;
    const filledWhys = form.whys.filter((w) => w.question.trim() && w.answer.trim());
    if (filledWhys.length < minWhys) {
      errors.whys = `At least ${minWhys} Why(s) are required for ${form.severity || 'this'} severity`;
    }
  }
  if (step === 3) {
    if (form.actions.length === 0) {
      errors.actions = 'At least one action is required';
    }
    form.actions.forEach((a, i) => {
      if (!a.description.trim()) errors[`action_desc_${i}`] = 'Description required';
      if (!a.owner.trim()) errors[`action_owner_${i}`] = 'Owner required';
      if (!a.dueDate) errors[`action_date_${i}`] = 'Due date required';
    });
  }
  return errors;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CAPACreatePage() {
  const navigate = useNavigate();
  const createCAPA = useCreateCAPA();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>({ ...initialFormData });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedBranches, setExpandedBranches] = useState<Record<string, boolean>>({
    man: true,
    machine: true,
    material: false,
    method: false,
    measurement: false,
    environment: false,
  });

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleNext = () => {
    const stepErrors = validateStep(step, form);
    if (Object.keys(stepErrors).length > 0) {
      setErrors(stepErrors);
      return;
    }
    setErrors({});
    setStep((s) => Math.min(s + 1, 4));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = () => {
    createCAPA.mutate(form as unknown as Record<string, unknown>, {
      onSuccess: () => navigate('/qms/capa'),
    });
  };

  // ── Why Handlers ────────────────────────────────────────────────────────

  const updateWhy = (idx: number, field: 'question' | 'answer', value: string) => {
    setForm((prev) => {
      const whys = [...prev.whys];
      whys[idx] = { ...whys[idx], [field]: value };
      return { ...prev, whys };
    });
  };

  const addWhy = () => {
    if (form.whys.length >= 7) return;
    setForm((prev) => ({
      ...prev,
      whys: [...prev.whys, { whyNumber: prev.whys.length + 1, question: '', answer: '' }],
    }));
  };

  const removeWhy = (idx: number) => {
    if (form.whys.length <= 1) return;
    setForm((prev) => ({
      ...prev,
      whys: prev.whys
        .filter((_, i) => i !== idx)
        .map((w, i) => ({ ...w, whyNumber: i + 1 })),
    }));
  };

  // ── Fishbone Handlers ──────────────────────────────────────────────────

  const addFishboneCause = (branch: string) => {
    setForm((prev) => ({
      ...prev,
      fishbone: {
        ...prev.fishbone,
        [branch]: [...prev.fishbone[branch], { id: newId(), text: '' }],
      },
    }));
  };

  const updateFishboneCause = (branch: string, id: string, text: string) => {
    setForm((prev) => ({
      ...prev,
      fishbone: {
        ...prev.fishbone,
        [branch]: prev.fishbone[branch].map((c) => (c.id === id ? { ...c, text } : c)),
      },
    }));
  };

  const removeFishboneCause = (branch: string, id: string) => {
    setForm((prev) => ({
      ...prev,
      fishbone: {
        ...prev.fishbone,
        [branch]: prev.fishbone[branch].filter((c) => c.id !== id),
      },
    }));
  };

  const toggleBranch = (key: string) => {
    setExpandedBranches((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Action Handlers ────────────────────────────────────────────────────

  const addAction = (type: 'CORRECTIVE' | 'PREVENTIVE') => {
    setForm((prev) => ({
      ...prev,
      actions: [
        ...prev.actions,
        { id: newId(), description: '', type, owner: '', dueDate: '' },
      ],
    }));
  };

  const updateAction = (id: string, field: keyof ActionRow, value: string) => {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions.map((a) => (a.id === id ? { ...a, [field]: value } : a)),
    }));
  };

  const removeAction = (id: string) => {
    setForm((prev) => ({
      ...prev,
      actions: prev.actions.filter((a) => a.id !== id),
    }));
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/qms/capa')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Initiate CAPA</h1>
          <p className="mt-1 text-sm text-slate-500">
            Create a new corrective or preventive action
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <div className="flex items-center gap-2 flex-1">
              <div
                className={cn(
                  'flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold shrink-0 transition-colors',
                  step > s.id
                    ? 'bg-emerald-500 text-white'
                    : step === s.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-500',
                )}
              >
                {step > s.id ? <Check className="h-4 w-4" /> : s.id}
              </div>
              <span
                className={cn(
                  'text-sm font-medium whitespace-nowrap',
                  step === s.id ? 'text-slate-900' : 'text-slate-400',
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'h-px flex-1 min-w-[24px]',
                  step > s.id ? 'bg-emerald-300' : 'bg-gray-200',
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        {/* ── Step 1: Details ─────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-5">
            <CardHeader>
              <CardTitle>CAPA Details</CardTitle>
            </CardHeader>
            <Input
              label="Title"
              required
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              error={errors.title}
              placeholder="Brief description of the corrective/preventive action"
            />
            <Textarea
              label="Description"
              required
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              error={errors.description}
              placeholder="Detailed description of the issue and why CAPA is needed"
              rows={4}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Source"
                required
                value={form.source}
                onChange={(e) => updateField('source', e.target.value)}
                options={SOURCE_OPTIONS}
                placeholder="Select source"
                error={errors.source}
              />
              <Select
                label="Severity"
                required
                value={form.severity}
                onChange={(e) => updateField('severity', e.target.value)}
                options={SEVERITY_OPTIONS}
                placeholder="Select severity"
                error={errors.severity}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Department"
                required
                value={form.department}
                onChange={(e) => updateField('department', e.target.value)}
                options={DEPARTMENT_OPTIONS}
                placeholder="Select department"
                error={errors.department}
              />
              <Input
                label="Product / Process"
                value={form.productProcess}
                onChange={(e) => updateField('productProcess', e.target.value)}
                placeholder="e.g., Heat Treatment, CNC Machining"
              />
            </div>
            <Input
              label="Link to Source Record"
              value={form.linkedSourceRecord}
              onChange={(e) => updateField('linkedSourceRecord', e.target.value)}
              placeholder="e.g., NC-2026-0042, AUD-2026-0003"
              helperText="Enter the reference number of the related NC, audit finding, or complaint"
            />
          </div>
        )}

        {/* ── Step 2: Root Cause ──────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-6">
            <CardHeader>
              <CardTitle>Root Cause Analysis</CardTitle>
            </CardHeader>

            {/* 5-Whys */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-800">5-Why Analysis</h4>
                <Button variant="ghost" size="sm" onClick={addWhy} disabled={form.whys.length >= 7}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Why
                </Button>
              </div>
              {errors.whys && (
                <p className="mb-3 text-xs font-medium text-red-600">{errors.whys}</p>
              )}
              <div className="space-y-3">
                {form.whys.map((w, i) => (
                  <div
                    key={i}
                    className="relative border border-slate-200 rounded-lg p-4 bg-slate-50/50"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600/10 text-blue-600 text-xs font-bold shrink-0 mt-1">
                        {w.whyNumber}
                      </div>
                      <div className="flex-1 space-y-3">
                        <Input
                          label={`Why ${w.whyNumber} - Question`}
                          value={w.question}
                          onChange={(e) => updateWhy(i, 'question', e.target.value)}
                          placeholder={`Why did this happen? (Level ${w.whyNumber})`}
                        />
                        <Input
                          label="Answer"
                          value={w.answer}
                          onChange={(e) => updateWhy(i, 'answer', e.target.value)}
                          placeholder="Because..."
                        />
                      </div>
                      {form.whys.length > 1 && (
                        <button
                          onClick={() => removeWhy(i)}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors mt-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Fishbone Diagram Data Entry */}
            <div>
              <h4 className="text-sm font-semibold text-slate-800 mb-3">
                Fishbone (Ishikawa) Diagram
              </h4>
              <p className="text-xs text-slate-500 mb-4">
                Categorize potential causes under the 6M framework
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {FISHBONE_BRANCHES.map((branch) => {
                  const causes = form.fishbone[branch.key] || [];
                  const isExpanded = expandedBranches[branch.key];
                  return (
                    <div
                      key={branch.key}
                      className={cn(
                        'border rounded-lg overflow-hidden transition-colors',
                        branch.color,
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleBranch(branch.key)}
                        className="w-full flex items-center justify-between px-4 py-2.5"
                      >
                        <span className="text-sm font-semibold">{branch.label}</span>
                        <div className="flex items-center gap-2">
                          {causes.length > 0 && (
                            <span className="text-xs font-medium opacity-70">
                              {causes.length} cause{causes.length !== 1 ? 's' : ''}
                            </span>
                          )}
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-3 space-y-2 bg-white/60">
                          {causes.map((cause) => (
                            <div key={cause.id} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={cause.text}
                                onChange={(e) =>
                                  updateFishboneCause(branch.key, cause.id, e.target.value)
                                }
                                placeholder="Enter potential cause..."
                                className="flex-1 rounded border border-slate-300 px-2.5 py-1.5 text-sm outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500/20"
                              />
                              <button
                                onClick={() => removeFishboneCause(branch.key, cause.id)}
                                className="p-1 text-slate-400 hover:text-red-500"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                          <button
                            onClick={() => addFishboneCause(branch.key)}
                            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 pt-1"
                          >
                            <Plus className="h-3 w-3" />
                            Add cause
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Actions ─────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-6">
            <CardHeader>
              <CardTitle>Corrective & Preventive Actions</CardTitle>
            </CardHeader>
            {errors.actions && (
              <p className="text-xs font-medium text-red-600">{errors.actions}</p>
            )}

            {/* Corrective Actions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-800">Corrective Actions</h4>
                <Button variant="ghost" size="sm" onClick={() => addAction('CORRECTIVE')}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Corrective Action
                </Button>
              </div>
              <div className="space-y-3">
                {form.actions
                  .filter((a) => a.type === 'CORRECTIVE')
                  .map((action, idx) => (
                    <div
                      key={action.id}
                      className="border border-slate-200 rounded-lg p-4 bg-sky-50/30"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <Badge variant="info">Corrective #{idx + 1}</Badge>
                        <button
                          onClick={() => removeAction(action.id)}
                          className="p-1 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-3">
                        <Textarea
                          label="Description"
                          required
                          value={action.description}
                          onChange={(e) =>
                            updateAction(action.id, 'description', e.target.value)
                          }
                          error={errors[`action_desc_${form.actions.indexOf(action)}`]}
                          placeholder="Describe the corrective action to be taken"
                          rows={2}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            label="Owner"
                            required
                            value={action.owner}
                            onChange={(e) =>
                              updateAction(action.id, 'owner', e.target.value)
                            }
                            error={errors[`action_owner_${form.actions.indexOf(action)}`]}
                            placeholder="Responsible person"
                          />
                          <Input
                            label="Due Date"
                            required
                            type="date"
                            value={action.dueDate}
                            onChange={(e) =>
                              updateAction(action.id, 'dueDate', e.target.value)
                            }
                            error={errors[`action_date_${form.actions.indexOf(action)}`]}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                {form.actions.filter((a) => a.type === 'CORRECTIVE').length === 0 && (
                  <p className="text-sm text-slate-400 italic py-4 text-center">
                    No corrective actions added yet
                  </p>
                )}
              </div>
            </div>

            {/* Preventive Actions */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-800">Preventive Actions</h4>
                <Button variant="ghost" size="sm" onClick={() => addAction('PREVENTIVE')}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Preventive Action
                </Button>
              </div>
              <div className="space-y-3">
                {form.actions
                  .filter((a) => a.type === 'PREVENTIVE')
                  .map((action, idx) => (
                    <div
                      key={action.id}
                      className="border border-slate-200 rounded-lg p-4 bg-violet-50/30"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <Badge variant="purple">Preventive #{idx + 1}</Badge>
                        <button
                          onClick={() => removeAction(action.id)}
                          className="p-1 text-slate-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="space-y-3">
                        <Textarea
                          label="Description"
                          required
                          value={action.description}
                          onChange={(e) =>
                            updateAction(action.id, 'description', e.target.value)
                          }
                          error={errors[`action_desc_${form.actions.indexOf(action)}`]}
                          placeholder="Describe the preventive action to be taken"
                          rows={2}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <Input
                            label="Owner"
                            required
                            value={action.owner}
                            onChange={(e) =>
                              updateAction(action.id, 'owner', e.target.value)
                            }
                            error={errors[`action_owner_${form.actions.indexOf(action)}`]}
                            placeholder="Responsible person"
                          />
                          <Input
                            label="Due Date"
                            required
                            type="date"
                            value={action.dueDate}
                            onChange={(e) =>
                              updateAction(action.id, 'dueDate', e.target.value)
                            }
                            error={errors[`action_date_${form.actions.indexOf(action)}`]}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                {form.actions.filter((a) => a.type === 'PREVENTIVE').length === 0 && (
                  <p className="text-sm text-slate-400 italic py-4 text-center">
                    No preventive actions added yet
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Review ──────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-6">
            <CardHeader>
              <CardTitle>Review & Submit</CardTitle>
            </CardHeader>

            {/* Details Summary */}
            <div className="border border-slate-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">CAPA Details</h4>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div>
                  <dt className="text-slate-500 text-xs uppercase tracking-wide">Title</dt>
                  <dd className="font-medium text-slate-900 mt-0.5">{form.title || '---'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-xs uppercase tracking-wide">Source</dt>
                  <dd className="mt-0.5">
                    {form.source ? (
                      <Badge variant="info">{form.source}</Badge>
                    ) : (
                      '---'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-xs uppercase tracking-wide">Severity</dt>
                  <dd className="mt-0.5">
                    {form.severity ? (
                      <Badge
                        variant={
                          form.severity === 'CRITICAL'
                            ? 'danger'
                            : form.severity === 'MAJOR'
                              ? 'warning'
                              : 'default'
                        }
                      >
                        {form.severity}
                      </Badge>
                    ) : (
                      '---'
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-xs uppercase tracking-wide">Department</dt>
                  <dd className="font-medium text-slate-900 mt-0.5">
                    {form.department || '---'}
                  </dd>
                </div>
                <div className="md:col-span-2">
                  <dt className="text-slate-500 text-xs uppercase tracking-wide">Description</dt>
                  <dd className="text-slate-700 mt-0.5">{form.description || '---'}</dd>
                </div>
                {form.linkedSourceRecord && (
                  <div>
                    <dt className="text-slate-500 text-xs uppercase tracking-wide">
                      Source Record
                    </dt>
                    <dd className="font-mono text-xs text-slate-900 mt-0.5">
                      {form.linkedSourceRecord}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Root Cause Summary */}
            <div className="border border-slate-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">Root Cause Analysis</h4>
              <div className="space-y-2">
                {form.whys
                  .filter((w) => w.question.trim() || w.answer.trim())
                  .map((w) => (
                    <div key={w.whyNumber} className="flex gap-3 text-sm">
                      <span className="font-mono text-xs font-bold text-blue-600 w-6 shrink-0 mt-0.5">
                        W{w.whyNumber}
                      </span>
                      <div>
                        <p className="text-slate-700 font-medium">{w.question}</p>
                        <p className="text-slate-500 mt-0.5">{w.answer}</p>
                      </div>
                    </div>
                  ))}
                {form.whys.filter((w) => w.question.trim()).length === 0 && (
                  <p className="text-sm text-slate-400 italic">No 5-Why analysis entered</p>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-500">
                  Fishbone causes:{' '}
                  {Object.entries(form.fishbone)
                    .filter(([, causes]) => causes.length > 0)
                    .map(([key, causes]) => `${key} (${causes.length})`)
                    .join(', ') || 'None entered'}
                </p>
              </div>
            </div>

            {/* Actions Summary */}
            <div className="border border-slate-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-slate-800 mb-3">Actions</h4>
              {form.actions.length > 0 ? (
                <div className="space-y-2">
                  {form.actions.map((a, i) => (
                    <div key={a.id} className="flex items-start gap-3 text-sm">
                      <Badge variant={a.type === 'CORRECTIVE' ? 'info' : 'purple'}>
                        {a.type === 'CORRECTIVE' ? 'C' : 'P'}
                      </Badge>
                      <div className="flex-1">
                        <p className="text-slate-700">{a.description || `Action ${i + 1}`}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Owner: {a.owner || '---'} | Due: {a.dueDate || '---'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">No actions defined</p>
              )}
            </div>

            {/* Effectiveness */}
            <div className="space-y-4">
              <Textarea
                label="Effectiveness Criteria"
                value={form.effectivenessCriteria}
                onChange={(e) => updateField('effectivenessCriteria', e.target.value)}
                placeholder="Define measurable criteria to verify the effectiveness of actions taken"
                rows={3}
              />
              <Select
                label="Monitoring Period"
                value={form.monitoringPeriodDays}
                onChange={(e) => updateField('monitoringPeriodDays', e.target.value)}
                options={MONITORING_OPTIONS}
              />
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-5 border-t border-slate-200">
          <Button variant="outline" onClick={handleBack} disabled={step === 1}>
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          {step < 4 ? (
            <Button onClick={handleNext}>
              Next
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} isLoading={createCAPA.isPending}>
              <Check className="h-4 w-4" />
              Submit CAPA
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
