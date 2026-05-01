import { z } from 'zod';

export const INDUSTRIES = [
  'Pharmaceuticals',
  'Automotive',
  'Chemical',
  'FMCG',
  'Food & Beverage',
  'Medical Devices',
  'Electronics',
  'Aerospace',
  'Manufacturing',
  'Other',
] as const;

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  tenantCode: z.string().min(1).max(40).optional(),
  industry: z.enum(INDUSTRIES).optional(),
  website: z.string().url().or(z.literal('')).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  standards: z.array(z.string().min(1).max(60)).max(20).optional(),
  timezone: z.string().max(60).optional(),
  dateFormat: z.string().max(20).optional(),
  logoUrl: z.string().url().or(z.literal('')).optional().nullable(),
});

export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>;
export type Industry = (typeof INDUSTRIES)[number];
