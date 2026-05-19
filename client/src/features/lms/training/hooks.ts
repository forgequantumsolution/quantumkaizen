import { useState, useMemo } from 'react';
import { useUserIndustry, pickByIndustry } from '@/lib/userIndustry';

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
  // ── Additional records (20+ total for the demo) ──
  ...((): TrainingProgram[] => {
    const extras: Array<[string, string, string, TrainingProgram['type'], TrainingProgram['status'], string, string, number]> = [
      ['tp9',  'TRN-GDP-009',     'GDP (Good Distribution Practice) Awareness',     'REGULATORY',            'ACTIVE', 'Distribution',     '2 hours',   48],
      ['tp10', 'TRN-ERG-010',     'Ergonomics & Manual Handling',                    'INDUCTION',            'ACTIVE', 'EHS',              '45 min',    55],
      ['tp11', 'TRN-EHS-011',     'Chemical Safety & Hazard Communication',          'REGULATORY',            'ACTIVE', 'EHS',              '1.5 hours', 62],
      ['tp12', 'TRN-CSV-012',     'Computer System Validation (GAMP 5)',             'CLASSROOM',            'ACTIVE', 'IT / Validation',  '4 hours',   28],
      ['tp13', 'TRN-APV-013',     'APR / APQR Authoring Workshop',                    'CLASSROOM',            'ACTIVE', 'Quality Assurance','3 hours',   22],
      ['tp14', 'TRN-OOS-014',     'OOS / OOT Investigation Methodology',             'CLASSROOM',            'ACTIVE', 'Quality Control',  '2.5 hours', 38],
      ['tp15', 'TRN-CHG-015',     'Change Control Process',                           'E_LEARNING',            'ACTIVE', 'Quality Assurance','1 hour',    65],
      ['tp16', 'TRN-RCA-016',     'Root Cause Analysis Techniques (5-Why / Fishbone)','CLASSROOM',            'ACTIVE', 'Quality Assurance','4 hours',   42],
      ['tp17', 'TRN-TLM-017',     'Temperature & Humidity Management',               'E_LEARNING',            'ACTIVE', 'Warehouse',        '45 min',    35],
      ['tp18', 'TRN-ANX1-018',    'EU GMP Annex 1 — 2022 Revision',                  'REGULATORY',            'ACTIVE', 'Sterile Mfg',      '3 hours',   30],
      ['tp19', 'TRN-DI-019',      'Data Integrity Refresher (ALCOA+)',               'REGULATORY',            'ACTIVE', 'Quality Control',  '1.5 hours', 72],
      ['tp20', 'TRN-AS-020',      'Aseptic Technique Re-Qualification',              'REFRESHER',            'ACTIVE', 'Sterile Mfg',      '2 hours',   18],
    ];
    return extras.map(([id, programId, title, type, status, department, duration, enrolled]) => ({
      id, programId, title,
      description: title + ' — required per SOP training matrix.',
      type, status, department, duration,
      enrolled, completionRate: Math.round(Math.random() * 30 + 60),
      validityPeriod: '1 year', passingScore: 80,
      objectives: ['Demonstrate understanding of the topic', 'Apply learnings in daily work'],
      prerequisites: [],
      createdAt: '2026-01-15T10:00:00Z', updatedAt: '2026-03-10T10:00:00Z',
    }));
  })(),
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

