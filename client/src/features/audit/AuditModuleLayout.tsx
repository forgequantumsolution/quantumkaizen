import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Briefcase, ClipboardCheck, PlayCircle, AlertOctagon, ShieldCheck, ListTodo } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { cn } from '@/lib/utils';

// Schedule lives as a section on the Audit Program page (Register → Program flow),
// so it's no longer a top-level tab. "My Workspace" surfaces the audit workflow
// tickets (PRs) on the generic module workspace, embedded under these tabs.
const TABS = [
  { to: '/audit/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/audit/workspace', label: 'My Workspace', icon: Briefcase },
  { to: '/audit/register', label: 'Audit Register', icon: ClipboardCheck },
  { to: '/audit/program', label: 'Audit Program', icon: PlayCircle },
  { to: '/audit/non-conformance', label: 'Non-Conformance', icon: AlertOctagon },
  { to: '/audit/capa', label: 'CAPA', icon: ShieldCheck },
  { to: '/audit/actions', label: 'Action Items', icon: ListTodo },
];

export default function AuditModuleLayout() {
  return (
    <PageContainer>
      <div className="flex items-center gap-1 border-b border-gray-200 mb-5">
        {TABS.map((t) => {
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
