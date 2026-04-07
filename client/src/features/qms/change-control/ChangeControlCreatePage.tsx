import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Upload } from 'lucide-react';
import { Card, CardTitle, Button } from '@/components/ui';
import { useCreateChangeRequest } from './hooks';

const CHANGE_TYPES = [
  { value: 'Process', label: 'Process Change' },
  { value: 'Product', label: 'Product Change' },
  { value: 'System', label: 'System Change' },
  { value: 'Document', label: 'Document Change' },
];

const IMPACT_LEVELS = [
  { value: 'High', label: 'High' },
  { value: 'Medium', label: 'Medium' },
  { value: 'Low', label: 'Low' },
];

const DOCUMENTS = [
  'QM-001 (Quality Manual)',
  'SOP-HT-003 (Heat Treatment Procedure)',
  'SOP-DCC-001 (Document Control Procedure)',
  'WPS-108 (Welding Procedure Specification)',
  'QCP-2026-015 (Quality Control Plan)',
  'INSP-PV-001 (Final Inspection Checklist)',
  'WI-FLNG-001 (Flange Assembly Work Instruction)',
  'SOP-IQC-001 (Incoming Inspection)',
  'PUR-SPEC-012 (Purchase Specification)',
  'AVL-2026 (Approved Vendor List)',
];

const PROCESSES = [
  'Heat Treatment',
  'CNC Machining',
  'Welding',
  'Surface Treatment',
  'Assembly',
  'Final Inspection',
  'Incoming Inspection',
  'NDE',
  'Pressure Testing',
  'Procurement',
  'Document Control',
];

const DEPARTMENTS = [
  'Quality Assurance',
  'Quality Control',
  'Production',
  'Engineering',
  'HSE',
  'Procurement',
  'HR & Training',
  'IT',
  'Management',
];

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20';
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700';

