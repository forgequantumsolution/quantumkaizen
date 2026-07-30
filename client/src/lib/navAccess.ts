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
    description:
      'Controlled document management — SOPs, policies, protocols, and the ' +
      'Document Approval workflow. The Approval tab is appended at runtime ' +
      'from the Document Review workflow type (see AccessControlTab).',
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
    key: 'calibration',
    label: 'Calibration',
    description:
      'Day-to-day calibration operations — instrument registry, schedule, execution, ' +
      'out-of-tolerance impact, in-use checks and MSA. An independent module: it owns ' +
      'its own instrument registry and only soft-links to LIMS equipment where a tenant ' +
      'runs both. Set-up-once master data lives under "Calibration Configuration".',
    tabs: [
      { key: 'cal.dashboard',   label: 'Overview',            permission: 'calibration_analytics.read',  entity: 'calibration_analytics' },
      { key: 'cal.instruments', label: 'Instruments',         permission: 'calibration_instrument.read', entity: 'calibration_instrument' },
      { key: 'cal.schedule',    label: 'Schedule',            permission: 'calibration_event.read',      entity: 'calibration_event' },
      { key: 'cal.events',      label: 'Calibrations',        permission: 'calibration_event.read',      entity: 'calibration_event' },
      { key: 'cal.oot',         label: 'Out of Tolerance',    permission: 'calibration_oot.read',        entity: 'calibration_oot' },
      { key: 'cal.checks',      label: 'In-Use Checks',       permission: 'calibration_check.read',      entity: 'calibration_check' },
    ],
  },
  {
    key: 'calibration-config',
    label: 'Calibration — Configuration',
    description:
      'Set-up-once master data: industry packs, policy and signature rules, instrument ' +
      'categories with their tolerance templates, and calibration providers. This is ' +
      'where the pharma / automotive / FMCG difference is configured.',
    tabs: [
      { key: 'cal.packs',      label: 'Industry Packs',       permission: 'calibration_config.read',   entity: 'calibration_config' },
      { key: 'cal.policy',     label: 'Policy & Rules',       permission: 'calibration_config.read',   entity: 'calibration_config' },
      { key: 'cal.categories', label: 'Instrument Categories', permission: 'calibration_config.read',   entity: 'calibration_config' },
      { key: 'cal.standards',  label: 'Reference Standards',   permission: 'calibration_standard.read',  entity: 'calibration_standard' },
      { key: 'cal.providers',  label: 'Calibration Providers', permission: 'calibration_provider.read',  entity: 'calibration_provider' },
      { key: 'cal.msa',        label: 'MSA / Gage R&R',        permission: 'msa_study.read',             entity: 'msa_study' },
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
    key: 'risk',
    label: 'Risk Management',
    description: 'Quality risk management — registers, risks, controls, reviews, assessments.',
    tabs: [
      { key: 'risk.risks',       label: 'Risks',       permission: 'risk.read',            entity: 'risk' },
      { key: 'risk.registers',   label: 'Registers',   permission: 'risk_register.read',   entity: 'risk_register' },
      { key: 'risk.assessments', label: 'Assessments', permission: 'risk_assessment.read', entity: 'risk_assessment' },
      { key: 'risk.controls',    label: 'Controls',    permission: 'risk_control.read',    entity: 'risk_control' },
      { key: 'risk.reviews',     label: 'Reviews',     permission: 'risk_review.read',     entity: 'risk_review' },
    ],
  },
  {
    key: 'risk-config',
    label: 'Risk Configuration',
    description: 'Risk framework, category and library master data.',
    tabs: [
      { key: 'risk.frameworks',  label: 'Frameworks',  permission: 'risk_framework.read',  entity: 'risk_framework' },
      { key: 'risk.categories',  label: 'Categories',  permission: 'risk_category.read',    entity: 'risk_category' },
      { key: 'risk.libraries',   label: 'Libraries',   permission: 'risk_library.read',     entity: 'risk_library' },
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
      { key: 'config.sites',         label: 'Facilities',     permission: 'site.read',             entity: 'site' },
      { key: 'config.workflowTypes', label: 'Workflow Types', permission: 'workflow.lookups.read', entity: 'workflow.lookups' },
      // Sidebar accordion grouping. Layout only — it grants no module access;
      // what a role can see is decided by the other rows in this registry.
      { key: 'config.navGroups',     label: 'Navigation Groups', permission: 'nav.groups.read', entity: 'nav.groups' },
    ],
  },
  // The global `ticket.*` "All Workflow Types" master was retired — ticket
  // access is granted exclusively via the per-workflow-type module switches
  // below (docs/per-module-ticket-master-plan.md).
];

