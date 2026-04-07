import { useMemo } from 'react';

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

// ── Mock Data ───────────────────────────────────────────────────────────────

export const mockEmployees: CompetencyEmployee[] = [
  { id: 'e1', name: 'Priya Sharma', employeeId: 'EMP-001', department: 'Quality Assurance', role: 'QA Inspector' },
  { id: 'e2', name: 'Rajesh Kumar', employeeId: 'EMP-002', department: 'Quality Assurance', role: 'Quality Manager' },
  { id: 'e3', name: 'Kavita Singh', employeeId: 'EMP-008', department: 'Quality Assurance', role: 'Document Controller' },
  { id: 'e4', name: 'Anita Desai', employeeId: 'EMP-003', department: 'Quality Assurance', role: 'Lab Analyst' },
  { id: 'e5', name: 'Vikram Patel', employeeId: 'EMP-004', department: 'Production', role: 'Production Supervisor' },
  { id: 'e6', name: 'Arun Mehta', employeeId: 'EMP-007', department: 'Production', role: 'Machine Operator' },
  { id: 'e7', name: 'Manoj Verma', employeeId: 'EMP-009', department: 'Production', role: 'Welding Operator' },
  { id: 'e8', name: 'Ravi Tiwari', employeeId: 'EMP-011', department: 'Production', role: 'Assembly Technician' },
  { id: 'e9', name: 'Deepak Nair', employeeId: 'EMP-006', department: 'Engineering', role: 'Design Engineer' },
  { id: 'e10', name: 'Neha Gupta', employeeId: 'EMP-010', department: 'Engineering', role: 'Process Engineer' },
  { id: 'e11', name: 'Sunita Rao', employeeId: 'EMP-005', department: 'Engineering', role: 'HSE Officer' },
  { id: 'e12', name: 'Amit Joshi', employeeId: 'EMP-012', department: 'Engineering', role: 'R&D Engineer' },
];

export const mockPrograms: CompetencyProgram[] = [
  { id: 'tp1', title: 'GMP Fundamentals', shortCode: 'GMP' },
  { id: 'tp2', title: 'ISO 9001 Awareness', shortCode: 'ISO' },
  { id: 'tp3', title: 'Welding Procedure Qualification', shortCode: 'WPQ' },
  { id: 'tp5', title: '5S Methodology', shortCode: '5S' },
  { id: 'tp6', title: 'Safety Induction', shortCode: 'SAF' },
  { id: 'tp8', title: 'Calibration Refresher', shortCode: 'CAL' },
];

