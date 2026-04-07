import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useCreateAudit, type AuditType } from './hooks';

export default function AuditCreatePage() {
  const navigate = useNavigate();
  const createAudit = useCreateAudit();

  const [form, setForm] = useState<{
    title: string; type: AuditType; standard: string; scope: string;
    department: string; leadAuditor: string; plannedStart: string; plannedEnd: string;
  }>({
    title: '',
    type: 'INTERNAL',
    standard: 'ISO 9001:2015',
    scope: '',
    department: '',
    leadAuditor: '',
    plannedStart: '',
    plannedEnd: '',
  });

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createAudit.mutateAsync(form);
      navigate('/qms/audits');
    } catch {
      navigate('/qms/audits');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-h1 text-gray-900">Schedule Audit</h1>
          <p className="text-body text-gray-500 mt-0.5">Plan a new internal, external, or supplier audit</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label label-required">Audit Title</label>
            <input
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="e.g. ISO 9001:2015 Internal Audit — Q2 Production"
              className="input-base"
              required
            />
          </div>

          <div>
            <label className="label label-required">Audit Type</label>
            <select value={form.type} onChange={e => set('type', e.target.value as AuditType)} className="input-base">
              <option value="INTERNAL">Internal</option>
              <option value="EXTERNAL">External</option>
              <option value="SUPPLIER">Supplier</option>
              <option value="CERTIFICATION">Certification</option>
            </select>
          </div>

          <div>
            <label className="label label-required">Standard / Framework</label>
            <select value={form.standard} onChange={e => set('standard', e.target.value)} className="input-base">
              <option value="ISO 9001:2015">ISO 9001:2015</option>
              <option value="IATF 16949:2016">IATF 16949:2016</option>
              <option value="ISO 14001:2015">ISO 14001:2015</option>
              <option value="ISO 45001:2018">ISO 45001:2018</option>
              <option value="AS9100D">AS9100D</option>
              <option value="NADCAP">NADCAP</option>
              <option value="Custom">Custom</option>
            </select>
          </div>

          <div>
            <label className="label label-required">Department / Area</label>
            <input
              type="text"
              value={form.department}
              onChange={e => set('department', e.target.value)}
              placeholder="e.g. Production, Quality, R&D"
              className="input-base"
              required
            />
          </div>

          <div>
            <label className="label label-required">Lead Auditor</label>
            <input
              type="text"
              value={form.leadAuditor}
              onChange={e => set('leadAuditor', e.target.value)}
              placeholder="Full name"
              className="input-base"
              required
            />
          </div>

          <div>
            <label className="label label-required">Planned Start</label>
            <input
              type="date"
              value={form.plannedStart}
              onChange={e => set('plannedStart', e.target.value)}
              className="input-base"
              required
            />
          </div>

          <div>
            <label className="label label-required">Planned End</label>
            <input
              type="date"
              value={form.plannedEnd}
              onChange={e => set('plannedEnd', e.target.value)}
              className="input-base"
              required
            />
          </div>

          <div className="col-span-2">
            <label className="label label-required">Scope</label>
            <textarea
              value={form.scope}
              onChange={e => set('scope', e.target.value)}
              placeholder="Describe the audit scope, processes, and exclusions..."
              rows={3}
              className="input-base h-auto min-h-[80px] py-2.5 resize-none"
              required
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <Button variant="outline" type="button" onClick={() => navigate(-1)}>Cancel</Button>
          <Button variant="primary" type="submit" isLoading={createAudit.isPending}>
            Schedule Audit
          </Button>
        </div>
      </form>
    </div>
  );
}
