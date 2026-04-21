import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem } from '@/lib/apiShape';

// Backend row shape is a subset of the UI's. Default missing arrays to [] so
// list-page `.slice()/.length/.map()` calls don't crash on real data.
function normalizeCompliance(r: any) {
  if (!r || typeof r !== 'object') return r;
  return {
    ...r,
    linkedProcedures: Array.isArray(r.linkedProcedures) ? r.linkedProcedures : [],
    linkedRisks: Array.isArray(r.linkedRisks) ? r.linkedRisks : [],
    linkedAudits: Array.isArray(r.linkedAudits) ? r.linkedAudits : [],
  };
}

// ── Types ───────────────────────────────────────────────────────────────────

export type ComplianceStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL' | 'NOT_ASSESSED';

export interface ComplianceRequirement {
  id: string;
  standard: string;
  clauseNumber: string;
  clauseTitle: string;
  clauseText: string;
  status: ComplianceStatus;
  linkedProcedures: string[];
  linkedDocuments: string[];
  linkedCAPAs: string[];
  lastAssessed: string;
  nextReview: string;
  assessor: string;
  findings: string;
  gapActions: { id: string; action: string; owner: string; dueDate: string; status: string }[];
  assessmentHistory: { date: string; assessor: string; status: ComplianceStatus; notes: string }[];
}

// ── Mock Data ───────────────────────────────────────────────────────────────

