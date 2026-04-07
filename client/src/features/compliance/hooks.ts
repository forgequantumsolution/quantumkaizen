// ============================================================
// COMPLIANCE MODULE — HOOKS & MOCK DATA
// Covers: QMS/DMS/LMS regulatory compliance per
// Pharma (FDA/EU GMP/ICH), Chemical (OSHA PSM/REACH),
// Food & Beverage (FSMA/HACCP/GFSI), Automotive (IATF 16949)
// ============================================================

export type Industry = 'PHARMA' | 'CHEMICAL' | 'FOOD' | 'AUTOMOTIVE';
export type SystemType = 'QMS' | 'DMS' | 'LMS';
export type ImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type ComplianceStatus = 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT';
export type ReadinessStatus = 'GREEN' | 'AMBER' | 'RED';

// ── Regulatory Framework ──────────────────────────────────────────────────────

export interface RegulatoryFramework {
  id: string;
  name: string;
  shortName: string;
  industry: Industry;
  category: string;
  complianceScore: number;
  openGaps: number;
  criticalGaps: number;
  lastReviewDate: string;
  nextReviewDate: string;
  clauses: { id: string; ref: string; title: string; status: ComplianceStatus }[];
}

export const regulatoryFrameworks: RegulatoryFramework[] = [
  {
    id: 'fda-cgmp',
    name: 'FDA 21 CFR Parts 210 & 211',
    shortName: 'FDA cGMP',
    industry: 'PHARMA',
    category: 'GMP',
    complianceScore: 92,
    openGaps: 4,
    criticalGaps: 1,
    lastReviewDate: '2025-10-15',
    nextReviewDate: '2026-04-15',
    clauses: [
      { id: 'c1', ref: '21 CFR 211.68', title: 'Automatic, mechanical, electronic equipment', status: 'COMPLIANT' },
      { id: 'c2', ref: '21 CFR 211.100', title: 'Written procedures; deviations', status: 'PARTIAL' },
      { id: 'c3', ref: '21 CFR 211.180', title: 'Records and reports — retention', status: 'COMPLIANT' },
      { id: 'c4', ref: '21 CFR 211.192', title: 'Production record review', status: 'COMPLIANT' },
      { id: 'c5', ref: '21 CFR 211.198', title: 'Complaint files', status: 'PARTIAL' },
    ],
  },
  {
    id: 'fda-part11',
    name: 'FDA 21 CFR Part 11',
    shortName: 'Part 11 / e-Records',
    industry: 'PHARMA',
    category: 'Data Integrity',
    complianceScore: 88,
    openGaps: 3,
    criticalGaps: 0,
    lastReviewDate: '2025-11-01',
    nextReviewDate: '2026-05-01',
    clauses: [
      { id: 'c1', ref: 'Part 11.10(a)', title: 'Validation of electronic records systems', status: 'COMPLIANT' },
      { id: 'c2', ref: 'Part 11.10(b)', title: 'Accurate and ready retrieval', status: 'COMPLIANT' },
      { id: 'c3', ref: 'Part 11.10(e)', title: 'Use of secure, computer-generated audit trails', status: 'PARTIAL' },
      { id: 'c4', ref: 'Part 11.50', title: 'Signature manifestations', status: 'PARTIAL' },
      { id: 'c5', ref: 'Part 11.70', title: 'Signature/record linking', status: 'COMPLIANT' },
    ],
  },
  {
    id: 'eu-gmp-annex11',
    name: 'EU GMP Annex 11 — Computerised Systems',
    shortName: 'Annex 11',
    industry: 'PHARMA',
    category: 'GMP',
    complianceScore: 85,
    openGaps: 6,
    criticalGaps: 1,
    lastReviewDate: '2025-09-20',
    nextReviewDate: '2026-03-20',
    clauses: [
      { id: 'c1', ref: 'Annex 11 §1', title: 'Risk Management', status: 'COMPLIANT' },
      { id: 'c2', ref: 'Annex 11 §4', title: 'Validation', status: 'PARTIAL' },
      { id: 'c3', ref: 'Annex 11 §7', title: 'Data Storage', status: 'COMPLIANT' },
      { id: 'c4', ref: 'Annex 11 §9', title: 'Audit Trails', status: 'PARTIAL' },
      { id: 'c5', ref: 'Annex 11 §12', title: 'Security', status: 'NON_COMPLIANT' },
    ],
  },
  {
    id: 'ich-q9',
    name: 'ICH Q9 — Quality Risk Management',
    shortName: 'ICH Q9',
    industry: 'PHARMA',
    category: 'Quality',
    complianceScore: 91,
    openGaps: 2,
    criticalGaps: 0,
    lastReviewDate: '2025-12-01',
    nextReviewDate: '2026-06-01',
    clauses: [
      { id: 'c1', ref: 'ICH Q9 §5', title: 'Risk identification', status: 'COMPLIANT' },
      { id: 'c2', ref: 'ICH Q9 §6', title: 'Risk evaluation', status: 'COMPLIANT' },
      { id: 'c3', ref: 'ICH Q9 §7', title: 'Risk control', status: 'PARTIAL' },
      { id: 'c4', ref: 'ICH Q9 §8', title: 'Risk communication', status: 'COMPLIANT' },
      { id: 'c5', ref: 'ICH Q9 §9', title: 'Risk review', status: 'PARTIAL' },
    ],
  },
  {
    id: 'osha-psm',
    name: 'OSHA PSM — 29 CFR 1910.119',
    shortName: 'OSHA PSM',
    industry: 'CHEMICAL',
    category: 'Process Safety',
    complianceScore: 84,
    openGaps: 7,
    criticalGaps: 2,
    lastReviewDate: '2025-08-10',
    nextReviewDate: '2026-08-10',
    clauses: [
      { id: 'c1', ref: '§1910.119(e)', title: 'Process Safety Information', status: 'COMPLIANT' },
      { id: 'c2', ref: '§1910.119(g)', title: 'Training — initial and refresher', status: 'PARTIAL' },
      { id: 'c3', ref: '§1910.119(l)', title: 'Management of Change', status: 'PARTIAL' },
      { id: 'c4', ref: '§1910.119(m)', title: 'Incident Investigation', status: 'COMPLIANT' },
      { id: 'c5', ref: '§1910.119(o)', title: 'Compliance Audits (triennial)', status: 'NON_COMPLIANT' },
    ],
  },
  {
    id: 'reach',
    name: 'EU REACH — EC 1907/2006',
    shortName: 'REACH',
    industry: 'CHEMICAL',
    category: 'Substance Compliance',
    complianceScore: 79,
    openGaps: 9,
    criticalGaps: 3,
    lastReviewDate: '2025-07-15',
    nextReviewDate: '2026-01-15',
    clauses: [
      { id: 'c1', ref: 'REACH Art. 31', title: 'SDS requirements', status: 'PARTIAL' },
      { id: 'c2', ref: 'REACH Art. 33', title: 'SVHC >0.1% w/w disclosure', status: 'NON_COMPLIANT' },
      { id: 'c3', ref: 'REACH Art. 36', title: 'Record retention (10 years)', status: 'COMPLIANT' },
      { id: 'c4', ref: 'REACH Annex XIV', title: 'Substances requiring authorisation', status: 'PARTIAL' },
      { id: 'c5', ref: 'REACH Annex XVII', title: 'Restrictions on hazardous substances', status: 'PARTIAL' },
    ],
  },
  {
    id: 'fsma-117',
    name: 'FSMA 21 CFR Part 117 — HARPC',
    shortName: 'FSMA HARPC',
    industry: 'FOOD',
    category: 'Food Safety',
    complianceScore: 82,
    openGaps: 8,
    criticalGaps: 2,
    lastReviewDate: '2025-09-05',
    nextReviewDate: '2026-03-05',
    clauses: [
      { id: 'c1', ref: 'Part 117.126', title: 'Food safety plan requirement', status: 'COMPLIANT' },
      { id: 'c2', ref: 'Part 117.135', title: 'Preventive controls', status: 'PARTIAL' },
      { id: 'c3', ref: 'Part 117.145', title: 'Monitoring requirements', status: 'COMPLIANT' },
      { id: 'c4', ref: 'Part 117.150', title: 'Corrective actions & corrections', status: 'PARTIAL' },
      { id: 'c5', ref: 'Part 117.165', title: 'Verification activities', status: 'NON_COMPLIANT' },
    ],
  },
  {
    id: 'iso-22000',
    name: 'ISO 22000:2018 — Food Safety Management',
    shortName: 'ISO 22000',
    industry: 'FOOD',
    category: 'Food Safety',
    complianceScore: 87,
    openGaps: 5,
    criticalGaps: 1,
    lastReviewDate: '2025-10-20',
    nextReviewDate: '2026-04-20',
    clauses: [
      { id: 'c1', ref: 'ISO 22000 §6.1', title: 'Hazard analysis', status: 'COMPLIANT' },
      { id: 'c2', ref: 'ISO 22000 §8.5', title: 'Prerequisite programme (PRPs)', status: 'COMPLIANT' },
      { id: 'c3', ref: 'ISO 22000 §8.6', title: 'Hazard analysis', status: 'PARTIAL' },
      { id: 'c4', ref: 'ISO 22000 §8.9', title: 'Control of NC products', status: 'PARTIAL' },
      { id: 'c5', ref: 'ISO 22000 §9.1', title: 'Monitoring, measurement, analysis', status: 'COMPLIANT' },
    ],
  },
  {
    id: 'iatf-16949',
    name: 'IATF 16949:2016',
    shortName: 'IATF 16949',
    industry: 'AUTOMOTIVE',
    category: 'Quality',
    complianceScore: 94,
    openGaps: 2,
    criticalGaps: 0,
    lastReviewDate: '2025-11-15',
    nextReviewDate: '2026-05-15',
    clauses: [
      { id: 'c1', ref: 'IATF §6.1.2.3', title: 'Contingency planning', status: 'COMPLIANT' },
      { id: 'c2', ref: 'IATF §7.2', title: 'Competence', status: 'COMPLIANT' },
      { id: 'c3', ref: 'IATF §8.3', title: 'Design & development (APQP)', status: 'COMPLIANT' },
      { id: 'c4', ref: 'IATF §8.7.1', title: 'Control of NC outputs', status: 'PARTIAL' },
      { id: 'c5', ref: 'IATF §10.2', title: 'Nonconformity and corrective action', status: 'PARTIAL' },
    ],
  },
  {
    id: 'iso-26262',
    name: 'ISO 26262:2018 — Functional Safety',
    shortName: 'ISO 26262',
    industry: 'AUTOMOTIVE',
    category: 'Functional Safety',
    complianceScore: 76,
    openGaps: 11,
    criticalGaps: 2,
    lastReviewDate: '2025-06-30',
    nextReviewDate: '2026-06-30',
    clauses: [
      { id: 'c1', ref: 'ISO 26262-3 §6', title: 'ITEM definition', status: 'COMPLIANT' },
      { id: 'c2', ref: 'ISO 26262-3 §7', title: 'Hazard analysis & risk assessment', status: 'PARTIAL' },
      { id: 'c3', ref: 'ISO 26262-3 §8', title: 'Functional safety concept', status: 'PARTIAL' },
      { id: 'c4', ref: 'ISO 26262-4 §6', title: 'Technical safety requirements', status: 'NON_COMPLIANT' },
      { id: 'c5', ref: 'ISO 26262-8 §6', title: 'Confidence in SW', status: 'NON_COMPLIANT' },
    ],
  },
];

