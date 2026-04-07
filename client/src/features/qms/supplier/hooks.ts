import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import toast from 'react-hot-toast';

// ── Types ───────────────────────────────────────────────────────────────────

export type SupplierStatus = 'APPROVED' | 'CONDITIONAL' | 'PENDING' | 'DISQUALIFIED';
export type SupplierCategory = 'CRITICAL' | 'MAJOR' | 'MINOR';

export interface SupplierCertification {
  id: string;
  name: string;
  certificateNumber: string;
  issuedBy: string;
  issuedDate: string;
  expiryDate: string;
  status: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED';
}

export interface SupplierAudit {
  id: string;
  type: string;
  date: string;
  auditor: string;
  score: number;
  status: 'COMPLETED' | 'SCHEDULED' | 'OVERDUE';
  findings: string;
  ncCount: number;
}

export interface SupplierPerformance {
  quality: number;
  delivery: number;
  cost: number;
  responsiveness: number;
  innovation: number;
  overallScore: number;
  monthlyTrend: { month: string; score: number }[];
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  category: SupplierCategory;
  status: SupplierStatus;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  productsServices: string[];
  rating: number;
  certifications: SupplierCertification[];
  audits: SupplierAudit[];
  performance: SupplierPerformance;
  certExpiry: string;
  lastAuditDate: string;
  createdAt: string;
  updatedAt: string;
}

// ── Mock Data ───────────────────────────────────────────────────────────────

