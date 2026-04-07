import { useState, useMemo } from 'react';

// ── Types ───────────────────────────────────────────────────────────────────

export type ProgramType = 'INDUCTION' | 'OJT' | 'CLASSROOM' | 'E_LEARNING' | 'REGULATORY' | 'REFRESHER';
export type ProgramStatus = 'ACTIVE' | 'DRAFT' | 'ARCHIVED' | 'EXPIRED';
export type ParticipantStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';

export interface TrainingProgram {
  id: string;
  programId: string;
  title: string;
  description: string;
  type: ProgramType;
  status: ProgramStatus;
  department: string;
  duration: string;
  enrolled: number;
  completionRate: number;
  validityPeriod: string;
  passingScore: number;
  objectives: string[];
  prerequisites: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ContentBlock {
  id: string;
  order: number;
  title: string;
  type: 'DOCUMENT' | 'PRESENTATION' | 'VIDEO' | 'CHECKLIST';
  url: string;
  duration: string;
}

export interface AssessmentQuestion {
  id: string;
  order: number;
  type: 'MULTIPLE_CHOICE' | 'TRUE_FALSE' | 'OPEN_TEXT';
  question: string;
  options: string[];
  correctAnswer: string;
  points: number;
}

export interface Participant {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  role: string;
  status: ParticipantStatus;
  score: number | null;
  completionDate: string | null;
  certificateId: string | null;
  enrolledDate: string;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

export const mockTrainingPrograms: TrainingProgram[] = [
  {
    id: 'tp1', programId: 'TRN-IND-001', title: 'GMP Fundamentals',
    description: 'Comprehensive training on Good Manufacturing Practices covering hygiene, documentation, process controls, and regulatory requirements for pharmaceutical and food manufacturing.',
    type: 'CLASSROOM', status: 'ACTIVE', department: 'Quality Assurance',
    duration: '16 hours', enrolled: 42, completionRate: 87, validityPeriod: '2 years',
    passingScore: 80, objectives: ['Understand GMP principles and regulatory expectations', 'Apply documentation best practices', 'Identify contamination risks and controls', 'Perform GMP self-inspections'],
    prerequisites: ['Safety Induction'], createdAt: '2025-01-15T10:00:00Z', updatedAt: '2026-03-20T08:00:00Z',
  },
  {
    id: 'tp2', programId: 'TRN-REG-002', title: 'ISO 9001 Awareness',
    description: 'Training on ISO 9001:2015 quality management system requirements, clause structure, process approach, and risk-based thinking.',
    type: 'E_LEARNING', status: 'ACTIVE', department: 'Quality Assurance',
    duration: '8 hours', enrolled: 65, completionRate: 92, validityPeriod: '3 years',
    passingScore: 75, objectives: ['Explain ISO 9001:2015 clause structure', 'Apply process approach methodology', 'Understand risk-based thinking', 'Participate in internal audits effectively'],
    prerequisites: [], createdAt: '2024-11-01T10:00:00Z', updatedAt: '2026-02-15T14:30:00Z',
  },
  {
    id: 'tp3', programId: 'TRN-OJT-003', title: 'Welding Procedure Qualification',
    description: 'On-the-job training for welding operators covering WPS, PQR, and welder performance qualification per ASME Section IX.',
    type: 'OJT', status: 'ACTIVE', department: 'Production',
    duration: '40 hours', enrolled: 18, completionRate: 72, validityPeriod: '1 year',
    passingScore: 85, objectives: ['Interpret WPS parameters correctly', 'Perform qualified welding procedures', 'Complete PQR documentation', 'Pass visual and destructive testing criteria'],
    prerequisites: ['Safety Induction', 'GMP Fundamentals'], createdAt: '2025-06-10T10:00:00Z', updatedAt: '2026-03-18T09:15:00Z',
  },
  {
    id: 'tp4', programId: 'TRN-CLS-004', title: 'FMEA Workshop',
    description: 'Interactive workshop on Failure Mode and Effects Analysis methodology for design and process FMEA per AIAG-VDA guidelines.',
    type: 'CLASSROOM', status: 'ACTIVE', department: 'Engineering',
    duration: '24 hours', enrolled: 28, completionRate: 64, validityPeriod: '3 years',
    passingScore: 70, objectives: ['Construct FMEA structure tables', 'Rate severity, occurrence, and detection', 'Calculate and prioritize RPN values', 'Develop action plans for high-risk items'],
    prerequisites: ['ISO 9001 Awareness'], createdAt: '2025-09-01T10:00:00Z', updatedAt: '2026-03-25T11:45:00Z',
  },
  {
    id: 'tp5', programId: 'TRN-ELR-005', title: '5S Methodology',
    description: 'eLearning program on 5S workplace organization methodology: Sort, Set in Order, Shine, Standardize, and Sustain.',
    type: 'E_LEARNING', status: 'ACTIVE', department: 'Production',
    duration: '4 hours', enrolled: 85, completionRate: 95, validityPeriod: '2 years',
    passingScore: 70, objectives: ['Apply each of the 5S steps', 'Conduct 5S audits', 'Sustain improvements through visual management', 'Lead 5S initiatives in work areas'],
    prerequisites: [], createdAt: '2024-06-15T10:00:00Z', updatedAt: '2026-01-10T16:00:00Z',
  },
  {
    id: 'tp6', programId: 'TRN-IND-006', title: 'Safety Induction',
    description: 'Mandatory safety induction program for all new employees covering emergency procedures, PPE requirements, hazard identification, and reporting.',
    type: 'INDUCTION', status: 'ACTIVE', department: 'HSE',
    duration: '8 hours', enrolled: 120, completionRate: 98, validityPeriod: '1 year',
    passingScore: 90, objectives: ['Identify workplace hazards', 'Use PPE correctly', 'Follow emergency evacuation procedures', 'Report incidents and near-misses'],
    prerequisites: [], createdAt: '2023-01-01T10:00:00Z', updatedAt: '2026-03-01T10:00:00Z',
  },
  {
    id: 'tp7', programId: 'TRN-REG-007', title: 'IATF 16949 Core Tools',
    description: 'Regulatory training on IATF 16949 automotive quality core tools: APQP, PPAP, FMEA, MSA, and SPC.',
    type: 'REGULATORY', status: 'DRAFT', department: 'Quality Assurance',
    duration: '32 hours', enrolled: 0, completionRate: 0, validityPeriod: '3 years',
    passingScore: 80, objectives: ['Apply APQP phases', 'Prepare PPAP submission packages', 'Conduct MSA studies', 'Implement SPC charts'],
    prerequisites: ['ISO 9001 Awareness', 'FMEA Workshop'], createdAt: '2026-03-20T10:00:00Z', updatedAt: '2026-03-28T14:00:00Z',
  },
  {
    id: 'tp8', programId: 'TRN-REF-008', title: 'Calibration Refresher',
    description: 'Annual refresher training on instrument calibration procedures, measurement uncertainty, and calibration record management.',
    type: 'REFRESHER', status: 'ACTIVE', department: 'Quality Control',
    duration: '6 hours', enrolled: 32, completionRate: 78, validityPeriod: '1 year',
    passingScore: 75, objectives: ['Perform calibration per approved procedures', 'Calculate measurement uncertainty', 'Maintain calibration records and stickers', 'Handle out-of-calibration situations'],
    prerequisites: ['GMP Fundamentals'], createdAt: '2025-03-01T10:00:00Z', updatedAt: '2026-03-15T13:30:00Z',
  },
];

export const mockContentBlocks: ContentBlock[] = [
  { id: 'cb1', order: 1, title: 'Introduction to GMP', type: 'PRESENTATION', url: '/content/gmp-intro.pptx', duration: '45 min' },
  { id: 'cb2', order: 2, title: 'GMP Documentation Requirements', type: 'DOCUMENT', url: '/content/gmp-docs.pdf', duration: '30 min' },
  { id: 'cb3', order: 3, title: 'Contamination Control Video', type: 'VIDEO', url: 'https://training.example.com/gmp-contamination', duration: '20 min' },
  { id: 'cb4', order: 4, title: 'Personal Hygiene Standards', type: 'DOCUMENT', url: '/content/hygiene-standards.pdf', duration: '20 min' },
  { id: 'cb5', order: 5, title: 'GMP Self-Inspection Checklist', type: 'CHECKLIST', url: '/content/gmp-checklist.xlsx', duration: '60 min' },
  { id: 'cb6', order: 6, title: 'Case Studies and Best Practices', type: 'PRESENTATION', url: '/content/gmp-case-studies.pptx', duration: '40 min' },
];

export const mockAssessmentQuestions: AssessmentQuestion[] = [
  { id: 'q1', order: 1, type: 'MULTIPLE_CHOICE', question: 'Which of the following is a primary objective of GMP?', options: ['Maximize production speed', 'Ensure product quality and safety', 'Reduce employee headcount', 'Minimize documentation'], correctAnswer: 'Ensure product quality and safety', points: 10 },
  { id: 'q2', order: 2, type: 'TRUE_FALSE', question: 'GMP requires that all deviations from standard procedures must be documented and investigated.', options: ['True', 'False'], correctAnswer: 'True', points: 5 },
  { id: 'q3', order: 3, type: 'MULTIPLE_CHOICE', question: 'What is the correct order of cleaning validation?', options: ['Clean, Validate, Document', 'Document, Clean, Validate', 'Validate, Clean, Document', 'Clean, Document, Validate'], correctAnswer: 'Clean, Validate, Document', points: 10 },
  { id: 'q4', order: 4, type: 'OPEN_TEXT', question: 'Describe three key contamination risks in a manufacturing environment and explain how each can be mitigated.', options: [], correctAnswer: '', points: 20 },
  { id: 'q5', order: 5, type: 'MULTIPLE_CHOICE', question: 'Which document type provides step-by-step instructions for a specific task?', options: ['Policy', 'Procedure', 'Work Instruction', 'Manual'], correctAnswer: 'Work Instruction', points: 10 },
  { id: 'q6', order: 6, type: 'TRUE_FALSE', question: 'Batch records can be corrected using correction fluid (white-out).', options: ['True', 'False'], correctAnswer: 'False', points: 5 },
];

export const mockParticipants: Participant[] = [
  { id: 'p1', name: 'Priya Sharma', employeeId: 'EMP-001', department: 'Quality Assurance', role: 'QA Inspector', status: 'COMPLETED', score: 92, completionDate: '2026-02-15T10:00:00Z', certificateId: 'CERT-001', enrolledDate: '2026-01-10T08:00:00Z' },
  { id: 'p2', name: 'Vikram Patel', employeeId: 'EMP-004', department: 'Production', role: 'Production Supervisor', status: 'COMPLETED', score: 88, completionDate: '2026-02-20T14:00:00Z', certificateId: 'CERT-002', enrolledDate: '2026-01-10T08:00:00Z' },
  { id: 'p3', name: 'Anita Desai', employeeId: 'EMP-003', department: 'Quality Control', role: 'Lab Analyst', status: 'IN_PROGRESS', score: null, completionDate: null, certificateId: null, enrolledDate: '2026-02-01T08:00:00Z' },
  { id: 'p4', name: 'Deepak Nair', employeeId: 'EMP-006', department: 'Engineering', role: 'Design Engineer', status: 'IN_PROGRESS', score: null, completionDate: null, certificateId: null, enrolledDate: '2026-02-15T08:00:00Z' },
  { id: 'p5', name: 'Sunita Rao', employeeId: 'EMP-005', department: 'HSE', role: 'HSE Officer', status: 'COMPLETED', score: 96, completionDate: '2026-01-28T10:00:00Z', certificateId: 'CERT-003', enrolledDate: '2026-01-10T08:00:00Z' },
  { id: 'p6', name: 'Arun Mehta', employeeId: 'EMP-007', department: 'Production', role: 'Machine Operator', status: 'NOT_STARTED', score: null, completionDate: null, certificateId: null, enrolledDate: '2026-03-01T08:00:00Z' },
  { id: 'p7', name: 'Kavita Singh', employeeId: 'EMP-008', department: 'Quality Assurance', role: 'Document Controller', status: 'EXPIRED', score: 78, completionDate: '2024-03-15T10:00:00Z', certificateId: 'CERT-004', enrolledDate: '2024-02-01T08:00:00Z' },
  { id: 'p8', name: 'Rajesh Kumar', employeeId: 'EMP-002', department: 'Quality Assurance', role: 'Quality Manager', status: 'COMPLETED', score: 94, completionDate: '2026-01-20T10:00:00Z', certificateId: 'CERT-005', enrolledDate: '2026-01-10T08:00:00Z' },
  { id: 'p9', name: 'Manoj Verma', employeeId: 'EMP-009', department: 'Production', role: 'Welding Operator', status: 'IN_PROGRESS', score: null, completionDate: null, certificateId: null, enrolledDate: '2026-03-10T08:00:00Z' },
  { id: 'p10', name: 'Neha Gupta', employeeId: 'EMP-010', department: 'Engineering', role: 'Process Engineer', status: 'COMPLETED', score: 90, completionDate: '2026-03-05T10:00:00Z', certificateId: 'CERT-006', enrolledDate: '2026-02-15T08:00:00Z' },
];

// ── Hooks ───────────────────────────────────────────────────────────────────

interface TrainingFilters {
  type?: string;
  status?: string;
  department?: string;
  search?: string;
}

export function useTrainingPrograms(filters: TrainingFilters = {}) {
  const data = useMemo(() => {
    let filtered = [...mockTrainingPrograms];
    if (filters.type) filtered = filtered.filter((p) => p.type === filters.type);
    if (filters.status) filtered = filtered.filter((p) => p.status === filters.status);
    if (filters.department) filtered = filtered.filter((p) => p.department === filters.department);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(
        (p) => p.title.toLowerCase().includes(q) || p.programId.toLowerCase().includes(q),
      );
    }
    return filtered;
  }, [filters.type, filters.status, filters.department, filters.search]);

