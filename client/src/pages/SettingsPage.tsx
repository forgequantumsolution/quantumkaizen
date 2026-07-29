import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Save, Check, Plus,
  Building2, Users as UsersIcon, Layers, KeyRound, Lock,
  Workflow, Bell, Shield, MapPin, AlertOctagon, ArrowUpNarrowWide, PanelLeft,
} from "lucide-react";
// Note: when section === "forms", FormListPage renders its own ListPageHeader
// (title + search + view toggle + create button), so we skip PageHeader here.
import { Button } from "@/components/ui/Button";
import PageContainer from "@/components/layout/PageContainer";
import PageHeader from "@/components/layout/PageHeader";
import { useAuthStore } from "@/stores/authStore";
import CreateWorkflowModal from "@/features/workflows/shared/CreateWorkflowModal";
import { cn } from "@/lib/utils";
import GeneralTab from "@/features/admin/organization/GeneralTab";
import UsersTab from "@/features/admin/users/UsersTab";
import DepartmentsTab from "@/features/admin/departments/DepartmentsTab";
import RolesTab from "@/features/admin/roles/RolesTab";
import AccessControlTab from "@/features/admin/access-control/AccessControlTab";
import WorkflowTypesTab from "@/features/admin/workflow-types/WorkflowTypesTab";
import SitesTab from "@/features/admin/sites/SitesTab";
import SeveritiesTab from "@/features/admin/severities/SeveritiesTab";
import EscalationMatrixTab from "@/features/admin/escalation/EscalationMatrixTab";
import NavGroupsTab from "@/features/admin/nav-groups/NavGroupsTab";
import WorkflowsPage from "@/features/workflows/WorkflowsPage";
import FormListPage from "@/features/forms/FormListPage";

type Section = "master-data" | "workflows" | "forms" | "nav-groups";

// Tabs that appear *inside* the Master Data section. `permission` gates each tab
// (see lib/navAccess.ts + Access Control → Menu Access); undefined = always shown.
const masterDataTabs = [
  { key: "general",        label: "Organization Profile", icon: Building2,    permission: undefined },
  { key: "users",          label: "User Management",      icon: UsersIcon,   permission: "user.read" },
  { key: "departments",    label: "Departments",          icon: Layers,      permission: "department.read" },
  { key: "sites",          label: "Facilities",           icon: MapPin,      permission: "site.read" },
  { key: "roles",          label: "Roles",                icon: KeyRound,    permission: "role.read" },
  { key: "access",         label: "Access Control",       icon: Lock,        permission: "role.read" },
  { key: "workflow-types", label: "Workflow Categories",  icon: Workflow,    permission: "workflow.lookups.read" },
  { key: "severities",     label: "Severity Matrix",      icon: AlertOctagon, permission: "workflow.lookups.read" },
  { key: "escalation",     label: "Escalation Matrix",    icon: ArrowUpNarrowWide, permission: "escalation.read" },
  { key: "notifications",  label: "Notifications",        icon: Bell,        permission: undefined },
  { key: "security",       label: "Security & Compliance", icon: Shield,     permission: undefined },
] as const;

type MdTab = (typeof masterDataTabs)[number]["key"];
const VALID_MD_TABS = new Set<MdTab>(
  masterDataTabs.map((t) => t.key) as MdTab[],
);

const SECTION_TITLES: Record<Section, string> = {
  "master-data": "Master Data",
  workflows: "Workflows",
  forms: "Forms",
  "nav-groups": "Navigation Groups",
};

const SECTION_DESCRIPTIONS: Record<Section, string> = {
  "master-data":
    "Centralized configuration for your organization — profile, users, roles, access policies, workflow categories, and compliance settings.",
  workflows: "Browse and configure workflow definitions.",
  forms: "Browse and configure forms.",
  "nav-groups":
    "Organize the sidebar into collapsible groups and choose which modules sit in each. Layout only — a module still appears only for users who have access to it.",
};

