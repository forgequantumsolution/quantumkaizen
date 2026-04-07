import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Quantum Kaizen database...');

  // Create tenant
  const tenant = await prisma.tenant.upsert({
    where: { code: 'FORGE-QS' },
    update: {},
    create: {
      code: 'FORGE-QS',
      name: 'Forge Quantum Solutions',
      industry: 'GENERAL_MANUFACTURING',
      settings: {
        riskMatrix: '5x5',
        defaultApprovalStages: 2,
        documentNumberFormat: '{LEVEL}-{CATEGORY}-{SEQ}',
      },
    },
  });

  console.log(`Tenant created: ${tenant.name} (${tenant.code})`);

  const passwordHash = await bcrypt.hash('QuantumK@izen2026', 12);

  // Create users
  const users = [
    {
      employeeId: 'EMP001',
      email: 'admin@forgequantum.com',
      name: 'Ashish Pandit',
      role: 'TENANT_ADMIN' as const,
      department: 'Management',
      site: 'HQ',
    },
    {
      employeeId: 'EMP002',
      email: 'quality.manager@forgequantum.com',
      name: 'Priya Sharma',
      role: 'QUALITY_MANAGER' as const,
      department: 'Quality Assurance',
      site: 'Plant 1',
    },
    {
      employeeId: 'EMP003',
      email: 'quality.engineer@forgequantum.com',
      name: 'Rajesh Kumar',
      role: 'QUALITY_ENGINEER' as const,
      department: 'Quality Control',
      site: 'Plant 1',
    },
    {
      employeeId: 'EMP004',
      email: 'doc.controller@forgequantum.com',
      name: 'Anita Desai',
      role: 'DOCUMENT_CONTROLLER' as const,
      department: 'Quality Assurance',
      site: 'HQ',
    },
    {
      employeeId: 'EMP005',
      email: 'auditor@forgequantum.com',
      name: 'Vikram Patel',
      role: 'AUDITOR' as const,
      department: 'Quality Assurance',
      site: 'Plant 1',
    },
    {
      employeeId: 'EMP006',
      email: 'dept.head@forgequantum.com',
      name: 'Sunita Rao',
      role: 'DEPARTMENT_HEAD' as const,
      department: 'Production',
      site: 'Plant 1',
    },
  ];

  const createdUsers: Record<string, string> = {};

  for (const userData of users) {
    const user = await prisma.user.upsert({
      where: {
        tenantId_email: { tenantId: tenant.id, email: userData.email },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        passwordHash,
        ...userData,
      },
    });
    createdUsers[userData.employeeId] = user.id;
    console.log(`  User: ${userData.name} (${userData.email})`);
  }

  // ─── Approval Workflows ─────────────────────────────────────────────
  await prisma.approvalWorkflow.create({
    data: {
      tenantId: tenant.id,
      name: 'Standard Document Approval',
      entityType: 'DOCUMENT',
      stages: [
        { name: 'Review', order: 1, assigneeRole: 'QUALITY_ENGINEER', slaDays: 3, isParallel: false },
        { name: 'Approval', order: 2, assigneeRole: 'QUALITY_MANAGER', slaDays: 5, isParallel: false },
      ],
    },
  });

  await prisma.approvalWorkflow.create({
    data: {
      tenantId: tenant.id,
      name: 'NC Closure Approval',
      entityType: 'NON_CONFORMANCE',
      stages: [
        { name: 'QA Review', order: 1, assigneeRole: 'QUALITY_ENGINEER', slaDays: 2, isParallel: false },
        { name: 'QA Manager Approval', order: 2, assigneeRole: 'QUALITY_MANAGER', slaDays: 3, isParallel: false },
      ],
    },
  });

  await prisma.approvalWorkflow.create({
    data: {
      tenantId: tenant.id,
      name: 'CAPA Approval',
      entityType: 'CAPA',
      stages: [
        { name: 'QA Engineer Review', order: 1, assigneeRole: 'QUALITY_ENGINEER', slaDays: 3, isParallel: false },
        { name: 'QA Manager Approval', order: 2, assigneeRole: 'QUALITY_MANAGER', slaDays: 5, isParallel: false },
        { name: 'Management Sign-off', order: 3, assigneeRole: 'TENANT_ADMIN', slaDays: 7, isParallel: false },
      ],
    },
  });

  await prisma.approvalWorkflow.create({
    data: {
      tenantId: tenant.id,
      name: 'Risk Assessment Approval',
      entityType: 'RISK_REGISTER',
      stages: [
        { name: 'Department Head Review', order: 1, assigneeRole: 'DEPARTMENT_HEAD', slaDays: 3, isParallel: false },
        { name: 'QA Manager Approval', order: 2, assigneeRole: 'QUALITY_MANAGER', slaDays: 5, isParallel: false },
      ],
    },
  });

  console.log('  Approval workflows created (4 workflows)');

  // ─── Documents ──────────────────────────────────────────────────────

  const doc1 = await prisma.document.create({
    data: {
      tenantId: tenant.id,
      documentNumber: 'L1-QMS-001',
      title: 'Quality Management System Policy',
      description: 'Top-level quality policy defining the QMS scope, principles, and management commitment.',
      level: 'LEVEL_1_POLICY',
      category: 'Quality',
      department: 'Quality Assurance',
      status: 'PUBLISHED',
      currentVersion: '2.0',
      ownerId: createdUsers['EMP001'],
      reviewerId: createdUsers['EMP002'],
      approverId: createdUsers['EMP001'],
      effectiveDate: new Date('2025-01-15'),
      expiryDate: new Date('2027-01-15'),
      reviewDate: new Date('2026-07-15'),
      isControlled: true,
      tags: ['ISO 9001', 'QMS', 'Policy'],
    },
  });

  const doc2 = await prisma.document.create({
    data: {
      tenantId: tenant.id,
      documentNumber: 'L2-QMS-001',
      title: 'Non-Conformance Management Procedure',
      description: 'Procedure for identifying, documenting, and resolving non-conformances.',
      level: 'LEVEL_2_PROCEDURE',
      category: 'Quality',
      department: 'Quality Assurance',
      status: 'PUBLISHED',
      currentVersion: '3.1',
      ownerId: createdUsers['EMP002'],
      reviewerId: createdUsers['EMP003'],
      approverId: createdUsers['EMP002'],
      effectiveDate: new Date('2025-03-01'),
      expiryDate: new Date('2027-03-01'),
      reviewDate: new Date('2026-09-01'),
      isControlled: true,
      tags: ['NC', 'Procedure', 'ISO 9001'],
      parentDocumentId: doc1.id,
    },
  });

  await prisma.document.create({
    data: {
      tenantId: tenant.id,
      documentNumber: 'L2-QMS-002',
      title: 'CAPA Management Procedure',
      description: 'Procedure for Corrective and Preventive Action management aligned with ISO 9001:2015.',
      level: 'LEVEL_2_PROCEDURE',
      category: 'Quality',
      department: 'Quality Assurance',
      status: 'PUBLISHED',
      currentVersion: '2.0',
      ownerId: createdUsers['EMP002'],
      reviewerId: createdUsers['EMP003'],
      approverId: createdUsers['EMP002'],
      effectiveDate: new Date('2025-02-01'),
      expiryDate: new Date('2027-02-01'),
      reviewDate: new Date('2026-08-01'),
      isControlled: true,
      tags: ['CAPA', 'Procedure', 'ISO 9001'],
      parentDocumentId: doc1.id,
    },
  });

  await prisma.document.create({
    data: {
      tenantId: tenant.id,
      documentNumber: 'L3-QC-001',
      title: 'Incoming Material Inspection Work Instruction',
      description: 'Step-by-step work instruction for inspecting incoming raw materials.',
      level: 'LEVEL_3_WORK_INSTRUCTION',
      category: 'Quality Control',
      department: 'Quality Control',
      status: 'PUBLISHED',
      currentVersion: '1.2',
      ownerId: createdUsers['EMP003'],
      approverId: createdUsers['EMP002'],
      effectiveDate: new Date('2025-04-01'),
      expiryDate: new Date('2027-04-01'),
      reviewDate: new Date('2026-10-01'),
      isControlled: true,
      tags: ['Inspection', 'Work Instruction', 'Incoming'],
      parentDocumentId: doc2.id,
    },
  });

  await prisma.document.create({
    data: {
      tenantId: tenant.id,
      documentNumber: 'L4-QC-001',
      title: 'Dimensional Inspection Checklist',
      description: 'Form template for recording dimensional inspection results.',
      level: 'LEVEL_4_FORM',
      category: 'Quality Control',
      department: 'Quality Control',
      status: 'PUBLISHED',
      currentVersion: '1.0',
      ownerId: createdUsers['EMP003'],
      approverId: createdUsers['EMP002'],
      effectiveDate: new Date('2025-05-01'),
      isControlled: true,
      tags: ['Form', 'Inspection', 'Checklist'],
    },
  });

  await prisma.document.create({
    data: {
      tenantId: tenant.id,
      documentNumber: 'L2-HSE-001',
      title: 'Health, Safety & Environment Procedure',
      description: 'HSE management procedure covering workplace safety, environmental compliance, and emergency response.',
      level: 'LEVEL_2_PROCEDURE',
      category: 'HSE',
      department: 'Production',
      status: 'DRAFT',
      currentVersion: '1.0',
      ownerId: createdUsers['EMP006'],
      isControlled: true,
      tags: ['HSE', 'Safety', 'Environment'],
    },
  });

  await prisma.document.create({
    data: {
      tenantId: tenant.id,
      documentNumber: 'EXT-ISO9001-2015',
      title: 'ISO 9001:2015 Standard Reference',
      description: 'External reference document for the ISO 9001:2015 Quality Management System standard.',
      level: 'EXTERNAL',
      category: 'Standards',
      department: 'Quality Assurance',
      status: 'PUBLISHED',
      currentVersion: '2015',
      ownerId: createdUsers['EMP004'],
      effectiveDate: new Date('2015-09-15'),
      isControlled: false,
      tags: ['ISO 9001', 'Standard', 'External'],
    },
  });

  console.log('  Documents created (7 documents across all levels)');

  // ─── Non-Conformances ───────────────────────────────────────────────

  const nc1 = await prisma.nonConformance.create({
    data: {
      tenantId: tenant.id,
      ncNumber: 'NC-2026-001',
      title: 'Raw Material Hardness Out of Specification',
      description: 'Incoming batch B2026-0142 of steel rods (supplier: Tata Steel) failed hardness testing. Measured 58 HRC vs specification 62-65 HRC. Affects production order PO-2026-087.',
      type: 'PRODUCT_NC',
      severity: 'MAJOR',
      status: 'ROOT_CAUSE_ANALYSIS',
      disposition: 'RETURN_TO_VENDOR',
      source: 'Incoming Inspection',
      departmentAffected: 'Quality Control',
      productProcess: 'Steel Rods - Grade 4140',
      batchLot: 'B2026-0142',
      containmentActions: {
        actions: [
          { description: 'Segregated affected batch in quarantine area', completedAt: '2026-03-15T10:30:00Z' },
          { description: 'Notified supplier Tata Steel with NCR details', completedAt: '2026-03-15T14:00:00Z' },
          { description: 'Issued deviation alert to production planning', completedAt: '2026-03-15T16:00:00Z' },
        ],
      },
      rootCauseAnalysis: {
        method: '5-Why',
        findings: [
          'Why 1: Material hardness below specification',
          'Why 2: Heat treatment process deviation at supplier',
          'Why 3: Furnace temperature controller malfunction',
          'Why 4: Scheduled maintenance was overdue',
          'Why 5: Supplier maintenance scheduling system gap',
        ],
        rootCause: 'Supplier furnace temperature controller malfunction due to overdue preventive maintenance.',
      },
      reportedById: createdUsers['EMP003'],
      assignedToId: createdUsers['EMP002'],
      dueDate: new Date('2026-04-15'),
    },
  });

  await prisma.nonConformance.create({
    data: {
      tenantId: tenant.id,
      ncNumber: 'NC-2026-002',
      title: 'Assembly Line Process Deviation - Torque Values',
      description: 'Final assembly torque check on Line 3 revealed 12 out of 50 units with bolt torque values outside the 45-55 Nm range (measured 38-42 Nm). Identified during in-process inspection.',
      type: 'PROCESS_NC',
      severity: 'CRITICAL',
      status: 'CONTAINMENT',
      disposition: 'REWORK',
      source: 'In-Process Inspection',
      departmentAffected: 'Production',
      productProcess: 'Final Assembly - Line 3',
      batchLot: 'L3-2026-0315',
      containmentActions: {
        actions: [
          { description: 'Halted Line 3 assembly operations', completedAt: '2026-03-20T09:00:00Z' },
          { description: '100% re-inspection of units from current shift', completedAt: '2026-03-20T12:00:00Z' },
        ],
      },
      reportedById: createdUsers['EMP006'],
      assignedToId: createdUsers['EMP003'],
      dueDate: new Date('2026-04-05'),
    },
  });

  await prisma.nonConformance.create({
    data: {
      tenantId: tenant.id,
      ncNumber: 'NC-2026-003',
      title: 'Customer Complaint - Surface Finish Defect',
      description: 'Customer XYZ Corp reported surface finish defects (scratches and pitting) on 8 units from shipment SH-2026-0289. Units fail visual inspection criteria per customer spec CS-440 Rev C.',
      type: 'COMPLAINT',
      severity: 'MAJOR',
      status: 'OPEN',
      disposition: 'PENDING',
      source: 'Customer Complaint',
      departmentAffected: 'Quality Assurance',
      productProcess: 'CNC Machining - Cell 2',
      reportedById: createdUsers['EMP002'],
      assignedToId: createdUsers['EMP003'],
      dueDate: new Date('2026-04-10'),
    },
  });

  await prisma.nonConformance.create({
    data: {
      tenantId: tenant.id,
      ncNumber: 'NC-2025-018',
      title: 'Calibration Deviation on CMM #3',
      description: 'Annual calibration of CMM #3 (Zeiss Contura) showed X-axis deviation of 0.015mm exceeding the 0.005mm tolerance. All measurements taken since last calibration require review.',
      type: 'DEVIATION',
      severity: 'MINOR',
      status: 'CLOSED',
      disposition: 'USE_AS_IS',
      source: 'Internal Audit',
      departmentAffected: 'Quality Control',
      productProcess: 'Metrology Lab',
      reportedById: createdUsers['EMP005'],
      assignedToId: createdUsers['EMP003'],
      dueDate: new Date('2025-12-15'),
      closedAt: new Date('2025-12-10'),
    },
  });

  console.log('  Non-Conformances created (4 NCs)');

  // ─── CAPAs ──────────────────────────────────────────────────────────

  await prisma.cAPA.create({
    data: {
      tenantId: tenant.id,
      capaNumber: 'CAPA-2026-001',
      title: 'Supplier Quality Improvement - Tata Steel Heat Treatment',
      description: 'Corrective and preventive actions to address recurring material hardness failures from Tata Steel supplier. Linked to NC-2026-001.',
      source: 'NC',
      severity: 'MAJOR',
      status: 'ACTION_DEFINITION',
      sourceRecordId: nc1.id,
      sourceRecordType: 'NON_CONFORMANCE',
      department: 'Quality Assurance',
      site: 'Plant 1',
      productProcess: 'Incoming Materials',
      discoveryDate: new Date('2026-03-15'),
      dueDate: new Date('2026-05-15'),
      ownerId: createdUsers['EMP002'],
      rootCauseAnalysis: {
        method: '5-Why + Ishikawa',
        rootCauses: [
          'Supplier preventive maintenance scheduling gap',
          'No real-time furnace temperature monitoring alerts',
        ],
      },
      effectivenessCriteria: 'Zero hardness failures from Tata Steel for 3 consecutive months after implementation.',
      monitoringPeriodDays: 90,
      nonConformances: { connect: [{ id: nc1.id }] },
      actions: {
        create: [
          {
            type: 'CORRECTIVE',
            description: 'Issue formal corrective action request (SCAR) to Tata Steel requiring updated maintenance schedule and furnace calibration records.',
            ownerId: createdUsers['EMP002'],
            dueDate: new Date('2026-04-01'),
          },
          {
            type: 'CORRECTIVE',
            description: 'Implement enhanced incoming inspection sampling plan for Tata Steel batches (AQL Level II to Level I).',
            ownerId: createdUsers['EMP003'],
            dueDate: new Date('2026-04-15'),
          },
          {
            type: 'PREVENTIVE',
            description: 'Add supplier furnace maintenance compliance to quarterly supplier audit checklist.',
            ownerId: createdUsers['EMP005'],
            dueDate: new Date('2026-05-01'),
          },
          {
            type: 'PREVENTIVE',
            description: 'Evaluate and qualify alternate steel supplier as backup source.',
            ownerId: createdUsers['EMP002'],
            dueDate: new Date('2026-06-30'),
          },
        ],
      },
    },
  });

  await prisma.cAPA.create({
    data: {
      tenantId: tenant.id,
      capaNumber: 'CAPA-2026-002',
      title: 'Assembly Line Torque Control Enhancement',
      description: 'Preventive actions to eliminate torque value deviations on Assembly Line 3. Root cause: torque wrench calibration drift and operator technique variation.',
      source: 'NC',
      severity: 'CRITICAL',
      status: 'IMPLEMENTATION',
      department: 'Production',
      site: 'Plant 1',
      productProcess: 'Final Assembly - Line 3',
      discoveryDate: new Date('2026-03-20'),
      dueDate: new Date('2026-04-30'),
      ownerId: createdUsers['EMP006'],
      rootCauseAnalysis: {
        method: 'Fishbone Diagram',
        rootCauses: [
          'Torque wrench calibration interval too long (6 months vs recommended 3 months)',
          'Operator re-certification training overdue for 3 operators',
        ],
      },
      effectivenessCriteria: 'Zero torque failures for 30 consecutive production days post-implementation.',
      monitoringPeriodDays: 60,
      actions: {
        create: [
          {
            type: 'CORRECTIVE',
            description: 'Re-calibrate all torque wrenches on Line 3 and reduce calibration interval to 3 months.',
            ownerId: createdUsers['EMP003'],
            dueDate: new Date('2026-04-01'),
            completionDate: new Date('2026-03-28'),
            verificationStatus: 'VERIFIED',
            verifiedById: createdUsers['EMP002'],
            verifiedAt: new Date('2026-03-29'),
          },
          {
            type: 'CORRECTIVE',
            description: 'Conduct torque application re-certification training for all Line 3 operators.',
            ownerId: createdUsers['EMP006'],
            dueDate: new Date('2026-04-10'),
          },
          {
            type: 'PREVENTIVE',
            description: 'Install digital torque monitoring system with automatic reject capability on Line 3.',
            ownerId: createdUsers['EMP006'],
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
      title: 'CMM Calibration Schedule Improvement',
      description: 'Preventive actions to ensure timely calibration of all metrology equipment following deviation found on CMM #3.',
      source: 'AUDIT',
      severity: 'MINOR',
      status: 'CLOSED',
      department: 'Quality Control',
      site: 'Plant 1',
      productProcess: 'Metrology Lab',
      discoveryDate: new Date('2025-11-15'),
      dueDate: new Date('2026-01-15'),
      closedAt: new Date('2026-01-10'),
      ownerId: createdUsers['EMP003'],
      rootCauseAnalysis: {
        method: '5-Why',
        rootCauses: ['Calibration tracking was manual (spreadsheet-based) with no automated reminders'],
      },
      effectivenessCriteria: 'All calibrations completed on-time for 6 months.',
      effectivenessResult: 'EFFECTIVE',
      effectivenessCheckDate: new Date('2026-03-10'),
      monitoringPeriodDays: 180,
      actions: {
        create: [
          {
            type: 'CORRECTIVE',
            description: 'Implemented automated calibration tracking and reminder system.',
            ownerId: createdUsers['EMP003'],
            dueDate: new Date('2025-12-15'),
            completionDate: new Date('2025-12-12'),
            verificationStatus: 'VERIFIED',
            verifiedById: createdUsers['EMP002'],
            verifiedAt: new Date('2025-12-14'),
          },
          {
            type: 'PREVENTIVE',
            description: 'Added calibration status dashboard to daily quality KPI review meeting.',
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

  console.log('  CAPAs created (3 CAPAs with actions)');

  // ─── Risk Register ──────────────────────────────────────────────────

  await prisma.riskRegister.create({
    data: {
      tenantId: tenant.id,
      riskNumber: 'RSK-001',
      title: 'Single-Source Supplier Dependency',
      description: 'Critical raw materials (Grade 4140 steel) sourced from single supplier (Tata Steel). Supply disruption would halt production within 2 weeks of inventory depletion.',
      category: 'Supply Chain',
      department: 'Procurement',
      likelihood: 3,
      consequence: 5,
      riskScore: 15,
      riskLevel: 'HIGH',
      controlMeasures: {
        existing: ['Safety stock of 4 weeks', 'Quarterly supplier performance reviews'],
        planned: ['Qualify alternate supplier', 'Negotiate consignment stock agreement'],
      },
      residualLikelihood: 2,
      residualConsequence: 4,
      residualScore: 8,
      residualLevel: 'MEDIUM',
      ownerId: createdUsers['EMP002'],
      reviewDate: new Date('2026-06-30'),
    },
  });

  await prisma.riskRegister.create({
    data: {
      tenantId: tenant.id,
      riskNumber: 'RSK-002',
      title: 'Equipment Failure - CNC Machining Center',
      description: 'Aging CNC machining center (Cell 2, 15 years old) at risk of unplanned breakdown. Last major failure caused 3-day production stoppage.',
      category: 'Operations',
      department: 'Production',
      likelihood: 4,
      consequence: 4,
      riskScore: 16,
      riskLevel: 'HIGH',
      controlMeasures: {
        existing: ['Preventive maintenance every 500 hours', 'Vibration monitoring program'],
        planned: ['Capital budget approval for replacement in Q4 2026'],
      },
      residualLikelihood: 2,
      residualConsequence: 4,
      residualScore: 8,
      residualLevel: 'MEDIUM',
      ownerId: createdUsers['EMP006'],
      reviewDate: new Date('2026-06-30'),
    },
  });

  await prisma.riskRegister.create({
    data: {
      tenantId: tenant.id,
      riskNumber: 'RSK-003',
      title: 'Regulatory Compliance - ISO 9001 Recertification',
      description: 'ISO 9001:2015 recertification audit scheduled for Q3 2026. Non-compliance findings could result in certificate suspension and customer contract termination.',
      category: 'Compliance',
      department: 'Quality Assurance',
      likelihood: 2,
      consequence: 5,
      riskScore: 10,
      riskLevel: 'HIGH',
      controlMeasures: {
        existing: ['Internal audit program', 'Management review meetings', 'Corrective action tracking'],
        planned: ['Pre-assessment audit in Q2 2026', 'Gap analysis against ISO 9001:2015 clauses'],
      },
      residualLikelihood: 1,
      residualConsequence: 5,
      residualScore: 5,
      residualLevel: 'MEDIUM',
      ownerId: createdUsers['EMP002'],
      reviewDate: new Date('2026-05-31'),
    },
  });

  await prisma.riskRegister.create({
    data: {
      tenantId: tenant.id,
      riskNumber: 'RSK-004',
      title: 'Data Security and System Access',
      description: 'Risk of unauthorized access to quality records and intellectual property. System stores confidential product specifications and customer data.',
      category: 'Information Security',
      department: 'Management',
      likelihood: 2,
      consequence: 4,
      riskScore: 8,
      riskLevel: 'MEDIUM',
      controlMeasures: {
        existing: ['Role-based access control', 'Audit trail logging', 'Password policy enforcement'],
        planned: ['Implement SSO with MFA', 'Annual penetration testing'],
      },
      residualLikelihood: 1,
      residualConsequence: 3,
      residualScore: 3,
      residualLevel: 'LOW',
      ownerId: createdUsers['EMP001'],
      reviewDate: new Date('2026-09-30'),
    },
  });

  await prisma.riskRegister.create({
    data: {
      tenantId: tenant.id,
      riskNumber: 'RSK-005',
      title: 'Skilled Workforce Attrition',
      description: 'Loss of experienced quality engineers and inspectors to competitors. Current team has average tenure of 3 years with 2 key staff eligible for retirement in 2027.',
      category: 'Human Resources',
      department: 'Quality Assurance',
      likelihood: 3,
      consequence: 3,
      riskScore: 9,
      riskLevel: 'MEDIUM',
      controlMeasures: {
        existing: ['Cross-training program', 'Competency matrix tracking'],
        planned: ['Succession planning for key roles', 'Retention bonus program'],
      },
      ownerId: createdUsers['EMP001'],
      reviewDate: new Date('2026-06-30'),
    },
  });

  console.log('  Risk Register entries created (5 risks)');

  // ─── Training Programs ──────────────────────────────────────────────

  const trainingIso = await prisma.trainingProgram.create({
    data: {
      tenantId: tenant.id,
      title: 'ISO 9001:2015 Awareness Training',
      description: 'Comprehensive training covering ISO 9001:2015 requirements, quality management principles, risk-based thinking, and the process approach.',
      type: 'CLASSROOM',
      content: {
        modules: [
          { title: 'Introduction to ISO 9001:2015', durationMinutes: 60 },
          { title: 'Quality Management Principles', durationMinutes: 45 },
          { title: 'Process Approach & Risk-Based Thinking', durationMinutes: 60 },
          { title: 'Documentation Requirements', durationMinutes: 45 },
          { title: 'Internal Audit Basics', durationMinutes: 30 },
        ],
      },
      assessmentQuestions: {
        questions: [
          { q: 'How many quality management principles are defined in ISO 9001:2015?', options: ['5', '7', '8', '10'], answer: 1 },
          { q: 'What is risk-based thinking?', options: ['Avoiding all risks', 'Considering risk in all planning and operations', 'Only managing high risks', 'Insurance planning'], answer: 1 },
          { q: 'What clause covers management responsibility?', options: ['Clause 4', 'Clause 5', 'Clause 7', 'Clause 9'], answer: 1 },
        ],
      },
      passingScore: 80,
      validityDays: 365,
    },
  });

  const trainingNC = await prisma.trainingProgram.create({
    data: {
      tenantId: tenant.id,
      title: 'Non-Conformance & CAPA Management',
      description: 'Training on identifying, documenting, and resolving non-conformances and implementing corrective/preventive actions.',
      type: 'ON_THE_JOB',
      content: {
        modules: [
          { title: 'Identifying Non-Conformances', durationMinutes: 30 },
          { title: 'NC Documentation & Classification', durationMinutes: 45 },
          { title: 'Root Cause Analysis Methods', durationMinutes: 60 },
          { title: 'CAPA Implementation & Verification', durationMinutes: 45 },
        ],
      },
      passingScore: 75,
      validityDays: 730,
    },
  });

  const trainingSafety = await prisma.trainingProgram.create({
    data: {
      tenantId: tenant.id,
      title: 'Workplace Safety Induction',
      description: 'Mandatory safety induction covering PPE, emergency procedures, chemical handling, and workplace hazards.',
      type: 'INDUCTION',
      content: {
        modules: [
          { title: 'PPE Requirements', durationMinutes: 20 },
          { title: 'Emergency Procedures & Evacuation', durationMinutes: 30 },
          { title: 'Chemical Safety & MSDS', durationMinutes: 25 },
          { title: 'Workplace Ergonomics', durationMinutes: 15 },
        ],
      },
      passingScore: 90,
      validityDays: 365,
    },
  });

  const trainingMetrology = await prisma.trainingProgram.create({
    data: {
      tenantId: tenant.id,
      title: 'Metrology & Measurement Systems',
      description: 'Advanced training on measurement techniques, GD&T interpretation, CMM operation, and measurement uncertainty.',
      type: 'COMPETENCY_ASSESSMENT',
      content: {
        modules: [
          { title: 'GD&T Fundamentals', durationMinutes: 90 },
          { title: 'CMM Operation & Programming', durationMinutes: 120 },
          { title: 'Measurement Uncertainty', durationMinutes: 60 },
          { title: 'MSA - Gage R&R Studies', durationMinutes: 60 },
        ],
      },
      passingScore: 85,
      validityDays: 730,
    },
  });

  // Training assignments
  await prisma.trainingAssignment.createMany({
    data: [
      {
        programId: trainingIso.id,
        userId: createdUsers['EMP003'],
        status: 'COMPLETED',
        assignedAt: new Date('2025-06-01'),
        completedAt: new Date('2025-06-15'),
        score: 92,
        expiresAt: new Date('2026-06-15'),
      },
      {
        programId: trainingIso.id,
        userId: createdUsers['EMP006'],
        status: 'COMPLETED',
        assignedAt: new Date('2025-06-01'),
        completedAt: new Date('2025-06-20'),
        score: 85,
        expiresAt: new Date('2026-06-20'),
      },
      {
        programId: trainingIso.id,
        userId: createdUsers['EMP004'],
        status: 'IN_PROGRESS',
        assignedAt: new Date('2026-03-01'),
        dueDate: new Date('2026-04-15'),
      },
      {
        programId: trainingNC.id,
        userId: createdUsers['EMP003'],
        status: 'COMPLETED',
        assignedAt: new Date('2025-03-01'),
        completedAt: new Date('2025-03-20'),
        score: 88,
        expiresAt: new Date('2027-03-20'),
      },
      {
        programId: trainingNC.id,
        userId: createdUsers['EMP006'],
        status: 'NOT_STARTED',
        assignedAt: new Date('2026-03-15'),
        dueDate: new Date('2026-04-30'),
      },
      {
        programId: trainingSafety.id,
        userId: createdUsers['EMP003'],
        status: 'COMPLETED',
        assignedAt: new Date('2025-01-10'),
        completedAt: new Date('2025-01-12'),
        score: 95,
        expiresAt: new Date('2026-01-12'),
      },
      {
        programId: trainingSafety.id,
        userId: createdUsers['EMP006'],
        status: 'COMPLETED',
        assignedAt: new Date('2025-01-10'),
        completedAt: new Date('2025-01-11'),
        score: 100,
        expiresAt: new Date('2026-01-11'),
      },
      {
        programId: trainingMetrology.id,
        userId: createdUsers['EMP003'],
        status: 'COMPLETED',
        assignedAt: new Date('2025-04-01'),
        completedAt: new Date('2025-05-15'),
        score: 91,
        expiresAt: new Date('2027-05-15'),
      },
    ],
  });

  // Competency matrices
  await prisma.competencyMatrix.createMany({
    data: [
      {
        tenantId: tenant.id,
        roleOrUserId: 'QUALITY_ENGINEER',
        programId: trainingIso.id,
        isRequired: true,
        proficiencyLevel: 'PROFICIENT',
        deadlineDays: 30,
        isRegulatoryMandatory: true,
      },
      {
        tenantId: tenant.id,
        roleOrUserId: 'QUALITY_ENGINEER',
        programId: trainingNC.id,
        isRequired: true,
        proficiencyLevel: 'EXPERT',
        deadlineDays: 60,
        isRegulatoryMandatory: false,
      },
      {
        tenantId: tenant.id,
        roleOrUserId: 'QUALITY_ENGINEER',
        programId: trainingMetrology.id,
        isRequired: true,
        proficiencyLevel: 'PROFICIENT',
        deadlineDays: 90,
        isRegulatoryMandatory: false,
      },
      {
        tenantId: tenant.id,
        roleOrUserId: 'DEPARTMENT_HEAD',
        programId: trainingIso.id,
        isRequired: true,
        proficiencyLevel: 'WORKING_KNOWLEDGE',
        deadlineDays: 60,
        isRegulatoryMandatory: true,
      },
      {
        tenantId: tenant.id,
        roleOrUserId: 'DEPARTMENT_HEAD',
        programId: trainingSafety.id,
        isRequired: true,
        proficiencyLevel: 'PROFICIENT',
        deadlineDays: 7,
        isRegulatoryMandatory: true,
      },
      {
        tenantId: tenant.id,
        roleOrUserId: 'AUDITOR',
        programId: trainingIso.id,
        isRequired: true,
        proficiencyLevel: 'EXPERT',
        deadlineDays: 30,
        isRegulatoryMandatory: true,
      },
    ],
  });

  console.log('  Training programs created (4 programs, 8 assignments, 6 competency mappings)');

  // ─── Summary ────────────────────────────────────────────────────────

  console.log('\nSeed complete!');
  console.log('\nSeeded data summary:');
  console.log('  1 Tenant (Forge Quantum Solutions)');
  console.log('  6 Users across roles');
  console.log('  4 Approval Workflows (Document, NC, CAPA, Risk)');
  console.log('  7 Documents (Levels 1-4 + External)');
  console.log('  4 Non-Conformances (various statuses)');
  console.log('  3 CAPAs with actions');
  console.log('  5 Risk Register entries');
  console.log('  4 Training Programs');
  console.log('  8 Training Assignments');
  console.log('  6 Competency Matrix mappings');
  console.log('\nLogin credentials:');
  console.log('  Tenant Code: FORGE-QS');
  console.log('  Email: admin@forgequantum.com');
  console.log('  Password: QuantumK@izen2026');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
