import { NavLink, Outlet } from "react-router-dom";
import { Database, FileText, Target, ListChecks } from "lucide-react";
import PageContainer from "@/components/layout/PageContainer";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";

// `permission` gates each tab — see lib/navAccess.ts + Access Control → Menu Access.
const TABS = [
  { to: "/audit/master", label: "Audit Master", icon: Database, permission: "audit_master.read" },
  { to: "/audit/focus-areas", label: "Focus Area", icon: Target, permission: "focus_area.read" },
  { to: "/audit/audit-types", label: "Audit Type", icon: ListChecks, permission: "audit_type.read" },
  { to: "/audit/iso-standards", label: "ISO Standards", icon: FileText, permission: "iso_standard.read" },
];

export default function AuditConfigLayout() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const tabs = TABS.filter((t) => hasPermission(t.permission));
  return (
    <PageContainer>
      <div className="flex items-center gap-1 border-b border-gray-200 mb-5">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                cn(
                  "inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                  isActive
                    ? "text-blue-700 border-blue-600"
                    : "text-gray-600 border-transparent hover:text-gray-900"
                )
              }
            >
              <Icon size={14} />
              {t.label}
            </NavLink>
          );
        })}
      </div>

      <Outlet />
    </PageContainer>
  );
}