export const mockRequirements: ComplianceRequirement[] = [
  {
    id: 'cr1',
    standard: 'ISO 9001',
    clauseNumber: '4.1',
    clauseTitle: 'Understanding the organization and its context',
    clauseText: 'The organization shall determine external and internal issues that are relevant to its purpose and its strategic direction and that affect its ability to achieve the intended result(s) of its quality management system.',
    status: 'COMPLIANT',
    linkedProcedures: ['QP-001 Context Analysis Procedure', 'QP-002 Strategic Planning'],
    linkedDocuments: ['Context Analysis Report 2026', 'SWOT Analysis'],
    linkedCAPAs: [],
    lastAssessed: '2026-02-15',
    nextReview: '2026-08-15',
    assessor: 'Priya Sharma',
    findings: 'Context analysis is well documented and reviewed during management review. Internal and external issues are identified and monitored.',
    gapActions: [],
    assessmentHistory: [
      { date: '2026-02-15', assessor: 'Priya Sharma', status: 'COMPLIANT', notes: 'Fully compliant. Context reviewed in MRM.' },
      { date: '2025-08-10', assessor: 'Priya Sharma', status: 'COMPLIANT', notes: 'No gaps identified.' },
    ],
  },
  {
    id: 'cr2',
    standard: 'ISO 9001',
    clauseNumber: '4.2',
    clauseTitle: 'Understanding the needs and expectations of interested parties',
    clauseText: 'The organization shall determine the interested parties that are relevant to the quality management system and the requirements of these interested parties.',
    status: 'COMPLIANT',
    linkedProcedures: ['QP-001 Context Analysis Procedure'],
    linkedDocuments: ['Interested Parties Register'],
    linkedCAPAs: [],
    lastAssessed: '2026-02-15',
    nextReview: '2026-08-15',
    assessor: 'Priya Sharma',
    findings: 'Interested parties register maintained and updated quarterly.',
    gapActions: [],
    assessmentHistory: [
      { date: '2026-02-15', assessor: 'Priya Sharma', status: 'COMPLIANT', notes: 'Register is current.' },
    ],
  },
  {
    id: 'cr3',
    standard: 'ISO 9001',
    clauseNumber: '5.1',
    clauseTitle: 'Leadership and commitment',
    clauseText: 'Top management shall demonstrate leadership and commitment with respect to the quality management system.',
    status: 'COMPLIANT',
    linkedProcedures: ['QP-010 Management Review Procedure'],
    linkedDocuments: ['Quality Policy', 'Management Review Minutes Q1-2026'],
    linkedCAPAs: [],
    lastAssessed: '2026-03-01',
    nextReview: '2026-09-01',
    assessor: 'Deepak Nair',
    findings: 'Top management actively participates in MRM and quality initiatives. Quality policy is communicated.',
    gapActions: [],
    assessmentHistory: [
      { date: '2026-03-01', assessor: 'Deepak Nair', status: 'COMPLIANT', notes: 'Active leadership demonstrated.' },
    ],
  },
  {
    id: 'cr4',
    standard: 'ISO 9001',
    clauseNumber: '6.1',
    clauseTitle: 'Actions to address risks and opportunities',
    clauseText: 'When planning for the quality management system, the organization shall consider the issues referred to in 4.1 and the requirements referred to in 4.2 and determine the risks and opportunities that need to be addressed.',
    status: 'PARTIAL',
    linkedProcedures: ['QP-015 Risk Management Procedure'],
    linkedDocuments: ['Risk Register 2026', 'Opportunities Log'],
    linkedCAPAs: ['CAPA-2026-008'],
    lastAssessed: '2026-03-01',
    nextReview: '2026-06-01',
    assessor: 'Deepak Nair',
    findings: 'Risk register exists but not all processes have documented risk assessments. Opportunity identification needs improvement.',
    gapActions: [
      { id: 'ga1', action: 'Complete risk assessment for welding and surface treatment processes', owner: 'Vikram Patel', dueDate: '2026-04-15', status: 'IN_PROGRESS' },
      { id: 'ga2', action: 'Develop formal opportunity evaluation criteria', owner: 'Sunita Rao', dueDate: '2026-05-01', status: 'PENDING' },
    ],
    assessmentHistory: [
      { date: '2026-03-01', assessor: 'Deepak Nair', status: 'PARTIAL', notes: 'Gaps in risk assessment coverage.' },
      { date: '2025-09-15', assessor: 'Deepak Nair', status: 'PARTIAL', notes: 'Same gaps noted; action plan created.' },
    ],
  },
  {
    id: 'cr5',
    standard: 'ISO 9001',
    clauseNumber: '7.1',
    clauseTitle: 'Resources',
    clauseText: 'The organization shall determine and provide the resources needed for the establishment, implementation, maintenance and continual improvement of the quality management system.',
    status: 'COMPLIANT',
    linkedProcedures: ['QP-020 Resource Management', 'QP-021 Infrastructure Management'],
    linkedDocuments: ['Annual Budget Plan', 'Resource Allocation Matrix'],
    linkedCAPAs: [],
    lastAssessed: '2026-02-20',
    nextReview: '2026-08-20',
    assessor: 'Anita Desai',
    findings: 'Resources are adequately provided. New CMM machine procured for quality lab expansion.',
    gapActions: [],
    assessmentHistory: [
      { date: '2026-02-20', assessor: 'Anita Desai', status: 'COMPLIANT', notes: 'Adequate resources available.' },
    ],
  },
  {
    id: 'cr6',
    standard: 'ISO 9001',
    clauseNumber: '8.1',
    clauseTitle: 'Operational planning and control',
    clauseText: 'The organization shall plan, implement and control the processes needed to meet the requirements for the provision of products and services.',
    status: 'COMPLIANT',
    linkedProcedures: ['QP-030 Production Planning', 'QP-031 Process Control'],
    linkedDocuments: ['Control Plans', 'Work Instructions Register'],
    linkedCAPAs: [],
    lastAssessed: '2026-03-10',
    nextReview: '2026-09-10',
    assessor: 'Vikram Patel',
    findings: 'Control plans in place for all production processes. Work instructions are current.',
    gapActions: [],
    assessmentHistory: [
      { date: '2026-03-10', assessor: 'Vikram Patel', status: 'COMPLIANT', notes: 'All control plans current.' },
    ],
  },
  {
    id: 'cr7',
    standard: 'ISO 9001',
    clauseNumber: '9.1',
    clauseTitle: 'Monitoring, measurement, analysis and evaluation',
    clauseText: 'The organization shall determine what needs to be monitored and measured, the methods for monitoring, measurement, analysis and evaluation needed to ensure valid results.',
    status: 'NON_COMPLIANT',
    linkedProcedures: ['QP-040 Monitoring and Measurement'],
    linkedDocuments: ['KPI Dashboard', 'Customer Satisfaction Survey'],
    linkedCAPAs: ['CAPA-2026-012', 'CAPA-2026-014'],
    lastAssessed: '2026-03-15',
    nextReview: '2026-04-15',
    assessor: 'Priya Sharma',
    findings: 'Customer satisfaction survey not conducted in Q4-2025. Process performance data for heat treatment not being analyzed systematically. Calibration records for 3 instruments are missing.',
    gapActions: [
      { id: 'ga3', action: 'Conduct overdue customer satisfaction survey', owner: 'Rajesh Kumar', dueDate: '2026-04-01', status: 'IN_PROGRESS' },
      { id: 'ga4', action: 'Implement SPC for heat treatment process', owner: 'Vikram Patel', dueDate: '2026-04-20', status: 'PENDING' },
      { id: 'ga5', action: 'Locate or recreate missing calibration records', owner: 'Anita Desai', dueDate: '2026-04-05', status: 'IN_PROGRESS' },
    ],
    assessmentHistory: [
      { date: '2026-03-15', assessor: 'Priya Sharma', status: 'NON_COMPLIANT', notes: 'Multiple gaps found during internal audit.' },
      { date: '2025-09-20', assessor: 'Priya Sharma', status: 'COMPLIANT', notes: 'No issues at last assessment.' },
    ],
  },
  {
    id: 'cr8',
    standard: 'ISO 9001',
    clauseNumber: '9.2',
    clauseTitle: 'Internal audit',
    clauseText: 'The organization shall conduct internal audits at planned intervals to provide information on whether the quality management system conforms to the organization\'s own requirements and the requirements of this International Standard.',
    status: 'COMPLIANT',
    linkedProcedures: ['QP-041 Internal Audit Procedure'],
    linkedDocuments: ['Internal Audit Schedule 2026', 'Audit Reports'],
    linkedCAPAs: [],
    lastAssessed: '2026-03-10',
    nextReview: '2026-09-10',
    assessor: 'Deepak Nair',
    findings: 'Internal audit program is on schedule. All planned audits for Q1-2026 completed.',
    gapActions: [],
    assessmentHistory: [
      { date: '2026-03-10', assessor: 'Deepak Nair', status: 'COMPLIANT', notes: 'Audit schedule on track.' },
    ],
  },
  {
    id: 'cr9',
    standard: 'ISO 9001',
    clauseNumber: '9.3',
    clauseTitle: 'Management review',
    clauseText: 'Top management shall review the organization\'s quality management system, at planned intervals, to ensure its continuing suitability, adequacy, effectiveness and alignment with the strategic direction of the organization.',
    status: 'COMPLIANT',
    linkedProcedures: ['QP-010 Management Review Procedure'],
    linkedDocuments: ['MRM Minutes Q1-2026', 'MRM Action Items Tracker'],
    linkedCAPAs: [],
    lastAssessed: '2026-03-20',
    nextReview: '2026-09-20',
    assessor: 'Priya Sharma',
    findings: 'Q1-2026 management review conducted on schedule with all required inputs addressed.',
    gapActions: [],
    assessmentHistory: [
      { date: '2026-03-20', assessor: 'Priya Sharma', status: 'COMPLIANT', notes: 'MRM conducted as planned.' },
    ],
  },
  {
    id: 'cr10',
    standard: 'ISO 9001',
    clauseNumber: '10.1',
    clauseTitle: 'Improvement - General',
    clauseText: 'The organization shall determine and select opportunities for improvement and implement any necessary actions to meet customer requirements and enhance customer satisfaction.',
    status: 'PARTIAL',
    linkedProcedures: ['QP-050 Continual Improvement', 'QP-051 CAPA Procedure'],
    linkedDocuments: ['Improvement Project Register', 'Kaizen Event Reports'],
    linkedCAPAs: ['CAPA-2026-010'],
    lastAssessed: '2026-03-05',
    nextReview: '2026-06-05',
    assessor: 'Sunita Rao',
    findings: 'CAPA process is effective. However, proactive improvement initiatives need to be better documented and tracked.',
    gapActions: [
      { id: 'ga6', action: 'Implement formal improvement project tracking system', owner: 'Deepak Nair', dueDate: '2026-05-15', status: 'PENDING' },
    ],
    assessmentHistory: [
      { date: '2026-03-05', assessor: 'Sunita Rao', status: 'PARTIAL', notes: 'Improvement tracking needs formalization.' },
      { date: '2025-09-01', assessor: 'Sunita Rao', status: 'PARTIAL', notes: 'Same observation; some progress made.' },
    ],
  },
];

