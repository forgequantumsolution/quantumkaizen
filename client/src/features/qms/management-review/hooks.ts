import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ManagementReview {
  id: string;
  title: string;
  date: string;
  time: string;
  status: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  attendees: Attendee[];
  agenda: string[];
  minutesSummary: string | null;
  actionItems: ActionItem[];
}

export interface Attendee {
  name: string;
  role: string;
  present?: boolean;
}

export interface ActionItem {
  id: string;
  action: string;
  owner: string;
  dueDate: string;
  status: 'Open' | 'In Progress' | 'Completed' | 'Overdue';
  reviewId: string;
  reviewTitle: string;
  priority: 'High' | 'Medium' | 'Low';
  completionNotes: string | null;
}

export interface QMSSummary {
  ncCount: number;
  ncOpenCount: number;
  ncClosedThisQuarter: number;
  ncAvgClosureTime: number;
  capaCount: number;
  capaOpenCount: number;
  capaEffectivenessRate: number;
  auditFindingsTotal: number;
  auditFindingsOpen: number;
  auditFindingsMajor: number;
}

export interface DMSSummary {
  totalDocuments: number;
  documentsDueForReview: number;
  newDocumentsThisQuarter: number;
  overdueReviews: number;
  pendingApprovals: number;
}

export interface LMSSummary {
  trainingCompliancePercent: number;
  totalTrainings: number;
  completedTrainings: number;
  expiringCertifications: number;
  overdueCertifications: number;
  avgTrainingHoursPerEmployee: number;
}

