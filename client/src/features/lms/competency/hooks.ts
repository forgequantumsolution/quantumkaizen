import { useMemo } from 'react';
import { useUserIndustry, pickByIndustry } from '@/lib/userIndustry';

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

// Medical-device competency matrix — ISO 13485 §6.2.
export const mockMedicalDeviceEmployees: CompetencyEmployee[] = [
  { id: 'md-e1',  name: 'Dr. Anjali Verma', employeeId: 'FQ-MD-001', department: 'Regulatory Affairs', role: 'Tenant Admin / PRRC' },
  { id: 'md-e2',  name: 'Karthik Iyer',     employeeId: 'FQ-MD-002', department: 'Sterilization',      role: 'Sterilization Lead' },
  { id: 'md-e3',  name: 'Neha Bansal',      employeeId: 'FQ-MD-003', department: 'Procurement',        role: 'Supplier QA Manager' },
  { id: 'md-e4',  name: 'Rohit Khanna',     employeeId: 'FQ-MD-004', department: 'Engineering',        role: 'Maintenance Engineer' },
  { id: 'md-e5',  name: 'Sneha Kapoor',     employeeId: 'FQ-MD-005', department: 'Regulatory Affairs', role: 'Regulatory Manager' },
  { id: 'md-e6',  name: 'Aditya Menon',     employeeId: 'FQ-MD-006', department: 'Design Controls',    role: 'Firmware / R&D Engineer' },
  { id: 'md-e7',  name: 'Pooja Iyengar',    employeeId: 'FQ-MD-007', department: 'Cleanroom Assembly', role: 'Cleanroom Operator' },
  { id: 'md-e8',  name: 'Vijay Bhattacharya',employeeId: 'FQ-MD-008',department: 'QC Lab',             role: 'Biocompatibility Analyst' },
  { id: 'md-e9',  name: 'Anand Kulkarni',   employeeId: 'FQ-MD-009', department: 'Sterilization',      role: 'EO Cycle Operator' },
  { id: 'md-e10', name: 'Reema Joshi',      employeeId: 'FQ-MD-010', department: 'Packaging',          role: 'UDI Verifier' },
];

export const mockMedicalDevicePrograms: CompetencyProgram[] = [
  { id: 'md-tp1',  title: 'ISO 13485:2016 Awareness',                shortCode: 'ISO13485' },
  { id: 'md-tp2',  title: 'ISO 14971:2019 — Risk Management',         shortCode: 'ISO14971' },
  { id: 'md-tp4',  title: 'EO Sterilization Cycle (ISO 11135)',        shortCode: 'EOSTER' },
  { id: 'md-tp5',  title: 'EU MDR Vigilance & PMS',                    shortCode: 'MDR-PMS' },
  { id: 'md-tp6',  title: 'Cleanroom Behaviour & Gowning',             shortCode: 'CLEANROOM' },
  { id: 'md-tp8',  title: 'UDI Compliance — 21 CFR 830 / EU MDR',       shortCode: 'UDI' },
  { id: 'md-tp9',  title: 'Biocompatibility & ISO 10993',              shortCode: 'ISO10993' },
  { id: 'md-tp12', title: 'Aseptic Technique Re-Qualification',         shortCode: 'ASEPTIC' },
];

const mdCell = (employeeId: string, programId: string, status: CellStatus, score: number | null = null, completionDate: string | null = null, expiryDate: string | null = null, dueDate: string | null = null): MatrixCell => ({
  employeeId, programId, status, score, completionDate, expiryDate, dueDate,
});

