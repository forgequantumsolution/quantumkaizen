import { useState } from 'react';
import { ChevronRight, ChevronDown, Copy, CheckCheck } from 'lucide-react';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  description: string;
  requestBody?: string;
  response: string;
}

interface ApiGroup {
  name: string;
  endpoints: Endpoint[];
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-amber-100 text-amber-700',
  PATCH: 'bg-purple-100 text-purple-700',
  DELETE: 'bg-red-100 text-red-700',
};

const API_GROUPS: ApiGroup[] = [
  {
    name: 'Non-Conformances',
    endpoints: [
      { method: 'GET', path: '/api/qms/non-conformances', description: 'List all NCs with optional filters (?status=OPEN&severity=CRITICAL)', response: '{ data: NC[], total: number, page: number }' },
      { method: 'POST', path: '/api/qms/non-conformances', description: 'Create a new non-conformance', requestBody: '{ title, description, severity, department, detectedBy }', response: '{ id, ncNumber, ...NC }' },
      { method: 'GET', path: '/api/qms/non-conformances/:id', description: 'Get NC details', response: '{ ...NC, timeline: [], attachments: [] }' },
      { method: 'PATCH', path: '/api/qms/non-conformances/:id', description: 'Update NC fields or status', requestBody: '{ status?, disposition?, rootCause? }', response: '{ ...updatedNC }' },
    ],
  },
  {
    name: 'CAPA',
    endpoints: [
      { method: 'GET', path: '/api/qms/capa', description: 'List CAPAs (?status=&severity=&source=&department=&search=)', response: '{ data: CAPA[], total, page }' },
      { method: 'POST', path: '/api/qms/capa', description: 'Initiate new CAPA', requestBody: '{ title, description, source, severity, department, owner, dueDate }', response: '{ id, capaNumber, ...CAPA }' },
      { method: 'GET', path: '/api/qms/capa/:id', description: 'CAPA detail with actions, history, effectiveness', response: '{ ...CAPA, actions: [], history: [] }' },
      { method: 'PATCH', path: '/api/qms/capa/:id/status', description: 'Advance CAPA lifecycle stage', requestBody: '{ status, notes }', response: '{ ...updatedCAPA }' },
      { method: 'POST', path: '/api/qms/capa/:id/actions', description: 'Add corrective action to CAPA', requestBody: '{ description, type, owner, dueDate }', response: '{ ...action }' },
    ],
  },
  {
    name: 'Audits',
    endpoints: [
      { method: 'GET', path: '/api/qms/audits', description: 'List audits (?status=&type=)', response: '{ data: Audit[], stats: AuditStats }' },
      { method: 'POST', path: '/api/qms/audits', description: 'Schedule new audit', requestBody: '{ title, type, standard, scope, department, leadAuditor, plannedStart, plannedEnd }', response: '{ id, auditNumber, ...Audit }' },
      { method: 'GET', path: '/api/qms/audits/:id', description: 'Audit detail with findings and team', response: '{ ...Audit, findings: [], auditTeam: [] }' },
      { method: 'POST', path: '/api/qms/audits/:id/findings', description: 'Add finding to audit', requestBody: '{ type, clause, description }', response: '{ ...finding }' },
    ],
  },
  {
    name: 'Risk Register',
    endpoints: [
      { method: 'GET', path: '/api/qms/risks', description: 'List risks (?category=&status=)', response: '{ data: Risk[], heatmap: HeatmapData }' },
      { method: 'POST', path: '/api/qms/risks', description: 'Create risk entry', requestBody: '{ title, category, likelihood, severity, description, owner }', response: '{ id, riskNumber, riskScore, ...Risk }' },
      { method: 'PATCH', path: '/api/qms/risks/:id', description: 'Update risk or record treatment', requestBody: '{ status?, treatment?, residualLikelihood?, residualSeverity? }', response: '{ ...updatedRisk }' },
    ],
  },
  {
    name: 'Documents (DMS)',
    endpoints: [
      { method: 'GET', path: '/api/dms/documents', description: 'List documents (?category=&status=)', response: '{ data: Document[], total }' },
      { method: 'POST', path: '/api/dms/documents', description: 'Upload new document (multipart/form-data)', requestBody: 'FormData: { file, title, category, department, effectiveDate }', response: '{ id, docNumber, version, ...Document }' },
      { method: 'POST', path: '/api/dms/documents/:id/versions', description: 'Upload new version of document', requestBody: 'FormData: { file, changeNotes }', response: '{ version, ...DocumentVersion }' },
      { method: 'POST', path: '/api/dms/documents/:id/acknowledge', description: 'Submit e-signature acknowledgment', requestBody: '{ userId, signature, password }', response: '{ acknowledged: true, timestamp }' },
    ],
  },
  {
    name: 'Suppliers',
    endpoints: [
      { method: 'GET', path: '/api/qms/suppliers', description: 'List suppliers (?status=&category=&search=)', response: '{ data: Supplier[], total }' },
      { method: 'POST', path: '/api/qms/suppliers', description: 'Register new supplier', requestBody: '{ name, code, category, contactPerson, email, phone, address }', response: '{ id, ...Supplier }' },
      { method: 'GET', path: '/api/qms/suppliers/:id/performance', description: 'Get supplier scorecard', response: '{ quality, delivery, cost, responsiveness, overallScore, trend }' },
    ],
  },
  {
    name: 'Calibration',
    endpoints: [
      { method: 'GET', path: '/api/calibration', description: 'List calibration records (?status=&category=)', response: '{ data: CalibrationRecord[], stats }' },
      { method: 'POST', path: '/api/calibration', description: 'Register equipment for calibration', requestBody: '{ name, manufacturer, model, serialNumber, category, location, frequency }', response: '{ id, equipmentId, ...CalibrationRecord }' },
      { method: 'POST', path: '/api/calibration/:id/calibrate', description: 'Record new calibration event', requestBody: '{ calibratedBy, certificate, notes, nextDue }', response: '{ ...updatedRecord }' },
    ],
  },
  {
    name: 'Authentication',
    endpoints: [
      { method: 'POST', path: '/api/auth/login', description: 'Login with email and password', requestBody: '{ email, password }', response: '{ token, user: { id, name, email, role } }' },
      { method: 'POST', path: '/api/auth/logout', description: 'Invalidate session token', response: '{ success: true }' },
      { method: 'POST', path: '/api/auth/refresh', description: 'Refresh JWT token', requestBody: '{ refreshToken }', response: '{ token, refreshToken }' },
      { method: 'POST', path: '/api/auth/2fa/setup', description: 'Generate 2FA TOTP secret + QR code', response: '{ secret, qrCode: "data:image/png;base64,..." }' },
      { method: 'POST', path: '/api/auth/2fa/verify', description: 'Verify TOTP code and enable 2FA', requestBody: '{ code }', response: '{ enabled: true }' },
    ],
  },
];

