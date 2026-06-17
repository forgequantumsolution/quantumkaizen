import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem, flattenUsers } from '@/lib/apiShape';
import { useUserIndustry, pickByIndustry } from '@/lib/userIndustry';
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

// Medical-device tenant (ISO 13485 / 21 CFR Part 820) — FQ MedTech, a
// diversified manufacturer spanning the full medical-device range: Class IIa
// disposables (syringes, hypodermic needles, IV cannulae, IV/infusion sets,
// Foley catheters, surgical drapes), Class IIb/III implants (heart valves,
// intraocular lenses, orthopaedic screws) and connected devices (smart
// infusion pumps). Records cover the failure modes each product family
// actually exhibits: EO sterility, particulate, biocompat, barrel/needle
// dimensional defects, UDI, sterile-barrier integrity, design-controls and
// software V&V breakdowns.
export const mockMedicalDeviceNCs: NonConformance[] = [
  {
    id: 'md-nc1', ncNumber: 'NC-MD-2026-0042', title: 'EO sterilization residuals exceed ISO 10993-7 limit — Infusion Set Lot ISET-26-0118',
    description: 'Ethylene oxide residual testing on infusion set lot ISET-26-0118 reported 14.2 mg/device EO and 9.8 mg/device ECH against ISO 10993-7 limits of 4 mg/device and 9 mg/device respectively. Two replicate GC-MS injections confirmed the result. Aeration cycle parameter deviation suspected.',
    type: 'OOS', severity: 'CRITICAL', status: 'OPEN',
    source: 'Final Inspection', department: 'Sterilization', departmentId: 'dept-md1',
    productProcess: 'EO Sterilization · Aeration', batchLot: 'ISET-26-0118',
    assignedTo: 'Karthik Iyer', assignedToId: 'u-md2', dueDate: '2026-04-12',
    priorityJustification: 'Lot on hold; distribution to Apollo and Fortis hospitals deferred. Patient exposure risk under 21 CFR 820.198.',
    containmentActions: [
      { id: 'md-ca1', description: 'Quarantine lot ISET-26-0118 in bonded sterile store', owner: 'Karthik Iyer', dueDate: '2026-03-30', status: 'COMPLETED' },
      { id: 'md-ca2', description: 'Halt EO sterilizer EOS-02 pending aeration cycle requalification', owner: 'Rohit Khanna',  dueDate: '2026-03-31', status: 'COMPLETED' },
    ],
    createdAt: '2026-03-29T10:00:00Z', updatedAt: '2026-03-31T12:00:00Z', closedAt: null, createdBy: 'Karthik Iyer',
  },
  {
    id: 'md-nc2', ncNumber: 'NC-MD-2026-0041', title: 'Sterility test failure (USP <71>) — Single-use surgical drape Lot SDR-26-0094',
    description: 'Sterility testing of surgical drape lot SDR-26-0094 by membrane filtration showed growth in 2 of 20 test units after 14 days incubation. Isolate identified as Bacillus circulans. Possible cleanroom HEPA breach during packaging.',
    type: 'PRODUCT_NC', severity: 'CRITICAL', status: 'INVESTIGATION',
    source: 'Final Inspection', department: 'Cleanroom Assembly', departmentId: 'dept-md2',
    productProcess: 'Class 7 Cleanroom Packaging', batchLot: 'SDR-26-0094',
    assignedTo: 'Dr. Anjali Verma', assignedToId: 'u-md1', dueDate: '2026-04-15',
    priorityJustification: 'Sterility critical — vigilance report to CDSCO under MDR 2017 may be required.',
    containmentActions: [
      { id: 'md-ca3', description: 'Reject and destroy lot SDR-26-0094 under dual control', owner: 'Dr. Anjali Verma', dueDate: '2026-03-28', status: 'COMPLETED' },
      { id: 'md-ca4', description: 'Initiate full cleanroom re-qualification (smoke study + viable air sampling)', owner: 'Neha Bansal', dueDate: '2026-04-05', status: 'IN_PROGRESS' },
    ],
    createdAt: '2026-03-26T09:30:00Z', updatedAt: '2026-03-30T15:00:00Z', closedAt: null, createdBy: 'Dr. Anjali Verma',
  },
  {
    id: 'md-nc3', ncNumber: 'NC-MD-2026-0040', title: 'UDI barcode unreadable on 312 vascular catheter cartons',
    description: 'During end-of-line UDI verification, 312 cartons of vascular catheters (VCT-26-0071) failed GS1 barcode scan with high reject rate (>4%). Root cause attributed to printer ribbon wear and incorrect label substrate.',
    type: 'PROCESS_NC', severity: 'MAJOR', status: 'ROOT_CAUSE',
    source: 'Internal Audit', department: 'Secondary Packaging', departmentId: 'dept-md3',
    productProcess: 'UDI Labelling · 21 CFR 830', batchLot: 'VCT-26-0071',
    assignedTo: 'Rohit Khanna', assignedToId: 'u-md4', dueDate: '2026-04-08',
    priorityJustification: 'Distribution blocked; UDI compliance breach is reportable under FDA UDI rule.',
    containmentActions: [
      { id: 'md-ca5', description: 'Halt packaging line PL-MD-01 and quarantine all affected cartons', owner: 'Rohit Khanna', dueDate: '2026-03-22', status: 'COMPLETED' },
      { id: 'md-ca6', description: '100% relabelling of cartons with new compliant labels', owner: 'Karthik Iyer', dueDate: '2026-04-02', status: 'IN_PROGRESS' },
    ],
    createdAt: '2026-03-22T08:00:00Z', updatedAt: '2026-03-28T11:30:00Z', closedAt: null, createdBy: 'Neha Bansal',
  },
  {
    id: 'md-nc4', ncNumber: 'NC-MD-2026-0039', title: 'Biocompatibility shift — cytotoxicity grade 3 on orthopaedic screw coating',
    description: 'ISO 10993-5 cytotoxicity testing of orthopaedic bone screw coating lot OBS-26-0048 returned MEM Elution grade 3 reactivity against the pass threshold of grade ≤2. Suspected supplier change in PLA coating resin.',
    type: 'OOS', severity: 'MAJOR', status: 'CAPA_PLANNING',
    source: 'Supplier Material Receipt', department: 'QC Lab', departmentId: 'dept-md4',
    productProcess: 'Biocompatibility (ISO 10993-5)', batchLot: 'OBS-26-0048',
    assignedTo: 'Sneha Kapoor', assignedToId: 'u-md5', dueDate: '2026-04-20',
    priorityJustification: 'Lot held. Supplier qualification review triggered for coating resin vendor.',
    containmentActions: [
      { id: 'md-ca7', description: 'Quarantine lot OBS-26-0048 and adjacent lots produced from same resin batch', owner: 'Sneha Kapoor', dueDate: '2026-03-20', status: 'COMPLETED' },
    ],
    createdAt: '2026-03-19T10:30:00Z', updatedAt: '2026-03-24T16:00:00Z', closedAt: null, createdBy: 'Sneha Kapoor',
  },
  {
    id: 'md-nc5', ncNumber: 'NC-MD-2026-0038', title: 'Visual inspection rejection — particulate matter on intraocular lens Lot IOL-26-0033',
    description: 'AOI rejected 24 IOLs from lot IOL-26-0033 due to detection of >50µm sub-visible particles. Manual re-inspection confirmed silicone fragments in 17 units. Root cause traced to tooling wear in injection moulding cavity 03.',
    type: 'PRODUCT_NC', severity: 'CRITICAL', status: 'CLOSED',
    source: 'Final Inspection', department: 'Cleanroom Assembly', departmentId: 'dept-md2',
    productProcess: 'Injection Moulding · Visual Inspection', batchLot: 'IOL-26-0033',
    assignedTo: 'Dr. Anjali Verma', assignedToId: 'u-md1', dueDate: '2026-03-22',
    priorityJustification: null,
    containmentActions: [
      { id: 'md-ca8', description: 'Reject and destroy all 24 flagged IOLs', owner: 'Dr. Anjali Verma', dueDate: '2026-03-15', status: 'COMPLETED' },
      { id: 'md-ca9', description: 'Replace cavity 03 tooling and revalidate (3 lot OQ)',     owner: 'Rohit Khanna',      dueDate: '2026-03-20', status: 'COMPLETED' },
    ],
    createdAt: '2026-03-10T09:00:00Z', updatedAt: '2026-03-22T11:00:00Z', closedAt: '2026-03-22T11:00:00Z', createdBy: 'Karthik Iyer',
  },
  {
    id: 'md-nc6', ncNumber: 'NC-MD-2025-0117', title: 'Software anomaly in infusion pump firmware v3.4 — over-delivery 4% above setpoint',
    description: 'Verification testing of infusion pump firmware v3.4 (IEC 62304 Class B) detected delivery rate 4.2% above setpoint at 1 mL/hr. Root cause: floating-point rounding in dosage calculation module. CAPA includes algorithm fix and full V&V re-run.',
    type: 'PRODUCT_NC', severity: 'MAJOR', status: 'CLOSED',
    source: 'Design Verification', department: 'Design Controls', departmentId: 'dept-md5',
    productProcess: 'Firmware V&V (IEC 62304)', batchLot: 'FW-v3.4',
    assignedTo: 'Aditya Menon', assignedToId: 'u-md6', dueDate: '2025-11-10',
    priorityJustification: null,
    containmentActions: [
      { id: 'md-ca10', description: 'Hold firmware v3.4 release; revert deployed dev units to v3.3', owner: 'Aditya Menon', dueDate: '2025-10-28', status: 'COMPLETED' },
    ],
    createdAt: '2025-10-25T11:00:00Z', updatedAt: '2025-11-10T14:00:00Z', closedAt: '2025-11-10T14:00:00Z', createdBy: 'Aditya Menon',
  },
  {
    id: 'md-nc7', ncNumber: 'NC-MD-2025-0098', title: 'Out-of-spec leak rate on heart valve packaging — Lot HV-25-0061',
    description: 'Bubble-emission leak testing per ASTM F2096 of heart valve sterile barrier pouches showed 3 of 50 units with detectable leaks. Sealing temperature drift on tray sealer TS-04 identified as root cause. CAPA-MD-2025-0058 raised.',
    type: 'PROCESS_NC', severity: 'CRITICAL', status: 'CLOSED',
    source: 'Final Inspection', department: 'Sterile Barrier Packaging', departmentId: 'dept-md3',
    productProcess: 'Heat Seal · ASTM F2096', batchLot: 'HV-25-0061',
    assignedTo: 'Neha Bansal', assignedToId: 'u-md3', dueDate: '2025-09-30',
    priorityJustification: null,
    containmentActions: [
      { id: 'md-ca11', description: 'Quarantine lot and adjacent lots, halt tray sealer TS-04', owner: 'Neha Bansal', dueDate: '2025-09-15', status: 'COMPLETED' },
    ],
    createdAt: '2025-09-12T08:30:00Z', updatedAt: '2025-09-30T16:00:00Z', closedAt: '2025-09-30T16:00:00Z', createdBy: 'Neha Bansal',
  },
  {
    id: 'md-nc8', ncNumber: 'NC-MD-2025-0064', title: 'Process-validation deviation — pulsed-light disinfection cycle below 6-log reduction',
    description: 'IQ/OQ/PQ revalidation of pulsed-light disinfection chamber PLD-01 showed bacterial log reduction of 5.4-log against the 6-log specification. Lamp degradation beyond expected service life identified as root cause.',
    type: 'PROCESS_NC', severity: 'MAJOR', status: 'CLOSED',
    source: 'Internal Audit', department: 'Sterilization', departmentId: 'dept-md1',
    productProcess: 'Pulsed-Light Disinfection · PQ', batchLot: null,
    assignedTo: 'Karthik Iyer', assignedToId: 'u-md2', dueDate: '2025-07-05',
    priorityJustification: null,
    containmentActions: [
      { id: 'md-ca12', description: 'Replace pulsed-light lamps and re-run full IQ/OQ/PQ',     owner: 'Karthik Iyer',      dueDate: '2025-06-25', status: 'COMPLETED' },
    ],
    createdAt: '2025-06-15T09:00:00Z', updatedAt: '2025-07-05T11:30:00Z', closedAt: '2025-07-05T11:30:00Z', createdBy: 'Karthik Iyer',
  },
  // ── Disposables product family ──────────────────────────────────────────
  {
    id: 'md-nc9', ncNumber: 'NC-MD-2026-0037', title: 'Sub-visible particles inside 5 mL Disposable Syringe barrels — Lot DSY-26-0204',
    description: 'AOI rejected 38 of 4 800 sampled units from 5 mL disposable-syringe lot DSY-26-0204 due to sub-visible particles (>25 µm) inside the polypropylene barrel. FTIR identified silicone-oil agglomerates from over-lubrication of the plunger.',
    type: 'PRODUCT_NC', severity: 'MAJOR', status: 'CAPA_PLANNING',
    source: 'Final Inspection', department: 'Cleanroom Assembly', departmentId: 'dept-md2',
    productProcess: 'Plunger Lubrication · USP <788>', batchLot: 'DSY-26-0204',
    assignedTo: 'Sneha Kapoor', assignedToId: 'u-md5', dueDate: '2026-04-22',
    priorityJustification: 'Particulate hazard for IV and IM injection; lot held pending CAPA effectiveness.',
    containmentActions: [
      { id: 'md-ca13', description: 'Quarantine lot DSY-26-0204 and adjacent lots produced on Line DSY-3 on the same day', owner: 'Sneha Kapoor', dueDate: '2026-04-02', status: 'COMPLETED' },
      { id: 'md-ca14', description: 'Recalibrate silicone-oil spray nozzle on Line DSY-3 to validated 0.5–1.0 mg per barrel', owner: 'Rohit Khanna',  dueDate: '2026-04-05', status: 'COMPLETED' },
    ],
    createdAt: '2026-04-01T10:30:00Z', updatedAt: '2026-04-05T15:00:00Z', closedAt: null, createdBy: 'Sneha Kapoor',
  },
  {
    id: 'md-nc10', ncNumber: 'NC-MD-2026-0036', title: 'Hypodermic needle pin-bend rate above 0.3% on 23G × 1" — Lot HYP-26-0312',
    description: 'In-process pin-bend inspection (ASTM F1816 / IS 10654) of 23G × 1" hypodermic needle lot HYP-26-0312 returned a defect rate of 0.42% against the validated process limit of NMT 0.30%. Cause traced to a worn cam follower on Needle Assembly Machine NAM-04.',
    type: 'PROCESS_NC', severity: 'MAJOR', status: 'ROOT_CAUSE',
    source: 'In-Process Inspection', department: 'Needle Manufacturing', departmentId: 'dept-md6',
    productProcess: 'Needle Hub Assembly · NAM-04', batchLot: 'HYP-26-0312',
    assignedTo: 'Rohit Khanna', assignedToId: 'u-md4', dueDate: '2026-04-12',
    priorityJustification: 'Pin bend during use can cause needle stick injury — patient safety hazard.',
    containmentActions: [
      { id: 'md-ca15', description: '100% visual + pin-bend re-inspection on quarantined lot HYP-26-0312', owner: 'Karthik Iyer', dueDate: '2026-03-28', status: 'COMPLETED' },
      { id: 'md-ca16', description: 'Stop NAM-04 and replace worn cam follower; verify CpK ≥ 1.67 on 3 OQ lots', owner: 'Rohit Khanna', dueDate: '2026-04-08', status: 'IN_PROGRESS' },
    ],
    createdAt: '2026-03-27T08:00:00Z', updatedAt: '2026-04-02T11:00:00Z', closedAt: null, createdBy: 'Rohit Khanna',
  },
  {
    id: 'md-nc11', ncNumber: 'NC-MD-2026-0035', title: 'IV cannula flow-rate below specification — 20G Lot IVC-26-0089',
    description: 'Gravity flow-rate testing per ISO 10555-5 on 20G IV cannula lot IVC-26-0089 measured 49 mL/min against the specification of NLT 55 mL/min. Mean of 20 samples 51.2 mL/min, 4 of 20 below spec. Suspected wall-thickness drift on extrusion line EX-02.',
    type: 'PRODUCT_NC', severity: 'MAJOR', status: 'INVESTIGATION',
    source: 'Final Inspection', department: 'Quality Control', departmentId: 'dept-md4',
    productProcess: 'Cannula Extrusion · ISO 10555-5', batchLot: 'IVC-26-0089',
    assignedTo: 'Sneha Kapoor', assignedToId: 'u-md5', dueDate: '2026-04-18',
    priorityJustification: 'Under-flow lengthens infusion time; clinically significant in emergency settings.',
    containmentActions: [
      { id: 'md-ca17', description: 'Quarantine lot IVC-26-0089 and pull retention samples for laser-micrometer wall analysis', owner: 'Sneha Kapoor', dueDate: '2026-04-04', status: 'COMPLETED' },
      { id: 'md-ca18', description: 'Re-zero EX-02 die-gap and run 3 validation lots',                                          owner: 'Rohit Khanna',  dueDate: '2026-04-15', status: 'IN_PROGRESS' },
    ],
    createdAt: '2026-04-03T09:00:00Z', updatedAt: '2026-04-06T16:30:00Z', closedAt: null, createdBy: 'Sneha Kapoor',
  },
  {
    id: 'md-nc12', ncNumber: 'NC-MD-2026-0034', title: 'Auto-disable mechanism failed to lock on 1 mL AD-syringe — Lot ADS-26-0048',
    description: 'Auto-disable function verification on 1 mL immunization AD-syringe lot ADS-26-0048 showed 3 of 200 sampled units where the plunger could be retracted after a single use, against the WHO PQS E13/IM01.3 specification. Lock-tab dimensional drift suspected.',
    type: 'PRODUCT_NC', severity: 'CRITICAL', status: 'CAPA_PLANNING',
    source: 'Final Inspection', department: 'Cleanroom Assembly', departmentId: 'dept-md2',
    productProcess: 'AD-Syringe Plunger Lock Assembly · WHO PQS E13', batchLot: 'ADS-26-0048',
    assignedTo: 'Dr. Anjali Verma', assignedToId: 'u-md1', dueDate: '2026-04-25',
    priorityJustification: 'WHO PQS critical defect — single-use AD function is a patient-safety design control. Lot tagged for immunization tender to UNICEF; release blocked.',
    containmentActions: [
      { id: 'md-ca19', description: 'Quarantine lot ADS-26-0048 and notify UNICEF supply chain', owner: 'Dr. Anjali Verma', dueDate: '2026-04-08', status: 'COMPLETED' },
      { id: 'md-ca20', description: 'Pull retention samples and run 100% AD-function verification per WHO PQS E13/IM01.3', owner: 'Karthik Iyer', dueDate: '2026-04-15', status: 'IN_PROGRESS' },
    ],
    createdAt: '2026-04-07T10:00:00Z', updatedAt: '2026-04-10T14:30:00Z', closedAt: null, createdBy: 'Dr. Anjali Verma',
  },
  {
    id: 'md-nc13', ncNumber: 'NC-MD-2026-0033', title: 'Foley catheter balloon burst-volume above limit — 18Fr Lot FCT-26-0067',
    description: 'Balloon burst-volume testing per ISO 20696 of 18Fr silicone Foley catheter lot FCT-26-0067 returned mean burst of 78 mL against the specification of NMT 50 mL (declared 10 mL balloon). Over-thinned balloon wall suspected from dip-moulding cycle drift on line FCT-MC-02.',
    type: 'PRODUCT_NC', severity: 'MAJOR', status: 'OPEN',
    source: 'Final Inspection', department: 'Quality Control', departmentId: 'dept-md4',
    productProcess: 'Silicone Dip Moulding · ISO 20696', batchLot: 'FCT-26-0067',
    assignedTo: 'Karthik Iyer', assignedToId: 'u-md2', dueDate: '2026-04-30',
    priorityJustification: 'Over-inflation risk in urology use can cause bladder trauma; recall already initiated for distributed cartons.',
    containmentActions: [
      { id: 'md-ca21', description: 'Initiate recall of lot FCT-26-0067 from 4 distributors; quarantine remaining stock', owner: 'Neha Bansal', dueDate: '2026-04-14', status: 'IN_PROGRESS' },
      { id: 'md-ca22', description: 'Halt dip-moulding line FCT-MC-02; recalibrate silicone bath temperature and dwell time', owner: 'Rohit Khanna', dueDate: '2026-04-12', status: 'COMPLETED' },
    ],
    createdAt: '2026-04-10T08:00:00Z', updatedAt: '2026-04-12T15:00:00Z', closedAt: null, createdBy: 'Karthik Iyer',
  },
];

