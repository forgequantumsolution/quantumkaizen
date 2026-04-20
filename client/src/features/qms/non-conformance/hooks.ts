import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem, flattenUsers } from '@/lib/apiShape';
import type { NonConformance, PaginatedResponse } from '@/types';
import toast from 'react-hot-toast';

// ── Mock data ────────────────────────────────────────────────────────────────

export const mockNCs: NonConformance[] = [
  // ── 2026 records ──
  {
    id: 'nc1', ncNumber: 'NC-2026-0042', title: 'HPLC assay OOS on Paracetamol 500mg batch B26-PA-0112',
    description: 'HPLC assay result for Paracetamol 500mg tablets batch B26-PA-0112 reported at 93.2% w/w against specification of 95.0–105.0% w/w. Two replicate injections confirmed the result. Investigation indicates possible reference standard degradation.',
    type: 'OOS', severity: 'CRITICAL', status: 'OPEN',
    source: 'In-Process Inspection', department: 'Quality Control', departmentId: 'dept2',
    productProcess: 'HPLC Assay', batchLot: 'B26-PA-0112',
    assignedTo: 'Rajesh Kumar', assignedToId: 'u2', dueDate: '2026-04-10',
    priorityJustification: 'Batch on hold; dispatch deadline April 12. Reference standard suspect — all concurrent testing paused.',
    containmentActions: [
      { id: 'ca1', description: 'Place batch B26-PA-0112 under quarantine in bonded store', owner: 'Rajesh Kumar', dueDate: '2026-03-30', status: 'COMPLETED' },
      { id: 'ca2', description: 'Suspend use of current reference standard lot RS-2026-004 pending verification', owner: 'Dr. Priya Sharma', dueDate: '2026-03-31', status: 'COMPLETED' },
    ],
    createdAt: '2026-03-30T09:15:00Z', updatedAt: '2026-03-31T11:00:00Z', closedAt: null, createdBy: 'Rajesh Kumar',
  },
  {
    id: 'nc2', ncNumber: 'NC-2026-0041', title: 'Microbial contamination excursion — Grade B aseptic fill area',
    description: 'Active air sampling during aseptic fill of Ondansetron 4mg/2ml injection batch B26-ON-0088 detected 5 CFU/m³ in Grade B area (limit: NMT 1 CFU/m³). Organism identified as Staphylococcus epidermidis. Gowning breach suspected.',
    type: 'PROCESS_NC', severity: 'CRITICAL', status: 'INVESTIGATION',
    source: 'In-Process Inspection', department: 'Quality Control', departmentId: 'dept2',
    productProcess: 'Aseptic Fill', batchLot: 'B26-ON-0088',
    assignedTo: 'Dr. Priya Sharma', assignedToId: 'u1', dueDate: '2026-04-12',
    priorityJustification: 'Sterility of batch B26-ON-0088 at risk. Regulatory notification may be required under Schedule M.',
    containmentActions: [
      { id: 'ca3', description: 'Halt aseptic filling operations and quarantine batch B26-ON-0088', owner: 'Vikram Patel', dueDate: '2026-03-28', status: 'COMPLETED' },
      { id: 'ca4', description: 'Initiate cleanroom decontamination — full fumigation with VHP', owner: 'Deepak Nair', dueDate: '2026-03-29', status: 'COMPLETED' },
    ],
    createdAt: '2026-03-28T10:30:00Z', updatedAt: '2026-03-30T14:00:00Z', closedAt: null, createdBy: 'Rajesh Kumar',
  },
  {
    id: 'nc3', ncNumber: 'NC-2026-0040', title: 'Label mix-up — wrong batch number printed on Metformin 500mg cartons',
    description: 'During packaging line clearance, 240 printed cartons for Metformin 500mg batch B26-MF-0074 were found bearing batch number B26-MF-0069 (a previously packed and released batch). Cause attributed to incomplete line clearance before batch changeover.',
    type: 'PROCESS_NC', severity: 'CRITICAL', status: 'ROOT_CAUSE',
    source: 'Internal Audit', department: 'Production', departmentId: 'dept3',
    productProcess: 'Secondary Packaging', batchLot: 'B26-MF-0074',
    assignedTo: 'Vikram Patel', assignedToId: 'u4', dueDate: '2026-04-05',
    priorityJustification: 'Label mix-up constitutes a potential GMP critical defect. Regulatory risk under 21 CFR Part 211.130.',
    containmentActions: [
      { id: 'ca5', description: 'Halt packaging line PL-03 and quarantine all cartons from current run', owner: 'Vikram Patel', dueDate: '2026-03-25', status: 'COMPLETED' },
      { id: 'ca6', description: 'Conduct 100% reconciliation of printed labels for batch B26-MF-0074', owner: 'Dr. Priya Sharma', dueDate: '2026-03-26', status: 'COMPLETED' },
    ],
    createdAt: '2026-03-25T14:00:00Z', updatedAt: '2026-03-28T09:00:00Z', closedAt: null, createdBy: 'Anita Desai',
  },
  {
    id: 'nc4', ncNumber: 'NC-2026-0039', title: 'Dissolution failure — Metformin 500mg tablets batch B26-MF-0071',
    description: 'Stage 1 dissolution testing of Metformin 500mg tablets batch B26-MF-0071 (USP Apparatus II, 900mL pH 6.8 phosphate buffer, 50 rpm) showed mean release of 68% at 45 minutes against Q-value of NLT 80%. Six out of six vessels failed.',
    type: 'OOS', severity: 'MAJOR', status: 'CAPA_PLANNING',
    source: 'Final Inspection', department: 'Quality Control', departmentId: 'dept2',
    productProcess: 'Dissolution Testing', batchLot: 'B26-MF-0071',
    assignedTo: 'Rajesh Kumar', assignedToId: 'u2', dueDate: '2026-04-18',
    priorityJustification: 'Batch cannot be released. Granulation process parameter deviation suspected.',
    containmentActions: [
      { id: 'ca7', description: 'Quarantine batch B26-MF-0071 and place reject label', owner: 'Rajesh Kumar', dueDate: '2026-03-22', status: 'COMPLETED' },
    ],
    createdAt: '2026-03-22T10:00:00Z', updatedAt: '2026-03-25T15:00:00Z', closedAt: null, createdBy: 'Rajesh Kumar',
  },
  {
    id: 'nc5', ncNumber: 'NC-2026-0038', title: 'Foreign particle detected in Ondansetron 4mg/2ml injection vials — visual inspection rejection',
    description: 'Automated visual inspection (Brevetti system) rejected 18 vials from batch B26-ON-0082 due to detection of glass particles. Manual re-inspection confirmed visible glass flakes in 12 vials. Root cause linked to vial washing equipment nozzle degradation.',
    type: 'PRODUCT_NC', severity: 'CRITICAL', status: 'CLOSED',
    source: 'Final Inspection', department: 'Quality Control', departmentId: 'dept2',
    productProcess: 'Visual Inspection', batchLot: 'B26-ON-0082',
    assignedTo: 'Dr. Priya Sharma', assignedToId: 'u1', dueDate: '2026-03-20',
    priorityJustification: null,
    containmentActions: [
      { id: 'ca8', description: 'Reject all 18 flagged vials and destroy under dual control', owner: 'Dr. Priya Sharma', dueDate: '2026-03-15', status: 'COMPLETED' },
      { id: 'ca9', description: 'Halt vial washer WM-02 and inspect nozzle integrity', owner: 'Deepak Nair', dueDate: '2026-03-16', status: 'COMPLETED' },
    ],
    createdAt: '2026-03-10T08:00:00Z', updatedAt: '2026-03-20T11:20:00Z', closedAt: '2026-03-20T11:20:00Z', createdBy: 'Rajesh Kumar',
  },
  {
    id: 'nc6', ncNumber: 'NC-2026-0037', title: 'Environmental monitoring excursion — particulate count exceeded in Grade B cleanroom',
    description: 'Non-viable particle count (≥0.5µm) in Grade B fill zone recorded at 3,820 particles/m³ during aseptic processing of Ceftriaxone 1g injection. Specification: NMT 3,520 particles/m³ at rest. Personnel movement during fill suspected as contributing factor.',
    type: 'PROCESS_NC', severity: 'MAJOR', status: 'CAPA_IMPLEMENTATION',
    source: 'In-Process Inspection', department: 'Quality Control', departmentId: 'dept2',
    productProcess: 'Environmental Monitoring', batchLot: 'B26-CE-0055',
    assignedTo: 'Rajesh Kumar', assignedToId: 'u2', dueDate: '2026-04-02',
    priorityJustification: 'Grade B classification integrity at risk. WHO GMP Annex 1 compliance requirement.',
    containmentActions: [
      { id: 'ca10', description: 'Suspend personnel entry to fill zone during active filling; restrict to essential personnel only', owner: 'Vikram Patel', dueDate: '2026-03-18', status: 'COMPLETED' },
      { id: 'ca11', description: 'Conduct repeat particle count under at-rest and in-operation conditions to re-qualify zone', owner: 'Rajesh Kumar', dueDate: '2026-03-20', status: 'COMPLETED' },
    ],
    createdAt: '2026-03-18T09:00:00Z', updatedAt: '2026-03-28T16:00:00Z', closedAt: null, createdBy: 'Rajesh Kumar',
  },
  {
    id: 'nc7', ncNumber: 'NC-2026-0036', title: 'Calibration deviation — analytical balance AB-07 used beyond calibration due date',
    description: 'Analytical balance AB-07 in QC laboratory was found in use with calibration expiry date of 2026-02-28. Balance was used for weighing API samples for assay testing from 01-Mar to 08-Mar 2026 (8 days out of calibration). Eight batches of test data potentially affected.',
    type: 'PROCESS_NC', severity: 'MAJOR', status: 'CLOSED',
    source: 'Internal Audit', department: 'Quality Control', departmentId: 'dept2',
    productProcess: 'Weighing / Calibration', batchLot: null,
    assignedTo: 'Rajesh Kumar', assignedToId: 'u2', dueDate: '2026-03-25',
    priorityJustification: 'All test data generated on AB-07 between 01-Mar and 08-Mar requires data integrity investigation and potential retesting.',
    containmentActions: [
      { id: 'ca12', description: 'Take AB-07 out of service immediately and affix OUT OF SERVICE label', owner: 'Rajesh Kumar', dueDate: '2026-03-09', status: 'COMPLETED' },
      { id: 'ca13', description: 'Identify and list all batches tested using AB-07 during calibration gap period', owner: 'Dr. Priya Sharma', dueDate: '2026-03-11', status: 'COMPLETED' },
    ],
    createdAt: '2026-03-09T09:00:00Z', updatedAt: '2026-03-25T14:00:00Z', closedAt: '2026-03-25T14:00:00Z', createdBy: 'Dr. Priya Sharma',
  },
  // ── 2025 records ──
  {
    id: 'nc8', ncNumber: 'NC-2025-0031', title: 'BMR deviation — wrong API quantity weighed for Amoxicillin 250mg capsule batch',
    description: 'During batch manufacturing record (BMR) review of Amoxicillin 250mg capsules batch B25-AM-0094, it was identified that operator weighed 25.5 kg of Amoxicillin trihydrate against the BMR-specified quantity of 25.0 kg (2% excess). Error detected at in-process check stage; product not yet manufactured.',
    type: 'DEVIATION', severity: 'MAJOR', status: 'CLOSED',
    source: 'In-Process Inspection', department: 'Production', departmentId: 'dept3',
    productProcess: 'Dispensing', batchLot: 'B25-AM-0094',
    assignedTo: 'Vikram Patel', assignedToId: 'u4', dueDate: '2025-11-10',
    priorityJustification: null,
    containmentActions: [
      { id: 'ca14', description: 'Halt dispensing operation; return excess API to dispensing room under dual control', owner: 'Vikram Patel', dueDate: '2025-10-28', status: 'COMPLETED' },
    ],
    createdAt: '2025-10-25T08:30:00Z', updatedAt: '2025-11-10T11:00:00Z', closedAt: '2025-11-10T11:00:00Z', createdBy: 'Dr. Priya Sharma',
  },
  {
    id: 'nc9', ncNumber: 'NC-2025-0028', title: 'Packaging material rejection — blister foil delamination in Omeprazole 20mg caps lot',
    description: 'Incoming inspection of aluminium blister foil lot PKG-2025-055 (supplier: Bilcare Ltd) revealed delamination of the heat-seal lacquer layer on 3 of 10 sample rolls. Delamination would result in inadequate sealing of Omeprazole 20mg capsule blisters, compromising moisture barrier.',
    type: 'PRODUCT_NC', severity: 'MAJOR', status: 'CLOSED',
    source: 'Incoming Inspection', department: 'Quality Control', departmentId: 'dept2',
    productProcess: 'Blister Packaging', batchLot: 'PKG-2025-055',
    assignedTo: 'Rajesh Kumar', assignedToId: 'u2', dueDate: '2025-09-20',
    priorityJustification: null,
    containmentActions: [
      { id: 'ca15', description: 'Reject lot PKG-2025-055 and place in quarantine pending return to supplier', owner: 'Rajesh Kumar', dueDate: '2025-09-12', status: 'COMPLETED' },
    ],
    createdAt: '2025-09-10T10:00:00Z', updatedAt: '2025-09-22T15:30:00Z', closedAt: '2025-09-22T15:30:00Z', createdBy: 'Deepak Nair',
  },
  {
    id: 'nc10', ncNumber: 'NC-2025-0022', title: 'Stability study OOS result — Ceftriaxone 1g injection assay at 18-month timepoint',
    description: 'Stability study sample for Ceftriaxone 1g injection (batch B24-CE-0011, 25°C/60%RH accelerated condition) at 18-month timepoint showed assay result of 89.5% w/w, below the specification limit of NLT 90.0% w/w. All earlier timepoints were within specification.',
    type: 'OOS', severity: 'CRITICAL', status: 'CLOSED',
    source: 'Internal Audit', department: 'Quality Assurance', departmentId: 'dept1',
    productProcess: 'Stability Testing', batchLot: 'B24-CE-0011',
    assignedTo: 'Dr. Priya Sharma', assignedToId: 'u1', dueDate: '2025-07-15',
    priorityJustification: 'Stability OOS may impact approved shelf life claim. Regulatory authority notification under ICH Q10 being evaluated.',
    containmentActions: [
      { id: 'ca16', description: 'Initiate accelerated OOS investigation per SOP-QC-018; retain all stability samples', owner: 'Rajesh Kumar', dueDate: '2025-07-05', status: 'COMPLETED' },
      { id: 'ca17', description: 'Evaluate impact on marketed batches within expiry — review recall risk', owner: 'Dr. Priya Sharma', dueDate: '2025-07-07', status: 'COMPLETED' },
    ],
    createdAt: '2025-07-02T09:00:00Z', updatedAt: '2025-07-18T14:00:00Z', closedAt: '2025-07-18T14:00:00Z', createdBy: 'Rajesh Kumar',
  },
  {
    id: 'nc11', ncNumber: 'NC-2025-0015', title: 'OOS microbiological count — purified water system outlet point WU-04',
    description: 'Routine microbiological testing of purified water (PW) outlet point WU-04 showed Total Viable Count (TVC) of 120 CFU/mL against alert limit of 50 CFU/mL and action limit of 100 CFU/mL. Organisms isolated: Pseudomonas putida. Sanitisation frequency of the loop may be inadequate.',
    type: 'OOS', severity: 'MAJOR', status: 'CLOSED',
    source: 'In-Process Inspection', department: 'Quality Control', departmentId: 'dept2',
    productProcess: 'Purified Water System', batchLot: null,
    assignedTo: 'Rajesh Kumar', assignedToId: 'u2', dueDate: '2025-05-30',
    priorityJustification: null,
    containmentActions: [
      { id: 'ca18', description: 'Suspend use of WU-04 for pharmaceutical manufacturing; reroute to non-product use', owner: 'Vikram Patel', dueDate: '2025-05-15', status: 'COMPLETED' },
      { id: 'ca19', description: 'Conduct emergency hot sanitisation of purified water loop', owner: 'Deepak Nair', dueDate: '2025-05-16', status: 'COMPLETED' },
    ],
    createdAt: '2025-05-14T11:00:00Z', updatedAt: '2025-06-02T09:00:00Z', closedAt: '2025-06-02T09:00:00Z', createdBy: 'Anita Desai',
  },
  {
    id: 'nc12', ncNumber: 'NC-2025-0008', title: 'Customer complaint — Omeprazole 20mg capsule: wrong strength labelled',
    description: 'Pharmacist reported that cartons from batch B24-OM-0033 (Omeprazole 20mg) were labelled as Omeprazole 40mg on the secondary carton. Investigation confirmed a label roll mix-up during packaging. 480 cartons affected; product already partially distributed.',
    type: 'COMPLAINT', severity: 'CRITICAL', status: 'CLOSED',
    source: 'Customer Complaint', department: 'Quality Assurance', departmentId: 'dept1',
    productProcess: 'Secondary Packaging', batchLot: 'B24-OM-0033',
    assignedTo: 'Dr. Priya Sharma', assignedToId: 'u1', dueDate: '2025-03-10',
    priorityJustification: 'Potential patient safety risk — wrong strength labelling. Voluntary market recall being evaluated. Regulatory notification mandatory.',
    containmentActions: [
      { id: 'ca20', description: 'Issue urgent field alert and initiate voluntary recall of batch B24-OM-0033', owner: 'Anita Desai', dueDate: '2025-03-05', status: 'COMPLETED' },
      { id: 'ca21', description: 'Quarantine all remaining stock of batch B24-OM-0033 in warehouse', owner: 'Dr. Priya Sharma', dueDate: '2025-03-03', status: 'COMPLETED' },
    ],
    createdAt: '2025-02-28T10:00:00Z', updatedAt: '2025-03-12T16:00:00Z', closedAt: '2025-03-12T16:00:00Z', createdBy: 'Rajesh Kumar',
  },
  // ── 2024 records ──
  {
    id: 'nc13', ncNumber: 'NC-2024-0045', title: 'Particulate matter failure — Ceftriaxone 1g injection visual inspection batch B24-CE-0022',
    description: 'Manual 100% visual inspection of Ceftriaxone 1g injection vials, batch B24-CE-0022, identified white particulate matter in 34 vials out of 5,000 inspected (0.68% reject rate vs. acceptable limit of 0.1%). Particles identified as rubber stopper fragments from the vial stopper punching operation.',
    type: 'PRODUCT_NC', severity: 'CRITICAL', status: 'CLOSED',
    source: 'Final Inspection', department: 'Quality Control', departmentId: 'dept2',
    productProcess: 'Visual Inspection', batchLot: 'B24-CE-0022',
    assignedTo: 'Dr. Priya Sharma', assignedToId: 'u1', dueDate: '2024-11-20',
    priorityJustification: 'Parenteral product particulate failure — immediate reject and investigation mandated under WHO GMP.',
    containmentActions: [
      { id: 'ca22', description: 'Reject batch B24-CE-0022 in full; quarantine under destruction pending investigation', owner: 'Dr. Priya Sharma', dueDate: '2024-11-10', status: 'COMPLETED' },
      { id: 'ca23', description: 'Halt stopper punching operation and inspect stopper insertion tooling', owner: 'Deepak Nair', dueDate: '2024-11-11', status: 'COMPLETED' },
    ],
    createdAt: '2024-11-05T14:00:00Z', updatedAt: '2024-11-22T10:00:00Z', closedAt: '2024-11-22T10:00:00Z', createdBy: 'Deepak Nair',
  },
  {
    id: 'nc14', ncNumber: 'NC-2024-0038', title: 'HPLC assay OOS — Paracetamol 500mg batch B24-PA-0088 (repeat failure)',
    description: 'Paracetamol 500mg tablets batch B24-PA-0088 HPLC assay Phase II result: 91.8% w/w (spec: 95.0–105.0%). This is the second batch in 60 days to show HPLC assay OOS. Phase I and Phase II investigations completed; root cause assigned to reference standard degradation due to improper cold-chain storage.',
    type: 'OOS', severity: 'MAJOR', status: 'CLOSED',
    source: 'In-Process Inspection', department: 'Quality Control', departmentId: 'dept2',
    productProcess: 'HPLC Assay', batchLot: 'B24-PA-0088',
    assignedTo: 'Rajesh Kumar', assignedToId: 'u2', dueDate: '2024-09-30',
    priorityJustification: null,
    containmentActions: [
      { id: 'ca24', description: 'Quarantine batch B24-PA-0088; retest with freshly prepared reference standard from alternative supplier', owner: 'Rajesh Kumar', dueDate: '2024-09-25', status: 'COMPLETED' },
    ],
    createdAt: '2024-09-18T09:30:00Z', updatedAt: '2024-10-02T11:00:00Z', closedAt: '2024-10-02T11:00:00Z', createdBy: 'Dr. Priya Sharma',
  },
  {
    id: 'nc15', ncNumber: 'NC-2024-0027', title: 'Gowning SOP deviation — operator entered Grade B area without completing full gowning sequence',
    description: 'CCTV review during aseptic process simulation (media fill) of Ondansetron injection revealed one operator entered Grade B area without completing hand sanitisation step (step 6 of 9 in gowning SOP-MA-012). Media fill batch placed on hold pending investigation.',
    type: 'PROCESS_NC', severity: 'MAJOR', status: 'CLOSED',
    source: 'Internal Audit', department: 'Production', departmentId: 'dept3',
    productProcess: 'Aseptic Gowning', batchLot: 'MF-2024-003',
    assignedTo: 'Vikram Patel', assignedToId: 'u4', dueDate: '2024-07-15',
    priorityJustification: null,
    containmentActions: [
      { id: 'ca25', description: 'Place media fill batch MF-2024-003 on hold; evaluate incubation results before disposition', owner: 'Dr. Priya Sharma', dueDate: '2024-07-08', status: 'COMPLETED' },
      { id: 'ca26', description: 'Conduct immediate refresher gowning training for all aseptic area personnel', owner: 'Sunita Rao', dueDate: '2024-07-10', status: 'COMPLETED' },
    ],
    createdAt: '2024-07-04T08:00:00Z', updatedAt: '2024-07-17T14:00:00Z', closedAt: '2024-07-17T14:00:00Z', createdBy: 'Rajesh Kumar',
  },
  {
    id: 'nc16', ncNumber: 'NC-2024-0014', title: 'Deviation in tablet hardness — Metformin 500mg batch B24-MF-0031 (compression stage)',
    description: 'In-process compression monitoring for Metformin 500mg tablets batch B24-MF-0031 showed tablet hardness dropping to 8 kP at the midpoint of compression (spec: 10–18 kP). Compression force settings drifted due to punch set wear. 150 kg of tablets (approx. 30% of batch) potentially affected.',
    type: 'OOS', severity: 'MINOR', status: 'CLOSED',
    source: 'In-Process Inspection', department: 'Production', departmentId: 'dept3',
    productProcess: 'Tablet Compression', batchLot: 'B24-MF-0031',
    assignedTo: 'Vikram Patel', assignedToId: 'u4', dueDate: '2024-04-20',
    priorityJustification: null,
    containmentActions: [
      { id: 'ca27', description: 'Segregate compressed tablets from affected period; re-inspect punch set and adjust compression force', owner: 'Vikram Patel', dueDate: '2024-04-15', status: 'COMPLETED' },
    ],
    createdAt: '2024-04-10T10:00:00Z', updatedAt: '2024-04-22T09:00:00Z', closedAt: '2024-04-22T09:00:00Z', createdBy: 'Anita Desai',
  },
  {
    id: 'nc17', ncNumber: 'NC-2024-0005', title: 'Incoming API rejection — Amoxicillin trihydrate lot API-2024-007 (particle size OOS)',
    description: 'Incoming quality control testing of Amoxicillin trihydrate (supplier: Aurobindo Pharma) lot API-2024-007 showed D90 particle size of 185 µm against specification of NMT 150 µm. Non-compliant particle size distribution may impact dissolution and blending uniformity in capsule formulation.',
    type: 'DEVIATION', severity: 'MAJOR', status: 'CLOSED',
    source: 'Incoming Inspection', department: 'Quality Assurance', departmentId: 'dept1',
    productProcess: 'API Receipt', batchLot: 'API-2024-007',
    assignedTo: 'Dr. Priya Sharma', assignedToId: 'u1', dueDate: '2024-02-15',
    priorityJustification: 'API used in sterile-grade formulation. Reject and return to supplier; qualification of alternative lot required before production restart.',
    containmentActions: [
      { id: 'ca28', description: 'Reject lot API-2024-007 and place in quarantine pending return to Aurobindo Pharma', owner: 'Dr. Priya Sharma', dueDate: '2024-02-08', status: 'COMPLETED' },
    ],
    createdAt: '2024-02-05T09:00:00Z', updatedAt: '2024-02-18T11:00:00Z', closedAt: '2024-02-18T11:00:00Z', createdBy: 'Rajesh Kumar',
  },
];

