/**
 * Standalone seed for audit master lookup data (Focus Areas + Audit Types).
 *
 * Kept separate from the main prisma/seed.ts so this reference data can be
 * pushed to the database on its own without re-running the full seed
 * (permissions, roles, users, workflows, …).
 *
 * Run with:  npm run db:seed:audit   (from the backend workspace)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FOCUS_AREAS: { name: string; description: string }[] = [
  { name: 'Quality Management System', description: 'QMS documentation, procedures and records' },
  { name: 'Manufacturing Process', description: 'Production floor processes and controls' },
  { name: 'Product Quality', description: 'Product specifications and conformance' },
  { name: 'Supplier Management', description: 'Supplier qualification and incoming inspection' },
  { name: 'Health, Safety & Environment', description: 'HSE compliance and safety controls' },
  { name: 'Document Control', description: 'Document lifecycle, versioning and approvals' },
];

const AUDIT_TYPES_MASTER: { name: string; description: string }[] = [
  { name: 'System Audit', description: 'Comprehensive system-wide audit' },
  { name: 'Process Audit', description: 'Focused audit of a specific process' },
  { name: 'Product Audit', description: 'Product-focused quality audit' },
  { name: 'Supplier Audit', description: 'Audit of an external supplier' },
  { name: 'Compliance Audit', description: 'Regulatory / standard compliance audit' },
  { name: 'Internal Audit', description: 'Internally conducted audit' },
];

async function main() {
  console.log('🌱  Seeding Audit Focus Areas...');
  for (const fa of FOCUS_AREAS) {
    await prisma.focusArea.upsert({
      where: { name: fa.name },
      update: { description: fa.description },
      create: fa,
    });
  }

  console.log('🌱  Seeding Audit Types...');
  for (const at of AUDIT_TYPES_MASTER) {
    await prisma.auditTypeMaster.upsert({
      where: { name: at.name },
      update: { description: at.description },
      create: at,
    });
  }

  console.log('\n✅  Audit master data seeded');
  console.log(`    focus areas:  ${FOCUS_AREAS.length}`);
  console.log(`    audit types:  ${AUDIT_TYPES_MASTER.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
