import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search, Bell, Menu, LogOut, User, ChevronDown,
  ChevronRight, AlertTriangle, Clock, Shield, PenLine,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useNotificationStore, AppNotification } from '@/stores/notificationStore';
import NotificationPanel from '@/components/shared/NotificationPanel';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { cn } from '@/lib/utils';
import GlobalSearch from '@/components/shared/GlobalSearch';
import { useFiscalYearStore, FISCAL_YEARS } from '@/stores/fiscalYearStore';

const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'n1', type: 'APPROVAL_REQUEST', title: 'Approval required',
    message: 'SOP-2026-003 awaiting your review and sign-off.',
    entityType: 'Document', entityId: 'SOP-2026-003',
    link: '/dms/documents', isRead: false,
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
  },
  {
    id: 'n2', type: 'OVERDUE', title: 'CAPA action overdue',
    message: 'Root cause analysis for CAPA-2026-007 is 3 days past due.',
    entityType: 'CAPA', entityId: 'CAPA-2026-007',
    link: '/qms/capa', isRead: false,
    createdAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
  },
  {
    id: 'n3', type: 'OVERDUE', title: 'NC overdue for closure',
    message: 'NC-2026-011 is 5 days past its target closure date.',
    entityType: 'Non-Conformance', entityId: 'NC-2026-011',
    link: '/qms/non-conformances', isRead: false,
    createdAt: new Date(Date.now() - 86400 * 1000).toISOString(),
  },
  {
    id: 'n4', type: 'EXPIRING', title: 'Document expiring in 7 days',
    message: 'ISO Procedures Manual (DOC-ISO-001) — schedule review.',
    entityType: 'Document', entityId: 'DOC-ISO-001',
    link: '/dms/documents', isRead: false,
    createdAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  },
  {
    id: 'n5', type: 'APPROVAL_REQUEST', title: 'Risk assessment review',
    message: 'RA-2026-004 (High) requires your sign-off.',
    entityType: 'Risk', entityId: 'RA-2026-004',
    link: '/qms/risks', isRead: false,
    createdAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
  },
  {
    id: 'n6', type: 'TASK_ASSIGNED', title: 'Audit Q2 assigned',
    message: 'Internal audit AUD-2026-Q2 has been assigned to you.',
    entityType: 'Audit', entityId: 'AUD-2026-Q2',
    link: '/qms/audits', isRead: true,
    createdAt: new Date(Date.now() - 2 * 86400 * 1000).toISOString(),
  },
];

const breadcrumbMap: Record<string, string> = {
  dashboard: 'Dashboard', qms: 'Quality', dms: 'Documents',
  lms: 'Learning', compliance: 'Regulatory',
  'non-conformances': 'Non-Conformances', capa: 'CAPA',
  risks: 'Risk Register', audits: 'Audits', fmea: 'FMEA',
  documents: 'Documents', training: 'Training Programs',
  'audit-log': 'Audit Log', settings: 'Settings',
  analytics: 'Analytics', scorecards: 'Scorecards',
  new: 'New', hub: 'Compliance Hub',
  'inspection-readiness': 'Inspection Readiness',
  'regulatory-changes': 'Regulatory Changes',
  'regulatory-training': 'Regulatory Training',
  suppliers: 'Suppliers', 'change-control': 'Change Control',
  complaints: 'Complaints', 'management-review': 'Management Review',
  calibration: 'Calibration', inspection: 'Inspection',
  workflows: 'Workflows', competency: 'Competency Matrix',
  'api-docs': 'API Docs',
};

// Notification severity icon
function NotifIcon({ type }: { type: string }) {
  if (type === 'OVERDUE')
    return <AlertTriangle size={12} className="text-critical-500 shrink-0 mt-0.5" />;
  if (type === 'APPROVAL_REQUEST')
    return <PenLine size={12} className="text-pharma-500 shrink-0 mt-0.5" />;
  if (type === 'EXPIRING')
    return <Clock size={12} className="text-caution-500 shrink-0 mt-0.5" />;
  return <Shield size={12} className="text-ink-tertiary shrink-0 mt-0.5" />;
}

// Role badge displayed in header
const ROLE_LABELS: Record<string, string> = {
  TENANT_ADMIN:        'Admin',
  QUALITY_MANAGER:     'QA Manager',
  QUALITY_ENGINEER:    'QA Engineer',
  REGULATORY_AFFAIRS:  'Reg. Affairs',
  LAB_ANALYST:         'Lab Analyst',
  PRODUCTION_OPERATOR: 'Production',
  READ_ONLY:           'Read Only',
  SUPER_ADMIN:         'Super Admin',
};

