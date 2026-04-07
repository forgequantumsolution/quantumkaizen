import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { NonConformance, PaginatedResponse } from '@/types';
import toast from 'react-hot-toast';

// ── Mock data ────────────────────────────────────────────────────────────────

export const mockNCs: NonConformance[] = [
  {
    id: 'nc1', ncNumber: 'NC-2026-0042', title: 'Out-of-spec hardness on batch HT-2026-112',
    description: 'Hardness test results for heat-treated flanges in batch HT-2026-112 fell below the minimum specification of 220 HB. Three out of ten samples measured between 198-215 HB.',
    type: 'OOS', severity: 'CRITICAL', status: 'OPEN',
    source: 'In-Process Inspection', department: 'Production', departmentId: 'dept2',
    productProcess: 'Heat Treatment', batchLot: 'HT-2026-112',
    assignedTo: 'Priya Sharma', assignedToId: 'u1', dueDate: '2026-04-06',
    priorityJustification: 'Critical customer order at risk; shipment deadline April 10.',
    containmentActions: [
      { id: 'ca1', description: 'Quarantine remaining batch HT-2026-112', owner: 'Vikram Patel', dueDate: '2026-03-30', status: 'COMPLETED' },
      { id: 'ca2', description: 'Notify customer about potential delay', owner: 'Priya Sharma', dueDate: '2026-03-31', status: 'IN_PROGRESS' },
    ],
    createdAt: '2026-03-30T09:15:00Z', updatedAt: '2026-03-30T09:15:00Z', closedAt: null, createdBy: 'Deepak Nair',
  },
  {
    id: 'nc2', ncNumber: 'NC-2026-0041', title: 'Dimensional deviation in machined valve body',
    description: 'Bore diameter on valve body part number VB-3200 measured 50.12mm against specification of 50.00 +/- 0.05mm.',
    type: 'PRODUCT_NC', severity: 'MAJOR', status: 'INVESTIGATION',
    source: 'Final Inspection', department: 'Quality Control', departmentId: 'dept3',
    productProcess: 'CNC Machining', batchLot: 'MCH-2026-089',
    assignedTo: 'Anita Desai', assignedToId: 'u3', dueDate: '2026-04-10',
    priorityJustification: null,
    containmentActions: [
      { id: 'ca3', description: 'Segregate affected parts', owner: 'Anita Desai', dueDate: '2026-03-28', status: 'COMPLETED' },
    ],
    createdAt: '2026-03-28T10:30:00Z', updatedAt: '2026-03-29T11:00:00Z', closedAt: null, createdBy: 'Deepak Nair',
  },
  {
    id: 'nc3', ncNumber: 'NC-2026-0040', title: 'Incorrect welding procedure used on pressure vessel',
    description: 'Welder used WPS-102 instead of the specified WPS-108 for circumferential seam on pressure vessel PV-4401. Weld joint requires requalification.',
    type: 'PROCESS_NC', severity: 'CRITICAL', status: 'ROOT_CAUSE',
    source: 'Internal Audit', department: 'Production', departmentId: 'dept2',
    productProcess: 'Welding', batchLot: 'PV-4401',
    assignedTo: 'Vikram Patel', assignedToId: 'u4', dueDate: '2026-04-03',
    priorityJustification: 'Safety-critical weld on pressure vessel; regulatory notification may be required.',
    containmentActions: [
      { id: 'ca4', description: 'Stop welding operations on PV-4401', owner: 'Vikram Patel', dueDate: '2026-03-25', status: 'COMPLETED' },
      { id: 'ca5', description: 'Conduct NDE on affected weld joint', owner: 'Deepak Nair', dueDate: '2026-03-27', status: 'COMPLETED' },
    ],
    createdAt: '2026-03-25T14:00:00Z', updatedAt: '2026-03-29T09:00:00Z', closedAt: null, createdBy: 'Sunita Rao',
  },
  {
    id: 'nc4', ncNumber: 'NC-2026-0039', title: 'Customer complaint — surface finish defect on delivered parts',
    description: 'Customer reported visible surface pitting on 15 out of 200 units delivered in order ORD-2026-0445.',
    type: 'COMPLAINT', severity: 'MAJOR', status: 'CAPA_PLANNING',
    source: 'Customer Complaint', department: 'Quality Assurance', departmentId: 'dept1',
    productProcess: 'Surface Treatment', batchLot: 'ST-2026-078',
    assignedTo: 'Priya Sharma', assignedToId: 'u1', dueDate: '2026-04-15',
    priorityJustification: null,
    containmentActions: [
      { id: 'ca6', description: 'Issue replacement parts to customer', owner: 'Priya Sharma', dueDate: '2026-03-30', status: 'IN_PROGRESS' },
    ],
    createdAt: '2026-03-22T10:00:00Z', updatedAt: '2026-03-29T15:00:00Z', closedAt: null, createdBy: 'Rajesh Kumar',
  },
  {
    id: 'nc5', ncNumber: 'NC-2026-0038', title: 'Deviation in raw material chemical composition',
    description: 'Incoming inspection of steel plate batch SP-2026-055 showed carbon content of 0.28% against specified max of 0.25%.',
    type: 'DEVIATION', severity: 'MINOR', status: 'CLOSED',
    source: 'Incoming Inspection', department: 'Quality Control', departmentId: 'dept3',
    productProcess: null, batchLot: 'SP-2026-055',
    assignedTo: 'Sunita Rao', assignedToId: 'u5', dueDate: '2026-03-20',
    priorityJustification: null,
    containmentActions: [
      { id: 'ca7', description: 'Return batch to supplier', owner: 'Sunita Rao', dueDate: '2026-03-15', status: 'COMPLETED' },
    ],
    createdAt: '2026-03-10T08:00:00Z', updatedAt: '2026-03-29T11:20:00Z', closedAt: '2026-03-29T11:20:00Z', createdBy: 'Anita Desai',
  },
  {
    id: 'nc6', ncNumber: 'NC-2026-0037', title: 'Calibration overdue on CMM machine',
    description: 'Coordinate Measuring Machine (CMM-02) calibration expired on 2026-03-15 but continued to be used for three days before detection.',
    type: 'PROCESS_NC', severity: 'MAJOR', status: 'CAPA_IMPLEMENTATION',
    source: 'Internal Audit', department: 'Quality Control', departmentId: 'dept3',
    productProcess: 'Measurement', batchLot: null,
    assignedTo: 'Anita Desai', assignedToId: 'u3', dueDate: '2026-04-01',
    priorityJustification: 'All parts measured during the gap period need re-inspection.',
    containmentActions: [
      { id: 'ca8', description: 'Take CMM-02 out of service', owner: 'Anita Desai', dueDate: '2026-03-18', status: 'COMPLETED' },
      { id: 'ca9', description: 'Identify all parts measured from 15-18 March', owner: 'Deepak Nair', dueDate: '2026-03-20', status: 'COMPLETED' },
    ],
    createdAt: '2026-03-18T09:00:00Z', updatedAt: '2026-03-28T16:00:00Z', closedAt: null, createdBy: 'Rajesh Kumar',
  },
  {
    id: 'nc7', ncNumber: 'NC-2026-0036', title: 'Missing traceability markings on forged rings',
    description: 'Six forged rings from lot FRG-2026-044 found without heat number stamps during shipping preparation.',
    type: 'PRODUCT_NC', severity: 'MINOR', status: 'CLOSED',
    source: 'Shipping Inspection', department: 'Production', departmentId: 'dept2',
    productProcess: 'Forging', batchLot: 'FRG-2026-044',
    assignedTo: 'Vikram Patel', assignedToId: 'u4', dueDate: '2026-03-15',
    priorityJustification: null,
    containmentActions: [
      { id: 'ca10', description: 'Re-stamp all rings from lot FRG-2026-044', owner: 'Vikram Patel', dueDate: '2026-03-10', status: 'COMPLETED' },
    ],
    createdAt: '2026-03-08T11:00:00Z', updatedAt: '2026-03-15T14:00:00Z', closedAt: '2026-03-15T14:00:00Z', createdBy: 'Priya Sharma',
  },
];