export interface SupplierSummary {
  totalSuppliers: number;
  approvedSuppliers: number;
  suppliersOnWatch: number;
  avgSupplierRating: number;
  supplierNCCount: number;
  overdueEvaluations: number;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

export const mockReviews: ManagementReview[] = [
  {
    id: 'mr1',
    title: 'Q2 2026 Management Review',
    date: '2026-04-25',
    time: '10:00 AM - 01:00 PM',
    status: 'Scheduled',
    attendees: [
      { name: 'Kavita Iyer', role: 'Managing Director' },
      { name: 'Priya Sharma', role: 'QA Manager' },
      { name: 'Rajesh Kumar', role: 'Engineering Head' },
      { name: 'Vikram Patel', role: 'Production Manager' },
      { name: 'Sunita Rao', role: 'Procurement Head' },
      { name: 'Anita Desai', role: 'QC Lead' },
      { name: 'Deepak Nair', role: 'HSE Manager' },
    ],
    agenda: [
      'Review of previous MRM action items',
      'QMS performance metrics (Q1 2026)',
      'NC and CAPA trend analysis',
      'Internal and external audit findings',
      'Customer complaint analysis',
      'Supplier performance review',
      'Training compliance status',
      'Document management system migration update',
      'Risk register review',
      'Resource requirements and improvement opportunities',
    ],
    minutesSummary: null,
    actionItems: [],
  },
  {
    id: 'mr2',
    title: 'Q1 2026 Management Review',
    date: '2026-01-28',
    time: '10:00 AM - 12:30 PM',
    status: 'Completed',
    attendees: [
      { name: 'Kavita Iyer', role: 'Managing Director', present: true },
      { name: 'Priya Sharma', role: 'QA Manager', present: true },
      { name: 'Rajesh Kumar', role: 'Engineering Head', present: true },
      { name: 'Vikram Patel', role: 'Production Manager', present: true },
      { name: 'Sunita Rao', role: 'Procurement Head', present: false },
      { name: 'Anita Desai', role: 'QC Lead', present: true },
      { name: 'Deepak Nair', role: 'HSE Manager', present: true },
    ],
    agenda: [
      'Review of Q4 2025 action items',
      'QMS performance summary',
      'Audit findings status',
      'Customer satisfaction analysis',
      'Supplier performance',
      'Training and competency',
      'Improvement opportunities',
    ],
    minutesSummary: 'Review conducted with 6 of 7 members present. All Q4 2025 action items reviewed — 6 completed, 2 carried forward. NC rate decreased by 12% QoQ. CAPA effectiveness improved to 88%. One major audit finding pending closure. Customer satisfaction score improved to 4.2/5.0. Supplier evaluation cycle initiated for 8 critical suppliers. Training compliance at 91%. Decision: Proceed with DMS migration project. Next review scheduled for April 2026.',
    actionItems: [],
  },
  {
    id: 'mr3',
    title: 'Q4 2025 Management Review',
    date: '2025-10-30',
    time: '10:00 AM - 01:00 PM',
    status: 'Completed',
    attendees: [
      { name: 'Kavita Iyer', role: 'Managing Director', present: true },
      { name: 'Priya Sharma', role: 'QA Manager', present: true },
      { name: 'Rajesh Kumar', role: 'Engineering Head', present: true },
      { name: 'Vikram Patel', role: 'Production Manager', present: true },
      { name: 'Sunita Rao', role: 'Procurement Head', present: true },
      { name: 'Anita Desai', role: 'QC Lead', present: true },
      { name: 'Deepak Nair', role: 'HSE Manager', present: true },
    ],
    agenda: [
      'Review of Q3 action items',
      'Annual QMS performance',
      'Certification audit preparation',
      'Resource planning',
    ],
    minutesSummary: 'Full attendance. Q3 action items — 8 of 8 completed. Annual NC trend shows 15% reduction YoY. CAPA effectiveness at 85%. ISO 9001 surveillance audit scheduled for November 2025. Supplier rating system upgrade approved. Training plan for 2026 discussed.',
    actionItems: [],
  },
];

export const mockActionItems: ActionItem[] = [
  { id: 'ai1', action: 'Complete DMS migration Phase 1 (QA/QC documents)', owner: 'Priya Sharma', dueDate: '2026-04-25', status: 'In Progress', reviewId: 'mr2', reviewTitle: 'Q1 2026 Management Review', priority: 'High', completionNotes: null },
  { id: 'ai2', action: 'Close major audit finding AF-2025-012 (calibration procedure gap)', owner: 'Anita Desai', dueDate: '2026-03-31', status: 'Overdue', reviewId: 'mr2', reviewTitle: 'Q1 2026 Management Review', priority: 'High', completionNotes: null },
  { id: 'ai3', action: 'Conduct supplier evaluation for 8 critical suppliers', owner: 'Sunita Rao', dueDate: '2026-04-15', status: 'In Progress', reviewId: 'mr2', reviewTitle: 'Q1 2026 Management Review', priority: 'Medium', completionNotes: null },
  { id: 'ai4', action: 'Achieve 95% training compliance target for Q2', owner: 'Rajesh Kumar', dueDate: '2026-06-30', status: 'Open', reviewId: 'mr2', reviewTitle: 'Q1 2026 Management Review', priority: 'Medium', completionNotes: null },
  { id: 'ai5', action: 'Implement automated calibration reminder system', owner: 'Deepak Nair', dueDate: '2026-04-30', status: 'In Progress', reviewId: 'mr2', reviewTitle: 'Q1 2026 Management Review', priority: 'High', completionNotes: null },
  { id: 'ai6', action: 'Update risk register with new operational risks identified', owner: 'Priya Sharma', dueDate: '2026-02-28', status: 'Completed', reviewId: 'mr2', reviewTitle: 'Q1 2026 Management Review', priority: 'Medium', completionNotes: 'Risk register updated with 5 new risks. Reviewed and approved by management.' },
  { id: 'ai7', action: 'Deploy customer satisfaction survey for Q1 orders', owner: 'Sunita Rao', dueDate: '2026-03-15', status: 'Completed', reviewId: 'mr2', reviewTitle: 'Q1 2026 Management Review', priority: 'Low', completionNotes: 'Survey deployed to 42 customers. Response rate: 68%.' },
  { id: 'ai8', action: 'Review and update all FMEA documents for production processes', owner: 'Vikram Patel', dueDate: '2026-05-15', status: 'Open', reviewId: 'mr2', reviewTitle: 'Q1 2026 Management Review', priority: 'Medium', completionNotes: null },
];

export const mockQMSSummary: QMSSummary = {
  ncCount: 42,
  ncOpenCount: 8,
  ncClosedThisQuarter: 14,
  ncAvgClosureTime: 18,
  capaCount: 28,
  capaOpenCount: 6,
  capaEffectivenessRate: 88,
  auditFindingsTotal: 15,
  auditFindingsOpen: 3,
  auditFindingsMajor: 1,
};

export const mockDMSSummary: DMSSummary = {
  totalDocuments: 342,
  documentsDueForReview: 18,
  newDocumentsThisQuarter: 12,
  overdueReviews: 4,
  pendingApprovals: 7,
};

export const mockLMSSummary: LMSSummary = {
  trainingCompliancePercent: 91,
  totalTrainings: 156,
  completedTrainings: 142,
  expiringCertifications: 8,
  overdueCertifications: 2,
  avgTrainingHoursPerEmployee: 24,
};

export const mockSupplierSummary: SupplierSummary = {
  totalSuppliers: 48,
  approvedSuppliers: 42,
  suppliersOnWatch: 3,
  avgSupplierRating: 4.1,
  supplierNCCount: 5,
  overdueEvaluations: 2,
};

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useManagementReviews() {
  return useQuery({
    queryKey: ['management-reviews'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/management-reviews');
        return data;
      } catch {
        return { reviews: mockReviews, actionItems: mockActionItems };
      }
    },
    staleTime: 30_000,
  });
}

export function useScheduleReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { title: string; date: string; time: string; agenda: string }) => {
      try {
        const { data } = await api.post('/qms/management-reviews', body);
        return data;
      } catch {
        return { id: `mr-${Date.now()}`, ...body, status: 'Scheduled' };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['management-reviews'] }),
  });
}

export function useManagementReviewSummary() {
  return useQuery({
    queryKey: ['management-review-summary'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/management-reviews/summary');
        return data;
      } catch {
        return {
          qms: mockQMSSummary,
          dms: mockDMSSummary,
          lms: mockLMSSummary,
          supplier: mockSupplierSummary,
        };
      }
    },
    staleTime: 30_000,
  });
}
