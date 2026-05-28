import { NavLink, Outlet } from 'react-router-dom';
import { Database, FileText } from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/audit/master', label: 'Audit Master', icon: Database },
  { to: '/audit/iso-standards', label: 'ISO Standards', icon: FileText },
];

export default function AuditConfigLayout() {
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