// ── ALCOA+ Metrics ────────────────────────────────────────────────────────────

export interface ALCOAMetric {
  principle: string;
  letter: string;
  score: number;
  openFindings: number;
  description: string;
}

export const alcoaMetrics: ALCOAMetric[] = [
  { principle: 'Attributable', letter: 'A', score: 96, openFindings: 2, description: 'Each record linked to its creator with user ID and timestamp' },
  { principle: 'Legible', letter: 'L', score: 99, openFindings: 0, description: 'All records readable and permanent' },
  { principle: 'Contemporaneous', letter: 'C', score: 97, openFindings: 1, description: 'Records created at time of activity' },
  { principle: 'Original', letter: 'O', score: 100, openFindings: 0, description: 'First capture of data; no transcription errors' },
  { principle: 'Accurate', letter: 'A', score: 93, openFindings: 4, description: 'Data free from errors, corrections documented' },
  { principle: 'Complete', letter: 'C', score: 89, openFindings: 6, description: 'No blank fields without justification' },
  { principle: 'Consistent', letter: 'C', score: 97, openFindings: 1, description: 'Uniform date/time formats and units' },
  { principle: 'Enduring', letter: 'E', score: 100, openFindings: 0, description: 'Records retained per regulatory retention schedule' },
  { principle: 'Available', letter: 'A', score: 99, openFindings: 0, description: 'Records accessible on demand for inspection' },
];

