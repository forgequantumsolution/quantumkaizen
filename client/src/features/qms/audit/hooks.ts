import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem, flattenUsers } from '@/lib/apiShape';
import { useUserIndustry, pickByIndustry } from '@/lib/userIndustry';

const flattenAudit = (a: Record<string, unknown>) => flattenUsers(a, ['createdBy']);

export type AuditType = 'INTERNAL' | 'EXTERNAL' | 'SUPPLIER' | 'CERTIFICATION';
export type AuditStatus = 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface AuditFinding {
  id: string;
  type: 'MAJOR' | 'MINOR' | 'OFI';
  clause: string;
  description: string;
  status: 'OPEN' | 'CLOSED';
}

export interface Audit {
  id: string;
  auditNumber: string;
  title: string;
  type: AuditType;
  status: AuditStatus;
  standard: string;
  scope: string;
  department: string;
  leadAuditor: string;
  auditTeam: string[];
  plannedStart: string;
  plannedEnd: string;
  actualStart?: string;
  actualEnd?: string;
  findings: AuditFinding[];
  majorFindings: number;
  minorFindings: number;
  ofiCount: number;
  createdAt: string;
}

const mockAudits: Audit[] = [
  // ── 2026 records ──
  {
    id: 'AUD-001', auditNumber: 'AUD-2026-001', title: 'WHO Pre-qualification Inspection',
    type: 'CERTIFICATION', status: 'PLANNED', standard: 'WHO GMP TRS 986 Annex 2',
    scope: 'Full-site GMP inspection covering Tablet & Injectable manufacturing, QC laboratory, warehouse, and quality systems for WHO PQ dossier submission',
    department: 'Quality Assurance', leadAuditor: 'WHO Assessor (External)', auditTeam: [],
    plannedStart: '2026-06-09', plannedEnd: '2026-06-13',
    findings: [],
    majorFindings: 0, minorFindings: 0, ofiCount: 0, createdAt: '2026-03-01',
  },
  {
    id: 'AUD-002', auditNumber: 'AUD-2026-002', title: 'Internal GMP Audit — Tablet Manufacturing Block',
    type: 'INTERNAL', status: 'IN_PROGRESS', standard: 'Schedule M (Revised) GMP',
    scope: 'Granulation, compression, coating, and primary packaging operations for Paracetamol 500mg and Metformin 500mg product lines',
    department: 'Production', leadAuditor: 'Dr. Priya Sharma', auditTeam: ['Rajesh Kumar', 'Deepak Nair'],
    plannedStart: '2026-04-14', plannedEnd: '2026-04-16',
    actualStart: '2026-04-14',
    findings: [
      { id: 'F1', type: 'MINOR', clause: 'Schedule M Cl. 5.3', description: 'Batch manufacturing record for Paracetamol batch PMT-2026-0041 missing second-person verification on in-process yield step', status: 'OPEN' },
      { id: 'F2', type: 'OFI', clause: 'Schedule M Cl. 14.1', description: 'Environmental monitoring frequency in compression area could be increased from weekly to twice-weekly during validation runs', status: 'OPEN' },
    ],
    majorFindings: 0, minorFindings: 1, ofiCount: 1, createdAt: '2026-04-01',
  },
  {
    id: 'AUD-003', auditNumber: 'AUD-2026-003', title: 'Internal GMP Audit — Injectable Manufacturing Block',
    type: 'INTERNAL', status: 'PLANNED', standard: 'Schedule M (Revised) GMP / EU GMP Annex 1',
    scope: 'Aseptic filling, lyophilisation, and terminal sterilisation operations for Ondansetron 4mg/2ml injection; environmental monitoring and media fill review',
    department: 'Production', leadAuditor: 'Dr. Priya Sharma', auditTeam: ['Rajesh Kumar', 'Vikram Patel'],
    plannedStart: '2026-05-12', plannedEnd: '2026-05-14',
    findings: [],
    majorFindings: 0, minorFindings: 0, ofiCount: 0, createdAt: '2026-04-01',
  },
  {
    id: 'AUD-004', auditNumber: 'AUD-2026-004', title: 'Internal Audit — Regulatory Affairs & Dossier Management',
    type: 'INTERNAL', status: 'PLANNED', standard: 'ICH Q10 / Schedule M (Revised)',
    scope: 'Review of CTD dossier change control, post-approval change management, and artwork revision process for all five marketed products',
    department: 'Regulatory Affairs', leadAuditor: 'Dr. Priya Sharma', auditTeam: ['Anita Desai'],
    plannedStart: '2026-07-07', plannedEnd: '2026-07-08',
    findings: [],
    majorFindings: 0, minorFindings: 0, ofiCount: 0, createdAt: '2026-04-10',
  },
  // ── 2025 records ──
  {
    id: 'AUD-005', auditNumber: 'AUD-2025-001', title: 'CDSCO GMP Inspection — Manufacturing Site',
    type: 'EXTERNAL', status: 'COMPLETED', standard: 'Drugs & Cosmetics Act 1940 / Schedule M',
    scope: 'Full-site GMP inspection by CDSCO inspectors covering manufacturing, QC, QA, and warehouse; triggered by licence renewal for Ondansetron injection',
    department: 'Quality Assurance', leadAuditor: 'CDSCO Inspector (External)', auditTeam: ['Dr. Priya Sharma', 'Anita Desai'],
    plannedStart: '2025-11-03', plannedEnd: '2025-11-05',
    actualStart: '2025-11-03', actualEnd: '2025-11-05',
    findings: [
      { id: 'F3', type: 'MAJOR', clause: 'Schedule M Cl. 11.2', description: 'Batch manufacturing records for three injectable batches (ONS-2025-012 to 014) lacked complete in-process test entries; gaps identified in sterilisation cycle print-outs', status: 'CLOSED' },
      { id: 'F4', type: 'MINOR', clause: 'Schedule M Cl. 6.4', description: 'SOP for handling of rejected materials (SOP-WH-007) not reviewed within the stipulated 2-year review cycle; last review date September 2022', status: 'CLOSED' },
      { id: 'F5', type: 'OFI', clause: 'Schedule M Cl. 14.4', description: 'Environmental monitoring trend data not formally presented at quarterly management review meetings', status: 'CLOSED' },
    ],
    majorFindings: 1, minorFindings: 1, ofiCount: 1, createdAt: '2025-10-10',
  },
  {
    id: 'AUD-006', auditNumber: 'AUD-2025-002', title: 'Supplier Audit — Divi\'s Laboratories Ltd (API Supplier)',
    type: 'SUPPLIER', status: 'COMPLETED', standard: 'ICH Q7 / WHO GMP',
    scope: 'Audit of Divi\'s API manufacturing site for Paracetamol and Metformin active pharmaceutical ingredients; covering synthesis, in-process controls, analytical testing, and CoA verification',
    department: 'Quality Assurance', leadAuditor: 'Rajesh Kumar', auditTeam: ['Dr. Priya Sharma'],
    plannedStart: '2025-09-10', plannedEnd: '2025-09-11',
    actualStart: '2025-09-10', actualEnd: '2025-09-11',
    findings: [
      { id: 'F6', type: 'MINOR', clause: 'ICH Q7 Cl. 6.6', description: 'Out-of-specification investigation for Paracetamol lot DL-PCT-2025-088 did not include a root cause analysis within the 30-day timeframe specified in their SOP', status: 'CLOSED' },
      { id: 'F7', type: 'OFI', clause: 'ICH Q7 Cl. 11.1', description: 'Deviation trending not linked to CAPA system; manual spreadsheet tracking creates risk of data gap', status: 'CLOSED' },
    ],
    majorFindings: 0, minorFindings: 1, ofiCount: 1, createdAt: '2025-08-20',
  },
  {
    id: 'AUD-007', auditNumber: 'AUD-2025-003', title: 'Internal Audit — QC Laboratory (Data Integrity Focus)',
    type: 'INTERNAL', status: 'COMPLETED', standard: 'ALCOA+ / MHRA Data Integrity Guidance 2018',
    scope: 'Data integrity review of HPLC systems, dissolution apparatus, and analytical balances; audit trail completeness, user access controls, and raw data retention in QC laboratory',
    department: 'Quality Control', leadAuditor: 'Dr. Priya Sharma', auditTeam: ['Anita Desai'],
    plannedStart: '2025-06-02', plannedEnd: '2025-06-03',
    actualStart: '2025-06-02', actualEnd: '2025-06-03',
    findings: [
      { id: 'F8', type: 'MAJOR', clause: 'ALCOA+ — Attributable', description: 'Two shared analyst login credentials found on HPLC workstations QC-HPLC-02 and QC-HPLC-04; individual accountability cannot be established for 14 injections runs in May 2025', status: 'CLOSED' },
      { id: 'F9', type: 'MINOR', clause: 'ALCOA+ — Contemporaneous', description: 'Analyst bench notebooks contained retrospective entries for dissolution runs on three dates without a documented justification for the delay', status: 'CLOSED' },
      { id: 'F10', type: 'MINOR', clause: 'ALCOA+ — Legible', description: 'Three pages in stability sample logbook QC-STB-2025-02 had overwritten entries without single-line strike-through and auditor initials', status: 'CLOSED' },
    ],
    majorFindings: 1, minorFindings: 2, ofiCount: 0, createdAt: '2025-05-12',
  },
  {
    id: 'AUD-008', auditNumber: 'AUD-2025-004', title: 'Internal Audit — EHS & Solvent Handling',
    type: 'INTERNAL', status: 'COMPLETED', standard: 'ISO 14001:2015 / Factories Act 1948',
    scope: 'Hazardous solvent storage, isopropyl alcohol dispensing, effluent treatment plant operation, and PPE compliance in Production and QC areas',
    department: 'Engineering', leadAuditor: 'Sunita Rao', auditTeam: ['Deepak Nair'],
    plannedStart: '2025-03-17', plannedEnd: '2025-03-18',
    actualStart: '2025-03-17', actualEnd: '2025-03-18',
    findings: [
      { id: 'F11', type: 'MINOR', clause: 'Factories Act — Rule 68J', description: 'Secondary containment bund in solvent storage room found cracked and not watertight; repair pending since January 2025', status: 'CLOSED' },
      { id: 'F12', type: 'OFI', clause: 'ISO 14001 Cl. 9.1.1', description: 'ETP effluent monitoring conducted monthly; increasing to fortnightly would better detect excursions and align with upcoming statutory amendments', status: 'CLOSED' },
    ],
    majorFindings: 0, minorFindings: 1, ofiCount: 1, createdAt: '2025-03-01',
  },
  // ── 2024 records ──
  {
    id: 'AUD-009', auditNumber: 'AUD-2024-001', title: 'EU GMP Inspection — EDQM (Certificate of Suitability)',
    type: 'EXTERNAL', status: 'COMPLETED', standard: 'EU GMP Parts I & II / Ph. Eur.',
    scope: 'GMP inspection by EDQM assessors in support of CEP application for Paracetamol API sourcing from Divi\'s; covers analytical methods, QC laboratory, and raw material management',
    department: 'Quality Assurance', leadAuditor: 'EDQM Assessor (External)', auditTeam: ['Dr. Priya Sharma', 'Rajesh Kumar', 'Anita Desai'],
    plannedStart: '2024-10-07', plannedEnd: '2024-10-09',
    actualStart: '2024-10-07', actualEnd: '2024-10-09',
    findings: [
      { id: 'F13', type: 'MINOR', clause: 'EU GMP Ch. 6.6', description: 'Reference standard re-qualification programme for Ph. Eur. working standards not formally documented in the QC SOP; procedure relied on individual analyst knowledge', status: 'CLOSED' },
      { id: 'F14', type: 'OFI', clause: 'EU GMP Ch. 4.29', description: 'Electronic document management system could benefit from automated expiry alerts to reduce reliance on manual SOP review calendar', status: 'CLOSED' },
    ],
    majorFindings: 0, minorFindings: 1, ofiCount: 1, createdAt: '2024-09-01',
  },
  {
    id: 'AUD-010', auditNumber: 'AUD-2024-002', title: 'Internal Audit — Warehouse & Cold Chain Management',
    type: 'INTERNAL', status: 'COMPLETED', standard: 'Schedule M (Revised) / GDP Guidelines',
    scope: 'Ambient and cold-room storage conditions, Ondansetron injection cold chain compliance, quarantine area management, and inventory reconciliation',
    department: 'Warehouse', leadAuditor: 'Rajesh Kumar', auditTeam: ['Deepak Nair'],
    plannedStart: '2024-08-05', plannedEnd: '2024-08-06',
    actualStart: '2024-08-05', actualEnd: '2024-08-06',
    findings: [
      { id: 'F15', type: 'MAJOR', clause: 'Schedule M Cl. 17.4', description: 'Cold room temperature excursion on 2024-07-19 (recorded max 12.8°C vs. 2–8°C specification) not reported as a deviation; Ondansetron stock WH-LOT-2024-031 not quarantined pending investigation', status: 'CLOSED' },
      { id: 'F16', type: 'MINOR', clause: 'Schedule M Cl. 17.1', description: 'Approved vendor list (AVL) in warehouse not updated to reflect removal of two delisted packaging suppliers; superseded version in use at receiving bay', status: 'CLOSED' },
    ],
    majorFindings: 1, minorFindings: 1, ofiCount: 0, createdAt: '2024-07-15',
  },
  {
    id: 'AUD-011', auditNumber: 'AUD-2024-003', title: 'ISO 9001:2015 Surveillance Audit — Year 2',
    type: 'EXTERNAL', status: 'COMPLETED', standard: 'ISO 9001:2015',
    scope: 'Surveillance audit by Bureau Veritas covering management review, internal audit programme, CAPA system effectiveness, and customer complaint handling',
    department: 'Quality Assurance', leadAuditor: 'Bureau Veritas Auditor (External)', auditTeam: ['Dr. Priya Sharma'],
    plannedStart: '2024-05-13', plannedEnd: '2024-05-14',
    actualStart: '2024-05-13', actualEnd: '2024-05-14',
    findings: [
      { id: 'F17', type: 'MINOR', clause: 'ISO 9001 Cl. 10.2.1', description: 'Three CAPAs (CAPA-2024-005, 007, 009) exceeded their planned completion dates without a documented extension justification or re-risk assessment', status: 'CLOSED' },
      { id: 'F18', type: 'OFI', clause: 'ISO 9001 Cl. 9.3', description: 'Management review agenda does not formally include product quality review (PQR) summary data as a standing input; currently reviewed separately outside the MRM', status: 'CLOSED' },
    ],
    majorFindings: 0, minorFindings: 1, ofiCount: 1, createdAt: '2024-04-20',
  },
  {
    id: 'AUD-012', auditNumber: 'AUD-2024-004', title: 'Supplier Audit — Uflex Ltd (Packaging Supplier)',
    type: 'SUPPLIER', status: 'COMPLETED', standard: 'ISO 9001:2015 / Schedule M Packaging Requirements',
    scope: 'Audit of Uflex blister foil and PVDC laminate production line supplying primary packaging for Paracetamol 500mg and Amoxicillin 250mg; covers incoming materials, print quality, and CoC traceability',
    department: 'Quality Assurance', leadAuditor: 'Rajesh Kumar', auditTeam: [],
    plannedStart: '2024-02-19', plannedEnd: '2024-02-19',
    actualStart: '2024-02-19', actualEnd: '2024-02-19',
    findings: [
      { id: 'F19', type: 'MINOR', clause: 'ISO 9001 Cl. 8.5.2', description: 'Identification and traceability records for blister foil lots UF-BF-2024-003 and UF-BF-2024-004 did not include the lacquer coating batch reference, preventing full CoC reconstruction', status: 'CLOSED' },
      { id: 'F20', type: 'OFI', clause: 'ISO 9001 Cl. 8.4.1', description: 'Supplier performance scorecard not formally shared with Uflex on a quarterly basis; improving communication frequency would support proactive defect prevention', status: 'CLOSED' },
    ],
    majorFindings: 0, minorFindings: 1, ofiCount: 1, createdAt: '2024-02-01',
  },
];

