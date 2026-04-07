import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Plus, Trash2, Upload } from 'lucide-react';
import { Card, CardTitle, Button } from '@/components/ui';
import { useCreateComplaint } from './hooks';

const SEVERITIES = [
  { value: 'Critical', label: 'Critical' },
  { value: 'Major', label: 'Major' },
  { value: 'Minor', label: 'Minor' },
];

const PRODUCTS = [
  'Pressure Vessel',
  'Heat Exchanger',
  'Fabricated Column',
  'Turbine Blade Castings',
  'Machined Flanges',
  'Forged Rings',
  'Structural Steel Members',
  'Valve Body',
  'Piping Spools',
  'Storage Tank',
];

const USERS = [
  { id: 'u1', name: 'Priya Sharma' },
  { id: 'u2', name: 'Rajesh Kumar' },
  { id: 'u3', name: 'Anita Desai' },
  { id: 'u4', name: 'Vikram Patel' },
  { id: 'u5', name: 'Sunita Rao' },
  { id: 'u6', name: 'Deepak Nair' },
];

interface ContainmentRow {
  id: string;
  description: string;
  owner: string;
  dueDate: string;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-500/20';
const labelClass = 'mb-1.5 block text-sm font-medium text-slate-700';

export default function ComplaintCreatePage() {
  const navigate = useNavigate();
  const createMutation = useCreateComplaint();

  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [productService, setProductService] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState('');
  const [batchOrderRef, setBatchOrderRef] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  const [containmentActions, setContainmentActions] = useState<ContainmentRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!customerName.trim()) errs.customerName = 'Customer name is required';
    if (!subject.trim()) errs.subject = 'Subject is required';
    if (!description.trim()) errs.description = 'Description is required';
    if (!severity) errs.severity = 'Severity is required';
    if (!receivedDate) errs.receivedDate = 'Received date is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const payload = {
      customerName,
      customerContact,
      customerEmail,
      productService,
      subject,
      description,
      severity,
      batchOrderRef,
      receivedDate,
      assignedTo,
      containmentActions: containmentActions.filter((a) => a.description),
      status: 'Received',
    };

    try {
      await createMutation.mutateAsync(payload);
      navigate('/qms/complaints');
    } catch {
      // error handled in hook
    }
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <button
          onClick={() => navigate('/qms/complaints')}
          className="hover:text-navy-700 transition-colors"
        >
          Customer Complaints
        </button>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-slate-900">Log Complaint</span>
      </nav>

      <h1 className="text-2xl font-bold text-slate-900">Log Customer Complaint</h1>

      {/* Customer Information */}
      <Card className="max-w-3xl">
        <CardTitle>Customer Information</CardTitle>
        <div className="mt-4 space-y-5">
          <div>
            <label className={labelClass}>
              Customer Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className={inputClass}
              placeholder="e.g., Bharat Heavy Electricals Ltd"
            />
            {errors.customerName && (
              <p className="mt-1 text-xs text-red-600">{errors.customerName}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Customer Contact Person</label>
              <input
                type="text"
                value={customerContact}
                onChange={(e) => setCustomerContact(e.target.value)}
                className={inputClass}
                placeholder="Contact person name"
              />
            </div>
            <div>
              <label className={labelClass}>Customer Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className={inputClass}
                placeholder="email@company.com"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Complaint Details */}
      <Card className="max-w-3xl">
        <CardTitle>Complaint Details</CardTitle>
        <div className="mt-4 space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Product / Service</label>
              <select
                value={productService}
                onChange={(e) => setProductService(e.target.value)}
                className={inputClass}
              >
                <option value="">Select product/service</option>
                {PRODUCTS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>
                Severity <span className="text-red-500">*</span>
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
                className={inputClass}
              >
                <option value="">Select severity</option>
                {SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              {errors.severity && (
                <p className="mt-1 text-xs text-red-600">{errors.severity}</p>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Complaint Subject <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={inputClass}
              placeholder="Brief subject line for the complaint"
            />
            {errors.subject && (
              <p className="mt-1 text-xs text-red-600">{errors.subject}</p>
            )}
          </div>

          <div>
            <label className={labelClass}>
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className={inputClass}
              placeholder="Describe the complaint in detail — what was reported, affected quantities, impact to customer"
            />
            {errors.description && (
              <p className="mt-1 text-xs text-red-600">{errors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Batch / Order Reference</label>
              <input
                type="text"
                value={batchOrderRef}
                onChange={(e) => setBatchOrderRef(e.target.value)}
                className={inputClass}
                placeholder="e.g., PO-2026-BHEL-445 / TC-2026-078"
              />
            </div>
            <div>
              <label className={labelClass}>
                Date Received <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className={inputClass}
              />
              {errors.receivedDate && (
                <p className="mt-1 text-xs text-red-600">{errors.receivedDate}</p>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>Assign To</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className={inputClass}
            >
              <option value="">Select assignee</option>
              {USERS.map((u) => (
                <option key={u.id} value={u.name}>{u.name}</option>
              ))}
            </select>
          </div>

          {/* Evidence Upload */}
          <div>
            <label className={labelClass}>Evidence</label>
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-8 transition hover:border-navy-400">
              <Upload className="mb-2 h-8 w-8 text-slate-400" />
              <p className="text-sm text-slate-600">
                Drag & drop evidence files, or{' '}
                <span className="cursor-pointer text-navy-600 underline">browse</span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Photos, test reports, customer correspondence
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Immediate Containment Actions */}
      <Card className="max-w-3xl">
        <CardTitle>Immediate Containment Actions</CardTitle>
        <p className="mt-1 text-sm text-slate-500">
          Define immediate actions to contain the issue and prevent further customer impact.
        </p>

        <div className="mt-4 space-y-4">
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
                className={inputClass}
                placeholder="Describe the containment action"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <input
                  value={action.owner}
                  onChange={(e) => updateContainmentRow(action.id, 'owner', e.target.value)}
                  className={inputClass}
                  placeholder="Action owner"
                />
                <input
                  type="date"
                  value={action.dueDate}
                  onChange={(e) => updateContainmentRow(action.id, 'dueDate', e.target.value)}
                  className={inputClass}
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
        </div>
      </Card>

      {/* Actions */}
      <div className="max-w-3xl flex items-center justify-end gap-3 border-t border-slate-200 pt-5">
        <Button variant="outline" onClick={() => navigate('/qms/complaints')}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Submitting...' : 'Log Complaint'}
        </Button>
      </div>
    </div>
  );
}
