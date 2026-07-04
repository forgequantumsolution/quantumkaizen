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
  { to: '/audit/dashboard', label: 'Overview', icon: LayoutDashboard, permission: 'audit_register.read' },
  { to: '/audit/workspace', label: 'My Tasks', icon: Briefcase, permission: 'ticket.read' },
  { to: '/audit/register', label: 'Audit Planner', icon: ClipboardCheck, permission: 'audit_register.read' },
  { to: '/audit/program', label: 'Audit Execution', icon: PlayCircle, permission: 'audit_program.read' },
  { to: '/audit/non-conformance', label: 'Findings', icon: AlertOctagon, permission: 'non_conformance.read' },
  { to: '/audit/capa', label: 'Corrective Actions', icon: ShieldCheck, permission: 'capa.read' },
  { to: '/audit/actions', label: 'Action Tracker', icon: ListTodo, permission: 'action_item.read' },
];

export default function AuditModuleLayout() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const tabs = TABS.filter((t) => hasPermission(t.permission));
  return (
    <PageContainer>
      {/* Compact single-row header: identity + tabs share one line. */}
      <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm overflow-hidden mb-4 border-l-[3px] border-l-gold-500">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <ClipboardCheck size={18} />
          </span>
          <h1 className="text-[15px] font-bold text-gray-900 tracking-tight shrink-0 leading-none">
            Audit
          </h1>
          <div className="h-6 w-px bg-gray-200 shrink-0 hidden sm:block" />

          {/* Segmented pill tabs — stretch to fill the row, equal-width tabs. */}
          <div className="flex-1 min-w-0 -my-1">
            <nav className="flex w-full gap-1.5 p-1 rounded-lg bg-gray-100/80 ring-1 ring-gray-200/60">
              {tabs.map((t) => {
                const Icon = t.icon;
                return (
                  <NavLink
                    key={t.to}
                    to={t.to}
                    className={({ isActive }) =>
                      cn(
                        'flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-[13px] font-semibold rounded-md whitespace-nowrap transition-all duration-150',
                        isActive
                          ? 'bg-white text-gold-700 shadow-sm ring-1 ring-gray-200/80'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-white/70',
                      )
                    }
                  >
                    <Icon size={14} className="shrink-0" />
                    <span className="truncate">{t.label}</span>
                  </NavLink>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      <Outlet />
    </PageContainer>
  );
}
