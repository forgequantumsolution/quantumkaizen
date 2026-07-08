import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search, Bell, Menu, LogOut, User, ChevronDown,
  ChevronRight, AlertTriangle, Clock, Shield, PenLine, Building2, Check,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useSiteStore } from '@/stores/siteStore';
import { useUIStore } from '@/stores/uiStore';
import { useNotificationStore, AppNotification } from '@/stores/notificationStore';
import { useTicket } from '@/lib/api/ticket';
import NotificationPanel from '@/components/shared/NotificationPanel';
import { LanguageSwitcher } from '@/components/shared/LanguageSwitcher';
import { cn } from '@/lib/utils';
import GlobalSearch from '@/components/shared/GlobalSearch';
import { useFiscalYearStore, FISCAL_YEARS } from '@/stores/fiscalYearStore';

const MOCK_NOTIFICATIONS: AppNotification[] = [];

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

// Navbar Site selector. Drives ticket-list scoping via the site store. Users
// pinned to a single site see a static label; users who can view across sites
// (`site.view_all`) get a dropdown with an "All Sites" option.
function SiteSelector() {
  const user = useAuthStore((s) => s.user);
  const { selectedSiteId, setSelectedSiteId } = useSiteStore();
  const [open, setOpen] = useState(false);

  const allowedSites = user?.allowedSites ?? [];
  const canViewAll = user?.permissions.includes('site.view_all') ?? false;

  // Reconcile a persisted selection against this user's allowed sites so a stale
  // id from another session/user can't linger.
  useEffect(() => {
    if (!user) return;
    const ids = (user.allowedSites ?? []).map((s) => s.id);
    const valid =
      (!!selectedSiteId && ids.includes(selectedSiteId)) ||
      (selectedSiteId === null && canViewAll);
    if (valid) return;
    setSelectedSiteId(canViewAll ? null : (user.site?.id ?? ids[0] ?? null));
  }, [user, selectedSiteId, canViewAll, setSelectedSiteId]);

  if (!user || (allowedSites.length === 0 && !canViewAll)) return null;

  // Single site, no cross-site view → static, non-interactive label.
  if (!canViewAll && allowedSites.length <= 1) {
    const only = allowedSites[0];
    if (!only) return null;
    return (
      <span
        className="hidden sm:inline-flex items-center gap-1.5 px-2 h-6 rounded text-[11px] font-medium text-ink-secondary bg-surface-bg border border-surface-border"
        title={`Site: ${only.name}`}
      >
        <Building2 size={11} className="text-ink-tertiary" />
        {only.name}
      </span>
    );
  }

  const currentLabel = selectedSiteId
    ? allowedSites.find((s) => s.id === selectedSiteId)?.name ?? 'Site'
    : 'All Sites';

  const choose = (id: string | null) => {
    setSelectedSiteId(id);
    setOpen(false);
  };

  return (
    <div className="relative hidden sm:block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 h-6 rounded text-[11px] font-medium text-ink-secondary bg-surface-bg border border-surface-border hover:border-surface-border-strong hover:text-ink transition-colors"
        aria-label="Select site"
        aria-expanded={open}
      >
        <Building2 size={11} className="text-ink-tertiary" />
        <span className="max-w-[120px] truncate">{currentLabel}</span>
        <ChevronDown size={10} className="text-ink-tertiary" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded border border-surface-border shadow-overlay py-1 z-50 animate-slide-down max-h-72 overflow-y-auto">
            {canViewAll && (
              <button
                onClick={() => choose(null)}
                className="flex items-center justify-between w-full px-3 py-1.5 text-xs text-ink hover:bg-surface-bg transition-colors"
              >
                <span className="font-medium">All Sites</span>
                {selectedSiteId === null && <Check size={13} className="text-pharma-600" />}
              </button>
            )}
            {allowedSites.map((s) => (
              <button
                key={s.id}
                onClick={() => choose(s.id)}
                className="flex items-center justify-between w-full px-3 py-1.5 text-xs text-ink hover:bg-surface-bg transition-colors"
              >
                <span className="truncate">{s.name}</span>
                {selectedSiteId === s.id && <Check size={13} className="text-pharma-600 shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function Header() {
  const location = useLocation();
  const navigate  = useNavigate();
  const { user, logout } = useAuthStore();
  const { setSidebarOpen } = useUIStore();
  const { notifications, isOpen, togglePanel, openPanel, setNotifications } = useNotificationStore();
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

  // On /tickets/<uuid>, swap the UUID segment for the human ID (e.g. DOC-FQS-001).
  // Hide it entirely until the ticket loads so the raw UUID never flashes.
  const ticketIdSegment =
    segments[0] === 'tickets' && segments[1] ? segments[1] : undefined;
  const { data: ticket } = useTicket(ticketIdSegment);

  const visibleSegments =
    ticketIdSegment && !ticket?.uniqueId
      ? segments.filter((_, i) => i !== 1)
      : segments;

  const breadcrumbs = visibleSegments.map((seg, i) => {
    const label =
      seg === ticketIdSegment && ticket?.uniqueId
        ? ticket.uniqueId
        : breadcrumbMap[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
    return {
      label,
      path: '/' + visibleSegments.slice(0, i + 1).join('/'),
      isLast: i === visibleSegments.length - 1,
    };
  });

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? 'QK';
  const roleLabel = ROLE_LABELS[user?.role ?? ''] ?? user?.role?.replace(/_/g, ' ') ?? '';

  return (
    <>
      <header className="sticky top-0 z-30 h-14 bg-white flex items-center justify-between px-5 gap-3" style={{ borderBottom: '1px solid #E8ECF2' }}>

        {/* ── Left: mobile menu + breadcrumbs ── */}
        <div className="flex items-center gap-3 min-w-0 shrink">
          <button
            className="lg:hidden text-ink-tertiary hover:text-ink transition-colors p-1 rounded"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
          >
            <Menu size={16} />
          </button>

          <nav className="hidden sm:flex items-center gap-1.5 min-w-0" aria-label="Breadcrumb">
            {breadcrumbs.map((crumb, i) => (
              <div key={crumb.path} className="flex items-center gap-1.5 min-w-0">
                {i > 0 && <ChevronRight size={12} className="text-ink-tertiary shrink-0" />}
                <span
                  className={cn(
                    'text-xs transition-colors leading-none font-medium truncate',
                    crumb.isLast
                      ? 'text-ink font-semibold'
                      : 'text-ink-secondary hover:text-ink cursor-pointer'
                  )}
                  onClick={() => !crumb.isLast && navigate(crumb.path)}
                >
                  {crumb.label}
                </span>
              </div>
            ))}
          </nav>
        </div>

        {/* ── Center: spacer (former alert pills removed) ── */}
        <div className="hidden xl:flex flex-1 min-w-0" />

        {/* ── Right: search + actions ── */}
        <div className="flex items-center gap-1 shrink-0">
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

          {/* Site selector — scopes ticket lists to the active site */}
          <SiteSelector />

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
                      onClick={() => { setShowNotifDropdown(false); openPanel(); }}
                      className="text-xxs font-medium transition-colors" style={{ color: '#A88937' }}
                    >
                      View all notifications →
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
