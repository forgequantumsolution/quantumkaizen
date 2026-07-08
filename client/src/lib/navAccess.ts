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
  /**
   * Permission-key PREFIX for this tab's entity (e.g. 'sample', 'document',
   * 'audit_register'). The Access Matrix collects every catalog key that starts
   * with `${entity}.` and buckets them into View/Create/Edit/Delete/Approve/More
   * columns (see lib/accessActions.ts). Keeps `permission` (the .read key) as the
   * sidebar gate, untouched.
   */
  entity: string;
}

export interface NavModuleAccess {
  key: string;
  label: string;
  description?: string;
  tabs: NavTabAccess[];
}

export const NAV_ACCESS: NavModuleAccess[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    description: 'Landing dashboard — KPIs and workload overview.',
    tabs: [
      { key: 'dashboard.main', label: 'Dashboard', permission: 'dashboard.read', entity: 'dashboard' },
    ],
  },
  {
    key: 'dms',
    label: 'Documents (DMS)',
    description: 'Controlled document management — SOPs, policies, protocols.',
    tabs: [
      { key: 'dms.documents', label: 'Documents', permission: 'document.read', entity: 'document' },
    ],
  },
  {
    key: 'training',
    label: 'Training & Competency',
    description: 'Assign training and track read-and-understood completion.',
    tabs: [
      { key: 'training.module', label: 'Training', permission: 'training.read', entity: 'training' },
    ],
  },
  {
    key: 'lims',
    label: 'LIMS — Operations',
    description: 'Day-to-day lab operations — samples, testing, QC, stability, CoA.',
    tabs: [
      { key: 'lims.dashboard', label: 'LIMS Dashboard', permission: 'lims_dashboard.read', entity: 'lims_dashboard' },
      { key: 'lims.samples', label: 'Samples', permission: 'sample.read', entity: 'sample' },
      { key: 'lims.worklists', label: 'Worklists', permission: 'worklist.read', entity: 'worklist' },
      { key: 'lims.qc', label: 'Quality Control', permission: 'qc.read', entity: 'qc' },
      { key: 'lims.stability', label: 'Stability', permission: 'stability.read', entity: 'stability' },
      { key: 'lims.oos', label: 'OOS Investigations', permission: 'oos.read', entity: 'oos' },
      { key: 'lims.coa', label: 'Certificates (CoA)', permission: 'coa.read', entity: 'coa' },
      { key: 'lims.dataReview', label: 'Data Review', permission: 'data_review.read', entity: 'data_review' },
    ],
  },
  {
    key: 'lims-config',
    label: 'LIMS — Configuration',
    description: 'Set-up-once master data: labs, equipment, catalog, test library.',
    tabs: [
      { key: 'lims.labs', label: 'Lab Registry', permission: 'lab.read', entity: 'lab' },
      { key: 'lims.equipment', label: 'Equipment', permission: 'equipment.read', entity: 'equipment' },
      { key: 'lims.storage', label: 'Storage Locations', permission: 'storage.read', entity: 'storage' },
      { key: 'lims.certifications', label: 'Certifications', permission: 'certification.read', entity: 'certification' },
      { key: 'lims.products', label: 'Products', permission: 'product.read', entity: 'product' },
      { key: 'lims.analytes', label: 'Analytes', permission: 'analyte.read', entity: 'analyte' },
      { key: 'lims.units', label: 'Units of Measure', permission: 'unit.read', entity: 'unit' },
      { key: 'lims.samplingPoints', label: 'Sampling Points', permission: 'sampling_point.read', entity: 'sampling_point' },
      { key: 'lims.customers', label: 'Customers', permission: 'customer.read', entity: 'customer' },
      { key: 'lims.suppliers', label: 'Suppliers', permission: 'supplier.read', entity: 'supplier' },
      { key: 'lims.methods', label: 'Test Methods', permission: 'method.read', entity: 'method' },
      { key: 'lims.tests', label: 'Test Definitions', permission: 'test_definition.read', entity: 'test_definition' },
      { key: 'lims.panels', label: 'Test Panels', permission: 'test_panel.read', entity: 'test_panel' },
      { key: 'lims.specifications', label: 'Specifications', permission: 'specification.read', entity: 'specification' },
      { key: 'lims.specVersions', label: 'Spec Versions', permission: 'spec_version.read', entity: 'spec_version' },
    ],
  },
  {
    key: 'audit',
    label: 'Audit',
    description: 'Audit operations — planning, execution, findings and CAPA.',
    tabs: [
      { key: 'audit.dashboard',  label: 'Dashboard',        permission: 'audit_register.read',  entity: 'audit_register' },
      { key: 'audit.register',   label: 'Audit Register',   permission: 'audit_register.read',  entity: 'audit_register' },
      { key: 'audit.program',    label: 'Audit Program',    permission: 'audit_program.read',   entity: 'audit_program' },
      { key: 'audit.nc',         label: 'Non-Conformance',  permission: 'non_conformance.read', entity: 'non_conformance' },
      { key: 'audit.capa',       label: 'CAPA',             permission: 'capa.read',            entity: 'capa' },
      { key: 'audit.actions',    label: 'Action Items',     permission: 'action_item.read',     entity: 'action_item' },
    ],
  },
  {
    key: 'audit-master',
    label: 'Audit Master',
    description: 'Audit configuration master data.',
    tabs: [
      { key: 'audit.master',     label: 'Audit Master',  permission: 'audit_master.read',  entity: 'audit_master' },
      { key: 'audit.focus',      label: 'Focus Area',    permission: 'focus_area.read',    entity: 'focus_area' },
      { key: 'audit.types',      label: 'Audit Type',    permission: 'audit_type.read',    entity: 'audit_type' },
      { key: 'audit.iso',        label: 'ISO Standards', permission: 'iso_standard.read',  entity: 'iso_standard' },
    ],
  },
  {
    key: 'configuration',
    label: 'Configuration',
    description: 'Workflow, form and master-data administration.',
    tabs: [
      { key: 'config.workflows',     label: 'Workflows',      permission: 'workflow.read',         entity: 'workflow' },
      { key: 'config.forms',         label: 'Forms',          permission: 'form.read',             entity: 'form' },
      { key: 'config.users',         label: 'Users',          permission: 'user.read',             entity: 'user' },
      { key: 'config.roles',         label: 'Roles',          permission: 'role.read',             entity: 'role' },
      { key: 'config.departments',   label: 'Departments',    permission: 'department.read',       entity: 'department' },
      { key: 'config.workflowTypes', label: 'Workflow Types', permission: 'workflow.lookups.read', entity: 'workflow.lookups' },
    ],
  },
  {
    // The global `ticket.*` master. Granting it opens tickets across EVERY
    // workflow type at once; leave it off and use the per-type module switches
    // (appended after this list) to restrict a role to specific types.
    key: 'workflow-tickets-master',
    label: 'All Workflow Types (ticket master)',
    description:
      'Master switch — grants ticket access across every workflow type at once. Leave this off and use the individual workflow-type switches below to restrict a role to specific modules.',
    tabs: [
      { key: 'tickets.master', label: 'All Workflow Types', permission: 'ticket.read', entity: 'ticket' },
    ],
  },
];