// IATF 16949 additional requirements (sample)
export const mockIATFRequirements: ComplianceRequirement[] = [
  {
    id: 'iatf1', standard: 'IATF 16949', clauseNumber: '8.3.2.1', clauseTitle: 'Design and development planning - supplemental',
    clauseText: 'The organization shall ensure that design and development planning includes all affected stakeholders within the organization and, as appropriate, its supply chain.',
    status: 'COMPLIANT', linkedProcedures: ['QP-060 APQP Procedure'], linkedDocuments: ['APQP Status Report'],
    linkedCAPAs: [], lastAssessed: '2026-02-28', nextReview: '2026-08-28', assessor: 'Rajesh Kumar',
    findings: 'APQP process includes cross-functional team with supplier involvement.', gapActions: [],
    assessmentHistory: [{ date: '2026-02-28', assessor: 'Rajesh Kumar', status: 'COMPLIANT', notes: 'APQP well managed.' }],
  },
  {
    id: 'iatf2', standard: 'IATF 16949', clauseNumber: '8.5.6.1', clauseTitle: 'Control of changes - supplemental',
    clauseText: 'The organization shall have a documented process to control and react to changes that impact product realization.',
    status: 'PARTIAL', linkedProcedures: ['QP-061 Change Management'], linkedDocuments: ['Change Request Log'],
    linkedCAPAs: ['CAPA-2026-015'], lastAssessed: '2026-03-10', nextReview: '2026-06-10', assessor: 'Vikram Patel',
    findings: 'Change management process exists but supplier notification workflow needs improvement.',
    gapActions: [{ id: 'ga7', action: 'Update change notification procedure to include supplier communication', owner: 'Vikram Patel', dueDate: '2026-04-30', status: 'IN_PROGRESS' }],
    assessmentHistory: [{ date: '2026-03-10', assessor: 'Vikram Patel', status: 'PARTIAL', notes: 'Supplier notification gap.' }],
  },
];