// ── Cross-System Integration Triggers ────────────────────────────────────────

export interface IntegrationTrigger {
  id: string;
  from: SystemType;
  to: SystemType;
  sourceType: string;
  sourceId: string;
  sourceTitle: string;
  triggerType: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
  createdAt: string;
  dueDate: string;
  owner: string;
}

export const integrationTriggers: IntegrationTrigger[] = [
  { id: 't1', from: 'QMS', to: 'DMS', sourceType: 'CAPA', sourceId: 'CAPA-2026-0018', sourceTitle: 'Tablet coating defect CAPA', triggerType: 'Document Revision Required', status: 'PENDING', createdAt: '2026-03-28', dueDate: '2026-04-10', owner: 'Priya Sharma' },
  { id: 't2', from: 'QMS', to: 'DMS', sourceType: 'Change Control', sourceId: 'CR-2026-0007', sourceTitle: 'Granulation process parameter change', triggerType: 'SOP Revision Required', status: 'IN_PROGRESS', createdAt: '2026-03-20', dueDate: '2026-04-05', owner: 'Rajesh Kumar' },
  { id: 't3', from: 'QMS', to: 'LMS', sourceType: 'CAPA', sourceId: 'CAPA-2026-0019', sourceTitle: 'Data integrity CAPA — GDP training gap', triggerType: 'Training Assignment', status: 'COMPLETED', createdAt: '2026-03-15', dueDate: '2026-03-30', owner: 'Anita Desai' },
  { id: 't4', from: 'DMS', to: 'LMS', sourceType: 'Document', sourceId: 'SOP-QMS-001 v4.0', sourceTitle: 'Deviation Management SOP revision', triggerType: 'Read & Understand Assignment', status: 'PENDING', createdAt: '2026-03-29', dueDate: '2026-04-12', owner: 'Deepak Nair' },
  { id: 't5', from: 'DMS', to: 'LMS', sourceType: 'Document', sourceId: 'WI-PRD-012 v2.0', sourceTitle: 'Tablet compression work instruction', triggerType: 'Read & Understand Assignment', status: 'IN_PROGRESS', createdAt: '2026-03-25', dueDate: '2026-04-08', owner: 'Sunita Rao' },
  { id: 't6', from: 'LMS', to: 'QMS', sourceType: 'Training', sourceId: 'TRN-2026-GMP-02', sourceTitle: 'GMP Refresher — Production Operators', triggerType: 'Process Execution Gate', status: 'PENDING', createdAt: '2026-03-27', dueDate: '2026-04-03', owner: 'Vikram Patel' },
  { id: 't7', from: 'QMS', to: 'DMS', sourceType: 'NC', sourceId: 'NC-2026-0038', sourceTitle: 'OOS investigation — analytical method', triggerType: 'Specification Revision', status: 'IN_PROGRESS', createdAt: '2026-03-18', dueDate: '2026-04-02', owner: 'Priya Sharma' },
  { id: 't8', from: 'DMS', to: 'LMS', sourceType: 'Document', sourceId: 'SOP-QC-034 v3.1', sourceTitle: 'HPLC analytical method SOP', triggerType: 'Analyst Requalification', status: 'PENDING', createdAt: '2026-03-30', dueDate: '2026-04-15', owner: 'Anita Desai' },
];