export const mockMedicalDeviceMatrixCells: MatrixCell[] = [
  // Dr. Anjali Verma (Tenant Admin / PRRC)
  mdCell('md-e1', 'md-tp1',  'COMPLETED', 96, '2025-09-12', '2028-09-12'),
  mdCell('md-e1', 'md-tp2',  'COMPLETED', 94, '2025-10-04', '2028-10-04'),
  mdCell('md-e1', 'md-tp4',  'NOT_REQUIRED'),
  mdCell('md-e1', 'md-tp5',  'COMPLETED', 98, '2025-11-21', '2027-11-21'),
  mdCell('md-e1', 'md-tp6',  'COMPLETED', 92, '2025-08-10', '2026-08-10'),
  mdCell('md-e1', 'md-tp8',  'COMPLETED', 90, '2025-12-02', '2026-12-02'),
  mdCell('md-e1', 'md-tp9',  'COMPLETED', 88, '2025-06-15', '2028-06-15'),
  mdCell('md-e1', 'md-tp12', 'NOT_REQUIRED'),
  // Karthik Iyer (Sterilization Lead)
  mdCell('md-e2', 'md-tp1',  'COMPLETED', 88, '2025-09-12', '2028-09-12'),
  mdCell('md-e2', 'md-tp2',  'COMPLETED', 84, '2025-10-08', '2028-10-08'),
  mdCell('md-e2', 'md-tp4',  'COMPLETED', 96, '2026-01-20', '2027-01-20'),
  mdCell('md-e2', 'md-tp5',  'NOT_REQUIRED'),
  mdCell('md-e2', 'md-tp6',  'COMPLETED', 95, '2025-08-12', '2026-08-12'),
  mdCell('md-e2', 'md-tp8',  'NOT_REQUIRED'),
  mdCell('md-e2', 'md-tp9',  'NOT_REQUIRED'),
  mdCell('md-e2', 'md-tp12', 'COMPLETED', 92, '2025-11-04', '2026-11-04'),
  // Neha Bansal (Supplier QA Manager)
  mdCell('md-e3', 'md-tp1',  'COMPLETED', 90, '2025-09-12', '2028-09-12'),
  mdCell('md-e3', 'md-tp2',  'COMPLETED', 86, '2025-10-08', '2028-10-08'),
  mdCell('md-e3', 'md-tp4',  'NOT_REQUIRED'),
  mdCell('md-e3', 'md-tp5',  'COMPLETED', 88, '2025-12-04', '2027-12-04'),
  mdCell('md-e3', 'md-tp6',  'NOT_REQUIRED'),
  mdCell('md-e3', 'md-tp8',  'IN_PROGRESS', null, null, null, '2026-05-10'),
  mdCell('md-e3', 'md-tp9',  'COMPLETED', 82, '2025-07-15', '2028-07-15'),
  mdCell('md-e3', 'md-tp12', 'NOT_REQUIRED'),
  // Rohit Khanna (Maintenance Engineer)
  mdCell('md-e4', 'md-tp1',  'COMPLETED', 80, '2025-09-12', '2028-09-12'),
  mdCell('md-e4', 'md-tp2',  'NOT_REQUIRED'),
  mdCell('md-e4', 'md-tp4',  'COMPLETED', 92, '2026-01-20', '2027-01-20'),
  mdCell('md-e4', 'md-tp5',  'NOT_REQUIRED'),
  mdCell('md-e4', 'md-tp6',  'COMPLETED', 88, '2025-08-12', '2026-08-12'),
  mdCell('md-e4', 'md-tp8',  'NOT_REQUIRED'),
  mdCell('md-e4', 'md-tp9',  'NOT_REQUIRED'),
  mdCell('md-e4', 'md-tp12', 'NOT_STARTED', null, null, null, '2026-05-30'),
  // Sneha Kapoor (Regulatory Manager)
  mdCell('md-e5', 'md-tp1',  'COMPLETED', 94, '2025-09-12', '2028-09-12'),
  mdCell('md-e5', 'md-tp2',  'COMPLETED', 90, '2025-10-04', '2028-10-04'),
  mdCell('md-e5', 'md-tp4',  'NOT_REQUIRED'),
  mdCell('md-e5', 'md-tp5',  'COMPLETED', 96, '2025-11-21', '2027-11-21'),
  mdCell('md-e5', 'md-tp6',  'NOT_REQUIRED'),
  mdCell('md-e5', 'md-tp8',  'COMPLETED', 92, '2025-12-02', '2026-12-02'),
  mdCell('md-e5', 'md-tp9',  'COMPLETED', 86, '2025-07-15', '2028-07-15'),
  mdCell('md-e5', 'md-tp12', 'NOT_REQUIRED'),
  // Aditya Menon (Firmware / R&D Engineer)
  mdCell('md-e6', 'md-tp1',  'COMPLETED', 90, '2025-09-12', '2028-09-12'),
  mdCell('md-e6', 'md-tp2',  'COMPLETED', 92, '2025-10-04', '2028-10-04'),
  mdCell('md-e6', 'md-tp4',  'NOT_REQUIRED'),
  mdCell('md-e6', 'md-tp5',  'IN_PROGRESS', null, null, null, '2026-05-20'),
  mdCell('md-e6', 'md-tp6',  'NOT_REQUIRED'),
  mdCell('md-e6', 'md-tp8',  'COMPLETED', 88, '2025-12-02', '2026-12-02'),
  mdCell('md-e6', 'md-tp9',  'NOT_REQUIRED'),
  mdCell('md-e6', 'md-tp12', 'NOT_REQUIRED'),
  // Pooja Iyengar (Cleanroom Operator)
  mdCell('md-e7', 'md-tp1',  'COMPLETED', 80, '2025-09-12', '2028-09-12'),
  mdCell('md-e7', 'md-tp2',  'NOT_REQUIRED'),
  mdCell('md-e7', 'md-tp4',  'NOT_REQUIRED'),
  mdCell('md-e7', 'md-tp5',  'NOT_REQUIRED'),
  mdCell('md-e7', 'md-tp6',  'COMPLETED', 94, '2025-08-12', '2026-08-12'),
  mdCell('md-e7', 'md-tp8',  'NOT_REQUIRED'),
  mdCell('md-e7', 'md-tp9',  'NOT_REQUIRED'),
  mdCell('md-e7', 'md-tp12', 'OVERDUE', null, null, null, '2026-03-15'),
  // Vijay Bhattacharya (Biocompatibility Analyst)
  mdCell('md-e8', 'md-tp1',  'COMPLETED', 86, '2025-09-12', '2028-09-12'),
  mdCell('md-e8', 'md-tp2',  'COMPLETED', 82, '2025-10-04', '2028-10-04'),
  mdCell('md-e8', 'md-tp4',  'NOT_REQUIRED'),
  mdCell('md-e8', 'md-tp5',  'NOT_REQUIRED'),
  mdCell('md-e8', 'md-tp6',  'NOT_REQUIRED'),
  mdCell('md-e8', 'md-tp8',  'NOT_REQUIRED'),
  mdCell('md-e8', 'md-tp9',  'COMPLETED', 94, '2025-07-15', '2028-07-15'),
  mdCell('md-e8', 'md-tp12', 'NOT_REQUIRED'),
  // Anand Kulkarni (EO Cycle Operator)
  mdCell('md-e9', 'md-tp1',  'COMPLETED', 78, '2025-09-12', '2028-09-12'),
  mdCell('md-e9', 'md-tp2',  'NOT_REQUIRED'),
  mdCell('md-e9', 'md-tp4',  'IN_PROGRESS', null, null, null, '2026-05-12'),
  mdCell('md-e9', 'md-tp5',  'NOT_REQUIRED'),
  mdCell('md-e9', 'md-tp6',  'COMPLETED', 92, '2025-08-12', '2026-08-12'),
  mdCell('md-e9', 'md-tp8',  'NOT_REQUIRED'),
  mdCell('md-e9', 'md-tp9',  'NOT_REQUIRED'),
  mdCell('md-e9', 'md-tp12', 'EXPIRED', 88, '2024-12-10', '2025-12-10'),
  // Reema Joshi (UDI Verifier)
  mdCell('md-e10', 'md-tp1', 'COMPLETED', 84, '2025-09-12', '2028-09-12'),
  mdCell('md-e10', 'md-tp2', 'NOT_REQUIRED'),
  mdCell('md-e10', 'md-tp4', 'NOT_REQUIRED'),
  mdCell('md-e10', 'md-tp5', 'NOT_REQUIRED'),
  mdCell('md-e10', 'md-tp6', 'NOT_REQUIRED'),
  mdCell('md-e10', 'md-tp8', 'COMPLETED', 90, '2025-12-02', '2026-12-02'),
  mdCell('md-e10', 'md-tp9', 'NOT_REQUIRED'),
  mdCell('md-e10', 'md-tp12','NOT_REQUIRED'),
];