export default function ChangeControlCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateChangeRequest();

  const [title, setTitle] = useState('');
  const [changeType, setChangeType] = useState('');
  const [impactLevel, setImpactLevel] = useState('');
  const [description, setDescription] = useState('');
  const [reasonForChange, setReasonForChange] = useState('');
  const [impactAssessment, setImpactAssessment] = useState('');
  const [riskAssessment, setRiskAssessment] = useState('');
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [selectedProcesses, setSelectedProcesses] = useState<string[]>([]);
  const [regulatoryNotification, setRegulatoryNotification] = useState(false);
  const [targetDate, setTargetDate] = useState('');
  const [notifyDepartments, setNotifyDepartments] = useState<string[]>([]);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleDocument = (doc: string) => {
    setSelectedDocuments((prev) =>
      prev.includes(doc) ? prev.filter((d) => d !== doc) : [...prev, doc],
    );
  };

  const toggleProcess = (proc: string) => {
    setSelectedProcesses((prev) =>
      prev.includes(proc) ? prev.filter((p) => p !== proc) : [...prev, proc],
    );
  };

  const toggleDepartment = (dept: string) => {
    setNotifyDepartments((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept],
    );
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Title is required';
    if (!changeType) errs.changeType = 'Change type is required';
    if (!description.trim()) errs.description = 'Description is required';
    if (!reasonForChange.trim()) errs.reasonForChange = 'Reason for change is required';
    if (!impactAssessment.trim()) errs.impactAssessment = 'Impact assessment is required';
    if (!targetDate) errs.targetDate = 'Target implementation date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const buildPayload = (status: string) => ({
    title,
    changeType,
    impactLevel,
    description,
    reasonForChange,
    impactAssessment,
    riskAssessment,
    affectedDocuments: selectedDocuments,
    affectedProcesses: selectedProcesses,
    regulatoryNotification,
    targetDate,
    notifyDepartments,
    status,
  });

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      await createMutation.mutateAsync(buildPayload('SUBMITTED'));
      navigate('/qms/change-control');
    } catch {
      // error handled in hook
    }
  };

  const handleSaveAsDraft = async () => {
    if (!title.trim()) {
      setErrors({ title: 'Title is required' });
      return;
    }

    try {
      await createMutation.mutateAsync(buildPayload('DRAFT'));
      navigate('/qms/change-control');
    } catch {
      // error handled in hook
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <button
          onClick={() => navigate('/qms/change-control')}
          className="hover:text-navy-700 transition-colors"
        >
          Change Control
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">New Change Request</span>
      </nav>

      <h1 className="text-2xl font-bold text-slate-900">New Change Request</h1>

      {/* Change Details */}
      <Card className="max-w-3xl">
        <CardTitle>Change Details</CardTitle>
        <div className="mt-4 space-y-5">
          <div>
            <label className={labelClass}>
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="Brief title describing the proposed change"
            />
            {errors.title && (
              <p className="mt-1 text-xs text-red-600">{errors.title}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>
                Change Type <span className="text-red-500">*</span>
              </label>
              <select
                value={changeType}
                onChange={(e) => setChangeType(e.target.value)}
                className={inputClass}
              >
                <option value="">Select type</option>
                {CHANGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {errors.changeType && (
                <p className="mt-1 text-xs text-red-600">{errors.changeType}</p>
              )}
            </div>
            <div>
              <label className={labelClass}>Impact Level</label>
              <select
                value={impactLevel}
                onChange={(e) => setImpactLevel(e.target.value)}
                className={inputClass}
              >
                <option value="">Select impact level</option>
                {IMPACT_LEVELS.map((i) => (
                  <option key={i.value} value={i.value}>{i.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Description of Change <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className={inputClass}
              placeholder="Describe the proposed change in detail — what will be changed, how, and where"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-600">{errors.description}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>
              Reason for Change <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reasonForChange}
              onChange={(e) => setReasonForChange(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Explain why this change is needed — regulatory, safety, improvement, customer requirement, etc."
            />
            {errors.reasonForChange && (
              <p className="mt-1 text-xs text-red-600">{errors.reasonForChange}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>
              Impact Assessment <span className="text-red-500">*</span>
            </label>
            <textarea
              value={impactAssessment}
              onChange={(e) => setImpactAssessment(e.target.value)}
              rows={4}
              className={inputClass}
              placeholder="Describe the impact on production, quality, costs, timelines, and resources"
            />
            {errors.impactAssessment && (
              <p className="mt-1 text-xs text-red-600">{errors.impactAssessment}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>Risk Assessment</label>
            <textarea
              value={riskAssessment}
              onChange={(e) => setRiskAssessment(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Identify risks associated with this change and proposed mitigations"
            />
          </div>

          {/* Affected Documents */}
          <div>
            <label className={labelClass}>Affected Documents</label>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DOCUMENTS.map((doc) => (
                <label
                  key={doc}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedDocuments.includes(doc)}
                    onChange={() => toggleDocument(doc)}
                    className="h-4 w-4 rounded border-slate-300 text-navy-600 focus:ring-navy-500"
                  />
                  <span className="text-slate-700">{doc}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Affected Processes */}
          <div>
            <label className={labelClass}>Affected Processes</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PROCESSES.map((proc) => (
                <button
                  key={proc}
                  type="button"
                  onClick={() => toggleProcess(proc)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                    selectedProcesses.includes(proc)
                      ? 'bg-navy-50 text-navy-700 ring-navy-600/30'
                      : 'bg-slate-50 text-slate-600 ring-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {proc}
                </button>
              ))}
            </div>
          </div>

          {/* Regulatory */}
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={regulatoryNotification}
                onChange={(e) => setRegulatoryNotification(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-navy-600 focus:ring-navy-500"
              />
              <span className="text-sm font-medium text-slate-700">
                Regulatory notification required
              </span>
            </label>
            <p className="mt-1 ml-7 text-xs text-slate-400">
              Check if this change requires notification to regulatory bodies (ASME, IBR, PESO, etc.)
            </p>
          </div>

          {/* Target Date */}
          <div>
            <label className={labelClass}>
              Target Implementation Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className={inputClass}
            />
            {errors.targetDate && (
              <p className="mt-1 text-xs text-red-600">{errors.targetDate}</p>
            )}
          </div>
        </div>
      </Card>

      {/* Stakeholder Notification */}
      <Card className="max-w-3xl">
        <CardTitle>Stakeholder Notification</CardTitle>
        <p className="mt-1 text-sm text-slate-500">
          Select departments to notify about this change request
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {DEPARTMENTS.map((dept) => (
            <label
              key={dept}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <input
                type="checkbox"
                checked={notifyDepartments.includes(dept)}
                onChange={() => toggleDepartment(dept)}
                className="h-4 w-4 rounded border-slate-300 text-navy-600 focus:ring-navy-500"
              />
              <span className="text-slate-700">{dept}</span>
            </label>
          ))}
        </div>
      </Card>

      {/* Evidence Upload */}
      <Card className="max-w-3xl">
        <CardTitle>Supporting Documents</CardTitle>
        <div className="mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 transition hover:border-navy-400">
          <Upload className="mb-2 h-8 w-8 text-slate-400" />
          <p className="text-sm text-slate-600">
            Drag & drop supporting files, or{' '}
            <span className="cursor-pointer text-navy-600 underline">browse</span>
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Technical reports, test data, code change specifications
          </p>
        </div>
      </Card>

      {/* Actions */}
      <div className="max-w-3xl flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
        <Button variant="outline" onClick={() => navigate('/qms/change-control')}>
          Cancel
        </Button>
        <Button variant="outline" onClick={handleSaveAsDraft} disabled={createMutation.isPending}>
          Save as Draft
        </Button>
        <Button onClick={handleSubmit} disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Submitting...' : 'Submit for Review'}
        </Button>
      </div>
    </div>
  );
}
