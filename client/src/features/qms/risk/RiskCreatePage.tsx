import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Check } from 'lucide-react';
import { Card, CardHeader, CardTitle, Button, Badge } from '@/components/ui';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import { useCreateRisk, calcRiskLevel } from './hooks';
import type { RiskLevel } from './hooks';

// ── Constants ───────────────────────────────────────────────────────────────

const CATEGORY_OPTIONS = [
  { value: 'OPERATIONAL', label: 'Operational' },
  { value: 'SAFETY', label: 'Safety' },
  { value: 'QUALITY', label: 'Quality' },
  { value: 'ENVIRONMENTAL', label: 'Environmental' },
  { value: 'FINANCIAL', label: 'Financial' },
];

const DEPARTMENT_OPTIONS = [
  { value: 'Quality Assurance', label: 'Quality Assurance' },
  { value: 'Quality Control', label: 'Quality Control' },
  { value: 'Production', label: 'Production' },
  { value: 'Engineering', label: 'Engineering' },
  { value: 'HSE', label: 'Health, Safety & Environment' },
  { value: 'Maintenance', label: 'Maintenance' },
];

const HIERARCHY_OPTIONS = [
  { value: 'ELIMINATION', label: 'Elimination' },
  { value: 'SUBSTITUTION', label: 'Substitution' },
  { value: 'ENGINEERING', label: 'Engineering Controls' },
  { value: 'ADMINISTRATIVE', label: 'Administrative Controls' },
  { value: 'PPE', label: 'PPE' },
];

const LIKELIHOOD_LABELS: Record<number, string> = {
  1: 'Rare',
  2: 'Unlikely',
  3: 'Possible',
  4: 'Likely',
  5: 'Almost Certain',
};

const CONSEQUENCE_LABELS: Record<number, string> = {
  1: 'Negligible',
  2: 'Minor',
  3: 'Moderate',
  4: 'Major',
  5: 'Catastrophic',
};

// ── Types ───────────────────────────────────────────────────────────────────

interface ControlRow {
  id: string;
  hierarchy: string;
  description: string;
  owner: string;
}

interface FormData {
  title: string;
  description: string;
  category: string;
  department: string;
  likelihood: number;
  consequence: number;
  controls: ControlRow[];
  residualLikelihood: number;
  residualConsequence: number;
  owner: string;
  reviewDate: string;
}

function levelBadgeColor(level: RiskLevel): string {
  switch (level) {
    case 'CRITICAL': return 'bg-red-100 text-red-700 border-red-200';
    case 'HIGH': return 'bg-orange-100 text-orange-700 border-orange-200';
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    case 'LOW': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  }
}

let idCounter = 0;

// ── Component ───────────────────────────────────────────────────────────────

