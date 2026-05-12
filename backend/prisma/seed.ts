import { PrismaClient, StageActionBehavior } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const WORKFLOW_STAGE_STATUSES: { name: string; behavior: StageActionBehavior }[] = [
  { name: 'Approve / Forward', behavior: 'FORWARD'  },
  { name: 'Reject',            behavior: 'REJECT'   },
  { name: 'Hold',              behavior: 'HOLD'     },
  { name: 'Resume',            behavior: 'UNHOLD'   },
  { name: 'Return',            behavior: 'RETURN'   },
  { name: 'Reassign',          behavior: 'REASSIGN' },
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];

const ACTION_CRITERIA = ['Anyone'];

const PERMISSIONS = [
  // ── Admin ────────────────────────────────────────────
  { key: 'user.create',       module: 'USER',       action: 'CREATE', description: 'Create users' },
  { key: 'user.read',         module: 'USER',       action: 'READ',   description: 'View users' },
  { key: 'user.update',       module: 'USER',       action: 'UPDATE', description: 'Edit users' },
  { key: 'user.delete',       module: 'USER',       action: 'DELETE', description: 'Deactivate users' },
  { key: 'role.create',       module: 'ROLE',       action: 'CREATE', description: 'Create roles' },
  { key: 'role.read',         module: 'ROLE',       action: 'READ',   description: 'View roles' },
  { key: 'role.update',       module: 'ROLE',       action: 'UPDATE', description: 'Edit roles' },
  { key: 'role.delete',       module: 'ROLE',       action: 'DELETE', description: 'Delete roles' },
  { key: 'department.create', module: 'DEPARTMENT', action: 'CREATE', description: 'Create departments' },
  { key: 'department.read',   module: 'DEPARTMENT', action: 'READ',   description: 'View departments' },
  { key: 'department.update', module: 'DEPARTMENT', action: 'UPDATE', description: 'Edit departments' },
  { key: 'department.delete', module: 'DEPARTMENT', action: 'DELETE', description: 'Delete departments' },
  { key: 'org.read',          module: 'ORG',        action: 'READ',   description: 'View organization settings' },
  { key: 'org.update',        module: 'ORG',        action: 'UPDATE', description: 'Edit organization settings' },
  // ── QMS modules ──────────────────────────────────────
  { key: 'doc.read',          module: 'DOC',        action: 'READ',    description: 'View documents' },
  { key: 'doc.write',         module: 'DOC',        action: 'WRITE',   description: 'Create/edit documents' },
  { key: 'doc.approve',       module: 'DOC',        action: 'APPROVE', description: 'Approve documents' },
  { key: 'capa.read',         module: 'CAPA',       action: 'READ',    description: 'View CAPAs' },
  { key: 'capa.write',        module: 'CAPA',       action: 'WRITE',   description: 'Create/edit CAPAs' },
  { key: 'capa.approve',      module: 'CAPA',       action: 'APPROVE', description: 'Approve CAPAs' },
  { key: 'nc.read',           module: 'NC',         action: 'READ',    description: 'View Non-Conformances' },
  { key: 'nc.write',          module: 'NC',         action: 'WRITE',   description: 'Create/edit NCs' },
  { key: 'nc.approve',        module: 'NC',         action: 'APPROVE', description: 'Approve NC closures' },
  { key: 'audit.read',        module: 'AUDIT',      action: 'READ',    description: 'View audits' },
  { key: 'audit.write',       module: 'AUDIT',      action: 'WRITE',   description: 'Create/conduct audits' },
  { key: 'audit.approve',     module: 'AUDIT',      action: 'APPROVE', description: 'Sign-off audit reports' },
  { key: 'fmea.read',         module: 'FMEA',       action: 'READ',    description: 'View FMEAs' },
  { key: 'fmea.write',        module: 'FMEA',       action: 'WRITE',   description: 'Create/edit FMEAs' },
  { key: 'risk.read',         module: 'RISK',       action: 'READ',    description: 'View risks' },
  { key: 'risk.write',        module: 'RISK',       action: 'WRITE',   description: 'Create/edit risks' },
  { key: 'supplier.read',     module: 'SUPPLIER',   action: 'READ',    description: 'View suppliers' },
  { key: 'supplier.write',    module: 'SUPPLIER',   action: 'WRITE',   description: 'Create/edit suppliers' },
  { key: 'training.read',     module: 'TRAINING',   action: 'READ',    description: 'View training' },
  { key: 'training.write',    module: 'TRAINING',   action: 'WRITE',   description: 'Manage training' },
  { key: 'inspection.read',   module: 'INSPECTION', action: 'READ',    description: 'View inspections' },
  { key: 'inspection.write',  module: 'INSPECTION', action: 'WRITE',   description: 'Record inspections' },
  { key: 'calibration.read',  module: 'CALIBRATION',action: 'READ',    description: 'View calibration records' },
  { key: 'calibration.write', module: 'CALIBRATION',action: 'WRITE',   description: 'Record calibrations' },
  // ── Workflow ─────────────────────────────────────────
  { key: 'workflow.read',           module: 'WORKFLOW', action: 'READ',   description: 'View workflows' },
  { key: 'workflow.create',         module: 'WORKFLOW', action: 'CREATE', description: 'Create workflow shells' },
  { key: 'workflow.update',         module: 'WORKFLOW', action: 'UPDATE', description: 'Edit/version workflows' },
  { key: 'workflow.delete',         module: 'WORKFLOW', action: 'DELETE', description: 'Soft-delete workflows' },
  { key: 'workflow.lookups.read',   module: 'WORKFLOW', action: 'READ',   description: 'View workflow lookup tables' },
  { key: 'workflow.lookups.manage', module: 'WORKFLOW', action: 'MANAGE', description: 'Manage workflow lookup tables (types, statuses, criteria)' },
  // ── Ticket ───────────────────────────────────────────
  { key: 'ticket.read',       module: 'TICKET', action: 'READ',       description: 'View tickets' },
  { key: 'ticket.create',     module: 'TICKET', action: 'CREATE',     description: 'Raise tickets' },
  { key: 'ticket.update',     module: 'TICKET', action: 'UPDATE',     description: 'Edit ticket fields, comments, docs' },
  { key: 'ticket.delete',     module: 'TICKET', action: 'DELETE',     description: 'Soft-delete tickets' },
  { key: 'ticket.transition', module: 'TICKET', action: 'TRANSITION', description: 'Perform stage actions on tickets' },
  // ── Dynamic Forms ────────────────────────────────────
  { key: 'form.read',             module: 'FORM',            action: 'READ',   description: 'View form templates' },
  { key: 'form.create',           module: 'FORM',            action: 'CREATE', description: 'Create form templates' },
  { key: 'form.update',           module: 'FORM',            action: 'UPDATE', description: 'Edit/save form templates' },
  { key: 'form.delete',           module: 'FORM',            action: 'DELETE', description: 'Delete form templates' },
  { key: 'form_type.create',      module: 'FORM_TYPE',       action: 'CREATE', description: 'Create form/checklist types' },
  { key: 'form_type.update',      module: 'FORM_TYPE',       action: 'UPDATE', description: 'Edit form/checklist types' },
  { key: 'form_type.delete',      module: 'FORM_TYPE',       action: 'DELETE', description: 'Delete form/checklist types' },
  { key: 'field_type.create',     module: 'FIELD_TYPE',      action: 'CREATE', description: 'Create custom field types' },
  { key: 'field_type.update',     module: 'FIELD_TYPE',      action: 'UPDATE', description: 'Edit custom field types' },
  { key: 'field_type.delete',     module: 'FIELD_TYPE',      action: 'DELETE', description: 'Delete custom field types' },
  { key: 'form_submission.read',  module: 'FORM_SUBMISSION', action: 'READ',   description: 'View form submissions' },
  { key: 'form_submission.create',module: 'FORM_SUBMISSION', action: 'CREATE', description: 'Submit form responses' },
  { key: 'form_submission.update',module: 'FORM_SUBMISSION', action: 'UPDATE', description: 'Update submission status (approve/reject)' },
  { key: 'form_submission.delete',module: 'FORM_SUBMISSION', action: 'DELETE', description: 'Delete form submissions' },
  // ── Audit (ISO standards & schedules) ────────────────
  { key: 'iso_standard.read',     module: 'ISO_STANDARD',    action: 'READ',   description: 'View ISO standards / audit checklists' },
  { key: 'iso_standard.create',   module: 'ISO_STANDARD',    action: 'CREATE', description: 'Create ISO standards' },
  { key: 'iso_standard.update',   module: 'ISO_STANDARD',    action: 'UPDATE', description: 'Edit ISO standards' },
  { key: 'iso_standard.delete',   module: 'ISO_STANDARD',    action: 'DELETE', description: 'Delete ISO standards' },
  { key: 'audit_schedule.read',   module: 'AUDIT_SCHEDULE',  action: 'READ',   description: 'View audit schedules' },
  { key: 'audit_schedule.create', module: 'AUDIT_SCHEDULE',  action: 'CREATE', description: 'Create audit schedules' },
  { key: 'audit_schedule.update', module: 'AUDIT_SCHEDULE',  action: 'UPDATE', description: 'Edit audit schedules' },
  { key: 'audit_schedule.delete', module: 'AUDIT_SCHEDULE',  action: 'DELETE', description: 'Delete audit schedules' },
  // ── Phase 3 — Approvals ─────────────────────────────
  { key: 'approval.read',          module: 'APPROVAL', action: 'READ',    description: 'View approval instances on tickets' },
  { key: 'approval.decide',        module: 'APPROVAL', action: 'DECIDE',  description: 'Approve or reject a pending approval instance' },
  { key: 'approval.policy.read',   module: 'APPROVAL', action: 'READ',    description: 'View approval policies on workflows' },
  { key: 'approval.policy.create', module: 'APPROVAL', action: 'CREATE',  description: 'Create approval policies' },
  { key: 'approval.policy.update', module: 'APPROVAL', action: 'UPDATE',  description: 'Edit approval policies' },
  { key: 'approval.policy.delete', module: 'APPROVAL', action: 'DELETE',  description: 'Delete approval policies' },
  // ── Phase 3 — SLA ────────────────────────────────────
  { key: 'sla.policy.read',         module: 'SLA', action: 'READ',    description: 'View SLA policies' },
  { key: 'sla.policy.create',       module: 'SLA', action: 'CREATE',  description: 'Create SLA policies' },
  { key: 'sla.policy.update',       module: 'SLA', action: 'UPDATE',  description: 'Edit SLA policies' },
  { key: 'sla.policy.delete',       module: 'SLA', action: 'DELETE',  description: 'Delete SLA policies' },
  { key: 'sla.timer.read',          module: 'SLA', action: 'READ',    description: 'View SLA timers and events' },
  { key: 'sla.timer.extend',        module: 'SLA', action: 'UPDATE',  description: 'Request SLA timer extensions' },
  { key: 'sla.timer.extend.approve',module: 'SLA', action: 'APPROVE', description: 'Approve or reject SLA extension requests' },
  // ── Phase 3 — Business calendars ─────────────────────
  { key: 'business-calendar.read',   module: 'BUSINESS_CALENDAR', action: 'READ',   description: 'View business calendars' },
  { key: 'business-calendar.create', module: 'BUSINESS_CALENDAR', action: 'CREATE', description: 'Create business calendars' },
  { key: 'business-calendar.update', module: 'BUSINESS_CALENDAR', action: 'UPDATE', description: 'Edit business calendars' },
  { key: 'business-calendar.delete', module: 'BUSINESS_CALENDAR', action: 'DELETE', description: 'Delete business calendars' },
];

