import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, AlertTriangle, CheckCircle2, Shield,
  ClipboardCheck, Activity, Scale, FileText, FolderOpen,
  GraduationCap, Grid3X3, History, Settings, ChevronLeft,
  ChevronRight, Truck, GitBranch, MessageSquareWarning,
  BarChart3, Gauge, ClipboardList, Clock, FileCode,
  ShieldCheck, BookOpen, RefreshCw, Network, ChevronDown,
  TrendingUp, Trophy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiStore';
import { useRecentItemsStore } from '@/stores/recentItemsStore';
import { useAuthStore } from '@/stores/authStore';
import { useState } from 'react';

interface NavItem    { label: string; path: string; icon: React.ElementType }
interface NavSection { title: string; items: NavItem[]; collapsible?: boolean }

const navigation: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard',  path: '/dashboard',  icon: LayoutDashboard },
      { label: 'Analytics',  path: '/analytics',  icon: TrendingUp },
      { label: 'Workflows',  path: '/workflows',  icon: Network },
    ],
  },
  {
    title: 'Quality (QMS)',
    collapsible: true,
    items: [
      { label: 'Non-Conformances', path: '/qms/non-conformances',  icon: AlertTriangle },
      { label: 'CAPA',             path: '/qms/capa',              icon: CheckCircle2 },
      { label: 'Risk Register',    path: '/qms/risks',             icon: Shield },
      { label: 'Audits',           path: '/qms/audits',            icon: ClipboardCheck },
      { label: 'FMEA',             path: '/qms/fmea',              icon: Activity },
      { label: 'Compliance',       path: '/qms/compliance',        icon: Scale },
      { label: 'Suppliers',        path: '/qms/suppliers',         icon: Truck },
      { label: 'Scorecards',       path: '/qms/suppliers/scorecards', icon: Trophy },
      { label: 'Change Control',   path: '/qms/change-control',    icon: GitBranch },
      { label: 'Complaints',       path: '/qms/complaints',        icon: MessageSquareWarning },
      { label: 'Mgmt Review',      path: '/qms/management-review', icon: BarChart3 },
    ],
  },
  {
    title: 'Documents (DMS)',
    collapsible: true,
    items: [
      { label: 'All Documents', path: '/dms/documents', icon: FileText },
      { label: 'Templates',     path: '/dms/templates', icon: FolderOpen },
    ],
  },
  {
    title: 'Learning (LMS)',
    collapsible: true,
    items: [
      { label: 'Training Programs',   path: '/lms/training',            icon: GraduationCap },
      { label: 'Competency Matrix',   path: '/lms/competency',          icon: Grid3X3 },
      { label: 'Regulatory Training', path: '/lms/regulatory-training', icon: BookOpen },
    ],
  },
  {
    title: 'Regulatory',
    collapsible: true,
    items: [
      { label: 'Compliance Hub',       path: '/compliance/hub',                  icon: ShieldCheck },
      { label: 'Inspection Readiness', path: '/compliance/inspection-readiness', icon: ClipboardCheck },
      { label: 'Regulatory Changes',   path: '/compliance/regulatory-changes',   icon: RefreshCw },
    ],
  },
  {
    title: 'Operations',
    collapsible: true,
    items: [
      { label: 'Calibration', path: '/calibration', icon: Gauge },
      { label: 'Inspection',  path: '/inspection',  icon: ClipboardList },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Audit Log', path: '/audit-log', icon: History },
      { label: 'Settings',  path: '/settings',  icon: Settings },
      { label: 'API Docs',  path: '/api-docs',  icon: FileCode },
    ],
  },
];

// Design tokens — inline to guarantee rendering
const BG           = '#0D0E17';
const ACTIVE_BG    = '#1E2035';
const ACCENT       = '#F59E0B';
const SECTION_CLR  = '#4A4A6A';
const INACTIVE_CLR = '#7A7A9A';
const ACTIVE_CLR   = '#F59E0B';
const DIVIDER      = 'rgba(255,255,255,0.06)';
const HOVER_BG     = 'rgba(255,255,255,0.04)';

