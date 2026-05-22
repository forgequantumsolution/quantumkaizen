import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Save, Check,
  Building2, Users as UsersIcon, Layers, KeyRound, Lock,
  Workflow, Bell, Shield, MapPin, AlertOctagon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";
import GeneralTab from "@/features/admin/organization/GeneralTab";
import UsersTab from "@/features/admin/users/UsersTab";
import DepartmentsTab from "@/features/admin/departments/DepartmentsTab";
import RolesTab from "@/features/admin/roles/RolesTab";
import AccessControlTab from "@/features/admin/access-control/AccessControlTab";
import WorkflowTypesTab from "@/features/admin/workflow-types/WorkflowTypesTab";
import SitesTab from "@/features/admin/sites/SitesTab";
import SeveritiesTab from "@/features/admin/severities/SeveritiesTab";
import WorkflowsPage from "@/features/workflows/WorkflowsPage";
import FormListPage from "@/features/forms/FormListPage";

type Section = "master-data" | "workflows" | "forms";

// Tabs that appear *inside* the Master Data section.
const masterDataTabs = [
  { key: "general",        label: "General",        icon: Building2 },
  { key: "users",          label: "Users",          icon: UsersIcon },
  { key: "departments",    label: "Departments",    icon: Layers },
  { key: "sites",          label: "Sites",          icon: MapPin },
  { key: "roles",          label: "Roles",          icon: KeyRound },
  { key: "access",         label: "Access Control", icon: Lock },
  { key: "workflow-types", label: "Workflow Types", icon: Workflow },
  { key: "severities",     label: "Severities",     icon: AlertOctagon },
  { key: "notifications",  label: "Notifications",  icon: Bell },
  { key: "security",       label: "Security",       icon: Shield },
] as const;

type MdTab = (typeof masterDataTabs)[number]["key"];
const VALID_MD_TABS = new Set<MdTab>(
  masterDataTabs.map((t) => t.key) as MdTab[],
);

const SECTION_TITLES: Record<Section, string> = {
  "master-data": "Master Data",
  workflows: "Workflows",
  forms: "Forms",
};

// Master Data tabs whose content has its own toolbar — hide the global Save.
const NO_SAVE_MD_TABS = new Set<MdTab>(["workflow-types"]);

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get("section");
  const tabParam = searchParams.get("tab");

  const section: Section =
    sectionParam === "workflows" || sectionParam === "forms"
      ? sectionParam
      : "master-data";
  const activeTab: MdTab = VALID_MD_TABS.has(tabParam as MdTab)
    ? (tabParam as MdTab)
    : "general";

  const setActiveTab = (key: MdTab) => {
    setSearchParams({ tab: key });
  };

  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

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
    <PageContainer>
      <PageHeader
        title={SECTION_TITLES[section]}
        description={
          section === "master-data"
            ? "Master configuration data — organization, users, departments, roles, access, workflow types, and more."
            : section === "workflows"
              ? "Browse and configure workflow definitions."
              : "Browse and configure dynamic forms."
        }
        actions={
          section !== "master-data" || NO_SAVE_MD_TABS.has(activeTab)
            ? undefined
            : (
              <Button variant="primary" onClick={handleSave}>
                {saved ? <Check size={15} /> : <Save size={15} />}
                {saved ? "Saved!" : "Save Changes"}
              </Button>
            )
        }
      />

      {/* ── WORKFLOWS section ───────────────────────────── */}
      {section === "workflows" && <WorkflowsPage />}

      {/* ── FORMS section ───────────────────────────────── */}
      {section === "forms" && <FormListPage />}

      {/* ── MASTER DATA section — internal tab strip ───── */}
      {section === "master-data" && (
        <>
          <div className="border-b border-gray-200">
            <nav role="tablist" className="flex gap-1 overflow-x-auto -mb-px">
              {masterDataTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-175",
                      isActive
                        ? "border-slate-900 text-slate-900"
                        : "border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300",
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

          <div className="min-w-0">
            {activeTab === "general" && <GeneralTab />}
            {activeTab === "users" && <UsersTab />}
            {activeTab === "departments" && <DepartmentsTab />}
            {activeTab === "sites" && <SitesTab />}
            {activeTab === "roles" && <RolesTab />}
            {activeTab === "access" && <AccessControlTab />}
            {activeTab === "workflow-types" && <WorkflowTypesTab />}
            {activeTab === "severities" && <SeveritiesTab />}

            {/* ── NOTIFICATIONS ────────────────────────── */}
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
        </>
      )}
    </PageContainer>
  );
}