// Dairy tenant — competency matrix.
export const mockDairyEmployees: CompetencyEmployee[] = [
  { id: 'dy-e1',  name: 'Sandeep Joshi',     employeeId: 'FQ-DY-001', department: 'Quality Assurance',    role: 'Head of Quality / FSSAI Focal' },
  { id: 'dy-e2',  name: 'Meera Pillai',      employeeId: 'FQ-DY-002', department: 'Procurement',           role: 'Procurement / Farm Liaison' },
  { id: 'dy-e3',  name: 'Anita Kulkarni',    employeeId: 'FQ-DY-003', department: 'Microbiology Lab',      role: 'Microbiology Analyst' },
  { id: 'dy-e4',  name: 'Ravi Deshmukh',     employeeId: 'FQ-DY-004', department: 'Pasteurization',        role: 'Senior Pasteurization Operator' },
  { id: 'dy-e5',  name: 'Priya Khanna',      employeeId: 'FQ-DY-005', department: 'Packaging',             role: 'Packaging / Cold Chain Lead' },
  { id: 'dy-e6',  name: 'Sunita Borade',     employeeId: 'FQ-DY-006', department: 'R&D',                   role: 'R&D / NPD Lead' },
  { id: 'dy-e7',  name: 'Rohit Pawar',       employeeId: 'FQ-DY-007', department: 'Receiving Dock',        role: 'Dock Tester' },
  { id: 'dy-e8',  name: 'Sneha Bhosale',     employeeId: 'FQ-DY-008', department: 'Production',            role: 'Curd / Paneer Operator' },
  { id: 'dy-e9',  name: 'Vinay Surve',       employeeId: 'FQ-DY-009', department: 'Production',            role: 'Ghee Kettle Operator' },
  { id: 'dy-e10', name: 'Anjali Mhatre',     employeeId: 'FQ-DY-010', department: 'Cold Chain',            role: 'Cold-chain Driver' },
];