// ── Inspection Readiness ──────────────────────────────────────────────────────

export interface ChecklistItem {
  id: string;
  category: string;
  requirement: string;
  status: 'PASS' | 'FAIL' | 'PARTIAL' | 'NA';
  evidence: string | null;
  criticalForInspection: boolean;
}

export interface InspectionFramework {
  id: string;
  name: string;
  body: string;
  standard: string;
  industry: Industry;
  readinessScore: number;
  status: ReadinessStatus;
  lastInspectionDate: string | null;
  nextExpectedDate: string;
  criticalOpenItems: number;
  majorOpenItems: number;
  minorOpenItems: number;
  checklistItems: ChecklistItem[];
}

export const inspectionFrameworks: InspectionFramework[] = [
  {
    id: 'fda-gmp',
    name: 'FDA GMP / PAI Inspection',
    body: 'FDA',
    standard: '21 CFR Parts 210 & 211',
    industry: 'PHARMA',
    readinessScore: 91,
    status: 'GREEN',
    lastInspectionDate: '2024-09-12',
    nextExpectedDate: '2026-09-01',
    criticalOpenItems: 1,
    majorOpenItems: 3,
    minorOpenItems: 5,
    checklistItems: [
      { id: 'i1', category: 'Quality Systems', requirement: 'Quality Management System documented and implemented', status: 'PASS', evidence: 'QMS-MAN-001 v3.0', criticalForInspection: true },
      { id: 'i2', category: 'Quality Systems', requirement: 'Deviation management SOPs in place with trending', status: 'PASS', evidence: 'SOP-QMS-001 v4.0', criticalForInspection: true },
      { id: 'i3', category: 'Data Integrity', requirement: '21 CFR Part 11 e-signature validation complete', status: 'PARTIAL', evidence: 'CSV-VAL-011 (IQ/OQ complete, PQ pending)', criticalForInspection: true },
      { id: 'i4', category: 'Data Integrity', requirement: 'ALCOA+ audit trail review performed annually', status: 'PASS', evidence: 'DI-RPT-2025-Q4', criticalForInspection: true },
      { id: 'i5', category: 'CAPA', requirement: 'CAPA system effectiveness reviews documented', status: 'PASS', evidence: 'CAPA trend report Q1 2026', criticalForInspection: false },
      { id: 'i6', category: 'CAPA', requirement: 'Root cause analysis tools (5-Why/Fishbone) used', status: 'PASS', evidence: 'CAPA-2026-0018', criticalForInspection: false },
      { id: 'i7', category: 'Training', requirement: 'GMP training records current for all personnel', status: 'PARTIAL', evidence: 'Training compliance 92%; 8 overdue', criticalForInspection: false },
      { id: 'i8', category: 'Training', requirement: 'Annual data integrity ALCOA+ refresher completed', status: 'FAIL', evidence: 'Q1 2026 cohort pending', criticalForInspection: true },
      { id: 'i9', category: 'Documents', requirement: 'All controlled documents at current revision', status: 'PASS', evidence: 'DMS audit Feb 2026', criticalForInspection: false },
      { id: 'i10', category: 'Documents', requirement: 'Batch records reconciliation at batch close', status: 'PASS', evidence: 'BPR checklist SOP-BPR-002', criticalForInspection: true },
    ],
  },
  {
    id: 'ema-gmp',
    name: 'EMA GMP Inspection',
    body: 'EMA / National CA',
    standard: 'EU GMP EudraLex Vol. 4',
    industry: 'PHARMA',
    readinessScore: 84,
    status: 'AMBER',
    lastInspectionDate: '2024-04-22',
    nextExpectedDate: '2027-04-01',
    criticalOpenItems: 2,
    majorOpenItems: 5,
    minorOpenItems: 8,
    checklistItems: [
      { id: 'i1', category: 'Computerised Systems', requirement: 'Annex 11 validation lifecycle documented (GAMP 5)', status: 'PARTIAL', evidence: 'VMP-2025 covers QMS; DMS pending PQ', criticalForInspection: true },
      { id: 'i2', category: 'Computerised Systems', requirement: 'Audit trail review procedure implemented', status: 'PARTIAL', evidence: 'SOP-DI-003 draft; not yet effective', criticalForInspection: true },
      { id: 'i3', category: 'Computerised Systems', requirement: 'System access management (quarterly review)', status: 'FAIL', evidence: 'Last review Dec 2024 — overdue', criticalForInspection: true },
      { id: 'i4', category: 'GMP Training', requirement: 'Personnel training records ≥3 years retained', status: 'PASS', evidence: 'LMS retention policy confirmed', criticalForInspection: false },
      { id: 'i5', category: 'Self-Inspections', requirement: 'EU GMP Chapter 9 self-inspection conducted annually', status: 'PASS', evidence: 'AUD-2025-INT-012', criticalForInspection: false },
      { id: 'i6', category: 'Quality System', requirement: 'APR/PQR compiled for all marketed products', status: 'PARTIAL', evidence: '3 of 5 products complete', criticalForInspection: false },
      { id: 'i7', category: 'Suppliers', requirement: 'Technical/Quality Agreements with all CMOs', status: 'PASS', evidence: 'Supplier module records', criticalForInspection: true },
    ],
  },
  {
    id: 'iatf-cb',
    name: 'IATF 16949 Certification Audit',
    body: 'IATF Certification Body',
    standard: 'IATF 16949:2016',
    industry: 'AUTOMOTIVE',
    readinessScore: 94,
    status: 'GREEN',
    lastInspectionDate: '2024-11-08',
    nextExpectedDate: '2026-11-01',
    criticalOpenItems: 0,
    majorOpenItems: 2,
    minorOpenItems: 3,
    checklistItems: [
      { id: 'i1', category: 'APQP/PPAP', requirement: 'PPAP packages complete for all active products', status: 'PASS', evidence: 'PPAP register Mar 2026', criticalForInspection: true },
      { id: 'i2', category: 'APQP/PPAP', requirement: 'PFMEA updated on all engineering changes', status: 'PARTIAL', evidence: '1 PFMEA update pending CR-2026-0005', criticalForInspection: false },
      { id: 'i3', category: 'Customer Specific', requirement: 'CSR register maintained per major OEM', status: 'PASS', evidence: 'CSR-REG-001 v2.1', criticalForInspection: true },
      { id: 'i4', category: 'Warranty', requirement: 'Warranty claims linked to NC and PFMEA update', status: 'PARTIAL', evidence: '2 claims pending NC creation', criticalForInspection: false },
      { id: 'i5', category: 'Contingency', requirement: 'Contingency plans per IATF Clause 6.1.2.3', status: 'PASS', evidence: 'CP-MFG-2025-003', criticalForInspection: false },
      { id: 'i6', category: 'Internal Audits', requirement: 'VDA 6.3 process audits scheduled annually', status: 'PASS', evidence: 'AUD schedule 2026', criticalForInspection: false },
    ],
  },
  {
    id: 'osha-psm-audit',
    name: 'OSHA PSM Compliance Audit',
    body: 'OSHA / Third Party',
    standard: '29 CFR 1910.119',
    industry: 'CHEMICAL',
    readinessScore: 72,
    status: 'RED',
    lastInspectionDate: '2022-11-14',
    nextExpectedDate: '2025-11-14',
    criticalOpenItems: 3,
    majorOpenItems: 7,
    minorOpenItems: 6,
    checklistItems: [
      { id: 'i1', category: 'PHA', requirement: 'PHA revalidated every 5 years', status: 'FAIL', evidence: 'PHA-2018-001 due Nov 2023 — OVERDUE', criticalForInspection: true },
      { id: 'i2', category: 'Training', requirement: 'PSM process training — refresher every 3 years', status: 'PARTIAL', evidence: '18 of 42 operators overdue', criticalForInspection: true },
      { id: 'i3', category: 'MOC', requirement: 'MOC procedure and records for all covered changes', status: 'PASS', evidence: 'SOP-MOC-001 v2.0', criticalForInspection: true },
      { id: 'i4', category: 'MOC', requirement: 'PSSR completed before all MOC startups', status: 'PARTIAL', evidence: '1 PSSR documentation gap in 2025', criticalForInspection: true },
      { id: 'i5', category: 'Incident Investigation', requirement: 'Incident investigation within 48 hours', status: 'PASS', evidence: 'INC-REG-2025', criticalForInspection: false },
      { id: 'i6', category: 'Mechanical Integrity', requirement: 'Inspection/testing schedule for pressure vessels', status: 'FAIL', evidence: '3 vessels overdue for inspection', criticalForInspection: true },
    ],
  },
  {
    id: 'fssc-22000',
    name: 'FSSC 22000 v6 Audit',
    body: 'Certification Body',
    standard: 'FSSC 22000 v6 / ISO 22000:2018',
    industry: 'FOOD',
    readinessScore: 83,
    status: 'AMBER',
    lastInspectionDate: '2025-03-18',
    nextExpectedDate: '2026-03-01',
    criticalOpenItems: 1,
    majorOpenItems: 4,
    minorOpenItems: 7,
    checklistItems: [
      { id: 'i1', category: 'Food Safety Plan', requirement: 'HARPC/HACCP plan current with last revalidation ≤1 year', status: 'PARTIAL', evidence: 'Plan valid; revalidation in progress', criticalForInspection: true },
      { id: 'i2', category: 'Allergen', requirement: 'Allergen management program with cross-contact controls', status: 'PASS', evidence: 'AMP-PRG-001 v3.0', criticalForInspection: true },
      { id: 'i3', category: 'Allergen', requirement: 'Allergen label verification at every changeover', status: 'PASS', evidence: 'WI-PKG-012', criticalForInspection: true },
      { id: 'i4', category: 'Traceability', requirement: 'FSMA Section 204 records — 1-up/1-down within 4 hours', status: 'FAIL', evidence: 'Mock trace Apr 2025 took 6.5 hours', criticalForInspection: true },
      { id: 'i5', category: 'Supplier', requirement: 'FSVP records for all foreign suppliers', status: 'PARTIAL', evidence: '4 of 9 foreign suppliers with full FSVP docs', criticalForInspection: false },
      { id: 'i6', category: 'PCQI', requirement: 'PCQI certificated person on team', status: 'PASS', evidence: 'Meera Pillai FSPCA cert #PCQI-2024-0892', criticalForInspection: true },
      { id: 'i7', category: 'EMP', requirement: 'Environmental Monitoring Program with trend analysis', status: 'PASS', evidence: 'EMP-MON-2026-Q1', criticalForInspection: false },
    ],
  },
];