export const mockSuppliers: Supplier[] = [
  {
    id: 'sup1',
    code: 'SUP-001',
    name: 'Tata Steel Ltd',
    category: 'CRITICAL',
    status: 'APPROVED',
    contactPerson: 'Arun Mehta',
    email: 'arun.mehta@tatasteel.com',
    phone: '+91 657 242 5555',
    address: 'Bistupur, Jamshedpur',
    city: 'Jamshedpur',
    state: 'Jharkhand',
    productsServices: ['Hot Rolled Steel Plates', 'Cold Rolled Sheets', 'Alloy Steel Bars'],
    rating: 4.5,
    certifications: [
      { id: 'cert1', name: 'ISO 9001:2015', certificateNumber: 'QMS-TS-2024-001', issuedBy: 'Bureau Veritas', issuedDate: '2024-06-15', expiryDate: '2027-06-14', status: 'VALID' },
      { id: 'cert2', name: 'ISO 14001:2015', certificateNumber: 'EMS-TS-2024-002', issuedBy: 'Bureau Veritas', issuedDate: '2024-06-15', expiryDate: '2027-06-14', status: 'VALID' },
      { id: 'cert3', name: 'IATF 16949:2016', certificateNumber: 'IATF-TS-2024-003', issuedBy: 'TUV SUD', issuedDate: '2024-08-01', expiryDate: '2027-07-31', status: 'VALID' },
    ],
    audits: [
      { id: 'aud1', type: 'Supplier Quality Audit', date: '2026-01-15', auditor: 'Priya Sharma', score: 92, status: 'COMPLETED', findings: 'Minor observation on incoming inspection records', ncCount: 0 },
      { id: 'aud2', type: 'Process Audit', date: '2026-07-15', auditor: 'Vikram Patel', score: 0, status: 'SCHEDULED', findings: '', ncCount: 0 },
    ],
    performance: {
      quality: 95, delivery: 88, cost: 82, responsiveness: 90, innovation: 75,
      overallScore: 86,
      monthlyTrend: [
        { month: 'Oct', score: 84 }, { month: 'Nov', score: 85 }, { month: 'Dec', score: 87 },
        { month: 'Jan', score: 86 }, { month: 'Feb', score: 85 }, { month: 'Mar', score: 86 },
      ],
    },
    certExpiry: '2027-06-14',
    lastAuditDate: '2026-01-15',
    createdAt: '2023-04-10T10:00:00Z',
    updatedAt: '2026-03-20T14:00:00Z',
  },
  {
    id: 'sup2',
    code: 'SUP-002',
    name: 'Mahindra Forge Ltd',
    category: 'CRITICAL',
    status: 'APPROVED',
    contactPerson: 'Kavita Joshi',
    email: 'kavita.joshi@mahindraforge.com',
    phone: '+91 20 6648 1500',
    address: 'Mundhwa, Pune',
    city: 'Pune',
    state: 'Maharashtra',
    productsServices: ['Forged Crankshafts', 'Connecting Rods', 'Forged Flanges'],
    rating: 4.2,
    certifications: [
      { id: 'cert4', name: 'ISO 9001:2015', certificateNumber: 'QMS-MF-2023-010', issuedBy: 'DNV GL', issuedDate: '2023-09-01', expiryDate: '2026-08-31', status: 'VALID' },
      { id: 'cert5', name: 'IATF 16949:2016', certificateNumber: 'IATF-MF-2023-011', issuedBy: 'DNV GL', issuedDate: '2023-09-01', expiryDate: '2026-08-31', status: 'VALID' },
    ],
    audits: [
      { id: 'aud3', type: 'Supplier Quality Audit', date: '2025-11-20', auditor: 'Deepak Nair', score: 88, status: 'COMPLETED', findings: 'Two minor NCs on traceability', ncCount: 2 },
    ],
    performance: {
      quality: 90, delivery: 85, cost: 78, responsiveness: 88, innovation: 70,
      overallScore: 82,
      monthlyTrend: [
        { month: 'Oct', score: 80 }, { month: 'Nov', score: 81 }, { month: 'Dec', score: 83 },
        { month: 'Jan', score: 82 }, { month: 'Feb', score: 81 }, { month: 'Mar', score: 82 },
      ],
    },
    certExpiry: '2026-08-31',
    lastAuditDate: '2025-11-20',
    createdAt: '2023-06-15T10:00:00Z',
    updatedAt: '2026-03-18T11:00:00Z',
  },
  {
    id: 'sup3',
    code: 'SUP-003',
    name: 'Bharat Heavy Electricals Ltd',
    category: 'CRITICAL',
    status: 'CONDITIONAL',
    contactPerson: 'Suresh Iyer',
    email: 'suresh.iyer@bhel.in',
    phone: '+91 11 2610 0694',
    address: 'Bharat Nagar, Haridwar',
    city: 'Haridwar',
    state: 'Uttarakhand',
    productsServices: ['Electric Motors', 'Transformers', 'Turbine Components'],
    rating: 3.4,
    certifications: [
      { id: 'cert6', name: 'ISO 9001:2015', certificateNumber: 'QMS-BHEL-2024-050', issuedBy: 'LRQA', issuedDate: '2024-03-01', expiryDate: '2027-02-28', status: 'VALID' },
      { id: 'cert7', name: 'ISO 14001:2015', certificateNumber: 'EMS-BHEL-2024-051', issuedBy: 'LRQA', issuedDate: '2024-03-01', expiryDate: '2027-02-28', status: 'VALID' },
    ],
    audits: [
      { id: 'aud4', type: 'Supplier Quality Audit', date: '2026-02-10', auditor: 'Anita Desai', score: 72, status: 'COMPLETED', findings: 'Major NC on process control; two minor NCs on documentation', ncCount: 3 },
      { id: 'aud5', type: 'Follow-up Audit', date: '2026-05-10', auditor: 'Anita Desai', score: 0, status: 'SCHEDULED', findings: '', ncCount: 0 },
    ],
    performance: {
      quality: 72, delivery: 65, cost: 85, responsiveness: 60, innovation: 55,
      overallScore: 67,
      monthlyTrend: [
        { month: 'Oct', score: 70 }, { month: 'Nov', score: 68 }, { month: 'Dec', score: 66 },
        { month: 'Jan', score: 65 }, { month: 'Feb', score: 67 }, { month: 'Mar', score: 67 },
      ],
    },
    certExpiry: '2027-02-28',
    lastAuditDate: '2026-02-10',
    createdAt: '2022-10-01T10:00:00Z',
    updatedAt: '2026-03-15T09:00:00Z',
  },
  {
    id: 'sup4',
    code: 'SUP-004',
    name: 'Sundaram Fasteners Ltd',
    category: 'MAJOR',
    status: 'APPROVED',
    contactPerson: 'Lakshmi Narayanan',
    email: 'lakshmi.n@sundaram.com',
    phone: '+91 44 2860 1100',
    address: 'Padi, Chennai',
    city: 'Chennai',
    state: 'Tamil Nadu',
    productsServices: ['High Strength Bolts', 'Nuts and Washers', 'Precision Fasteners'],
    rating: 4.3,
    certifications: [
      { id: 'cert8', name: 'ISO 9001:2015', certificateNumber: 'QMS-SF-2025-020', issuedBy: 'TUV Rheinland', issuedDate: '2025-01-15', expiryDate: '2028-01-14', status: 'VALID' },
      { id: 'cert9', name: 'IATF 16949:2016', certificateNumber: 'IATF-SF-2025-021', issuedBy: 'TUV Rheinland', issuedDate: '2025-01-15', expiryDate: '2028-01-14', status: 'VALID' },
    ],
    audits: [
      { id: 'aud6', type: 'Supplier Quality Audit', date: '2025-10-05', auditor: 'Priya Sharma', score: 90, status: 'COMPLETED', findings: 'Good quality system. One observation on calibration schedule.', ncCount: 0 },
    ],
    performance: {
      quality: 93, delivery: 91, cost: 80, responsiveness: 85, innovation: 72,
      overallScore: 84,
      monthlyTrend: [
        { month: 'Oct', score: 83 }, { month: 'Nov', score: 84 }, { month: 'Dec', score: 84 },
        { month: 'Jan', score: 85 }, { month: 'Feb', score: 84 }, { month: 'Mar', score: 84 },
      ],
    },
    certExpiry: '2028-01-14',
    lastAuditDate: '2025-10-05',
    createdAt: '2023-08-20T10:00:00Z',
    updatedAt: '2026-03-10T16:00:00Z',
  },
  {
    id: 'sup5',
    code: 'SUP-005',
    name: 'Godrej Precision Engineering',
    category: 'MAJOR',
    status: 'APPROVED',
    contactPerson: 'Neha Kulkarni',
    email: 'neha.kulkarni@godrej.com',
    phone: '+91 22 6879 6000',
    address: 'Vikhroli, Mumbai',
    city: 'Mumbai',
    state: 'Maharashtra',
    productsServices: ['Precision Machined Components', 'Tooling', 'Jigs and Fixtures'],
    rating: 4.0,
    certifications: [
      { id: 'cert10', name: 'ISO 9001:2015', certificateNumber: 'QMS-GP-2024-030', issuedBy: 'SGS', issuedDate: '2024-11-01', expiryDate: '2027-10-31', status: 'VALID' },
    ],
    audits: [
      { id: 'aud7', type: 'Supplier Quality Audit', date: '2025-08-12', auditor: 'Vikram Patel', score: 85, status: 'COMPLETED', findings: 'Satisfactory. Minor improvement needed in SPC implementation.', ncCount: 1 },
    ],
    performance: {
      quality: 88, delivery: 82, cost: 76, responsiveness: 80, innovation: 68,
      overallScore: 79,
      monthlyTrend: [
        { month: 'Oct', score: 77 }, { month: 'Nov', score: 78 }, { month: 'Dec', score: 79 },
        { month: 'Jan', score: 79 }, { month: 'Feb', score: 80 }, { month: 'Mar', score: 79 },
      ],
    },
    certExpiry: '2027-10-31',
    lastAuditDate: '2025-08-12',
    createdAt: '2024-01-05T10:00:00Z',
    updatedAt: '2026-02-28T12:00:00Z',
  },
  {
    id: 'sup6',
    code: 'SUP-006',
    name: 'Hindustan Copper Ltd',
    category: 'MINOR',
    status: 'APPROVED',
    contactPerson: 'Amit Ghosh',
    email: 'amit.ghosh@hindustancopper.com',
    phone: '+91 657 220 3001',
    address: 'Moubhandar, Ghatsila',
    city: 'Ghatsila',
    state: 'Jharkhand',
    productsServices: ['Copper Busbars', 'Copper Wire'],
    rating: 3.8,
    certifications: [
      { id: 'cert11', name: 'ISO 9001:2015', certificateNumber: 'QMS-HCL-2025-015', issuedBy: 'BSI', issuedDate: '2025-04-01', expiryDate: '2028-03-31', status: 'VALID' },
    ],
    audits: [
      { id: 'aud8', type: 'Desktop Assessment', date: '2025-12-01', auditor: 'Sunita Rao', score: 80, status: 'COMPLETED', findings: 'Adequate quality system for material supply.', ncCount: 0 },
    ],
    performance: {
      quality: 82, delivery: 78, cost: 88, responsiveness: 75, innovation: 60,
      overallScore: 77,
      monthlyTrend: [
        { month: 'Oct', score: 76 }, { month: 'Nov', score: 77 }, { month: 'Dec', score: 77 },
        { month: 'Jan', score: 78 }, { month: 'Feb', score: 77 }, { month: 'Mar', score: 77 },
      ],
    },
    certExpiry: '2028-03-31',
    lastAuditDate: '2025-12-01',
    createdAt: '2024-05-15T10:00:00Z',
    updatedAt: '2026-01-20T09:00:00Z',
  },
  {
    id: 'sup7',
    code: 'SUP-007',
    name: 'Kirloskar Pneumatic Co.',
    category: 'MAJOR',
    status: 'PENDING',
    contactPerson: 'Ramesh Deshmukh',
    email: 'ramesh.deshmukh@kirloskar.com',
    phone: '+91 20 2444 0055',
    address: 'Hadapsar, Pune',
    city: 'Pune',
    state: 'Maharashtra',
    productsServices: ['Pneumatic Cylinders', 'Compressor Valves', 'Air Dryers'],
    rating: 0,
    certifications: [
      { id: 'cert12', name: 'ISO 9001:2015', certificateNumber: 'QMS-KP-2024-040', issuedBy: 'Intertek', issuedDate: '2024-07-01', expiryDate: '2027-06-30', status: 'VALID' },
    ],
    audits: [],
    performance: {
      quality: 0, delivery: 0, cost: 0, responsiveness: 0, innovation: 0,
      overallScore: 0,
      monthlyTrend: [],
    },
    certExpiry: '2027-06-30',
    lastAuditDate: '',
    createdAt: '2026-03-15T10:00:00Z',
    updatedAt: '2026-03-15T10:00:00Z',
  },
  {
    id: 'sup8',
    code: 'SUP-008',
    name: 'Jayaswal Neco Industries',
    category: 'MAJOR',
    status: 'DISQUALIFIED',
    contactPerson: 'Sanjay Agrawal',
    email: 'sanjay.a@jayaswalneco.com',
    phone: '+91 712 222 1234',
    address: 'Kamptee Road, Nagpur',
    city: 'Nagpur',
    state: 'Maharashtra',
    productsServices: ['Cast Iron Components', 'Steel Castings'],
    rating: 2.1,
    certifications: [
      { id: 'cert13', name: 'ISO 9001:2015', certificateNumber: 'QMS-JN-2023-008', issuedBy: 'Bureau Veritas', issuedDate: '2023-02-01', expiryDate: '2026-01-31', status: 'EXPIRED' },
    ],
    audits: [
      { id: 'aud9', type: 'Supplier Quality Audit', date: '2025-06-15', auditor: 'Deepak Nair', score: 48, status: 'COMPLETED', findings: 'Major NCs on quality control, traceability, and calibration. Corrective actions not implemented from previous audit.', ncCount: 5 },
    ],
    performance: {
      quality: 45, delivery: 52, cost: 90, responsiveness: 40, innovation: 30,
      overallScore: 51,
      monthlyTrend: [
        { month: 'Oct', score: 55 }, { month: 'Nov', score: 53 }, { month: 'Dec', score: 50 },
        { month: 'Jan', score: 48 }, { month: 'Feb', score: 50 }, { month: 'Mar', score: 51 },
      ],
    },
    certExpiry: '2026-01-31',
    lastAuditDate: '2025-06-15',
    createdAt: '2022-06-01T10:00:00Z',
    updatedAt: '2025-12-01T09:00:00Z',
  },
];

