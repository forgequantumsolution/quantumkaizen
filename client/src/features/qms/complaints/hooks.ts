import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem, flattenUsers } from '@/lib/apiShape';
import toast from 'react-hot-toast';

const flattenComplaint = (c: Record<string, unknown>) => flattenUsers(c, ['assignedTo', 'investigator']);

// ── Types ───────────────────────────────────────────────────────────────────

export interface Complaint {
  id: string;
  complaintNumber: string;
  customerName: string;
  customerContact: string;
  customerEmail: string;
  subject: string;
  description: string;
  severity: 'Critical' | 'Major' | 'Minor';
  status: 'Received' | 'Acknowledged' | 'Under Investigation' | 'Resolution Proposed' | 'Closed';
  productService: string;
  batchOrderRef: string;
  receivedDate: string;
  responseDue: string;
  assignedTo: string;
  assignedToId: string;
  containmentActions: ContainmentAction[];
  investigation: Investigation | null;
  resolution: Resolution | null;
  communications: Communication[];
  linkedCAPAs: LinkedCAPA[];
  history: ComplaintHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ContainmentAction {
  id: string;
  description: string;
  owner: string;
  dueDate: string;
  status: 'Pending' | 'In Progress' | 'Completed';
}

export interface Investigation {
  rootCause: string;
  methodology: string;
  fiveWhys: FiveWhyEntry[];
  findings: string;
  investigatedBy: string;
  completedDate: string;
}

export interface FiveWhyEntry {
  whyNumber: number;
  question: string;
  answer: string;
}

export interface Resolution {
  proposedResolution: string;
  customerAccepted: boolean | null;
  acceptedDate: string | null;
  resolutionDetails: string;
  compensationOffered: string;
  resolvedBy: string;
}

export interface Communication {
  id: string;
  date: string;
  type: 'Email' | 'Phone' | 'Meeting' | 'Letter';
  direction: 'Inbound' | 'Outbound';
  summary: string;
  contactPerson: string;
  user: string;
}

export interface LinkedCAPA {
  id: string;
  capaNumber: string;
  title: string;
  status: string;
  type: 'CORRECTIVE' | 'PREVENTIVE';
}

export interface ComplaintHistoryEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

export const mockComplaints: Complaint[] = [
  // ── 2026 records ──
  {
    id: 'cmp1',
    complaintNumber: 'CMP-2026-0018',
    customerName: 'Apollo Hospitals Ltd',
    customerContact: 'Dr. Suresh Reddy',
    customerEmail: 's.reddy@apollohospitals.com',
    subject: 'Injectable vials with visible particulate matter — Ondansetron 4mg/2ml',
    description: 'Clinical pharmacist at Apollo Hospitals Chennai reported visible white particles in 6 vials of Ondansetron 4mg/2ml (Batch OND-2026-034) received in the latest consignment. Particles observed under fluorescent light during pre-administration inspection. Vials immediately quarantined. This is a critical patient safety complaint.',
    severity: 'Critical',
    status: 'Under Investigation',
    productService: 'Ondansetron 4mg/2ml Injection',
    batchOrderRef: 'PO-2026-APL-112 / OND-2026-034',
    receivedDate: '2026-03-22',
    responseDue: '2026-03-29',
    assignedTo: 'Dr. Priya Sharma',
    assignedToId: 'u1',
    containmentActions: [
      { id: 'ca1', description: 'Issue immediate field alert and quarantine all remaining units of batch OND-2026-034 at all customer sites', owner: 'Dr. Priya Sharma', dueDate: '2026-03-23', status: 'Completed' },
      { id: 'ca2', description: 'Quarantine retained samples and reserve batch from warehouse; initiate retained sample inspection', owner: 'Rajesh Kumar', dueDate: '2026-03-23', status: 'Completed' },
      { id: 'ca3', description: 'Notify Regulatory Affairs for potential voluntary recall assessment', owner: 'Anita Desai', dueDate: '2026-03-24', status: 'In Progress' },
    ],
    investigation: {
      rootCause: 'Particulate matter identified as glass delamination fragments from primary borosilicate glass vials supplied by Schott AG (lot SGL-2026-009). Elevated autoclave temperature (125°C vs validated 121°C) during terminal sterilisation triggered delamination of inner glass surface.',
      methodology: '5-Whys Analysis',
      fiveWhys: [
        { whyNumber: 1, question: 'Why were visible particles present in the Ondansetron vials?', answer: 'Glass delamination fragments from the inner vial surface were present in the solution.' },
        { whyNumber: 2, question: 'Why did glass delamination occur?', answer: 'Autoclave temperature exceeded validated maximum (125°C vs 121°C) during terminal sterilisation of batch OND-2026-034.' },
        { whyNumber: 3, question: 'Why did autoclave temperature exceed the validated limit?', answer: 'Autoclave temperature probe TC-02 was out of calibration — reading 4°C below actual temperature, causing controller to overshoot.' },
        { whyNumber: 4, question: 'Why was TC-02 out of calibration at time of sterilisation?', answer: 'Calibration was overdue by 18 days; the calibration management system did not generate a blocking alert before equipment use.' },
        { whyNumber: 5, question: 'Why did the calibration management system not block use of the overdue equipment?', answer: 'Equipment blocking feature was not enabled for autoclaves in the CMMS configuration.' },
      ],
      findings: 'Root cause confirmed as autoclave over-temperature due to out-of-calibration temperature probe. CMMS equipment blocking was not configured for sterilisation-critical equipment, allowing use beyond calibration due date.',
      investigatedBy: 'Rajesh Kumar',
      completedDate: '2026-03-28',
    },
    resolution: {
      proposedResolution: 'Initiate voluntary recall of batch OND-2026-034. Replace all units at no charge with conforming batch OND-2026-038. Recalibrate all autoclave probes. Enable CMMS equipment blocking for all sterilisation-critical instruments.',
      customerAccepted: null,
      acceptedDate: null,
      resolutionDetails: '',
      compensationOffered: 'Full replacement of affected units; priority delivery of replacement batch',
      resolvedBy: 'Dr. Priya Sharma',
    },
    communications: [
      { id: 'com1', date: '2026-03-22', type: 'Phone', direction: 'Inbound', summary: 'Urgent call from Apollo Hospitals clinical pharmacist reporting visible particles in injectable vials. Photos shared via email.', contactPerson: 'Dr. Suresh Reddy', user: 'Dr. Priya Sharma' },
      { id: 'com2', date: '2026-03-22', type: 'Email', direction: 'Outbound', summary: 'Acknowledged complaint. Issued field quarantine instruction for batch OND-2026-034. Committed to investigation and replacement.', contactPerson: 'Dr. Suresh Reddy', user: 'Dr. Priya Sharma' },
      { id: 'com3', date: '2026-03-25', type: 'Meeting', direction: 'Outbound', summary: 'Video call with Apollo QA and procurement teams to present interim investigation findings and recall assessment timeline.', contactPerson: 'Dr. Suresh Reddy', user: 'Dr. Priya Sharma' },
    ],
    linkedCAPAs: [
      { id: 'capa1', capaNumber: 'CAPA-2026-0022', title: 'Enable CMMS equipment blocking for sterilisation-critical instruments', status: 'OPEN', type: 'CORRECTIVE' },
      { id: 'capa2', capaNumber: 'CAPA-2026-0023', title: 'Autoclave calibration frequency review and alert system enhancement', status: 'OPEN', type: 'PREVENTIVE' },
    ],
    history: [
      { id: 'h1', timestamp: '2026-03-22T10:00:00Z', user: 'Dr. Priya Sharma', action: 'Complaint Logged', details: 'Critical patient safety complaint received from Apollo Hospitals' },
      { id: 'h2', timestamp: '2026-03-22T11:30:00Z', user: 'Dr. Priya Sharma', action: 'Acknowledged', details: 'Field quarantine instruction issued within 2 hours of receipt' },
      { id: 'h3', timestamp: '2026-03-23T09:00:00Z', user: 'Rajesh Kumar', action: 'Investigation Started', details: 'Root cause investigation initiated; retained samples pulled' },
    ],
    createdAt: '2026-03-22T10:00:00Z',
    updatedAt: '2026-03-28T16:00:00Z',
  },
  {
    id: 'cmp2',
    complaintNumber: 'CMP-2026-0017',
    customerName: 'Cipla Ltd',
    customerContact: 'Ramesh Agarwal',
    customerEmail: 'r.agarwal@cipla.com',
    subject: 'Wrong label language on Amoxicillin 250mg capsules export consignment — Arabic text missing',
    description: 'Cipla Ltd (export distributor) received consignment of Amoxicillin 250mg Capsules (Batch AMX-2026-019) intended for GCC markets. Outer carton and blister labels are in English only; Arabic language text required per GCC regulatory requirement is absent. Entire consignment of 50,000 packs is on hold at port of entry.',
    severity: 'Major',
    status: 'Resolution Proposed',
    productService: 'Amoxicillin 250mg Capsules',
    batchOrderRef: 'PO-2026-CPL-078 / AMX-2026-019',
    receivedDate: '2026-03-18',
    responseDue: '2026-03-25',
    assignedTo: 'Anita Desai',
    assignedToId: 'u3',
    containmentActions: [
      { id: 'ca4', description: 'Place export hold on all remaining Amoxicillin packs from AMX-2026-019 in warehouse', owner: 'Anita Desai', dueDate: '2026-03-19', status: 'Completed' },
      { id: 'ca5', description: 'Review artwork master file for GCC label template to identify root cause', owner: 'Anita Desai', dueDate: '2026-03-20', status: 'Completed' },
    ],
    investigation: {
      rootCause: 'GCC-specific bilingual label artwork was not linked to the batch packaging order. Packaging line operators printed English-only label as the artwork file reference in the batch record was incorrect (domestic label version was referenced instead of GCC export version).',
      methodology: 'Timeline Analysis',
      fiveWhys: [],
      findings: 'Artwork master file management system does not enforce market-specific label selection at batch creation. The batch packaging order was created with incorrect artwork reference and was not independently verified by QA before printing commenced.',
      investigatedBy: 'Anita Desai',
      completedDate: '2026-03-24',
    },
    resolution: {
      proposedResolution: 'Recall consignment from port and relabel with correct bilingual artwork under QA supervision. Ship replacement consignment within 10 working days. No additional cost to Cipla.',
      customerAccepted: null,
      acceptedDate: null,
      resolutionDetails: 'Relabelling operation plan shared with Cipla QA for approval. Regulatory Affairs to file label variation if required.',
      compensationOffered: 'Full relabelling at our cost; priority shipping of corrected consignment',
      resolvedBy: 'Anita Desai',
    },
    communications: [
      { id: 'com4', date: '2026-03-18', type: 'Email', direction: 'Inbound', summary: 'Formal complaint from Cipla QA with photos of label and customs hold notification.', contactPerson: 'Ramesh Agarwal', user: 'Anita Desai' },
      { id: 'com5', date: '2026-03-19', type: 'Phone', direction: 'Outbound', summary: 'Acknowledged complaint, confirmed export hold. Committed to investigation and resolution within 7 days.', contactPerson: 'Ramesh Agarwal', user: 'Anita Desai' },
      { id: 'com6', date: '2026-03-24', type: 'Meeting', direction: 'Outbound', summary: 'Shared root cause findings and relabelling plan with Cipla QA team.', contactPerson: 'Ramesh Agarwal', user: 'Anita Desai' },
    ],
    linkedCAPAs: [
      { id: 'capa3', capaNumber: 'CAPA-2026-0020', title: 'Artwork management system: enforce market-specific label at batch creation', status: 'OPEN', type: 'CORRECTIVE' },
    ],
    history: [
      { id: 'h4', timestamp: '2026-03-18T11:00:00Z', user: 'Anita Desai', action: 'Complaint Logged', details: 'Complaint received from Cipla Ltd regarding GCC export consignment' },
      { id: 'h5', timestamp: '2026-03-25T10:00:00Z', user: 'Anita Desai', action: 'Resolution Proposed', details: 'Relabelling plan and replacement schedule proposed to customer' },
    ],
    createdAt: '2026-03-18T11:00:00Z',
    updatedAt: '2026-03-25T10:00:00Z',
  },
  {
    id: 'cmp3',
    complaintNumber: 'CMP-2026-0016',
    customerName: 'Fortis Healthcare',
    customerContact: 'Pritha Banerjee',
    customerEmail: 'p.banerjee@fortishealthcare.com',
    subject: 'Paracetamol 500mg tablets failing friability specification in delivered batch',
    description: 'Pharmacy department at Fortis Healthcare Gurgaon reported that tablets from Batch PCT-2026-011 crumbled during dispensing and showed visible surface friability. In-house re-test by hospital pharmacy reported friability of 1.8% against specification of NMT 1.0% per IP. Batch quantity affected: 20,000 tablets.',
    severity: 'Major',
    status: 'Acknowledged',
    productService: 'Paracetamol 500mg Tablets',
    batchOrderRef: 'PO-2026-FH-055 / PCT-2026-011',
    receivedDate: '2026-03-26',
    responseDue: '2026-04-02',
    assignedTo: 'Rajesh Kumar',
    assignedToId: 'u2',
    containmentActions: [
      { id: 'ca6', description: 'Recall all units of PCT-2026-011 from Fortis Healthcare sites and place in quarantine', owner: 'Dr. Priya Sharma', dueDate: '2026-03-28', status: 'In Progress' },
      { id: 'ca7', description: 'Retrieve and test retained samples from batch PCT-2026-011 for friability, hardness, and disintegration', owner: 'Rajesh Kumar', dueDate: '2026-03-29', status: 'Pending' },
    ],
    investigation: null,
    resolution: null,
    communications: [
      { id: 'com7', date: '2026-03-26', type: 'Email', direction: 'Inbound', summary: 'Customer shared friability test report from their in-house lab with photographs of tablet breakage.', contactPerson: 'Pritha Banerjee', user: 'Rajesh Kumar' },
      { id: 'com8', date: '2026-03-27', type: 'Phone', direction: 'Outbound', summary: 'Acknowledged complaint; informed customer of containment actions. Committed to full investigation within 10 days.', contactPerson: 'Pritha Banerjee', user: 'Rajesh Kumar' },
    ],
    linkedCAPAs: [],
    history: [
      { id: 'h6', timestamp: '2026-03-26T15:00:00Z', user: 'Rajesh Kumar', action: 'Complaint Logged', details: 'Quality complaint received from Fortis Healthcare regarding tablet friability' },
      { id: 'h7', timestamp: '2026-03-27T09:00:00Z', user: 'Rajesh Kumar', action: 'Acknowledged', details: 'Customer acknowledgement sent; containment initiated' },
    ],
    createdAt: '2026-03-26T15:00:00Z',
    updatedAt: '2026-03-27T09:00:00Z',
  },
  {
    id: 'cmp4',
    complaintNumber: 'CMP-2026-0015',
    customerName: 'Medline Industries',
    customerContact: 'Sanjeev Kapoor',
    customerEmail: 's.kapoor@medline.com',
    subject: 'Poor blister seal integrity on Metformin 500mg tablets — multiple packs with open seals',
    description: 'Medline Industries (distributor) reported that approximately 3% of blister packs in consignment Batch MET-2026-008 exhibited inadequate heat seal, with one or more cavities found open or partially sealed. Detected during distributor incoming inspection. Risk of moisture ingress and product degradation.',
    severity: 'Major',
    status: 'Received',
    productService: 'Metformin 500mg Tablets',
    batchOrderRef: 'PO-2026-MDL-041 / MET-2026-008',
    receivedDate: '2026-03-29',
    responseDue: '2026-04-05',
    assignedTo: 'Vikram Patel',
    assignedToId: 'u4',
    containmentActions: [],
    investigation: null,
    resolution: null,
    communications: [
      { id: 'com9', date: '2026-03-29', type: 'Email', direction: 'Inbound', summary: 'Distributor complaint with photos and incoming inspection report showing seal failure percentage.', contactPerson: 'Sanjeev Kapoor', user: 'Vikram Patel' },
    ],
    linkedCAPAs: [],
    history: [
      { id: 'h8', timestamp: '2026-03-29T16:30:00Z', user: 'Vikram Patel', action: 'Complaint Logged', details: 'Complaint received from Medline Industries regarding blister seal integrity' },
    ],
    createdAt: '2026-03-29T16:30:00Z',
    updatedAt: '2026-03-29T16:30:00Z',
  },
  {
    id: 'cmp5',
    complaintNumber: 'CMP-2026-0014',
    customerName: 'AIIMS New Delhi',
    customerContact: 'Dr. Kavita Menon',
    customerEmail: 'k.menon@aiims.edu',
    subject: 'Omeprazole 20mg capsules failing dissolution specification',
    description: 'AIIMS New Delhi pharmacy reported that Omeprazole 20mg Capsules from Batch OMP-2026-005 failed in-house dissolution testing. Hospital test result: 58% dissolved at 45 minutes vs specification of NLT 75% (Q) at 45 minutes per IP. Batch of 15,000 capsules under hospital hold.',
    severity: 'Critical',
    status: 'Closed',
    productService: 'Omeprazole 20mg Capsules',
    batchOrderRef: 'PO-2026-AIIMS-029 / OMP-2026-005',
    receivedDate: '2026-03-10',
    responseDue: '2026-03-17',
    assignedTo: 'Rajesh Kumar',
    assignedToId: 'u2',
    containmentActions: [
      { id: 'ca8', description: 'Initiate voluntary recall of all units of OMP-2026-005 from AIIMS and other customers', owner: 'Dr. Priya Sharma', dueDate: '2026-03-12', status: 'Completed' },
    ],
    investigation: {
      rootCause: 'Dissolution failure was linked to use of a non-conforming lot of HPMC coating polymer from Colorcon Ltd (lot HPM-C-2026-002) that had reduced viscosity grade, resulting in inadequate enteric coat thickness on pellets.',
      methodology: '5-Whys Analysis',
      fiveWhys: [
        { whyNumber: 1, question: 'Why did Omeprazole capsules fail dissolution?', answer: 'Enteric coat on pellets was insufficiently thick, causing premature release in acid medium.' },
        { whyNumber: 2, question: 'Why was enteric coat thickness insufficient?', answer: 'Coating polymer (HPMC) applied had lower-than-specified viscosity, affecting coat build-up rate.' },
        { whyNumber: 3, question: 'Why was lower viscosity HPMC used?', answer: 'Incoming inspection did not test viscosity of Colorcon HPMC lot HPM-C-2026-002; viscosity was assumed conforming based on CoA alone.' },
        { whyNumber: 4, question: 'Why was viscosity not tested during incoming inspection?', answer: 'Viscosity was not included as a tested parameter in the Incoming QC specification for HPMC; CoA acceptance was the only control.' },
        { whyNumber: 5, question: 'Why was viscosity absent from the incoming specification?', answer: 'Incoming specification was drafted in 2019 and had not been reviewed against current validated coating process parameters.' },
      ],
      findings: 'Non-conforming HPMC lot passed incoming inspection because viscosity was not an incoming test parameter. Root specification gap identified and corrected.',
      investigatedBy: 'Rajesh Kumar',
      completedDate: '2026-03-20',
    },
    resolution: {
      proposedResolution: 'Voluntary recall of batch OMP-2026-005. Replace with conforming batch OMP-2026-009 re-manufactured with verified HPMC. Update incoming specification to include viscosity testing.',
      customerAccepted: true,
      acceptedDate: '2026-03-25',
      resolutionDetails: 'Recalled units destroyed. Replacement batch delivered to AIIMS on 2026-03-22 with full CoA. Customer confirmed acceptance. Incoming specification updated.',
      compensationOffered: 'Full replacement of affected units at no charge; recall costs absorbed',
      resolvedBy: 'Dr. Priya Sharma',
    },
    communications: [
      { id: 'com10', date: '2026-03-10', type: 'Email', direction: 'Inbound', summary: 'AIIMS pharmacy submitted dissolution test failure report with raw data.', contactPerson: 'Dr. Kavita Menon', user: 'Rajesh Kumar' },
      { id: 'com11', date: '2026-03-11', type: 'Phone', direction: 'Outbound', summary: 'Acknowledged complaint; initiated voluntary recall discussion with AIIMS pharmacy head.', contactPerson: 'Dr. Kavita Menon', user: 'Dr. Priya Sharma' },
      { id: 'com12', date: '2026-03-25', type: 'Email', direction: 'Inbound', summary: 'AIIMS confirmed receipt of replacement batch and acceptance of resolution.', contactPerson: 'Dr. Kavita Menon', user: 'Rajesh Kumar' },
    ],
    linkedCAPAs: [
      { id: 'capa4', capaNumber: 'CAPA-2026-0018', title: 'Update HPMC incoming specification to include viscosity testing', status: 'CLOSED', type: 'CORRECTIVE' },
      { id: 'capa5', capaNumber: 'CAPA-2026-0019', title: 'Periodic review of incoming QC specifications against validated process parameters', status: 'IN_PROGRESS', type: 'PREVENTIVE' },
    ],
    history: [
      { id: 'h9', timestamp: '2026-03-10T09:00:00Z', user: 'Rajesh Kumar', action: 'Complaint Logged', details: 'Critical quality complaint received from AIIMS New Delhi' },
      { id: 'h10', timestamp: '2026-03-11T08:30:00Z', user: 'Dr. Priya Sharma', action: 'Acknowledged', details: 'Voluntary recall initiated' },
      { id: 'h11', timestamp: '2026-03-25T14:00:00Z', user: 'Dr. Priya Sharma', action: 'Closed', details: 'Customer accepted resolution; CAPA implemented' },
    ],
    createdAt: '2026-03-10T09:00:00Z',
    updatedAt: '2026-03-25T14:00:00Z',
  },
  // ── 2025 records ──
  {
    id: 'cmp-2025-001',
    complaintNumber: 'CMP-2025-0031',
    customerName: 'Cipla Ltd',
    customerContact: 'Ramesh Agarwal',
    customerEmail: 'r.agarwal@cipla.com',
    subject: 'Mixed batch numbers in same shipping carton — Ceftriaxone 1g Injection',
    description: 'Cipla distribution centre Mumbai reported mixed batches in Ceftriaxone 1g Injection shipper cartons. Batches CFT-2025-041 and CFT-2025-038 (different expiry dates) were co-packed in the same outer cartons, creating traceability and dispensing risk.',
    severity: 'Major',
    status: 'Closed',
    productService: 'Ceftriaxone 1g Injection',
    batchOrderRef: 'PO-2025-CPL-188 / CFT-2025-041',
    receivedDate: '2025-11-18',
    responseDue: '2025-11-25',
    assignedTo: 'Vikram Patel',
    assignedToId: 'u4',
    containmentActions: [
      { id: 'ca9', description: 'Hold all cartons from shipment at Cipla warehouse; request 100% carton-level segregation by batch', owner: 'Vikram Patel', dueDate: '2025-11-20', status: 'Completed' },
      { id: 'ca10', description: 'Inspect all remaining Ceftriaxone finished goods in our warehouse for mixed batch packing', owner: 'Dr. Priya Sharma', dueDate: '2025-11-21', status: 'Completed' },
    ],
    investigation: {
      rootCause: 'During overcount reconciliation at end of packaging shift, units from previous batch CFT-2025-038 (residual 84 units from a partial carton) were mixed into the ongoing batch CFT-2025-041 packaging run by an operator without recording the deviation.',
      methodology: '5-Whys Analysis',
      fiveWhys: [
        { whyNumber: 1, question: 'Why were two different batches found in the same cartons?', answer: 'Residual units from batch CFT-2025-038 were placed into batch CFT-2025-041 cartons during shift reconciliation.' },
        { whyNumber: 2, question: 'Why were residual units from a previous batch accessible on the packaging floor?', answer: 'Residual partial carton from CFT-2025-038 was not returned to quarantine store after previous shift ended.' },
        { whyNumber: 3, question: 'Why was the partial carton not returned to quarantine?', answer: 'Shift handover checklist did not include verification that all batch-specific materials are removed from the line at batch end.' },
        { whyNumber: 4, question: 'Why was the operator not aware of the procedure?', answer: 'Training records show the operator had not received refresher training on batch segregation SOP in the past 24 months.' },
      ],
      findings: 'Batch segregation failure during shift handover due to incomplete shift end checklist and lapsed operator training.',
      investigatedBy: 'Vikram Patel',
      completedDate: '2025-12-01',
    },
    resolution: {
      proposedResolution: 'Re-sort and re-pack all affected cartons with single-batch integrity under QA supervision at Cipla warehouse. Update shift handover checklist to mandate batch clearance verification.',
      customerAccepted: true,
      acceptedDate: '2025-12-10',
      resolutionDetails: 'Re-sorting completed at Cipla warehouse within 5 days. All cartons confirmed single-batch. Shift handover checklist updated and all operators retrained.',
      compensationOffered: 'Re-sorting labour cost covered by manufacturer; no charge to Cipla',
      resolvedBy: 'Vikram Patel',
    },
    communications: [
      { id: 'com13', date: '2025-11-18', type: 'Email', direction: 'Inbound', summary: 'Cipla QA sent formal complaint with photographic evidence of mixed batches in carton.', contactPerson: 'Ramesh Agarwal', user: 'Vikram Patel' },
      { id: 'com14', date: '2025-11-19', type: 'Phone', direction: 'Outbound', summary: 'Acknowledged complaint; committed to on-site re-sorting team within 3 days.', contactPerson: 'Ramesh Agarwal', user: 'Vikram Patel' },
    ],
    linkedCAPAs: [
      { id: 'capa6', capaNumber: 'CAPA-2025-0029', title: 'Batch segregation: enhance shift handover checklist and batch clearance verification', status: 'CLOSED', type: 'CORRECTIVE' },
    ],
    history: [
      { id: 'h12', timestamp: '2025-11-18T12:00:00Z', user: 'Vikram Patel', action: 'Complaint Logged', details: 'Received from Cipla Ltd' },
      { id: 'h13', timestamp: '2025-12-10T10:00:00Z', user: 'Vikram Patel', action: 'Closed', details: 'Customer confirmed resolution; CAPA implemented' },
    ],
    createdAt: '2025-11-18T12:00:00Z',
    updatedAt: '2025-12-10T10:00:00Z',
  },
  {
    id: 'cmp-2025-002',
    complaintNumber: 'CMP-2025-0022',
    customerName: 'Anita Desai (Regulatory Affairs)',
    customerContact: 'Anita Desai',
    customerEmail: 'a.desai@company.in',
    subject: 'Stability data discrepancy identified in ANDA dossier submission for Metformin 500mg',
    description: 'Regulatory Affairs team identified a discrepancy between the stability data tabulated in Module 3.2.P.8 of the ANDA submission dossier and the raw analytical data from QC stability laboratory for Metformin 500mg tablets. Six accelerated stability time points showed data in the dossier that did not match QC LIMS records. Filing was suspended pending investigation.',
    severity: 'Critical',
    status: 'Closed',
    productService: 'Metformin 500mg Tablets',
    batchOrderRef: 'ANDA-2025-MET500 / Stability Study SS-2024-MET-002',
    receivedDate: '2025-08-12',
    responseDue: '2025-08-19',
    assignedTo: 'Anita Desai',
    assignedToId: 'u3',
    containmentActions: [
      { id: 'ca11', description: 'Suspend ANDA dossier submission and notify regulatory consultant', owner: 'Anita Desai', dueDate: '2025-08-13', status: 'Completed' },
      { id: 'ca12', description: 'Retrieve all raw stability data from LIMS and compare with dossier tables', owner: 'Rajesh Kumar', dueDate: '2025-08-15', status: 'Completed' },
    ],
    investigation: {
      rootCause: 'Data transcription error occurred during manual transfer of stability results from LIMS printout to the dossier table in MS Word format. Six values were incorrectly entered (rounding applied to 3 decimal places in LIMS, but 2 decimal place values from an intermediate spreadsheet were used in the dossier).',
      methodology: '5-Whys Analysis',
      fiveWhys: [
        { whyNumber: 1, question: 'Why did the dossier stability table differ from LIMS records?', answer: 'Data was manually transcribed from a non-LIMS intermediate spreadsheet into the dossier instead of from LIMS directly.' },
        { whyNumber: 2, question: 'Why was a non-LIMS intermediate spreadsheet used?', answer: 'The LIMS report format was not suitable for direct copy-paste into the eCTD template; analysts created a formatted spreadsheet manually.' },
        { whyNumber: 3, question: 'Why was no secondary review of transcribed data performed?', answer: 'SOP for dossier compilation required only author review, not independent secondary verification of numerical data.' },
      ],
      findings: 'Manual data transcription without secondary verification creates transcription error risk in dossier compilation. LIMS-to-dossier data integrity controls were insufficient.',
      investigatedBy: 'Anita Desai',
      completedDate: '2025-08-22',
    },
    resolution: {
      proposedResolution: 'Correct all stability data tables in dossier using verified LIMS exports. Implement mandatory data verification step in dossier SOP. Re-submit ANDA with corrected data.',
      customerAccepted: true,
      acceptedDate: '2025-09-01',
      resolutionDetails: 'Dossier corrected and re-submitted on 2025-09-15. Regulatory consultant confirmed filing accepted. New dossier compilation SOP implemented with mandatory numerical data verification.',
      compensationOffered: 'Internal complaint; no external compensation required',
      resolvedBy: 'Anita Desai',
    },
    communications: [
      { id: 'com15', date: '2025-08-12', type: 'Email', direction: 'Inbound', summary: 'Internal complaint raised by Regulatory Affairs following pre-submission self-audit discrepancy finding.', contactPerson: 'Anita Desai', user: 'Dr. Priya Sharma' },
      { id: 'com16', date: '2025-08-13', type: 'Meeting', direction: 'Outbound', summary: 'Emergency meeting: QA, RA, and QC to scope discrepancy and agree investigation plan.', contactPerson: 'Anita Desai', user: 'Dr. Priya Sharma' },
    ],
    linkedCAPAs: [
      { id: 'capa7', capaNumber: 'CAPA-2025-0026', title: 'Dossier data integrity: mandatory verification of LIMS data in dossier compilation', status: 'CLOSED', type: 'CORRECTIVE' },
    ],
    history: [
      { id: 'h14', timestamp: '2025-08-12T09:00:00Z', user: 'Anita Desai', action: 'Complaint Logged', details: 'Internal regulatory complaint — stability data discrepancy found' },
      { id: 'h15', timestamp: '2025-09-01T10:00:00Z', user: 'Dr. Priya Sharma', action: 'Closed', details: 'Corrected dossier filed; CAPA complete' },
    ],
    createdAt: '2025-08-12T09:00:00Z',
    updatedAt: '2025-09-01T10:00:00Z',
  },
  {
    id: 'cmp-2025-003',
    complaintNumber: 'CMP-2025-0009',
    customerName: 'Apollo Hospitals Ltd',
    customerContact: 'Dr. Suresh Reddy',
    customerEmail: 's.reddy@apollohospitals.com',
    subject: 'Short expiry date products supplied — Ceftriaxone 1g injection, less than 6 months remaining',
    description: 'Apollo Hospitals procurement flagged that Ceftriaxone 1g Injection (Batch CFT-2025-008) received in March 2025 had only 4.5 months remaining shelf life (expiry: Aug-2025) against their purchase contract requirement of minimum 6 months remaining shelf life at time of delivery.',
    severity: 'Minor',
    status: 'Closed',
    productService: 'Ceftriaxone 1g Injection',
    batchOrderRef: 'PO-2025-APL-045 / CFT-2025-008',
    receivedDate: '2025-03-05',
    responseDue: '2025-03-12',
    assignedTo: 'Vikram Patel',
    assignedToId: 'u4',
    containmentActions: [
      { id: 'ca13', description: 'Arrange return and replacement of short-dated units with batch having adequate shelf life', owner: 'Vikram Patel', dueDate: '2025-03-08', status: 'Completed' },
    ],
    investigation: {
      rootCause: 'Order picking system did not check remaining shelf life against customer-specific minimum shelf life requirements. FEFO (First Expiry First Out) dispatch of older batch was compliant with internal process but did not account for Apollo contractual 6-month requirement.',
      methodology: 'Timeline Analysis',
      fiveWhys: [],
      findings: 'Warehouse management system applied standard FEFO dispatch without customer-specific shelf life constraint check. Customer-specific shelf life requirements were not configured in the order management system.',
      investigatedBy: 'Vikram Patel',
      completedDate: '2025-03-10',
    },
    resolution: {
      proposedResolution: 'Replace all short-dated units with conforming batch (CFT-2025-012, expiry Jan-2026). Configure customer-specific minimum shelf life in order management system.',
      customerAccepted: true,
      acceptedDate: '2025-03-15',
      resolutionDetails: 'Replacement delivered on 2025-03-12. Apollo confirmed acceptance. Customer-specific shelf life constraint added for Apollo Hospitals in ERP.',
      compensationOffered: 'Free replacement; return freight at our cost',
      resolvedBy: 'Vikram Patel',
    },
    communications: [
      { id: 'com17', date: '2025-03-05', type: 'Email', direction: 'Inbound', summary: 'Apollo procurement raised short expiry complaint with delivery note and product expiry details.', contactPerson: 'Dr. Suresh Reddy', user: 'Vikram Patel' },
      { id: 'com18', date: '2025-03-06', type: 'Phone', direction: 'Outbound', summary: 'Acknowledged; committed to replacement within 5 working days.', contactPerson: 'Dr. Suresh Reddy', user: 'Vikram Patel' },
    ],
    linkedCAPAs: [],
    history: [
      { id: 'h16', timestamp: '2025-03-05T10:00:00Z', user: 'Vikram Patel', action: 'Complaint Logged', details: 'Received from Apollo Hospitals — short expiry complaint' },
      { id: 'h17', timestamp: '2025-03-15T11:00:00Z', user: 'Vikram Patel', action: 'Closed', details: 'Replacement accepted; ERP configured with customer shelf life constraint' },
    ],
    createdAt: '2025-03-05T10:00:00Z',
    updatedAt: '2025-03-15T11:00:00Z',
  },
  // ── 2024 records ──
  {
    id: 'cmp-2024-001',
    complaintNumber: 'CMP-2024-0038',
    customerName: 'Sun Pharma (Contract Manufacturing)',
    customerContact: 'Deepika Nair',
    customerEmail: 'd.nair@sunpharma.com',
    subject: 'Metformin 500mg tablet hardness out of specification in 3 sub-batches',
    description: 'Sun Pharma contract manufacturing team received Metformin 500mg Tablets under contract and found hardness values of 3.2–3.8 kP in 3 out of 5 sub-batches (MET-2024-091 to MET-2024-095), below the in-house specification of 5.0–9.0 kP. Customer concerned about potential friability and packaging-line breakage issues.',
    severity: 'Major',
    status: 'Closed',
    productService: 'Metformin 500mg Tablets (Contract)',
    batchOrderRef: 'CMO-PO-2024-SP-078 / MET-2024-091 to 095',
    receivedDate: '2024-11-05',
    responseDue: '2024-11-12',
    assignedTo: 'Rajesh Kumar',
    assignedToId: 'u2',
    containmentActions: [
      { id: 'ca14', description: 'Quarantine sub-batches MET-2024-091, 092, 093 at Sun Pharma pending investigation outcome', owner: 'Rajesh Kumar', dueDate: '2024-11-07', status: 'Completed' },
    ],
    investigation: {
      rootCause: 'Granulator main binder addition pump (P-102) had a worn impeller delivering 15% less binder solution than set point. Reduced binder concentration led to inadequate granule binding strength and sub-specification tablet hardness.',
      methodology: '5-Whys Analysis',
      fiveWhys: [
        { whyNumber: 1, question: 'Why were tablet hardness values below specification?', answer: 'Granules had insufficient binder concentration, resulting in weak inter-particulate bonding after compression.' },
        { whyNumber: 2, question: 'Why was binder concentration in granules insufficient?', answer: 'Binder solution delivery pump P-102 delivered 15% less binder than the set process parameter.' },
        { whyNumber: 3, question: 'Why was pump P-102 delivering below set point?', answer: 'Impeller was worn and had not been replaced at the scheduled 500-hour maintenance interval.' },
        { whyNumber: 4, question: 'Why had the impeller not been replaced?', answer: 'Maintenance work order for P-102 at 500-hour interval was raised but not executed; engineering team backlog caused delay.' },
        { whyNumber: 5, question: 'Why did production proceed despite overdue pump maintenance?', answer: 'No system interlock prevented granulation runs when critical equipment maintenance was overdue.' },
      ],
      findings: 'Critical equipment (binder pump) operated beyond maintenance interval due to backlog. No production blocking control existed for overdue critical equipment maintenance.',
      investigatedBy: 'Rajesh Kumar',
      completedDate: '2024-11-18',
    },
    resolution: {
      proposedResolution: 'Reject three non-conforming sub-batches (MET-2024-091–093); re-manufacture with repaired pump. Implement critical equipment maintenance blocking in CMMS.',
      customerAccepted: true,
      acceptedDate: '2024-11-25',
      resolutionDetails: 'Non-conforming batches destroyed under QA supervision. Replacement batches MET-2024-098–100 manufactured with repaired pump and delivered. Sun Pharma confirmed acceptance.',
      compensationOffered: 'Full replacement of non-conforming batches at no charge to Sun Pharma',
      resolvedBy: 'Dr. Priya Sharma',
    },
    communications: [
      { id: 'com19', date: '2024-11-05', type: 'Email', direction: 'Inbound', summary: 'Sun Pharma CMO QA team submitted hardness test data and complaint report.', contactPerson: 'Deepika Nair', user: 'Rajesh Kumar' },
      { id: 'com20', date: '2024-11-06', type: 'Phone', direction: 'Outbound', summary: 'Acknowledged; agreed quarantine. Committed to investigation report within 7 days.', contactPerson: 'Deepika Nair', user: 'Rajesh Kumar' },
    ],
    linkedCAPAs: [
      { id: 'capa8', capaNumber: 'CAPA-2024-0038', title: 'Critical equipment maintenance blocking: prevent production run on overdue equipment', status: 'CLOSED', type: 'CORRECTIVE' },
    ],
    history: [
      { id: 'h18', timestamp: '2024-11-05T11:00:00Z', user: 'Rajesh Kumar', action: 'Complaint Logged', details: 'Received from Sun Pharma CMO team' },
      { id: 'h19', timestamp: '2024-11-25T14:00:00Z', user: 'Dr. Priya Sharma', action: 'Closed', details: 'Replacement batches delivered and accepted; CAPA implemented' },
    ],
    createdAt: '2024-11-05T11:00:00Z',
    updatedAt: '2024-11-25T14:00:00Z',
  },
  {
    id: 'cmp-2024-002',
    complaintNumber: 'CMP-2024-0021',
    customerName: 'Medline Industries',
    customerContact: 'Sanjeev Kapoor',
    customerEmail: 's.kapoor@medline.com',
    subject: 'Paracetamol 500mg tablets — wrong product insert (Metformin leaflet included)',
    description: 'Medline Industries reported that retail packs of Paracetamol 500mg Tablets (Batch PCT-2024-055) contained a Metformin 500mg patient information leaflet instead of the correct Paracetamol leaflet. Discovered during distributor secondary packaging review. Approximately 8,000 packs affected.',
    severity: 'Critical',
    status: 'Closed',
    productService: 'Paracetamol 500mg Tablets',
    batchOrderRef: 'PO-2024-MDL-195 / PCT-2024-055',
    receivedDate: '2024-07-10',
    responseDue: '2024-07-17',
    assignedTo: 'Dr. Priya Sharma',
    assignedToId: 'u1',
    containmentActions: [
      { id: 'ca15', description: 'Immediately suspend distribution of all PCT-2024-055 units held at Medline and our warehouse', owner: 'Dr. Priya Sharma', dueDate: '2024-07-11', status: 'Completed' },
      { id: 'ca16', description: 'Assess whether any incorrectly leafleted packs have reached retail pharmacies and initiate field retrieval if so', owner: 'Anita Desai', dueDate: '2024-07-12', status: 'Completed' },
    ],
    investigation: {
      rootCause: 'During packaging line changeover from Metformin to Paracetamol, the leaflet feeder hopper was not fully emptied of Metformin leaflets before loading Paracetamol leaflets. Line clearance checklist was signed off without physical verification of hopper contents.',
      methodology: '5-Whys Analysis',
      fiveWhys: [
        { whyNumber: 1, question: 'Why were Metformin leaflets found in Paracetamol packs?', answer: 'Metformin leaflets remained in the feeder hopper after changeover and were dispensed into Paracetamol packs.' },
        { whyNumber: 2, question: 'Why were Metformin leaflets still in the hopper after changeover?', answer: 'Hopper was not physically emptied during changeover; residual leaflets were not visible from operating position.' },
        { whyNumber: 3, question: 'Why was physical hopper emptying not performed?', answer: 'Line clearance SOP required visual check but did not mandate physical emptying and counting of leaflet hopper contents.' },
        { whyNumber: 4, question: 'Why was the clearance checklist signed without confirming hopper emptying?', answer: 'Operator signed off based on visual check from operating position without opening hopper lid to confirm empty.' },
      ],
      findings: 'Line clearance procedure inadequate for leaflet hopper — visual check insufficient; physical emptying with count reconciliation is required to prevent mix-ups.',
      investigatedBy: 'Dr. Priya Sharma',
      completedDate: '2024-07-22',
    },
    resolution: {
      proposedResolution: 'Recall and replace all affected packs. Update line clearance SOP to mandate physical emptying and count reconciliation of leaflet hopper at every changeover.',
      customerAccepted: true,
      acceptedDate: '2024-08-01',
      resolutionDetails: 'All 8,000 packs retrieved from Medline and warehouse. No packs confirmed to have reached retail. Replacement batch PCT-2024-062 delivered. Line clearance SOP updated and all packaging operators retrained.',
      compensationOffered: 'Full replacement of affected units; retrieval and destruction costs absorbed by manufacturer',
      resolvedBy: 'Dr. Priya Sharma',
    },
    communications: [
      { id: 'com21', date: '2024-07-10', type: 'Email', direction: 'Inbound', summary: 'Urgent complaint from Medline QA with photographic evidence of wrong leaflet in Paracetamol packs.', contactPerson: 'Sanjeev Kapoor', user: 'Dr. Priya Sharma' },
      { id: 'com22', date: '2024-07-10', type: 'Phone', direction: 'Outbound', summary: 'Immediate call to acknowledge; distribution suspension confirmed; field retrieval assessment initiated.', contactPerson: 'Sanjeev Kapoor', user: 'Dr. Priya Sharma' },
    ],
    linkedCAPAs: [
      { id: 'capa9', capaNumber: 'CAPA-2024-0021', title: 'Line clearance: mandatory leaflet hopper physical emptying and count reconciliation', status: 'CLOSED', type: 'CORRECTIVE' },
    ],
    history: [
      { id: 'h20', timestamp: '2024-07-10T09:00:00Z', user: 'Dr. Priya Sharma', action: 'Complaint Logged', details: 'Critical packaging mix-up complaint received from Medline Industries' },
      { id: 'h21', timestamp: '2024-08-01T10:00:00Z', user: 'Dr. Priya Sharma', action: 'Closed', details: 'All affected packs replaced; CAPA implemented and verified' },
    ],
    createdAt: '2024-07-10T09:00:00Z',
    updatedAt: '2024-08-01T10:00:00Z',
  },
  // ── Additional records (20+ total for the demo) ──
  ...((): Complaint[] => {
    const extras: Array<[
      string, string, string, string, string,
      Complaint['severity'], Complaint['status'],
      string, string, string,
    ]> = [
      ['cmp11','CMP-2026-0017','NetMeds Online Pharmacy',        'customer.care@netmeds.example','Blister seal integrity — Atorvastatin 10mg',            'Major','Closed',               'Atorvastatin 10mg Tablets','Batch ATV-26-0311','2026-03-15'],
      ['cmp12','CMP-2026-0016','1mg / Tata Online',              'escalation@1mg.example',      'Broken tablets in pack — Ibuprofen 400mg',               'Minor','Closed',               'Ibuprofen 400mg Tablets',  'Batch IBU-26-0208','2026-03-05'],
      ['cmp13','CMP-2026-0015','Apollo Hospital Chennai',        'procurement@apollo-chen.example','Bottle quantity mismatch — Paracetamol 500mg',          'Major','Under Investigation',  'Paracetamol 500mg Bottle of 100','Batch PMT-26-0112','2026-03-22'],
      ['cmp14','CMP-2026-0014','CDSCO PvPI India (ADR)',          'pvpi@cdsco.example',          'ADR — skin rash after Naproxen',                         'Major','Closed',               'Naproxen 250mg Tablets',   'Batch NAP-26-0102','2026-03-20'],
      ['cmp15','CMP-2026-0013','Fortis Hospital Delhi',          'pharmacy@fortis-delhi.example','Hairline crack on vial neck — Insulin Glargine',         'Critical','Under Investigation','Insulin Glargine 100 IU/mL','Batch INS-26-0094','2026-03-18'],
      ['cmp16','CMP-2026-0012','MedPlus Pharmacy',                'qa@medplus.example',          'Tablet colour variation — Metformin',                    'Minor','Closed',               'Metformin 500mg Tablets',  'Batch MET-26-0099','2026-02-28'],
      ['cmp17','CMP-2026-0011','Internal QA',                    'qa@aurorabiopharma.example',  'Internal — wrong batch number on Amlodipine cartons',    'Major','Closed',               'Amlodipine 5mg Cartons',   'Batch AML-26-0045','2026-03-10'],
      ['cmp18','CMP-2026-0010','Retail Pharmacy — Delhi',        'rx@delhi-rx.example',         'Patient complaint — bitter taste Amoxicillin suspension','Minor','Closed',               'Amoxicillin Suspension 250mg/5mL','Batch AMX-26-0070','2026-02-10'],
      ['cmp19','CMP-2026-0009','Max Healthcare Bangalore',       'procurement@maxhealthcare.example','Cold-chain excursion reported by 3PL',                  'Major','Under Investigation',  'Insulin Glargine 100 IU/mL','Batch INS-26-0087','2026-03-25'],
      ['cmp20','CMP-2026-0008','Drugs Controller General (Inspection)','dcgi@cdsco.example',    'CDSCO inspection observation — documentation gap',       'Major','Closed',               'Site-level (all batches)', '—','2026-03-12'],
    ];
    return extras.map(([id, complaintNumber, customerName, customerEmail, subject, severity, status, productService, batchOrderRef, receivedDate]) => ({
      id, complaintNumber, customerName, customerContact: 'Quality Contact', customerEmail,
      subject, description: subject + ' — detailed complaint recorded in complaint file.',
      severity, status,
      productService, batchOrderRef, receivedDate, responseDue: receivedDate,
      assignedTo: 'Dr. Priya Sharma', assignedToId: 'u1',
      containmentActions: [], investigation: null, resolution: null,
      communications: [], linkedCAPAs: [], history: [],
      createdAt: receivedDate + 'T09:00:00Z', updatedAt: receivedDate + 'T12:00:00Z',
    }));
  })(),
];

// ── Hooks ───────────────────────────────────────────────────────────────────

interface ComplaintFilters {
  status?: string;
  severity?: string;
  search?: string;
}

export function useComplaints(filters: ComplaintFilters = {}) {
  return useQuery({
    queryKey: ['complaints', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/complaints', { params: filters });
        return unwrapList<Complaint>(data, flattenComplaint as any);
      } catch {
        let filtered = [...mockComplaints];
        if (filters.status) filtered = filtered.filter((c) => c.status === filters.status);
        if (filters.severity) filtered = filtered.filter((c) => c.severity === filters.severity);
        if (filters.search) {
          const q = filters.search.toLowerCase();
          filtered = filtered.filter(
            (c) =>
              c.subject.toLowerCase().includes(q) ||
              c.complaintNumber.toLowerCase().includes(q) ||
              c.customerName.toLowerCase().includes(q),
          );
        }
        return { data: filtered, total: filtered.length, page: 1, pageSize: 20, totalPages: 1 };
      }
    },
    staleTime: 30_000,
  });
}

