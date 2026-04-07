import { useState } from 'react';
import {
  Building2, Users, GitBranch, Bell, Shield,
  Save, Upload, Plus, Trash2, Check, ChevronDown, Eye, EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

// ── Mock data ────────────────────────────────────────────────
const mockUsers = [
  { id: '1', name: 'Admin User', email: 'admin@forgequantum.com', role: 'QMS_ADMIN', department: 'Quality', status: 'active', lastLogin: '2026-03-31' },
  { id: '2', name: 'Sarah Johnson', email: 'sarah@forgequantum.com', role: 'QUALITY_ENGINEER', department: 'Quality', status: 'active', lastLogin: '2026-03-30' },
  { id: '3', name: 'David Kim', email: 'david@forgequantum.com', role: 'AUDITOR', department: 'Quality', status: 'active', lastLogin: '2026-03-29' },
  { id: '4', name: 'Emma Wilson', email: 'emma@forgequantum.com', role: 'DOCUMENT_CONTROLLER', department: 'QA', status: 'active', lastLogin: '2026-03-28' },
  { id: '5', name: 'Tom Richards', email: 'tom@forgequantum.com', role: 'READ_ONLY', department: 'Operations', status: 'inactive', lastLogin: '2026-02-15' },
];

const ROLES = ['SUPER_ADMIN','QMS_ADMIN','QUALITY_ENGINEER','AUDITOR','DOCUMENT_CONTROLLER','NC_INITIATOR','CAPA_OWNER','RISK_OWNER','SUPPLIER_MANAGER','READ_ONLY'];

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-700',
  QMS_ADMIN: 'bg-slate-900/10 text-slate-900',
  QUALITY_ENGINEER: 'bg-blue-100 text-blue-700',
  AUDITOR: 'bg-purple-100 text-purple-700',
  DOCUMENT_CONTROLLER: 'bg-green-100 text-green-700',
  NC_INITIATOR: 'bg-amber-100 text-amber-700',
  CAPA_OWNER: 'bg-orange-100 text-orange-700',
  RISK_OWNER: 'bg-red-100 text-red-600',
  SUPPLIER_MANAGER: 'bg-teal-100 text-teal-700',
  READ_ONLY: 'bg-gray-100 text-gray-600',
};

const tabs = [
  { key: 'general', label: 'General', icon: Building2 },
  { key: 'users', label: 'Users & Roles', icon: Users },
  { key: 'workflows', label: 'Workflows', icon: GitBranch },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'security', label: 'Security', icon: Shield },
] as const;