export default function ApiDocsPage() {
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['Non-Conformances']));
  const [openEndpoints, setOpenEndpoints] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState('');

  const toggleGroup = (name: string) =>
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });

  const toggleEndpoint = (key: string) =>
    setOpenEndpoints((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      <div>
        <h1 className="text-h1 text-gray-900">API Documentation</h1>
        <p className="text-body text-gray-500 mt-0.5">REST API reference for Quantum Kaizen integrations</p>
      </div>

      {/* Base URL banner */}
      <div className="flex items-center justify-between bg-gray-900 text-gray-100 rounded-xl px-4 py-3">
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wider mr-3">Base URL</span>
          <code className="text-sm font-mono text-blue-600">https://api.quantumkaizen.com/v1</code>
        </div>
        <div className="text-xs text-gray-400">All requests require <code className="text-gray-200">Authorization: Bearer &lt;token&gt;</code></div>
      </div>

      {/* Groups */}
      {API_GROUPS.map((group) => (
        <div key={group.name} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggleGroup(group.name)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
          >
            <span className="font-semibold text-gray-900">{group.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{group.endpoints.length} endpoints</span>
              {openGroups.has(group.name) ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
            </div>
          </button>

          {openGroups.has(group.name) && (
            <div className="border-t border-gray-100 divide-y divide-gray-50">
              {group.endpoints.map((ep) => {
                const epKey = `${group.name}:${ep.method}:${ep.path}`;
                const isOpen = openEndpoints.has(epKey);
                return (
                  <div key={epKey}>
                    <button
                      onClick={() => toggleEndpoint(epKey)}
                      className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50/60 transition-colors"
                    >
                      <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono w-16 text-center shrink-0 ${METHOD_COLORS[ep.method]}`}>
                        {ep.method}
                      </span>
                      <code className="text-sm font-mono text-gray-800 flex-1">{ep.path}</code>
                      <span className="text-xs text-gray-400 hidden sm:block">{ep.description}</span>
                      {isOpen ? <ChevronDown size={14} className="text-gray-300 shrink-0" /> : <ChevronRight size={14} className="text-gray-300 shrink-0" />}
                    </button>

                    {isOpen && (
                      <div className="px-5 pb-4 space-y-3 bg-gray-50/40">
                        <p className="text-sm text-gray-600">{ep.description}</p>
                        {ep.requestBody && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Request Body</span>
                              <button onClick={() => copy(ep.requestBody!, epKey + 'req')} className="text-gray-400 hover:text-gray-600">
                                {copied === epKey + 'req' ? <CheckCheck size={13} className="text-green-500" /> : <Copy size={13} />}
                              </button>
                            </div>
                            <pre className="text-xs bg-gray-900 text-green-300 rounded-lg p-3 overflow-x-auto font-mono">{ep.requestBody}</pre>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Response</span>
                            <button onClick={() => copy(ep.response, epKey + 'res')} className="text-gray-400 hover:text-gray-600">
                              {copied === epKey + 'res' ? <CheckCheck size={13} className="text-green-500" /> : <Copy size={13} />}
                            </button>
                          </div>
                          <pre className="text-xs bg-gray-900 text-blue-300 rounded-lg p-3 overflow-x-auto font-mono">{ep.response}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