export const mockDairyPrograms: CompetencyProgram[] = [
  { id: 'dy-tp1',  title: 'FSSAI Schedule 4 — Hygienic Food Premises',                 shortCode: 'FSSAI'    },
  { id: 'dy-tp2',  title: 'HACCP for Dairy Processing',                                shortCode: 'HACCP'    },
  { id: 'dy-tp3',  title: 'ISO 22000:2018 Awareness',                                  shortCode: 'ISO22000' },
  { id: 'dy-tp4',  title: 'Raw-Milk Testing — Fat / SNF / COB / Antibiotic Dipstick',  shortCode: 'RAW-MILK' },
  { id: 'dy-tp5',  title: 'HTST Pasteurization — Re-Qualification',                    shortCode: 'PAST'     },
  { id: 'dy-tp6',  title: 'Microbiology of Milk & Milk Products',                       shortCode: 'MICRO'    },
  { id: 'dy-tp7',  title: 'CIP Procedure & ATP-Swab Verification',                      shortCode: 'CIP'      },
  { id: 'dy-tp8',  title: 'Cold-Chain Driver & Dispatch Training',                       shortCode: 'COLD'     },
];

const dyCell = (employeeId: string, programId: string, status: CellStatus, score: number | null = null, completionDate: string | null = null, expiryDate: string | null = null, dueDate: string | null = null): MatrixCell => ({
  employeeId, programId, status, score, completionDate, expiryDate, dueDate,
});