export const mockMatrixCells: MatrixCell[] = [
  // Quality Assurance department
  { employeeId: 'e1', programId: 'tp1', status: 'COMPLETED', score: 92, completionDate: '2026-02-15', expiryDate: '2028-02-15', dueDate: null },
  { employeeId: 'e1', programId: 'tp2', status: 'COMPLETED', score: 88, completionDate: '2025-11-10', expiryDate: '2028-11-10', dueDate: null },
  { employeeId: 'e1', programId: 'tp3', status: 'NOT_REQUIRED', score: null, completionDate: null, expiryDate: null, dueDate: null },
  { employeeId: 'e1', programId: 'tp5', status: 'COMPLETED', score: 95, completionDate: '2025-08-20', expiryDate: '2027-08-20', dueDate: null },
  { employeeId: 'e1', programId: 'tp6', status: 'COMPLETED', score: 100, completionDate: '2025-06-01', expiryDate: '2026-06-01', dueDate: null },
  { employeeId: 'e1', programId: 'tp8', status: 'COMPLETED', score: 85, completionDate: '2026-01-10', expiryDate: '2027-01-10', dueDate: null },

  { employeeId: 'e2', programId: 'tp1', status: 'COMPLETED', score: 94, completionDate: '2026-01-20', expiryDate: '2028-01-20', dueDate: null },
  { employeeId: 'e2', programId: 'tp2', status: 'COMPLETED', score: 96, completionDate: '2025-10-05', expiryDate: '2028-10-05', dueDate: null },
  { employeeId: 'e2', programId: 'tp3', status: 'NOT_REQUIRED', score: null, completionDate: null, expiryDate: null, dueDate: null },
  { employeeId: 'e2', programId: 'tp5', status: 'COMPLETED', score: 90, completionDate: '2025-07-15', expiryDate: '2027-07-15', dueDate: null },
  { employeeId: 'e2', programId: 'tp6', status: 'COMPLETED', score: 98, completionDate: '2025-06-01', expiryDate: '2026-06-01', dueDate: null },
  { employeeId: 'e2', programId: 'tp8', status: 'IN_PROGRESS', score: null, completionDate: null, expiryDate: null, dueDate: '2026-04-15' },

  { employeeId: 'e3', programId: 'tp1', status: 'EXPIRED', score: 78, completionDate: '2024-03-15', expiryDate: '2026-03-15', dueDate: null },
  { employeeId: 'e3', programId: 'tp2', status: 'COMPLETED', score: 82, completionDate: '2025-09-20', expiryDate: '2028-09-20', dueDate: null },
  { employeeId: 'e3', programId: 'tp3', status: 'NOT_REQUIRED', score: null, completionDate: null, expiryDate: null, dueDate: null },
  { employeeId: 'e3', programId: 'tp5', status: 'OVERDUE', score: null, completionDate: null, expiryDate: null, dueDate: '2026-03-01' },
  { employeeId: 'e3', programId: 'tp6', status: 'EXPIRED', score: 90, completionDate: '2025-01-15', expiryDate: '2026-01-15', dueDate: null },
  { employeeId: 'e3', programId: 'tp8', status: 'NOT_STARTED', score: null, completionDate: null, expiryDate: null, dueDate: '2026-05-01' },

  { employeeId: 'e4', programId: 'tp1', status: 'IN_PROGRESS', score: null, completionDate: null, expiryDate: null, dueDate: '2026-04-30' },
  { employeeId: 'e4', programId: 'tp2', status: 'COMPLETED', score: 86, completionDate: '2025-12-01', expiryDate: '2028-12-01', dueDate: null },
  { employeeId: 'e4', programId: 'tp3', status: 'NOT_REQUIRED', score: null, completionDate: null, expiryDate: null, dueDate: null },
  { employeeId: 'e4', programId: 'tp5', status: 'COMPLETED', score: 88, completionDate: '2025-09-10', expiryDate: '2027-09-10', dueDate: null },
  { employeeId: 'e4', programId: 'tp6', status: 'COMPLETED', score: 95, completionDate: '2025-06-15', expiryDate: '2026-06-15', dueDate: null },
  { employeeId: 'e4', programId: 'tp8', status: 'COMPLETED', score: 90, completionDate: '2026-02-01', expiryDate: '2027-02-01', dueDate: null },

  // Production department
  { employeeId: 'e5', programId: 'tp1', status: 'COMPLETED', score: 88, completionDate: '2026-02-20', expiryDate: '2028-02-20', dueDate: null },
  { employeeId: 'e5', programId: 'tp2', status: 'COMPLETED', score: 80, completionDate: '2025-11-15', expiryDate: '2028-11-15', dueDate: null },
  { employeeId: 'e5', programId: 'tp3', status: 'COMPLETED', score: 92, completionDate: '2026-01-10', expiryDate: '2027-01-10', dueDate: null },
  { employeeId: 'e5', programId: 'tp5', status: 'COMPLETED', score: 98, completionDate: '2025-07-01', expiryDate: '2027-07-01', dueDate: null },
  { employeeId: 'e5', programId: 'tp6', status: 'COMPLETED', score: 100, completionDate: '2025-06-01', expiryDate: '2026-06-01', dueDate: null },
  { employeeId: 'e5', programId: 'tp8', status: 'NOT_REQUIRED', score: null, completionDate: null, expiryDate: null, dueDate: null },

  { employeeId: 'e6', programId: 'tp1', status: 'NOT_STARTED', score: null, completionDate: null, expiryDate: null, dueDate: '2026-04-15' },
  { employeeId: 'e6', programId: 'tp2', status: 'OVERDUE', score: null, completionDate: null, expiryDate: null, dueDate: '2026-03-15' },
  { employeeId: 'e6', programId: 'tp3', status: 'IN_PROGRESS', score: null, completionDate: null, expiryDate: null, dueDate: '2026-05-01' },
  { employeeId: 'e6', programId: 'tp5', status: 'COMPLETED', score: 82, completionDate: '2025-10-01', expiryDate: '2027-10-01', dueDate: null },
  { employeeId: 'e6', programId: 'tp6', status: 'COMPLETED', score: 92, completionDate: '2025-08-01', expiryDate: '2026-08-01', dueDate: null },
  { employeeId: 'e6', programId: 'tp8', status: 'NOT_REQUIRED', score: null, completionDate: null, expiryDate: null, dueDate: null },

  { employeeId: 'e7', programId: 'tp1', status: 'COMPLETED', score: 80, completionDate: '2025-12-01', expiryDate: '2027-12-01', dueDate: null },
  { employeeId: 'e7', programId: 'tp2', status: 'NOT_STARTED', score: null, completionDate: null, expiryDate: null, dueDate: '2026-05-01' },
  { employeeId: 'e7', programId: 'tp3', status: 'IN_PROGRESS', score: null, completionDate: null, expiryDate: null, dueDate: '2026-04-30' },
  { employeeId: 'e7', programId: 'tp5', status: 'OVERDUE', score: null, completionDate: null, expiryDate: null, dueDate: '2026-02-28' },
  { employeeId: 'e7', programId: 'tp6', status: 'EXPIRED', score: 88, completionDate: '2025-01-01', expiryDate: '2026-01-01', dueDate: null },
  { employeeId: 'e7', programId: 'tp8', status: 'NOT_REQUIRED', score: null, completionDate: null, expiryDate: null, dueDate: null },

  { employeeId: 'e8', programId: 'tp1', status: 'OVERDUE', score: null, completionDate: null, expiryDate: null, dueDate: '2026-03-10' },
  { employeeId: 'e8', programId: 'tp2', status: 'NOT_STARTED', score: null, completionDate: null, expiryDate: null, dueDate: '2026-06-01' },
  { employeeId: 'e8', programId: 'tp3', status: 'NOT_REQUIRED', score: null, completionDate: null, expiryDate: null, dueDate: null },
  { employeeId: 'e8', programId: 'tp5', status: 'IN_PROGRESS', score: null, completionDate: null, expiryDate: null, dueDate: '2026-04-15' },
  { employeeId: 'e8', programId: 'tp6', status: 'COMPLETED', score: 94, completionDate: '2025-09-01', expiryDate: '2026-09-01', dueDate: null },
  { employeeId: 'e8', programId: 'tp8', status: 'NOT_REQUIRED', score: null, completionDate: null, expiryDate: null, dueDate: null },

  // Engineering department
  { employeeId: 'e9', programId: 'tp1', status: 'COMPLETED', score: 86, completionDate: '2025-11-01', expiryDate: '2027-11-01', dueDate: null },
  { employeeId: 'e9', programId: 'tp2', status: 'COMPLETED', score: 90, completionDate: '2025-10-15', expiryDate: '2028-10-15', dueDate: null },
  { employeeId: 'e9', programId: 'tp3', status: 'NOT_REQUIRED', score: null, completionDate: null, expiryDate: null, dueDate: null },
  { employeeId: 'e9', programId: 'tp5', status: 'COMPLETED', score: 94, completionDate: '2025-08-01', expiryDate: '2027-08-01', dueDate: null },
  { employeeId: 'e9', programId: 'tp6', status: 'COMPLETED', score: 96, completionDate: '2025-06-01', expiryDate: '2026-06-01', dueDate: null },
  { employeeId: 'e9', programId: 'tp8', status: 'NOT_REQUIRED', score: null, completionDate: null, expiryDate: null, dueDate: null },

  { employeeId: 'e10', programId: 'tp1', status: 'COMPLETED', score: 90, completionDate: '2026-03-05', expiryDate: '2028-03-05', dueDate: null },
  { employeeId: 'e10', programId: 'tp2', status: 'IN_PROGRESS', score: null, completionDate: null, expiryDate: null, dueDate: '2026-04-30' },
  { employeeId: 'e10', programId: 'tp3', status: 'NOT_REQUIRED', score: null, completionDate: null, expiryDate: null, dueDate: null },
  { employeeId: 'e10', programId: 'tp5', status: 'COMPLETED', score: 92, completionDate: '2025-09-15', expiryDate: '2027-09-15', dueDate: null },
  { employeeId: 'e10', programId: 'tp6', status: 'COMPLETED', score: 98, completionDate: '2025-07-01', expiryDate: '2026-07-01', dueDate: null },
  { employeeId: 'e10', programId: 'tp8', status: 'NOT_REQUIRED', score: null, completionDate: null, expiryDate: null, dueDate: null },

  { employeeId: 'e11', programId: 'tp1', status: 'NOT_STARTED', score: null, completionDate: null, expiryDate: null, dueDate: '2026-05-01' },
  { employeeId: 'e11', programId: 'tp2', status: 'COMPLETED', score: 84, completionDate: '2025-12-10', expiryDate: '2028-12-10', dueDate: null },
  { employeeId: 'e11', programId: 'tp3', status: 'NOT_REQUIRED', score: null, completionDate: null, expiryDate: null, dueDate: null },
  { employeeId: 'e11', programId: 'tp5', status: 'OVERDUE', score: null, completionDate: null, expiryDate: null, dueDate: '2026-03-01' },
  { employeeId: 'e11', programId: 'tp6', status: 'COMPLETED', score: 100, completionDate: '2025-06-01', expiryDate: '2026-06-01', dueDate: null },
  { employeeId: 'e11', programId: 'tp8', status: 'NOT_REQUIRED', score: null, completionDate: null, expiryDate: null, dueDate: null },

  { employeeId: 'e12', programId: 'tp1', status: 'IN_PROGRESS', score: null, completionDate: null, expiryDate: null, dueDate: '2026-04-30' },
  { employeeId: 'e12', programId: 'tp2', status: 'OVERDUE', score: null, completionDate: null, expiryDate: null, dueDate: '2026-03-20' },
  { employeeId: 'e12', programId: 'tp3', status: 'NOT_REQUIRED', score: null, completionDate: null, expiryDate: null, dueDate: null },
  { employeeId: 'e12', programId: 'tp5', status: 'NOT_STARTED', score: null, completionDate: null, expiryDate: null, dueDate: '2026-05-15' },
  { employeeId: 'e12', programId: 'tp6', status: 'EXPIRED', score: 86, completionDate: '2025-02-01', expiryDate: '2026-02-01', dueDate: null },
  { employeeId: 'e12', programId: 'tp8', status: 'NOT_REQUIRED', score: null, completionDate: null, expiryDate: null, dueDate: null },
];

