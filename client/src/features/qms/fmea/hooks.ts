import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem } from '@/lib/apiShape';
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
    function: 'Deliver accurate tablet weight within ±5% of target (600 mg)',
    failureMode: 'Tablet weight out of specification — low weight',
    effect: 'Sub-potent dose delivered to patient; therapeutic failure risk',
    severity: 9,
    cause: 'Punch tip wear reducing fill volume in die cavity',
    occurrence: 4,
    preventionControl: 'Punch inspection per PM schedule SOP-EQ-012 (every 5M tablets)',
    detectionControl: 'In-process weight check every 30 min (10-tablet sample)',
    detection: 3,
    rpn: 108,
    actionPriority: 'MEDIUM',
    recommendedAction: 'Install automated weight-rejection system with real-time feedback to force control',
    responsible: 'Vikram Patel',
    targetDate: '2026-04-15',
    actionTaken: 'Automated inline weight rejection unit installed on Compression Line 2',
    newSeverity: 9,
    newOccurrence: 2,
    newDetection: 2,
    newRPN: 36,
  },
  {
    id: 'fm2',
    function: 'Deliver accurate tablet weight within ±5% of target (600 mg)',
    failureMode: 'Tablet weight uniformity failure — high variability across turret positions',
    effect: 'Batch fails Ph. Eur. 2.9.5 uniformity test; batch rejection and patient risk',
    severity: 10,
    cause: 'Granule particle size segregation in feed hopper causing density variation by position',
    occurrence: 3,
    preventionControl: 'Granulation endpoint moisture control; flow agent optimisation in formulation',
    detectionControl: 'Weight uniformity test (20 tablets) at compression start and mid-batch',
    detection: 4,
    rpn: 120,
    actionPriority: 'HIGH',
    recommendedAction: 'Install anti-segregation baffle in compression hopper; validate with 3 process qualification batches',
    responsible: 'Dr. Priya Sharma',
    targetDate: '2026-04-20',
    actionTaken: '',
    newSeverity: null,
    newOccurrence: null,
    newDetection: null,
    newRPN: null,
  },
  {
    id: 'fm3',
    function: 'Produce tablet with hardness 10–18 kP for adequate dissolution and friability',
    failureMode: 'Tablet hardness below specification (< 10 kP)',
    effect: 'Tablet friability failure; dissolution may be accelerated; packaging damage during handling',
    severity: 8,
    cause: 'Compression force set below validated range due to operator error during shift changeover',
    occurrence: 5,
    preventionControl: 'BMR pre-set compression force parameters; supervisor sign-off on machine setup',
    detectionControl: 'Hardness test (6 tablets) every 30 min during compression',
    detection: 2,
    rpn: 80,
    actionPriority: 'LOW',
    recommendedAction: 'Implement recipe-locked compression force via HMI with password-controlled override',
    responsible: 'Rajesh Kumar',
    targetDate: '2026-05-01',
    actionTaken: 'Recipe-lock feature enabled on Fette 2090 HMI; operator training completed',
    newSeverity: 8,
    newOccurrence: 2,
    newDetection: 2,
    newRPN: 32,
  },
  {
    id: 'fm4',
    function: 'Achieve dissolution Q ≥ 80% at 45 min in pH 6.8 phosphate buffer',
    failureMode: 'Dissolution failure — Q value below specification at 45-minute timepoint',
    effect: 'Batch fails release specification; potential sub-therapeutic bioavailability in patients',
    severity: 9,
    cause: 'Granulation moisture content above upper limit (> 2.0% LOD) resulting in over-dense granules',
    occurrence: 4,
    preventionControl: 'Fluid bed dryer endpoint LOD control per BMR; NIR moisture monitoring during drying',
    detectionControl: 'Stage 1 dissolution (6 vessels) at batch release; in-process hardness as surrogate indicator',
    detection: 5,
    rpn: 180,
    actionPriority: 'HIGH',
    recommendedAction: 'Install in-line NIR moisture sensor on fluid bed dryer; define automated stop at LOD 1.8%',
    responsible: 'Anita Desai',
    targetDate: '2026-05-15',
    actionTaken: '',
    newSeverity: null,
    newOccurrence: null,
    newDetection: null,
    newRPN: null,
  },
  {
    id: 'fm5',
    function: 'Apply film coating uniformly to protect tablet and mask bitterness',
    failureMode: 'Film coating defect — logo bridging / tablet picking',
    effect: 'Cosmetic defect causing patient confusion; possible dose inaccuracy if coating contains API',
    severity: 6,
    cause: 'Inlet air temperature too high causing premature drying and sticking during pan coating',
    occurrence: 4,
    preventionControl: 'Validated coating parameters locked in recipe (inlet temp 55–65°C, spray rate 8–12 g/min)',
    detectionControl: 'Visual inspection of 50-tablet sample every 15 min; AQL final visual inspection',
    detection: 3,
    rpn: 72,
    actionPriority: 'LOW',
    recommendedAction: 'Add automated inlet temperature interlock to suspend spray if > 68°C; operator alert alarm',
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
    function: 'Blend active (Paracetamol 500 mg) uniformly with excipients to achieve content uniformity',
    failureMode: 'Blend non-uniformity — content uniformity failure (RSD > 5%)',
    effect: 'Tablets with varying API content; patient over/under-dose; batch failure at release',
    severity: 10,
    cause: 'API agglomeration due to electrostatic charge; inadequate de-lumping prior to blending',
    occurrence: 2,
    preventionControl: 'API de-lumping through 0.5 mm screen prior to blending; earthing of blender vessel',
    detectionControl: 'Blend uniformity sampling (10 locations, USP <905>) before compression',
    detection: 3,
    rpn: 60,
    actionPriority: 'LOW',
    recommendedAction: 'Qualify humidity-controlled dispensing booth (RH 35–45%) to prevent API electrostatic agglomeration',
    responsible: 'Sunita Rao',
    targetDate: '2026-06-01',
    actionTaken: 'Humidity-controlled dispensing booth qualified; validation report approved',
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
    title: 'Paracetamol 500mg Tablet Compression — Process FMEA',
    type: 'PFMEA',
    productProcess: 'Tablet Compression — Fette 2090, Line 2',
    status: 'IN_PROGRESS',
    owner: 'Dr. Priya Sharma',
    ownerId: 'u1',
    teamMembers: ['Vikram Patel', 'Rajesh Kumar', 'Anita Desai'],
    scope: 'Full tablet compression process for Paracetamol 500mg from granule feed through compression, weight control, and tablet discharge; covering all 36 punch positions on Fette 2090 rotary press',
    maxRPN: 180,
    failureModes: mockFailureModes1,
    revisionHistory: [
      { version: '1.0', date: '2026-01-15', author: 'Dr. Priya Sharma', changes: 'Initial PFMEA creation for Paracetamol compression validation' },
      { version: '1.1', date: '2026-02-20', author: 'Vikram Patel', changes: 'Added FM4 (dissolution) and FM5 (coating defect) based on PQR 2025 trends' },
      { version: '1.2', date: '2026-03-10', author: 'Dr. Priya Sharma', changes: 'Updated RPN for FM1 after automated rejection unit installation' },
    ],
    createdAt: '2026-01-15T09:00:00Z',
    updatedAt: '2026-03-25T14:30:00Z',
  },
  {
    id: 'fmea2',
    fmeaNumber: 'FMEA-2026-002',
    title: 'Ondansetron 4mg/2mL Injection — Aseptic Fill Design FMEA',
    type: 'DFMEA',
    productProcess: 'Aseptic Filling — Vial Fill-Finish Line 1',
    status: 'UNDER_REVIEW',
    owner: 'Deepak Nair',
    ownerId: 'u2',
    teamMembers: ['Sunita Rao', 'Anita Desai'],
    scope: 'Design FMEA for aseptic fill-finish of Ondansetron 4mg/2mL injection in 10mL Type I borosilicate glass vials; covering vial preparation, filling, stoppering, capping, and 100% visual inspection',
    maxRPN: 210,
    failureModes: [],
    revisionHistory: [
      { version: '1.0', date: '2026-02-01', author: 'Deepak Nair', changes: 'Initial DFMEA aligned to EU GMP Annex 1 (2022 revision)' },
      { version: '2.0', date: '2026-03-15', author: 'Deepak Nair', changes: 'Major revision after aseptic process simulation (media fill) review' },
    ],
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-03-20T16:00:00Z',
  },
  {
    id: 'fmea3',
    fmeaNumber: 'FMEA-2026-003',
    title: 'Amoxicillin 250mg Capsule Encapsulation — Process FMEA',
    type: 'PFMEA',
    productProcess: 'Capsule Encapsulation — Bosch GKF 2500',
    status: 'APPROVED',
    owner: 'Vikram Patel',
    ownerId: 'u4',
    teamMembers: ['Dr. Priya Sharma', 'Rajesh Kumar'],
    scope: 'Process FMEA for hard gelatin capsule filling of Amoxicillin 250mg on Bosch GKF 2500 encapsulator; covering powder feed, fill weight control, capsule lock, and in-process inspection',
    maxRPN: 168,
    failureModes: [],
    revisionHistory: [
      { version: '1.0', date: '2025-11-10', author: 'Vikram Patel', changes: 'Initial PFMEA for new encapsulation line GKF 2500' },
      { version: '1.1', date: '2026-01-20', author: 'Vikram Patel', changes: 'Updated after annual process review; added fill weight variability failure mode' },
    ],
    createdAt: '2025-11-10T08:00:00Z',
    updatedAt: '2026-03-18T11:00:00Z',
  },
  {
    id: 'fmea4',
    fmeaNumber: 'FMEA-2026-004',
    title: 'Purified Water System — Distribution Loop Process FMEA',
    type: 'PFMEA',
    productProcess: 'Purified Water Generation & Distribution Loop',
    status: 'DRAFT',
    owner: 'Sunita Rao',
    ownerId: 'u5',
    teamMembers: ['Deepak Nair', 'Vikram Patel'],
    scope: 'Process FMEA for purified water generation (reverse osmosis + CEDI) and ambient distribution loop serving QC laboratory and manufacturing areas; covering 12 user points (UPs) per Schedule M requirements',
    maxRPN: 96,
    failureModes: [],
    revisionHistory: [
      { version: '0.1', date: '2026-03-20', author: 'Sunita Rao', changes: 'Draft creation following WU-04 microbial excursion (NC-2026-0015)' },
    ],
    createdAt: '2026-03-20T13:00:00Z',
    updatedAt: '2026-03-28T10:00:00Z',
  },
  {
    id: 'fmea5',
    fmeaNumber: 'FMEA-2026-005',
    title: 'Metformin 500mg Tablet — Granulation Process FMEA',
    type: 'PFMEA',
    productProcess: 'Wet Granulation — High-Shear Granulator HSG-600L',
    status: 'IN_PROGRESS',
    owner: 'Rajesh Kumar',
    ownerId: 'u6',
    teamMembers: ['Dr. Priya Sharma', 'Anita Desai', 'Deepak Nair'],
    scope: 'Process FMEA for wet granulation of Metformin 500mg covering dispensing, dry mixing, binder addition, wet massing, fluid bed drying, and milling; aligned to ICH Q8 design space and validated CPPs',
    maxRPN: 192,
    failureModes: [],
    revisionHistory: [
      { version: '1.0', date: '2026-02-15', author: 'Rajesh Kumar', changes: 'Initial PFMEA creation following repeat dissolution failures (NC-2026-0039)' },
      { version: '1.1', date: '2026-03-22', author: 'Rajesh Kumar', changes: 'Added granulation moisture and LOD failure modes; updated detection controls' },
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
        // Backend mount is /qms/fmea (singular)
        const { data } = await api.get('/qms/fmea', { params: filters });
        return unwrapList<FMEA>(data);
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
        const { data } = await api.get(`/qms/fmea/${id}`);
        return unwrapItem<FMEA>(data);
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