// Medical-device audits — ISO 13485, 21 CFR Part 820, MDSAP and EU MDR themed.
const mockMedicalDeviceAudits: Audit[] = [
  {
    id: 'AUD-MD-001', auditNumber: 'AUD-MD-2026-001', title: 'MDSAP Recertification Audit',
    type: 'CERTIFICATION', status: 'PLANNED', standard: 'MDSAP / ISO 13485:2016',
    scope: 'Full QMS recertification covering design controls, sterilization, production, post-market surveillance and regulatory reporting across infusion-set, IOL and orthopaedic-screw product families',
    department: 'Quality Assurance', leadAuditor: 'BSI Lead Assessor (External)', auditTeam: [],
    plannedStart: '2026-06-15', plannedEnd: '2026-06-19',
    findings: [],
    majorFindings: 0, minorFindings: 0, ofiCount: 0, createdAt: '2026-03-01',
  },
  {
    id: 'AUD-MD-002', auditNumber: 'AUD-MD-2026-002', title: 'Internal Audit — Design Controls & Risk Management',
    type: 'INTERNAL', status: 'IN_PROGRESS', standard: 'ISO 13485 §7.3 / ISO 14971',
    scope: 'Design history files, design reviews and ISO 14971 risk-management files for infusion pump v3.x and orthopaedic screw OBS family',
    department: 'Design Controls', leadAuditor: 'Dr. Anjali Verma', auditTeam: ['Aditya Menon', 'Sneha Kapoor'],
    plannedStart: '2026-04-15', plannedEnd: '2026-04-17',
    actualStart: '2026-04-15',
    findings: [
      { id: 'MD-F1', type: 'MINOR', clause: 'ISO 13485 §7.3.7', description: 'Design verification protocol DV-PROT-MD-019 missing pre-defined acceptance criteria for one bench test', status: 'OPEN' },
      { id: 'MD-F2', type: 'OFI',   clause: 'ISO 14971 §5.5',  description: 'Hazard analysis worksheet for infusion pump could traceably link each hazard to a specific risk control in the DHF', status: 'OPEN' },
    ],
    majorFindings: 0, minorFindings: 1, ofiCount: 1, createdAt: '2026-04-01',
  },
  {
    id: 'AUD-MD-003', auditNumber: 'AUD-MD-2026-003', title: 'Internal Audit — Sterilization & Cleanroom Operations',
    type: 'INTERNAL', status: 'PLANNED', standard: 'ISO 11135 / ISO 14644 / ISO 13485 §7.5',
    scope: 'EO sterilization cycles, cleanroom classification monitoring, gowning practices and aseptic-packaging integrity testing for surgical-drape and heart-valve lines',
    department: 'Sterilization', leadAuditor: 'Dr. Anjali Verma', auditTeam: ['Karthik Iyer', 'Rohit Khanna'],
    plannedStart: '2026-05-13', plannedEnd: '2026-05-15',
    findings: [],
    majorFindings: 0, minorFindings: 0, ofiCount: 0, createdAt: '2026-04-01',
  },
  {
    id: 'AUD-MD-004', auditNumber: 'AUD-MD-2025-007', title: 'EU MDR Notified Body Surveillance Audit',
    type: 'EXTERNAL', status: 'COMPLETED', standard: 'EU MDR 2017/745 / ISO 13485:2016',
    scope: 'Surveillance audit covering technical documentation, PMS plan, vigilance reporting and PSUR for Class IIb infusion sets and Class III heart valves',
    department: 'Regulatory Affairs', leadAuditor: 'TÜV SÜD Lead Auditor (External)', auditTeam: [],
    plannedStart: '2025-11-04', plannedEnd: '2025-11-06',
    actualStart: '2025-11-04', actualEnd: '2025-11-06',
    findings: [
      { id: 'MD-F3', type: 'MAJOR', clause: 'MDR Annex XIV Part B', description: 'PMS plan did not include quantitative criteria for trending Field Safety Notices across product families',                                                                                            status: 'CLOSED' },
      { id: 'MD-F4', type: 'MINOR', clause: 'ISO 13485 §8.2.1',     description: 'Customer-complaint trend report Q3 2025 not signed by the Person Responsible for Regulatory Compliance (PRRC)',                                                                                            status: 'CLOSED' },
      { id: 'MD-F5', type: 'OFI',   clause: 'MDR Article 83',       description: 'Strengthen integration of vigilance trending into the management review input package; current process relies on manual collation',                                                                       status: 'CLOSED' },
    ],
    majorFindings: 1, minorFindings: 1, ofiCount: 1, createdAt: '2025-09-10',
  },
  {
    id: 'AUD-MD-005', auditNumber: 'AUD-MD-2025-005', title: 'Supplier Audit — Resin Vendor for Orthopaedic Coating',
    type: 'SUPPLIER', status: 'COMPLETED', standard: 'ISO 13485 §7.4 / 21 CFR 820.50',
    scope: 'Process controls, biocompatibility data, change-notification practices and CoA accuracy at PLA-coating resin supplier (Pune)',
    department: 'Procurement', leadAuditor: 'Neha Bansal', auditTeam: ['Sneha Kapoor'],
    plannedStart: '2025-09-18', plannedEnd: '2025-09-19',
    actualStart: '2025-09-18', actualEnd: '2025-09-19',
    findings: [
      { id: 'MD-F6', type: 'MAJOR', clause: '21 CFR 820.50(b)',  description: 'Supplier shipped resin from a new manufacturing site without prior change notification to the customer',                                                                       status: 'CLOSED' },
      { id: 'MD-F7', type: 'MINOR', clause: 'ISO 13485 §7.4.3',  description: 'Incoming-inspection sampling plan not aligned with the agreed AQL in the quality agreement',                                                                                    status: 'CLOSED' },
    ],
    majorFindings: 1, minorFindings: 1, ofiCount: 0, createdAt: '2025-09-01',
  },
];