// ── Hooks ───────────────────────────────────────────────────────────────────

interface CompetencyFilters {
  department?: string;
  role?: string;
}

export function useCompetencyMatrix(filters: CompetencyFilters = {}) {
  const result = useMemo(() => {
    let employees = [...mockEmployees];
    if (filters.department) employees = employees.filter((e) => e.department === filters.department);
    if (filters.role) employees = employees.filter((e) => e.role === filters.role);

    const employeeIds = new Set(employees.map((e) => e.id));
    const cells = mockMatrixCells.filter((c) => employeeIds.has(c.employeeId));

    return { employees, programs: mockPrograms, cells };
  }, [filters.department, filters.role]);

  return { data: result, isLoading: false };
}

export function useGapAnalysis(filters: CompetencyFilters = {}) {
  const result = useMemo(() => {
    let employees = [...mockEmployees];
    if (filters.department) employees = employees.filter((e) => e.department === filters.department);
    if (filters.role) employees = employees.filter((e) => e.role === filters.role);

    const gaps: GapEntry[] = employees.map((emp) => {
      const empCells = mockMatrixCells.filter((c) => c.employeeId === emp.id);
      const required = empCells.filter((c) => c.status !== 'NOT_REQUIRED');
      const completed = empCells.filter((c) => c.status === 'COMPLETED');
      const overdue = empCells.filter((c) => c.status === 'OVERDUE').length;
      const notStarted = empCells.filter((c) => c.status === 'NOT_STARTED').length;
      const expired = empCells.filter((c) => c.status === 'EXPIRED').length;
      const compliancePercent = required.length > 0 ? Math.round((completed.length / required.length) * 100) : 100;

      return { employee: emp, overdueCount: overdue, notStartedCount: notStarted, expiredCount: expired, compliancePercent };
    });

    const totalGaps = gaps.reduce((sum, g) => sum + g.overdueCount + g.expiredCount, 0);
    const departments = [...new Set(employees.map((e) => e.department))];
    const deptCompliance = departments.map((dept) => {
      const deptGaps = gaps.filter((g) => g.employee.department === dept);
      const avg = Math.round(deptGaps.reduce((s, g) => s + g.compliancePercent, 0) / (deptGaps.length || 1));
      return { department: dept, compliance: avg, employeeCount: deptGaps.length };
    });

    return { gaps: gaps.filter((g) => g.overdueCount > 0 || g.expiredCount > 0 || g.notStartedCount > 0), totalGaps, deptCompliance };
  }, [filters.department, filters.role]);

  return { data: result, isLoading: false };
}
