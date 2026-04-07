import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { PaginatedResponse } from '@/types';
import toast from 'react-hot-toast';

// ── Types ───────────────────────────────────────────────────────────────────

export type CAPASource = 'NC' | 'AUDIT' | 'COMPLAINT' | 'PROACTIVE' | 'MANAGEMENT' | 'CUSTOMER';
export type CAPASeverity = 'CRITICAL' | 'MAJOR' | 'MINOR';
export type CAPALifecycle =
  | 'INITIATED'
  | 'CONTAINMENT'
  | 'ROOT_CAUSE_ANALYSIS'
  | 'ACTION_DEFINITION'
  | 'IMPLEMENTATION'
  | 'EFFECTIVENESS_VERIFICATION'
  | 'CLOSED';

export interface FiveWhyEntry {
  whyNumber: number;
  question: string;
  answer: string;
}

export interface FishboneCause {
  id: string;
  text: string;
}

export interface FishboneData {
  man: FishboneCause[];
  machine: FishboneCause[];
  material: FishboneCause[];
  method: FishboneCause[];
  measurement: FishboneCause[];
  environment: FishboneCause[];
}

export interface CAPAAction {
  id: string;
  description: string;
  type: 'CORRECTIVE' | 'PREVENTIVE';
  owner: string;
  dueDate: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'VERIFIED';
  completedDate?: string | null;
  evidence?: string | null;
}

