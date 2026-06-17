import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem } from '@/lib/apiShape';
import { useUserIndustry } from '@/lib/userIndustry';

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

// Medical-device compliance register — ISO 13485 / 21 CFR 820 / EU MDR / ISO 14971.
export const mockMedicalDeviceRequirements: ComplianceRequirement[] = [
  {
    id: 'md-cr1', standard: 'ISO 13485', clauseNumber: '4.2.3', clauseTitle: 'Medical device file',
    clauseText: 'The organization shall establish and maintain one or more files containing documents generated to demonstrate conformity to the requirement of this International Standard and compliance with applicable regulatory requirements.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-MD-QMS-04 Medical Device File Management'],
    linkedDocuments: ['DHF-DEV-MD-027 Smart Infusion Pump', 'DHF-DEV-MD-019 IOL Family'],
    linkedCAPAs: [],
    lastAssessed: '2026-02-10', nextReview: '2026-08-10', assessor: 'Dr. Anjali Verma',
    findings: 'All product-family DHFs maintained per SOP. Spot-checked 3 files — controlled, traceable.',
    gapActions: [], assessmentHistory: [{ date: '2026-02-10', assessor: 'Dr. Anjali Verma', status: 'COMPLIANT', notes: 'No gaps.' }],
  },
  {
    id: 'md-cr2', standard: 'ISO 13485', clauseNumber: '7.3.2', clauseTitle: 'Design and development planning',
    clauseText: 'The organization shall plan and control the design and development of product. Design and development plans shall be maintained.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-MD-DC-01 Design Control Procedure'],
    linkedDocuments: ['DP-INF-PUMP-v3 Design Plan'],
    linkedCAPAs: [], lastAssessed: '2026-03-01', nextReview: '2026-09-01', assessor: 'Aditya Menon',
    findings: 'Design plans current; phase gates documented in DHF.',
    gapActions: [], assessmentHistory: [],
  },
  {
    id: 'md-cr3', standard: 'ISO 13485', clauseNumber: '7.3.7', clauseTitle: 'Design and development verification',
    clauseText: 'Design and development verification shall be performed in accordance with planned and documented arrangements to ensure that the design and development outputs have met the design and development input requirements.',
    status: 'PARTIAL',
    linkedProcedures: ['SOP-MD-DC-03 Design Verification'],
    linkedDocuments: ['DV-PROT-MD-019'],
    linkedCAPAs: ['CAPA-MD-2026-0014'],
    lastAssessed: '2026-04-15', nextReview: '2026-07-15', assessor: 'Dr. Anjali Verma',
    findings: 'Internal audit MD-F1 noted DV-PROT-MD-019 missing pre-defined acceptance criteria on one bench test. Open NC.',
    gapActions: [
      { id: 'md-ga1', action: 'Revise DV-PROT-MD-019 — add quantitative acceptance criteria for all bench tests', owner: 'Aditya Menon', dueDate: '2026-05-15', status: 'Open' },
    ],
    assessmentHistory: [{ date: '2026-04-15', assessor: 'Dr. Anjali Verma', status: 'PARTIAL', notes: 'Open from MD-F1' }],
  },
  {
    id: 'md-cr4', standard: 'ISO 13485', clauseNumber: '7.5.7', clauseTitle: 'Particular requirements for sterile medical devices',
    clauseText: 'The organization shall maintain records of the parameters of the sterilization process used for each sterilization batch. Sterilization records shall be traceable to each production batch of medical devices.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-MD-EOS-01 EO Sterilization', 'SOP-MD-EOS-02 Sterilization Records'],
    linkedDocuments: ['VMP-MD-2025-04 Sterilization Master Plan'],
    linkedCAPAs: ['CAPA-MD-2026-0019'],
    lastAssessed: '2026-04-12', nextReview: '2026-10-12', assessor: 'Karthik Iyer',
    findings: 'Sterilization records traceable to each batch; CAPA-MD-2026-0019 strengthening parameter-recovery controls.',
    gapActions: [], assessmentHistory: [],
  },
  {
    id: 'md-cr5', standard: 'ISO 13485', clauseNumber: '8.2.1', clauseTitle: 'Feedback (Complaints / Vigilance)',
    clauseText: 'The organization shall document procedures for the feedback process. This feedback process shall include provisions to gather data from production as well as post-production activities.',
    status: 'PARTIAL',
    linkedProcedures: ['SOP-MD-PMS-01 Post-Market Surveillance'],
    linkedDocuments: ['Q3-2025 Vigilance Trend Report'],
    linkedCAPAs: [],
    lastAssessed: '2025-11-08', nextReview: '2026-05-08', assessor: 'Dr. Anjali Verma',
    findings: 'Q3 2025 vigilance trend report missed PRRC sign-off (audit finding MD-F4).',
    gapActions: [
      { id: 'md-ga2', action: 'Implement auto-escalation rule: serious event → PRRC notification ≤24h', owner: 'Aditya Menon', dueDate: '2026-05-30', status: 'In Progress' },
    ],
    assessmentHistory: [],
  },
  {
    id: 'md-cr6', standard: '21 CFR 820', clauseNumber: '820.30', clauseTitle: 'Design Controls',
    clauseText: 'Each manufacturer of any class III or class II device shall establish and maintain procedures to control the design of the device in order to ensure that specified design requirements are met.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-MD-DC-01', 'SOP-MD-DC-02', 'SOP-MD-DC-03'],
    linkedDocuments: ['DHF-DEV-MD-027', 'DHF-DEV-MD-019'],
    linkedCAPAs: [], lastAssessed: '2026-02-25', nextReview: '2026-08-25', assessor: 'Aditya Menon',
    findings: 'Design control system aligned with 21 CFR 820.30 (a)–(j). Last FDA inspection: no observations.',
    gapActions: [], assessmentHistory: [],
  },
  {
    id: 'md-cr7', standard: '21 CFR 820', clauseNumber: '820.198', clauseTitle: 'Complaint Files',
    clauseText: 'Each manufacturer shall maintain complaint files and establish and maintain procedures for receiving, reviewing, and evaluating complaints by a formally designated unit.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-MD-CMP-01 Complaint Handling'],
    linkedDocuments: ['Complaint Master Register'],
    linkedCAPAs: [], lastAssessed: '2026-03-15', nextReview: '2026-09-15', assessor: 'Neha Bansal',
    findings: 'Formally designated complaint unit in place. MDR-reportability decision tree updated 2026-Q1.',
    gapActions: [], assessmentHistory: [],
  },
  {
    id: 'md-cr8', standard: '21 CFR 820', clauseNumber: '820.50', clauseTitle: 'Purchasing Controls',
    clauseText: 'Each manufacturer shall establish and maintain procedures to ensure that all purchased or otherwise received product and services conform to specified requirements.',
    status: 'PARTIAL',
    linkedProcedures: ['SOP-MD-PUR-01 Supplier Qualification'],
    linkedDocuments: ['Approved Supplier List'],
    linkedCAPAs: [],
    lastAssessed: '2025-09-25', nextReview: '2026-03-25', assessor: 'Neha Bansal',
    findings: 'Supplier audit AUD-MD-2025-005 identified unauthorised manufacturing-site change at Specur Polymers (MDV-103). CAR open.',
    gapActions: [{ id: 'md-ga3', action: 'Close Specur Polymers CAR; tighten change-notification SLA in QAA', owner: 'Neha Bansal', dueDate: '2026-05-15', status: 'In Progress' }],
    assessmentHistory: [],
  },
  {
    id: 'md-cr9', standard: 'EU MDR 2017/745', clauseNumber: 'Art. 10(9)', clauseTitle: 'Quality management system obligations',
    clauseText: 'Manufacturers shall establish, document, implement, maintain, keep up to date and continually improve a quality management system that shall ensure compliance in the most effective manner and in a manner that is proportionate to the risk class.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-MD-QMS-01 Quality Manual'],
    linkedDocuments: ['Quality Manual MD-QM-2025'],
    linkedCAPAs: [], lastAssessed: '2025-11-05', nextReview: '2026-05-05', assessor: 'Dr. Anjali Verma',
    findings: 'QMS aligned with EU MDR Article 10(9). Recent TÜV SÜD surveillance audit closed with all findings addressed.',
    gapActions: [], assessmentHistory: [],
  },
  {
    id: 'md-cr10', standard: 'EU MDR 2017/745', clauseNumber: 'Annex XIV Part B', clauseTitle: 'Post-market clinical follow-up (PMCF)',
    clauseText: 'PMCF shall be understood to be a continuous process that updates the clinical evaluation referred to in Article 61 and Part A of this Annex and shall be addressed in the manufacturer\'s post-market surveillance plan.',
    status: 'PARTIAL',
    linkedProcedures: ['SOP-MD-PMS-02 PMCF Process'],
    linkedDocuments: ['PMS Plan v3'],
    linkedCAPAs: [],
    lastAssessed: '2025-11-05', nextReview: '2026-05-05', assessor: 'Sneha Kapoor',
    findings: 'PMS plan did not include quantitative criteria for trending FSNs across product families (notified body finding MD-F3).',
    gapActions: [{ id: 'md-ga4', action: 'Revise PMS plan with quantitative FSN-trend thresholds per product family', owner: 'Sneha Kapoor', dueDate: '2026-05-15', status: 'In Progress' }],
    assessmentHistory: [],
  },
  {
    id: 'md-cr11', standard: 'EU MDR 2017/745', clauseNumber: 'Art. 27', clauseTitle: 'Unique Device Identification system',
    clauseText: 'In order to allow the identification and to facilitate the traceability of devices, other than custom-made and investigational devices, the UDI system shall be established and shall allow the identification of devices through their distribution and use.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-MD-UDI-01 UDI Assignment', 'SOP-MD-UDI-02 UDI Print/Verify'],
    linkedDocuments: ['UDI Master Register'],
    linkedCAPAs: ['CAPA-MD-2026-0017'],
    lastAssessed: '2026-04-01', nextReview: '2026-10-01', assessor: 'Aditya Menon',
    findings: 'UDI assigned per product family; EUDAMED submission current. NC-MD-2026-0040 corrective action verified.',
    gapActions: [], assessmentHistory: [],
  },
  {
    id: 'md-cr12', standard: 'ISO 14971', clauseNumber: '4.4', clauseTitle: 'Risk management file',
    clauseText: 'The risk management file shall provide traceability for each identified hazard to: (a) the risk analysis; (b) the risk evaluation; (c) the implementation and verification of the risk control measures; (d) the assessment of the acceptability of any residual risks.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-MD-RM-01 Risk Management'],
    linkedDocuments: ['RMF-ISO14971-v3'],
    linkedCAPAs: [], lastAssessed: '2026-03-20', nextReview: '2026-09-20', assessor: 'Dr. Anjali Verma',
    findings: 'RMF traceability matrix current. Hazards linked to design outputs and risk controls.',
    gapActions: [], assessmentHistory: [],
  },
];

