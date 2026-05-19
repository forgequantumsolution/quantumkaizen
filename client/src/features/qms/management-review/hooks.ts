import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem } from '@/lib/apiShape';
import { useUserIndustry, pickByIndustry } from '@/lib/userIndustry';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ManagementReview {
  id: string;
  title: string;
  date: string;
  time: string;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  attendees: Attendee[];
  agenda: string[];
  minutesSummary: string | null;
  actionItems: ActionItem[];
}

export interface Attendee {
  name: string;
  role: string;
  present?: boolean;
}

export interface ActionItem {
  id: string;
  action: string;
  owner: string;
  dueDate: string;
  status: 'Open' | 'In Progress' | 'Completed' | 'Overdue';
  reviewId: string;
  reviewTitle: string;
  priority: 'High' | 'Medium' | 'Low';
  completionNotes: string | null;
}

export interface QMSSummary {
  ncCount: number;
  ncOpenCount: number;
  ncClosedThisQuarter: number;
  ncAvgClosureTime: number;
  capaCount: number;
  capaOpenCount: number;
  capaEffectivenessRate: number;
  auditFindingsTotal: number;
  auditFindingsOpen: number;
  auditFindingsMajor: number;
}

export interface DMSSummary {
  totalDocuments: number;
  documentsDueForReview: number;
  newDocumentsThisQuarter: number;
  overdueReviews: number;
  pendingApprovals: number;
}

export interface LMSSummary {
  trainingCompliancePercent: number;
  totalTrainings: number;
  completedTrainings: number;
  expiringCertifications: number;
  overdueCertifications: number;
  avgTrainingHoursPerEmployee: number;
}

