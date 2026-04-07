import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  Button,
  Badge,
} from '@/components/ui';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import { useCreateFMEA } from './hooks';

interface FailureModeEntry {
  function: string;
  failureMode: string;
  effect: string;
  severity: string;
  cause: string;
  occurrence: string;
  preventionControl: string;
  detectionControl: string;
  detection: string;
  recommendedAction: string;
  responsible: string;
  targetDate: string;
}

const emptyFailureMode: FailureModeEntry = {
  function: '',
  failureMode: '',
  effect: '',
  severity: '',
  cause: '',
  occurrence: '',
  preventionControl: '',
  detectionControl: '',
  detection: '',
  recommendedAction: '',
  responsible: '',
  targetDate: '',
};

export default function FMEACreatePage() {
  const navigate = useNavigate();
  const createFMEA = useCreateFMEA();

  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [productProcess, setProductProcess] = useState('');
  const [teamMembers, setTeamMembers] = useState('');
  const [scope, setScope] = useState('');
  const [failureModes, setFailureModes] = useState<FailureModeEntry[]>([{ ...emptyFailureMode }]);

  const updateFailureMode = (index: number, field: keyof FailureModeEntry, value: string) => {
    setFailureModes((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addFailureMode = () => {
    setFailureModes((prev) => [...prev, { ...emptyFailureMode }]);
  };

  const removeFailureMode = (index: number) => {
    if (failureModes.length <= 1) return;
    setFailureModes((prev) => prev.filter((_, i) => i !== index));
  };

  const computeRPN = (fm: FailureModeEntry) => {
    const s = parseInt(fm.severity) || 0;
    const o = parseInt(fm.occurrence) || 0;
    const d = parseInt(fm.detection) || 0;
    return s * o * d;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createFMEA.mutateAsync({ title, type, productProcess, teamMembers, scope, failureModes });
    } catch {
      // falls through — mock mode
    }
    navigate('/qms/fmea');
  };

  const severityOptions = Array.from({ length: 10 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/qms/fmea')}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Create FMEA</h1>
          <p className="mt-1 text-sm text-slate-500">
            Define a new Failure Mode and Effects Analysis
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* FMEA Details */}
        <Card>
          <CardHeader>
            <CardTitle>FMEA Details</CardTitle>
          </CardHeader>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Input
              label="Title"
              placeholder="e.g., Brake Assembly Process FMEA"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <Select
              label="Type"
              placeholder="Select FMEA type"
              options={[
                { value: 'DFMEA', label: 'DFMEA (Design)' },
                { value: 'PFMEA', label: 'PFMEA (Process)' },
              ]}
              value={type}
              onChange={(e) => setType(e.target.value)}
              required
            />
            <Input
              label="Product / Process Name"
              placeholder="e.g., Brake Assembly Line 3"
              value={productProcess}
              onChange={(e) => setProductProcess(e.target.value)}
              required
            />
            <Input
              label="Team Members"
              placeholder="Comma-separated names"
              value={teamMembers}
              onChange={(e) => setTeamMembers(e.target.value)}
              helperText="Enter names separated by commas"
            />
            <div className="sm:col-span-2">
              <Textarea
                label="FMEA Scope"
                placeholder="Describe the scope and boundaries of this FMEA..."
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                required
              />
            </div>
          </div>
        </Card>

        {/* Initial Failure Modes */}
        <Card>
          <CardHeader>
            <CardTitle>Initial Failure Modes</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={addFailureMode}>
              <Plus className="h-4 w-4" />
              Add Row
            </Button>
          </CardHeader>

          <div className="space-y-6">
            {failureModes.map((fm, index) => (
              <div
                key={index}
                className="relative border border-surface-border rounded-lg p-5 bg-surface-secondary/20"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">FM-{index + 1}</Badge>
                    {computeRPN(fm) > 0 && (
                      <span className="text-xs text-slate-500">
                        RPN: <span className="font-bold">{computeRPN(fm)}</span>
                      </span>
                    )}
                  </div>
                  {failureModes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeFailureMode(index)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <Input
                    label="Function / Requirement"
                    placeholder="What is the function?"
                    value={fm.function}
                    onChange={(e) => updateFailureMode(index, 'function', e.target.value)}
                    required
                  />
                  <Input
                    label="Potential Failure Mode"
                    placeholder="How could it fail?"
                    value={fm.failureMode}
                    onChange={(e) => updateFailureMode(index, 'failureMode', e.target.value)}
                    required
                  />
                  <Input
                    label="Potential Effect"
                    placeholder="What is the effect of failure?"
                    value={fm.effect}
                    onChange={(e) => updateFailureMode(index, 'effect', e.target.value)}
                    required
                  />
                  <Select
                    label="Severity (1-10)"
                    placeholder="Select"
                    options={severityOptions}
                    value={fm.severity}
                    onChange={(e) => updateFailureMode(index, 'severity', e.target.value)}
                    required
                  />
                  <Input
                    label="Potential Cause"
                    placeholder="Root cause of failure"
                    value={fm.cause}
                    onChange={(e) => updateFailureMode(index, 'cause', e.target.value)}
                    required
                  />
                  <Select
                    label="Occurrence (1-10)"
                    placeholder="Select"
                    options={severityOptions}
                    value={fm.occurrence}
                    onChange={(e) => updateFailureMode(index, 'occurrence', e.target.value)}
                    required
                  />
                  <Input
                    label="Prevention Controls"
                    placeholder="Current prevention measures"
                    value={fm.preventionControl}
                    onChange={(e) => updateFailureMode(index, 'preventionControl', e.target.value)}
                  />
                  <Input
                    label="Detection Controls"
                    placeholder="Current detection measures"
                    value={fm.detectionControl}
                    onChange={(e) => updateFailureMode(index, 'detectionControl', e.target.value)}
                  />
                  <Select
                    label="Detection (1-10)"
                    placeholder="Select"
                    options={severityOptions}
                    value={fm.detection}
                    onChange={(e) => updateFailureMode(index, 'detection', e.target.value)}
                    required
                  />
                  <Input
                    label="Recommended Action"
                    placeholder="What action should be taken?"
                    value={fm.recommendedAction}
                    onChange={(e) => updateFailureMode(index, 'recommendedAction', e.target.value)}
                  />
                  <Input
                    label="Responsible"
                    placeholder="Person responsible"
                    value={fm.responsible}
                    onChange={(e) => updateFailureMode(index, 'responsible', e.target.value)}
                  />
                  <Input
                    label="Target Date"
                    type="date"
                    value={fm.targetDate}
                    onChange={(e) => updateFailureMode(index, 'targetDate', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/qms/fmea')}>
            Cancel
          </Button>
          <Button type="submit">
            Create FMEA
          </Button>
        </div>
      </form>
    </div>
  );
}