/* ── Dynamic per-workflow-type modules ──────────────────────────────────────
 * Each workflow type (CAPA, Deviation, …) is its own module in Access Control,
 * gated by DB-driven `wf_type.<id>.*` keys (mirrors backend/src/lib/
 * rbac-workflow-types.ts). Audit is excluded — it keeps its own audit_* keys. */

/** Audit is special-cased everywhere — never gets a generated per-type row. */
export const isAuditWorkflowTypeName = (name: string): boolean => /^audit$/i.test(name.trim());

/** Permission-key entity prefix for a workflow type (buckets the matrix columns). */
export const wfTypeEntity = (typeId: string): string => `wf_type.${typeId}`;

/** The `.read` key that gates a workflow-type module in the sidebar/matrix. */
export const wfTypeReadKey = (typeId: string): string => `wf_type.${typeId}.read`;

/** Build the Access-Control matrix module for one workflow type. */
export const workflowTypeModule = (type: { id: string; name: string }): NavModuleAccess => ({
  key: wfTypeEntity(type.id),
  label: type.name,
  description: `${type.name} — workflow tickets`,
  tabs: [
    {
      key: `${wfTypeEntity(type.id)}.tab`,
      label: type.name,
      permission: wfTypeReadKey(type.id),
      entity: wfTypeEntity(type.id),
    },
  ],
});

/** Flat list of every gateable tab (for lookups). */
export const NAV_ACCESS_TABS: NavTabAccess[] = NAV_ACCESS.flatMap((m) => m.tabs);

/** Permission key → tab, for reverse lookups in the matrix. */
export const PERMISSION_BY_TAB_KEY = new Map(
  NAV_ACCESS_TABS.map((t) => [t.key, t.permission] as const),
);
