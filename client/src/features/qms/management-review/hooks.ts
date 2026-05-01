import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem } from '@/lib/apiShape';

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

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useManagementReviews() {
  return useQuery({
    queryKey: ['management-reviews'],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/management-review/meetings');
        const { data: reviews } = unwrapList(data);
        return {
          reviews: (Array.isArray(reviews) ? reviews : []) as unknown as ManagementReview[],
          actionItems: [] as ActionItem[],
        };
      } catch {
        return { reviews: [] as ManagementReview[], actionItems: [] as ActionItem[] };
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
        const { data } = await api.post('/qms/management-review/meetings', body);
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
        const { data } = await api.get('/qms/management-review/summary');
        return unwrapItem(data);
      } catch {
        return {
          qms: {
            ncCount: 0,
            ncOpenCount: 0,
            ncClosedThisQuarter: 0,
            ncAvgClosureTime: 0,
            capaCount: 0,
            capaOpenCount: 0,
            capaEffectivenessRate: 0,
            auditFindingsTotal: 0,
            auditFindingsOpen: 0,
            auditFindingsMajor: 0,
          } as QMSSummary,
          dms: {
            totalDocuments: 0,
            documentsDueForReview: 0,
            newDocumentsThisQuarter: 0,
            overdueReviews: 0,
            pendingApprovals: 0,
          } as DMSSummary,
          lms: {
            trainingCompliancePercent: 0,
            totalTrainings: 0,
            completedTrainings: 0,
            expiringCertifications: 0,
            overdueCertifications: 0,
            avgTrainingHoursPerEmployee: 0,
          } as LMSSummary,
          supplier: {
            totalSuppliers: 0,
            approvedSuppliers: 0,
            suppliersOnWatch: 0,
            avgSupplierRating: 0,
            supplierNCCount: 0,
            overdueEvaluations: 0,
          } as SupplierSummary,
        };
      }
    },
    staleTime: 30_000,
  });
}
