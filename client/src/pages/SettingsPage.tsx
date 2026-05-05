import { useState } from "react";
import {
  Building2,
  Users,
  GitBranch,
  Bell,
  Shield,
  Layers,
  KeyRound,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import PageHeader from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";
import GeneralTab from "@/features/admin/organization/GeneralTab";
import UsersTab from "@/features/admin/users/UsersTab";
import DepartmentsTab from "@/features/admin/departments/DepartmentsTab";
import RolesTab from "@/features/admin/roles/RolesTab";
import AccessControlTab from "@/features/admin/access-control/AccessControlTab";

const tabs = [
  { key: "general", label: "General", icon: Building2 },
  { key: "users", label: "Users", icon: Users },
  { key: "departments", label: "Departments", icon: Layers },
  { key: "roles", label: "Roles", icon: KeyRound },
  { key: "access", label: "Access Control", icon: Lock },
  { key: "workflows", label: "Workflows", icon: GitBranch },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "security", label: "Security", icon: Shield },
] as const;

type Tab = (typeof tabs)[number]["key"];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("general");

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState({
    emailOnAssignment: true,
    emailOnApproval: true,
    emailOnOverdue: true,
    emailOnExpiry: true,
    emailDigest: "DAILY",
    inAppAssignment: true,
    inAppApproval: true,
    inAppOverdue: true,
    inAppExpiry: true,
  });

  // Security state
  const [security, setSecurity] = useState({
    sessionTimeout: "480",
    require2FA: false,
    passwordMinLength: "8",
    passwordRequireSpecial: true,
    passwordRequireNumbers: true,
    maxLoginAttempts: "5",
    ssoEnabled: false,
    ssoProvider: "SAML",
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Settings"
        description="Manage your organization's configuration and preferences"
        actions={
          <Button variant="primary" onClick={handleSave}>
            {saved ? <Check size={15} /> : <Save size={15} />}
            {saved ? "Saved!" : "Save Changes"}
          </Button>
        }
      />

      {/* Top tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 overflow-x-auto -mb-px" role="tablist">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-175",
                  isActive
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300"
                )}
              >
                <Icon
                  size={16}
                  className={isActive ? "text-slate-900" : "text-gray-400"}
                />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="min-w-0">
        {/* ── GENERAL ─────────────────────────────────── */}
        {activeTab === "general" && <GeneralTab />}

        {/* ── USERS ───────────────────────────────────── */}
        {activeTab === "users" && <UsersTab />}

        {/* ── DEPARTMENTS ─────────────────────────────── */}
        {activeTab === "departments" && <DepartmentsTab />}

        {/* ── ROLES ───────────────────────────────────── */}
        {activeTab === "roles" && <RolesTab />}

        {/* ── ACCESS CONTROL ──────────────────────────── */}
        {activeTab === "access" && <AccessControlTab />}

        {/* ── WORKFLOWS ────────────────────────────────── */}
        {activeTab === "workflows" && (
          <div className="space-y-4">
            {[
              {
                module: "Document Approval",
                description: "Multi-stage approval for document publishing",
                stages: ["Author → Reviewer → Approver"],
                enabled: true,
              },
              {
                module: "CAPA Approval",
                description:
                  "Corrective action plans require quality manager sign-off",
                stages: ["Initiator → QA Manager → QMS Admin"],
                enabled: true,
              },
              {
                module: "Risk Assessment",
                description: "High-risk items require additional review",
                stages: ["Risk Owner → Risk Committee"],
                enabled: false,
              },
              {
                module: "Change Control",
                description:
                  "All change requests must be reviewed before implementation",
                stages: ["Initiator → Change Board → Management"],
                enabled: true,
              },
              {
                module: "Supplier Approval",
                description: "New suppliers require qualification review",
                stages: ["Procurement → Quality → Management"],
                enabled: true,
              },
            ].map((wf) => (
              <div
                key={wf.module}
                className="bg-white rounded-xl border border-gray-200 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {wf.module}
                      </h3>
                      <span
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          wf.enabled
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        )}
                      >
                        {wf.enabled ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">
                      {wf.description}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {wf.stages[0].split(" → ").map((stage, i, arr) => (
                        <span key={stage} className="flex items-center gap-1.5">
                          <span className="text-xs bg-slate-900/8 text-slate-900 px-2 py-0.5 rounded font-medium">
                            {stage}
                          </span>
                          {i < arr.length - 1 && (
                            <span className="text-gray-300">→</span>
                          )}
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
        {activeTab === "notifications" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="text-h3 text-gray-900">Email Notifications</h2>
              {[
                {
                  key: "emailOnAssignment" as const,
                  label: "New task or record assigned to me",
                },
                {
                  key: "emailOnApproval" as const,
                  label: "Approval request requires my action",
                },
                {
                  key: "emailOnOverdue" as const,
                  label: "My tasks or records are overdue",
                },
                {
                  key: "emailOnExpiry" as const,
                  label: "Documents or certifications expiring soon",
                },
              ].map(({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <span className="text-sm text-gray-700">{label}</span>
                  <button
                    onClick={() =>
                      setNotifPrefs((p) => ({ ...p, [key]: !p[key] }))
                    }
                    className={cn(
                      "w-10 h-5.5 rounded-full relative transition-colors duration-200",
                      notifPrefs[key] ? "bg-blue-600" : "bg-gray-200"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200",
                        notifPrefs[key] ? "translate-x-5" : "translate-x-0.5"
                      )}
                    />
                  </button>
                </div>
              ))}
              <div>
                <label className="label">Email Digest Frequency</label>
                <select
                  value={notifPrefs.emailDigest}
                  onChange={(e) =>
                    setNotifPrefs((p) => ({
                      ...p,
                      emailDigest: e.target.value,
                    }))
                  }
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
                { key: "inAppAssignment" as const, label: "Task assignments" },
                { key: "inAppApproval" as const, label: "Approval requests" },
                { key: "inAppOverdue" as const, label: "Overdue alerts" },
                { key: "inAppExpiry" as const, label: "Expiry warnings" },
              ].map(({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <span className="text-sm text-gray-700">{label}</span>
                  <button
                    onClick={() =>
                      setNotifPrefs((p) => ({ ...p, [key]: !p[key] }))
                    }
                    className={cn(
                      "w-10 h-5.5 rounded-full relative transition-colors duration-200",
                      notifPrefs[key] ? "bg-blue-600" : "bg-gray-200"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200",
                        notifPrefs[key] ? "translate-x-5" : "translate-x-0.5"
                      )}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── SECURITY ─────────────────────────────────── */}
        {activeTab === "security" && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h2 className="text-h3 text-gray-900">
                Session & Authentication
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Session Timeout (minutes)</label>
                  <input
                    type="number"
                    value={security.sessionTimeout}
                    onChange={(e) =>
                      setSecurity((s) => ({
                        ...s,
                        sessionTimeout: e.target.value,
                      }))
                    }
                    className="input-base"
                  />
                </div>
                <div>
                  <label className="label">Max Login Attempts</label>
                  <input
                    type="number"
                    value={security.maxLoginAttempts}
                    onChange={(e) =>
                      setSecurity((s) => ({
                        ...s,
                        maxLoginAttempts: e.target.value,
                      }))
                    }
                    className="input-base"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-gray-100">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Require Two-Factor Authentication
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    All users must set up TOTP before accessing the system
                  </p>
                </div>
                <button
                  onClick={() =>
                    setSecurity((s) => ({ ...s, require2FA: !s.require2FA }))
                  }
                  className={cn(
                    "w-10 h-5.5 rounded-full relative transition-colors duration-200 shrink-0",
                    security.require2FA ? "bg-blue-600" : "bg-gray-200"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200",
                      security.require2FA ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
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
                    onChange={(e) =>
                      setSecurity((s) => ({
                        ...s,
                        passwordMinLength: e.target.value,
                      }))
                    }
                    className="input-base"
                  />
                </div>
              </div>
              {[
                {
                  key: "passwordRequireSpecial" as const,
                  label: "Require special characters (!@#$...)",
                },
                {
                  key: "passwordRequireNumbers" as const,
                  label: "Require numbers",
                },
              ].map(({ key, label }) => (
                <div
                  key={key}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <span className="text-sm text-gray-700">{label}</span>
                  <button
                    onClick={() =>
                      setSecurity((s) => ({ ...s, [key]: !s[key] }))
                    }
                    className={cn(
                      "w-10 h-5.5 rounded-full relative transition-colors duration-200",
                      security[key] ? "bg-blue-600" : "bg-gray-200"
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200",
                        security[key] ? "translate-x-5" : "translate-x-0.5"
                      )}
                    />
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-h3 text-gray-900">
                    Single Sign-On (SSO)
                  </h2>
                  <p className="text-xs text-gray-500 mt-0.5">
                    SAML 2.0 or OIDC integration with your identity provider
                  </p>
                </div>
                <button
                  onClick={() =>
                    setSecurity((s) => ({ ...s, ssoEnabled: !s.ssoEnabled }))
                  }
                  className={cn(
                    "w-10 h-5.5 rounded-full relative transition-colors duration-200",
                    security.ssoEnabled ? "bg-blue-600" : "bg-gray-200"
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200",
                      security.ssoEnabled ? "translate-x-5" : "translate-x-0.5"
                    )}
                  />
                </button>
              </div>
              {security.ssoEnabled && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                  <div>
                    <label className="label">Protocol</label>
                    <select
                      value={security.ssoProvider}
                      onChange={(e) =>
                        setSecurity((s) => ({
                          ...s,
                          ssoProvider: e.target.value,
                        }))
                      }
                      className="input-base"
                    >
                      <option value="SAML">SAML 2.0</option>
                      <option value="OIDC">OpenID Connect</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Identity Provider URL</label>
                    <input
                      type="text"
                      placeholder="https://idp.company.com"
                      className="input-base"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="label">Metadata / Certificate</label>
                    <textarea
                      rows={3}
                      placeholder="Paste IdP metadata XML or certificate here..."
                      className="input-base h-auto min-h-[72px] py-2.5 resize-none"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