export interface SupplierSummary {
  totalSuppliers: number;
  approvedSuppliers: number;
  suppliersOnWatch: number;
  avgSupplierRating: number;
  supplierNCCount: number;
  overdueEvaluations: number;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

export const mockReviews: ManagementReview[] = [
  {
    id: 'mr1',
    title: 'Q2 2026 Management Review',
    date: '2026-04-25',
    time: '10:00 AM - 01:00 PM',
    status: 'Scheduled',
    attendees: [
      { name: 'Kavita Iyer', role: 'Managing Director' },
      { name: 'Priya Sharma', role: 'QA Manager' },
      { name: 'Rajesh Kumar', role: 'Engineering Head' },
      { name: 'Vikram Patel', role: 'Production Manager' },
      { name: 'Sunita Rao', role: 'Procurement Head' },
      { name: 'Anita Desai', role: 'QC Lead' },
      { name: 'Deepak Nair', role: 'HSE Manager' },
    ],
    agenda: [
      'Review of previous MRM action items',
      'QMS performance metrics (Q1 2026)',
      'NC and CAPA trend analysis',
      'Internal and external audit findings',
      'Customer complaint analysis',
      'Supplier performance review',
      'Training compliance status',
      'Document management system migration update',
      'Risk register review',
      'Resource requirements and improvement opportunities',
    ],
    minutesSummary: null,
    actionItems: [],
  },
  {
    id: 'mr2',
    title: 'Q1 2026 Management Review',
    date: '2026-01-28',
    time: '10:00 AM - 12:30 PM',
    status: 'Completed',
    attendees: [
      { name: 'Kavita Iyer', role: 'Managing Director', present: true },
      { name: 'Priya Sharma', role: 'QA Manager', present: true },
      { name: 'Rajesh Kumar', role: 'Engineering Head', present: true },
      { name: 'Vikram Patel', role: 'Production Manager', present: true },
      { name: 'Sunita Rao', role: 'Procurement Head', present: false },
      { name: 'Anita Desai', role: 'QC Lead', present: true },
      { name: 'Deepak Nair', role: 'HSE Manager', present: true },
    ],
    agenda: [
      'Review of Q4 2025 action items',
      'QMS performance summary',
      'Audit findings status',
      'Customer satisfaction analysis',
      'Supplier performance',
      'Training and competency',
      'Improvement opportunities',
    ],
    minutesSummary: 'Review conducted with 6 of 7 members present. All Q4 2025 action items reviewed — 6 completed, 2 carried forward. NC rate decreased by 12% QoQ. CAPA effectiveness improved to 88%. One major audit finding pending closure. Customer satisfaction score improved to 4.2/5.0. Supplier evaluation cycle initiated for 8 critical suppliers. Training compliance at 91%. Decision: Proceed with DMS migration project. Next review scheduled for April 2026.',
    actionItems: [],
  },
  {
    id: 'mr3',
    title: 'Q4 2025 Management Review',
    date: '2025-10-30',
    time: '10:00 AM - 01:00 PM',
    status: 'Completed',
    attendees: [
      { name: 'Kavita Iyer', role: 'Managing Director', present: true },
      { name: 'Priya Sharma', role: 'QA Manager', present: true },
      { name: 'Rajesh Kumar', role: 'Engineering Head', present: true },
      { name: 'Vikram Patel', role: 'Production Manager', present: true },
      { name: 'Sunita Rao', role: 'Procurement Head', present: true },
      { name: 'Anita Desai', role: 'QC Lead', present: true },
      { name: 'Deepak Nair', role: 'HSE Manager', present: true },
    ],
    agenda: [
      'Review of Q3 action items',
      'Annual QMS performance',
      'Certification audit preparation',
      'Resource planning',
    ],
    minutesSummary: 'Full attendance. Q3 action items — 8 of 8 completed. Annual NC trend shows 15% reduction YoY. CAPA effectiveness at 85%. ISO 9001 surveillance audit scheduled for November 2025. Supplier rating system upgrade approved. Training plan for 2026 discussed.',
    actionItems: [],
  },
];

export const mockActionItems: ActionItem[] = [
  { id: 'ai1', action: 'Complete DMS migration Phase 1 (QA/QC documents)', owner: 'Priya Sharma', dueDate: '2026-04-25', status: 'In Progress', reviewId: 'mr2', reviewTitle: 'Q1 2026 Management Review', priority: 'High', completionNotes: null },
  { id: 'ai2', action: 'Close major audit finding AF-2025-012 (calibration procedure gap)', owner: 'Anita Desai', dueDate: '2026-03-31', status: 'Overdue', reviewId: 'mr2', reviewTitle: 'Q1 2026 Management Review', priority: 'High', completionNotes: null },
  { id: 'ai3', action: 'Conduct supplier evaluation for 8 critical suppliers', owner: 'Sunita Rao', dueDate: '2026-04-15', status: 'In Progress', reviewId: 'mr2', reviewTitle: 'Q1 2026 Management Review', priority: 'Medium', completionNotes: null },
  { id: 'ai4', action: 'Achieve 95% training compliance target for Q2', owner: 'Rajesh Kumar', dueDate: '2026-06-30', status: 'Open', reviewId: 'mr2', reviewTitle: 'Q1 2026 Management Review', priority: 'Medium', completionNotes: null },
  { id: 'ai5', action: 'Implement automated calibration reminder system', owner: 'Deepak Nair', dueDate: '2026-04-30', status: 'In Progress', reviewId: 'mr2', reviewTitle: 'Q1 2026 Management Review', priority: 'High', completionNotes: null },
  { id: 'ai6', action: 'Update risk register with new operational risks identified', owner: 'Priya Sharma', dueDate: '2026-02-28', status: 'Completed', reviewId: 'mr2', reviewTitle: 'Q1 2026 Management Review', priority: 'Medium', completionNotes: 'Risk register updated with 5 new risks. Reviewed and approved by management.' },
  { id: 'ai7', action: 'Deploy customer satisfaction survey for Q1 orders', owner: 'Sunita Rao', dueDate: '2026-03-15', status: 'Completed', reviewId: 'mr2', reviewTitle: 'Q1 2026 Management Review', priority: 'Low', completionNotes: 'Survey deployed to 42 customers. Response rate: 68%.' },
  { id: 'ai8', action: 'Review and update all FMEA documents for production processes', owner: 'Vikram Patel', dueDate: '2026-05-15', status: 'Open', reviewId: 'mr2', reviewTitle: 'Q1 2026 Management Review', priority: 'Medium', completionNotes: null },
];

export const mockQMSSummary: QMSSummary = {
  ncCount: 42,
  ncOpenCount: 8,
  ncClosedThisQuarter: 14,
  ncAvgClosureTime: 18,
  capaCount: 28,
  capaOpenCount: 6,
  capaEffectivenessRate: 88,
  auditFindingsTotal: 15,
  auditFindingsOpen: 3,
  auditFindingsMajor: 1,
};

export const mockDMSSummary: DMSSummary = {
  totalDocuments: 342,
  documentsDueForReview: 18,
  newDocumentsThisQuarter: 12,
  overdueReviews: 4,
  pendingApprovals: 7,
};

export const mockLMSSummary: LMSSummary = {
  trainingCompliancePercent: 91,
  totalTrainings: 156,
  completedTrainings: 142,
  expiringCertifications: 8,
  overdueCertifications: 2,
  avgTrainingHoursPerEmployee: 24,
};

export const mockSupplierSummary: SupplierSummary = {
  totalSuppliers: 48,
  approvedSuppliers: 42,
  suppliersOnWatch: 3,
  avgSupplierRating: 4.1,
  supplierNCCount: 5,
  overdueEvaluations: 2,
};

// Medical-device management reviews — agenda per ISO 13485 §5.6.
export const mockMedicalDeviceReviews: ManagementReview[] = [
  {
    id: 'md-mr1', title: 'Q2 2026 Management Review (FQ MedTech)', date: '2026-04-30', time: '10:00 AM - 01:30 PM',
    status: 'Scheduled',
    attendees: [
      { name: 'Vikram Saraswat',   role: 'Managing Director' },
      { name: 'Dr. Anjali Verma',  role: 'Head of Quality / PRRC' },
      { name: 'Aditya Menon',      role: 'Head of R&D / Design Controls' },
      { name: 'Karthik Iyer',      role: 'Production & Sterilization Head' },
      { name: 'Neha Bansal',       role: 'Procurement Head' },
      { name: 'Sneha Kapoor',      role: 'Regulatory Affairs Manager' },
      { name: 'Rohit Khanna',      role: 'Engineering Manager' },
    ],
    agenda: [
      'Review of Q1 2026 MRM action items',
      'PMS / vigilance trends (ISO 13485 §5.6.2)',
      'NC and CAPA effectiveness — including CAPA-MD-2026-0019 (EO) and CAPA-MD-2025-0058 (sealer) closure',
      'Notified-body audit MD-F3 / F4 closure status',
      'EU MDR PSUR submission readiness',
      'Risk-management file (ISO 14971) review',
      'Cybersecurity / SBOM update for connected infusion pump',
      'MDSAP recertification readiness',
      'Supplier performance (Specur Polymers CAR status)',
      'Training compliance and competency gaps',
    ],
    minutesSummary: null, actionItems: [],
  },
  {
    id: 'md-mr2', title: 'Q1 2026 Management Review (FQ MedTech)', date: '2026-01-30', time: '10:00 AM - 12:30 PM',
    status: 'Completed',
    attendees: [
      { name: 'Vikram Saraswat',   role: 'Managing Director',         present: true },
      { name: 'Dr. Anjali Verma',  role: 'Head of Quality / PRRC',    present: true },
      { name: 'Aditya Menon',      role: 'Head of R&D / Design Controls', present: true },
      { name: 'Karthik Iyer',      role: 'Production & Sterilization Head', present: true },
      { name: 'Neha Bansal',       role: 'Procurement Head',          present: false },
      { name: 'Sneha Kapoor',      role: 'Regulatory Affairs Manager',present: true },
      { name: 'Rohit Khanna',      role: 'Engineering Manager',       present: true },
    ],
    agenda: [
      'Review of Q4 2025 MRM action items',
      'TÜV SÜD surveillance audit results',
      'Sterilization process performance (post heart-valve seal CAPA)',
      'Customer feedback / vigilance',
      'Training compliance',
    ],
    minutesSummary: 'Review held with 6 of 7 attendees. All Q4 2025 action items completed except PMCF quantitative-thresholds revision (carried to Q2). TÜV SÜD MD-F3 (PMS plan) closure on track for 2026-05. CAPA-MD-2025-0058 (heart-valve seal) effectiveness PASS — 0 seal failures in 90-day window. CAPA-MD-2026-0011 (IOL cavity 03) effectiveness PASS — 0 particulate NCs over 180 days. PMS report Q4 2025 reviewed and signed by PRRC. Training compliance at 89% — Q2 target 93%. Decision: extend CAPA monitoring to 180 days following CR-MD-2025-0033 AOI deployment.',
    actionItems: [],
  },
  {
    id: 'md-mr3', title: 'Q4 2025 Management Review (FQ MedTech)', date: '2025-10-31', time: '10:00 AM - 01:00 PM',
    status: 'Completed',
    attendees: [
      { name: 'Vikram Saraswat',   role: 'Managing Director',         present: true },
      { name: 'Dr. Anjali Verma',  role: 'Head of Quality / PRRC',    present: true },
      { name: 'Aditya Menon',      role: 'Head of R&D / Design Controls', present: true },
      { name: 'Karthik Iyer',      role: 'Production & Sterilization Head', present: true },
      { name: 'Neha Bansal',       role: 'Procurement Head',          present: true },
      { name: 'Sneha Kapoor',      role: 'Regulatory Affairs Manager',present: true },
      { name: 'Rohit Khanna',      role: 'Engineering Manager',       present: true },
    ],
    agenda: ['Q3 action item closure', 'EU MDR notified-body audit readiness', 'CR-MD-2025-0033 AOI deployment review', 'PMCF plan refresh', 'Cybersecurity guidance impact (FDA 2023)'],
    minutesSummary: 'Full attendance. EU MDR surveillance audit scheduled for Nov 2025; readiness on track. AOI deployment validated, IOL particulate-related NCs down 64%. Cybersecurity guidance impact assessed; CR-MD-2025-0048 raised to incorporate IEC 81001-5-1.',
    actionItems: [],
  },
];

export const mockMedicalDeviceActionItems: ActionItem[] = [
  { id: 'md-ai1', action: 'Close TÜV SÜD finding MD-F3 (PMS plan — quantitative FSN thresholds)', owner: 'Sneha Kapoor',     dueDate: '2026-05-15', status: 'In Progress', reviewId: 'md-mr2', reviewTitle: 'Q1 2026 Management Review (FQ MedTech)', priority: 'High',   completionNotes: null },
  { id: 'md-ai2', action: 'Submit Letter-to-File to USFDA for firmware v3.5 (CR-MD-2026-0014)',     owner: 'Sneha Kapoor',     dueDate: '2026-05-25', status: 'Open',         reviewId: 'md-mr2', reviewTitle: 'Q1 2026 Management Review (FQ MedTech)', priority: 'High',   completionNotes: null },
  { id: 'md-ai3', action: 'Complete 1+3+3 IQ/OQ/PQ for extended EO aeration cycle',                 owner: 'Rohit Khanna',     dueDate: '2026-05-12', status: 'In Progress', reviewId: 'md-mr2', reviewTitle: 'Q1 2026 Management Review (FQ MedTech)', priority: 'High',   completionNotes: null },
  { id: 'md-ai4', action: 'Qualify secondary titanium-alloy vendor (Resonetics India)',             owner: 'Neha Bansal',      dueDate: '2026-07-31', status: 'Open',         reviewId: 'md-mr2', reviewTitle: 'Q1 2026 Management Review (FQ MedTech)', priority: 'Medium', completionNotes: null },
  { id: 'md-ai5', action: 'Lift training compliance from 89% to 93% target by Q2',                  owner: 'Dr. Anjali Verma', dueDate: '2026-06-30', status: 'Open',         reviewId: 'md-mr2', reviewTitle: 'Q1 2026 Management Review (FQ MedTech)', priority: 'Medium', completionNotes: null },
  { id: 'md-ai6', action: 'Refresh PMCF plan with quantitative FSN-trend thresholds per product family', owner: 'Sneha Kapoor', dueDate: '2026-05-15', status: 'In Progress', reviewId: 'md-mr2', reviewTitle: 'Q1 2026 Management Review (FQ MedTech)', priority: 'High',   completionNotes: null },
];

// Numbers calibrated against the medical-device mock totals — full
// manufacturer scope (disposables + implants + connected). Visible record
// counts plus a credible background tail so MRM tables match the list pages.
export const mockMedicalDeviceQMSSummary: QMSSummary = {
  ncCount: 34, ncOpenCount: 9, ncClosedThisQuarter: 13, ncAvgClosureTime: 23,
  capaCount: 19, capaOpenCount: 6, capaEffectivenessRate: 91,
  auditFindingsTotal: 13, auditFindingsOpen: 2, auditFindingsMajor: 2,
};
export const mockMedicalDeviceDMSSummary: DMSSummary = {
  totalDocuments: 226, documentsDueForReview: 12, newDocumentsThisQuarter: 9, overdueReviews: 2, pendingApprovals: 3,
};
export const mockMedicalDeviceLMSSummary: LMSSummary = {
  trainingCompliancePercent: 89, totalTrainings: 124, completedTrainings: 112, expiringCertifications: 5, overdueCertifications: 1, avgTrainingHoursPerEmployee: 27,
};
export const mockMedicalDeviceSupplierSummary: SupplierSummary = {
  totalSuppliers: 22, approvedSuppliers: 18, suppliersOnWatch: 2, avgSupplierRating: 4.5, supplierNCCount: 4, overdueEvaluations: 0,
};

// Dairy tenant — Management Review records (FSSAI / ISO 22000 themed).
export const mockDairyReviews: ManagementReview[] = [
  {
    id: 'dy-mr1', title: 'Q2 2026 Management Review (Dairy Plant)', date: '2026-05-28', time: '10:00 AM - 01:00 PM',
    status: 'Scheduled',
    attendees: [
      { name: 'Anil Kothari',     role: 'Managing Director' },
      { name: 'Sandeep Joshi',    role: 'Head of Quality (FSSAI focal)' },
      { name: 'Meera Pillai',     role: 'Procurement / Farm Liaison' },
      { name: 'Ravi Deshmukh',    role: 'Production Manager (Pasteurization)' },
      { name: 'Anita Kulkarni',   role: 'Microbiology / Lab Lead' },
      { name: 'Priya Khanna',     role: 'Packaging / Cold Chain' },
      { name: 'Sunita Borade',    role: 'R&D / NPD' },
    ],
    agenda: [
      'Review of Q1 2026 MRM action items',
      'AfM1 mycotoxin trend + pre-monsoon screening readiness (CAPA-DY-2026-0019)',
      'NC trends — antibiotic residue / TPC / fat-SNF',
      'FSSAI Annual Inspection readiness (AUD-DY-2026-001)',
      'Cold-chain IoT rollout (CR-DY-2026-0006) status',
      'Shelf-life extension validation (CR-DY-2026-0007) status',
      'A2 cow-milk SKU launch readiness (CR-DY-2026-0005)',
      'Supplier scorecards — farmer co-op clusters A/B/C',
      'Training compliance Q1',
    ],
    minutesSummary: null, actionItems: [],
  },
  {
    id: 'dy-mr2', title: 'Q1 2026 Management Review (Dairy Plant)', date: '2026-03-25', time: '10:00 AM - 12:30 PM',
    status: 'Completed',
    attendees: [
      { name: 'Anil Kothari',     role: 'Managing Director',                   present: true  },
      { name: 'Sandeep Joshi',    role: 'Head of Quality (FSSAI focal)',       present: true  },
      { name: 'Meera Pillai',     role: 'Procurement / Farm Liaison',          present: false },
      { name: 'Ravi Deshmukh',    role: 'Production Manager (Pasteurization)', present: true  },
      { name: 'Anita Kulkarni',   role: 'Microbiology / Lab Lead',             present: true  },
      { name: 'Priya Khanna',     role: 'Packaging / Cold Chain',              present: true  },
      { name: 'Sunita Borade',    role: 'R&D / NPD',                           present: true  },
    ],
    agenda: [
      'Q4 2025 action item closure',
      'FSSAI Surveillance findings closure (AUD-DY-2025-FSSAI)',
      'Q1 NC trends (curd coliform, ghee FFA, pouch leakage)',
      'Cold-chain incident on route DEL-N3',
      'Training plan FY26-27',
    ],
    minutesSummary: 'Review held with 6 of 7 attendees. All Q4 2025 action items closed except FSSAI MD-F3 antibiotic-log gap (carried). CAPA-DY-2025-0044 (FFS-04 heat seal) effectiveness PASS — 0 leak events in 90-day window. Cold-chain NC-DY-2025-0156 root-caused — IoT logger rollout approved via CR-DY-2026-0006. Q1 NC count 6 closures vs. 4 currently open — Q1 closure cadence stable. Training compliance at 89% — Q3 target 93%.',
    actionItems: [],
  },
  {
    id: 'dy-mr3', title: 'Q4 2025 Management Review (Dairy Plant)', date: '2025-12-20', time: '10:00 AM - 01:00 PM',
    status: 'Completed',
    attendees: [
      { name: 'Anil Kothari',     role: 'Managing Director',                   present: true },
      { name: 'Sandeep Joshi',    role: 'Head of Quality (FSSAI focal)',       present: true },
      { name: 'Meera Pillai',     role: 'Procurement / Farm Liaison',          present: true },
      { name: 'Ravi Deshmukh',    role: 'Production Manager (Pasteurization)', present: true },
      { name: 'Anita Kulkarni',   role: 'Microbiology / Lab Lead',             present: true },
      { name: 'Priya Khanna',     role: 'Packaging / Cold Chain',              present: true },
      { name: 'Sunita Borade',    role: 'R&D / NPD',                           present: true },
    ],
    agenda: ['Q3 action item closure', 'FSSAI Annual Inspection prep', 'Cold-chain audit results', 'Summer demand planning'],
    minutesSummary: 'Full attendance. Q3 action items 7 of 7 completed. FSSAI Surveillance audit (AUD-DY-2025-FSSAI) had 1 Major (antibiotic-log gap) — closure plan agreed. Cold-chain audit identified VAN-N3 risk — service scheduled.',
    actionItems: [],
  },
];

export const mockDairyActionItems: ActionItem[] = [
  { id: 'dy-ai1', action: 'Close FSSAI Surveillance MD-F3 — antibiotic-log gap at 4 village centres (CAPA-DY-2026-0017)', owner: 'Meera Pillai',     dueDate: '2026-05-30', status: 'In Progress', reviewId: 'dy-mr2', reviewTitle: 'Q1 2026 Management Review (Dairy Plant)', priority: 'High',   completionNotes: null },
  { id: 'dy-ai2', action: 'Pre-monsoon AfM1 sampling (twice-weekly) deployed across all 18 collection centres',           owner: 'Anita Kulkarni',   dueDate: '2026-06-10', status: 'In Progress', reviewId: 'dy-mr2', reviewTitle: 'Q1 2026 Management Review (Dairy Plant)', priority: 'High',   completionNotes: null },
  { id: 'dy-ai3', action: 'IQ/OQ/PQ on extended 21-second pasteurization holding tube (CR-DY-2026-0007)',                 owner: 'Ravi Deshmukh',    dueDate: '2026-06-10', status: 'In Progress', reviewId: 'dy-mr2', reviewTitle: 'Q1 2026 Management Review (Dairy Plant)', priority: 'High',   completionNotes: null },
  { id: 'dy-ai4', action: 'IoT cold-chain loggers installed on all 14 refrigerated vans (CR-DY-2026-0006)',                owner: 'Priya Khanna',     dueDate: '2026-05-30', status: 'In Progress', reviewId: 'dy-mr2', reviewTitle: 'Q1 2026 Management Review (Dairy Plant)', priority: 'Medium', completionNotes: null },
  { id: 'dy-ai5', action: 'A2 cow-milk SKU pilot batch dispatched to 12 retail stores (CR-DY-2026-0005)',                  owner: 'Sunita Borade',    dueDate: '2026-07-15', status: 'Open',         reviewId: 'dy-mr2', reviewTitle: 'Q1 2026 Management Review (Dairy Plant)', priority: 'Medium', completionNotes: null },
  { id: 'dy-ai6', action: 'Lift training compliance from 89% to 93% by Q3 (FSSAI hygiene + HACCP refresh)',                owner: 'Sandeep Joshi',    dueDate: '2026-09-30', status: 'Open',         reviewId: 'dy-mr2', reviewTitle: 'Q1 2026 Management Review (Dairy Plant)', priority: 'Medium', completionNotes: null },
];

// KPI totals calibrated against the visible dairy mocks:
//   NCs 10 visible (4 open) + ~12 background → ncCount 22, ncOpenCount 9
//   CAPAs 4 visible (3 open, 1 closed PASS) + tail → capaCount 12, capaOpenCount 6
//   Audits 5 visible · 7 visible findings (2 currently open, 2 majors closed)
//   Suppliers 8 visible (mean 4.4/5 → score 88) + tail → totalSuppliers 18
//   Training programs 12 (mean completion 89%) → compliance 89, totalTrainings 86
export const mockDairyQMSSummary: QMSSummary = {
  ncCount: 22, ncOpenCount: 9, ncClosedThisQuarter: 6, ncAvgClosureTime: 19,
  capaCount: 12, capaOpenCount: 6, capaEffectivenessRate: 91,
  auditFindingsTotal: 7, auditFindingsOpen: 2, auditFindingsMajor: 2,
};
export const mockDairyDMSSummary: DMSSummary = {
  totalDocuments: 142, documentsDueForReview: 6, newDocumentsThisQuarter: 4, overdueReviews: 1, pendingApprovals: 2,
};
export const mockDairyLMSSummary: LMSSummary = {
  trainingCompliancePercent: 89, totalTrainings: 86, completedTrainings: 77, expiringCertifications: 4, overdueCertifications: 1, avgTrainingHoursPerEmployee: 24,
};
export const mockDairySupplierSummary: SupplierSummary = {
  totalSuppliers: 18, approvedSuppliers: 14, suppliersOnWatch: 1, avgSupplierRating: 4.4, supplierNCCount: 2, overdueEvaluations: 0,
};

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useManagementReviews() {
  const industry = useUserIndustry();
  return useQuery({
    queryKey: ['management-reviews', industry ?? 'default'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/management-review/meetings');
        const { data: reviews } = unwrapList(data);
        const actionItems = pickByIndustry(industry, mockActionItems, { medical_device: mockMedicalDeviceActionItems, dairy: mockDairyActionItems });
        return { reviews: reviews as unknown as typeof mockReviews, actionItems };
      } catch {
        const reviews     = pickByIndustry(industry, mockReviews,     { medical_device: mockMedicalDeviceReviews,     dairy: mockDairyReviews });
        const actionItems = pickByIndustry(industry, mockActionItems, { medical_device: mockMedicalDeviceActionItems, dairy: mockDairyActionItems });
        return { reviews, actionItems };
      }
    },
    staleTime: 30_000,
  });
}