// 20 built-in field types — seeded so the form builder has a baseline registry.
const FIELD_TYPES = [
  { name: 'text',        label: 'Text',             dataType: 'string'  },
  { name: 'number',      label: 'Number',           dataType: 'number'  },
  { name: 'textarea',    label: 'Long Text',        dataType: 'string'  },
  { name: 'password',    label: 'Password',         dataType: 'string'  },
  { name: 'checkbox',    label: 'Checkbox Group',   dataType: 'json'    },
  { name: 'radio',       label: 'Radio Group',      dataType: 'string'  },
  { name: 'select',      label: 'Dropdown',         dataType: 'string'  },
  { name: 'multi_text',  label: 'Multi Text',       dataType: 'json'    },
  { name: 'date',        label: 'Date',             dataType: 'date'    },
  { name: 'date_range',  label: 'Date Range',       dataType: 'json'    },
  { name: 'time',        label: 'Time',             dataType: 'string'  },
  { name: 'time_range',  label: 'Time Range',       dataType: 'json'    },
  { name: 'file',        label: 'File Upload',      dataType: 'file'    },
  { name: 'image',       label: 'Image Upload',     dataType: 'file'    },
  { name: 'switch',      label: 'Toggle / Switch',  dataType: 'boolean' },
  { name: 'slider',      label: 'Slider',           dataType: 'number'  },
  { name: 'range',       label: 'Number Range',     dataType: 'json'    },
  { name: 'color',       label: 'Color Picker',     dataType: 'string'  },
  { name: 'signature',   label: 'Signature',        dataType: 'string'  },
  { name: 'richtext',    label: 'Rich Text',        dataType: 'string'  },
  { name: 'table',       label: 'Table / Grid',     dataType: 'json'    },
];

