import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Settings, ChevronLeft,
  ChevronRight, Clock, ChevronDown,
  Palette,
  AlertTriangle, FileWarning, ShieldAlert, Wrench,
  GitBranch, Layers, FileText, Beaker, BookOpen,
  Database, ClipboardList,
  ClipboardCheck, PlayCircle, AlertOctagon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/uiStore';
import { useRecentItemsStore } from '@/stores/recentItemsStore';
import { useAuthStore } from '@/stores/authStore';
import { useWorkflowTypes } from '@/lib/api/workflowLookups';
import { useMemo, useState } from 'react';

interface NavItem {
  label: string;
  /** Leaf items must have a path; parents-with-children can omit it. */
  path?: string;
  icon: React.ElementType;
  children?: NavItem[];
  /** Extra pathname prefixes that should also mark this item active — useful
   * for entries that land on one route but share a layout with siblings (e.g.
   * "Audit" points to /audit/register but should stay active on /audit/program). */
  activeForPrefixes?: string[];
}
interface NavSection { title: string; items: NavItem[]; collapsible?: boolean }

// Best-effort mapping from a workflow type's stored iconName (e.g. "file-text")
// or its name (e.g. "CAPA") to a lucide icon. Anything unknown gets a sensible
// fallback so the sidebar still renders cleanly.
const ICON_BY_KEY: Record<string, React.ElementType> = {
  // by iconName (lowercase, with dashes/underscores normalised)
  alerttriangle: AlertTriangle,
  filewarning: FileWarning,
  shieldalert: ShieldAlert,
  wrench: Wrench,
  gitbranch: GitBranch,
  layers: Layers,
  filetext: FileText,
  beaker: Beaker,
  bookopen: BookOpen,
  // by canonical name
  capa: Wrench,
  deviation: FileWarning,
  change: GitBranch,
  changecontrol: GitBranch,
  risk: ShieldAlert,
  audit: BookOpen,
  document: FileText,
};

const normaliseKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

const findFirstLeaf = (item: NavItem): NavItem | null => {
  if (!item.children?.length) return item.path ? item : null;
  for (const child of item.children) {
    const leaf = findFirstLeaf(child);
    if (leaf) return leaf;
  }
  return null;
};

const pickIcon = (name: string, iconName: string | null | undefined): React.ElementType => {
  if (iconName) {
    const k = normaliseKey(iconName);
    if (ICON_BY_KEY[k]) return ICON_BY_KEY[k];
  }
  const k = normaliseKey(name);
  return ICON_BY_KEY[k] ?? Layers;
};

// Design tokens — pulled from CSS custom properties (set by AppearanceProvider)
// so the sidebar tracks the user's color preset. Section/inactive/hover stay
// hardcoded because they're cosmetic neutrals that don't need theming.
const BG           = 'var(--color-navy)';
const ACTIVE_BG    = 'var(--color-navy-mid)';
const ACCENT       = 'var(--color-gold)';
const ACTIVE_CLR   = 'var(--color-gold)';
const SECTION_CLR  = '#4A4A6A';
const INACTIVE_CLR = '#7A7A9A';
const DIVIDER      = 'rgba(255,255,255,0.06)';
const HOVER_BG     = 'rgba(255,255,255,0.04)';