// Dairy tenant — FSSAI / ISO 22000 / HACCP themed records covering the
// full Indian dairy product range: liquid milk (toned, full-cream, A2),
// curd / dahi, paneer, ghee, butter, buttermilk / lassi, flavoured milk,
// ice cream, sweets and dairy whitener. Failure modes include microbial
// limits (TPC, coliform, E. coli, Listeria), fat / SNF shortfall, aflatoxin
// M1, antibiotic residues, pasteurization deviations, cold-chain breaks
// and packaging seal defects.
export const mockDairyNCs: NonConformance[] = [
  {
    id: 'dy-nc1', ncNumber: 'NC-DY-2026-0042', title: 'Aflatoxin M1 in raw milk above FSSAI limit — Tanker T-2026-0512',
    description: 'Aflatoxin M1 testing by ELISA on raw-milk tanker T-2026-0512 reported 0.71 µg/kg against the FSSAI limit of NMT 0.5 µg/kg. Tanker sourced from 4 village collection centres in the Pune cluster. Suspected mycotoxin contamination in cattle feed.',
    type: 'OOS', severity: 'CRITICAL', status: 'OPEN',
    source: 'Raw Milk Receiving', department: 'Receiving Dock', departmentId: 'dept-dy1',
    productProcess: 'Raw-milk Acceptance · FSSAI 2.1.1', batchLot: 'T-2026-0512',
    assignedTo: 'Sandeep Joshi', assignedToId: 'u-dy1', dueDate: '2026-05-28',
    priorityJustification: 'Tanker on hold; entire 6 000 L volume cannot be released to processing. Risk of regulatory adverse action under FSSAI Schedule 4.',
    containmentActions: [
      { id: 'dy-ca1', description: 'Reject tanker T-2026-0512; divert to non-food disposal route under dual control', owner: 'Sandeep Joshi', dueDate: '2026-05-16', status: 'COMPLETED' },
      { id: 'dy-ca2', description: 'Notify 4 source collection centres; suspend procurement pending feed audit',       owner: 'Meera Pillai',  dueDate: '2026-05-18', status: 'IN_PROGRESS' },
    ],
    createdAt: '2026-05-15T09:00:00Z', updatedAt: '2026-05-16T15:30:00Z', closedAt: null, createdBy: 'Sandeep Joshi',
  },
  {
    id: 'dy-nc2', ncNumber: 'NC-DY-2026-0041', title: 'Total Plate Count above limit on pasteurized toned milk — Batch PTM-26-0431',
    description: 'Microbial testing of pasteurized toned-milk batch PTM-26-0431 (1 L pouches) returned TPC of 95 000 cfu/ml against the FSSAI limit of NMT 30 000 cfu/ml. Phosphatase test negative (under-pasteurization ruled out). Recontamination at filling-machine FM-02 suspected.',
    type: 'PRODUCT_NC', severity: 'CRITICAL', status: 'INVESTIGATION',
    source: 'Final Inspection', department: 'Microbiology Lab', departmentId: 'dept-dy4',
    productProcess: 'Pouch Filling · Post-pasteurization', batchLot: 'PTM-26-0431',
    assignedTo: 'Anita Kulkarni', assignedToId: 'u-dy3', dueDate: '2026-05-22',
    priorityJustification: 'Batch already distributed to 12 retail depots; recall initiation may be required. Risk under FSSAI 2.1.1 dairy microbio limits.',
    containmentActions: [
      { id: 'dy-ca3', description: 'Halt filling machine FM-02; quarantine all post-pasteurization stock from same shift',   owner: 'Ravi Deshmukh',   dueDate: '2026-05-12', status: 'COMPLETED' },
      { id: 'dy-ca4', description: 'Initiate recall of distributed batch PTM-26-0431 from 12 retail depots',                  owner: 'Sandeep Joshi',   dueDate: '2026-05-15', status: 'IN_PROGRESS' },
    ],
    createdAt: '2026-05-11T08:30:00Z', updatedAt: '2026-05-14T16:00:00Z', closedAt: null, createdBy: 'Anita Kulkarni',
  },
  {
    id: 'dy-nc3', ncNumber: 'NC-DY-2026-0040', title: 'Antibiotic residue (beta-lactam) detected in raw milk — Tanker T-2026-0498',
    description: 'Charm SL beta-lactam screening on raw-milk tanker T-2026-0498 returned positive on first and confirmatory tests. Source traced to a single supplier farm where a cow was under treatment with amoxicillin without observing the 96-hour withdrawal period.',
    type: 'OOS', severity: 'CRITICAL', status: 'ROOT_CAUSE',
    source: 'Raw Milk Receiving', department: 'Receiving Dock', departmentId: 'dept-dy1',
    productProcess: 'Antibiotic Residue Screening', batchLot: 'T-2026-0498',
    assignedTo: 'Sandeep Joshi', assignedToId: 'u-dy1', dueDate: '2026-05-18',
    priorityJustification: 'Antibiotic residue is a regulatory red flag under FSSAI 2.3.4 — recurrence triggers supplier de-listing.',
    containmentActions: [
      { id: 'dy-ca5', description: 'Reject tanker T-2026-0498; segregate at receiving bay until disposal authorised', owner: 'Sandeep Joshi', dueDate: '2026-05-08', status: 'COMPLETED' },
      { id: 'dy-ca6', description: 'Suspend procurement from the source farm for 14 days pending investigation',       owner: 'Meera Pillai',  dueDate: '2026-05-10', status: 'COMPLETED' },
    ],
    createdAt: '2026-05-07T07:30:00Z', updatedAt: '2026-05-10T11:00:00Z', closedAt: null, createdBy: 'Sandeep Joshi',
  },
  {
    id: 'dy-nc4', ncNumber: 'NC-DY-2026-0039', title: 'Fat content below FSSAI minimum on full-cream milk — Batch PFC-26-0218',
    description: 'Gerber fat testing on full-cream milk batch PFC-26-0218 returned 5.7% fat against FSSAI Standard 2.1.1 minimum of 6.0% fat. SNF within spec at 9.1%. Suspected standardisation error at the cream separator.',
    type: 'PRODUCT_NC', severity: 'MAJOR', status: 'CAPA_PLANNING',
    source: 'In-Process Inspection', department: 'Quality Control', departmentId: 'dept-dy5',
    productProcess: 'Standardisation · FSSAI 2.1.1', batchLot: 'PFC-26-0218',
    assignedTo: 'Anita Kulkarni', assignedToId: 'u-dy3', dueDate: '2026-05-25',
    priorityJustification: 'Mis-labelling risk; batch cannot be released as "full-cream" without recalibration. FSSAI label-claim deviation.',
    containmentActions: [
      { id: 'dy-ca7', description: 'Quarantine batch PFC-26-0218 in chilled holding tank; rework via fat-correction',  owner: 'Ravi Deshmukh', dueDate: '2026-05-06', status: 'COMPLETED' },
    ],
    createdAt: '2026-05-04T10:30:00Z', updatedAt: '2026-05-07T15:00:00Z', closedAt: null, createdBy: 'Anita Kulkarni',
  },
  {
    id: 'dy-nc5', ncNumber: 'NC-DY-2026-0038', title: 'Phosphatase test positive on pasteurized milk — under-pasteurization — Batch PTM-26-0413',
    description: 'Phosphatase test on pasteurized toned-milk batch PTM-26-0413 returned positive (>10 mg/L p-nitrophenol), indicating incomplete pasteurization. PHE-01 outlet thermometer was reading 71.5 °C instead of validated 72 °C for 15 s. Suspected drift on temperature controller.',
    type: 'PROCESS_NC', severity: 'CRITICAL', status: 'CLOSED',
    source: 'In-Process Inspection', department: 'Pasteurization', departmentId: 'dept-dy2',
    productProcess: 'HTST Pasteurization · 72 °C / 15 s', batchLot: 'PTM-26-0413',
    assignedTo: 'Ravi Deshmukh', assignedToId: 'u-dy4', dueDate: '2026-05-02',
    priorityJustification: null,
    containmentActions: [
      { id: 'dy-ca8', description: 'Re-pasteurize batch PTM-26-0413 through PHE-01 after temperature controller recalibration', owner: 'Ravi Deshmukh', dueDate: '2026-04-22', status: 'COMPLETED' },
      { id: 'dy-ca9', description: 'Halt PHE-01 production; recalibrate thermometer and temperature controller with NABL-traceable references', owner: 'Priya Khanna', dueDate: '2026-04-23', status: 'COMPLETED' },
    ],
    createdAt: '2026-04-18T11:15:00Z', updatedAt: '2026-05-02T11:00:00Z', closedAt: '2026-05-02T11:00:00Z', createdBy: 'Sandeep Joshi',
  },
  {
    id: 'dy-nc6', ncNumber: 'NC-DY-2026-0034', title: 'Coliform count positive on curd — Lot DAH-26-0167',
    description: 'Set curd lot DAH-26-0167 (200g cups) showed coliform count of 12 cfu/g against FSSAI limit of <10 cfu/g. Possible CIP-cleaning gap at fermentation tank FT-03 between batches.',
    type: 'PRODUCT_NC', severity: 'MAJOR', status: 'CLOSED',
    source: 'Final Inspection', department: 'Microbiology Lab', departmentId: 'dept-dy4',
    productProcess: 'Curd Fermentation · 42 °C / 6 h', batchLot: 'DAH-26-0167',
    assignedTo: 'Anita Kulkarni', assignedToId: 'u-dy3', dueDate: '2026-04-12',
    priorityJustification: null,
    containmentActions: [
      { id: 'dy-ca10', description: 'Reject lot DAH-26-0167 and divert to non-food disposal',                         owner: 'Anita Kulkarni', dueDate: '2026-04-05', status: 'COMPLETED' },
      { id: 'dy-ca11', description: 'Run intensive CIP cycle (90 °C / 30 min) on FT-03; ATP-swab verification',       owner: 'Priya Khanna',   dueDate: '2026-04-07', status: 'COMPLETED' },
    ],
    createdAt: '2026-04-02T09:30:00Z', updatedAt: '2026-04-10T16:00:00Z', closedAt: '2026-04-10T16:00:00Z', createdBy: 'Anita Kulkarni',
  },
  {
    id: 'dy-nc7', ncNumber: 'NC-DY-2026-0029', title: 'Ghee Free Fatty Acid (FFA) above limit — Batch GHC-26-0091',
    description: 'FFA analysis on cow-ghee batch GHC-26-0091 (1 L tins) returned 3.4% (as oleic acid) against the FSSAI / BIS IS 3508 limit of NMT 3.0%. Suspected over-aging of butter before clarification.',
    type: 'OOS', severity: 'MAJOR', status: 'CLOSED',
    source: 'Final Inspection', department: 'Quality Control', departmentId: 'dept-dy5',
    productProcess: 'Ghee Clarification · BIS IS 3508', batchLot: 'GHC-26-0091',
    assignedTo: 'Anita Kulkarni', assignedToId: 'u-dy3', dueDate: '2026-03-25',
    priorityJustification: null,
    containmentActions: [
      { id: 'dy-ca12', description: 'Quarantine batch GHC-26-0091 and adjacent tins from same boiling kettle',         owner: 'Ravi Deshmukh',  dueDate: '2026-03-18', status: 'COMPLETED' },
      { id: 'dy-ca13', description: 'Discard 60 kg of over-aged white butter; tighten butter-to-ghee turnaround to 48 h', owner: 'Ravi Deshmukh', dueDate: '2026-03-20', status: 'COMPLETED' },
    ],
    createdAt: '2026-03-15T08:00:00Z', updatedAt: '2026-03-25T14:30:00Z', closedAt: '2026-03-25T14:30:00Z', createdBy: 'Anita Kulkarni',
  },
  {
    id: 'dy-nc8', ncNumber: 'NC-DY-2026-0024', title: 'Pouch leakage rate 0.8% on 500ml toned-milk pouches — Line PL-04',
    description: 'Drop-test reject rate on 500 ml toned-milk pouches from filling line PL-04 measured 0.8% against the validated specification of NMT 0.3%. Heat-seal jaw wear on FFS-04 identified as root cause.',
    type: 'PROCESS_NC', severity: 'MAJOR', status: 'CLOSED',
    source: 'In-Process Inspection', department: 'Packaging', departmentId: 'dept-dy6',
    productProcess: 'Form-Fill-Seal · Drop Test', batchLot: 'PTM-26-0290',
    assignedTo: 'Priya Khanna', assignedToId: 'u-dy5', dueDate: '2026-02-28',
    priorityJustification: null,
    containmentActions: [
      { id: 'dy-ca14', description: 'Halt FFS-04; replace heat-seal jaw and re-validate seal strength', owner: 'Priya Khanna', dueDate: '2026-02-15', status: 'COMPLETED' },
    ],
    createdAt: '2026-02-12T10:00:00Z', updatedAt: '2026-02-28T11:00:00Z', closedAt: '2026-02-28T11:00:00Z', createdBy: 'Priya Khanna',
  },
  {
    id: 'dy-nc9', ncNumber: 'NC-DY-2025-0156', title: 'Cold-chain temperature excursion on milk delivery route DEL-N3',
    description: 'Refrigerated delivery van VAN-N3 on the Pune-Mumbai milk route logged 14 °C cargo-area temperature for 47 minutes against the validated cold-chain limit of NMT 8 °C. Suspected refrigeration unit failure during traffic stop.',
    type: 'PROCESS_NC', severity: 'MAJOR', status: 'CLOSED',
    source: 'Distribution Audit', department: 'Cold Chain', departmentId: 'dept-dy7',
    productProcess: 'Cold-chain Distribution', batchLot: 'PTM-25-0931',
    assignedTo: 'Ravi Deshmukh', assignedToId: 'u-dy4', dueDate: '2025-12-15',
    priorityJustification: null,
    containmentActions: [
      { id: 'dy-ca15', description: 'Quarantine all pouches delivered on VAN-N3 that day; re-test microbio at depots', owner: 'Anita Kulkarni', dueDate: '2025-12-05', status: 'COMPLETED' },
      { id: 'dy-ca16', description: 'Service refrigeration unit on VAN-N3; install IoT temperature logger',             owner: 'Priya Khanna',   dueDate: '2025-12-12', status: 'COMPLETED' },
    ],
    createdAt: '2025-12-02T09:30:00Z', updatedAt: '2025-12-15T16:30:00Z', closedAt: '2025-12-15T16:30:00Z', createdBy: 'Ravi Deshmukh',
  },
  {
    id: 'dy-nc10', ncNumber: 'NC-DY-2025-0118', title: 'MRP / Best-Before label print error on 1L full-cream milk pouches — Lot PFC-25-0612',
    description: 'Pre-shipment label inspection on lot PFC-25-0612 (full-cream 1L pouches) found best-before date printed as "DD-MM-2026" instead of "DD-MM-2025" on a sub-lot of ~3 200 pouches. Suspected operator entry error at FFS-02 when changing date setting.',
    type: 'PROCESS_NC', severity: 'MAJOR', status: 'CLOSED',
    source: 'Pre-shipment Inspection', department: 'Packaging', departmentId: 'dept-dy6',
    productProcess: 'Form-Fill-Seal · Date Printing', batchLot: 'PFC-25-0612',
    assignedTo: 'Priya Khanna', assignedToId: 'u-dy5', dueDate: '2025-09-22',
    priorityJustification: null,
    containmentActions: [
      { id: 'dy-ca17', description: 'Quarantine sub-lot of 3 200 pouches; over-print correct date or destroy', owner: 'Priya Khanna', dueDate: '2025-09-15', status: 'COMPLETED' },
    ],
    createdAt: '2025-09-12T08:00:00Z', updatedAt: '2025-09-22T16:00:00Z', closedAt: '2025-09-22T16:00:00Z', createdBy: 'Priya Khanna',
  },
];