type Tab = typeof tabs[number]['key'];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [saved, setSaved] = useState(false);

  // General settings state
  const [company, setCompany] = useState({
    name: 'Forge Quantum Solutions',
    tenantCode: 'FORGE-QS',
    industry: 'Automotive',
    timezone: 'Asia/Kolkata',
    dateFormat: 'DD/MM/YYYY',
    standard: 'IATF 16949:2016',
    address: '123 Industrial Zone, Pune, Maharashtra 411001',
    website: 'https://forgequantum.com',
  });

  // Users state
  const [users, setUsers] = useState(mockUsers);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('READ_ONLY');

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState({
    emailOnAssignment: true,
    emailOnApproval: true,
    emailOnOverdue: true,
    emailOnExpiry: true,
    emailDigest: 'DAILY',
    inAppAssignment: true,
    inAppApproval: true,
    inAppOverdue: true,
    inAppExpiry: true,
  });

  // Security state
  const [security, setSecurity] = useState({
    sessionTimeout: '480',
    require2FA: false,
    passwordMinLength: '8',
    passwordRequireSpecial: true,
    passwordRequireNumbers: true,
    maxLoginAttempts: '5',
    ssoEnabled: false,
    ssoProvider: 'SAML',
  });

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 text-gray-900">Settings</h1>
          <p className="text-body text-gray-500 mt-0.5">Manage your organization's configuration and preferences</p>
        </div>
        <Button variant="primary" onClick={handleSave}>
          {saved ? <Check size={15} /> : <Save size={15} />}
          {saved ? 'Saved!' : 'Save Changes'}
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar tabs */}
        <div className="w-48 shrink-0">
          <nav className="space-y-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-175',
                    activeTab === tab.key
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <Icon size={16} className={activeTab === tab.key ? 'text-blue-600-light' : 'text-gray-400'} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">

          {/* ── GENERAL ─────────────────────────────────── */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Logo */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-h3 text-gray-900 mb-4">Organization Identity</h2>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-16 h-16 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
                    <span className="text-blue-600 font-bold text-xl">QK</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Organization Logo</p>
                    <p className="text-xs text-gray-500 mt-0.5">PNG or SVG, max 2MB, recommended 200×200px</p>
                    <button className="mt-2 flex items-center gap-1.5 text-xs text-slate-900 font-medium hover:underline">
                      <Upload size={12} /> Upload logo
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Organization Name', key: 'name' as const },
                    { label: 'Tenant Code', key: 'tenantCode' as const },
                    { label: 'Primary Standard', key: 'standard' as const },
                    { label: 'Industry', key: 'industry' as const },
                    { label: 'Timezone', key: 'timezone' as const },
                    { label: 'Date Format', key: 'dateFormat' as const },
                  ].map(({ label, key }) => (
                    <div key={key}>
                      <label className="label">{label}</label>
                      <input
                        type="text"
                        value={company[key]}
                        onChange={e => setCompany(c => ({ ...c, [key]: e.target.value }))}
                        className="input-base"
                      />
                    </div>
                  ))}
                  <div className="col-span-2">
                    <label className="label">Address</label>
                    <input
                      type="text"
                      value={company.address}
                      onChange={e => setCompany(c => ({ ...c, address: e.target.value }))}
                      className="input-base"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Website</label>
                    <input
                      type="text"
                      value={company.website}
                      onChange={e => setCompany(c => ({ ...c, website: e.target.value }))}
                      className="input-base"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── USERS & ROLES ────────────────────────────── */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{users.filter(u => u.status === 'active').length} active users</p>
                <Button variant="primary" size="sm" onClick={() => setShowInviteForm(!showInviteForm)}>
                  <Plus size={14} />
                  Invite User
                </Button>
              </div>

              {/* Invite form */}
              {showInviteForm && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-blue-900">Invite New User</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Email Address</label>
                      <input
                        type="email"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        placeholder="user@company.com"
                        className="input-base"
                      />
                    </div>
                    <div>
                      <label className="label">Role</label>
                      <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className="input-base">
                        {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="primary" onClick={() => {
                      if (inviteEmail) {
                        setUsers(u => [...u, { id: Date.now().toString(), name: inviteEmail.split('@')[0], email: inviteEmail, role: inviteRole, department: '—', status: 'active', lastLogin: '—' }]);
                        setInviteEmail(''); setShowInviteForm(false);
                      }
                    }}>Send Invite</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowInviteForm(false)}>Cancel</Button>
                  </div>
                </div>
              )}

              {/* Users table */}
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-surface-secondary border-b border-gray-100">
                    <tr>
                      {['User', 'Role', 'Department', 'Last Login', 'Status', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {users.map(user => (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-slate-900/10 flex items-center justify-center">
                              <span className="text-xs font-medium text-slate-900">
                                {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{user.name}</p>
                              <p className="text-xs text-gray-400">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', ROLE_COLORS[user.role] ?? 'bg-gray-100 text-gray-600')}>
                            {user.role.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{user.department}</td>
                        <td className="px-4 py-3 text-gray-500">{user.lastLogin}</td>
                        <td className="px-4 py-3">
                          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', user.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setUsers(u => u.map(x => x.id === user.id ? { ...x, status: x.status === 'active' ? 'inactive' : 'active' } : x))}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                          >
                            {user.status === 'active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── WORKFLOWS ────────────────────────────────── */}
          {activeTab === 'workflows' && (
            <div className="space-y-4">
              {[
                { module: 'Document Approval', description: 'Multi-stage approval for document publishing', stages: ['Author → Reviewer → Approver'], enabled: true },
                { module: 'CAPA Approval', description: 'Corrective action plans require quality manager sign-off', stages: ['Initiator → QA Manager → QMS Admin'], enabled: true },
                { module: 'Risk Assessment', description: 'High-risk items require additional review', stages: ['Risk Owner → Risk Committee'], enabled: false },
                { module: 'Change Control', description: 'All change requests must be reviewed before implementation', stages: ['Initiator → Change Board → Management'], enabled: true },
                { module: 'Supplier Approval', description: 'New suppliers require qualification review', stages: ['Procurement → Quality → Management'], enabled: true },
              ].map(wf => (
                <div key={wf.module} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-gray-900">{wf.module}</h3>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full', wf.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500')}>
                          {wf.enabled ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{wf.description}</p>
                      <div className="flex items-center gap-1.5">
                        {wf.stages[0].split(' → ').map((stage, i, arr) => (
                          <span key={stage} className="flex items-center gap-1.5">
                            <span className="text-xs bg-slate-900/8 text-slate-900 px-2 py-0.5 rounded font-medium">{stage}</span>
                            {i < arr.length - 1 && <span className="text-gray-300">→</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button className="ml-4 text-xs text-slate-900 font-medium hover:underline shrink-0">
                      Configure
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── NOTIFICATIONS ────────────────────────────── */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <h2 className="text-h3 text-gray-900">Email Notifications</h2>
                {[
                  { key: 'emailOnAssignment' as const, label: 'New task or record assigned to me' },
                  { key: 'emailOnApproval' as const, label: 'Approval request requires my action' },
                  { key: 'emailOnOverdue' as const, label: 'My tasks or records are overdue' },
                  { key: 'emailOnExpiry' as const, label: 'Documents or certifications expiring soon' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-700">{label}</span>
                    <button
                      onClick={() => setNotifPrefs(p => ({ ...p, [key]: !p[key] }))}
                      className={cn('w-10 h-5.5 rounded-full relative transition-colors duration-200', notifPrefs[key] ? 'bg-blue-600' : 'bg-gray-200')}
                    >
                      <span className={cn('absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200', notifPrefs[key] ? 'translate-x-5' : 'translate-x-0.5')} />
                    </button>
                  </div>
                ))}
                <div>
                  <label className="label">Email Digest Frequency</label>
                  <select
                    value={notifPrefs.emailDigest}
                    onChange={e => setNotifPrefs(p => ({ ...p, emailDigest: e.target.value }))}
                    className="input-base w-48"
                  >
                    <option value="REALTIME">Real-time</option>
                    <option value="DAILY">Daily digest</option>
                    <option value="WEEKLY">Weekly digest</option>
                    <option value="NEVER">Never</option>
                  </select>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <h2 className="text-h3 text-gray-900">In-App Notifications</h2>
                {[
                  { key: 'inAppAssignment' as const, label: 'Task assignments' },
                  { key: 'inAppApproval' as const, label: 'Approval requests' },
                  { key: 'inAppOverdue' as const, label: 'Overdue alerts' },
                  { key: 'inAppExpiry' as const, label: 'Expiry warnings' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-700">{label}</span>
                    <button
                      onClick={() => setNotifPrefs(p => ({ ...p, [key]: !p[key] }))}
                      className={cn('w-10 h-5.5 rounded-full relative transition-colors duration-200', notifPrefs[key] ? 'bg-blue-600' : 'bg-gray-200')}
                    >
                      <span className={cn('absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200', notifPrefs[key] ? 'translate-x-5' : 'translate-x-0.5')} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── SECURITY ─────────────────────────────────── */}
          {activeTab === 'security' && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <h2 className="text-h3 text-gray-900">Session & Authentication</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Session Timeout (minutes)</label>
                    <input
                      type="number"
                      value={security.sessionTimeout}
                      onChange={e => setSecurity(s => ({ ...s, sessionTimeout: e.target.value }))}
                      className="input-base"
                    />
                  </div>
                  <div>
                    <label className="label">Max Login Attempts</label>
                    <input
                      type="number"
                      value={security.maxLoginAttempts}
                      onChange={e => setSecurity(s => ({ ...s, maxLoginAttempts: e.target.value }))}
                      className="input-base"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between py-2 border-t border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Require Two-Factor Authentication</p>
                    <p className="text-xs text-gray-500 mt-0.5">All users must set up TOTP before accessing the system</p>
                  </div>
                  <button
                    onClick={() => setSecurity(s => ({ ...s, require2FA: !s.require2FA }))}
                    className={cn('w-10 h-5.5 rounded-full relative transition-colors duration-200 shrink-0', security.require2FA ? 'bg-blue-600' : 'bg-gray-200')}
                  >
                    <span className={cn('absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200', security.require2FA ? 'translate-x-5' : 'translate-x-0.5')} />
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <h2 className="text-h3 text-gray-900">Password Policy</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Minimum Length</label>
                    <input
                      type="number"
                      value={security.passwordMinLength}
                      onChange={e => setSecurity(s => ({ ...s, passwordMinLength: e.target.value }))}
                      className="input-base"
                    />
                  </div>
                </div>
                {[
                  { key: 'passwordRequireSpecial' as const, label: 'Require special characters (!@#$...)' },
                  { key: 'passwordRequireNumbers' as const, label: 'Require numbers' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-700">{label}</span>
                    <button
                      onClick={() => setSecurity(s => ({ ...s, [key]: !s[key] }))}
                      className={cn('w-10 h-5.5 rounded-full relative transition-colors duration-200', security[key] ? 'bg-blue-600' : 'bg-gray-200')}
                    >
                      <span className={cn('absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200', security[key] ? 'translate-x-5' : 'translate-x-0.5')} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-h3 text-gray-900">Single Sign-On (SSO)</h2>
                    <p className="text-xs text-gray-500 mt-0.5">SAML 2.0 or OIDC integration with your identity provider</p>
                  </div>
                  <button
                    onClick={() => setSecurity(s => ({ ...s, ssoEnabled: !s.ssoEnabled }))}
                    className={cn('w-10 h-5.5 rounded-full relative transition-colors duration-200', security.ssoEnabled ? 'bg-blue-600' : 'bg-gray-200')}
                  >
                    <span className={cn('absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200', security.ssoEnabled ? 'translate-x-5' : 'translate-x-0.5')} />
                  </button>
                </div>
                {security.ssoEnabled && (
                  <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                    <div>
                      <label className="label">Protocol</label>
                      <select value={security.ssoProvider} onChange={e => setSecurity(s => ({ ...s, ssoProvider: e.target.value }))} className="input-base">
                        <option value="SAML">SAML 2.0</option>
                        <option value="OIDC">OpenID Connect</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Identity Provider URL</label>
                      <input type="text" placeholder="https://idp.company.com" className="input-base" />
                    </div>
                    <div className="col-span-2">
                      <label className="label">Metadata / Certificate</label>
                      <textarea rows={3} placeholder="Paste IdP metadata XML or certificate here..." className="input-base h-auto min-h-[72px] py-2.5 resize-none" />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
