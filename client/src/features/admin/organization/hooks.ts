import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface Organization {
  id: string;
  name: string;
  tenantCode: string;
  industry: string;
  website: string | null;
  address: string | null;
  standards: string[];
  timezone: string;
  dateFormat: string;
  logoUrl: string | null;
  reportFooterText: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UpdateOrganizationInput = Partial<
  Omit<Organization, 'id' | 'createdAt' | 'updatedAt'>
>;

export function useOrganization() {
  return useQuery({
    queryKey: ['organization'],
    queryFn: async () => {
      const { data } = await api.get('/organization');
      return data as Organization;
    },
  });
}

export function useIndustries() {
  return useQuery({
    queryKey: ['organization', 'industries'],
    queryFn: async () => {
      const { data } = await api.get('/organization/industries');
      return Array.isArray(data) ? (data as string[]) : [];
    },
    staleTime: 60 * 60_000,
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: UpdateOrganizationInput) => {
      const { data } = await api.put('/organization', body);
      return data as Organization;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['organization'] }),
  });
}

export const SUGGESTED_STANDARDS_BY_INDUSTRY: Record<string, string[]> = {
  Pharmaceuticals: ['ISO 9001', 'GMP', '21 CFR Part 11', 'ICH Q10'],
  Automotive: ['IATF 16949', 'ISO 9001', 'VDA 6.3'],
  Chemical: ['ISO 9001', 'ISO 14001', 'REACH', 'RC 14001'],
  FMCG: ['ISO 22000', 'HACCP', 'FSSC 22000', 'BRCGS'],
  'Food & Beverage': ['ISO 22000', 'HACCP', 'FSSC 22000', 'BRCGS'],
  'Medical Devices': ['ISO 13485', '21 CFR Part 820', 'MDR'],
  Electronics: ['ISO 9001', 'IPC', 'RoHS'],
  Aerospace: ['AS9100', 'ISO 9001'],
  Manufacturing: ['ISO 9001', 'ISO 14001', 'ISO 45001'],
  Other: [],
};