// Medical-device training programs — ISO 13485 §6.2 / 21 CFR 820.25.
export const mockMedicalDeviceTrainingPrograms: TrainingProgram[] = [
  {
    id: 'md-tp1', programId: 'TRN-MD-001', title: 'ISO 13485:2016 Awareness',
    description: 'Foundation training on ISO 13485:2016 — scope, QMS structure, design controls, regulatory linkages and risk-based thinking for medical-device manufacturing.',
    type: 'REGULATORY', status: 'ACTIVE', department: 'Quality Assurance',
    duration: '8 hours', enrolled: 42, completionRate: 94, validityPeriod: '3 years', passingScore: 80,
    objectives: ['Explain ISO 13485 clause structure', 'Map clauses to internal SOPs', 'Identify key documentation requirements for medical devices'],
    prerequisites: [], createdAt: '2024-08-01T10:00:00Z', updatedAt: '2026-03-10T08:00:00Z',
  },
  {
    id: 'md-tp2', programId: 'TRN-MD-002', title: 'ISO 14971:2019 — Risk Management Workshop',
    description: 'Workshop covering hazard analysis, risk evaluation, control selection, residual risk acceptability and benefit-risk analysis for medical devices.',
    type: 'CLASSROOM', status: 'ACTIVE', department: 'Design Controls',
    duration: '16 hours', enrolled: 24, completionRate: 88, validityPeriod: '3 years', passingScore: 80,
    objectives: ['Build a risk management file', 'Conduct hazard identification per Annex C', 'Quantify risks (likelihood × severity)', 'Verify and validate risk controls'],
    prerequisites: ['ISO 13485:2016 Awareness'], createdAt: '2024-09-12T10:00:00Z', updatedAt: '2026-03-12T11:00:00Z',
  },
  {
    id: 'md-tp3', programId: 'TRN-MD-003', title: 'IEC 62366-1 Usability Engineering',
    description: 'Usability engineering process for medical devices — use specification, use-related risk analysis, formative and summative evaluations.',
    type: 'CLASSROOM', status: 'ACTIVE', department: 'Design Controls',
    duration: '8 hours', enrolled: 18, completionRate: 82, validityPeriod: '3 years', passingScore: 75,
    objectives: ['Define use specification', 'Identify use-related hazards', 'Plan and conduct formative/summative studies', 'Document the usability engineering file'],
    prerequisites: ['ISO 14971:2019 Workshop'], createdAt: '2025-02-01T10:00:00Z', updatedAt: '2026-03-12T11:00:00Z',
  },
  {
    id: 'md-tp4', programId: 'TRN-MD-004', title: 'EO Sterilization Cycle Operation & Release (ISO 11135)',
    description: 'OJT for sterilization operators — cycle parameters, biological indicator handling, EO/ECH residual release, post-maintenance qualification.',
    type: 'OJT', status: 'ACTIVE', department: 'Sterilization',
    duration: '24 hours', enrolled: 12, completionRate: 92, validityPeriod: '1 year', passingScore: 90,
    objectives: ['Operate EO sterilizers per validated parameters', 'Perform biological indicator setup and read-out', 'Recognise and respond to cycle deviations'],
    prerequisites: ['Aseptic Awareness'], createdAt: '2024-06-12T10:00:00Z', updatedAt: '2026-04-10T11:00:00Z',
  },
  {
    id: 'md-tp5', programId: 'TRN-MD-005', title: 'EU MDR Vigilance & PMS — Incident Reporting',
    description: 'Regulatory training on incident classification, MDR/IVDR reporting timelines, FSCA decisions and PSUR authoring per EU MDR 2017/745.',
    type: 'REGULATORY', status: 'ACTIVE', department: 'Regulatory Affairs',
    duration: '6 hours', enrolled: 16, completionRate: 89, validityPeriod: '2 years', passingScore: 85,
    objectives: ['Apply MDR Article 87/88 timelines', 'Decide reportability with the MDR decision tree', 'Draft an FSCA notification and a PSUR section'],
    prerequisites: ['ISO 13485:2016 Awareness'], createdAt: '2024-10-22T10:00:00Z', updatedAt: '2026-03-20T11:00:00Z',
  },
  {
    id: 'md-tp6', programId: 'TRN-MD-006', title: 'Cleanroom Behaviour & Gowning (ISO 14644)',
    description: 'Mandatory training for Class 7/8 cleanroom personnel — gowning sequence, behaviour, materials transfer, EM sampling.',
    type: 'INDUCTION', status: 'ACTIVE', department: 'Cleanroom Assembly',
    duration: '6 hours', enrolled: 35, completionRate: 96, validityPeriod: '1 year', passingScore: 95,
    objectives: ['Demonstrate correct gowning sequence', 'Identify gowning breaches', 'Perform a contamination event response'],
    prerequisites: ['Safety Induction'], createdAt: '2023-11-15T10:00:00Z', updatedAt: '2026-03-15T11:00:00Z',
  },
  {
    id: 'md-tp7', programId: 'TRN-MD-007', title: 'IEC 62304 Medical Device Software Lifecycle',
    description: 'Software lifecycle processes for medical-device firmware: SOUP/OTS handling, planning, V&V, problem resolution, configuration management.',
    type: 'E_LEARNING', status: 'ACTIVE', department: 'Design Controls',
    duration: '4 hours', enrolled: 11, completionRate: 91, validityPeriod: '3 years', passingScore: 80,
    objectives: ['Classify software per IEC 62304 (A/B/C)', 'Apply V-model planning', 'Document SOUP integration'],
    prerequisites: ['ISO 13485:2016 Awareness'], createdAt: '2025-01-10T10:00:00Z', updatedAt: '2026-02-20T11:00:00Z',
  },
  {
    id: 'md-tp8', programId: 'TRN-MD-008', title: 'UDI Compliance — 21 CFR 830 & EU MDR Article 27',
    description: 'Refresher covering UDI assignment, GUDID/EUDAMED submission, print/verify controls and reconciliation.',
    type: 'REFRESHER', status: 'ACTIVE', department: 'Regulatory Affairs',
    duration: '2 hours', enrolled: 28, completionRate: 87, validityPeriod: '1 year', passingScore: 75,
    objectives: ['Generate UDI-DI/UDI-PI per GS1 rules', 'Submit to GUDID/EUDAMED', 'Reconcile UDI master register'],
    prerequisites: [], createdAt: '2024-12-01T10:00:00Z', updatedAt: '2026-03-25T13:30:00Z',
  },
  {
    id: 'md-tp9', programId: 'TRN-MD-009', title: 'Biocompatibility & ISO 10993 Test Selection',
    description: 'Test selection matrix per ISO 10993-1, contact category and duration; sampling and CoA review.',
    type: 'CLASSROOM', status: 'ACTIVE', department: 'QC Lab',
    duration: '6 hours', enrolled: 14, completionRate: 84, validityPeriod: '3 years', passingScore: 80,
    objectives: ['Choose appropriate ISO 10993 tests', 'Plan biocompatibility evaluation for a new device', 'Interpret CoA / GLP study outputs'],
    prerequisites: [], createdAt: '2025-04-05T10:00:00Z', updatedAt: '2026-03-25T13:30:00Z',
  },
  {
    id: 'md-tp10', programId: 'TRN-MD-010', title: 'MDSAP — Multi-Region Inspection Readiness',
    description: 'Awareness of Medical Device Single Audit Program — process categories, audit-grading, common findings and readiness checklists.',
    type: 'REGULATORY', status: 'ACTIVE', department: 'Quality Assurance',
    duration: '4 hours', enrolled: 22, completionRate: 81, validityPeriod: '2 years', passingScore: 75,
    objectives: ['Describe MDSAP process categories', 'Prepare for grading per MDSAP audit-grading matrix', 'Apply preventive actions to common findings'],
    prerequisites: ['ISO 13485:2016 Awareness'], createdAt: '2024-12-15T10:00:00Z', updatedAt: '2026-03-25T13:30:00Z',
  },
  {
    id: 'md-tp11', programId: 'TRN-MD-011', title: 'Cybersecurity for Connected Devices (IEC 81001-5-1)',
    description: 'Threat modelling, SBOM (SPDX 2.3) generation, secure-by-design principles and post-market vulnerability management per FDA 2023 guidance.',
    type: 'CLASSROOM', status: 'DRAFT', department: 'Design Controls',
    duration: '8 hours', enrolled: 0, completionRate: 0, validityPeriod: '2 years', passingScore: 80,
    objectives: ['Build a STRIDE threat model', 'Generate and maintain an SBOM', 'Plan vulnerability management'],
    prerequisites: ['IEC 62304 Medical Device Software Lifecycle'], createdAt: '2026-02-15T10:00:00Z', updatedAt: '2026-03-25T13:30:00Z',
  },
  {
    id: 'md-tp12', programId: 'TRN-MD-012', title: 'Aseptic Technique Re-Qualification',
    description: 'Annual re-qualification for Class 7 aseptic-area operators including gowning, media-fill participation and competency assessment.',
    type: 'REFRESHER', status: 'ACTIVE', department: 'Cleanroom Assembly',
    duration: '4 hours', enrolled: 18, completionRate: 95, validityPeriod: '1 year', passingScore: 90,
    objectives: ['Re-qualify aseptic gowning', 'Pass observation by QA', 'Participate in media-fill run'],
    prerequisites: ['Cleanroom Behaviour & Gowning'], createdAt: '2024-04-01T10:00:00Z', updatedAt: '2026-03-25T13:30:00Z',
  },
];

