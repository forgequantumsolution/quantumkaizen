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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";
import { useRecentItemsStore } from "@/stores/recentItemsStore";
import { useAuthStore } from "@/stores/authStore";
import { useWorkflowTypes } from "@/lib/api/workflowLookups";
import { wfTypeReadKey } from "@/lib/navAccess";
import { useNavCounts } from "@/lib/api/navCounts";
import { useMemo, useState } from "react";

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
  title: string;
  items: NavItem[];
  collapsible?: boolean;
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

// GMP terminology overrides (FQS-QK-UIUX-002 §6) for DB-driven workflow-type
// modules. The workflow type's stored `name` is the internal key (used by seeds
// / lookups / permissions) and is left untouched — only its sidebar display
// label is remapped here. Unmatched names fall through to `t.name`.
const WF_DISPLAY_NAME: Record<string, string> = {
  CAPA: "CAPA Management",
  Deviation: "Deviations",
  Complaints: "Product Complaints",
};

// Which sidebar group each DB-driven workflow module belongs to
// (FQS-QK-UIUX-003 §2/§4). Matched on the normalised workflow-type name;
// unknown types default to "Quality System".
type ModuleGroup = "Quality System" | "Compliance";
const MODULE_GROUP: Record<string, ModuleGroup> = {
  capa: "Quality System",
  deviation: "Quality System",
  deviations: "Quality System",
  complaints: "Quality System",
  productcomplaints: "Quality System",
  change: "Quality System",
  changecontrol: "Quality System",
  risk: "Quality System",
  audit: "Compliance",
  calibration: "Compliance",
};
const groupForModule = (name: string): ModuleGroup =>
  MODULE_GROUP[name.toLowerCase().replace(/[^a-z0-9]/g, "")] ??
  "Quality System";

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
    const isDocReview = (name: string) =>
      /^document\s*review$/i.test(name.trim());

    // DB-driven workflow modules, each tagged with its GMP sidebar group so the
    // sections below can distribute them (FQS-QK-UIUX-003 §2).
    const moduleEntries = (workflowTypes ?? [])
      .filter((t) => !t.isDeleted && !isDocReview(t.name))
      .map((t) => {
        const isAudit = /^audit$/i.test(t.name);
        const item: NavItem = {
          label: WF_DISPLAY_NAME[t.name] ?? t.name,
          // For Audit, omit the leaf path so the parent acts purely as an expandable
          // group; first child becomes the navigation target in collapsed mode.
          path: isAudit ? undefined : `/modules/${t.id}`,
          icon: pickIcon(t.name, t.iconConfig?.iconName ?? null),
          // Each workflow-type module has its own switch: gate strictly on its
          // per-type read key. Audit gates via its children
          // (audit_register.read etc) instead.
          permission: isAudit ? undefined : wfTypeReadKey(t.id),
          children: isAudit ? auditChildren : undefined,
          count: navCounts?.workflowTypes?.[t.id],
        };
        return { item, group: groupForModule(t.name) };
      });
    const qualityItems = moduleEntries
      .filter((e) => e.group === "Quality System")
      .map((e) => e.item);
    const complianceItems = moduleEntries
      .filter((e) => e.group === "Compliance")
      .map((e) => e.item);

    // Children of the "Document Management System" group: the DMS document
    // library plus the "Document Review" workflow ticket workspace (if seeded).
    const docReviewType = (workflowTypes ?? []).find(
      (t) => !t.isDeleted && isDocReview(t.name)
    );
    const documentChildren: NavItem[] = [
      ...(docReviewType
        ? [
            {
              label: "Document Approval",
              path: `/modules/${docReviewType.id}`,
              icon: ClipboardCheck,
              permission: wfTypeReadKey(docReviewType.id),
            },
          ]
        : []),
      {
        label: "Documents",
        path: "/dms",
        icon: FileText,
        permission: "document.read",
      },
    ];

    // ── Hardcoded modules, placed into their GMP groups in `sections` below ──
    const dashboardItem: NavItem = {
      label: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
    };
    // Groups the DMS document library with the "Document Review" workflow so the
    // two document-centric areas live under one roof.
    const dmsItem: NavItem = {
      label: "DMS ",
      icon: FileText,
      children: documentChildren,
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
        { label: "Integrations", path: "/integrations", icon: Plug },
        { label: "Appearance", path: "/appearance", icon: Palette },
      ],
    };

    // Four GMP-aligned groups (FQS-QK-UIUX-003 §2/§4). Dashboard stays ungrouped
    // at the top. Empty groups (e.g. no seeded workflow types) are dropped by the
    // `items.length > 0` filter at the end of this memo.
    const sections: NavSection[] = [
      { title: "", items: [dashboardItem] },
      { title: "Lab Operations", items: [limsItem, limsConfigItem] },
      { title: "DMS", items: [dmsItem] },
      { title: "Quality System", items: qualityItems },
      { title: "Compliance", items: complianceItems },
      { title: "LMS", items: [trainingItem, configItem] },
    ];

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
          if (it.anyPermission && !it.anyPermission.some((k) => hasPermission(k)))
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
  }, [workflowTypes, hasPermission, navCounts, user]);

  const [sectionsCollapsed, setSectionsCollapsed] = useState<
    Record<string, boolean>
  >({});
  const toggleSection = (title: string) =>
    setSectionsCollapsed((prev) => ({ ...prev, [title]: !prev[title] }));

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

  const initials =
    user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "QK";

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
          "flex items-center h-14 shrink-0",
          sidebarCollapsed ? "justify-center px-3" : "gap-3 px-4"
        )}
      >
        <div
          style={{ backgroundColor: ACCENT }}
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
        >
          <span
            style={{ color: "#0D0E17" }}
            className="font-black text-sm tracking-tight"
          >
            Q
          </span>
        </div>
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <p className="text-white text-base leading-none tracking-tight">
              Quantum <span style={{ color: ACCENT }}>Kairoz</span>
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav
        className="flex-1 overflow-y-auto py-3 scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {navigation.map((section) => {
          const isCollapsed = !!(
            section.collapsible && sectionsCollapsed[section.title]
          );
          const hasActive = section.items.some(isItemActive);

          const hasHeader = !!section.title;
          return (
            <div
              key={section.title || `untitled-${navigation.indexOf(section)}`}
              className="mb-1"
            >
              {!sidebarCollapsed && hasHeader && (
                <button
                  onClick={() =>
                    section.collapsible && toggleSection(section.title)
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
                        isCollapsed ? "-rotate-90" : "rotate-0"
                      )}
                    />
                  )}
                </button>
              )}

              {sidebarCollapsed && navigation.indexOf(section) > 0 && (
                <div
                  style={{ background: DIVIDER }}
                  className="mx-3 my-1.5 h-px"
                />
              )}

              {!isCollapsed && (
                <div
                  className={cn(
                    "space-y-px",
                    sidebarCollapsed ? "px-1.5" : "px-2"
                  )}
                >
                  {section.items.map((item) => renderNavItem(item, 0))}
                </div>
              )}
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

      {/* User identity */}
      {!sidebarCollapsed && (
        <div
          style={{ borderTop: "1px solid " + DIVIDER }}
          className="px-3 py-2.5 flex items-center gap-2.5 shrink-0"
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user?.name ?? "User"}
              style={{ border: "1px solid rgba(201,168,76,0.35)" }}
              className="w-8 h-8 rounded object-cover shrink-0"
            />
          ) : (
            <div
              style={{
                backgroundColor: "rgba(201,168,76,0.15)",
                border: "1px solid rgba(201,168,76,0.25)",
              }}
              className="w-8 h-8 rounded flex items-center justify-center shrink-0"
            >
              <span style={{ color: ACCENT }} className="text-[11px] font-bold">
                {initials}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p
              style={{ color: ACTIVE_CLR }}
              className="text-[15px] truncate leading-tight"
            >
              {user?.name ?? "—"}
            </p>
            {user?.email && (
              <p
                style={{ color: ACTIVE_CLR, opacity: 0.6 }}
                className="text-[12px] truncate leading-tight mt-0.5"
              >
                {user.email}
              </p>
            )}
            <p
              style={{ color: SECTION_CLR }}
              className="text-[11px] truncate leading-tight mt-0.5 tracking-wide uppercase"
            >
              {user?.role?.replace(/_/g, " ") ?? "Unknown Role"}
            </p>
          </div>
        </div>
      )}

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