export default function Sidebar() {
  const location    = useLocation();
  const navigate    = useNavigate();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const recentItems = useRecentItemsStore();
  const user        = useAuthStore(s => s.user);

  const [sectionsCollapsed, setSectionsCollapsed] = useState<Record<string, boolean>>({});
  const toggleSection = (title: string) =>
    setSectionsCollapsed(prev => ({ ...prev, [title]: !prev[title] }));

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? 'QK';

  return (
    <aside
      style={{ backgroundColor: BG, borderRight: '1px solid ' + DIVIDER }}
      className={cn(
        'fixed left-0 top-0 h-screen flex flex-col z-40',
        'transition-[width] duration-250 ease-in-out',
        sidebarCollapsed ? 'w-[56px]' : 'w-[240px]',
      )}
    >
      {/* Brand */}
      <div
        style={{ borderBottom: '1px solid ' + DIVIDER }}
        className={cn('flex items-center h-14 shrink-0', sidebarCollapsed ? 'justify-center px-3' : 'gap-3 px-4')}
      >
        <div style={{ backgroundColor: ACCENT }} className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0">
          <span style={{ color: '#0D0E17' }} className="font-black text-sm tracking-tight">Q</span>
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <p className="text-white font-bold text-sm leading-none tracking-tight">
              Quantum <span style={{ color: ACCENT }}>Kaizen</span>
            </p>
            <p style={{ color: SECTION_CLR }} className="text-[9px] tracking-[0.15em] mt-0.5 uppercase font-medium">QMS Platform</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
        {navigation.map(section => {
          const isCollapsed = !!(section.collapsible && sectionsCollapsed[section.title]);
          const hasActive   = section.items.some(i =>
            location.pathname === i.path ||
            (i.path !== '/dashboard' && location.pathname.startsWith(i.path))
          );

          return (
            <div key={section.title} className="mb-1">
              {!sidebarCollapsed && (
                <button
                  onClick={() => section.collapsible && toggleSection(section.title)}
                  className={cn('w-full flex items-center justify-between px-4 py-1 mb-0.5 rounded', section.collapsible && 'cursor-pointer')}
                  onMouseEnter={e => { if (section.collapsible) (e.currentTarget as HTMLElement).style.backgroundColor = HOVER_BG; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <span style={{ color: hasActive ? ACCENT : SECTION_CLR, fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    {section.title}
                  </span>
                  {section.collapsible && (
                    <ChevronDown size={11} style={{ color: SECTION_CLR }}
                      className={cn('transition-transform duration-150', isCollapsed ? '-rotate-90' : 'rotate-0')} />
                  )}
                </button>
              )}

              {sidebarCollapsed && navigation.indexOf(section) > 0 && (
                <div style={{ background: DIVIDER }} className="mx-3 my-1.5 h-px" />
              )}

              {!isCollapsed && (
                <div className={cn('space-y-px', sidebarCollapsed ? 'px-1.5' : 'px-2')}>
                  {section.items.map(item => {
                    const isActive =
                      location.pathname === item.path ||
                      (item.path !== '/dashboard' && location.pathname.startsWith(item.path));
                    const Icon = item.icon;

                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        title={sidebarCollapsed ? item.label : undefined}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: sidebarCollapsed ? 0 : '10px',
                          padding: sidebarCollapsed ? 0 : '7px 10px 7px 8px',
                          width: sidebarCollapsed ? '36px' : '100%',
                          height: sidebarCollapsed ? '36px' : undefined,
                          justifyContent: sidebarCollapsed ? 'center' : undefined,
                          marginLeft: sidebarCollapsed ? 'auto' : undefined,
                          marginRight: sidebarCollapsed ? 'auto' : undefined,
                          borderRadius: '6px',
                          borderLeft: !sidebarCollapsed ? (isActive ? '3px solid ' + ACCENT : '3px solid transparent') : undefined,
                          backgroundColor: isActive ? ACTIVE_BG : 'transparent',
                          color: isActive ? ACTIVE_CLR : INACTIVE_CLR,
                          textDecoration: 'none',
                          transition: 'background-color 100ms, color 100ms',
                        }}
                        onMouseEnter={e => {
                          if (!isActive) {
                            (e.currentTarget as HTMLElement).style.backgroundColor = HOVER_BG;
                            (e.currentTarget as HTMLElement).style.color = ACTIVE_CLR;
                          }
                        }}
                        onMouseLeave={e => {
                          if (!isActive) {
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                            (e.currentTarget as HTMLElement).style.color = INACTIVE_CLR;
                          }
                        }}
                      >
                        <Icon size={15} strokeWidth={isActive ? 2 : 1.5}
                          style={{ color: isActive ? ACCENT : 'inherit', flexShrink: 0 }} />
                        {!sidebarCollapsed && (
                          <span style={{ fontSize: '13px', fontWeight: isActive ? 500 : 400, lineHeight: 1, whiteSpace: 'nowrap' }}>
                            {item.label}
                          </span>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Recent items */}
        {!sidebarCollapsed && recentItems.items.length > 0 && (
          <div style={{ borderTop: '1px solid ' + DIVIDER }} className="mt-2 px-2 pt-3">
            <div className="flex items-center justify-between mb-1.5 px-2">
              <span style={{ color: SECTION_CLR, fontSize: '10px', fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase' }}
                className="flex items-center gap-1.5">
                <Clock size={9} /> Recent
              </span>
              <button onClick={recentItems.clearItems}
                style={{ color: SECTION_CLR, fontSize: '10px', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
            </div>
            <div className="space-y-px">
              {recentItems.items.slice(0, 4).map(item => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  style={{ color: INACTIVE_CLR, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '4px' }}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = HOVER_BG; (e.currentTarget as HTMLElement).style.color = ACTIVE_CLR; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = INACTIVE_CLR; }}
                >
                  <div style={{ background: ACCENT }} className="w-1 h-1 rounded-full shrink-0" />
                  <span className="text-xs truncate flex-1">{item.label}</span>
                  <span style={{ color: SECTION_CLR }} className="text-[10px] shrink-0 font-mono">{item.type}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* User identity */}
      {!sidebarCollapsed && (
        <div style={{ borderTop: '1px solid ' + DIVIDER }} className="px-3 py-2.5 flex items-center gap-2.5 shrink-0">
          <div style={{ backgroundColor: 'rgba(201,168,76,0.15)', border: '1px solid rgba(201,168,76,0.25)' }}
            className="w-7 h-7 rounded flex items-center justify-center shrink-0">
            <span style={{ color: ACCENT }} className="text-[10px] font-bold">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p style={{ color: ACTIVE_CLR }} className="text-[13px] font-medium truncate leading-none">{user?.name ?? '—'}</p>
            <p style={{ color: SECTION_CLR }} className="text-[10px] truncate leading-none mt-0.5">
              {user?.role?.replace(/_/g, ' ') ?? 'Unknown Role'}
            </p>
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <div style={{ borderTop: '1px solid ' + DIVIDER }} className="shrink-0">
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
          style={{ color: SECTION_CLR, width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = HOVER_BG; (e.currentTarget as HTMLElement).style.color = ACTIVE_CLR; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = SECTION_CLR; }}
        >
          {sidebarCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>
    </aside>
  );
}