export default function RiskCreatePage() {
  const navigate = useNavigate();
  const createRisk = useCreateRisk();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState<FormData>({
    title: '',
    description: '',
    category: '',
    department: '',
    likelihood: 3,
    consequence: 3,
    controls: [],
    residualLikelihood: 2,
    residualConsequence: 2,
    owner: '',
    reviewDate: '',
  });

  const riskScore = form.likelihood * form.consequence;
  const riskLevel = calcRiskLevel(riskScore);
  const residualScore = form.residualLikelihood * form.residualConsequence;
  const residualLevel = calcRiskLevel(residualScore);

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const addControl = () => {
    setForm((prev) => ({
      ...prev,
      controls: [
        ...prev.controls,
        { id: `ctrl-${++idCounter}`, hierarchy: '', description: '', owner: '' },
      ],
    }));
  };

  const updateControl = (id: string, field: keyof ControlRow, value: string) => {
    setForm((prev) => ({
      ...prev,
      controls: prev.controls.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    }));
  };

  const removeControl = (id: string) => {
    setForm((prev) => ({
      ...prev,
      controls: prev.controls.filter((c) => c.id !== id),
    }));
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e.title = 'Title is required';
    if (!form.description.trim()) e.description = 'Description is required';
    if (!form.category) e.category = 'Category is required';
    if (!form.department) e.department = 'Department is required';
    if (!form.owner.trim()) e.owner = 'Owner is required';
    if (!form.reviewDate) e.reviewDate = 'Review date is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;
    createRisk.mutate(
      { ...form, riskScore, riskLevel, residualScore, residualLevel } as unknown as Record<string, unknown>,
      { onSuccess: () => navigate('/qms/risks') },
    );
  };

  // ── Slider Component ──────────────────────────────────────────────────────

  const RatingSelector = ({
    label,
    value,
    onChange,
    labels,
  }: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    labels: Record<number, string>;
  }) => (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2 mt-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              'flex flex-col items-center justify-center w-16 h-16 rounded-lg border-2 transition-all text-xs font-medium',
              value === n
                ? 'border-blue-500 bg-blue-600/10 text-blue-600 shadow-sm'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
            )}
          >
            <span className="text-lg font-bold">{n}</span>
            <span className="text-[10px] leading-tight text-center mt-0.5">
              {labels[n]}
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/qms/risks')}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Add Risk</h1>
          <p className="mt-1 text-sm text-slate-500">
            Register a new risk in the organizational risk register
          </p>
        </div>
      </div>

      {/* Risk Details */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Details</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <Input
            label="Title"
            required
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            error={errors.title}
            placeholder="Brief title for the risk"
          />
          <Textarea
            label="Description"
            required
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            error={errors.description}
            placeholder="Describe the risk scenario, potential triggers, and potential impact"
            rows={4}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Category"
              required
              value={form.category}
              onChange={(e) => updateField('category', e.target.value)}
              options={CATEGORY_OPTIONS}
              placeholder="Select category"
              error={errors.category}
            />
            <Select
              label="Department"
              required
              value={form.department}
              onChange={(e) => updateField('department', e.target.value)}
              options={DEPARTMENT_OPTIONS}
              placeholder="Select department"
              error={errors.department}
            />
          </div>
        </div>
      </Card>

      {/* Initial Risk Assessment */}
      <Card>
        <CardHeader>
          <CardTitle>Initial Risk Assessment</CardTitle>
        </CardHeader>
        <div className="space-y-5">
          <RatingSelector
            label="Likelihood"
            value={form.likelihood}
            onChange={(v) => updateField('likelihood', v)}
            labels={LIKELIHOOD_LABELS}
          />
          <RatingSelector
            label="Consequence"
            value={form.consequence}
            onChange={(v) => updateField('consequence', v)}
            labels={CONSEQUENCE_LABELS}
          />
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Risk Score</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{riskScore}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Risk Level</p>
              <div className="mt-1">
                <span
                  className={cn(
                    'inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border',
                    levelBadgeColor(riskLevel),
                  )}
                >
                  {riskLevel}
                </span>
              </div>
            </div>
            <div className="flex-1 text-right text-xs text-slate-400">
              {form.likelihood} (L) x {form.consequence} (C) = {riskScore}
            </div>
          </div>
        </div>
      </Card>

      {/* Control Measures */}
      <Card>
        <CardHeader>
          <CardTitle>Control Measures</CardTitle>
          <Button variant="ghost" size="sm" onClick={addControl}>
            <Plus className="h-3.5 w-3.5" />
            Add Control
          </Button>
        </CardHeader>
        <div className="space-y-3">
          {form.controls.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-6">
              No control measures added yet. Click "Add Control" to define risk mitigations.
            </p>
          ) : (
            form.controls.map((ctrl, idx) => {
              const hierarchyMeta: Record<string, string> = {
                ELIMINATION: 'bg-emerald-50 border-emerald-200',
                SUBSTITUTION: 'bg-blue-50 border-blue-200',
                ENGINEERING: 'bg-violet-50 border-violet-200',
                ADMINISTRATIVE: 'bg-amber-50 border-amber-200',
                PPE: 'bg-red-50 border-red-200',
              };
              return (
                <div
                  key={ctrl.id}
                  className={cn(
                    'border rounded-lg p-4',
                    ctrl.hierarchy
                      ? hierarchyMeta[ctrl.hierarchy] || 'border-slate-200'
                      : 'border-slate-200',
                  )}
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-xs font-semibold text-slate-500">
                      Control #{idx + 1}
                    </span>
                    <button
                      onClick={() => removeControl(ctrl.id)}
                      className="p-1 text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <Select
                      label="Hierarchy of Controls"
                      value={ctrl.hierarchy}
                      onChange={(e) => updateControl(ctrl.id, 'hierarchy', e.target.value)}
                      options={HIERARCHY_OPTIONS}
                      placeholder="Select hierarchy level"
                    />
                    <Textarea
                      label="Description"
                      value={ctrl.description}
                      onChange={(e) => updateControl(ctrl.id, 'description', e.target.value)}
                      placeholder="Describe the control measure"
                      rows={2}
                    />
                    <Input
                      label="Owner"
                      value={ctrl.owner}
                      onChange={(e) => updateControl(ctrl.id, 'owner', e.target.value)}
                      placeholder="Person responsible for this control"
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Residual Risk */}
      <Card>
        <CardHeader>
          <CardTitle>Residual Risk Assessment</CardTitle>
        </CardHeader>
        <p className="text-xs text-slate-500 mb-4">
          Assess the risk level remaining after control measures are implemented
        </p>
        <div className="space-y-5">
          <RatingSelector
            label="Residual Likelihood"
            value={form.residualLikelihood}
            onChange={(v) => updateField('residualLikelihood', v)}
            labels={LIKELIHOOD_LABELS}
          />
          <RatingSelector
            label="Residual Consequence"
            value={form.residualConsequence}
            onChange={(v) => updateField('residualConsequence', v)}
            labels={CONSEQUENCE_LABELS}
          />
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Residual Score</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">{residualScore}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-500 uppercase tracking-wide">Residual Level</p>
              <div className="mt-1">
                <span
                  className={cn(
                    'inline-flex items-center px-3 py-1 rounded-full text-sm font-bold border',
                    levelBadgeColor(residualLevel),
                  )}
                >
                  {residualLevel}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Owner & Review */}
      <Card>
        <CardHeader>
          <CardTitle>Assignment</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Risk Owner"
            required
            value={form.owner}
            onChange={(e) => updateField('owner', e.target.value)}
            error={errors.owner}
            placeholder="Person accountable for this risk"
          />
          <Input
            label="Review Date"
            required
            type="date"
            value={form.reviewDate}
            onChange={(e) => updateField('reviewDate', e.target.value)}
            error={errors.reviewDate}
          />
        </div>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3 pb-8">
        <Button variant="outline" onClick={() => navigate('/qms/risks')}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} isLoading={createRisk.isPending}>
          <Check className="h-4 w-4" />
          Submit Risk
        </Button>
      </div>
    </div>
  );
}
