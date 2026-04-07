import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';

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
  {
    id: 'cmp1',
    complaintNumber: 'CMP-2026-0018',
    customerName: 'Bharat Heavy Electricals Ltd (BHEL)',
    customerContact: 'Raghav Kapoor',
    customerEmail: 'r.kapoor@bhel.in',
    subject: 'Surface pitting on delivered turbine blade castings',
    description: 'Customer reported visible surface pitting on 15 out of 200 turbine blade castings delivered against PO-2026-BHEL-445. Defects observed during incoming inspection at customer site. Affected parts from batch TC-2026-078.',
    severity: 'Critical',
    status: 'Under Investigation',
    productService: 'Turbine Blade Castings (TC-3200)',
    batchOrderRef: 'PO-2026-BHEL-445 / TC-2026-078',
    receivedDate: '2026-03-22',
    responseDue: '2026-03-29',
    assignedTo: 'Priya Sharma',
    assignedToId: 'u1',
    containmentActions: [
      { id: 'ca1', description: 'Ship 15 replacement castings from safety stock', owner: 'Priya Sharma', dueDate: '2026-03-25', status: 'Completed' },
      { id: 'ca2', description: 'Quarantine remaining castings from batch TC-2026-078', owner: 'Vikram Patel', dueDate: '2026-03-23', status: 'Completed' },
    ],
    investigation: {
      rootCause: 'Surface pitting caused by inadequate degassing during melting process. Gas porosity formed subsurface and was exposed during final machining.',
      methodology: '5-Whys Analysis',
      fiveWhys: [
        { whyNumber: 1, question: 'Why was surface pitting present on the castings?', answer: 'Gas porosity trapped below the surface was exposed during finish machining.' },
        { whyNumber: 2, question: 'Why was gas porosity present in the castings?', answer: 'Inadequate degassing during the melting process in the induction furnace.' },
        { whyNumber: 3, question: 'Why was degassing inadequate?', answer: 'Argon purge time was reduced from 15 minutes to 8 minutes on the production run.' },
        { whyNumber: 4, question: 'Why was purge time reduced?', answer: 'Operator was trying to meet production targets and shortened the cycle.' },
        { whyNumber: 5, question: 'Why was the operator able to deviate from the standard cycle?', answer: 'No automated interlock on furnace PLC to enforce minimum purge duration.' },
      ],
      findings: 'Root cause confirmed as operator deviation from standard degassing procedure. Lack of PLC interlock allowed manual override of purge cycle time.',
      investigatedBy: 'Vikram Patel',
      completedDate: '2026-03-28',
    },
    resolution: {
      proposedResolution: 'Replace all 15 defective castings at no cost. Implement PLC interlock for minimum degassing cycle. 100% radiographic inspection of remaining batch.',
      customerAccepted: null,
      acceptedDate: null,
      resolutionDetails: '',
      compensationOffered: 'Free replacement of 15 castings + expedited shipping',
      resolvedBy: 'Priya Sharma',
    },
    communications: [
      { id: 'com1', date: '2026-03-22', type: 'Email', direction: 'Inbound', summary: 'Customer reported defect with photos. Requested immediate replacement and root cause analysis.', contactPerson: 'Raghav Kapoor', user: 'Priya Sharma' },
      { id: 'com2', date: '2026-03-23', type: 'Phone', direction: 'Outbound', summary: 'Called customer to acknowledge complaint and confirm replacement shipment timeline.', contactPerson: 'Raghav Kapoor', user: 'Priya Sharma' },
      { id: 'com3', date: '2026-03-25', type: 'Email', direction: 'Outbound', summary: 'Sent replacement shipment tracking details. Shared interim investigation findings.', contactPerson: 'Raghav Kapoor', user: 'Priya Sharma' },
    ],
    linkedCAPAs: [
      { id: 'capa1', capaNumber: 'CAPA-2026-0022', title: 'Implement PLC interlock for degassing cycle', status: 'OPEN', type: 'CORRECTIVE' },
    ],
    history: [
      { id: 'h1', timestamp: '2026-03-22T10:00:00Z', user: 'Priya Sharma', action: 'Complaint Logged', details: 'Complaint received from BHEL via email' },
      { id: 'h2', timestamp: '2026-03-23T09:00:00Z', user: 'Priya Sharma', action: 'Acknowledged', details: 'Complaint acknowledged within 24 hours' },
      { id: 'h3', timestamp: '2026-03-25T14:00:00Z', user: 'Vikram Patel', action: 'Investigation Started', details: 'Root cause investigation initiated' },
    ],
    createdAt: '2026-03-22T10:00:00Z',
    updatedAt: '2026-03-28T16:00:00Z',
  },
  {
    id: 'cmp2',
    complaintNumber: 'CMP-2026-0017',
    customerName: 'Larsen & Toubro Ltd',
    customerContact: 'Meena Krishnamurthy',
    customerEmail: 'm.krishnamurthy@lnt.in',
    subject: 'Late delivery of fabricated pressure vessel',
    description: 'Pressure vessel PV-4402 delivered 12 days past the contractual delivery date causing project delay at customer site. Customer is claiming liquidated damages.',
    severity: 'Major',
    status: 'Resolution Proposed',
    productService: 'Pressure Vessel (PV-4402)',
    batchOrderRef: 'PO-2026-LT-312',
    receivedDate: '2026-03-18',
    responseDue: '2026-03-25',
    assignedTo: 'Sunita Rao',
    assignedToId: 'u5',
    containmentActions: [
      { id: 'ca3', description: 'Expedite final inspection and dispatch', owner: 'Sunita Rao', dueDate: '2026-03-19', status: 'Completed' },
    ],
    investigation: {
      rootCause: 'Delay caused by non-availability of NACE-compliant raw material. Procurement lead time was underestimated during project planning.',
      methodology: 'Timeline Analysis',
      fiveWhys: [],
      findings: 'Material procurement timeline was 6 weeks vs planned 3 weeks. No alternate suppliers were identified during planning phase.',
      investigatedBy: 'Sunita Rao',
      completedDate: '2026-03-24',
    },
    resolution: {
      proposedResolution: 'Waive 5% of invoice value as compensation for delay. Commit to revised project planning methodology for future orders.',
      customerAccepted: null,
      acceptedDate: null,
      resolutionDetails: 'Offered 5% invoice credit and priority scheduling for next order',
      compensationOffered: '5% invoice credit (INR 2,85,000)',
      resolvedBy: 'Sunita Rao',
    },
    communications: [
      { id: 'com4', date: '2026-03-18', type: 'Letter', direction: 'Inbound', summary: 'Formal complaint letter regarding delayed delivery with LD claim.', contactPerson: 'Meena Krishnamurthy', user: 'Sunita Rao' },
      { id: 'com5', date: '2026-03-20', type: 'Meeting', direction: 'Outbound', summary: 'Meeting with L&T procurement team. Explained root cause and proposed resolution.', contactPerson: 'Meena Krishnamurthy', user: 'Sunita Rao' },
    ],
    linkedCAPAs: [],
    history: [
      { id: 'h4', timestamp: '2026-03-18T11:00:00Z', user: 'Sunita Rao', action: 'Complaint Logged', details: 'Formal complaint received via letter' },
      { id: 'h5', timestamp: '2026-03-25T10:00:00Z', user: 'Sunita Rao', action: 'Resolution Proposed', details: 'Credit note and commitment proposed' },
    ],
    createdAt: '2026-03-18T11:00:00Z',
    updatedAt: '2026-03-25T10:00:00Z',
  },
  {
    id: 'cmp3',
    complaintNumber: 'CMP-2026-0016',
    customerName: 'Hindustan Petroleum Corporation Ltd (HPCL)',
    customerContact: 'Arvind Joshi',
    customerEmail: 'a.joshi@hpcl.co.in',
    subject: 'Incorrect documentation accompanying heat exchanger delivery',
    description: 'Material test certificates (MTCs) for heat exchanger HE-2026-005 did not match the actual material heat numbers stamped on the equipment. Three MTCs referenced wrong heat numbers.',
    severity: 'Major',
    status: 'Acknowledged',
    productService: 'Heat Exchanger (HE-2026-005)',
    batchOrderRef: 'PO-2026-HPCL-189',
    receivedDate: '2026-03-26',
    responseDue: '2026-04-02',
    assignedTo: 'Anita Desai',
    assignedToId: 'u3',
    containmentActions: [
      { id: 'ca4', description: 'Retrieve correct MTCs from material records', owner: 'Anita Desai', dueDate: '2026-03-27', status: 'In Progress' },
      { id: 'ca5', description: 'Verify all other documentation in the data book', owner: 'Deepak Nair', dueDate: '2026-03-28', status: 'Pending' },
    ],
    investigation: null,
    resolution: null,
    communications: [
      { id: 'com6', date: '2026-03-26', type: 'Email', direction: 'Inbound', summary: 'Customer flagged MTC mismatch during their incoming QA review.', contactPerson: 'Arvind Joshi', user: 'Anita Desai' },
      { id: 'com7', date: '2026-03-27', type: 'Phone', direction: 'Outbound', summary: 'Acknowledged issue and committed to sending corrected MTCs by March 30.', contactPerson: 'Arvind Joshi', user: 'Anita Desai' },
    ],
    linkedCAPAs: [],
    history: [
      { id: 'h6', timestamp: '2026-03-26T15:00:00Z', user: 'Anita Desai', action: 'Complaint Logged', details: 'Complaint received from HPCL' },
      { id: 'h7', timestamp: '2026-03-27T09:00:00Z', user: 'Anita Desai', action: 'Acknowledged', details: 'Complaint acknowledged' },
    ],
    createdAt: '2026-03-26T15:00:00Z',
    updatedAt: '2026-03-27T09:00:00Z',
  },
  {
    id: 'cmp4',
    complaintNumber: 'CMP-2026-0015',
    customerName: 'Godrej & Boyce Manufacturing',
    customerContact: 'Shalini Deshmukh',
    customerEmail: 's.deshmukh@godrej.com',
    subject: 'Weld defect found during customer hydro test',
    description: 'Pinhole leak detected during customer hydro test on fabricated column CL-2026-012 at nozzle N3 weld joint. Leak observed at 1.5x design pressure.',
    severity: 'Critical',
    status: 'Received',
    productService: 'Fabricated Column (CL-2026-012)',
    batchOrderRef: 'PO-2026-GB-567',
    receivedDate: '2026-03-29',
    responseDue: '2026-04-01',
    assignedTo: 'Vikram Patel',
    assignedToId: 'u4',
    containmentActions: [],
    investigation: null,
    resolution: null,
    communications: [
      { id: 'com8', date: '2026-03-29', type: 'Phone', direction: 'Inbound', summary: 'Urgent call from Godrej QA reporting hydro test failure. Photos shared via email.', contactPerson: 'Shalini Deshmukh', user: 'Vikram Patel' },
    ],
    linkedCAPAs: [],
    history: [
      { id: 'h8', timestamp: '2026-03-29T16:30:00Z', user: 'Vikram Patel', action: 'Complaint Logged', details: 'Urgent complaint received via phone' },
    ],
    createdAt: '2026-03-29T16:30:00Z',
    updatedAt: '2026-03-29T16:30:00Z',
  },
  {
    id: 'cmp5',
    complaintNumber: 'CMP-2026-0014',
    customerName: 'Thermax Ltd',
    customerContact: 'Nitin Kulkarni',
    customerEmail: 'n.kulkarni@thermaxglobal.com',
    subject: 'Dimensional non-conformance on machined flanges',
    description: 'Bolt circle diameter on 6 out of 24 flanges measures 410mm instead of specified 406.4mm. Parts unusable in customer assembly.',
    severity: 'Major',
    status: 'Closed',
    productService: 'Machined Flanges (FL-1200)',
    batchOrderRef: 'PO-2026-TH-234 / MCH-2026-061',
    receivedDate: '2026-03-10',
    responseDue: '2026-03-17',
    assignedTo: 'Anita Desai',
    assignedToId: 'u3',
    containmentActions: [
      { id: 'ca6', description: 'Express ship 6 replacement flanges', owner: 'Anita Desai', dueDate: '2026-03-12', status: 'Completed' },
    ],
    investigation: {
      rootCause: 'Incorrect bolt circle diameter in CNC program revision. Program was updated for a different flange variant and mistakenly applied to FL-1200 batch.',
      methodology: '5-Whys Analysis',
      fiveWhys: [
        { whyNumber: 1, question: 'Why was the bolt circle diameter incorrect?', answer: 'CNC program had wrong diameter value.' },
        { whyNumber: 2, question: 'Why did the CNC program have wrong value?', answer: 'Program updated for FL-1400 variant was loaded for FL-1200 batch.' },
        { whyNumber: 3, question: 'Why was wrong program loaded?', answer: 'Program naming convention did not clearly distinguish variants.' },
      ],
      findings: 'CNC program management process lacks adequate version control and variant identification.',
      investigatedBy: 'Anita Desai',
      completedDate: '2026-03-15',
    },
    resolution: {
      proposedResolution: 'Replace 6 defective flanges. Implement CNC program naming convention standard.',
      customerAccepted: true,
      acceptedDate: '2026-03-18',
      resolutionDetails: 'Replacement flanges delivered and accepted by customer. CNC program naming standard implemented.',
      compensationOffered: 'Free replacement + express shipping at our cost',
      resolvedBy: 'Anita Desai',
    },
    communications: [
      { id: 'com9', date: '2026-03-10', type: 'Email', direction: 'Inbound', summary: 'Customer reported dimensional issue with measurement report attached.', contactPerson: 'Nitin Kulkarni', user: 'Anita Desai' },
      { id: 'com10', date: '2026-03-12', type: 'Email', direction: 'Outbound', summary: 'Confirmed replacement shipment. Shared tracking details.', contactPerson: 'Nitin Kulkarni', user: 'Anita Desai' },
      { id: 'com11', date: '2026-03-18', type: 'Email', direction: 'Inbound', summary: 'Customer confirmed receipt and acceptance of replacement flanges.', contactPerson: 'Nitin Kulkarni', user: 'Anita Desai' },
    ],
    linkedCAPAs: [
      { id: 'capa2', capaNumber: 'CAPA-2026-0020', title: 'Implement CNC program naming convention and version control', status: 'IN_PROGRESS', type: 'CORRECTIVE' },
    ],
    history: [
      { id: 'h9', timestamp: '2026-03-10T09:00:00Z', user: 'Anita Desai', action: 'Complaint Logged', details: 'Complaint received from Thermax' },
      { id: 'h10', timestamp: '2026-03-20T11:00:00Z', user: 'Anita Desai', action: 'Closed', details: 'Customer accepted resolution' },
    ],
    createdAt: '2026-03-10T09:00:00Z',
    updatedAt: '2026-03-20T11:00:00Z',
  },
  {
    id: 'cmp6',
    complaintNumber: 'CMP-2026-0013',
    customerName: 'Reliance Industries Ltd',
    customerContact: 'Deepa Nambiar',
    customerEmail: 'd.nambiar@ril.com',
    subject: 'Paint coating thickness below specification',
    description: 'Dry film thickness (DFT) measurements on structural steel members show 180 microns against specified minimum of 250 microns in multiple locations. Corrosion protection inadequate for offshore application.',
    severity: 'Major',
    status: 'Under Investigation',
    productService: 'Structural Steel Members (SS-OFS-2026)',
    batchOrderRef: 'PO-2026-RIL-890',
    receivedDate: '2026-03-24',
    responseDue: '2026-03-31',
    assignedTo: 'Deepak Nair',
    assignedToId: 'u6',
    containmentActions: [
      { id: 'ca7', description: 'Hold shipment of remaining painted members', owner: 'Deepak Nair', dueDate: '2026-03-25', status: 'Completed' },
      { id: 'ca8', description: 'Arrange re-coating of affected members at customer site', owner: 'Deepak Nair', dueDate: '2026-03-30', status: 'In Progress' },
    ],
    investigation: null,
    resolution: null,
    communications: [
      { id: 'com12', date: '2026-03-24', type: 'Email', direction: 'Inbound', summary: 'Customer shared DFT measurement report showing below-spec readings.', contactPerson: 'Deepa Nambiar', user: 'Deepak Nair' },
      { id: 'com13', date: '2026-03-25', type: 'Phone', direction: 'Outbound', summary: 'Discussed re-coating plan at site. Customer agreed to provide access for touch-up.', contactPerson: 'Deepa Nambiar', user: 'Deepak Nair' },
    ],
    linkedCAPAs: [],
    history: [
      { id: 'h11', timestamp: '2026-03-24T11:00:00Z', user: 'Deepak Nair', action: 'Complaint Logged', details: 'Complaint received from Reliance Industries' },
      { id: 'h12', timestamp: '2026-03-25T10:00:00Z', user: 'Deepak Nair', action: 'Acknowledged', details: 'Containment measures initiated' },
    ],
    createdAt: '2026-03-24T11:00:00Z',
    updatedAt: '2026-03-25T10:00:00Z',
  },
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
        return data;
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
        return data;
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