/* ── Dynamic per-workflow-type modules ──────────────────────────────────────
 * Each workflow type (CAPA, Deviation, …) is its own module in Access Control,
 * gated by DB-driven `wf_type.<id>.*` keys (mirrors backend/src/lib/
 * rbac-workflow-types.ts). Audit is excluded — it keeps its own audit_* keys. */

/** Audit is special-cased everywhere — never gets a generated per-type row. */
export const isAuditWorkflowTypeName = (name: string): boolean => /^audit$/i.test(name.trim());

/** The Risk workflow type — folded into the static "Risk Management" module
 *  (like Audit) so its ticket/findings keys don't form a duplicate group. */
export const isRiskWorkflowTypeName = (name: string): boolean =>
  /^risk(\s*management)?$/i.test(name.trim());

/** The Document Review workflow type. It no longer has a sidebar entry of its
 *  own — /dms renders it as the "Document Approval" tab — so it folds into the
 *  static DMS module here rather than forming a standalone group. Keep this in
 *  step with the same test in Sidebar.tsx and DocumentListPage.tsx. */
export const isDocReviewWorkflowTypeName = (name: string): boolean =>
  /^document\s*review$/i.test(name.trim());

/** Permission-key entity prefix for a workflow type (buckets the matrix columns). */
export const wfTypeEntity = (typeId: string): string => `wf_type.${typeId}`;

/** The `.read` key that gates a workflow-type module in the sidebar/matrix. */
export const wfTypeReadKey = (typeId: string): string => `wf_type.${typeId}.read`;

/** The remaining per-type ticket action keys, alongside `wfTypeReadKey`. */
export const wfTypeCreateKey = (typeId: string): string => `wf_type.${typeId}.create`;
export const wfTypeUpdateKey = (typeId: string): string => `wf_type.${typeId}.update`;
export const wfTypeDeleteKey = (typeId: string): string => `wf_type.${typeId}.delete`;
export const wfTypeTransitionKey = (typeId: string): string => `wf_type.${typeId}.transition`;

/** Per-type FINDINGS keys — only exist for types with supportsFindings=true.
 *  Entity prefix + read/create keys drive the matrix row and client gating (see
 *  backend lib/rbac-findings.ts). */
export const findingTypeEntity = (typeId: string): string => `finding.${typeId}`;
export const findingTypeReadKey = (typeId: string): string => `finding.${typeId}.read`;
export const findingTypeCreateKey = (typeId: string): string => `finding.${typeId}.create`;
export const findingTypeUpdateKey = (typeId: string): string => `finding.${typeId}.update`;
export const findingTypeDeleteKey = (typeId: string): string => `finding.${typeId}.delete`;

/**
 * Build the Access-Control matrix module for one workflow type. The module
 * itself is named after the type (e.g. "CAPA"); its single row is labeled
 * "Workflow Tickets" — not the type name again — so it doesn't read as a
 * duplicate of the module header, and matches the row Audit gets for the same
 * `wf_type.*` keys (see AccessControlTab's `useAuditTicketTabs`).
 */
export const workflowTypeModule = (type: {
  id: string;
  name: string;
  supportsFindings?: boolean;
}): NavModuleAccess => ({
  key: wfTypeEntity(type.id),
  label: type.name,
  description: `${type.name} — workflow tickets`,
  tabs: [
    {
      key: `${wfTypeEntity(type.id)}.tab`,
      label: 'Workflow Tickets',
      permission: wfTypeReadKey(type.id),
      entity: wfTypeEntity(type.id),
    },
    // Findings-enabled types get a second row gating the generic Findings
    // capability (Findings tab on tickets + module register) independently of
    // ticket access. Backed by the per-type `finding.<id>.*` keys.
    ...(type.supportsFindings
      ? [
          {
            key: `${wfTypeEntity(type.id)}.findings`,
            label: 'Findings',
            permission: findingTypeReadKey(type.id),
            entity: findingTypeEntity(type.id),
          },
        ]
      : []),
  ],
});

/** Flat list of every gateable tab (for lookups). */
export const NAV_ACCESS_TABS: NavTabAccess[] = NAV_ACCESS.flatMap((m) => m.tabs);

/** Permission key → tab, for reverse lookups in the matrix. */
export const PERMISSION_BY_TAB_KEY = new Map(
  NAV_ACCESS_TABS.map((t) => [t.key, t.permission] as const),
);
