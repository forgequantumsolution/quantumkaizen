import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const fakeSig = (parts: string[]) => {
  const s = parts.join('|');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ('sig-' + Math.abs(h).toString(16).padStart(8, '0')).repeat(8).slice(0, 64);
};

async function main() {
  console.log('Seeding Quantum Kaizen — Pharma dataset...');

  // ─── Tenant ─────────────────────────────────────────────────────────
  const tenant = await prisma.tenant.upsert({
    where: { code: 'AURORA-PH' },
    update: {},
    create: {
      code: 'AURORA-PH',
      name: 'Aurora BioPharma Pvt Ltd',
      industry: 'PHARMACEUTICAL',
      settings: {
        riskMatrix: '5x5',
        defaultApprovalStages: 3,
        documentNumberFormat: '{LEVEL}-{CATEGORY}-{SEQ}',
        gxpSite: true,
        regulatoryAuthorities: ['USFDA', 'EMA', 'CDSCO', 'MHRA', 'WHO'],
        applicableStandards: [
          '21 CFR Part 210/211',
          '21 CFR Part 11',
          'EU GMP Annex 1',
          'ICH Q7',
          'ICH Q9',
          'ICH Q10',
          'USP <797>',
        ],
      },
    },
  });

  console.log(`Tenant: ${tenant.name} (${tenant.code}) — ${tenant.industry}`);

  // ─── Users ──────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('QuantumK@izen2026', 12);

  const users = [
    {
      employeeId: 'EMP001',
      email: 'admin@aurorabiopharma.com',
      name: 'Dr. Ashish Pandit',
      role: 'TENANT_ADMIN' as const,
      department: 'Site Management',
      site: 'Hyderabad - Unit I',
      phone: '+91-9876500001',
    },
    {
      employeeId: 'EMP002',
      email: 'qa.head@aurorabiopharma.com',
      name: 'Dr. Priya Sharma',
      role: 'QUALITY_MANAGER' as const,
      department: 'Quality Assurance',
      site: 'Hyderabad - Unit I',
      phone: '+91-9876500002',
    },
    {
      employeeId: 'EMP003',
      email: 'qc.analyst@aurorabiopharma.com',
      name: 'Rajesh Kumar',
      role: 'QUALITY_ENGINEER' as const,
      department: 'Quality Control',
      site: 'Hyderabad - Unit I',
      phone: '+91-9876500003',
    },
    {
      employeeId: 'EMP004',
      email: 'doc.controller@aurorabiopharma.com',
      name: 'Anita Desai',
      role: 'DOCUMENT_CONTROLLER' as const,
      department: 'Quality Assurance',
      site: 'Hyderabad - Unit I',
      phone: '+91-9876500004',
    },
    {
      employeeId: 'EMP005',
      email: 'gmp.auditor@aurorabiopharma.com',
      name: 'Vikram Patel',
      role: 'AUDITOR' as const,
      department: 'Corporate Quality',
      site: 'Hyderabad - Unit I',
      phone: '+91-9876500005',
    },
    {
      employeeId: 'EMP006',
      email: 'production.head@aurorabiopharma.com',
      name: 'Sunita Rao',
      role: 'DEPARTMENT_HEAD' as const,
      department: 'Manufacturing - Solid Orals',
      site: 'Hyderabad - Unit I',
      phone: '+91-9876500006',
    },
    {
      employeeId: 'EMP007',
      email: 'validation.lead@aurorabiopharma.com',
      name: 'Mohammed Iqbal',
      role: 'QUALITY_ENGINEER' as const,
      department: 'Validation & Qualification',
      site: 'Hyderabad - Unit I',
      phone: '+91-9876500007',
    },
    {
      employeeId: 'EMP008',
      email: 'training.coord@aurorabiopharma.com',
      name: 'Neha Iyer',
      role: 'TRAINER' as const,
      department: 'Human Resources',
      site: 'Hyderabad - Unit I',
      phone: '+91-9876500008',
    },
    {
      employeeId: 'EMP009',
      email: 'operator.tab@aurorabiopharma.com',
      name: 'Suresh Reddy',
      role: 'TRAINEE' as const,
      department: 'Manufacturing - Solid Orals',
      site: 'Hyderabad - Unit I',
      phone: '+91-9876500009',
    },
    {
      employeeId: 'EMP010',
      email: 'microbiologist@aurorabiopharma.com',
      name: 'Dr. Kavita Menon',
      role: 'QUALITY_ENGINEER' as const,
      department: 'Microbiology',
      site: 'Hyderabad - Unit I',
      phone: '+91-9876500010',
    },
  ];

  const createdUsers: Record<string, string> = {};
  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: userData.email } },
      update: {},
      create: { tenantId: tenant.id, passwordHash, ...userData },
    });
    createdUsers[userData.employeeId] = user.id;
  }
  console.log(`  Users: ${users.length}`);

  // ─── Approval Workflows ─────────────────────────────────────────────
  const wfDoc = await prisma.approvalWorkflow.create({
    data: {
      tenantId: tenant.id,
      name: 'GMP Document Approval (3-Tier)',
      entityType: 'DOCUMENT',
      stages: [
        { name: 'QC Review', order: 1, assigneeRole: 'QUALITY_ENGINEER', slaDays: 3, isParallel: false },
        { name: 'QA Approval', order: 2, assigneeRole: 'QUALITY_MANAGER', slaDays: 5, isParallel: false },
        { name: 'Site Head Authorization', order: 3, assigneeRole: 'TENANT_ADMIN', slaDays: 5, isParallel: false },
      ],
    },
  });

  await prisma.approvalWorkflow.create({
    data: {
      tenantId: tenant.id,
      name: 'Deviation / OOS Closure',
      entityType: 'NON_CONFORMANCE',
      stages: [
        { name: 'QC Investigation Review', order: 1, assigneeRole: 'QUALITY_ENGINEER', slaDays: 2, isParallel: false },
        { name: 'QA Manager Approval', order: 2, assigneeRole: 'QUALITY_MANAGER', slaDays: 3, isParallel: false },
        { name: 'QP Release', order: 3, assigneeRole: 'TENANT_ADMIN', slaDays: 2, isParallel: false },
      ],
    },
  });

  await prisma.approvalWorkflow.create({
    data: {
      tenantId: tenant.id,
      name: 'CAPA Approval (cGMP)',
      entityType: 'CAPA',
      stages: [
        { name: 'QA Engineer Review', order: 1, assigneeRole: 'QUALITY_ENGINEER', slaDays: 3, isParallel: false },
        { name: 'QA Head Approval', order: 2, assigneeRole: 'QUALITY_MANAGER', slaDays: 5, isParallel: false },
        { name: 'Site Head Sign-off', order: 3, assigneeRole: 'TENANT_ADMIN', slaDays: 7, isParallel: false },
      ],
    },
  });

  await prisma.approvalWorkflow.create({
    data: {
      tenantId: tenant.id,
      name: 'Quality Risk Management Approval',
      entityType: 'RISK_REGISTER',
      stages: [
        { name: 'Department Head Review', order: 1, assigneeRole: 'DEPARTMENT_HEAD', slaDays: 3, isParallel: false },
        { name: 'QA Head Approval', order: 2, assigneeRole: 'QUALITY_MANAGER', slaDays: 5, isParallel: false },
      ],
    },
  });

  await prisma.approvalWorkflow.create({
    data: {
      tenantId: tenant.id,
      name: 'Change Control Approval',
      entityType: 'CHANGE_REQUEST',
      stages: [
        { name: 'Initiator Department Review', order: 1, assigneeRole: 'DEPARTMENT_HEAD', slaDays: 2, isParallel: false },
        { name: 'Cross-functional Review', order: 2, assigneeRole: 'QUALITY_ENGINEER', slaDays: 5, isParallel: true },
        { name: 'QA Head Approval', order: 3, assigneeRole: 'QUALITY_MANAGER', slaDays: 5, isParallel: false },
        { name: 'Site Head Authorization', order: 4, assigneeRole: 'TENANT_ADMIN', slaDays: 3, isParallel: false },
      ],
    },
  });

  console.log('  Approval workflows: 5');

  // ─── Documents (with versions and acknowledgements) ─────────────────
  const doc1 = await prisma.document.create({
    data: {
      tenantId: tenant.id,
      documentNumber: 'L1-QMS-001',
      title: 'Pharmaceutical Quality System (PQS) Manual',
      description: 'Site Quality Manual aligned to ICH Q10 covering Pharmaceutical Quality System scope, principles, and management commitment.',
      level: 'LEVEL_1_POLICY',
      category: 'Quality',
      department: 'Quality Assurance',
      status: 'PUBLISHED',
      currentVersion: '4.0',
      ownerId: createdUsers['EMP001'],
      reviewerId: createdUsers['EMP002'],
      approverId: createdUsers['EMP001'],
      effectiveDate: new Date('2026-01-15'),
      expiryDate: new Date('2028-01-15'),
      reviewDate: new Date('2027-01-15'),
      isControlled: true,
      tags: ['ICH Q10', 'PQS', 'GMP', 'Policy'],
    },
  });

  const doc2 = await prisma.document.create({
    data: {
      tenantId: tenant.id,
      documentNumber: 'L2-QMS-001',
      title: 'SOP — Deviation & OOS Investigation',
      description: 'Standard operating procedure for handling deviations and Out-of-Specification (OOS) results per FDA OOS Guidance and EU GMP Chapter 1.',
      level: 'LEVEL_2_PROCEDURE',
      category: 'Quality',
      department: 'Quality Assurance',
      status: 'PUBLISHED',
      currentVersion: '5.2',
      ownerId: createdUsers['EMP002'],
      reviewerId: createdUsers['EMP003'],
      approverId: createdUsers['EMP002'],
      effectiveDate: new Date('2026-02-01'),
      expiryDate: new Date('2028-02-01'),
      reviewDate: new Date('2027-02-01'),
      isControlled: true,
      tags: ['Deviation', 'OOS', 'GMP', 'SOP'],
      parentDocumentId: doc1.id,
    },
  });

  await prisma.document.create({
    data: {
      tenantId: tenant.id,
      documentNumber: 'L2-QMS-002',
      title: 'SOP — CAPA Management',
      description: 'Procedure for Corrective and Preventive Action management aligned with ICH Q10 and 21 CFR 211.192.',
      level: 'LEVEL_2_PROCEDURE',
      category: 'Quality',
      department: 'Quality Assurance',
      status: 'PUBLISHED',
      currentVersion: '3.0',
      ownerId: createdUsers['EMP002'],
      reviewerId: createdUsers['EMP003'],
      approverId: createdUsers['EMP002'],
      effectiveDate: new Date('2026-02-01'),
      expiryDate: new Date('2028-02-01'),
      reviewDate: new Date('2027-02-01'),
      isControlled: true,
      tags: ['CAPA', 'GMP', 'SOP'],
      parentDocumentId: doc1.id,
    },
  });

  await prisma.document.create({
    data: {
      tenantId: tenant.id,
      documentNumber: 'L2-MFG-001',
      title: 'Master Batch Manufacturing Record — Paracetamol 500 mg Tablets',
      description: 'Master Production and Control Record (MPCR) for Paracetamol 500 mg uncoated tablets, batch size 500,000 units.',
      level: 'LEVEL_2_PROCEDURE',
      category: 'Manufacturing',
      department: 'Manufacturing - Solid Orals',
      status: 'PUBLISHED',
      currentVersion: '2.1',
      ownerId: createdUsers['EMP006'],
      reviewerId: createdUsers['EMP002'],
      approverId: createdUsers['EMP001'],
      effectiveDate: new Date('2026-01-20'),
      expiryDate: new Date('2028-01-20'),
      reviewDate: new Date('2027-01-20'),
      isControlled: true,
      tags: ['BMR', 'Paracetamol', 'Solid Orals', '21 CFR 211.186'],
    },
  });

  await prisma.document.create({
    data: {
      tenantId: tenant.id,
      documentNumber: 'L3-QC-001',
      title: 'WI — HPLC Assay for Paracetamol',
      description: 'Work instruction for HPLC assay procedure for Paracetamol API & finished tablets per USP monograph.',
      level: 'LEVEL_3_WORK_INSTRUCTION',
      category: 'Quality Control',
      department: 'Quality Control',
      status: 'PUBLISHED',
      currentVersion: '1.4',
      ownerId: createdUsers['EMP003'],
      approverId: createdUsers['EMP002'],
      effectiveDate: new Date('2026-01-10'),
      expiryDate: new Date('2028-01-10'),
      reviewDate: new Date('2027-01-10'),
      isControlled: true,
      tags: ['HPLC', 'Assay', 'USP', 'Work Instruction'],
      parentDocumentId: doc2.id,
    },
  });

  await prisma.document.create({
    data: {
      tenantId: tenant.id,
      documentNumber: 'L3-MICRO-001',
      title: 'WI — Environmental Monitoring of Grade A/B Cleanrooms',
      description: 'Work instruction for viable & non-viable particulate monitoring of Grade A and B cleanrooms per EU GMP Annex 1.',
      level: 'LEVEL_3_WORK_INSTRUCTION',
      category: 'Microbiology',
      department: 'Microbiology',
      status: 'PUBLISHED',
      currentVersion: '2.0',
      ownerId: createdUsers['EMP010'],
      approverId: createdUsers['EMP002'],
      effectiveDate: new Date('2026-03-01'),
      expiryDate: new Date('2028-03-01'),
      reviewDate: new Date('2027-03-01'),
      isControlled: true,
      tags: ['EM', 'Cleanroom', 'EU GMP Annex 1', 'Sterile'],
    },
  });

  await prisma.document.create({
    data: {
      tenantId: tenant.id,
      documentNumber: 'L4-QC-001',
      title: 'Form — Analytical Test Request & Report',
      description: 'Form template for QC test requests and reporting of finished product analyses.',
      level: 'LEVEL_4_FORM',
      category: 'Quality Control',
      department: 'Quality Control',
      status: 'PUBLISHED',
      currentVersion: '1.0',
      ownerId: createdUsers['EMP003'],
      approverId: createdUsers['EMP002'],
      effectiveDate: new Date('2026-01-10'),
      isControlled: true,
      tags: ['Form', 'QC', 'ATR'],
    },
  });

  await prisma.document.create({
    data: {
      tenantId: tenant.id,
      documentNumber: 'L4-VAL-001',
      title: 'Form — Equipment Qualification Protocol Template (IQ/OQ/PQ)',
      description: 'Standard template for Installation, Operational and Performance Qualification protocols.',
      level: 'LEVEL_4_FORM',
      category: 'Validation',
      department: 'Validation & Qualification',
      status: 'PUBLISHED',
      currentVersion: '2.0',
      ownerId: createdUsers['EMP007'],
      approverId: createdUsers['EMP002'],
      effectiveDate: new Date('2026-02-15'),
      isControlled: true,
      tags: ['Validation', 'IQ', 'OQ', 'PQ', 'Form'],
    },
  });

  const docDraft = await prisma.document.create({
    data: {
      tenantId: tenant.id,
      documentNumber: 'L2-DI-001',
      title: 'SOP — Data Integrity & ALCOA+ Compliance',
      description: 'Procedure to ensure data integrity in GxP records per FDA Data Integrity Guidance, MHRA & WHO TRS 996 Annex 5.',
      level: 'LEVEL_2_PROCEDURE',
      category: 'Quality',
      department: 'Quality Assurance',
      status: 'UNDER_REVIEW',
      currentVersion: '0.9',
      ownerId: createdUsers['EMP002'],
      reviewerId: createdUsers['EMP003'],
      isControlled: true,
      tags: ['Data Integrity', 'ALCOA+', '21 CFR Part 11', 'Draft'],
    },
  });

  await prisma.document.create({
    data: {
      tenantId: tenant.id,
      documentNumber: 'EXT-USP43-NF38',
      title: 'USP 43 - NF 38 Pharmacopeia Reference',
      description: 'External reference: United States Pharmacopeia 43 / National Formulary 38 monographs.',
      level: 'EXTERNAL',
      category: 'Standards',
      department: 'Quality Control',
      status: 'PUBLISHED',
      currentVersion: '43-NF38',
      ownerId: createdUsers['EMP004'],
      effectiveDate: new Date('2024-12-01'),
      isControlled: false,
      tags: ['USP', 'Pharmacopeia', 'External'],
    },
  });

  // Document versions for SOP - Deviation & OOS
  const ver1 = await prisma.documentVersion.create({
    data: {
      documentId: doc2.id,
      versionNumber: '5.0',
      changeSummary: 'Initial release for revised OOS investigation flow.',
      createdById: createdUsers['EMP002'],
      isCurrentVersion: false,
    },
  });

  await prisma.documentVersion.create({
    data: {
      documentId: doc2.id,
      versionNumber: '5.1',
      changeSummary: 'Added Phase II investigation timeline (10 working days) per FDA guidance.',
      createdById: createdUsers['EMP002'],
      isCurrentVersion: false,
    },
  });

  const verCurrent = await prisma.documentVersion.create({
    data: {
      documentId: doc2.id,
      versionNumber: '5.2',
      changeSummary: 'Aligned with EU GMP Chapter 1 update — added QP review checkpoint.',
      createdById: createdUsers['EMP002'],
      isCurrentVersion: true,
    },
  });

  // Acknowledgements
  await prisma.documentAcknowledgement.createMany({
    data: [
      {
        documentId: doc2.id,
        documentVersionId: verCurrent.id,
        userId: createdUsers['EMP003'],
        acknowledgedAt: new Date('2026-02-05'),
      },
      {
        documentId: doc2.id,
        documentVersionId: verCurrent.id,
        userId: createdUsers['EMP006'],
        acknowledgedAt: new Date('2026-02-06'),
      },
      {
        documentId: doc2.id,
        documentVersionId: verCurrent.id,
        userId: createdUsers['EMP010'],
        acknowledgedAt: null,
        isOverdue: true,
      },
      {
        documentId: doc2.id,
        documentVersionId: ver1.id,
        userId: createdUsers['EMP003'],
        acknowledgedAt: new Date('2025-08-12'),
      },
    ],
  });

  console.log('  Documents: 10 (with versions & acknowledgements)');

  // ─── Non-Conformances (Pharma deviations & OOS) ─────────────────────
  const nc1 = await prisma.nonConformance.create({
    data: {
      tenantId: tenant.id,
      ncNumber: 'NC-2026-001',
      title: 'OOS — Paracetamol 500 mg Tablets Assay (Batch PCT-26-0142)',
      description:
        'Assay result for batch PCT-26-0142 of Paracetamol 500 mg tablets reported 94.2% (specification 95.0–105.0%) by HPLC. Phase I lab investigation completed; no analytical error identified. Phase II manufacturing investigation in progress.',
      type: 'OOS',
      severity: 'MAJOR',
      status: 'ROOT_CAUSE_ANALYSIS',
      disposition: 'PENDING',
      source: 'QC Finished Product Testing',
      departmentAffected: 'Quality Control',
      productProcess: 'Paracetamol 500 mg Tablets',
      batchLot: 'PCT-26-0142',
      containmentActions: {
        actions: [
          { description: 'Batch placed on QA hold; quarantined in BSR.', completedAt: '2026-03-15T10:30:00Z' },
          { description: 'Re-sampling and re-testing per OOS SOP performed.', completedAt: '2026-03-16T14:00:00Z' },
          { description: 'Hold notice issued to warehouse and dispatch.', completedAt: '2026-03-15T16:00:00Z' },
        ],
      },
      rootCauseAnalysis: {
        method: '5-Why + Ishikawa',
        findings: [
          'Why 1: Assay below LSL by 0.8%',
          'Why 2: Blend uniformity drift in granulation step',
          'Why 3: Granulator impeller speed variability ±50 rpm',
          'Why 4: VFD controller calibration drift',
          'Why 5: Calibration interval too long (annual vs recommended bi-annual)',
        ],
        rootCause: 'Granulator VFD calibration drift causing impeller speed variation impacting blend uniformity.',
      },
      reportedById: createdUsers['EMP003'],
      assignedToId: createdUsers['EMP002'],
      dueDate: new Date('2026-04-15'),
    },
  });

  const nc2 = await prisma.nonConformance.create({
    data: {
      tenantId: tenant.id,
      ncNumber: 'NC-2026-002',
      title: 'Deviation — Cleanroom Grade A Particle Excursion',
      description:
        'During aseptic vial filling on Line F-2, ≥5.0 µm particle count exceeded EU GMP Annex 1 Grade A limit (29 vs ≤20 per m³) for 7 minutes. Filling halted; batch impact under evaluation.',
      type: 'DEVIATION',
      severity: 'CRITICAL',
      status: 'CONTAINMENT',
      disposition: 'PENDING',
      source: 'Environmental Monitoring',
      departmentAffected: 'Sterile Manufacturing',
      productProcess: 'Aseptic Vial Filling - Line F-2',
      batchLot: 'INJ-26-0089',
      containmentActions: {
        actions: [
          { description: 'Filling line halted, area declared as compromised.', completedAt: '2026-03-20T09:00:00Z' },
          { description: 'Increased EM sampling frequency in Grade A zone.', completedAt: '2026-03-20T12:00:00Z' },
          { description: 'Investigation initiated for HEPA integrity & gowning.', completedAt: '2026-03-20T15:00:00Z' },
        ],
      },
      reportedById: createdUsers['EMP010'],
      assignedToId: createdUsers['EMP002'],
      dueDate: new Date('2026-04-05'),
    },
  });

  await prisma.nonConformance.create({
    data: {
      tenantId: tenant.id,
      ncNumber: 'NC-2026-003',
      title: 'Market Complaint — Discoloration of Amoxicillin 250 mg Capsules',
      description:
        'Customer (Apollo Pharmacy, Mumbai) reported brownish discoloration of capsule shells in 12 units from batch AMX-26-0411. Stability impact assessment underway.',
      type: 'COMPLAINT',
      severity: 'MAJOR',
      status: 'OPEN',
      disposition: 'PENDING',
      source: 'Market Complaint',
      departmentAffected: 'Quality Assurance',
      productProcess: 'Amoxicillin 250 mg Capsules',
      batchLot: 'AMX-26-0411',
      reportedById: createdUsers['EMP002'],
      assignedToId: createdUsers['EMP003'],
      dueDate: new Date('2026-04-10'),
    },
  });

  await prisma.nonConformance.create({
    data: {
      tenantId: tenant.id,
      ncNumber: 'NC-2025-018',
      title: 'Calibration Deviation — HPLC #3 Detector Wavelength',
      description:
        'Annual calibration of HPLC #3 (Agilent 1260) revealed UV detector wavelength deviation of 1.2 nm exceeding ±1.0 nm tolerance. Retrospective review of analyses performed since previous calibration completed and impact ruled out.',
      type: 'DEVIATION',
      severity: 'MINOR',
      status: 'CLOSED',
      disposition: 'USE_AS_IS',
      source: 'Internal Audit',
      departmentAffected: 'Quality Control',
      productProcess: 'QC Lab - HPLC',
      reportedById: createdUsers['EMP005'],
      assignedToId: createdUsers['EMP003'],
      dueDate: new Date('2025-12-15'),
      closedAt: new Date('2025-12-10'),
    },
  });

  await prisma.nonConformance.create({
    data: {
      tenantId: tenant.id,
      ncNumber: 'NC-2026-004',
      title: 'Deviation — Cold Chain Temperature Excursion',
      description:
        'Temperature mapping for cold storage room CR-02 logged excursion to 9.2°C for 32 minutes (specification 2–8°C) on 12-Mar-2026. Insulin batch INS-26-0067 stored therein under impact assessment.',
      type: 'DEVIATION',
      severity: 'MAJOR',
      status: 'UNDER_INVESTIGATION',
      disposition: 'PENDING',
      source: 'Warehouse Monitoring',
      departmentAffected: 'Warehouse',
      productProcess: 'Cold Storage CR-02',
      batchLot: 'INS-26-0067',
      reportedById: createdUsers['EMP004'],
      assignedToId: createdUsers['EMP002'],
      dueDate: new Date('2026-04-20'),
    },
  });

  console.log('  Non-Conformances: 5');

  // ─── CAPAs ──────────────────────────────────────────────────────────
  const capa1 = await prisma.cAPA.create({
    data: {
      tenantId: tenant.id,
      capaNumber: 'CAPA-2026-001',
      title: 'Granulator VFD Calibration & Blend Uniformity Improvement',
      description:
        'CAPA initiated to address OOS for Paracetamol 500 mg tablets caused by granulator VFD calibration drift (linked NC-2026-001).',
      source: 'NC',
      severity: 'MAJOR',
      status: 'ACTION_DEFINITION',
      sourceRecordId: nc1.id,
      sourceRecordType: 'NON_CONFORMANCE',
      department: 'Quality Assurance',
      site: 'Hyderabad - Unit I',
      productProcess: 'Granulation - Solid Orals',
      discoveryDate: new Date('2026-03-15'),
      dueDate: new Date('2026-05-15'),
      ownerId: createdUsers['EMP002'],
      rootCauseAnalysis: {
        method: '5-Why + Ishikawa',
        rootCauses: [
          'Granulator VFD calibration interval insufficient (annual)',
          'No automated blend uniformity SPC trending',
        ],
      },
      effectivenessCriteria:
        'Zero OOS results for assay/uniformity in next 5 commercial batches of Paracetamol 500 mg tablets.',
      monitoringPeriodDays: 90,
      nonConformances: { connect: [{ id: nc1.id }] },
      actions: {
        create: [
          {
            type: 'CORRECTIVE',
            description: 'Re-calibrate VFD on Granulator G-201 and reduce calibration interval to 6 months.',
            ownerId: createdUsers['EMP007'],
            dueDate: new Date('2026-04-01'),
          },
          {
            type: 'CORRECTIVE',
            description: 'Perform retrospective blend uniformity assessment for last 10 batches.',
            ownerId: createdUsers['EMP003'],
            dueDate: new Date('2026-04-15'),
          },
          {
            type: 'PREVENTIVE',
            description: 'Implement Statistical Process Control (SPC) trending for in-process blend uniformity.',
            ownerId: createdUsers['EMP002'],
            dueDate: new Date('2026-05-01'),
          },
          {
            type: 'PREVENTIVE',
            description: 'Add VFD calibration to weekly engineering walkdown checklist.',
            ownerId: createdUsers['EMP007'],
            dueDate: new Date('2026-04-30'),
          },
        ],
      },
    },
  });

  const capa2 = await prisma.cAPA.create({
    data: {
      tenantId: tenant.id,
      capaNumber: 'CAPA-2026-002',
      title: 'Aseptic Filling Line F-2 — HEPA & Gowning Program',
      description:
        'CAPA addressing Grade A particle excursion during aseptic filling. Includes HEPA integrity, smoke study and gowning re-qualification.',
      source: 'NC',
      severity: 'CRITICAL',
      status: 'IMPLEMENTATION',
      department: 'Sterile Manufacturing',
      site: 'Hyderabad - Unit I',
      productProcess: 'Aseptic Vial Filling Line F-2',
      discoveryDate: new Date('2026-03-20'),
      dueDate: new Date('2026-04-30'),
      ownerId: createdUsers['EMP006'],
      rootCauseAnalysis: {
        method: 'Fishbone Diagram',
        rootCauses: [
          'HEPA filter velocity reduced 12% from baseline',
          'Operator gowning re-qualification overdue for 3 personnel',
        ],
      },
      effectivenessCriteria:
        'No Grade A excursions in 60 consecutive aseptic operations days post-implementation.',
      monitoringPeriodDays: 60,
      nonConformances: { connect: [{ id: nc2.id }] },
      actions: {
        create: [
          {
            type: 'CORRECTIVE',
            description: 'Replace HEPA filters in Grade A zone of Line F-2 and verify with DOP test.',
            ownerId: createdUsers['EMP007'],
            dueDate: new Date('2026-04-01'),
            completionDate: new Date('2026-03-28'),
            verificationStatus: 'VERIFIED',
            verifiedById: createdUsers['EMP002'],
            verifiedAt: new Date('2026-03-29'),
          },
          {
            type: 'CORRECTIVE',
            description: 'Re-qualify all operators on aseptic gowning per WHO TRS 961 Annex 6.',
            ownerId: createdUsers['EMP008'],
            dueDate: new Date('2026-04-10'),
          },
          {
            type: 'PREVENTIVE',
            description: 'Implement quarterly smoke study (airflow visualization) for Grade A workstations.',
            ownerId: createdUsers['EMP010'],
            dueDate: new Date('2026-04-30'),
          },
        ],
      },
    },
  });

  await prisma.cAPA.create({
    data: {
      tenantId: tenant.id,
      capaNumber: 'CAPA-2025-012',
      title: 'HPLC Calibration Schedule Improvement',
      description: 'Preventive actions following calibration deviation on HPLC #3 (NC-2025-018).',
      source: 'AUDIT',
      severity: 'MINOR',
      status: 'CLOSED',
      department: 'Quality Control',
      site: 'Hyderabad - Unit I',
      productProcess: 'QC Lab - Instrumentation',
      discoveryDate: new Date('2025-11-15'),
      dueDate: new Date('2026-01-15'),
      closedAt: new Date('2026-01-10'),
      ownerId: createdUsers['EMP003'],
      rootCauseAnalysis: {
        method: '5-Why',
        rootCauses: ['Calibration tracking spreadsheet-based with no automated reminders'],
      },
      effectivenessCriteria: 'All instrument calibrations completed on-time for 6 months.',
      effectivenessResult: 'EFFECTIVE',
      effectivenessCheckDate: new Date('2026-03-10'),
      monitoringPeriodDays: 180,
      actions: {
        create: [
          {
            type: 'CORRECTIVE',
            description: 'Implemented automated CMS calibration tracking with email/SMS reminders.',
            ownerId: createdUsers['EMP003'],
            dueDate: new Date('2025-12-15'),
            completionDate: new Date('2025-12-12'),
            verificationStatus: 'VERIFIED',
            verifiedById: createdUsers['EMP002'],
            verifiedAt: new Date('2025-12-14'),
          },
          {
            type: 'PREVENTIVE',
            description: 'Added calibration KPI to daily QA huddle dashboard.',
            ownerId: createdUsers['EMP002'],
            dueDate: new Date('2026-01-05'),
            completionDate: new Date('2026-01-03'),
            verificationStatus: 'VERIFIED',
            verifiedById: createdUsers['EMP001'],
            verifiedAt: new Date('2026-01-08'),
          },
        ],
      },
    },
  });

  console.log('  CAPAs: 3');

  // ─── Risk Register (ICH Q9 quality risk management) ─────────────────
  await prisma.riskRegister.createMany({
    data: [
      {
        tenantId: tenant.id,
        riskNumber: 'RSK-001',
        title: 'Cross-Contamination Risk - Multi-Product Facility',
        description:
          'Risk of cross-contamination between potent oncology API products and conventional formulations sharing manufacturing & HVAC infrastructure.',
        category: 'Product Quality',
        department: 'Manufacturing',
        likelihood: 3,
        consequence: 5,
        riskScore: 15,
        riskLevel: 'HIGH',
        controlMeasures: {
          existing: ['Dedicated containment suites', 'PDE-based cleaning validation', 'Pressure cascade controls'],
          planned: ['Install dedicated AHU for potent compounds', 'Quarterly swab program expansion'],
        },
        residualLikelihood: 2,
        residualConsequence: 4,
        residualScore: 8,
        residualLevel: 'MEDIUM',
        ownerId: createdUsers['EMP002'],
        reviewDate: new Date('2026-09-30'),
      },
      {
        tenantId: tenant.id,
        riskNumber: 'RSK-002',
        title: 'API Single-Source Dependency - Sitagliptin',
        description:
          'Sitagliptin API supplied solely by Hetero Drugs Ltd. Supply disruption would halt anti-diabetic finished product manufacturing within 6 weeks.',
        category: 'Supply Chain',
        department: 'Procurement',
        likelihood: 3,
        consequence: 5,
        riskScore: 15,
        riskLevel: 'HIGH',
        controlMeasures: {
          existing: ['8-week safety stock', 'Quarterly supplier QMS reviews'],
          planned: ['Qualify alternate API source (Aurobindo)', 'Long-term supply agreement'],
        },
        residualLikelihood: 2,
        residualConsequence: 4,
        residualScore: 8,
        residualLevel: 'MEDIUM',
        ownerId: createdUsers['EMP002'],
        reviewDate: new Date('2026-06-30'),
      },
      {
        tenantId: tenant.id,
        riskNumber: 'RSK-003',
        title: 'Regulatory - USFDA Inspection Readiness',
        description:
          'Pre-Approval Inspection (PAI) by USFDA expected Q3 2026 for ANDA approval. Adverse outcome (Form 483 / Warning Letter) would delay launch by 12-18 months.',
        category: 'Regulatory',
        department: 'Regulatory Affairs',
        likelihood: 2,
        consequence: 5,
        riskScore: 10,
        riskLevel: 'HIGH',
        controlMeasures: {
          existing: ['Mock inspections every 6 months', 'GMP gap assessments', 'Data integrity audits'],
          planned: ['Engage external GMP consultant for pre-PAI assessment'],
        },
        residualLikelihood: 1,
        residualConsequence: 5,
        residualScore: 5,
        residualLevel: 'MEDIUM',
        ownerId: createdUsers['EMP005'],
        reviewDate: new Date('2026-05-31'),
      },
      {
        tenantId: tenant.id,
        riskNumber: 'RSK-004',
        title: 'Data Integrity - Standalone GxP Systems',
        description:
          'Risk of data integrity breaches in legacy standalone HPLC & dissolution systems lacking 21 CFR Part 11 audit trail.',
        category: 'Data Integrity',
        department: 'Quality Control',
        likelihood: 3,
        consequence: 4,
        riskScore: 12,
        riskLevel: 'HIGH',
        controlMeasures: {
          existing: ['Manual logbook reconciliation', 'Restricted user access'],
          planned: ['Migrate to Empower CDS', 'Decommission legacy stations by Q4 2026'],
        },
        residualLikelihood: 1,
        residualConsequence: 3,
        residualScore: 3,
        residualLevel: 'LOW',
        ownerId: createdUsers['EMP001'],
        reviewDate: new Date('2026-12-31'),
      },
      {
        tenantId: tenant.id,
        riskNumber: 'RSK-005',
        title: 'Cold Chain Excursion - Insulin Distribution',
        description:
          'Risk of temperature excursion during insulin distribution to Tier-2/3 cities with unreliable cold chain infrastructure.',
        category: 'Distribution',
        department: 'Supply Chain',
        likelihood: 4,
        consequence: 4,
        riskScore: 16,
        riskLevel: 'HIGH',
        controlMeasures: {
          existing: ['Validated cold chain shippers', 'Real-time GPS temperature loggers'],
          planned: ['Phase change material (PCM) for last-mile', 'Distributor cold chain audits'],
        },
        residualLikelihood: 2,
        residualConsequence: 3,
        residualScore: 6,
        residualLevel: 'MEDIUM',
        ownerId: createdUsers['EMP006'],
        reviewDate: new Date('2026-08-31'),
      },
      {
        tenantId: tenant.id,
        riskNumber: 'RSK-006',
        title: 'Microbiological Contamination - Water for Injection (WFI)',
        description:
          'Risk of microbial contamination in WFI distribution loop affecting parenteral product manufacturing.',
        category: 'Microbiology',
        department: 'Microbiology',
        likelihood: 2,
        consequence: 5,
        riskScore: 10,
        riskLevel: 'HIGH',
        controlMeasures: {
          existing: ['Continuous loop circulation 80°C', 'Daily TOC & conductivity monitoring', 'Weekly microbial sampling'],
          planned: ['Install ozone sanitization', 'Real-time bioburden sensor pilot'],
        },
        residualLikelihood: 1,
        residualConsequence: 5,
        residualScore: 5,
        residualLevel: 'MEDIUM',
        ownerId: createdUsers['EMP010'],
        reviewDate: new Date('2026-07-31'),
      },
    ],
  });

  console.log('  Risks: 6');

  // ─── Training Programs (Pharma cGMP curriculum) ─────────────────────
  const tGmp = await prisma.trainingProgram.create({
    data: {
      tenantId: tenant.id,
      title: 'cGMP Awareness — 21 CFR 210/211 & EU GMP',
      description: 'Comprehensive cGMP training covering 21 CFR Parts 210 & 211, EU GMP volume 4 chapters and Annexes.',
      type: 'CLASSROOM',
      content: {
        modules: [
          { title: 'Introduction to cGMP', durationMinutes: 60 },
          { title: '21 CFR 211 Subparts A–K', durationMinutes: 90 },
          { title: 'EU GMP Chapters 1-9 Overview', durationMinutes: 60 },
          { title: 'Documentation & Records', durationMinutes: 45 },
          { title: 'GMP Inspections & Form 483', durationMinutes: 30 },
        ],
      },
      assessmentQuestions: {
        questions: [
          { q: 'Under 21 CFR 211.192, who must investigate any unexplained discrepancy?', options: ['Production', 'QA', 'QC', 'Engineering'], answer: 1 },
          { q: 'EU GMP Annex 1 covers:', options: ['Computer Systems', 'Sterile Manufacturing', 'Active Substances', 'Qualification'], answer: 1 },
          { q: 'What does ALCOA+ stand for?', options: ['Audit logs only', 'Attributable, Legible, Contemporaneous, Original, Accurate +', 'A risk model', 'A regulation'], answer: 1 },
        ],
      },
      passingScore: 80,
      validityDays: 365,
    },
  });

  const tDev = await prisma.trainingProgram.create({
    data: {
      tenantId: tenant.id,
      title: 'Deviation, OOS & CAPA Investigation',
      description: 'OJT on identifying and investigating deviations, OOS, OOT, and managing CAPA effectiveness.',
      type: 'ON_THE_JOB',
      content: {
        modules: [
          { title: 'Deviation Identification & Classification', durationMinutes: 30 },
          { title: 'Phase I Lab vs Phase II Manufacturing OOS', durationMinutes: 60 },
          { title: 'Root Cause Analysis Techniques', durationMinutes: 60 },
          { title: 'CAPA Lifecycle & Effectiveness Verification', durationMinutes: 45 },
        ],
      },
      passingScore: 75,
      validityDays: 730,
    },
  });

  const tAseptic = await prisma.trainingProgram.create({
    data: {
      tenantId: tenant.id,
      title: 'Aseptic Technique & Gowning Qualification',
      description: 'Hands-on training and qualification for aseptic processing and Grade A/B gowning.',
      type: 'COMPETENCY_ASSESSMENT',
      content: {
        modules: [
          { title: 'Cleanroom Behavior', durationMinutes: 30 },
          { title: 'Gowning Procedure (Grade A/B)', durationMinutes: 45 },
          { title: 'Media Fill Participation', durationMinutes: 90 },
          { title: 'Aseptic Manipulations', durationMinutes: 60 },
        ],
      },
      passingScore: 95,
      validityDays: 180,
    },
  });

  const tDataInt = await prisma.trainingProgram.create({
    data: {
      tenantId: tenant.id,
      title: 'Data Integrity & ALCOA+',
      description: 'eLearning module covering FDA, MHRA & WHO data integrity guidelines and 21 CFR Part 11 compliance.',
      type: 'ELEARNING',
      content: {
        modules: [
          { title: 'ALCOA+ Principles', durationMinutes: 30 },
          { title: '21 CFR Part 11 Electronic Records', durationMinutes: 45 },
          { title: 'Audit Trail Review', durationMinutes: 30 },
          { title: 'Common DI Citations & Lessons Learned', durationMinutes: 30 },
        ],
      },
      passingScore: 85,
      validityDays: 365,
    },
  });

  const tPv = await prisma.trainingProgram.create({
    data: {
      tenantId: tenant.id,
      title: 'Pharmacovigilance Awareness',
      description: 'Regulatory training on adverse event reporting (ICSR), PSUR/PBRER and signal management.',
      type: 'REGULATORY',
      content: {
        modules: [
          { title: 'Pharmacovigilance Framework', durationMinutes: 45 },
          { title: 'ICSR Reporting Workflow', durationMinutes: 30 },
          { title: 'Periodic Safety Update Reports', durationMinutes: 30 },
        ],
      },
      passingScore: 80,
      validityDays: 365,
    },
  });

  await prisma.trainingProgram.create({
    data: {
      tenantId: tenant.id,
      title: 'Annual cGMP Refresher',
      description: 'Mandatory annual refresher on cGMP fundamentals for all GxP personnel.',
      type: 'REFRESHER',
      content: { modules: [{ title: 'GMP Refresher', durationMinutes: 60 }] },
      passingScore: 80,
      validityDays: 365,
    },
  });

  // Training assignments
  await prisma.trainingAssignment.createMany({
    data: [
      { programId: tGmp.id, userId: createdUsers['EMP003'], status: 'COMPLETED', assignedAt: new Date('2025-06-01'), completedAt: new Date('2025-06-15'), score: 92, expiresAt: new Date('2026-06-15') },
      { programId: tGmp.id, userId: createdUsers['EMP006'], status: 'COMPLETED', assignedAt: new Date('2025-06-01'), completedAt: new Date('2025-06-20'), score: 85, expiresAt: new Date('2026-06-20') },
      { programId: tGmp.id, userId: createdUsers['EMP004'], status: 'IN_PROGRESS', assignedAt: new Date('2026-03-01'), dueDate: new Date('2026-04-15') },
      { programId: tGmp.id, userId: createdUsers['EMP009'], status: 'NOT_STARTED', assignedAt: new Date('2026-03-15'), dueDate: new Date('2026-05-01') },
      { programId: tDev.id, userId: createdUsers['EMP003'], status: 'COMPLETED', assignedAt: new Date('2025-03-01'), completedAt: new Date('2025-03-20'), score: 88, expiresAt: new Date('2027-03-20') },
      { programId: tDev.id, userId: createdUsers['EMP006'], status: 'NOT_STARTED', assignedAt: new Date('2026-03-15'), dueDate: new Date('2026-04-30') },
      { programId: tAseptic.id, userId: createdUsers['EMP010'], status: 'COMPLETED', assignedAt: new Date('2025-10-01'), completedAt: new Date('2025-10-15'), score: 96, expiresAt: new Date('2026-04-15') },
      { programId: tAseptic.id, userId: createdUsers['EMP009'], status: 'OVERDUE', assignedAt: new Date('2026-01-10'), dueDate: new Date('2026-03-10') },
      { programId: tDataInt.id, userId: createdUsers['EMP001'], status: 'COMPLETED', assignedAt: new Date('2025-08-01'), completedAt: new Date('2025-08-05'), score: 94, expiresAt: new Date('2026-08-05') },
      { programId: tDataInt.id, userId: createdUsers['EMP003'], status: 'COMPLETED', assignedAt: new Date('2025-08-01'), completedAt: new Date('2025-08-07'), score: 89, expiresAt: new Date('2026-08-07') },
      { programId: tPv.id, userId: createdUsers['EMP002'], status: 'COMPLETED', assignedAt: new Date('2025-09-01'), completedAt: new Date('2025-09-12'), score: 91, expiresAt: new Date('2026-09-12') },
    ],
  });

  // Competency matrices
  await prisma.competencyMatrix.createMany({
    data: [
      { tenantId: tenant.id, roleOrUserId: 'QUALITY_ENGINEER', programId: tGmp.id, isRequired: true, proficiencyLevel: 'PROFICIENT', deadlineDays: 30, isRegulatoryMandatory: true },
      { tenantId: tenant.id, roleOrUserId: 'QUALITY_ENGINEER', programId: tDev.id, isRequired: true, proficiencyLevel: 'EXPERT', deadlineDays: 60, isRegulatoryMandatory: true },
      { tenantId: tenant.id, roleOrUserId: 'QUALITY_ENGINEER', programId: tDataInt.id, isRequired: true, proficiencyLevel: 'PROFICIENT', deadlineDays: 30, isRegulatoryMandatory: true },
      { tenantId: tenant.id, roleOrUserId: 'DEPARTMENT_HEAD', programId: tGmp.id, isRequired: true, proficiencyLevel: 'WORKING_KNOWLEDGE', deadlineDays: 60, isRegulatoryMandatory: true },
      { tenantId: tenant.id, roleOrUserId: 'TRAINEE', programId: tAseptic.id, isRequired: true, proficiencyLevel: 'PROFICIENT', deadlineDays: 30, isRegulatoryMandatory: true },
      { tenantId: tenant.id, roleOrUserId: 'AUDITOR', programId: tGmp.id, isRequired: true, proficiencyLevel: 'EXPERT', deadlineDays: 30, isRegulatoryMandatory: true },
      { tenantId: tenant.id, roleOrUserId: 'QUALITY_MANAGER', programId: tPv.id, isRequired: true, proficiencyLevel: 'WORKING_KNOWLEDGE', deadlineDays: 90, isRegulatoryMandatory: false },
    ],
  });

  console.log('  Training programs: 6, assignments: 11, competency mappings: 7');

  // ─── Audits & Findings ──────────────────────────────────────────────
  const audit1 = await prisma.audit.create({
    data: {
      tenantId: tenant.id,
      auditNumber: 'AUD-2026-001',
      title: 'Internal cGMP Audit — Solid Orals Block',
      type: 'INTERNAL',
      status: 'COMPLETED',
      standard: '21 CFR 211 / EU GMP Vol. 4',
      scope: 'Granulation, Compression, Coating & Packaging',
      department: 'Manufacturing - Solid Orals',
      leadAuditor: 'Vikram Patel',
      auditTeam: ['Vikram Patel', 'Rajesh Kumar'],
      plannedStart: new Date('2026-02-10'),
      plannedEnd: new Date('2026-02-13'),
      actualStart: new Date('2026-02-10'),
      actualEnd: new Date('2026-02-13'),
      createdById: createdUsers['EMP005'],
    },
  });

  await prisma.auditFinding.createMany({
    data: [
      { auditId: audit1.id, type: 'MAJOR', clause: '211.100(b)', description: 'Master Production Records lacked signature of preparer for 3 of 12 reviewed BMRs.', status: 'OPEN' },
      { auditId: audit1.id, type: 'MINOR', clause: '211.67', description: 'Cleaning logs for tablet press TP-04 missed entry on 03-Feb-2026.', status: 'CLOSED' },
      { auditId: audit1.id, type: 'OFI', clause: '211.180', description: 'Suggest digitizing equipment usage logs to improve traceability.', status: 'OPEN' },
    ],
  });

  await prisma.audit.create({
    data: {
      tenantId: tenant.id,
      auditNumber: 'AUD-2026-002',
      title: 'Supplier Audit — Hetero Drugs (Sitagliptin API)',
      type: 'SUPPLIER',
      status: 'IN_PROGRESS',
      standard: 'ICH Q7 - GMP for APIs',
      scope: 'API manufacturing, QC and warehouse for Sitagliptin',
      department: 'Quality Assurance',
      leadAuditor: 'Vikram Patel',
      auditTeam: ['Vikram Patel', 'Priya Sharma'],
      plannedStart: new Date('2026-04-22'),
      plannedEnd: new Date('2026-04-24'),
      actualStart: new Date('2026-04-22'),
      createdById: createdUsers['EMP005'],
    },
  });

  const audit3 = await prisma.audit.create({
    data: {
      tenantId: tenant.id,
      auditNumber: 'AUD-2026-003',
      title: 'USFDA Pre-Approval Inspection (Mock)',
      type: 'INTERNAL',
      status: 'PLANNED',
      standard: '21 CFR 210/211 + 21 CFR Part 11',
      scope: 'Site-wide PAI readiness',
      department: 'Site',
      leadAuditor: 'External Consultant - Dr. R. Iyer',
      auditTeam: ['External Consultant', 'Vikram Patel', 'Priya Sharma'],
      plannedStart: new Date('2026-06-15'),
      plannedEnd: new Date('2026-06-19'),
      createdById: createdUsers['EMP002'],
    },
  });

  await prisma.audit.create({
    data: {
      tenantId: tenant.id,
      auditNumber: 'AUD-2025-014',
      title: 'EU GMP Annex 1 Compliance Audit — Sterile Block',
      type: 'CERTIFICATION',
      status: 'COMPLETED',
      standard: 'EU GMP Annex 1 (2022 Revision)',
      scope: 'Aseptic processing area, EM program, Sterilization',
      department: 'Sterile Manufacturing',
      leadAuditor: 'External - TÜV SÜD',
      auditTeam: ['TÜV SÜD Auditor', 'Kavita Menon'],
      plannedStart: new Date('2025-11-10'),
      plannedEnd: new Date('2025-11-12'),
      actualStart: new Date('2025-11-10'),
      actualEnd: new Date('2025-11-12'),
      createdById: createdUsers['EMP005'],
    },
  });

  console.log('  Audits: 4 (with findings)');

  // ─── FMEA ───────────────────────────────────────────────────────────
  const fmea1 = await prisma.fMEARecord.create({
    data: {
      tenantId: tenant.id,
      fmeaNumber: 'FMEA-2026-001',
      title: 'Process FMEA — Tablet Compression',
      type: 'PROCESS',
      productProcess: 'Paracetamol 500 mg Tablet Compression',
      teamMembers: 'Sunita Rao (Production), Rajesh Kumar (QC), Mohammed Iqbal (Validation), Priya Sharma (QA)',
      scope: 'Tablet press TP-04, ancillary feeders and weight check stations.',
      status: 'APPROVED',
      createdById: createdUsers['EMP007'],
    },
  });

  await prisma.fMEAFailureMode.createMany({
    data: [
      {
        fmeaId: fmea1.id,
        function: 'Maintain tablet weight within ±5%',
        failureMode: 'Tablet weight variation exceeds limits',
        effect: 'Sub-potent or super-potent tablets, batch rejection',
        severity: 8,
        cause: 'Force feeder paddle worn',
        occurrence: 4,
        preventionControl: 'Quarterly preventive maintenance',
        detectionControl: 'In-process automatic weight check every 15 min',
        detection: 3,
        rpn: 96,
        recommendedAction: 'Reduce PM interval to monthly; install real-time SPC',
        responsible: 'Sunita Rao',
        targetDate: new Date('2026-06-30'),
      },
      {
        fmeaId: fmea1.id,
        function: 'Maintain tablet hardness 5–8 kp',
        failureMode: 'Tablet hardness out of range',
        effect: 'Disintegration / dissolution failure',
        severity: 7,
        cause: 'Compression force drift',
        occurrence: 3,
        preventionControl: 'Force monitoring system (FMS)',
        detectionControl: 'Hardness check every 30 min',
        detection: 2,
        rpn: 42,
        recommendedAction: 'Auto-feedback loop linking FMS to upper punch.',
        responsible: 'Mohammed Iqbal',
        targetDate: new Date('2026-07-31'),
      },
      {
        fmeaId: fmea1.id,
        function: 'Prevent foreign particle inclusion',
        failureMode: 'Metal contamination',
        effect: 'Patient safety risk, recall',
        severity: 10,
        cause: 'Tooling wear / breakage',
        occurrence: 2,
        preventionControl: 'Tool inspection per batch',
        detectionControl: 'Metal detector at end of compression line',
        detection: 1,
        rpn: 20,
        recommendedAction: 'Maintain current controls; revalidate metal detector annually.',
        responsible: 'Rajesh Kumar',
        targetDate: new Date('2026-12-31'),
      },
    ],
  });

  const fmea2 = await prisma.fMEARecord.create({
    data: {
      tenantId: tenant.id,
      fmeaNumber: 'FMEA-2026-002',
      title: 'Process FMEA — Aseptic Vial Filling',
      type: 'PROCESS',
      productProcess: 'Sterile Insulin Vial Filling Line F-2',
      teamMembers: 'Kavita Menon (Micro), Priya Sharma (QA), Mohammed Iqbal (Validation), Sunita Rao (Production)',
      scope: 'Filling needle, stoppering, capping, EM points.',
      status: 'DRAFT',
      createdById: createdUsers['EMP010'],
    },
  });

  await prisma.fMEAFailureMode.createMany({
    data: [
      {
        fmeaId: fmea2.id,
        function: 'Maintain Grade A air quality',
        failureMode: 'Particle excursion in Grade A zone',
        effect: 'Sterility failure / batch rejection',
        severity: 9,
        cause: 'HEPA filter degradation',
        occurrence: 3,
        preventionControl: 'Annual HEPA integrity test',
        detectionControl: 'Continuous viable & non-viable particle monitoring',
        detection: 2,
        rpn: 54,
        recommendedAction: 'Reduce HEPA integrity test interval to 6 months for Grade A.',
        responsible: 'Mohammed Iqbal',
        targetDate: new Date('2026-08-31'),
      },
      {
        fmeaId: fmea2.id,
        function: 'Achieve correct fill volume (1.0 mL ±2%)',
        failureMode: 'Underfill / overfill',
        effect: 'Sub-potent dose / waste',
        severity: 7,
        cause: 'Pump syringe wear',
        occurrence: 4,
        preventionControl: 'Syringe replacement every 6 months',
        detectionControl: 'In-line check weighing 100%',
        detection: 2,
        rpn: 56,
        recommendedAction: 'Predictive maintenance via flow sensor trending.',
        responsible: 'Mohammed Iqbal',
        targetDate: new Date('2026-09-30'),
      },
    ],
  });

  console.log('  FMEAs: 2 (with failure modes)');

  // ─── Compliance Requirements ────────────────────────────────────────
  await prisma.complianceRequirement.createMany({
    data: [
      { tenantId: tenant.id, standard: '21 CFR Part 211', clauseNumber: '211.22', clauseTitle: 'Responsibilities of QCU', requirementText: 'Establish a Quality Control Unit with the responsibility and authority to approve or reject components, in-process materials, packaging materials, labeling and drug products.', status: 'COMPLIANT', evidence: 'QA Org Chart QA-ORG-001 v3.0; Job Descriptions JD-QA-001 to JD-QA-008.', owner: 'Priya Sharma', nextReview: new Date('2026-12-31') },
      { tenantId: tenant.id, standard: '21 CFR Part 211', clauseNumber: '211.100', clauseTitle: 'Written procedures; deviations', requirementText: 'There shall be written procedures for production and process control designed to assure that drug products have the identity, strength, quality, and purity they purport.', status: 'COMPLIANT', evidence: 'SOP Master List MFG-SOP-LST-001; BMR Index.', owner: 'Sunita Rao', nextReview: new Date('2026-09-30') },
      { tenantId: tenant.id, standard: '21 CFR Part 211', clauseNumber: '211.192', clauseTitle: 'Production record review', requirementText: 'All drug product production and control records shall be reviewed and approved by the quality control unit. Any unexplained discrepancy shall be thoroughly investigated.', status: 'PARTIAL', evidence: 'Deviation SOP L2-QMS-001 v5.2; OOS investigations log Q1-2026.', owner: 'Priya Sharma', nextReview: new Date('2026-06-30') },
      { tenantId: tenant.id, standard: '21 CFR Part 11', clauseNumber: '11.10(e)', clauseTitle: 'Audit trails', requirementText: 'Use of secure, computer-generated, time-stamped audit trails to independently record the date and time of operator entries and actions.', status: 'PARTIAL', evidence: 'Empower 3 CDS audit trail review SOP. Legacy systems pending migration.', owner: 'Rajesh Kumar', nextReview: new Date('2026-06-30') },
      { tenantId: tenant.id, standard: 'EU GMP Annex 1', clauseNumber: '4.29', clauseTitle: 'Environmental & process monitoring', requirementText: 'Continuous monitoring of viable and non-viable particulates in Grade A and B areas during operations.', status: 'COMPLIANT', evidence: 'EM SOP L3-MICRO-001 v2.0; Continuous EM trend reports.', owner: 'Kavita Menon', nextReview: new Date('2026-12-31') },
      { tenantId: tenant.id, standard: 'EU GMP Annex 1', clauseNumber: '8.40', clauseTitle: 'Sterilization', requirementText: 'Sterilization processes must be validated and revalidated at least annually.', status: 'COMPLIANT', evidence: 'Autoclave PQ Report VAL-PQ-2025-08; Annual revalidation schedule.', owner: 'Mohammed Iqbal', nextReview: new Date('2026-08-31') },
      { tenantId: tenant.id, standard: 'ICH Q7', clauseNumber: '7.30', clauseTitle: 'Sampling and testing of incoming production materials', requirementText: 'At least one test to verify the identity of each batch of material should be conducted.', status: 'COMPLIANT', evidence: 'QC Sampling SOP L3-QC-002; Material approval log.', owner: 'Rajesh Kumar', nextReview: new Date('2026-12-31') },
      { tenantId: tenant.id, standard: 'ICH Q9', clauseNumber: 'Annex II', clauseTitle: 'Risk management methods - FMEA, HAZOP', requirementText: 'Quality risk management should be applied to manufacturing processes using formal tools.', status: 'COMPLIANT', evidence: 'QRM SOP L2-QMS-005; FMEA records FMEA-2026-001/002.', owner: 'Priya Sharma', nextReview: new Date('2026-12-31') },
      { tenantId: tenant.id, standard: 'ICH Q10', clauseNumber: '3.2', clauseTitle: 'Management responsibility', requirementText: 'Senior management has the ultimate responsibility to ensure an effective pharmaceutical quality system.', status: 'COMPLIANT', evidence: 'Management Review minutes MR-Q1-2026.', owner: 'Ashish Pandit', nextReview: new Date('2026-06-30') },
      { tenantId: tenant.id, standard: 'WHO TRS 996', clauseNumber: 'Annex 5', clauseTitle: 'Data management & integrity', requirementText: 'Data should be maintained as per ALCOA+ principles throughout the lifecycle.', status: 'NOT_ASSESSED', evidence: null, owner: 'Anita Desai', nextReview: new Date('2026-05-15') },
    ],
  });

  console.log('  Compliance requirements: 10');

  // ─── Suppliers ──────────────────────────────────────────────────────
  const sup1 = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      supplierCode: 'SUP-API-001',
      companyName: 'Hetero Drugs Limited',
      category: 'Active Pharmaceutical Ingredient',
      status: 'APPROVED',
      riskRating: 'HIGH',
      contactPerson: 'V. Ramesh',
      email: 'qa@heterodrugs.com',
      phone: '+91-40-23704923',
      address: '7-2-A2, Hetero Corporate, Industrial Estates',
      city: 'Hyderabad',
      country: 'India',
      productsServices: 'Sitagliptin API, Atorvastatin API, Metformin HCl',
      qualityScore: 88.5,
      deliveryScore: 92.0,
    },
  });

  const sup2 = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      supplierCode: 'SUP-API-002',
      companyName: 'Aurobindo Pharma Ltd',
      category: 'Active Pharmaceutical Ingredient',
      status: 'CONDITIONAL',
      riskRating: 'MEDIUM',
      contactPerson: 'Lakshmi Narayan',
      email: 'supplier.qa@aurobindo.com',
      phone: '+91-40-66725000',
      address: 'Plot No. 2, Maitri Vihar, Ameerpet',
      city: 'Hyderabad',
      country: 'India',
      productsServices: 'Amoxicillin Trihydrate, Cefuroxime Axetil',
      qualityScore: 79.5,
      deliveryScore: 85.0,
    },
  });

  const sup3 = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      supplierCode: 'SUP-EXC-001',
      companyName: 'Colorcon Asia Pvt Ltd',
      category: 'Excipient & Coating',
      status: 'APPROVED',
      riskRating: 'LOW',
      contactPerson: 'Anjali Mehta',
      email: 'a.mehta@colorcon.com',
      phone: '+91-22-25890605',
      address: 'Plot No. 70, MIDC, Thane Belapur Road',
      city: 'Thane',
      country: 'India',
      productsServices: 'Opadry film coating, Starch 1500',
      qualityScore: 95.0,
      deliveryScore: 96.5,
    },
  });

  const sup4 = await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      supplierCode: 'SUP-PKG-001',
      companyName: 'Schott Kaisha Pvt Ltd',
      category: 'Primary Packaging',
      status: 'APPROVED',
      riskRating: 'MEDIUM',
      contactPerson: 'Ravi Shankar',
      email: 'qa.india@schott.com',
      phone: '+91-22-26527979',
      address: 'B-203 Mittal Tower, Nariman Point',
      city: 'Mumbai',
      country: 'India',
      productsServices: 'Glass vials (Type I), Ampoules, Cartridges',
      qualityScore: 91.0,
      deliveryScore: 88.0,
    },
  });

  await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      supplierCode: 'SUP-LAB-001',
      companyName: 'Sigma-Aldrich (Merck Life Science)',
      category: 'Lab Reagents & Reference Standards',
      status: 'APPROVED',
      riskRating: 'LOW',
      contactPerson: 'Customer Care India',
      email: 'cs.india@merckgroup.com',
      address: 'Godrej One, Pirojshanagar, Vikhroli (E)',
      city: 'Mumbai',
      country: 'India',
      productsServices: 'USP/EP reference standards, HPLC reagents',
      qualityScore: 98.0,
      deliveryScore: 94.0,
    },
  });

  await prisma.supplier.create({
    data: {
      tenantId: tenant.id,
      supplierCode: 'SUP-API-003',
      companyName: 'Generic Chem Corp',
      category: 'Active Pharmaceutical Ingredient',
      status: 'SUSPENDED',
      riskRating: 'HIGH',
      contactPerson: 'Withheld',
      email: 'support@genericchem.example',
      address: 'Industrial Park Block C',
      city: 'Ahmedabad',
      country: 'India',
      productsServices: 'Loratadine API (suspended after 2 batch failures)',
      qualityScore: 52.0,
      deliveryScore: 70.0,
    },
  });

  await prisma.supplierCertification.createMany({
    data: [
      { supplierId: sup1.id, name: 'WHO-GMP', certificateNumber: 'WHO-GMP/2024/HET-018', issuedBy: 'CDSCO', expiryDate: new Date('2027-03-31') },
      { supplierId: sup1.id, name: 'USFDA EIR (Acceptable)', certificateNumber: 'EIR-2024-HET-API', issuedBy: 'USFDA', expiryDate: new Date('2027-06-30') },
      { supplierId: sup2.id, name: 'EU GMP', certificateNumber: 'EU-GMP-2025-AUR-014', issuedBy: 'EDQM', expiryDate: new Date('2027-12-31') },
      { supplierId: sup3.id, name: 'ISO 9001:2015', certificateNumber: 'ISO9001-COL-2025', issuedBy: 'BSI', expiryDate: new Date('2028-01-15') },
      { supplierId: sup4.id, name: 'ISO 15378', certificateNumber: 'ISO15378-SCH-2024', issuedBy: 'TÜV', expiryDate: new Date('2027-09-30') },
    ],
  });

  await prisma.supplierScore.createMany({
    data: [
      { tenantId: tenant.id, supplierId: sup1.id, fiscalYear: 2025, score: 88.0, grade: 'A', passRate: 96.0, capaClosureRate: 90.0, auditScore: 78.0, prevScore: 82.0 },
      { tenantId: tenant.id, supplierId: sup2.id, fiscalYear: 2025, score: 75.0, grade: 'B', passRate: 88.0, capaClosureRate: 78.0, auditScore: 65.0, prevScore: 81.0 },
      { tenantId: tenant.id, supplierId: sup3.id, fiscalYear: 2025, score: 95.5, grade: 'A', passRate: 99.0, capaClosureRate: 95.0, auditScore: 92.0, prevScore: 94.0 },
      { tenantId: tenant.id, supplierId: sup4.id, fiscalYear: 2025, score: 90.0, grade: 'A', passRate: 94.0, capaClosureRate: 92.0, auditScore: 84.0, prevScore: 87.0 },
    ],
  });

  console.log('  Suppliers: 6 (with certifications & scorecards)');

  // ─── Change Requests ────────────────────────────────────────────────
  await prisma.changeRequest.createMany({
    data: [
      {
        tenantId: tenant.id,
        changeNumber: 'CC-2026-001',
        title: 'Change in Sitagliptin API Source — Add Aurobindo as Alternate',
        type: 'SUPPLIER',
        priority: 'HIGH',
        status: 'UNDER_EVALUATION',
        description: 'Qualify Aurobindo Pharma as alternate source for Sitagliptin API to mitigate single-source dependency risk.',
        justification: 'RSK-002 mitigation; supply assurance for anti-diabetic finished products.',
        riskAssessment: 'Comparative API characterization, equivalency studies, 3-batch process validation required prior to approval.',
        implementationPlan: 'Phase 1: API qualification (Q2 2026), Phase 2: PV batches (Q3 2026), Phase 3: Regulatory CBE-30 (Q4 2026).',
        createdById: createdUsers['EMP002'],
      },
      {
        tenantId: tenant.id,
        changeNumber: 'CC-2026-002',
        title: 'Equipment Replacement — HPLC #3 (Agilent 1260 → 1290 Infinity II)',
        type: 'SYSTEM',
        priority: 'MEDIUM',
        status: 'APPROVED',
        description: 'Replace ageing HPLC #3 with Agilent 1290 Infinity II UHPLC having 21 CFR Part 11 compliant CDS.',
        justification: 'Improved data integrity, faster runtime, end-of-life on existing system.',
        riskAssessment: 'Method transfer required for 14 active assays. Comparative data and equivalency study planned.',
        implementationPlan: 'IQ/OQ/PQ Q2 2026; Method transfer Q3 2026.',
        createdById: createdUsers['EMP003'],
      },
      {
        tenantId: tenant.id,
        changeNumber: 'CC-2026-003',
        title: 'Specification Update — Paracetamol Tablets (Dissolution Q-value)',
        type: 'PRODUCT',
        priority: 'HIGH',
        status: 'IMPLEMENTED',
        description: 'Tighten dissolution Q-value from Q=80% to Q=85% at 30 minutes for Paracetamol 500 mg tablets.',
        justification: 'Customer (Cipla) commercial agreement requires tighter spec; aligns with USP harmonization.',
        riskAssessment: 'Historical data shows 99.2% of last 50 batches meet Q=85%; minimal risk.',
        implementationPlan: 'Specification revision SPC-PCT-001 Rev 6 effective 01-Apr-2026.',
        createdById: createdUsers['EMP002'],
      },
      {
        tenantId: tenant.id,
        changeNumber: 'CC-2026-004',
        title: 'Process Change — Direct Compression for Metformin 500 mg',
        type: 'PROCESS',
        priority: 'MEDIUM',
        status: 'DRAFT',
        description: 'Convert Metformin 500 mg from wet granulation to direct compression process.',
        justification: 'Reduce processing time by 40%, eliminate drying step, lower energy consumption.',
        riskAssessment: 'Pending FMEA and 3-batch validation; flow & compressibility studies required.',
        implementationPlan: 'TBD pending feasibility study completion.',
        createdById: createdUsers['EMP006'],
      },
      {
        tenantId: tenant.id,
        changeNumber: 'CC-2025-027',
        title: 'Regulatory Change — EU GMP Annex 1 (2022 Revision) Implementation',
        type: 'REGULATORY',
        priority: 'CRITICAL',
        status: 'IMPLEMENTED',
        description: 'Implement updated EU GMP Annex 1 (2022) requirements for sterile manufacturing.',
        justification: 'Mandatory regulatory compliance; effective date 25-Aug-2023.',
        riskAssessment: 'Gap assessment identified 23 requirements; 21 closed, 2 in CAPA-2026-002.',
        implementationPlan: 'Completed CCS, gowning re-qualification, smoke studies and EM program update.',
        createdById: createdUsers['EMP002'],
      },
    ],
  });

  console.log('  Change Requests: 5');

  // ─── Complaints ─────────────────────────────────────────────────────
  await prisma.complaint.createMany({
    data: [
      {
        tenantId: tenant.id,
        complaintNumber: 'CMP-2026-001',
        title: 'Discoloration of Amoxicillin 250 mg Capsules',
        source: 'CUSTOMER',
        severity: 'HIGH',
        status: 'UNDER_INVESTIGATION',
        customerName: 'Apollo Pharmacy, Mumbai',
        productService: 'Amoxicillin 250 mg Capsules - Batch AMX-26-0411',
        description: 'Customer reported brownish discoloration of capsule shells in 12 of 100 capsules from one strip.',
        immediateAction: 'Mock recall initiated for batch AMX-26-0411; retain samples pulled for stability re-evaluation.',
        rootCause: 'Investigation in progress — suspected gelatin shell sensitivity to elevated humidity in distribution.',
        createdById: createdUsers['EMP002'],
      },
      {
        tenantId: tenant.id,
        complaintNumber: 'CMP-2026-002',
        title: 'Tablet Chipping — Atorvastatin 20 mg',
        source: 'CUSTOMER',
        severity: 'MEDIUM',
        status: 'CLOSED',
        customerName: 'Medplus Health Services, Bangalore',
        productService: 'Atorvastatin 20 mg Tablets - Batch ATV-25-0982',
        description: 'Cosmetic chipping of tablet edges observed in 4 tablets from blister.',
        immediateAction: 'Retained samples evaluated; no chipping observed in retain.',
        rootCause: 'Mishandling during transit (mechanical impact); not a manufacturing defect.',
        correctiveAction: 'Customer educated on proper handling; complaint closed as not-product-related.',
        closedAt: new Date('2026-02-20'),
        createdById: createdUsers['EMP003'],
      },
      {
        tenantId: tenant.id,
        complaintNumber: 'CMP-2026-003',
        title: 'ADR Report — Metformin 500 mg (Gastric upset)',
        source: 'REGULATORY',
        severity: 'LOW',
        status: 'CLOSED',
        customerName: 'CDSCO PvPI India',
        productService: 'Metformin 500 mg Tablets - Batch MET-25-1124',
        description: 'Adverse Drug Reaction case received via PvPI: gastric upset in 2 patients on initiation.',
        immediateAction: 'ICSR submitted to PvPI within 15 days; medical review completed.',
        rootCause: 'Known labeled adverse effect; expected under product label.',
        correctiveAction: 'No CAPA required; recorded in PSUR for next reporting period.',
        closedAt: new Date('2026-01-30'),
        createdById: createdUsers['EMP002'],
      },
      {
        tenantId: tenant.id,
        complaintNumber: 'CMP-2026-004',
        title: 'Internal — Misprint on Insulin Vial Carton',
        source: 'INTERNAL',
        severity: 'HIGH',
        status: 'UNDER_INVESTIGATION',
        customerName: 'Internal QA',
        productService: 'Insulin Glargine 100 IU/mL Vial - Batch INS-26-0067',
        description: 'In-process check identified misprint of expiry date on 28 cartons of batch INS-26-0067.',
        immediateAction: 'Affected cartons segregated; line stopped pending investigation.',
        rootCause: 'Investigation in progress — suspected printer ribbon malfunction.',
        createdById: createdUsers['EMP004'],
      },
    ],
  });

  console.log('  Complaints: 4');

  // ─── Management Reviews ─────────────────────────────────────────────
  await prisma.managementReview.createMany({
    data: [
      {
        tenantId: tenant.id,
        title: 'Q1 2026 Management Review — Aurora BioPharma',
        date: new Date('2026-04-08'),
        time: '10:00 IST',
        status: 'Completed',
        agenda: [
          'Review of Quality KPIs (NCs, CAPAs, OOS trends)',
          'Status of regulatory inspections & commitments',
          'Customer complaints & market actions',
          'Supplier performance review',
          'Training compliance status',
          'Resource & capability gaps',
          'Risk register status & mitigation actions',
        ],
        attendees: [
          { name: 'Dr. Ashish Pandit', role: 'Site Head', status: 'Present' },
          { name: 'Dr. Priya Sharma', role: 'QA Head', status: 'Present' },
          { name: 'Sunita Rao', role: 'Production Head', status: 'Present' },
          { name: 'Rajesh Kumar', role: 'QC Head', status: 'Present' },
          { name: 'Mohammed Iqbal', role: 'Validation Lead', status: 'Present' },
        ],
        minutesSummary:
          'Q1 2026 NC count down 12% vs Q4 2025; OTIF on CAPA closure improved to 87%. Two open major audit observations from internal audit being addressed via CAPA-2026-001/002. PAI mock scheduled June 2026.',
        actionItems: [
          { id: 1, item: 'Close CAPA-2026-001 by 15-May-2026', owner: 'Priya Sharma', dueDate: '2026-05-15', status: 'In Progress' },
          { id: 2, item: 'Engage external consultant for PAI mock', owner: 'Vikram Patel', dueDate: '2026-05-01', status: 'In Progress' },
          { id: 3, item: 'Approve capital for HPLC #3 replacement', owner: 'Ashish Pandit', dueDate: '2026-04-30', status: 'Closed' },
        ],
        createdById: createdUsers['EMP001'],
      },
      {
        tenantId: tenant.id,
        title: 'Q2 2026 Management Review — Aurora BioPharma',
        date: new Date('2026-07-10'),
        time: '10:00 IST',
        status: 'Scheduled',
        agenda: [
          'Mock USFDA PAI outcome review',
          'CAPA effectiveness verification status',
          'Annual Product Quality Review (APQR) progress',
          'Supplier scorecard 2025 finalization',
        ],
        attendees: [
          { name: 'Dr. Ashish Pandit', role: 'Site Head', status: 'Invited' },
          { name: 'Dr. Priya Sharma', role: 'QA Head', status: 'Invited' },
          { name: 'Vikram Patel', role: 'Auditor', status: 'Invited' },
        ],
        minutesSummary: null,
        actionItems: [],
        createdById: createdUsers['EMP001'],
      },
      {
        tenantId: tenant.id,
        title: 'Q4 2025 Management Review — Aurora BioPharma',
        date: new Date('2026-01-12'),
        time: '11:00 IST',
        status: 'Completed',
        agenda: [
          'Annual quality KPI review',
          'TÜV SÜD audit findings closure',
          'Annex 1 implementation closeout',
          'Budget approval for 2026 quality initiatives',
        ],
        attendees: [
          { name: 'Dr. Ashish Pandit', role: 'Site Head', status: 'Present' },
          { name: 'Dr. Priya Sharma', role: 'QA Head', status: 'Present' },
          { name: 'Sunita Rao', role: 'Production Head', status: 'Present' },
        ],
        minutesSummary:
          '2025 annual quality KPIs largely met; first-pass batch yield 96.8%, OTIF 92%. EU GMP Annex 1 implementation complete. Budget of INR 4.2 Cr approved for 2026 initiatives including HPLC replacement and ozone sanitization.',
        actionItems: [
          { id: 1, item: 'Close all TÜV SÜD findings', owner: 'Kavita Menon', dueDate: '2026-02-28', status: 'Closed' },
          { id: 2, item: 'Initiate procurement for ozone sanitization', owner: 'Mohammed Iqbal', dueDate: '2026-03-31', status: 'Closed' },
        ],
        createdById: createdUsers['EMP001'],
      },
    ],
  });

  console.log('  Management Reviews: 3');

  // ─── Notifications ──────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: createdUsers['EMP002'],
        type: 'APPROVAL_REQUIRED',
        title: 'CAPA-2026-001 awaiting QA Manager approval',
        message: 'CAPA for granulator VFD calibration improvement is in your approval queue (SLA 5 days).',
        entityType: 'CAPA',
        entityId: capa1.id,
        isRead: false,
      },
      {
        tenantId: tenant.id,
        userId: createdUsers['EMP003'],
        type: 'ASSIGNMENT',
        title: 'NC-2026-003 assigned to you',
        message: 'You have been assigned the customer complaint investigation for Amoxicillin 250 mg capsules discoloration.',
        entityType: 'NON_CONFORMANCE',
        entityId: nc1.id,
        isRead: true,
        readAt: new Date('2026-03-25T08:32:00Z'),
      },
      {
        tenantId: tenant.id,
        userId: createdUsers['EMP010'],
        type: 'OVERDUE',
        title: 'Document acknowledgement overdue',
        message: 'Acknowledgement for SOP L2-QMS-001 v5.2 (Deviation & OOS Investigation) is overdue.',
        entityType: 'DOCUMENT',
        entityId: doc2.id,
        isRead: false,
      },
      {
        tenantId: tenant.id,
        userId: createdUsers['EMP009'],
        type: 'EXPIRY_WARNING',
        title: 'Aseptic gowning qualification expiring',
        message: 'Your aseptic gowning qualification expires in 14 days. Please re-qualify.',
        entityType: 'TRAINING',
        entityId: tAseptic.id,
        isRead: false,
      },
      {
        tenantId: tenant.id,
        userId: createdUsers['EMP001'],
        type: 'SYSTEM_ALERT',
        title: 'USFDA PAI mock — 60 days countdown',
        message: 'Mock USFDA Pre-Approval Inspection scheduled for 15-Jun-2026. Readiness review due 15-May-2026.',
        entityType: 'AUDIT',
        entityId: audit3.id,
        isRead: false,
      },
      {
        tenantId: tenant.id,
        userId: createdUsers['EMP006'],
        type: 'WORKFLOW_TRANSITION',
        title: 'NC-2026-002 moved to CONTAINMENT',
        message: 'Aseptic Filling Line F-2 particle excursion deviation transitioned to Containment phase.',
        entityType: 'NON_CONFORMANCE',
        entityId: nc2.id,
        isRead: true,
        readAt: new Date('2026-03-21T11:15:00Z'),
      },
      {
        tenantId: tenant.id,
        userId: createdUsers['EMP004'],
        type: 'REJECTION',
        title: 'Document L2-DI-001 returned for revision',
        message: 'SOP — Data Integrity & ALCOA+ Compliance returned with QC review comments.',
        entityType: 'DOCUMENT',
        entityId: docDraft.id,
        isRead: false,
      },
    ],
  });

  console.log('  Notifications: 7');

  // ─── Approval Requests & Actions ────────────────────────────────────
  const ar1 = await prisma.approvalRequest.create({
    data: {
      tenantId: tenant.id,
      workflowId: wfDoc.id,
      entityType: 'DOCUMENT',
      entityId: docDraft.id,
      currentStage: 1,
      status: 'PENDING',
      requestedById: createdUsers['EMP002'],
    },
  });

  await prisma.approvalAction.create({
    data: {
      approvalRequestId: ar1.id,
      stage: 1,
      action: 'RETURNED',
      userId: createdUsers['EMP003'],
      userName: 'Rajesh Kumar',
      comment: 'Section 6.4 needs alignment with FDA Data Integrity Guidance 2018; please add ALCOA+ definitions in Annex A.',
    },
  });

  const ar2 = await prisma.approvalRequest.create({
    data: {
      tenantId: tenant.id,
      workflowId: wfDoc.id,
      entityType: 'DOCUMENT',
      entityId: doc2.id,
      currentStage: 3,
      status: 'APPROVED',
      requestedById: createdUsers['EMP002'],
      completedAt: new Date('2026-02-01'),
    },
  });

  await prisma.approvalAction.createMany({
    data: [
      { approvalRequestId: ar2.id, stage: 1, action: 'APPROVED', userId: createdUsers['EMP003'], userName: 'Rajesh Kumar', comment: 'QC review complete; technically sound.', actionAt: new Date('2026-01-25') },
      { approvalRequestId: ar2.id, stage: 2, action: 'APPROVED', userId: createdUsers['EMP002'], userName: 'Dr. Priya Sharma', comment: 'QA approved.', actionAt: new Date('2026-01-29') },
      { approvalRequestId: ar2.id, stage: 3, action: 'APPROVED', userId: createdUsers['EMP001'], userName: 'Dr. Ashish Pandit', comment: 'Authorized for release.', actionAt: new Date('2026-02-01') },
    ],
  });

  console.log('  Approval requests: 2 (with actions)');

  // ─── Electronic Signatures ──────────────────────────────────────────
  await prisma.electronicSignature.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: createdUsers['EMP001'],
        userName: 'Dr. Ashish Pandit',
        userRole: 'TENANT_ADMIN',
        meaning: 'Approval - Authorized for use',
        entityType: 'DOCUMENT',
        entityId: doc2.id,
        entityVersion: '5.2',
        ipAddress: '10.10.20.5',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/124.0',
        signatureHash: fakeSig([createdUsers['EMP001'], 'DOCUMENT', doc2.id, '5.2', 'APPROVAL']),
      },
      {
        tenantId: tenant.id,
        userId: createdUsers['EMP002'],
        userName: 'Dr. Priya Sharma',
        userRole: 'QUALITY_MANAGER',
        meaning: 'Review - Technical content verified',
        entityType: 'DOCUMENT',
        entityId: doc2.id,
        entityVersion: '5.2',
        ipAddress: '10.10.20.7',
        userAgent: 'Mozilla/5.0 (Macintosh) Safari/17.5',
        signatureHash: fakeSig([createdUsers['EMP002'], 'DOCUMENT', doc2.id, '5.2', 'REVIEW']),
      },
      {
        tenantId: tenant.id,
        userId: createdUsers['EMP002'],
        userName: 'Dr. Priya Sharma',
        userRole: 'QUALITY_MANAGER',
        meaning: 'Approval - CAPA effectiveness verified',
        entityType: 'CAPA',
        entityId: capa2.id,
        entityVersion: '1.0',
        ipAddress: '10.10.20.7',
        userAgent: 'Mozilla/5.0 (Macintosh) Safari/17.5',
        signatureHash: fakeSig([createdUsers['EMP002'], 'CAPA', capa2.id, '1.0', 'APPROVAL']),
      },
    ],
  });

  console.log('  Electronic signatures: 3');

  // ─── Audit Logs (sample) ───────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: createdUsers['EMP002'],
        userName: 'Dr. Priya Sharma',
        userRole: 'QUALITY_MANAGER',
        action: 'CREATE',
        entityType: 'NON_CONFORMANCE',
        entityId: nc1.id,
        afterState: { ncNumber: 'NC-2026-001', status: 'OPEN' },
        changedFields: ['ncNumber', 'status', 'severity'],
        ipAddress: '10.10.20.7',
        sessionId: 'sess-001',
        userAgent: 'Mozilla/5.0 Safari/17.5',
      },
      {
        tenantId: tenant.id,
        userId: createdUsers['EMP002'],
        userName: 'Dr. Priya Sharma',
        userRole: 'QUALITY_MANAGER',
        action: 'STATUS_CHANGE',
        entityType: 'NON_CONFORMANCE',
        entityId: nc1.id,
        beforeState: { status: 'OPEN' },
        afterState: { status: 'ROOT_CAUSE_ANALYSIS' },
        changedFields: ['status'],
        ipAddress: '10.10.20.7',
        sessionId: 'sess-001',
        userAgent: 'Mozilla/5.0 Safari/17.5',
      },
      {
        tenantId: tenant.id,
        userId: createdUsers['EMP001'],
        userName: 'Dr. Ashish Pandit',
        userRole: 'TENANT_ADMIN',
        action: 'APPROVAL_ACTION',
        entityType: 'DOCUMENT',
        entityId: doc2.id,
        afterState: { decision: 'APPROVED' },
        changedFields: ['status'],
        ipAddress: '10.10.20.5',
        sessionId: 'sess-002',
        userAgent: 'Mozilla/5.0 Chrome/124.0',
      },
      {
        tenantId: tenant.id,
        userId: createdUsers['EMP003'],
        userName: 'Rajesh Kumar',
        userRole: 'QUALITY_ENGINEER',
        action: 'LOGIN',
        entityType: 'USER',
        entityId: createdUsers['EMP003'],
        changedFields: [],
        ipAddress: '10.10.21.45',
        sessionId: 'sess-101',
        userAgent: 'Mozilla/5.0 Chrome/124.0',
      },
    ],
  });

  console.log('  Audit logs: 4');

  // ─── Summary ────────────────────────────────────────────────────────
  console.log('\n=========================================================');
  console.log('  Quantum Kaizen — Pharma Seed Complete');
  console.log('=========================================================');
  console.log('  Tenant         : Aurora BioPharma Pvt Ltd (PHARMACEUTICAL)');
  console.log('  Users          : 10');
  console.log('  Workflows      : 5  | Approval requests : 2');
  console.log('  Documents      : 10 | Versions: 3 | Acks: 4');
  console.log('  NCs            : 5  | CAPAs: 3   | Risks: 6');
  console.log('  Training       : 6  | Assignments: 11 | Competencies: 7');
  console.log('  Audits         : 4  | FMEAs: 2   | Compliance: 10');
  console.log('  Suppliers      : 6  | Scorecards: 4   | Certs: 5');
  console.log('  Change Reqs    : 5  | Complaints: 4   | Mgmt Reviews: 3');
  console.log('  Notifications  : 7  | E-Signatures: 3 | Audit Logs: 4');
  console.log('---------------------------------------------------------');
  console.log('  Login: admin@aurorabiopharma.com / QuantumK@izen2026');
  console.log('  Tenant Code: AURORA-PH');
  console.log('=========================================================\n');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