export default function Header() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { user, logout } = useAuthStore();
  const { setSidebarOpen } = useUIStore();
  const { notifications, isOpen, togglePanel, setNotifications } = useNotificationStore();
  const { year: fyYear, setYear: setFyYear } = useFiscalYearStore();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    setNotifications(MOCK_NOTIFICATIONS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unread = notifications.filter(n => !n.isRead);
  const criticalCount = unread.filter(n => n.type === 'OVERDUE').length;

  // Build breadcrumbs
  const segments = location.pathname.split('/').filter(Boolean);
  const breadcrumbs = segments.map((seg, i) => ({
    label: breadcrumbMap[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1),
    path: '/' + segments.slice(0, i + 1).join('/'),
    isLast: i === segments.length - 1,
  }));

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? 'QK';
  const roleLabel = ROLE_LABELS[user?.role ?? ''] ?? user?.role?.replace(/_/g, ' ') ?? '';

  return (
    <>
      <header className="sticky top-0 z-30 h-14 bg-white flex items-center justify-between px-5 gap-3" style={{ borderBottom: '1px solid #E8ECF2' }}>

        {/* ── Left: mobile menu + breadcrumbs ── */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            className="lg:hidden text-ink-tertiary hover:text-ink transition-colors p-1 rounded"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={16} />
          </button>

          <nav className="hidden sm:flex items-center gap-1" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <div key={crumb.path} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={11} className="text-ink-disabled" />}
                <span
                  className={cn(
                    'text-xs transition-colors leading-none font-medium',
                    crumb.isLast
                      ? 'text-ink font-semibold'
                      : 'text-ink-tertiary hover:text-ink cursor-pointer'
                  )}
                  onClick={() => !crumb.isLast && navigate(crumb.path)}
                >
                  {crumb.label}
                </span>
              </div>
            ))}
          </nav>
        </div>

        {/* ── Center: alert badge pills ── */}
        <div className="hidden md:flex items-center gap-2 flex-1 justify-center">
          {/* Expiry alerts */}
          <div
            className="flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity"
            style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}
            onClick={() => navigate('/dms/documents')}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
            {criticalCount + 2} Expiry Alerts
          </div>
          {/* Open CAPAs */}
          <div
            className="flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-semibold cursor-pointer hover:opacity-80 transition-opacity"
            style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309' }}
            onClick={() => navigate('/qms/capa')}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {unread.length + 19} Open CAPAs
          </div>
          {/* GMP status */}
          <div
            className="flex items-center gap-1.5 px-3 h-7 rounded-full text-xs font-semibold"
            style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            GMP Compliant
          </div>
        </div>

        {/* ── Right: search + actions ── */}
        <div className="flex items-center gap-1">
          {/* Global search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="hidden md:flex items-center gap-2 px-2.5 h-7 text-xs text-ink-tertiary bg-surface-bg border border-surface-border rounded-lg hover:border-surface-border-strong hover:text-ink transition-colors"
            style={{ minWidth: '160px' }}
            aria-label="Global search (⌘K)"
          >
            <Search size={12} className="shrink-0" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="font-mono text-xxs bg-white border border-surface-border rounded px-1 text-ink-disabled">⌘K</kbd>
          </button>

          {/* ── role indicator, notifications, user ── */}
          {/* Language */}
          <LanguageSwitcher />

          {/* FY selector — compact toggle */}
          <div className="hidden sm:flex items-center border border-gray-200 rounded overflow-hidden ml-1">
            {FISCAL_YEARS.map(y => (
              <button
                key={y}
                onClick={() => setFyYear(y)}
                className="px-2 h-6 text-[11px] font-medium transition-colors border-r last:border-r-0"
                style={
                  fyYear === y
                    ? { backgroundColor: '#0D0E17', color: '#F59E0B' }
                    : { backgroundColor: 'transparent', color: '#9CA3AF' }
                }
              >
                {y}
              </button>
            ))}
          </div>

          {/* Role badge — always visible per compliance req. */}
          {roleLabel && (
            <span className="hidden sm:inline-flex items-center px-2 h-5 rounded text-xxs font-semibold tracking-wide"
              style={{ backgroundColor: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.30)', color: '#A88937' }}>
              {roleLabel}
            </span>
          )}

          <div className="w-px h-5 bg-surface-border mx-1" />

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => { togglePanel(); setShowNotifDropdown(!showNotifDropdown); }}
              className="relative flex items-center justify-center w-8 h-8 rounded text-ink-tertiary hover:bg-surface-hover hover:text-ink transition-colors"
              aria-label={`Notifications${unread.length > 0 ? `, ${unread.length} unread` : ''}`}
            >
              <Bell size={15} />
              {unread.length > 0 && (
                <span className={cn(
                  'absolute top-1 right-1 min-w-[14px] h-3.5 flex items-center justify-center rounded-full',
                  'text-white text-xxs font-bold px-0.5 leading-none',
                  criticalCount > 0 ? 'bg-red-500' : 'bg-yellow-500'
                )}>
                  {unread.length > 9 ? '9+' : unread.length}
                </span>
              )}
            </button>

            {/* Compact notification dropdown */}
            {showNotifDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowNotifDropdown(false)} />
                <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded border border-surface-border shadow-overlay z-50 animate-slide-down overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-border bg-surface-bg">
                    <span className="text-xs font-semibold text-ink">Notifications</span>
                    {unread.length > 0 && (
                      <span className="text-xxs text-pharma-600 font-medium">{unread.length} unread</span>
                    )}
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-surface-border">
                    {notifications.slice(0, 6).map(n => (
                      <div
                        key={n.id}
                        className={cn(
                          'flex gap-2.5 px-4 py-2.5 hover:bg-surface-bg transition-colors cursor-pointer',
                          !n.isRead && 'bg-yellow-50/60'
                        )}
                        onClick={() => { if (n.link) navigate(n.link); setShowNotifDropdown(false); }}
                      >
                        <NotifIcon type={n.type} />
                        <div className="min-w-0">
                          <p className={cn('text-xs leading-snug', !n.isRead ? 'font-semibold text-ink' : 'font-medium text-ink-secondary')}>
                            {n.title}
                          </p>
                          <p className="text-xxs text-ink-tertiary mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                        </div>
                        {!n.isRead && (
                          <div className="w-1.5 h-1.5 rounded-full shrink-0 mt-1" style={{ backgroundColor: '#C9A84C' }} />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2 border-t border-surface-border bg-surface-bg">
                    <button
                      onClick={() => { navigate('/audit-log'); setShowNotifDropdown(false); }}
                      className="text-xxs font-medium transition-colors" style={{ color: '#A88937' }}
                    >
                      View all in Audit Log →
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {isOpen && <NotificationPanel />}

          <div className="w-px h-5 bg-surface-border mx-0.5" />

          {/* User menu */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-surface-hover transition-colors"
              aria-label="User menu"
              aria-expanded={showUserMenu}
            >
              <div className="w-6 h-6 rounded-lg text-xxs font-bold flex items-center justify-center shrink-0" style={{ backgroundColor: '#0D0E17', color: '#F59E0B' }}>
                {initials}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-ink leading-none">{user?.name ?? '—'}</p>
              </div>
              <ChevronDown size={11} className="text-ink-tertiary hidden sm:block" />
            </button>

            {showUserMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded border border-surface-border shadow-overlay py-1 z-50 animate-slide-down">
                  {/* User identity */}
                  <div className="px-3 py-2 border-b border-surface-border mb-1">
                    <p className="text-xs font-semibold text-ink">{user?.name}</p>
                    <p className="text-xxs text-ink-tertiary mt-0.5">{user?.email}</p>
                    {roleLabel && (
                      <span className="inline-flex mt-1.5 items-center px-1.5 py-px rounded text-xxs font-semibold" style={{ backgroundColor: 'rgba(201,168,76,0.12)', border: '1px solid rgba(201,168,76,0.25)', color: '#A88937' }}>
                        {roleLabel}
                      </span>
                    )}
                  </div>
                  <button className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-ink hover:bg-surface-bg transition-colors">
                    <User size={13} className="text-ink-tertiary" />
                    Profile & Preferences
                  </button>
                  <div className="h-px bg-surface-border my-1 mx-2" />
                  <button
                    onClick={() => { logout(); navigate('/login'); }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-critical-600 hover:bg-critical-50 transition-colors"
                  >
                    <LogOut size={13} />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </>
  );
}
