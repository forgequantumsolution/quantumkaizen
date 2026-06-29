import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Briefcase, ClipboardCheck, PlayCircle, AlertOctagon, ShieldCheck, ListTodo } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

// Schedule lives as a section on the Audit Program page (Register → Program flow),
// so it's no longer a top-level tab. "My Workspace" surfaces the audit workflow
// tickets (PRs) on the generic module workspace, embedded under these tabs.
// `permission` gates each tab — see lib/navAccess.ts + Access Control → Menu Access.
const TABS = [
  { to: '/audit/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'audit_register.read' },
  { to: '/audit/workspace', label: 'My Workspace', icon: Briefcase, permission: 'ticket.read' },
  { to: '/audit/register', label: 'Audit Register', icon: ClipboardCheck, permission: 'audit_register.read' },
  { to: '/audit/program', label: 'Audit Program', icon: PlayCircle, permission: 'audit_program.read' },
  { to: '/audit/non-conformance', label: 'Non-Conformance', icon: AlertOctagon, permission: 'non_conformance.read' },
  { to: '/audit/capa', label: 'CAPA', icon: ShieldCheck, permission: 'capa.read' },
  { to: '/audit/actions', label: 'Action Items', icon: ListTodo, permission: 'action_item.read' },
];

export default function AuditModuleLayout() {
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
                  'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                  isActive
                    ? 'text-blue-700 border-blue-600'
                    : 'text-gray-600 border-transparent hover:text-gray-900',
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