export interface CAPAHistoryEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export interface CAPARecord {
  id: string;
  capaNumber: string;
  title: string;
  description: string;
  source: CAPASource;
  severity: CAPASeverity;
  status: CAPALifecycle;
  department: string;
  productProcess: string | null;
  linkedSourceRecord: string | null;
  owner: string;
  ownerId: string;
  dueDate: string;
  fiveWhys: FiveWhyEntry[];
  fishbone: FishboneData;
  actions: CAPAAction[];
  effectivenessCriteria: string | null;
  monitoringPeriodDays: number;
  effectivenessResult: 'PASS' | 'FAIL' | null;
  effectivenessEvidence: string | null;
  history: CAPAHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  createdBy: string;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

export const mockCAPAs: CAPARecord[] = [
  {
    id: 'capa1',
    capaNumber: 'CAPA-2026-0012',
    title: 'Corrective action for hardness OOS in heat treatment batch',
    description: 'Heat treatment batch HT-2026-112 produced flanges with hardness below 220 HB specification. Root cause analysis and corrective measures required to prevent recurrence.',
    source: 'NC',
    severity: 'CRITICAL',
    status: 'ROOT_CAUSE_ANALYSIS',
    department: 'Production',
    productProcess: 'Heat Treatment',
    linkedSourceRecord: 'NC-2026-0042',
    owner: 'Priya Sharma',
    ownerId: 'u1',
    dueDate: '2026-04-20',
    fiveWhys: [
      { whyNumber: 1, question: 'Why did the hardness fall below specification?', answer: 'Furnace temperature dropped during the soaking phase.' },
      { whyNumber: 2, question: 'Why did the furnace temperature drop?', answer: 'Thermocouple TC-04 gave inaccurate readings.' },
      { whyNumber: 3, question: 'Why was TC-04 inaccurate?', answer: 'The thermocouple had drifted beyond calibration tolerance.' },
      { whyNumber: 4, question: 'Why was the drift not detected earlier?', answer: 'Calibration was overdue by 15 days due to scheduling gap.' },
      { whyNumber: 5, question: 'Why was calibration scheduling not followed?', answer: 'No automated alert system for calibration due dates.' },
    ],
    fishbone: {
      man: [{ id: 'f1', text: 'Operator did not verify thermocouple status' }, { id: 'f2', text: 'Insufficient training on pre-run checks' }],
      machine: [{ id: 'f3', text: 'Thermocouple TC-04 drift' }, { id: 'f4', text: 'No redundant temperature sensor' }],
      material: [{ id: 'f5', text: 'Material composition within spec' }],
      method: [{ id: 'f6', text: 'No pre-run calibration verification step in SOP' }],
      measurement: [{ id: 'f7', text: 'Single point temperature measurement' }, { id: 'f8', text: 'Calibration overdue' }],
      environment: [{ id: 'f9', text: 'Ambient temperature variation minimal' }],
    },
    actions: [
      { id: 'a1', description: 'Implement automated calibration alert system in CMMS', type: 'CORRECTIVE', owner: 'Deepak Nair', dueDate: '2026-04-10', status: 'IN_PROGRESS' },
      { id: 'a2', description: 'Install redundant thermocouple on furnace HT-03', type: 'CORRECTIVE', owner: 'Vikram Patel', dueDate: '2026-04-15', status: 'PENDING' },
      { id: 'a3', description: 'Update heat treatment SOP to include pre-run thermocouple verification', type: 'PREVENTIVE', owner: 'Priya Sharma', dueDate: '2026-04-08', status: 'IN_PROGRESS' },
      { id: 'a4', description: 'Conduct refresher training for all furnace operators', type: 'PREVENTIVE', owner: 'Sunita Rao', dueDate: '2026-04-20', status: 'PENDING' },
    ],
    effectivenessCriteria: 'Zero hardness OOS incidents over 90-day monitoring period. All calibrations completed on schedule.',
    monitoringPeriodDays: 90,
    effectivenessResult: null,
    effectivenessEvidence: null,
    history: [
      { id: 'h1', timestamp: '2026-03-30T09:30:00Z', user: 'Priya Sharma', action: 'CAPA Initiated', details: 'CAPA created from NC-2026-0042' },
      { id: 'h2', timestamp: '2026-03-30T10:00:00Z', user: 'Priya Sharma', action: 'Containment Applied', details: 'Batch quarantined, furnace taken offline for inspection' },
      { id: 'h3', timestamp: '2026-03-31T14:00:00Z', user: 'Deepak Nair', action: 'Root Cause Analysis Started', details: '5-Why analysis initiated' },
    ],
    createdAt: '2026-03-30T09:30:00Z',
    updatedAt: '2026-03-31T14:00:00Z',
    closedAt: null,
    createdBy: 'Priya Sharma',
  },
  {
    id: 'capa2',
    capaNumber: 'CAPA-2026-0011',
    title: 'Preventive action for welding procedure gap',
    description: 'Internal audit finding revealed welders occasionally using incorrect WPS. Preventive action needed to strengthen procedure compliance.',
    source: 'AUDIT',
    severity: 'MAJOR',
    status: 'IMPLEMENTATION',
    department: 'Production',
    productProcess: 'Welding',
    linkedSourceRecord: 'AUD-2026-0003',
    owner: 'Vikram Patel',
    ownerId: 'u4',
    dueDate: '2026-04-15',
    fiveWhys: [
      { whyNumber: 1, question: 'Why was the wrong WPS used?', answer: 'Welder picked WPS from memory instead of checking the job card.' },
      { whyNumber: 2, question: 'Why did the welder not check the job card?', answer: 'Job card was not available at the welding station.' },
      { whyNumber: 3, question: 'Why was the job card not at the station?', answer: 'Production planning issued it late due to backlog.' },
    ],
    fishbone: {
      man: [{ id: 'f10', text: 'Welder relied on memory' }],
      machine: [{ id: 'f11', text: 'No digital WPS display at station' }],
      material: [],
      method: [{ id: 'f12', text: 'Job card delivery process not enforced' }, { id: 'f13', text: 'No verification step before welding' }],
      measurement: [],
      environment: [{ id: 'f14', text: 'High workload pressure' }],
    },
    actions: [
      { id: 'a5', description: 'Install digital WPS display terminals at all welding stations', type: 'CORRECTIVE', owner: 'Rajesh Kumar', dueDate: '2026-04-10', status: 'COMPLETED', completedDate: '2026-04-08' },
      { id: 'a6', description: 'Implement mandatory WPS scan-and-confirm before welding start', type: 'PREVENTIVE', owner: 'Vikram Patel', dueDate: '2026-04-12', status: 'IN_PROGRESS' },
    ],
    effectivenessCriteria: 'Zero WPS non-conformances over 60-day monitoring period.',
    monitoringPeriodDays: 60,
    effectivenessResult: null,
    effectivenessEvidence: null,
    history: [
      { id: 'h4', timestamp: '2026-03-25T10:00:00Z', user: 'Vikram Patel', action: 'CAPA Initiated', details: 'Raised from audit finding AUD-2026-0003' },
      { id: 'h5', timestamp: '2026-03-27T11:00:00Z', user: 'Vikram Patel', action: 'Root Cause Completed', details: '5-Why and fishbone analysis completed' },
      { id: 'h6', timestamp: '2026-03-28T09:00:00Z', user: 'Rajesh Kumar', action: 'Actions Defined', details: '2 actions defined and assigned' },
      { id: 'h7', timestamp: '2026-04-08T16:00:00Z', user: 'Rajesh Kumar', action: 'Action Completed', details: 'Digital WPS terminals installed at 8 stations' },
    ],
    createdAt: '2026-03-25T10:00:00Z',
    updatedAt: '2026-04-08T16:00:00Z',
    closedAt: null,
    createdBy: 'Sunita Rao',
  },
  {
    id: 'capa3',
    capaNumber: 'CAPA-2026-0010',
    title: 'Corrective action for surface finish customer complaint',
    description: 'Customer reported surface pitting on delivered parts. Investigation into surface treatment process required.',
    source: 'COMPLAINT',
    severity: 'MAJOR',
    status: 'ACTION_DEFINITION',
    department: 'Quality Assurance',
    productProcess: 'Surface Treatment',
    linkedSourceRecord: 'NC-2026-0039',
    owner: 'Priya Sharma',
    ownerId: 'u1',
    dueDate: '2026-04-25',
    fiveWhys: [
      { whyNumber: 1, question: 'Why did surface pitting occur?', answer: 'Phosphating bath concentration was below optimum levels.' },
      { whyNumber: 2, question: 'Why was the bath concentration low?', answer: 'Chemical replenishment was delayed by 2 days.' },
      { whyNumber: 3, question: 'Why was replenishment delayed?', answer: 'Chemical stock ran out and procurement lead time was underestimated.' },
    ],
    fishbone: {
      man: [{ id: 'f15', text: 'Operator did not escalate low stock' }],
      machine: [{ id: 'f16', text: 'No automated concentration monitoring' }],
      material: [{ id: 'f17', text: 'Chemical supplier delivery delay' }],
      method: [{ id: 'f18', text: 'No minimum stock level defined for chemicals' }],
      measurement: [{ id: 'f19', text: 'Manual bath testing frequency insufficient' }],
      environment: [],
    },
    actions: [],
    effectivenessCriteria: null,
    monitoringPeriodDays: 90,
    effectivenessResult: null,
    effectivenessEvidence: null,
    history: [
      { id: 'h8', timestamp: '2026-03-22T14:00:00Z', user: 'Priya Sharma', action: 'CAPA Initiated', details: 'Created from customer complaint CC-2026-018' },
      { id: 'h9', timestamp: '2026-03-24T09:00:00Z', user: 'Anita Desai', action: 'Root Cause Analysis Completed', details: 'Analysis shows chemical management gap' },
    ],
    createdAt: '2026-03-22T14:00:00Z',
    updatedAt: '2026-03-24T09:00:00Z',
    closedAt: null,
    createdBy: 'Rajesh Kumar',
  },
  {
    id: 'capa4',
    capaNumber: 'CAPA-2026-0009',
    title: 'Preventive action for calibration management improvement',
    description: 'Multiple calibration overdue incidents in Q1 2026. Systemic improvement to calibration scheduling process needed.',
    source: 'MANAGEMENT',
    severity: 'MINOR',
    status: 'EFFECTIVENESS_VERIFICATION',
    department: 'Quality Control',
    productProcess: 'Measurement',
    linkedSourceRecord: null,
    owner: 'Anita Desai',
    ownerId: 'u3',
    dueDate: '2026-04-05',
    fiveWhys: [
      { whyNumber: 1, question: 'Why were calibrations overdue?', answer: 'Calendar reminders were missed by responsible personnel.' },
      { whyNumber: 2, question: 'Why were reminders missed?', answer: 'Reminders were email-based and got buried in inbox.' },
      { whyNumber: 3, question: 'Why is the reminder system email-only?', answer: 'No integrated calibration management module in existing system.' },
    ],
    fishbone: {
      man: [{ id: 'f20', text: 'No dedicated calibration coordinator role' }],
      machine: [{ id: 'f21', text: 'CMMS lacks calibration tracking module' }],
      material: [],
      method: [{ id: 'f22', text: 'Email-based reminder system inadequate' }],
      measurement: [{ id: 'f23', text: '3 instruments found overdue in Q1' }],
      environment: [],
    },
    actions: [
      { id: 'a7', description: 'Deploy calibration tracking module in QuantumFlow CMMS', type: 'CORRECTIVE', owner: 'Deepak Nair', dueDate: '2026-03-20', status: 'COMPLETED', completedDate: '2026-03-18' },
      { id: 'a8', description: 'Assign calibration coordinator role to Meena Iyer', type: 'PREVENTIVE', owner: 'Anita Desai', dueDate: '2026-03-22', status: 'COMPLETED', completedDate: '2026-03-21' },
      { id: 'a9', description: 'Configure automated SMS + dashboard alerts for calibration due dates', type: 'PREVENTIVE', owner: 'Deepak Nair', dueDate: '2026-03-25', status: 'COMPLETED', completedDate: '2026-03-24' },
    ],
    effectivenessCriteria: 'Zero calibration overdue incidents for 30 consecutive days. All alerts acknowledged within 24 hours.',
    monitoringPeriodDays: 30,
    effectivenessResult: null,
    effectivenessEvidence: null,
    history: [
      { id: 'h10', timestamp: '2026-03-10T09:00:00Z', user: 'Anita Desai', action: 'CAPA Initiated', details: 'Raised from management review MR-2026-Q1' },
      { id: 'h11', timestamp: '2026-03-12T14:00:00Z', user: 'Anita Desai', action: 'Root Cause Completed', details: 'Systemic gap in calibration management identified' },
      { id: 'h12', timestamp: '2026-03-14T10:00:00Z', user: 'Deepak Nair', action: 'Actions Defined', details: '3 actions defined' },
      { id: 'h13', timestamp: '2026-03-24T16:00:00Z', user: 'Deepak Nair', action: 'All Actions Completed', details: 'Monitoring period started' },
    ],
    createdAt: '2026-03-10T09:00:00Z',
    updatedAt: '2026-03-24T16:00:00Z',
    closedAt: null,
    createdBy: 'Anita Desai',
  },
  {
    id: 'capa5',
    capaNumber: 'CAPA-2026-0008',
    title: 'Corrective action for dimensional deviation in CNC machining',
    description: 'Recurring dimensional non-conformances on valve body bore diameter. Tool wear compensation process needs improvement.',
    source: 'NC',
    severity: 'MAJOR',
    status: 'CLOSED',
    department: 'Production',
    productProcess: 'CNC Machining',
    linkedSourceRecord: 'NC-2026-0041',
    owner: 'Anita Desai',
    ownerId: 'u3',
    dueDate: '2026-03-25',
    fiveWhys: [
      { whyNumber: 1, question: 'Why was the bore oversize?', answer: 'Tool insert was worn beyond compensation limit.' },
      { whyNumber: 2, question: 'Why was tool wear not compensated?', answer: 'Operator did not adjust tool offset after measuring first article.' },
      { whyNumber: 3, question: 'Why did operator skip adjustment?', answer: 'First article was marginally within spec so operator continued.' },
    ],
    fishbone: {
      man: [{ id: 'f24', text: 'Operator judgement error on marginal first article' }],
      machine: [{ id: 'f25', text: 'No automatic tool wear compensation' }],
      material: [{ id: 'f26', text: 'Material hardness variation within spec' }],
      method: [{ id: 'f27', text: 'No defined threshold for tool offset adjustment' }],
      measurement: [{ id: 'f28', text: 'First article measurement protocol adequate' }],
      environment: [],
    },
    actions: [
      { id: 'a10', description: 'Define tool offset adjustment thresholds in work instruction', type: 'CORRECTIVE', owner: 'Vikram Patel', dueDate: '2026-03-15', status: 'VERIFIED', completedDate: '2026-03-14' },
      { id: 'a11', description: 'Implement SPC monitoring on critical dimensions', type: 'PREVENTIVE', owner: 'Anita Desai', dueDate: '2026-03-20', status: 'VERIFIED', completedDate: '2026-03-19' },
    ],
    effectivenessCriteria: 'No dimensional OOS on valve body for 30 days. Cpk > 1.33 on bore diameter.',
    monitoringPeriodDays: 30,
    effectivenessResult: 'PASS',
    effectivenessEvidence: 'SPC data shows Cpk of 1.67 over 30-day period. Zero dimensional NCs recorded.',
    history: [
      { id: 'h14', timestamp: '2026-03-01T09:00:00Z', user: 'Anita Desai', action: 'CAPA Initiated', details: 'Created from NC-2026-0041' },
      { id: 'h15', timestamp: '2026-03-05T10:00:00Z', user: 'Anita Desai', action: 'Root Cause Completed', details: 'Tool compensation gap identified' },
      { id: 'h16', timestamp: '2026-03-19T16:00:00Z', user: 'Vikram Patel', action: 'All Actions Completed', details: 'Work instruction updated, SPC deployed' },
      { id: 'h17', timestamp: '2026-03-25T11:00:00Z', user: 'Anita Desai', action: 'Effectiveness Verified', details: 'Cpk 1.67, zero NCs in monitoring period' },
      { id: 'h18', timestamp: '2026-03-25T11:30:00Z', user: 'Priya Sharma', action: 'CAPA Closed', details: 'Effectiveness verified, CAPA closed' },
    ],
    createdAt: '2026-03-01T09:00:00Z',
    updatedAt: '2026-03-25T11:30:00Z',
    closedAt: '2026-03-25T11:30:00Z',
    createdBy: 'Anita Desai',
  },
  {
    id: 'capa6',
    capaNumber: 'CAPA-2026-0007',
    title: 'Preventive action for incoming inspection sampling plan',
    description: 'Proactive review identified sampling plan for raw materials is based on outdated AQL levels. Update required.',
    source: 'PROACTIVE',
    severity: 'MINOR',
    status: 'CLOSED',
    department: 'Quality Control',
    productProcess: 'Incoming Inspection',
    linkedSourceRecord: null,
    owner: 'Sunita Rao',
    ownerId: 'u5',
    dueDate: '2026-03-20',
    fiveWhys: [
      { whyNumber: 1, question: 'Why is the sampling plan outdated?', answer: 'AQL levels were set 5 years ago and never reviewed.' },
      { whyNumber: 2, question: 'Why was the review not conducted?', answer: 'No periodic review requirement in quality manual.' },
      { whyNumber: 3, question: 'Why is periodic review not mandated?', answer: 'Gap in quality manual procedures for statistical methods.' },
    ],
    fishbone: {
      man: [],
      machine: [],
      material: [{ id: 'f29', text: 'Supplier quality has improved since original AQL' }],
      method: [{ id: 'f30', text: 'No periodic review cycle for sampling plans' }],
      measurement: [{ id: 'f31', text: 'Sampling plan based on IS 2500 Part 1 outdated edition' }],
      environment: [],
    },
    actions: [
      { id: 'a12', description: 'Revise sampling plan per IS 2500:2020 with updated AQL levels', type: 'CORRECTIVE', owner: 'Sunita Rao', dueDate: '2026-03-12', status: 'VERIFIED', completedDate: '2026-03-11' },
      { id: 'a13', description: 'Add annual sampling plan review to quality calendar', type: 'PREVENTIVE', owner: 'Priya Sharma', dueDate: '2026-03-15', status: 'VERIFIED', completedDate: '2026-03-14' },
    ],
    effectivenessCriteria: 'Revised sampling plan implemented. Annual review scheduled in quality calendar.',
    monitoringPeriodDays: 30,
    effectivenessResult: 'PASS',
    effectivenessEvidence: 'New sampling plan deployed. Calendar entry confirmed for March 2027 review.',
    history: [
      { id: 'h19', timestamp: '2026-02-20T09:00:00Z', user: 'Sunita Rao', action: 'CAPA Initiated', details: 'Proactive improvement identified during process review' },
      { id: 'h20', timestamp: '2026-03-14T16:00:00Z', user: 'Sunita Rao', action: 'All Actions Completed', details: 'Sampling plan revised and review scheduled' },
      { id: 'h21', timestamp: '2026-03-20T10:00:00Z', user: 'Priya Sharma', action: 'CAPA Closed', details: 'Effectiveness verified' },
    ],
    createdAt: '2026-02-20T09:00:00Z',
    updatedAt: '2026-03-20T10:00:00Z',
    closedAt: '2026-03-20T10:00:00Z',
    createdBy: 'Sunita Rao',
  },
  {
    id: 'capa7',
    capaNumber: 'CAPA-2026-0006',
    title: 'Corrective action for supplier non-conforming raw material',
    description: 'Two consecutive batches from supplier Mehta Steels had carbon content exceeding specification. Supplier corrective action required.',
    source: 'NC',
    severity: 'MAJOR',
    status: 'CONTAINMENT',
    department: 'Quality Control',
    productProcess: 'Incoming Inspection',
    linkedSourceRecord: 'NC-2026-0038',
    owner: 'Sunita Rao',
    ownerId: 'u5',
    dueDate: '2026-04-18',
    fiveWhys: [],
    fishbone: { man: [], machine: [], material: [], method: [], measurement: [], environment: [] },
    actions: [],
    effectivenessCriteria: null,
    monitoringPeriodDays: 90,
    effectivenessResult: null,
    effectivenessEvidence: null,
    history: [
      { id: 'h22', timestamp: '2026-03-29T11:00:00Z', user: 'Sunita Rao', action: 'CAPA Initiated', details: 'Created from NC-2026-0038, supplier issue' },
      { id: 'h23', timestamp: '2026-03-29T14:00:00Z', user: 'Sunita Rao', action: 'Containment Started', details: 'Tightened incoming inspection to 100% for Mehta Steels' },
    ],
    createdAt: '2026-03-29T11:00:00Z',
    updatedAt: '2026-03-29T14:00:00Z',
    closedAt: null,
    createdBy: 'Sunita Rao',
  },
  {
    id: 'capa8',
    capaNumber: 'CAPA-2026-0005',
    title: 'Preventive action for documentation control during shift handover',
    description: 'Observation from compliance audit that shift handover documentation is inconsistent across departments. Standardization needed.',
    source: 'AUDIT',
    severity: 'MINOR',
    status: 'INITIATED',
    department: 'Quality Assurance',
    productProcess: null,
    linkedSourceRecord: 'AUD-2026-0002',
    owner: 'Meena Iyer',
    ownerId: 'u6',
    dueDate: '2026-04-30',
    fiveWhys: [],
    fishbone: { man: [], machine: [], material: [], method: [], measurement: [], environment: [] },
    actions: [],
    effectivenessCriteria: null,
    monitoringPeriodDays: 60,
    effectivenessResult: null,
    effectivenessEvidence: null,
    history: [
      { id: 'h24', timestamp: '2026-03-30T08:00:00Z', user: 'Meena Iyer', action: 'CAPA Initiated', details: 'Created from audit observation AUD-2026-0002' },
    ],
    createdAt: '2026-03-30T08:00:00Z',
    updatedAt: '2026-03-30T08:00:00Z',
    closedAt: null,
    createdBy: 'Meena Iyer',
  },
];

// ── Hooks ───────────────────────────────────────────────────────────────────

interface CAPAFilters {
  status?: string;
  severity?: string;
  source?: string;
  department?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useCAPAs(filters: CAPAFilters = {}) {
  return useQuery<PaginatedResponse<CAPARecord>>({
    queryKey: ['capas', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/capas', { params: filters });
        return data;
      } catch {
        let filtered = [...mockCAPAs];
        if (filters.status) filtered = filtered.filter((c) => c.status === filters.status);
        if (filters.severity) filtered = filtered.filter((c) => c.severity === filters.severity);
        if (filters.source) filtered = filtered.filter((c) => c.source === filters.source);
        if (filters.department) filtered = filtered.filter((c) => c.department === filters.department);
        if (filters.search) {
          const q = filters.search.toLowerCase();
          filtered = filtered.filter(
            (c) =>
              c.title.toLowerCase().includes(q) ||
              c.capaNumber.toLowerCase().includes(q),
          );
        }
        return { data: filtered, total: filtered.length, page: 1, pageSize: 20, totalPages: 1 };
      }
    },
    staleTime: 30_000,
  });
}

export function useCAPA(id: string) {
  return useQuery<CAPARecord>({
    queryKey: ['capas', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/capas/${id}`);
        return data;
      } catch {
        const capa = mockCAPAs.find((c) => c.id === id);
        if (!capa) throw new Error('CAPA not found');
        return capa;
      }
    },
    enabled: !!id,
  });
}

export function useCreateCAPA() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/qms/capas', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['capas'] });
      toast.success('CAPA initiated successfully');
    },
    onError: () => {
      toast.error('Failed to initiate CAPA');
    },
  });
}