// Dairy tenant — FSSAI / ISO 22000 / HACCP themed audits.
const mockDairyAudits: Audit[] = [
  {
    id: 'AUD-DY-001', auditNumber: 'AUD-DY-2026-001', title: 'FSSAI Annual Inspection — Central Licence Renewal',
    type: 'CERTIFICATION', status: 'PLANNED', standard: 'FSSAI Schedule 4 / Food Safety and Standards Act',
    scope: 'Full-site FSSAI inspection covering raw-milk reception, pasteurization, packaging, cold-chain, microbiology lab, sweets and ghee sections; pre-requisite for FSSAI Central licence renewal',
    department: 'Quality Assurance', leadAuditor: 'FSSAI Designated Officer', auditTeam: [],
    plannedStart: '2026-07-15', plannedEnd: '2026-07-17',
    findings: [],
    majorFindings: 0, minorFindings: 0, ofiCount: 0, createdAt: '2026-04-15',
  },
  {
    id: 'AUD-DY-002', auditNumber: 'AUD-DY-2026-002', title: 'Internal Audit — Pasteurization & Cold Chain Integrity',
    type: 'INTERNAL', status: 'IN_PROGRESS', standard: 'FSSAI Schedule 4 / ISO 22000:2018',
    scope: 'Pasteurizer PHE-01 and PHE-02 operating parameters, phosphatase testing, post-pasteurization recontamination control, refrigerated tanker fleet and depot cold-chain temperature compliance',
    department: 'Pasteurization', leadAuditor: 'Sandeep Joshi', auditTeam: ['Ravi Deshmukh', 'Anita Kulkarni'],
    plannedStart: '2026-05-02', plannedEnd: '2026-05-05',
    actualStart: '2026-05-02',
    findings: [
      { id: 'DY-F1', type: 'MINOR', clause: 'FSSAI 2.1.1', description: 'Pasteurizer outlet thermometer drift not captured in shift-handover log on 2026-04-18',           status: 'OPEN' },
      { id: 'DY-F2', type: 'OFI',   clause: 'ISO 22000 §8.5.1', description: 'Cold-chain depot temperature audit data could be aggregated daily into a single dashboard for proactive trending', status: 'OPEN' },
    ],
    majorFindings: 0, minorFindings: 1, ofiCount: 1, createdAt: '2026-04-20',
  },
  {
    id: 'AUD-DY-003', auditNumber: 'AUD-DY-2026-003', title: 'Internal Audit — Curd, Paneer & Ghee Production Lines',
    type: 'INTERNAL', status: 'PLANNED', standard: 'FSSAI 2.1.1 / BIS IS 3508 / ISO 22000',
    scope: 'Curd fermentation tanks (FT-01 to FT-04), paneer chhana presses, ghee clarification kettles, CIP cycles between batches, ATP-swab verification, FFA monitoring on finished ghee',
    department: 'Production', leadAuditor: 'Sandeep Joshi', auditTeam: ['Anita Kulkarni', 'Ravi Deshmukh'],
    plannedStart: '2026-06-10', plannedEnd: '2026-06-12',
    findings: [],
    majorFindings: 0, minorFindings: 0, ofiCount: 0, createdAt: '2026-05-05',
  },
  {
    id: 'AUD-DY-004', auditNumber: 'AUD-DY-2025-FSSAI', title: 'FSSAI Surveillance Inspection (Q4 2025)',
    type: 'EXTERNAL', status: 'COMPLETED', standard: 'FSSAI Schedule 4 / Food Safety and Standards Act',
    scope: 'Routine surveillance: raw-milk testing log, antibiotic residue compliance, label declarations on all SKUs, microbiology records, recall and traceability records',
    department: 'Quality Assurance', leadAuditor: 'FSSAI Designated Officer', auditTeam: [],
    plannedStart: '2025-11-04', plannedEnd: '2025-11-05',
    actualStart: '2025-11-04', actualEnd: '2025-11-05',
    findings: [
      { id: 'DY-F3', type: 'MAJOR', clause: 'FSSAI 2.3.4', description: 'Antibiotic residue dipstick frequency at village collection centres was not documented for 12 of 18 centres for Q3 2025', status: 'CLOSED' },
      { id: 'DY-F4', type: 'MINOR', clause: 'FSSAI Sch 4 §2.4', description: 'Visitor-entry log at receiving dock missing PPE compliance column on 2 of 30 sampled days', status: 'CLOSED' },
      { id: 'DY-F5', type: 'OFI',   clause: 'FSSAI 2.1.1', description: 'Pasteurized milk shelf-life claim could be backed with stronger accelerated-aging data; current data 30 days, claim 5 days', status: 'CLOSED' },
    ],
    majorFindings: 1, minorFindings: 1, ofiCount: 1, createdAt: '2025-09-10',
  },
  {
    id: 'AUD-DY-005', auditNumber: 'AUD-DY-2025-FARM', title: 'Supplier Farm Audit — Cluster of 12 Village Collection Centres',
    type: 'SUPPLIER', status: 'COMPLETED', standard: 'FSSAI 2.3.4 / Internal Quality Agreement',
    scope: 'Cattle health, feed quality, milking-hygiene practices, water source, antibiotic-withdrawal compliance and tanker hygiene at 12 village collection centres in the Pune cluster',
    department: 'Procurement', leadAuditor: 'Meera Pillai', auditTeam: ['Sandeep Joshi'],
    plannedStart: '2025-09-15', plannedEnd: '2025-09-19',
    actualStart: '2025-09-15', actualEnd: '2025-09-19',
    findings: [
      { id: 'DY-F6', type: 'MAJOR', clause: 'FSSAI 2.3.4', description: 'Antibiotic withdrawal log not maintained at 4 of 12 centres', status: 'CLOSED' },
      { id: 'DY-F7', type: 'MINOR', clause: 'Quality Agreement §4.2', description: 'Tanker pre-cleaning record missing on 3 days at 2 centres',     status: 'CLOSED' },
    ],
    majorFindings: 1, minorFindings: 1, ofiCount: 0, createdAt: '2025-09-01',
  },
];

