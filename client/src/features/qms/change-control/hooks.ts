import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem } from '@/lib/apiShape';
import toast from 'react-hot-toast';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ChangeRequest {
  id: string;
  crNumber: string;
  title: string;
  description: string;
  reasonForChange: string;
  changeType: 'Process' | 'Product' | 'System' | 'Document';
  impactLevel: 'High' | 'Medium' | 'Low';
  status: 'Draft' | 'Under Review' | 'Approved' | 'In Implementation' | 'Validated' | 'Closed' | 'Rejected';
  requestor: string;
  requestorId: string;
  department: string;
  targetDate: string;
  impactAssessment: string;
  affectedDocuments: string[];
  affectedProcesses: string[];
  riskAssessment: string;
  regulatoryNotification: boolean;
  notifyDepartments: string[];
  implementationTasks: ImplementationTask[];
  approvalStages: ApprovalStage[];
  validationResults: ValidationResult | null;
  history: ChangeHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ImplementationTask {
  id: string;
  description: string;
  owner: string;
  dueDate: string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Overdue';
}

export interface ApprovalStage {
  name: string;
  status: 'completed' | 'active' | 'pending' | 'rejected';
  approver?: string;
  timestamp?: string;
  comment?: string;
}

export interface ValidationResult {
  validated: boolean;
  validatedBy: string;
  validationDate: string;
  effectivenessConfirmed: boolean;
  notes: string;
}

export interface ChangeHistoryEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

// ── Hooks ───────────────────────────────────────────────────────────────────

interface CRFilters {
  status?: string;
  changeType?: string;
  impactLevel?: string;
  search?: string;
}

export function useChangeRequests(filters: CRFilters = {}) {
  return useQuery({
    queryKey: ['change-requests', filters],
    queryFn: async () => {
      try {
        // Backend mount is /qms/change-control, not /qms/change-requests
        const { data } = await api.get('/qms/change-control', { params: filters });
        return unwrapList<ChangeRequest>(data);
      } catch {
        return { data: [] as ChangeRequest[], total: 0, page: 1, pageSize: 20, totalPages: 0 };
      }
    },
    staleTime: 30_000,
  });
}

export function useChangeRequest(id: string) {
  return useQuery<ChangeRequest | null>({
    queryKey: ['change-requests', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/change-control/${id}`);
        const item = unwrapItem<ChangeRequest>(data);
        return (item?.id ? item : null) as ChangeRequest | null;
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });
}

export function useCreateChangeRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/qms/change-requests', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change-requests'] });
      toast.success('Change request created successfully');
    },
    onError: () => {
      toast.error('Failed to create change request');
    },
  });
}