// ── Hooks ────────────────────────────────────────────────────────────────────

const flattenNC = (nc: Record<string, unknown>) =>
  flattenUsers(nc, ['assignedTo', 'reportedBy']);

interface NCFilters {
  status?: string;
  severity?: string;
  type?: string;
  department?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useNonConformances(filters: NCFilters = {}) {
  return useQuery<PaginatedResponse<NonConformance>>({
    queryKey: ['non-conformances', filters],
    queryFn: async () => {
      try {
        const { data: payload } = await api.get('/qms/non-conformances', { params: filters });
        return unwrapList<NonConformance>(payload, flattenNC as any);
      } catch {
        let filtered = [...mockNCs];
        if (filters.status) filtered = filtered.filter((nc) => nc.status === filters.status);
        if (filters.severity) filtered = filtered.filter((nc) => nc.severity === filters.severity);
        if (filters.type) filtered = filtered.filter((nc) => nc.type === filters.type);
        if (filters.department) filtered = filtered.filter((nc) => nc.department === filters.department);
        if (filters.search) {
          const q = filters.search.toLowerCase();
          filtered = filtered.filter(
            (nc) =>
              nc.title.toLowerCase().includes(q) ||
              nc.ncNumber.toLowerCase().includes(q),
          );
        }
        return { data: filtered, total: filtered.length, page: 1, pageSize: 20, totalPages: 1 };
      }
    },
    staleTime: 30_000,
  });
}

export function useNonConformance(id: string) {
  return useQuery<NonConformance>({
    queryKey: ['non-conformances', id],
    queryFn: async () => {
      try {
        const { data: payload } = await api.get(`/qms/non-conformances/${id}`);
        return unwrapItem<NonConformance>(payload, flattenNC as any);
      } catch {
        const nc = mockNCs.find((n) => n.id === id);
        if (!nc) throw new Error('NC not found');
        return nc;
      }
    },
    enabled: !!id,
  });
}

export function useCreateNC() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/qms/non-conformances', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-conformances'] });
      toast.success('Non-conformance reported successfully');
    },
    onError: () => {
      toast.error('Failed to report non-conformance');
    },
  });
}

export function useUpdateNCStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      try {
        const { data } = await api.patch(`/qms/non-conformances/${id}/status`, { status });
        return data;
      } catch {
        return { id, status }; // mock success
      }
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['non-conformances', id] });
      qc.invalidateQueries({ queryKey: ['non-conformances'] });
    },
  });
}