// Dairy tenant — FSSAI Schedule 4 / FSS Act / ISO 22000 / BIS / Codex.
export const mockDairyRequirements: ComplianceRequirement[] = [
  {
    id: 'dy-cr1', standard: 'FSSAI Schedule 4', clauseNumber: 'Part II §1', clauseTitle: 'General hygienic requirements — sanitary food premises',
    clauseText: 'The food premises shall be located, designed and constructed to ensure that food is not contaminated and is suitable for the intended use, including pest control and waste disposal arrangements.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-DY-HYG-01 Sanitary Premises'],
    linkedDocuments: ['Plant Layout Drawing 2026', 'Pest Control Service Contract 2026'],
    linkedCAPAs: [],
    lastAssessed: '2026-04-22', nextReview: '2026-10-22', assessor: 'Sandeep Joshi',
    findings: 'Plant layout, hygienic-zone segregation and pest-control program align with FSSAI Schedule 4 Part II §1.',
    gapActions: [], assessmentHistory: [{ date: '2026-04-22', assessor: 'Sandeep Joshi', status: 'COMPLIANT', notes: 'No gaps.' }],
  },
  {
    id: 'dy-cr2', standard: 'FSSAI Schedule 4', clauseNumber: 'Part II §3', clauseTitle: 'Personal hygiene of food handlers',
    clauseText: 'Food handlers shall maintain personal hygiene and undergo medical examination once a year. Handlers shall be free from any communicable disease.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-DY-HYG-02 Personal Hygiene'],
    linkedDocuments: ['Annual Medical Examination Register 2026'],
    linkedCAPAs: [],
    lastAssessed: '2026-04-22', nextReview: '2027-04-22', assessor: 'Priya Khanna',
    findings: 'All 124 food handlers had annual medical examinations completed by Apr 2026; gowning/hairnet/gloves SOP enforced.',
    gapActions: [], assessmentHistory: [],
  },
  {
    id: 'dy-cr3', standard: 'FSSAI 2.1.1', clauseNumber: '2.1.1.1', clauseTitle: 'Milk — Standards & label declarations',
    clauseText: 'Milk shall conform to the standards specified for the named variety (toned, double-toned, full-cream, standardised) with respect to minimum milk fat and minimum SNF percentage.',
    status: 'PARTIAL',
    linkedProcedures: ['SOP-DY-LAB-12 Fat / SNF Analysis'],
    linkedDocuments: ['Fat-SNF release register'],
    linkedCAPAs: [],
    lastAssessed: '2026-05-07', nextReview: '2026-08-07', assessor: 'Anita Kulkarni',
    findings: 'NC-DY-2026-0039 identified Full-Cream Milk batch PFC-26-0218 at 5.7% fat vs. 6.0% minimum. CAPA under definition.',
    gapActions: [
      { id: 'dy-ga1', action: 'Recalibrate cream-separator standardisation set-point on Line PHE-01', owner: 'Ravi Deshmukh', dueDate: '2026-05-25', status: 'In Progress' },
    ],
    assessmentHistory: [{ date: '2026-05-07', assessor: 'Anita Kulkarni', status: 'PARTIAL', notes: 'Open from NC-DY-2026-0039' }],
  },
  {
    id: 'dy-cr4', standard: 'FSSAI 2.3.4', clauseNumber: '2.3.4 (i)', clauseTitle: 'Antibiotic residues in milk and milk products',
    clauseText: 'Veterinary drug residues in milk and milk products shall not exceed the maximum residue limits as prescribed by Codex Alimentarius.',
    status: 'PARTIAL',
    linkedProcedures: ['SOP-DY-PROC-04 Raw-milk Acceptance'],
    linkedDocuments: ['Charm SL beta-lactam screening log'],
    linkedCAPAs: ['CAPA-DY-2026-0017'],
    lastAssessed: '2026-05-10', nextReview: '2026-08-10', assessor: 'Meera Pillai',
    findings: 'NC-DY-2026-0040 beta-lactam positive on Tanker T-2026-0498. Source farm suspended; CAPA in implementation.',
    gapActions: [
      { id: 'dy-ga2', action: 'Deploy Charm SL beta-lactam dipsticks at all 18 village collection centres', owner: 'Sandeep Joshi', dueDate: '2026-05-20', status: 'In Progress' },
    ],
    assessmentHistory: [],
  },
  {
    id: 'dy-cr5', standard: 'FSSAI 2.3.5', clauseNumber: '2.3.5', clauseTitle: 'Aflatoxin M1 in milk',
    clauseText: 'The level of Aflatoxin M1 in milk and milk products shall not exceed 0.5 µg/kg.',
    status: 'NON_COMPLIANT',
    linkedProcedures: ['SOP-DY-LAB-08 Aflatoxin M1 ELISA'],
    linkedDocuments: ['Aflatoxin M1 Test Register'],
    linkedCAPAs: ['CAPA-DY-2026-0019'],
    lastAssessed: '2026-05-16', nextReview: '2026-07-16', assessor: 'Anita Kulkarni',
    findings: 'NC-DY-2026-0042 — AfM1 at 0.71 µg/kg on Tanker T-2026-0512. Tanker rejected; feed audit + monsoon-screening program in CAPA-DY-2026-0019.',
    gapActions: [
      { id: 'dy-ga3', action: 'Pre-monsoon AfM1 sampling (twice-weekly Apr–Sep) for all procurement routes', owner: 'Anita Kulkarni', dueDate: '2026-06-10', status: 'In Progress' },
    ],
    assessmentHistory: [],
  },
  {
    id: 'dy-cr6', standard: 'FSSAI 2.3.2', clauseNumber: '2.3.2', clauseTitle: 'Microbiological standards — pasteurized milk',
    clauseText: 'Pasteurized milk shall conform to the specified microbiological standards: Total Plate Count NMT 30 000 cfu/ml, Coliforms NMT 10 cfu/ml, Phosphatase test negative.',
    status: 'PARTIAL',
    linkedProcedures: ['SOP-DY-MICRO-02 Microbial Limits Testing'],
    linkedDocuments: ['Microbiology Release Register Q1 2026'],
    linkedCAPAs: ['CAPA-DY-2026-0018'],
    lastAssessed: '2026-05-14', nextReview: '2026-08-14', assessor: 'Anita Kulkarni',
    findings: 'NC-DY-2026-0041 TPC 95 000 cfu/ml on batch PTM-26-0431. CIP recipe lock + ATP-swab verification in CAPA-DY-2026-0018.',
    gapActions: [],
    assessmentHistory: [],
  },
  {
    id: 'dy-cr7', standard: 'ISO 22000', clauseNumber: '7.1.3', clauseTitle: 'Externally provided processes, products and services',
    clauseText: 'The organization shall establish criteria for the evaluation, selection, monitoring of performance and re-evaluation of external providers of processes, products and services.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-DY-PROC-01 Supplier Qualification'],
    linkedDocuments: ['Approved Supplier List', 'Annual Supplier Scorecards'],
    linkedCAPAs: [],
    lastAssessed: '2026-04-12', nextReview: '2026-10-12', assessor: 'Meera Pillai',
    findings: 'Supplier qualification, approval and re-evaluation cadence aligned with ISO 22000 §7.1.3. Annual scorecard distributed Apr 2026.',
    gapActions: [], assessmentHistory: [],
  },
  {
    id: 'dy-cr8', standard: 'ISO 22000', clauseNumber: '8.5.1', clauseTitle: 'Establishment of HACCP plan',
    clauseText: 'The HACCP plan shall be developed, documented and maintained for each product or process, identifying significant hazards, CCPs, critical limits, monitoring and verification.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-DY-HACCP-01 HACCP Plan Authoring'],
    linkedDocuments: ['HACCP-PLAN-MILK-v6', 'HACCP-PLAN-CURD-v3', 'HACCP-PLAN-GHEE-v2'],
    linkedCAPAs: [],
    lastAssessed: '2026-04-12', nextReview: '2026-10-12', assessor: 'Sandeep Joshi',
    findings: 'HACCP plans for milk, curd, paneer, ghee and sweets all current. CCP monitoring records 100% complete in Q1 2026.',
    gapActions: [], assessmentHistory: [],
  },
  {
    id: 'dy-cr9', standard: 'ISO 22000', clauseNumber: '8.6.1', clauseTitle: 'Calibration / verification of monitoring and measuring equipment',
    clauseText: 'The organization shall ensure that monitoring and measuring activities required for food safety control are reliable, including calibration / verification of measuring equipment.',
    status: 'PARTIAL',
    linkedProcedures: ['SOP-DY-CAL-01 Equipment Calibration'],
    linkedDocuments: ['Calibration Master Schedule'],
    linkedCAPAs: [],
    lastAssessed: '2026-04-22', nextReview: '2026-07-22', assessor: 'Priya Khanna',
    findings: 'Audit DY-F1 noted pasteurizer-outlet thermometer drift not captured in shift-handover log on 2026-04-18. Calibration tightened.',
    gapActions: [{ id: 'dy-ga4', action: 'Add temperature-drift column to shift handover log', owner: 'Priya Khanna', dueDate: '2026-05-30', status: 'In Progress' }],
    assessmentHistory: [],
  },
  {
    id: 'dy-cr10', standard: 'BIS IS 3508', clauseNumber: '§5.1', clauseTitle: 'Ghee — chemical requirements',
    clauseText: 'Ghee shall conform to the requirements for moisture (NMT 0.5%), butyro-refractometer reading at 40 °C (40-43), Reichert value (NMT 31), free fatty acids (NMT 3.0%) as oleic acid and other parameters as specified in IS 3508.',
    status: 'PARTIAL',
    linkedProcedures: ['SOP-DY-LAB-15 Ghee Chemistry'],
    linkedDocuments: ['Ghee batch release register'],
    linkedCAPAs: [],
    lastAssessed: '2026-03-25', nextReview: '2026-06-25', assessor: 'Anita Kulkarni',
    findings: 'NC-DY-2026-0029 — Ghee batch GHC-26-0091 FFA 3.4% vs. NMT 3.0%. CAPA closed; butter-to-ghee turnaround now 48 h.',
    gapActions: [],
    assessmentHistory: [],
  },
  {
    id: 'dy-cr11', standard: 'BIS IS 1166', clauseNumber: '§4', clauseTitle: 'Skim Milk Powder — chemical & microbiological requirements',
    clauseText: 'Skim milk powder shall conform to the requirements specified — moisture NMT 4.5%, fat NMT 1.5%, protein NLT 34%, solubility, scorched particles and microbiological limits as per IS 1166.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-DY-LAB-09 Powder Analysis'],
    linkedDocuments: ['Dairy Whitener QA File'],
    linkedCAPAs: [],
    lastAssessed: '2026-03-18', nextReview: '2026-09-18', assessor: 'Anita Kulkarni',
    findings: 'Dairy whitener / SMP release lots Q1 2026 within IS 1166 limits. Supplier audit AUD-DY-2025-FARM closed.',
    gapActions: [], assessmentHistory: [],
  },
  {
    id: 'dy-cr12', standard: 'FSSAI Labelling 2020', clauseNumber: 'Reg 2.2', clauseTitle: 'Pre-packaged food labelling — best-before, MRP, FSSAI logo & licence',
    clauseText: 'Pre-packaged food labels shall declare name, list of ingredients, nutritional information, vegetarian / non-vegetarian symbol, FSSAI logo + licence number, net quantity, MRP, best-before / use-by date and address of manufacturer.',
    status: 'PARTIAL',
    linkedProcedures: ['SOP-DY-LABEL-04 Label Generation'],
    linkedDocuments: ['Artwork master register'],
    linkedCAPAs: [],
    lastAssessed: '2025-09-22', nextReview: '2026-03-22', assessor: 'Priya Khanna',
    findings: 'NC-DY-2025-0118 — date-print error on lot PFC-25-0612 quarantined. Two-person sign-off on FFS date change now mandatory.',
    gapActions: [
      { id: 'dy-ga5', action: 'Deploy vision-system best-before / MRP verification at end-of-line on FFS-02/03/04', owner: 'Sandeep Joshi', dueDate: '2026-09-30', status: 'Open' },
    ],
    assessmentHistory: [],
  },
];