// Master Data tabs whose content has its own toolbar — hide the global Save.
const NO_SAVE_MD_TABS = new Set<MdTab>(["workflow-types", "escalation"]);

export default function SettingsPage() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canCreateWorkflow = hasPermission("workflow.create");

  const [searchParams, setSearchParams] = useSearchParams();
  const sectionParam = searchParams.get("section");
  const tabParam = searchParams.get("tab");

  const section: Section =
    sectionParam === "workflows" ||
    sectionParam === "forms" ||
    sectionParam === "nav-groups"
      ? sectionParam
      : "master-data";
  const activeTab: MdTab = VALID_MD_TABS.has(tabParam as MdTab)
    ? (tabParam as MdTab)
    : "general";

  // Workflow create flow lives here when the workflows section is embedded —
  // WorkflowsPage's header button + modal are skipped, and its EmptyState
  // triggers this open via the onCreateWorkflow prop.
  const [createWorkflowOpen, setCreateWorkflowOpen] = useState(false);

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

  // Section-specific header actions. Workflows' Create button still lives here;
  // Forms renders its own ListPageHeader (skip PageHeader entirely below).
  const headerActions =
    section === "workflows" ? (
      canCreateWorkflow ? (
        <Button variant="primary" onClick={() => setCreateWorkflowOpen(true)}>
          <Plus size={16} />
          <span className="ml-1.5">Create Workflow</span>
        </Button>
      ) : undefined
    ) : section === "master-data" && !NO_SAVE_MD_TABS.has(activeTab) ? (
      <Button variant="primary" onClick={handleSave}>
        {saved ? <Check size={15} /> : <Save size={15} />}
        {saved ? "Saved!" : "Save Changes"}
      </Button>
    ) : undefined;

  return (
    <PageContainer>
      {/* Workflows renders its own hero header (title + create + filters) inside
          WorkflowsPage, so skip the generic PageHeader for that section. */}
      {section !== "forms" && section !== "workflows" && (
        <PageHeader
          title={SECTION_TITLES[section]}
          description={SECTION_DESCRIPTIONS[section]}
          actions={headerActions}
        />
      )}

      {/* ── WORKFLOWS section ───────────────────────────── */}
      {section === "workflows" && (
        <>
          <WorkflowsPage onCreateWorkflow={() => setCreateWorkflowOpen(true)} />
          <CreateWorkflowModal
            isOpen={createWorkflowOpen}
            onClose={() => setCreateWorkflowOpen(false)}
          />
        </>
      )}

      {/* ── FORMS section ───────────────────────────────── */}
      {section === "forms" && <FormListPage />}

      {/* ── NAVIGATION GROUPS section ───────────────────── */}
      {/* Its own section rather than a Master Data tab: this configures the
          sidebar itself, not organizational master data. Carries its own Save,
          so no global header action. */}
      {section === "nav-groups" && <NavGroupsTab />}

      {/* ── MASTER DATA section — internal tab strip ───── */}
      {section === "master-data" && (
        <>
          <div className="mb-5">
            <nav
              role="tablist"
              className="flex gap-1 overflow-x-auto p-1.5 rounded-2xl bg-gray-100/80 ring-1 ring-gray-200/70 shadow-inner [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {masterDataTabs
                .filter((tab) => !tab.permission || hasPermission(tab.permission))
                .map((tab) => {
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
                        "group relative flex items-center gap-2 px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap rounded-xl transition-all duration-150",
                        isActive
                          ? "bg-white text-gold-700 shadow-sm ring-1 ring-gray-200/80"
                          : "text-gray-500 hover:text-gray-900 hover:bg-white/70",
                      )}
                    >
                      <span
                        className={cn(
                          "flex items-center justify-center rounded-lg transition-colors",
                          isActive
                            ? "text-gold-600"
                            : "text-gray-400 group-hover:text-gray-600",
                        )}
                      >
                        <Icon size={15} strokeWidth={2} />
                      </span>
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
            {activeTab === "escalation" && <EscalationMatrixTab />}

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