// Biologics tenant — Mubadala Bio "DiabTec" (Abu Dhabi, UAE). Biologics
// drug-substance (10,000 L microbial fermentation) plus aseptic cartridge
// fill-finish of human insulin, insulin analogues (glargine, aspart, lispro,
// degludec) and GLP-1 (semaglutide, liraglutide) pen cartridges. Records are
// themed to EU GMP Annex 1/2, FDA 21 CFR 600s and ICH Q5/Q6B: visible
// particulates in cartridges, fill-weight OOS, sterility / bioburden
// excursions, endotoxin OOS, host cell protein / residual DNA above limit,
// A280 concentration deviation, container-closure integrity, 2-8 °C cold-chain
// excursion, Grade A/B environmental monitoring, bioreactor contamination,
// chromatography column performance drift and cartridge mislabelling.
export const mockBiologicsNCs: NonConformance[] = [
  {
    id: 'bio-nc1', ncNumber: 'NC-BIO-2026-0042', title: 'Visible particulates in semaglutide pen cartridges — Lot SEMA-26-0118',
    description: 'Manual 100% visual inspection of 1.5 mL semaglutide pen cartridge lot SEMA-26-0118 detected visible translucent particulates in 28 of 6,200 cartridges (0.45% vs. acceptable limit of 0.1%). FTIR identified the particulates as protein aggregate / silicone-oil agglomerates. Over-siliconisation of the glass barrel suspected.',
    type: 'PRODUCT_NC', severity: 'CRITICAL', status: 'OPEN',
    source: 'Final Inspection', department: 'Aseptic Fill-Finish', departmentId: 'dept-bio1',
    productProcess: 'Cartridge Visual Inspection · EU GMP Annex 1', batchLot: 'SEMA-26-0118',
    assignedTo: 'Dr. Layla Al-Mansoori', assignedToId: 'u-bio1', dueDate: '2026-04-12',
    priorityJustification: 'Parenteral particulate critical defect; lot on hold. Patient injection-site risk and reportable under FDA 21 CFR 600.14.',
    containmentActions: [
      { id: 'bio-ca1', description: 'Quarantine lot SEMA-26-0118 in 2-8 °C bonded store under dual control', owner: 'Dr. Layla Al-Mansoori', dueDate: '2026-03-30', status: 'COMPLETED' },
      { id: 'bio-ca2', description: 'Halt fill line FF-02 and requalify siliconisation nozzle to validated 0.4-0.8 mg per barrel', owner: 'Omar Al-Farsi', dueDate: '2026-03-31', status: 'COMPLETED' },
    ],
    createdAt: '2026-03-29T09:15:00Z', updatedAt: '2026-03-31T11:00:00Z', closedAt: null, createdBy: 'Dr. Layla Al-Mansoori',
  },
  {
    id: 'bio-nc2', ncNumber: 'NC-BIO-2026-0041', title: 'Sterility test failure (USP <71>) — insulin glargine cartridges Lot GLAR-26-0094',
    description: 'Sterility testing of insulin glargine 3 mL cartridge lot GLAR-26-0094 by membrane filtration showed turbidity in 2 of 20 test units after 14 days incubation. Isolate identified as Micrococcus luteus. Suspected Grade A first-air interruption during aseptic fill.',
    type: 'PRODUCT_NC', severity: 'CRITICAL', status: 'INVESTIGATION',
    source: 'Final Inspection', department: 'Microbiology/QC Lab', departmentId: 'dept-bio4',
    productProcess: 'Aseptic Cartridge Fill · USP <71>', batchLot: 'GLAR-26-0094',
    assignedTo: 'Fatima Al-Hashimi', assignedToId: 'u-bio3', dueDate: '2026-04-15',
    priorityJustification: 'Sterility critical; field-alert and potential recall under EU GMP Annex 1 and FDA 21 CFR 600s.',
    containmentActions: [
      { id: 'bio-ca3', description: 'Reject and quarantine lot GLAR-26-0094; impound retention samples', owner: 'Fatima Al-Hashimi', dueDate: '2026-03-28', status: 'COMPLETED' },
      { id: 'bio-ca4', description: 'Initiate Grade A/B re-qualification — smoke study + viable air sampling on fill line FF-01', owner: 'Aisha Khalid', dueDate: '2026-04-05', status: 'IN_PROGRESS' },
    ],
    createdAt: '2026-03-26T09:30:00Z', updatedAt: '2026-03-30T15:00:00Z', closedAt: null, createdBy: 'Fatima Al-Hashimi',
  },
  {
    id: 'bio-nc3', ncNumber: 'NC-BIO-2026-0040', title: 'Mislabelled cartridges — insulin aspart printed with lispro artwork — Lot ASP-26-0071',
    description: 'During end-of-line label verification, 360 pen cartridges of insulin aspart batch ASP-26-0071 were found bearing insulin lispro secondary-label artwork. Cause attributed to incomplete line clearance before product changeover on labelling line LB-03.',
    type: 'PROCESS_NC', severity: 'CRITICAL', status: 'ROOT_CAUSE',
    source: 'Internal Audit', department: 'Aseptic Fill-Finish', departmentId: 'dept-bio1',
    productProcess: 'Cartridge Labelling · EU GMP Annex 2', batchLot: 'ASP-26-0071',
    assignedTo: 'Omar Al-Farsi', assignedToId: 'u-bio2', dueDate: '2026-04-08',
    priorityJustification: 'Product mix-up is a critical GMP defect; wrong-analogue dosing is a patient-safety hazard. Reportable under FDA 21 CFR 600.14.',
    containmentActions: [
      { id: 'bio-ca5', description: 'Halt labelling line LB-03 and quarantine all cartons from the current run', owner: 'Omar Al-Farsi', dueDate: '2026-03-22', status: 'COMPLETED' },
      { id: 'bio-ca6', description: '100% reconciliation and re-labelling of lot ASP-26-0071 with correct artwork', owner: 'Yusuf Rahman', dueDate: '2026-04-02', status: 'IN_PROGRESS' },
    ],
    createdAt: '2026-03-22T08:00:00Z', updatedAt: '2026-03-28T11:30:00Z', closedAt: null, createdBy: 'Aisha Khalid',
  },
  {
    id: 'bio-nc4', ncNumber: 'NC-BIO-2026-0039', title: 'Host cell protein above limit on insulin drug substance — Lot DS-INS-26-0048',
    description: 'Host cell protein (HCP) ELISA on human insulin drug-substance lot DS-INS-26-0048 returned 142 ng/mg against the ICH Q6B specification of NMT 100 ng/mg. Suspected reduced clearance from a fouled anion-exchange polishing step.',
    type: 'OOS', severity: 'MAJOR', status: 'CAPA_PLANNING',
    source: 'In-Process Inspection', department: 'Downstream Purification', departmentId: 'dept-bio3',
    productProcess: 'Anion-Exchange Polishing · ICH Q6B', batchLot: 'DS-INS-26-0048',
    assignedTo: 'Yusuf Rahman', assignedToId: 'u-bio5', dueDate: '2026-04-20',
    priorityJustification: 'Drug substance held; impurity clearance impacts immunogenicity profile. Affects downstream fill-finish scheduling.',
    containmentActions: [
      { id: 'bio-ca7', description: 'Quarantine lot DS-INS-26-0048 and adjacent lots from the same purification campaign', owner: 'Yusuf Rahman', dueDate: '2026-03-20', status: 'COMPLETED' },
    ],
    createdAt: '2026-03-19T10:30:00Z', updatedAt: '2026-03-24T16:00:00Z', closedAt: null, createdBy: 'Yusuf Rahman',
  },
  {
    id: 'bio-nc5', ncNumber: 'NC-BIO-2026-0038', title: 'Endotoxin OOS on liraglutide drug substance — Lot DS-LIRA-26-0033',
    description: 'Bacterial endotoxin testing (kinetic chromogenic LAL, USP <85>) of liraglutide drug-substance lot DS-LIRA-26-0033 returned 0.18 EU/mg against the specification of NMT 0.10 EU/mg. Suspected biofilm in the purified-water feed to the final UF/DF skid.',
    type: 'OOS', severity: 'CRITICAL', status: 'CLOSED',
    source: 'Final Inspection', department: 'Microbiology/QC Lab', departmentId: 'dept-bio4',
    productProcess: 'Endotoxin (LAL) · USP <85>', batchLot: 'DS-LIRA-26-0033',
    assignedTo: 'Fatima Al-Hashimi', assignedToId: 'u-bio3', dueDate: '2026-03-22',
    priorityJustification: null,
    containmentActions: [
      { id: 'bio-ca8', description: 'Quarantine lot DS-LIRA-26-0033 and impound retention samples', owner: 'Fatima Al-Hashimi', dueDate: '2026-03-15', status: 'COMPLETED' },
      { id: 'bio-ca9', description: 'Hot-WFI sanitisation of UF/DF water feed loop and re-test endotoxin at outlet', owner: 'Khalid Nasser', dueDate: '2026-03-20', status: 'COMPLETED' },
    ],
    createdAt: '2026-03-10T09:00:00Z', updatedAt: '2026-03-22T11:00:00Z', closedAt: '2026-03-22T11:00:00Z', createdBy: 'Fatima Al-Hashimi',
  },
  {
    id: 'bio-nc6', ncNumber: 'NC-BIO-2026-0037', title: 'Fill-weight out of specification on insulin degludec cartridges — Lot DEG-26-0204',
    description: 'In-process check-weighing of insulin degludec 3 mL cartridge lot DEG-26-0204 showed mean fill weight of 3.18 g against the target of 3.00 g ± 0.05 g, with 9 of 200 sampled cartridges above the upper limit. Time-pressure filling pump drift on FF-03 suspected.',
    type: 'OOS', severity: 'MAJOR', status: 'CAPA_PLANNING',
    source: 'In-Process Inspection', department: 'Aseptic Fill-Finish', departmentId: 'dept-bio1',
    productProcess: 'Cartridge Fill · Check-Weigh', batchLot: 'DEG-26-0204',
    assignedTo: 'Aisha Khalid', assignedToId: 'u-bio4', dueDate: '2026-04-22',
    priorityJustification: 'Over-fill affects deliverable dose accuracy; lot held pending CAPA effectiveness on pump calibration.',
    containmentActions: [
      { id: 'bio-ca10', description: 'Quarantine lot DEG-26-0204 and adjacent lots filled on FF-03 in the same shift', owner: 'Aisha Khalid', dueDate: '2026-04-02', status: 'COMPLETED' },
      { id: 'bio-ca11', description: 'Recalibrate FF-03 time-pressure fill pump and verify fill-weight CpK ≥ 1.33 on 3 lots', owner: 'Omar Al-Farsi', dueDate: '2026-04-05', status: 'COMPLETED' },
    ],
    createdAt: '2026-04-01T10:30:00Z', updatedAt: '2026-04-05T15:00:00Z', closedAt: null, createdBy: 'Aisha Khalid',
  },
  {
    id: 'bio-nc7', ncNumber: 'NC-BIO-2026-0036', title: 'Container-closure integrity failure on insulin lispro cartridges — Lot LIS-26-0312',
    description: 'High-voltage leak detection (HVLD) container-closure integrity testing of insulin lispro cartridge lot LIS-26-0312 flagged 5 of 100 sampled cartridges with a defective crimp at the plunger / septum seal. Crimp-station jaw wear on capping unit CC-04 suspected.',
    type: 'PRODUCT_NC', severity: 'CRITICAL', status: 'INVESTIGATION',
    source: 'Final Inspection', department: 'Aseptic Fill-Finish', departmentId: 'dept-bio1',
    productProcess: 'Container-Closure Integrity · HVLD', batchLot: 'LIS-26-0312',
    assignedTo: 'Dr. Layla Al-Mansoori', assignedToId: 'u-bio1', dueDate: '2026-04-18',
    priorityJustification: 'CCI failure compromises sterility assurance and 2-8 °C shelf life; sterility risk under EU GMP Annex 1.',
    containmentActions: [
      { id: 'bio-ca12', description: 'Quarantine lot LIS-26-0312 and pull retention samples for 100% HVLD re-test', owner: 'Dr. Layla Al-Mansoori', dueDate: '2026-04-04', status: 'COMPLETED' },
      { id: 'bio-ca13', description: 'Halt capping unit CC-04; replace crimp jaws and re-validate residual seal force', owner: 'Omar Al-Farsi', dueDate: '2026-04-15', status: 'IN_PROGRESS' },
    ],
    createdAt: '2026-04-03T09:00:00Z', updatedAt: '2026-04-06T16:30:00Z', closedAt: null, createdBy: 'Dr. Layla Al-Mansoori',
  },
  {
    id: 'bio-nc8', ncNumber: 'NC-BIO-2026-0035', title: 'A280 concentration deviation on insulin glargine drug substance — Lot DS-GLAR-26-0089',
    description: 'UV A280 concentration measurement on insulin glargine drug-substance lot DS-GLAR-26-0089 returned 9.2 mg/mL against the target of 10.0 mg/mL ± 0.5 mg/mL. Under-concentration traced to a UF/DF diafiltration end-point drift on skid UFDF-02.',
    type: 'OOS', severity: 'MAJOR', status: 'OPEN',
    source: 'In-Process Inspection', department: 'Downstream Purification', departmentId: 'dept-bio3',
    productProcess: 'UF/DF Concentration · A280', batchLot: 'DS-GLAR-26-0089',
    assignedTo: 'Yusuf Rahman', assignedToId: 'u-bio5', dueDate: '2026-04-30',
    priorityJustification: 'Out-of-target concentration affects fill-finish dose formulation; lot held pending re-concentration assessment.',
    containmentActions: [
      { id: 'bio-ca14', description: 'Quarantine lot DS-GLAR-26-0089 and hold at 2-8 °C pending disposition', owner: 'Yusuf Rahman', dueDate: '2026-04-14', status: 'COMPLETED' },
      { id: 'bio-ca15', description: 'Re-zero UFDF-02 in-line A280 sensor and re-run diafiltration end-point on a validation lot', owner: 'Khalid Nasser', dueDate: '2026-04-22', status: 'IN_PROGRESS' },
    ],
    createdAt: '2026-04-10T08:00:00Z', updatedAt: '2026-04-12T15:00:00Z', closedAt: null, createdBy: 'Yusuf Rahman',
  },
  {
    id: 'bio-nc9', ncNumber: 'NC-BIO-2025-0117', title: 'Bioreactor contamination — 10,000 L insulin fermentation Batch FRM-25-0061',
    description: 'Online optical-density and pH drift during the 10,000 L microbial fermentation of human insulin batch FRM-25-0061 prompted sterility sampling, which confirmed contamination with Bacillus subtilis. Suspected failed sterile filter integrity on the air-sparge line.',
    type: 'PROCESS_NC', severity: 'CRITICAL', status: 'CLOSED',
    source: 'In-Process Inspection', department: 'Drug Substance', departmentId: 'dept-bio2',
    productProcess: '10,000 L Microbial Fermentation', batchLot: 'FRM-25-0061',
    assignedTo: 'Khalid Nasser', assignedToId: 'u-bio6', dueDate: '2025-11-10',
    priorityJustification: null,
    containmentActions: [
      { id: 'bio-ca16', description: 'Abort and discard fermentation batch FRM-25-0061; initiate full CIP/SIP of the bioreactor', owner: 'Khalid Nasser', dueDate: '2025-10-28', status: 'COMPLETED' },
    ],
    createdAt: '2025-10-25T11:00:00Z', updatedAt: '2025-11-10T14:00:00Z', closedAt: '2025-11-10T14:00:00Z', createdBy: 'Khalid Nasser',
  },
  {
    id: 'bio-nc10', ncNumber: 'NC-BIO-2025-0098', title: 'Residual host-cell DNA above limit on semaglutide drug substance — Lot DS-SEMA-25-0042',
    description: 'qPCR residual host-cell DNA testing of semaglutide drug-substance lot DS-SEMA-25-0042 returned 14 ng/dose against the ICH Q5/Q6B specification of NMT 10 ng/dose. Suspected breakthrough on the final size-exclusion chromatography polishing step.',
    type: 'OOS', severity: 'MAJOR', status: 'CLOSED',
    source: 'Final Inspection', department: 'Downstream Purification', departmentId: 'dept-bio3',
    productProcess: 'Residual DNA (qPCR) · ICH Q5', batchLot: 'DS-SEMA-25-0042',
    assignedTo: 'Yusuf Rahman', assignedToId: 'u-bio5', dueDate: '2025-09-30',
    priorityJustification: null,
    containmentActions: [
      { id: 'bio-ca17', description: 'Quarantine lot DS-SEMA-25-0042 and adjacent lots from the same SEC column cycle', owner: 'Yusuf Rahman', dueDate: '2025-09-15', status: 'COMPLETED' },
    ],
    createdAt: '2025-09-12T08:30:00Z', updatedAt: '2025-09-30T16:00:00Z', closedAt: '2025-09-30T16:00:00Z', createdBy: 'Yusuf Rahman',
  },
  {
    id: 'bio-nc11', ncNumber: 'NC-BIO-2025-0064', title: 'Grade A environmental monitoring excursion at fill point — Line FF-01',
    description: 'Active air sampling at the Grade A fill point of insulin aspart fill line FF-01 detected 2 CFU/m³ against the EU GMP Annex 1 limit of <1 CFU/m³. Organism identified as Staphylococcus hominis. Operator intervention during fill suspected.',
    type: 'PROCESS_NC', severity: 'MAJOR', status: 'CLOSED',
    source: 'In-Process Inspection', department: 'Microbiology/QC Lab', departmentId: 'dept-bio4',
    productProcess: 'Environmental Monitoring · EU GMP Annex 1', batchLot: null,
    assignedTo: 'Fatima Al-Hashimi', assignedToId: 'u-bio3', dueDate: '2025-07-05',
    priorityJustification: null,
    containmentActions: [
      { id: 'bio-ca18', description: 'Restrict interventions on FF-01 to essential personnel; quarantine concurrently filled cartridges', owner: 'Aisha Khalid', dueDate: '2025-06-25', status: 'COMPLETED' },
      { id: 'bio-ca19', description: 'Re-qualify Grade A zone (smoke study + repeat viable / non-viable monitoring)', owner: 'Fatima Al-Hashimi', dueDate: '2025-07-02', status: 'COMPLETED' },
    ],
    createdAt: '2025-06-15T09:00:00Z', updatedAt: '2025-07-05T11:30:00Z', closedAt: '2025-07-05T11:30:00Z', createdBy: 'Fatima Al-Hashimi',
  },
  {
    id: 'bio-nc12', ncNumber: 'NC-BIO-2025-0048', title: 'Cold-chain 2-8 °C excursion on insulin glargine cartridge shipment SHP-25-0931',
    description: 'Refrigerated shipment SHP-25-0931 of insulin glargine pen cartridges logged 11 °C cargo temperature for 38 minutes against the validated 2-8 °C cold-chain limit. Suspected refrigeration-unit failure during a customs hold at Abu Dhabi port.',
    type: 'PROCESS_NC', severity: 'MAJOR', status: 'CLOSED',
    source: 'Distribution Audit', department: 'QA', departmentId: 'dept-bio5',
    productProcess: 'Cold-Chain Distribution · 2-8 °C', batchLot: 'GLAR-25-0820',
    assignedTo: 'Omar Al-Farsi', assignedToId: 'u-bio2', dueDate: '2025-05-30',
    priorityJustification: null,
    containmentActions: [
      { id: 'bio-ca20', description: 'Quarantine shipment SHP-25-0931 at destination; evaluate stability impact via MKT calculation', owner: 'Omar Al-Farsi', dueDate: '2025-05-15', status: 'COMPLETED' },
      { id: 'bio-ca21', description: 'Service the reefer unit and add a redundant IoT temperature logger to the lane', owner: 'Khalid Nasser', dueDate: '2025-05-22', status: 'COMPLETED' },
    ],
    createdAt: '2025-05-14T11:00:00Z', updatedAt: '2025-05-30T16:30:00Z', closedAt: '2025-05-30T16:30:00Z', createdBy: 'Omar Al-Farsi',
  },
  {
    id: 'bio-nc13', ncNumber: 'NC-BIO-2025-0031', title: 'Chromatography column performance drift — Protein-A capture step DS-INS-25-0019',
    description: 'HETP and asymmetry trending on the cation-exchange capture column for human insulin drug substance (lot DS-INS-25-0019) showed HETP rising to 1.9x the validated baseline with peak tailing, indicating column-bed compaction. Reduced dynamic binding capacity and yield loss observed.',
    type: 'DEVIATION', severity: 'MAJOR', status: 'CLOSED',
    source: 'In-Process Inspection', department: 'Downstream Purification', departmentId: 'dept-bio3',
    productProcess: 'Capture Chromatography · HETP Trend', batchLot: 'DS-INS-25-0019',
    assignedTo: 'Yusuf Rahman', assignedToId: 'u-bio5', dueDate: '2025-03-25',
    priorityJustification: null,
    containmentActions: [
      { id: 'bio-ca22', description: 'Take the capture column out of service; repack the resin bed and re-run HETP / DBC qualification', owner: 'Yusuf Rahman', dueDate: '2025-03-18', status: 'COMPLETED' },
    ],
    createdAt: '2025-03-15T08:00:00Z', updatedAt: '2025-03-25T14:30:00Z', closedAt: '2025-03-25T14:30:00Z', createdBy: 'Yusuf Rahman',
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
  const industry = useUserIndustry();
  return useQuery<PaginatedResponse<NonConformance>>({
    queryKey: ['non-conformances', filters, industry ?? 'default'],
    queryFn: async () => {
      try {
        const { data: payload } = await api.get('/qms/non-conformances', { params: filters });
        return unwrapList<NonConformance>(payload, flattenNC as any);
      } catch {
        const baseList = pickByIndustry(industry, mockNCs, { medical_device: mockMedicalDeviceNCs, dairy: mockDairyNCs, biologics: mockBiologicsNCs });
        let filtered = [...baseList];
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
  const industry = useUserIndustry();
  return useQuery<NonConformance>({
    queryKey: ['non-conformances', id, industry ?? 'default'],
    queryFn: async () => {
      try {
        const { data: payload } = await api.get(`/qms/non-conformances/${id}`);
        return unwrapItem<NonConformance>(payload, flattenNC as any);
      } catch {
        const baseList = pickByIndustry(industry, mockNCs, { medical_device: mockMedicalDeviceNCs, dairy: mockDairyNCs, biologics: mockBiologicsNCs });
        const nc = baseList.find((n) => n.id === id);
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
