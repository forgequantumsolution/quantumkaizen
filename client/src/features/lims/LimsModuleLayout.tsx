import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, TestTubes, ClipboardList, Microscope, Thermometer,
  AlertTriangle, Award, ShieldCheck, FlaskConical,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

// Day-to-day LIMS operations, surfaced as segmented pill tabs so every section
// opens inside one shared frame (mirrors AuditModuleLayout). Set-up-once master
// data lives under the separate "LIMS Configuration" entry (LimsConfigLayout).
// `permission` gates each tab — see lib/navAccess.ts + Access Control → Menu Access.
const TABS = [
  { to: '/lims/dashboard', label: 'Overview', icon: LayoutDashboard, permission: 'lims_dashboard.read' },
  { to: '/lims/samples', label: 'Samples', icon: TestTubes, permission: 'sample.read' },
  { to: '/lims/worklists', label: 'Worklists', icon: ClipboardList, permission: 'worklist.read' },
  { to: '/lims/qc', label: 'Quality Control', icon: Microscope, permission: 'qc.read' },
  { to: '/lims/stability', label: 'Stability', icon: Thermometer, permission: 'stability.read' },
  { to: '/lims/oos', label: 'OOS / OOT', icon: AlertTriangle, permission: 'oos.read' },
  { to: '/lims/coa', label: 'CoA', icon: Award, permission: 'coa.read' },
  { to: '/lims/data-review', label: 'Data Review', icon: ShieldCheck, permission: 'data_review.read' },
];

export default function LimsModuleLayout() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const tabs = TABS.filter((t) => hasPermission(t.permission));
  return (
    <div>
      {/* Compact single-row header: identity + tabs share one line. Child pages
          keep their own PageContainer, which supplies the padding below. */}
      <div className="px-4 sm:px-6 pt-5">
        <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm overflow-hidden border-l-[3px] border-l-gold-500">
          <div className="flex items-center gap-3 px-2.5 py-2">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <FlaskConical size={18} />
            </span>
            <h1 className="text-[15px] font-bold text-gray-900 tracking-tight shrink-0 leading-none">
              LIMS
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
      </div>

      <Outlet />
    </div>
  );
}