export const mockISO14001Requirements: ComplianceRequirement[] = [
  {
    id: 'env1', standard: 'ISO 14001', clauseNumber: '6.1.2', clauseTitle: 'Environmental aspects',
    clauseText: 'The organization shall determine the environmental aspects of its activities, products and services that it can control and those that it can influence.',
    status: 'COMPLIANT', linkedProcedures: ['EP-010 Environmental Aspects Procedure'], linkedDocuments: ['Aspects Register 2026'],
    linkedCAPAs: [], lastAssessed: '2026-01-20', nextReview: '2026-07-20', assessor: 'Sunita Rao',
    findings: 'Environmental aspects register is comprehensive and current.', gapActions: [],
    assessmentHistory: [{ date: '2026-01-20', assessor: 'Sunita Rao', status: 'COMPLIANT', notes: 'All aspects identified and rated.' }],
  },
];

export const mockISO45001Requirements: ComplianceRequirement[] = [
  {
    id: 'ohs1', standard: 'ISO 45001', clauseNumber: '6.1.2.1', clauseTitle: 'Hazard identification',
    clauseText: 'The organization shall establish, implement and maintain an ongoing and proactive process for hazard identification.',
    status: 'COMPLIANT', linkedProcedures: ['HSE-010 Hazard Identification Procedure'], linkedDocuments: ['HIRA Register 2026'],
    linkedCAPAs: [], lastAssessed: '2026-02-10', nextReview: '2026-08-10', assessor: 'Deepak Nair',
    findings: 'HIRA conducted for all work areas. Updated after recent process changes.', gapActions: [],
    assessmentHistory: [{ date: '2026-02-10', assessor: 'Deepak Nair', status: 'COMPLIANT', notes: 'HIRA is current.' }],
  },
];

