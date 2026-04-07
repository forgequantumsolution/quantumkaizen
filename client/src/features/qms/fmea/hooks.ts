import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// ── Types ───────────────────────────────────────────────────────────────────

export interface FMEAFailureMode {
  id: string;
  function: string;
  failureMode: string;
  effect: string;
  severity: number;
  cause: string;
  occurrence: number;
  preventionControl: string;
  detectionControl: string;
  detection: number;
  rpn: number;
  actionPriority: 'HIGH' | 'MEDIUM' | 'LOW';
  recommendedAction: string;
  responsible: string;
  targetDate: string;
  actionTaken: string;
  newSeverity: number | null;
  newOccurrence: number | null;
  newDetection: number | null;
  newRPN: number | null;
}

export interface FMEA {
  id: string;
  fmeaNumber: string;
  title: string;
  type: 'DFMEA' | 'PFMEA';
  productProcess: string;
  status: string;
  owner: string;
  ownerId: string;
  teamMembers: string[];
  scope: string;
  maxRPN: number;
  failureModes: FMEAFailureMode[];
  revisionHistory: { version: string; date: string; author: string; changes: string }[];
  createdAt: string;
  updatedAt: string;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

const mockFailureModes1: FMEAFailureMode[] = [
  {
    id: 'fm1',
    function: 'Apply braking force to wheel assembly',
    failureMode: 'Insufficient braking force',
    effect: 'Extended stopping distance; potential collision',
    severity: 9,
    cause: 'Brake pad wear beyond specification limit',
    occurrence: 4,
    preventionControl: 'Incoming material inspection per IS-2062',
    detectionControl: 'End-of-line brake dynamometer test',
    detection: 3,
    rpn: 108,
    actionPriority: 'MEDIUM',
    recommendedAction: 'Implement automated pad thickness measurement at assembly',
    responsible: 'Vikram Patel',
    targetDate: '2026-04-15',
    actionTaken: 'Automated gauge installed on Line 3',
    newSeverity: 9,
    newOccurrence: 2,
    newDetection: 2,
    newRPN: 36,
  },
  {
    id: 'fm2',
    function: 'Apply braking force to wheel assembly',
    failureMode: 'Brake lockup during normal operation',
    effect: 'Loss of vehicle control; safety hazard',
    severity: 10,
    cause: 'Hydraulic valve sticking due to contamination',
    occurrence: 3,
    preventionControl: 'Cleanroom assembly environment',
    detectionControl: 'Functional test with ABS simulation',
    detection: 4,
    rpn: 120,
    actionPriority: 'HIGH',
    recommendedAction: 'Add inline filtration system to hydraulic fluid supply',
    responsible: 'Priya Sharma',
    targetDate: '2026-04-20',
    actionTaken: '',
    newSeverity: null,
    newOccurrence: null,
    newDetection: null,
    newRPN: null,
  },
  {
    id: 'fm3',
    function: 'Transmit hydraulic pressure to caliper',
    failureMode: 'Brake line leakage',
    effect: 'Gradual loss of braking; customer complaint',
    severity: 8,
    cause: 'Improper torque on fitting connections',
    occurrence: 5,
    preventionControl: 'Torque-controlled power tools with error proofing',
    detectionControl: 'Pressure decay test at end of line',
    detection: 2,
    rpn: 80,
    actionPriority: 'LOW',
    recommendedAction: 'Implement digital torque tracking with Poka-Yoke verification',
    responsible: 'Rajesh Kumar',
    targetDate: '2026-05-01',
    actionTaken: 'Digital torque system installed; pilot running',
    newSeverity: 8,
    newOccurrence: 2,
    newDetection: 2,
    newRPN: 32,
  },
  {
    id: 'fm4',
    function: 'Dissipate heat from braking friction',
    failureMode: 'Brake disc warping under thermal stress',
    effect: 'Vibration during braking; NVH complaint',
    severity: 6,
    cause: 'Uneven material composition in casting',
    occurrence: 4,
    preventionControl: 'Supplier material certification review',
    detectionControl: 'Dimensional check using CMM post-machining',
    detection: 5,
    rpn: 120,
    actionPriority: 'MEDIUM',
    recommendedAction: 'Tighten incoming material specification for carbon content uniformity',
    responsible: 'Anita Desai',
    targetDate: '2026-04-25',
    actionTaken: '',
    newSeverity: null,
    newOccurrence: null,
    newDetection: null,
    newRPN: null,
  },
  {
    id: 'fm5',
    function: 'Provide audible wear indication',
    failureMode: 'Wear indicator fails to produce sound',
    effect: 'Customer unaware of pad wear; potential disc damage',
    severity: 7,
    cause: 'Incorrect wear indicator positioning during assembly',
    occurrence: 3,
    preventionControl: 'Assembly work instruction with visual aids',
    detectionControl: 'Manual visual inspection',
    detection: 6,
    rpn: 126,
    actionPriority: 'MEDIUM',
    recommendedAction: 'Design Poka-Yoke fixture for indicator placement',
    responsible: 'Deepak Nair',
    targetDate: '2026-05-10',
    actionTaken: '',
    newSeverity: null,
    newOccurrence: null,
    newDetection: null,
    newRPN: null,
  },
  {
    id: 'fm6',
    function: 'Maintain structural integrity under load',
    failureMode: 'Caliper bracket fracture',
    effect: 'Complete brake failure; catastrophic safety risk',
    severity: 10,
    cause: 'Fatigue crack initiation at stress concentration point',
    occurrence: 2,
    preventionControl: 'FEA analysis during design phase',
    detectionControl: 'Magnetic particle inspection on 100% of brackets',
    detection: 3,
    rpn: 60,
    actionPriority: 'LOW',
    recommendedAction: 'Redesign fillet radius to reduce stress concentration factor',
    responsible: 'Sunita Rao',
    targetDate: '2026-06-01',
    actionTaken: 'Design revision B completed; validation pending',
    newSeverity: 10,
    newOccurrence: 1,
    newDetection: 2,
    newRPN: 20,
  },
];

export const mockFMEAs: FMEA[] = [
  {
    id: 'fmea1',
    fmeaNumber: 'FMEA-2026-001',
    title: 'Brake Assembly Process FMEA',
    type: 'PFMEA',
    productProcess: 'Brake Assembly Line 3',
    status: 'IN_PROGRESS',
    owner: 'Priya Sharma',
    ownerId: 'u1',
    teamMembers: ['Vikram Patel', 'Rajesh Kumar', 'Anita Desai'],
    scope: 'Complete brake assembly process from component staging through final testing on Line 3',
    maxRPN: 126,
    failureModes: mockFailureModes1,
    revisionHistory: [
      { version: '1.0', date: '2026-01-15', author: 'Priya Sharma', changes: 'Initial FMEA creation' },
      { version: '1.1', date: '2026-02-20', author: 'Vikram Patel', changes: 'Added failure modes FM3 and FM4' },
      { version: '1.2', date: '2026-03-10', author: 'Priya Sharma', changes: 'Updated RPN for FM1 after action completion' },
    ],
    createdAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-03-25T14:30:00Z',
  },
  {
    id: 'fmea2',
    fmeaNumber: 'FMEA-2026-002',
    title: 'Hydraulic Valve Design FMEA',
    type: 'DFMEA',
    productProcess: 'Hydraulic Control Valve HCV-500',
    status: 'UNDER_REVIEW',
    owner: 'Deepak Nair',
    ownerId: 'u2',
    teamMembers: ['Sunita Rao', 'Anita Desai'],
    scope: 'Design FMEA for hydraulic control valve HCV-500 series covering all operating conditions',
    maxRPN: 210,
    failureModes: [],
    revisionHistory: [
      { version: '1.0', date: '2026-02-01', author: 'Deepak Nair', changes: 'Initial design FMEA' },
      { version: '2.0', date: '2026-03-15', author: 'Deepak Nair', changes: 'Major revision after design review' },
    ],
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-03-20T16:00:00Z',
  },
  {
    id: 'fmea3',
    fmeaNumber: 'FMEA-2026-003',
    title: 'CNC Machining Process FMEA',
    type: 'PFMEA',
    productProcess: 'CNC Turning Cell 2',
    status: 'APPROVED',
    owner: 'Vikram Patel',
    ownerId: 'u4',
    teamMembers: ['Priya Sharma', 'Rajesh Kumar'],
    scope: 'Process FMEA for CNC turning operations including setup, machining, and in-process inspection',
    maxRPN: 168,
    failureModes: [],
    revisionHistory: [
      { version: '1.0', date: '2025-11-10', author: 'Vikram Patel', changes: 'Initial FMEA' },
      { version: '1.1', date: '2026-01-20', author: 'Vikram Patel', changes: 'Updated after annual review' },
    ],
    createdAt: '2025-11-10T08:00:00Z',
    updatedAt: '2026-03-18T11:00:00Z',
  },
  {
    id: 'fmea4',
    fmeaNumber: 'FMEA-2026-004',
    title: 'Pressure Vessel Welding FMEA',
    type: 'PFMEA',
    productProcess: 'Welding Bay - Pressure Vessels',
    status: 'DRAFT',
    owner: 'Sunita Rao',
    ownerId: 'u5',
    teamMembers: ['Deepak Nair', 'Vikram Patel'],
    scope: 'Welding process FMEA for circumferential and longitudinal seam welds on pressure vessels',
    maxRPN: 96,
    failureModes: [],
    revisionHistory: [
      { version: '0.1', date: '2026-03-20', author: 'Sunita Rao', changes: 'Draft creation' },
    ],
    createdAt: '2026-03-20T13:00:00Z',
    updatedAt: '2026-03-28T10:00:00Z',
  },
  {
    id: 'fmea5',
    fmeaNumber: 'FMEA-2026-005',
    title: 'Electric Motor Stator Design FMEA',
    type: 'DFMEA',
    productProcess: 'Stator Assembly EMS-200',
    status: 'IN_PROGRESS',
    owner: 'Rajesh Kumar',
    ownerId: 'u6',
    teamMembers: ['Priya Sharma', 'Anita Desai', 'Deepak Nair'],
    scope: 'Design FMEA for electric motor stator covering insulation, winding, and lamination stack',
    maxRPN: 192,
    failureModes: [],
    revisionHistory: [
      { version: '1.0', date: '2026-02-15', author: 'Rajesh Kumar', changes: 'Initial DFMEA creation' },
      { version: '1.1', date: '2026-03-22', author: 'Rajesh Kumar', changes: 'Added thermal failure modes' },
    ],
    createdAt: '2026-02-15T11:00:00Z',
    updatedAt: '2026-03-22T15:00:00Z',
  },
];

// ── Hooks ───────────────────────────────────────────────────────────────────

interface FMEAFilters {
  type?: string;
  status?: string;
  search?: string;
}

export function useFMEAs(filters: FMEAFilters = {}) {
  return useQuery({
    queryKey: ['fmeas', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/fmeas', { params: filters });
        return data;
      } catch {
        let filtered = [...mockFMEAs];
        if (filters.type) filtered = filtered.filter((f) => f.type === filters.type);
        if (filters.status) filtered = filtered.filter((f) => f.status === filters.status);
        if (filters.search) {
          const q = filters.search.toLowerCase();
          filtered = filtered.filter(
            (f) =>
              f.title.toLowerCase().includes(q) ||
              f.fmeaNumber.toLowerCase().includes(q),
          );
        }
        return { data: filtered, total: filtered.length, page: 1, pageSize: 20, totalPages: 1 };
      }
    },
    staleTime: 30_000,
  });
}

export function useFMEA(id: string) {
  return useQuery<FMEA>({
    queryKey: ['fmeas', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/fmeas/${id}`);
        return data;
      } catch {
        const fmea = mockFMEAs.find((f) => f.id === id);
        if (!fmea) throw new Error('FMEA not found');
        // For fmea1, return with failure modes; for others, generate some
        if (fmea.id === 'fmea1') return fmea;
        return { ...fmea, failureModes: mockFailureModes1.slice(0, 3) };
      }
    },
    enabled: !!id,
  });
}

export function useCreateFMEA() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/qms/fmeas', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fmeas'] });
      toast.success('FMEA created successfully');
    },
    onError: () => {
      toast.error('Failed to create FMEA');
    },
  });
}
