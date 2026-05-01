import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

// ── Types ───────────────────────────────────────────────────────────────────

export type CellStatus = 'COMPLETED' | 'EXPIRED' | 'OVERDUE' | 'IN_PROGRESS' | 'NOT_REQUIRED' | 'NOT_STARTED';

export interface CompetencyEmployee {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  role: string;
}

export interface CompetencyProgram {
  id: string;
  title: string;
  shortCode: string;
}

export interface MatrixCell {
  employeeId: string;
  programId: string;
  status: CellStatus;
  score: number | null;
  completionDate: string | null;
  expiryDate: string | null;
  dueDate: string | null;
}

export interface GapEntry {
  employee: CompetencyEmployee;
  overdueCount: number;
  notStartedCount: number;
  expiredCount: number;
  compliancePercent: number;
}

export interface CompetencyMatrix {
  employees: CompetencyEmployee[];
  programs: CompetencyProgram[];
  cells: MatrixCell[];
}

export interface GapAnalysis {
  gaps: GapEntry[];
  totalGaps: number;
  deptCompliance: { department: string; compliance: number; employeeCount: number }[];
}

// ── Hooks ───────────────────────────────────────────────────────────────────

interface CompetencyFilters {
  department?: string;
  role?: string;
}

const EMPTY_MATRIX: CompetencyMatrix = { employees: [], programs: [], cells: [] };
const EMPTY_GAPS: GapAnalysis = { gaps: [], totalGaps: 0, deptCompliance: [] };

export function useCompetencyMatrix(filters: CompetencyFilters = {}) {
  return useQuery<CompetencyMatrix>({
    queryKey: ['lms', 'competency', 'matrix', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/lms/competency/matrix', { params: filters });
        if (!data || typeof data !== 'object') return EMPTY_MATRIX;
        return {
          employees: Array.isArray(data.employees) ? data.employees : [],
          programs: Array.isArray(data.programs) ? data.programs : [],
          cells: Array.isArray(data.cells) ? data.cells : [],
        };
      } catch {
        return EMPTY_MATRIX;
      }
    },
    initialData: EMPTY_MATRIX,
  });
}

export function useGapAnalysis(filters: CompetencyFilters = {}) {
  return useQuery<GapAnalysis>({
    queryKey: ['lms', 'competency', 'gaps', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/lms/competency/gap-analysis', { params: filters });
        if (!data || typeof data !== 'object') return EMPTY_GAPS;
        return {
          gaps: Array.isArray(data.gaps) ? data.gaps : [],
          totalGaps: typeof data.totalGaps === 'number' ? data.totalGaps : 0,
          deptCompliance: Array.isArray(data.deptCompliance) ? data.deptCompliance : [],
        };
      } catch {
        return EMPTY_GAPS;
      }
    },
    initialData: EMPTY_GAPS,
  });
}
