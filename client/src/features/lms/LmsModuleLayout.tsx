import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  GraduationCap, Award, Compass, Users, ClipboardCheck, Gauge, Settings2,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';

// Training & Qualification (LMS) surfaced as segmented pill tabs so every section
// opens inside one shared frame (mirrors LimsModuleLayout / AuditModuleLayout).
// The "Configuration" tab opens an in-module sub-layout (LmsConfigLayout) holding
// the set-up-once authoring screens — it is NOT a separate top-level sidebar
// entry. `activeFor` keeps a tab lit across the routes it owns; `permission`
// gates each tab (see lib/navAccess.ts + Access Control → Menu Access).
// Drill-down pages (course player, exam, builders, certificate) stay full-page.
const TABS: {
  to: string;
  label: string;
  icon: typeof Award;
  permission: string | string[];
  activeFor?: string[];
}[] = [
  { to: '/lms/my', label: 'My Training', icon: Award, permission: 'lms_my.read' },
  { to: '/lms/catalog', label: 'Catalog', icon: Compass, permission: 'lms_my.read' },
  { to: '/lms/admin/assignments', label: 'Assignments', icon: Users, permission: 'lms_enrollment.assign' },
  { to: '/lms/admin/grading', label: 'Results', icon: ClipboardCheck, permission: 'lms_assessment.grade' },
  { to: '/lms/admin/reports', label: 'Reports', icon: Gauge, permission: 'lms_report.read' },
  {
    to: '/lms/admin/courses',
    label: 'Configuration',
    icon: Settings2,
    permission: ['lms_course.read', 'lms_enrollment.read', 'lms_matrix.read'],
    activeFor: ['/lms/admin/courses', '/lms/admin/curricula', '/lms/admin/matrix'],
  },
];

export default function LmsModuleLayout() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { pathname } = useLocation();
  const can = (p: string | string[]) => (Array.isArray(p) ? p.some(hasPermission) : hasPermission(p));
  const tabs = TABS.filter((t) => can(t.permission));

  return (
    <div>
      {/* Compact single-row header: identity + tabs share one line. Child pages
          keep their own PageContainer, which supplies the padding below. */}
      <div className="px-4 sm:px-6 pt-5">
        <div className="rounded-xl border border-gray-200/80 bg-white shadow-sm overflow-hidden border-l-[3px] border-l-gold-500">
          <div className="flex items-center gap-3 px-2.5 py-2">
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <GraduationCap size={18} />
            </span>
            <h1 className="text-[15px] font-bold text-gray-900 tracking-tight shrink-0 leading-none hidden lg:block">
              Training
            </h1>
            <div className="h-6 w-px bg-gray-200 shrink-0 hidden lg:block" />

            {/* Segmented pill tabs — stretch to fill the row, equal-width tabs. */}
            <div className="flex-1 min-w-0 -my-1">
              <nav className="flex w-full gap-1.5 p-1 rounded-lg bg-gray-100/80 ring-1 ring-gray-200/60">
                {tabs.map((t) => {
                  const Icon = t.icon;
                  const isActive = (t.activeFor ?? [t.to]).some((p) => pathname.startsWith(p));
                  return (
                    <Link
                      key={t.to}
                      to={t.to}
                      className={cn(
                        'flex-1 min-w-0 inline-flex items-center justify-center gap-1.5 px-2 py-1.5 text-[13px] font-semibold rounded-md whitespace-nowrap transition-all duration-150',
                        isActive
                          ? 'bg-white text-gold-700 shadow-sm ring-1 ring-gray-200/80'
                          : 'text-gray-500 hover:text-gray-900 hover:bg-white/70',
                      )}
                    >
                      <Icon size={14} className="shrink-0" />
                      <span className="truncate">{t.label}</span>
                    </Link>
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