// Dairy tenant — FSSAI / ISO 22000 / HACCP themed training programs.
export const mockDairyTrainingPrograms: TrainingProgram[] = [
  { id: 'dy-tp1',  programId: 'TRN-DY-001', title: 'FSSAI Schedule 4 — Hygienic Food Premises',
    description: 'Awareness training on FSSAI Schedule 4 Part II — sanitary food premises, personal hygiene, food handler health, water source and waste disposal.',
    type: 'INDUCTION', status: 'ACTIVE', department: 'Quality Assurance',
    duration: '4 hours', enrolled: 124, completionRate: 96, validityPeriod: '1 year', passingScore: 85,
    objectives: ['Apply FSSAI Schedule 4 §1, §2, §3 in daily work', 'Identify hygienic-zone breaches', 'Use hand-wash, gowning and PPE correctly'],
    prerequisites: [], createdAt: '2023-06-15T10:00:00Z', updatedAt: '2026-04-12T08:00:00Z',
  },
  { id: 'dy-tp2',  programId: 'TRN-DY-002', title: 'HACCP for Dairy Processing',
    description: 'Codex Alimentarius HACCP 7 principles applied to dairy: hazard analysis, CCP identification, critical limits, monitoring, corrective actions, verification, documentation.',
    type: 'CLASSROOM', status: 'ACTIVE', department: 'Quality Assurance',
    duration: '16 hours', enrolled: 38, completionRate: 92, validityPeriod: '3 years', passingScore: 80,
    objectives: ['Lead HACCP plan author/review', 'Distinguish CCP vs OPRP vs PRP', 'Set and verify critical limits at pasteurization / packaging'],
    prerequisites: ['FSSAI Schedule 4 — Hygienic Food Premises'], createdAt: '2023-09-22T10:00:00Z', updatedAt: '2026-04-12T11:00:00Z',
  },
  { id: 'dy-tp3',  programId: 'TRN-DY-003', title: 'ISO 22000:2018 Awareness',
    description: 'FSMS scope, leadership, planning, support, operation, performance evaluation, improvement; relationship between PRPs, OPRPs and HACCP plan.',
    type: 'E_LEARNING', status: 'ACTIVE', department: 'Quality Assurance',
    duration: '6 hours', enrolled: 62, completionRate: 89, validityPeriod: '3 years', passingScore: 75,
    objectives: ['Map clause structure to SOPs', 'Participate in internal audits', 'Maintain documented information'],
    prerequisites: [], createdAt: '2024-01-08T10:00:00Z', updatedAt: '2026-04-12T11:00:00Z',
  },
  { id: 'dy-tp4',  programId: 'TRN-DY-004', title: 'Raw-Milk Testing — Fat / SNF / COB / Antibiotic Dipstick',
    description: 'On-the-job training for dock-receiving testers — Gerber fat, Lactoscan SNF, clot-on-boiling, alcohol test, Charm SL beta-lactam dipstick, organoleptic acceptance.',
    type: 'OJT', status: 'ACTIVE', department: 'Receiving Dock',
    duration: '24 hours', enrolled: 14, completionRate: 95, validityPeriod: '1 year', passingScore: 90,
    objectives: ['Perform Gerber fat per IS 1224', 'Operate Lactoscan auto-analyser', 'Interpret antibiotic dipstick visually'],
    prerequisites: ['FSSAI Schedule 4 — Hygienic Food Premises'], createdAt: '2024-03-22T10:00:00Z', updatedAt: '2026-04-12T11:00:00Z',
  },
  { id: 'dy-tp5',  programId: 'TRN-DY-005', title: 'HTST Pasteurization — Operator Re-Qualification',
    description: 'Annual re-qualification for pasteurizer operators — cycle parameters, holding-tube residence, flow-divert valve, phosphatase verification, CIP between batches.',
    type: 'REFRESHER', status: 'ACTIVE', department: 'Pasteurization',
    duration: '8 hours', enrolled: 11, completionRate: 91, validityPeriod: '1 year', passingScore: 90,
    objectives: ['Run PHE-01 / PHE-02 within validated parameters', 'Recognise cycle deviations', 'Read and respond to phosphatase results'],
    prerequisites: ['HACCP for Dairy Processing'], createdAt: '2024-05-10T10:00:00Z', updatedAt: '2026-04-12T11:00:00Z',
  },
  { id: 'dy-tp6',  programId: 'TRN-DY-006', title: 'Microbiology of Milk & Milk Products',
    description: 'Microbial limits per FSSAI 2.3.2 — TPC, coliform, E. coli, Salmonella, Listeria; methods (pour plate, MPN, immunological); culture media handling.',
    type: 'CLASSROOM', status: 'ACTIVE', department: 'Microbiology Lab',
    duration: '12 hours', enrolled: 9, completionRate: 88, validityPeriod: '3 years', passingScore: 80,
    objectives: ['Perform TPC / coliform per BIS IS 5402', 'Operate ELISA for AfM1', 'Interpret microbiological release results'],
    prerequisites: [], createdAt: '2024-07-15T10:00:00Z', updatedAt: '2026-03-10T11:00:00Z',
  },
  { id: 'dy-tp7',  programId: 'TRN-DY-007', title: 'CIP Procedure & ATP-Swab Verification',
    description: 'Refresher on CIP cycles, validated parameters, recipe selection on HMI, ATP-swab verification and corrective actions on non-conforming swabs.',
    type: 'REFRESHER', status: 'ACTIVE', department: 'Production',
    duration: '3 hours', enrolled: 28, completionRate: 90, validityPeriod: '1 year', passingScore: 80,
    objectives: ['Run CIP per SOP-DY-CIP-02', 'Operate ATP-swab device', 'Escalate failed swabs'],
    prerequisites: [], createdAt: '2024-09-12T10:00:00Z', updatedAt: '2026-04-12T11:00:00Z',
  },
  { id: 'dy-tp8',  programId: 'TRN-DY-008', title: 'Cold-Chain Driver & Dispatch Training',
    description: 'Cold-chain compliance for refrigerated tanker / van drivers — pre-trip checks, IoT logger operation, temperature alert escalation, hand-off SOP at depots.',
    type: 'INDUCTION', status: 'ACTIVE', department: 'Cold Chain',
    duration: '4 hours', enrolled: 22, completionRate: 88, validityPeriod: '1 year', passingScore: 75,
    objectives: ['Verify pre-trip cold-chain readiness', 'Respond to IoT temperature alerts', 'Hand off to depots with sign-off'],
    prerequisites: [], createdAt: '2024-11-04T10:00:00Z', updatedAt: '2026-04-12T11:00:00Z',
  },
  { id: 'dy-tp9',  programId: 'TRN-DY-009', title: 'Label Compliance — FSSAI Labelling Regulation 2020',
    description: 'FSSAI labelling requirements: mandatory declarations, vegetarian / non-vegetarian symbols, MRP and best-before date setting, claims regulation.',
    type: 'REGULATORY', status: 'ACTIVE', department: 'Packaging',
    duration: '4 hours', enrolled: 19, completionRate: 87, validityPeriod: '2 years', passingScore: 75,
    objectives: ['Review artwork against FSSAI Labelling Regulation 2020', 'Set FFS date stamping correctly', 'Recognise non-compliant claims'],
    prerequisites: [], createdAt: '2024-12-15T10:00:00Z', updatedAt: '2026-03-25T13:30:00Z',
  },
  { id: 'dy-tp10', programId: 'TRN-DY-010', title: 'Ghee Manufacturing & BIS IS 3508 Compliance',
    description: 'Operating training for ghee kettle operators — clarification temperature profile, FFA monitoring, sediment removal and tin sealing.',
    type: 'OJT', status: 'ACTIVE', department: 'Production',
    duration: '12 hours', enrolled: 7, completionRate: 86, validityPeriod: '1 year', passingScore: 85,
    objectives: ['Run ghee boiling cycle per SOP', 'Test FFA per IS 3508', 'Maintain butter-to-ghee turnaround ≤ 48 h'],
    prerequisites: ['FSSAI Schedule 4 — Hygienic Food Premises'], createdAt: '2025-01-12T10:00:00Z', updatedAt: '2026-03-25T13:30:00Z',
  },
  { id: 'dy-tp11', programId: 'TRN-DY-011', title: 'Internal Auditor — FSSAI / ISO 22000',
    description: 'Internal-auditor course covering ISO 19011, audit planning, evidence gathering, finding classification, reporting and follow-up.',
    type: 'CLASSROOM', status: 'ACTIVE', department: 'Quality Assurance',
    duration: '24 hours', enrolled: 8, completionRate: 81, validityPeriod: '3 years', passingScore: 80,
    objectives: ['Plan and conduct internal audits per ISO 19011', 'Classify findings (Major / Minor / OFI)', 'Document audit reports'],
    prerequisites: ['ISO 22000:2018 Awareness'], createdAt: '2025-04-20T10:00:00Z', updatedAt: '2026-03-25T13:30:00Z',
  },
  { id: 'dy-tp12', programId: 'TRN-DY-012', title: 'Allergen Management for Dairy Sweets',
    description: 'Allergen-management training — tree nuts in badam-peda, milk allergens, undeclared allergens, cleaning verification between SKUs and label declarations.',
    type: 'CLASSROOM', status: 'ACTIVE', department: 'Production',
    duration: '4 hours', enrolled: 18, completionRate: 90, validityPeriod: '2 years', passingScore: 80,
    objectives: ['Identify allergen cross-contact risks', 'Verify allergen-cleaning between SKUs', 'Read FSSAI allergen-labelling rules'],
    prerequisites: [], createdAt: '2025-05-05T10:00:00Z', updatedAt: '2026-03-25T13:30:00Z',
  },
];