export function useComplaint(id: string) {
  return useQuery<Complaint>({
    queryKey: ['complaints', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/complaints/${id}`);
        return unwrapItem<Complaint>(data, flattenComplaint as any);
      } catch {
        const complaint = mockComplaints.find((c) => c.id === id);
        if (!complaint) throw new Error('Complaint not found');
        return complaint;
      }
    },
    enabled: !!id,
  });
}

export type ComplaintStatus = Complaint['status'];

const STATUS_NEXT: Record<ComplaintStatus, ComplaintStatus | null> = {
  Received: 'Acknowledged',
  Acknowledged: 'Under Investigation',
  'Under Investigation': 'Resolution Proposed',
  'Resolution Proposed': 'Closed',
  Closed: null,
};

export function getNextStatus(current: ComplaintStatus): ComplaintStatus | null {
  return STATUS_NEXT[current];
}

export function useUpdateComplaintStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ComplaintStatus }) => {
      try {
        const { data } = await api.patch(`/qms/complaints/${id}/status`, { status });
        return data;
      } catch {
        return { id, status };
      }
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['complaints', id] });
      qc.invalidateQueries({ queryKey: ['complaints'] });
    },
  });
}

export function useCreateComplaint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/qms/complaints', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      toast.success('Complaint logged successfully');
    },
    onError: () => {
      toast.error('Failed to log complaint');
    },
  });
}
