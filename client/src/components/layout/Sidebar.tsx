import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Settings,
  ChevronLeft,
  ChevronRight,
  Clock,
  ChevronDown,
  Palette,
  AlertTriangle,
  FileWarning,
  ShieldAlert,
  Wrench,
  GitBranch,
  Layers,
  FileText,
  Beaker,
  BookOpen,
  Database,
  ClipboardList,
  ClipboardCheck,
  PlayCircle,
  AlertOctagon,
  GraduationCap,
  FlaskConical,
  BadgeCheck,
  ScrollText,
  Snowflake,
  Package,
  Atom,
  Ruler,
  MapPin,
  Truck,
  Activity,
  ShieldCheck,
  Settings2,
  MessageSquareWarning,
  RefreshCw,
  Plug,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";
import { useRecentItemsStore } from "@/stores/recentItemsStore";
import { useAuthStore } from "@/stores/authStore";
import { useWorkflowTypes } from "@/lib/api/workflowLookups";
import { wfTypeReadKey } from "@/lib/navAccess";
import { useNavCounts } from "@/lib/api/navCounts";
import { useNavGroups, toNavGroupConfigs } from "@/lib/api/navGroups";
import { isDocReviewName, wfDisplayName, wfModuleKey } from "@/config/navModules";
import { useEffect, useMemo, useRef, useState } from "react";

interface NavItem {
  label: string;
  /** Leaf items must have a path; parents-with-children can omit it. */
  path?: string;
  icon: React.ElementType;
  children?: NavItem[];
  /** Permission key that gates this item (see lib/navAccess.ts). When set and
   * the user lacks it, the item is hidden. Parents with children stay visible
   * only while at least one child survives gating. */
  permission?: string;
  /** Visible if the user holds ANY of these keys. Evaluated together with
   * `permission` (both must pass when both are set). */
  anyPermission?: string[];
  /** Extra pathname prefixes that should also mark this item active — useful
   * for entries that land on one route but share a layout with siblings (e.g.
   * "Audit" points to /audit/register but should stay active on /audit/program). */
  activeForPrefixes?: string[];
  /** Pending-action count for the notification badge (FQS-QK-UIUX-003 §4).
   * Leaves carry their own count; parents show the sum of descendants. */
  count?: number;
}
interface NavSection {
  /** Stable group key — identity for React and for the persisted open state.
   * Never the title: titles are admin-editable (Master Data → Navigation Groups). */
  key: string;
  title: string;
  items: NavItem[];
  collapsible: boolean;
  /** Admin-set initial state; the user's own toggle overrides it (uiStore). */
  defaultOpen: boolean;
}

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
  // by canonical name — icon choices follow FQS-QK-UIUX-003 §3 (lab-specific,
  // unique per module: CAPA = corrective/preventive loop, Audit = inspection
  // checklist, Complaints = alert message).
  capa: RefreshCw,
  deviation: FileWarning,
  change: GitBranch,
  changecontrol: GitBranch,
  complaints: MessageSquareWarning,
  productcomplaints: MessageSquareWarning,
  risk: ShieldAlert,
  riskmanagement: ShieldAlert,
  audit: ClipboardCheck,
  document: FileText,
  // Additional QMS modules — each gets a distinct, recognisable icon so the
  // sidebar doesn't collapse to a wall of identical `Layers` fallbacks.
  equipment: Wrench,
  inspection: ClipboardCheck,
  maintenance: Settings2,
  supplierquality: Truck,
  supplier: Truck,
  calibration: Ruler,
};

const normaliseKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const findFirstLeaf = (item: NavItem): NavItem | null => {
  if (!item.children?.length) return item.path ? item : null;
  for (const child of item.children) {
    const leaf = findFirstLeaf(child);
    if (leaf) return leaf;
  }
  return null;
};

const pickIcon = (
  name: string,
  iconName: string | null | undefined
): React.ElementType => {
  if (iconName) {
    const k = normaliseKey(iconName);
    if (ICON_BY_KEY[k]) return ICON_BY_KEY[k];
  }
  const k = normaliseKey(name);
  return ICON_BY_KEY[k] ?? Layers;
};

// GMP display-name overrides live in config/navModules.ts (`wfDisplayName`), so
// the Navigation Groups editor arranges the same labels shown here.

// Which group each module belongs to is no longer hardcoded here — it is stored
// per-installation and edited in Master Data → Navigation Groups
// (docs/sidebar-module-grouping-plan.md). Grouping is presentation only: what a
// user can actually see is still decided entirely by the permission gates below.

