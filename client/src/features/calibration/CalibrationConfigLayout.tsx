import { NavLink, Outlet } from 'react-router-dom';
import { Settings2, Package, SlidersHorizontal, Layers, Truck, Ruler, ShieldCheck, Sigma } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { useCapabilities } from '@/lib/api/calibration';

/**
 * Calibration Configuration — the set-up-once surfaces, split out of the
 * day-to-day module exactly as LIMS splits its master data (LimsConfigLayout).
 *
 * The operational shell answers "what is due, what failed, what is on hold".
 * This answers "how does calibration work here" — and in this module that is a
 * bigger question than usual, because the pharma / automotive / FMCG difference
 * lives entirely in these screens rather than in code.
 *
 * Each item is permission-gated (lib/navAccess.ts → Access Control → Menu
 * Access); empty groups hide themselves.
 */
const GROUPS: {
  label: string;
  items: { to: string; label: string; icon: typeof Package; permission: string; feature?: 'msa' }[];
}[] = [
  {
    label: 'Setup',
    items: [
      { to: '/calibration/config/packs', label: 'Industry Packs', icon: Package, permission: 'calibration_config.read' },
      { to: '/calibration/config/policy', label: 'Policy & Rules', icon: SlidersHorizontal, permission: 'calibration_config.read' },
    ],
  },
  {
    label: 'Master Data',
    items: [
      { to: '/calibration/config/categories', label: 'Instrument Categories', icon: Layers, permission: 'calibration_config.read' },
      { to: '/calibration/config/standards', label: 'Reference Standards', icon: ShieldCheck, permission: 'calibration_standard.read' },
      { to: '/calibration/config/providers', label: 'Calibration Providers', icon: Truck, permission: 'calibration_provider.read' },
    ],
  },
  {
    // Gauge qualification: performed once at introduction, and it gates plan
    // activation — a setup concern rather than a daily one.
    label: 'Qualification',
    items: [
      { to: '/calibration/config/msa', label: 'MSA / Gage R&R', icon: Sigma, permission: 'msa_study.read', feature: 'msa' },
    ],
  },
];

export default function CalibrationConfigLayout() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { data: caps } = useCapabilities();

  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => {
      if (!hasPermission(i.permission)) return false;
      if (i.feature && caps && !caps.features[i.feature]) return false;
      return true;
    }),
  })).filter((g) => g.items.length);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <aside className="w-60 shrink-0 border-r border-gray-200 bg-gray-50/60 px-3 py-5">
        <div className="px-2 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <Settings2 size={15} className="text-gray-500" /> Calibration Configuration
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">One-time setup &amp; master data</p>
          {caps?.industry_pack && caps.industry_pack !== 'CUSTOM' && (
            <span className="inline-flex items-center gap-1 mt-2 px-1.5 py-0.5 rounded bg-gold-50 text-gold-700 border border-gold-200 text-[10px] font-semibold">
              <Package size={10} />
              {caps.industry_pack} pack
            </span>
          )}
        </div>

        <nav className="space-y-4">
          {groups.map((g) => (
            <div key={g.label}>
              <div className="px-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{g.label}</div>
              <div className="space-y-0.5">
                {g.items.map((it) => {
                  const Icon = it.icon;
                  return (
                    <NavLink
                      key={it.to}
                      to={it.to}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors',
                          isActive ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-100',
                        )
                      }
                    >
                      <Icon size={14} className="shrink-0" />
                      {it.label}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Back to the operational side — the config sidebar replaces the tab
            bar, so without this the way back is the browser button. */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <NavLink
            to="/calibration/dashboard"
            className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors"
          >
            <Ruler size={13} className="shrink-0" />
            Back to Calibration
          </NavLink>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
