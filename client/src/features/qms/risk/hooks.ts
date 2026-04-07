import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { PaginatedResponse } from '@/types';
import toast from 'react-hot-toast';

// ── Types ───────────────────────────────────────────────────────────────────

export type RiskCategory = 'OPERATIONAL' | 'SAFETY' | 'QUALITY' | 'ENVIRONMENTAL' | 'FINANCIAL';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ControlHierarchy = 'ELIMINATION' | 'SUBSTITUTION' | 'ENGINEERING' | 'ADMINISTRATIVE' | 'PPE';

export interface ControlMeasure {
  id: string;
  hierarchy: ControlHierarchy;
  description: string;
  owner: string;
  status: 'PLANNED' | 'IMPLEMENTED' | 'VERIFIED';
}

export interface RiskHistoryEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

export interface RiskRecord {
  id: string;
  riskNumber: string;
  title: string;
  description: string;
  category: RiskCategory;
  department: string;
  likelihood: number;
  consequence: number;
  riskScore: number;
  riskLevel: RiskLevel;
  controls: ControlMeasure[];
  residualLikelihood: number;
  residualConsequence: number;
  residualScore: number;
  residualLevel: RiskLevel;
  owner: string;
  ownerId: string;
  reviewDate: string;
  history: RiskHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function calcRiskLevel(score: number): RiskLevel {
  if (score >= 15) return 'CRITICAL';
  if (score >= 10) return 'HIGH';
  if (score >= 5) return 'MEDIUM';
  return 'LOW';
}

export function riskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'CRITICAL': return 'bg-red-500';
    case 'HIGH': return 'bg-orange-500';
    case 'MEDIUM': return 'bg-yellow-400';
    case 'LOW': return 'bg-emerald-500';
  }
}

export function riskLevelBadge(level: RiskLevel): 'danger' | 'warning' | 'success' | 'default' {
  switch (level) {
    case 'CRITICAL': return 'danger';
    case 'HIGH': return 'warning';
    case 'MEDIUM': return 'default';
    case 'LOW': return 'success';
  }
}

// ── Mock Data ───────────────────────────────────────────────────────────────

