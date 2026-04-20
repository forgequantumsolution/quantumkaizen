/**
 * Quantum Kaizen — expansion seed.
 *
 * Idempotent top-up of the base seed. Safe to re-run on every container
 * start: anything already present is either skipped (compound-unique keys
 * via `skipDuplicates`) or gated by a count check.
 *
 * Intentionally a separate file from seed.ts so even if the base seed
 * crashes on a re-run (it uses plain `create`s for Document/CAPA/NC and
 * hits P2002), this expansion still runs.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[seedMore] Expansion seed starting...');

  const tenant = await prisma.tenant.findUnique({ where: { code: 'AURORA-PH' } });
  if (!tenant) {
    console.log('[seedMore] Tenant AURORA-PH not found — skipping.');
    return;
  }
  const tenantId = tenant.id;

  const users = await prisma.user.findMany({
    where: { tenantId },
    select: { id: true, employeeId: true, name: true },
  });
  const userByEmp: Record<string, string> = {};
  const userByName: Record<string, string> = {};
  for (const u of users) {
    if (u.employeeId) userByEmp[u.employeeId] = u.id;
    userByName[u.name] = u.id;
  }
  const pickUser = (emp = 'EMP002') => userByEmp[emp] ?? users[0]?.id;

  // ─── Compliance Requirements (main ask — 30 more) ────────────────────
  const complianceTarget = 40;
  const complianceCount = await prisma.complianceRequirement.count({ where: { tenantId } });
  if (complianceCount < complianceTarget) {
    const addN = complianceTarget - complianceCount;
    const extras = [
      { standard: '21 CFR Part 211', clauseNumber: '211.25', clauseTitle: 'Personnel qualifications', requirementText: 'Each person engaged in the manufacture, processing, packing, or holding of a drug product shall have education, training, and experience to perform the assigned functions.', status: 'COMPLIANT', evidence: 'Training matrix TRN-MTX-001; JD-001 through JD-045.', owner: 'Anita Desai' },
      { standard: '21 CFR Part 211', clauseNumber: '211.42', clauseTitle: 'Design and construction features', requirementText: 'Buildings used in the manufacture, processing, packing, or holding of a drug product shall be of suitable size and construction to facilitate cleaning, maintenance, and proper operations.', status: 'COMPLIANT', evidence: 'Facility qualification FQ-001; floor plan drawings.', owner: 'Mohammed Iqbal' },
      { standard: '21 CFR Part 211', clauseNumber: '211.46', clauseTitle: 'Ventilation, air filtration, air heating and cooling', requirementText: 'Adequate ventilation shall be provided. Equipment for adequate control over air pressure, microorganisms, dust, humidity and temperature shall be provided when appropriate.', status: 'COMPLIANT', evidence: 'HVAC validation VAL-HVAC-2025; EM trend Q1-2026.', owner: 'Mohammed Iqbal' },
      { standard: '21 CFR Part 211', clauseNumber: '211.68', clauseTitle: 'Automatic, mechanical, and electronic equipment', requirementText: 'Automatic, mechanical, or electronic equipment or other types of equipment used in the manufacture, processing, packing, and holding of a drug product shall be routinely calibrated, inspected, and checked.', status: 'PARTIAL', evidence: 'Calibration master schedule CAL-SCH-2026. 2 overdue items on CAPA-2026-004.', owner: 'Rajesh Kumar' },
      { standard: '21 CFR Part 211', clauseNumber: '211.84', clauseTitle: 'Testing and approval or rejection of components', requirementText: 'Each lot of components, drug product containers, and closures shall be withheld from use until the lot has been sampled, tested or examined.', status: 'COMPLIANT', evidence: 'COA review SOP; material release log Q1-2026.', owner: 'Rajesh Kumar' },
      { standard: '21 CFR Part 211', clauseNumber: '211.110', clauseTitle: 'Sampling and testing of in-process materials', requirementText: 'To assure batch uniformity and integrity of drug products, written procedures shall be established and followed that describe the in-process controls.', status: 'COMPLIANT', evidence: 'IPQC SOPs MFG-IPC-001 through 012.', owner: 'Sunita Rao' },
      { standard: '21 CFR Part 211', clauseNumber: '211.113', clauseTitle: 'Control of microbiological contamination', requirementText: 'Appropriate written procedures, designed to prevent objectionable microorganisms in drug products not required to be sterile, shall be established and followed.', status: 'COMPLIANT', evidence: 'Micro monitoring SOP L3-MICRO-002; trend data.', owner: 'Kavita Menon' },
      { standard: '21 CFR Part 211', clauseNumber: '211.160', clauseTitle: 'General requirements (Laboratory controls)', requirementText: 'Laboratory controls shall include the establishment of scientifically sound and appropriate specifications, standards, sampling plans, and test procedures.', status: 'COMPLIANT', evidence: 'QC methods registry QC-MTH-REG; USP/EP monographs.', owner: 'Rajesh Kumar' },
      { standard: '21 CFR Part 211', clauseNumber: '211.165', clauseTitle: 'Testing and release for distribution', requirementText: 'For each batch of drug product, there shall be appropriate laboratory determination of satisfactory conformance to final specifications.', status: 'COMPLIANT', evidence: 'Batch release SOP L2-QA-003.', owner: 'Priya Sharma' },
      { standard: '21 CFR Part 211', clauseNumber: '211.166', clauseTitle: 'Stability testing', requirementText: 'There shall be a written testing program designed to assess the stability characteristics of drug products.', status: 'COMPLIANT', evidence: 'Stability protocol master STB-MST-001; stability chambers.', owner: 'Rajesh Kumar' },

      { standard: '21 CFR Part 11', clauseNumber: '11.10(a)', clauseTitle: 'Validation of systems', requirementText: 'Validation of systems to ensure accuracy, reliability, consistent intended performance.', status: 'COMPLIANT', evidence: 'CSV SOP L2-IT-001; validation master plan VMP-2025.', owner: 'Rajesh Kumar' },
      { standard: '21 CFR Part 11', clauseNumber: '11.10(b)', clauseTitle: 'Ability to generate accurate copies', requirementText: 'The ability to generate accurate and complete copies of records in both human readable and electronic form suitable for inspection.', status: 'COMPLIANT', evidence: 'Empower 3 data export validation report.', owner: 'Rajesh Kumar' },
      { standard: '21 CFR Part 11', clauseNumber: '11.10(d)', clauseTitle: 'Limiting system access to authorized individuals', requirementText: 'Limiting system access to authorized individuals.', status: 'COMPLIANT', evidence: 'Access control matrix ACM-2026; quarterly review.', owner: 'Anita Desai' },
      { standard: '21 CFR Part 11', clauseNumber: '11.30', clauseTitle: 'Controls for open systems', requirementText: 'Persons who use open systems to create, modify, maintain, or transmit electronic records shall employ procedures and controls.', status: 'NOT_ASSESSED', evidence: null, owner: 'Anita Desai' },
      { standard: '21 CFR Part 11', clauseNumber: '11.50', clauseTitle: 'Signature manifestations', requirementText: 'Signed electronic records shall contain information associated with the signing that clearly indicates the name, date and time, and meaning of the signature.', status: 'COMPLIANT', evidence: 'E-signature SOP L2-IT-005; Empower 3 e-sig config.', owner: 'Rajesh Kumar' },

      { standard: 'EU GMP Annex 1', clauseNumber: '2.1', clauseTitle: 'Pharmaceutical Quality System (PQS)', requirementText: 'A pharmaceutical quality system should be in place to manage the sterile manufacturing lifecycle.', status: 'COMPLIANT', evidence: 'PQS manual QM-001 v4.0.', owner: 'Priya Sharma' },
      { standard: 'EU GMP Annex 1', clauseNumber: '2.5', clauseTitle: 'Contamination Control Strategy (CCS)', requirementText: 'A Contamination Control Strategy (CCS) should be implemented.', status: 'COMPLIANT', evidence: 'CCS document CCS-STERILE-001 v2.0 approved Apr-2024.', owner: 'Kavita Menon' },
      { standard: 'EU GMP Annex 1', clauseNumber: '5.19', clauseTitle: 'Smoke studies', requirementText: 'Airflow visualisation studies (smoke studies) should be performed to confirm unidirectional airflow.', status: 'COMPLIANT', evidence: 'Smoke study video reports SSV-2025-01 through 08.', owner: 'Mohammed Iqbal' },
      { standard: 'EU GMP Annex 1', clauseNumber: '9.16', clauseTitle: 'Media fills', requirementText: 'Aseptic process simulation (media fill) should be performed as initial validation and repeated at defined intervals.', status: 'COMPLIANT', evidence: 'Media fill protocol MF-PROT-2026; last successful run 20-Mar-2026.', owner: 'Kavita Menon' },
      { standard: 'EU GMP Annex 1', clauseNumber: '10.2', clauseTitle: 'Environmental monitoring', requirementText: 'Environmental monitoring programme including viable and non-viable monitoring.', status: 'COMPLIANT', evidence: 'EM program EM-PROG-2026; Grade A/B continuous monitoring.', owner: 'Kavita Menon' },

      { standard: 'ICH Q7', clauseNumber: '2.40', clauseTitle: 'Internal audits (Self Inspection)', requirementText: 'Regular internal audits should be performed to monitor compliance with GMP principles.', status: 'COMPLIANT', evidence: 'Internal audit schedule 2026; AUD-2026-001 closed.', owner: 'Vikram Patel' },
      { standard: 'ICH Q7', clauseNumber: '6.70', clauseTitle: 'Validation of analytical methods', requirementText: 'Analytical methods should be validated unless the method employed is included in the relevant pharmacopoeia.', status: 'COMPLIANT', evidence: 'AMV master list AMV-LST-001; 42 methods validated.', owner: 'Rajesh Kumar' },
      { standard: 'ICH Q7', clauseNumber: '12.50', clauseTitle: 'Cleaning validation', requirementText: 'Cleaning procedures should be validated. Validation should reflect actual equipment usage patterns.', status: 'COMPLIANT', evidence: 'Cleaning validation master plan CVMP-2024; 18 products covered.', owner: 'Mohammed Iqbal' },

      { standard: 'ICH Q9', clauseNumber: '4.1', clauseTitle: 'Responsibilities', requirementText: 'Quality risk management should be a responsibility of all departments.', status: 'COMPLIANT', evidence: 'QRM SOP L2-QMS-005; cross-functional FMEA teams.', owner: 'Priya Sharma' },
      { standard: 'ICH Q9', clauseNumber: '5.0', clauseTitle: 'Risk assessment tools', requirementText: 'FMEA, HAZOP, HACCP, Fault Tree Analysis or similar formal tools should be applied.', status: 'COMPLIANT', evidence: 'FMEA-2026-001/002; risk register RSK-001 through 018.', owner: 'Priya Sharma' },

      { standard: 'ICH Q10', clauseNumber: '2.0', clauseTitle: 'Management commitment', requirementText: 'Senior management has the ultimate responsibility to ensure an effective PQS.', status: 'COMPLIANT', evidence: 'Quality policy QP-2026; signed by CEO.', owner: 'Ashish Pandit' },
      { standard: 'ICH Q10', clauseNumber: '3.2.1', clauseTitle: 'Process performance and product quality monitoring', requirementText: 'An effective monitoring system should be in place providing assurance of the continued capability of processes.', status: 'COMPLIANT', evidence: 'APR annual trending reports; SPC dashboards.', owner: 'Priya Sharma' },
      { standard: 'ICH Q10', clauseNumber: '3.2.4', clauseTitle: 'Change management', requirementText: 'Change management system used to evaluate, approve and implement changes.', status: 'COMPLIANT', evidence: 'Change control SOP L2-QMS-003; 23 changes in Q1 2026.', owner: 'Priya Sharma' },

      { standard: 'WHO TRS 996', clauseNumber: 'Annex 2', clauseTitle: 'WHO GMP for pharmaceutical products', requirementText: 'WHO GMP for pharmaceutical products: main principles.', status: 'COMPLIANT', evidence: 'WHO GMP certificate WHO-GMP-2024.', owner: 'Priya Sharma' },
      { standard: 'WHO TRS 996', clauseNumber: 'Annex 4', clauseTitle: 'Supplementary guidelines on GMP for validation', requirementText: 'Validation of manufacturing processes, cleaning, analytical methods and computerised systems.', status: 'COMPLIANT', evidence: 'VMP-2025; individual validation protocols.', owner: 'Mohammed Iqbal' },

      { standard: 'USP <797>', clauseNumber: '6', clauseTitle: 'Personnel training and competency', requirementText: 'Personnel assigned to compounding sterile preparations shall be trained and demonstrate competency.', status: 'COMPLIANT', evidence: 'Gowning qual records; aseptic technique quals.', owner: 'Kavita Menon' },
      { standard: 'USP <797>', clauseNumber: '7', clauseTitle: 'Environmental controls', requirementText: 'Primary engineering controls (PEC) shall be located in a SEC.', status: 'COMPLIANT', evidence: 'Class 5 isolator qualification; EM trending.', owner: 'Kavita Menon' },
    ];
    await prisma.complianceRequirement.createMany({
      data: extras.slice(0, addN).map((r) => ({
        tenantId, ...r, nextReview: new Date(new Date().setMonth(new Date().getMonth() + 6)),
      })),
    });
    console.log(`[seedMore] Compliance: added ${Math.min(addN, extras.length)}`);
  } else {
    console.log(`[seedMore] Compliance: already ${complianceCount} — skipping`);
  }

  // ─── Non-Conformances (add up to 20) ──────────────────────────────────
  const ncTarget = 20;
  const ncExisting = await prisma.nonConformance.findMany({ where: { tenantId }, select: { ncNumber: true } });
  const ncHave = new Set(ncExisting.map((n) => n.ncNumber));
  const ncCandidates = [
    { ncNumber: 'NC-2026-006', title: 'Out-of-spec assay result — Paracetamol 500 mg batch PCT-26-0501', type: 'OOS', severity: 'MAJOR', status: 'UNDER_INVESTIGATION', source: 'Release Testing', departmentAffected: 'Quality Control', productProcess: 'Paracetamol 500 mg Tablets', batchLot: 'PCT-26-0501' },
    { ncNumber: 'NC-2026-007', title: 'Deviation — Extended compression time on tablet press TP-04', type: 'DEVIATION', severity: 'MINOR', status: 'OPEN', source: 'Production', departmentAffected: 'Manufacturing - Solid Orals', productProcess: 'Compression', batchLot: 'HT-26-0112' },
    { ncNumber: 'NC-2026-008', title: 'Environmental monitoring excursion — Grade A particle count', type: 'PROCESS_NC', severity: 'CRITICAL', status: 'CONTAINMENT', source: 'Environmental Monitoring', departmentAffected: 'Sterile Manufacturing', productProcess: 'Vial Filling Line F-2' },
    { ncNumber: 'NC-2026-009', title: 'Label mix-up — Metformin 500 mg and 1000 mg cartons', type: 'PRODUCT_NC', severity: 'MAJOR', status: 'OPEN', source: 'Packaging Line', departmentAffected: 'Packaging', productProcess: 'Carton labelling' },
    { ncNumber: 'NC-2026-010', title: 'Stability failure — Ibuprofen 400 mg 24-month time point', type: 'OOS', severity: 'MAJOR', status: 'UNDER_INVESTIGATION', source: 'Stability', departmentAffected: 'Quality Control', productProcess: 'Ibuprofen 400 mg Tablets', batchLot: 'IBU-24-0221' },
    { ncNumber: 'NC-2026-011', title: 'Power outage during aseptic fill — Insulin Glargine', type: 'DEVIATION', severity: 'CRITICAL', status: 'CONTAINMENT', source: 'Facility', departmentAffected: 'Sterile Manufacturing', productProcess: 'Vial Filling', batchLot: 'INS-26-0089' },
    { ncNumber: 'NC-2026-012', title: 'pH out of range during Ranitidine syrup compounding', type: 'PROCESS_NC', severity: 'MINOR', status: 'OPEN', source: 'In-Process', departmentAffected: 'Liquid Manufacturing', productProcess: 'Ranitidine Syrup' },
    { ncNumber: 'NC-2026-013', title: 'Balance calibration drift — HPLC sample prep area', type: 'PROCESS_NC', severity: 'MINOR', status: 'CLOSED', source: 'Calibration', departmentAffected: 'Quality Control', productProcess: 'Sample preparation' },
    { ncNumber: 'NC-2026-014', title: 'Water system alert — TOC trending high on WFI loop', type: 'PROCESS_NC', severity: 'MAJOR', status: 'CONTAINMENT', source: 'Utilities', departmentAffected: 'Engineering', productProcess: 'WFI distribution' },
    { ncNumber: 'NC-2026-015', title: 'Visual particulate in finished Insulin vial', type: 'PRODUCT_NC', severity: 'CRITICAL', status: 'UNDER_INVESTIGATION', source: 'Visual Inspection', departmentAffected: 'Sterile Manufacturing', productProcess: 'Vial Filling', batchLot: 'INS-26-0091' },
    { ncNumber: 'NC-2026-016', title: 'Sample chain-of-custody gap — archival samples', type: 'DEVIATION', severity: 'MINOR', status: 'CLOSED', source: 'Internal Audit', departmentAffected: 'Quality Control', productProcess: 'Sample management' },
    { ncNumber: 'NC-2026-017', title: 'Training lapse — Analyst performed release test without requal', type: 'DEVIATION', severity: 'MAJOR', status: 'OPEN', source: 'Internal Audit', departmentAffected: 'Quality Control', productProcess: 'Release testing' },
    { ncNumber: 'NC-2026-018', title: 'Temperature excursion during shipment to distributor', type: 'DEVIATION', severity: 'MAJOR', status: 'UNDER_INVESTIGATION', source: 'Distribution', departmentAffected: 'Warehouse', productProcess: 'Cold chain', batchLot: 'INS-26-0087' },
    { ncNumber: 'NC-2026-019', title: 'Tablet weight variation exceeding ±5% spec', type: 'PROCESS_NC', severity: 'MINOR', status: 'CLOSED', source: 'In-Process', departmentAffected: 'Manufacturing - Solid Orals', productProcess: 'Tablet compression' },
    { ncNumber: 'NC-2026-020', title: 'Packaging material receipt — damaged foil rolls', type: 'PRODUCT_NC', severity: 'MINOR', status: 'CLOSED', source: 'Goods Receipt', departmentAffected: 'Warehouse', productProcess: 'Primary packaging' },
  ].filter((n) => !ncHave.has(n.ncNumber));

  const ncCurrent = ncExisting.length;
  const ncToAdd = ncCandidates.slice(0, Math.max(0, ncTarget - ncCurrent));
  if (ncToAdd.length) {
    await prisma.nonConformance.createMany({
      data: ncToAdd.map((n) => ({
        tenantId,
        ...n,
        description: `${n.title} — detailed observation captured in the NC form. See batch records, deviation log and supporting evidence for full context.`,
        reportedById: pickUser('EMP003'),
        assignedToId: pickUser('EMP002'),
        dueDate: new Date(new Date().setDate(new Date().getDate() + 14)),
      })) as any,
      skipDuplicates: true,
    });
    console.log(`[seedMore] Non-Conformances: added ${ncToAdd.length}`);
  }

  // ─── CAPAs (add up to 15) ────────────────────────────────────────────
  const capaTarget = 15;
  const capaExisting = await prisma.cAPA.findMany({ where: { tenantId }, select: { capaNumber: true } });
  const capaHave = new Set(capaExisting.map((c) => c.capaNumber));
  const capaCandidates = [
    { capaNumber: 'CAPA-2026-004', title: 'Overdue calibrations — corrective plan', source: 'AUDIT', severity: 'MAJOR', status: 'IMPLEMENTATION', department: 'Quality Control' },
    { capaNumber: 'CAPA-2026-005', title: 'Prevent balance drift via temp-controlled weighing booth', source: 'NC', severity: 'MINOR', status: 'ACTION_DEFINITION', department: 'Quality Control' },
    { capaNumber: 'CAPA-2026-006', title: 'WFI TOC trend — investigation and loop cleaning', source: 'NC', severity: 'MAJOR', status: 'ROOT_CAUSE_ANALYSIS', department: 'Engineering' },
    { capaNumber: 'CAPA-2026-007', title: 'Reduce label mix-up risk via vision inspection upgrade', source: 'NC', severity: 'MAJOR', status: 'CONTAINMENT', department: 'Packaging' },
    { capaNumber: 'CAPA-2026-008', title: 'Aseptic training refresher program rollout', source: 'AUDIT', severity: 'MAJOR', status: 'IMPLEMENTATION', department: 'Sterile Manufacturing' },
    { capaNumber: 'CAPA-2026-009', title: 'Supplier scorecard framework — implement RAG dashboard', source: 'MANAGEMENT', severity: 'MINOR', status: 'INITIATED', department: 'Quality Assurance' },
    { capaNumber: 'CAPA-2026-010', title: 'Stability failure investigation — Ibuprofen 24M', source: 'NC', severity: 'MAJOR', status: 'EFFECTIVENESS_VERIFICATION', department: 'Quality Control' },
    { capaNumber: 'CAPA-2026-011', title: 'Cold chain excursion SOP revision', source: 'COMPLAINT', severity: 'MAJOR', status: 'IMPLEMENTATION', department: 'Warehouse' },
    { capaNumber: 'CAPA-2026-012', title: 'Analyst re-qualification tracking — gate before release testing', source: 'AUDIT', severity: 'MAJOR', status: 'ACTION_DEFINITION', department: 'Quality Control' },
    { capaNumber: 'CAPA-2026-013', title: 'Preventive — enhance smoke studies frequency for Grade A', source: 'PROACTIVE', severity: 'MINOR', status: 'CLOSED', department: 'Sterile Manufacturing' },
    { capaNumber: 'CAPA-2026-014', title: 'Customer complaint — packaging handling training', source: 'COMPLAINT', severity: 'MINOR', status: 'CLOSED', department: 'Distribution' },
    { capaNumber: 'CAPA-2026-015', title: 'Vendor COA verification — random retesting', source: 'PROACTIVE', severity: 'MINOR', status: 'IMPLEMENTATION', department: 'Quality Control' },
  ].filter((c) => !capaHave.has(c.capaNumber));
  const capaToAdd = capaCandidates.slice(0, Math.max(0, capaTarget - capaExisting.length));
  if (capaToAdd.length) {
    await prisma.cAPA.createMany({
      data: capaToAdd.map((c) => ({
        tenantId,
        ...c,
        description: `${c.title} — full CAPA plan including RCA, actions, effectiveness criteria and timeline captured in attached documents.`,
        ownerId: pickUser('EMP002'),
        dueDate: new Date(new Date().setDate(new Date().getDate() + 30)),
        effectivenessCriteria: 'Zero recurrence over 90-day monitoring period; training completion 100%.',
        monitoringPeriodDays: 90,
      })) as any,
      skipDuplicates: true,
    });
    console.log(`[seedMore] CAPAs: added ${capaToAdd.length}`);
  }

  // ─── Risks (add up to 18) ────────────────────────────────────────────
  const riskTarget = 18;
  const riskExisting = await prisma.riskRegister.findMany({ where: { tenantId }, select: { riskNumber: true } });
  const riskHave = new Set(riskExisting.map((r) => r.riskNumber));
  const riskCat = ['OPERATIONAL', 'QUALITY', 'SAFETY', 'ENVIRONMENTAL', 'FINANCIAL'];
  const riskLvl = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
  const riskTitles = [
    'Single-source API dependency on key excipient',
    'Tablet press spare-parts lead time exceeding 12 weeks',
    'HVAC compressor failure in sterile block — sterility impact',
    'Power grid instability during monsoon season',
    'Cyber-security risk on legacy Empower 3 instance',
    'Cleaning agent supply disruption from global shortages',
    'Stability chamber compressor redundancy gap',
    'QC analyst attrition impacting release timelines',
    'Water system bio-burden excursion — microbiological risk',
    'Counterfeit risk for high-value oncology products',
    'Regulatory change — USFDA DSCSA full implementation',
    'Fire hazard in solvent storage — Class I flammables',
  ];
  const riskToAdd = riskTitles
    .map((t, i) => ({ riskNumber: `RSK-2026-${String(10 + i).padStart(3, '0')}`, title: t }))
    .filter((r) => !riskHave.has(r.riskNumber))
    .slice(0, Math.max(0, riskTarget - riskExisting.length))
    .map((r, i) => {
      const likelihood = 1 + ((i * 3) % 5);
      const consequence = 1 + ((i * 5) % 5);
      const score = likelihood * consequence;
      return {
        tenantId,
        riskNumber: r.riskNumber,
        title: r.title,
        description: `${r.title} — assessed per ICH Q9 with likelihood/consequence rating.`,
        category: riskCat[i % riskCat.length],
        likelihood,
        consequence,
        riskScore: score,
        riskLevel: score >= 20 ? 'CRITICAL' : score >= 12 ? 'HIGH' : score >= 6 ? 'MEDIUM' : 'LOW',
        residualLikelihood: Math.max(1, likelihood - 1),
        residualConsequence: Math.max(1, consequence - 1),
        residualScore: Math.max(1, (likelihood - 1) * (consequence - 1)),
        residualLevel: riskLvl[Math.max(0, riskLvl.indexOf(score >= 20 ? 'CRITICAL' : score >= 12 ? 'HIGH' : score >= 6 ? 'MEDIUM' : 'LOW') - 1)] ?? 'LOW',
        status: i % 4 === 0 ? 'CLOSED' : 'OPEN',
        department: ['Quality', 'Production', 'Engineering', 'Warehouse', 'IT'][i % 5],
        ownerId: pickUser('EMP002'),
        reviewDate: new Date(new Date().setMonth(new Date().getMonth() + 6)),
        controlMeasures: 'Multiple layered controls: procedural, engineering, monitoring. See risk register for detail.',
      };
    });
  if (riskToAdd.length) {
    await prisma.riskRegister.createMany({ data: riskToAdd as any, skipDuplicates: true });
    console.log(`[seedMore] Risks: added ${riskToAdd.length}`);
  }

  // ─── Suppliers (add if under 18) ─────────────────────────────────────
  const supplierTarget = 18;
  const supplierCount = await prisma.supplier.count({ where: { tenantId } });
  if (supplierCount < supplierTarget) {
    const addN = supplierTarget - supplierCount;
    const extras = [
      { supplierCode: 'SUP-API-010', companyName: 'Divis Laboratories', category: 'Active Pharmaceutical Ingredient', status: 'APPROVED', riskRating: 'LOW', contactPerson: 'Ramesh Kumar', email: 'ramesh.k@divis.example', city: 'Hyderabad', country: 'India', productsServices: 'Naproxen API, Levetiracetam API, custom synthesis', qualityScore: 96, deliveryScore: 92 },
      { supplierCode: 'SUP-API-011', companyName: 'Dr. Reddy\'s Laboratories', category: 'Active Pharmaceutical Ingredient', status: 'APPROVED', riskRating: 'LOW', contactPerson: 'Arjun Mehta', email: 'arjun.m@drreddys.example', city: 'Hyderabad', country: 'India', productsServices: 'Atorvastatin API, Omeprazole API', qualityScore: 94, deliveryScore: 90 },
      { supplierCode: 'SUP-EXC-002', companyName: 'Colorcon Asia', category: 'Excipient & Coating', status: 'APPROVED', riskRating: 'LOW', contactPerson: 'Suresh Nair', email: 'snair@colorcon.example', city: 'Goa', country: 'India', productsServices: 'Opadry film coating systems, HPMC', qualityScore: 98, deliveryScore: 96 },
      { supplierCode: 'SUP-LAB-005', companyName: 'Waters Corporation', category: 'Lab Equipment & Consumables', status: 'APPROVED', riskRating: 'LOW', contactPerson: 'John D\'Souza', email: 'service.in@waters.example', city: 'Bangalore', country: 'India', productsServices: 'HPLC/UPLC systems, columns, consumables', qualityScore: 97, deliveryScore: 94 },
      { supplierCode: 'SUP-PKG-003', companyName: 'Amcor India Ltd', category: 'Primary Packaging', status: 'CONDITIONAL', riskRating: 'MEDIUM', contactPerson: 'Ashok Patil', email: 'apatil@amcor.example', city: 'Pune', country: 'India', productsServices: 'Blister foil, bottles, closures', qualityScore: 87, deliveryScore: 85 },
      { supplierCode: 'SUP-SRV-001', companyName: 'SGS India Pvt Ltd', category: 'Testing Services', status: 'APPROVED', riskRating: 'LOW', contactPerson: 'Meera Iyer', email: 'meera.iyer@sgs.example', city: 'Mumbai', country: 'India', productsServices: 'Contract analytical testing, stability studies', qualityScore: 95, deliveryScore: 93 },
      { supplierCode: 'SUP-UTL-001', companyName: 'Praxair India', category: 'Utilities & Gases', status: 'APPROVED', riskRating: 'LOW', contactPerson: 'Vivek Sharma', email: 'vsharma@praxair.example', city: 'Mumbai', country: 'India', productsServices: 'USP-grade nitrogen, argon, compressed air', qualityScore: 92, deliveryScore: 88 },
      { supplierCode: 'SUP-CLN-001', companyName: 'Ecolab India', category: 'Cleaning & Sanitization', status: 'APPROVED', riskRating: 'LOW', contactPerson: 'Kavitha Reddy', email: 'k.reddy@ecolab.example', city: 'Gurgaon', country: 'India', productsServices: 'Validated cleaning chemicals, sporicidal disinfectants', qualityScore: 96, deliveryScore: 91 },
      { supplierCode: 'SUP-EXC-003', companyName: 'JRS Pharma India', category: 'Excipient & Coating', status: 'APPROVED', riskRating: 'LOW', contactPerson: 'Rohan Desai', email: 'rohan.d@jrs.example', city: 'Mumbai', country: 'India', productsServices: 'Microcrystalline cellulose, binders, disintegrants', qualityScore: 95, deliveryScore: 89 },
      { supplierCode: 'SUP-API-012', companyName: 'Hetero Drugs', category: 'Active Pharmaceutical Ingredient', status: 'CONDITIONAL', riskRating: 'MEDIUM', contactPerson: 'Priya Venkat', email: 'priya.v@hetero.example', city: 'Hyderabad', country: 'India', productsServices: 'Sitagliptin API, Efavirenz API', qualityScore: 84, deliveryScore: 82 },
      { supplierCode: 'SUP-PKG-004', companyName: 'Bilcare Research', category: 'Primary Packaging', status: 'APPROVED', riskRating: 'LOW', contactPerson: 'Nitin Joshi', email: 'njoshi@bilcare.example', city: 'Pune', country: 'India', productsServices: 'Protective packaging, track-and-trace labels', qualityScore: 91, deliveryScore: 90 },
      { supplierCode: 'SUP-SRV-002', companyName: 'Eurofins Advinus', category: 'Testing Services', status: 'APPROVED', riskRating: 'LOW', contactPerson: 'Dr. Anil Kapoor', email: 'anil.k@eurofins.example', city: 'Bangalore', country: 'India', productsServices: 'Extractables & leachables, toxicology studies', qualityScore: 93, deliveryScore: 89 },
    ];
    await prisma.supplier.createMany({
      data: extras.slice(0, addN).map((s) => ({ tenantId, ...s })),
    });
    console.log(`[seedMore] Suppliers: added ${Math.min(addN, extras.length)}`);
  }

  // ─── Audits (add if under 12) ────────────────────────────────────────
  const auditTarget = 12;
  const auditCount = await prisma.audit.count({ where: { tenantId } });
  if (auditCount < auditTarget) {
    const addN = auditTarget - auditCount;
    const extras = [
      { auditNumber: 'AUD-2026-004', title: 'Internal GMP Audit — Liquid Orals Block', type: 'INTERNAL', status: 'COMPLETED', standard: '21 CFR 211', scope: 'Liquid compounding, filling, packaging', department: 'Manufacturing - Liquids', leadAuditor: 'Vikram Patel', auditTeam: ['Vikram Patel', 'Kavita Menon'], plannedStart: '2026-03-10', plannedEnd: '2026-03-12' },
      { auditNumber: 'AUD-2026-005', title: 'Data Integrity Audit — QC Laboratory', type: 'INTERNAL', status: 'COMPLETED', standard: '21 CFR Part 11 / MHRA DI', scope: 'Empower 3, LIMS, paper records', department: 'Quality Control', leadAuditor: 'Priya Sharma', auditTeam: ['Priya Sharma', 'Anita Desai'], plannedStart: '2026-03-17', plannedEnd: '2026-03-18' },
      { auditNumber: 'AUD-2026-006', title: 'Supplier Audit — Colorcon Asia', type: 'SUPPLIER', status: 'COMPLETED', standard: 'IPEC GDP & QA', scope: 'Opadry manufacturing, QC, warehouse', department: 'Quality Assurance', leadAuditor: 'Vikram Patel', auditTeam: ['Vikram Patel'], plannedStart: '2026-02-20', plannedEnd: '2026-02-21' },
      { auditNumber: 'AUD-2026-007', title: 'Vendor Audit — Amcor (Packaging Material)', type: 'SUPPLIER', status: 'IN_PROGRESS', standard: 'ISO 15378 / 21 CFR 211', scope: 'Primary packaging material manufacture', department: 'Quality Assurance', leadAuditor: 'Vikram Patel', auditTeam: ['Vikram Patel', 'Anita Desai'], plannedStart: '2026-04-25', plannedEnd: '2026-04-26' },
      { auditNumber: 'AUD-2026-008', title: 'MHRA Mock Inspection — Sterile Manufacturing', type: 'INTERNAL', status: 'PLANNED', standard: 'EU GMP Annex 1 (2022)', scope: 'Full sterile block mock inspection', department: 'Sterile Manufacturing', leadAuditor: 'External - Ex-MHRA Inspector', auditTeam: ['External Consultant', 'Kavita Menon', 'Priya Sharma'], plannedStart: '2026-07-14', plannedEnd: '2026-07-18' },
      { auditNumber: 'AUD-2025-013', title: 'ISO 14001 Surveillance — Environment', type: 'CERTIFICATION', status: 'COMPLETED', standard: 'ISO 14001:2015', scope: 'Environmental management system', department: 'EHS', leadAuditor: 'External - TÜV', auditTeam: ['TÜV Auditor'], plannedStart: '2025-10-05', plannedEnd: '2025-10-06' },
      { auditNumber: 'AUD-2025-012', title: 'OHSAS Safety Audit — Site-wide', type: 'INTERNAL', status: 'COMPLETED', standard: 'ISO 45001', scope: 'Occupational health & safety', department: 'EHS', leadAuditor: 'Vikram Patel', auditTeam: ['Vikram Patel', 'Safety Officer'], plannedStart: '2025-09-15', plannedEnd: '2025-09-16' },
      { auditNumber: 'AUD-2025-011', title: 'Warehouse GDP Audit', type: 'INTERNAL', status: 'COMPLETED', standard: 'EU GDP', scope: 'Finished goods warehouse, receiving, dispatch', department: 'Warehouse', leadAuditor: 'Vikram Patel', auditTeam: ['Vikram Patel'], plannedStart: '2025-08-20', plannedEnd: '2025-08-21' },
    ];
    await prisma.audit.createMany({
      data: extras.slice(0, addN).map((a) => ({
        tenantId,
        ...a,
        plannedStart: new Date(a.plannedStart),
        plannedEnd: new Date(a.plannedEnd),
        createdById: pickUser('EMP005'),
      })) as any,
    });
    console.log(`[seedMore] Audits: added ${Math.min(addN, extras.length)}`);
  }

  // ─── Change Requests (add if under 15) ───────────────────────────────
  const crTarget = 15;
  const crCount = await prisma.changeRequest.count({ where: { tenantId } });
  if (crCount < crTarget) {
    const addN = crTarget - crCount;
    const extras = [
      { changeNumber: 'CC-2026-005', title: 'Rollout LIMS 7.2 upgrade', type: 'SYSTEM', priority: 'HIGH', status: 'UNDER_EVALUATION', description: 'Upgrade LIMS from v6.8 to v7.2 — new e-signature module.', justification: 'Vendor EoL on v6.8 by Dec-2026; improved compliance features.', riskAssessment: 'System re-validation required; 21 CFR Part 11 re-qualification.', implementationPlan: 'Sandbox Q2; PRD migration Q3; Go-live Oct-2026.' },
      { changeNumber: 'CC-2026-006', title: 'New printing method for pack inserts', type: 'PROCESS', priority: 'MEDIUM', status: 'APPROVED', description: 'Shift from offset to digital printing for pack inserts.', justification: 'Faster turnaround for minor revisions; lower min-order quantity.', riskAssessment: 'Print quality equivalence study completed — meets spec.', implementationPlan: 'Phase rollout starting May-2026.' },
      { changeNumber: 'CC-2026-007', title: 'Warehouse racking reconfiguration', type: 'SYSTEM', priority: 'LOW', status: 'IMPLEMENTED', description: 'Reconfigure bulk storage racking for better FIFO compliance.', justification: 'Improve stock rotation; reduce picking errors.', riskAssessment: 'Low — operational change only.', implementationPlan: 'Completed Apr-2026.' },
      { changeNumber: 'CC-2026-008', title: 'Spec tightening — Omeprazole 20 mg dissolution', type: 'PRODUCT', priority: 'MEDIUM', status: 'UNDER_EVALUATION', description: 'Tighten dissolution from Q=75% to Q=80% at 30 min.', justification: 'Align with USP chapter revision; customer request.', riskAssessment: 'Historical data shows 98% batches already meet Q=80%.', implementationPlan: 'Effective Q3 2026 pending approval.' },
      { changeNumber: 'CC-2026-009', title: 'Tablet coating formulation change', type: 'PRODUCT', priority: 'HIGH', status: 'DRAFT', description: 'Change Opadry II formulation on Paracetamol coating.', justification: 'Supplier rationalization; cost reduction.', riskAssessment: 'Pilot batches required; stability study committed.', implementationPlan: 'TBD pending pilot data.' },
      { changeNumber: 'CC-2026-010', title: 'QC sample storage — secondary freezer addition', type: 'SYSTEM', priority: 'MEDIUM', status: 'APPROVED', description: 'Add redundant -20°C freezer for retained samples.', justification: 'Business continuity; single-freezer single point of failure.', riskAssessment: 'Low — capacity expansion only.', implementationPlan: 'Purchase complete; IQ/OQ May-2026.' },
      { changeNumber: 'CC-2026-011', title: 'Supplier change — cleaning chemical', type: 'SUPPLIER', priority: 'LOW', status: 'IMPLEMENTED', description: 'Replace sporicidal supplier from X to Ecolab.', justification: 'Price and performance; reduced MOQ.', riskAssessment: 'Cleaning revalidation confirmed equivalent efficacy.', implementationPlan: 'Completed Mar-2026.' },
      { changeNumber: 'CC-2026-012', title: 'Regulatory — CDSCO Schedule M 2024 updates', type: 'REGULATORY', priority: 'HIGH', status: 'UNDER_EVALUATION', description: 'Gap assessment and implementation of Schedule M revisions.', justification: 'Mandatory — in force 01-Jan-2027 for all licensed facilities.', riskAssessment: '14 new requirements identified; gap closure plan in draft.', implementationPlan: 'Gap closure by Sep-2026.' },
      { changeNumber: 'CC-2026-013', title: 'Stability chamber replacement — Chamber 4', type: 'SYSTEM', priority: 'HIGH', status: 'APPROVED', description: 'Replace 12-year-old chamber 4 (25°C/60% RH) with new unit.', justification: 'Chamber reliability issues; vendor end-of-support.', riskAssessment: 'New chamber qualification + sample transfer risk.', implementationPlan: 'Q2 2026 qualification; migration plan in place.' },
      { changeNumber: 'CC-2026-014', title: 'Process optimization — reduce tablet compression speed', type: 'PROCESS', priority: 'LOW', status: 'IMPLEMENTED', description: 'Optimize compression speed for Ibuprofen 400 mg to improve yield.', justification: 'Reduce compression dust; improve first-pass yield.', riskAssessment: 'Minimal — validated range.', implementationPlan: 'Completed Mar-2026.' },
    ];
    await prisma.changeRequest.createMany({
      data: extras.slice(0, addN).map((cr) => ({ tenantId, ...cr, createdById: pickUser('EMP002') })),
    });
    console.log(`[seedMore] Change Requests: added ${Math.min(addN, extras.length)}`);
  }

  // ─── Complaints (add if under 12) ────────────────────────────────────
  const cmpTarget = 12;
  const cmpCount = await prisma.complaint.count({ where: { tenantId } });
  if (cmpCount < cmpTarget) {
    const addN = cmpTarget - cmpCount;
    const extras = [
      { complaintNumber: 'CMP-2026-005', title: 'Blister seal integrity failure — Atorvastatin 10 mg', source: 'CUSTOMER', severity: 'MEDIUM', status: 'CLOSED', customerName: 'NetMeds Online Pharmacy', productService: 'Atorvastatin 10 mg Tablets - Batch ATV-26-0311', description: 'Patient reported some blisters with open seals in the pack.', immediateAction: 'Retained samples examined — no defects found in retain.', rootCause: 'Transportation damage during last-mile delivery.', correctiveAction: 'Customer educated; logistics partner notified.', closedAt: new Date('2026-03-15') },
      { complaintNumber: 'CMP-2026-006', title: 'Broken tablets in pack — Ibuprofen 400 mg', source: 'CUSTOMER', severity: 'LOW', status: 'CLOSED', customerName: '1mg / Tata Online', productService: 'Ibuprofen 400 mg Tablets - Batch IBU-26-0208', description: 'Minor tablet breakage in pack.', immediateAction: 'Replacement shipped; no further issues.', rootCause: 'Transport handling; not product-related.', correctiveAction: 'Warned logistics vendor.', closedAt: new Date('2026-03-05') },
      { complaintNumber: 'CMP-2026-007', title: 'Hospital report — wrong bottle quantity (90 vs 100)', source: 'CUSTOMER', severity: 'MEDIUM', status: 'UNDER_INVESTIGATION', customerName: 'Apollo Hospital Chennai', productService: 'Paracetamol 500 mg Tablets Bottle of 100', description: 'Hospital received bottle labelled 100 but count was 90.', immediateAction: 'Batch recount of retained samples initiated.', rootCause: 'Investigation — suspected count verification failure.' },
      { complaintNumber: 'CMP-2026-008', title: 'ADR — Rash after Naproxen dose', source: 'REGULATORY', severity: 'MEDIUM', status: 'CLOSED', customerName: 'CDSCO PvPI', productService: 'Naproxen 250 mg Tablets - Batch NAP-26-0102', description: 'Reported skin rash in 1 patient.', immediateAction: 'ICSR submitted to PvPI within 15 days.', rootCause: 'Known labeled adverse effect.', correctiveAction: 'Recorded in PSUR.', closedAt: new Date('2026-03-20') },
      { complaintNumber: 'CMP-2026-009', title: 'Crack visible in vial — Insulin Glargine', source: 'CUSTOMER', severity: 'HIGH', status: 'UNDER_INVESTIGATION', customerName: 'Fortis Hospital Delhi', productService: 'Insulin Glargine 100 IU/mL - Batch INS-26-0094', description: 'Hairline crack observed on vial neck by pharmacist.', immediateAction: 'Retain samples sent to QC; hold on batch INS-26-0094.' },
      { complaintNumber: 'CMP-2026-010', title: 'Discoloration of tablet coating — Metformin', source: 'CUSTOMER', severity: 'LOW', status: 'CLOSED', customerName: 'Medplus', productService: 'Metformin 500 mg Tablets - Batch MET-26-0099', description: 'Slight color variation observed between batches.', immediateAction: 'Retain samples compared; within spec.', rootCause: 'Batch-to-batch variation within validated range; cosmetic only.', correctiveAction: 'Communicated to customer.', closedAt: new Date('2026-02-28') },
      { complaintNumber: 'CMP-2026-011', title: 'Internal — Label batch number mismatch flagged by packaging operator', source: 'INTERNAL', severity: 'HIGH', status: 'CLOSED', customerName: 'Internal QA', productService: 'Amlodipine 5 mg Carton', description: 'Operator identified wrong batch number on 15 cartons during line clearance.', immediateAction: 'Line stopped; affected cartons segregated.', rootCause: 'Print program mis-selected; reconciliation procedure gap.', correctiveAction: 'SOP updated; additional verification step added.', closedAt: new Date('2026-03-10') },
      { complaintNumber: 'CMP-2026-012', title: 'Patient complaint — Bitter taste of Amoxicillin suspension', source: 'CUSTOMER', severity: 'LOW', status: 'CLOSED', customerName: 'Retail pharmacy - Delhi', productService: 'Amoxicillin Suspension 250 mg/5 mL', description: 'Patient complaint about taste.', immediateAction: 'Reviewed — taste masking within labeled expectation.', rootCause: 'Patient-specific taste sensitivity; product within spec.', correctiveAction: 'Communication note added to medical affairs FAQ.', closedAt: new Date('2026-02-10') },
    ];
    await prisma.complaint.createMany({
      data: extras.slice(0, addN).map((c) => ({ tenantId, ...c, createdById: pickUser('EMP002') })) as any,
    });
    console.log(`[seedMore] Complaints: added ${Math.min(addN, extras.length)}`);
  }

  // ─── Management Reviews (add if under 8) ─────────────────────────────
  const mrTarget = 8;
  const mrCount = await prisma.managementReview.count({ where: { tenantId } });
  if (mrCount < mrTarget) {
    const addN = mrTarget - mrCount;
    const extras = [
      { title: 'Q3 2025 Management Review — Aurora BioPharma', date: new Date('2025-10-14'), time: '10:00 IST', status: 'Completed', agenda: ['Q3 quality KPIs', 'Inspection readiness review'], attendees: [{ name: 'Dr. Ashish Pandit', role: 'Site Head', status: 'Present' }], minutesSummary: 'All Q3 KPIs on track.', actionItems: [] },
      { title: 'Q2 2025 Management Review — Aurora BioPharma', date: new Date('2025-07-08'), time: '10:00 IST', status: 'Completed', agenda: ['Q2 quality KPIs', 'APR progress', 'Budget mid-year review'], attendees: [{ name: 'Dr. Ashish Pandit', role: 'Site Head', status: 'Present' }], minutesSummary: 'APR progress on track.', actionItems: [] },
      { title: 'Q3 2026 Management Review — Aurora BioPharma', date: new Date('2026-10-10'), time: '10:00 IST', status: 'Scheduled', agenda: ['PAI outcome', 'CAPA Q3 closure'], attendees: [{ name: 'Dr. Ashish Pandit', role: 'Site Head', status: 'Invited' }], minutesSummary: null, actionItems: [] },
      { title: 'Q1 2025 Management Review — Aurora BioPharma', date: new Date('2025-04-09'), time: '10:00 IST', status: 'Completed', agenda: ['Q1 quality KPIs', 'Training compliance'], attendees: [{ name: 'Dr. Ashish Pandit', role: 'Site Head', status: 'Present' }], minutesSummary: 'Training compliance 94%.', actionItems: [] },
      { title: 'Special Review — Annex 1 Readiness (Pre-implementation)', date: new Date('2023-06-15'), time: '14:00 IST', status: 'Completed', agenda: ['Annex 1 gap closure', 'CCS approval'], attendees: [{ name: 'Dr. Ashish Pandit', role: 'Site Head', status: 'Present' }], minutesSummary: 'Annex 1 readiness 85%; remaining gaps on track.', actionItems: [] },
    ];
    await prisma.managementReview.createMany({
      data: extras.slice(0, addN).map((mr) => ({ tenantId, ...mr, createdById: pickUser('EMP001') })) as any,
    });
    console.log(`[seedMore] Management Reviews: added ${Math.min(addN, extras.length)}`);
  }

  // ─── Training Programs (add if under 15) + Assignments ───────────────
  const tpCount = await prisma.trainingProgram.count({ where: { tenantId } });
  if (tpCount < 15) {
    const existingTitles = new Set(
      (await prisma.trainingProgram.findMany({ where: { tenantId }, select: { title: true } })).map((p) => p.title),
    );
    const extras = [
      { title: 'GDP (Good Distribution Practice) Awareness', type: 'REGULATORY', validityDays: 730, description: 'Cold chain, shipment, temperature monitoring.' },
      { title: 'Ergonomics & Manual Handling', type: 'INDUCTION', validityDays: 1095, description: 'Workplace safety and manual handling.' },
      { title: 'Chemical Safety & Hazard Communication', type: 'REGULATORY', validityDays: 365, description: 'SDS, PPE, chemical storage.' },
      { title: 'Computer System Validation (GAMP 5)', type: 'CLASSROOM', validityDays: 1095, description: 'GAMP 5 principles and lifecycle.' },
      { title: 'APR / APQR Authoring Workshop', type: 'CLASSROOM', validityDays: 730, description: 'Annual Product Review authoring workshop.' },
      { title: 'OOS / OOT Investigation', type: 'CLASSROOM', validityDays: 730, description: 'Systematic OOS investigation methodology.' },
      { title: 'Change Control Process', type: 'ELEARNING', validityDays: 730, description: 'Site change control SOP L2-QMS-003.' },
      { title: 'Root Cause Analysis Techniques', type: 'CLASSROOM', validityDays: 1095, description: '5-Why, Fishbone, Fault Tree Analysis.' },
      { title: 'Temperature & Humidity Management', type: 'ELEARNING', validityDays: 365, description: 'Warehouse and transport temp control.' },
    ].filter((e) => !existingTitles.has(e.title)).slice(0, 15 - tpCount);

    await prisma.trainingProgram.createMany({
      data: extras.map((t) => ({ tenantId, ...t, isActive: true })) as any,
    });
    console.log(`[seedMore] Training programs: added ${extras.length}`);

    // Add assignments for each new program — one per first few users
    const newPrograms = await prisma.trainingProgram.findMany({
      where: { tenantId, title: { in: extras.map((e) => e.title) } },
    });
    let assignmentsAdded = 0;
    for (const prog of newPrograms) {
      for (const u of users.slice(0, 5)) {
        try {
          await prisma.trainingAssignment.create({
            data: {
              programId: prog.id,
              userId: u.id,
              status: Math.random() > 0.5 ? 'COMPLETED' : 'IN_PROGRESS',
              assignedAt: new Date(Date.now() - 30 * 86400000),
              dueDate: new Date(Date.now() + 60 * 86400000),
              completedAt: Math.random() > 0.5 ? new Date() : null,
              score: Math.round(80 + Math.random() * 20),
            },
          });
          assignmentsAdded++;
        } catch { /* dup — skip */ }
      }
    }
    console.log(`[seedMore] Training assignments: added ${assignmentsAdded}`);
  }

  // ─── Notifications (add if under 20) ─────────────────────────────────
  const notCount = await prisma.notification.count({ where: { tenantId } });
  if (notCount < 20) {
    const addN = 20 - notCount;
    const extras = [
      { type: 'OVERDUE', title: 'NC-2026-007 is overdue', message: 'Containment action is 3 days past due.', entityType: 'NON_CONFORMANCE' },
      { type: 'APPROVAL_REQUIRED', title: 'CAPA-2026-006 pending RCA review', message: 'Awaiting your sign-off on the RCA.', entityType: 'CAPA' },
      { type: 'ASSIGNMENT', title: 'Change Request CC-2026-008 assigned', message: 'Please complete impact assessment by Friday.', entityType: 'CHANGE_REQUEST' },
      { type: 'EXPIRY_WARNING', title: 'SOP L2-QMS-001 due for review', message: 'Review date approaching in 14 days.', entityType: 'DOCUMENT' },
      { type: 'WORKFLOW_TRANSITION', title: 'Audit AUD-2026-004 closed', message: 'All findings closed; audit marked complete.', entityType: 'AUDIT' },
      { type: 'ASSIGNMENT', title: 'Training TRN-CSV-001 assigned', message: 'Please complete within 30 days.', entityType: 'TRAINING' },
      { type: 'OVERDUE', title: 'CAPA-2026-005 overdue', message: 'Action definition stage past due by 2 days.', entityType: 'CAPA' },
      { type: 'SYSTEM_ALERT', title: 'Scheduled backup completed', message: 'Nightly backup ran successfully.', entityType: 'SYSTEM' },
      { type: 'REJECTION', title: 'Change CC-2026-009 returned for revision', message: 'Additional stability data required before approval.', entityType: 'CHANGE_REQUEST' },
      { type: 'EXPIRY_WARNING', title: 'Calibration of HPLC #3 due next week', message: 'Schedule via engineering.', entityType: 'EQUIPMENT' },
      { type: 'ASSIGNMENT', title: 'Complaint CMP-2026-009 assigned', message: 'Customer complaint requires investigation.', entityType: 'COMPLAINT' },
      { type: 'APPROVAL_REQUIRED', title: 'Document POL-QA-001 v4 awaiting approval', message: 'Please review and approve.', entityType: 'DOCUMENT' },
      { type: 'OVERDUE', title: 'Training TRN-GMP-001 past due date', message: 'Complete before 30-Apr-2026.', entityType: 'TRAINING' },
    ];
    await prisma.notification.createMany({
      data: extras.slice(0, addN).map((n, i) => ({
        tenantId,
        userId: users[i % users.length].id,
        ...n,
        entityId: `placeholder-${i}`,
        isRead: i % 3 === 0,
      })) as any,
    });
    console.log(`[seedMore] Notifications: added ${Math.min(addN, extras.length)}`);
  }

  console.log('[seedMore] Expansion seed complete.');
}

main()
  .catch((e) => {
    console.error('[seedMore] error:', e);
    throw e;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
