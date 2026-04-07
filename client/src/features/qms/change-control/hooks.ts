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
  {
    id: 'cr1',
    crNumber: 'CR-2026-0012',
    title: 'Update heat treatment parameters for Grade 91 steel',
    description: 'Revise heat treatment temperature and soak time parameters for Grade 91 steel components to align with updated ASME requirements. The current parameters (1040 deg C / 2 hrs) need to be adjusted to (1050 deg C / 2.5 hrs) based on recent metallurgical analysis.',
    reasonForChange: 'Updated ASME BPVC Section IX requirements mandate tighter control of tempering parameters. Recent metallurgical failures in field have been traced to insufficient soak time at tempering temperature.',
    changeType: 'Process',
    impactLevel: 'High',
    status: 'Under Review',
    requestor: 'Vikram Patel',
    requestorId: 'u4',
    department: 'Engineering',
    targetDate: '2026-04-15',
    impactAssessment: 'This change affects all Grade 91 steel components in production. Approximately 45 active work orders will require revised process parameters. Furnace PLC programs need reprogramming. Operator training required for 12 personnel.',
    affectedDocuments: ['WPS-108 (Welding Procedure Specification)', 'SOP-HT-003 (Heat Treatment Procedure)', 'QCP-2026-015 (Quality Control Plan)'],
    affectedProcesses: ['Heat Treatment', 'Post-Weld Heat Treatment', 'Final Inspection'],
    riskAssessment: 'Medium risk. Incorrect implementation could lead to non-compliant material properties. Mitigation: Pilot run on 5 test specimens before full production changeover.',
    regulatoryNotification: true,
    notifyDepartments: ['Production', 'Quality Assurance', 'Quality Control', 'Engineering'],
    implementationTasks: [
      { id: 't1', description: 'Update furnace PLC parameters', owner: 'Deepak Nair', dueDate: '2026-04-05', status: 'In Progress' },
      { id: 't2', description: 'Revise SOP-HT-003', owner: 'Priya Sharma', dueDate: '2026-04-08', status: 'Pending' },
      { id: 't3', description: 'Conduct operator training', owner: 'Rajesh Kumar', dueDate: '2026-04-12', status: 'Pending' },
      { id: 't4', description: 'Execute pilot run on test specimens', owner: 'Vikram Patel', dueDate: '2026-04-10', status: 'Pending' },
    ],
    approvalStages: [
      { name: 'Initiator Submission', status: 'completed', approver: 'Vikram Patel', timestamp: '2026-03-25 09:30', comment: 'Submitted based on ASME code update analysis' },
      { name: 'Engineering Review', status: 'completed', approver: 'Rajesh Kumar', timestamp: '2026-03-26 14:15', comment: 'Parameters verified against code requirements' },
      { name: 'Quality Assurance Review', status: 'active', approver: 'Priya Sharma' },
      { name: 'Production Head Approval', status: 'pending', approver: 'Suresh Menon' },
      { name: 'Management Approval', status: 'pending', approver: 'Kavita Iyer' },
    ],
    validationResults: null,
    history: [
      { id: 'h1', timestamp: '2026-03-25T09:30:00Z', user: 'Vikram Patel', action: 'Created', details: 'Change request submitted' },
      { id: 'h2', timestamp: '2026-03-26T14:15:00Z', user: 'Rajesh Kumar', action: 'Approved', details: 'Engineering review completed and approved' },
      { id: 'h3', timestamp: '2026-03-27T10:00:00Z', user: 'Priya Sharma', action: 'Under Review', details: 'QA review in progress' },
    ],
    createdAt: '2026-03-25T09:30:00Z',
    updatedAt: '2026-03-27T10:00:00Z',
  },
  {
    id: 'cr2',
    crNumber: 'CR-2026-0011',
    title: 'New raw material supplier qualification — Tata Steel Ltd',
    description: 'Qualify Tata Steel Ltd as an approved supplier for SA-516 Gr.70 carbon steel plates. Current sole-source dependency on JSW Steel poses supply chain risk.',
    reasonForChange: 'Supply chain risk mitigation. JSW Steel delivery lead times have increased by 40% over the past quarter. Adding Tata Steel as a qualified alternate supplier ensures continuity.',
    changeType: 'Product',
    impactLevel: 'Medium',
    status: 'Approved',
    requestor: 'Sunita Rao',
    requestorId: 'u5',
    department: 'Procurement',
    targetDate: '2026-04-30',
    impactAssessment: 'New supplier material must pass incoming inspection criteria. Test coupons from Tata Steel batch need mechanical testing and chemical analysis before production use.',
    affectedDocuments: ['AVL-2026 (Approved Vendor List)', 'SOP-IQC-001 (Incoming Inspection)', 'PUR-SPEC-012 (Purchase Specification)'],
    affectedProcesses: ['Incoming Inspection', 'Procurement', 'Material Storage'],
    riskAssessment: 'Low risk. Standard supplier qualification process. Material from Tata Steel has been used successfully in previous projects.',
    regulatoryNotification: false,
    notifyDepartments: ['Procurement', 'Quality Control', 'Production'],
    implementationTasks: [
      { id: 't5', description: 'Obtain test certificates from Tata Steel', owner: 'Sunita Rao', dueDate: '2026-04-10', status: 'Completed' },
      { id: 't6', description: 'Conduct incoming inspection on sample batch', owner: 'Anita Desai', dueDate: '2026-04-15', status: 'In Progress' },
      { id: 't7', description: 'Update Approved Vendor List', owner: 'Sunita Rao', dueDate: '2026-04-25', status: 'Pending' },
    ],
    approvalStages: [
      { name: 'Initiator Submission', status: 'completed', approver: 'Sunita Rao', timestamp: '2026-03-20 11:00' },
      { name: 'QC Review', status: 'completed', approver: 'Anita Desai', timestamp: '2026-03-22 09:45', comment: 'Sample test results satisfactory' },
      { name: 'Procurement Head Approval', status: 'completed', approver: 'Manoj Pillai', timestamp: '2026-03-24 16:30', comment: 'Approved for qualification' },
      { name: 'Management Approval', status: 'completed', approver: 'Kavita Iyer', timestamp: '2026-03-25 10:00' },
    ],
    validationResults: null,
    history: [
      { id: 'h4', timestamp: '2026-03-20T11:00:00Z', user: 'Sunita Rao', action: 'Created', details: 'Supplier qualification request submitted' },
      { id: 'h5', timestamp: '2026-03-25T10:00:00Z', user: 'Kavita Iyer', action: 'Approved', details: 'All approvals completed' },
    ],
    createdAt: '2026-03-20T11:00:00Z',
    updatedAt: '2026-03-25T10:00:00Z',
  },
  {
    id: 'cr3',
    crNumber: 'CR-2026-0010',
    title: 'CNC program revision for valve body VB-3200',
    description: 'Revise CNC machining program for valve body VB-3200 to correct bore diameter tolerance. Current program produces bore at 50.12mm, exceeding specification of 50.00 +/- 0.05mm.',
    reasonForChange: 'NC-2026-0041 identified dimensional deviation. Root cause traced to incorrect tool offset compensation in CNC program.',
    changeType: 'Process',
    impactLevel: 'High',
    status: 'In Implementation',
    requestor: 'Anita Desai',
    requestorId: 'u3',
    department: 'Engineering',
    targetDate: '2026-04-05',
    impactAssessment: 'All VB-3200 parts currently in production queue (12 units) will use revised program. First-article inspection mandatory after program change.',
    affectedDocuments: ['CNC-PRG-VB3200 (CNC Program)', 'QCP-VB3200 (Quality Control Plan)', 'INSP-VB3200 (Inspection Checklist)'],
    affectedProcesses: ['CNC Machining', 'In-Process Inspection', 'Final Inspection'],
    riskAssessment: 'Medium risk. Incorrect tool offset could cause scrap. Mitigation: Dry run followed by first-article inspection.',
    regulatoryNotification: false,
    notifyDepartments: ['Production', 'Quality Control', 'Engineering'],
    implementationTasks: [
      { id: 't8', description: 'Modify CNC program tool offset parameters', owner: 'Deepak Nair', dueDate: '2026-03-30', status: 'Completed' },
      { id: 't9', description: 'Execute dry run on CNC machine', owner: 'Deepak Nair', dueDate: '2026-03-31', status: 'In Progress' },
      { id: 't10', description: 'First-article inspection', owner: 'Anita Desai', dueDate: '2026-04-02', status: 'Pending' },
    ],
    approvalStages: [
      { name: 'Initiator Submission', status: 'completed', approver: 'Anita Desai', timestamp: '2026-03-26 10:00' },
      { name: 'Engineering Review', status: 'completed', approver: 'Rajesh Kumar', timestamp: '2026-03-27 11:30' },
      { name: 'QA Approval', status: 'completed', approver: 'Priya Sharma', timestamp: '2026-03-28 09:00' },
      { name: 'Production Approval', status: 'completed', approver: 'Suresh Menon', timestamp: '2026-03-28 14:00' },
    ],
    validationResults: null,
    history: [
      { id: 'h6', timestamp: '2026-03-26T10:00:00Z', user: 'Anita Desai', action: 'Created', details: 'Linked to NC-2026-0041' },
      { id: 'h7', timestamp: '2026-03-28T14:00:00Z', user: 'Suresh Menon', action: 'Approved', details: 'All approvals completed, implementation started' },
    ],
    createdAt: '2026-03-26T10:00:00Z',
    updatedAt: '2026-03-29T15:00:00Z',
  },
  {
    id: 'cr4',
    crNumber: 'CR-2026-0009',
    title: 'Document control system migration to QuantumFlow DMS',
    description: 'Migrate all controlled documents from legacy file-server based system to QuantumFlow DMS module with full version control, electronic signatures, and automated review reminders.',
    reasonForChange: 'Current file-server based document control does not meet ISO 9001:2015 clause 7.5 requirements for controlled access and version management. Multiple instances of obsolete documents being used in production.',
    changeType: 'System',
    impactLevel: 'High',
    status: 'Approved',
    requestor: 'Priya Sharma',
    requestorId: 'u1',
    department: 'Quality Assurance',
    targetDate: '2026-05-15',
    impactAssessment: 'All departments affected. 340+ controlled documents to migrate. Training required for all 85 system users. Legacy system decommissioning planned after 30-day parallel run.',
    affectedDocuments: ['SOP-DCC-001 (Document Control Procedure)', 'QM-001 (Quality Manual)', 'All SOPs, WIs, and Forms'],
    affectedProcesses: ['Document Control', 'Training', 'All QMS Processes'],
    riskAssessment: 'High risk due to scope. Mitigation: Phased rollout by department. Parallel run period. Rollback plan maintained.',
    regulatoryNotification: false,
    notifyDepartments: ['All Departments'],
    implementationTasks: [
      { id: 't11', description: 'Complete document inventory and categorization', owner: 'Priya Sharma', dueDate: '2026-04-10', status: 'In Progress' },
      { id: 't12', description: 'Configure DMS module permissions', owner: 'Rajesh Kumar', dueDate: '2026-04-15', status: 'Pending' },
      { id: 't13', description: 'Migrate Phase 1 documents (QA/QC)', owner: 'Priya Sharma', dueDate: '2026-04-25', status: 'Pending' },
      { id: 't14', description: 'Conduct user training sessions', owner: 'Sunita Rao', dueDate: '2026-05-05', status: 'Pending' },
    ],
    approvalStages: [
      { name: 'Initiator Submission', status: 'completed', approver: 'Priya Sharma', timestamp: '2026-03-15 09:00' },
      { name: 'IT Review', status: 'completed', approver: 'Rajesh Kumar', timestamp: '2026-03-17 14:00' },
      { name: 'Management Approval', status: 'completed', approver: 'Kavita Iyer', timestamp: '2026-03-19 11:00', comment: 'Approved with phased implementation approach' },
    ],
    validationResults: null,
    history: [
      { id: 'h8', timestamp: '2026-03-15T09:00:00Z', user: 'Priya Sharma', action: 'Created', details: 'System change request submitted' },
      { id: 'h9', timestamp: '2026-03-19T11:00:00Z', user: 'Kavita Iyer', action: 'Approved', details: 'Management approval granted' },
    ],
    createdAt: '2026-03-15T09:00:00Z',
    updatedAt: '2026-03-19T11:00:00Z',
  },
  {
    id: 'cr5',
    crNumber: 'CR-2026-0008',
    title: 'Revise final inspection checklist for pressure vessels',
    description: 'Update final inspection checklist INSP-PV-001 to include additional NDE requirements per revised ASME Section VIII Div.1.',
    reasonForChange: 'Updated ASME code edition mandates additional radiographic examination for nozzle-to-shell welds on Category C joints.',
    changeType: 'Document',
    impactLevel: 'Medium',
    status: 'Validated',
    requestor: 'Deepak Nair',
    requestorId: 'u6',
    department: 'Quality Control',
    targetDate: '2026-03-28',
    impactAssessment: 'Inspection time per vessel increases by approximately 2 hours. NDE subcontractor capacity confirmed.',
    affectedDocuments: ['INSP-PV-001 (Final Inspection Checklist)', 'QCP-PV-GEN (Quality Control Plan - PV)'],
    affectedProcesses: ['Final Inspection', 'NDE'],
    riskAssessment: 'Low risk. Additive change only — no removal of existing checks.',
    regulatoryNotification: true,
    notifyDepartments: ['Quality Control', 'Production'],
    implementationTasks: [
      { id: 't15', description: 'Draft revised checklist', owner: 'Deepak Nair', dueDate: '2026-03-20', status: 'Completed' },
      { id: 't16', description: 'Train inspectors on new requirements', owner: 'Anita Desai', dueDate: '2026-03-25', status: 'Completed' },
      { id: 't17', description: 'Deploy revised checklist to production floor', owner: 'Deepak Nair', dueDate: '2026-03-26', status: 'Completed' },
    ],
    approvalStages: [
      { name: 'Initiator Submission', status: 'completed', approver: 'Deepak Nair', timestamp: '2026-03-15 08:00' },
      { name: 'QA Review', status: 'completed', approver: 'Priya Sharma', timestamp: '2026-03-16 10:30' },
      { name: 'Management Approval', status: 'completed', approver: 'Kavita Iyer', timestamp: '2026-03-17 09:00' },
    ],
    validationResults: {
      validated: true,
      validatedBy: 'Priya Sharma',
      validationDate: '2026-03-28',
      effectivenessConfirmed: true,
      notes: 'Verified on 3 pressure vessels (PV-4405, PV-4406, PV-4407). All NDE results recorded correctly per new checklist. No discrepancies found.',
    },
    history: [
      { id: 'h10', timestamp: '2026-03-15T08:00:00Z', user: 'Deepak Nair', action: 'Created', details: 'Document change request submitted' },
      { id: 'h11', timestamp: '2026-03-17T09:00:00Z', user: 'Kavita Iyer', action: 'Approved', details: 'Approved for implementation' },
      { id: 'h12', timestamp: '2026-03-28T16:00:00Z', user: 'Priya Sharma', action: 'Validated', details: 'Post-implementation validation completed' },
    ],
    createdAt: '2026-03-15T08:00:00Z',
    updatedAt: '2026-03-28T16:00:00Z',
  },
  {
    id: 'cr6',
    crNumber: 'CR-2026-0007',
    title: 'Reject proposal to change torque specifications on flange assembly',
    description: 'Proposal to reduce flange bolt torque values by 15% based on supplier recommendation for new gasket material.',
    reasonForChange: 'Gasket supplier recommended lower torque to prevent gasket crushing with their new material formulation.',
    changeType: 'Process',
    impactLevel: 'High',
    status: 'Rejected',
    requestor: 'Rajesh Kumar',
    requestorId: 'u2',
    department: 'Engineering',
    targetDate: '2026-03-20',
    impactAssessment: 'Would affect all flanged connections on pressure equipment. Risk of leakage under operating conditions unacceptable.',
    affectedDocuments: ['WI-FLNG-001 (Flange Assembly Work Instruction)'],
    affectedProcesses: ['Assembly', 'Pressure Testing'],
    riskAssessment: 'High risk. Reduced torque may compromise joint integrity under cyclic loading. Insufficient test data provided by supplier.',
    regulatoryNotification: false,
    notifyDepartments: ['Engineering', 'Production'],
    implementationTasks: [],
    approvalStages: [
      { name: 'Initiator Submission', status: 'completed', approver: 'Rajesh Kumar', timestamp: '2026-03-10 09:00' },
      { name: 'Engineering Review', status: 'completed', approver: 'Vikram Patel', timestamp: '2026-03-12 11:00', comment: 'Insufficient data to support torque reduction' },
      { name: 'QA Review', status: 'rejected', approver: 'Priya Sharma', timestamp: '2026-03-13 14:00', comment: 'Rejected — supplier must provide cyclic fatigue test data before reconsideration' },
    ],
    validationResults: null,
    history: [
      { id: 'h13', timestamp: '2026-03-10T09:00:00Z', user: 'Rajesh Kumar', action: 'Created', details: 'Change request submitted' },
      { id: 'h14', timestamp: '2026-03-13T14:00:00Z', user: 'Priya Sharma', action: 'Rejected', details: 'Rejected due to insufficient supporting data' },
    ],
    createdAt: '2026-03-10T09:00:00Z',
    updatedAt: '2026-03-13T14:00:00Z',
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
