import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem, flattenUsers } from '@/lib/apiShape';
import toast from 'react-hot-toast';

const flattenComplaint = (c: Record<string, unknown>) => flattenUsers(c, ['assignedTo', 'investigator']);

// ── Types ───────────────────────────────────────────────────────────────────

export interface Complaint {
  id: string;
  complaintNumber: string;
  customerName: string;
  customerContact: string;
  customerEmail: string;
  subject: string;
  description: string;
  severity: 'Critical' | 'Major' | 'Minor';
  status: 'Received' | 'Acknowledged' | 'Under Investigation' | 'Resolution Proposed' | 'Closed';
  productService: string;
  batchOrderRef: string;
  receivedDate: string;
  responseDue: string;
  assignedTo: string;
  assignedToId: string;
  containmentActions: ContainmentAction[];
  investigation: Investigation | null;
  resolution: Resolution | null;
  communications: Communication[];
  linkedCAPAs: LinkedCAPA[];
  history: ComplaintHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ContainmentAction {
  id: string;
  description: string;
  owner: string;
  dueDate: string;
  status: 'Pending' | 'In Progress' | 'Completed';
}

export interface Investigation {
  rootCause: string;
  methodology: string;
  fiveWhys: FiveWhyEntry[];
  findings: string;
  investigatedBy: string;
  completedDate: string;
}

export interface FiveWhyEntry {
  whyNumber: number;
  question: string;
  answer: string;
}

export interface Resolution {
  proposedResolution: string;
  customerAccepted: boolean | null;
  acceptedDate: string | null;
  resolutionDetails: string;
  compensationOffered: string;
  resolvedBy: string;
}

export interface Communication {
  id: string;
  date: string;
  type: 'Email' | 'Phone' | 'Meeting' | 'Letter';
  direction: 'Inbound' | 'Outbound';
  summary: string;
  contactPerson: string;
  user: string;
}

export interface LinkedCAPA {
  id: string;
  capaNumber: string;
  title: string;
  status: string;
  type: 'CORRECTIVE' | 'PREVENTIVE';
}

export interface ComplaintHistoryEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
}

// ── Hooks ───────────────────────────────────────────────────────────────────

interface ComplaintFilters {
  status?: string;
  severity?: string;
  search?: string;
}

export function useComplaints(filters: ComplaintFilters = {}) {
  return useQuery({
    queryKey: ['complaints', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/complaints', { params: filters });
        return unwrapList<Complaint>(data, flattenComplaint as any);
      } catch {
        return { data: [] as Complaint[], total: 0, page: 1, pageSize: 20, totalPages: 0 };
      }
    },
    staleTime: 30_000,
  });
}

export function useComplaint(id: string) {
  return useQuery<Complaint | null>({
    queryKey: ['complaints', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/complaints/${id}`);
        const item = unwrapItem<Complaint>(data, flattenComplaint as any);
        return (item?.id ? item : null) as Complaint | null;
      } catch {
        return null;
      }
    },
    enabled: !!id,
  });
}

export type ComplaintStatus = Complaint['status'];

const STATUS_NEXT: Record<ComplaintStatus, ComplaintStatus | null> = {
  Received: 'Acknowledged',
  Acknowledged: 'Under Investigation',
  'Under Investigation': 'Resolution Proposed',
  'Resolution Proposed': 'Closed',
  Closed: null,
};

export function getNextStatus(current: ComplaintStatus): ComplaintStatus | null {
  return STATUS_NEXT[current];
}

export function useUpdateComplaintStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ComplaintStatus }) => {
      try {
        const { data } = await api.patch(`/qms/complaints/${id}/status`, { status });
        return data;
      } catch {
        return { id, status };
      }
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['complaints', id] });
      qc.invalidateQueries({ queryKey: ['complaints'] });
    },
  });
}

export function useCreateComplaint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/qms/complaints', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['complaints'] });
      toast.success('Complaint logged successfully');
    },
    onError: () => {
      toast.error('Failed to log complaint');
    },
  });
}