// Biologics tenant — Mubadala Bio "DiabTec" (Abu Dhabi, UAE): biologics drug-substance +
// aseptic cartridge fill-finish (insulin, analogues, GLP-1). EU GMP Annex 1, ICH Q7,
// FDA PAI readiness, 21 CFR Part 11 and GDP/cold-chain themed audits.
const mockBiologicsAudits: Audit[] = [
  {
    id: 'AUD-BIO-001', auditNumber: 'AUD-BIO-2026-001', title: 'FDA Pre-Approval Inspection (PAI) Readiness Audit',
    type: 'CERTIFICATION', status: 'PLANNED', standard: 'FDA 21 CFR 211 / 21 CFR 600 / ICH Q7',
    scope: 'PAI readiness assessment across aseptic cartridge fill-finish, drug-substance fermentation, downstream purification and QC microbiology in support of the insulin analogue BLA submission',
    department: 'Regulatory Affairs', leadAuditor: 'FDA Investigator (External)', auditTeam: [],
    plannedStart: '2026-06-22', plannedEnd: '2026-06-26',
    findings: [],
    majorFindings: 0, minorFindings: 0, ofiCount: 0, createdAt: '2026-03-05',
  },
  {
    id: 'AUD-BIO-002', auditNumber: 'AUD-BIO-2026-002', title: 'Internal Audit — Aseptic Process & EU GMP Annex 1',
    type: 'INTERNAL', status: 'IN_PROGRESS', standard: 'EU GMP Annex 1 (2022) / ISO 14644',
    scope: 'Contamination Control Strategy, Grade A/B cleanroom monitoring, gowning qualification, aseptic process simulation (media fills) and single-use system integrity on the GLP-1 cartridge fill line',
    department: 'Aseptic Fill-Finish', leadAuditor: 'Dr. Layla Al-Mansoori', auditTeam: ['Omar Al-Farsi', 'Fatima Al-Hashimi'],
    plannedStart: '2026-04-20', plannedEnd: '2026-04-23',
    actualStart: '2026-04-20',
    findings: [
      { id: 'BIO-F1', type: 'MINOR', clause: 'Annex 1 §4.29', description: 'Continuous viable air monitoring data for Grade A filling zone showed one alert-level excursion on 2026-04-12 without a documented contemporaneous investigation entry', status: 'OPEN' },
      { id: 'BIO-F2', type: 'OFI',   clause: 'Annex 1 §2.3',  description: 'Contamination Control Strategy document could more explicitly cross-reference single-use system supplier change-control records', status: 'OPEN' },
    ],
    majorFindings: 0, minorFindings: 1, ofiCount: 1, createdAt: '2026-04-02',
  },
  {
    id: 'AUD-BIO-003', auditNumber: 'AUD-BIO-2026-003', title: 'Internal Audit — Data Integrity (21 CFR Part 11)',
    type: 'INTERNAL', status: 'PLANNED', standard: '21 CFR Part 11 / EU GMP Annex 11 / ALCOA+',
    scope: 'Audit-trail review, user access controls and electronic-record retention across the chromatography data system, bioreactor SCADA and environmental monitoring software in the Microbiology/QC laboratory',
    department: 'Microbiology/QC Lab', leadAuditor: 'Dr. Sami Haddad', auditTeam: ['Hassan Al-Balushi', 'Fatima Al-Hashimi'],
    plannedStart: '2026-05-18', plannedEnd: '2026-05-20',
    findings: [],
    majorFindings: 0, minorFindings: 0, ofiCount: 0, createdAt: '2026-04-05',
  },
  {
    id: 'AUD-BIO-004', auditNumber: 'AUD-BIO-2025-009', title: 'Sterility Assurance & Environmental Monitoring Program Audit',
    type: 'INTERNAL', status: 'COMPLETED', standard: 'EU GMP Annex 1 (2022) / USP <1116> / Ph. Eur. 5.1.4',
    scope: 'End-to-end sterility assurance review: media-fill acceptance criteria, environmental monitoring trending, isolator decontamination cycle and microbial identification practices across drug-substance and fill-finish areas',
    department: 'Validation', leadAuditor: 'Omar Al-Farsi', auditTeam: ['Dr. Layla Al-Mansoori'],
    plannedStart: '2025-11-10', plannedEnd: '2025-11-13',
    actualStart: '2025-11-10', actualEnd: '2025-11-13',
    findings: [
      { id: 'BIO-F3', type: 'MAJOR', clause: 'Annex 1 §9.28', description: 'Environmental monitoring trend report for Q3 2025 did not include adverse-trend criteria for Grade B viable counts; an upward shift over three weeks was not escalated as required', status: 'CLOSED' },
      { id: 'BIO-F4', type: 'MINOR', clause: 'Annex 1 §8.20', description: 'Isolator glove-integrity test records for two fill sessions lacked the verifier signature', status: 'CLOSED' },
      { id: 'BIO-F5', type: 'OFI',   clause: 'USP <1116>',     description: 'Microbial identification to species level could be extended to all Grade A/B recoveries rather than the current excursion-only practice', status: 'CLOSED' },
    ],
    majorFindings: 1, minorFindings: 1, ofiCount: 1, createdAt: '2025-09-20',
  },
  {
    id: 'AUD-BIO-005', auditNumber: 'AUD-BIO-2025-006', title: 'ICH Q7 API Audit — Drug Substance Fermentation & Purification',
    type: 'INTERNAL', status: 'COMPLETED', standard: 'ICH Q7 / EU GMP Part II',
    scope: 'Upstream fermentation seed-train control, downstream chromatography column lifetime, viral-clearance validation and in-process control limits for recombinant insulin drug substance',
    department: 'Drug Substance (Fermentation)', leadAuditor: 'Hassan Al-Balushi', auditTeam: ['Dr. Sami Haddad'],
    plannedStart: '2025-09-22', plannedEnd: '2025-09-24',
    actualStart: '2025-09-22', actualEnd: '2025-09-24',
    findings: [
      { id: 'BIO-F6', type: 'MINOR', clause: 'ICH Q7 §8.3', description: 'Chromatography resin lifetime study did not document the rationale for the maximum-cycle limit applied to the Capture column', status: 'CLOSED' },
      { id: 'BIO-F7', type: 'OFI',   clause: 'ICH Q7 §6.5', description: 'Deviation trending for fermentation batch yield could be linked directly to the CAPA system rather than tracked on a separate spreadsheet', status: 'CLOSED' },
    ],
    majorFindings: 0, minorFindings: 1, ofiCount: 1, createdAt: '2025-09-01',
  },
  {
    id: 'AUD-BIO-006', auditNumber: 'AUD-BIO-2025-004', title: 'Supplier Audit — Single-Use Systems Vendor',
    type: 'SUPPLIER', status: 'COMPLETED', standard: 'ISO 13485 / USP <87>/<88> / EU GMP Annex 1',
    scope: 'Audit of single-use assembly supplier covering gamma-irradiation sterilisation validation, extractables/leachables data, integrity testing and change-notification practices for biologics fill-finish single-use systems',
    department: 'QA', leadAuditor: 'Fatima Al-Hashimi', auditTeam: ['Omar Al-Farsi'],
    plannedStart: '2025-07-14', plannedEnd: '2025-07-16',
    actualStart: '2025-07-14', actualEnd: '2025-07-16',
    findings: [
      { id: 'BIO-F8', type: 'MAJOR', clause: 'EU GMP Annex 1 §8.123', description: 'Supplier changed the gamma-irradiation contractor without prior change notification, affecting sterilisation dose mapping for the cartridge filling assembly', status: 'CLOSED' },
      { id: 'BIO-F9', type: 'MINOR', clause: 'ISO 13485 §7.4.3',     description: 'Extractables study report for the tubing set was not re-issued after a resin formulation change communicated in 2025', status: 'CLOSED' },
    ],
    majorFindings: 1, minorFindings: 1, ofiCount: 0, createdAt: '2025-06-25',
  },
  {
    id: 'AUD-BIO-007', auditNumber: 'AUD-BIO-2025-002', title: 'Cold-Chain & GDP Distribution Audit',
    type: 'INTERNAL', status: 'COMPLETED', standard: 'EU GDP 2013/C 343/01 / WHO TRS 961 Annex 9',
    scope: 'Temperature-controlled storage qualification (2–8°C), shipper validation, last-mile excursion handling and temperature-mapping of the cold-chain warehouse for insulin and GLP-1 cartridge distribution',
    department: 'Cold-Chain Warehouse', leadAuditor: 'Dr. Layla Al-Mansoori', auditTeam: ['Hassan Al-Balushi'],
    plannedStart: '2025-03-10', plannedEnd: '2025-03-12',
    actualStart: '2025-03-10', actualEnd: '2025-03-12',
    findings: [
      { id: 'BIO-F10', type: 'MINOR', clause: 'EU GDP §3.2.1', description: 'Temperature-mapping of cold room CR-02 was performed empty only; a loaded-condition mapping had not been completed within the qualification programme', status: 'CLOSED' },
      { id: 'BIO-F11', type: 'OFI',   clause: 'EU GDP §9.2',   description: 'Validated shipper qualification could include a summer worst-case ambient profile reflecting Abu Dhabi peak-season transport conditions', status: 'CLOSED' },
    ],
    majorFindings: 0, minorFindings: 1, ofiCount: 1, createdAt: '2025-02-20',
  },
];