export function useScheduleReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title: string; date: string; time: string; agenda: string }) => {
      try {
        const { data } = await api.post('/qms/management-review/meetings', body);
        return data;
      } catch {
        return { id: `mr-${Date.now()}`, ...body, status: 'Scheduled' };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['management-reviews'] }),
  });
}

export function useManagementReviewSummary() {
  const industry = useUserIndustry();
  return useQuery({
    queryKey: ['management-review-summary', industry ?? 'default'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/management-review/summary');
        return unwrapItem(data);
      } catch {
        return {
          qms:      pickByIndustry(industry, mockQMSSummary,      { medical_device: mockMedicalDeviceQMSSummary,      dairy: mockDairyQMSSummary }),
          dms:      pickByIndustry(industry, mockDMSSummary,      { medical_device: mockMedicalDeviceDMSSummary,      dairy: mockDairyDMSSummary }),
          lms:      pickByIndustry(industry, mockLMSSummary,      { medical_device: mockMedicalDeviceLMSSummary,      dairy: mockDairyLMSSummary }),
          supplier: pickByIndustry(industry, mockSupplierSummary, { medical_device: mockMedicalDeviceSupplierSummary, dairy: mockDairySupplierSummary }),
        };
      }
    },
    staleTime: 30_000,
  });
}