export const mockRisks: RiskRecord[] = [
  {
    id: 'r1',
    riskNumber: 'RSK-2026-0018',
    title: 'Pressure vessel weld failure risk during hydrostatic testing',
    description: 'Risk of weld joint failure during hydrostatic test due to potential residual stresses and hydrogen-induced cracking in thick-wall pressure vessels.',
    category: 'SAFETY',
    department: 'Production',
    likelihood: 2,
    consequence: 5,
    riskScore: 10,
    riskLevel: 'HIGH',
    controls: [
      { id: 'cm1', hierarchy: 'ENGINEERING', description: 'PWHT mandatory for all welds >25mm wall thickness', owner: 'Vikram Patel', status: 'IMPLEMENTED' },
      { id: 'cm2', hierarchy: 'ENGINEERING', description: '100% radiographic testing of all butt welds', owner: 'Deepak Nair', status: 'IMPLEMENTED' },
      { id: 'cm3', hierarchy: 'ADMINISTRATIVE', description: 'Hydro test procedure with safe zone barricading', owner: 'Rajesh Kumar', status: 'IMPLEMENTED' },
      { id: 'cm4', hierarchy: 'PPE', description: 'Blast shields and safety gear for test operators', owner: 'Sunita Rao', status: 'VERIFIED' },
    ],
    residualLikelihood: 1,
    residualConsequence: 5,
    residualScore: 5,
    residualLevel: 'MEDIUM',
    owner: 'Vikram Patel',
    ownerId: 'u4',
    reviewDate: '2026-06-30',
    history: [
      { id: 'rh1', timestamp: '2026-01-15T10:00:00Z', user: 'Vikram Patel', action: 'Risk Identified', details: 'Identified during HAZOP review of pressure vessel manufacturing process' },
      { id: 'rh2', timestamp: '2026-02-01T09:00:00Z', user: 'Deepak Nair', action: 'Controls Implemented', details: 'NDE and PWHT controls put in place' },
    ],
    createdAt: '2026-01-15T10:00:00Z',
    updatedAt: '2026-03-15T10:00:00Z',
  },
  {
    id: 'r2',
    riskNumber: 'RSK-2026-0017',
    title: 'Chemical splash exposure in phosphating line',
    description: 'Risk of operator exposure to acidic phosphating chemicals during tank maintenance and manual top-up operations.',
    category: 'SAFETY',
    department: 'Production',
    likelihood: 3,
    consequence: 4,
    riskScore: 12,
    riskLevel: 'HIGH',
    controls: [
      { id: 'cm5', hierarchy: 'SUBSTITUTION', description: 'Evaluate less hazardous phosphating chemistry', owner: 'Priya Sharma', status: 'PLANNED' },
      { id: 'cm6', hierarchy: 'ENGINEERING', description: 'Automated chemical dosing system installation', owner: 'Rajesh Kumar', status: 'IMPLEMENTED' },
      { id: 'cm7', hierarchy: 'PPE', description: 'Chemical-resistant aprons, face shields, nitrile gloves mandatory', owner: 'Sunita Rao', status: 'VERIFIED' },
    ],
    residualLikelihood: 2,
    residualConsequence: 3,
    residualScore: 6,
    residualLevel: 'MEDIUM',
    owner: 'Sunita Rao',
    ownerId: 'u5',
    reviewDate: '2026-05-15',
    history: [
      { id: 'rh3', timestamp: '2026-02-10T11:00:00Z', user: 'Sunita Rao', action: 'Risk Identified', details: 'Near-miss incident prompted risk assessment' },
    ],
    createdAt: '2026-02-10T11:00:00Z',
    updatedAt: '2026-03-20T14:00:00Z',
  },
  {
    id: 'r3',
    riskNumber: 'RSK-2026-0016',
    title: 'Critical dimension drift on CNC machining centers',
    description: 'Progressive dimensional drift risk on aging CNC machines leading to out-of-specification parts and increased scrap rates.',
    category: 'QUALITY',
    department: 'Production',
    likelihood: 4,
    consequence: 3,
    riskScore: 12,
    riskLevel: 'HIGH',
    controls: [
      { id: 'cm8', hierarchy: 'ENGINEERING', description: 'Implement SPC with automatic tool offset compensation', owner: 'Anita Desai', status: 'IMPLEMENTED' },
      { id: 'cm9', hierarchy: 'ADMINISTRATIVE', description: 'Mandatory first-article and last-article inspection per setup', owner: 'Deepak Nair', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 2,
    residualConsequence: 3,
    residualScore: 6,
    residualLevel: 'MEDIUM',
    owner: 'Anita Desai',
    ownerId: 'u3',
    reviewDate: '2026-06-01',
    history: [
      { id: 'rh4', timestamp: '2026-01-20T09:00:00Z', user: 'Anita Desai', action: 'Risk Identified', details: 'Trend analysis showed increasing scrap rate on CNC-03 and CNC-05' },
    ],
    createdAt: '2026-01-20T09:00:00Z',
    updatedAt: '2026-03-10T11:00:00Z',
  },
  {
    id: 'r4',
    riskNumber: 'RSK-2026-0015',
    title: 'Supply chain disruption for specialty alloy steel',
    description: 'Single-source dependency on Mehta Steels for SA516 Grade 70 plates. Any supply disruption could halt production for 6-8 weeks.',
    category: 'OPERATIONAL',
    department: 'Quality Control',
    likelihood: 3,
    consequence: 4,
    riskScore: 12,
    riskLevel: 'HIGH',
    controls: [
      { id: 'cm10', hierarchy: 'ADMINISTRATIVE', description: 'Qualify alternate supplier (Tata Steel) for SA516 Gr70', owner: 'Sunita Rao', status: 'PLANNED' },
      { id: 'cm11', hierarchy: 'ADMINISTRATIVE', description: 'Maintain 3-month buffer stock for critical grades', owner: 'Rajesh Kumar', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 2,
    residualConsequence: 3,
    residualScore: 6,
    residualLevel: 'MEDIUM',
    owner: 'Rajesh Kumar',
    ownerId: 'u7',
    reviewDate: '2026-07-01',
    history: [
      { id: 'rh5', timestamp: '2026-02-01T10:00:00Z', user: 'Rajesh Kumar', action: 'Risk Identified', details: 'Identified during supplier performance review meeting' },
    ],
    createdAt: '2026-02-01T10:00:00Z',
    updatedAt: '2026-03-01T09:00:00Z',
  },
  {
    id: 'r5',
    riskNumber: 'RSK-2026-0014',
    title: 'Hazardous waste overflow from effluent treatment plant',
    description: 'Risk of treated effluent exceeding CPCB discharge limits during monsoon season due to excess inflow diluting treatment capacity.',
    category: 'ENVIRONMENTAL',
    department: 'HSE',
    likelihood: 3,
    consequence: 5,
    riskScore: 15,
    riskLevel: 'CRITICAL',
    controls: [
      { id: 'cm12', hierarchy: 'ENGINEERING', description: 'Install additional holding tank capacity (50KL)', owner: 'Rajesh Kumar', status: 'PLANNED' },
      { id: 'cm13', hierarchy: 'ENGINEERING', description: 'Stormwater diversion channel to separate rainwater from process effluent', owner: 'Deepak Nair', status: 'IMPLEMENTED' },
      { id: 'cm14', hierarchy: 'ADMINISTRATIVE', description: 'Daily pH and BOD monitoring during monsoon with 4-hourly checks', owner: 'Sunita Rao', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 2,
    residualConsequence: 4,
    residualScore: 8,
    residualLevel: 'MEDIUM',
    owner: 'Deepak Nair',
    ownerId: 'u8',
    reviewDate: '2026-05-01',
    history: [
      { id: 'rh6', timestamp: '2026-01-10T14:00:00Z', user: 'Deepak Nair', action: 'Risk Identified', details: 'Annual environmental risk review ahead of monsoon season' },
    ],
    createdAt: '2026-01-10T14:00:00Z',
    updatedAt: '2026-03-05T11:00:00Z',
  },
  {
    id: 'r6',
    riskNumber: 'RSK-2026-0013',
    title: 'Forklift collision in finished goods warehouse',
    description: 'High traffic area with pedestrian and forklift movement crossover. Previous near-miss reported in January 2026.',
    category: 'SAFETY',
    department: 'Production',
    likelihood: 3,
    consequence: 4,
    riskScore: 12,
    riskLevel: 'HIGH',
    controls: [
      { id: 'cm15', hierarchy: 'ENGINEERING', description: 'Install physical barriers and designated pedestrian walkways', owner: 'Rajesh Kumar', status: 'IMPLEMENTED' },
      { id: 'cm16', hierarchy: 'ENGINEERING', description: 'Proximity sensor alarms on forklifts', owner: 'Vikram Patel', status: 'PLANNED' },
      { id: 'cm17', hierarchy: 'ADMINISTRATIVE', description: 'Speed limit signage and forklift traffic management plan', owner: 'Sunita Rao', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 1,
    residualConsequence: 4,
    residualScore: 4,
    residualLevel: 'LOW',
    owner: 'Rajesh Kumar',
    ownerId: 'u7',
    reviewDate: '2026-06-15',
    history: [
      { id: 'rh7', timestamp: '2026-01-25T09:00:00Z', user: 'Rajesh Kumar', action: 'Risk Identified', details: 'Near-miss investigation in warehouse zone B' },
    ],
    createdAt: '2026-01-25T09:00:00Z',
    updatedAt: '2026-03-12T16:00:00Z',
  },
  {
    id: 'r7',
    riskNumber: 'RSK-2026-0012',
    title: 'Loss of quality records due to server failure',
    description: 'Quality records stored on local server without adequate backup. Single point of failure for regulatory compliance documentation.',
    category: 'OPERATIONAL',
    department: 'Quality Assurance',
    likelihood: 2,
    consequence: 4,
    riskScore: 8,
    riskLevel: 'MEDIUM',
    controls: [
      { id: 'cm18', hierarchy: 'ENGINEERING', description: 'Deploy QuantumFlow cloud-based QMS with daily backups', owner: 'Priya Sharma', status: 'IMPLEMENTED' },
      { id: 'cm19', hierarchy: 'ADMINISTRATIVE', description: 'Weekly backup verification and quarterly DR testing', owner: 'Deepak Nair', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 1,
    residualConsequence: 2,
    residualScore: 2,
    residualLevel: 'LOW',
    owner: 'Priya Sharma',
    ownerId: 'u1',
    reviewDate: '2026-09-01',
    history: [
      { id: 'rh8', timestamp: '2025-12-15T10:00:00Z', user: 'Priya Sharma', action: 'Risk Identified', details: 'IT infrastructure audit finding' },
      { id: 'rh9', timestamp: '2026-02-15T16:00:00Z', user: 'Deepak Nair', action: 'Controls Verified', details: 'Cloud backup and DR test completed successfully' },
    ],
    createdAt: '2025-12-15T10:00:00Z',
    updatedAt: '2026-02-15T16:00:00Z',
  },
  {
    id: 'r8',
    riskNumber: 'RSK-2026-0011',
    title: 'Financial impact from warranty claims on coating failures',
    description: 'Increasing trend of coating adhesion failures in field leading to warranty claims averaging INR 8 lakhs per quarter.',
    category: 'FINANCIAL',
    department: 'Quality Assurance',
    likelihood: 4,
    consequence: 3,
    riskScore: 12,
    riskLevel: 'HIGH',
    controls: [
      { id: 'cm20', hierarchy: 'ENGINEERING', description: 'Upgrade pre-treatment process to improve adhesion', owner: 'Anita Desai', status: 'IMPLEMENTED' },
      { id: 'cm21', hierarchy: 'ADMINISTRATIVE', description: 'Adhesion pull-off test on every batch before dispatch', owner: 'Priya Sharma', status: 'IMPLEMENTED' },
    ],
    residualLikelihood: 2,
    residualConsequence: 2,
    residualScore: 4,
    residualLevel: 'LOW',
    owner: 'Priya Sharma',
    ownerId: 'u1',
    reviewDate: '2026-06-30',
    history: [
      { id: 'rh10', timestamp: '2026-01-05T11:00:00Z', user: 'Priya Sharma', action: 'Risk Identified', details: 'Warranty claims trend analysis from Q4 2025' },
    ],
    createdAt: '2026-01-05T11:00:00Z',
    updatedAt: '2026-03-01T10:00:00Z',
  },
];

// ── Hooks ───────────────────────────────────────────────────────────────────

interface RiskFilters {
  riskLevel?: string;
  department?: string;
  category?: string;
  owner?: string;
  search?: string;
}

export function useRisks(filters: RiskFilters = {}) {
  return useQuery<PaginatedResponse<RiskRecord>>({
    queryKey: ['risks', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/risks', { params: filters });
        return data;
      } catch {
        let filtered = [...mockRisks];
        if (filters.riskLevel) filtered = filtered.filter((r) => r.riskLevel === filters.riskLevel);
        if (filters.department) filtered = filtered.filter((r) => r.department === filters.department);
        if (filters.category) filtered = filtered.filter((r) => r.category === filters.category);
        if (filters.owner) filtered = filtered.filter((r) => r.owner === filters.owner);
        if (filters.search) {
          const q = filters.search.toLowerCase();
          filtered = filtered.filter(
            (r) => r.title.toLowerCase().includes(q) || r.riskNumber.toLowerCase().includes(q),
          );
        }
        return { data: filtered, total: filtered.length, page: 1, pageSize: 20, totalPages: 1 };
      }
    },
    staleTime: 30_000,
  });
}

export function useRisk(id: string) {
  return useQuery<RiskRecord>({
    queryKey: ['risks', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/risks/${id}`);
        return data;
      } catch {
        const risk = mockRisks.find((r) => r.id === id);
        if (!risk) throw new Error('Risk not found');
        return risk;
      }
    },
    enabled: !!id,
  });
}

export function useCreateRisk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/qms/risks', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risks'] });
      toast.success('Risk added successfully');
    },
    onError: () => {
      toast.error('Failed to add risk');
    },
  });
}