// ── Pharma compliance register — mirrors server/prisma/seedMore.ts ─────────
//
// These 40 records are the same dataset the backend seeds into the DB. Having
// them here means the Compliance Management page stays fully populated in the
// Vercel demo (no backend reachable).
const pharmaRow = (
  id: string,
  standard: string,
  clauseNumber: string,
  clauseTitle: string,
  clauseText: string,
  status: ComplianceStatus,
  owner: string,
  evidence = 'Documented in QMS; see SOP register.',
  nextMonths = 6,
  linkedCAPAs: string[] = [],
): ComplianceRequirement => ({
  id,
  standard,
  clauseNumber,
  clauseTitle,
  clauseText,
  status,
  linkedProcedures: [],
  linkedDocuments: [evidence],
  linkedCAPAs,
  lastAssessed: '2026-03-01',
  nextReview: new Date(new Date().setMonth(new Date().getMonth() + nextMonths)).toISOString().slice(0, 10),
  assessor: owner,
  findings: evidence,
  gapActions: status === 'PARTIAL' || status === 'NON_COMPLIANT'
    ? [{ id: `${id}-g1`, action: 'Close remaining gap per assessment notes', owner, dueDate: '2026-06-30', status: 'IN_PROGRESS' }]
    : [],
  assessmentHistory: [
    { date: '2026-03-01', assessor: owner, status, notes: evidence },
  ],
});

