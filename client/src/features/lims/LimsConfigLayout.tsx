import { NavLink, Outlet } from 'react-router-dom';
import {
  Settings2, FlaskConical, Gauge, Snowflake, BadgeCheck, Package, Atom, Ruler,
  MapPin, Users, Truck, Beaker, Layers, ScrollText, FileText,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

/**
 * LIMS Configuration — one place for all the set-up-once master data, grouped
 * so it reads as "configure the lab once". Each item is permission-gated (see
 * lib/navAccess.ts + Access Control → Menu Access); empty groups hide.
 */
const GROUPS: { label: string; items: { to: string; label: string; icon: typeof FlaskConical; permission: string }[] }[] = [
  {
    label: 'Laboratory',
    items: [
      { to: '/lims/labs', label: 'Lab Registry', icon: FlaskConical, permission: 'lab.read' },
      { to: '/lims/equipment', label: 'Equipment', icon: Gauge, permission: 'equipment.read' },
      { to: '/lims/storage', label: 'Storage Locations', icon: Snowflake, permission: 'storage.read' },
      { to: '/lims/certifications', label: 'Certifications', icon: BadgeCheck, permission: 'certification.read' },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { to: '/lims/products', label: 'Products', icon: Package, permission: 'product.read' },
      { to: '/lims/analytes', label: 'Analytes', icon: Atom, permission: 'analyte.read' },
      { to: '/lims/units', label: 'Units of Measure', icon: Ruler, permission: 'unit.read' },
      { to: '/lims/sampling-points', label: 'Sampling Points', icon: MapPin, permission: 'sampling_point.read' },
    ],
  },
  {
    label: 'Partners',
    items: [
      { to: '/lims/customers', label: 'Customers', icon: Users, permission: 'customer.read' },
      { to: '/lims/suppliers', label: 'Vendor Management', icon: Truck, permission: 'supplier.read' },
    ],
  },
  {
    label: 'Test Library',
    items: [
      { to: '/lims/methods', label: 'Test Methods', icon: Beaker, permission: 'method.read' },
      { to: '/lims/tests', label: 'Test Definitions', icon: FlaskConical, permission: 'test_definition.read' },
      { to: '/lims/panels', label: 'Test Panels', icon: Layers, permission: 'test_panel.read' },
      { to: '/lims/specifications', label: 'Specifications', icon: FileText, permission: 'specification.read' },
      { to: '/lims/spec-versions', label: 'Spec Versions', icon: ScrollText, permission: 'spec_version.read' },
    ],
  },
];

export default function LimsConfigLayout() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const groups = GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => hasPermission(i.permission)) }))
    .filter((g) => g.items.length);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <aside className="w-60 shrink-0 border-r border-gray-200 bg-gray-50/60 px-3 py-5">
        <div className="px-2 mb-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
            <Settings2 size={15} className="text-gray-500" /> LIMS Configuration
          </h2>
          <p className="text-[11px] text-gray-500 mt-0.5">One-time master-data setup</p>
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
      </aside>
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
