import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ChangeRequest {
  id: string;
  crNumber: string;
  title: string;
  description: string;
  reasonForChange: string;
  changeType: 'Process' | 'Product' | 'System' | 'Document';
  impactLevel: 'High' | 'Medium' | 'Low';
  status: 'Draft' | 'Under Review' | 'Approved' | 'In Implementation' | 'Validated' | 'Closed' | 'Rejected';
  requestor: string;
  requestorId: string;
  department: string;
  targetDate: string;
  impactAssessment: string;
  affectedDocuments: string[];
  affectedProcesses: string[];
  riskAssessment: string;
  regulatoryNotification: boolean;
  notifyDepartments: string[];
  implementationTasks: ImplementationTask[];
  approvalStages: ApprovalStage[];
  validationResults: ValidationResult | null;
  history: ChangeHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ImplementationTask {
  id: string;
  description: string;
  owner: string;
  dueDate: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Overdue';
}

export interface ApprovalStage {
  name: string;
  status: 'completed' | 'active' | 'pending' | 'rejected';
  approver?: string;
  timestamp?: string;
  comment?: string;
}

export interface ValidationResult {
  validated: boolean;
  validatedBy: string;
  validationDate: string;
  effectivenessConfirmed: boolean;
  notes: string;
}

export interface ChangeHistoryEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

export const mockChangeRequests: ChangeRequest[] = [
  // ── 2026 records ──
  {
    id: 'cr1',
    crNumber: 'CR-2026-0012',
    title: 'Analytical method change: HPLC to UPLC for assay of Paracetamol 500mg tablets',
    description: 'Replace existing HPLC assay method (BP 2020, Appendix III) with a validated UPLC method for Paracetamol 500mg tablet assay and related substances testing. UPLC method offers shorter run time (6 min vs 18 min), improved resolution, and lower solvent consumption.',
    reasonForChange: 'UPLC method provides significant reduction in analysis time and organic solvent waste. QC laboratory throughput bottleneck identified in annual capacity review. UPLC equipment procured as part of lab expansion (CR-2025-0034). Regulatory precedent established — UPLC accepted in Ph.Eur. and USP monographs.',
    changeType: 'Process',
    impactLevel: 'High',
    status: 'Under Review',
    requestor: 'Rajesh Kumar',
    requestorId: 'u2',
    department: 'Quality Control',
    targetDate: '2026-05-30',
    impactAssessment: 'Method validation required per ICH Q2(R1) including specificity, linearity, accuracy, precision, LOD/LOQ, and robustness. All QC analysts (8 persons) require training on UPLC system. Method transfer study with stability laboratory required. Regulatory variation filing required for all registered markets.',
    affectedDocuments: ['STP-PCT-001 (Paracetamol 500mg QC Specification and Test Procedure)', 'SOP-QC-UPLC-001 (new: UPLC Operation)', 'SOP-QC-METH-007 (Method Validation)', 'Stability protocol SS-PCT-001'],
    affectedProcesses: ['QC Release Testing', 'Stability Testing', 'Method Validation'],
    riskAssessment: 'High regulatory risk if method validation is incomplete or variation filing is delayed. Mitigation: Run HPLC and UPLC in parallel during transition period. All validation data reviewed by Head QC before regulatory submission.',
    regulatoryNotification: true,
    notifyDepartments: ['Quality Control', 'Quality Assurance', 'Regulatory Affairs'],
    implementationTasks: [
      { id: 't1', description: 'Complete full method validation per ICH Q2(R1)', owner: 'Rajesh Kumar', dueDate: '2026-04-30', status: 'In Progress' },
      { id: 't2', description: 'Train all QC analysts on UPLC system operation and new STP', owner: 'Rajesh Kumar', dueDate: '2026-05-10', status: 'Pending' },
      { id: 't3', description: 'Complete method transfer to stability laboratory', owner: 'Rajesh Kumar', dueDate: '2026-05-15', status: 'Pending' },
      { id: 't4', description: 'Prepare and file regulatory variation dossier', owner: 'Anita Desai', dueDate: '2026-05-28', status: 'Pending' },
    ],
    approvalStages: [
      { name: 'Initiator Submission', status: 'completed', approver: 'Rajesh Kumar', timestamp: '2026-03-25 09:30', comment: 'Submitted based on validated method development data' },
      { name: 'QC Head Review', status: 'completed', approver: 'Rajesh Kumar', timestamp: '2026-03-26 14:15', comment: 'Method development data reviewed and found satisfactory' },
      { name: 'Quality Assurance Review', status: 'active', approver: 'Dr. Priya Sharma' },
      { name: 'Regulatory Affairs Review', status: 'pending', approver: 'Anita Desai' },
      { name: 'Management Approval', status: 'pending', approver: 'Plant Director' },
    ],
    validationResults: null,
    history: [
      { id: 'h1', timestamp: '2026-03-25T09:30:00Z', user: 'Rajesh Kumar', action: 'Created', details: 'Change request submitted for HPLC to UPLC method change' },
      { id: 'h2', timestamp: '2026-03-26T14:15:00Z', user: 'Rajesh Kumar', action: 'Approved', details: 'QC review completed and approved' },
      { id: 'h3', timestamp: '2026-03-27T10:00:00Z', user: 'Dr. Priya Sharma', action: 'Under Review', details: 'QA review in progress' },
    ],
    createdAt: '2026-03-25T09:30:00Z',
    updatedAt: '2026-03-27T10:00:00Z',
  },
  {
    id: 'cr2',
    crNumber: 'CR-2026-0011',
    title: 'Excipient supplier change: HPMC coating polymer from Colorcon Ltd to BASF SE',
    description: 'Qualify BASF SE Pharmacoat 603 as an alternate source for HPMC coating polymer currently sourced exclusively from Colorcon Opadry. This change applies to Omeprazole 20mg Capsule enteric coating and Metformin 500mg Tablet film coat processes.',
    reasonForChange: 'Following CAPA-2026-0019 (dissolution failure linked to Colorcon HPMC lot HPM-C-2026-002), management directed dual-sourcing of critical coating polymer. BASF Pharmacoat 603 has equivalent viscosity specification and is compendial (USP/NF, Ph.Eur.).',
    changeType: 'Product',
    impactLevel: 'High',
    status: 'Approved',
    requestor: 'Dr. Priya Sharma',
    requestorId: 'u1',
    department: 'Quality Assurance',
    targetDate: '2026-06-30',
    impactAssessment: 'Comparative dissolution testing required for both products using BASF HPMC. Stability study required (accelerated, 6 months minimum) before regulatory variation filing. New supplier qualification audit of BASF SE India required. Incoming specification update required to add viscosity testing for both sources.',
    affectedDocuments: ['MFR-OMP-001 (Omeprazole Manufacturing Formula)', 'MFR-MET-001 (Metformin Manufacturing Formula)', 'AVL-2026 (Approved Vendor List)', 'STP-QC-HPMC-001 (Incoming Specification for HPMC)', 'SOP-QA-SUPP-003 (Supplier Change Procedure)'],
    affectedProcesses: ['Granulation', 'Coating', 'QC Incoming Inspection', 'Stability Testing'],
    riskAssessment: 'High risk due to critical functional role of HPMC in enteric coating. Mitigation: Pilot coating trials on 3 consecutive batches before commercial use. Dissolution testing at each key time point. Maintain Colorcon supply as primary until BASF fully qualified.',
    regulatoryNotification: true,
    notifyDepartments: ['Quality Assurance', 'Quality Control', 'Production', 'Regulatory Affairs'],
    implementationTasks: [
      { id: 't5', description: 'Conduct pilot coating trials (3 batches each product) using BASF Pharmacoat 603', owner: 'Vikram Patel', dueDate: '2026-05-15', status: 'Pending' },
      { id: 't6', description: 'Complete comparative dissolution testing vs Colorcon benchmark', owner: 'Rajesh Kumar', dueDate: '2026-05-30', status: 'Pending' },
      { id: 't7', description: 'Conduct supplier qualification audit of BASF SE India (Mumbai)', owner: 'Dr. Priya Sharma', dueDate: '2026-04-30', status: 'In Progress' },
      { id: 't8', description: 'Initiate 6-month accelerated stability study with BASF-coated batches', owner: 'Rajesh Kumar', dueDate: '2026-05-20', status: 'Pending' },
    ],
    approvalStages: [
      { name: 'Initiator Submission', status: 'completed', approver: 'Dr. Priya Sharma', timestamp: '2026-03-20 11:00' },
      { name: 'QC Review', status: 'completed', approver: 'Rajesh Kumar', timestamp: '2026-03-22 09:45', comment: 'Comparative technical data reviewed; BASF specification equivalent confirmed' },
      { name: 'Regulatory Affairs Review', status: 'completed', approver: 'Anita Desai', timestamp: '2026-03-24 14:00', comment: 'Regulatory variation pathway identified; Type II variation required' },
      { name: 'Management Approval', status: 'completed', approver: 'Plant Director', timestamp: '2026-03-25 10:00', comment: 'Approved; dual sourcing strategy confirmed' },
    ],
    validationResults: null,
    history: [
      { id: 'h4', timestamp: '2026-03-20T11:00:00Z', user: 'Dr. Priya Sharma', action: 'Created', details: 'Supplier change request submitted' },
      { id: 'h5', timestamp: '2026-03-25T10:00:00Z', user: 'Plant Director', action: 'Approved', details: 'All approvals completed; implementation authorised' },
    ],
    createdAt: '2026-03-20T11:00:00Z',
    updatedAt: '2026-03-25T10:00:00Z',
  },
  {
    id: 'cr3',
    crNumber: 'CR-2026-0010',
    title: 'Granulation process parameter change: granulator impeller speed for Metformin 500mg',
    description: 'Revise granulator impeller speed set point for Metformin 500mg wet granulation from 150 RPM to 180 RPM to improve granule size distribution and bulk density consistency. Change supported by DoE (Design of Experiment) data from three development batches.',
    reasonForChange: 'Investigation following CAPA-2024-0038 (tablet hardness out of specification) identified that granule size variability was a contributing factor. DoE study demonstrated that increasing impeller speed from 150 to 180 RPM narrows granule PSD (D90: 420µm ± 15µm vs 420µm ± 48µm) and improves bulk density consistency (RSD: 2.1% vs 6.8%).',
    changeType: 'Process',
    impactLevel: 'High',
    status: 'In Implementation',
    requestor: 'Vikram Patel',
    requestorId: 'u4',
    department: 'Production',
    targetDate: '2026-04-15',
    impactAssessment: 'Process re-validation required: 3 consecutive batches at new parameter. All batch manufacturing records (BMR) for Metformin 500mg must be updated. Granulator PLC set point requires engineering change. Comparative dissolution and physical testing required for validation batches.',
    affectedDocuments: ['BMR-MET-001 Rev 5 (Metformin 500mg Batch Manufacturing Record)', 'PV-MET-001 (Process Validation Protocol)', 'SOP-PROD-GRAN-002 (Wet Granulation Procedure)'],
    affectedProcesses: ['Wet Granulation', 'In-Process QC', 'Process Validation'],
    riskAssessment: 'Medium risk. Higher impeller speed could cause API degradation or over-granulation if not controlled. Mitigation: In-process monitoring of granule endpoint (torque/power consumption). First validation batch with enhanced in-process sampling.',
    regulatoryNotification: true,
    notifyDepartments: ['Production', 'Quality Assurance', 'Quality Control', 'Regulatory Affairs'],
    implementationTasks: [
      { id: 't9', description: 'Update granulator PLC set point to 180 RPM and lock with engineering password', owner: 'Deepak Nair', dueDate: '2026-03-30', status: 'Completed' },
      { id: 't10', description: 'Update BMR-MET-001 to reflect new impeller speed parameter', owner: 'Dr. Priya Sharma', dueDate: '2026-04-01', status: 'In Progress' },
      { id: 't11', description: 'Manufacture 3 consecutive validation batches and collect all in-process data', owner: 'Vikram Patel', dueDate: '2026-04-10', status: 'Pending' },
      { id: 't12', description: 'Prepare process validation report and QA approval', owner: 'Dr. Priya Sharma', dueDate: '2026-04-14', status: 'Pending' },
    ],
    approvalStages: [
      { name: 'Initiator Submission', status: 'completed', approver: 'Vikram Patel', timestamp: '2026-03-26 10:00', comment: 'Submitted with DoE data package' },
      { name: 'QC Review', status: 'completed', approver: 'Rajesh Kumar', timestamp: '2026-03-27 11:30', comment: 'DoE data reviewed; granule characteristics improved at 180 RPM' },
      { name: 'QA Approval', status: 'completed', approver: 'Dr. Priya Sharma', timestamp: '2026-03-28 09:00', comment: 'Approved; process validation protocol to be submitted before commercial batches' },
      { name: 'Regulatory Affairs', status: 'completed', approver: 'Anita Desai', timestamp: '2026-03-28 14:00', comment: 'CBE-30 variation filing required; pre-approval implementation permitted' },
    ],
    validationResults: null,
    history: [
      { id: 'h6', timestamp: '2026-03-26T10:00:00Z', user: 'Vikram Patel', action: 'Created', details: 'Process parameter change request submitted with DoE data' },
      { id: 'h7', timestamp: '2026-03-28T14:00:00Z', user: 'Anita Desai', action: 'Approved', details: 'All approvals obtained; implementation started' },
    ],
    createdAt: '2026-03-26T10:00:00Z',
    updatedAt: '2026-03-29T15:00:00Z',
  },
  {
    id: 'cr4',
    crNumber: 'CR-2026-0009',
    title: 'Primary packaging change: PVC blister to PVC/PVDC for Omeprazole 20mg capsules',
    description: 'Change primary packaging material for Omeprazole 20mg Capsules from 250µm PVC blister foil to 250µm PVC/60gsm PVDC blister foil to provide enhanced moisture barrier protection. Change driven by stability data trending from 2025 annual stability review.',
    reasonForChange: 'Annual stability review 2025 identified moisture-related assay degradation (water content increase from 3.8% to 5.9% over 24 months in PVC blisters stored in high-humidity zones). PVC/PVDC foil provides MVTR of <0.5 g/m²/day vs PVC at 3.2 g/m²/day, expected to maintain product within specification for full 24-month shelf life in all ICH climatic zones.',
    changeType: 'Product',
    impactLevel: 'High',
    status: 'Approved',
    requestor: 'Dr. Priya Sharma',
    requestorId: 'u1',
    department: 'Quality Assurance',
    targetDate: '2026-07-31',
    impactAssessment: 'New packaging validation required: package integrity testing, moisture transmission testing, and packaging compatibility study. Regulatory variation filing (Type II) required. Stability data with PVC/PVDC packaging to be placed on study immediately. Blister machine tooling update required for new foil gauge (minor).',
    affectedDocuments: ['MFR-OMP-001 Rev 3 (Omeprazole Manufacturing Formula — Packaging section)', 'PAC-SPEC-OMP-001 (Packaging Specification)', 'STP-OMP-001 (QC Specification)', 'Stability protocol SS-OMP-001 (amendment required)'],
    affectedProcesses: ['Primary Packaging', 'QC Incoming Inspection (foil)', 'Stability Testing'],
    riskAssessment: 'Low process risk — well-established packaging material. High regulatory risk if variation not filed before commercial use. Mitigation: Obtain regulatory approval before first commercial batch with new packaging. Pilot packaging run with enhanced testing before validation batches.',
    regulatoryNotification: true,
    notifyDepartments: ['Quality Assurance', 'Quality Control', 'Production', 'Regulatory Affairs', 'Warehouse'],
    implementationTasks: [
      { id: 't13', description: 'Qualify PVC/PVDC foil from Uflex Ltd: incoming specification and test approval', owner: 'Rajesh Kumar', dueDate: '2026-05-15', status: 'Pending' },
      { id: 't14', description: 'Conduct packaging validation pilot run and physical integrity testing', owner: 'Vikram Patel', dueDate: '2026-06-15', status: 'Pending' },
      { id: 't15', description: 'Place stability batches in PVC/PVDC packaging on ICH study', owner: 'Rajesh Kumar', dueDate: '2026-06-30', status: 'Pending' },
      { id: 't16', description: 'Prepare and submit Type II regulatory variation dossier', owner: 'Anita Desai', dueDate: '2026-07-15', status: 'Pending' },
    ],
    approvalStages: [
      { name: 'Initiator Submission', status: 'completed', approver: 'Dr. Priya Sharma', timestamp: '2026-03-15 09:00', comment: 'Submitted with 2025 annual stability review data' },
      { name: 'QC Review', status: 'completed', approver: 'Rajesh Kumar', timestamp: '2026-03-17 14:00', comment: 'Stability trending data confirmed; PVDC specification reviewed' },
      { name: 'Regulatory Affairs Review', status: 'completed', approver: 'Anita Desai', timestamp: '2026-03-19 11:00', comment: 'Type II variation required; approved to proceed with packaging development' },
      { name: 'Management Approval', status: 'completed', approver: 'Plant Director', timestamp: '2026-03-20 10:00', comment: 'Approved; patient safety priority change' },
    ],
    validationResults: null,
    history: [
      { id: 'h8', timestamp: '2026-03-15T09:00:00Z', user: 'Dr. Priya Sharma', action: 'Created', details: 'Packaging change request submitted — stability data support' },
      { id: 'h9', timestamp: '2026-03-20T10:00:00Z', user: 'Plant Director', action: 'Approved', details: 'Management approval granted' },
    ],
    createdAt: '2026-03-15T09:00:00Z',
    updatedAt: '2026-03-20T10:00:00Z',
  },
  {
    id: 'cr5',
    crNumber: 'CR-2026-0008',
    title: 'Addition of new blister packaging line — Blister Pack Line 3 (Uhlmann UPS 4)',
    description: 'Install and qualify Uhlmann UPS 4 blister packaging line (Line 3) to increase primary packaging capacity by 40%. Current Line 1 and Line 2 are operating at 95% utilisation, creating a bottleneck for tablet and capsule products.',
    reasonForChange: 'Capacity analysis for FY2026 shows primary packaging as critical bottleneck. New contract with Sun Pharma (CR-2025-0028) and growth in Apollo and AIIMS volumes requires additional capacity. Uhlmann UPS 4 selected for compatibility with current PVC and PVC/PVDC foil materials and pharma-standard vision inspection system.',
    changeType: 'Process',
    impactLevel: 'Medium',
    status: 'Validated',
    requestor: 'Deepak Nair',
    requestorId: 'u6',
    department: 'Engineering',
    targetDate: '2026-03-31',
    impactAssessment: 'Installation qualification (IQ), operational qualification (OQ), and performance qualification (PQ) required per SOP-VAL-EQUIP-001. Operators require training. New equipment added to preventive maintenance schedule. Environmental monitoring programme update for cleanroom impact assessment.',
    affectedDocuments: ['INSP-PKG-001 (Packaging Inspection Checklist)', 'SOP-PKG-LINE3-001 (new: Line 3 Operating Procedure)', 'PM-SCHED-2026 (Preventive Maintenance Schedule)', 'EM-PLAN-2026 (Environmental Monitoring Plan)'],
    affectedProcesses: ['Primary Packaging', 'In-Process QC', 'Environmental Monitoring'],
    riskAssessment: 'Low risk. Standard equipment qualification process. Vendor (Uhlmann) provides IQ/OQ support. Mitigation: PQ with 3 consecutive batches each for tablet and capsule products before commercial use.',
    regulatoryNotification: false,
    notifyDepartments: ['Production', 'Quality Assurance', 'Engineering'],
    implementationTasks: [
      { id: 't17', description: 'Complete IQ (Installation Qualification) with Uhlmann engineer', owner: 'Deepak Nair', dueDate: '2026-03-05', status: 'Completed' },
      { id: 't18', description: 'Execute OQ (Operational Qualification) — all functional tests', owner: 'Deepak Nair', dueDate: '2026-03-15', status: 'Completed' },
      { id: 't19', description: 'Execute PQ (Performance Qualification) — 3 consecutive batches', owner: 'Vikram Patel', dueDate: '2026-03-25', status: 'Completed' },
      { id: 't20', description: 'Train packaging operators on Line 3 operation and line clearance SOP', owner: 'Vikram Patel', dueDate: '2026-03-28', status: 'Completed' },
    ],
    approvalStages: [
      { name: 'Initiator Submission', status: 'completed', approver: 'Deepak Nair', timestamp: '2026-02-01 08:00' },
      { name: 'QA Review', status: 'completed', approver: 'Dr. Priya Sharma', timestamp: '2026-02-03 10:30', comment: 'Qualification protocol approved' },
      { name: 'Management Approval', status: 'completed', approver: 'Plant Director', timestamp: '2026-02-05 09:00', comment: 'Capital expenditure approved' },
    ],
    validationResults: {
      validated: true,
      validatedBy: 'Dr. Priya Sharma',
      validationDate: '2026-03-29',
      effectivenessConfirmed: true,
      notes: 'PQ batches: 3 consecutive batches of Paracetamol 500mg (PCT-2026-020, 021, 022) and 3 of Metformin 500mg (MET-2026-015, 016, 017). All physical integrity tests, seal strength, and vision inspection results within specification. Leak test 100% pass. Line 3 released for commercial use.',
    },
    history: [
      { id: 'h10', timestamp: '2026-02-01T08:00:00Z', user: 'Deepak Nair', action: 'Created', details: 'Equipment qualification change request submitted' },
      { id: 'h11', timestamp: '2026-02-05T09:00:00Z', user: 'Plant Director', action: 'Approved', details: 'Approved for implementation' },
      { id: 'h12', timestamp: '2026-03-29T17:00:00Z', user: 'Dr. Priya Sharma', action: 'Validated', details: 'PQ completed; Line 3 released for commercial production' },
    ],
    createdAt: '2026-02-01T08:00:00Z',
    updatedAt: '2026-03-29T17:00:00Z',
  },
  {
    id: 'cr6',
    crNumber: 'CR-2026-0007',
    title: 'Rejected: API particle size specification tightening for Paracetamol 500mg — D90 reduction',
    description: 'Proposal to tighten API (Paracetamol) incoming particle size specification from D90 NMT 300µm to D90 NMT 200µm to improve content uniformity in tablet compression.',
    reasonForChange: 'Development data suggested tighter particle size could improve content uniformity RSD from 2.1% to below 1.5%. Proposed by QC following minor content uniformity trend observation in 2025 annual product review.',
    changeType: 'Product',
    impactLevel: 'High',
    status: 'Rejected',
    requestor: 'Rajesh Kumar',
    requestorId: 'u2',
    department: 'Quality Control',
    targetDate: '2026-03-28',
    impactAssessment: 'Tighter specification would require API re-milling at supplier (Divi\'s Laboratories Ltd) or procurement of pre-milled grade at significantly higher cost. Would affect existing API contracts. Current content uniformity is within specification (RSD 2.1% vs limit of NMT 6.0%).',
    affectedDocuments: ['STP-QC-API-PCT-001 (Paracetamol API Incoming Specification)'],
    affectedProcesses: ['Incoming Inspection', 'Procurement'],
    riskAssessment: 'High supply chain risk: sole supplier (Divi\'s Laboratories) cannot guarantee D90 NMT 200µm without additional milling. Alternative milled grades not available in sufficient volume. Current specification already meets regulatory requirements. Change not supported by regulatory necessity.',
    regulatoryNotification: true,
    notifyDepartments: ['Quality Control', 'Regulatory Affairs', 'Procurement'],
    implementationTasks: [],
    approvalStages: [
      { name: 'Initiator Submission', status: 'completed', approver: 'Rajesh Kumar', timestamp: '2026-03-10 09:00' },
      { name: 'QA Review', status: 'completed', approver: 'Dr. Priya Sharma', timestamp: '2026-03-12 11:00', comment: 'Current CU within spec; benefit does not justify supply chain risk' },
      { name: 'Regulatory Affairs Review', status: 'rejected', approver: 'Anita Desai', timestamp: '2026-03-13 14:00', comment: 'Rejected — tighter specification not supported by regulatory requirement or clinical data. Supplier cannot reliably meet D90 NMT 200µm. Recommend annual product review monitoring to be continued; revisit if CU trend deteriorates.' },
    ],
    validationResults: null,
    history: [
      { id: 'h13', timestamp: '2026-03-10T09:00:00Z', user: 'Rajesh Kumar', action: 'Created', details: 'Change request submitted for particle size specification tightening' },
      { id: 'h14', timestamp: '2026-03-13T14:00:00Z', user: 'Anita Desai', action: 'Rejected', details: 'Rejected — supply chain risk unacceptable; regulatory necessity not established' },
    ],
    createdAt: '2026-03-10T09:00:00Z',
    updatedAt: '2026-03-13T14:00:00Z',
  },
  // ── 2025 records ──
  {
    id: 'cr-2025-001',
    crNumber: 'CR-2025-0034',
    title: 'New stability protocol for accelerated storage conditions — ICH Q1A(R2) update',
    description: 'Revise stability protocols for all tablet and capsule products to comply with updated ICH Q1A(R2) guidance and include new intermediate condition (30°C/65%RH) for products intended for distribution in Zone III/IV countries. Protocols updated to include photo-stability (ICH Q1B) requirements for all uncoated products.',
    reasonForChange: 'Regulatory Affairs received guidance from CDSCO that all products with Zone III/IV market authorisations must include intermediate stability data per ICH Q1A(R2). Current protocols do not include 30°C/65%RH condition. New export markets (GCC, Sub-Saharan Africa) require updated stability data package.',
    changeType: 'Document',
    impactLevel: 'High',
    status: 'Closed',
    requestor: 'Anita Desai',
    requestorId: 'u3',
    department: 'Regulatory Affairs',
    targetDate: '2025-12-31',
    impactAssessment: 'All 6 product stability protocols require revision. Stability chambers at 30°C/65%RH capacity must be confirmed (Deepak Nair to assess). Additional 1,400 samples per year placed on new intermediate condition. Stability report templates updated. Regulatory submissions in 4 markets require updated stability data.',
    affectedDocuments: ['SS-PCT-001 (Paracetamol Stability Protocol)', 'SS-MET-001 (Metformin Stability Protocol)', 'SS-AMX-001 (Amoxicillin Stability Protocol)', 'SS-OND-001 (Ondansetron Stability Protocol)', 'SS-OMP-001 (Omeprazole Stability Protocol)', 'SS-CFT-001 (Ceftriaxone Stability Protocol)', 'SOP-QC-STAB-001 (Stability Testing Procedure)'],
    affectedProcesses: ['Stability Testing', 'Regulatory Submissions', 'Annual Product Review'],
    riskAssessment: 'Medium risk. Additional stability chamber capacity needed; if unavailable, testing will be outsourced. Regulatory risk if updated data not filed within committed timelines to CDSCO.',
    regulatoryNotification: true,
    notifyDepartments: ['Quality Control', 'Quality Assurance', 'Regulatory Affairs', 'Engineering'],
    implementationTasks: [
      { id: 't10', description: 'Revise all 6 stability protocols to include 30°C/65%RH and ICH Q1B conditions', owner: 'Rajesh Kumar', dueDate: '2025-10-15', status: 'Completed' },
      { id: 't11', description: 'Confirm 30°C/65%RH chamber capacity; procure additional chamber if required', owner: 'Deepak Nair', dueDate: '2025-10-30', status: 'Completed' },
      { id: 't12', description: 'Place all products on new intermediate stability conditions (Year 0 time point)', owner: 'Rajesh Kumar', dueDate: '2025-11-30', status: 'Completed' },
      { id: 't13', description: 'Update stability report templates and train QC analysts', owner: 'Rajesh Kumar', dueDate: '2025-12-15', status: 'Completed' },
    ],
    approvalStages: [
      { name: 'Initiator Submission', status: 'completed', approver: 'Anita Desai', timestamp: '2025-09-10 09:30', comment: 'Submitted with CDSCO guidance document reference' },
      { name: 'QC Head Review', status: 'completed', approver: 'Rajesh Kumar', timestamp: '2025-09-12 11:00', comment: 'Protocol revisions technically sound; chamber capacity confirmed' },
      { name: 'QA Approval', status: 'completed', approver: 'Dr. Priya Sharma', timestamp: '2025-09-14 14:00', comment: 'Approved; ICH Q1A(R2) compliance requirement acknowledged' },
      { name: 'Management Approval', status: 'completed', approver: 'Plant Director', timestamp: '2025-09-15 10:00', comment: 'Approved; export market expansion priority' },
    ],
    validationResults: {
      validated: true,
      validatedBy: 'Dr. Priya Sharma',
      validationDate: '2025-12-28',
      effectivenessConfirmed: true,
      notes: 'All 6 product stability protocols revised and approved. New 30°C/65%RH stability chamber (Binder KBF-720) installed and qualified. 1,392 samples placed on study. 3-month intermediate stability data reviewed — all within specifications. CDSCO variation filed for 2 products.',
    },
    history: [
      { id: 'h15', timestamp: '2025-09-10T09:30:00Z', user: 'Anita Desai', action: 'Created', details: 'Stability protocol revision change request submitted' },
      { id: 'h16', timestamp: '2025-09-15T10:00:00Z', user: 'Plant Director', action: 'Approved', details: 'All approvals obtained; implementation authorised' },
      { id: 'h17', timestamp: '2025-12-30T11:00:00Z', user: 'Dr. Priya Sharma', action: 'Closed', details: 'All protocols updated; samples on study; variation filed' },
    ],
    createdAt: '2025-09-10T09:30:00Z',
    updatedAt: '2025-12-30T11:00:00Z',
  },
  {
    id: 'cr-2025-002',
    crNumber: 'CR-2025-0018',
    title: 'Manufacturing site transfer of Ceftriaxone 1g Injection — sterile fill-finish to dedicated injectables suite',
    description: 'Transfer manufacturing of Ceftriaxone 1g Injection from shared multi-product fill-finish suite (Room 204) to dedicated beta-lactam injectables suite (Room 208) following facility upgrade. Includes full process validation at new location and regulatory site variation filing.',
    reasonForChange: 'Expanded facility provides dedicated beta-lactam injectables suite (Room 208) with independent HVAC, dedicated equipment, and enhanced containment. Move reduces cross-contamination risk and aligns with WHO-GMP expectations for beta-lactam antibiotics. Room 204 to be repurposed for non-antibiotic sterile products.',
    changeType: 'Process',
    impactLevel: 'High',
    status: 'Closed',
    requestor: 'Vikram Patel',
    requestorId: 'u4',
    department: 'Production',
    targetDate: '2025-06-30',
    impactAssessment: 'Full process re-validation required at new site (IQ/OQ/PQ of all new equipment). Media fill qualification required for aseptic fill line. Environmental monitoring qualification for new suite. Regulatory site variation required in all registered markets (CDSCO, WHO, GCC).',
    affectedDocuments: ['Site Master File', 'MFR-CFT-001 (Ceftriaxone Manufacturing Formula — location references)', 'VAL-PLAN-2025-001 (Validation Master Plan)', 'BMR-CFT-001 (Batch Manufacturing Record)'],
    affectedProcesses: ['Sterile Fill-Finish', 'Environmental Monitoring', 'In-Process QC', 'Process Validation'],
    riskAssessment: 'High regulatory and product quality risk. Mitigation: Full qualification and validation programme. Parallel run: last 2 batches in old suite, first 3 batches in new suite held pending regulatory variation approval. WHO-GMP consultant engaged for pre-inspection review.',
    regulatoryNotification: true,
    notifyDepartments: ['Production', 'Quality Assurance', 'Quality Control', 'Regulatory Affairs', 'Engineering'],
    implementationTasks: [
      { id: 't14', description: 'Complete IQ/OQ of all equipment in Room 208', owner: 'Deepak Nair', dueDate: '2025-03-31', status: 'Completed' },
      { id: 't15', description: 'Conduct environmental monitoring qualification and media fill', owner: 'Dr. Priya Sharma', dueDate: '2025-04-30', status: 'Completed' },
      { id: 't16', description: 'Manufacture PQ batches (3) and complete process validation report', owner: 'Vikram Patel', dueDate: '2025-05-31', status: 'Completed' },
      { id: 't17', description: 'File site variation in all registered markets', owner: 'Anita Desai', dueDate: '2025-06-15', status: 'Completed' },
    ],
    approvalStages: [
      { name: 'Initiator Submission', status: 'completed', approver: 'Vikram Patel', timestamp: '2025-01-10 09:30' },
      { name: 'Engineering Review', status: 'completed', approver: 'Deepak Nair', timestamp: '2025-01-14 11:00', comment: 'Room 208 engineering readiness confirmed' },
      { name: 'QA Review', status: 'completed', approver: 'Dr. Priya Sharma', timestamp: '2025-01-15 14:00', comment: 'Approved subject to full validation programme' },
      { name: 'Regulatory Affairs', status: 'completed', approver: 'Anita Desai', timestamp: '2025-01-16 10:00', comment: 'Site variation strategy confirmed; WHO pre-inspection arranged' },
      { name: 'Management Approval', status: 'completed', approver: 'Plant Director', timestamp: '2025-01-17 09:00', comment: 'Approved; strategic facility priority' },
    ],
    validationResults: {
      validated: true,
      validatedBy: 'Dr. Priya Sharma',
      validationDate: '2025-06-18',
      effectivenessConfirmed: true,
      notes: '3 consecutive PQ batches (CFT-2025-020, 021, 022) manufactured in Room 208. All sterility, endotoxin, particulate, and assay results within specification. Media fill: 0/6,600 units contaminated. WHO-GMP inspection (May 2025): no critical findings. Site variation approved CDSCO June 2025.',
    },
    history: [
      { id: 'h18', timestamp: '2025-01-10T09:30:00Z', user: 'Vikram Patel', action: 'Created', details: 'Site transfer change request submitted' },
      { id: 'h19', timestamp: '2025-01-17T09:00:00Z', user: 'Plant Director', action: 'Approved', details: 'All approvals obtained; site transfer programme initiated' },
      { id: 'h20', timestamp: '2025-06-20T11:00:00Z', user: 'Dr. Priya Sharma', action: 'Closed', details: 'Full transfer validated; regulatory variation approved; Room 208 fully operational' },
    ],
    createdAt: '2025-01-10T09:30:00Z',
    updatedAt: '2025-06-20T11:00:00Z',
  },
  // ── 2024 records ──
  {
    id: 'cr-2024-001',
    crNumber: 'CR-2024-0041',
    title: 'Amoxicillin API supplier change: Hikal Ltd qualification as alternate source',
    description: 'Qualify Hikal Ltd (Pune) as an approved alternate API supplier for Amoxicillin trihydrate alongside current sole-source supplier. Sole-source dependency identified as supply chain risk in 2023 risk assessment. Hikal Ltd has WHO-GMP certification and supplies Amoxicillin API to multiple Indian and export markets.',
    reasonForChange: 'Supply chain risk mitigation following 2023 risk assessment. Current sole-source API supplier had two delivery delays in 2023 (total 8 weeks unplanned lead time). WHO-GMP certificate confirmed for Hikal. Comparable quality specification confirmed from Hikal CoA and regulatory DMF review.',
    changeType: 'Product',
    impactLevel: 'High',
    status: 'Closed',
    requestor: 'Dr. Priya Sharma',
    requestorId: 'u1',
    department: 'Quality Assurance',
    targetDate: '2024-12-31',
    impactAssessment: 'Full supplier qualification audit required at Hikal Pune facility. Comparative analysis of Hikal API vs current supplier: specification equivalence, bioequivalence risk assessment, comparative dissolution of capsules manufactured with Hikal API. Regulatory variation (CBE-30) required for each registered market. Update to AVL and procurement approved vendor procedures.',
    affectedDocuments: ['AVL-2024 (Approved Vendor List)', 'STP-QC-API-AMX-001 (Amoxicillin API Incoming Specification)', 'MFR-AMX-001 (Amoxicillin 250mg Manufacturing Formula)', 'PUR-SPEC-AMX-001 (API Purchase Specification)'],
    affectedProcesses: ['API Incoming Inspection', 'Procurement', 'Capsule Manufacture', 'QC Release Testing'],
    riskAssessment: 'Medium risk. API particle size distribution and polymorphic form must be confirmed equivalent to avoid bio-inequivalence risk. Mitigation: Full comparative dissolution study (12 time points); Hikal API polymorphic form confirmed by XRPD before use.',
    regulatoryNotification: true,
    notifyDepartments: ['Quality Assurance', 'Quality Control', 'Regulatory Affairs', 'Production', 'Procurement'],
    implementationTasks: [
      { id: 't16', description: 'Conduct supplier qualification audit at Hikal Ltd, Pune', owner: 'Dr. Priya Sharma', dueDate: '2024-09-30', status: 'Completed' },
      { id: 't17', description: 'Complete comparative API characterisation (XRPD, PSD, moisture) vs current supplier', owner: 'Rajesh Kumar', dueDate: '2024-10-31', status: 'Completed' },
      { id: 't18', description: 'Manufacture 3 comparative capsule batches with Hikal API; comparative dissolution vs current supplier batches', owner: 'Vikram Patel', dueDate: '2024-11-30', status: 'Completed' },
      { id: 't19', description: 'File CBE-30 regulatory variations for all registered markets', owner: 'Anita Desai', dueDate: '2024-12-20', status: 'Completed' },
    ],
    approvalStages: [
      { name: 'Initiator Submission', status: 'completed', approver: 'Dr. Priya Sharma', timestamp: '2024-07-05 09:00', comment: 'Submitted with Hikal WHO-GMP certificate and sample CoA' },
      { name: 'QC Review', status: 'completed', approver: 'Rajesh Kumar', timestamp: '2024-07-08 14:00', comment: 'Specification equivalence confirmed from CoA review' },
      { name: 'Regulatory Affairs Review', status: 'completed', approver: 'Anita Desai', timestamp: '2024-07-10 10:00', comment: 'CBE-30 variation pathway confirmed; DMF available for Hikal' },
      { name: 'Management Approval', status: 'completed', approver: 'Plant Director', timestamp: '2024-07-12 09:00', comment: 'Approved; strategic supply chain risk mitigation priority' },
    ],
    validationResults: {
      validated: true,
      validatedBy: 'Dr. Priya Sharma',
      validationDate: '2024-12-10',
      effectivenessConfirmed: true,
      notes: 'Hikal audit score: 88/100. XRPD: polymorphic form confirmed equivalent. Comparative dissolution: f2 = 72 (acceptance criterion f2 ≥ 50 met). 3 comparative batches all released against specification. CBE-30 filed for 6 markets. Hikal Ltd added to AVL as approved alternate source.',
    },
    history: [
      { id: 'h20', timestamp: '2024-07-05T09:00:00Z', user: 'Dr. Priya Sharma', action: 'Created', details: 'API alternate supplier qualification request submitted' },
      { id: 'h21', timestamp: '2024-07-12T09:00:00Z', user: 'Plant Director', action: 'Approved', details: 'Qualification programme approved' },
      { id: 'h22', timestamp: '2024-12-12T15:00:00Z', user: 'Dr. Priya Sharma', action: 'Closed', details: 'Hikal fully qualified; regulatory variations filed; added to AVL' },
    ],
    createdAt: '2024-07-05T09:00:00Z',
    updatedAt: '2024-12-12T15:00:00Z',
  },
  {
    id: 'cr-2024-002',
    crNumber: 'CR-2024-0022',
    title: 'Document control system migration to electronic QMS (QuantumFlow DMS)',
    description: 'Migrate all controlled documents (SOPs, BMRs, STPs, work instructions, and forms) from paper-based and shared file-server system to QuantumFlow electronic document management module with full 21 CFR Part 11 compliant audit trail, e-signatures, and automated review reminders.',
    reasonForChange: 'WHO-GMP inspection in 2023 identified paper-based document control as an observation (corrective action required). 21 CFR Part 11 compliance is required for FDA-regulated export markets (US). Electronic DMS eliminates paper version control failures (3 instances of obsolete documents used in production in 2023). Aligns with ICH Q10 Pharmaceutical Quality System expectations.',
    changeType: 'System',
    impactLevel: 'High',
    status: 'Closed',
    requestor: 'Dr. Priya Sharma',
    requestorId: 'u1',
    department: 'Quality Assurance',
    targetDate: '2024-09-30',
    impactAssessment: 'All departments affected. 520+ controlled documents to migrate. 21 CFR Part 11 validation required for QuantumFlow DMS. All staff (92 users) require training on electronic system. Computer system validation (CSV) report required. Paper-based system decommissioned after 60-day parallel operation.',
    affectedDocuments: ['SOP-DCC-001 (Document Control Procedure)', 'QM-001 (Quality Manual)', 'All SOPs, BMRs, STPs, WIs, and Forms (520 documents)', 'CSV-QDM-001 (new: Computer System Validation Report)'],
    affectedProcesses: ['Document Control', 'Training', 'Change Control', 'All GMP Processes'],
    riskAssessment: 'High risk due to scope and regulatory requirement for 21 CFR Part 11 validation. Mitigation: CSV per GAMP 5 guidelines. Phased rollout by department. Parallel operation for 60 days. Rollback plan documented.',
    regulatoryNotification: false,
    notifyDepartments: ['All Departments'],
    implementationTasks: [
      { id: 't19', description: 'Complete 21 CFR Part 11 / GAMP 5 computer system validation (IQ/OQ/PQ)', owner: 'Deepak Nair', dueDate: '2024-06-30', status: 'Completed' },
      { id: 't20', description: 'Migrate all 520 controlled documents with metadata tagging and version history', owner: 'Dr. Priya Sharma', dueDate: '2024-08-15', status: 'Completed' },
      { id: 't21', description: 'Train all 92 system users; issue user access credentials per role matrix', owner: 'Sunita Rao', dueDate: '2024-09-01', status: 'Completed' },
      { id: 't22', description: 'Execute 60-day parallel operation; decommission paper system', owner: 'Dr. Priya Sharma', dueDate: '2024-09-30', status: 'Completed' },
    ],
    approvalStages: [
      { name: 'Initiator Submission', status: 'completed', approver: 'Dr. Priya Sharma', timestamp: '2024-03-10 09:00', comment: 'Submitted with WHO-GMP CAPA reference and 21 CFR Part 11 requirement' },
      { name: 'IT/Engineering Review', status: 'completed', approver: 'Deepak Nair', timestamp: '2024-03-12 14:00', comment: 'CSV scope and GAMP 5 category confirmed; infrastructure readiness confirmed' },
      { name: 'QA Review', status: 'completed', approver: 'Dr. Priya Sharma', timestamp: '2024-03-14 10:00', comment: 'CSV and migration plan approved' },
      { name: 'Management Approval', status: 'completed', approver: 'Plant Director', timestamp: '2024-03-15 09:00', comment: 'Approved; WHO-GMP CAPA priority; capital approved' },
    ],
    validationResults: {
      validated: true,
      validatedBy: 'Dr. Priya Sharma',
      validationDate: '2024-09-25',
      effectivenessConfirmed: true,
      notes: 'CSV completed per GAMP 5; 21 CFR Part 11 compliance confirmed. All 520 documents migrated. 92 users trained and access configured. 60-day parallel run completed with zero critical discrepancies. Paper system decommissioned 2024-09-25. WHO-GMP follow-up inspection (Oct 2024): document control observation closed.',
    },
    history: [
      { id: 'h23', timestamp: '2024-03-10T09:00:00Z', user: 'Dr. Priya Sharma', action: 'Created', details: 'System change request submitted' },
      { id: 'h24', timestamp: '2024-03-15T09:00:00Z', user: 'Plant Director', action: 'Approved', details: 'Management approval granted; WHO-GMP CAPA priority' },
      { id: 'h25', timestamp: '2024-09-30T16:00:00Z', user: 'Dr. Priya Sharma', action: 'Closed', details: 'QuantumFlow DMS fully operational; paper system decommissioned; WHO-GMP CAPA closed' },
    ],
    createdAt: '2024-03-10T09:00:00Z',
    updatedAt: '2024-09-30T16:00:00Z',
  },
];

// ── Hooks ───────────────────────────────────────────────────────────────────

interface CRFilters {
  status?: string;
  changeType?: string;
  impactLevel?: string;
  search?: string;
}

export function useChangeRequests(filters: CRFilters = {}) {
  return useQuery({
    queryKey: ['change-requests', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/change-requests', { params: filters });
        if (!Array.isArray(data?.data)) throw new Error('unexpected response');
        return data;
      } catch {
        let filtered = [...mockChangeRequests];
        if (filters.status) filtered = filtered.filter((cr) => cr.status === filters.status);
        if (filters.changeType) filtered = filtered.filter((cr) => cr.changeType === filters.changeType);
        if (filters.impactLevel) filtered = filtered.filter((cr) => cr.impactLevel === filters.impactLevel);
        if (filters.search) {
          const q = filters.search.toLowerCase();
          filtered = filtered.filter(
            (cr) =>
              cr.title.toLowerCase().includes(q) ||
              cr.crNumber.toLowerCase().includes(q),
          );
        }
        return { data: filtered, total: filtered.length, page: 1, pageSize: 20, totalPages: 1 };
      }
    },
    staleTime: 30_000,
  });
}

export function useChangeRequest(id: string) {
  return useQuery<ChangeRequest>({
    queryKey: ['change-requests', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/change-requests/${id}`);
        if (!data?.id) throw new Error('unexpected response');
        return data;
      } catch {
        const cr = mockChangeRequests.find((c) => c.id === id);
        if (!cr) throw new Error('Change request not found');
        return cr;
      }
    },
    enabled: !!id,
  });
}

export function useCreateChangeRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/qms/change-requests', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-requests'] });
      toast.success('Change request created successfully');
    },
    onError: () => {
      toast.error('Failed to create change request');
    },
  });
}