export const mockDairyMatrixCells: MatrixCell[] = [
  // Sandeep Joshi (Head of Quality)
  dyCell('dy-e1', 'dy-tp1', 'COMPLETED', 96, '2025-09-08', '2026-09-08'),
  dyCell('dy-e1', 'dy-tp2', 'COMPLETED', 94, '2025-10-14', '2028-10-14'),
  dyCell('dy-e1', 'dy-tp3', 'COMPLETED', 92, '2025-11-04', '2028-11-04'),
  dyCell('dy-e1', 'dy-tp4', 'NOT_REQUIRED'),
  dyCell('dy-e1', 'dy-tp5', 'NOT_REQUIRED'),
  dyCell('dy-e1', 'dy-tp6', 'COMPLETED', 88, '2026-01-10', '2029-01-10'),
  dyCell('dy-e1', 'dy-tp7', 'COMPLETED', 90, '2025-08-04', '2026-08-04'),
  dyCell('dy-e1', 'dy-tp8', 'NOT_REQUIRED'),
  // Meera Pillai (Procurement)
  dyCell('dy-e2', 'dy-tp1', 'COMPLETED', 92, '2025-09-08', '2026-09-08'),
  dyCell('dy-e2', 'dy-tp2', 'COMPLETED', 86, '2025-10-14', '2028-10-14'),
  dyCell('dy-e2', 'dy-tp3', 'IN_PROGRESS', null, null, null, '2026-06-30'),
  dyCell('dy-e2', 'dy-tp4', 'COMPLETED', 88, '2025-08-22', '2026-08-22'),
  dyCell('dy-e2', 'dy-tp5', 'NOT_REQUIRED'),
  dyCell('dy-e2', 'dy-tp6', 'NOT_REQUIRED'),
  dyCell('dy-e2', 'dy-tp7', 'NOT_REQUIRED'),
  dyCell('dy-e2', 'dy-tp8', 'NOT_REQUIRED'),
  // Anita Kulkarni (Microbiology Lead)
  dyCell('dy-e3', 'dy-tp1', 'COMPLETED', 94, '2025-09-08', '2026-09-08'),
  dyCell('dy-e3', 'dy-tp2', 'COMPLETED', 92, '2025-10-14', '2028-10-14'),
  dyCell('dy-e3', 'dy-tp3', 'COMPLETED', 88, '2025-11-04', '2028-11-04'),
  dyCell('dy-e3', 'dy-tp4', 'NOT_REQUIRED'),
  dyCell('dy-e3', 'dy-tp5', 'NOT_REQUIRED'),
  dyCell('dy-e3', 'dy-tp6', 'COMPLETED', 96, '2026-01-10', '2029-01-10'),
  dyCell('dy-e3', 'dy-tp7', 'COMPLETED', 88, '2025-08-04', '2026-08-04'),
  dyCell('dy-e3', 'dy-tp8', 'NOT_REQUIRED'),
  // Ravi Deshmukh (Pasteurization)
  dyCell('dy-e4', 'dy-tp1', 'COMPLETED', 88, '2025-09-08', '2026-09-08'),
  dyCell('dy-e4', 'dy-tp2', 'COMPLETED', 84, '2025-10-14', '2028-10-14'),
  dyCell('dy-e4', 'dy-tp3', 'NOT_REQUIRED'),
  dyCell('dy-e4', 'dy-tp4', 'NOT_REQUIRED'),
  dyCell('dy-e4', 'dy-tp5', 'COMPLETED', 95, '2025-12-04', '2026-12-04'),
  dyCell('dy-e4', 'dy-tp6', 'NOT_REQUIRED'),
  dyCell('dy-e4', 'dy-tp7', 'COMPLETED', 90, '2025-08-04', '2026-08-04'),
  dyCell('dy-e4', 'dy-tp8', 'NOT_REQUIRED'),
  // Priya Khanna (Packaging / Cold Chain)
  dyCell('dy-e5', 'dy-tp1', 'COMPLETED', 90, '2025-09-08', '2026-09-08'),
  dyCell('dy-e5', 'dy-tp2', 'COMPLETED', 80, '2025-10-14', '2028-10-14'),
  dyCell('dy-e5', 'dy-tp3', 'IN_PROGRESS', null, null, null, '2026-07-15'),
  dyCell('dy-e5', 'dy-tp4', 'NOT_REQUIRED'),
  dyCell('dy-e5', 'dy-tp5', 'NOT_REQUIRED'),
  dyCell('dy-e5', 'dy-tp6', 'NOT_REQUIRED'),
  dyCell('dy-e5', 'dy-tp7', 'COMPLETED', 88, '2025-08-04', '2026-08-04'),
  dyCell('dy-e5', 'dy-tp8', 'COMPLETED', 92, '2025-12-15', '2026-12-15'),
  // Sunita Borade (R&D)
  dyCell('dy-e6', 'dy-tp1', 'COMPLETED', 92, '2025-09-08', '2026-09-08'),
  dyCell('dy-e6', 'dy-tp2', 'COMPLETED', 88, '2025-10-14', '2028-10-14'),
  dyCell('dy-e6', 'dy-tp3', 'COMPLETED', 84, '2025-11-04', '2028-11-04'),
  dyCell('dy-e6', 'dy-tp4', 'NOT_REQUIRED'),
  dyCell('dy-e6', 'dy-tp5', 'NOT_REQUIRED'),
  dyCell('dy-e6', 'dy-tp6', 'COMPLETED', 86, '2026-01-10', '2029-01-10'),
  dyCell('dy-e6', 'dy-tp7', 'NOT_REQUIRED'),
  dyCell('dy-e6', 'dy-tp8', 'NOT_REQUIRED'),
  // Rohit Pawar (Dock Tester)
  dyCell('dy-e7', 'dy-tp1', 'COMPLETED', 82, '2025-09-08', '2026-09-08'),
  dyCell('dy-e7', 'dy-tp2', 'NOT_STARTED', null, null, null, '2026-07-30'),
  dyCell('dy-e7', 'dy-tp3', 'NOT_REQUIRED'),
  dyCell('dy-e7', 'dy-tp4', 'COMPLETED', 90, '2025-08-22', '2026-08-22'),
  dyCell('dy-e7', 'dy-tp5', 'NOT_REQUIRED'),
  dyCell('dy-e7', 'dy-tp6', 'NOT_REQUIRED'),
  dyCell('dy-e7', 'dy-tp7', 'NOT_REQUIRED'),
  dyCell('dy-e7', 'dy-tp8', 'NOT_REQUIRED'),
  // Sneha Bhosale (Curd / Paneer)
  dyCell('dy-e8', 'dy-tp1', 'COMPLETED', 86, '2025-09-08', '2026-09-08'),
  dyCell('dy-e8', 'dy-tp2', 'COMPLETED', 78, '2025-10-14', '2028-10-14'),
  dyCell('dy-e8', 'dy-tp3', 'NOT_REQUIRED'),
  dyCell('dy-e8', 'dy-tp4', 'NOT_REQUIRED'),
  dyCell('dy-e8', 'dy-tp5', 'NOT_REQUIRED'),
  dyCell('dy-e8', 'dy-tp6', 'NOT_REQUIRED'),
  dyCell('dy-e8', 'dy-tp7', 'OVERDUE', null, null, null, '2026-03-30'),
  dyCell('dy-e8', 'dy-tp8', 'NOT_REQUIRED'),
  // Vinay Surve (Ghee operator)
  dyCell('dy-e9', 'dy-tp1', 'COMPLETED', 80, '2025-09-08', '2026-09-08'),
  dyCell('dy-e9', 'dy-tp2', 'IN_PROGRESS', null, null, null, '2026-07-15'),
  dyCell('dy-e9', 'dy-tp3', 'NOT_REQUIRED'),
  dyCell('dy-e9', 'dy-tp4', 'NOT_REQUIRED'),
  dyCell('dy-e9', 'dy-tp5', 'NOT_REQUIRED'),
  dyCell('dy-e9', 'dy-tp6', 'NOT_REQUIRED'),
  dyCell('dy-e9', 'dy-tp7', 'COMPLETED', 84, '2025-08-04', '2026-08-04'),
  dyCell('dy-e9', 'dy-tp8', 'NOT_REQUIRED'),
  // Anjali Mhatre (Cold-chain driver)
  dyCell('dy-e10','dy-tp1', 'COMPLETED', 88, '2025-09-08', '2026-09-08'),
  dyCell('dy-e10','dy-tp2', 'NOT_REQUIRED'),
  dyCell('dy-e10','dy-tp3', 'NOT_REQUIRED'),
  dyCell('dy-e10','dy-tp4', 'NOT_REQUIRED'),
  dyCell('dy-e10','dy-tp5', 'NOT_REQUIRED'),
  dyCell('dy-e10','dy-tp6', 'NOT_REQUIRED'),
  dyCell('dy-e10','dy-tp7', 'NOT_REQUIRED'),
  dyCell('dy-e10','dy-tp8', 'COMPLETED', 90, '2025-12-15', '2026-12-15'),
];

