import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  ShieldAlert,
  ClipboardList,
  ShieldCheck,
  CalendarClock,
} from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

// Ordered to follow the ICH Q9 cycle as it is actually run: you assess a process
// first, promote the lines that matter into a register, then treat and review the
// resulting risks. `permission` gates each tab — keep this order and the tab list
// in lib/navAccess.ts (Access Control → Menu Access) in step.
const TABS = [
  { to: '/risk/dashboard', label: 'Overview', icon: LayoutDashboard, permission: 'risk.read' },
  { to: '/risk/assessments', label: 'Assessments', icon: ClipboardList, permission: 'risk_assessment.read' },
  { to: '/risk/registers', label: 'Registers', icon: FolderKanban, permission: 'risk_register.read' },
  { to: '/risk/risks', label: 'Risks', icon: ShieldAlert, permission: 'risk.read' },
  { to: '/risk/controls', label: 'Controls', icon: ShieldCheck, permission: 'risk_control.read' },
  { to: '/risk/reviews', label: 'Reviews', icon: CalendarClock, permission: 'risk_review.read' },
];

export default function RiskModuleLayout() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const tabs = TABS.filter((t) => hasPermission(t.permission));

  return (
    <PageContainer>
      {/* Compact single-row header: identity + tabs share one line. Unlike LIMS —
          whose child pages each apply their own PageContainer — the risk pages
          render bare, so this layout owns the page chrome (padding + rhythm). */}
      <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm overflow-hidden mb-4 border-l-[3px] border-l-gold-500">
        <div className="flex items-center gap-3 px-2.5 py-2">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <ShieldAlert size={18} />
          </span>
          <h1 className="text-[15px] font-bold text-gray-900 tracking-tight shrink-0 leading-none">
            Risk
          </h1>
          <div className="h-6 w-px bg-gray-200 shrink-0 hidden sm:block" />

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
