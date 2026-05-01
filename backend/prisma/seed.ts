import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

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

  console.log('\n✅  Seed complete');
  console.log(`    permissions:  ${PERMISSIONS.length}`);
  console.log(`    roles:        ${ROLES.length}`);
  console.log(`    sites:        ${SITES.length}`);
  console.log(`    departments:  ${DEPARTMENTS.length}`);
  console.log(`    users:        ${USERS.length}`);
  console.log(`    organization: ${ORGANIZATION.name}`);
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
