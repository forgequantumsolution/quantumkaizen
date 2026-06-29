/**
 * Comprehensive demo data for the whole Audit module — so the dashboard,
 * schedule/calendar, register/program flow, non-conformances, CAPAs, action
 * items, audit trail, signatures and reports all show realistic data.
 *
 *   npm run db:seed:audit-data   (from the backend workspace)
 *
 * Idempotent: all seeded rows are tagged "[SEED]" and removed + recreated on
 * each run, so it's safe to re-run. Requires the base seed (users/depts) first.
 */
import { PrismaClient, type AuditFrequency } from '@prisma/client';

const prisma = new PrismaClient();
const SEED = '[SEED]';

const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

async function main() {
  // ── Resolve referenced users + departments ──
  const users = await prisma.user.findMany({ select: { id: true, email: true } });
  const byEmail = (e: string) => users.find((u) => u.email === e)?.id ?? users[0]?.id ?? null;
  const auditor = byEmail('auditor@forgequantum.com');
  const qa = byEmail('qa@forgequantum.com');
  const admin = byEmail('admin@forgequantum.com');
  const docUser = byEmail('doc@forgequantum.com');

  const depts = await prisma.department.findMany({ select: { id: true, name: true } });
  const deptByName = (n: string) => depts.find((d) => d.name === n)?.id ?? null;
  const qcDept = deptByName('Quality Control');
  const mfgDept = deptByName('Manufacturing');
  const engDept = deptByName('Engineering');

  // ── Clean prior seed rows (children cascade where defined) ──
  console.log('🧹  Clearing previous [SEED] audit data…');
  await prisma.actionItem.deleteMany({ where: { title: { startsWith: SEED } } });
  await prisma.capa.deleteMany({ where: { title: { startsWith: SEED } } });
  await prisma.auditScheduleRule.deleteMany({ where: { name: { startsWith: SEED } } });
  await prisma.auditRegister.deleteMany({ where: { title: { startsWith: SEED } } });

  // ── ISO standard (upsert by unique name) ──
  console.log('🌱  ISO standard…');
  const iso = await prisma.isoStandard.upsert({
    where: { name: 'ISO 9001:2015' },
    update: {},
    create: {
      name: 'ISO 9001:2015',
      remarks: 'Quality management systems — Requirements',
      clauses: {
        create: [
          {
            clauseNumber: '4',
            clauseTitle: 'Context of the organization',
            position: 0,
            subClauses: {
              create: [
                { subClauseNumber: '4.1', subClauseTitle: 'Understanding the organization', position: 0 },
                { subClauseNumber: '4.4', subClauseTitle: 'QMS and its processes', position: 1 },
              ],
            },
          },
          {
            clauseNumber: '8',
            clauseTitle: 'Operation',
            position: 1,
            subClauses: {
              create: [
                { subClauseNumber: '8.5.1', subClauseTitle: 'Control of production', position: 0 },
                { subClauseNumber: '8.7', subClauseTitle: 'Control of nonconforming outputs', position: 1 },
              ],
            },
          },
        ],
      },
    },
    include: { clauses: { include: { subClauses: true } } },
  });
  const subClause = (num: string) =>
    iso.clauses.flatMap((c) => c.subClauses).find((s) => s.subClauseNumber === num)?.id ?? null;

  // ── Audit masters (upsert by unique code) ──
  console.log('🌱  Audit masters…');
  const masterDefs = [
    { code: 'AM-INT', name: 'Internal QMS Audit', auditType: 'INTERNAL' as const, frequency: 'QUARTERLY' as AuditFrequency },
    { code: 'AM-SUP', name: 'Supplier Audit', auditType: 'SUPPLIER' as const, frequency: 'ANNUAL' as AuditFrequency },
    { code: 'AM-PROC', name: 'Process Audit', auditType: 'PROCESS' as const, frequency: 'MONTHLY' as AuditFrequency },
  ];
  const masters: Record<string, string> = {};
  for (const m of masterDefs) {
    const row = await prisma.auditMaster.upsert({
      where: { code: m.code },
      update: { name: m.name, auditType: m.auditType, frequency: m.frequency, defaultIsoStandardId: iso.id },
      create: { ...m, defaultIsoStandardId: iso.id, createdById: admin },
    });
    masters[m.code] = row.id;
  }

  // ── Schedule rules ──
  console.log('🌱  Schedule rules…');
  const ruleDefs: { name: string; master: string; frequency: AuditFrequency; anchor: Date; auditor: string | null }[] = [
    { name: `${SEED} Quarterly Internal Audit`, master: 'AM-INT', frequency: 'QUARTERLY', anchor: daysFromNow(20), auditor },
    { name: `${SEED} Annual Supplier Audit`, master: 'AM-SUP', frequency: 'ANNUAL', anchor: daysFromNow(75), auditor: qa },
    { name: `${SEED} Monthly Process Check`, master: 'AM-PROC', frequency: 'MONTHLY', anchor: daysFromNow(8), auditor },
  ];
  for (const r of ruleDefs) {
    await prisma.auditScheduleRule.create({
      data: {
        name: r.name,
        auditMasterId: masters[r.master],
        frequency: r.frequency,
        anchorDate: r.anchor,
        nextRunAt: r.anchor,
        defaultAuditorId: r.auditor,
        plant: 'Plant 1',
        createdById: admin,
      },
    });
  }

  // ── Numbering helpers (continue from existing counts) ──
  const year = new Date().getFullYear();
  const counter = async (model: 'auditRegister' | 'auditProgram' | 'auditFinding' | 'nonConformance' | 'capa' | 'actionItem', field: string, prefix: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let n = await (prisma as any)[model].count({ where: { [field]: { startsWith: `${prefix}-${year}-` } } });
    return () => `${prefix}-${year}-${String(++n).padStart(4, '0')}`;
  };
  const nextAR = await counter('auditRegister', 'registerNumber', 'AR');
  const nextAP = await counter('auditProgram', 'programNumber', 'AP');
  const nextAF = await counter('auditFinding', 'findingNumber', 'AF');
  const nextNC = await counter('nonConformance', 'ncNumber', 'NC');
  const nextCAPA = await counter('capa', 'capaNumber', 'CAPA');
  const nextAI = await counter('actionItem', 'actionNumber', 'AI');

  console.log('🌱  Registers / programs / findings / NC / CAPA / actions…');

  // Helper to create a register with optional program + findings.
  type FindingSpec = {
    severity: 'OBSERVATION' | 'MINOR' | 'MAJOR' | 'CRITICAL';
    status?: 'OPEN' | 'IN_REVIEW' | 'ACCEPTED' | 'REJECTED' | 'CLOSED';
    description: string;
    clause?: string;
    promote?: { dept: string | null; capa?: { status: 'OPEN' | 'INVESTIGATION' | 'PLAN' | 'IMPLEMENTATION' | 'VERIFICATION' | 'CLOSED'; rootCause?: string; corrective?: string; overdue?: boolean } };
  };

  const makeRegister = async (opts: {
    title: string;
    auditType: string;
    masterCode: string;
    status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'IN_PROGRESS' | 'COMPLETED';
    plannedInDays: number;
    plant: string;
    program?: { status: 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED'; score?: number; summary?: string };
    findings?: FindingSpec[];
  }) => {
    const reg = await prisma.auditRegister.create({
      data: {
        registerNumber: nextAR(),
        title: `${SEED} ${opts.title}`,
        status: opts.status,
        auditMasterId: masters[opts.masterCode],
        auditType: opts.auditType,
        plant: opts.plant,
        plannedDate: daysFromNow(opts.plannedInDays),
        financialYear: `${year}-${year + 1}`,
        auditMethod: 'On-site',
        isoStandardId: iso.id,
        auditorId: auditor,
        approverId: qa,
        createdById: admin,
        submittedAt: opts.status === 'DRAFT' ? null : daysFromNow(-10),
        approvedAt: ['APPROVED', 'IN_PROGRESS', 'COMPLETED'].includes(opts.status) ? daysFromNow(-7) : null,
        approvedById: ['APPROVED', 'IN_PROGRESS', 'COMPLETED'].includes(opts.status) ? qa : null,
        rejectionReason: opts.status === 'REJECTED' ? 'Scope unclear — please add the affected lines.' : null,
      },
    });

    if (opts.program) {
      const prog = await prisma.auditProgram.create({
        data: {
          programNumber: nextAP(),
          registerId: reg.id,
          status: opts.program.status,
          startedAt: opts.program.status !== 'PLANNED' ? daysFromNow(-5) : null,
          completedAt: opts.program.status === 'COMPLETED' ? daysFromNow(-2) : null,
          score: opts.program.score ?? null,
          summary: opts.program.summary ?? null,
        },
      });

      for (const f of opts.findings ?? []) {
        const finding = await prisma.auditFinding.create({
          data: {
            findingNumber: nextAF(),
            programId: prog.id,
            severity: f.severity,
            status: f.status ?? 'OPEN',
            description: f.description,
            clauseRef: f.clause ?? null,
            isoSubClauseId: f.clause ? subClause(f.clause) : null,
            recommendation: 'Review procedure and retrain affected staff.',
            createdById: auditor,
          },
        });

        if (f.promote) {
          const nc = await prisma.nonConformance.create({
            data: {
              ncNumber: nextNC(),
              findingId: finding.id,
              severity: f.severity,
              status: f.promote.capa ? 'CAPA_RAISED' : 'OPEN',
              track: 'by-department',
              departmentId: f.promote.dept,
              dueDate: daysFromNow(14),
              createdById: auditor,
            },
          });

          if (f.promote.capa) {
            const c = f.promote.capa;
            const capa = await prisma.capa.create({
              data: {
                capaNumber: nextCAPA(),
                title: `${SEED} CAPA for ${nc.ncNumber}`,
                type: 'CORRECTIVE',
                status: c.status,
                nonConformanceId: nc.id,
                rootCause: c.rootCause ?? null,
                correctiveAction: c.corrective ?? null,
                ownerId: qa,
                departmentId: f.promote.dept,
                dueDate: c.overdue ? daysFromNow(-3) : daysFromNow(21),
                closedAt: c.status === 'CLOSED' ? daysFromNow(-1) : null,
                verifiedById: c.status === 'CLOSED' ? admin : null,
                verifiedAt: c.status === 'CLOSED' ? daysFromNow(-1) : null,
                effectivenessCheck: c.status === 'CLOSED' ? 'Re-audit confirmed the control is effective.' : null,
                createdById: auditor,
              },
            });
            // Action items under the CAPA
            await prisma.actionItem.create({
              data: {
                actionNumber: nextAI(),
                title: `${SEED} Update SOP and retrain operators`,
                status: c.status === 'CLOSED' ? 'VERIFIED' : 'IN_PROGRESS',
                priority: f.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
                ownerId: docUser,
                dueDate: c.overdue ? daysFromNow(-2) : daysFromNow(10),
                completedAt: c.status === 'CLOSED' ? daysFromNow(-1) : null,
                capaId: capa.id,
                createdById: qa,
              },
            });
            // A trail + signature for closed CAPAs (demo compliance data)
            await prisma.auditTrailEntry.create({
              data: { entityType: 'Capa', entityId: capa.id, action: 'CREATE', newValue: capa.capaNumber, userId: auditor, userName: 'Auditor' },
            });
            if (c.status === 'CLOSED') {
              await prisma.auditTrailEntry.create({
                data: { entityType: 'Capa', entityId: capa.id, action: 'TRANSITION', field: 'status', oldValue: 'VERIFICATION', newValue: 'CLOSED', userId: admin, userName: 'QMS Admin' },
              });
              await prisma.eSignature.create({
                data: { entityType: 'Capa', entityId: capa.id, meaning: 'Verified & Closed', userId: admin, userName: 'QMS Admin' },
              });
            }
          }
        }
      }
    }
    return reg;
  };

  // 1) DRAFT — future planned
  await makeRegister({ title: 'Q3 Internal QMS Audit (Draft)', auditType: 'INTERNAL', masterCode: 'AM-INT', status: 'DRAFT', plannedInDays: 30, plant: 'Plant 1' });

  // 2) PENDING_APPROVAL
  await makeRegister({ title: 'Engineering Process Audit', auditType: 'PROCESS', masterCode: 'AM-PROC', status: 'PENDING_APPROVAL', plannedInDays: 18, plant: 'Plant 2' });

  // 3) REJECTED
  await makeRegister({ title: 'Ad-hoc Supplier Audit', auditType: 'SUPPLIER', masterCode: 'AM-SUP', status: 'REJECTED', plannedInDays: 25, plant: 'Plant 1' });

  // 4) APPROVED → program PLANNED
  await makeRegister({ title: 'Annual Supplier Audit — Acme Co', auditType: 'SUPPLIER', masterCode: 'AM-SUP', status: 'APPROVED', plannedInDays: 12, plant: 'Plant 1', program: { status: 'PLANNED' } });

  // 5) IN_PROGRESS → findings being recorded
  await makeRegister({
    title: 'Manufacturing Line A Audit', auditType: 'PROCESS', masterCode: 'AM-PROC', status: 'IN_PROGRESS', plannedInDays: -1, plant: 'Plant 1',
    program: { status: 'IN_PROGRESS' },
    findings: [
      { severity: 'MINOR', status: 'OPEN', description: 'Calibration label on gauge G-12 is past due.', clause: '8.5.1' },
      { severity: 'OBSERVATION', status: 'OPEN', description: 'Operator work instructions not at the latest revision at station 4.', clause: '4.4' },
      { severity: 'MAJOR', status: 'IN_REVIEW', description: 'Nonconforming parts not segregated in the rework area.', clause: '8.7', promote: { dept: mfgDept, capa: { status: 'INVESTIGATION', rootCause: 'No dedicated quarantine bin on Line A.' } } },
    ],
  });

  // 6) COMPLETED — scored, with NC + CAPA in various states
  await makeRegister({
    title: 'Internal QMS Audit — H1', auditType: 'INTERNAL', masterCode: 'AM-INT', status: 'COMPLETED', plannedInDays: -20, plant: 'Plant 1',
    program: { status: 'COMPLETED', score: 86, summary: 'Overall conformance good. Two majors raised against clause 8; CAPAs in progress.' },
    findings: [
      { severity: 'CRITICAL', status: 'ACCEPTED', description: 'Released product without final inspection record on 2 lots.', clause: '8.7', promote: { dept: qcDept, capa: { status: 'IMPLEMENTATION', rootCause: 'Inspection sign-off step skipped under schedule pressure.', corrective: 'Add system gate blocking release without QC sign-off.', overdue: true } } },
      { severity: 'MAJOR', status: 'CLOSED', description: 'Internal audit schedule not maintained for Engineering.', clause: '4.4', promote: { dept: engDept, capa: { status: 'CLOSED', rootCause: 'Owner left; schedule not reassigned.', corrective: 'Reassigned schedule owner; added to onboarding checklist.' } } },
      { severity: 'MINOR', status: 'CLOSED', description: 'Two SOPs past their review date.', clause: '4.1' },
    ],
  });

  // 7) COMPLETED — clean audit (good score, no NC) for dashboard variety
  await makeRegister({
    title: 'Document Control Audit', auditType: 'INTERNAL', masterCode: 'AM-INT', status: 'COMPLETED', plannedInDays: -35, plant: 'Plant 2',
    program: { status: 'COMPLETED', score: 95, summary: 'Strong document control. One observation only.' },
    findings: [{ severity: 'OBSERVATION', status: 'CLOSED', description: 'Obsolete copy of form F-09 found in break room.', clause: '4.4' }],
  });

  // ── A couple of standalone action items (not under a CAPA) ──
  await prisma.actionItem.create({
    data: { actionNumber: nextAI(), title: `${SEED} Schedule calibration of torque wrenches`, status: 'OPEN', priority: 'MEDIUM', ownerId: mfgDept ? auditor : auditor, dueDate: daysFromNow(5), createdById: qa },
  });
  await prisma.actionItem.create({
    data: { actionNumber: nextAI(), title: `${SEED} Refresh supplier audit checklist`, status: 'IN_PROGRESS', priority: 'LOW', ownerId: qa, dueDate: daysFromNow(-1), createdById: admin },
  });

  // ── Summary ──
  const counts = {
    registers: await prisma.auditRegister.count({ where: { title: { startsWith: SEED } } }),
    rules: await prisma.auditScheduleRule.count({ where: { name: { startsWith: SEED } } }),
    findings: await prisma.auditFinding.count(),
    ncs: await prisma.nonConformance.count(),
    capas: await prisma.capa.count({ where: { title: { startsWith: SEED } } }),
    actions: await prisma.actionItem.count({ where: { title: { startsWith: SEED } } }),
  };
  console.log('\n✅  Audit demo data seeded');
  console.table(counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