// ── Hooks ────────────────────────────────────────────────────────────────────

interface NCFilters {
  status?: string;
  severity?: string;
  type?: string;
  department?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function useNonConformances(filters: NCFilters = {}) {
  return useQuery<PaginatedResponse<NonConformance>>({
    queryKey: ['non-conformances', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/non-conformances', { params: filters });
        return data;
      } catch {
        let filtered = [...mockNCs];
        if (filters.status) filtered = filtered.filter((nc) => nc.status === filters.status);
        if (filters.severity) filtered = filtered.filter((nc) => nc.severity === filters.severity);
        if (filters.type) filtered = filtered.filter((nc) => nc.type === filters.type);
        if (filters.department) filtered = filtered.filter((nc) => nc.department === filters.department);
        if (filters.search) {
          const q = filters.search.toLowerCase();
          filtered = filtered.filter(
            (nc) =>
              nc.title.toLowerCase().includes(q) ||
              nc.ncNumber.toLowerCase().includes(q),
          );
        }
        return { data: filtered, total: filtered.length, page: 1, pageSize: 20, totalPages: 1 };
      }
    },
    staleTime: 30_000,
  });
}

export function useNonConformance(id: string) {
  return useQuery<NonConformance>({
    queryKey: ['non-conformances', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/non-conformances/${id}`);
        return data;
      } catch {
        const nc = mockNCs.find((n) => n.id === id);
        if (!nc) throw new Error('NC not found');
        return nc;
      }
    },
    enabled: !!id,
  });
}

export function useCreateNC() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/qms/non-conformances', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['non-conformances'] });
      toast.success('Non-conformance reported successfully');
    },
    onError: () => {
      toast.error('Failed to report non-conformance');
    },
  });
}

export function useUpdateNCStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      try {
        const { data } = await api.patch(`/qms/non-conformances/${id}/status`, { status });
        return data;
      } catch {
        return { id, status }; // mock success
      }
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['non-conformances', id] });
      qc.invalidateQueries({ queryKey: ['non-conformances'] });
    },
  });
}