const ROLES = [
  {
    name: 'SUPER_ADMIN',
    description: 'Full system access — all admin and QMS permissions',
    isSystem: true,
    permissionKeys: PERMISSIONS.map(p => p.key),
  },
  {
    name: 'QMS_ADMIN',
    description: 'Quality Management System administrator',
    isSystem: true,
    permissionKeys: PERMISSIONS.filter(p =>
      p.module !== 'USER' && p.module !== 'ROLE' || p.action === 'READ'
    ).map(p => p.key),
  },
  {
    name: 'QUALITY_ENGINEER',
    description: 'Day-to-day QMS work: create and edit records, no admin access',
    isSystem: true,
    permissionKeys: [
      'user.read', 'department.read', 'org.read',
      'doc.read', 'doc.write',
      'capa.read', 'capa.write',
      'nc.read', 'nc.write',
      'audit.read',
      'fmea.read', 'fmea.write',
      'risk.read', 'risk.write',
      'supplier.read', 'supplier.write',
      'training.read',
      'inspection.read', 'inspection.write',
      'calibration.read', 'calibration.write',
      'workflow.read', 'workflow.lookups.read',
      'ticket.read', 'ticket.create', 'ticket.update', 'ticket.transition',
      // Phase 3 — approve as participant + read everything + extend timers
      'approval.read', 'approval.decide', 'approval.policy.read',
      'sla.policy.read', 'sla.timer.read', 'sla.timer.extend',
      'business-calendar.read',
    ],
  },
  {
    name: 'AUDITOR',
    description: 'Conducts audits, reads other QMS records',
    isSystem: true,
    permissionKeys: [
      'user.read', 'department.read', 'org.read',
      'doc.read', 'capa.read', 'nc.read',
      'audit.read', 'audit.write', 'audit.approve',
      'fmea.read', 'risk.read', 'supplier.read',
      'training.read', 'inspection.read', 'calibration.read',
      'workflow.read', 'workflow.lookups.read',
      'ticket.read', 'ticket.transition',
      // Phase 3 — read-only on governance primitives
      'approval.read', 'approval.policy.read',
      'sla.policy.read', 'sla.timer.read',
      'business-calendar.read',
    ],
  },
  {
    name: 'DOCUMENT_CONTROLLER',
    description: 'Manages document lifecycle and approvals',
    isSystem: true,
    permissionKeys: [
      'user.read', 'department.read', 'org.read',
      'doc.read', 'doc.write', 'doc.approve',
      'capa.read', 'nc.read', 'audit.read',
      'training.read',
      'workflow.read', 'workflow.lookups.read',
      'ticket.read', 'ticket.transition',
      // Phase 3 — read + decide as approver
      'approval.read', 'approval.decide', 'approval.policy.read',
      'sla.policy.read', 'sla.timer.read',
      'business-calendar.read',
    ],
  },
  {
    name: 'READ_ONLY',
    description: 'View-only access across all modules',
    isSystem: true,
    permissionKeys: PERMISSIONS.filter(p => p.action === 'READ').map(p => p.key),
  },
];

