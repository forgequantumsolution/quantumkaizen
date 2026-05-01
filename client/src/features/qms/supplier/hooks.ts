import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { unwrapList, unwrapItem } from '@/lib/apiShape';
import toast from 'react-hot-toast';

// Backend supplier shape differs from the UI's expected shape in a few places:
//   • `companyName` → `name`
//   • `supplierCode` → `code`
//   • `productsServices` is a delimited string → the UI expects string[]
//   • `status` can be SUSPENDED (not in the client's badge map)
// Normalize once at the hook boundary so every page below just works.
function normalizeSupplier(s: any) {
  if (!s || typeof s !== 'object') return s;
  const rawProducts = s.productsServices;
  let products: string[] = [];
  if (Array.isArray(rawProducts)) products = rawProducts;
  else if (typeof rawProducts === 'string' && rawProducts.trim())
    products = rawProducts.split(/[,;|]/).map((p: string) => p.trim()).filter(Boolean);
  // Backend exposes qualityScore + deliveryScore (0-100). UI expects `rating`
  // on a 0-5 star scale. Map if absent.
  let rating = typeof s.rating === 'number' ? s.rating : undefined;
  if (rating == null) {
    const q = typeof s.qualityScore === 'number' ? s.qualityScore : undefined;
    const d = typeof s.deliveryScore === 'number' ? s.deliveryScore : undefined;
    if (q != null || d != null) {
      const avg100 = ((q ?? 0) + (d ?? 0)) / ((q != null && d != null) ? 2 : 1);
      rating = Math.round((avg100 / 20) * 10) / 10; // 0-5 with one decimal
    } else {
      rating = 0;
    }
  }
  return {
    ...s,
    name: s.name ?? s.companyName ?? '',
    code: s.code ?? s.supplierCode ?? '',
    productsServices: products,
    rating,
  };
}

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
        return unwrapList<Supplier>(data, normalizeSupplier);
      } catch {
        return { data: [] as Supplier[], total: 0, page: 1, pageSize: 20, totalPages: 0 };
      }
    },
    staleTime: 30_000,
  });
}

export function useSupplier(id: string) {
  return useQuery<Supplier | null>({
    queryKey: ['suppliers', id],
    queryFn: async () => {
      try {
        const { data } = await api.get(`/qms/suppliers/${id}`);
        const item = unwrapItem<Supplier>(data, normalizeSupplier);
        return (item?.id ? item : null) as Supplier | null;
      } catch {
        return null;
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