// ── Hooks ───────────────────────────────────────────────────────────────────

interface TrainingFilters {
  type?: string;
  status?: string;
  department?: string;
  search?: string;
}

export function useTrainingPrograms(filters: TrainingFilters = {}) {
  const industry = useUserIndustry();
  const source = pickByIndustry(industry, mockTrainingPrograms, { medical_device: mockMedicalDeviceTrainingPrograms, dairy: mockDairyTrainingPrograms });
  const data = useMemo(() => {
    let filtered = [...source];
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
  }, [source, filters.type, filters.status, filters.department, filters.search]);

  return { data, isLoading: false };
}

export function useTrainingProgram(id: string) {
  const industry = useUserIndustry();
  const source = pickByIndustry(industry, mockTrainingPrograms, { medical_device: mockMedicalDeviceTrainingPrograms, dairy: mockDairyTrainingPrograms });
  const program = useMemo(() => source.find((p) => p.id === id) ?? null, [source, id]);
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
  const industry = useUserIndustry();
  const source = pickByIndustry(industry, mockTrainingPrograms, { medical_device: mockMedicalDeviceTrainingPrograms, dairy: mockDairyTrainingPrograms });
  const stats = useMemo(() => {
    const active = source.filter((p) => p.status === 'ACTIVE').length;
    const totalEnrolled = source.reduce((sum, p) => sum + p.enrolled, 0);
    const avgCompletion = Math.round(
      source.filter((p) => p.status === 'ACTIVE').reduce((sum, p) => sum + p.completionRate, 0) /
        (active || 1),
    );
    const expiringCerts = mockParticipants.filter((p) => p.status === 'EXPIRED').length;
    return { activePrograms: active, totalEnrolled, avgCompletion, expiringCerts };
  }, [source]);
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
