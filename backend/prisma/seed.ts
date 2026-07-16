import { Prisma, PrismaClient, StageActionBehavior } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { PERMISSIONS } from '../src/lib/rbac-catalog';

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

// Severity — impact classification pick-list (distinct from Priority). Higher
// `level` = more severe (used for sorting); colours drive the UI badges.
const SEVERITIES: { name: string; level: number; color: string }[] = [
  { name: 'Critical', level: 30, color: '#DC2626' },
  { name: 'Major', level: 20, color: '#D97706' },
  { name: 'Minor', level: 10, color: '#2563EB' },
  { name: 'Observation', level: 0, color: '#64748B' },
];

const ACTION_CRITERIA = ['Anyone'];


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
  { name: 'compliance',  label: 'Compliance Result', dataType: 'string' },
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
    // Full ticket access (all 5 verbs, across all workflow types) is granted
    // post-seed by ensureSystemRoleTicketGrants() — the `TICKET` module has no
    // catalog rows anymore for this filter to pick up (see
    // lib/rbac-system-role-tickets.ts).
    permissionKeys: PERMISSIONS.filter(p =>
      p.module !== 'USER' && p.module !== 'ROLE' || p.action === 'READ'
    ).map(p => p.key),
  },
  {
    name: 'QUALITY_ENGINEER',
    description: 'Day-to-day QMS work: create and edit records, no admin access',
    isSystem: true,
    permissionKeys: [
      'user.read', 'department.read', 'org.read', 'site.read',
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
      // Ticket access (read/create/update/transition, across all workflow
      // types) is granted post-seed by ensureSystemRoleTicketGrants() in
      // lib/rbac-system-role-tickets.ts — the global `ticket.*` master this
      // used to reference was retired (docs/per-module-ticket-master-plan.md).
      // Phase 3 — approve as participant + read everything + extend timers
      'approval.read', 'approval.decide', 'approval.policy.read',
      'sla.policy.read', 'sla.timer.read', 'sla.timer.extend',
      'business-calendar.read',
      // Phase 3.5 — see and fill workflow-bound forms
      'stage-form.read',
      'form.read', 'form_submission.read', 'form_submission.create',
    ],
  },
  {
    name: 'AUDITOR',
    description: 'Conducts audits, reads other QMS records',
    isSystem: true,
    permissionKeys: [
      'user.read', 'department.read', 'org.read', 'site.read',
      'doc.read', 'capa.read', 'nc.read',
      'audit.read', 'audit.write', 'audit.approve',
      // Audit module (new `audit_*` catalog). AUDITORs run audits AND are the
      // intended approvers, so they hold `audit_register.approve`; combined with
      // the named-approver enforcement in audit-register.service.ts this lets an
      // auditor named on a register approve it (and only that register).
      'audit_register.read', 'audit_register.create', 'audit_register.update', 'audit_register.approve',
      'audit_master.read', 'audit_master.create', 'audit_master.update',
      'audit_program.read', 'audit_program.execute',
      'audit_finding.read', 'audit_finding.create', 'audit_finding.update',
      'audit_schedule.read', 'audit_schedule.create', 'audit_schedule.update',
      'audit_type.read', 'audit_type.create', 'audit_type.update',
      'non_conformance.read', 'non_conformance.create',
      'fmea.read', 'risk.read', 'supplier.read',
      'training.read', 'inspection.read', 'calibration.read',
      'workflow.read', 'workflow.lookups.read',
      // Ticket access (read/transition, across all workflow types) is granted
      // post-seed by ensureSystemRoleTicketGrants() — see QUALITY_ENGINEER above.
      // Phase 3 — read-only on governance primitives
      'approval.read', 'approval.policy.read',
      'sla.policy.read', 'sla.timer.read',
      'business-calendar.read',
      // Phase 3.5 — read-only on bindings + submissions
      'stage-form.read', 'form.read', 'form_submission.read',
    ],
  },
  {
    name: 'DOCUMENT_CONTROLLER',
    description: 'Manages document lifecycle and approvals',
    isSystem: true,
    permissionKeys: [
      'user.read', 'department.read', 'org.read', 'site.read',
      'doc.read', 'doc.write', 'doc.approve',
      'capa.read', 'nc.read', 'audit.read',
      'training.read',
      'workflow.read', 'workflow.lookups.read',
      // Ticket access (read/transition, across all workflow types) is granted
      // post-seed by ensureSystemRoleTicketGrants() — see QUALITY_ENGINEER above.
      // Phase 3 — read + decide as approver
      'approval.read', 'approval.decide', 'approval.policy.read',
      'sla.policy.read', 'sla.timer.read',
      'business-calendar.read',
      // Phase 3.5 — read + fill workflow-bound forms
      'stage-form.read',
      'form.read', 'form_submission.read', 'form_submission.create',
    ],
  },
  {
    name: 'READ_ONLY',
    description: 'View-only access across all modules',
    isSystem: true,
    // Ticket read (across all workflow types) is granted post-seed by
    // ensureSystemRoleTicketGrants() — see QMS_ADMIN above.
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
    // LIMS — dedicated reviewer so the second-person data review (analyst ≠ reviewer)
    // can be demonstrated end-to-end.
    email: 'reviewer@forgequantum.com',
    employeeId: 'EMP-007',
    firstName: 'Meera',
    lastName: 'Nair',
    designation: 'QC Reviewer',
    departmentCode: 'QC',
    roleName: 'QUALITY_ENGINEER',
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

  console.log('🌱  Seeding Severities...');
  for (const s of SEVERITIES) {
    await prisma.severity.upsert({
      where: { name: s.name },
      update: { level: s.level, color: s.color, isDeleted: false },
      create: { name: s.name, level: s.level, color: s.color },
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
        // Layout is computed client-side by dagre at render time — no
        // position stored on the WorkflowStage row anymore.
        const submit = await tx.workflowStage.create({
          data: {
            workflowId: wf.id,
            name: 'Submit',
            canonicalId: 'sample-submit',
            isInitialStage: true,
            stageType: 'STAGE',
          },
        });
        const review = await tx.workflowStage.create({
          data: {
            workflowId: wf.id,
            name: 'Review',
            canonicalId: 'sample-review',
            stageType: 'STAGE',
          },
        });
        const approve = await tx.workflowStage.create({
          data: {
            workflowId: wf.id,
            name: 'Approve',
            canonicalId: 'sample-approve',
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
            // `name` was added in the Django-alignment revision — required, unique
            // per policy. Use a stable label so re-runs are idempotent.
            name: 'warning',
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

  // ── Phase 3.5 — sample workflow-bound forms ─────────────────────────────
  // Two forms with stage bindings on the seeded Document Review v1 workflow:
  //   1. "Submission Confirmation" — OPTIONAL binding on Submit (lets users
  //      acknowledge but doesn't block transitions).
  //   2. "Document Review Checklist" — REQUIRED binding on Review (blocks
  //      the Approve transition until submitted).
  // Idempotent via Form.templateKey + StageFormBinding.@@unique([stage, form]).
  console.log('🌱  Seeding workflow-bound sample forms...');
  const wfForForms = await prisma.workflow.findFirst({
    where: { name: 'Document Review v1' },
  });
  if (wfForForms) {
    const submitStageForForms = await prisma.workflowStage.findFirst({
      where: { workflowId: wfForForms.id, canonicalId: 'sample-submit' },
    });
    const reviewStageForForms = await prisma.workflowStage.findFirst({
      where: { workflowId: wfForForms.id, canonicalId: 'sample-review' },
    });
    const textType = await prisma.fieldType.findUnique({ where: { name: 'text' } });
    const textareaType = await prisma.fieldType.findUnique({
      where: { name: 'textarea' },
    });
    const checkboxType = await prisma.fieldType.findUnique({
      where: { name: 'checkbox' },
    });
    const switchType = await prisma.fieldType.findUnique({
      where: { name: 'switch' },
    });

    const upsertForm = async (
      templateKey: string,
      title: string,
      description: string,
      sectionsSpec: Array<{
        sectionId: string;
        name: string;
        fields: Array<{
          fieldId: string;
          name: string;
          label: string;
          typeId: string | null;
          typeName: string;
          required?: boolean;
          width?: string;
          options?: Array<{ label: string; value: string }>;
        }>;
      }>,
    ) => {
      const existing = await prisma.form.findFirst({
        where: { templateKey, version: 1 },
        select: { id: true },
      });
      if (existing) return existing.id;

      const form = await prisma.form.create({
        data: {
          templateKey,
          title,
          description,
          version: 1,
          versionId: `${templateKey}-v1`,
          status: 'PUBLISHED',
        },
        select: { id: true },
      });
      for (const sec of sectionsSpec) {
        const section = await prisma.formSection.create({
          data: {
            formId: form.id,
            sectionId: sec.sectionId,
            name: sec.name,
            position: 0,
          },
          select: { id: true },
        });
        for (const [fieldIdx, f] of sec.fields.entries()) {
          await prisma.formField.create({
            data: {
              sectionId: section.id,
              fieldId: f.fieldId,
              name: f.name,
              label: f.label,
              position: fieldIdx,
              width: f.width ?? '100',
              required: f.required ?? false,
              typeId: f.typeId,
              typeName: f.typeName,
              options: f.options ? (f.options as unknown as Prisma.InputJsonValue) : undefined,
            },
          });
        }
      }
      return form.id;
    };

    const submissionFormId = await upsertForm(
      'submission-confirmation',
      'Submission Confirmation',
      'Optional confirmation form filled when submitting the document.',
      [
        {
          sectionId: 'sec-meta',
          name: 'Submission details',
          fields: [
            {
              fieldId: 'fld-doctitle',
              name: 'documentTitle',
              label: 'Document title',
              typeId: textType?.id ?? null,
              typeName: 'text',
              required: true,
            },
            {
              fieldId: 'fld-summary',
              name: 'changeSummary',
              label: 'What changed?',
              typeId: textareaType?.id ?? null,
              typeName: 'textarea',
            },
            {
              fieldId: 'fld-major',
              name: 'isMajor',
              label: 'Major revision?',
              typeId: switchType?.id ?? null,
              typeName: 'switch',
              width: '50',
            },
          ],
        },
      ],
    );

    const reviewFormId = await upsertForm(
      'document-review-checklist',
      'Document Review Checklist',
      'Mandatory checklist filled by the reviewer before forwarding to Approve.',
      [
        {
          sectionId: 'sec-checks',
          name: 'Reviewer checks',
          fields: [
            {
              fieldId: 'fld-reviewer',
              name: 'reviewerName',
              label: 'Reviewer name',
              typeId: textType?.id ?? null,
              typeName: 'text',
              required: true,
              width: '50',
            },
            {
              fieldId: 'fld-checks',
              name: 'completedChecks',
              label: 'Completed checks',
              typeId: checkboxType?.id ?? null,
              typeName: 'checkbox',
              required: true,
              options: [
                { label: 'Document follows the template', value: 'template' },
                { label: 'Sources cited', value: 'sources' },
                { label: 'Spelling and grammar pass', value: 'spelling' },
                { label: 'Diagrams legible', value: 'diagrams' },
              ],
            },
            {
              fieldId: 'fld-notes',
              name: 'reviewerNotes',
              label: 'Notes for the approver',
              typeId: textareaType?.id ?? null,
              typeName: 'textarea',
            },
          ],
        },
      ],
    );

    // Per-form access control. Each binding restricts who may FILL and who may
    // VIEW the form:
    //   fillMode ANYONE → one shared copy, any member of the fill group fills it.
    //   fillMode EACH    → one copy per fill-group member; the stage stays
    //                      blocked until everyone has submitted their own copy.
    // An empty fill group is treated as "legacy open" (everyone may fill/view)
    // by the engine, so we seed explicit groups here to exercise the flow.
    type BindingAccess = {
      fillMode?: 'ANYONE' | 'EACH';
      fillRoles?: string[]; // role names → resolved via roleByName
      fillUsers?: string[]; // user emails (User.email is unique)
      viewRoles?: string[];
      viewUsers?: string[];
    };
    const roleConnect = (names: string[] = []) =>
      names
        .map((n) => roleByName.get(n))
        .filter((id): id is string => Boolean(id))
        .map((id) => ({ id }));
    const userConnect = (emails: string[] = []) => emails.map((email) => ({ email }));

    // Bind forms to their stages. Use upsert-style behavior so a re-seed
    // un-deletes soft-deleted bindings left over from test runs (the
    // @@unique([stage, form]) constraint covers both isDeleted=true and =false
    // rows, so plain `create` would conflict). Access groups are refreshed on
    // every re-seed via `set` so the binding always reflects the seeded policy.
    const upsertBinding = async (
      stageId: string,
      formId: string,
      isRequired: boolean,
      access: BindingAccess = {},
    ) => {
      const fillMode = access.fillMode ?? 'ANYONE';
      const fillRoles = roleConnect(access.fillRoles);
      const fillUsers = userConnect(access.fillUsers);
      const viewRoles = roleConnect(access.viewRoles);
      const viewUsers = userConnect(access.viewUsers);

      const existing = await prisma.stageFormBinding.findUnique({
        where: { stageId_formId: { stageId, formId } },
        select: { id: true },
      });
      if (!existing) {
        await prisma.stageFormBinding.create({
          data: {
            workflowId: wfForForms.id,
            stageId,
            formId,
            isRequired,
            position: 0,
            fillMode,
            allowedFillRoles: { connect: fillRoles },
            allowedFillUsers: { connect: fillUsers },
            allowedViewRoles: { connect: viewRoles },
            allowedViewUsers: { connect: viewUsers },
          },
        });
      } else {
        await prisma.stageFormBinding.update({
          where: { id: existing.id },
          data: {
            isDeleted: false,
            isActive: true,
            isRequired,
            fillMode,
            allowedFillRoles: { set: fillRoles },
            allowedFillUsers: { set: fillUsers },
            allowedViewRoles: { set: viewRoles },
            allowedViewUsers: { set: viewUsers },
          },
        });
      }
    };

    if (submitStageForForms) {
      // Submission Confirmation — filled by the document controller who submits;
      // visible to QA/management/audit for context. Optional (doesn't block).
      await upsertBinding(submitStageForForms.id, submissionFormId, false, {
        fillMode: 'ANYONE',
        fillRoles: ['DOCUMENT_CONTROLLER'],
        viewRoles: ['QMS_ADMIN', 'QUALITY_ENGINEER', 'AUDITOR'],
      });
    }
    if (reviewStageForForms) {
      // Document Review Checklist — filled by the reviewing quality engineer;
      // visible to management/doc-control/audit. Required (blocks the Approve
      // transition until submitted).
      await upsertBinding(reviewStageForForms.id, reviewFormId, true, {
        fillMode: 'ANYONE',
        fillRoles: ['QUALITY_ENGINEER'],
        viewRoles: ['QMS_ADMIN', 'DOCUMENT_CONTROLLER', 'AUDITOR'],
      });
    }
    console.log(`    sample forms: 2 (Submission Confirmation, Document Review Checklist)`);
    console.log(`    sample bindings: Submit (optional, fill=DocControl) + Review (required, fill=QE)`);
  }

  // ── Phase 3.6 — dependency-rule fixture (e2e: verify-dep-rule[-ticket]) ──
  // A CAPA-style RCA form whose "5 Why Analysis" field is shown only when
  // "Root Cause Analysis Required" = Yes (field-level dependency rule).
  // Seeded with a FIXED id because the standalone fill spec navigates to it
  // directly (/forms/<id>/fill); the RCA workflow below binds it to an initial
  // stage so a raised ticket renders it inline (the ticket spec path).
  console.log('🌱  Seeding dependency-rule fixture (RCA 5-Whys form + workflow)...');
  const RCA_FORM_ID = 'c318dadd-7375-4606-9c99-d3cb2cd719a3';
  const selectTypeF = await prisma.fieldType.findUnique({ where: { name: 'select' } });
  const textareaTypeF = await prisma.fieldType.findUnique({ where: { name: 'textarea' } });

  const existingRcaForm = await prisma.form.findUnique({ where: { id: RCA_FORM_ID }, select: { id: true } });
  if (!existingRcaForm) {
    const rcaForm = await prisma.form.create({
      data: {
        id: RCA_FORM_ID,
        templateKey: 'rca-5whys',
        title: 'Root Cause Analysis',
        description: 'CAPA RCA form — the analysis table is revealed only when root cause analysis is required.',
        version: 1,
        versionId: 'rca-5whys-v1',
        status: 'PUBLISHED',
      },
      select: { id: true },
    });
    const sec = await prisma.formSection.create({
      data: { formId: rcaForm.id, sectionId: 'sec-rca', name: 'Root Cause Analysis', position: 0 },
      select: { id: true },
    });
    // Controlling dropdown — Yes/No.
    await prisma.formField.create({
      data: {
        sectionId: sec.id,
        fieldId: 'fld-rca-required',
        name: 'rootCauseRequired',
        label: 'Root Cause Analysis Required',
        position: 0,
        width: '50',
        required: true,
        typeId: selectTypeF?.id ?? null,
        typeName: 'select',
        options: [{ label: 'Yes', value: 'Yes' }, { label: 'No', value: 'No' }] as unknown as Prisma.InputJsonValue,
      },
    });
    // Dependent 5-Why table — shown only when the dropdown above equals "Yes".
    await prisma.formField.create({
      data: {
        sectionId: sec.id,
        fieldId: 'fld-5why',
        name: 'fiveWhyAnalysis',
        label: '5 Why Analysis',
        position: 1,
        width: '100',
        required: false,
        typeId: textareaTypeF?.id ?? null,
        typeName: 'textarea',
        dependency: {
          enabled: true,
          mode: 'show',
          combinator: 'and',
          conditions: [
            { sectionName: 'Root Cause Analysis', fieldName: 'rootCauseRequired', operator: 'equals', value: 'Yes' },
          ],
        } as unknown as Prisma.InputJsonValue,
      },
    });
  }

  // RCA workflow whose INITIAL stage carries the fixture form, so a freshly
  // raised ticket sits on it and renders the form inline. Idempotent by name.
  if (approveStatus) {
    const existingRcaWf = await prisma.workflow.findFirst({ where: { name: 'Root Cause Analysis Demo v1' } });
    if (!existingRcaWf) {
      await prisma.$transaction(async (tx) => {
        const wf = await tx.workflow.create({
          data: {
            name: 'Root Cause Analysis Demo v1',
            typeId: docType.id,
            status: 'APPROVED',
            workflowStatus: 'ACTIVE',
            createdById: adminUser?.id ?? null,
          },
        });
        const rca = await tx.workflowStage.create({
          data: { workflowId: wf.id, name: 'Root Cause Analysis', canonicalId: 'rca-analyse', isInitialStage: true, stageType: 'STAGE' },
        });
        const done = await tx.workflowStage.create({
          data: { workflowId: wf.id, name: 'Done', canonicalId: 'rca-done', stageType: 'STAGE' },
        });
        await tx.workflowStageAction.create({ data: { workflowStageId: rca.id, workflowActionId: approveStatus.id, isPrimary: true } });
        await tx.workflowStageAction.create({ data: { workflowStageId: done.id, workflowActionId: approveStatus.id, isPrimary: true } });
        await tx.workflowTransition.create({ data: { workflowId: wf.id, fromStageId: rca.id, toStageId: done.id, branchOrder: 0 } });
        // Legacy-open binding (no fill/view groups) so any user can fill it.
        await tx.stageFormBinding.create({
          data: { workflowId: wf.id, stageId: rca.id, formId: RCA_FORM_ID, isRequired: false, position: 0, fillMode: 'ANYONE' },
        });
      }, { timeout: 30_000, maxWait: 5_000 });
    }
  }
  console.log('    fixture: RCA form (c318dadd…) + "Root Cause Analysis Demo v1" workflow');

  // ── CAPA workflow with proper per-stage forms ──────────────────────────
  // A full corrective/preventive-action lifecycle, driven as a workflow ticket
  // (mirrors the AuditRegister pattern: a first-class record spawns a workflow
  // ticket and surfaces its stage progress). Six linear stages, each with a
  // REQUIRED form bound so the stage blocks until it's filled. Stage
  // canonicalIds line up with the CapaStatus enum (OPEN → INVESTIGATION → PLAN
  // → IMPLEMENTATION → VERIFICATION → CLOSED) so a later stage→status sync is a
  // straight map. Idempotent by workflow name + form templateKey.
  console.log('🌱  Seeding CAPA workflow + per-stage forms...');
  const capaType = await prisma.workflowType.upsert({
    where: { name: 'CAPA' },
    update: {},
    create: {
      name: 'CAPA',
      codePrefix: 'CAPA',
      iconConfig: { create: { iconName: 'shield-check' } },
    },
  });

  const returnStatus = await prisma.workflowStageStatus.findUnique({ where: { name: 'Return' } });
  const FT_TEXT = (await prisma.fieldType.findUnique({ where: { name: 'text' } }))?.id ?? null;
  const FT_TEXTAREA = (await prisma.fieldType.findUnique({ where: { name: 'textarea' } }))?.id ?? null;
  const FT_SELECT = (await prisma.fieldType.findUnique({ where: { name: 'select' } }))?.id ?? null;
  const FT_DATE = (await prisma.fieldType.findUnique({ where: { name: 'date' } }))?.id ?? null;
  const FT_SWITCH = (await prisma.fieldType.findUnique({ where: { name: 'switch' } }))?.id ?? null;

  type CapaFieldSpec = {
    fieldId: string;
    name: string;
    label: string;
    typeId: string | null;
    typeName: string;
    required?: boolean;
    width?: string;
    options?: Array<{ label: string; value: string }>;
  };

  // Idempotent by templateKey — returns the existing form id on re-seed.
  const upsertCapaForm = async (
    templateKey: string,
    title: string,
    description: string,
    sectionName: string,
    fields: CapaFieldSpec[],
  ): Promise<string> => {
    const existing = await prisma.form.findFirst({
      where: { templateKey, version: 1 },
      select: { id: true },
    });
    if (existing) return existing.id;
    const form = await prisma.form.create({
      data: {
        templateKey,
        title,
        description,
        version: 1,
        versionId: `${templateKey}-v1`,
        status: 'PUBLISHED',
        kind: 'FORM',
        workflowType: 'CAPA',
      },
      select: { id: true },
    });
    const section = await prisma.formSection.create({
      data: { formId: form.id, sectionId: `sec-${templateKey}`, name: sectionName, position: 0 },
      select: { id: true },
    });
    for (const [i, f] of fields.entries()) {
      await prisma.formField.create({
        data: {
          sectionId: section.id,
          fieldId: f.fieldId,
          name: f.name,
          label: f.label,
          position: i,
          width: f.width ?? '100',
          required: f.required ?? false,
          typeId: f.typeId,
          typeName: f.typeName,
          options: f.options ? (f.options as unknown as Prisma.InputJsonValue) : undefined,
        },
      });
    }
    return form.id;
  };

  const sel = (opts: string[]) => opts.map((o) => ({ label: o, value: o }));

  const capaInitiationFormId = await upsertCapaForm(
    'capa-initiation',
    'CAPA Initiation',
    'Problem statement and classification captured when the CAPA is raised.',
    'Initiation',
    [
      { fieldId: 'f-problem', name: 'problemStatement', label: 'Problem statement', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-source', name: 'source', label: 'Source', typeId: FT_SELECT, typeName: 'select', required: true, width: '50', options: sel(['Non-Conformance', 'Audit Finding', 'Customer Complaint', 'Deviation', 'OOS', 'Internal']) },
      { fieldId: 'f-type', name: 'capaType', label: 'CAPA type', typeId: FT_SELECT, typeName: 'select', required: true, width: '50', options: sel(['Corrective', 'Preventive', 'Both']) },
      { fieldId: 'f-severity', name: 'severity', label: 'Severity', typeId: FT_SELECT, typeName: 'select', required: true, width: '50', options: sel(['Critical', 'Major', 'Minor']) },
      { fieldId: 'f-process', name: 'affectedProcess', label: 'Affected product / process', typeId: FT_TEXT, typeName: 'text', width: '50' },
      { fieldId: 'f-detected', name: 'dateDetected', label: 'Date detected', typeId: FT_DATE, typeName: 'date', width: '50' },
    ],
  );

  const capaRcaFormId = await upsertCapaForm(
    'capa-rca',
    'Root Cause Analysis',
    'Investigation and 5-Why analysis leading to a confirmed root cause.',
    'Investigation & Root Cause',
    [
      { fieldId: 'f-invsum', name: 'investigationSummary', label: 'Investigation summary', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-why1', name: 'why1', label: 'Why 1', typeId: FT_TEXT, typeName: 'text' },
      { fieldId: 'f-why2', name: 'why2', label: 'Why 2', typeId: FT_TEXT, typeName: 'text' },
      { fieldId: 'f-why3', name: 'why3', label: 'Why 3', typeId: FT_TEXT, typeName: 'text' },
      { fieldId: 'f-why4', name: 'why4', label: 'Why 4', typeId: FT_TEXT, typeName: 'text' },
      { fieldId: 'f-why5', name: 'why5', label: 'Why 5', typeId: FT_TEXT, typeName: 'text' },
      { fieldId: 'f-category', name: 'rootCauseCategory', label: 'Root cause category', typeId: FT_SELECT, typeName: 'select', required: true, width: '50', options: sel(['Man', 'Machine', 'Material', 'Method', 'Measurement', 'Environment']) },
      { fieldId: 'f-rootcause', name: 'confirmedRootCause', label: 'Confirmed root cause', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
    ],
  );

  const capaPlanFormId = await upsertCapaForm(
    'capa-action-plan',
    'CAPA Action Plan',
    'Corrective and preventive actions with owners and target dates.',
    'Action Plan',
    [
      { fieldId: 'f-corrective', name: 'correctiveActions', label: 'Corrective actions', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-preventive', name: 'preventiveActions', label: 'Preventive actions', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-responsible', name: 'responsiblePerson', label: 'Responsible person', typeId: FT_TEXT, typeName: 'text', width: '50' },
      { fieldId: 'f-target', name: 'targetDate', label: 'Target completion date', typeId: FT_DATE, typeName: 'date', required: true, width: '50' },
      { fieldId: 'f-risk', name: 'riskIfNotDone', label: 'Risk if not implemented', typeId: FT_SELECT, typeName: 'select', width: '50', options: sel(['High', 'Medium', 'Low']) },
    ],
  );

  const capaImplFormId = await upsertCapaForm(
    'capa-implementation',
    'Implementation Record',
    'Record of actions completed and the objective evidence.',
    'Implementation',
    [
      { fieldId: 'f-done', name: 'actionsCompleted', label: 'Actions completed', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-evidence', name: 'evidence', label: 'Evidence / references', typeId: FT_TEXTAREA, typeName: 'textarea' },
      { fieldId: 'f-actual', name: 'actualCompletionDate', label: 'Actual completion date', typeId: FT_DATE, typeName: 'date', required: true, width: '50' },
      { fieldId: 'f-deviation', name: 'deviationsFromPlan', label: 'Deviations from plan', typeId: FT_TEXTAREA, typeName: 'textarea' },
    ],
  );

  const capaEffFormId = await upsertCapaForm(
    'capa-effectiveness',
    'Effectiveness Verification',
    'Verification that the root cause was eliminated over the 30/60/90-day window.',
    'Effectiveness Verification',
    [
      { fieldId: 'f-method', name: 'verificationMethod', label: 'Verification method', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-c30', name: 'check30', label: '30-day check', typeId: FT_SELECT, typeName: 'select', width: '33', options: sel(['Pending', 'Pass', 'Fail']) },
      { fieldId: 'f-c60', name: 'check60', label: '60-day check', typeId: FT_SELECT, typeName: 'select', width: '33', options: sel(['Pending', 'Pass', 'Fail']) },
      { fieldId: 'f-c90', name: 'check90', label: '90-day check', typeId: FT_SELECT, typeName: 'select', width: '33', options: sel(['Pending', 'Pass', 'Fail']) },
      { fieldId: 'f-conclusion', name: 'effectivenessConclusion', label: 'Effectiveness conclusion', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
    ],
  );

  const capaClosureFormId = await upsertCapaForm(
    'capa-closure',
    'CAPA Closure',
    'Final QA sign-off and closure of the CAPA.',
    'Closure',
    [
      { fieldId: 'f-summary', name: 'closureSummary', label: 'Closure summary', typeId: FT_TEXTAREA, typeName: 'textarea', required: true },
      { fieldId: 'f-residual', name: 'residualRiskAcceptable', label: 'Residual risk acceptable?', typeId: FT_SWITCH, typeName: 'switch', width: '50' },
      { fieldId: 'f-approver', name: 'qaApprover', label: 'QA approver', typeId: FT_TEXT, typeName: 'text', required: true, width: '50' },
      { fieldId: 'f-closuredate', name: 'closureDate', label: 'Closure date', typeId: FT_DATE, typeName: 'date', required: true, width: '50' },
    ],
  );

  if (approveStatus) {
    const existingCapaWf = await prisma.workflow.findFirst({ where: { name: 'CAPA Handling v1' } });
    if (!existingCapaWf) {
      const roleConnectC = (names: string[] = []) =>
        names
          .map((n) => roleByName.get(n))
          .filter((id): id is string => Boolean(id))
          .map((id) => ({ id }));
      await prisma.$transaction(
        async (tx) => {
          const wf = await tx.workflow.create({
            data: {
              name: 'CAPA Handling v1',
              typeId: capaType.id,
              status: 'APPROVED',
              workflowStatus: 'ACTIVE',
              createdById: adminUser?.id ?? null,
            },
          });

          const mkStage = (name: string, canonicalId: string, isInitialStage = false) =>
            tx.workflowStage.create({
              data: { workflowId: wf.id, name, canonicalId, isInitialStage, stageType: 'STAGE' },
            });

          const initiation = await mkStage('Initiation', 'capa-initiation', true);
          const investigation = await mkStage('Investigation & Root Cause', 'capa-investigation');
          const plan = await mkStage('Action Plan', 'capa-action-plan');
          const implementation = await mkStage('Implementation', 'capa-implementation');
          const verification = await mkStage('Effectiveness Verification', 'capa-verification');
          const closure = await mkStage('Closure', 'capa-closure');

          // Primary Approve/Forward on every stage; a Return option on the mid
          // stages lets a reviewer send the CAPA back for more work.
          for (const s of [initiation, investigation, plan, implementation, verification, closure]) {
            await tx.workflowStageAction.create({
              data: { workflowStageId: s.id, workflowActionId: approveStatus.id, isPrimary: true },
            });
          }
          if (returnStatus) {
            for (const s of [investigation, plan, implementation, verification]) {
              await tx.workflowStageAction.create({
                data: { workflowStageId: s.id, workflowActionId: returnStatus.id, isPrimary: false },
              });
            }
          }

          // Linear transitions Initiation → … → Closure.
          const transition = (from: { id: string }, to: { id: string }) =>
            tx.workflowTransition.create({
              data: { workflowId: wf.id, fromStageId: from.id, toStageId: to.id, branchOrder: 0 },
            });
          await transition(initiation, investigation);
          await transition(investigation, plan);
          await transition(plan, implementation);
          await transition(implementation, verification);
          await transition(verification, closure);

          // Bind each stage's REQUIRED form. QE fills the working stages;
          // QMS_ADMIN signs off at Closure. Auditors get view access throughout.
          const bind = (
            stageId: string,
            formId: string,
            fillRoles: string[],
            viewRoles: string[],
          ) =>
            tx.stageFormBinding.create({
              data: {
                workflowId: wf.id,
                stageId,
                formId,
                isRequired: true,
                position: 0,
                fillMode: 'ANYONE',
                allowedFillRoles: { connect: roleConnectC(fillRoles) },
                allowedViewRoles: { connect: roleConnectC(viewRoles) },
              },
            });

          await bind(initiation.id, capaInitiationFormId, ['QUALITY_ENGINEER'], ['QMS_ADMIN', 'AUDITOR']);
          await bind(investigation.id, capaRcaFormId, ['QUALITY_ENGINEER'], ['QMS_ADMIN', 'AUDITOR']);
          await bind(plan.id, capaPlanFormId, ['QUALITY_ENGINEER'], ['QMS_ADMIN', 'AUDITOR']);
          await bind(implementation.id, capaImplFormId, ['QUALITY_ENGINEER'], ['QMS_ADMIN', 'AUDITOR']);
          await bind(verification.id, capaEffFormId, ['QUALITY_ENGINEER'], ['QMS_ADMIN', 'AUDITOR']);
          await bind(closure.id, capaClosureFormId, ['QMS_ADMIN'], ['QUALITY_ENGINEER', 'AUDITOR']);
        },
        { timeout: 30_000, maxWait: 5_000 },
      );
    }
  }
  console.log('    CAPA workflow: 6 stages (Initiation → Closure) + 6 required stage forms');

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