// ── Hooks ───────────────────────────────────────────────────────────────────

interface SupplierFilters {
  status?: string;
  category?: string;
  search?: string;
}

export function useSuppliers(filters: SupplierFilters = {}) {
  return useQuery({
    queryKey: ['suppliers', filters],
    queryFn: async () => {
      try {
        const { data } = await api.get('/qms/suppliers', { params: filters });
        return data;
      } catch {
        let filtered = [...mockSuppliers];
        if (filters.status) filtered = filtered.filter((s) => s.status === filters.status);
        if (filters.category) filtered = filtered.filter((s) => s.category === filters.category);
        if (filters.search) {
          const q = filters.search.toLowerCase();
          filtered = filtered.filter(
            (s) =>
              s.name.toLowerCase().includes(q) ||
              s.code.toLowerCase().includes(q),
          );
        }
        return { data: filtered, total: filtered.length, page: 1, pageSize: 20, totalPages: 1 };
      }
    },
    staleTime: 30_000,
  });
}

export function useSupplier(id: string) {
  return useQuery<Supplier>({
    queryKey: ['suppliers', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/suppliers/${id}`);
        return data;
      } catch {
        const supplier = mockSuppliers.find((s) => s.id === id);
        if (!supplier) throw new Error('Supplier not found');
        return supplier;
      }
    },
    enabled: !!id,
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data } = await api.post('/qms/suppliers', payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('Supplier added successfully');
    },
    onError: () => {
      toast.error('Failed to add supplier');
    },
  });
}
