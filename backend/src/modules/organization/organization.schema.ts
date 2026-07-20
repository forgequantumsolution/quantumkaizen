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

// Logo may be an http(s) URL or an inline base64 data-URL (png/jpeg/svg).
const LogoValue = z
  .string()
  .refine(
    (v) => v === '' || /^https?:\/\//.test(v) || /^data:image\/(png|jpe?g|svg\+xml);base64,/.test(v),
    { message: 'Logo must be an http(s) URL or a base64 image data-URL' },
  )
  // ~1MB base64 ceiling to keep the org record and report payload sane.
  .refine((v) => v.length <= 1_400_000, { message: 'Logo image is too large (max ~1MB)' });

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  tenantCode: z.string().min(1).max(40).optional(),
  industry: z.enum(INDUSTRIES).optional(),
  website: z.string().url().or(z.literal('')).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  standards: z.array(z.string().min(1).max(60)).max(20).optional(),
  timezone: z.string().max(60).optional(),
  dateFormat: z.string().max(20).optional(),
  logoUrl: LogoValue.optional().nullable(),
  reportFooterText: z.string().max(200).optional().nullable(),
});

export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>;
export type Industry = (typeof INDUSTRIES)[number];