// ── Hooks ───────────────────────────────────────────────────────────────────

interface CompetencyFilters {
  department?: string;
  role?: string;
}

export function useCompetencyMatrix(filters: CompetencyFilters = {}) {
  const industry = useUserIndustry();
  const employeesSrc = pickByIndustry(industry, mockEmployees,    { medical_device: mockMedicalDeviceEmployees,   dairy: mockDairyEmployees });
  const programsSrc  = pickByIndustry(industry, mockPrograms,     { medical_device: mockMedicalDevicePrograms,    dairy: mockDairyPrograms });
  const cellsSrc     = pickByIndustry(industry, mockMatrixCells,  { medical_device: mockMedicalDeviceMatrixCells, dairy: mockDairyMatrixCells });
  const result = useMemo(() => {
    let employees = [...employeesSrc];
    if (filters.department) employees = employees.filter((e) => e.department === filters.department);
    if (filters.role) employees = employees.filter((e) => e.role === filters.role);

    const employeeIds = new Set(employees.map((e) => e.id));
    const cells = cellsSrc.filter((c) => employeeIds.has(c.employeeId));

    return { employees, programs: programsSrc, cells };
  }, [employeesSrc, programsSrc, cellsSrc, filters.department, filters.role]);

  return { data: result, isLoading: false };
}

export function useGapAnalysis(filters: CompetencyFilters = {}) {
  const industry = useUserIndustry();
  const employeesSrc = pickByIndustry(industry, mockEmployees,   { medical_device: mockMedicalDeviceEmployees, dairy: mockDairyEmployees });
  const cellsSrc     = pickByIndustry(industry, mockMatrixCells, { medical_device: mockMedicalDeviceMatrixCells, dairy: mockDairyMatrixCells });
  const result = useMemo(() => {
    let employees = [...employeesSrc];
    if (filters.department) employees = employees.filter((e) => e.department === filters.department);
    if (filters.role) employees = employees.filter((e) => e.role === filters.role);

    const gaps: GapEntry[] = employees.map((emp) => {
      const empCells = cellsSrc.filter((c) => c.employeeId === emp.id);
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
  }, [employeesSrc, cellsSrc, filters.department, filters.role]);

  return { data: result, isLoading: false };
}