// Design tokens — pulled from CSS custom properties (set by AppearanceProvider)
// so the sidebar tracks the user's color preset. Section/inactive/hover stay
// hardcoded because they're cosmetic neutrals that don't need theming.
const BG = "var(--color-navy)";
const ACTIVE_BG = "var(--color-navy-mid)";
const ACCENT = "var(--color-gold)";
const ACTIVE_CLR = "var(--color-gold)";
const SECTION_CLR = "rgba(255,255,255,0.65)";
const INACTIVE_CLR = "#FFFFFF";
const DIVIDER = "rgba(255,255,255,0.06)";
const HOVER_BG = "rgba(255,255,255,0.04)";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const recentItems = useRecentItemsStore();
  const user = useAuthStore((s) => s.user);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const { data: workflowTypes } = useWorkflowTypes();
  const { data: navCounts } = useNavCounts();
  const { data: navGroups } = useNavGroups();
  const navGroupsOpen = useUIStore((s) => s.navGroupsOpen);
  const toggleNavGroup = useUIStore((s) => s.toggleNavGroup);
  const setNavGroupOpen = useUIStore((s) => s.setNavGroupOpen);
  // Falls back to the compiled-in layout when the API is unreachable.
  const groupConfigs = useMemo(() => toNavGroupConfigs(navGroups), [navGroups]);

  const navigation = useMemo<NavSection[]>(() => {
    // Audit child pages — attached under the dynamic "Audit" workflow type when
    // present. Only two entries: "Audit" lands on the operations layout (Register
    // / Program / Non-Conformance as tabs); "Audit Master" lands on the config
    // layout (Master / ISO Standards as tabs).
    const auditChildren: NavItem[] = [
      {
        label: "Audit",
        path: "/audit/register",
        icon: ClipboardCheck,
        permission: "audit_register.read",
        activeForPrefixes: [
          "/audit/register",
          "/audit/program",
          "/audit/non-conformance",
        ],
      },
      {
        label: "Audit Master",
        path: "/audit/master",
        icon: Database,
        permission: "audit_master.read",
        activeForPrefixes: ["/audit/master", "/audit/iso-standards"],
      },
    ];

    // The "Document Review" workflow type isn't surfaced as its own top-level
    // module — it's grouped under the "Document Management System" entry next to
    // the DMS document library, since both concern documents. Pull it out here so
    // it can be nested below, and keep it out of the generic module list.
    const isDocReview = isDocReviewName;

    // DB-driven workflow modules, keyed by `wf:<id>` so the stored grouping can
    // reference them by a name-change-proof identifier.
    const moduleEntries = (workflowTypes ?? [])
      .filter((t) => !t.isDeleted && !isDocReview(t.name))
      .map((t) => {
        const isAudit = /^audit$/i.test(t.name);
        // Risk has a dedicated feature area (registers, risks, controls,
        // reviews, assessments) under /risk with its own tab bar — route the
        // sidebar entry there instead of the generic /modules ticket workspace.
        const isRisk = /^risk(\s*management)?$/i.test(t.name);
        const item: NavItem = {
          label: wfDisplayName(t.name),
          // For Audit, omit the leaf path so the parent acts purely as an expandable
          // group; first child becomes the navigation target in collapsed mode.
          path: isAudit ? undefined : isRisk ? "/risk/dashboard" : `/modules/${t.id}`,
          icon: pickIcon(t.name, t.iconConfig?.iconName ?? null),
          // Each workflow-type module has its own switch: gate strictly on its
          // per-type read key. Audit gates via its children
          // (audit_register.read etc) instead; Risk gates on its feature key.
          permission: isAudit ? undefined : isRisk ? "risk.read" : wfTypeReadKey(t.id),
          children: isAudit ? auditChildren : undefined,
          // Keep the entry highlighted across every /risk/* sub-page.
          activeForPrefixes: isRisk ? ["/risk"] : undefined,
          count: navCounts?.workflowTypes?.[t.id],
        };
        return { key: wfModuleKey(t.id), item };
      });

    // The "Document Review" workflow type, if seeded. It is no longer a sidebar
    // entry of its own — /dms hosts it as a tab — but it still decides whether a
    // doc-review-only user can see the DMS entry at all.
    const docReviewType = (workflowTypes ?? []).find(
      (t) => !t.isDeleted && isDocReview(t.name)
    );

    // ── Hardcoded modules, placed into their GMP groups in `sections` below ──
    const dashboardItem: NavItem = {
      label: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
    };
    // System-wide change history. Gated on its own key rather than the
    // internal-audit module's, since the trail spans every module and includes
    // security events.
    const auditTrailItem: NavItem = {
      label: "Audit Trail",
      path: "/admin/audit-trail",
      icon: ScrollText,
      permission: "audit_trail.read",
    };
    // One flat entry, not an expandable group. The document library and the
    // Document Approval workflow are two tabs of the same screen now, so nesting
    // them here would have duplicated the tab bar in the sidebar. Gated on ANY
    // of the two reads: a user who only holds the doc-review key still needs the
    // entry to reach their approval queue.
    const dmsItem: NavItem = {
      label: "DMS",
      path: "/dms",
      icon: FileText,
      anyPermission: [
        "document.read",
        ...(docReviewType ? [wfTypeReadKey(docReviewType.id)] : []),
      ],
      activeForPrefixes: ["/dms"],
    };
    // Training & Qualification (GMP term for the LMS). "My Training" is the
    // learner view; "Courses" is the author studio. Labels/icons follow
    // FQS-QK-UIUX-002 §6 and FQS-QK-UIUX-003 §3.
    // Training & Qualification (LMS) opens inside one tabbed frame
    // (LmsModuleLayout), mirroring LIMS/Audit — the sub-sections (My Training /
    // Catalog / Courses / Programs / Assignments / Matrix / Results / Reports)
    // are top tabs, not sidebar items. Lands on "My Training" (every employee);
    // stays active across every /lms route so the group highlights on drill-downs.
    const trainingItem: NavItem = {
      label: "Training & Qualification",
      path: "/lms/my",
      icon: GraduationCap,
      permission: "lms_my.read",
      activeForPrefixes: ["/lms"],
    };
    // Day-to-day LIMS operations open inside one tabbed frame (LimsModuleLayout),
    // mirroring the Audit module — the sub-sections (Overview / Samples / Worklists
    // / QC / Stability / OOS / CoA / Data Review) are top tabs, not sidebar items.
    // Set-up-once master data lives under the separate "LIMS Configuration" entry.
    const limsItem: NavItem = {
      label: "LIMS",
      path: "/lims/dashboard",
      icon: FlaskConical,
      permission: "lims_dashboard.read",
      count: navCounts?.oos,
      activeForPrefixes: [
        "/lims/dashboard",
        "/lims/samples",
        "/lims/worklists",
        "/lims/qc",
        "/lims/stability",
        "/lims/oos",
        "/lims/coa",
        "/lims/data-review",
      ],
    };
    const limsConfigItem: NavItem = {
      label: "LIMS Configuration",
      path: "/lims/config",
      icon: Settings2,
      permission: "lab.read",
      activeForPrefixes: [
        "/lims/config",
        "/lims/labs",
        "/lims/equipment",
        "/lims/storage",
        "/lims/certifications",
        "/lims/products",
        "/lims/analytes",
        "/lims/units",
        "/lims/sampling-points",
        "/lims/customers",
        "/lims/suppliers",
        "/lims/methods",
        "/lims/tests",
        "/lims/panels",
        "/lims/specifications",
        "/lims/spec-versions",
      ],
    };
    // Configuration only appears when the user can reach at least one of its
    // set-up surfaces (parent `anyPermission`). A role with no config access
    // (e.g. an auditor) would otherwise still see the group via the ungated
    // Master Data / Appearance children. Keep this union in sync with the child
    // gates below.
    const configItem: NavItem = {
      label: "Configuration",
      icon: Settings,
      anyPermission: [
        "workflow.read",
        "form.read",
        "user.read",
        "role.read",
        "department.read",
        "site.read",
        "workflow.lookups.read",
        "nav.groups.read",
      ],
      children: [
        {
          label: "Workflows",
          path: "/settings?section=workflows",
          icon: GitBranch,
          permission: "workflow.read",
        },
        {
          label: "Forms",
          path: "/settings?section=forms",
          icon: ClipboardList,
          permission: "form.read",
        },
        // Master Data holds the admin tabs (Users / Roles / Access Control /
        // Departments / Facilities / Workflow Categories / …). Show it only when
        // the user can open at least one of those gated tabs — the always-on
        // personal tabs (profile / notifications / security) don't warrant the
        // entry on their own.
        {
          // Explicit section param so this doesn't loose-match every /settings*
          // URL — otherwise Master Data stays highlighted on the Workflows/Forms
          // sub-sections too (they share the /settings pathname). SettingsPage
          // treats any non-workflows/forms section as master-data.
          label: "Master Data",
          path: "/settings?section=master-data",
          icon: Database,
          anyPermission: [
            "user.read",
            "role.read",
            "department.read",
            "site.read",
            "workflow.lookups.read",
          ],
        },
        // Configures the sidebar itself (which accordion group each module sits
        // in), so it sits beside the other configuration surfaces rather than
        // inside Master Data.
        {
          label: "Navigation Groups",
          path: "/settings?section=nav-groups",
          icon: PanelLeft,
          permission: "nav.groups.read",
        },
        { label: "Integrations", path: "/integrations", icon: Plug },
        { label: "Appearance", path: "/appearance", icon: Palette },
      ],
    };

    // ── Assemble sections from the stored grouping ──────────────────────────
    // Every groupable module, keyed the same way the DB stores it. Static keys
    // must match config/navModules.ts (and the backend's STATIC_MODULE_KEYS) —
    // they are permanent identifiers, so renaming one orphans its stored row.
    const itemsByKey = new Map<string, NavItem>([
      ["dashboard", dashboardItem],
      ["lims", limsItem],
      ["lims-config", limsConfigItem],
      ["dms", dmsItem],
      ["training", trainingItem],
      ["audit-trail", auditTrailItem],
      ["configuration", configItem],
      ...moduleEntries.map((e) => [e.key, e.item] as const),
    ]);

    const configuredKeys = new Set(groupConfigs.flatMap((g) => g.moduleKeys));
    const sections: NavSection[] = groupConfigs.map((g) => ({
      key: g.key,
      title: g.title,
      collapsible: g.collapsible,
      defaultOpen: g.defaultOpen,
      items: g.moduleKeys
        .map((k) => itemsByKey.get(k))
        .filter((it): it is NavItem => !!it),
    }));

    // A module the stored config has never heard of — a workflow type seeded
    // after the layout was last saved — joins the fallback group rather than
    // disappearing. Insertion order of `itemsByKey` keeps this stable.
    const unassigned = [...itemsByKey.entries()]
      .filter(([k]) => !configuredKeys.has(k))
      .map(([, item]) => item);
    if (unassigned.length) {
      const fallbackIdx = groupConfigs.findIndex((g) => g.isFallback);
      const target = sections[fallbackIdx >= 0 ? fallbackIdx : sections.length - 1];
      if (target) target.items = [...target.items, ...unassigned];
    }

    // Gate by permission: drop items the user can't access, and any parent whose
    // children all got dropped. SUPER_ADMIN holds every key, so it's unaffected.
    const gate = (items: NavItem[]): NavItem[] =>
      items
        .map((it) => {
          const children = it.children ? gate(it.children) : undefined;
          return { ...it, children };
        })
        .filter((it) => {
          if (it.children && it.children.length === 0 && !it.path) return false;
          if (it.permission && !hasPermission(it.permission)) return false;
          if (
            it.anyPermission &&
            !it.anyPermission.some((k) => hasPermission(k))
          )
            return false;
          return true;
        });

    return sections
      .map((s) => ({ ...s, items: gate(s.items) }))
      .filter((s) => s.items.length > 0);
    // `user` is a dep because `hasPermission` reads user.permissions but is a
    // stable Zustand reference — without it the gate wouldn't re-run when an
    // access-control change refreshes the current user's permissions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowTypes, hasPermission, navCounts, user, groupConfigs]);

  // Per-item expand state, keyed by label since parents may have no path.
  // All parents start collapsed; user opens what they need.
  const [itemsExpanded, setItemsExpanded] = useState<Record<string, boolean>>(
    {}
  );
  const toggleItem = (label: string) =>
    setItemsExpanded((prev) => ({ ...prev, [label]: !prev[label] }));

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
        !item.path.includes("?") &&
        item.path !== "/dashboard" &&
        location.pathname.startsWith(item.path)
      ) {
        return true;
      }
    }
    return !!item.children?.some(isItemActive);
  };

  // A group is open if the user has toggled it; otherwise the admin's default.
  const isSectionOpen = (section: NavSection): boolean =>
    !section.collapsible || (navGroupsOpen[section.key] ?? section.defaultOpen);

  // ─── Collapsed-rail flyout ───────────────────────────────────────────────
  // In the 56px rail a group is one tile; hovering it reveals its modules in a
  // panel to the right. Without this the groups would dissolve into a flat strip
  // of icons and the layout an admin configured would be invisible when collapsed.
  const [flyout, setFlyout] = useState<{ key: string; top: number } | null>(null);
  const flyoutTimer = useRef<number | null>(null);

  const cancelFlyoutClose = () => {
    if (flyoutTimer.current !== null) {
      window.clearTimeout(flyoutTimer.current);
      flyoutTimer.current = null;
    }
  };
  const openFlyout = (key: string, el: HTMLElement) => {
    cancelFlyoutClose();
    const rect = el.getBoundingClientRect();
    // Keep the panel on screen: nudge it up when the tile sits near the bottom.
    const top = Math.max(8, Math.min(rect.top, window.innerHeight - 140));
    setFlyout({ key, top });
  };
  // Small grace period so the pointer can travel from tile to panel without the
  // panel vanishing under it.
  const scheduleFlyoutClose = () => {
    cancelFlyoutClose();
    flyoutTimer.current = window.setTimeout(() => setFlyout(null), 140);
  };

  // Expanding the sidebar or navigating away must not leave a panel stranded.
  useEffect(() => {
    setFlyout(null);
    cancelFlyoutClose();
  }, [sidebarCollapsed, location.pathname, location.search]);
  useEffect(() => cancelFlyoutClose, []);

  // Deep-linking into a module must never land inside a collapsed group, so the
  // group holding the active route is forced open on navigation. Runs only when
  // it is actually shut, so it never fights a user closing a different group.
  useEffect(() => {
    for (const section of navigation) {
      if (!section.collapsible) continue;
      if (!section.items.some(isItemActive)) continue;
      if (navGroupsOpen[section.key] === false) {
        setNavGroupOpen(section.key, true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search, navigation]);

  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "QK";

  // ─── Collapsed rail: one tile per group ───────────────────────────────────
  // The tile borrows the first module's icon, which reads better than a generic
  // folder glyph — "Lab Operations" shows the LIMS flask, so the rail stays
  // recognisable at a glance.
  const renderCollapsedGroup = (section: NavSection): React.ReactNode => {
    const Icon = section.items[0]?.icon ?? Layers;
    const isActive = section.items.some(isItemActive);
    const open = flyout?.key === section.key;
    const firstLeaf = section.items.map(findFirstLeaf).find(Boolean);

    return (
      <button
        key={section.key}
        type="button"
        aria-label={section.title}
        aria-expanded={open}
        onMouseEnter={(e) => openFlyout(section.key, e.currentTarget)}
        onMouseLeave={scheduleFlyoutClose}
        onFocus={(e) => openFlyout(section.key, e.currentTarget)}
        onBlur={scheduleFlyoutClose}
        onClick={() => firstLeaf?.path && navigate(firstLeaf.path)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "36px",
          height: "36px",
          marginLeft: "auto",
          marginRight: "auto",
          borderRadius: "6px",
          backgroundColor: isActive || open ? ACTIVE_BG : "transparent",
          color: isActive ? ACTIVE_CLR : INACTIVE_CLR,
          border: "none",
          cursor: "pointer",
          transition: "background-color 100ms, color 100ms",
        }}
      >
        <Icon
          size={17}
          strokeWidth={isActive ? 2 : 1.5}
          style={{ color: isActive ? ACCENT : "inherit" }}
        />
      </button>
    );
  };

  // Flyout rows — leaves become links; a parent contributes a muted caption and
  // its children, so nothing is unreachable from the rail.
  const renderFlyoutItem = (item: NavItem, depth: number): React.ReactNode => {
    const Icon = item.icon;
    const isActive = isItemActive(item);

    if (item.children?.length && !item.path) {
      return (
        <div key={item.label}>
          <p
            style={{ color: SECTION_CLR }}
            className="flex items-center gap-2 px-2.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider"
          >
            <Icon size={12} /> {item.label}
          </p>
          {item.children.map((child) => renderFlyoutItem(child, depth + 1))}
        </div>
      );
    }
    if (!item.path) return null;

    return (
      <NavLink
        key={item.path}
        to={item.path}
        onClick={() => setFlyout(null)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "9px",
          padding: "7px 10px",
          paddingLeft: `${10 + depth * 10}px`,
          borderRadius: "6px",
          backgroundColor: isActive ? ACTIVE_BG : "transparent",
          color: isActive ? ACTIVE_CLR : INACTIVE_CLR,
          textDecoration: "none",
          whiteSpace: "nowrap",
          transition: "background-color 100ms, color 100ms",
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.backgroundColor = HOVER_BG;
            (e.currentTarget as HTMLElement).style.color = ACTIVE_CLR;
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            (e.currentTarget as HTMLElement).style.color = INACTIVE_CLR;
          }
        }}
      >
        <Icon
          size={15}
          strokeWidth={isActive ? 2 : 1.5}
          style={{ color: isActive ? ACCENT : "inherit", flexShrink: 0 }}
        />
        <span className="text-sm leading-tight">{item.label}</span>
      </NavLink>
    );
  };

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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "36px",
              height: "36px",
              marginLeft: "auto",
              marginRight: "auto",
              borderRadius: "6px",
              backgroundColor: isActive ? ACTIVE_BG : "transparent",
              color: isActive ? ACTIVE_CLR : INACTIVE_CLR,
              border: "none",
              cursor: "pointer",
              transition: "background-color 100ms, color 100ms",
            }}
          >
            <Icon
              size={17}
              strokeWidth={isActive ? 2 : 1.5}
              style={{ color: isActive ? ACCENT : "inherit" }}
            />
          </button>
        );
      }

      return (
        <div key={item.label}>
          <button
            type="button"
            onClick={() => toggleItem(item.label)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "9px 12px 9px 10px",
              paddingLeft: `${10 + indent}px`,
              width: "100%",
              borderRadius: "6px",
              borderLeft: isActive
                ? "3px solid " + ACCENT
                : "3px solid transparent",
              backgroundColor: isActive ? ACTIVE_BG : "transparent",
              color: isActive ? ACTIVE_CLR : INACTIVE_CLR,
              border: "none",
              cursor: "pointer",
              textAlign: "left",
              transition: "background-color 100ms, color 100ms",
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  HOVER_BG;
                (e.currentTarget as HTMLElement).style.color = ACTIVE_CLR;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  "transparent";
                (e.currentTarget as HTMLElement).style.color = INACTIVE_CLR;
              }
            }}
          >
            <Icon
              size={depth === 0 ? 19 : 16}
              strokeWidth={isActive ? 2 : 1.5}
              style={{ color: isActive ? ACCENT : "inherit", flexShrink: 0 }}
            />
            <span
              style={{
                flex: 1,
                fontSize: depth === 0 ? "15px" : "14px",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
              }}
            >
              {item.label}
            </span>
            <ChevronDown
              size={13}
              style={{
                color: SECTION_CLR,
                flexShrink: 0,
                transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
                transition: "transform 150ms",
              }}
            />
          </button>
          {expanded && (
            <div className="mt-0.5 space-y-px">
              {item.children!.map((child) => renderNavItem(child, depth + 1))}
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
          display: "flex",
          alignItems: "center",
          gap: sidebarCollapsed ? 0 : "10px",
          padding: sidebarCollapsed ? 0 : "9px 12px 9px 10px",
          paddingLeft: sidebarCollapsed ? 0 : `${10 + indent}px`,
          width: sidebarCollapsed ? "36px" : "100%",
          height: sidebarCollapsed ? "36px" : undefined,
          justifyContent: sidebarCollapsed ? "center" : undefined,
          marginLeft: sidebarCollapsed ? "auto" : undefined,
          marginRight: sidebarCollapsed ? "auto" : undefined,
          borderRadius: "6px",
          borderLeft: !sidebarCollapsed
            ? isActive
              ? "3px solid " + ACCENT
              : "3px solid transparent"
            : undefined,
          backgroundColor: isActive ? ACTIVE_BG : "transparent",
          color: isActive ? ACTIVE_CLR : INACTIVE_CLR,
          textDecoration: "none",
          transition: "background-color 100ms, color 100ms",
        }}
        onMouseEnter={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.backgroundColor = HOVER_BG;
            (e.currentTarget as HTMLElement).style.color = ACTIVE_CLR;
          }
        }}
        onMouseLeave={(e) => {
          if (!isActive) {
            (e.currentTarget as HTMLElement).style.backgroundColor =
              "transparent";
            (e.currentTarget as HTMLElement).style.color = INACTIVE_CLR;
          }
        }}
      >
        <Icon
          size={depth === 0 ? 19 : 16}
          strokeWidth={isActive ? 2 : 1.5}
          style={{ color: isActive ? ACCENT : "inherit", flexShrink: 0 }}
        />
        {!sidebarCollapsed && (
          <>
            <span
              style={{
                fontSize: depth === 0 ? "15px" : "14px",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
              }}
            >
              {item.label}
            </span>
          </>
        )}
      </NavLink>
    );
  };

  return (
    <aside
      style={{ backgroundColor: BG, borderRight: "1px solid " + DIVIDER }}
      className={cn(
        "fixed left-0 top-0 h-screen flex flex-col z-40",
        "transition-[width] duration-250 ease-in-out",
        sidebarCollapsed ? "w-[56px]" : "w-[288px]"
      )}
    >
      {/* Brand */}
      <div
        style={{ borderBottom: "1px solid " + DIVIDER }}
        className={cn(
          "flex items-center justify-center h-[72px] shrink-0",
          sidebarCollapsed ? "px-3" : "gap-3.5 px-5"
        )}
      >
        <div
          style={{ backgroundColor: ACCENT }}
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        >
          <span
            style={{ color: "#0D0E17" }}
            className="font-black text-lg tracking-tight"
          >
            Q
          </span>
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <p className="text-white text-xl leading-none tracking-[0.01em]">
              Quantum <span style={{ color: ACCENT }}>Kairoz</span>
            </p>
          </div>
        )}
      </div>

      {/* Logged-in user — raised card so the identity block reads as its own
          surface rather than another sidebar row (FQS-QK-UIUX-003 §4). */}
      {!sidebarCollapsed && (
        <div className="shrink-0 px-3 pt-3 pb-2">
          <div
            style={{
              background:
                "linear-gradient(160deg, rgba(201,168,76,0.16) 0%, rgba(201,168,76,0.06) 55%, rgba(201,168,76,0.02) 100%)",
              border: "1px solid rgba(201,168,76,0.30)",
              boxShadow:
                "0 6px 18px -6px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.07)",
            }}
            className="relative flex flex-col items-center text-center rounded-xl py-4 px-3 overflow-hidden"
          >
            {/* Soft gold glow behind the avatar */}
            <div
              aria-hidden
              style={{
                background:
                  "radial-gradient(circle, rgba(201,168,76,0.20) 0%, rgba(201,168,76,0) 70%)",
              }}
              className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 w-40 h-40 rounded-full"
            />
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user?.name ?? "User"}
                style={{
                  border: "2px solid rgba(201,168,76,0.55)",
                  boxShadow:
                    "0 0 0 4px rgba(201,168,76,0.10), 0 8px 18px -6px rgba(0,0,0,0.7)",
                }}
                className="relative w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <div
                style={{
                  background:
                    "linear-gradient(145deg, rgba(201,168,76,0.30) 0%, rgba(201,168,76,0.10) 100%)",
                  border: "1px solid rgba(201,168,76,0.45)",
                  boxShadow:
                    "0 0 0 4px rgba(201,168,76,0.10), 0 8px 18px -6px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.12)",
                }}
                className="relative w-20 h-20 rounded-full flex items-center justify-center"
              >
                <span style={{ color: ACCENT }} className="text-2xl font-bold">
                  {initials}
                </span>
              </div>
            )}
            <p
              style={{ color: ACTIVE_CLR }}
              className="relative text-sm font-semibold truncate leading-tight mt-2.5 max-w-full"
            >
              {user?.name ?? "—"}
            </p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto py-3 scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {navigation.map((section, sectionIdx) => {
          // Group collapse only applies when the sidebar itself is expanded —
          // the 56px rail has no headers to click.
          const isOpen = sidebarCollapsed || isSectionOpen(section);
          const hasActive = section.items.some(isItemActive);
          const hasHeader = !!section.title;

          // Collapsed rail: the configured groups survive as one tile each, with
          // their modules reachable through the hover panel. The headerless
          // system row (Dashboard) has no group to stand for, so its items are
          // rendered directly.
          if (sidebarCollapsed) {
            return (
              <div key={section.key} className="mb-1">
                {sectionIdx > 0 && (
                  <div
                    style={{ background: DIVIDER }}
                    className="mx-3 my-1.5 h-px"
                  />
                )}
                <div className="space-y-px px-1.5">
                  {hasHeader
                    ? renderCollapsedGroup(section)
                    : section.items.map((item) => renderNavItem(item, 0))}
                </div>
              </div>
            );
          }

          return (
            <div key={section.key} className="mb-1">
              {!sidebarCollapsed && hasHeader && (
                <button
                  type="button"
                  aria-expanded={section.collapsible ? isOpen : undefined}
                  aria-controls={`nav-group-${section.key}`}
                  onClick={() =>
                    section.collapsible &&
                    toggleNavGroup(section.key, section.defaultOpen)
                  }
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-1 mb-0.5 rounded",
                    section.collapsible && "cursor-pointer"
                  )}
                  onMouseEnter={(e) => {
                    if (section.collapsible)
                      (e.currentTarget as HTMLElement).style.backgroundColor =
                        HOVER_BG;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "transparent";
                  }}
                >
                  <span
                    style={{
                      color: hasActive ? ACCENT : SECTION_CLR,
                      fontSize: "12.5px",
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                    }}
                  >
                    {section.title}
                  </span>
                  {section.collapsible && (
                    <ChevronDown
                      size={13}
                      style={{ color: SECTION_CLR }}
                      className={cn(
                        "transition-transform duration-150",
                        isOpen ? "rotate-0" : "-rotate-90"
                      )}
                    />
                  )}
                </button>
              )}

              {sidebarCollapsed && sectionIdx > 0 && (
                <div
                  style={{ background: DIVIDER }}
                  className="mx-3 my-1.5 h-px"
                />
              )}

              <div
                id={`nav-group-${section.key}`}
                className={cn(
                  "overflow-hidden transition-[max-height,opacity] duration-150 ease-in-out",
                  isOpen ? "opacity-100" : "max-h-0 opacity-0"
                )}
                style={{
                  // Generous ceiling: max-height must exceed the tallest group
                  // or the tail of a long list would be clipped while open.
                  maxHeight: isOpen ? "1000px" : 0,
                  // Clipping alone only hides the links visually — they keep
                  // their own layout boxes, so they stay tabbable and are still
                  // announced by screen readers. `visibility` takes them out of
                  // the a11y tree and the tab order for real.
                  visibility: isOpen ? "visible" : "hidden",
                }}
              >
                <div
                  className={cn(
                    "space-y-px",
                    sidebarCollapsed ? "px-1.5" : "px-2"
                  )}
                >
                  {section.items.map((item) => renderNavItem(item, 0))}
                </div>
              </div>
            </div>
          );
        })}

        {/* Recent items */}
        {!sidebarCollapsed && recentItems.items.length > 0 && (
          <div
            style={{ borderTop: "1px solid " + DIVIDER }}
            className="mt-2 px-2 pt-3"
          >
            <div className="flex items-center justify-between mb-1.5 px-2">
              <span
                style={{
                  color: SECTION_CLR,
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                }}
                className="flex items-center gap-1.5"
              >
                <Clock size={11} /> Recent
              </span>
              <button
                onClick={recentItems.clearItems}
                style={{
                  color: SECTION_CLR,
                  fontSize: "11px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            </div>
            <div className="space-y-px">
              {recentItems.items.slice(0, 4).map((item) => (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  style={{
                    color: INACTIVE_CLR,
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    borderRadius: "4px",
                  }}
                  className="flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors"
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      HOVER_BG;
                    (e.currentTarget as HTMLElement).style.color = ACTIVE_CLR;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      "transparent";
                    (e.currentTarget as HTMLElement).style.color = INACTIVE_CLR;
                  }}
                >
                  <div
                    style={{ background: ACCENT }}
                    className="w-1 h-1 rounded-full shrink-0"
                  />
                  <span className="text-sm truncate flex-1">{item.label}</span>
                  <span
                    style={{ color: SECTION_CLR }}
                    className="text-[11px] shrink-0 font-mono"
                  >
                    {item.type}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </nav>

      {/* Compliance-mode indicator (FQS-QK-UIUX-003 §4/§8) — reassures QA/
          inspectors that GMP data-integrity controls are active. */}
      {!sidebarCollapsed && (
        <div
          style={{ borderTop: "1px solid " + DIVIDER, color: ACCENT }}
          className="px-3 py-2 flex items-center gap-1.5 shrink-0"
        >
          <ShieldCheck size={11} />
          <span className="text-[10px] font-semibold tracking-wide">
            GMP · 21 CFR 11 · EU Annex 11
          </span>
        </div>
      )}

      {/* Collapsed-rail group panel. Fixed rather than absolute so the scrolling
          <nav> can't clip it, and anchored to the hovered tile's viewport y. */}
      {sidebarCollapsed &&
        (() => {
          const section = navigation.find((s) => s.key === flyout?.key);
          if (!section || !flyout) return null;
          return (
            <div
              role="group"
              aria-label={section.title}
              onMouseEnter={cancelFlyoutClose}
              onMouseLeave={scheduleFlyoutClose}
              style={{
                position: "fixed",
                left: "60px",
                top: `${flyout.top}px`,
                zIndex: 50,
                minWidth: "208px",
                maxHeight: "calc(100vh - 16px)",
                overflowY: "auto",
                backgroundColor: BG,
                border: "1px solid rgba(255,255,255,0.10)",
                borderRadius: "10px",
                boxShadow: "0 18px 40px -12px rgba(0,0,0,0.75)",
                padding: "6px",
              }}
              className="scrollbar-none"
            >
              <p
                style={{ color: ACCENT, borderBottom: "1px solid " + DIVIDER }}
                className="px-2.5 pb-1.5 mb-1 text-[11px] font-semibold uppercase tracking-[0.14em]"
              >
                {section.title}
              </p>
              <div className="space-y-px">
                {section.items.map((item) => renderFlyoutItem(item, 0))}
              </div>
            </div>
          );
        })()}

      {/* Collapse toggle */}
      <div style={{ borderTop: "1px solid " + DIVIDER }} className="shrink-0">
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
          style={{
            color: SECTION_CLR,
            width: "100%",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = HOVER_BG;
            (e.currentTarget as HTMLElement).style.color = ACTIVE_CLR;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor =
              "transparent";
            (e.currentTarget as HTMLElement).style.color = SECTION_CLR;
          }}
        >
          {sidebarCollapsed ? (
            <ChevronRight size={14} />
          ) : (
            <ChevronLeft size={14} />
          )}
        </button>
      </div>
    </aside>
  );
}