export const mockPharmaRequirements: ComplianceRequirement[] = [
  // 21 CFR Part 211 — 13 entries
  pharmaRow('pr-211-22',  '21 CFR Part 211', '211.22',  'Responsibilities of QCU',                       'Establish a Quality Control Unit with the responsibility and authority to approve or reject components, in-process materials, packaging materials, labeling and drug products.', 'COMPLIANT', 'Priya Sharma',   'QA Org Chart QA-ORG-001 v3.0; Job Descriptions JD-QA-001 to JD-QA-008.', 9),
  pharmaRow('pr-211-25',  '21 CFR Part 211', '211.25',  'Personnel qualifications',                      'Each person engaged in the manufacture, processing, packing, or holding of a drug product shall have education, training, and experience to perform the assigned functions.', 'COMPLIANT', 'Anita Desai',    'Training matrix TRN-MTX-001; JD-001 through JD-045.'),
  pharmaRow('pr-211-42',  '21 CFR Part 211', '211.42',  'Design and construction features',              'Buildings used in the manufacture, processing, packing, or holding of a drug product shall be of suitable size and construction to facilitate cleaning, maintenance, and proper operations.', 'COMPLIANT', 'Mohammed Iqbal', 'Facility qualification FQ-001; floor plan drawings.'),
  pharmaRow('pr-211-46',  '21 CFR Part 211', '211.46',  'Ventilation, air filtration, heating/cooling', 'Adequate ventilation shall be provided. Equipment for adequate control over air pressure, microorganisms, dust, humidity and temperature shall be provided when appropriate.', 'COMPLIANT', 'Mohammed Iqbal', 'HVAC validation VAL-HVAC-2025; EM trend Q1-2026.'),
  pharmaRow('pr-211-68',  '21 CFR Part 211', '211.68',  'Automatic, mechanical, electronic equipment',   'Automatic, mechanical, or electronic equipment or other types of equipment used in the manufacture, processing, packing, and holding of a drug product shall be routinely calibrated, inspected, and checked.', 'PARTIAL', 'Rajesh Kumar', 'Calibration master schedule CAL-SCH-2026. 2 overdue items tracked in CAPA-2026-004.', 3, ['CAPA-2026-004']),
  pharmaRow('pr-211-84',  '21 CFR Part 211', '211.84',  'Testing and approval/rejection of components', 'Each lot of components, drug product containers, and closures shall be withheld from use until the lot has been sampled, tested or examined.', 'COMPLIANT', 'Rajesh Kumar', 'COA review SOP; material release log Q1-2026.'),
  pharmaRow('pr-211-100', '21 CFR Part 211', '211.100', 'Written procedures; deviations',                'There shall be written procedures for production and process control designed to assure that drug products have the identity, strength, quality, and purity they purport.', 'COMPLIANT', 'Sunita Rao',  'SOP Master List MFG-SOP-LST-001; BMR Index.'),
  pharmaRow('pr-211-110', '21 CFR Part 211', '211.110', 'Sampling and testing of in-process materials', 'To assure batch uniformity and integrity of drug products, written procedures shall be established and followed that describe the in-process controls.', 'COMPLIANT', 'Sunita Rao', 'IPQC SOPs MFG-IPC-001 through 012.'),
  pharmaRow('pr-211-113', '21 CFR Part 211', '211.113', 'Control of microbiological contamination',      'Appropriate written procedures, designed to prevent objectionable microorganisms in drug products not required to be sterile, shall be established and followed.', 'COMPLIANT', 'Kavita Menon', 'Micro monitoring SOP L3-MICRO-002; trend data.'),
  pharmaRow('pr-211-160', '21 CFR Part 211', '211.160', 'General laboratory controls',                   'Laboratory controls shall include the establishment of scientifically sound and appropriate specifications, standards, sampling plans, and test procedures.', 'COMPLIANT', 'Rajesh Kumar', 'QC methods registry QC-MTH-REG; USP/EP monographs.'),
  pharmaRow('pr-211-165', '21 CFR Part 211', '211.165', 'Testing and release for distribution',          'For each batch of drug product, there shall be appropriate laboratory determination of satisfactory conformance to final specifications.', 'COMPLIANT', 'Priya Sharma', 'Batch release SOP L2-QA-003.'),
  pharmaRow('pr-211-166', '21 CFR Part 211', '211.166', 'Stability testing',                             'There shall be a written testing program designed to assess the stability characteristics of drug products.', 'COMPLIANT', 'Rajesh Kumar', 'Stability protocol master STB-MST-001.'),
  pharmaRow('pr-211-192', '21 CFR Part 211', '211.192', 'Production record review',                      'All drug product production and control records shall be reviewed and approved by the QC unit. Any unexplained discrepancy shall be thoroughly investigated.', 'PARTIAL', 'Priya Sharma', 'Deviation SOP L2-QMS-001 v5.2; OOS investigations log Q1-2026.', 3),

  // 21 CFR Part 11 — 6 entries
  pharmaRow('pr-11-10a',  '21 CFR Part 11', '11.10(a)', 'Validation of systems',                        'Validation of systems to ensure accuracy, reliability, consistent intended performance.', 'COMPLIANT', 'Rajesh Kumar', 'CSV SOP L2-IT-001; validation master plan VMP-2025.'),
  pharmaRow('pr-11-10b',  '21 CFR Part 11', '11.10(b)', 'Ability to generate accurate copies',           'The ability to generate accurate and complete copies of records in both human readable and electronic form suitable for inspection.', 'COMPLIANT', 'Rajesh Kumar', 'Empower 3 data export validation report.'),
  pharmaRow('pr-11-10d',  '21 CFR Part 11', '11.10(d)', 'Limiting access to authorized individuals',     'Limiting system access to authorized individuals.', 'COMPLIANT', 'Anita Desai', 'Access control matrix ACM-2026; quarterly review.'),
  pharmaRow('pr-11-10e',  '21 CFR Part 11', '11.10(e)', 'Audit trails',                                  'Use of secure, computer-generated, time-stamped audit trails to independently record the date and time of operator entries and actions.', 'PARTIAL', 'Rajesh Kumar', 'Empower 3 CDS audit trail review SOP. Legacy systems pending migration.', 3),
  pharmaRow('pr-11-30',   '21 CFR Part 11', '11.30',    'Controls for open systems',                     'Persons who use open systems to create, modify, maintain, or transmit electronic records shall employ procedures and controls.', 'NOT_ASSESSED', 'Anita Desai', 'Open-system usage under evaluation.'),
  pharmaRow('pr-11-50',   '21 CFR Part 11', '11.50',    'Signature manifestations',                      'Signed electronic records shall contain information associated with the signing that clearly indicates the name, date and time, and meaning of the signature.', 'COMPLIANT', 'Rajesh Kumar', 'E-signature SOP L2-IT-005; Empower 3 e-sig config.'),

  // EU GMP Annex 1 — 7 entries
  pharmaRow('pr-a1-21',   'EU GMP Annex 1', '2.1',      'Pharmaceutical Quality System (PQS)',          'A pharmaceutical quality system should be in place to manage the sterile manufacturing lifecycle.', 'COMPLIANT', 'Priya Sharma', 'PQS manual QM-001 v4.0.'),
  pharmaRow('pr-a1-25',   'EU GMP Annex 1', '2.5',      'Contamination Control Strategy (CCS)',          'A Contamination Control Strategy (CCS) should be implemented.', 'COMPLIANT', 'Kavita Menon', 'CCS document CCS-STERILE-001 v2.0 approved Apr-2024.'),
  pharmaRow('pr-a1-429',  'EU GMP Annex 1', '4.29',     'Environmental & process monitoring',            'Continuous monitoring of viable and non-viable particulates in Grade A and B areas during operations.', 'COMPLIANT', 'Kavita Menon', 'EM SOP L3-MICRO-001 v2.0; Continuous EM trend reports.'),
  pharmaRow('pr-a1-519',  'EU GMP Annex 1', '5.19',     'Smoke studies',                                 'Airflow visualisation studies (smoke studies) should be performed to confirm unidirectional airflow.', 'COMPLIANT', 'Mohammed Iqbal', 'Smoke study video reports SSV-2025-01 through 08.'),
  pharmaRow('pr-a1-840',  'EU GMP Annex 1', '8.40',     'Sterilization',                                 'Sterilization processes must be validated and revalidated at least annually.', 'COMPLIANT', 'Mohammed Iqbal', 'Autoclave PQ Report VAL-PQ-2025-08.'),
  pharmaRow('pr-a1-916',  'EU GMP Annex 1', '9.16',     'Media fills',                                   'Aseptic process simulation (media fill) should be performed as initial validation and repeated at defined intervals.', 'COMPLIANT', 'Kavita Menon', 'Media fill protocol MF-PROT-2026; last successful run 20-Mar-2026.'),
  pharmaRow('pr-a1-102',  'EU GMP Annex 1', '10.2',     'Environmental monitoring',                      'Environmental monitoring programme including viable and non-viable monitoring.', 'COMPLIANT', 'Kavita Menon', 'EM program EM-PROG-2026; Grade A/B continuous monitoring.'),

  // ICH Q7 — 4 entries
  pharmaRow('pr-q7-240',  'ICH Q7', '2.40',  'Internal audits (Self Inspection)',                      'Regular internal audits should be performed to monitor compliance with GMP principles.', 'COMPLIANT', 'Vikram Patel', 'Internal audit schedule 2026; AUD-2026-001 closed.'),
  pharmaRow('pr-q7-670',  'ICH Q7', '6.70',  'Validation of analytical methods',                       'Analytical methods should be validated unless the method employed is included in the relevant pharmacopoeia.', 'COMPLIANT', 'Rajesh Kumar', 'AMV master list AMV-LST-001; 42 methods validated.'),
  pharmaRow('pr-q7-730',  'ICH Q7', '7.30',  'Sampling and testing of incoming materials',              'At least one test to verify the identity of each batch of material should be conducted.', 'COMPLIANT', 'Rajesh Kumar', 'QC Sampling SOP L3-QC-002; Material approval log.'),
  pharmaRow('pr-q7-1250', 'ICH Q7', '12.50', 'Cleaning validation',                                     'Cleaning procedures should be validated. Validation should reflect actual equipment usage patterns.', 'COMPLIANT', 'Mohammed Iqbal', 'Cleaning validation master plan CVMP-2024; 18 products covered.'),

  // ICH Q9 — 3 entries
  pharmaRow('pr-q9-41',   'ICH Q9', '4.1',   'Responsibilities',                                        'Quality risk management should be a responsibility of all departments.', 'COMPLIANT', 'Priya Sharma', 'QRM SOP L2-QMS-005; cross-functional FMEA teams.'),
  pharmaRow('pr-q9-50',   'ICH Q9', '5.0',   'Risk assessment tools',                                   'FMEA, HAZOP, HACCP, Fault Tree Analysis or similar formal tools should be applied.', 'COMPLIANT', 'Priya Sharma', 'FMEA-2026-001/002; risk register RSK-001 through 018.'),
  pharmaRow('pr-q9-a2',   'ICH Q9', 'Annex II', 'Risk management methods - FMEA, HAZOP',                'Quality risk management should be applied to manufacturing processes using formal tools.', 'COMPLIANT', 'Priya Sharma', 'QRM SOP L2-QMS-005; FMEA records FMEA-2026-001/002.'),

  // ICH Q10 — 4 entries
  pharmaRow('pr-q10-20',  'ICH Q10', '2.0',  'Management commitment',                                   'Senior management has the ultimate responsibility to ensure an effective PQS.', 'COMPLIANT', 'Ashish Pandit', 'Quality policy QP-2026; signed by CEO.'),
  pharmaRow('pr-q10-32',  'ICH Q10', '3.2',  'Management responsibility',                               'Senior management has the ultimate responsibility to ensure an effective pharmaceutical quality system.', 'COMPLIANT', 'Ashish Pandit', 'Management Review minutes MR-Q1-2026.'),
  pharmaRow('pr-q10-321', 'ICH Q10', '3.2.1', 'Process performance / quality monitoring',               'An effective monitoring system should be in place providing assurance of the continued capability of processes.', 'COMPLIANT', 'Priya Sharma', 'APR annual trending reports; SPC dashboards.'),
  pharmaRow('pr-q10-324', 'ICH Q10', '3.2.4', 'Change management',                                      'Change management system used to evaluate, approve and implement changes.', 'COMPLIANT', 'Priya Sharma', 'Change control SOP L2-QMS-003; 23 changes in Q1 2026.'),

  // WHO TRS 996 — 2 entries
  pharmaRow('pr-who-a4',  'WHO TRS 996', 'Annex 4', 'Supplementary GMP for validation',                'Validation of manufacturing processes, cleaning, analytical methods and computerised systems.', 'COMPLIANT', 'Mohammed Iqbal', 'VMP-2025; individual validation protocols.'),
  pharmaRow('pr-who-a5',  'WHO TRS 996', 'Annex 5', 'Data management & integrity',                    'Data should be maintained as per ALCOA+ principles throughout the lifecycle.', 'NOT_ASSESSED', 'Anita Desai', 'ALCOA+ gap assessment scheduled Q2 2026.', 2),

  // USP <797> — 2 entries
  pharmaRow('pr-usp-6',   'USP <797>', '6',   'Personnel training and competency',                     'Personnel assigned to compounding sterile preparations shall be trained and demonstrate competency.', 'COMPLIANT', 'Kavita Menon', 'Gowning qual records; aseptic technique quals.'),
  pharmaRow('pr-usp-7',   'USP <797>', '7',   'Environmental controls',                                'Primary engineering controls (PEC) shall be located in a SEC.', 'COMPLIANT', 'Kavita Menon', 'Class 5 isolator qualification; EM trending.'),
];

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useComplianceRequirements(standard?: string) {
  return useQuery({
    queryKey: ['compliance', standard],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/compliance', {
          // `limit=200` is well above the current 40 seeded requirements — the
          // UI renders its own client-side tab filter, so we want the full set.
          // Pass `standard` only when the caller asked for a specific one.
          params: { limit: 200, ...(standard ? { standard } : {}) },
        });
        return unwrapList<ComplianceRequirement>(data, normalizeCompliance);
      } catch {
        // Offline fallback — the pharma register (matches server/prisma/seedMore.ts)
        // is the default dataset; legacy ISO/IATF mocks handle their named tabs.
        let requirements: ComplianceRequirement[];
        switch (standard) {
          case 'IATF 16949':
            requirements = mockIATFRequirements;
            break;
          case 'ISO 14001':
            requirements = mockISO14001Requirements;
            break;
          case 'ISO 45001':
            requirements = mockISO45001Requirements;
            break;
          case 'ISO 9001':
            requirements = mockRequirements;
            break;
          default:
            // "All" tab + any pharma-specific standard — return all 40 pharma reqs
            // and also the three ISO/IATF entries so every page-level tab has data.
            requirements = [
              ...mockPharmaRequirements,
              ...mockRequirements,
              ...mockIATFRequirements,
              ...mockISO14001Requirements,
              ...mockISO45001Requirements,
            ];
            // If a specific pharma standard was requested, filter down.
            if (standard) requirements = requirements.filter(r => r.standard === standard);
        }
        return { data: requirements, total: requirements.length, page: 1, pageSize: requirements.length, totalPages: 1 };
      }
    },
    staleTime: 30_000,
  });
}

export function useComplianceRequirement(id: string) {
  return useQuery<ComplianceRequirement>({
    queryKey: ['compliance', 'detail', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/compliance/${id}`);
        return unwrapItem<ComplianceRequirement>(data, normalizeCompliance);
      } catch {
        const all = [...mockRequirements, ...mockIATFRequirements, ...mockISO14001Requirements, ...mockISO45001Requirements];
        const req = all.find((r) => r.id === id);
        if (!req) throw new Error('Requirement not found');
        return req;
      }
    },
    enabled: !!id,
  });
}