export function useAudits(filters?: { status?: string; type?: string }) {
  const industry = useUserIndustry();
  return useQuery({
    queryKey: ['audits', filters, industry ?? 'default'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/audits', { params: filters });
        const unwrapped = unwrapList<Audit>(data, flattenAudit as any);
        return unwrapped.data;
      } catch {
        const baseList = pickByIndustry(industry, mockAudits, { medical_device: mockMedicalDeviceAudits, dairy: mockDairyAudits, biologics: mockBiologicsAudits });
        let result = [...baseList];
        if (filters?.status) result = result.filter(a => a.status === filters.status);
        if (filters?.type) result = result.filter(a => a.type === filters.type);
        return result;
      }
    },
  });
}

export function useAudit(id: string) {
  const industry = useUserIndustry();
  return useQuery({
    queryKey: ['audits', id, industry ?? 'default'],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/audits/${id}`);
        const item = unwrapItem<Audit>(data, flattenAudit as any);
        if (!item?.id) throw new Error('unexpected response');
        return item;
      } catch {
        const baseList = pickByIndustry(industry, mockAudits, { medical_device: mockMedicalDeviceAudits, dairy: mockDairyAudits, biologics: mockBiologicsAudits });
        return baseList.find(a => a.id === id) ?? baseList[0];
      }
    },
    enabled: !!id,
  });
}

export function useCreateAudit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Audit>) => {
      const { data } = await api.post('/qms/audits', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['audits'] }),
  });
}

export function useUpdateAuditStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: AuditStatus }) => {
      try {
        const { data } = await api.patch(`/qms/audits/${id}/status`, { status });
        return data;
      } catch {
        return { id, status };
      }
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['audits', id] });
      qc.invalidateQueries({ queryKey: ['audits'] });
    },
  });
}

export function useAuditStats() {
  // Backend doesn't expose a /qms/audits/stats endpoint; compute from the list.
  const industry = useUserIndustry();
  return useQuery({
    queryKey: ['audits', 'stats', industry ?? 'default'],
    queryFn: async () => {
      let audits: Audit[] = pickByIndustry(industry, mockAudits, { medical_device: mockMedicalDeviceAudits, dairy: mockDairyAudits, biologics: mockBiologicsAudits });
      try {
        const { data } = await api.get('/qms/audits');
        const unwrapped = unwrapList<Audit>(data, flattenAudit as any).data;
        if (unwrapped.length > 0) audits = unwrapped;
      } catch {
        /* fall through to mockAudits */
      }
      return {
        total: audits.length,
        planned: audits.filter(a => a.status === 'PLANNED').length,
        inProgress: audits.filter(a => a.status === 'IN_PROGRESS').length,
        completed: audits.filter(a => a.status === 'COMPLETED').length,
        openFindings: audits.reduce((sum, a) => sum + ((a as any).majorFindings ?? 0) + ((a as any).minorFindings ?? 0), 0),
      };
    },
  });
}
