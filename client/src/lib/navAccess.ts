/**
 * Navigation access registry — the single source of truth for which permission
 * key gates each navigable Module → Tab in the app.
 *
 * Two consumers share this:
 *   1. The layouts/sidebar filter their nav by `hasPermission(tab.permission)`
 *      so a role only sees what it's allowed to (SUPER_ADMIN holds every key, so
 *      it always sees everything).
 *   2. The Access Control → "Menu Access" view renders this as a Role × Tab
 *      checkbox matrix; toggling a tab grants/revokes its permission key on the
 *      role. That makes "which module / which tab a role can access" fully
 *      dynamic and configurable, enforced by the same keys.
 *
 * Keys here MUST exist in the backend permission catalog (src/lib/rbac-catalog.ts).
 */

export interface NavTabAccess {
  /** Stable id for the matrix UI. */
  key: string;
  label: string;
  /** Permission key that gates this tab. Held by a role → tab is visible. */
  permission: string;
}

export interface NavModuleAccess {
  key: string;
  label: string;
  description?: string;
  tabs: NavTabAccess[];
}

export const NAV_ACCESS: NavModuleAccess[] = [
  {
    key: 'audit',
    label: 'Audit',
    description: 'Audit operations — planning, execution, findings and CAPA.',
    tabs: [
      { key: 'audit.dashboard',  label: 'Dashboard',        permission: 'audit_register.read' },
      { key: 'audit.workspace',  label: 'My Workspace',     permission: 'ticket.read' },
      { key: 'audit.register',   label: 'Audit Register',   permission: 'audit_register.read' },
      { key: 'audit.program',    label: 'Audit Program',    permission: 'audit_program.read' },
      { key: 'audit.nc',         label: 'Non-Conformance',  permission: 'non_conformance.read' },
      { key: 'audit.capa',       label: 'CAPA',             permission: 'capa.read' },
      { key: 'audit.actions',    label: 'Action Items',     permission: 'action_item.read' },
    ],
  },
  {
    key: 'audit-master',
    label: 'Audit Master',
    description: 'Audit configuration master data.',
    tabs: [
      { key: 'audit.master',     label: 'Audit Master',  permission: 'audit_master.read' },
      { key: 'audit.focus',      label: 'Focus Area',    permission: 'focus_area.read' },
      { key: 'audit.types',      label: 'Audit Type',    permission: 'audit_type.read' },
      { key: 'audit.iso',        label: 'ISO Standards', permission: 'iso_standard.read' },
    ],
  },
  {
    key: 'configuration',
    label: 'Configuration',
    description: 'Workflow, form and master-data administration.',
    tabs: [
      { key: 'config.workflows',     label: 'Workflows',      permission: 'workflow.read' },
      { key: 'config.forms',         label: 'Forms',          permission: 'form.read' },
      { key: 'config.users',         label: 'Users',          permission: 'user.read' },
      { key: 'config.roles',         label: 'Roles',          permission: 'role.read' },
      { key: 'config.departments',   label: 'Departments',    permission: 'department.read' },
      { key: 'config.workflowTypes', label: 'Workflow Types', permission: 'workflow.lookups.read' },
    ],
  },
];

/** Flat list of every gateable tab (for lookups). */
export const NAV_ACCESS_TABS: NavTabAccess[] = NAV_ACCESS.flatMap((m) => m.tabs);

/** Permission key → tab, for reverse lookups in the matrix. */
export const PERMISSION_BY_TAB_KEY = new Map(
  NAV_ACCESS_TABS.map((t) => [t.key, t.permission] as const),
);
