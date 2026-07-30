/**
 * Registry of every top-level sidebar module that can be placed into a
 * navigation group (docs/sidebar-module-grouping-plan.md §6.1).
 *
 * This is NOT the grouping — that lives in the DB and is edited in Master Data →
 * Navigation Groups. This file is the catalog of *groupable things*, and has
 * three consumers:
 *   1. Sidebar.tsx — maps a stored `moduleKey` back to its NavItem;
 *   2. NavGroupsTab — lists what an admin can drag into a group;
 *   3. the compiled-in fallback layout used when the API is unreachable.
 *
 * Distinct from lib/navAccess.ts on purpose: NAV_ACCESS describes Module → Tab
 * for the Access Control matrix and does not line up 1:1 with sidebar entries
 * (no `audit-trail` module, `audit-master` is a child of Audit, `risk-config`
 * has no sidebar entry, and its `training` row gates on a different key than the
 * sidebar's Training entry). Keeping them separate avoids bending either one.
 *
 * Module keys are PERMANENT identifiers — renaming one orphans its stored row.
 */

/** Statically-defined modules. Mirrors STATIC_MODULE_KEYS on the backend. */
export const STATIC_MODULE_KEYS = [
  'dashboard',
  'lims',
  'lims-config',
  'calibration',
  'calibration-config',
  'dms',
  'training',
  'audit-trail',
  'configuration',
] as const;

export type StaticModuleKey = (typeof STATIC_MODULE_KEYS)[number];

/** Human labels for the admin editor. The sidebar uses its own NavItem labels. */
export const STATIC_MODULE_LABELS: Record<StaticModuleKey, string> = {
  dashboard: 'Dashboard',
  lims: 'LIMS',
  'lims-config': 'LIMS Configuration',
  calibration: 'Calibration',
  'calibration-config': 'Calibration Configuration',
  dms: 'DMS',
  training: 'Training & Qualification',
  'audit-trail': 'Audit Trail',
  configuration: 'Configuration',
};

// ── Workflow-type-driven modules ────────────────────────────────────────────
// Keyed by id rather than name: type names are editable in Workflow Categories,
// and a rename must not orphan the assignment.

export const WF_MODULE_PREFIX = 'wf:';
export const wfModuleKey = (workflowTypeId: string) => `${WF_MODULE_PREFIX}${workflowTypeId}`;
export const isWfModuleKey = (key: string) => key.startsWith(WF_MODULE_PREFIX);
export const workflowTypeIdFromKey = (key: string) => key.slice(WF_MODULE_PREFIX.length);

/**
 * The "Document Review" workflow type is deliberately NOT a sidebar module — it
 * renders as a tab inside /dms. It must be excluded from the assignable list, or
 * an admin can place a module that never appears.
 */
export const isDocReviewName = (name: string) => /^document\s*review$/i.test(name.trim());

/**
 * GMP terminology overrides (FQS-QK-UIUX-002 §6) for DB-driven workflow-type
 * modules. The stored `name` is the internal key (used by seeds / lookups /
 * permissions) and is left untouched — only the display label is remapped.
 *
 * Shared by the sidebar and the Navigation Groups editor so an admin arranges
 * the same labels the user actually sees; showing "Complaints" in one place and
 * "Product Complaints" in the other reads as two different modules.
 */
export const WF_DISPLAY_NAME: Record<string, string> = {
  CAPA: 'CAPA Management',
  Deviation: 'Deviations',
  Complaints: 'Product Complaints',
};

export const wfDisplayName = (name: string) => WF_DISPLAY_NAME[name] ?? name;

// ── Fallback layout ─────────────────────────────────────────────────────────

export interface NavGroupConfig {
  key: string;
  title: string;
  icon?: string | null;
  collapsible: boolean;
  defaultOpen: boolean;
  isFallback: boolean;
  isSystem: boolean;
  moduleKeys: string[];
}

/**
 * Used only when `GET /nav-groups` fails — navigation must never disappear on a
 * network blip. Mirrors the backend bootstrap in lib/nav-group-defaults.ts;
 * workflow modules are omitted here (their ids aren't known statically) and land
 * in the fallback group at render time.
 */
export const FALLBACK_NAV_GROUPS: NavGroupConfig[] = [
  { key: 'top', title: '', collapsible: false, defaultOpen: true, isFallback: false, isSystem: true, moduleKeys: ['dashboard'] },
  { key: 'lab-operations', title: 'Lab Operations', collapsible: true, defaultOpen: true, isFallback: false, isSystem: false, moduleKeys: ['lims', 'lims-config', 'calibration', 'calibration-config'] },
  { key: 'dms', title: 'DMS', collapsible: true, defaultOpen: true, isFallback: false, isSystem: false, moduleKeys: ['dms'] },
  { key: 'quality-system', title: 'Quality System', collapsible: true, defaultOpen: true, isFallback: true, isSystem: false, moduleKeys: [] },
  { key: 'compliance', title: 'Compliance', collapsible: true, defaultOpen: true, isFallback: false, isSystem: false, moduleKeys: ['audit-trail'] },
  { key: 'training', title: 'Training', collapsible: true, defaultOpen: true, isFallback: false, isSystem: false, moduleKeys: ['training'] },
  { key: 'administration', title: 'Administration', collapsible: true, defaultOpen: false, isFallback: false, isSystem: false, moduleKeys: ['configuration'] },
];