// ── Regulatory Changes ────────────────────────────────────────────────────────

export interface ChangeActionItem {
  id: string;
  system: SystemType;
  description: string;
  owner: string;
  dueDate: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface RegulatoryChange {
  id: string;
  title: string;
  regulation: string;
  regulatoryBody: string;
  publishedDate: string;
  effectiveDate: string;
  impactLevel: ImpactLevel;
  affectedSystems: SystemType[];
  affectedIndustries: Industry[];
  status: 'MONITORING' | 'ASSESSMENT' | 'ACTION' | 'CLOSED';
  summary: string;
  actionItems: ChangeActionItem[];
}

export const regulatoryChanges: RegulatoryChange[] = [
  {
    id: 'rc1',
    title: 'FDA QMSR — 21 CFR Part 820 Revision (Effective Feb 2026)',
    regulation: '21 CFR Part 820 / ISO 13485:2016',
    regulatoryBody: 'FDA',
    publishedDate: '2024-02-02',
    effectiveDate: '2026-02-02',
    impactLevel: 'HIGH',
    affectedSystems: ['QMS', 'DMS', 'LMS'],
    affectedIndustries: ['PHARMA'],
    status: 'ACTION',
    summary: 'FDA harmonized the Quality System Regulation with ISO 13485:2016, creating the Quality Management System Regulation (QMSR). All medical device manufacturers must transition by Feb 2026.',
    actionItems: [
      { id: 'a1', system: 'QMS', description: 'Gap assessment QMS vs. QMSR requirements', owner: 'Priya Sharma', dueDate: '2026-03-01', status: 'COMPLETED' },
      { id: 'a2', system: 'DMS', description: 'Revise QMS Manual to reference QMSR clauses', owner: 'Rajesh Kumar', dueDate: '2026-04-01', status: 'IN_PROGRESS' },
      { id: 'a3', system: 'LMS', description: 'Training: QMSR transition for QA personnel', owner: 'Anita Desai', dueDate: '2026-04-15', status: 'PENDING' },
    ],
  },
  {
    id: 'rc2',
    title: 'FSMA Section 204 — Food Traceability Rule (Effective Jan 2026)',
    regulation: '21 CFR Part 1 Subpart S',
    regulatoryBody: 'FDA',
    publishedDate: '2022-11-21',
    effectiveDate: '2026-01-20',
    impactLevel: 'HIGH',
    affectedSystems: ['QMS', 'DMS', 'LMS'],
    affectedIndustries: ['FOOD'],
    status: 'ACTION',
    summary: 'FSMA Section 204 Traceability Rule requires food businesses handling FTL foods to maintain key data elements (KDEs) at critical tracking events (CTEs) and produce records to FDA within 24 hours.',
    actionItems: [
      { id: 'a1', system: 'QMS', description: 'Update traceability workflow for FTL products', owner: 'Meera Pillai', dueDate: '2026-01-01', status: 'COMPLETED' },
      { id: 'a2', system: 'DMS', description: 'Create CTE/KDE documentation templates', owner: 'Suresh Iyer', dueDate: '2025-12-15', status: 'COMPLETED' },
      { id: 'a3', system: 'LMS', description: 'FSMA 204 traceability training for warehouse/production', owner: 'Meera Pillai', dueDate: '2026-01-15', status: 'IN_PROGRESS' },
    ],
  },
  {
    id: 'rc3',
    title: 'EU Machinery Regulation 2023/1230 — Transition (Effective Jan 2027)',
    regulation: 'EU Regulation 2023/1230',
    regulatoryBody: 'European Commission',
    publishedDate: '2023-06-29',
    effectiveDate: '2027-01-14',
    impactLevel: 'HIGH',
    affectedSystems: ['QMS', 'DMS'],
    affectedIndustries: ['AUTOMOTIVE'],
    status: 'ASSESSMENT',
    summary: 'EU Machinery Regulation replaces the 2006/42/EC Machinery Directive. Introduces digital instructions, new risk assessment methodology, and expanded scope for software-driven machinery.',
    actionItems: [
      { id: 'a1', system: 'QMS', description: 'Gap analysis: 2006/42/EC vs 2023/1230 requirements', owner: 'Karan Mehta', dueDate: '2025-12-31', status: 'IN_PROGRESS' },
      { id: 'a2', system: 'DMS', description: 'Update CE technical file templates for 2023/1230', owner: 'Divya Nair', dueDate: '2026-06-30', status: 'PENDING' },
    ],
  },
  {
    id: 'rc4',
    title: 'EU GMP Annex 1 Revision — Manufacture of Sterile Products (2022)',
    regulation: 'EU GMP EudraLex Vol. 4 Annex 1',
    regulatoryBody: 'EMA / EU Commission',
    publishedDate: '2022-08-25',
    effectiveDate: '2023-08-25',
    impactLevel: 'HIGH',
    affectedSystems: ['QMS', 'DMS', 'LMS'],
    affectedIndustries: ['PHARMA'],
    status: 'CLOSED',
    summary: 'Comprehensive revision of Annex 1 introducing Contamination Control Strategy (CCS), enhanced environmental monitoring, and updated aseptic process simulation requirements.',
    actionItems: [
      { id: 'a1', system: 'QMS', description: 'Develop Contamination Control Strategy document', owner: 'Priya Sharma', dueDate: '2023-08-01', status: 'COMPLETED' },
      { id: 'a2', system: 'LMS', description: 'Aseptic gowning requalification per revised Annex 1', owner: 'Anita Desai', dueDate: '2023-10-01', status: 'COMPLETED' },
    ],
  },
  {
    id: 'rc5',
    title: 'REACH SVHC Candidate List Update — 247 Substances',
    regulation: 'REACH Regulation EC 1907/2006',
    regulatoryBody: 'ECHA',
    publishedDate: '2024-06-27',
    effectiveDate: '2024-06-27',
    impactLevel: 'MEDIUM',
    affectedSystems: ['QMS', 'DMS'],
    affectedIndustries: ['CHEMICAL', 'AUTOMOTIVE'],
    status: 'ACTION',
    summary: 'ECHA updated the SVHC Candidate List to 247 substances. Manufacturers and importers must notify ECHA within 6 months if articles contain SVHCs >0.1% w/w and inform customers.',
    actionItems: [
      { id: 'a1', system: 'QMS', description: 'Screen product portfolio against updated SVHC list', owner: 'Ravi Shankar', dueDate: '2024-12-27', status: 'IN_PROGRESS' },
      { id: 'a2', system: 'DMS', description: 'Update SDS for affected substances', owner: 'Leela Krishnamurthy', dueDate: '2025-01-15', status: 'PENDING' },
    ],
  },
  {
    id: 'rc6',
    title: 'ICH Q12 — Pharmaceutical Lifecycle Management (Implementation)',
    regulation: 'ICH Q12',
    regulatoryBody: 'ICH',
    publishedDate: '2019-11-20',
    effectiveDate: '2025-01-01',
    impactLevel: 'MEDIUM',
    affectedSystems: ['QMS', 'DMS'],
    affectedIndustries: ['PHARMA'],
    status: 'ACTION',
    summary: 'ICH Q12 provides a framework for managing post-approval chemistry, manufacturing, and controls (CMC) changes with predictable regulatory outcomes via PACMP and EFPIA commitments.',
    actionItems: [
      { id: 'a1', system: 'QMS', description: 'Implement PACMP framework in change control module', owner: 'Priya Sharma', dueDate: '2025-06-30', status: 'IN_PROGRESS' },
      { id: 'a2', system: 'DMS', description: 'Establish established conditions document template', owner: 'Rajesh Kumar', dueDate: '2025-04-30', status: 'PENDING' },
    ],
  },
];

// ── Regulatory Training Requirements ─────────────────────────────────────────

export interface RegTrainingRequirement {
  id: string;
  regulationClause: string;
  requirement: string;
  industry: Industry;
  framework: string;
  affectedRoles: string[];
  frequency: string;
  linkedTraining: string[];
  completionRate: number;
  complianceStatus: ComplianceStatus;
  retentionPeriod: string;
}

export const regTrainingRequirements: RegTrainingRequirement[] = [
  {
    id: 'rt1',
    regulationClause: '21 CFR 211.68 / EU GMP Ch. 2',
    requirement: 'GMP Fundamentals — initial training before assignment, annual refresher',
    industry: 'PHARMA',
    framework: 'FDA cGMP / EU GMP',
    affectedRoles: ['Production Operator', 'QC Analyst', 'QA Associate', 'Warehouse Staff'],
    frequency: 'Annual refresher',
    linkedTraining: ['GMP Fundamentals', 'Good Documentation Practice'],
    completionRate: 92,
    complianceStatus: 'COMPLIANT',
    retentionPeriod: '3 years post departure (EU GMP); life of facility (FDA)',
  },
  {
    id: 'rt2',
    regulationClause: 'FDA Data Integrity Guidance 2018 / PIC/S PI 041-1',
    requirement: 'ALCOA+ data integrity awareness — mandatory annual refresher for all GMP personnel',
    industry: 'PHARMA',
    framework: 'FDA / EU GMP Annex 11',
    affectedRoles: ['All GMP Personnel'],
    frequency: 'Annual',
    linkedTraining: ['Data Integrity & ALCOA+'],
    completionRate: 74,
    complianceStatus: 'PARTIAL',
    retentionPeriod: 'Life of facility',
  },
  {
    id: 'rt3',
    regulationClause: '21 CFR Part 11 / EU GMP Annex 11 §2',
    requirement: 'Computer System GxP training for personnel using validated systems',
    industry: 'PHARMA',
    framework: 'FDA Part 11 / Annex 11',
    affectedRoles: ['QA', 'IT', 'Validation Team', 'System Administrators'],
    frequency: 'On system access / annual refresher',
    linkedTraining: ['CSV / Computer System GxP', '21 CFR Part 11 Overview'],
    completionRate: 88,
    complianceStatus: 'COMPLIANT',
    retentionPeriod: '3 years post departure',
  },
  {
    id: 'rt4',
    regulationClause: 'EU GMP Annex 1 (2022) — Aseptic Technique',
    requirement: 'Aseptic gowning qualification for Grade A/B area personnel',
    industry: 'PHARMA',
    framework: 'EU GMP Annex 1',
    affectedRoles: ['Aseptic Production Operators', 'QC Microbiologists'],
    frequency: 'Initial + annual requalification',
    linkedTraining: ['Aseptic Gowning Qualification', 'Media Fill Participation'],
    completionRate: 96,
    complianceStatus: 'COMPLIANT',
    retentionPeriod: '3 years post departure',
  },
  {
    id: 'rt5',
    regulationClause: '29 CFR 1910.119(g) — OSHA PSM',
    requirement: 'Process-specific hazard training before assignment; refresher every 3 years',
    industry: 'CHEMICAL',
    framework: 'OSHA PSM',
    affectedRoles: ['Process Operators', 'Maintenance Technicians', 'Shift Supervisors'],
    frequency: 'Initial + 3-year refresher',
    linkedTraining: ['PSM Process Safety Training', 'P&ID Interpretation'],
    completionRate: 61,
    complianceStatus: 'NON_COMPLIANT',
    retentionPeriod: 'Minimum 3 years',
  },
  {
    id: 'rt6',
    regulationClause: '29 CFR 1910.1200(h) — OSHA HazCom',
    requirement: 'GHS hazard communication training before initial assignment',
    industry: 'CHEMICAL',
    framework: 'OSHA HazCom 2012',
    affectedRoles: ['All Chemical Handling Personnel'],
    frequency: 'Initial + on new hazard introduction',
    linkedTraining: ['HazCom / GHS Training', 'SDS Reading'],
    completionRate: 89,
    complianceStatus: 'COMPLIANT',
    retentionPeriod: 'Duration of employment',
  },
  {
    id: 'rt7',
    regulationClause: 'FSMA 21 CFR Part 117.4 / PCQI Requirement',
    requirement: 'PCQI must complete FSPCA Preventive Controls for Human Food course',
    industry: 'FOOD',
    framework: 'FSMA',
    affectedRoles: ['PCQI', 'Food Safety Manager', 'Quality Director'],
    frequency: 'One-time certification (refresher recommended every 3 years)',
    linkedTraining: ['FSPCA PCQI Certification'],
    completionRate: 100,
    complianceStatus: 'COMPLIANT',
    retentionPeriod: 'Permanently linked to food safety plan record',
  },
  {
    id: 'rt8',
    regulationClause: 'FSMA 21 CFR Part 117 Subpart B — Food Handler Training',
    requirement: 'All food handlers qualified via training or experience; supervisor FSPCA certified',
    industry: 'FOOD',
    framework: 'FSMA',
    affectedRoles: ['Production Operators', 'Line Supervisors', 'Warehouse Staff'],
    frequency: 'Annual refresher',
    linkedTraining: ['Food Safety Fundamentals', 'Allergen Management', 'HACCP Awareness'],
    completionRate: 84,
    complianceStatus: 'PARTIAL',
    retentionPeriod: '2 years from training date',
  },
  {
    id: 'rt9',
    regulationClause: 'IATF 16949:2016 §7.2 / §7.3',
    requirement: 'Competence training for all persons affecting product/process conformity',
    industry: 'AUTOMOTIVE',
    framework: 'IATF 16949',
    affectedRoles: ['All Manufacturing Personnel', 'Quality Engineers', 'Process Engineers'],
    frequency: 'On role assignment; effectiveness evaluation required',
    linkedTraining: ['IATF 16949 / ISO 9001 QMS Awareness', '8D Problem Solving', 'SPC'],
    completionRate: 95,
    complianceStatus: 'COMPLIANT',
    retentionPeriod: '15 years (safety/liability roles)',
  },
  {
    id: 'rt10',
    regulationClause: 'IATF 16949 §8.3 — APQP/PPAP',
    requirement: 'APQP/PPAP training for product and process engineers with PSW sign-off authority',
    industry: 'AUTOMOTIVE',
    framework: 'IATF 16949 / AIAG',
    affectedRoles: ['Product Engineers', 'Process Engineers', 'Quality Engineers'],
    frequency: 'Initial certification; refresher on standard update',
    linkedTraining: ['APQP/PPAP Certification', 'AIAG-VDA FMEA 7-Step Methodology'],
    completionRate: 91,
    complianceStatus: 'COMPLIANT',
    retentionPeriod: '15 years',
  },
];

// ── Industry compliance summary ───────────────────────────────────────────────

export const industryComplianceSummary = [
  { industry: 'Pharma', overall: 89, qms: 91, dms: 88, lms: 85, regulations: 4, openGaps: 15, critical: 2 },
  { industry: 'Chemical', overall: 82, qms: 84, dms: 79, lms: 72, regulations: 4, openGaps: 24, critical: 5 },
  { industry: 'Food & Bev', overall: 85, qms: 82, dms: 87, lms: 84, regulations: 4, openGaps: 18, critical: 3 },
  { industry: 'Automotive', overall: 88, qms: 94, dms: 82, lms: 91, regulations: 3, openGaps: 13, critical: 2 },
];

export const overallComplianceScore = 86;
