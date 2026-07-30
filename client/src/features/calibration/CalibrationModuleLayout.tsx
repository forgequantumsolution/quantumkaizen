import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard,
  Ruler,
  CalendarClock,
  ClipboardCheck,
  AlertTriangle,
  Repeat,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { useCapabilities } from '@/lib/api/calibration';

/**
 * Calibration module shell — segmented pill tabs, mirroring LimsModuleLayout.
 *
 * Day-to-day work only. Set-up-once surfaces (industry packs, policy, instrument
 * categories, reference standards, providers, MSA) live in the separate
 * Configuration shell so this row stays readable.
 *
 * Two gates, deliberately distinct:
 *   `permission` — WHO may see the tab (Access Control → Menu Access).
 *   `feature`    — WHETHER the capability exists here at all, from the site's
 *                  industry pack. In-use checks are meaningless outside
 *                  FMCG/pharma. Hiding them is honest, not coy.
 */
const TABS: {
  to: string;
  label: string;
  icon: typeof Ruler;
  permission: string;
  feature?: 'in_use_checks';
}[] = [
  { to: '/calibration/dashboard', label: 'Overview', icon: LayoutDashboard, permission: 'calibration_analytics.read' },
  { to: '/calibration/instruments', label: 'Instruments', icon: Ruler, permission: 'calibration_instrument.read' },
  { to: '/calibration/schedule', label: 'Schedule', icon: CalendarClock, permission: 'calibration_event.read' },
  { to: '/calibration/events', label: 'Calibrations', icon: ClipboardCheck, permission: 'calibration_event.read' },
  { to: '/calibration/oot', label: 'Out of Tolerance', icon: AlertTriangle, permission: 'calibration_oot.read' },
  { to: '/calibration/checks', label: 'In-Use Checks', icon: Repeat, permission: 'calibration_check.read', feature: 'in_use_checks' },
];

export default function CalibrationModuleLayout() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { data: caps } = useCapabilities();

  const tabs = TABS.filter((t) => {
    if (!hasPermission(t.permission)) return false;
    // Until capabilities load, show everything rather than flickering tabs away.
    if (t.feature && caps && !caps.features[t.feature]) return false;
    return true;
  });

  return (
    <div>
      <div className="px-4 sm:px-6 pt-5">
        <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm overflow-hidden border-l-[3px] border-l-gold-500">
          <div className="flex items-center gap-3 px-2.5 py-2">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <Ruler size={18} />
            </span>
            <div className="shrink-0 leading-none">
              <h1 className="text-[15px] font-bold text-gray-900 tracking-tight">Calibration</h1>
              {caps?.industry_pack && caps.industry_pack !== 'CUSTOM' && (
                <span className="text-[10px] text-gray-400 font-medium">{caps.industry_pack} pack</span>
              )}
            </div>
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
      </div>

      <Outlet />
    </div>
  );
}
