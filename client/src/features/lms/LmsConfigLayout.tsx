import { NavLink, Outlet } from 'react-router-dom';
import { BookOpen, Layers, Grid3x3 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

/**
 * LMS Configuration — the set-up-once authoring area, nested INSIDE the single
 * Training module (it renders below the LmsModuleLayout tab bar, not as its own
 * top-level sidebar entry). A left sub-sidebar lists the config screens; each is
 * permission-gated (see lib/navAccess.ts + Access Control → Menu Access).
 */
const ITEMS: { to: string; label: string; icon: typeof BookOpen; permission: string }[] = [
  { to: '/lms/admin/courses', label: 'Courses', icon: BookOpen, permission: 'lms_course.read' },
  { to: '/lms/admin/curricula', label: 'Training Programs', icon: Layers, permission: 'lms_enrollment.read' },
  { to: '/lms/admin/matrix', label: 'Qualification Matrix', icon: Grid3x3, permission: 'lms_matrix.read' },
];

export default function LmsConfigLayout() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const items = ITEMS.filter((i) => hasPermission(i.permission));

  return (
    <div className="flex min-h-[calc(100vh-8rem)] px-4 sm:px-6 pt-4">
      <aside className="w-56 shrink-0 border-r border-gray-200 bg-gray-50/60 px-3 py-4 rounded-l-xl">
        <div className="px-2 mb-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Configuration</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">Course & program set-up</p>
        </div>
        <nav className="space-y-0.5">
          {items.map((it) => {
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
        </nav>
      </aside>
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