const ORGANIZATION = {
  name: 'Forge Quantum Solutions',
  tenantCode: 'FORGE-QS',
  industry: 'Manufacturing',
  website: 'https://forgequantum.com',
  address: '123 Industrial Zone, Pune, Maharashtra 411001, India',
  standards: ['ISO 9001'],
  timezone: 'Asia/Kolkata',
  dateFormat: 'DD/MM/YYYY',
};

const SITES = [
  { code: 'HQ',  name: 'Headquarters', address: 'Pune, India' },
];

const DEPARTMENTS = [
  { code: 'MGT', name: 'Management',       description: 'Executive & Management' },
  { code: 'QA',  name: 'Quality Assurance',description: 'QA team' },
  { code: 'QC',  name: 'Quality Control',  description: 'QC laboratory' },
  { code: 'MFG', name: 'Manufacturing',    description: 'Production floor' },
  { code: 'ENG', name: 'Engineering',      description: 'R&D and engineering' },
  { code: 'DOC', name: 'Document Control', description: 'Document management' },
];

const SEED_PASSWORD = 'Admin@123';

const USERS = [
  {
    email: 'info@forgequantumsolution.com',
    employeeId: 'EMP-001',
    firstName: 'Forge Quantum',
    lastName: 'Admin',
    designation: 'System Administrator',
    departmentCode: 'MGT',
    roleName: 'SUPER_ADMIN',
  },
  {
    email: 'admin@forgequantum.com',
    employeeId: 'EMP-002',
    firstName: 'Ashish',
    lastName: 'Pandit',
    designation: 'QMS Director',
    departmentCode: 'MGT',
    roleName: 'QMS_ADMIN',
  },
  {
    email: 'qa@forgequantum.com',
    employeeId: 'EMP-003',
    firstName: 'Priya',
    lastName: 'Sharma',
    designation: 'Senior Quality Engineer',
    departmentCode: 'QA',
    roleName: 'QUALITY_ENGINEER',
  },
  {
    email: 'auditor@forgequantum.com',
    employeeId: 'EMP-004',
    firstName: 'Rajesh',
    lastName: 'Kumar',
    designation: 'Internal Auditor',
    departmentCode: 'QA',
    roleName: 'AUDITOR',
  },
  {
    email: 'doc@forgequantum.com',
    employeeId: 'EMP-005',
    firstName: 'Anita',
    lastName: 'Desai',
    designation: 'Document Controller',
    departmentCode: 'DOC',
    roleName: 'DOCUMENT_CONTROLLER',
  },
  {
    email: 'readonly@forgequantum.com',
    employeeId: 'EMP-006',
    firstName: 'Vikram',
    lastName: 'Patel',
    designation: 'External Partner',
    departmentCode: null,
    roleName: 'READ_ONLY',
  },
];