  return { data, isLoading: false };
}

export function useTrainingProgram(id: string) {
  const program = useMemo(() => mockTrainingPrograms.find((p) => p.id === id) ?? null, [id]);
  return { data: program, isLoading: false };
}

export function useTrainingContent(_programId: string) {
  return { data: mockContentBlocks, isLoading: false };
}

export function useAssessmentQuestions(_programId: string) {
  return { data: mockAssessmentQuestions, isLoading: false };
}

export function useParticipants(_programId: string) {
  return { data: mockParticipants, isLoading: false };
}

export function useTrainingStats() {
  const stats = useMemo(() => {
    const active = mockTrainingPrograms.filter((p) => p.status === 'ACTIVE').length;
    const totalEnrolled = mockTrainingPrograms.reduce((sum, p) => sum + p.enrolled, 0);
    const avgCompletion = Math.round(
      mockTrainingPrograms.filter((p) => p.status === 'ACTIVE').reduce((sum, p) => sum + p.completionRate, 0) /
        (active || 1),
    );
    const expiringCerts = mockParticipants.filter((p) => p.status === 'EXPIRED').length;
    return { activePrograms: active, totalEnrolled, avgCompletion, expiringCerts };
  }, []);
  return stats;
}


export function useCreateTrainingProgram() {
  const [isPending, setIsPending] = useState(false);
  const mutateAsync = async (payload: Record<string, unknown>) => {
    setIsPending(true);
    try {
      const response = await fetch('/api/lms/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('API unavailable');
      return response.json();
    } catch {
      // mock mode — silently succeed
      return { id: `TRN-${Date.now()}`, ...payload };
    } finally {
      setIsPending(false);
    }
  };
  return { mutateAsync, isPending };
}