export default function Sidebar() {
  const location    = useLocation();
  const navigate    = useNavigate();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const recentItems = useRecentItemsStore();
  const user        = useAuthStore(s => s.user);
  const { data: workflowTypes } = useWorkflowTypes();

  const navigation = useMemo<NavSection[]>(() => {
    // Audit child pages — attached under the dynamic "Audit" workflow type when
    // present. Only two entries: "Audit" lands on the operations layout (Register
    // / Program / Non-Conformance as tabs); "Audit Master" lands on the config
    // layout (Master / ISO Standards as tabs).
    const auditChildren: NavItem[] = [
      {
        label: 'Audit',
        path: '/audit/register',
        icon: ClipboardCheck,
        activeForPrefixes: ['/audit/register', '/audit/program', '/audit/non-conformance'],
      },
      {
        label: 'Audit Master',
        path: '/audit/master',
        icon: Database,
        activeForPrefixes: ['/audit/master', '/audit/iso-standards'],
      },
    ];

    const moduleItems: NavItem[] = (workflowTypes ?? [])
      .filter((t) => !t.isDeleted)
      .map((t) => {
        const isAudit = /^audit$/i.test(t.name);
        return {
          label: t.name,
          // For Audit, omit the leaf path so the parent acts purely as an expandable
          // group; first child becomes the navigation target in collapsed mode.
          path: isAudit ? undefined : `/modules/${t.id}`,
          icon: pickIcon(t.name, t.iconConfig?.iconName ?? null),
          children: isAudit ? auditChildren : undefined,
        };
      });

    const sections: NavSection[] = [
      {
        title: 'Overview',
        items: [{ label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard }],
      },
    ];

    if (moduleItems.length > 0) {
      sections.push({ title: 'Modules', items: moduleItems, collapsible: true });
    }

    sections.push({
      title: '',
      items: [
        {
          label: 'Configuration',
          icon: Settings,
          children: [
            { label: 'Workflows',   path: '/settings?section=workflows', icon: GitBranch },
            { label: 'Forms',       path: '/settings?section=forms',     icon: ClipboardList },
            { label: 'Master Data', path: '/settings',                   icon: Database },
            { label: 'Appearance',  path: '/appearance',                 icon: Palette },
          ],
        },
      ],
    });

    return sections;
  }, [workflowTypes]);

  const [sectionsCollapsed, setSectionsCollapsed] = useState<Record<string, boolean>>({});
  const toggleSection = (title: string) =>
    setSectionsCollapsed(prev => ({ ...prev, [title]: !prev[title] }));

  // Per-item expand state, keyed by label since parents may have no path.
  // Configuration + Master Data default to expanded so users see the children
  // immediately on /settings.
  const [itemsExpanded, setItemsExpanded] = useState<Record<string, boolean>>({
    Configuration: true,
    'Master Data': true,
  });
  const toggleItem = (label: string) =>
    setItemsExpanded(prev => ({ ...prev, [label]: !prev[label] }));

  // Match by pathname AND query string so /settings?tab=users highlights the
  // right child instead of every Configuration child at once.
  const currentUrl = location.pathname + location.search;
  const isItemActive = (item: NavItem): boolean => {
    if (item.activeForPrefixes?.some((p) => location.pathname.startsWith(p))) {
      return true;
    }
    if (item.path) {
      if (item.path === currentUrl) return true;
      // Loose match for items without query params (e.g. /workflows/123).
      if (
        !item.path.includes('?') &&
        item.path !== '/dashboard' &&
        location.pathname.startsWith(item.path)
      ) {
        return true;
      }
    }
    return !!item.children?.some(isItemActive);
  };

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? 'QK';

  // ─── Recursive item renderer (handles leaf links + expandable parents) ───
  const renderNavItem = (item: NavItem, depth: number): React.ReactNode => {
    const Icon = item.icon;
    const isActive = isItemActive(item);
    const hasChildren = !!item.children?.length;
    const expanded = itemsExpanded[item.label] ?? false;
    const indent = depth === 0 ? 0 : depth * 12;

    // Parent with children → button that toggles expansion (collapsed sidebar
    // still falls back to a leaf-style hover-only display for the top level).
    if (hasChildren) {
      // When the whole sidebar is collapsed, hide the nested tree entirely —
      // there's no room for children. The first leaf descendant is used as the
      // navigation target for the icon tile.
      if (sidebarCollapsed && depth === 0) {
        const firstLeaf = findFirstLeaf(item);
        return (
          <button
            key={item.label}
            title={item.label}
            onClick={() => firstLeaf?.path && navigate(firstLeaf.path)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '36px', height: '36px', marginLeft: 'auto', marginRight: 'auto',
              borderRadius: '6px',
              backgroundColor: isActive ? ACTIVE_BG : 'transparent',
              color: isActive ? ACTIVE_CLR : INACTIVE_CLR,
              border: 'none', cursor: 'pointer',
              transition: 'background-color 100ms, color 100ms',
            }}
          >
            <Icon size={17} strokeWidth={isActive ? 2 : 1.5}
              style={{ color: isActive ? ACCENT : 'inherit' }} />
          </button>
        );
      }

      return (
        <div key={item.label}>
          <button
            type="button"
            onClick={() => toggleItem(item.label)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '9px 12px 9px 10px',
              paddingLeft: `${10 + indent}px`,
              width: '100%',
              borderRadius: '6px',
              borderLeft: isActive ? '3px solid ' + ACCENT : '3px solid transparent',
              backgroundColor: isActive ? ACTIVE_BG : 'transparent',
              color: isActive ? ACTIVE_CLR : INACTIVE_CLR,
              border: 'none', cursor: 'pointer', textAlign: 'left',
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
            <Icon size={depth === 0 ? 17 : 15} strokeWidth={isActive ? 2 : 1.5}
              style={{ color: isActive ? ACCENT : 'inherit', flexShrink: 0 }} />
            <span style={{
              flex: 1, fontSize: depth === 0 ? '15px' : '13px',
              fontWeight: isActive ? 500 : 400, lineHeight: 1.15, whiteSpace: 'nowrap',
            }}>{item.label}</span>
            <ChevronDown
              size={13}
              style={{
                color: SECTION_CLR, flexShrink: 0,
                transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 150ms',
              }}
            />
          </button>
          {expanded && (
            <div className="mt-0.5 space-y-px">
              {item.children!.map(child => renderNavItem(child, depth + 1))}
            </div>
          )}
        </div>
      );
    }

    // Leaf item → NavLink
    if (!item.path) return null;
    return (
      <NavLink
        key={item.path}
        to={item.path}
        title={sidebarCollapsed ? item.label : undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: sidebarCollapsed ? 0 : '10px',
          padding: sidebarCollapsed ? 0 : '9px 12px 9px 10px',
          paddingLeft: sidebarCollapsed ? 0 : `${10 + indent}px`,
          width: sidebarCollapsed ? '36px' : '100%',
          height: sidebarCollapsed ? '36px' : undefined,
          justifyContent: sidebarCollapsed ? 'center' : undefined,
          marginLeft: sidebarCollapsed ? 'auto' : undefined,
          marginRight: sidebarCollapsed ? 'auto' : undefined,
          borderRadius: '6px',
          borderLeft: !sidebarCollapsed
            ? isActive ? '3px solid ' + ACCENT : '3px solid transparent'
            : undefined,
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
        <Icon size={depth === 0 ? 17 : 15} strokeWidth={isActive ? 2 : 1.5}
          style={{ color: isActive ? ACCENT : 'inherit', flexShrink: 0 }} />
        {!sidebarCollapsed && (
          <span style={{
            fontSize: depth === 0 ? '15px' : '13px',
            fontWeight: isActive ? 500 : 400, lineHeight: 1.15, whiteSpace: 'nowrap',
          }}>{item.label}</span>
        )}
      </NavLink>
    );
  };

  return (
    <aside
      style={{ backgroundColor: BG, borderRight: '1px solid ' + DIVIDER }}
      className={cn(
        'fixed left-0 top-0 h-screen flex flex-col z-40',
        'transition-[width] duration-250 ease-in-out',
        sidebarCollapsed ? 'w-[56px]' : 'w-[256px]',
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
          const hasActive   = section.items.some(isItemActive);

          const hasHeader = !!section.title;
          return (
            <div key={section.title || `untitled-${navigation.indexOf(section)}`} className="mb-1">
              {!sidebarCollapsed && hasHeader && (
                <button
                  onClick={() => section.collapsible && toggleSection(section.title)}
                  className={cn('w-full flex items-center justify-between px-4 py-1 mb-0.5 rounded', section.collapsible && 'cursor-pointer')}
                  onMouseEnter={e => { if (section.collapsible) (e.currentTarget as HTMLElement).style.backgroundColor = HOVER_BG; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
                >
                  <span style={{ color: hasActive ? ACCENT : SECTION_CLR, fontSize: '11px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    {section.title}
                  </span>
                  {section.collapsible && (
                    <ChevronDown size={13} style={{ color: SECTION_CLR }}
                      className={cn('transition-transform duration-150', isCollapsed ? '-rotate-90' : 'rotate-0')} />
                  )}
                </button>
              )}

              {sidebarCollapsed && navigation.indexOf(section) > 0 && (
                <div style={{ background: DIVIDER }} className="mx-3 my-1.5 h-px" />
              )}

              {!isCollapsed && (
                <div className={cn('space-y-px', sidebarCollapsed ? 'px-1.5' : 'px-2')}>
                  {section.items.map(item => renderNavItem(item, 0))}
                </div>
              )}
            </div>
          );
        })}

        {/* Recent items */}
        {!sidebarCollapsed && recentItems.items.length > 0 && (
          <div style={{ borderTop: '1px solid ' + DIVIDER }} className="mt-2 px-2 pt-3">
            <div className="flex items-center justify-between mb-1.5 px-2">
              <span style={{ color: SECTION_CLR, fontSize: '11px', fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase' }}
                className="flex items-center gap-1.5">
                <Clock size={11} /> Recent
              </span>
              <button onClick={recentItems.clearItems}
                style={{ color: SECTION_CLR, fontSize: '11px', background: 'none', border: 'none', cursor: 'pointer' }}>Clear</button>
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
                  <span className="text-sm truncate flex-1">{item.label}</span>
                  <span style={{ color: SECTION_CLR }} className="text-[11px] shrink-0 font-mono">{item.type}</span>
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
            className="w-8 h-8 rounded flex items-center justify-center shrink-0">
            <span style={{ color: ACCENT }} className="text-[11px] font-bold">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p style={{ color: ACTIVE_CLR }} className="text-[14px] font-medium truncate leading-tight">{user?.name ?? '—'}</p>
            <p style={{ color: SECTION_CLR }} className="text-[11px] truncate leading-tight mt-0.5">
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
