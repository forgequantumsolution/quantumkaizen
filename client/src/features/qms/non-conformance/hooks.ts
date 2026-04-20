import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem, flattenUsers } from '@/lib/apiShape';
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
  // ── 2025 records ──
  {
    id: 'nc8', ncNumber: 'NC-2025-0031', title: 'Porosity defects in aluminium die castings',
    description: 'Gas porosity detected in 8 of 50 sampled aluminium die castings in lot ADC-2025-067. X-ray inspection revealed voids exceeding acceptance criterion of 1mm diameter.',
    type: 'PRODUCT_NC', severity: 'MAJOR', status: 'CLOSED',
    source: 'Final Inspection', department: 'Quality Control', departmentId: 'dept3',
    productProcess: 'Die Casting', batchLot: 'ADC-2025-067',
    assignedTo: 'Anita Desai', assignedToId: 'u3', dueDate: '2025-11-10',
    priorityJustification: null, containmentActions: [
      { id: 'ca11', description: 'Segregate and quarantine lot ADC-2025-067', owner: 'Anita Desai', dueDate: '2025-10-28', status: 'COMPLETED' },
    ],
    createdAt: '2025-10-25T08:30:00Z', updatedAt: '2025-11-10T11:00:00Z', closedAt: '2025-11-10T11:00:00Z', createdBy: 'Priya Sharma',
  },
  {
    id: 'nc9', ncNumber: 'NC-2025-0028', title: 'Thread gauging failure on stainless steel fittings',
    description: 'Go/No-Go thread gauge failed on 12 out of 80 stainless steel pipe fittings from batch SSF-2025-055. Thread form non-conforming to BS EN 10226.',
    type: 'OOS', severity: 'MAJOR', status: 'CLOSED',
    source: 'In-Process Inspection', department: 'Production', departmentId: 'dept2',
    productProcess: 'Thread Cutting', batchLot: 'SSF-2025-055',
    assignedTo: 'Vikram Patel', assignedToId: 'u4', dueDate: '2025-09-20',
    priorityJustification: null, containmentActions: [
      { id: 'ca12', description: 'Stop thread cutting on CNC-04, verify tool geometry', owner: 'Vikram Patel', dueDate: '2025-09-12', status: 'COMPLETED' },
    ],
    createdAt: '2025-09-10T10:00:00Z', updatedAt: '2025-09-22T15:30:00Z', closedAt: '2025-09-22T15:30:00Z', createdBy: 'Deepak Nair',
  },
  {
    id: 'nc10', ncNumber: 'NC-2025-0022', title: 'Chemical composition deviation in forged billets',
    description: 'Third-party mill test report for forged billets lot FB-2025-039 shows manganese content of 1.52% against max specification of 1.40%.',
    type: 'DEVIATION', severity: 'CRITICAL', status: 'CLOSED',
    source: 'Incoming Inspection', department: 'Quality Assurance', departmentId: 'dept1',
    productProcess: null, batchLot: 'FB-2025-039',
    assignedTo: 'Priya Sharma', assignedToId: 'u1', dueDate: '2025-07-15',
    priorityJustification: 'Material being used in pressure-critical components; disposition requires metallurgist sign-off.',
    containmentActions: [
      { id: 'ca13', description: 'Hold lot FB-2025-039 pending material review board decision', owner: 'Priya Sharma', dueDate: '2025-07-05', status: 'COMPLETED' },
    ],
    createdAt: '2025-07-02T09:00:00Z', updatedAt: '2025-07-18T14:00:00Z', closedAt: '2025-07-18T14:00:00Z', createdBy: 'Rajesh Kumar',
  },
  {
    id: 'nc11', ncNumber: 'NC-2025-0015', title: 'Paint adhesion failure on structural frames',
    description: 'Cross-hatch adhesion test on painted structural frames shows 30% paint loss (Grade 4B) against requirement of ≥ Grade 4B (≤5% loss). Batch PF-2025-021.',
    type: 'PROCESS_NC', severity: 'MINOR', status: 'CLOSED',
    source: 'Final Inspection', department: 'Quality Control', departmentId: 'dept3',
    productProcess: 'Surface Coating', batchLot: 'PF-2025-021',
    assignedTo: 'Sunita Rao', assignedToId: 'u5', dueDate: '2025-05-30',
    priorityJustification: null, containmentActions: [
      { id: 'ca14', description: 'Strip and re-coat affected frames', owner: 'Sunita Rao', dueDate: '2025-05-20', status: 'COMPLETED' },
    ],
    createdAt: '2025-05-14T11:00:00Z', updatedAt: '2025-06-02T09:00:00Z', closedAt: '2025-06-02T09:00:00Z', createdBy: 'Anita Desai',
  },
  {
    id: 'nc12', ncNumber: 'NC-2025-0008', title: 'Incorrect material substitution on flange order',
    description: 'ASTM A105 carbon steel flanges supplied against order requiring ASTM A182 F316L stainless steel flanges for order ORD-2025-112.',
    type: 'COMPLAINT', severity: 'CRITICAL', status: 'CLOSED',
    source: 'Customer Complaint', department: 'Quality Assurance', departmentId: 'dept1',
    productProcess: null, batchLot: 'FLG-2025-012',
    assignedTo: 'Priya Sharma', assignedToId: 'u1', dueDate: '2025-03-10',
    priorityJustification: 'Safety-critical application — offshore piping. Customer has halted installation.',
    containmentActions: [
      { id: 'ca15', description: 'Expedite replacement F316L flanges from approved supplier', owner: 'Priya Sharma', dueDate: '2025-03-05', status: 'COMPLETED' },
    ],
    createdAt: '2025-02-28T10:00:00Z', updatedAt: '2025-03-12T16:00:00Z', closedAt: '2025-03-12T16:00:00Z', createdBy: 'Rajesh Kumar',
  },
  // ── 2024 records ──
  {
    id: 'nc13', ncNumber: 'NC-2024-0045', title: 'Weld undercut exceeding ASME IX limits',
    description: 'Visual inspection revealed weld undercut of 0.8mm depth on pressure vessel shell WS-2024-088, exceeding ASME Section IX limit of 0.4mm.',
    type: 'PROCESS_NC', severity: 'CRITICAL', status: 'CLOSED',
    source: 'Internal Audit', department: 'Production', departmentId: 'dept2',
    productProcess: 'Welding', batchLot: 'WS-2024-088',
    assignedTo: 'Vikram Patel', assignedToId: 'u4', dueDate: '2024-11-20',
    priorityJustification: 'Code-witnessed pressure vessel; radiography required before re-inspection.',
    containmentActions: [
      { id: 'ca16', description: 'Remove vessel from service pending NDE re-inspection', owner: 'Vikram Patel', dueDate: '2024-11-10', status: 'COMPLETED' },
    ],
    createdAt: '2024-11-05T14:00:00Z', updatedAt: '2024-11-22T10:00:00Z', closedAt: '2024-11-22T10:00:00Z', createdBy: 'Deepak Nair',
  },
  {
    id: 'nc14', ncNumber: 'NC-2024-0038', title: 'Hardness out-of-specification on heat-treated shafts',
    description: 'Hardness survey on lot HS-2024-072 shows average 42 HRC against spec of 45–50 HRC. Insufficient austenitising temperature identified as root cause.',
    type: 'OOS', severity: 'MAJOR', status: 'CLOSED',
    source: 'In-Process Inspection', department: 'Quality Control', departmentId: 'dept3',
    productProcess: 'Heat Treatment', batchLot: 'HS-2024-072',
    assignedTo: 'Anita Desai', assignedToId: 'u3', dueDate: '2024-09-30',
    priorityJustification: null, containmentActions: [
      { id: 'ca17', description: 'Re-heat-treat lot HS-2024-072 at corrected temperature', owner: 'Anita Desai', dueDate: '2024-09-25', status: 'COMPLETED' },
    ],
    createdAt: '2024-09-18T09:30:00Z', updatedAt: '2024-10-02T11:00:00Z', closedAt: '2024-10-02T11:00:00Z', createdBy: 'Priya Sharma',
  },
  {
    id: 'nc15', ncNumber: 'NC-2024-0027', title: 'Incorrect torque applied to critical fasteners',
    description: 'Post-assembly audit found 6 critical bolted joints on pump assembly PA-2024-055 torqued to 180 Nm against requirement of 220 Nm. Attributed to uncalibrated torque wrench.',
    type: 'PROCESS_NC', severity: 'MAJOR', status: 'CLOSED',
    source: 'Internal Audit', department: 'Production', departmentId: 'dept2',
    productProcess: 'Assembly', batchLot: 'PA-2024-055',
    assignedTo: 'Vikram Patel', assignedToId: 'u4', dueDate: '2024-07-15',
    priorityJustification: null, containmentActions: [
      { id: 'ca18', description: 'Re-torque all critical joints in PA-2024-055', owner: 'Vikram Patel', dueDate: '2024-07-08', status: 'COMPLETED' },
      { id: 'ca19', description: 'Withdraw uncalibrated torque wrench TW-14 from service', owner: 'Deepak Nair', dueDate: '2024-07-06', status: 'COMPLETED' },
    ],
    createdAt: '2024-07-04T08:00:00Z', updatedAt: '2024-07-17T14:00:00Z', closedAt: '2024-07-17T14:00:00Z', createdBy: 'Rajesh Kumar',
  },
  {
    id: 'nc16', ncNumber: 'NC-2024-0014', title: 'Surface contamination on precision ground components',
    description: 'Corrosion spots found on 18 precision ground shafts from lot PG-2024-028 during pre-dispatch inspection. Attributed to failure of rust inhibitor application step.',
    type: 'PRODUCT_NC', severity: 'MINOR', status: 'CLOSED',
    source: 'Final Inspection', department: 'Quality Control', departmentId: 'dept3',
    productProcess: 'Grinding', batchLot: 'PG-2024-028',
    assignedTo: 'Sunita Rao', assignedToId: 'u5', dueDate: '2024-04-20',
    priorityJustification: null, containmentActions: [
      { id: 'ca20', description: 'Clean, re-apply inhibitor and repack affected shafts', owner: 'Sunita Rao', dueDate: '2024-04-15', status: 'COMPLETED' },
    ],
    createdAt: '2024-04-10T10:00:00Z', updatedAt: '2024-04-22T09:00:00Z', closedAt: '2024-04-22T09:00:00Z', createdBy: 'Anita Desai',
  },
  {
    id: 'nc17', ncNumber: 'NC-2024-0005', title: 'Substandard raw material from new supplier',
    description: 'Tensile testing of steel bar stock from new supplier batch SB-2024-007 shows Yield Strength of 230 MPa vs. minimum requirement of 250 MPa.',
    type: 'DEVIATION', severity: 'CRITICAL', status: 'CLOSED',
    source: 'Incoming Inspection', department: 'Quality Assurance', departmentId: 'dept1',
    productProcess: null, batchLot: 'SB-2024-007',
    assignedTo: 'Priya Sharma', assignedToId: 'u1', dueDate: '2024-02-15',
    priorityJustification: 'Structural components; reject and return to supplier. New supplier qualification suspended.',
    containmentActions: [
      { id: 'ca21', description: 'Reject lot SB-2024-007 and initiate return to supplier', owner: 'Priya Sharma', dueDate: '2024-02-08', status: 'COMPLETED' },
    ],
    createdAt: '2024-02-05T09:00:00Z', updatedAt: '2024-02-18T11:00:00Z', closedAt: '2024-02-18T11:00:00Z', createdBy: 'Rajesh Kumar',
  },
];

// ── Hooks ────────────────────────────────────────────────────────────────────

const flattenNC = (nc: Record<string, unknown>) =>
  flattenUsers(nc, ['assignedTo', 'reportedBy']);

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
        const { data: payload } = await api.get('/qms/non-conformances', { params: filters });
        return unwrapList<NonConformance>(payload, flattenNC as any);
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
        const { data: payload } = await api.get(`/qms/non-conformances/${id}`);
        return unwrapItem<NonConformance>(payload, flattenNC as any);
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