async function main() {
  console.log('🌱  Seeding Permissions...');
  for (const p of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, action: p.action, description: p.description },
      create: p,
    });
  }
  const allPermissions = await prisma.permission.findMany();
  const permByKey = new Map(allPermissions.map(p => [p.key, p.id]));

  console.log('🌱  Seeding Roles...');
  for (const r of ROLES) {
    const permIds = r.permissionKeys
      .map(k => permByKey.get(k))
      .filter((id): id is string => !!id)
      .map(id => ({ id }));
    await prisma.role.upsert({
      where: { name: r.name },
      update: {
        description: r.description,
        isSystem: r.isSystem,
        permissions: { set: permIds },
      },
      create: {
        name: r.name,
        description: r.description,
        isSystem: r.isSystem,
        permissions: { connect: permIds },
      },
    });
  }
  const roleByName = new Map(
    (await prisma.role.findMany()).map(r => [r.name, r.id])
  );

  console.log('🌱  Seeding Sites...');
  for (const s of SITES) {
    await prisma.site.upsert({
      where: { code: s.code },
      update: { name: s.name, address: s.address },
      create: s,
    });
  }
  const siteByCode = new Map(
    (await prisma.site.findMany()).map(s => [s.code, s.id])
  );

  console.log('🌱  Seeding Organization...');
  const existingOrg = await prisma.organization.findFirst();
  if (existingOrg) {
    await prisma.organization.update({
      where: { id: existingOrg.id },
      data: ORGANIZATION,
    });
  } else {
    await prisma.organization.create({ data: ORGANIZATION });
  }

  console.log('🌱  Seeding Departments...');
  for (const d of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { code: d.code },
      update: { name: d.name, description: d.description },
      create: d,
    });
  }
  const deptByCode = new Map(
    (await prisma.department.findMany()).map(d => [d.code, d.id])
  );

  console.log('🌱  Seeding Users...');
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  for (const u of USERS) {
    const departmentId = u.departmentCode ? deptByCode.get(u.departmentCode) ?? null : null;
    const roleId = roleByName.get(u.roleName) ?? null;
    const siteId = siteByCode.get('HQ') ?? null;
    const fullName = `${u.firstName} ${u.lastName}`;

    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        employeeId: u.employeeId,
        firstName: u.firstName,
        lastName: u.lastName,
        name: fullName,
        designation: u.designation,
        departmentId,
        roleId,
        siteId,
        isActive: true,
      },
      create: {
        email: u.email,
        passwordHash,
        employeeId: u.employeeId,
        firstName: u.firstName,
        lastName: u.lastName,
        name: fullName,
        designation: u.designation,
        departmentId,
        roleId,
        siteId,
        isActive: true,
      },
    });
  }

  console.log('🌱  Backfilling department heads...');
  const qaHead = await prisma.user.findUnique({ where: { email: 'qa@forgequantum.com' } });
  const docHead = await prisma.user.findUnique({ where: { email: 'doc@forgequantum.com' } });
  const mgtHead = await prisma.user.findUnique({ where: { email: 'admin@forgequantum.com' } });
  if (qaHead)  await prisma.department.update({ where: { code: 'QA'  }, data: { headUserId: qaHead.id  } });
  if (docHead) await prisma.department.update({ where: { code: 'DOC' }, data: { headUserId: docHead.id } });
  if (mgtHead) await prisma.department.update({ where: { code: 'MGT' }, data: { headUserId: mgtHead.id } });

  console.log('🌱  Seeding Workflow Stage Statuses...');
  for (const s of WORKFLOW_STAGE_STATUSES) {
    await prisma.workflowStageStatus.upsert({
      where: { name: s.name },
      update: { behavior: s.behavior },
      create: s,
    });
  }

  console.log('🌱  Seeding Priorities...');
  for (const name of PRIORITIES) {
    await prisma.priority.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log('🌱  Seeding Action Criteria...');
  for (const name of ACTION_CRITERIA) {
    const existing = await prisma.actionCriteria.findFirst({ where: { name } });
    if (!existing) await prisma.actionCriteria.create({ data: { name } });
  }

  console.log('🌱  Seeding sample Workflow ("Document Review v1")...');
  const docType = await prisma.workflowType.upsert({
    where: { name: 'Document Review' },
    update: {},
    create: {
      name: 'Document Review',
      codePrefix: 'DOC',
      iconConfig: { create: { iconName: 'file-text' } },
    },
  });
  const approveStatus = await prisma.workflowStageStatus.findUnique({
    where: { name: 'Approve / Forward' },
  });
  const rejectStatus = await prisma.workflowStageStatus.findUnique({
    where: { name: 'Reject' },
  });
  const adminUser = await prisma.user.findUnique({
    where: { email: 'info@forgequantumsolution.com' },
  });

  if (approveStatus && rejectStatus) {
    const existingSample = await prisma.workflow.findFirst({
      where: { name: 'Document Review v1', typeId: docType.id, isLatestVersion: true },
    });
    if (!existingSample) {
      await prisma.$transaction(async (tx) => {
        const wf = await tx.workflow.create({
          data: {
            name: 'Document Review v1',
            typeId: docType.id,
            status: 'APPROVED',
            workflowStatus: 'ACTIVE',
            createdById: adminUser?.id ?? null,
          },
        });
        const submit = await tx.workflowStage.create({
          data: {
            workflowId: wf.id,
            name: 'Submit',
            canonicalId: 'sample-submit',
            isInitialStage: true,
            position: { x: 50, y: 100 },
            stageType: 'STAGE',
          },
        });
        const review = await tx.workflowStage.create({
          data: {
            workflowId: wf.id,
            name: 'Review',
            canonicalId: 'sample-review',
            position: { x: 300, y: 100 },
            stageType: 'STAGE',
          },
        });
        const approve = await tx.workflowStage.create({
          data: {
            workflowId: wf.id,
            name: 'Approve',
            canonicalId: 'sample-approve',
            position: { x: 550, y: 100 },
            stageType: 'STAGE',
          },
        });
        await tx.workflowStageAction.create({
          data: { workflowStageId: submit.id, workflowActionId: approveStatus.id, isPrimary: true },
        });
        await tx.workflowStageAction.create({
          data: { workflowStageId: review.id, workflowActionId: approveStatus.id, isPrimary: true },
        });
        await tx.workflowStageAction.create({
          data: { workflowStageId: review.id, workflowActionId: rejectStatus.id, isPrimary: false },
        });
        await tx.workflowStageAction.create({
          data: { workflowStageId: approve.id, workflowActionId: approveStatus.id, isPrimary: true },
        });
        await tx.workflowTransition.create({
          data: { workflowId: wf.id, fromStageId: submit.id, toStageId: review.id, branchOrder: 0 },
        });
        await tx.workflowTransition.create({
          data: { workflowId: wf.id, fromStageId: review.id, toStageId: approve.id, branchOrder: 0 },
        });
      }, { timeout: 30_000, maxWait: 5_000 });
    }
  }

  // ─── Phase 3 — Business calendars ────────────────────────────────────
  // 5-day Mon-Fri 09:00-18:00 schedule, no holidays. Used as the default for
  // every SlaPolicy that doesn't explicitly choose another calendar.
  const default24x7 = await prisma.businessCalendar.upsert({
    where: { name: 'default-24x7' },
    update: {},
    create: {
      name: 'default-24x7',
      timezone: 'Asia/Kolkata',
      weeklySchedule: {
        mon: { start: '09:00', end: '18:00' },
        tue: { start: '09:00', end: '18:00' },
        wed: { start: '09:00', end: '18:00' },
        thu: { start: '09:00', end: '18:00' },
        fri: { start: '09:00', end: '18:00' },
        sat: null,
        sun: null,
      },
      holidays: [],
    },
  });
  await prisma.businessCalendar.upsert({
    where: { name: 'support-24x7' },
    update: {},
    create: {
      name: 'support-24x7',
      timezone: 'Asia/Kolkata',
      weeklySchedule: {
        mon: { start: '00:00', end: '24:00' },
        tue: { start: '00:00', end: '24:00' },
        wed: { start: '00:00', end: '24:00' },
        thu: { start: '00:00', end: '24:00' },
        fri: { start: '00:00', end: '24:00' },
        sat: { start: '00:00', end: '24:00' },
        sun: { start: '00:00', end: '24:00' },
      },
      holidays: [],
    },
  });

  // ─── Phase 3 — Sample SLA + approval policy on Document Review ───────
  // Wires the seeded "Document Review v1" workflow with realistic governance
  // so the FE has data to render: 4-hour SLA on Submit (75% threshold), and
  // a 2-of-2 QE approval requirement on Review's Approve / Forward action.
  const sampleWorkflow = await prisma.workflow.findFirst({
    where: { name: 'Document Review v1', typeId: docType.id, isLatestVersion: true },
  });
  const qeRole = await prisma.role.findUnique({ where: { name: 'QUALITY_ENGINEER' } });

  if (sampleWorkflow && qeRole) {
    const submitStage = await prisma.workflowStage.findFirst({
      where: { workflowId: sampleWorkflow.id, canonicalId: 'sample-submit' },
    });
    const reviewStage = await prisma.workflowStage.findFirst({
      where: { workflowId: sampleWorkflow.id, canonicalId: 'sample-review' },
    });

    if (submitStage) {
      const existingSla = await prisma.slaPolicy.findUnique({
        where: { parentStageId: submitStage.id },
      });
      if (!existingSla) {
        const slaPolicy = await prisma.slaPolicy.create({
          data: {
            parentStageId: submitStage.id,
            duration: 4 * 60 * 60, // 4 hours in seconds
            calendarId: default24x7.id,
            pauseOnHold: true,
            responsibleRoles: { connect: [{ id: qeRole.id }] },
          },
        });
        await prisma.slaThreshold.create({
          data: {
            policyId: slaPolicy.id,
            percentage: 75,
            notifyRoles: { connect: [{ id: qeRole.id }] },
          },
        });
      }
    }

    if (reviewStage && approveStatus) {
      const reviewApproveAction = await prisma.workflowStageAction.findFirst({
        where: {
          workflowStageId: reviewStage.id,
          workflowActionId: approveStatus.id,
          isPrimary: true,
        },
      });
      if (reviewApproveAction) {
        const existingApproval = await prisma.approvalPolicy.findUnique({
          where: {
            stageId_actionId: {
              stageId: reviewStage.id,
              actionId: reviewApproveAction.id,
            },
          },
        });
        if (!existingApproval) {
          await prisma.approvalPolicy.create({
            data: {
              workflowId: sampleWorkflow.id,
              stageId: reviewStage.id,
              actionId: reviewApproveAction.id,
              mode: 'ALL_REQUIRED',
              requiredCount: 2,
              allowSelfApproval: false,
              approvalSlaHours: 24,
              approverRoles: { connect: [{ id: qeRole.id }] },
            },
          });
        }
      }
    }
  }

  console.log('\n✅  Seed complete');
  console.log(`    permissions:  ${PERMISSIONS.length}`);
  console.log(`    roles:        ${ROLES.length}`);
  console.log(`    sites:        ${SITES.length}`);
  console.log(`    departments:  ${DEPARTMENTS.length}`);
  console.log(`    users:        ${USERS.length}`);
  console.log(`    organization: ${ORGANIZATION.name}`);
  console.log(`    wf statuses:  ${WORKFLOW_STAGE_STATUSES.length}`);
  console.log(`    priorities:   ${PRIORITIES.length}`);
  console.log(`    criteria:     ${ACTION_CRITERIA.length}`);

  console.log('🌱  Seeding built-in Field Types...');
  for (const ft of FIELD_TYPES) {
    await prisma.fieldType.upsert({
      where: { name: ft.name },
      update: { label: ft.label, dataType: ft.dataType, isSystem: true, isActive: true },
      create: { name: ft.name, label: ft.label, dataType: ft.dataType, isSystem: true, isActive: true },
    });
  }
  console.log(`    field types:  ${FIELD_TYPES.length}`);
  console.log(`    calendars:    2 (default-24x7, support-24x7)`);
  console.log(`    sample SLA + approval policy on Document Review v1`);
  console.log(`\n    All seeded users login with password:  ${SEED_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