// Biologics tenant — Mubadala Bio "DiabTec" (Abu Dhabi, UAE): biologics
// drug-substance (10,000 L fermentation) + aseptic cartridge fill-finish
// (insulin, analogues, GLP-1). EU GMP Annex 1 / ICH Q5A / ICH Q6B /
// 21 CFR Part 600 / 21 CFR Part 11 / ICH Q7.
export const mockBiologicsRequirements: ComplianceRequirement[] = [
  {
    id: 'bio-cr1', standard: 'EU GMP Annex 1', clauseNumber: '2.3', clauseTitle: 'Contamination Control Strategy',
    clauseText: 'A Contamination Control Strategy (CCS) shall be implemented across the facility to define all critical control points and assess the effectiveness of the controls and monitoring measures employed to manage risks to medicinal product quality and safety.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-BIO-CCS-01 Contamination Control Strategy'],
    linkedDocuments: ['CCS-DIABTEC-2026 Site Contamination Control Strategy'],
    linkedCAPAs: [],
    lastAssessed: '2026-03-12', nextReview: '2026-09-12', assessor: 'Dr. Layla Al-Mansoori',
    findings: 'Site-wide CCS authored and approved; holistic review of fill-finish controls completed. Linked to EM and QRM programs.',
    gapActions: [], assessmentHistory: [{ date: '2026-03-12', assessor: 'Dr. Layla Al-Mansoori', status: 'COMPLIANT', notes: 'No gaps.' }],
  },
  {
    id: 'bio-cr2', standard: 'EU GMP Annex 1', clauseNumber: '4.29', clauseTitle: 'Environmental and process monitoring — Grade A',
    clauseText: 'For Grade A zones, continuous viable and total particle monitoring shall be performed for the full duration of critical processing, including equipment assembly, except where justified by contaminants in the process that would damage the particle counter.',
    status: 'PARTIAL',
    linkedProcedures: ['SOP-BIO-EM-02 Aseptic Zone Monitoring'],
    linkedDocuments: ['EM Trend Report Q1-2026', 'Isolator Qualification IQ/OQ-FF-02'],
    linkedCAPAs: ['CAPA-BIO-2026-0011'],
    lastAssessed: '2026-04-18', nextReview: '2026-07-18', assessor: 'Omar Al-Farsi',
    findings: 'Internal audit BIO-F1 noted a gap in continuous total-particle coverage during cartridge-line setup on FF-02. CAPA open.',
    gapActions: [
      { id: 'bio-ga1', action: 'Extend continuous particle monitoring to full equipment-assembly window on Line FF-02', owner: 'Omar Al-Farsi', dueDate: '2026-06-30', status: 'In Progress' },
    ],
    assessmentHistory: [{ date: '2026-04-18', assessor: 'Omar Al-Farsi', status: 'PARTIAL', notes: 'Open from BIO-F1' }],
  },
  {
    id: 'bio-cr3', standard: 'EU GMP Annex 1', clauseNumber: '9.16', clauseTitle: 'Aseptic Process Simulation (media fill)',
    clauseText: 'Aseptic process simulations shall be conducted to validate the aseptic process and shall closely simulate the routine aseptic manufacturing process and include all critical subsequent manufacturing steps.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-BIO-APS-01 Media Fill Program'],
    linkedDocuments: ['APS-FF-02-2026 Media Fill Report'],
    linkedCAPAs: [],
    lastAssessed: '2026-02-28', nextReview: '2026-08-28', assessor: 'Dr. Sami Haddad',
    findings: 'Three consecutive media fills on FF-02 passed with zero contaminated units; worst-case interventions included. Line qualified.',
    gapActions: [], assessmentHistory: [],
  },
  {
    id: 'bio-cr4', standard: 'EU GMP Annex 1', clauseNumber: '8.123', clauseTitle: 'Sterilising filtration and integrity testing',
    clauseText: 'The integrity of the sterilised filter assembly shall be verified by testing before use, where this would not affect the validated process, and verified by on-line testing immediately after use by an appropriate method such as a bubble point, diffusive flow, water intrusion or pressure hold test.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-BIO-FIL-03 Sterile Filtration & PUPSIT'],
    linkedDocuments: ['Filter Validation FV-DS-2025-07'],
    linkedCAPAs: [],
    lastAssessed: '2026-03-30', nextReview: '2026-09-30', assessor: 'Dr. Sami Haddad',
    findings: 'Pre- and post-use integrity testing (PUPSIT) implemented on drug-substance and fill-finish sterilising filters; all releases compliant.',
    gapActions: [], assessmentHistory: [],
  },
  {
    id: 'bio-cr5', standard: 'ICH Q5A', clauseNumber: '4', clauseTitle: 'Viral clearance evaluation',
    clauseText: 'The capacity of the manufacturing process to remove and/or inactivate viruses shall be evaluated through validation studies using relevant or specific model viruses spiked at appropriate process steps.',
    status: 'PARTIAL',
    linkedProcedures: ['SOP-BIO-VS-01 Viral Safety & Clearance'],
    linkedDocuments: ['Viral Clearance Study VCS-2025-03'],
    linkedCAPAs: ['CAPA-BIO-2026-0014'],
    lastAssessed: '2026-04-05', nextReview: '2026-07-05', assessor: 'Dr. Layla Al-Mansoori',
    findings: 'Audit BIO-F2 found one downstream chromatography step lacked a documented viral-clearance log-reduction claim for the GLP-1 process. CAPA open.',
    gapActions: [
      { id: 'bio-ga2', action: 'Commission spiking study for AEX polishing step (GLP-1) and update viral safety dossier', owner: 'Dr. Sami Haddad', dueDate: '2026-06-20', status: 'In Progress' },
    ],
    assessmentHistory: [],
  },
  {
    id: 'bio-cr6', standard: 'ICH Q5A', clauseNumber: '2.3', clauseTitle: 'Microbial / cell-bank characterisation',
    clauseText: 'Cell substrates used for the production of biotechnological products shall be characterised and tested for the absence of adventitious agents and endogenous viruses at the level of the master and working cell banks.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-BIO-CB-02 Cell Bank Characterisation'],
    linkedDocuments: ['MCB/WCB Characterisation Report CB-2025-01'],
    linkedCAPAs: [],
    lastAssessed: '2026-02-14', nextReview: '2026-08-14', assessor: 'Khalid Nasser',
    findings: 'MCB and WCB for the insulin host strain fully characterised; adventitious-agent testing complete and within acceptance.',
    gapActions: [], assessmentHistory: [],
  },
  {
    id: 'bio-cr7', standard: 'ICH Q6B', clauseNumber: '2.1', clauseTitle: 'Specifications — analytical procedures for biotech products',
    clauseText: 'Specifications shall be established and justified based on data obtained from lots used in preclinical and clinical studies and from lots used for stability studies, and shall consist of a list of tests, references to analytical procedures and appropriate acceptance criteria.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-BIO-SPEC-01 Specification Setting'],
    linkedDocuments: ['DS/DP Specification SPEC-INS-2025-v4'],
    linkedCAPAs: [],
    lastAssessed: '2026-03-22', nextReview: '2026-09-22', assessor: 'Dr. Sami Haddad',
    findings: 'Drug-substance and drug-product specifications justified per ICH Q6B; identity, purity, potency and impurity tests defined for insulin and analogues.',
    gapActions: [], assessmentHistory: [],
  },
  {
    id: 'bio-cr8', standard: 'ICH Q6B', clauseNumber: '6.2', clauseTitle: 'Potency assay validation',
    clauseText: 'A relevant, validated potency assay shall be part of the specifications for a biotechnological or biological product, expressing the specific ability or capacity of the product to achieve its intended biological effect.',
    status: 'PARTIAL',
    linkedProcedures: ['SOP-BIO-QC-07 Potency Bioassay'],
    linkedDocuments: ['Potency Assay Validation PAV-2025-02'],
    linkedCAPAs: [],
    lastAssessed: '2026-04-10', nextReview: '2026-07-10', assessor: 'Khalid Nasser',
    findings: 'Audit BIO-F3 noted the GLP-1 cell-based potency assay validation lacked intermediate-precision data across analysts. Re-validation in progress.',
    gapActions: [
      { id: 'bio-ga3', action: 'Complete intermediate-precision arm of GLP-1 potency assay re-validation', owner: 'Khalid Nasser', dueDate: '2026-06-15', status: 'In Progress' },
    ],
    assessmentHistory: [],
  },
  {
    id: 'bio-cr9', standard: '21 CFR Part 600', clauseNumber: '600.10', clauseTitle: 'Personnel — qualification and training',
    clauseText: 'Personnel shall have a capability to perform their assigned functions, have an understanding of the precautions necessary to prevent contamination and microbiological hazards, and be of good health to the extent that their state of health does not adversely affect the product.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-BIO-HR-01 Aseptic Gowning Qualification'],
    linkedDocuments: ['Gowning Qualification Register 2026'],
    linkedCAPAs: [],
    lastAssessed: '2026-03-05', nextReview: '2026-09-05', assessor: 'Omar Al-Farsi',
    findings: 'All Grade A/B operators hold current gowning qualification and aseptic-technique certification. Health-surveillance program active.',
    gapActions: [], assessmentHistory: [],
  },
  {
    id: 'bio-cr10', standard: '21 CFR Part 600', clauseNumber: '610.12', clauseTitle: 'Sterility testing of biological products',
    clauseText: 'The sterility of each lot of each biological product shall be demonstrated by performing sterility tests as prescribed, or by an alternative procedure that has been validated and approved.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-BIO-QC-03 Sterility Test', 'SOP-BIO-QC-04 RMM Sterility'],
    linkedDocuments: ['Sterility Method Suitability MSV-2025-06'],
    linkedCAPAs: [],
    lastAssessed: '2026-02-20', nextReview: '2026-08-20', assessor: 'Dr. Layla Al-Mansoori',
    findings: 'Closed-system sterility testing under isolator; method suitability validated for all insulin and GLP-1 presentations.',
    gapActions: [], assessmentHistory: [],
  },
  {
    id: 'bio-cr11', standard: '21 CFR Part 11', clauseNumber: '11.10', clauseTitle: 'Controls for closed systems (data integrity)',
    clauseText: 'Persons who use closed systems to create, modify, maintain, or transmit electronic records shall employ procedures and controls designed to ensure the authenticity, integrity, and confidentiality of electronic records, including audit trails, access controls and operational system checks.',
    status: 'PARTIAL',
    linkedProcedures: ['SOP-BIO-IT-02 Data Integrity & Audit Trail Review'],
    linkedDocuments: ['CSV Validation Pack — Chromatography Data System'],
    linkedCAPAs: ['CAPA-BIO-2026-0018'],
    lastAssessed: '2026-04-25', nextReview: '2026-07-25', assessor: 'Omar Al-Farsi',
    findings: 'Audit BIO-F4 found periodic audit-trail review was not documented for the QC chromatography data system. CAPA open.',
    gapActions: [
      { id: 'bio-ga4', action: 'Implement and document monthly audit-trail review for CDS and standalone balances', owner: 'Omar Al-Farsi', dueDate: '2026-06-10', status: 'Open' },
    ],
    assessmentHistory: [],
  },
  {
    id: 'bio-cr12', standard: 'ICH Q7', clauseNumber: '11.1', clauseTitle: 'Batch release of drug substance',
    clauseText: 'To ensure that each batch of API meets established specifications, written procedures describing the sampling, testing, approval or rejection of materials and the release of the API for use shall be established and followed by the quality unit.',
    status: 'COMPLIANT',
    linkedProcedures: ['SOP-BIO-QA-05 Batch Disposition & Release'],
    linkedDocuments: ['Batch Release Register 2026'],
    linkedCAPAs: [],
    lastAssessed: '2026-03-18', nextReview: '2026-09-18', assessor: 'Dr. Sami Haddad',
    findings: 'Drug-substance batch disposition controlled by the Qualified Person; review-by-exception with full BR checklist. Cold-chain / GDP records verified at release.',
    gapActions: [], assessmentHistory: [],
  },
];

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useComplianceRequirements(standard?: string) {
  const industry = useUserIndustry();
  return useQuery({
    queryKey: ['compliance', standard, industry ?? 'default'],
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
        // Industry-scoped tenants see their own clause register. Pharma + ISO
        // defaults are reserved for the legacy multi-industry view.
        let requirements: ComplianceRequirement[];
        if (industry === 'medical_device') {
          requirements = standard
            ? mockMedicalDeviceRequirements.filter(r => r.standard === standard)
            : mockMedicalDeviceRequirements;
        } else if (industry === 'dairy') {
          requirements = standard
            ? mockDairyRequirements.filter(r => r.standard === standard)
            : mockDairyRequirements;
        } else if (industry === 'biologics') {
          requirements = standard
            ? mockBiologicsRequirements.filter(r => r.standard === standard)
            : mockBiologicsRequirements;
        } else {
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
        }
        return { data: requirements, total: requirements.length, page: 1, pageSize: requirements.length, totalPages: 1 };
      }
    },
    staleTime: 30_000,
  });
}

export function useComplianceRequirement(id: string) {
  const industry = useUserIndustry();
  return useQuery<ComplianceRequirement>({
    queryKey: ['compliance', 'detail', id, industry ?? 'default'],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/compliance/${id}`);
        return unwrapItem<ComplianceRequirement>(data, normalizeCompliance);
      } catch {
        const all =
          industry === 'medical_device' ? mockMedicalDeviceRequirements :
          industry === 'dairy'          ? mockDairyRequirements :
          industry === 'biologics'      ? mockBiologicsRequirements :
          [...mockRequirements, ...mockIATFRequirements, ...mockISO14001Requirements, ...mockISO45001Requirements, ...mockPharmaRequirements];
        const req = all.find((r) => r.id === id);
        if (!req) throw new Error('Requirement not found');
        return req;
      }
    },
    enabled: !!id,
  });
}
